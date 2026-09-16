/**
 * One application run, shared by portable and installed modes.
 *
 * The two modes differ only in which roots they resolve, so this module owns
 * the whole lifecycle — creating the roots, starting the packaged CLI,
 * announcing the URL, handing it to the browser, and waiting for the
 * application to end — exactly once.
 */

import { mkdirSync } from 'node:fs'
import { launchApplication, nativeCacheDirectory } from './app-launch.ts'
import type { DistributionLayout } from './layout.ts'
import { format, type MessageDictionary } from './messages.ts'
import type { ResolvedRoots } from './settings.ts'
import { openApplicationUrl } from './shell-open.ts'

/** Lines of packaged-CLI output kept for a failure report. */
const OUTPUT_TAIL_LINES = 20

/** Everything one run needs. */
export interface ApplicationRun {
  /** Resolved distribution layout supplying the packaged executable. */
  readonly layout: DistributionLayout
  /** Harness home and workspace this run uses. */
  readonly roots: ResolvedRoots
  /** Interface copy for the selected language. */
  readonly messages: MessageDictionary
  /** Receives one line of interface output. */
  readonly write: (line: string) => void
}

/**
 * Start the packaged application, open it, and wait for it to end.
 *
 * The application's own output is not echoed: it is start-up diagnostics in
 * English, while the interface reports the same events in the user's language.
 * The tail is kept so a failure can show what the application said.
 *
 * @param run - layout, resolved roots, copy, and output sink.
 * @returns the application's exit code, or undefined when it never started.
 */
export async function runApplication(run: ApplicationRun): Promise<number | null | undefined> {
  const { layout, roots, messages, write } = run
  mkdirSync(roots.home, { recursive: true })
  mkdirSync(nativeCacheDirectory(roots.home), { recursive: true })
  mkdirSync(roots.workspace, { recursive: true })
  write(format(messages['launch.starting'], { executable: layout.runtimeExecutable }))
  const tail: string[] = []
  let application
  try {
    application = await launchApplication({
      executable: layout.runtimeExecutable,
      home: roots.home,
      workspace: roots.workspace,
      onOutput: (line) => {
        tail.push(line)
        if (tail.length > OUTPUT_TAIL_LINES) tail.shift()
      },
    })
  } catch (error) {
    write(format(messages['launch.failed'], { detail: detailOf(error, tail) }))
    return undefined
  }
  write(format(messages['launch.ready'], { url: application.url }))
  try {
    await openApplicationUrl(application.url)
  } catch (error) {
    // The URL is already on screen, so a browser handoff failure is a
    // disclosure rather than a failed run.
    write(format(messages['open.failed'], {
      path: application.url,
      detail: error instanceof Error ? error.message : String(error),
    }))
  }
  write(messages['launch.hint'])
  const interrupt = (): void => { application.stop() }
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', interrupt)
  try {
    return await application.exited
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', interrupt)
  }
}

/** Compose a failure detail from an error and whatever the application last said. */
function detailOf(error: unknown, tail: readonly string[]): string {
  const reason = error instanceof Error ? error.message : String(error)
  return tail.length === 0 ? reason : `${reason}\n${tail.join('\n')}`
}
