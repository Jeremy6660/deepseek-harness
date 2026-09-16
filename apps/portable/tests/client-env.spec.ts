import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  portableClientBuildEnvironment, productLogoDataUri, readProductLogo, readProductLogoDark,
} from '../src/client-env.ts'
import { parsePortableProductConfig } from '../src/product-config.ts'
import { png, productYaml, writeProductFixture } from './fixture.ts'

const roots: string[] = []

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-portable-client-env-'))
  roots.push(root)
  writeProductFixture(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('portable product client build environment', () => {
  it('maps validated metadata to the exact product client key set', () => {
    const root = fixture()
    const config = parsePortableProductConfig(productYaml(), root)
    const logo = png()
    const logoDark = Buffer.concat([png(), Buffer.from([1])])
    expect(portableClientBuildEnvironment(config, logo, logoDark)).toEqual({
      DSH_CLIENT_TITLE: '便携智能体实验盘',
      DSH_CLIENT_TITLE_EN: 'Portable Agent Lab USB',
      DSH_CLIENT_TITLE_ZH: '便携智能体实验盘',
      DSH_CLIENT_WELCOME_EN: 'Welcome to Portable Agent Lab USB.',
      DSH_CLIENT_WELCOME_ZH: '欢迎使用便携智能体实验盘。',
      DSH_CLIENT_ATTRIBUTION_EN: 'Unofficial product based on DeepSeek Harness; not published or endorsed by DeepSeek.',
      DSH_CLIENT_ATTRIBUTION_ZH: '本产品基于 DeepSeek Harness，并非由 DeepSeek 发布或背书。',
      DSH_CLIENT_SUPPORT_EN: 'Simple support for 30 days after receipt.',
      DSH_CLIENT_SUPPORT_ZH: '收货后提供 30 天简单售后。',
      DSH_CLIENT_PRIMARY_LIGHT: '#3366CC',
      DSH_CLIENT_PRIMARY_DARK: '#6699FF',
      DSH_CLIENT_LOGO: productLogoDataUri(logo),
      DSH_CLIENT_LOGO_DARK: productLogoDataUri(logoDark),
      DSH_CLIENT_COMMIT_HASH: '0123456',
      DSH_CLIENT_VERSION: '1.0.0',
    })
  })

  it('reads each palette logo from the file its own field names', () => {
    const root = fixture()
    const config = parsePortableProductConfig(productYaml(), root)
    writeFileSync(join(root, 'Runtime/win-x64/brand/logo.png'), png())
    writeFileSync(join(root, 'Runtime/win-x64/brand/logo-dark.png'), Buffer.concat([png(), Buffer.from([2])]))
    expect(readProductLogo(root, config).equals(readProductLogoDark(root, config))).toBe(false)
    expect(readProductLogo(root, config).byteLength).toBe(24)
    expect(readProductLogoDark(root, config).byteLength).toBe(25)
  })

  it('encodes the logo as a local data URI with no remote or scriptable content', () => {
    const logo = png()
    expect(productLogoDataUri(logo)).toBe(`data:image/png;base64,${logo.toString('base64')}`)
    expect(productLogoDataUri(logo)).not.toMatch(/^https?:/u)
  })
})
