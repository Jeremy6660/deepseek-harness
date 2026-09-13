/** Publisher-brand occupants for the browser-brand slots, active only in product builds. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import {
  ProductBrandMark, ProductBrandName, ProductHeroBrandMark, ProductHeroWelcome,
} from './Brand.tsx'
import { NS, productDicts } from './locales.ts'
import type { ProductKey } from './locales.ts'
import { productPrimaryDark, productPrimaryLight } from './env.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Publisher brand copy fixed at build time. */
    product: ProductKey
  }
}

/** Required services: slots for presentation, locale + theme for brand copy and accent. */
export const inject = ['slots', 'locale', 'theme']

/**
 * Fill the sidebar and conversation hero brand slots from the inlined product
 * build environment. Each declaring package's pair installs as one
 * declaration-aware set, so the occupants appear whether this row activates
 * before or after the declarer and withdraw together on teardown. The hero
 * welcome line rides the new `conversation.hero.welcome` slot.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  if (process.env.DSH_CLIENT_BUILD_PROFILE !== 'product') return

  const { zh, en } = productDicts()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-brand-product: dictionaries')

  const light = productPrimaryLight()
  const dark = productPrimaryDark()
  ctx.effect(() => ctx.theme.overrideTokens('ui-brand-product', {
    '--dsw-alias-brand-primary': { light, dark },
  }), 'ui-brand-product: brand accent')

  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, ProductBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name', locale: NS }, ProductBrandName)
    }))

  ctx.slots.inject('conversation.hero.brand.mark', () =>
    ctx.slots.inject('conversation.hero.welcome', function* () {
      yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, ProductHeroBrandMark)
      yield ctx.slots.register({ name: 'conversation.hero.welcome', locale: NS }, ProductHeroWelcome)
    }))
}
