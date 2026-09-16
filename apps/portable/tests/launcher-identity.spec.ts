import { afterEach, describe, expect, it, vi } from 'vitest'
import { launcherIdentity, launcherLanguage } from '../src/launcher/identity.ts'
import { format, launcherMessages } from '../src/launcher/messages.ts'

/** The inlined build values one product launcher carries. */
const INLINED: Readonly<Record<string, string>> = {
  DSH_CLIENT_TITLE_EN: 'Portable Agent Lab USB',
  DSH_CLIENT_TITLE_ZH: '便携智能体实验盘',
  DSH_CLIENT_WELCOME_EN: 'Welcome to Portable Agent Lab USB.',
  DSH_CLIENT_WELCOME_ZH: '欢迎使用便携智能体实验盘。',
  DSH_CLIENT_ATTRIBUTION_EN: 'Unofficial product based on DeepSeek Harness; not published or endorsed by DeepSeek.',
  DSH_CLIENT_ATTRIBUTION_ZH: '本产品基于 DeepSeek Harness，并非由 DeepSeek 发布或背书。',
  DSH_CLIENT_SUPPORT_EN: 'Simple support for 30 days after receipt.',
  DSH_CLIENT_SUPPORT_ZH: '收货后提供 30 天简单售后。',
  DSH_CLIENT_VERSION: '1.0.0',
  DSH_CLIENT_COMMIT_HASH: '0123456',
}

function inline(values: Readonly<Record<string, string>> = INLINED): void {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('launcher interface language', () => {
  it('selects Simplified Chinese only for Chinese locales', () => {
    expect(launcherLanguage('zh-CN')).toBe('zh-CN')
    expect(launcherLanguage('zh-Hans-CN')).toBe('zh-CN')
    expect(launcherLanguage(' zh ')).toBe('zh-CN')
    expect(launcherLanguage('en-US')).toBe('en')
    expect(launcherLanguage('')).toBe('en')
  })
})

describe('inlined product identity', () => {
  it('presents the localized title, welcome, attribution, and support', () => {
    inline()
    expect(launcherIdentity('zh-CN')).toEqual({
      title: '便携智能体实验盘',
      titleEn: 'Portable Agent Lab USB',
      welcome: '欢迎使用便携智能体实验盘。',
      attribution: '本产品基于 DeepSeek Harness，并非由 DeepSeek 发布或背书。',
      support: '收货后提供 30 天简单售后。',
      version: '1.0.0',
      commit: '0123456',
      language: 'zh-CN',
    })
    expect(launcherIdentity('en-GB').title).toBe('Portable Agent Lab USB')
    expect(launcherIdentity('en-GB').language).toBe('en')
  })

  it('keeps the English title ASCII under a Chinese interface, for names Windows tooling must handle', () => {
    inline()
    const identity = launcherIdentity('zh-CN')
    expect(identity.title).not.toBe(identity.titleEn)
    expect(identity.titleEn).toMatch(/^[ -~]+$/u)
  })

  it('fails loudly when the publisher build supplied no value', () => {
    expect(() => launcherIdentity('en')).toThrow(/DSH_CLIENT_TITLE_EN was not inlined/u)
  })

  it('fails loudly on a blank value rather than presenting an empty product', () => {
    inline({ ...INLINED, DSH_CLIENT_VERSION: '   ' })
    expect(() => launcherIdentity('en')).toThrow(/DSH_CLIENT_VERSION was not inlined/u)
  })

  it('reads no product.yml, so a distribution directory needs no metadata to start', () => {
    inline()
    // The identity comes from the process environment alone; the launcher is
    // never given a distribution root here and must still resolve.
    expect(launcherIdentity('en').title).toBe('Portable Agent Lab USB')
  })
})

describe('launcher interface copy', () => {
  it('covers the same keys in both languages', () => {
    expect(Object.keys(launcherMessages('zh-CN')).sort()).toEqual(Object.keys(launcherMessages('en')).sort())
  })

  it('leaves no message empty in either language', () => {
    for (const language of ['zh-CN', 'en'] as const) {
      for (const [key, value] of Object.entries(launcherMessages(language))) {
        expect(value.trim(), `${language} ${key}`).not.toBe('')
      }
    }
  })

  it('substitutes placeholders and leaves unknown ones alone', () => {
    expect(format('启动失败：{detail}', { detail: 'missing runtime' })).toBe('启动失败：missing runtime')
    expect(format('{count} of {total}', { count: 3 })).toBe('3 of {total}')
    expect(format('no placeholders', {})).toBe('no placeholders')
  })
})
