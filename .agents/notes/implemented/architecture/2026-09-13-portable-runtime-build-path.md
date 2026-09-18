# Agent Note: Portable Runtime build path

Status: implemented

English | [中文](2026-09-13-portable-runtime-build-path.zh.md)

## Problem

[Portable product metadata and SEA carrier](2026-09-11-portable-product-metadata-and-sea-carrier.md) fixed `@yao-pkg/pkg --sea` as the v1 Windows x64 carrier and recorded a measured carrier comparison, but the carrier it measured could not be reproduced from the repository by anyone holding the product's metadata. The only command that produced a SEA executable, `scripts/build-exe-for-python-sdk.ts`, packaged the Python wheel's runtime with the official client profile into the wheel's own staging closure, and `apps/portable/scripts/compare-carriers.ts` accepted only an executable that already existed. A distribution could therefore state its product identity and its carrier decision while no command in the repository could produce the Runtime those statements describe, which made the first milestone depend on an artifact rather than on a build.

## Decision

`pnpm run build:portable-runtime --root <absolute staging> --out <absolute directory>` builds the Windows x64 Runtime a portable distribution ships, from a checkout plus a staging root holding a validated `product.yml`. `scripts/build-portable-runtime.ts` is that command, and it is the single reproduction path.

### Inputs and outputs

Inputs are the absolute staging root, the absolute output directory, and the checkout itself: the locked dependency closure, `python/sdk-runtime/platforms.json` naming the executable for the target, and `@yao-pkg/pkg` from the root `devDependencies`.

Outputs, all inside the output directory: the SEA executable, its `-rg.exe` ripgrep sidecar, and `runtime-build.json`. The record carries the schema version, product id and version, the full 40-character upstream revision, the `win32/x64` target with its pkg and Node pins, the client build profile, the declared and installed `@yao-pkg/pkg` versions, and the byte count and SHA-256 digest of each produced file. It is written and read back before the command reports success.

### Version pinning

The target is fixed at `node24-win-x64`. The Node range comes from that triple, the pkg version from the locked root manifest, and the client build environment from the staging root's validated metadata through the `product` client build profile. Because the record captures all of them, a distribution can state exactly which inputs produced its Runtime rather than implying it from the product version alone.

### Reused SEA pipeline

`scripts/build-exe-for-python-sdk.ts` exports `Target`, `BuildCli`, and `SingleExeBuild`, and `SingleExeBuild` accepts a `SingleExeBuildRoots` override for its deploy staging and product output directories. The portable command constructs that pipeline with a portable-specific staging root at `.dsh-build/portable-runtime/win-x64/closure` and product directory `dist-exe/portable-runtime`, so the deploy, hoist-restoration, link-materialization, and packaging logic exists once while the two products keep separate closures.

The branded client build the Runtime embeds is the same root build `build:product` owns. `scripts/build-product.ts` exports `PRODUCT_CLIENT_BUILD_PROFILE`, `publisherEnvironment`, and `portableProductIdentity`; the portable command reads product identity through the same validated CLI bridge as `client-env` and runs `runRootBuild` with the `product` client environment before packaging with `--skip-build`. Product metadata is therefore parsed by one implementation, and the launcher's build-time identity inlining reads what that implementation produced.

`scripts/build-exe-for-python-sdk.ts` executes only under `import.meta.main`, so importing its classes does not run the Python wheel's build.

## Alternatives considered

**Write a second SEA pipeline inside `apps/portable`.** The pkg invocation, the asset globs, the legacy-hoist restoration, and the link materialization encode hard-won packaging behavior. A second copy would drift from the pinned route and re-open decisions the carrier note already settled.

**Reuse the Python wheel's staging root.** `pnpm deploy` clears its staging directory. A portable build using the wheel's root would replace the wheel's staged closure with publisher-branded artifacts, so the wheel would ship product branding. Separate roots are required, not merely tidy.

**Let the launcher build the Runtime.** The launcher ships to users and starts the application; a launcher that also runs `pnpm` would need the repository present and would turn a distribution's bytes into something only reproducible on a build machine.

**Build the SEA executable with Node's own `--experimental-sea-config`.** pkg already implements the asset and virtual-filesystem behavior the Cordis plugin tree needs on Windows. Switching carriers re-opens the fixed v1 carrier decision without new evidence.

**Record only the executable digest.** Without the client build profile and the pkg pin, a distribution could prove a file's equality but not what produced it. When two builds of the same product version differ, the record is the only artifact that says why.

## Consequences

The first milestone is reproducible: one documented command turns a validated staging root into the Runtime a distribution ships, and the carrier probe re-validates the result end to end. The check-in at `apps/portable/README.md` is the operational reference for the command, its inputs, its outputs, and its pins.

The portable command uses ignored roots under `.dsh-build/` and `dist-exe/`. Before deployment, it verifies the client build record against both the product environment and the emitted artifact digests, including when `--skip-build` reuses a complete branded build. Missing or mismatched records fail before packaging, preventing official or different-product branding from being recorded as a product build. The Runtime files are inputs to distribution sealing, which records them under the `runtime` role; the build command does not seal a distribution or write media.
