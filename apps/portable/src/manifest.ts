/** Deterministic sealing and read-only verification for portable distributions. */

import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { valid } from 'semver'
import { INSTALL_MARKER_NAME, LAUNCHER_BUILD_RECORD_NAME, LAUNCHER_SETTINGS_NAME } from './launcher/layout.ts'
import { portablePathSegments, resolvePortablePath } from './path-policy.ts'
import type {
  PortableContentRole,
  PortableDistributionManifest,
  PortableManifestFile,
  PortableProductConfig,
  PortableVerificationIssue,
  PortableVerificationReport,
} from './types.ts'

export const PORTABLE_MANIFEST_FILE = 'manifest.json'
export const PORTABLE_MANIFEST_CHECKSUM_FILE = 'manifest.sha256'

const PRODUCT_ID = /^[a-z][a-z0-9-]{2,63}$/u
const REVISION = /^[0-9a-f]{40}$/u
const DIGEST = /^[0-9a-f]{64}$/u

function comparePath(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sha256(body: Buffer | string): string {
  return createHash('sha256').update(body).digest('hex')
}

function record(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object`)
  const result = value as Record<string, unknown>
  const unknown = Object.keys(result).filter(key => !keys.includes(key))
  if (unknown.length > 0) throw new Error(`${path} has unknown field ${JSON.stringify(unknown[0])}`)
  for (const key of keys) if (!Object.hasOwn(result, key)) throw new Error(`${path}.${key} is required`)
  return result
}

/**
 * Resolve the immutable ownership role encoded by a distribution path.
 *
 * Three kinds of path belong to nobody. `PortableData/**` is the user's, and
 * the manifest pair is the seal itself. The launcher's own two files are the
 * third: an installed program directory is verified by this same manifest, and
 * both files appear there only after the copy that the manifest describes, so
 * counting them as unowned content would make every installed program report
 * itself as damaged. A medium carries neither, so on a medium the rule is inert.
 *
 * @param path - Validated slash-separated relative path.
 * @returns Immutable role, or undefined for metadata files and user-owned PortableData.
 * @throws When an immutable path has no supported owner.
 */
export function portableContentRole(path: string): PortableContentRole | undefined {
  const [root, target, ...rest] = portablePathSegments(path)
  if (root === 'PortableData') return undefined
  if (path === PORTABLE_MANIFEST_FILE || path === PORTABLE_MANIFEST_CHECKSUM_FILE) return undefined
  if (path === INSTALL_MARKER_NAME || path === LAUNCHER_SETTINGS_NAME) return undefined
  if (path === 'Launcher.exe') return 'launcher'
  if (path === 'product.yml') return 'metadata'
  // The launcher's build record is released alongside the executable it
  // describes, the same way `Runtime/win-x64/runtime-build.json` is released
  // with the Runtime. It is immutable content the publisher ships.
  if (path === LAUNCHER_BUILD_RECORD_NAME) return 'metadata'
  if (root === 'Runtime' && target === 'win-x64' && rest.length > 0) return 'runtime'
  if (root === 'Recovery' && target === 'win-x64' && rest.length > 0) return 'recovery'
  if (root === 'Source' && target !== undefined) return 'source'
  if (root === 'Developer' && target === 'win-x64' && rest.length > 0) return 'developer'
  if (root === 'Docs' && target === 'zh-CN' && rest.length > 0) return 'documentation'
  if (root === 'Licenses' && target !== undefined) return 'license'
  throw new Error(`portable distribution path ${JSON.stringify(path)} has no supported immutable owner`)
}

interface ScanResult {
  readonly files: PortableManifestFile[]
  readonly seen: Set<string>
  readonly issues: PortableVerificationIssue[]
}

function distributionRoot(root: string): string {
  if (!isAbsolute(root)) throw new Error('portable distribution root must be an explicit absolute directory')
  const absoluteRoot = resolve(root)
  const status = lstatSync(absoluteRoot)
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new Error(`portable distribution root ${absoluteRoot} must be an unlinked directory`)
  }
  return absoluteRoot
}

function scanDistribution(root: string, verifying: boolean): ScanResult {
  const files: PortableManifestFile[] = []
  const seen = new Set<string>()
  const issues: PortableVerificationIssue[] = []
  const folded = new Map<string, string>()
  const visit = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => comparePath(a.name, b.name))) {
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      portablePathSegments(path)
      const collision = folded.get(path.toLowerCase())
      if (collision !== undefined && collision !== path) {
        throw new Error(`portable distribution paths ${JSON.stringify(collision)} and ${JSON.stringify(path)} collide on Windows`)
      }
      folded.set(path.toLowerCase(), path)
      if (path === 'PortableData') {
        if (!entry.isDirectory()) {
          if (!verifying) throw new Error('portable distribution PortableData must be a directory')
          issues.push({ code: 'unsupported-entry', path })
        }
        continue
      }
      if (entry.isDirectory()) {
        visit(join(directory, entry.name), path)
        continue
      }
      seen.add(path)
      if (!entry.isFile()) {
        if (!verifying) throw new Error(`portable distribution ${JSON.stringify(path)} must be a regular file or directory`)
        issues.push({ code: 'unsupported-entry', path })
        continue
      }
      let role: PortableContentRole | undefined
      try { role = portableContentRole(path) } catch (error) {
        if (!verifying) throw error
        issues.push({ code: 'unexpected', path })
        continue
      }
      if (role === undefined) continue
      const body = readFileSync(join(directory, entry.name))
      files.push({ path, role, bytes: body.byteLength, sha256: sha256(body) })
    }
  }
  visit(resolve(root), '')
  files.sort((a, b) => comparePath(a.path, b.path))
  return { files, seen, issues }
}

function parseManifestFile(value: unknown, index: number): PortableManifestFile {
  const path = `manifest.json files[${index}]`
  const item = record(value, path, ['path', 'role', 'bytes', 'sha256'])
  if (typeof item.path !== 'string') throw new Error(`${path}.path must be a string`)
  portablePathSegments(item.path)
  const expectedRole = portableContentRole(item.path)
  if (expectedRole === undefined || item.role !== expectedRole) throw new Error(`${path}.role does not match its immutable owner`)
  if (!Number.isSafeInteger(item.bytes) || (item.bytes as number) < 0) throw new Error(`${path}.bytes must be a non-negative safe integer`)
  if (typeof item.sha256 !== 'string' || !DIGEST.test(item.sha256)) throw new Error(`${path}.sha256 must be a lowercase SHA-256 digest`)
  return { path: item.path, role: expectedRole, bytes: item.bytes as number, sha256: item.sha256 }
}

/**
 * Parse an untrusted distribution manifest without accessing its files.
 * @param source - JSON manifest text.
 * @returns Strict v1 Windows x64 manifest.
 * @throws When fields, paths, ownership, ordering, or identities are invalid.
 */
export function parsePortableDistributionManifest(source: string): PortableDistributionManifest {
  let parsed: unknown
  try { parsed = JSON.parse(source) } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`manifest.json must contain JSON: ${reason}`)
  }
  const root = record(parsed, 'manifest.json', ['schemaVersion', 'product', 'upstreamRevision', 'target', 'files'])
  if (root.schemaVersion !== 1) throw new Error('manifest.json schemaVersion must be 1')
  const product = record(root.product, 'manifest.json product', ['id', 'version'])
  if (typeof product.id !== 'string' || !PRODUCT_ID.test(product.id)) throw new Error('manifest.json product.id is invalid')
  if (typeof product.version !== 'string' || valid(product.version) === null) throw new Error('manifest.json product.version is invalid')
  if (typeof root.upstreamRevision !== 'string' || !REVISION.test(root.upstreamRevision)) {
    throw new Error('manifest.json upstreamRevision must be a lowercase 40-character Git revision')
  }
  const target = record(root.target, 'manifest.json target', ['platform', 'arch'])
  if (target.platform !== 'win32' || target.arch !== 'x64') throw new Error('manifest.json target must be win32/x64')
  if (!Array.isArray(root.files)) throw new Error('manifest.json files must be an array')
  const files = root.files.map(parseManifestFile)
  for (const [index, current] of files.entries()) {
    const previous = files[index - 1]
    if (previous !== undefined && comparePath(previous.path, current.path) >= 0) {
      throw new Error('manifest.json files must be uniquely sorted by path')
    }
    const collision = files.find((candidate, candidateIndex) => candidateIndex < index
      && candidate.path.toLowerCase() === current.path.toLowerCase())
    if (collision !== undefined) throw new Error(`manifest.json paths ${JSON.stringify(collision.path)} and ${JSON.stringify(current.path)} collide on Windows`)
  }
  return {
    schemaVersion: 1,
    product: { id: product.id, version: product.version },
    upstreamRevision: root.upstreamRevision,
    target: { platform: 'win32', arch: 'x64' },
    files,
  }
}

function serializeManifest(manifest: PortableDistributionManifest): string {
  return `${JSON.stringify(manifest, undefined, 2)}\n`
}

/**
 * Inventory and seal one explicit staging directory.
 * @param root - Staging root that receives manifest.json and manifest.sha256.
 * @param config - Validated product identity for the manifest.
 * @returns The written deterministic manifest.
 * @throws Without writing metadata when the staged tree contains an unsafe or unsupported entry.
 */
export function sealPortableDistribution(
  root: string,
  config: PortableProductConfig,
): PortableDistributionManifest {
  const absoluteRoot = distributionRoot(root)
  const scan = scanDistribution(absoluteRoot, false)
  const manifest: PortableDistributionManifest = {
    schemaVersion: 1,
    product: { id: config.product.id, version: config.product.version },
    upstreamRevision: config.upstream.revision,
    target: { platform: 'win32', arch: 'x64' },
    files: scan.files,
  }
  const source = serializeManifest(manifest)
  const checksum = `${sha256(source)}  ${PORTABLE_MANIFEST_FILE}\n`
  writeFileSync(join(absoluteRoot, PORTABLE_MANIFEST_FILE), source)
  writeFileSync(join(absoluteRoot, PORTABLE_MANIFEST_CHECKSUM_FILE), checksum)
  return manifest
}

function readTrustedManifest(root: string): PortableDistributionManifest {
  const source = readFileSync(join(root, PORTABLE_MANIFEST_FILE), 'utf8')
  const checksum = readFileSync(join(root, PORTABLE_MANIFEST_CHECKSUM_FILE), 'utf8')
  const match = /^([0-9a-f]{64})  manifest\.json\r?\n?$/u.exec(checksum)
  if (match === null) throw new Error('manifest.sha256 must contain one SHA-256 record for manifest.json')
  if (match[1] !== sha256(source)) throw new Error('manifest.sha256 does not match manifest.json')
  return parsePortableDistributionManifest(source)
}

/**
 * Read the sealed manifest of one distribution root.
 *
 * Installing copies exactly the files a sealed manifest owns, so the copy needs
 * both the manifest and the proof that it is the one the publisher wrote. A
 * staging root that carries no seal has neither, and an install refuses it
 * rather than inferring a file set from whatever the directory happens to hold.
 *
 * @param root - Explicit distribution root.
 * @returns The manifest whose checksum file matches its bytes.
 * @throws When the root, the metadata, or the checksum is missing or invalid.
 */
export function readSealedPortableManifest(root: string): PortableDistributionManifest {
  return readTrustedManifest(distributionRoot(root))
}

/**
 * Verify immutable files without changing the distribution.
 * @param root - Explicit distribution root.
 * @returns All recoverable content mismatches in deterministic order.
 * @throws When trusted metadata or a filesystem path is invalid.
 */
export function verifyPortableDistribution(root: string): PortableVerificationReport {
  const absoluteRoot = distributionRoot(root)
  const manifest = readTrustedManifest(absoluteRoot)
  const actual = scanDistribution(absoluteRoot, true)
  const byPath = new Map(actual.files.map(file => [file.path, file]))
  const issues: PortableVerificationIssue[] = [...actual.issues]
  const expectedPaths = new Set(manifest.files.map(file => file.path))
  for (const expected of manifest.files) {
    const observed = byPath.get(expected.path)
    if (observed === undefined) {
      if (!actual.seen.has(expected.path)) issues.push({ code: 'missing', path: expected.path })
      continue
    }
    if (observed.bytes !== expected.bytes || observed.sha256 !== expected.sha256) {
      issues.push({ code: 'modified', path: expected.path })
    }
  }
  for (const observed of actual.files) {
    if (!expectedPaths.has(observed.path)) issues.push({ code: 'unexpected', path: observed.path })
  }
  issues.sort((left, right) => comparePath(left.path, right.path) || comparePath(left.code, right.code))
  return { valid: issues.length === 0, issues }
}

/** Resolve one manifest-owned file path for future repair consumers. */
export function portableManifestPath(root: string, path: string): string {
  portableContentRole(path)
  return resolvePortablePath(root, path)
}
