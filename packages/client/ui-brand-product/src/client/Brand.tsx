import { BrandImage } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './Brand.module.css'
import { productLogo, productLogoDark } from './env.ts'
import { NS } from './locales.ts'

/** The publisher locale seat carried by the copy-bearing occupants. */
type ProductLocale = PropsLocale<typeof NS>

/**
 * Join the host-supplied mark class with the palette-swap class the stylesheet
 * qualifies by theme. The host class carries geometry the occupant cannot know
 * (the hero passes its entrance-animated class), so neither replaces the other.
 *
 * A stylesheet's ambient declaration types every class name as possibly absent,
 * which is why both arguments may be undefined: an absent class is left out of
 * the attribute rather than rendered into it as the text `undefined`.
 *
 * @param hostClass - class the slot host supplied, when it supplied one.
 * @param swapClass - the palette class for this mark, when the stylesheet named one.
 * @returns the classes as one attribute value, or undefined when neither is present.
 */
function markClass(hostClass: string | undefined, swapClass: string | undefined): string | undefined {
  const classes = [hostClass, swapClass].filter(name => name !== undefined && name !== '')
  return classes.length === 0 ? undefined : classes.join(' ')
}

/**
 * Publisher logo as the sidebar brand mark, in both palettes. Decorative here
 * (`alt=""`): the adjacent brand name supplies the accessible label in the
 * expanded column, and the inlined data-URI sources keep the mark free of any
 * remote fetch. The stylesheet shows exactly one, keyed by the resolved theme.
 * @param props - host-supplied mark size.
 * @returns the publisher logo elements.
 */
export function ProductBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return (
    <>
      <BrandImage src={productLogo()} alt="" size={size} className={css.lightMark} />
      <BrandImage src={productLogoDark()} alt="" size={size} className={css.darkMark} />
    </>
  )
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
 * Publisher logo as the blank-session hero mark, in both palettes.
 * @param props - host-supplied mark size and geometry class.
 * @returns the publisher logo elements.
 */
export function ProductHeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return (
    <>
      <BrandImage src={productLogo()} alt="" size={size} className={markClass(className, css.lightMark)} />
      <BrandImage src={productLogoDark()} alt="" size={size} className={markClass(className, css.darkMark)} />
    </>
  )
}

/**
 * Publisher welcome line as the blank-session hero welcome.
 * @param props - the locale seat injecting the typed `t`.
 * @returns the welcome text element.
 */
export function ProductHeroWelcome({ t }: ProductLocale) {
  return <span>{t('welcome')}</span>
}
