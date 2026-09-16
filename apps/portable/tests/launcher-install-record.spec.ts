import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  detectRunMode,
  installRecordPath,
  readInstallRecord,
  writeInstallRecord,
  type InstallRecord,
} from '../src/launcher/install-record.ts'
import { distributionLayout } from '../src/launcher/layout.ts'

const roots: string[] = []

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-launcher-record-'))
  roots.push(root)
  return root
}

const RECORD: InstallRecord = {
  productId: 'portable-agent-lab-usb',
  productVersion: '1.0.0',
  installDirectoryName: 'PortableAgentLabUSB',
  launcherSha256: 'a'.repeat(64),
  installedAt: '2026-09-15T00:00:00.000Z',
  interfaceLanguage: 'zh-CN',
}

function recordPath(root: string): string {
  return installRecordPath(root)
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('install record', () => {
  it('round-trips a record it wrote', () => {
    const root = scratch()
    mkdirSync(root, { recursive: true })
    const path = recordPath(root)
    writeInstallRecord(path, RECORD)
    expect(readInstallRecord(path)).toEqual({ record: RECORD, path, defect: undefined, diagnostic: '' })
  })

  it('records no absolute path, so nothing persisted can name a removal target', () => {
    const root = scratch()
    const path = recordPath(root)
    writeInstallRecord(path, RECORD)
    const written = readFileSync(path, 'utf8')
    expect(written).not.toContain(root)
    expect(written).not.toMatch(/[A-Za-z]:[\\/]/u)
  })

  it('reports a record it cannot use instead of repairing it', () => {
    const root = scratch()
    const path = recordPath(root)
    expect(readInstallRecord(path).defect).toBe('unreadable')

    writeFileSync(path, 'not json')
    expect(readInstallRecord(path).defect).toBe('unreadable')

    for (const body of [
      '[]',
      '{"formatVersion":2}',
      JSON.stringify({ formatVersion: 1, ...RECORD, extra: true }),
      JSON.stringify({ formatVersion: 1, ...RECORD, launcherSha256: 'short' }),
      JSON.stringify({ formatVersion: 1, ...RECORD, interfaceLanguage: 'fr' }),
      JSON.stringify({ formatVersion: 1, ...RECORD, productId: '  ' }),
    ]) {
      writeFileSync(path, body)
      expect(readInstallRecord(path).defect, body).toBe('schema')
    }
  })
})

describe('run mode', () => {
  it('reports a directory with no record as a medium', () => {
    const root = scratch()
    const layout = distributionLayout(root)
    expect(detectRunMode(layout)).toBe('portable')
    writeFileSync(layout.installMarker, '{}\n')
    expect(detectRunMode(layout)).toBe('installed')
  })

  it('treats a damaged record as installed, because the directory is still one', () => {
    const root = scratch()
    const layout = distributionLayout(root)
    // Reporting this as a medium would offer the user the wrong actions; the
    // record's contents are checked by the uninstall, which is where they matter.
    writeFileSync(layout.installMarker, 'not json')
    expect(detectRunMode(layout)).toBe('installed')
  })
})
