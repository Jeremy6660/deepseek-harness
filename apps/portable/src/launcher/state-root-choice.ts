/**
 * The state directory the user chooses from the menu.
 *
 * One path decides both halves of the choice: the settings file that remembers
 * it and the roots the next launch uses. Resolving it and reporting a refusal
 * therefore live together, so a value refused while the user types it and the
 * same value refused later while reading the settings file are refused in the
 * same words.
 */

import { launcherSettingsPath, type DistributionLayout } from './layout.ts'
import type { MessageKey } from './messages.ts'
import {
  readLauncherSettings,
  resolveLaunchRoots,
  resolveStateRoot,
  StateRootError,
  writeLauncherSettings,
  type ResolvedRoots,
  type StateRootDefect,
} from './settings.ts'

/** Localized explanation for each way a state directory can be refused. */
export const STATE_ROOT_REASON: Readonly<Record<StateRootDefect, MessageKey>> = {
  empty: 'stateRoot.empty',
  'filesystem-root': 'stateRoot.filesystemRoot',
  'contains-program': 'stateRoot.containsProgram',
  'inside-program': 'stateRoot.insideProgram',
}

/** What one menu selection decided. */
export interface StateRootChoice {
  /** Absolute settings path the choice was written to. */
  readonly path: string
  /** Roots the next launch uses. */
  readonly roots: ResolvedRoots
  /** Set when the typed value was refused, in which case nothing was stored. */
  readonly defect: StateRootDefect | undefined
}

/**
 * Apply one state directory the user typed.
 *
 * An empty input clears the stored choice, which returns both roots to the mode
 * default. Any other value is resolved first: a refused value is reported and
 * stored nowhere, because the settings file may only ever hold a choice this
 * launcher can use. The value is stored with the spelling the user typed, so a
 * relative path still names the same place when the medium changes drive letter.
 *
 * @param input - the line the user typed.
 * @param layout - resolved distribution layout supplying the relative base.
 * @param installed - whether the program directory is an installed program.
 * @returns the settings path written and the roots the next launch uses.
 */
export function applyStateRootChoice(input: string, layout: DistributionLayout, installed: boolean): StateRootChoice {
  const path = launcherSettingsPath(layout, installed)
  const stored = readLauncherSettings(path)
  const typed = input.trim()
  if (typed === '') {
    writeLauncherSettings(path, {})
    return { path, roots: resolveLaunchRoots(layout, installed, {}), defect: undefined }
  }
  try {
    resolveStateRoot(typed, layout, installed)
  } catch (error) {
    if (!(error instanceof StateRootError)) throw error
    return { path, roots: resolveLaunchRoots(layout, installed, stored.settings), defect: error.defect }
  }
  const settings = { stateRoot: typed }
  writeLauncherSettings(path, settings)
  return { path, roots: resolveLaunchRoots(layout, installed, settings), defect: undefined }
}
