import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  parsePortableDistributionManifest,
  portableContentRole,
  sealPortableDistribution,
  verifyPortableDistribution,
} from '../src/manifest.ts'
import { readPortableProductConfig } from '../src/product-config.ts'
import { writeProductFixture } from './fixture.ts'

const roots: string[] = []

function fixture(order: 'forward' | 'reverse' = 'forward'): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-portable-manifest-'))
  roots.push(root)
  writeProductFixture(root, order)
  return root
}

function seal(root: string): string {
  sealPortableDistribution(root, readPortableProductConfig(join(root, 'product.yml'), root))
  return readFileSync(join(root, 'manifest.json'), 'utf8')
}

function rewriteManifest(root: string, mutate: (manifest: Record<string, unknown>) => void): void {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as Record<string, unknown>
  mutate(manifest)
  const source = `${JSON.stringify(manifest, undefined, 2)}\n`
  writeFileSync(join(root, 'manifest.json'), source)
  writeFileSync(join(root, 'manifest.sha256'), `${createHash('sha256').update(source).digest('hex')}  manifest.json\n`)
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('portable distribution manifest', () => {
  it('seals deterministically across creation order, Unicode names, and empty files', () => {
    const first = fixture('forward')
    const second = fixture('reverse')
    const left = seal(first)
    const right = seal(second)
    expect(left).toBe(right)
    expect(seal(first)).toBe(left)
    expect(parsePortableDistributionManifest(left).files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'Runtime/win-x64/empty.txt', bytes: 0 }),
      expect.objectContaining({ path: 'Source/说明.txt', role: 'source' }),
    ]))
    expect(readFileSync(join(first, 'manifest.sha256'), 'utf8')).toMatch(/^[0-9a-f]{64}  manifest\.json\n$/u)
  })

  it('reports missing, modified, unexpected, and unsupported immutable entries without touching PortableData', () => {
    const root = fixture()
    seal(root)
    const portable = join(root, 'PortableData', 'user.txt')
    const before = readFileSync(portable)
    unlinkSync(join(root, 'Source', '说明.txt'))
    writeFileSync(join(root, 'Runtime', 'win-x64', 'empty.txt'), 'changed')
    writeFileSync(join(root, 'Licenses', 'extra.txt'), 'extra')
    const external = join(root, 'external')
    mkdirSync(external)
    const link = join(root, 'Developer', 'win-x64', 'linked')
    symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir')

    expect(verifyPortableDistribution(root)).toEqual({
      valid: false,
      issues: [
        { code: 'unsupported-entry', path: 'Developer/win-x64/linked' },
        { code: 'unexpected', path: 'Licenses/extra.txt' },
        { code: 'modified', path: 'Runtime/win-x64/empty.txt' },
        { code: 'missing', path: 'Source/说明.txt' },
      ],
    })
    expect(readFileSync(portable)).toEqual(before)
  })

  it('rejects dangerous paths and case-insensitive manifest collisions', () => {
    expect(() => portableContentRole('Source/CON.txt')).toThrow(/reserved Windows name/u)
    expect(() => portableContentRole('../Source/file.txt')).toThrow(/traversing/u)
    const root = fixture()
    seal(root)
    rewriteManifest(root, (manifest) => {
      const files = manifest.files as Array<Record<string, unknown>>
      const source = files.find(file => file.path === 'Source/说明.txt')!
      files.push({ ...source, path: 'Source/说明.TXT' })
      files.sort((left, right) => String(left.path) < String(right.path) ? -1 : 1)
    })
    expect(() => verifyPortableDistribution(root)).toThrow(/collide on Windows|uniquely sorted/u)
  })

  it('rejects a replaced manifest and unsupported staging entries before sealing', () => {
    const root = fixture()
    seal(root)
    writeFileSync(join(root, 'manifest.json'), '{}\n')
    expect(() => verifyPortableDistribution(root)).toThrow(/does not match/u)

    rmSync(join(root, 'manifest.json'))
    rmSync(join(root, 'manifest.sha256'))
    writeFileSync(join(root, 'unknown.txt'), 'unknown')
    expect(() => seal(root)).toThrow(/no supported immutable owner/u)
    expect(() => readFileSync(join(root, 'manifest.json'))).toThrow()
  })

  it('requires an explicit absolute unlinked staging root', () => {
    const root = fixture()
    const config = readPortableProductConfig(join(root, 'product.yml'), root)
    expect(() => sealPortableDistribution('relative-staging', config)).toThrow(/explicit absolute directory/u)
    expect(() => verifyPortableDistribution('relative-staging')).toThrow(/explicit absolute directory/u)

    const parent = fixture()
    const link = join(parent, 'linked-root')
    try {
      symlinkSync(root, link, process.platform === 'win32' ? 'junction' : 'dir')
      expect(() => sealPortableDistribution(link, config)).toThrow(/unlinked directory/u)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EPERM') return
      throw error
    }
  })
})
