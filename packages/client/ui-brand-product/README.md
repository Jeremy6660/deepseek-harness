---
description: "Publisher-brand occupants for the Web client's sidebar and conversation hero, active only in product builds; presents a publisher's fixed title, logo, welcome line, and accent color."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-product

English | [中文](README.zh.md)

## Summary

This package presents a publisher's brand in a `product` client build. It occupies the sidebar mark and name slots plus the conversation hero mark and welcome slots, registers a `product` locale namespace for the publisher's bilingual title and welcome line, and overrides the brand accent token. Every value is baked in at build time from the validated `DSH_CLIENT_*` environment; there is no runtime brand configuration. The package retains no mutable state and does not affect model requests.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Compose this package into a consumer build, then build the client with the `product` profile so its occupants register. The `product` profile requires the complete publisher value set — title/welcome/attribution/support (bilingual), primary light/dark colors, and a PNG logo as a data URI — each validated by the build orchestration before any byte is inlined.

### What the brand fixes at build time

`DSH_CLIENT_BUILD_PROFILE === 'product'` is the only gate. When it holds, the package reads the inlined `DSH_CLIENT_*` values and:

- occupies `sidebar.brand.mark` and `conversation.hero.brand.mark` with the publisher logo (a `data:image/png;base64,…` URI, never a remote URL);
- occupies `sidebar.brand.name` with the publisher title and `conversation.hero.welcome` with the publisher welcome line;
- registers the `product` locale namespace with the bilingual title/welcome/attribution/support;
- overrides `--dsw-alias-brand-primary` with the publisher's light and dark accent colors.

Any other profile leaves every occupied slot on its declaring shell's fallback. The package still loads and validates; only the registration is profile-gated.

### Replacing the brand

A deployment with another identity composes a different package occupying the same slots, or edits the build-time `product.yml` the orchestration validates. Occupying a slot is the only composition route; there is no brand configuration surface in the running client.

### Security boundary

The package reads only the build-time-inlined `DSH_CLIENT_*` strings. It performs no file reads, loads no remote resource, injects no HTML/CSS/script, and renders the logo through a plain `<img>` whose `src` is a data-URI PNG. The publisher values are fixed at build time and cannot change the brand of a published artifact.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser half reads the inlined environment through literal `process.env.DSH_CLIENT_*` accesses ([`src/client/env.ts`](src/client/env.ts)) and assembles the bilingual dictionaries in [`src/client/locales.ts`](src/client/locales.ts). The occupants install as two declaration-aware registration sets — one per declaring package — via nested `ctx.slots.inject()` calls, so each pair appears whether this row activates before or after the declarer and withdraws together on teardown. The locale dictionary and theme token override both install through `ctx.effect`, so their disposers unload with the plugin. The node half is an empty Loader seat. The browser title remains a build-environment concern (`DSH_CLIENT_TITLE`), outside the slot system.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the brand surface is not enough. They move from the slots this package occupies to the shells that render them.

- [ui-sidebar](../ui-sidebar/README.md) — declares `sidebar.brand.mark` and `sidebar.brand.name` and renders their fallbacks.
- [ui-conversation](../ui-conversation/README.md) — declares `conversation.hero.brand.mark` and `conversation.hero.welcome` in the hero.
- [Web client architecture](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define how publisher brand presentation is supplied. They are current package constraints, not a brand-design comparison or a task backlog.

- **Brand is fixed at build time** — the publisher identity, copy, colors, and logo are inlined; no runtime surface can change them.
- **One occupant set** — alternative presentation belongs in another Cordis package occupying the same slots.
- **The browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The package retains no mutable state, and its four slot occupants install and leave through two transactional effects.
