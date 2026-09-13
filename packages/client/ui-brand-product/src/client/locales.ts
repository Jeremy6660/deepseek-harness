/**
 * The `product` locale namespace: publisher copy fixed at build time and read
 * through the literal build-environment inlining (see `env.ts`).
 */
import { required } from './env.ts'

/** Publisher brand copy keys. */
export type ProductKey = 'title' | 'welcome' | 'attribution' | 'support'

/** Namespace owning this package's publisher copy. */
export const NS = 'product' as const

/** Complete per-locale dictionary for the `product` namespace. */
export type ProductDict = Record<ProductKey, string>

/**
 * Assemble the bilingual dictionaries from the inlined build environment.
 * @returns zh and en dictionaries with the exact {@link ProductKey} set.
 */
export function productDicts(): { zh: ProductDict; en: ProductDict } {
  return {
    zh: {
      title: required('DSH_CLIENT_TITLE_ZH', process.env.DSH_CLIENT_TITLE_ZH),
      welcome: required('DSH_CLIENT_WELCOME_ZH', process.env.DSH_CLIENT_WELCOME_ZH),
      attribution: required('DSH_CLIENT_ATTRIBUTION_ZH', process.env.DSH_CLIENT_ATTRIBUTION_ZH),
      support: required('DSH_CLIENT_SUPPORT_ZH', process.env.DSH_CLIENT_SUPPORT_ZH),
    },
    en: {
      title: required('DSH_CLIENT_TITLE_EN', process.env.DSH_CLIENT_TITLE_EN),
      welcome: required('DSH_CLIENT_WELCOME_EN', process.env.DSH_CLIENT_WELCOME_EN),
      attribution: required('DSH_CLIENT_ATTRIBUTION_EN', process.env.DSH_CLIENT_ATTRIBUTION_EN),
      support: required('DSH_CLIENT_SUPPORT_EN', process.env.DSH_CLIENT_SUPPORT_EN),
    },
  }
}
