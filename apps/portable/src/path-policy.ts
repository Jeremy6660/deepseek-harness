/** Windows-safe relative-path validation shared by product assets and manifests. */

import { lstatSync, realpathSync, type Stats } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu
const WINDOWS_INVALID_CHARACTER = /[<>:"\\|?*\u0000-\u001f]/u

function invalidPath(path: string, reason: string): never {
  throw new Error(`portable path ${JSON.stringify(path)} ${reason}`)
}

/**
 * Validate one slash-separated path for storage on a Windows distribution.
 * @param path - Untrusted relative path.
 * @returns Validated path segments.
 * @throws When the path is absolute, ambiguous, traversing, or invalid on Windows.
 */
export function portablePathSegments(path: string): string[] {
  if (path === '' || isAbsolute(path) || path.includes('\\') || path.includes(':')) {
    return invalidPath(path, 'must be a non-empty slash-separated relative path')
  }
  if (path.normalize('NFC') !== path) return invalidPath(path, 'must use Unicode NFC normalization')
  const segments = path.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') return invalidPath(path, 'must not contain empty or traversing segments')
    if (WINDOWS_INVALID_CHARACTER.test(segment)) return invalidPath(path, 'contains a character forbidden by Windows')
    if (/[ .]$/u.test(segment)) return invalidPath(path, 'contains a segment ending in a space or period')
    if (WINDOWS_RESERVED_NAME.test(segment)) return invalidPath(path, `contains reserved Windows name ${JSON.stringify(segment)}`)
  }
  return segments
}

/**
 * Resolve a validated portable path below an explicit root.
 * @param root - Owning root directory.
 * @param path - Slash-separated relative path.
 * @returns Absolute path below `root`.
 */
export function resolvePortablePath(root: string, path: string): string {
  return join(resolve(root), ...portablePathSegments(path))
}

function childOf(root: string, child: string): boolean {
  const rel = relative(root, child)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/**
 * Require a regular file reached without crossing a filesystem link.
 * @param root - Explicit asset root.
 * @param path - Validated relative asset path.
 * @returns File status for the final path.
 * @throws When a component is missing, linked, outside the root, or not a regular file.
 */
export function requireUnlinkedFile(root: string, path: string): Stats {
  const absoluteRoot = resolve(root)
  const rootStatus = lstatSync(absoluteRoot)
  if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink()) throw new Error(`portable asset root ${absoluteRoot} must be an unlinked directory`)
  let current = absoluteRoot
  for (const segment of portablePathSegments(path)) {
    current = join(current, segment)
    const status = lstatSync(current)
    if (status.isSymbolicLink()) throw new Error(`portable asset ${JSON.stringify(path)} must not cross a filesystem link`)
  }
  const status = lstatSync(current)
  if (!status.isFile()) throw new Error(`portable asset ${JSON.stringify(path)} must be a regular file`)
  const canonicalRoot = realpathSync(absoluteRoot)
  const canonicalFile = realpathSync(current)
  if (!childOf(canonicalRoot, canonicalFile)) throw new Error(`portable asset ${JSON.stringify(path)} resolves outside its asset root`)
  return status
}
