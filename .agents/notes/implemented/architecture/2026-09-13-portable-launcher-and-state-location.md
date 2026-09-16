# Agent Note: Portable launcher and where portable state lives

Status: implemented

English | [中文](2026-09-13-portable-launcher-and-state-location.zh.md)

## Problem

The [Portable Agent Lab USB product](../../proposed/feature/2026-09-11-portable-agent-usb-product.md) ships a medium that an ordinary Windows user is expected to open without installing anything, and the [metadata and carrier note](2026-09-11-portable-product-metadata-and-sea-carrier.md) left the consumer with a packaged Runtime and no way to reach it. Three questions had to be answered before a launcher could exist.

First, what technology presents the product. The candidate carriers were already compared, but "which executable carries the Runtime" and "what the buyer sees first" are different decisions with different constraints: the launcher must run on a machine that has no Node.js and no Python, must not require the Electron shell the carrier note rejected, and must not become a second application entry point competing with the [`dsh` CLI's profile launch](2026-08-22-single-dsh-application-launcher.md).

Second, where application state lives in each mode. The proposal separates ownership of program files from ownership of user state and states that portable mode uses a medium-owned Harness home, but it does not say how the workspace relates to that home, or where an installed product keeps its state.

Third, how the state root is chosen and communicated. A buyer who runs from a medium, installs the product, and later wants their sessions somewhere else needs one rule that holds in every mode and is visible before anything starts.

## Decision

`Launcher.exe` is a console application built as a Node single-executable through the same pinned `@yao-pkg/pkg --sea` carrier the Runtime uses, and it presents a numbered menu rather than a graphical shell.

**One carrier, one packaging route.** The launcher bundles `apps/portable/src/launcher/main.ts` into a single module and packages it with the fixed `node24-win-x64` target. A distribution therefore ships one packaging mechanism, one version pin, and one `--skip-build` escape hatch, and `build:portable-launcher` records its own inputs exactly as `build:portable-runtime` does. The launcher needs no ripgrep sidecar, so its record lists one file.

**Identity is inlined, never read.** The launcher presents product values that arrive as `DSH_CLIENT_*` strings inlined at build time through the same `client-env` bridge the branded client build consumes. It opens no metadata file at run time. This is the boundary the [metadata and carrier note](2026-09-11-portable-product-metadata-and-sea-carrier.md) closed; the launcher does not reopen it, and the acceptance probe proves it by running the menu with `product.yml` moved out of the distribution.

**The launcher starts one application and no command.** The executable comes from the distribution layout, the profile is the shipped `consumer` composition, and the flags are fixed at `--profile consumer --no-open --port 0`. The browser handoff goes through one fixed shell mechanism, and the only URL the launcher will open is an `http://127.0.0.1/` root URL carrying exactly one base64url `token` parameter, validated by the launcher itself rather than trusted from the child's output. A handoff failure is a disclosure, not a failed run, because the URL is already on screen.

**Portable state is a sibling pair on the medium, installed state is the Harness's own home.** Portable mode keeps `PortableData/home` and `PortableData/workspace` side by side, where the manifest owns neither and the user's work travels with the medium. Installed mode keeps the Harness's per-user home and puts the workspace at `home/workspace` inside it. The asymmetry is deliberate: on a medium the workspace is a place the buyer can see from the file manager next to the program, while an installed product has no such natural neighbor, and `~/.dsh` is the location the Harness already defines for itself.

**The whole footprint stays on the medium.** The single-executable carrier unpacks its native payloads on first use — tens of megabytes of FFI and image libraries. Left alone it extracts them into the operator's profile. The launcher points `PKG_NATIVE_CACHE_PATH` and `NARB_NATIVE_CACHE_DIR` at `home/native-cache`, so the largest thing a portable run writes is on the medium. This was found by measuring, not by reasoning: the first acceptance run reported 17 files and 20 MB outside the medium, all of it carrier extraction.

**A state root is refused for three placements.** A volume root would make the product own a whole drive. A value that contains or equals the program directory would put the program inside the user's data. A value inside the program directory would be destroyed when the program goes away — which is what an uninstall does — except below `PortableData` on a medium, which the manifest never owns and where the medium's own default home lives. A refused root falls back to the mode default and reports why, because starting in the default place is better than not starting.

**A stored root is spelled the way the user typed it.** A relative value resolves against the distribution root, so a choice written on one machine still names the same place when the medium mounts under a different drive letter.

## Alternatives considered

**Ship the Electron desktop shell as the launcher.** The carrier note already rejected Desktop as the product shell on measurement: 616 MB and 11,734 files against 246 MB and 2. A launcher that reintroduced Electron would restore the size, the file count, and the update surface the carrier decision removed.

**A graphical launcher written against the operating system directly.** A native window would let the launcher present the logo and the brand colors prominently, but it adds a second toolchain to a repository whose distribution build is deliberately one packaging route, and it would make the launcher's own interface the thing that has to be localized, themed, and tested rather than a small set of strings.

**Have the launcher read `product.yml` at run time.** This would let a publisher edit the file on a written medium without rebuilding. It reopens a boundary closed deliberately in the previous milestone: validated inlined strings are the only product values the consumer side may trust, and a file the user can edit next to the executable is exactly the input that boundary excludes.

**Let the launcher build the Runtime on first run.** Rejected in the carrier note for the same reason it is rejected here: ordinary startup would depend on a complete compiler and package-manager environment, and the clean-machine promise would become an installation procedure.

**Put the workspace inside the Harness home in both modes.** Uniform, and one rule instead of two. It loses the property that a buyer can see and use their project folder from the file manager without knowing what a Harness home is, and it makes `PortableData/home` the only place to look for work the user created.

**Keep the native cache in the operator's profile in portable mode.** This is what the carrier does by default and it works. It was rejected because it makes a medium run leave its largest footprint on a host the buyer may not own, and because a second machine then re-extracts everything the first machine already unpacked.

**Refuse a state root inside the distribution root in every case.** Simpler to state, and it was the first implementation. It rejects the medium's own default home when the user types it, which is incoherent, and it rejects the one directory inside a medium that the manifest already declares user-owned.

**Persist the chosen state root in the operating system rather than on the medium.** The user registry would follow the person, not the product. A medium that has been told where its state goes should keep that choice when it moves to another machine, and an installed product's choice belongs with its install record.

## Consequences

The launcher is 94 MB and needs no sidecar, and the two executable entries in a distribution — `Launcher.exe` and the packaged Runtime — are produced by one command each with the same target pin. The launcher's own interface copy is a complete bilingual dictionary checked by type, so a new message cannot ship in one language only.

Portable and installed modes differ in one place, `resolveLaunchRoots`, and the difference is visible in the interface: the header always prints the state directory and the workspace the next launch will use. Nothing else in the run path branches on the mode.

The state-root rule is stricter than "the directory must be writable". A buyer who wants their state beside the program on a medium must put it below `PortableData/`, and a buyer who installs the product cannot put state inside the program directory at all. Both refusals are reported in the user's language with the fallback that was used.

The `PKG_NATIVE_CACHE_PATH` redirection couples the launcher to a carrier variable. If a later carrier renames it, the extraction silently returns to the operator's profile, so the acceptance probe keeps measuring the outside-the-medium inventory and treats a non-empty result as a finding rather than a warning.

`Docs/zh-CN/` and `Licenses/` are presented but not produced here; the guide is written before sale, and the workspace's placeholder content exists only to exercise the two menu entries.
