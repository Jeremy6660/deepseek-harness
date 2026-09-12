# Portable distribution tooling

English | [中文](README.zh.md)

`@deepseek-ai/dsh-portable` is the private build workspace for the first Portable Agent Lab USB milestone. It owns product metadata validation, immutable-file manifests, distribution verification, and the Windows x64 carrier probe. It is not a consumer launcher or a saleable USB product.

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
```

Successful commands and verification reports are single-line JSON on standard output. Verification mismatches set exit code 1. Invalid commands, manifests, configurations, roots, or dangerous paths emit a JSON error on standard error and set exit code 2.

The TypeScript API exports the same configuration, path-policy, sealing, and verification contracts from `@deepseek-ai/dsh-portable`.

## Windows carrier evidence

The v1 carrier is the existing `@yao-pkg/pkg --sea` Windows x64 executable plus its required `-rg.exe` sidecar. The carrier probe launches an already built executable with no system Node.js or Python available, an isolated temporary `DSH_HOME`, `--no-open`, and a dynamic port. It verifies the authenticated launch URL, token exchange, Web bootstrap, JavaScript and CSS assets, clean lifecycle disposal, exit code 0, and that state remains inside the temporary home.

The recorded comparison in [carrier-evidence.json](carrier-evidence.json) measures the SEA carrier at 246,261,760 bytes and 2 files, launched as `dsh web --no-open --port 0`. The matching unpacked Desktop sample measures 616,488,582 bytes and 11,734 files, launched through an Electron shell. SEA is therefore fixed as the v1 carrier; Desktop remains an implementation reference for deterministic file-tree handling, not a product shell.

Reproduce the comparison with already built absolute paths:

```sh
node --import tsx/esm apps/portable/scripts/compare-carriers.ts --sea C:\absolute\deepseek-harness-sdk-runtime-win-x64.exe --desktop C:\absolute\win-unpacked --out C:\absolute\carrier-evidence.json
```

## Milestone boundary

This workspace delivers a development protocol and a verified carrier foundation for Windows 10/11 x64 on NTFS. It does not implement consumer branding UI, a reduced consumer composition, Launcher, installation, uninstallation, repair, backup, a credential vault, media preparation, or an offline DevKit. It adds no signing, update service, or DRM and is not a saleable product.

The broader product remains proposed in [Portable agent USB product](../../.agents/notes/proposed/feature/2026-09-11-portable-agent-usb-product.md). The implemented protocol, threat boundary, and carrier decision are recorded in [Portable product metadata and SEA carrier](../../.agents/notes/implemented/architecture/2026-09-11-portable-product-metadata-and-sea-carrier.md).
