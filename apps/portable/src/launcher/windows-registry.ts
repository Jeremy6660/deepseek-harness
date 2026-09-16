/**
 * The per-user uninstall entry Windows shows in Settings.
 *
 * The entry is written by importing a `.reg` file rather than by passing values
 * to `reg add /d`. Both reach the same place, but a command line has to survive
 * quoting rules that differ between the argument parser and the shell, and a
 * product title with a quote or a backslash in it is exactly where that goes
 * wrong. A file has no such layer: what is escaped once is what the registry
 * stores.
 *
 * The absolute paths below are what the operating system displays and launches.
 * They are read back only to prove the write landed, and the uninstall never
 * derives a removal target from them: that is recomputed from the host and the
 * ASCII directory name every time.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { privateTemporaryRoot, registryToolPath } from './environment.ts'

/** Registry root the uninstall entry is written below, for the current user only. */
const UNINSTALL_ROOT = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'

/** Header every version 5 registry script opens with. */
const REGISTRY_SCRIPT_HEADER = 'Windows Registry Editor Version 5.00'

/** One value the uninstall entry carries. */
type RegistryValue =
  | { readonly name: string; readonly kind: 'text'; readonly text: string }
  | { readonly name: string; readonly kind: 'dword'; readonly value: number }

/** Everything the uninstall entry presents. */
export interface UninstallEntry {
  /** ASCII directory name the program was installed as. */
  readonly installDirectoryName: string
  /** Product name Windows displays. */
  readonly displayName: string
  /** Product version Windows displays. */
  readonly displayVersion: string
  /** Directory the program was installed into. */
  readonly installLocation: string
  /** Command Windows runs to uninstall. */
  readonly uninstallCommand: string
  /** Image Windows shows beside the entry. */
  readonly displayIcon: string
  /** Publisher name, omitted when the build inlines none. */
  readonly publisher: string | undefined
  /** Installed size in kibibytes, omitted when the install did not measure one. */
  readonly estimatedSizeKib: number | undefined
}

/** Result of one registry program run. */
export interface RegistryCommandResult {
  /** Exit status, or null when the program was terminated by a signal. */
  readonly status: number | null
  /** Everything the program wrote to standard output. */
  readonly stdout: string
  /** Everything the program wrote to standard error. */
  readonly stderr: string
  /** Failure to start the program at all. */
  readonly failure: string | undefined
}

/** How one registry command is run; injectable so no test touches the real registry. */
export type RegistryCommand = (program: string, args: readonly string[]) => RegistryCommandResult

/** Everything the registry operations need beyond the entry itself. */
export interface RegistryOptions {
  /** Absolute path of `reg.exe`. */
  readonly program: string
  /** How to run it; defaults to a hidden synchronous spawn. */
  readonly run?: RegistryCommand
  /** Directory the temporary script is written to. */
  readonly temporaryRoot?: string
}

/** Run one registry command with a fixed argv and no command interpreter. */
function spawnRegistry(program: string, args: readonly string[]): RegistryCommandResult {
  const result = spawnSync(program, [...args], { encoding: 'utf8', windowsHide: true })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    failure: result.error === undefined ? undefined : result.error.message,
  }
}

/** The options one call runs with, every field resolved. */
interface ResolvedRegistryOptions {
  /** Absolute path of `reg.exe`. */
  readonly program: string
  /** How to run it. */
  readonly run: RegistryCommand
  /** Directory a temporary script is written to. */
  readonly temporaryRoot: string
}

/** Resolve the options one call runs with, reporting an unresolvable host. */
function resolveOptions(options: Partial<RegistryOptions>): ResolvedRegistryOptions {
  const program = options.program ?? registryToolPath()
  if (program === undefined || program === '') {
    throw new Error('launcher: this host names no Windows system directory, so the uninstall entry cannot be written')
  }
  return { program, run: options.run ?? spawnRegistry, temporaryRoot: options.temporaryRoot ?? privateTemporaryRoot() }
}

/**
 * Resolve the registry key one installed program owns.
 * @param installDirectoryName - ASCII directory name the program was installed as.
 * @returns the full key path.
 */
export function uninstallKeyPath(installDirectoryName: string): string {
  return `${UNINSTALL_ROOT}\\${installDirectoryName}`
}

/**
 * Reject one value a registry script cannot carry.
 *
 * A line break would end the value and start a new key, so a value carrying one
 * could write an entry nobody asked for. The product metadata is validated, but
 * this is the boundary where a string becomes registry structure.
 *
 * @param value - the text about to be escaped.
 * @param name - the value name, used in the failure.
 * @returns the same text.
 * @throws When the text carries a line break or a NUL.
 */
function requireOneLine(value: string, name: string): string {
  if (/[\r\n\u0000]/u.test(value)) throw new Error(`launcher: ${name} must be one line to be stored in the registry`)
  return value
}

/** Escape one string for a version 5 registry script. */
function escapeRegistryText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

/** Render one value as a registry script line. */
function renderValue(value: RegistryValue): string {
  if (value.kind === 'dword') return `"${value.name}"=dword:${value.value.toString(16).padStart(8, '0')}`
  return `"${value.name}"="${escapeRegistryText(requireOneLine(value.text, value.name))}"`
}

/**
 * Render the values one uninstall entry stores.
 * @param entry - the entry to render.
 * @returns the values, in a deterministic order.
 */
export function uninstallEntryValues(entry: UninstallEntry): readonly RegistryValue[] {
  return [
    { name: 'DisplayName', kind: 'text', text: entry.displayName },
    { name: 'DisplayVersion', kind: 'text', text: entry.displayVersion },
    { name: 'InstallLocation', kind: 'text', text: entry.installLocation },
    { name: 'UninstallString', kind: 'text', text: entry.uninstallCommand },
    { name: 'DisplayIcon', kind: 'text', text: entry.displayIcon },
    ...(entry.publisher === undefined ? [] : [{ name: 'Publisher', kind: 'text', text: entry.publisher } as const]),
    // The product offers neither, so Windows should not offer them either.
    { name: 'NoModify', kind: 'dword', value: 1 },
    { name: 'NoRepair', kind: 'dword', value: 1 },
    ...(entry.estimatedSizeKib === undefined
      ? []
      : [{ name: 'EstimatedSize', kind: 'dword', value: entry.estimatedSizeKib } as const]),
  ]
}

/**
 * Render the registry script that creates one uninstall entry.
 * @param entry - the entry to render.
 * @returns the script text, without its byte-order mark.
 */
export function renderUninstallScript(entry: UninstallEntry): string {
  const key = uninstallKeyPath(entry.installDirectoryName)
  const lines = [REGISTRY_SCRIPT_HEADER, '', `[${key}]`, ...uninstallEntryValues(entry).map(renderValue)]
  return `${lines.join('\r\n')}\r\n`
}

/**
 * Write one uninstall entry and prove it landed.
 * @param entry - the entry to write.
 * @param options - the registry program and how to run it.
 * @throws When the program cannot run, the import fails, or a value reads back different.
 */
export function writeUninstallEntry(entry: UninstallEntry, options: Partial<RegistryOptions> = {}): void {
  const resolved = resolveOptions(options)
  const directory = mkdtempSync(join(resolved.temporaryRoot, 'dsh-registry-'))
  const script = join(directory, 'uninstall.reg')
  try {
    // The registry script format is UTF-16LE with a byte-order mark; `reg.exe`
    // reads a UTF-8 file as the system code page and mangles every non-ASCII name.
    writeFileSync(script, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(renderUninstallScript(entry), 'utf16le')]))
    const imported = resolved.run(resolved.program, ['import', script])
    if (imported.failure !== undefined) throw new Error(`launcher: could not run the registry tool: ${imported.failure}`)
    if (imported.status !== 0) {
      throw new Error(`launcher: the uninstall entry could not be written: ${imported.stderr.trim() || `exit ${String(imported.status)}`}`)
    }
    const stored = readUninstallEntry(entry.installDirectoryName, resolved)
    if (stored?.DisplayName !== entry.displayName) {
      throw new Error(`launcher: the uninstall entry for ${entry.installDirectoryName} did not read back`)
    }
    if (stored.UninstallString !== entry.uninstallCommand) {
      throw new Error(`launcher: the uninstall command for ${entry.installDirectoryName} did not read back`)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

/**
 * Read the values one uninstall entry stored.
 * @param installDirectoryName - ASCII directory name the entry belongs to.
 * @param options - the registry program and how to run it.
 * @returns the stored values by name, or undefined when the key or program is absent.
 */
export function readUninstallEntry(
  installDirectoryName: string,
  options: Partial<RegistryOptions> = {},
): Record<string, string> | undefined {
  const resolved = resolveOptions(options)
  const queried = resolved.run(resolved.program, ['query', uninstallKeyPath(installDirectoryName)])
  if (queried.failure !== undefined || queried.status !== 0) return undefined
  const values: Record<string, string> = {}
  for (const line of queried.stdout.split(/\r?\n/u)) {
    // `reg query` prints one `    Name    REG_KIND    value` record per value.
    const match = /^\s{2,}(\S+)\s+(REG_\w+)\s+(.*)$/u.exec(line)
    if (match?.[1] !== undefined && match[3] !== undefined) values[match[1]] = match[3].trim()
  }
  return values
}

/**
 * Remove one uninstall entry.
 * @param installDirectoryName - ASCII directory name the entry belongs to.
 * @param options - the registry program and how to run it.
 * @returns true when the key is gone afterwards, including when it was never there.
 * @throws When the registry tool cannot be run at all.
 */
export function deleteUninstallEntry(installDirectoryName: string, options: Partial<RegistryOptions> = {}): boolean {
  const resolved = resolveOptions(options)
  const removed = resolved.run(resolved.program, ['delete', uninstallKeyPath(installDirectoryName), '/f'])
  if (removed.failure !== undefined) throw new Error(`launcher: could not run the registry tool: ${removed.failure}`)
  // A key that was never written is already gone, which is the outcome an
  // uninstall wants; only a key that survives is a failure.
  return readUninstallEntry(installDirectoryName, resolved) === undefined
}
