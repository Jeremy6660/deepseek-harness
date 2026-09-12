import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parsePortableProductConfig } from '../src/product-config.ts'
import { png, productYaml, writeProductFixture } from './fixture.ts'

const roots: string[] = []

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-portable-config-'))
  roots.push(root)
  writeProductFixture(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('portable product config', () => {
  it('accepts the strict bilingual v1 product and local PNG', () => {
    const root = fixture()
    const config = parsePortableProductConfig(productYaml(), root)
    expect(config).toMatchObject({
      schemaVersion: 1,
      product: { id: 'portable-agent-lab-usb', version: '1.0.0' },
      branding: { primaryColor: { light: '#3366CC', dark: '#6699FF' } },
    })
  })

  it.each([
    ['missing field', productYaml().replace('  name: Example Student Publisher\n', ''), /publisher\.name is required/u],
    ['unknown field', `${productYaml()}unknown: true\n`, /unknown field "unknown"/u],
    ['custom YAML tag', productYaml().replace('schemaVersion: 1', 'schemaVersion: !!js/function function () {}'), /plain JSON-compatible YAML/u],
    ['invalid version', productYaml().replace('version: 1.0.0', 'version: current'), /valid semantic version/u],
    ['uppercase revision', productYaml().replace('0123456789abcdef', 'ABCDEF6789abcdef'), /lowercase 40-character/u],
    ['invalid light color', productYaml().replace("light: '#3366CC'", 'light: red'), /#RRGGBB/u],
    ['remote logo', productYaml().replace('Runtime/win-x64/brand/logo.png', 'https://example.com/logo.png'), /relative path/u],
    ['traversing logo', productYaml().replace('Runtime/win-x64/brand/logo.png', '../logo.png'), /traversing segments/u],
    ['SVG logo', productYaml().replace('Runtime/win-x64/brand/logo.png', 'Runtime/win-x64/brand/logo.svg'), /local PNG/u],
  ])('rejects %s', (_name, source, pattern) => {
    expect(() => parsePortableProductConfig(source, fixture())).toThrow(pattern)
  })

  it('rejects a non-PNG file and a linked asset directory', () => {
    const root = fixture()
    writeFileSync(join(root, 'Runtime/win-x64/brand/logo.png'), 'not png')
    expect(() => parsePortableProductConfig(productYaml(), root)).toThrow(/valid header/u)

    const other = join(root, 'other')
    mkdirSync(other)
    writeFileSync(join(other, 'logo.png'), png())
    rmSync(join(root, 'Runtime/win-x64/brand'), { recursive: true })
    try {
      const type = process.platform === 'win32' ? 'junction' : 'dir'
      symlinkSync(other, join(root, 'Runtime/win-x64/brand'), type)
      expect(() => parsePortableProductConfig(productYaml(), root)).toThrow(/filesystem link/u)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EPERM') return
      throw error
    }
  })
})
