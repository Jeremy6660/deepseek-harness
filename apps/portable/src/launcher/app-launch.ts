/**
 * The launcher's only application launch path.
 *
 * The launcher starts the packaged dsh CLI, not an arbitrary command: the
 * executable comes from the distribution layout, the profile is the shipped
 * consumer composition, and the flags are fixed here. No value the user types
 * reaches this argv.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { statSync } from 'node:fs'
import { join } from 'node:path'

/** Shipped profile the consumer product starts. */
export const APPLICATION_PROFILE = 'consumer'
/** Flags every portable and installed launch passes after the launcher's own flags. */
export const APPLICATION_ARGS: readonly string[] = ['--profile', APPLICATION_PROFILE, '--no-open', '--port', '0']
/** Default time the packaged CLI has to announce its authenticated URL. */
export const DEFAULT_READY_TIMEOUT_MS = 120_000
/** Directory name below the Harness home holding the unpacked native payloads. */
export const NATIVE_CACHE_DIRECTORY = 'native-cache'

/**
 * Resolve where the packaged runtime unpacks the native modules it carries.
 *
 * The single-executable carrier extracts its native payloads — the FFI and
 * image libraries, tens of megabytes of them — on first use. Left alone it
 * extracts them into the operator's own profile, which would make a run from a
 * medium leave its largest footprint on the host rather than on the medium.
 * Pointing the cache at the Harness home keeps the whole footprint inside the
 * state root the user chose, in both modes.
 *
 * @param home - Harness home this launch uses.
 * @returns the absolute directory the carrier may unpack into.
 */
export function nativeCacheDirectory(home: string): string {
  return join(home, NATIVE_CACHE_DIRECTORY)
}

/**
 * Build the environment the packaged application starts with.
 *
 * The parent is empty on purpose for the launcher's own launches. The packaged
 * application resolves its whole state root from the three values below, so
 * handing it the operator's environment would let an ambient variable move
 * state the launcher has already told the user it placed — and it would make
 * the "nothing outside the state root is written" property depend on whatever
 * happened to be exported when the launcher started.
 *
 * @param home - Harness home this launch uses.
 * @param parent - the environment to inherit, empty for a launcher launch.
 * @returns the parent environment with the application's state root and carrier caches redirected.
 */
export function applicationEnvironment(home: string, parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cache = nativeCacheDirectory(home)
  return {
    ...parent,
    DSH_HOME: home,
    PKG_NATIVE_CACHE_PATH: cache,
    NARB_NATIVE_CACHE_DIR: join(cache, 'narb'),
  }
}

/** Authenticated root URL the packaged CLI announces on standard output. */
const ANNOUNCED_URL = /dsh web:\s+(http:\/\/\S+)/u
/** Base64url token the browser authentication owner mints. */
const TOKEN = /^[A-Za-z0-9_-]+$/u

/**
 * Extract the authenticated root URL from packaged CLI output.
 * @param output - everything the CLI has written to standard output so far.
 * @returns the announced URL, or undefined before the CLI announces one.
 */
export function announcedUrl(output: string): string | undefined {
  return ANNOUNCED_URL.exec(output)?.[1]
}

/**
 * Decide whether the launcher may hand one URL to the operating system.
 *
 * The launcher opens exactly one kind of address: an authenticated loopback
 * root URL. Requiring the exact form keeps a compromised or replaced CLI from
 * making the launcher open an arbitrary target.
 *
 * @param url - the announced URL.
 * @returns true only for an authenticated `127.0.0.1` root URL.
 */
export function isLoopbackLaunchUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:') return false
  if (parsed.hostname !== '127.0.0.1') return false
  if (parsed.pathname !== '/' || parsed.hash !== '') return false
  const entries = [...parsed.searchParams.entries()]
  return entries.length === 1 && entries[0]?.[0] === 'token' && TOKEN.test(entries[0][1])
}

/** One running packaged application. */
export interface RunningApplication {
  /** Authenticated loopback URL the packaged CLI announced. */
  readonly url: string
  /** Resolves with the exit code once the application terminates. */
  readonly exited: Promise<number | null>
  /** Terminate the application process. */
  stop(): void
}

/** Everything one launch needs; the caller owns creating the directories. */
export interface LaunchRequest {
  /** Packaged dsh CLI from the distribution layout. */
  readonly executable: string
  /** Harness home the application reads and writes. */
  readonly home: string
  /** Directory the application starts in. */
  readonly workspace: string
  /** Receives every line the packaged CLI writes. */
  readonly onOutput: (line: string) => void
  /** Milliseconds the CLI has to announce its URL. */
  readonly readyTimeoutMs?: number
}

/**
 * Start the packaged application and wait for its authenticated URL.
 * @param request - resolved executable, state root, workspace, and output sink.
 * @returns the running application with its URL and exit promise.
 * @throws When the executable is missing, the CLI exits early, or it never announces a URL.
 */
export async function launchApplication(request: LaunchRequest): Promise<RunningApplication> {
  const status = statSync(request.executable, { throwIfNoEntry: false })
  if (status === undefined || !status.isFile()) {
    throw new Error(`launcher: packaged application ${request.executable} is missing from this distribution`)
  }
  let child: ChildProcess
  try {
    child = spawn(request.executable, [...APPLICATION_ARGS], {
      cwd: request.workspace,
      env: applicationEnvironment(request.home, {}),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch (error) {
    // A file that exists but that Windows refuses to execute — a truncated or
    // replaced runtime, say — throws from `spawn` itself rather than emitting
    // an error event, so it has to be reported in the launcher's own words.
    throw new Error(`launcher: the packaged application ${request.executable} could not start: ${error instanceof Error ? error.message : String(error)}`)
  }
  const exited = new Promise<number | null>((accept) => { child.once('exit', code => accept(code)) })
  let stdout = ''
  let stderr = ''
  const forward = (chunk: Buffer, sink: (text: string) => void): void => {
    const text = chunk.toString()
    sink(text)
    for (const line of text.split(/\r?\n/u)) if (line !== '') request.onOutput(line)
  }
  child.stdout?.on('data', (chunk: Buffer) => forward(chunk, (text) => { stdout += text }))
  child.stderr?.on('data', (chunk: Buffer) => forward(chunk, (text) => { stderr += text }))
  try {
    const url = await waitForUrl(child, () => stdout, () => stderr, request.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS)
    return { url, exited, stop: () => child.kill() }
  } catch (error) {
    child.kill()
    await exited
    throw error
  }
}

function waitForUrl(
  child: ChildProcess,
  stdout: () => string,
  stderr: () => string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((accept, reject) => {
    const finish = (settle: () => void): void => {
      clearTimeout(timer)
      child.stdout?.removeListener('data', inspect)
      child.removeListener('exit', onExit)
      child.removeListener('error', onError)
      settle()
    }
    const inspect = (): void => {
      const url = announcedUrl(stdout())
      if (url === undefined) return
      finish(() => accept(url))
    }
    const onExit = (code: number | null): void => {
      finish(() => reject(new Error(`launcher: the packaged application exited with code ${String(code)} before it announced a URL\n${stderr()}`)))
    }
    const onError = (error: Error): void => {
      finish(() => reject(new Error(`launcher: the packaged application could not start: ${error.message}`)))
    }
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`launcher: the packaged application announced no URL within ${String(timeoutMs)} ms\n${stderr()}`)))
    }, timeoutMs)
    child.stdout?.on('data', inspect)
    child.once('exit', onExit)
    child.once('error', onError)
    inspect()
  })
}
