import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultDshHome } from '@deepseek-ai/dsh-home-paths'
import { distributionLayout, PORTABLE_DATA_NAME } from '../src/launcher/layout.ts'
import {
  LAUNCHER_SETTINGS_FORMAT,
  readLauncherSettings,
  resolveLaunchRoots,
  resolveStateRoot,
  StateRootError,
  writeLauncherSettings,
} from '../src/launcher/settings.ts'

const roots: string[] = []
const VOLUME_ROOT = parse(resolve('/')).root

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-portable-settings-'))
  roots.push(root)
  return root
}

function layout(): ReturnType<typeof distributionLayout> {
  return distributionLayout(scratch())
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('launcher settings file', () => {
  it('treats a missing file as a first run rather than a defect', () => {
    const path = join(scratch(), 'launcher.json')
    expect(readLauncherSettings(path)).toEqual({ settings: {}, path, defect: undefined, diagnostic: '' })
  })

  it('reports unreadable content instead of rewriting it', () => {
    const path = join(scratch(), 'launcher.json')
    writeFileSync(path, '{ not json')
    const loaded = readLauncherSettings(path)
    expect(loaded.defect).toBe('unreadable')
    expect(loaded.settings).toEqual({})
    expect(loaded.diagnostic).not.toBe('')
    expect(readFileSync(path, 'utf8')).toBe('{ not json')
  })

  it('rejects a file whose shape or version it does not own', () => {
    const path = join(scratch(), 'launcher.json')
    for (const body of [
      '[]',
      '"stateRoot"',
      '{"formatVersion":1}',
      '{"formatVersion":2,"stateRoot":"D:\\\\Lab"}',
      `{"formatVersion":${String(LAUNCHER_SETTINGS_FORMAT)},"stateRoot":"D:\\\\Lab","extra":true}`,
      `{"formatVersion":${String(LAUNCHER_SETTINGS_FORMAT)},"stateRoot":"   "}`,
    ]) {
      writeFileSync(path, body)
      expect(readLauncherSettings(path).defect, body).toBe('schema')
    }
  })

  it('round-trips a chosen state root and can clear it', () => {
    const path = join(scratch(), PORTABLE_DATA_NAME, 'launcher.json')
    writeLauncherSettings(path, { stateRoot: 'D:\\AgentLab' })
    expect(readLauncherSettings(path)).toEqual({
      settings: { stateRoot: 'D:\\AgentLab' },
      path,
      defect: undefined,
      diagnostic: '',
    })
    writeLauncherSettings(path, {})
    expect(readLauncherSettings(path).settings).toEqual({})
  })
})

describe('state root selection', () => {
  it('resolves a relative value against the distribution root', () => {
    const distribution = layout()
    expect(resolveStateRoot(join('..', 'AgentLab'), distribution, false))
      .toBe(resolve(distribution.root, '..', 'AgentLab'))
  })

  it('expands a home-relative value', () => {
    const distribution = layout()
    expect(resolveStateRoot('~/agent-lab', distribution, true)).toBe(join(homedir(), 'agent-lab'))
  })

  it('refuses an empty value, a whole disk, and a directory holding the program', () => {
    const distribution = layout()
    for (const [value, defect] of [
      ['   ', 'empty'],
      [VOLUME_ROOT, 'filesystem-root'],
      [distribution.root, 'contains-program'],
      [resolve(distribution.root, '..'), 'contains-program'],
    ] as const) {
      try {
        resolveStateRoot(value, distribution, false)
        expect.unreachable(`${value} should have been refused`)
      } catch (error) {
        expect(error).toBeInstanceOf(StateRootError)
        expect((error as StateRootError).defect).toBe(defect)
      }
    }
  })

  it('accepts a folder below the user-owned data directory on a medium', () => {
    const distribution = layout()
    const chosen = join(distribution.root, PORTABLE_DATA_NAME, 'work')
    expect(resolveStateRoot(chosen, distribution, false)).toBe(chosen)
  })

  it('refuses the same folder once the program is an installed program', () => {
    const distribution = layout()
    try {
      resolveStateRoot(join(distribution.root, PORTABLE_DATA_NAME, 'work'), distribution, true)
      expect.unreachable('installed mode must not keep state inside the program directory')
    } catch (error) {
      expect((error as StateRootError).defect).toBe('inside-program')
    }
  })

  it('refuses a sealed program subdirectory even on a medium', () => {
    const distribution = layout()
    try {
      resolveStateRoot(join(distribution.root, 'Runtime', 'win-x64'), distribution, false)
      expect.unreachable('the sealed file set must never hold user state')
    } catch (error) {
      expect((error as StateRootError).defect).toBe('inside-program')
    }
  })
})

describe('resolved launch roots', () => {
  it('keeps both roots on the medium in portable mode', () => {
    const distribution = layout()
    expect(resolveLaunchRoots(distribution, false, {})).toEqual({
      home: distribution.portableHome,
      workspace: distribution.portableWorkspace,
      defect: undefined,
    })
  })

  it('keeps both roots in the Harness home in installed mode', () => {
    const distribution = layout()
    expect(resolveLaunchRoots(distribution, true, {})).toEqual({
      home: defaultDshHome(),
      workspace: join(defaultDshHome(), 'workspace'),
      defect: undefined,
    })
  })

  it('honours a chosen root and derives the workspace beside it', () => {
    const distribution = layout()
    const chosen = join(scratch(), 'AgentLab')
    expect(resolveLaunchRoots(distribution, false, { stateRoot: chosen })).toEqual({
      home: chosen,
      workspace: distribution.portableWorkspace,
      defect: undefined,
    })
    expect(resolveLaunchRoots(distribution, true, { stateRoot: chosen })).toEqual({
      home: chosen,
      workspace: join(chosen, 'workspace'),
      defect: undefined,
    })
  })

  it('falls back to the mode default and reports why a stored root was refused', () => {
    const distribution = layout()
    const stored = { stateRoot: VOLUME_ROOT }
    expect(resolveLaunchRoots(distribution, false, stored)).toEqual({
      home: distribution.portableHome,
      workspace: distribution.portableWorkspace,
      defect: 'filesystem-root',
    })
    expect(resolveLaunchRoots(distribution, true, stored)).toEqual({
      home: defaultDshHome(),
      workspace: join(defaultDshHome(), 'workspace'),
      defect: 'filesystem-root',
    })
  })

  it('creates nothing while resolving', () => {
    const chosen = join(scratch(), 'AgentLab')
    resolveLaunchRoots(layout(), true, { stateRoot: chosen })
    expect(existsSync(chosen)).toBe(false)
  })
})
