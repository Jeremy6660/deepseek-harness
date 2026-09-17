# Agent Note: Directory entry types come from lstat, not from Dirent predicates

Status: implemented

English | [中文](2026-09-17-packaged-readdir-entry-types.zh.md)

## Problem

A packaged executable could not create a session. The server answered `session/create` with `gateway/internal` and the message `TypeError: child.isDirectory is not a function` while the profile module-fallback healing walked a profile's owned `node_modules`. The same tree launched from source created sessions normally, so the failure existed only in the carrier the product ships.

The carrier is pkg's single-file executable over a virtual filesystem. Inside it, `readdir` and `readdirSync` answer with plain records for entries: the record carries `name` but not the `Dirent` predicates. Code that calls `entry.isDirectory()` or `entry.isSymbolicLink()` on those records throws at run time, in a code path that type-checks and passes every test that runs from source.

[Portable Runtime build path](../../implemented/architecture/2026-09-13-portable-runtime-build-path.md) owns the carrier decision itself; this defect is what that decision costs callers. One call site, the preset root scan in `packages/preset/agent-presets/src/discovery.ts`, had already been adapted to `lstat` for exactly this reason. The profile module-fallback healing in `packages/boot/app-boot/src/profile.ts` had not, and its `ownedPackageNames` scan reached the failing call on every packaged launch that creates a session.

## Decision

`ownedPackageNames` lists names with `readdirSync(modulesDir)` and resolves each entry's type through `lstatSync`, so it never calls a predicate on the value `readdir` returned. A directory entry whose `lstat` reports ENOENT becomes `undefined` and is treated as absent: a concurrent cleanup may remove an owned link between the listing and the type read, and that is not an error.

The two package-manager branches are unchanged in meaning. A `@`-prefixed directory is walked one level deeper and contributes every symlink below it as `@scope/name`; every other entry contributes its own name when it is a symlink. Non-links below the owned directory are still skipped rather than deleted, so the scan cannot remove a directory the launcher does not own.

`packages/session/session-persistence-jsonl/src/index.ts` needs no change. It reads entries with `withFileTypes` in four places, and each one uses only `entry.name`; no predicate is called on an entry there.

## Alternatives considered

**Keep the predicates and normalize the readdir result.** A shared helper would inspect each entry and fall back to `lstat` only for records that are not real `Dirent` instances. It was rejected because it wants a home in a package both call sites already depend on, and it would keep a type annotation that says Dirent while the runtime says otherwise — the mismatch that caused this defect would stay writable. Two call sites do not justify a new shared package.

**Guard each predicate call with a runtime check.** `entry.isDirectory?.() ?? …` at every site trades a real fix for a scattered workaround, and leaves the next author free to write the unguarded call again.

**Enumerate with a glob dependency.** A maintained walker would remove the hand-written enumeration, but it adds a dependency and a second directory-walk implementation beside the ones already in these packages.

## Consequences

The packaged profile scan no longer depends on `Dirent` instances, so a launch that heals the module fallback creates sessions on the carrier the product ships.

Entry types now cost one `lstat` per entry instead of arriving with the listing. The walked directories are one profile's own module roots, which hold tens of entries, and the scan already ran once per launch.

The defect was reachable only from a packaged executable, and the agent sandbox cannot launch one: the packaged launcher inherits a blocked network and fails on `realpath`, so a sandbox result is not evidence either way. What pins the behavior locally is the assertion in `packages/boot/app-boot/tests/profile.spec.ts` that a nested non-link below the owned directory survives a heal, which walks the `lstat` branch, plus the reported `session/create` failure itself. Confirming the carrier is clear needs a normal desktop session.
