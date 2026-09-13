# Agent Note: Product-branded build entry point

Status: implemented

English | [中文](2026-09-13-product-branded-build-entry-point.zh.md)

## Problem

A publisher-branded client build inlines 14 `DSH_CLIENT_*` values that come from a validated `product.yml`. The `product` profile of `scripts/client-build-environment.ts` reads those values from its process environment and fails loudly when any is missing, but nothing in the repository put them there. `apps/portable` already exposed `client-env`, which prints the exact 14-key object as JSON on stdout, and the [publisher branding milestone](../architecture/2026-09-12-publisher-branding-and-consumer-composition.md) documented it as the bridge from validated metadata to a branded build — but the bridge had no consumer on the far side.

The gap was the step in between: a publisher had to read that JSON and restate it as environment variables in their own shell before running the build. That instruction is not portable across shells, is not checkable, and turns a repository command into a copy-paste ritual. A publisher following the README on a different shell than the one it was written for reaches a build error that names a missing variable but not the step that dropped it.

## Decision

`pnpm run build:product --root <absolute staging>` runs the complete client build branded by one validated portable staging root. The publisher supplies a directory, not an environment.

`scripts/build-product.ts` owns the entry point. It requires an absolute `--root`, asks `apps/portable` for the publisher values by running the `client-env` subcommand through `tsx` against source, resolves them through `resolveClientBuildEnvironment(environment, 'product')`, and hands the result to the shared build sequence. It never restates the `product.yml` schema: the portable CLI remains the only mapping from that closed schema to `DSH_CLIENT_*`, so a schema change cannot leave the build entry point behind. A staging root the product schema refuses exits 2 with the CLI's own JSON error before any build phase starts.

`scripts/build.ts` exports `runRootBuild(clientEnvironment, environment)`, which is the sequence the default and `--profile` entry points already ran. Both entry points now call it, so a publisher build cannot silently skip `build:native-system`, `build:lib`, or `build:web`. The default entry point's observable behavior is unchanged.

The build record keeps its shape: a product build writes the 14 publisher values plus `DSH_CLIENT_BUILD_PROFILE=product`, matching the key-set symmetry `official` already had.

## Alternatives considered

**Add a `@deepseek-ai/dsh-portable` path alias to `tsconfig.base.json` and import the mapping directly.** This is the shortest path and gives a typed, in-process call with no subprocess. It loses because every entry in the base `paths` map targets `packages/` or `vendor/`, and that facade is the resolution config for every importer including `scripts/`; a first `apps/` entry would make an application workspace importable as a library from anywhere. Spawning the documented CLI keeps the same single source of truth without widening that facade.

**Parse `product.yml` inside `scripts/`.** This would remove the subprocess entirely, but it duplicates a strict schema — unknown-field rejection, remote-asset and path-traversal refusal, PNG validation — that `apps/portable` already owns and tests. Two parsers of one closed schema drift, and the second one would be the one guarding published bytes.

**Give `scripts/build.ts` a `--product-root` flag instead of a second file.** One entry point serves both cases, but the flag form cannot fail when the publisher forgets it. `pnpm run build:product` with no argument would silently run an unbranded default build and write a record that looks successful. A separate entry point makes the missing root a hard error.

**Keep the documented manual export.** This was the state before the change. It works on the shell the README was written for and nowhere else, and it leaves the repository's own `client-env` output unconsumed by anything the repository ships.

## Consequences

The publisher path is now one command, and the `client-env` bridge has a consumer, so the two ends of that contract are exercised together by `scripts/build-product.spec.ts`.

The entry point depends on `apps/portable` at run time through a source path rather than a package dependency, so it runs the CLI from `src` under `tsx`. A future move of that workspace's CLI entry must update `scripts/build-product.ts`; nothing in the type graph catches that.

A product build overwrites the shared gitignored `.dsh-build/client-build-environment.json` record with publisher values, exactly as `build:official` already overwrites it with official ones. A later built-Web test or release packing that expects the repository's own environment must rebuild after a publisher build, and nothing currently distinguishes "the record is a product build" from "the record is stale".

The complete build still runs end to end for a publisher; only the environment plumbing was removed. Branding a build remains a full `build:native-system` plus `build:lib` plus `build:web` run.
