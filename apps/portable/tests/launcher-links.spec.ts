import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { canonicalForm, requireUnlinkedDirectory, unlinkedDirectoryStatus } from '../src/launcher/links.ts'

const roots: string[] = []

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-launcher-links-'))
  roots.push(root)
  return root
}

/**
 * Create one directory link, reporting whether this host permits it.
 *
 * A junction is the link form Windows grants without elevation, so it is the
 * one a user can actually create beside an installed program.
 */
function link(target: string, path: string): boolean {
  try {
    symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'dir')
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EPERM') return false
    throw error
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('directory status without following links', () => {
  it('reports a directory, an absent path, and a file', () => {
    const root = scratch()
    const directory = join(root, 'program')
    mkdirSync(directory)
    writeFileSync(join(root, 'program.txt'), 'text')
    expect(unlinkedDirectoryStatus(directory)).toBe('directory')
    expect(unlinkedDirectoryStatus(join(root, 'missing'))).toBe('absent')
    expect(unlinkedDirectoryStatus(join(root, 'missing', 'below'))).toBe('absent')
    expect(unlinkedDirectoryStatus(join(root, 'program.txt'))).toBe('other')
  })

  it('reports a file standing where a directory has to be, rather than calling it absent', () => {
    const root = scratch()
    writeFileSync(join(root, 'program.txt'), 'text')
    // Reporting this as absence would hide an obstacle the user can remove.
    expect(unlinkedDirectoryStatus(join(root, 'program.txt', 'below'))).toBe('other')
  })

  it('reports a link anywhere on the way down, not only at the end', () => {
    const root = scratch()
    const outside = join(root, 'outside')
    const target = join(outside, 'elsewhere')
    mkdirSync(target, { recursive: true })
    const linked = join(root, 'linked')
    if (!link(outside, linked)) return
    expect(unlinkedDirectoryStatus(linked)).toBe('link')
    expect(unlinkedDirectoryStatus(join(linked, 'elsewhere'))).toBe('link')
  })
})

describe('requiring an unlinked directory', () => {
  it('accepts a directory and refuses every other outcome', () => {
    const root = scratch()
    const directory = join(root, 'program')
    mkdirSync(directory)
    writeFileSync(join(root, 'program.txt'), 'text')
    expect(() => { requireUnlinkedDirectory(directory) }).not.toThrow()
    expect(() => { requireUnlinkedDirectory(join(root, 'missing')) }).toThrow(/found absent/u)
    expect(() => { requireUnlinkedDirectory(join(root, 'program.txt')) }).toThrow(/found other/u)
    const outside = join(root, 'outside')
    mkdirSync(outside)
    const linked = join(root, 'linked')
    if (link(outside, linked)) expect(() => { requireUnlinkedDirectory(linked) }).toThrow(/found link/u)
  })
})

describe('canonical spelling', () => {
  it('resolves an existing directory and reports an absent one', () => {
    const root = scratch()
    const directory = join(root, 'program')
    mkdirSync(directory)
    expect(canonicalForm(directory)).toBe(canonicalForm(directory))
    expect(canonicalForm(join(root, 'missing'))).toBeUndefined()
  })
})
