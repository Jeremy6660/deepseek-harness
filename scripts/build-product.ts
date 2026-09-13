/** Run the complete build branded by one validated portable product staging root. */

import { spawnSync } from 'node:child_process'
import { isAbsolute, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { runRootBuild } from './build.ts'
import { resolveClientBuildEnvironment } from './client-build-environment.ts'

/** Profile a publisher-branded product build selects. */
const PRODUCT_CLIENT_BUILD_PROFILE = 'product'

/**
 * Read the publisher values one staging root defines through the portable CLI.
 *
 * `client-env` owns the only mapping from the closed `product.yml` schema to the
 * `DSH_CLIENT_*` values the bundlers inline, so this entry point consumes that
 * validated bridge instead of restating the schema here. The CLI answers on
 * stdout with one JSON object and reports every rejection on stderr with exit
 * code 2, which keeps a malformed staging root from reaching a build.
 *
 * @param root - repository root owning the private portable workspace.
 * @param portableRoot - explicit absolute staging root holding `product.yml`.
 * @returns the publisher values, without the profile selector the build supplies.
 */
export function publisherEnvironment(root: string, portableRoot: string): NodeJS.ProcessEnv {
  const cli = resolve(root, 'apps/portable/src/cli.ts')
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx/esm', cli, 'client-env', '--root', portableRoot],
    { cwd: root, env: process.env, encoding: 'utf8' },
  )
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`build:product: client-env exited with ${String(result.status ?? result.signal)}: ${result.stderr.trim()}`)
  }
  return JSON.parse(result.stdout) as Record<string, string>
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
