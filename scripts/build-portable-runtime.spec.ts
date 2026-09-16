import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeProductFixture } from '../apps/portable/tests/fixture.ts'
import { portableProductIdentity } from './build-product.ts'
import { BuildCli, SingleExeBuild, Target } from './build-exe-for-python-sdk.ts'
import { measure, parseCli, ripgrepSidecar, runtimeExecutable } from './build-portable-runtime.ts'

const roots: string[] = []
const repository = resolve(import.meta.dirname, '..')

function scratch(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-portable-runtime-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('portable Runtime build', () => {
  it('requires explicit absolute staging and output roots', () => {
    expect(() => parseCli([])).toThrow(/--root must name an explicit absolute/u)
    expect(() => parseCli(['--root', 'relative', '--out', scratch()])).toThrow(/--root must name an explicit absolute/u)
    expect(() => parseCli(['--root', scratch()])).toThrow(/--out must name an explicit absolute/u)
    const out = scratch()
    expect(parseCli(['--root', scratch(), '--out', out])).toEqual({
      portableRoot: expect.any(String),
      out,
      skipBuild: false,
    })
  })

  it('takes the executable name from the runtime platform manifest', () => {
    const target = Target.parse('node24-win-x64')
    expect(runtimeExecutable(target)).toBe('deepseek-harness-sdk-runtime-win-x64.exe')
    expect(ripgrepSidecar(runtimeExecutable(target))).toBe('deepseek-harness-sdk-runtime-win-x64-rg.exe')
  })

  it('refuses a sidecar name for a non-Windows executable', () => {
    expect(() => ripgrepSidecar('deepseek-harness-sdk-runtime-linux-x64')).toThrow(/not a Windows executable/u)
  })

  it('measures the bytes and digest of a produced artifact', async () => {
    const path = join(scratch(), 'artifact.bin')
    const body = Buffer.from('portable runtime artifact')
    writeFileSync(path, body)
    expect(await measure(path)).toEqual({
      path: 'artifact.bin',
      bytes: body.byteLength,
      sha256: createHash('sha256').update(body).digest('hex'),
    })
  })

  it('stages the portable closure apart from the Python wheel closure', () => {
    const cli = BuildCli.parse(['--targets', 'node24-win-x64', '--skip-build'])
    const wheel = new SingleExeBuild(cli)
    expect(wheel.staging).toBe(resolve(repository, 'python/sdk-runtime/src/deepseek_harness_runtime/runtime/node'))
    const portable = join(scratch(), 'closure')
    expect(new SingleExeBuild(cli, { staging: portable, outDir: scratch() }).staging).toBe(portable)
  })

  it('records the product identity the staging root declares', () => {
    const staging = scratch()
    writeProductFixture(staging)
    expect(portableProductIdentity(repository, staging)).toEqual({
      id: 'portable-agent-lab-usb',
      version: '1.0.0',
      upstreamRevision: '0123456789abcdef0123456789abcdef01234567',
    })
  })

  it('refuses a staging root the product schema cannot read', () => {
    expect(() => portableProductIdentity(repository, join(scratch(), 'missing'))).toThrow(/validate-product exited with 2/u)
  })
})
