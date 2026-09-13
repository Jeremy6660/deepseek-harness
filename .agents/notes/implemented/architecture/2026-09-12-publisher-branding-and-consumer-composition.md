# Agent Note: Publisher branding and consumer composition

Status: implemented

English | [中文](2026-09-12-publisher-branding-and-consumer-composition.zh.md)

## Problem

The [portable product metadata](../../proposed/feature/2026-09-11-portable-agent-usb-product.md) milestone delivered a closed, machine-readable product identity (`product.yml`) and a validated carrier, but nothing consumes that identity: publisher title, logo, primary colors, welcome line, attribution, and support statement never render in the Web client, and there is no trimmed composition that hides the developer-facing plugin, package, Cordis, and experimental surfaces for a consumer release.

## Decision

Publisher branding is fixed at build time and injected through the existing `DSH_CLIENT_*` client build environment, then presented by a new brand plugin package. A new `consumer` profile layers a trimming bundle over the Web app to hide developer surfaces.

### Build-time product profile

`scripts/client-build-environment.ts` gains a `product` client build profile. `productClientBuildEnvironment(environment)` reads the fixed key set — `DSH_CLIENT_TITLE`, bilingual `DSH_CLIENT_TITLE_EN/ZH`, `DSH_CLIENT_WELCOME_EN/ZH`, `DSH_CLIENT_ATTRIBUTION_EN/ZH`, `DSH_CLIENT_SUPPORT_EN/ZH`, `DSH_CLIENT_PRIMARY_LIGHT`, `DSH_CLIENT_PRIMARY_DARK`, `DSH_CLIENT_LOGO`, `DSH_CLIENT_COMMIT_HASH`, and `DSH_CLIENT_VERSION` — and re-validates their shapes before the bundlers inline them: non-empty strings, `#RRGGBB` colors, a `data:image/png;base64,` logo prefix, a Git commit hash, and a semantic version. Missing or malformed values fail the build loudly. The `official` profile is unchanged. `pnpm run build:product --root <absolute staging>` supplies those values from one validated portable staging root, so a publisher never restates them as shell environment syntax ([product-branded build entry point](../process/2026-09-13-product-branded-build-entry-point.md)).

### Brand package

New client package `@deepseek-ai/dsh-client-ui-brand-product` (`packages/client/ui-brand-product`) injects `slots`, `locale`, and `theme` and self-gates on `process.env.DSH_CLIENT_BUILD_PROFILE === 'product'`, so the official brand package (`ui-brand-official`, gated on `'official'`) and this package are mutually exclusive. It registers the `product` locale namespace (`title`, `welcome`, `attribution`, `support`) assembled from the inlined environment, overrides the `--dsw-alias-brand-primary` token to the publisher light/dark primary colors, and occupies the `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark` slots plus the new `conversation.hero.welcome` slot. Logo marks render through the new `BrandImage` primitive.

New primitive `BrandImage` in `ui-primitives` renders `<img src>` with `src`, `alt`, `size`, and `className`; the publisher logo is a base64 PNG data URI, so no remote fetch or HTML/CSS/script content is involved.

New slot `conversation.hero.welcome` in `ui-conversation` carries the blank-session welcome line; its default fallback is the existing `hero.headline` copy, so non-product builds keep the previous hero.

### Consumer composition

New bundle `@deepseek-ai/dsh-consumer-web` (`packages/bundle/consumer-web`) inserts `ui-brand-product` and disables seven developer-surface rows owned by the `web-app` roster: `plugin-inventory`, `cordis-host-runner`, `cordis-client-runner`, `client-hmr`, `ui-settings-plugin-inventory`, `ui-settings-plugins`, and `ui-cordis`. A `disabled: true` row only subtracts from the active set — the row stays owned by `web-app`, so disabling never re-adds a row or moves it between planes.

New `consumer` profile joins `PROFILE_TEMPLATES` in `app-boot` as `dsh-base → dsh-web-app → dsh-consumer-web` with `patchReload: 'live'` (matching `web`). The developer `web` profile remains complete.

### Security boundary

The consumer side does not reopen the boundary that `apps/portable` closed: the brand package reads only the build-time-inlined, already-validated `DSH_CLIENT_*` strings, never the `product.yml` file, does not use `dangerouslySetInnerHTML`, and renders the logo as an `<img>` whose `src` is a `data:image/png;base64,` data URI (asserted non-remote in tests). `product.yml` never reaches consumer settings. Brand naming uses the `DSH` abbreviation with "基于 DeepSeek Harness 构建" descriptive phrasing per the brand guidelines.

## Alternatives considered

**Pure `DSH_CLIENT_*` environment expansion without a brand package.** This cannot present the logo (needs a primitive), the primary color (needs a theme token override), or bilingual copy with locale semantics, and it would scatter the publisher dictionary across eight-plus environment keys.

**A brand package without a build-time input channel.** The package could occupy the slots but would have no per-publisher values to render.

**Trim the `web` profile in place.** The developer `web` profile must stay complete; the consumer release is a separate, branded composition layered over it.

**Add a dedicated brand-color token instead of overriding `--dsw-alias-brand-primary`.** The alias drives derived tokens (button fill, focus ring). Overriding it here treats the publisher color as the brand accent; a dedicated token remains possible if a later milestone needs to separate the two.

## Consequences

The client now presents publisher brand copy, logo, and primary colors in product builds, and `--profile consumer` offers a trimmed composition that hides plugin, package, Cordis, HMR, and experimental surfaces while keeping conversation, project selection, session history, tool rendering, model and credential settings, and essential preferences. Focused tests cover slot occupancy, locale namespace registration, the theme override, profile gating, the data-URI non-remote logo assertion, the new primitive, the consumer bundle disable roster, and the welcome slot's default fallback versus occupancy.

Keyless Web snapshots that replay the assembled composition must be re-recorded after the consumer bundle changes the tree; recording needs a real provider key, which remains a known blocker. Brand editing in the client has no corresponding UI row today and is noted as future work; any later brand-editing surface must be disabled in the consumer composition.
