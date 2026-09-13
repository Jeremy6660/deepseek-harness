---
description: "The consumer browser-surface bundle: publisher branding over dsh-web-app, minus the developer-facing plugin and Cordis surfaces, for published consumer artifacts."
kind: "package-bundle"
---

# @deepseek-ai/dsh-consumer-web

English | [中文](README.zh.md)

## Summary

The consumer Web surface is `dsh-web-app` plus publisher branding and minus the developer-facing surfaces: it layers `@deepseek-ai/dsh-client-ui-brand-product` over the web roster and disables the plugin-management, Cordis-configuration, HMR, and experimental-Cordis rows a published consumer artifact has no use for. Compose it through the `consumer` profile (`dsh-base` → `dsh-web-app` → `dsh-consumer-web`); you rarely touch this bundle directly. It holds no runtime code — its substance is a patch document.

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

Run the shipped `consumer` profile with a `product` client build, and the surface shows the publisher's brand. The brand occupants self-gate on `DSH_CLIENT_BUILD_PROFILE === 'product'`; without that profile the brand slots keep their declaring shell's fallback, and the disabled developer rows stay off either way.

### What it changes over the web surface

The bundle inserts `ui-brand-product`, which occupies the sidebar mark and name slots plus the conversation hero mark and welcome slots with the publisher's build-time-fixed title, logo, welcome line, and accent color. It disables seven developer-facing rows — `plugin-inventory`, `cordis-host-runner`, `cordis-client-runner`, `client-hmr`, `ui-settings-plugin-inventory`, `ui-settings-plugins`, and `ui-cordis` — so the settings surface keeps conversation, project, history, tool-call presentation, model and credential configuration, and necessary preferences, without the plugin and Cordis editing surfaces.

### Replacing the brand

A deployment with another identity composes a different package occupying the same brand slots, or edits the build-time `product.yml` the orchestration validates. See the [ui-brand-product reference](../../client/ui-brand-product/README.md) for the build-time value contract.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The bundle is a static patch document applied over the `dsh-web-app` layer. It mounts no service, emits no events, and holds no mutable state; each named row's package owns that row's behavior and invariants.

### Composition mechanics

A patch replaces the targeted row's whole `config` rather than merging into it; a `disabled: true` row only removes the row from the active set while the `dsh-web-app` layer keeps owning its id. The `insert` and `disable` list is documented inline in [`cordis.patch.yml`](cordis.patch.yml).

### Source map

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The bundle substance: the brand insert and the developer-surface disables, with per-row rationale as inline comments |
| [`src/index.ts`](src/index.ts) | Package entry; carries no runtime API |
| — | No runtime invariant companion is published; the package is a static patch-list carrier. |
| [`tests/consumer-web.spec.ts`](tests/consumer-web.spec.ts) | Manifest declaration and patch-content checks |

### Invariant ownership

No invariant companion is published because the package is a static patch-list carrier: the inserted brand row's package and the disabled rows' owning packages each carry their own invariants, and the bundle owns no mutable relation to check.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when you want to go deeper into the brand contract or the profile layering.

- [ui-brand-product](../../client/ui-brand-product/README.md) — the publisher-brand occupants and their build-time value contract.
- [app-boot profile section](../../boot/app-boot/README.md) — how profiles are resolved, layered, and customized.
- [Bundle package map](../README.md) — the surfaces built on the dsh core.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through each inserted or disabled row's package, which owns that row's model-facing behavior; the brand row is browser presentation and the disabled rows are model-agnostic developer surfaces.

#### KV Cache effect

The bundle itself adds no request prefix; every row it inserts or disables is model-agnostic.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits tell you when the consumer surface needs extra care or where an override must go. They are current package constraints, not a general comparison or a task backlog.

- **Brand is fixed at build time** — the publisher identity, copy, colors, and logo are inlined by the `product` client build; no runtime surface can change them.
- **Developer surfaces are hidden, not deleted** — the disabled rows stay installed so the profile resolves, but they no longer appear in the active set.
- **The brand row is inert outside the `product` build profile** — a consumer profile built without `product` keeps the official brand or the declaring shell's fallback.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
