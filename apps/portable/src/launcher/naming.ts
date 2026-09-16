/**
 * Names the launcher derives from the inlined product name.
 *
 * One derivation rule keeps the install directory, the shortcuts, and the
 * uninstall entry consistent, and keeps the directory name ASCII so ordinary
 * Windows tooling never has to handle a non-ASCII program path.
 */

/** Character budget for one install directory name and the uninstall key built from it. */
const MAX_IDENTIFIER_LENGTH = 64

/**
 * Derive the ASCII install directory name from the English product title.
 * @param titleEn - inlined English product title.
 * @returns the ASCII identifier used for the install directory and the uninstall key.
 * @throws When the title yields an empty or oversized identifier.
 */
export function installDirectoryName(titleEn: string): string {
  const identifier = titleEn.replace(/[^A-Za-z0-9]/gu, '')
  if (identifier === '') throw new Error(`launcher: product title ${JSON.stringify(titleEn)} yields no ASCII install directory name`)
  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`launcher: product title ${JSON.stringify(titleEn)} yields an install directory name longer than ${String(MAX_IDENTIFIER_LENGTH)} characters`)
  }
  return identifier
}
