import { describe, expect, it } from 'vitest'
import {
  localAppDataDirectory,
  privateTemporaryRoot,
  registryToolPath,
  roamingAppDataDirectory,
  systemProgramPath,
  userProgramsDirectory,
} from '../src/launcher/environment.ts'

const HOST: NodeJS.ProcessEnv = {
  LOCALAPPDATA: 'C:\\Users\\probe\\AppData\\Local',
  APPDATA: 'C:\\Users\\probe\\AppData\\Roaming',
  SystemRoot: 'C:\\Windows',
}

describe('host directories', () => {
  it('reads the per-user application data directories', () => {
    expect(localAppDataDirectory(HOST)).toBe('C:\\Users\\probe\\AppData\\Local')
    expect(roamingAppDataDirectory(HOST)).toBe('C:\\Users\\probe\\AppData\\Roaming')
  })

  it('places a per-user installation below the local application data directory', () => {
    expect(userProgramsDirectory(HOST)).toBe('C:\\Users\\probe\\AppData\\Local\\Programs')
  })

  it('reports a host that names no location instead of inventing one', () => {
    expect(localAppDataDirectory({})).toBeUndefined()
    expect(roamingAppDataDirectory({})).toBeUndefined()
    expect(userProgramsDirectory({})).toBeUndefined()
    expect(userProgramsDirectory({ LOCALAPPDATA: '   ' })).toBeUndefined()
  })

  it('refuses a relative location, which would resolve against the current directory', () => {
    expect(localAppDataDirectory({ LOCALAPPDATA: 'AppData\\Local' })).toBeUndefined()
  })
})

describe('system programs', () => {
  it('names a program inside the system directory rather than searching PATH', () => {
    expect(systemProgramPath('reg.exe', HOST)).toBe('C:\\Windows\\System32\\reg.exe')
    expect(registryToolPath(HOST)).toBe('C:\\Windows\\System32\\reg.exe')
  })

  it('accepts the legacy spelling of the system directory', () => {
    expect(registryToolPath({ windir: 'D:\\Windows' })).toBe('D:\\Windows\\System32\\reg.exe')
  })

  it('reports a host that names no system directory', () => {
    expect(registryToolPath({})).toBeUndefined()
  })
})

describe('private temporary root', () => {
  it('resolves the host temporary directory the launcher may use', () => {
    expect(privateTemporaryRoot()).not.toBe('')
  })
})
