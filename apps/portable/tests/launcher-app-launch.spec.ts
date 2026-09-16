import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  announcedUrl,
  APPLICATION_ARGS,
  APPLICATION_PROFILE,
  applicationEnvironment,
  isLoopbackLaunchUrl,
  launchApplication,
  nativeCacheDirectory,
} from '../src/launcher/app-launch.ts'

const scratch: string[] = []

function directory(): string {
  const path = mkdtempSync(join(tmpdir(), 'dsh-portable-launch-'))
  scratch.push(path)
  return path
}

afterEach(() => {
  for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true })
})

describe('announced URL', () => {
  it('reads the authenticated URL out of packaged CLI output', () => {
    const url = 'http://127.0.0.1:51234/?token=AbC-123_xyz'
    expect(announcedUrl(`starting\ndsh web: ${url}\n`)).toBe(url)
  })

  it('reports nothing before the CLI announces an HTTP URL', () => {
    expect(announcedUrl('')).toBeUndefined()
    expect(announcedUrl('dsh web:')).toBeUndefined()
    expect(announcedUrl('dsh web: not-a-url')).toBeUndefined()
  })
})

describe('loopback launch URL validation', () => {
  it('accepts an authenticated loopback root URL', () => {
    expect(isLoopbackLaunchUrl('http://127.0.0.1:51234/?token=AbC-123_xyz')).toBe(true)
    expect(isLoopbackLaunchUrl('http://127.0.0.1/?token=abc')).toBe(true)
  })

  it('refuses every other target the launcher could be asked to open', () => {
    for (const url of [
      'https://127.0.0.1:51234/?token=abc',
      'http://localhost:51234/?token=abc',
      'http://0.0.0.0:51234/?token=abc',
      'http://127.0.0.1:51234/?token=abc#fragment',
      'http://127.0.0.1:51234/sessions?token=abc',
      'http://127.0.0.1:51234/?token=abc&next=http://evil.example/',
      'http://127.0.0.1:51234/?token=ab%20c',
      'http://127.0.0.1:51234/?token=',
      'http://127.0.0.1:51234/',
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(isLoopbackLaunchUrl(url), url).toBe(false)
    }
  })
})

describe('launch request', () => {
  it('starts the shipped profile with fixed flags and no user input', () => {
    expect(APPLICATION_PROFILE).toBe('consumer')
    expect(APPLICATION_ARGS).toEqual(['--profile', 'consumer', '--no-open', '--port', '0'])
  })

  it('keeps the whole footprint inside the state root, including the carrier cache', () => {
    const home = join('D:', 'AgentLab', 'home')
    const environment = applicationEnvironment(home, { PATH: 'C:\\Windows', DSH_HOME: 'C:\\Users\\someone\\.dsh' })
    expect(environment.DSH_HOME).toBe(home)
    expect(environment.PKG_NATIVE_CACHE_PATH).toBe(nativeCacheDirectory(home))
    expect(environment.NARB_NATIVE_CACHE_DIR).toBe(join(nativeCacheDirectory(home), 'narb'))
    // The launcher's own environment is otherwise untouched.
    expect(environment.PATH).toBe('C:\\Windows')
  })

  it('refuses to start a distribution whose runtime is missing', async () => {
    const missing = join(directory(), 'Runtime', 'win-x64', 'deepseek-harness-sdk-runtime-win-x64.exe')
    await expect(async () => launchApplication({
      executable: missing,
      home: directory(),
      workspace: directory(),
      onOutput: () => undefined,
    })).rejects.toThrow(/is missing from this distribution/u)
  })

  it('reports what the runtime said when it exits before announcing a URL', async () => {
    // Any executable will do here: the fixed flags are not ones a bare Node
    // binary accepts, so the child exits immediately and the launcher must
    // surface that rather than wait out the ready timeout.
    await expect(async () => launchApplication({
      executable: process.execPath,
      home: directory(),
      workspace: directory(),
      onOutput: () => undefined,
    })).rejects.toThrow(/exited with code .* before it announced a URL/u)
  })

  it('reports a runtime that stays silent instead of waiting forever', async () => {
    // A zero budget makes the timeout branch deterministic: the timer is armed
    // before the child can possibly reach a running state.
    await expect(async () => launchApplication({
      executable: process.execPath,
      home: directory(),
      workspace: directory(),
      onOutput: () => undefined,
      readyTimeoutMs: 0,
    })).rejects.toThrow(/announced no URL within 0 ms/u)
  })

  it('reports a file the operating system refuses to execute', async () => {
    const notAnExecutable = join(directory(), 'stub.exe')
    writeFileSync(notAnExecutable, 'this is not a program')
    await expect(async () => launchApplication({
      executable: notAnExecutable,
      home: directory(),
      workspace: directory(),
      onOutput: () => undefined,
    })).rejects.toThrow(/launcher:/u)
  })
})
