import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cordisConfigFiles, readCordisConfigFile } from './cordis-config-files.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('cordisConfigFiles', () => {
  it('finds Loader YAML without treating translation records as configs', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-cordis-config-files-'))
    roots.push(root)
    for (const directory of ['.claude', 'apps/cli/config/examples', 'docs', 'node_modules/pkg', 'vendor/pkg']) {
      mkdirSync(join(root, directory), { recursive: true })
    }
    for (const file of [
      '.claude/hidden.cordis.yml',
      'docs/cordis-primer.i18n.yaml',
      'apps/cli/config/examples/agent.cordis.yaml',
      'apps/cli/config/examples/headless.cordis.yml',
      'node_modules/pkg/hidden.cordis.yml',
      'vendor/pkg/hidden.cordis.yml',
    ]) {
      writeFileSync(join(root, file), '[]\n')
    }

    expect(cordisConfigFiles(root)).toEqual([
      join('apps', 'cli', 'config', 'examples', 'agent.cordis.yaml'),
      join('apps', 'cli', 'config', 'examples', 'headless.cordis.yml'),
    ])
  })

  it('follows an in-repository checkout symlink pointer and rejects escape', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-cordis-config-files-'))
    roots.push(root)
    mkdirSync(join(root, 'profiles'), { recursive: true })
    mkdirSync(join(root, 'snapshots'), { recursive: true })
    writeFileSync(join(root, 'snapshots', 'cordis.yml'), '[]\n')
    writeFileSync(join(root, 'profiles', 'cordis.yml'), '../snapshots/cordis.yml\n')
    expect(readCordisConfigFile(root, 'profiles/cordis.yml')).toBe('[]\n')

    writeFileSync(join(root, 'profiles', 'cordis.yml'), '../../outside.yml\n')
    expect(() => readCordisConfigFile(root, 'profiles/cordis.yml')).toThrow(/escapes the repository/u)
  })
})
