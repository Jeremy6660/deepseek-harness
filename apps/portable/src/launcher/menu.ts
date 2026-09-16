/**
 * The launcher's console interface.
 *
 * Rendering is separate from input so the presented facts can be asserted
 * without a terminal: the header, the menu, and the integrity detail are pure
 * functions of state and copy. The one thing this interface offers is the
 * product's own identity, its attribution, its documents, and two run modes —
 * it has no update, rollback, brand-editing, or plugin-installation action.
 */

import { existsSync } from 'node:fs'
import { runApplication } from './application-run.ts'
import type { LauncherIdentity } from './identity.ts'
import type { RunMode } from './install-record.ts'
import { inspectDistribution, type IntegrityReport } from './integrity.ts'
import type { DistributionLayout } from './layout.ts'
import { format, type MessageDictionary } from './messages.ts'
import type { ResolvedRoots } from './settings.ts'
import { openDirectory } from './shell-open.ts'

/** Detail lines the integrity entry prints before it stops listing. */
export const INTEGRITY_DETAIL_LIMIT = 20

/** What a menu entry does. */
export type MenuAction = 'run' | 'guide' | 'licenses' | 'integrity' | 'quit'

/** One selectable menu entry. */
export interface MenuEntry {
  /** Text the user types to select this entry. */
  readonly input: string
  /** Behavior this entry selects. */
  readonly action: MenuAction
  /** Copy key for this entry's label. */
  readonly label: keyof MessageDictionary & string
}

/** The menu, in presentation order. */
export const MENU_ENTRIES: readonly MenuEntry[] = [
  { input: '1', action: 'run', label: 'menu.run' },
  { input: '2', action: 'guide', label: 'menu.guide' },
  { input: '3', action: 'licenses', label: 'menu.licenses' },
  { input: '4', action: 'integrity', label: 'menu.integrity' },
  { input: '0', action: 'quit', label: 'menu.quit' },
]

/** Everything the header presents. */
export interface MenuState {
  /** Product identity read from the inlined build values. */
  readonly identity: LauncherIdentity
  /** Mode this root provides. */
  readonly mode: RunMode
  /** Roots the next launch will use. */
  readonly roots: ResolvedRoots
  /** Integrity of the distribution root. */
  readonly integrity: IntegrityReport
}

/**
 * Resolve which action one line of input selects.
 * @param input - the line the user entered.
 * @returns the selected action, or undefined when the line selects no entry.
 */
export function menuActionFor(input: string): MenuAction | undefined {
  const trimmed = input.trim()
  return MENU_ENTRIES.find(entry => entry.input === trimmed)?.action
}

/**
 * Render the product header: identity, attribution, mode, roots, and integrity.
 * @param state - the facts to present.
 * @param messages - interface copy for the selected language.
 * @returns the lines to print, in order.
 */
export function renderHeader(state: MenuState, messages: MessageDictionary): string[] {
  const { identity, roots } = state
  return [
    `${identity.title}  ${identity.version}`,
    identity.welcome,
    identity.attribution,
    identity.support,
    '',
    `${messages['label.commit']}: ${identity.commit}`,
    `${messages['label.mode']}: ${messages[state.mode === 'portable' ? 'mode.portable' : 'mode.installed']}`,
    `${messages['label.stateRoot']}: ${roots.home}`,
    `${messages['label.workspace']}: ${roots.workspace}`,
    `${messages['label.integrity']}: ${renderIntegritySummary(state.integrity, messages)}`,
  ]
}

/**
 * Render the one-line integrity summary.
 * @param report - the inspection outcome.
 * @param messages - interface copy for the selected language.
 * @returns the summary line.
 */
export function renderIntegritySummary(report: IntegrityReport, messages: MessageDictionary): string {
  if (report.status === 'verified') return messages['integrity.verified']
  if (report.status === 'unsealed') {
    return format(messages['integrity.unsealed'], { names: report.missingMetadata.join(', ') })
  }
  if (report.status === 'damaged') {
    return format(messages['integrity.damaged'], { count: report.issues.length })
  }
  return format(messages['integrity.unreadable'], { detail: report.diagnostic })
}

/**
 * Render the per-file integrity detail.
 * @param report - the inspection outcome.
 * @param messages - interface copy for the selected language.
 * @param limit - greatest number of file lines to print.
 * @returns the detail lines; empty when the report lists no file.
 */
export function renderIntegrityDetail(
  report: IntegrityReport,
  messages: MessageDictionary,
  limit: number = INTEGRITY_DETAIL_LIMIT,
): string[] {
  return report.issues
    .slice(0, limit)
    .map(issue => format(messages['integrity.issue'], { code: issue.code, path: issue.path }))
}

/**
 * Render the selectable entries.
 * @param messages - interface copy for the selected language.
 * @returns the numbered entry lines, in presentation order.
 */
export function renderMenu(messages: MessageDictionary): string[] {
  return MENU_ENTRIES.map(entry => `  ${entry.input}) ${messages[entry.label]}`)
}

/** Everything the menu loop needs beyond its state. */
export interface MenuDependencies {
  /** Receives one line of interface output. */
  readonly write: (line: string) => void
  /** Reads one line of input; resolves undefined at end of input. */
  readonly ask: (prompt: string) => Promise<string | undefined>
  /** Directory holding `Launcher.exe`. */
  readonly layout: DistributionLayout
}

/**
 * Present the menu until the user quits or input ends.
 *
 * @param state - the facts the header presents.
 * @param messages - interface copy for the selected language.
 * @param dependencies - output, input, and the distribution layout.
 * @returns the last state, after any integrity entry refreshed it.
 */
export async function runMenu(
  state: MenuState,
  messages: MessageDictionary,
  dependencies: MenuDependencies,
): Promise<MenuState> {
  const { write, ask, layout } = dependencies
  let current = state
  for (;;) {
    write('')
    for (const line of renderHeader(current, messages)) write(line)
    write('')
    for (const line of renderMenu(messages)) write(line)
    const answer = await ask(messages['menu.prompt'])
    if (answer === undefined) return current
    const action = menuActionFor(answer)
    if (action === undefined) {
      write(messages['menu.invalid'])
      continue
    }
    if (action === 'quit') return current
    if (action === 'run') {
      await runApplication({ layout, roots: current.roots, messages, write })
      await pause(write, ask, messages)
      continue
    }
    if (action === 'integrity') {
      current = { ...current, integrity: inspectDistribution(layout.root) }
      write(renderIntegritySummary(current.integrity, messages))
      for (const line of renderIntegrityDetail(current.integrity, messages)) write(line)
      await pause(write, ask, messages)
      continue
    }
    const directory = action === 'guide' ? layout.guideDirectory : layout.licensesDirectory
    if (!existsSync(directory)) {
      write(format(messages['open.missing'], { path: directory }))
    } else {
      try {
        await openDirectory(directory)
        write(format(messages['open.opened'], { path: directory }))
      } catch (error) {
        write(format(messages['open.failed'], {
          path: directory,
          detail: error instanceof Error ? error.message : String(error),
        }))
      }
    }
    await pause(write, ask, messages)
  }
}

/** Wait for the user before redrawing the menu. */
async function pause(
  write: (line: string) => void,
  ask: (prompt: string) => Promise<string | undefined>,
  messages: MessageDictionary,
): Promise<void> {
  write('')
  await ask(messages['wait.enter'])
}
