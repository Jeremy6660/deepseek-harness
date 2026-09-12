import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function png(): Buffer {
  const body = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(body)
  body.writeUInt32BE(13, 8)
  body.write('IHDR', 12, 'ascii')
  body.writeUInt32BE(1, 16)
  body.writeUInt32BE(1, 20)
  return body
}

export function productYaml(overrides = ''): string {
  return `schemaVersion: 1
product:
  id: portable-agent-lab-usb
  version: 1.0.0
  title:
    en: Portable Agent Lab USB
    zh-CN: 便携智能体实验盘
publisher:
  name: Example Student Publisher
  support:
    en: Simple support for 30 days after receipt.
    zh-CN: 收货后提供 30 天简单售后。
branding:
  logo: Runtime/win-x64/brand/logo.png
  welcome:
    en: Welcome to Portable Agent Lab USB.
    zh-CN: 欢迎使用便携智能体实验盘。
  primaryColor:
    light: '#3366CC'
    dark: '#6699FF'
upstream:
  repository: https://github.com/deepseek-ai/deepseek-harness
  revision: 0123456789abcdef0123456789abcdef01234567
  attribution:
    en: Unofficial product based on DeepSeek Harness; not published or endorsed by DeepSeek.
    zh-CN: 本产品基于 DeepSeek Harness，并非由 DeepSeek 发布或背书。
${overrides}`
}

export function writeProductFixture(root: string, order: 'forward' | 'reverse' = 'forward'): void {
  const files: Array<[string, Buffer | string]> = [
    ['product.yml', productYaml()],
    ['Runtime/win-x64/brand/logo.png', png()],
    ['Runtime/win-x64/empty.txt', ''],
    ['Source/说明.txt', 'source'],
    ['Developer/win-x64/tool.txt', 'tool'],
    ['Docs/zh-CN/guide.txt', 'guide'],
    ['Licenses/MIT.txt', 'license'],
  ]
  if (order === 'reverse') files.reverse()
  for (const [path, body] of files) {
    const absolute = join(root, ...path.split('/'))
    mkdirSync(join(absolute, '..'), { recursive: true })
    writeFileSync(absolute, body)
  }
  mkdirSync(join(root, 'PortableData'), { recursive: true })
  writeFileSync(join(root, 'PortableData', 'user.txt'), 'keep')
}
