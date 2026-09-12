/** Cordis Loader configuration file discovery and portable checkout reads. */

import { existsSync, globSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

/**
 * Return repository-relative Cordis Loader YAML paths under `root`.
 *
 * Translation consistency records are YAML sidecars, never Loader inputs.
 *
 * @param root Repository root to scan.
 * @returns Sorted repository-relative Loader configuration paths.
 */
export function cordisConfigFiles(root: string): string[] {
  return globSync(['**/*cordis*.yml', '**/*cordis*.yaml'], {
    cwd: root,
    exclude: ['.claude/**', 'node_modules/**', 'vendor/**', '**/*.i18n.yaml'],
  }).sort()
}

/**
 * Read one Loader file, following the one-line relative pointer produced when
 * Git checks out a tracked symlink on a filesystem with core.symlinks=false.
 * @param root Repository root that bounds every resolved pointer.
 * @param file Repository-relative Loader path.
 * @returns Loader YAML source from the file or its in-repository target.
 */
export function readCordisConfigFile(root: string, file: string): string {
  const absoluteRoot = resolve(root)
  let current = resolve(absoluteRoot, file)
  const visited = new Set<string>()
  while (true) {
    if (visited.has(current)) throw new Error(`${file}: cyclic checkout symlink pointer`)
    visited.add(current)
    const source = readFileSync(current, 'utf8')
    const match = /^(\.\.?[/\\][^\r\n]+\.ya?ml)\r?\n?$/u.exec(source)
    if (match?.[1] === undefined) return source
    const target = resolve(dirname(current), match[1])
    const rel = relative(absoluteRoot, target)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error(`${file}: checkout symlink pointer escapes the repository`)
    }
    if (!existsSync(target) || !statSync(target).isFile()) return source
    current = target
  }
}
