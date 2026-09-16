/**
 * The launcher's own settings: which root holds the Harness home.
 *
 * A medium keeps this file below `PortableData`, so sealing ignores it and the
 * choice travels with the medium; an installed program keeps it beside the
 * marker that identified it as installed. Nothing else is stored — the
 * application's own state belongs to the Harness home.
 *
 * The stored value keeps the spelling the user chose. A relative value is
 * resolved against the distribution root, so a setting written on one machine
 * still names the same place when the medium is mounted under another drive
 * letter.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { expandHomePath, defaultDshHome } from '@deepseek-ai/dsh-home-paths'
import { PORTABLE_DATA_NAME, type DistributionLayout } from './layout.ts'
import { containsOrEqualsPath, containsPath, isFilesystemRoot } from './paths.ts'

/** Settings schema version this launcher writes and accepts. */
export const LAUNCHER_SETTINGS_FORMAT = 1

/** Exact keys one settings file may carry. */
const SETTINGS_KEYS = ['formatVersion', 'stateRoot'] as const

/** Launcher settings, as persisted. */
export interface LauncherSettings {
  /** State root the user chose, spelled as they entered it; absent means the mode default. */
  readonly stateRoot?: string
}

/** Why a settings file could not supply settings. */
export type SettingsDefect = 'unreadable' | 'schema'

/** Outcome of reading the settings file. */
export interface LoadedSettings {
  /** Usable settings; empty when nothing was stored or the file was rejected. */
  readonly settings: LauncherSettings
  /** Absolute path that was read. */
  readonly path: string
  /** Whatever made the file unusable, or undefined when it was fine or absent. */
  readonly defect: SettingsDefect | undefined
  /** Underlying failure detail for {@link SettingsDefect} `unreadable`. */
  readonly diagnostic: string
}

/** Why a state root the user named cannot be used. */
export type StateRootDefect = 'empty' | 'filesystem-root' | 'contains-program' | 'inside-program'

/** Rejection of one state root, carrying the reason so the interface can localize it. */
export class StateRootError extends Error {
  /**
   * @param defect - which rule the value broke.
   * @param input - the value the user supplied.
   */
  constructor(readonly defect: StateRootDefect, readonly input: string) {
    super(`launcher: state root ${JSON.stringify(input)} is rejected because ${defect}`)
    this.name = 'StateRootError'
  }
}

/** Roots one launch uses. */
export interface ResolvedRoots {
  /** Harness home the application reads and writes. */
  readonly home: string
  /** Directory the application starts in. */
  readonly workspace: string
  /** Set when a stored state root was rejected and the mode default was used instead. */
  readonly defect: StateRootDefect | undefined
}

/**
 * Read the launcher settings file.
 *
 * A missing file is the normal first run and is not a defect. A file this
 * launcher cannot use is reported and ignored rather than repaired: the
 * launcher never rewrites user data it did not understand.
 *
 * @param path - absolute settings path for this distribution root.
 * @returns the usable settings and how the file was treated.
 */
export function readLauncherSettings(path: string): LoadedSettings {
  if (!existsSync(path)) return { settings: {}, path, defect: undefined, diagnostic: '' }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return {
      settings: {},
      path,
      defect: 'unreadable',
      diagnostic: error instanceof Error ? error.message : String(error),
    }
  }
  const rejected: LoadedSettings = { settings: {}, path, defect: 'schema', diagnostic: '' }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return rejected
  const record = parsed as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (keys.length !== SETTINGS_KEYS.length || !keys.every((key, index) => key === SETTINGS_KEYS[index])) return rejected
  if (record.formatVersion !== LAUNCHER_SETTINGS_FORMAT) return rejected
  const stateRoot = record.stateRoot
  if (stateRoot !== undefined && (typeof stateRoot !== 'string' || stateRoot.trim() === '')) return rejected
  return {
    settings: stateRoot === undefined ? {} : { stateRoot: stateRoot as string },
    path,
    defect: undefined,
    diagnostic: '',
  }
}

/**
 * Persist the launcher settings, proving the written bytes first.
 * @param path - absolute settings path for this distribution root.
 * @param settings - settings to store; an empty object clears every choice.
 */
export function writeLauncherSettings(path: string, settings: LauncherSettings): void {
  const record: Record<string, unknown> = { formatVersion: LAUNCHER_SETTINGS_FORMAT }
  if (settings.stateRoot !== undefined) record.stateRoot = settings.stateRoot
  const output = `${JSON.stringify(record, undefined, 2)}\n`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, output)
  if (readFileSync(path, 'utf8') !== output) throw new Error(`launcher: could not verify the settings written to ${path}`)
}

/**
 * Resolve one state root the user named.
 *
 * A relative value is resolved against the distribution root so the choice
 * survives the medium moving between drive letters.
 *
 * Three placements are refused. A volume root would make the product own an
 * entire drive. A value that contains or equals the program directory would put
 * the program inside the user's own data, so the uninstall could not remove one
 * without the other. A value inside the program directory would be destroyed
 * when the program directory goes away — which is exactly what an uninstall
 * does — with one exception: on a medium, `PortableData` is user-owned, the
 * sealed manifest never covers it, and the medium's own default home lives
 * there, so a folder below it is a legitimate choice.
 *
 * @param input - the value the user supplied.
 * @param layout - resolved distribution layout supplying the relative base.
 * @param installed - whether the program directory is an installed program rather than a medium.
 * @returns the absolute state root.
 * @throws {StateRootError} when the value breaks one of those rules.
 */
export function resolveStateRoot(input: string, layout: DistributionLayout, installed: boolean): string {
  const trimmed = input.trim()
  if (trimmed === '') throw new StateRootError('empty', input)
  const expanded = expandHomePath(trimmed)
  const absolute = isAbsolute(expanded) ? resolve(expanded) : resolve(layout.root, expanded)
  if (isFilesystemRoot(absolute)) throw new StateRootError('filesystem-root', input)
  if (containsOrEqualsPath(absolute, layout.root)) throw new StateRootError('contains-program', input)
  const userOwned = !installed && containsPath(join(layout.root, PORTABLE_DATA_NAME), absolute)
  if (!userOwned && containsPath(layout.root, absolute)) throw new StateRootError('inside-program', input)
  return absolute
}

/**
 * Resolve the roots one launch uses for one mode.
 *
 * Portable mode keeps both roots on the medium, where the user's work travels
 * with the product. Installed mode keeps them in the Harness home, the only
 * user-owned location an installed program has, so removing the program never
 * removes the user's work. A stored root that no longer resolves falls back to
 * the mode default and reports why, because refusing to start would be worse
 * than starting in the default place.
 *
 * @param layout - resolved distribution layout.
 * @param installed - whether the root carries the install marker.
 * @param settings - the user's stored choices.
 * @returns the roots to use and any rejected stored root.
 */
export function resolveLaunchRoots(
  layout: DistributionLayout,
  installed: boolean,
  settings: LauncherSettings,
): ResolvedRoots {
  const workspace = installed ? undefined : layout.portableWorkspace
  const fallback = installed ? defaultDshHome() : layout.portableHome
  if (settings.stateRoot === undefined) {
    return { home: fallback, workspace: workspace ?? join(fallback, 'workspace'), defect: undefined }
  }
  let home: string
  try {
    home = resolveStateRoot(settings.stateRoot, layout, installed)
  } catch (error) {
    if (!(error instanceof StateRootError)) throw error
    return { home: fallback, workspace: workspace ?? join(fallback, 'workspace'), defect: error.defect }
  }
  return { home, workspace: workspace ?? join(home, 'workspace'), defect: undefined }
}
