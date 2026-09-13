/** The consumer Web bundle must carry one parseable publisher-brand + trimmed-roster layer. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

describe('Consumer Web bundle', () => {
  it('declares a public parseable layer that brands and trims the web surface', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      private?: boolean
      publishConfig?: { access?: string }
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.private).toBeUndefined()
    expect(manifest.publishConfig?.access).toBe('public')
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dependencies).toEqual({
      '@deepseek-ai/dsh-client-ui-brand-product': 'workspace:^',
    })

    const parsed = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as { insert?: { id?: string; name?: string }[]; id?: string; disabled?: boolean }[]
    expect(parsed.flatMap(patch => patch.insert ?? [])).toEqual([
      { id: 'ui-brand-product', name: '@deepseek-ai/dsh-client-ui-brand-product' },
    ])
    expect(parsed.filter(patch => patch.disabled === true).map(patch => patch.id)).toEqual([
      'plugin-inventory',
      'cordis-host-runner',
      'cordis-client-runner',
      'client-hmr',
      'ui-settings-plugin-inventory',
      'ui-settings-plugins',
      'ui-cordis',
    ])
  })
})
