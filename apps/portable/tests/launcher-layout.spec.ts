import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  distributionLayout,
  distributionRootOf,
  launcherSettingsPath,
  PORTABLE_DATA_NAME,
  RUNTIME_DIRECTORY,
  RUNTIME_EXECUTABLE,
} from '../src/launcher/layout.ts'
import { installDirectoryName } from '../src/launcher/naming.ts'

const ROOT = join(process.cwd(), 'distribution')

describe('distribution layout', () => {
  it('derives every fixed path from the directory holding the launcher', () => {
    const layout = distributionLayout(ROOT)
    expect(layout.runtimeExecutable).toBe(join(ROOT, ...RUNTIME_DIRECTORY.split('/'), RUNTIME_EXECUTABLE))
    expect(layout.runtimeSidecar).toBe(join(ROOT, ...RUNTIME_DIRECTORY.split('/'), 'deepseek-harness-sdk-runtime-win-x64-rg.exe'))
    expect(layout.portableHome).toBe(join(ROOT, PORTABLE_DATA_NAME, 'home'))
    expect(layout.portableWorkspace).toBe(join(ROOT, PORTABLE_DATA_NAME, 'workspace'))
    expect(layout.installMarker).toBe(join(ROOT, 'install.json'))
  })

  it('resolves the launcher root from the running image path', () => {
    expect(distributionRootOf(join(ROOT, 'Launcher.exe'))).toBe(ROOT)
  })

  it('keeps launcher settings outside the sealed file set on a medium', () => {
    const layout = distributionLayout(ROOT)
    expect(launcherSettingsPath(layout, false)).toBe(join(ROOT, PORTABLE_DATA_NAME, 'launcher.json'))
    expect(launcherSettingsPath(layout, true)).toBe(join(ROOT, 'launcher.json'))
  })
})

describe('install directory naming', () => {
  it('reduces a product title to an ASCII identifier', () => {
    expect(installDirectoryName('Portable Agent Lab USB')).toBe('PortableAgentLabUSB')
    expect(installDirectoryName('便携智能体实验盘 Portable Agent Lab')).toBe('PortableAgentLab')
  })

  it('refuses a title that yields no usable directory name', () => {
    expect(() => installDirectoryName('便携智能体实验盘')).toThrow(/no ASCII install directory name/u)
  })

  it('refuses a title that yields an oversized directory name', () => {
    expect(() => installDirectoryName('x'.repeat(65))).toThrow(/longer than 64 characters/u)
  })
})
