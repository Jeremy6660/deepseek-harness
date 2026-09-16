import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launcherBuildInputs, launcherBundleDefines, measure, parseCli, usage } from '../scripts/build-launcher.ts'
import { writeProductFixture } from './fixture.ts'

const roots: string[] = []

function scratch(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('launcher build command line', () => {
  it('requires an explicit absolute staging root and output directory', () => {
    expect(() => parseCli([])).toThrow(/--root must name an explicit absolute staging directory/u)
    expect(() => parseCli(['--root', 'relative/staging', '--out', 'relative/out'])).toThrow(/--root/u)
    expect(() => parseCli([`--root=${scratch('dsh-launcher-root-')}`])).toThrow(/--out must name an explicit absolute output directory/u)
  })

  it('resolves the pair it is given and defaults to building the workspace', () => {
    const portableRoot = scratch('dsh-launcher-root-')
    const out = scratch('dsh-launcher-out-')
    expect(parseCli([`--root=${portableRoot}`, `--out=${out}`])).toEqual({ portableRoot, out, skipBuild: false })
    expect(parseCli([`--root=${portableRoot}`, `--out=${out}`, '--skip-build']).skipBuild).toBe(true)
    expect(isAbsolute(parseCli([`--root=${portableRoot}`, `--out=${out}`]).out)).toBe(true)
  })

  it('names the target and the record it writes', () => {
    expect(usage()).toContain('node24-win-x64')
    expect(usage()).toContain('launcher-build.json')
  })
})

describe('launcher build inputs', () => {
  it('inlines exactly the validated product values the launcher presents', () => {
    const portableRoot = scratch('dsh-launcher-product-')
    writeProductFixture(portableRoot)
    const { environment } = launcherBuildInputs(portableRoot)
    expect(environment.DSH_CLIENT_TITLE_EN).toBe('Portable Agent Lab USB')
    expect(environment.DSH_CLIENT_TITLE_ZH).toBe('便携智能体实验盘')
    expect(environment.DSH_CLIENT_VERSION).toBe('1.0.0')
    expect(environment.DSH_CLIENT_COMMIT_HASH).toBe('0123456')
    expect(Object.keys(environment).every(name => name.startsWith('DSH_CLIENT_'))).toBe(true)
    // The 15 public product values plus the profile selector the resolver adds.
    expect(Object.keys(environment)).toHaveLength(16)
  })

  it('records the product identifier and both localized titles rather than the one the environment carries', () => {
    const portableRoot = scratch('dsh-launcher-product-')
    writeProductFixture(portableRoot)
    expect(launcherBuildInputs(portableRoot).product).toEqual({
      id: 'portable-agent-lab-usb',
      version: '1.0.0',
      titleEn: 'Portable Agent Lab USB',
      titleZh: '便携智能体实验盘',
    })
  })

  it('records the full upstream revision rather than the shortened one the client displays', () => {
    const portableRoot = scratch('dsh-launcher-product-')
    writeProductFixture(portableRoot)
    const { environment, upstreamRevision } = launcherBuildInputs(portableRoot)
    expect(environment.DSH_CLIENT_COMMIT_HASH).toBe('0123456')
    expect(upstreamRevision).toBe('0123456789abcdef0123456789abcdef01234567')
  })

  it('refuses a staging root whose product metadata is invalid', () => {
    const portableRoot = scratch('dsh-launcher-product-')
    writeFileSync(join(portableRoot, 'product.yml'), 'schemaVersion: 1\n')
    expect(() => launcherBuildInputs(portableRoot)).toThrow()
  })
})

describe('launcher bundler substitutions', () => {
  it('keeps the real process.env object so the launcher can read the host environment', () => {
    const portableRoot = scratch('dsh-launcher-product-')
    writeProductFixture(portableRoot)
    const { environment } = launcherBuildInputs(portableRoot)
    const defines = launcherBundleDefines(environment)
    // Replacing the whole object is right for a browser artifact and fatal for a
    // console program: LOCALAPPDATA, APPDATA, and TEMP would all read undefined.
    expect(defines['process.env']).toBeUndefined()
  })

  it('inlines every product value as its own literal, which outranks the object', () => {
    const portableRoot = scratch('dsh-launcher-product-')
    writeProductFixture(portableRoot)
    const { environment } = launcherBuildInputs(portableRoot)
    const defines = launcherBundleDefines(environment)
    for (const [name, value] of Object.entries(environment)) {
      expect(defines[`process.env.${name}`]).toBe(JSON.stringify(value))
    }
    expect(Object.keys(defines).every(name => name.startsWith('process.env.'))).toBe(true)
  })
})

describe('artifact measurement', () => {
  it('records the executable byte count and digest', async () => {
    const directory = scratch('dsh-launcher-measure-')
    const product = join(directory, 'Launcher.exe')
    writeFileSync(product, 'launcher bytes')
    expect(await measure(product)).toEqual({
      path: 'Launcher.exe',
      bytes: 'launcher bytes'.length,
      sha256: createHash('sha256').update('launcher bytes').digest('hex'),
    })
  })
})
