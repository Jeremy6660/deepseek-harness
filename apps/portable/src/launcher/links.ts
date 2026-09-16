/**
 * Directory handling that refuses to follow a filesystem link.
 *
 * Every path the launcher removes is checked one component at a time. A link
 * anywhere above the target would make the target name a directory somewhere
 * else entirely, so the removal would delete content the launcher never owned —
 * and a junction needs no privilege to create on Windows, which is exactly why
 * the check has to happen before the removal rather than during it.
 *
 * This is the model {@link requireUnlinkedFile} uses for distribution assets,
 * applied to directories the launcher may create and later remove.
 */

import { lstatSync, realpathSync } from 'node:fs'
import { join, parse, resolve, sep } from 'node:path'

/**
 * What one path names, when no filesystem link is followed.
 *
 * `absent` and `other` are both "there is no directory to act on here", and
 * they are separated because a removal reports them differently: absence is the
 * normal outcome of a retried uninstall, while a file where a directory was
 * expected is something the user should be told about.
 */
export type UnlinkedDirectoryStatus = 'absent' | 'directory' | 'link' | 'other'

/**
 * Inspect one path without following any filesystem link.
 * @param path - absolute or relative path to inspect.
 * @returns what the path names, checking every component on the way down.
 */
export function unlinkedDirectoryStatus(path: string): UnlinkedDirectoryStatus {
  const absolute = resolve(path)
  const { root } = parse(absolute)
  let current = root
  let status = lstatSync(current, { throwIfNoEntry: false })
  for (const segment of absolute.slice(root.length).split(sep)) {
    if (segment === '') continue
    if (status === undefined) return 'absent'
    if (status.isSymbolicLink()) return 'link'
    // A regular file where a directory has to be makes everything below it
    // unreachable; reporting that as absence would hide a real obstacle.
    if (!status.isDirectory()) return 'other'
    current = join(current, segment)
    status = lstatSync(current, { throwIfNoEntry: false })
  }
  if (status === undefined) return 'absent'
  if (status.isSymbolicLink()) return 'link'
  return status.isDirectory() ? 'directory' : 'other'
}

/**
 * Require one path to be a directory reached without crossing a filesystem link.
 * @param path - the directory to require.
 * @returns nothing; the caller may now act on the path.
 * @throws When the path is absent, linked, or not a directory.
 */
export function requireUnlinkedDirectory(path: string): void {
  const status = unlinkedDirectoryStatus(path)
  if (status === 'directory') return
  throw new Error(`launcher: ${resolve(path)} must be a directory reached without following a link; found ${status}`)
}

/**
 * Resolve the canonical spelling of one existing directory.
 *
 * Two spellings of the same directory have to compare equal before either is
 * treated as protected, and on Windows a short (8.3) name or a differently
 * cased spelling reaches the same place.
 *
 * @param path - the directory to canonicalize.
 * @returns the canonical absolute path, or undefined when it does not exist.
 */
export function canonicalForm(path: string): string | undefined {
  try {
    return realpathSync(resolve(path))
  } catch {
    return undefined
  }
}
