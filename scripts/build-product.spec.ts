import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeProductFixture } from '../apps/portable/tests/fixture.ts'
import { publisherEnvironment } from './build-product.ts'

const roots: string[] = []
const repository = resolve(import.meta.dirname, '..')

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-build-product-'))
  roots.push(root)
  writeProductFixture(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('publisher-branded build entry point', () => {
  it('reads the publisher values one staging root defines', () => {
    const environment = publisherEnvironment(repository, fixture())
    expect(environment).toMatchObject({
      DSH_CLIENT_TITLE: '便携智能体实验盘',
      DSH_CLIENT_TITLE_EN: 'Portable Agent Lab USB',
      DSH_CLIENT_PRIMARY_LIGHT: '#3366CC',
      DSH_CLIENT_COMMIT_HASH: '0123456',
      DSH_CLIENT_VERSION: '1.0.0',
    })
    expect(environment.DSH_CLIENT_LOGO).toMatch(/^data:image\/png;base64,/u)
  })

  it('refuses a staging root the product schema cannot read', () => {
    const root = join(fixture(), 'missing')
    expect(() => publisherEnvironment(repository, root)).toThrow(/client-env exited with 2/u)
  })
})
