/**
 * Path comparison the launcher uses before it treats one directory as another.
 *
 * The portable product is Windows-only, so comparison follows the Windows
 * filesystem: paths are case-insensitive, both separators are equivalent, and
 * a trailing separator is not a different directory. Comparison here is
 * lexical — it resolves `.` and `..` and normalizes the spelling, but it never
 * touches a filesystem link. Deciding whether a link is safe to follow is a
 * separate question that the uninstall ownership check answers.
 */

import { parse, resolve, sep } from 'node:path'

/** Whether the host filesystem folds case in path lookups. */
const CASE_INSENSITIVE = process.platform === 'win32'

/**
 * Normalize one path into the form used for comparison.
 * @param path - any absolute or relative path.
 * @returns the absolute, separator-normalized, case-folded comparison form.
 */
export function comparablePath(path: string): string {
  const absolute = resolve(path)
  return CASE_INSENSITIVE ? absolute.toLowerCase() : absolute
}

/**
 * Decide whether two paths name the same directory or file.
 * @param left - first path.
 * @param right - second path.
 * @returns true when both spellings resolve to one location.
 */
export function samePath(left: string, right: string): boolean {
  return comparablePath(left) === comparablePath(right)
}

/**
 * Decide whether one path lies strictly inside another.
 * @param parent - candidate ancestor directory.
 * @param child - candidate descendant path.
 * @returns true when `child` is below `parent`, never when they are equal.
 */
export function containsPath(parent: string, child: string): boolean {
  const inner = comparablePath(parent)
  const outer = comparablePath(child)
  if (outer === inner) return false
  const prefix = inner.endsWith(sep) ? inner : inner + sep
  return outer.startsWith(prefix)
}

/**
 * Decide whether one path lies inside another or is the same location.
 * @param parent - candidate ancestor directory.
 * @param child - candidate descendant path.
 * @returns true when `child` is below `parent` or names it.
 */
export function containsOrEqualsPath(parent: string, child: string): boolean {
  return samePath(parent, child) || containsPath(parent, child)
}

/**
 * Decide whether a path names the root of a filesystem.
 *
 * A state root at a volume root would make the product own an entire drive:
 * nothing would be a safe thing to clean up, and the uninstall precheck could
 * never prove that the Harness home is separate from unrelated user data.
 *
 * @param path - absolute path to test.
 * @returns true when the path is a filesystem root.
 */
export function isFilesystemRoot(path: string): boolean {
  const absolute = resolve(path)
  return parse(absolute).root === absolute
}
