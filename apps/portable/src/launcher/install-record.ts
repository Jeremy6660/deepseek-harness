/**
 * The record that makes one directory an installed program.
 *
 * The record is the commit point of an installation. Everything an install does
 * happens before it is written, and its presence is what makes the launcher
 * present installed mode — so a tree that carries it is a tree an install
 * completed, and a failure that happens after it is written removes it rather
 * than leaving a directory that claims to be something it is not.
 *
 * It carries no absolute path of any kind. The program directory is always
 * recomputed from the host, and a persisted path could only ever be used to
 * decide what to protect — never what to remove.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LauncherLanguage } from './identity.ts'
import { INSTALL_MARKER_NAME, type DistributionLayout } from './layout.ts'

/** Record schema version this launcher writes and accepts. */
export const INSTALL_RECORD_FORMAT = 1

/** Exact keys one install record may carry. */
const RECORD_KEYS = [
  'formatVersion',
  'productId',
  'productVersion',
  'installDirectoryName',
  'launcherSha256',
  'installedAt',
  'interfaceLanguage',
] as const

/** The same keys in the order a strict read compares them. */
const SORTED_RECORD_KEYS = [...RECORD_KEYS].sort()

/** Which run mode one distribution root provides. */
export type RunMode = 'portable' | 'installed'

/** One installed program, as recorded beside it. */
export interface InstallRecord {
  /** Product identifier the installed files came from. */
  readonly productId: string
  /** Product version the installed files came from. */
  readonly productVersion: string
  /** ASCII directory name the program was installed as. */
  readonly installDirectoryName: string
  /** Digest of the launcher image that performed the install. */
  readonly launcherSha256: string
  /** Moment the install committed, in ISO 8601 form. */
  readonly installedAt: string
  /** Interface language the install was performed in. */
  readonly interfaceLanguage: LauncherLanguage
}

/** Outcome of reading one install record. */
export interface LoadedInstallRecord {
  /** Usable record; absent when the file was missing or rejected. */
  readonly record: InstallRecord | undefined
  /** Absolute path that was read. */
  readonly path: string
  /** Why the file supplied no record, or undefined when it was fine. */
  readonly defect: 'unreadable' | 'schema' | undefined
  /** Underlying failure detail for the `unreadable` defect. */
  readonly diagnostic: string
}

/**
 * Resolve the record path below one program directory.
 * @param root - the program directory.
 * @returns the absolute path of the install record.
 */
export function installRecordPath(root: string): string {
  return join(root, INSTALL_MARKER_NAME)
}

/**
 * Decide which mode one distribution root provides.
 *
 * Presence is the whole test. The record's contents are checked where they
 * matter — an uninstall proves the record describes this product before it
 * removes anything — but a damaged record still means the directory is an
 * installed program, and reporting it as a medium would offer the user the
 * wrong set of actions.
 *
 * @param layout - resolved distribution layout.
 * @returns installed when the directory carries the record, portable otherwise.
 */
export function detectRunMode(layout: DistributionLayout): RunMode {
  return existsSync(layout.installMarker) ? 'installed' : 'portable'
}

/**
 * Read the install record beside one program directory.
 * @param path - absolute record path.
 * @returns the record and how the file was treated, never throwing.
 */
export function readInstallRecord(path: string): LoadedInstallRecord {
  const rejected = (defect: 'unreadable' | 'schema', diagnostic = ''): LoadedInstallRecord =>
    ({ record: undefined, path, defect, diagnostic })
  if (!existsSync(path)) return rejected('unreadable', 'the file is missing')
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return rejected('unreadable', error instanceof Error ? error.message : String(error))
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return rejected('schema')
  const record = parsed as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (keys.length !== SORTED_RECORD_KEYS.length || !keys.every((key, index) => key === SORTED_RECORD_KEYS[index])) {
    return rejected('schema')
  }
  if (record.formatVersion !== INSTALL_RECORD_FORMAT) return rejected('schema')
  const text = ['productId', 'productVersion', 'installDirectoryName', 'launcherSha256', 'installedAt'] as const
  for (const name of text) {
    if (typeof record[name] !== 'string' || (record[name] as string).trim() === '') return rejected('schema')
  }
  if (record.interfaceLanguage !== 'zh-CN' && record.interfaceLanguage !== 'en') return rejected('schema')
  if (!/^[0-9a-f]{64}$/u.test(record.launcherSha256 as string)) return rejected('schema')
  return {
    record: {
      productId: record.productId as string,
      productVersion: record.productVersion as string,
      installDirectoryName: record.installDirectoryName as string,
      launcherSha256: record.launcherSha256 as string,
      installedAt: record.installedAt as string,
      interfaceLanguage: record.interfaceLanguage,
    },
    path,
    defect: undefined,
    diagnostic: '',
  }
}

/**
 * Persist one install record, proving the written bytes first.
 * @param path - absolute record path.
 * @param record - the record to store.
 * @throws When the bytes read back differ from the bytes written.
 */
export function writeInstallRecord(path: string, record: InstallRecord): void {
  const output = `${JSON.stringify({ formatVersion: INSTALL_RECORD_FORMAT, ...record }, undefined, 2)}\n`
  writeFileSync(path, output)
  if (readFileSync(path, 'utf8') !== output) throw new Error(`launcher: could not verify the install record written to ${path}`)
}
