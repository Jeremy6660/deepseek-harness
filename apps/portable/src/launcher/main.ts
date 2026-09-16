/**
 * The Portable Agent Lab launcher.
 *
 * The launcher is a console application at the root of one distribution. It
 * presents the product, the upstream attribution, the shipped documents, and
 * the distribution's integrity, and it starts the packaged Harness through
 * the `dsh` CLI's shipped profile. It reads no `product.yml`: every product
 * value below is an inlined `DSH_CLIENT_*` string the publisher build already
 * validated, and it starts no command the user can influence.
 */

import { createInterface } from 'node:readline'
import { launcherIdentity } from './identity.ts'
import { detectRunMode } from './install-record.ts'
import { inspectDistribution } from './integrity.ts'
import { distributionLayout, distributionRootOf, launcherSettingsPath } from './layout.ts'
import { runMenu, type MenuState } from './menu.ts'
import { format, launcherMessages, type MessageDictionary } from './messages.ts'
import { readLauncherSettings, resolveLaunchRoots } from './settings.ts'
import { STATE_ROOT_REASON } from './state-root-choice.ts'

/**
 * Resolve the distribution root, read the inlined identity, and present the menu.
 * @returns nothing; the process exits after the menu.
 */
async function main(): Promise<void> {
  const layout = distributionLayout(distributionRootOf(process.execPath))
  const mode = detectRunMode(layout)
  const identity = launcherIdentity()
  const messages = launcherMessages(identity.language)
  const write = (line: string): void => { process.stdout.write(`${line}\n`) }

  const loaded = readLauncherSettings(launcherSettingsPath(layout, mode === 'installed'))
  if (loaded.defect !== undefined) {
    write(format(messages['settings.ignored'], {
      path: loaded.path,
      detail: loaded.defect === 'unreadable' ? loaded.diagnostic : messages['settings.schema'],
    }))
  }
  const roots = resolveLaunchRoots(layout, mode === 'installed', loaded.settings)
  if (roots.defect !== undefined) {
    write(format(messages['settings.stateRootRejected'], {
      reason: messages[STATE_ROOT_REASON[roots.defect]],
      path: roots.home,
    }))
  }

  const state: MenuState = {
    identity,
    mode,
    roots,
    integrity: inspectDistribution(layout.root),
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout })
  const lines = terminal[Symbol.asyncIterator]()
  const ask = async (prompt: string): Promise<string | undefined> => {
    process.stdout.write(prompt)
    const next = await lines.next()
    return next.done === true ? undefined : next.value
  }
  try {
    await runMenu(state, messages, { write, ask, layout })
  } finally {
    terminal.close()
  }
  write(messages['exit.bye'])
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    // The interface language is unknown until the inlined identity is read,
    // and reading it is what can fail. Fall back to Simplified Chinese, the
    // product's primary market, for the one message this path can print.
    const messages: MessageDictionary = launcherMessages('zh-CN')
    const detail = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${format(messages['fatal'], { detail })}\n`)
    process.exitCode = 1
  }
}
