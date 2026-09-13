// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { ThemeRuntime, type ThemeSettings } from '@deepseek-ai/dsh-client-ui-theme/client'
import { stubSettingsScope, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'
import { ProductBrandMark, ProductHeroWelcome } from '../src/client/Brand.tsx'

usePinnedBrowserLanguages('en')

const HOLES = [
  'sidebar.brand.mark',
  'sidebar.brand.name',
  'conversation.hero.brand.mark',
  'conversation.hero.welcome',
] as const

const PRODUCT_ENV: Record<string, string> = {
  DSH_CLIENT_BUILD_PROFILE: 'product',
  DSH_CLIENT_TITLE_EN: 'My Agent',
  DSH_CLIENT_TITLE_ZH: '我的智能体',
  DSH_CLIENT_WELCOME_EN: 'Welcome to my agent',
  DSH_CLIENT_WELCOME_ZH: '欢迎使用我的智能体',
  DSH_CLIENT_ATTRIBUTION_EN: 'Built with DSH',
  DSH_CLIENT_ATTRIBUTION_ZH: '基于 DSH 构建',
  DSH_CLIENT_SUPPORT_EN: 'Support',
  DSH_CLIENT_SUPPORT_ZH: '支持',
  DSH_CLIENT_PRIMARY_LIGHT: '#123456',
  DSH_CLIENT_PRIMARY_DARK: '#abcdef',
  DSH_CLIENT_LOGO: 'data:image/png;base64,iVBORw0KGgo=',
}

function stubProductEnv(): void {
  for (const [name, value] of Object.entries(PRODUCT_ENV)) vi.stubEnv(name, value)
}

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

async function bench(declare = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const theme = new ThemeRuntime(ctx, stubSettingsScope<ThemeSettings>().scope)
  ctx.provide('theme', theme)
  const declareHoles = () => slots.register({
    name: 'root',
    children: Object.fromEntries(HOLES.map(name => [name, { kind: 'single', scope: 'root' }])),
  } as never, () => null)
  const disposeHoles = declare ? declareHoles() : undefined
  return { ctx, slots, locale, theme, declareHoles, disposeHoles }
}

describe('product browser-brand plugin', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares the slot, locale, and theme services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'theme'])
  })

  it('leaves every slot empty outside the product build profile', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'local')
    const subject = await bench()
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
  })

  it('fills all four brand slots in the product profile and withdraws them on teardown', async () => {
    stubProductEnv()
    const subject = await bench()
    const fiber = subject.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(1)
    await fiber.dispose()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
  })

  it('registers the bilingual product dictionary from the build environment', async () => {
    stubProductEnv()
    const subject = await bench()
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    expect(subject.locale.bind('product')('title')).toBe(PRODUCT_ENV.DSH_CLIENT_TITLE_EN)
    expect(subject.locale.bind('product')('welcome')).toBe(PRODUCT_ENV.DSH_CLIENT_WELCOME_EN)
  })

  it('overrides the brand accent token in both palettes from the build environment', async () => {
    stubProductEnv()
    const subject = await bench()
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    expect(subject.theme.getTheme().active.tokens['--dsw-alias-brand-primary'])
      .toBe(PRODUCT_ENV.DSH_CLIENT_PRIMARY_LIGHT)
    subject.theme.setTheme('dark')
    expect(subject.theme.getTheme().active.tokens['--dsw-alias-brand-primary'])
      .toBe(PRODUCT_ENV.DSH_CLIENT_PRIMARY_DARK)
  })

  it('renders the publisher logo as an inlined data URI, never a remote URL', () => {
    stubProductEnv()
    const mark = render(<ProductBrandMark size={34} />)
    const image = mark.container.querySelector('img') as HTMLImageElement
    expect(image.src.startsWith('data:image/png;base64,')).toBe(true)
    expect(image.src.startsWith('http')).toBe(false)
    expect(image.src).toBe(PRODUCT_ENV.DSH_CLIENT_LOGO)
  })

  it('renders the publisher welcome line through the locale seat', () => {
    stubProductEnv()
    const t = ((key: string) => (key === 'welcome' ? 'Welcome to my agent' : key)) as never
    const welcome = render(<ProductHeroWelcome t={t} />)
    expect(welcome.getByText('Welcome to my agent')).toBeTruthy()
  })
})
