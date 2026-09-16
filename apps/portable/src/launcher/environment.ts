/**
 * Host locations the launcher's install and uninstall paths resolve.
 *
 * These come from the launcher's own process environment, which works only
 * because this bundle keeps the real `process.env`: the client build
 * substitutions replace that whole object with an empty literal for browser
 * artifacts, and `build-launcher.ts` drops exactly that one substitution here.
 *
 * Every value is optional. A launcher started with a stripped environment can
 * still present its menu, read its own distribution, and run the application —
 * only the install and uninstall entries need a host location, and each reports
 * which one it could not resolve rather than guessing.
 */

import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'

/** Directory Windows documents for a per-user program installation. */
export const USER_PROGRAMS_DIRECTORY = 'Programs'

/** Console registry tool, named inside the system directory rather than searched for. */
const REGISTRY_TOOL = 'reg.exe'

/** Read one absolute host directory from the environment. */
function hostDirectory(environment: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = environment[name]?.trim()
  if (value === undefined || value === '' || !isAbsolute(value)) return undefined
  return value
}

/**
 * Resolve the per-user local application data directory.
 * @param environment - the launcher's own environment.
 * @returns the absolute directory, or undefined when the host does not name one.
 */
export function localAppDataDirectory(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  return hostDirectory(environment, 'LOCALAPPDATA')
}

/**
 * Resolve the per-user roaming application data directory.
 * @param environment - the launcher's own environment.
 * @returns the absolute directory, or undefined when the host does not name one.
 */
export function roamingAppDataDirectory(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  return hostDirectory(environment, 'APPDATA')
}

/**
 * Resolve the directory a per-user installation places its programs in.
 * @param environment - the launcher's own environment.
 * @returns the absolute directory, or undefined when the host names no local application data.
 */
export function userProgramsDirectory(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  const local = localAppDataDirectory(environment)
  return local === undefined ? undefined : join(local, USER_PROGRAMS_DIRECTORY)
}

/**
 * Resolve the Windows directory holding the system programs.
 * @param environment - the launcher's own environment.
 * @returns the absolute directory, or undefined when the host does not name one.
 */
function systemDirectory(environment: NodeJS.ProcessEnv): string | undefined {
  return hostDirectory(environment, 'SystemRoot') ?? hostDirectory(environment, 'windir')
}

/**
 * Resolve the absolute path of one program in the Windows system directory.
 *
 * The launcher runs a fixed program with a fixed argument list and never
 * searches `PATH`, so a directory holding a planted executable of the same name
 * cannot change which program runs.
 *
 * @param name - executable file name.
 * @param environment - the launcher's own environment.
 * @returns the absolute path, or undefined when the host names no system directory.
 */
export function systemProgramPath(name: string, environment: NodeJS.ProcessEnv = process.env): string | undefined {
  const directory = systemDirectory(environment)
  return directory === undefined ? undefined : join(directory, 'System32', name)
}

/**
 * Resolve the console registry tool the uninstall entry is written with.
 * @param environment - the launcher's own environment.
 * @returns the absolute path, or undefined when the host names no system directory.
 */
export function registryToolPath(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  return systemProgramPath(REGISTRY_TOOL, environment)
}

/**
 * Resolve a temporary directory for the launcher's own short-lived files.
 *
 * The uninstall finisher runs from a private directory below this one, so the
 * program it is removing is never the program that is running.
 *
 * @returns the host temporary directory.
 */
export function privateTemporaryRoot(): string {
  return tmpdir()
}
