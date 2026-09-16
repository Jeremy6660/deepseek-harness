/** Assemble the publisher-branded product client build environment from validated metadata. */

import { readFileSync } from 'node:fs'
import { resolvePortablePath } from './path-policy.ts'
import type { PortableProductConfig } from './types.ts'

/** The only logo form a publisher-branded product build accepts. */
const PRODUCT_LOGO_PREFIX = 'data:image/png;base64,'

/**
 * Encode a validated local PNG as the data URI the product client inlines.
 * @param logo - Validated PNG bytes (already checked against the product schema).
 * @returns `data:image/png;base64,` URI with no remote or scriptable content.
 */
export function productLogoDataUri(logo: Buffer): string {
  return `${PRODUCT_LOGO_PREFIX}${logo.toString('base64')}`
}

/**
 * Map validated product metadata to the exact product client build environment.
 *
 * This is the single bridge between the closed `product.yml` schema and the
 * build-time `DSH_CLIENT_*` values inlined by the bundlers. It does not read or
 * re-validate the configuration; `parsePortableProductConfig` has already done
 * both. The result omits `DSH_CLIENT_BUILD_PROFILE`, which the build selector
 * supplies, so it matches `PRODUCT_CLIENT_ENV_KEYS` in the build scripts exactly.
 *
 * @param config - Strict v1 product configuration.
 * @param logo - Validated PNG logo bytes for the light palette.
 * @param logoDark - Validated PNG logo bytes for the dark palette.
 * @returns The 15 public product values, without the profile selector.
 */
export function portableClientBuildEnvironment(
  config: PortableProductConfig,
  logo: Buffer,
  logoDark: Buffer,
): Readonly<Record<string, string>> {
  return {
    DSH_CLIENT_TITLE: config.product.title['zh-CN'],
    DSH_CLIENT_TITLE_EN: config.product.title.en,
    DSH_CLIENT_TITLE_ZH: config.product.title['zh-CN'],
    DSH_CLIENT_WELCOME_EN: config.branding.welcome.en,
    DSH_CLIENT_WELCOME_ZH: config.branding.welcome['zh-CN'],
    DSH_CLIENT_ATTRIBUTION_EN: config.upstream.attribution.en,
    DSH_CLIENT_ATTRIBUTION_ZH: config.upstream.attribution['zh-CN'],
    DSH_CLIENT_SUPPORT_EN: config.publisher.support.en,
    DSH_CLIENT_SUPPORT_ZH: config.publisher.support['zh-CN'],
    DSH_CLIENT_PRIMARY_LIGHT: config.branding.primaryColor.light,
    DSH_CLIENT_PRIMARY_DARK: config.branding.primaryColor.dark,
    DSH_CLIENT_LOGO: productLogoDataUri(logo),
    DSH_CLIENT_LOGO_DARK: productLogoDataUri(logoDark),
    DSH_CLIENT_COMMIT_HASH: config.upstream.revision.slice(0, 7),
    DSH_CLIENT_VERSION: config.product.version,
  }
}

/**
 * Read the validated logo asset for one staging root.
 * @param root - Explicit staging root.
 * @param config - Configuration naming the local PNG logo.
 * @returns The validated PNG bytes.
 */
export function readProductLogo(root: string, config: PortableProductConfig): Buffer {
  return readFileSync(resolvePortablePath(root, config.branding.logo))
}

/**
 * Read the validated dark-palette logo asset for one staging root.
 * @param root - Explicit staging root.
 * @param config - Configuration naming the local PNG logo.
 * @returns The validated PNG bytes.
 */
export function readProductLogoDark(root: string, config: PortableProductConfig): Buffer {
  return readFileSync(resolvePortablePath(root, config.branding.logoDark))
}
