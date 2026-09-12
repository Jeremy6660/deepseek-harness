/** Product-level Windows carrier smoke and immutable-size comparison. */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

interface TreeMeasure {
  readonly bytes: number
  readonly files: number
}

function measureTree(path: string): TreeMeasure {
  const status = lstatSync(path)
  if (status.isSymbolicLink()) throw new Error(`carrier comparison refuses filesystem link ${path}`)
  if (status.isFile()) return { bytes: status.size, files: 1 }
  if (!status.isDirectory()) throw new Error(`carrier comparison requires regular files and directories, found ${path}`)
  let bytes = 0
  let files = 0
  for (const entry of readdirSync(path)) {
    const measured = measureTree(join(path, entry))
    bytes += measured.bytes
    files += measured.files
  }
  return { bytes, files }
}

function addMeasures(paths: readonly string[]): TreeMeasure {
  return paths.reduce<TreeMeasure>((total, path) => {
    const measured = measureTree(path)
    return { bytes: total.bytes + measured.bytes, files: total.files + measured.files }
  }, { bytes: 0, files: 0 })
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<number | null> {
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => reject(new Error('SEA Web process did not complete its controlled shutdown')), timeoutMs)
    child.once('error', reject)
    child.once('close', (code) => {
      clearTimeout(timer)
      accept(code)
    })
  })
}

function waitForUrl(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<string> {
  return new Promise((accept, reject) => {
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => reject(new Error(`SEA Web startup timed out: ${stderr}`)), timeoutMs)
    const inspect = (): void => {
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/u.exec(stdout)
      if (match?.[1] === undefined) return
      clearTimeout(timer)
      accept(match[1])
    }
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); inspect() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.once('error', reject)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`SEA Web exited before readiness with code ${String(code)}: ${stderr}`))
    })
  })
}

async function smokeSea(executable: string): Promise<{ readonly pathIsolated: true; readonly stateFiles: number }> {
  const scratch = mkdtempSync(join(tmpdir(), 'dsh-portable-carrier-'))
  const home = join(scratch, 'home')
  const workspace = join(scratch, 'workspace')
  const emptyPath = join(scratch, 'empty-path')
  const control = join(scratch, 'control')
  const temporary = join(home, 'temp')
  const stop = join(control, 'stop')
  const disposed = join(control, 'disposed')
  const shutdownProbe = join(control, 'shutdown-probe.mjs')
  const shutdownPatch = join(control, 'shutdown-probe.cordis.yml')
  mkdirSync(home)
  mkdirSync(workspace)
  mkdirSync(emptyPath)
  mkdirSync(control)
  mkdirSync(temporary)
  writeFileSync(shutdownProbe, [
    "import { existsSync, writeFileSync } from 'node:fs'",
    "export const name = 'portable-carrier-shutdown-probe'",
    'export function apply(ctx) {',
    '  let interrupted = false',
    '  const heartbeat = setInterval(() => {',
    '    if (interrupted || !existsSync(process.env.DSH_PORTABLE_PROBE_STOP_FILE)) return',
    '    interrupted = true',
    "    process.emit('SIGTERM')",
    '  }, 20)',
    '  ctx.effect(() => () => {',
    '    clearInterval(heartbeat)',
    "    writeFileSync(process.env.DSH_PORTABLE_PROBE_DISPOSED_FILE, 'disposed')",
    '  })',
    '}',
    '',
  ].join('\n'))
  writeFileSync(shutdownPatch, [
    '- insert:',
    '    - id: portable-carrier-shutdown-probe',
    `      name: ${pathToFileURL(shutdownProbe).href}`,
    '',
  ].join('\n'))
  const child = spawn(executable, ['web', '--patch', shutdownPatch, '--no-open', '--port', '0'], {
    cwd: workspace,
    env: {
      DSH_HOME: home,
      DSH_PORTABLE_PROBE_STOP_FILE: stop,
      DSH_PORTABLE_PROBE_DISPOSED_FILE: disposed,
      PKG_NATIVE_CACHE_PATH: join(home, 'native-cache'),
      NARB_NATIVE_CACHE_DIR: join(home, 'native-cache', 'narb'),
      APPDATA: join(home, 'app-data'),
      LOCALAPPDATA: join(home, 'local-app-data'),
      USERPROFILE: home,
      PATH: emptyPath,
      SystemRoot: process.env.SystemRoot,
      TEMP: temporary,
      TMP: temporary,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  try {
    const url = await waitForUrl(child, 120_000)
    const exchange = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    if (exchange.status !== 303) throw new Error(`SEA Web launch token exchange returned HTTP ${exchange.status}`)
    const setCookie = exchange.headers.get('set-cookie')
    if (setCookie === null) throw new Error('SEA Web launch token exchange omitted its authentication cookie')
    const cookie = setCookie.split(';', 1)[0]
    if (cookie === undefined || cookie === '') throw new Error('SEA Web launch token exchange returned an empty authentication cookie')
    const origin = new URL(url).origin
    const response = await fetch(`${origin}/`, {
      headers: { cookie },
      signal: AbortSignal.timeout(30_000),
    })
    const body = await response.text()
    if (!response.ok || !body.includes('__DSH_BOOT__')) {
      throw new Error(`SEA Web returned HTTP ${response.status} without the authenticated frontend bootstrap`)
    }
    const assetPath = /(?:src|href)="([^"?]+\.(?:css|js))"/u.exec(body)?.[1]
    if (assetPath === undefined) throw new Error('SEA Web frontend bootstrap references no JavaScript or CSS asset')
    const asset = await fetch(new URL(assetPath, `${origin}/`), {
      headers: { cookie },
      signal: AbortSignal.timeout(30_000),
    })
    if (!asset.ok || (await asset.arrayBuffer()).byteLength === 0) {
      throw new Error(`SEA Web frontend asset returned HTTP ${asset.status}`)
    }
    writeFileSync(stop, 'stop')
    const code = await waitForExit(child, 30_000)
    if (code !== 0) throw new Error(`SEA Web exited with code ${String(code)} after controlled shutdown`)
    if (!existsSync(disposed)) throw new Error('SEA Web exited without disposing the lifecycle probe')
    const state = measureTree(home)
    if (state.files === 0) throw new Error('SEA Web created no state below the explicit DSH_HOME')
    if (measureTree(workspace).files !== 0) throw new Error('SEA Web wrote state outside the explicit DSH_HOME')
    return { pathIsolated: true, stateFiles: state.files }
  } finally {
    if (child.exitCode === null) {
      child.kill()
      await waitForExit(child, 10_000).catch(() => undefined)
    }
    await new Promise(accept => setTimeout(accept, 2_000))
    await rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 })
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      sea: { type: 'string' },
      desktop: { type: 'string' },
      out: { type: 'string' },
    },
    allowPositionals: false,
  })
  if (values.sea === undefined || !isAbsolute(values.sea)) throw new Error('--sea must name an absolute Windows x64 SEA executable')
  const sea = resolve(values.sea)
  if (!statSync(sea).isFile()) throw new Error(`--sea is not a file: ${sea}`)
  if (!sea.toLowerCase().endsWith('.exe')) throw new Error(`--sea must name a .exe file: ${sea}`)
  const ripgrep = `${sea.slice(0, -'.exe'.length)}-rg.exe`
  if (!statSync(ripgrep).isFile()) throw new Error(`SEA ripgrep sidecar is not a file: ${ripgrep}`)
  const desktop = values.desktop === undefined ? undefined : resolve(values.desktop)
  if (values.desktop !== undefined && !isAbsolute(values.desktop)) throw new Error('--desktop must name an absolute unpacked Desktop directory')
  const report = {
    schemaVersion: 1,
    target: { platform: 'win32', arch: 'x64' },
    selectedCarrier: 'sea',
    sea: { ...addMeasures([sea, ripgrep]), smoke: await smokeSea(sea), launch: 'dsh web --no-open --port 0', repairUnit: 'file' },
    desktop: desktop === undefined ? undefined : { ...measureTree(desktop), launch: 'Electron shell', repairUnit: 'file tree' },
  }
  const output = `${JSON.stringify(report, undefined, 2)}\n`
  process.stdout.write(output)
  if (values.out !== undefined) {
    if (!isAbsolute(values.out)) throw new Error('--out must be an absolute file path')
    mkdirSync(dirname(values.out), { recursive: true })
    writeFileSync(values.out, output)
    if (readFileSync(values.out, 'utf8') !== output) throw new Error(`carrier comparison could not verify ${values.out}`)
  }
}

await main()
