/**
 * Literal build-time reads for the publisher values inlined by the bundlers.
 *
 * Each value is read through a literal `process.env.DSH_CLIENT_*` property so
 * the Vite/tsdown `define` step replaces it with the validated string baked in
 * at build time; a dynamic `process.env[name]` would evaluate against the
 * empty `process.env` fallback and return `undefined` in the browser bundle.
 * The build orchestration (product client profile) has already validated every
 * value, so a missing one here is a build defect and fails loud rather than
 * shipping an empty brand.
 */

/**
 * Read a required product value, failing loud on a missing or empty value.
 * @param name - environment key, used only in the defect message.
 * @param value - inlined environment value to validate.
 * @returns the non-empty value.
 */
export function required(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(`ui-brand-product: ${name} is missing from the product client build environment`)
  }
  return value
}

/**
 * Publisher mark for the light palette, an inlined data-URI PNG (never a
 * remote URL).
 * @returns the publisher logo data URI.
 */
export function productLogo(): string {
  return required('DSH_CLIENT_LOGO', process.env.DSH_CLIENT_LOGO)
}

/**
 * Publisher mark for the dark palette, an inlined data-URI PNG (never a
 * remote URL).
 * @returns the publisher logo data URI.
 */
export function productLogoDark(): string {
  return required('DSH_CLIENT_LOGO_DARK', process.env.DSH_CLIENT_LOGO_DARK)
}

/**
 * Publisher primary color for the light palette.
 * @returns the light `#RRGGBB` color.
 */
export function productPrimaryLight(): string {
  return required('DSH_CLIENT_PRIMARY_LIGHT', process.env.DSH_CLIENT_PRIMARY_LIGHT)
}

/**
 * Publisher primary color for the dark palette.
 * @returns the dark `#RRGGBB` color.
 */
export function productPrimaryDark(): string {
  return required('DSH_CLIENT_PRIMARY_DARK', process.env.DSH_CLIENT_PRIMARY_DARK)
}
