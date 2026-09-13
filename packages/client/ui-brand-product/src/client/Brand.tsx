import { BrandImage } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { productLogo } from './env.ts'
import { NS } from './locales.ts'

/** The publisher locale seat carried by the copy-bearing occupants. */
type ProductLocale = PropsLocale<typeof NS>

/**
 * Publisher logo as the sidebar brand mark. Decorative here (`alt=""`): the
 * adjacent brand name supplies the accessible label in the expanded column,
 * and the inlined data-URI source keeps the mark free of any remote fetch.
 * @param props - host-supplied mark size.
 * @returns the publisher logo element.
 */
export function ProductBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <BrandImage src={productLogo()} alt="" size={size} />
}

/**
 * Publisher title as the sidebar brand name.
 * @param props - the locale seat injecting the typed `t`.
 * @returns the title text element.
 */
export function ProductBrandName({ t }: ProductLocale) {
  return <span>{t('title')}</span>
}

/**
 * Publisher logo as the blank-session hero mark.
 * @param props - host-supplied mark size and geometry class.
 * @returns the publisher logo element.
 */
export function ProductHeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <BrandImage src={productLogo()} alt="" size={size} className={className} />
}

/**
 * Publisher welcome line as the blank-session hero welcome.
 * @param props - the locale seat injecting the typed `t`.
 * @returns the welcome text element.
 */
export function ProductHeroWelcome({ t }: ProductLocale) {
  return <span>{t('welcome')}</span>
}
