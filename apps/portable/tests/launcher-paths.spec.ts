import { join, parse, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { comparablePath, containsOrEqualsPath, containsPath, isFilesystemRoot, samePath } from '../src/launcher/paths.ts'

const WINDOWS = process.platform === 'win32'
const VOLUME_ROOT = parse(resolve('/')).root

describe('launcher path comparison', () => {
  it('normalizes the spelling of one directory into a single comparison form', () => {
    expect(comparablePath(join(VOLUME_ROOT, 'Programs', '..', 'Programs'))).toBe(comparablePath(join(VOLUME_ROOT, 'Programs')))
  })

  it('folds case exactly when the host filesystem does', () => {
    const mixed = join(VOLUME_ROOT, 'Portable Agent Lab')
    const lowered = mixed.toLowerCase()
    expect(samePath(mixed, lowered)).toBe(WINDOWS)
  })

  it('treats a path as contained in itself only through the equals form', () => {
    const parent = join(VOLUME_ROOT, 'Programs')
    expect(containsPath(parent, parent)).toBe(false)
    expect(containsOrEqualsPath(parent, parent)).toBe(true)
  })

  it('requires a real separator before it calls a path contained', () => {
    const parent = join(VOLUME_ROOT, 'Programs')
    expect(containsOrEqualsPath(parent, join(VOLUME_ROOT, 'ProgramsBackup'))).toBe(false)
    expect(containsOrEqualsPath(parent, join(parent, 'nested'))).toBe(true)
  })

  it('recognizes a filesystem root and nothing below it', () => {
    expect(isFilesystemRoot(VOLUME_ROOT)).toBe(true)
    expect(isFilesystemRoot(join(VOLUME_ROOT, 'PortableData'))).toBe(false)
  })
})
