# Portable distribution tooling

English | [中文](README.zh.md)

`@deepseek-ai/dsh-portable` is the private build workspace for the Portable Agent Lab USB distribution. It owns product metadata validation, immutable-file manifests, distribution verification, the Windows x64 carrier probe, the product launcher, and the portable run. It is not a saleable USB product.

## Product configuration

The staging root contains one strict `product.yml`:

```yaml
schemaVersion: 1
product:
  id: portable-agent-lab-usb
  version: 1.0.0
  title:
    en: Portable Agent Lab USB
    zh-CN: 便携智能体实验盘
publisher:
  name: Example Student Publisher
  support:
    en: Simple support for 30 days after receipt.
    zh-CN: 收货后提供 30 天简单售后。
branding:
  logo: Runtime/win-x64/brand/logo.png
  logoDark: Runtime/win-x64/brand/logo-dark.png
  welcome:
    en: Welcome to Portable Agent Lab USB.
    zh-CN: 欢迎使用便携智能体实验盘。
  primaryColor:
    light: '#3366CC'
    dark: '#6699FF'
upstream:
  repository: https://github.com/deepseek-ai/deepseek-harness
  revision: 0123456789abcdef0123456789abcdef01234567
  attribution:
    en: Unofficial product based on DeepSeek Harness; not published or endorsed by DeepSeek.
    zh-CN: 本产品基于 DeepSeek Harness，并非由 DeepSeek 发布或背书。
```

The schema rejects missing or unknown fields, custom YAML tags, invalid semantic versions, non-40-character Git revisions, invalid colors, remote assets, SVG files, traversal, links, and non-PNG logo content. Validation errors identify the field path and the required correction. Product configuration does not accept HTML, CSS, scripts, or event handlers.

## Distribution contract

`manifest.json` records schema version 1, product identity, upstream revision, the `win32/x64` target, and path-sorted immutable file entries. Every entry has a relative slash-separated path, byte count, SHA-256 digest, and one role: `launcher`, `runtime`, `recovery`, `metadata`, `source`, `developer`, `documentation`, or `license`.

The path policy rejects absolute paths, traversal, backslashes, colons, Windows reserved names, trailing dots or spaces, Unicode normalization ambiguity, case-insensitive collisions, symbolic links, junctions, and unsupported filesystem entries. Sealing operates only on an explicit absolute staging root. It does not discover, format, or write a removable drive.

`PortableData/**` is user-owned. It never enters the manifest, is ignored during verification, and is never modified by this workspace. Verification checks every manifest-owned file and reports immutable extras as `unexpected`. Recoverable content results use `missing`, `modified`, `unexpected`, or `unsupported-entry`; invalid metadata and dangerous paths fail immediately.

`manifest.sha256` contains one standard SHA-256 line for `manifest.json` only. It detects accidental or isolated corruption when the manifest is trusted. It does not resist an attacker who can replace both the program and its unsigned manifest, and it does not establish publisher identity.

## Build and CLI

Build the private workspace from the repository root:

```sh
pnpm --filter @deepseek-ai/dsh-portable run build
```

Run the built CLI against an absolute staging root:

```sh
node apps/portable/lib/cli.js validate-product --root C:\absolute\staging
node apps/portable/lib/cli.js seal --root C:\absolute\staging
node apps/portable/lib/cli.js verify --root C:\absolute\staging
node apps/portable/lib/cli.js client-env --root C:\absolute\staging
```

`client-env` prints the publisher's `DSH_CLIENT_*` values as the 15-key object the `product` client build profile inlines; it is the bridge from validated metadata to a branded build. The repository's `pnpm run build:product --root C:\absolute\staging` consumes that bridge and runs the complete client build branded by the staging root, so a publisher never restates the values as shell environment syntax.

Successful commands and verification reports are single-line JSON on standard output. Verification mismatches set exit code 1. Invalid commands, manifests, configurations, roots, or dangerous paths emit a JSON error on standard error and set exit code 2.

The TypeScript API exports the same configuration, path-policy, sealing, and verification contracts from `@deepseek-ai/dsh-portable`.

## Portable Runtime build

`pnpm run build:portable-runtime` is the one command that produces the Windows x64 Runtime a distribution ships. It is reproducible from a checkout plus a validated staging root, and it records its own inputs.

```sh
pnpm run build:portable-runtime --root C:\absolute\staging --out C:\absolute\runtime
```

Inputs:

- `--root`, an absolute staging root holding a `product.yml` that `validate-product` accepts. The command re-validates it and reads the product identity through the same bridge `client-env` uses; it never re-implements the schema.
- `--out`, an absolute directory receiving the produced files. Nothing is written outside it and the build roots below.
- The repository checkout itself: the locked dependency closure, `python/sdk-runtime/platforms.json` (which names the executable), and `@yao-pkg/pkg` from the root `devDependencies`.

Outputs, all inside `--out`:

- `deepseek-harness-sdk-runtime-win-x64.exe`, the SEA executable named by `platforms.json` for the `win-x64` target.
- `deepseek-harness-sdk-runtime-win-x64-rg.exe`, the ripgrep sidecar the executable spawns outside pkg's virtual filesystem.
- `runtime-build.json`, the build record: schema version, product id and version, full upstream revision, target and pkg/Node pins, the client build profile, the declared and installed `@yao-pkg/pkg` versions, and the byte count and SHA-256 digest of each produced file.

Version pinning: the target is fixed at `node24-win-x64`. The Node range comes from that target triple, the pkg version comes from the locked root manifest, and the client build environment comes from the staging root's validated metadata through the `product` client build profile. The record captures all of them, so a later distribution can state exactly what produced its Runtime.

Build roots are separate from the Python wheel's. The branded client build is the same root build `build:product` owns, and the deploy closure is staged at `.dsh-build/portable-runtime/win-x64/closure`, so building the portable Runtime cannot replace the closure the Python SDK runtime ships.

Reproduce it end to end, then prove the result with the carrier probe:

```sh
pnpm run build:portable-runtime --root C:\absolute\staging --out C:\absolute\runtime
node --import tsx/esm apps/portable/scripts/compare-carriers.ts --sea C:\absolute\runtime\deepseek-harness-sdk-runtime-win-x64.exe --out C:\absolute\carrier-evidence.json
```

`--skip-build` reuses the existing `lib/` artifacts instead of running the branded root build. Use it only when those artifacts already belong to the staging root's current metadata.

## Launcher

`Launcher.exe` is the distribution's console entry point. `pnpm run build:portable-launcher` produces it from one validated staging root, through the same pinned carrier as the Runtime:

```sh
pnpm run build:portable-launcher --root C:\absolute\staging --out C:\absolute\distribution
```

The command bundles `apps/portable/src/launcher/main.ts` into a single module with the product's `DSH_CLIENT_*` values inlined — the same 15-key object `client-env` prints, read from the staging root's validated `product.yml` — and packages it with the fixed `node24-win-x64` target. It writes `Launcher.exe` and `launcher-build.json`, which records the product identity, upstream revision, target, pkg pins, byte count, and SHA-256 digest. That record is immutable content the publisher ships, so the distribution manifest owns it under the `metadata` role alongside `product.yml`. `--skip-build` reuses existing `lib/` artifacts, and the pkg input directory is `.dsh-build/portable-launcher/win-x64`.

**The launcher never reads `product.yml`.** Every product value it presents is a build-time-inlined string the publisher build already validated; at run time it opens no metadata file. The [launcher note](../../.agents/notes/implemented/architecture/2026-09-13-portable-launcher-and-state-location.md) records why.

The launcher presents the product title, welcome, upstream attribution, and publisher support, the upstream revision, the mode it found, the state directory it will use, and the distribution's integrity:

| Entry | Behavior |
| --- | --- |
| Start the local application | Starts the packaged Runtime through the shipped `consumer` profile and the [dsh CLI](../../.agents/notes/implemented/architecture/2026-08-22-single-dsh-application-launcher.md), then opens the authenticated loopback URL it announced |
| Open the Simplified Chinese guide | Hands `Docs/zh-CN/` to the shell |
| View licenses and third-party notices | Hands `Licenses/` to the shell |
| Check distribution integrity again | Re-runs verification and lists up to 20 differing files |
| Set the state directory | Stores a typed directory as the next launch's Harness home, or restores the mode default on an empty line |
| Quit | Exits |

The state-directory entry writes the choice and reports the roots the next launch will use; it never rewrites a value it refused. A refused directory leaves the stored choice unchanged and names the rule it broke. The header always shows what the next launch will use, so a stored choice that no longer resolves is visible before anything starts.

It offers no update, rollback, brand editing, or plugin installation, and it starts no command the user can supply: the executable comes from the layout, the profile and flags are fixed, and the only URL it will hand to the operating system is an authenticated `http://127.0.0.1/` root URL it validated itself.

## Portable run

A medium runs in place. The launcher writes its own settings below `PortableData/`, which the manifest never owns, and keeps the Harness home and the workspace as its children:

```text
<medium>/
  Launcher.exe
  launcher-build.json
  product.yml
  Runtime/win-x64/
  Docs/zh-CN/
  Licenses/
  PortableData/
    home/           Harness home: sessions, settings, credentials
    workspace/      directory the application starts in
    launcher.json   the state root this medium was told to use, if any
```

The whole footprint stays on the medium, including the native payloads the single-executable carrier unpacks on first use. The launcher points `PKG_NATIVE_CACHE_PATH` and `NARB_NATIVE_CACHE_DIR` at `home/native-cache`, so a run leaves nothing in the operator's profile; without that redirection the carrier extracts tens of megabytes into `%USERPROFILE%\.cache\pkg`.

Prove the whole path with the acceptance probe, which drives a built `Launcher.exe` with `PATH` pointed at an empty directory:

```sh
node --import tsx/esm apps/portable/scripts/probe-portable-launch.ts --distribution C:\absolute\distribution --out C:\absolute\launcher-evidence.json
```

The probe starts the launcher with no interpreter reachable, reads the identity, mode, state directory, and integrity it presents, starts the application from the menu, follows the launch token to the authenticated interface and to every asset that interface references, measures the medium-owned home and the workspace, and then repeats the menu with `product.yml` moved aside to show the presented identity comes from the build rather than the file. It expects the identity the distribution's own `launcher-build.json` records rather than a name written into the probe, so it drives any publisher's product. Among those assets it requires the client to carry two distinct inlined product logos and the stylesheet to carry the selector that shows one of them, which is what makes a brand mark survive both themes. Its report lists everything the run wrote outside the medium; that inventory is empty.

## Windows carrier evidence

The v1 carrier is the existing `@yao-pkg/pkg --sea` Windows x64 executable plus its required `-rg.exe` sidecar. The carrier probe launches an already built executable with no system Node.js or Python available, an isolated temporary `DSH_HOME`, `--no-open`, and a dynamic port. It verifies the authenticated launch URL, token exchange, Web bootstrap, JavaScript and CSS assets, clean lifecycle disposal, exit code 0, and that state remains inside the temporary home.

The recorded comparison in [carrier-evidence.json](carrier-evidence.json) measures the SEA carrier at 246,261,760 bytes and 2 files, launched as `dsh web --no-open --port 0`. The matching unpacked Desktop sample measures 616,488,582 bytes and 11,734 files, launched through an Electron shell. SEA is therefore fixed as the v1 carrier; Desktop remains an implementation reference for deterministic file-tree handling, not a product shell.

Reproduce the comparison with already built absolute paths:

```sh
node --import tsx/esm apps/portable/scripts/compare-carriers.ts --sea C:\absolute\deepseek-harness-sdk-runtime-win-x64.exe --desktop C:\absolute\win-unpacked --out C:\absolute\carrier-evidence.json
```

## Milestone boundary

This workspace delivers a development protocol and a verified carrier foundation for Windows 10/11 x64 on NTFS, the `client-env` bridge from validated metadata to the branded client build, and the launcher skeleton with the portable run. The publisher branding and the reduced consumer composition themselves live outside this workspace, in [Publisher branding and consumer composition](../../.agents/notes/implemented/architecture/2026-09-12-publisher-branding-and-consumer-composition.md).

Per-user installation, uninstallation, and explicit state-root selection are built on this launcher but are not part of it. The workspace still does not implement repair, backup, a credential vault, media preparation, or an offline DevKit. It adds no signing, update service, or DRM and is not a saleable product.

The broader product remains proposed in [Portable agent USB product](../../.agents/notes/proposed/feature/2026-09-11-portable-agent-usb-product.md). The implemented protocol, threat boundary, and carrier decision are recorded in [Portable product metadata and SEA carrier](../../.agents/notes/implemented/architecture/2026-09-11-portable-product-metadata-and-sea-carrier.md).
