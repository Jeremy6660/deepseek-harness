/** Run the complete build branded by one validated portable product staging root. */

import { spawnSync } from 'node:child_process'
import { isAbsolute, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { runRootBuild } from './build.ts'
import { resolveClientBuildEnvironment } from './client-build-environment.ts'

/** Profile a publisher-branded product build selects. */
export const PRODUCT_CLIENT_BUILD_PROFILE = 'product'

/**
 * Run one portable CLI command against a staging root.
 *
 * The portable CLI owns every read of the closed `product.yml` schema: it
 * answers on stdout with one JSON object and reports every rejection on stderr
 * with exit code 2, which keeps a malformed staging root from reaching a build.
 *
 * @param root - repository root owning the private portable workspace.
 * @param portableRoot - explicit absolute staging root holding `product.yml`.
 * @param command - the portable CLI command to run.
 * @returns the parsed JSON the command wrote to stdout.
 */
function portableCommand(root: string, portableRoot: string, command: string): unknown {
  const cli = resolve(root, 'apps/portable/src/cli.ts')
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx/esm', cli, command, '--root', portableRoot],
    { cwd: root, env: process.env, encoding: 'utf8' },
  )
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`build:product: ${command} exited with ${String(result.status ?? result.signal)}: ${result.stderr.trim()}`)
  }
  return JSON.parse(result.stdout)
}

/**
 * Read the publisher values one staging root defines through the portable CLI.
 *
 * `client-env` owns the only mapping from the closed `product.yml` schema to the
 * `DSH_CLIENT_*` values the bundlers inline, so this entry point consumes that
 * validated bridge instead of restating the schema here.
 *
 * @param root - repository root owning the private portable workspace.
 * @param portableRoot - explicit absolute staging root holding `product.yml`.
 * @returns the publisher values, without the profile selector the build supplies.
 */
export function publisherEnvironment(root: string, portableRoot: string): NodeJS.ProcessEnv {
  return portableCommand(root, portableRoot, 'client-env') as Record<string, string>
}

/** Stable product identity a build records alongside its artifacts. */
export interface PortableProductIdentity {
  /** Publisher-chosen product id. */
  readonly id: string
  /** Semantic product version. */
  readonly version: string
  /** Full 40-character upstream Git revision the product pins. */
  readonly upstreamRevision: string
}

/**
 * Read the validated product identity of one staging root.
 *
 * `DSH_CLIENT_*` carries only the values the client inlines, so the product id
 * and the full upstream revision come from `validate-product`, which returns the
 * same configuration `client-env` consumed.
 *
 * @param root - repository root owning the private portable workspace.
 * @param portableRoot - explicit absolute staging root holding `product.yml`.
 * @returns the product id, version, and pinned upstream revision.
 */
export function portableProductIdentity(root: string, portableRoot: string): PortableProductIdentity {
  const result = portableCommand(root, portableRoot, 'validate-product') as {
    config: { product: { id: string; version: string }; upstream: { revision: string } }
  }
  return {
    id: result.config.product.id,
    version: result.config.product.version,
    upstreamRevision: result.config.upstream.revision,
  }
}

/** Run the complete build branded by `--root`. */
function main(): void {
  const { values } = parseArgs({
    options: { root: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.root === undefined || !isAbsolute(values.root)) {
    throw new Error('--root must name an explicit absolute staging directory holding product.yml')
  }
  const root = resolve(import.meta.dirname, '..')
  const environment = publisherEnvironment(root, resolve(values.root))
  runRootBuild(resolveClientBuildEnvironment(environment, PRODUCT_CLIENT_BUILD_PROFILE))
}

if (import.meta.main) main()
