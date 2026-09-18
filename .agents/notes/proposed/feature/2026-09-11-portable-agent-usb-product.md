# Agent Note: Portable agent USB product

Status: proposed

English | [中文](2026-09-11-portable-agent-usb-product.zh.md)

## Problem

DeepSeek Harness can run from source, as a packaged Desktop application, and through a platform-specific executable carrier, but it does not define a low-cost removable-media product that can run without installation, install itself for later use without the medium, repair the purchased installation, and reproduce its own build from the files on the medium. Copying the current checkout is not sufficient: its dependency tree contains platform-specific native files and absolute links, the build needs tools and caches that are not committed, and persisted state requires filesystem behavior that FAT and exFAT do not provide consistently.

The intended product is a student-maintained learning and exchange artifact sold at low margin through an informal marketplace. It needs an honest, bounded promise instead of enterprise licensing, continuous update infrastructure, expensive release signing, arbitrary-project support, or a guarantee that a model completes every task.

The first protocol-and-carrier milestone is implemented in the private `apps/portable` workspace and recorded in [Portable product metadata and SEA carrier](../../implemented/architecture/2026-09-11-portable-product-metadata-and-sea-carrier.md); the launcher and the portable run are recorded in [Portable launcher and state location](../../implemented/architecture/2026-09-13-portable-launcher-and-state-location.md); the command that builds the Runtime a distribution ships is recorded in [Portable Runtime build path](../../implemented/architecture/2026-09-13-portable-runtime-build-path.md); the launcher's state-root selection is recorded in [Portable state-root selection](../../implemented/feature/2026-09-16-portable-state-root-selection.md); the publisher branding and reduced consumer composition are recorded in [Publisher branding and consumer composition](../../implemented/architecture/2026-09-12-publisher-branding-and-consumer-composition.md). The installation and repair flows, media tooling, offline DevKit, and sale qualification described by this note remain proposed.

## Proposal

Create an unofficial, independently named portable agent USB product based on DeepSeek Harness. The working name is **Portable Agent Lab USB** until the publisher replaces it through one product configuration. Product copy must state that DeepSeek does not publish or endorse the product and must identify the exact upstream source revision.

Development proceeds through independently verified milestones, but no milestone is sold as a partial product. The publisher sells only a build that satisfies the complete release acceptance criteria. Each sale is a fixed final version with no update service or compatibility promise for later content.

### Product modes

One prepared medium exposes these supported modes through a small local launcher:

- **Portable run** starts the packaged Harness without installing it and stores portable state under a medium-owned Harness home.
- **Per-user install** installs under the current user's local application directory without administrator privileges, creates normal launch and uninstall entries, and continues to work after the medium is removed.
- **Verify and repair** authenticates the purchased version's manifest and restores only its program files. Repair preserves workspaces, sessions, settings, and credentials unless the user selects a separately disclosed reset operation after a backup.
- **Backup and import** explicitly copies supported user data between portable and installed homes. The product does not synchronize the homes automatically.
- **Developer materials** place source, patches, licenses, offline dependencies, and rebuild instructions in a separate `Developer/` directory that the normal consumer interface does not advertise.

The launcher also exposes the Chinese guide, product identity, upstream attribution, licenses, third-party notices, and integrity results. It does not expose update, rollback, brand editing, or arbitrary plugin installation actions.

### Platform and medium

The first release supports Windows 10 and Windows 11 on x64. The distribution layout uses platform adapters and `Runtime/<os>-<arch>` plus `Developer/<os>-<arch>` roots so later work can add native macOS or Linux products without redefining the manifest, launcher protocol, or product configuration. The first release neither carries nor promises macOS, Linux, or Windows arm64 artifacts.

The baseline physical product is a verified 16 GB USB 3.0 device formatted as NTFS. It does not require a premium or high-speed model. Media preparation must test reported capacity, read every written byte back, reject corrupt or counterfeit devices, and retain enough free space for user data and one repair copy. A slow or incompatible medium may stage immutable runtime files in a private host directory, but the launcher must disclose that mode and clean its owned files after normal exit. The preparation tool generates and validates a staging directory before it ever receives an explicitly selected removable-volume target; it never discovers and formats a drive automatically.

The source checkout, one `node_modules` tree, and one writable Harness home are not portable across operating systems. Platform-specific build caches and native dependencies remain isolated below their platform roots. FAT and exFAT are not supported as the live Windows workspace or Harness-home filesystem because the default Windows sandbox needs ACL behavior and persisted media may need links and durable replacement semantics.

### Runtime and rebuild split

The product separates a daily-use **Runtime** from an offline **DevKit**. Portable and installed launches use a prebuilt Windows x64 runtime and must not require system Node.js or Python merely to start Harness. The implementation should reuse the [single-file executable runtime](../../implemented/architecture/2026-07-10-single-file-executable-sdk-runtime-distribution.md) or the [Desktop bundled runtime](../../implemented/architecture/2026-09-08-desktop-bundled-runtime-and-external-plugins.md) only after a product-specific installed-artifact comparison proves which carrier satisfies launcher, size, repair, and consumer-interface requirements.

The Windows DevKit carries the exact source, portable Node.js and Python toolchains, pnpm entry and content-addressed store, required build caches, verified prebuilt native inputs, and scripts needed to rebuild the TypeScript, Web, and executable artifacts without network access. The ordinary offline rebuild may consume those authenticated native inputs. Building every native component from source belongs to a separate maintainer environment with Python, headers, compilers, and platform-native build tools; the consumer product does not promise that operation on an arbitrary target machine.

The first release's declared task toolchain comprises Git, Node.js and TypeScript, Python, PowerShell, and Harness-owned file search. A task that requires another compiler, container runtime, SDK, executable, elevated privilege, or online service is outside the guaranteed execution set. The harness may use the buyer's configured model endpoint and network; offline packaging and rebuild do not imply offline model inference.

### State, credentials, and privacy

Installed mode uses a per-user Harness home on the host. Portable mode uses an independent Harness home on the medium when its filesystem is supported, or an explicitly disclosed host staging home followed by a normal-exit export. Installation may offer a one-time import from portable state. Later exchange remains an explicit backup or import operation; automatic bidirectional synchronization and conflict resolution are out of scope.

The buyer supplies every model API credential and pays every provider charge. The product never includes the publisher's shared key and does not proxy model requests through a publisher-operated service. The credential UI offers an encrypted local vault and a no-persistence mode. The design must disclose that a credential is available to the same-user process while it is unlocked; encryption protects a lost medium or inactive store, not against the running agent itself.

The product collects no telemetry and sends no conversation, workspace content, credential, or diagnostic automatically. Support diagnostics are generated locally, redact secrets and user content by default, and leave the machine only through an explicit user export.

### Consumer interface and publisher branding

The consumer Web interface retains conversation, project selection, session history, tool-call presentation, model and credential setup, and essential preferences. It hides plugin development, package management, brand editing, experimental customization, and other high-complexity development controls. Removing a visible control must not remove the underlying extension architecture from the source.

One publisher-owned `product.yml` and local asset directory define the product title, logo, primary color, welcome text, version, support statement, and upstream attribution at build time. The configuration is not exposed through consumer settings. It must reject scripts, event handlers, arbitrary HTML or CSS, and remote asset URLs. The same build mechanism may produce another publisher or collaboration brand without changing application components; ordinary buyers cannot generate brand packs or load arbitrary client code.

The launcher starts the authenticated local Host-backed Web application rather than serving the Vite output as an independent static site. Loopback binding remains the default. Static brand assets must contain no credentials or private configuration.

### Sale, support, and version policy

The product charges for the physical medium, packaging, launcher, tested composition, Chinese guide, and limited support around open-source software. Every medium includes the corresponding source and local modifications, the MIT license, applicable third-party notices, a build manifest, and SHA-256 checksums. Product language must not imply exclusive ownership of DeepSeek Harness or an official DeepSeek relationship.

The purchased build has no online updater, offline updater, background update check, A/B update directory, account activation, device binding, DRM, or USB-dongle requirement. The installed product never requires the original medium to launch. The publisher may release later content as another product, but makes no compatibility, migration, discount, or availability promise for an earlier version.

Simple support lasts 30 days after receipt and covers installation, launch, entering the buyer's own API key, same-version verification and repair, and the documented basic flow. An obvious defect in the distributed program that prevents a documented supported flow may receive a corrected build of the same purchased version. Support does not include new features, upstream upgrades, API charges, model-quality guarantees, project-specific debugging, missing third-party toolchains, operating-system repair, or recovery of unbacked-up data.

The first release may be unsigned by a publicly trusted Windows code-signing certificate. It must provide checksums, show the exact product and upstream version before launch, and document the Windows unknown-publisher warning without instructing users to disable platform security. Self-signed certificates are not presented as third-party trust. Commercial signing remains an optional release decision, not an architectural requirement.

### Proposed distribution layout

The exact names may change during implementation, but ownership remains separated:

```text
/
  Launcher.exe
  product.yml
  manifest.json
  manifest.sha256
  Runtime/win-x64/
  Recovery/win-x64/
  Source/
  Developer/win-x64/
  Docs/zh-CN/
  Licenses/
  PortableData/
```

Immutable program, recovery, source, documentation, and license files are manifest-owned. `PortableData/` is user-owned and excluded from program repair. Host-installed program files and installed user state use separate owners so uninstall and repair cannot infer a destructive target from an arbitrary persisted path. The proposed [Desktop uninstall retention rule](2026-09-08-desktop-uninstall-preserve-dsh-home.md) remains an independent input; this proposal neither implements nor supersedes it.

### Implementation sequence

Sequence items 1 and 2 are implemented by the milestones linked above. Items 3 through 7 remain proposed.

1. Record the product configuration schema, distribution manifest, filesystem ownership rules, threat limits, and acceptance-test harness. **Implemented.**
2. Add publisher branding and the reduced consumer composition without changing the underlying client extension contracts. **Implemented.**
3. Add the Windows launcher, portable run, per-user install, uninstall, and explicit state-root selection. The launcher, the portable run, and explicit state-root selection are implemented; the per-user install and uninstall flows are not, though the install record, the ASCII install-directory name, the registry uninstall entry, and the removal-target guard that they consume are already written.
4. Add full-media preparation, integrity verification, backup, same-version repair, and recovery behavior.
5. Add the credential vault, no-persistence credential flow, redacted diagnostic export, and explicit data import/export.
6. Assemble and verify the Windows offline DevKit and its ordinary rebuild path.
7. Produce the staged USB distribution, run clean-machine release qualification, and finish the Simplified Chinese guide before sale.

Each milestone includes its code, focused tests, user-visible snapshots where repository policy requires them, documentation, and reproducible evidence. A milestone is an internal development checkpoint, not a saleable release.

## Alternatives considered

**Build from source on every launch.** This makes ordinary startup depend on the complete compiler and package-manager environment, magnifies low-cost flash-media small-file latency, and prevents a bounded clean-machine promise. A prebuilt Runtime and separate DevKit preserve both immediate use and reproducibility.

**Reuse one checkout and dependency tree across Windows, macOS, and Linux.** Native modules, executable bits, links, sandbox policies, and package-manager paths differ by platform. One physical product may contain platform roots, but one installed dependency tree cannot be the cross-platform unit.

**Use exFAT or FAT as the live cross-platform filesystem.** The formats improve file exchange but do not satisfy the Windows ACL sandbox and all durable-state link semantics. The Windows release uses NTFS and preserves cross-platform structure in the manifest rather than claiming unsupported live portability.

**Require premium high-speed or 64 GB media.** The agreed product competes on low cost. A verified 16 GB USB 3.0 device plus optional host staging is the baseline; release qualification, not a marketing speed class, decides whether a device is usable.

**Expose the original development and customization interface.** Ordinary buyers need the supported task flow, not plugin development, arbitrary JavaScript, or brand tooling. Hiding those controls reduces accidental code execution and support load while the source remains available under `Developer/`.

**Share the publisher's API key or operate a proxy service.** Both choices create uncontrolled cost, secret exposure, privacy obligations, and continuous operations. Buyers use their own provider accounts directly.

**Add enterprise activation, a hardware dongle, continuous updates, and public-trust signing before sale.** These systems cost more to build and operate than the low-margin learning product justifies. A fixed version, transparent source, deterministic manifests, simple repair, and bounded support match the intended sale.

**Automatically synchronize installed and portable state.** Bidirectional synchronization adds conflicts, credential movement, format coupling, and removable-device interruption paths. Explicit backup and import make each data transfer visible and recoverable.

**Promise later-version compatibility.** DeepSeek Harness is in developer preview and its durable formats evolve. Each fixed product version stands alone; later content carries no old-version compatibility or migration promise.

## Acceptance criteria

- A clean Windows 10 and Windows 11 x64 ordinary-user environment with no system Node.js or Python can validate the medium and start portable mode.
- The same environment can install for the current user, remove the medium, restart the installed product, and uninstall it without deleting user work or an independently owned Harness home.
- The buyer can configure a personal model API key, choose not to persist it, and observe a clear error for missing, rejected, or unreachable credentials.
- Portable and installed modes can create or open a Git workspace, read and write files, and invoke the declared Git, Node.js/TypeScript, Python, and PowerShell tools.
- Restarting a mode recovers its committed sessions. Explicit backup and import report source, destination, conflicts, excluded secrets, and completion without automatic synchronization.
- Verification detects a missing or changed manifest-owned file. Same-version repair restores immutable program content while byte-preserving user-owned workspaces, sessions, settings, and credentials.
- The publisher can change every `product.yml` field and local brand asset in a release build without editing application components. The consumer interface exposes none of those fields and cannot load arbitrary client code.
- With the network unavailable, the Windows DevKit rebuilds the declared TypeScript, Web, and executable outputs from the shipped source and authenticated native inputs. A separate maintainer check owns full native-from-source builds.
- Media preparation verifies a 16 GB target, writes only an explicitly selected removable volume, validates every manifest-owned byte after copying, and refuses an insufficient, corrupt, or unexpected target without formatting another disk.
- Repair, low-space, drive-letter change, slow-media staging, interrupted copy, unexpected removal, and unsupported-tool failures produce localized explanations and a recovery action. No test claims that unexpected removal preserves unflushed work.
- The release includes corresponding source, modifications, build identity, checksums, license, third-party notices, privacy and safety disclosures, the 30-day support boundary, and the fixed-version/no-update policy.
- Release qualification runs the complete matrix before sale. Only code and documentation owned by an implemented Agent Note are current implementation; the complete product is not implemented merely because this proposal exists.

## Risks

DeepSeek Harness is a developer-preview project, so completing the product before sale does not stabilize upstream APIs or formats. A fixed-version fork reduces ongoing support but transfers security review, dependency disclosure, and release qualification to the publisher.

Unsigned Windows executables can trigger SmartScreen or antivirus warnings. Checksums and source transparency detect content changes but do not create public-trust publisher identity or guarantee that endpoint security accepts the program.

Low-cost removable media can be slow, counterfeit, or fail without warning. Full-device qualification and explicit backup reduce the chance and impact but cannot recover data whose only copy was on a failed device.

The credential vault protects inactive files and a lost medium only while locked. Model providers, same-user processes, enabled tools, and the running agent can observe data that the user authorizes during execution.

NTFS makes the Windows product reliable but is not a cross-platform writable medium contract. Later macOS and Linux products need native filesystem, signing, sandbox, toolchain, and clean-machine qualification rather than a launcher-only port.

Bundled Git, Node.js, Python, native binaries, fonts, and future brand assets each carry redistribution and security obligations. The release inventory must establish permission and provenance; the upstream MIT license alone does not cover every bundled dependency or third-party service.

The reduced interface may hide capabilities advanced buyers expect, while the separate source tree still lets them create unsupported derivatives. Support copy must distinguish the tested consumer composition from source-level experimentation.
