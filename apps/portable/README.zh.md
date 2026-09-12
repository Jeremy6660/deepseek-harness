# 便携发行构建工具

[English](README.md) | 中文

`@deepseek-ai/dsh-portable` 是“便携智能体实验盘”首个里程碑的私有构建工作区，负责产品元数据校验、不可变文件清单、发行目录验证和 Windows x64 载体样机。它不是面向消费者的启动器，也不是可销售的 U 盘产品。

## 产品配置

staging 根目录包含一份严格的 `product.yml`：

```yaml
schemaVersion: 1
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
```

schema 会拒绝缺失或未知字段、自定义 YAML 标签、非法语义版本、非 40 位 Git revision、非法颜色、远程资产、SVG、路径遍历、链接以及内容不是 PNG 的 Logo。校验错误会指出字段路径和修正要求。产品配置不接受 HTML、CSS、脚本或事件处理器。

## 发行协议

`manifest.json` 记录 schema v1、产品身份、上游 revision、`win32/x64` 目标，以及按路径排序的不可变文件条目。每个条目包含使用正斜杠的相对路径、字节数、SHA-256 摘要和一个角色：`launcher`、`runtime`、`recovery`、`metadata`、`source`、`developer`、`documentation` 或 `license`。

路径策略拒绝绝对路径、路径遍历、反斜杠、冒号、Windows 保留名、尾随点或空格、Unicode 规范化歧义、大小写不敏感冲突、符号链接、junction 和不支持的文件系统条目。封装只处理显式给出的绝对 staging 根目录，不发现、格式化或写入可移动磁盘。

`PortableData/**` 归用户所有，永不进入清单，在验证时被忽略，也绝不会被本工作区修改。验证会检查清单中的每个文件，并将不可变区域的额外文件报告为 `unexpected`。可恢复的内容问题使用 `missing`、`modified`、`unexpected` 或 `unsupported-entry`；无效元数据和危险路径会立即失败。

`manifest.sha256` 只包含 `manifest.json` 的一行标准 SHA-256。它在清单可信时检测意外或孤立损坏，不能抵御同时替换程序与未签名清单的攻击，也不能建立发行方身份。

## 构建与 CLI

在仓库根目录构建私有工作区：

```sh
pnpm --filter @deepseek-ai/dsh-portable run build
```

使用绝对 staging 根目录运行已构建 CLI：

```sh
node apps/portable/lib/cli.js validate-product --root C:\absolute\staging
node apps/portable/lib/cli.js seal --root C:\absolute\staging
node apps/portable/lib/cli.js verify --root C:\absolute\staging
```

成功命令和验证报告会在标准输出写出单行 JSON。验证发现差异时退出码为 1；命令、清单、配置、根目录或危险路径无效时，在标准错误写出 JSON 错误并以退出码 2 结束。

TypeScript API 从 `@deepseek-ai/dsh-portable` 导出相同的配置、路径策略、封装和验证协议。

## Windows 载体证据

v1 载体是现有 `@yao-pkg/pkg --sea` Windows x64 可执行文件及其必需的 `-rg.exe` sidecar。载体样机在系统 Node.js 和 Python 均不可用的环境中，以隔离的临时 `DSH_HOME`、`--no-open` 和动态端口启动一个已经构建好的可执行文件；验证范围包括带认证信息的启动 URL、令牌交换、Web 启动数据、JavaScript 与 CSS 资产、干净的生命周期释放、退出码 0，以及状态只写入临时 home。

[carrier-evidence.json](carrier-evidence.json) 中的对比记录：SEA 载体为 246,261,760 字节、2 个文件，以 `dsh web --no-open --port 0` 启动；对应的 Desktop 解包样本为 616,488,582 字节、11,734 个文件，通过 Electron 壳启动。因此 v1 固定采用 SEA；Desktop 只作为确定性文件树处理的实现参考，不作为产品壳。

使用已经构建的绝对路径复现对比：

```sh
node --import tsx/esm apps/portable/scripts/compare-carriers.ts --sea C:\absolute\deepseek-harness-sdk-runtime-win-x64.exe --desktop C:\absolute\win-unpacked --out C:\absolute\carrier-evidence.json
```

## 里程碑边界

本工作区交付面向 Windows 10/11 x64 与 NTFS 的开发协议和通过验证的载体基础。它不实现消费者品牌 UI、精简消费组合、Launcher、安装、卸载、修复、备份、凭据 vault、介质制作或离线 DevKit；也不加入签名、更新服务或 DRM，不构成可销售产品。

完整产品仍处于 [便携智能体实验盘产品](../../.agents/notes/proposed/feature/2026-09-11-portable-agent-usb-product.zh.md) 提案阶段。已实现的协议、威胁边界与载体选择记录在 [便携产品元数据与 SEA 载体](../../.agents/notes/implemented/architecture/2026-09-11-portable-product-metadata-and-sea-carrier.zh.md)。
