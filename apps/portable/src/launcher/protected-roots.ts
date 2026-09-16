/**
 * The directories an uninstall may never remove, and the check that proves it.
 *
 * The program directory is computed from the host every time; it is never read
 * from anything the launcher or the user stored. What the user *did* store — a
 * chosen state root — is used only here, and only in the safe direction: a
 * stored value can add a directory to the protected set, never supply a target
 * to remove.
 *
 * The protected set is derived through the same {@link resolveLaunchRoots} the
 * launch path uses. That matters more than it looks: a root protected at launch
 * and unprotected at uninstall would let the application write its state
 * somewhere the uninstall then deletes, which is the one outcome the whole
 * ownership split exists to prevent.
 */

import { resolve } from 'node:path'
import { defaultDshHome, expandHomePath } from '@deepseek-ai/dsh-home-paths'
import { unlinkedDirectoryStatus } from './links.ts'
import type { DistributionLayout } from './layout.ts'
import { containsPath, isFilesystemRoot, samePath } from './paths.ts'
import { resolveLaunchRoots, type LauncherSettings } from './settings.ts'

/**
 * Why one directory may not be removed.
 *
 * Each reason is separate because the user acts differently on each: an equal
 * path means the target and a protected directory are the same place, while a
 * contained one means removing the target would take a protected directory with
 * it.
 */
export type RemovalRefusal =
  | 'filesystem-root'
  | 'linked'
  | 'equals-protected'
  | 'inside-protected'
  | 'contains-protected'

/** The outcome of one removal precheck. */
export interface RemovalVerdict {
  /** Whether the removal may proceed. */
  readonly allowed: boolean
  /** Why it may not, when it may not. */
  readonly refusal: RemovalRefusal | undefined
  /** The protected directory the refusal names, when one is involved. */
  readonly protectedPath: string | undefined
}

/** The verdict that allows a removal. */
const ALLOWED: RemovalVerdict = { allowed: true, refusal: undefined, protectedPath: undefined }

/**
 * Resolve every directory an uninstall must leave alone.
 *
 * The set covers the two roots this launch resolved — the Harness home and the
 * workspace — the default Harness home, which the application uses whenever no
 * root is chosen, and an ambient `DSH_HOME`, which names a Harness home this
 * program does not own and therefore must never remove.
 *
 * @param layout - resolved distribution layout.
 * @param installed - whether the program directory is an installed program.
 * @param settings - the user's stored choices.
 * @param environment - the launcher's own environment.
 * @returns absolute protected directories, deduplicated by comparison.
 */
export function protectedRoots(
  layout: DistributionLayout,
  installed: boolean,
  settings: LauncherSettings,
  environment: NodeJS.ProcessEnv = process.env,
): readonly string[] {
  const roots = resolveLaunchRoots(layout, installed, settings)
  const candidates = [roots.home, roots.workspace, defaultDshHome()]
  const ambient = environment.DSH_HOME?.trim()
  if (ambient !== undefined && ambient !== '') candidates.push(resolve(expandHomePath(ambient)))
  const protectedPaths: string[] = []
  for (const candidate of candidates) {
    if (!protectedPaths.some(existing => samePath(existing, candidate))) protectedPaths.push(candidate)
  }
  return protectedPaths
}

/**
 * Decide whether one directory may be removed.
 *
 * @param target - the computed program directory.
 * @param protectedPaths - directories from {@link protectedRoots}.
 * @returns the verdict, naming the protected directory when one is involved.
 */
export function evaluateRemovalTarget(target: string, protectedPaths: readonly string[]): RemovalVerdict {
  const refuse = (refusal: RemovalRefusal, protectedPath?: string): RemovalVerdict =>
    ({ allowed: false, refusal, protectedPath })
  if (isFilesystemRoot(target)) return refuse('filesystem-root')
  // A link anywhere above the target would make it name a directory elsewhere,
  // and every check below compares spellings rather than destinations.
  if (unlinkedDirectoryStatus(target) === 'link') return refuse('linked')
  for (const candidate of protectedPaths) {
    if (samePath(candidate, target)) return refuse('equals-protected', candidate)
    if (containsPath(candidate, target)) return refuse('inside-protected', candidate)
    if (containsPath(target, candidate)) return refuse('contains-protected', candidate)
  }
  return ALLOWED
}
