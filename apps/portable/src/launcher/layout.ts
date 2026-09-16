/** Fixed directory names and resolved paths of one launcher distribution root. */

import { dirname, join, resolve } from 'node:path'

/** Runtime directory the Windows x64 distribution fixes. */
export const RUNTIME_DIRECTORY = 'Runtime/win-x64'
/** Packaged dsh CLI the Runtime directory ships; `python/sdk-runtime/platforms.json` declares the same name. */
export const RUNTIME_EXECUTABLE = 'deepseek-harness-sdk-runtime-win-x64.exe'
/** User-owned directory the immutable manifest excludes. */
export const PORTABLE_DATA_NAME = 'PortableData'
/** Harness home the medium owns when the user selects no other root. */
export const PORTABLE_HOME_NAME = 'home'
/** Project directory portable mode starts in when the user selects no other root. */
export const PORTABLE_WORKSPACE_NAME = 'workspace'
/** Launcher-owned settings file name, below `PortableData` on a medium and below the install root when installed. */
export const LAUNCHER_SETTINGS_NAME = 'launcher.json'
/** Marker file that separates an installed program directory from a medium. */
export const INSTALL_MARKER_NAME = 'install.json'
/**
 * Build record the launcher build writes beside the executable.
 *
 * It is a released artifact like `Runtime/win-x64/runtime-build.json`, not a
 * build byproduct: it names the identity, the upstream revision, and the pins
 * the shipped `Launcher.exe` was produced from, and it is what an acceptance
 * probe reads to know which product it is driving.
 */
export const LAUNCHER_BUILD_RECORD_NAME = 'launcher-build.json'
/** Simplified Chinese guide directory. */
export const GUIDE_DIRECTORY = 'Docs/zh-CN'
/** License and third-party notice directory. */
export const LICENSES_DIRECTORY = 'Licenses'

/** Resolved paths of one distribution root. */
export interface DistributionLayout {
  /** Directory holding `Launcher.exe`; the medium root or the install root. */
  readonly root: string
  /** Packaged dsh CLI this distribution starts. */
  readonly runtimeExecutable: string
  /** ripgrep sidecar the packaged CLI spawns. */
  readonly runtimeSidecar: string
  /** Harness home the medium owns by default. */
  readonly portableHome: string
  /** Project directory portable mode starts in by default. */
  readonly portableWorkspace: string
  /** Absolute path of the install marker whose presence selects installed mode. */
  readonly installMarker: string
  /** Simplified Chinese guide directory. */
  readonly guideDirectory: string
  /** License and third-party notice directory. */
  readonly licensesDirectory: string
}

/**
 * Resolve the layout of one distribution root.
 * @param root - directory holding `Launcher.exe`.
 * @returns every fixed path the launcher resolves below that root.
 */
export function distributionLayout(root: string): DistributionLayout {
  const absolute = resolve(root)
  const runtime = join(absolute, ...RUNTIME_DIRECTORY.split('/'))
  return {
    root: absolute,
    runtimeExecutable: join(runtime, RUNTIME_EXECUTABLE),
    runtimeSidecar: join(runtime, `${RUNTIME_EXECUTABLE.slice(0, -'.exe'.length)}-rg.exe`),
    portableHome: join(absolute, PORTABLE_DATA_NAME, PORTABLE_HOME_NAME),
    portableWorkspace: join(absolute, PORTABLE_DATA_NAME, PORTABLE_WORKSPACE_NAME),
    installMarker: join(absolute, INSTALL_MARKER_NAME),
    guideDirectory: join(absolute, ...GUIDE_DIRECTORY.split('/')),
    licensesDirectory: join(absolute, LICENSES_DIRECTORY),
  }
}

/**
 * Resolve the directory holding `Launcher.exe` for one process image.
 * @param execPath - the running executable path (`process.execPath`).
 * @returns the distribution root.
 */
export function distributionRootOf(execPath: string): string {
  return dirname(resolve(execPath))
}

/**
 * Resolve where the launcher records its own settings.
 *
 * A medium keeps them below `PortableData`, which the manifest never owns, so
 * sealing and verification ignore the file and the choice travels with the
 * medium. An installed program directory keeps them beside the marker that
 * identified it as installed.
 *
 * @param layout - resolved distribution layout.
 * @param installed - whether the root carries the install marker.
 * @returns the absolute settings path.
 */
export function launcherSettingsPath(layout: DistributionLayout, installed: boolean): string {
  return installed
    ? join(layout.root, LAUNCHER_SETTINGS_NAME)
    : join(layout.root, PORTABLE_DATA_NAME, LAUNCHER_SETTINGS_NAME)
}
