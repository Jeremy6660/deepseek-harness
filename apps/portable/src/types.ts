/** JSON-like values accepted by the portable product metadata formats. */

/** English and Simplified Chinese product copy. */
export interface PortableLocalizedText {
  readonly en: string
  readonly 'zh-CN': string
}

/** Validated build-time product configuration. */
export interface PortableProductConfig {
  readonly schemaVersion: 1
  readonly product: {
    readonly id: string
    readonly version: string
    readonly title: PortableLocalizedText
  }
  readonly publisher: {
    readonly name: string
    readonly support: PortableLocalizedText
  }
  readonly branding: {
    readonly logo: string
    readonly welcome: PortableLocalizedText
    readonly primaryColor: {
      readonly light: string
      readonly dark: string
    }
  }
  readonly upstream: {
    readonly repository: string
    readonly revision: string
    readonly attribution: PortableLocalizedText
  }
}

/** Immutable file purpose in a portable distribution. */
export type PortableContentRole =
  | 'launcher'
  | 'runtime'
  | 'recovery'
  | 'metadata'
  | 'source'
  | 'developer'
  | 'documentation'
  | 'license'

/** Recorded bytes for one immutable distribution file. */
export interface PortableManifestFile {
  readonly path: string
  readonly role: PortableContentRole
  readonly bytes: number
  readonly sha256: string
}

/** Deterministic identity and immutable inventory for one Windows x64 distribution. */
export interface PortableDistributionManifest {
  readonly schemaVersion: 1
  readonly product: {
    readonly id: string
    readonly version: string
  }
  readonly upstreamRevision: string
  readonly target: {
    readonly platform: 'win32'
    readonly arch: 'x64'
  }
  readonly files: readonly PortableManifestFile[]
}

/** One recoverable mismatch between a distribution and its manifest. */
export interface PortableVerificationIssue {
  readonly code: 'missing' | 'modified' | 'unexpected' | 'unsupported-entry'
  readonly path: string
}

/** Complete immutable-content verification result. */
export interface PortableVerificationReport {
  readonly valid: boolean
  readonly issues: readonly PortableVerificationIssue[]
}
