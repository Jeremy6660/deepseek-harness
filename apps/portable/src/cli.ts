#!/usr/bin/env node
/** Machine-readable command line for portable product staging. */

import { isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { portableClientBuildEnvironment, readProductLogo, readProductLogoDark } from './client-env.ts'
import { readPortableProductConfig } from './product-config.ts'
import { sealPortableDistribution, verifyPortableDistribution } from './manifest.ts'

function rootArgument(args: readonly string[]): string {
  const { values } = parseArgs({ args, options: { root: { type: 'string' } }, allowPositionals: false })
  if (values.root === undefined || !isAbsolute(values.root)) throw new Error('--root must name an explicit absolute directory')
  return resolve(values.root)
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

/** Run one portable build command and set a non-zero exit status for verification issues. */
export function runPortableCli(args: readonly string[] = process.argv.slice(2)): void {
  const [command, ...rest] = args
  if (command === undefined) throw new Error('expected validate-product, seal, verify, or client-env')
  const root = rootArgument(rest)
  switch (command) {
    case 'validate-product':
      print({ valid: true, config: readPortableProductConfig(join(root, 'product.yml'), root) })
      return
    case 'seal': {
      const config = readPortableProductConfig(join(root, 'product.yml'), root)
      print(sealPortableDistribution(root, config))
      return
    }
    case 'verify': {
      const report = verifyPortableDistribution(root)
      print(report)
      if (!report.valid) process.exitCode = 1
      return
    }
    case 'client-env': {
      const config = readPortableProductConfig(join(root, 'product.yml'), root)
      print(portableClientBuildEnvironment(config, readProductLogo(root, config), readProductLogoDark(root, config)))
      return
    }
    default:
      throw new Error(`unknown portable command ${JSON.stringify(command)}; expected validate-product, seal, verify, or client-env`)
  }
}

if (import.meta.main) {
  try { runPortableCli() } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${JSON.stringify({ error: message })}\n`)
    process.exitCode = 2
  }
}
