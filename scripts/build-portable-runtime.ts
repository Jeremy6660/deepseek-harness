/**
 * Build the Windows x64 portable Runtime from one validated product staging root.
 *
 * The portable Runtime is the fixed `@yao-pkg/pkg --sea` carrier assembled from
 * the publisher-branded client composition, so this entry point runs the same
 * root build `build:product` owns and then packages that build through the shared
 * SEA pipeline. It stages into a closure of its own, so building the portable
 * Runtime cannot replace the Python wheel's staged closure, and it records the
 * pins and artifact digests beside the executable.
 */

import { createHash } from 'node:crypto'
import { createReadStream, readFileSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { runRootBuild } from './build.ts'
import {
  PRODUCT_CLIENT_BUILD_PROFILE,
  portableProductIdentity,
  publisherEnvironment,
  type PortableProductIdentity,
} from './build-product.ts'
import { BuildCli, SingleExeBuild, Target } from './build-exe-for-python-sdk.ts'
import { readClientBuildRecord, resolveClientBuildEnvironment } from './client-build-environment.ts'

const root = resolve(import.meta.dirname, '..')

/** The only portable Runtime target the first release builds. */
const PORTABLE_TARGET = 'node24-win-x64'
/** Deploy root of the portable SEA closure, kept separate from the Python wheel's. */
const PORTABLE_STAGING = '.dsh-build/portable-runtime/win-x64/closure'
/** Directory the SEA pipeline writes its products to before they are copied out. */
const PORTABLE_PRODUCT_DIR = 'dist-exe/portable-runtime'
/** Runtime platform manifest naming the executable each target ships. */
const RUNTIME_PLATFORMS = 'python/sdk-runtime/platforms.json'
/** Recorded inputs, pins, and digests of one portable Runtime build. */
const RUNTIME_BUILD_RECORD = 'runtime-build.json'
/** Repository-pinned SEA packaging dependency whose installed version is recorded. */
const PKG_PACKAGE = '@yao-pkg/pkg'

interface RuntimePlatform {
  readonly executable: string
}

/** Parsed command line of the portable Runtime build. */
interface PortableRuntimeCli {
  /** Absolute staging root holding the validated `product.yml`. */
  readonly portableRoot: string
  /** Absolute directory receiving the Runtime executable, sidecar, and record. */
  readonly out: string
  /** Reuse client artifacts whose build record matches the product environment and bytes. */
  readonly skipBuild: boolean
}

/**
 * Render the command's usage text.
 * @returns the printable usage block.
 */
export function usage(): string {
  return [
    'Usage: pnpm run build:portable-runtime --root <absolute staging> --out <absolute directory> [--skip-build]',
    '',
    '  --root=<path>   absolute staging root holding the validated product.yml.',
    `  --out=<path>    absolute directory receiving the ${PORTABLE_TARGET} Runtime artifacts.`,
    '  --skip-build    reuse verified client artifacts built for this product.',
    '',
    `Target: ${PORTABLE_TARGET}. Pins, inputs, and artifact digests are recorded in ${RUNTIME_BUILD_RECORD}.`,
  ].join('\n')
}

/**
 * Parse the portable Runtime build command line.
 * @param argv - raw arguments after the script name.
 * @returns the validated absolute roots and build switch.
 */
export function parseCli(argv: readonly string[]): PortableRuntimeCli {
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

/**
 * Read the executable filename one target ships, as the runtime platform manifest declares it.
 * @param target - pkg target triple, e.g. `node24-win-x64`.
 * @returns the declared executable filename.
 */
export function runtimeExecutable(target: Target): string {
  const platforms = JSON.parse(readFileSync(join(root, RUNTIME_PLATFORMS), 'utf8')) as Record<string, RuntimePlatform>
  const key = `${target.platform}-${target.arch}`
  const declared = platforms[key]?.executable
  if (declared === undefined) throw new Error(`${RUNTIME_PLATFORMS} declares no executable for target ${key}`)
  return declared
}

/**
 * Extract the ripgrep sidecar name the SEA pipeline writes beside an executable.
 * @param executable - the Runtime executable filename.
 * @returns the sidecar filename the pkg pipeline produces.
 */
export function ripgrepSidecar(executable: string): string {
  if (!executable.endsWith('.exe')) throw new Error(`portable Runtime executable ${executable} is not a Windows executable`)
  return `${executable.slice(0, -'.exe'.length)}-rg.exe`
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
  return { path: basename(path), bytes, sha256: hash.digest('hex') }
}

/** Installed and declared versions of the pinned SEA packaging dependency. */
function pkgPin(): { readonly declared: string; readonly installed: string } {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>
  }
  const installed = JSON.parse(readFileSync(join(root, 'node_modules', PKG_PACKAGE, 'package.json'), 'utf8')) as { version: string }
  return { declared: manifest.devDependencies?.[PKG_PACKAGE] ?? 'undeclared', installed: installed.version }
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2))
  const target = Target.parse(PORTABLE_TARGET)
  const identity: PortableProductIdentity = portableProductIdentity(root, cli.portableRoot)
  const clientEnvironment = resolveClientBuildEnvironment(
    publisherEnvironment(root, cli.portableRoot),
    PRODUCT_CLIENT_BUILD_PROFILE,
  )
  const pipeline = new SingleExeBuild(BuildCli.parse(['--targets', PORTABLE_TARGET, '--skip-build']), {
    staging: join(root, PORTABLE_STAGING),
    outDir: join(root, PORTABLE_PRODUCT_DIR),
  })
  console.log(`build:portable-runtime: ${identity.id} ${identity.version} @ ${identity.upstreamRevision.slice(0, 7)} -> ${target.spec}`)
  console.log(`build:portable-runtime: staging: ${pipeline.staging}`)
  await pipeline.verifyClosure()
  if (cli.skipBuild) {
    console.log('build:portable-runtime: skipping the branded root build (--skip-build)')
  } else {
    runRootBuild(clientEnvironment)
  }
  // Reusing artifacts must prove both the publisher values and the emitted bytes.
  readClientBuildRecord(root, clientEnvironment)
  await pipeline.deployStaging()
  await pipeline.injectPkgConfig()
  const products = await pipeline.pack(target)
  pipeline.printProducts(products)

  const executable = runtimeExecutable(target)
  const produced = [
    join(PORTABLE_PRODUCT_DIR, executable),
    join(PORTABLE_PRODUCT_DIR, ripgrepSidecar(executable)),
  ]
  await mkdir(cli.out, { recursive: true })
  const files = []
  for (const relative of produced) {
    const source = join(root, relative)
    const destination = join(cli.out, basename(relative))
    await copyFile(source, destination)
    files.push(await measure(destination))
    console.log(`build:portable-runtime: wrote ${destination}`)
  }
  const record = {
    schemaVersion: 1,
    product: { id: identity.id, version: identity.version },
    upstreamRevision: identity.upstreamRevision,
    target: { platform: 'win32', arch: 'x64', pkgTarget: target.spec, nodeRange: target.nodeRange },
    clientBuildProfile: PRODUCT_CLIENT_BUILD_PROFILE,
    pkg: pkgPin(),
    files,
  }
  const recordPath = join(cli.out, RUNTIME_BUILD_RECORD)
  const output = `${JSON.stringify(record, undefined, 2)}\n`
  await writeFile(recordPath, output)
  if (readFileSync(recordPath, 'utf8') !== output) throw new Error(`build:portable-runtime: could not verify ${recordPath}`)
  console.log(`build:portable-runtime: ${JSON.stringify({ executable, record: recordPath, files })}`)
}

if (import.meta.main) await main()
