import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { LauncherIdentity } from '../src/launcher/identity.ts'
import type { IntegrityReport } from '../src/launcher/integrity.ts'
import { distributionLayout } from '../src/launcher/layout.ts'
import {
  INTEGRITY_DETAIL_LIMIT,
  menuActionFor,
  renderHeader,
  renderIntegrityDetail,
  renderIntegritySummary,
  renderMenu,
  runMenu,
  type MenuState,
} from '../src/launcher/menu.ts'
import { launcherMessages } from '../src/launcher/messages.ts'
import type { ResolvedRoots } from '../src/launcher/settings.ts'
import type { PortableVerificationIssue } from '../src/types.ts'

const messages = launcherMessages('en')
const zh = launcherMessages('zh-CN')

/** Temporary distribution roots this file created, removed after each test. */
const created: string[] = []

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true })
})

const identity: LauncherIdentity = {
  title: 'Portable Agent Lab USB',
  titleEn: 'Portable Agent Lab USB',
  welcome: 'Welcome to Portable Agent Lab USB.',
  attribution: 'Unofficial product based on DeepSeek Harness; not published or endorsed by DeepSeek.',
  support: 'Simple support for 30 days after receipt.',
  version: '1.0.0',
  commit: '0123456',
  language: 'en',
}

const roots: ResolvedRoots = { home: join('D:', 'AgentLab', 'home'), workspace: join('D:', 'AgentLab', 'work'), defect: undefined }

/** One managed file that differs from the sealed manifest. */
function issue(path: string): PortableVerificationIssue {
  return { code: 'modified', path }
}

function state(integrity: IntegrityReport = { status: 'verified', issues: [], missingMetadata: [], diagnostic: '' }): MenuState {
  return { identity, mode: 'portable', roots, integrity }
}

describe('menu selection', () => {
  it('maps a listed number to its action and ignores everything else', () => {
    expect(menuActionFor(' 1 ')).toBe('run')
    expect(menuActionFor('5')).toBe('stateRoot')
    expect(menuActionFor('0')).toBe('quit')
    expect(menuActionFor('9')).toBeUndefined()
    expect(menuActionFor('')).toBeUndefined()
    expect(menuActionFor('run')).toBeUndefined()
  })
})

describe('header', () => {
  it('presents identity, attribution, mode, both roots, and integrity', () => {
    const lines = renderHeader(state(), messages)
    expect(lines[0]).toBe('Portable Agent Lab USB  1.0.0')
    expect(lines).toContain('Unofficial product based on DeepSeek Harness; not published or endorsed by DeepSeek.')
    expect(lines).toContain('Simple support for 30 days after receipt.')
    expect(lines).toContain('Mode: Portable (running from this medium)')
    expect(lines).toContain(`State directory: ${roots.home}`)
    expect(lines).toContain(`Working directory: ${roots.workspace}`)
    expect(lines).toContain('Integrity: Verified: every file matches the sealed manifest')
  })

  it('presents installed mode in the user’s language', () => {
    const lines = renderHeader({ ...state(), mode: 'installed' }, zh)
    expect(lines).toContain('运行方式: 已安装到本机')
    expect(lines).toContain(`状态目录: ${roots.home}`)
  })
})

describe('integrity presentation', () => {
  it('summarizes every outcome', () => {
    expect(renderIntegritySummary({ status: 'verified', issues: [], missingMetadata: [], diagnostic: '' }, messages))
      .toBe('Verified: every file matches the sealed manifest')
    expect(renderIntegritySummary(
      { status: 'unsealed', issues: [], missingMetadata: ['manifest.json', 'manifest.sha256'], diagnostic: '' },
      messages,
    )).toContain('manifest.json, manifest.sha256')
    expect(renderIntegritySummary(
      { status: 'damaged', issues: [issue('Runtime/win-x64/x.exe')], missingMetadata: [], diagnostic: '' },
      messages,
    )).toContain('1 managed file(s)')
    expect(renderIntegritySummary({ status: 'unreadable', issues: [], missingMetadata: [], diagnostic: 'bad json' }, messages))
      .toBe('Metadata cannot be read: bad json')
  })

  it('lists at most the detail limit and nothing for a clean report', () => {
    const issues = Array.from({ length: INTEGRITY_DETAIL_LIMIT + 5 }, (_, index) => issue(`file-${String(index)}`))
    const damaged: IntegrityReport = { status: 'damaged', issues, missingMetadata: [], diagnostic: '' }
    expect(renderIntegrityDetail(damaged, messages)).toHaveLength(INTEGRITY_DETAIL_LIMIT)
    expect(renderIntegrityDetail(damaged, messages)[0]).toBe('  modified  file-0')
    expect(renderIntegrityDetail(state().integrity, messages)).toEqual([])
  })
})

describe('menu rendering', () => {
  it('numbers every entry and offers nothing beyond the six', () => {
    expect(renderMenu(messages)).toEqual([
      '  1) Start the local application',
      '  2) Open the Simplified Chinese guide',
      '  3) View licenses and third-party notices',
      '  4) Check distribution integrity again',
      '  5) Set the state directory',
      '  0) Quit',
    ])
  })
})

/** Drive the menu with scripted answers and collect what it printed. */
async function drive(
  answers: readonly (string | undefined)[],
  initial: MenuState = state(),
  root: string = join('D:', 'AgentLab'),
): Promise<{ readonly lines: string[]; readonly final: MenuState }> {
  const lines: string[] = []
  const pending = [...answers]
  const final = await runMenu(initial, messages, {
    write: line => lines.push(line),
    ask: async () => pending.shift(),
    layout: distributionLayout(root),
  })
  return { lines, final }
}

describe('menu loop', () => {
  it('reports an unusable choice and asks again', async () => {
    const { lines } = await drive(['x', '0'])
    expect(lines).toContain(messages['menu.invalid'])
    expect(lines.filter(line => line === '  0) Quit')).toHaveLength(2)
  })

  it('returns on quit', async () => {
    const { final } = await drive(['0'])
    expect(final.mode).toBe('portable')
  })

  it('returns when input ends, so a closed terminal does not hang', async () => {
    const { lines } = await drive([undefined])
    expect(lines).not.toContain(messages['menu.invalid'])
  })

  it('discloses a document this distribution does not carry', async () => {
    const { lines } = await drive(['2', '', '0'])
    expect(lines).toContain(`This distribution does not contain ${join('D:', 'AgentLab', 'Docs', 'zh-CN')}.`)
  })

  it('refreshes integrity on request and keeps the refreshed result', async () => {
    const { lines, final } = await drive(['4', '', '0'])
    expect(lines.join('\n')).toContain('Not sealed:')
    expect(final.integrity.status).toBe('unsealed')
  })

  it('stores a chosen state directory and presents it in the next header', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-menu-state-'))
    created.push(root)
    const chosen = join(root, 'PortableData', 'state')
    const { lines, final } = await drive(['5', chosen, '', '0'], state(), root)
    expect(final.roots.home).toBe(chosen)
    expect(lines.join('\n')).toContain(chosen)
    expect(JSON.parse(readFileSync(join(root, 'PortableData', 'launcher.json'), 'utf8')).stateRoot).toBe(chosen)
  })

  it('reports a refused state directory in place and leaves the stored roots alone', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-menu-state-'))
    created.push(root)
    const { lines, final } = await drive(['5', root, '', '0'], state(), root)
    expect(lines.join('\n')).toContain(messages['stateRoot.containsProgram'])
    expect(final.roots.home).toBe(roots.home)
    expect(existsSync(join(root, 'PortableData', 'launcher.json'))).toBe(false)
  })

  it('restores the default state directory on an empty line', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-menu-state-'))
    created.push(root)
    const chosen = join(root, 'PortableData', 'state')
    const { final } = await drive(['5', chosen, '', '5', '', '', '0'], state(), root)
    expect(final.roots.home).toBe(distributionLayout(root).portableHome)
  })
})
