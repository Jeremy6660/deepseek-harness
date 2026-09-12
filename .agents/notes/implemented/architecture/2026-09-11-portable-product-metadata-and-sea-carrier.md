# Agent Note: Portable product metadata and SEA carrier

Status: implemented

English | [中文](2026-09-11-portable-product-metadata-and-sea-carrier.zh.md)

## Problem

The proposed [Portable Agent Lab USB product](../../proposed/feature/2026-09-11-portable-agent-usb-product.md) needs a trustworthy build boundary before launcher, branding, installation, repair, or media-writing work can begin. A portable staging directory previously had no strict product identity, deterministic immutable-file inventory, ownership rule for user data, or product-level evidence that an existing runtime carrier could serve the Windows x64 milestone without a system Node.js or Python installation.

## Decision

The repository contains a private `apps/portable` workspace for product configuration validation, deterministic sealing, distribution verification, and carrier comparison. The workspace participates in the root build and typecheck graph but remains outside the public release-package family. It does not provide a consumer launcher.

### Product configuration

`product.yml` has a closed schema at version 1. It records a stable product ID, semantic version, English and Simplified Chinese product title, publisher name and support statement, a local PNG logo, bilingual welcome text, light and dark hexadecimal primary colors, the upstream repository, a 40-character Git revision, and bilingual unofficial-product attribution.

Validation rejects missing and unknown fields, custom YAML tags, invalid versions, revisions and colors, non-local or escaping assets, SVG and remote resources, links, non-PNG logo content, and configuration that attempts to provide HTML, CSS, scripts, or event handlers. Errors identify the configuration path and a correction.

### Manifest and ownership

`manifest.json` version 1 records product identity, upstream revision, the `win32/x64` target, and path-sorted file entries with a role, byte count, and SHA-256 digest. Roles are limited to `launcher`, `runtime`, `recovery`, `metadata`, `source`, `developer`, `documentation`, and `license`.

Sealing accepts only an explicit absolute staging root. Paths reject absolute or escaping forms, backslashes, colons, Windows reserved names, trailing dots or spaces, Unicode normalization ambiguity, case-insensitive collisions, links, junctions, and unsupported filesystem entries. `PortableData/**` is user-owned, never enters the manifest, and is ignored and preserved during verification. The implementation does not discover, format, or write removable media.

`manifest.sha256` is one standard SHA-256 line covering only `manifest.json`. Verification hashes every manifest-owned file, reports immutable extras, and returns `missing`, `modified`, `unexpected`, or `unsupported-entry` for recoverable content problems. Invalid manifests and dangerous paths fail immediately. The same inputs produce byte-identical JSON ordering and digests.

### Threat boundary

The checksum proves equality with a trusted manifest and detects accidental or isolated content damage. Because the milestone adds no digital signature, update service, DRM, or external trust root, it does not resist an attacker who can replace both executable content and the manifest, and it does not establish publisher identity. Verification never repairs or deletes content.

### Carrier evidence

The Windows x64 carrier probe starts an already built existing `@yao-pkg/pkg --sea` executable as `dsh web --no-open --port 0` with an empty executable search path, a temporary `DSH_HOME`, and temporary cache and profile roots. The probe confirms that no system Node.js or Python participates, the CLI emits an authenticated launch URL, token exchange and cookie authentication succeed, the root page carries Web bootstrap data, JavaScript and CSS assets load, shutdown disposes the Host lifecycle with exit code 0, and all observed state stays under the temporary home.

The checked-in [carrier evidence](../../../../apps/portable/carrier-evidence.json) measures the SEA executable and required `-rg.exe` sidecar at 246,261,760 bytes across 2 files. The same-machine unpacked Desktop reference measures 616,488,582 bytes across 11,734 files and starts through an Electron shell. SEA starts through `dsh web`, has a file-level repair unit, and is the fixed v1 carrier. Desktop remains a reference for its deterministic runtime-tree algorithms, not a fallback shell. The SEA build path invokes the pinned `@yao-pkg/pkg` entry point through the current Node process so packaging does not mutate the repository dependency layout, and the SDK runtime declares the session-title package it loads at runtime.

The Desktop reference smoke now validates the current prebuilt `@deepseek-ai/node-addon-system` contract instead of the removed `fs-ext` build layout. This keeps [Desktop bundled runtime](2026-09-08-desktop-bundled-runtime-and-external-plugins.md) behavior aligned with the runtime actually packaged by the repository.

## Alternatives considered

**Use the Desktop Electron shell for v1.** The sample has substantially more files and bytes and adds a shell the milestone does not need. It remains useful as a file-tree implementation reference.

**Switch carriers automatically when the SEA probe fails.** Carrier failure is a blocker for this milestone. The SEA build path must be repaired and revalidated rather than silently changing the product architecture.

**Scan for and write a removable drive.** Media selection and preparation carry destructive-device risks and belong to a later milestone. This workspace operates only on an explicit staging directory.

**Allow remote or programmable branding.** Remote assets and arbitrary HTML, CSS, or scripts expand the execution and privacy boundary. Version 1 accepts only typed copy, colors, and a local PNG.

**Treat SHA-256 as publisher authentication.** An unsigned checksum has no independent trust anchor. The contract describes integrity against a trusted manifest without claiming resistance to coordinated replacement.

## Consequences

The project now has one deterministic, machine-readable protocol for product identity, immutable ownership, and distribution verification, plus executable evidence for the Windows x64 carrier. Focused tests cover hostile configuration, path safety, stable serialization, Unicode and empty files, ownership exclusion, links, and all verification outcomes. Desktop runtime-tree regression coverage remains in place.

The milestone does not complete the proposed product. Consumer branding, reduced composition, Launcher, install and uninstall, repair, backup, credential handling, media preparation, offline DevKit assembly, signing, and sale qualification remain future work under the proposed product note. The workspace README is the operational reference for the implemented CLI and formats.
