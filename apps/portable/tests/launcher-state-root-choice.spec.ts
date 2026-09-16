import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { distributionLayout } from '../src/launcher/layout.ts'
import { launcherMessages } from '../src/launcher/messages.ts'
import { applyStateRootChoice, STATE_ROOT_REASON } from '../src/launcher/state-root-choice.ts'

const created: string[] = []

/** One disposable distribution root carrying the directories a choice needs. */
function medium(): { readonly root: string; readonly layout: ReturnType<typeof distributionLayout> } {
  const root = mkdtempSync(join(tmpdir(), 'dsh-state-root-'))
  created.push(root)
  return { root, layout: distributionLayout(root) }
}

function settingsText(layout: ReturnType<typeof distributionLayout>): string {
  return readFileSync(join(layout.root, 'PortableData', 'launcher.json'), 'utf8')
}

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('state root choice', () => {
  it('stores the spelling the user typed and moves the state directory to it', () => {
    const { layout } = medium()
    const target = join(layout.root, 'PortableData', 'state')
    const choice = applyStateRootChoice(target, layout, false)
    expect(choice.defect).toBeUndefined()
    expect(choice.roots.home).toBe(target)
    // The stored value keeps the user's spelling rather than the resolved path.
    expect(JSON.parse(settingsText(layout))).toEqual({ formatVersion: 1, stateRoot: target })
  })

  it('resolves a relative value against the distribution root, so it survives a drive-letter change', () => {
    const { layout } = medium()
    const choice = applyStateRootChoice(join('PortableData', 'state'), layout, false)
    expect(choice.defect).toBeUndefined()
    expect(choice.roots.home).toBe(join(layout.root, 'PortableData', 'state'))
    expect(JSON.parse(settingsText(layout)).stateRoot).toBe(join('PortableData', 'state'))
  })

  it('clears the stored choice on an empty line and returns to the mode default', () => {
    const { layout } = medium()
    applyStateRootChoice(join(layout.root, 'PortableData', 'state'), layout, false)
    const cleared = applyStateRootChoice('   ', layout, false)
    expect(cleared.defect).toBeUndefined()
    expect(cleared.roots.home).toBe(layout.portableHome)
    expect(JSON.parse(settingsText(layout))).toEqual({ formatVersion: 1 })
  })

  it('refuses a whole disk and stores nothing', () => {
    const { layout } = medium()
    const choice = applyStateRootChoice(layout.root.slice(0, 3), layout, false)
    expect(choice.defect).toBe('filesystem-root')
    expect(existsSync(join(layout.root, 'PortableData', 'launcher.json'))).toBe(false)
  })

  it('refuses a directory that contains the program and stores nothing', () => {
    const { layout } = medium()
    const choice = applyStateRootChoice(layout.root, layout, false)
    expect(choice.defect).toBe('contains-program')
    expect(existsSync(join(layout.root, 'PortableData', 'launcher.json'))).toBe(false)
  })

  it('refuses a directory inside the program in installed mode, where PortableData is not user-owned', () => {
    const { layout } = medium()
    const choice = applyStateRootChoice(join(layout.root, 'PortableData', 'state'), layout, true)
    expect(choice.defect).toBe('inside-program')
    expect(existsSync(join(layout.root, 'PortableData', 'launcher.json'))).toBe(false)
  })

  it('keeps the previous roots when a new value is refused', () => {
    const { layout } = medium()
    const target = join(layout.root, 'PortableData', 'state')
    const accepted = applyStateRootChoice(target, layout, false)
    const refused = applyStateRootChoice(layout.root, layout, false)
    expect(refused.defect).toBe('contains-program')
    expect(refused.roots.home).toBe(accepted.roots.home)
  })

  it('names a localized reason for every refusal', () => {
    const zh = launcherMessages('zh-CN')
    const en = launcherMessages('en')
    for (const key of Object.values(STATE_ROOT_REASON)) {
      expect(zh[key]).not.toBe('')
      expect(en[key]).not.toBe('')
    }
  })

  it('recovers from a settings file it cannot read, so a corrupt file does not block the choice', () => {
    const { layout } = medium()
    const path = join(layout.root, 'PortableData', 'launcher.json')
    mkdirSync(join(layout.root, 'PortableData'), { recursive: true })
    writeFileSync(path, '{ not json')
    const choice = applyStateRootChoice(join(layout.root, 'PortableData', 'state'), layout, false)
    expect(choice.defect).toBeUndefined()
    expect(JSON.parse(settingsText(layout)).stateRoot).toBe(join(layout.root, 'PortableData', 'state'))
  })
})
