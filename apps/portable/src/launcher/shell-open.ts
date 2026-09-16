/**
 * Handing one target to the Windows shell.
 *
 * The launcher opens exactly two kinds of target: the authenticated loopback
 * URL the packaged application announced, and directories inside its own
 * distribution. Both go through one fixed program with a single argument and
 * no command interpreter, so no shell metacharacter, quoting rule, or PATH
 * lookup can turn an opened target into a different command.
 */

import { spawn } from 'node:child_process'
import { isLoopbackLaunchUrl } from './app-launch.ts'

/** The Windows shell, which is also the handler that resolves a URL to the default browser. */
const SHELL_PROGRAM = 'explorer.exe'

/**
 * Open one target through the Windows shell.
 *
 * The shell's exit code is deliberately ignored: it reports whether an
 * existing Explorer window reused the request, not whether the target opened.
 * Only a failure to start the shell at all is reported.
 *
 * @param target - the URL or directory to open.
 * @returns a promise that resolves once the shell has started.
 * @throws When the shell program cannot be started.
 */
function openInShell(target: string): Promise<void> {
  return new Promise((accept, reject) => {
    const child = spawn(SHELL_PROGRAM, [target], { detached: true, stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      accept()
    })
  })
}

/**
 * Open the authenticated loopback URL in the default browser.
 * @param url - the URL the packaged application announced.
 * @returns a promise that resolves once the shell has started.
 * @throws When the URL is not an authenticated loopback root URL, or the shell cannot start.
 */
export function openApplicationUrl(url: string): Promise<void> {
  if (!isLoopbackLaunchUrl(url)) {
    throw new Error(`launcher: refusing to open ${JSON.stringify(url)}; only an authenticated loopback root URL may be opened`)
  }
  return openInShell(url)
}

/**
 * Open one directory from this distribution in the file manager.
 * @param directory - absolute path of the directory to open.
 * @returns a promise that resolves once the shell has started.
 * @throws When the shell cannot start.
 */
export function openDirectory(directory: string): Promise<void> {
  return openInShell(directory)
}
