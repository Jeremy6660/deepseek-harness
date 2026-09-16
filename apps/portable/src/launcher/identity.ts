/**
 * Product identity the launcher presents.
 *
 * Every value below is a build-time-inlined `DSH_CLIENT_*` string that the
 * publisher build already validated. The launcher never reads `product.yml`;
 * a missing value means the build did not supply the product client profile,
 * which must fail loudly rather than present an empty product.
 */

/** Interface language the launcher selects from the host locale. */
export type LauncherLanguage = 'zh-CN' | 'en'

/** Product identity and copy one launcher interface presents. */
export interface LauncherIdentity {
  /** Localized product title. */
  readonly title: string
  /**
   * English product title, whatever the interface language is.
   *
   * Names that have to survive ordinary Windows tooling — the install
   * directory, the uninstall key — are derived from this one, so they stay
   * ASCII even on an interface that presents in Chinese.
   */
  readonly titleEn: string
  /** Localized welcome line. */
  readonly welcome: string
  /** Localized statement that the product is unofficial. */
  readonly attribution: string
  /** Localized publisher support statement. */
  readonly support: string
  /** Product version. */
  readonly version: string
  /** Short upstream revision the product pins. */
  readonly commit: string
  /** Selected interface language. */
  readonly language: LauncherLanguage
}

/**
 * Require one inlined build value.
 * @param value - the inlined value, absent when the build did not supply it.
 * @param name - the environment variable name, used in the failure.
 * @returns the non-empty inlined value.
 * @throws When the publisher build did not inline the value.
 */
function inlined(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`launcher: ${name} was not inlined; build the launcher with the product client build profile`)
  }
  return value
}

/**
 * Select the launcher interface language for one host locale.
 * @param locale - a BCP-47 locale tag.
 * @returns Simplified Chinese for Chinese locales, English otherwise.
 */
export function launcherLanguage(locale: string): LauncherLanguage {
  return /^zh(?:-|$)/iu.test(locale.trim()) ? 'zh-CN' : 'en'
}

/** Host locale the launcher presents in, defaulting to Simplified Chinese when ICU reports none. */
function systemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    // A runtime built without ICU data cannot report a locale; the product's
    // primary market is Simplified Chinese, so that is the safe default.
    return 'zh-CN'
  }
}

/**
 * Read the inlined product identity.
 * @param locale - host locale selecting the interface language.
 * @returns the localized identity and copy.
 * @throws When any inlined value is missing.
 */
export function launcherIdentity(locale: string = systemLocale()): LauncherIdentity {
  const language = launcherLanguage(locale)
  const titleEn = inlined(process.env.DSH_CLIENT_TITLE_EN, 'DSH_CLIENT_TITLE_EN')
  const titleZh = inlined(process.env.DSH_CLIENT_TITLE_ZH, 'DSH_CLIENT_TITLE_ZH')
  const welcomeEn = inlined(process.env.DSH_CLIENT_WELCOME_EN, 'DSH_CLIENT_WELCOME_EN')
  const welcomeZh = inlined(process.env.DSH_CLIENT_WELCOME_ZH, 'DSH_CLIENT_WELCOME_ZH')
  const attributionEn = inlined(process.env.DSH_CLIENT_ATTRIBUTION_EN, 'DSH_CLIENT_ATTRIBUTION_EN')
  const attributionZh = inlined(process.env.DSH_CLIENT_ATTRIBUTION_ZH, 'DSH_CLIENT_ATTRIBUTION_ZH')
  const supportEn = inlined(process.env.DSH_CLIENT_SUPPORT_EN, 'DSH_CLIENT_SUPPORT_EN')
  const supportZh = inlined(process.env.DSH_CLIENT_SUPPORT_ZH, 'DSH_CLIENT_SUPPORT_ZH')
  return {
    title: language === 'zh-CN' ? titleZh : titleEn,
    titleEn,
    welcome: language === 'zh-CN' ? welcomeZh : welcomeEn,
    attribution: language === 'zh-CN' ? attributionZh : attributionEn,
    support: language === 'zh-CN' ? supportZh : supportEn,
    version: inlined(process.env.DSH_CLIENT_VERSION, 'DSH_CLIENT_VERSION'),
    commit: inlined(process.env.DSH_CLIENT_COMMIT_HASH, 'DSH_CLIENT_COMMIT_HASH'),
    language,
  }
}
