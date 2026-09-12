import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeProductFixture } from './fixture.ts'

const roots: string[] = []
const cli = resolve(import.meta.dirname, '../src/cli.ts')

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-portable-cli-'))
  roots.push(root)
  writeProductFixture(root)
  return root
}

function run(...args: string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, ['--import', 'tsx/esm', cli, ...args], { encoding: 'utf8' })
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('portable distribution CLI', () => {
  it('prints a machine-readable validation result', () => {
    const result = run('validate-product', '--root', fixture())
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toMatchObject({
      valid: true,
      config: { schemaVersion: 1, product: { id: 'portable-agent-lab-usb' } },
    })
  })

  it('uses exit code 1 for recoverable verification issues', () => {
    const root = fixture()
    expect(run('seal', '--root', root).status).toBe(0)
    writeFileSync(join(root, 'Runtime', 'win-x64', 'empty.txt'), 'changed')
    const result = run('verify', '--root', root)
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      valid: false,
      issues: [{ code: 'modified', path: 'Runtime/win-x64/empty.txt' }],
    })
  })

  it('uses exit code 2 and stderr JSON for a hard input failure', () => {
    const result = run('verify', '--root', 'relative-staging')
    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(JSON.parse(result.stderr)).toEqual({ error: '--root must name an explicit absolute directory' })
  })
})
