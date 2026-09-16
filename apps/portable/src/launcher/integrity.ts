/** Read-only integrity inspection the launcher presents before it starts anything. */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PORTABLE_MANIFEST_CHECKSUM_FILE, PORTABLE_MANIFEST_FILE, verifyPortableDistribution } from '../manifest.ts'
import type { PortableVerificationIssue } from '../types.ts'

/**
 * Outcome of one integrity inspection.
 *
 * `unsealed` is a development staging root without sealed metadata, not a
 * failure: the launcher discloses that it cannot prove content equality and
 * continues. `unreadable` means the metadata itself is invalid, so no file
 * comparison was possible.
 */
export type IntegrityStatus = 'verified' | 'unsealed' | 'damaged' | 'unreadable'

/** Integrity result the launcher prints and counts. */
export interface IntegrityReport {
  /** Which outcome the inspection reached. */
  readonly status: IntegrityStatus
  /** Manifest-owned files whose comparison failed, in deterministic order. */
  readonly issues: readonly PortableVerificationIssue[]
  /** Metadata files this root does not carry, for the `unsealed` outcome. */
  readonly missingMetadata: readonly string[]
  /** Diagnostic text for the `unreadable` outcome; never shown for other outcomes. */
  readonly diagnostic: string
}

const METADATA_FILES = [PORTABLE_MANIFEST_FILE, PORTABLE_MANIFEST_CHECKSUM_FILE]

/**
 * Inspect one distribution root without changing it.
 * @param root - directory holding `Launcher.exe` and the sealed metadata.
 * @returns the inspection outcome, never throwing for damaged content.
 */
export function inspectDistribution(root: string): IntegrityReport {
  const missingMetadata = METADATA_FILES.filter(name => !existsSync(join(root, name)))
  if (missingMetadata.length > 0) {
    return { status: 'unsealed', issues: [], missingMetadata, diagnostic: '' }
  }
  let issues: readonly PortableVerificationIssue[]
  try {
    issues = verifyPortableDistribution(root).issues
  } catch (error) {
    // Metadata problems are recoverable for the launcher: it reports them and
    // lets the user decide, because a later milestone owns repair.
    return {
      status: 'unreadable',
      issues: [],
      missingMetadata: [],
      diagnostic: error instanceof Error ? error.message : String(error),
    }
  }
  return issues.length === 0
    ? { status: 'verified', issues: [], missingMetadata: [], diagnostic: '' }
    : { status: 'damaged', issues, missingMetadata: [], diagnostic: '' }
}
