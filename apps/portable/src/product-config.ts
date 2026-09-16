/** Strict parser for publisher-owned portable product metadata. */

import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import yaml from 'js-yaml'
import { valid } from 'semver'
import { portablePathSegments, requireUnlinkedFile, resolvePortablePath } from './path-policy.ts'
import type { PortableLocalizedText, PortableProductConfig } from './types.ts'

const PRODUCT_ID = /^[a-z][a-z0-9-]{2,63}$/u
const REVISION = /^[0-9a-f]{40}$/u
const COLOR = /^#[0-9a-f]{6}$/iu
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function record(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`product.yml ${path} must be an object`)
  }
  const result = value as Record<string, unknown>
  const unknown = Object.keys(result).filter(key => !keys.includes(key))
  if (unknown.length > 0) throw new Error(`product.yml ${path} has unknown field ${JSON.stringify(unknown[0])}; remove it`)
  for (const key of keys) {
    if (!Object.hasOwn(result, key)) throw new Error(`product.yml ${path}.${key} is required`)
  }
  return result
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`product.yml ${path} must be a non-empty string`)
  return value
}

function localized(value: unknown, path: string): PortableLocalizedText {
  const item = record(value, path, ['en', 'zh-CN'])
  return { en: text(item.en, `${path}.en`), 'zh-CN': text(item['zh-CN'], `${path}.zh-CN`) }
}

function product(value: unknown): PortableProductConfig['product'] {
  const item = record(value, 'product', ['id', 'version', 'title'])
  const id = text(item.id, 'product.id')
  if (!PRODUCT_ID.test(id)) throw new Error('product.yml product.id must match [a-z][a-z0-9-]{2,63}')
  const version = text(item.version, 'product.version')
  if (valid(version) === null) throw new Error('product.yml product.version must be a valid semantic version')
  return { id, version, title: localized(item.title, 'product.title') }
}

function publisher(value: unknown): PortableProductConfig['publisher'] {
  const item = record(value, 'publisher', ['name', 'support'])
  return { name: text(item.name, 'publisher.name'), support: localized(item.support, 'publisher.support') }
}

function assertPng(assetRoot: string, field: string, path: string): void {
  portablePathSegments(path)
  if (!path.toLowerCase().endsWith('.png')) throw new Error(`product.yml ${field} must name a local PNG file`)
  requireUnlinkedFile(assetRoot, path)
  const body = readFileSync(resolvePortablePath(assetRoot, path))
  if (body.byteLength < 24 || !body.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)
    || body.subarray(12, 16).toString('ascii') !== 'IHDR' || body.readUInt32BE(16) === 0 || body.readUInt32BE(20) === 0) {
    throw new Error(`product.yml ${field} must contain a PNG image with a valid header`)
  }
}

function branding(value: unknown, assetRoot: string): PortableProductConfig['branding'] {
  const item = record(value, 'branding', ['logo', 'logoDark', 'welcome', 'primaryColor'])
  const logo = text(item.logo, 'branding.logo')
  assertPng(assetRoot, 'branding.logo', logo)
  const logoDark = text(item.logoDark, 'branding.logoDark')
  assertPng(assetRoot, 'branding.logoDark', logoDark)
  const colors = record(item.primaryColor, 'branding.primaryColor', ['light', 'dark'])
  const light = text(colors.light, 'branding.primaryColor.light')
  const dark = text(colors.dark, 'branding.primaryColor.dark')
  if (!COLOR.test(light)) throw new Error('product.yml branding.primaryColor.light must be a #RRGGBB color')
  if (!COLOR.test(dark)) throw new Error('product.yml branding.primaryColor.dark must be a #RRGGBB color')
  return { logo, logoDark, welcome: localized(item.welcome, 'branding.welcome'), primaryColor: { light, dark } }
}

function upstream(value: unknown): PortableProductConfig['upstream'] {
  const item = record(value, 'upstream', ['repository', 'revision', 'attribution'])
  const repository = text(item.repository, 'upstream.repository')
  let url: URL
  try { url = new URL(repository) } catch { throw new Error('product.yml upstream.repository must be an absolute HTTPS URL') }
  if (url.protocol !== 'https:') throw new Error('product.yml upstream.repository must be an absolute HTTPS URL')
  const revision = text(item.revision, 'upstream.revision')
  if (!REVISION.test(revision)) throw new Error('product.yml upstream.revision must be a lowercase 40-character Git revision')
  return { repository, revision, attribution: localized(item.attribution, 'upstream.attribution') }
}

/**
 * Parse and validate product metadata plus its referenced local asset.
 * @param source - YAML document text.
 * @param assetRoot - Directory that owns relative asset paths.
 * @returns Strict v1 product configuration.
 * @throws With a field-qualified diagnostic for malformed or unsafe input.
 */
export function parsePortableProductConfig(source: string, assetRoot: string): PortableProductConfig {
  let parsed: unknown
  try { parsed = yaml.load(source, { schema: yaml.JSON_SCHEMA }) } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`product.yml must use plain JSON-compatible YAML: ${reason}`)
  }
  const root = record(parsed, '$', ['schemaVersion', 'product', 'publisher', 'branding', 'upstream'])
  if (root.schemaVersion !== 1) throw new Error('product.yml schemaVersion must be 1')
  return {
    schemaVersion: 1,
    product: product(root.product),
    publisher: publisher(root.publisher),
    branding: branding(root.branding, assetRoot),
    upstream: upstream(root.upstream),
  }
}

/**
 * Read a product configuration from disk.
 * @param path - Product YAML file.
 * @param assetRoot - Asset root; defaults to the YAML file's directory.
 * @returns Strict v1 product configuration.
 */
export function readPortableProductConfig(path: string, assetRoot: string = dirname(path)): PortableProductConfig {
  return parsePortableProductConfig(readFileSync(path, 'utf8'), assetRoot)
}
