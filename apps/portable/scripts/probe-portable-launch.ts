/**
 * Acceptance probe for the launcher skeleton and portable run.
 *
 * The probe drives one assembled distribution the way a buyer would: it starts
 * `Launcher.exe` with an empty `PATH` and no reachable system Node.js or
 * Python, reads the interface it presents, starts the packaged application from
 * the menu, proves the authenticated interface answers, and then measures where
 * the state landed.
 *
 * It also proves the boundary Milestone 2 closed: with `product.yml` moved out
 * of the distribution, the launcher still presents the full product identity,
 * because identity is inlined at build time rather than read at run time.
 *
 * What identity to expect comes from the distribution's own `launcher-build.json`
 * rather than from a constant here, so the probe runs against any publisher's
 * product. It then follows the authenticated interface the way a browser does —
 * the served shell, then every plugin bundle the client boot graph tells the
 * client to fetch — proving the two palette logos were inlined as distinct data
 * URIs and that a served bundle carries the rule that swaps them.
 *
 * The distribution path is an argument, never a constant, and the probe writes
 * nothing inside the repository.
 */

import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, readFileSync } from 'node:fs'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type { LauncherLanguage } from '../src/launcher/identity.ts'
import { LAUNCHER_BUILD_RECORD_NAME, LAUNCHER_SETTINGS_NAME, PORTABLE_DATA_NAME } from '../src/launcher/layout.ts'
import { launcherMessages, type MessageDictionary } from '../src/launcher/messages.ts'

/** Product executable this probe drives. */
const LAUNCHER_EXECUTABLE = 'Launcher.exe'
/** Build record the launcher build writes beside the executable. */
const LAUNCHER_BUILD_RECORD = LAUNCHER_BUILD_RECORD_NAME
/** Portable settings file the probe asserts the launcher left alone. */
const PORTABLE_SETTINGS = join(PORTABLE_DATA_NAME, LAUNCHER_SETTINGS_NAME)
/** Time the launcher has to reach its menu. */
const MENU_TIMEOUT_MS = 60_000
/** Time the packaged application has to announce its URL through the launcher. */
const READY_TIMEOUT_MS = 180_000
/** Launch language this probe asserts against, selected from the host locale. */
const ANNOUNCED_URL = /http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/u
/** Every asset the authenticated bootstrap references by relative path. */
const BOOTSTRAP_ASSET = /(?:src|href)="([^"?]+\.(?:css|js))"/gu
/**
 * Selector the brand stylesheet uses to hide the palette a theme does not want.
 *
 * Only that stylesheet writes the negated form; the platform's own token blocks
 * use the bare attribute, so matching the negation proves the swap shipped
 * rather than merely that the client knows about themes at all.
 */
const PALETTE_SWAP_SELECTOR = ':not([data-ds-dark-theme])'
/** Inlined product logo, as the client bundle carries it. */
const INLINED_PNG_DATA_URI = /data:image\/png;base64,[A-Za-z0-9+/=]+/gu
/** Assignment the host writes before the client boot graph it serves. */
const BOOT_GRAPH = 'globalThis["__DSH_BOOT__"] = '
/** Interface languages the launcher's own message dictionary can present in. */
const LAUNCHER_LANGUAGES: readonly LauncherLanguage[] = ['zh-CN', 'en']

/** One measured directory tree. */
interface TreeMeasure {
  readonly bytes: number
  readonly files: number
}

/** Everything one launcher session produced. */
interface Session {
  /** Every line the launcher wrote to standard output. */
  readonly lines: readonly string[]
  /** Every line the launcher wrote to standard error. */
  readonly errors: readonly string[]
  /** The process exit code, once it has exited. */
  readonly code: number | null
}

function measureTree(path: string): TreeMeasure {
  const status = lstatSync(path)
  if (status.isSymbolicLink()) throw new Error(`portable launcher probe refuses filesystem link ${path}`)
  if (status.isFile()) return { bytes: status.size, files: 1 }
  if (!status.isDirectory()) throw new Error(`portable launcher probe requires regular files and directories, found ${path}`)
  let bytes = 0
  let files = 0
  for (const entry of readdirSync(path)) {
    const measured = measureTree(join(path, entry))
    bytes += measured.bytes
    files += measured.files
  }
  return { bytes, files }
}

function measureIfPresent(path: string): TreeMeasure {
  return existsSync(path) ? measureTree(path) : { bytes: 0, files: 0 }
}

/** Every file one tree holds, relative to it, in a stable order. */
function inventory(path: string): string[] {
  if (!existsSync(path)) return []
  const found: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const absolute = join(current, entry)
      const status = lstatSync(absolute)
      if (status.isDirectory()) walk(absolute)
      else found.push(`${absolute.slice(path.length + 1)} (${String(status.size)} bytes)`)
    }
  }
  walk(path)
  return found
}

async function digest(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

/** Environment one isolated launcher session runs in. */
interface CleanEnvironment {
  /** Every variable the launcher and its child see. */
  readonly variables: NodeJS.ProcessEnv
  /** Directory `PATH` points at: present, and holding nothing. */
  readonly emptyPath: string
  /** Root the isolated host-side directories live under. */
  readonly host: string
}

function cleanEnvironment(scratch: string): CleanEnvironment {
  const emptyPath = join(scratch, 'empty-path')
  const host = join(scratch, 'host')
  for (const path of [emptyPath, join(host, 'app-data'), join(host, 'local-app-data'), join(host, 'temp')]) {
    mkdirSync(path, { recursive: true })
  }
  return {
    emptyPath,
    host,
    variables: {
      // Nothing is resolvable by name: the launcher and the application it
      // starts can only use the executables this distribution ships.
      PATH: emptyPath,
      SystemRoot: process.env.SystemRoot,
      // Every location a well-behaved Windows program may treat as its own is
      // redirected here, so anything the run writes outside the medium shows up
      // in one measurable place instead of the operator's real profile.
      TEMP: join(host, 'temp'),
      TMP: join(host, 'temp'),
      USERPROFILE: host,
      APPDATA: join(host, 'app-data'),
      LOCALAPPDATA: join(host, 'local-app-data'),
    },
  }
}

/** Start one launcher session and collect its output. */
function start(distribution: string, environment: CleanEnvironment, answers: readonly string[]): {
  readonly child: ChildProcessWithoutNullStreams
  readonly done: Promise<Session>
  readonly session: { lines: string[]; errors: string[] }
} {
  const child = spawn(join(distribution, LAUNCHER_EXECUTABLE), [], {
    cwd: distribution,
    env: environment.variables,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const session = { lines: [] as string[], errors: [] as string[] }
  const split = (text: string, sink: string[]): void => {
    for (const line of text.split(/\r?\n/u)) if (line !== '') sink.push(line)
  }
  child.stdout.on('data', (chunk: Buffer) => { split(chunk.toString(), session.lines) })
  child.stderr.on('data', (chunk: Buffer) => { split(chunk.toString(), session.errors) })
  for (const answer of answers) child.stdin.write(`${answer}\n`)
  const done = new Promise<Session>((accept, reject) => {
    const timer = setTimeout(() => reject(new Error(`launcher did not exit; it printed:\n${session.lines.join('\n')}`)), MENU_TIMEOUT_MS)
    child.once('error', reject)
    child.once('close', (code) => {
      clearTimeout(timer)
      accept({ lines: session.lines, errors: session.errors, code })
    })
  })
  return { child, done, session }
}

/** Wait for the launcher to print a line matching one pattern. */
async function waitForLine(
  session: { lines: string[] },
  pattern: RegExp,
  timeoutMs: number,
  what: string,
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const found = session.lines.find(line => pattern.test(line))
    if (found !== undefined) return found
    if (Date.now() > deadline) {
      throw new Error(`launcher never reported ${what}; it printed:\n${session.lines.join('\n')}`)
    }
    await new Promise(accept => setTimeout(accept, 100))
  }
}

/** Plugin bundles the served client boot graph tells the browser to fetch. */
interface BootGraph {
  /** One bundle URL per composed entry, in the order the client requests them. */
  readonly entries: readonly string[]
  /** One bundle URL per initial combo script. */
  readonly batches: readonly string[]
}

/**
 * Read the client boot graph the host inlined into the authenticated bootstrap.
 *
 * The graph is what the client module system resolves every plugin against, so
 * a bundle it does not name is a bundle the browser never fetches. Reading it is
 * how the probe follows the interface the way a client does, instead of
 * assuming which served file happens to carry the publisher's brand.
 *
 * @param html - the authenticated bootstrap document.
 * @returns the entry and batch bundle URLs the graph advertises.
 * @throws When the document carries no graph, or a graph of an unexpected shape.
 */
function bootGraph(html: string): BootGraph {
  const at = html.indexOf(BOOT_GRAPH)
  if (at < 0) throw new Error('the authenticated interface carried no client boot graph')
  const end = html.indexOf('</script>', at)
  if (end < 0) throw new Error('the client boot graph was not terminated by its script element')
  const raw = html.slice(at + BOOT_GRAPH.length, end).trim().replace(/;$/u, '')
  const parsed = JSON.parse(raw) as { entries?: unknown; batches?: unknown }
  const read = (list: unknown, field: string): string[] => {
    if (!Array.isArray(list)) throw new Error(`the client boot graph carried no ${field} list`)
    return list.map((row, index) => {
      const url = (row as { url?: unknown }).url
      if (typeof url !== 'string' || url === '') {
        throw new Error(`the client boot graph ${field}[${String(index)}] carried no bundle URL`)
      }
      return url
    })
  }
  return { entries: read(parsed.entries, 'entry'), batches: read(parsed.batches, 'batch') }
}

/** What following the authenticated interface to its assets proved. */
interface InterfaceEvidence {
  readonly exchangeStatus: number
  readonly bootstrapBytes: number
  /** Distinct inlined product logos the served client bundles carry. */
  readonly logoDataUris: number
  /** Whether a served bundle carries the palette-swap selector. */
  readonly paletteSwap: boolean
  /** Plugin bundles the client boot graph told the browser to fetch. */
  readonly bootBundles: number
}

/** Follow the launch token the way a browser does and prove the interface answers. */
async function reachInterface(url: string): Promise<InterfaceEvidence> {
  const exchange = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = exchange.headers.get('set-cookie')
  if (setCookie === null) throw new Error('the launch token exchange returned no authentication cookie')
  const cookie = setCookie.split(';', 1)[0]
  if (cookie === undefined || cookie === '') throw new Error('the launch token exchange returned an empty authentication cookie')
  const origin = new URL(url).origin
  const response = await fetch(`${origin}/`, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  const body = await response.text()
  if (!response.ok || !body.includes('__DSH_BOOT__')) {
    throw new Error(`the application answered HTTP ${String(response.status)} without its authenticated interface`)
  }
  const assetPaths = [...body.matchAll(BOOTSTRAP_ASSET)].map(match => match[1]!)
  if (assetPaths.length === 0) throw new Error('the authenticated interface referenced no JavaScript or CSS asset')
  const graph = bootGraph(body)
  if (graph.entries.length === 0) {
    throw new Error(
      'the client boot graph carried no plugin entry, so the packaged application serves the shell alone '
      + 'and no publisher brand — or any other client plugin — can reach the browser',
    )
  }
  const logos = new Set<string>()
  let paletteSwap = false
  for (const assetPath of new Set([...assetPaths, ...graph.batches, ...graph.entries])) {
    const asset = await fetch(new URL(assetPath, `${origin}/`), { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
    if (!asset.ok) throw new Error(`the interface asset ${assetPath} answered HTTP ${String(asset.status)}`)
    const source = await asset.text()
    if (source === '') throw new Error(`the interface asset ${assetPath} was empty`)
    // A plugin bundle carries its own CSS: the client build compiles each
    // stylesheet into the bundle and injects it as a style element, so the
    // palette rule arrives inside a script rather than in a served `.css`.
    if (source.includes(PALETTE_SWAP_SELECTOR)) paletteSwap = true
    for (const logo of source.match(INLINED_PNG_DATA_URI) ?? []) logos.add(logo)
  }
  if (logos.size < 2) {
    throw new Error(`the client carried ${String(logos.size)} inlined product logo(s); a product build inlines a light and a dark one`)
  }
  if (!paletteSwap) {
    throw new Error(`no served bundle carried ${PALETTE_SWAP_SELECTOR}; both palette logos would show at once`)
  }
  return {
    exchangeStatus: exchange.status,
    bootstrapBytes: body.length,
    logoDataUris: logos.size,
    paletteSwap,
    bootBundles: graph.batches.length + graph.entries.length,
  }
}

/**
 * Read the identity the launcher build recorded beside its executable.
 *
 * The probe checks what the launcher presents against this record, so it drives
 * any publisher's distribution without a constant here and never reads
 * `product.yml` — the file the launcher itself is forbidden to open.
 *
 * @param distribution - absolute distribution root.
 * @returns the recorded version and the distinct titles the menu can show.
 * @throws When the record is missing or does not carry what the menu presents.
 */
function readBuildRecord(distribution: string): { readonly version: string; readonly titles: readonly string[] } {
  const path = join(distribution, LAUNCHER_BUILD_RECORD)
  if (!existsSync(path)) throw new Error(`--distribution does not contain ${LAUNCHER_BUILD_RECORD}: ${path}`)
  const record = JSON.parse(readFileSync(path, 'utf8')) as {
    product?: { version?: unknown; titleEn?: unknown; titleZh?: unknown }
  }
  const product = record.product
  const version = product?.version
  const titleEn = product?.titleEn
  const titleZh = product?.titleZh
  if (typeof version !== 'string' || version === ''
    || typeof titleEn !== 'string' || titleEn === ''
    || typeof titleZh !== 'string' || titleZh === '') {
    throw new Error(`${LAUNCHER_BUILD_RECORD} does not record the product version and both localized titles`)
  }
  return { version, titles: [...new Set([titleEn, titleZh])] }
}

/**
 * Resolve the interface language the launcher presented in, from its own labels.
 *
 * The probe takes the launcher's words from the product's message dictionary
 * rather than restating either language here, so the integrity verdict is read
 * as text the launcher itself chose: a distribution reported as damaged or
 * unreadable is told apart from a verified one without the probe carrying a copy
 * of the wording that distinguishes them.
 *
 * @param lines - every line the launcher wrote to standard output.
 * @returns the presented language and its dictionary.
 * @throws When no line carries the integrity label in either language.
 */
function presentedMessages(lines: readonly string[]): {
  readonly language: LauncherLanguage
  readonly messages: MessageDictionary
} {
  for (const language of LAUNCHER_LANGUAGES) {
    const messages = launcherMessages(language)
    if (lines.some(line => line.startsWith(`${messages['label.integrity']}: `))) return { language, messages }
  }
  throw new Error(`the launcher presented no integrity line in either interface language:\n${lines.join('\n')}`)
}

/** Report whether the host itself can resolve an interpreter by name. */
function hostInterpreter(name: string): string {
  const found = spawnSync('where', [name], { encoding: 'utf8' })
  const first = found.status === 0 ? found.stdout.split(/\r?\n/u).find(line => line.trim() !== '') : undefined
  return first === undefined ? 'absent from the host PATH' : first.trim()
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { distribution: { type: 'string' }, out: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.distribution === undefined || !isAbsolute(values.distribution)) {
    throw new Error('--distribution must name the absolute root of an assembled distribution')
  }
  const distribution = resolve(values.distribution)
  const launcher = join(distribution, LAUNCHER_EXECUTABLE)
  if (!statSync(launcher).isFile()) throw new Error(`--distribution does not contain ${LAUNCHER_EXECUTABLE}: ${launcher}`)
  const recorded = readBuildRecord(distribution)
  // The header line is the title, two spaces, and the version. Matching on the
  // version rather than on a title keeps the probe product-agnostic, and a
  // product whose two localized titles are equal is not a language the probe
  // can tell apart, which it reports rather than guesses.
  const headline = `  ${recorded.version}`

  const scratch = mkdtempSync(join(tmpdir(), 'dsh-portable-launcher-probe-'))
  const environment = cleanEnvironment(scratch)
  const home = join(distribution, PORTABLE_DATA_NAME, 'home')
  const workspace = join(distribution, PORTABLE_DATA_NAME, 'workspace')
  try {
    // 1. The menu, the identity, and the integrity report, with no interpreter
    //    reachable and nothing the user has to answer beyond the menu.
    const menu = start(distribution, environment, ['4', '', '0'])
    const menuSession = await menu.done
    if (menuSession.code !== 0) {
      throw new Error(`the launcher exited with ${String(menuSession.code)}:\n${menuSession.errors.join('\n')}`)
    }
    const identity = menuSession.lines.find(line => line.endsWith(headline) && recorded.titles.includes(line.slice(0, -headline.length)))
    if (identity === undefined) {
      throw new Error(`the launcher presented no recorded product identity (${recorded.titles.join(' or ')}${headline}):\n${menuSession.lines.join('\n')}`)
    }
    const stateLine = menuSession.lines.find(line => line.includes(home))
    if (stateLine === undefined) throw new Error(`the launcher never presented the state directory ${home}`)
    const presentedLanguage = recorded.titles.length === 1
      ? 'undetermined: both localized titles are identical'
      : identity.slice(0, -headline.length) === recorded.titles[1] ? 'zh-CN' : 'en'
    const presented = presentedMessages(menuSession.lines)
    const integrityLabel = `${presented.messages['label.integrity']}: `
    const integrityLine = menuSession.lines.find(line => line.startsWith(integrityLabel))
    const integrity = integrityLine?.slice(integrityLabel.length) ?? ''
    if (integrity !== presented.messages['integrity.verified']) {
      throw new Error(`the launcher did not report a verified distribution; it reported: ${integrity}`)
    }

    // 2. The portable run: start the application from the menu and reach the
    //    authenticated interface it serves from the medium.
    const run = start(distribution, environment, ['1'])
    const announced = await waitForLine(run.session, ANNOUNCED_URL, READY_TIMEOUT_MS, 'an authenticated launch URL')
    const url = ANNOUNCED_URL.exec(announced)?.[0]
    if (url === undefined) throw new Error(`the launcher announced an unusable URL: ${announced}`)
    const reached = await reachInterface(url)

    // 3. Stop the run. The launcher ends an application when its window closes,
    //    which a non-interactive probe cannot do; killing the tree it started is
    //    the honest equivalent, and the graceful path over the same packaged
    //    runtime is held by the carrier probe.
    spawnSync('taskkill', ['/PID', String(run.child.pid ?? 0), '/T', '/F'], { stdio: 'ignore' })
    await run.done.catch(() => undefined)
    await new Promise(accept => setTimeout(accept, 3_000))
    if (!existsSync(home)) throw new Error(`the portable run left no state directory at ${home}`)
    const state = measureTree(home)
    if (state.files === 0) throw new Error('the portable run created no state below the medium-owned home')
    const workspaceMeasure = measureIfPresent(workspace)

    // 4. The closed boundary: the launcher presents the identity of a
    //    distribution that has no product.yml at all.
    const metadata = join(distribution, 'product.yml')
    const held = `${metadata}.held`
    await rm(held, { force: true })
    renameSync(metadata, held)
    let inlined: Session
    try {
      inlined = await start(distribution, environment, ['0']).done
    } finally {
      renameSync(held, metadata)
    }
    if (inlined.code !== 0) throw new Error(`the launcher exited with ${String(inlined.code)} without product.yml`)
    if (!inlined.lines.includes(identity)) {
      throw new Error(`the launcher presented no inlined identity without product.yml:\n${inlined.lines.join('\n')}`)
    }

    const report = {
      schemaVersion: 1,
      target: { platform: 'win32', arch: 'x64' },
      executable: { name: LAUNCHER_EXECUTABLE, bytes: statSync(launcher).size, sha256: await digest(launcher) },
      cleanEnvironment: {
        path: 'an existing directory holding no executable',
        hostNode: hostInterpreter('node'),
        hostPython: hostInterpreter('python'),
        // Everything the run wrote outside the medium, in the redirected
        // locations a Windows program treats as its own. An empty inventory
        // means the run kept every byte on the medium.
        hostStateOutsideTheMedium: ((): TreeMeasure & { readonly inventory: readonly string[] } => {
          const measured = measureTree(environment.host)
          return { ...measured, inventory: inventory(environment.host) }
        })(),
      },
      menu: {
        language: presentedLanguage,
        interfaceLanguage: presented.language,
        identity,
        stateLine,
        integrity,
        exitCode: menuSession.code,
      },
      portableRun: {
        application: 'the packaged runtime, started from the medium',
        profile: 'consumer',
        url: url.replace(/token=[A-Za-z0-9_-]+/u, 'token=<redacted>'),
        exchangeStatus: reached.exchangeStatus,
        interface: 'authenticated bootstrap and asset served',
        stop: 'the process tree the probe started',
      },
      brand: {
        inlinedLogoDataUris: reached.logoDataUris,
        paletteSwapSelector: reached.paletteSwap ? PALETTE_SWAP_SELECTOR : 'absent',
        clientBootBundles: reached.bootBundles,
        note: 'the two palette logos and the rule that shows one of them reached the client from the build, not from product.yml',
      },
      state: {
        home,
        homeFiles: state.files,
        homeBytes: state.bytes,
        workspaceFiles: workspaceMeasure.files,
        settings: existsSync(join(distribution, PORTABLE_SETTINGS)),
      },
      identityWithoutProductYml: true,
    }
    const output = `${JSON.stringify(report, undefined, 2)}\n`
    process.stdout.write(output)
    if (values.out !== undefined) {
      if (!isAbsolute(values.out)) throw new Error('--out must be an absolute file path')
      mkdirSync(dirname(values.out), { recursive: true })
      writeFileSync(values.out, output)
    }
  } finally {
    await new Promise(accept => setTimeout(accept, 2_000))
    await rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
  }
}

await main()
