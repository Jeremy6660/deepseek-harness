/**
 * Build `Launcher.exe` from one validated product staging root.
 *
 * The launcher is the distribution's only executable entry besides the
 * packaged Runtime. It is a console application bundled into a single module
 * with its product identity inlined at build time, and packaged through the
 * same fixed `@yao-pkg/pkg --sea` carrier the Runtime uses, so a distribution
 * ships one packaging route rather than two.
 *
 * Identity arrives the way every other product artifact receives it: read from
 * the validated `product.yml` through `portableClientBuildEnvironment`, the
 * same bridge the `client-env` command prints and the branded client build
 * consumes. The launcher itself never reads `product.yml`.
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { build } from 'tsdown'
import { clientBuildEnvironmentDefines, resolveClientBuildEnvironment } from '../../../scripts/client-build-environment.ts'
import { portableClientBuildEnvironment, readProductLogo, readProductLogoDark } from '../src/client-env.ts'
import { LAUNCHER_BUILD_RECORD_NAME } from '../src/launcher/layout.ts'
import { readPortableProductConfig } from '../src/product-config.ts'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')
/** The only launcher target the first release builds. */
const LAUNCHER_TARGET = 'node24-win-x64'
/** Product executable name at the distribution root. */
const LAUNCHER_OUTPUT = 'Launcher.exe'
/** Bundle filename inside the pkg input directory. */
const LAUNCHER_BUNDLE = 'launcher.js'
/** pkg input directory, kept outside the repository's build outputs. */
const LAUNCHER_STAGING = '.dsh-build/portable-launcher/win-x64'
/** Repository-pinned pkg entrypoint; direct execution avoids pnpm reinstalling the root. */
const PKG_BIN = 'node_modules/@yao-pkg/pkg/lib-es5/bin.js'
/** Module the bundle is produced from; `tsc -b` writes it. */
const LAUNCHER_ENTRY = 'apps/portable/lib/types/launcher/main.js'
/** Recorded inputs, pins, and digest of one launcher build. */
const LAUNCHER_BUILD_RECORD = LAUNCHER_BUILD_RECORD_NAME
/** Repository-pinned SEA packaging dependency whose installed version is recorded. */
const PKG_PACKAGE = '@yao-pkg/pkg'

/** Parsed command line of the launcher build. */
interface LauncherBuildCli {
  /** Absolute staging root holding the validated `product.yml`. */
  readonly portableRoot: string
  /** Absolute directory receiving `Launcher.exe` and the build record. */
  readonly out: string
  /** Skip the workspace type build; `lib/types` must already be current. */
  readonly skipBuild: boolean
}

/**
 * Render the command's usage text.
 * @returns the printable usage block.
 */
export function usage(): string {
  return [
    'Usage: pnpm run build:portable-launcher --root <absolute staging> --out <absolute directory> [--skip-build]',
    '',
    '  --root=<path>   absolute staging root holding the validated product.yml.',
    `  --out=<path>    absolute directory receiving ${LAUNCHER_OUTPUT}.`,
    '  --skip-build    skip the workspace type build (lib/types/ artifacts must already exist).',
    '',
    `Target: ${LAUNCHER_TARGET}. Pins and the artifact digest are recorded in ${LAUNCHER_BUILD_RECORD}.`,
  ].join('\n')
}

/**
 * Parse the launcher build command line.
 * @param argv - raw arguments after the script name.
 * @returns the validated absolute roots and build switch.
 */
export function parseCli(argv: readonly string[]): LauncherBuildCli {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      root: { type: 'string' },
      out: { type: 'string' },
      'skip-build': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  })
  if (values.help) {
    console.log(usage())
    process.exit(0)
  }
  if (values.root === undefined || !isAbsolute(values.root)) {
    throw new Error(`--root must name an explicit absolute staging directory holding product.yml\n\n${usage()}`)
  }
  if (values.out === undefined || !isAbsolute(values.out)) {
    throw new Error(`--out must name an explicit absolute output directory\n\n${usage()}`)
  }
  return { portableRoot: resolve(values.root), out: resolve(values.out), skipBuild: values['skip-build'] }
}

/** Identity one launcher build inlines and records. */
export interface LauncherBuildProduct {
  /** Product identifier from the validated metadata. */
  readonly id: string
  /** Product version from the validated metadata. */
  readonly version: string
  /** English product title the inlined environment carries. */
  readonly titleEn: string
  /**
   * Chinese product title the inlined environment carries.
   *
   * Recorded so an acceptance probe can tell which of the two the launcher
   * presented without reading `product.yml` — the file the launcher itself is
   * forbidden to open. A product whose two titles are equal records both, and
   * the probe reports that the language is undetermined rather than guessing.
   */
  readonly titleZh: string
}

/** The inlined environment and the identity it came from. */
export interface LauncherBuildInputs {
  /** Complete public environment, including the profile selector, the bundle inlines. */
  readonly environment: Readonly<Record<string, string>>
  /** Identity read from the same validated metadata, recorded for the distribution. */
  readonly product: LauncherBuildProduct
  /**
   * Full upstream revision the staging root pins.
   *
   * The inlined commit hash is the seven-character form the branded client
   * displays; a build record has to name the revision exactly, the way the
   * Runtime's record does.
   */
  readonly upstreamRevision: string
}

/**
 * Resolve the product client build environment the launcher inlines.
 * @param portableRoot - validated staging root.
 * @returns the environment to inline and the identity to record.
 */
export function launcherBuildInputs(portableRoot: string): LauncherBuildInputs {
  const config = readPortableProductConfig(join(portableRoot, 'product.yml'), portableRoot)
  return {
    environment: resolveClientBuildEnvironment(
      {
        ...portableClientBuildEnvironment(
          config,
          readProductLogo(portableRoot, config),
          readProductLogoDark(portableRoot, config),
        ),
      },
      'product',
    ),
    product: {
      id: config.product.id,
      version: config.product.version,
      titleEn: config.product.title.en,
      titleZh: config.product.title['zh-CN'],
    },
    upstreamRevision: config.upstream.revision,
  }
}

/**
 * Construct the bundler substitutions this launcher inlines.
 *
 * `clientBuildEnvironmentDefines` replaces the whole `process.env` object with
 * an empty literal, which is right for a browser artifact and wrong here: the
 * launcher is a console program that has to read `LOCALAPPDATA`, `APPDATA`, and
 * `TEMP`, and every one of them is `undefined` while that substitution stands.
 * Dropping it keeps the real object, so an install can resolve where to put a
 * program and an uninstall can find a private directory to finish from.
 *
 * Identity is unaffected. Each product value stays an individual substitution,
 * and an individual `process.env.DSH_CLIENT_*` is a longer match than the bare
 * object, so no identity read can observe an ambient value.
 *
 * @param environment - public environment whose `DSH_CLIENT_*` values are inlined.
 * @returns the substitutions to hand the bundler.
 */
export function launcherBundleDefines(environment: Record<string, string | undefined>): Record<string, string> {
  const defines = clientBuildEnvironmentDefines(environment)
  delete defines['process.env']
  return defines
}

/**
 * Measure one produced artifact for the build record.
 * @param path - absolute path of the produced file.
 * @returns its basename, byte count, and SHA-256 digest.
 */
export async function measure(path: string): Promise<{ readonly path: string; readonly bytes: number; readonly sha256: string }> {
  const hash = createHash('sha256')
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    const buffer = chunk as Buffer
    bytes += buffer.byteLength
    hash.update(buffer)
  }
  return { path: LAUNCHER_OUTPUT, bytes, sha256: hash.digest('hex') }
}

/** Installed and declared versions of the pinned SEA packaging dependency. */
function pkgPin(): { readonly declared: string; readonly installed: string } {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>
  }
  const installed = JSON.parse(readFileSync(join(ROOT, 'node_modules', PKG_PACKAGE, 'package.json'), 'utf8')) as { version: string }
  return { declared: manifest.devDependencies?.[PKG_PACKAGE] ?? 'undeclared', installed: installed.version }
}

/** Run one build subprocess, inheriting stdio and naming the command on failure. */
function run(label: string, command: string, args: readonly string[]): void {
  const result = spawnSync(command, [...args], { cwd: ROOT, stdio: 'inherit' })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) throw new Error(`build:launcher: ${label} exited with ${String(result.status ?? result.signal)}`)
}

/**
 * Bundle `lib/types/launcher/main.js` into one module with product values inlined.
 * @param staging - cleared pkg input directory.
 * @param environment - public environment whose `DSH_CLIENT_*` values are inlined.
 */
async function bundle(staging: string, environment: Readonly<Record<string, string>>): Promise<void> {
  await build({
    // The workspace configuration describes the package build, not this one
    // artifact; loading it would merge unrelated entries into this bundle.
    config: false,
    entry: { launcher: join(ROOT, LAUNCHER_ENTRY) },
    outDir: staging,
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    define: launcherBundleDefines(environment),
    // The launcher runs from pkg's virtual filesystem with no `node_modules`
    // beside it, so every import the bundle needs must be inside the bundle.
    deps: { neverBundle: [], onlyBundle: false },
    // Name the entry the way the packaged Runtime names its own, so both
    // carriers are handed a `.js` ESM file rather than a `.mjs` one.
    fixedExtension: false,
    dts: false,
    sourcemap: false,
    clean: false,
  })
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2))
  const { environment, product: identity, upstreamRevision } = launcherBuildInputs(cli.portableRoot)
  const staging = join(ROOT, LAUNCHER_STAGING)
  console.log(`build:launcher: ${identity.id} ${identity.version} -> ${LAUNCHER_TARGET}`)

  if (cli.skipBuild) {
    console.log('build:launcher: skipping the workspace type build (--skip-build)')
  } else {
    run('workspace type build', process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-b', 'apps/portable'])
  }
  if (!existsSync(join(ROOT, LAUNCHER_ENTRY))) {
    throw new Error(`build:launcher: ${LAUNCHER_ENTRY} is missing; run the workspace type build first`)
  }

  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  await bundle(staging, environment)
  const bundlePath = join(staging, LAUNCHER_BUNDLE)
  if (!existsSync(bundlePath)) {
    throw new Error(`build:launcher: the bundle did not produce ${bundlePath}`)
  }
  await writeFile(join(staging, 'package.json'), `${JSON.stringify({
    name: 'portable-agent-lab-launcher',
    version: '1.0.0',
    private: true,
    type: 'module',
    bin: LAUNCHER_BUNDLE,
  }, undefined, 2)}\n`)

  await mkdir(cli.out, { recursive: true })
  const product = join(cli.out, LAUNCHER_OUTPUT)
  run(`pkg ${LAUNCHER_TARGET}`, process.execPath, [
    join(ROOT, PKG_BIN),
    staging,
    '--sea',
    '--targets',
    LAUNCHER_TARGET,
    '--output',
    product,
  ])
  if (!existsSync(product)) throw new Error(`build:launcher: ${product} is missing after the pkg run`)

  const record = {
    schemaVersion: 1,
    product: identity,
    upstreamRevision,
    target: { platform: 'win32', arch: 'x64', pkgTarget: LAUNCHER_TARGET, nodeRange: 'node24' },
    clientBuildProfile: environment.DSH_CLIENT_BUILD_PROFILE ?? '',
    pkg: pkgPin(),
    files: [await measure(product)],
  }
  const recordPath = join(cli.out, LAUNCHER_BUILD_RECORD)
  const output = `${JSON.stringify(record, undefined, 2)}\n`
  await writeFile(recordPath, output)
  if (readFileSync(recordPath, 'utf8') !== output) throw new Error(`build:launcher: could not verify ${recordPath}`)
  console.log(`build:launcher: wrote ${product} (${String(statSync(product).size)} bytes)`)
  console.log(`build:launcher: ${JSON.stringify({ executable: LAUNCHER_OUTPUT, record: recordPath, files: record.files })}`)
}

if (import.meta.main) await main()
