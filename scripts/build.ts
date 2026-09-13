/** Run the complete repository build and bind its client artifacts to their public environment. */

import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  CLIENT_BUILD_RECORD_PATH,
  CLIENT_BUILD_PROFILE_SELECTOR,
  clientBuildProcessEnvironment,
  repositoryClientBuildEnvironment,
  resolveClientBuildEnvironment,
  writeClientBuildRecord,
  type ClientBuildEnvironment,
} from './client-build-environment.ts'
import { pnpmInvocation } from './pnpm-invocation.ts'

/** Run one package script through the package manager that invoked this build. */
function runScript(script: string, environment: NodeJS.ProcessEnv): void {
  const invocation = pnpmInvocation(['run', script], environment)
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: resolve(import.meta.dirname, '..'),
    env: environment,
    stdio: 'inherit',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`build: ${script} exited with ${String(result.status ?? result.signal)}`)
  }
}

/**
 * Run the complete root build bound to one already-resolved client environment.
 *
 * The sequence is shared by every entry point that completes a build: the
 * default one selects its environment from the repository or `--profile`, and
 * the publisher entry point selects it from validated product metadata. Keeping
 * one sequence means a publisher build cannot silently skip a build phase.
 *
 * @param clientEnvironment - complete public environment the client artifacts inline.
 * @param environment - parent process environment the build steps inherit from.
 */
export function runRootBuild(
  clientEnvironment: ClientBuildEnvironment,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const root = resolve(import.meta.dirname, '..')
  const buildEnvironment = clientBuildProcessEnvironment(environment, clientEnvironment)

  rmSync(resolve(root, CLIENT_BUILD_RECORD_PATH), { force: true })
  runScript('build:native-system', buildEnvironment)
  runScript('build:lib', buildEnvironment)
  runScript('build:web', buildEnvironment)
  const record = writeClientBuildRecord(root, clientEnvironment)
  console.log(
    `build: recorded ${String(record.artifacts.fileCount)} client artifact(s) with ${String(Object.keys(record.environment).length)} public value(s)`,
  )
}

/** Run the full build selected by `--profile` or `DSH_BUILD_CLIENT_PROFILE`. */
function main(): void {
  const { values } = parseArgs({
    options: { profile: { type: 'string' } },
    allowPositionals: false,
  })
  const root = resolve(import.meta.dirname, '..')
  const repositoryEnvironment = repositoryClientBuildEnvironment(root, process.env)
  const profile = values.profile ?? process.env[CLIENT_BUILD_PROFILE_SELECTOR]
  const clientEnvironment = resolveClientBuildEnvironment(repositoryEnvironment, profile)

  runRootBuild(clientEnvironment)
}

if (import.meta.main) main()
