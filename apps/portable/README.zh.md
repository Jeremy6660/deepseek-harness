# 便携发行构建工具

[English](README.md) | 中文

`@deepseek-ai/dsh-portable` 是“便携智能体实验盘”的私有构建工作区，负责产品元数据校验、不可变文件清单、发行目录验证、Windows x64 载体样机、产品启动器和免安装运行。它不是可销售的 U 盘产品。

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
  logoDark: Runtime/win-x64/brand/logo-dark.png
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
node apps/portable/lib/cli.js client-env --root C:\absolute\staging
```

`client-env` 会输出发布方的 `DSH_CLIENT_*` 值，即 `product` 客户端构建 profile 内联的 15 键对象；它是从已校验元数据通往品牌化构建的桥梁。仓库的 `pnpm run build:product --root C:\absolute\staging` 消费这座桥梁，执行由该 staging 根目录品牌化的完整客户端构建，发布方无需再把取值重写成 shell 环境变量语法。

成功命令和验证报告会在标准输出写出单行 JSON。验证发现差异时退出码为 1；命令、清单、配置、根目录或危险路径无效时，在标准错误写出 JSON 错误并以退出码 2 结束。

TypeScript API 从 `@deepseek-ai/dsh-portable` 导出相同的配置、路径策略、封装和验证协议。

## 便携 Runtime 构建

`pnpm run build:portable-runtime` 是产出发行版所携带 Windows x64 Runtime 的唯一命令。它可由一份检出加一个已校验 staging 根目录复现，并记录自身的全部输入。

```sh
pnpm run build:portable-runtime --root C:\absolute\staging --out C:\absolute\runtime
```

输入：

- `--root`：包含 `product.yml` 的绝对 staging 根目录，且该文件须能通过 `validate-product`。命令会重新校验它，并经 `client-env` 所用的同一座桥梁读取产品身份，绝不重新实现 schema。
- `--out`：接收产出文件的绝对目录。除它和下述构建根目录外不写入任何位置。
- 仓库检出本身：锁定后的依赖闭包、`python/sdk-runtime/platforms.json`（声明可执行文件名），以及根 `devDependencies` 中的 `@yao-pkg/pkg`。

产出（全部位于 `--out` 内）：

- `deepseek-harness-sdk-runtime-win-x64.exe`：`platforms.json` 为 `win-x64` 目标声明的 SEA 可执行文件。
- `deepseek-harness-sdk-runtime-win-x64-rg.exe`：可执行文件在 pkg 虚拟文件系统之外启动的 ripgrep sidecar。
- `runtime-build.json`：构建记录，含 schema 版本、产品 id 与版本、完整上游修订号、目标与 pkg/Node 固定版本、客户端构建 profile、`@yao-pkg/pkg` 的声明版本与实装版本，以及每个产出文件的字节数与 SHA-256。

版本固定：目标固定为 `node24-win-x64`；Node 范围来自该目标三元组，pkg 版本来自锁定的根清单，客户端构建环境来自 staging 根目录的已校验元数据，经 `product` 客户端构建 profile 得到。记录覆盖上述全部内容，后续发行版因此能准确说明其 Runtime 由何产出。

构建根目录与 Python wheel 的分开：品牌化客户端构建即 `build:product` 所拥有的同一次根构建，部署闭包暂存于 `.dsh-build/portable-runtime/win-x64/closure`，因此构建便携 Runtime 不会替换 Python SDK runtime 所携带的闭包。

端到端复现，并用载体样机验证结果：

```sh
pnpm run build:portable-runtime --root C:\absolute\staging --out C:\absolute\runtime
node --import tsx/esm apps/portable/scripts/compare-carriers.ts --sea C:\absolute\runtime\deepseek-harness-sdk-runtime-win-x64.exe --out C:\absolute\carrier-evidence.json
```

`--skip-build` 复用已有的客户端产物而不执行品牌化根构建。部署前，命令会校验客户端构建记录是否与 staging 根目录的产品环境及产物摘要一致。记录缺失、产物被修改或品牌不匹配都会使构建失败；请执行完整的品牌化构建来重新生成它们。

## 启动器

`Launcher.exe` 是发行目录的控制台入口。`pnpm run build:portable-launcher` 从一份已校验的 staging 根目录生成它，并使用与 Runtime 完全相同的固定载体：

```sh
pnpm run build:portable-launcher --root C:\absolute\staging --out C:\absolute\distribution
```

该命令把 `apps/portable/src/launcher/main.ts` 打包成单个模块，并在构建期内联产品的 `DSH_CLIENT_*` 值——即 `client-env` 打印的那 15 个键，取自 staging 根目录中已校验的 `product.yml`——再用固定的 `node24-win-x64` 目标打包。输出为 `Launcher.exe` 与 `launcher-build.json`，后者记录产品身份、上游修订、目标、pkg 版本固定值、字节数与 SHA-256 摘要。该记录是发布方交付的不可变内容，因此发行清单把它与 `product.yml` 一并归于 `metadata` 角色。`--skip-build` 复用已有 `lib/` 产物；pkg 输入目录为 `.dsh-build/portable-launcher/win-x64`。

**启动器绝不读取 `product.yml`。** 它呈现的每个产品值都是发布方构建期已校验并内联的字符串；运行时不打开任何元数据文件。原因记录在 [启动器笔记](../../.agents/notes/implemented/architecture/2026-09-13-portable-launcher-and-state-location.zh.md)。

启动器呈现产品标题、欢迎语、上游归属、发布方支持、上游修订、所检测到的运行方式、将要使用的状态目录，以及发行完整性：

| 菜单项 | 行为 |
| --- | --- |
| 启动本地应用 | 经 [dsh CLI](../../.agents/notes/implemented/architecture/2026-08-22-single-dsh-application-launcher.zh.md) 与随发行版附带的 `consumer` profile 启动打包 Runtime，并打开它公布的已认证回环 URL |
| 打开中文使用指南 | 把 `Docs/zh-CN/` 交给系统外壳打开 |
| 查看许可与第三方声明 | 把 `Licenses/` 交给系统外壳打开 |
| 重新检查发行完整性 | 重新执行验证，最多列出 20 个不一致文件 |
| 设置状态目录 | 把输入的目录保存为下次启动的 Harness home；直接回车则恢复该方式的默认目录 |
| 退出 | 结束 |

设置状态目录这一项会写入选择，并回报下次启动将使用的目录；它从不改写被拒绝的值。被拒绝的目录不会改动已保存的选择，并会说明它违反了哪条规则。表头始终显示下次启动将使用的目录，因此一个已失效的保存值会在任何东西启动之前就被看见。

它不提供更新、回滚、品牌编辑或插件安装，也不启动任何用户可指定的命令：可执行文件来自发行布局，profile 与参数固定，唯一交给操作系统的 URL 是启动器自行校验过的 `http://127.0.0.1/` 已认证根 URL。

## 免安装运行

介质就地运行。启动器把自身设置写在清单从不拥有的 `PortableData/` 之下，并让 Harness home 与工作目录成为它的子目录：

```text
<medium>/
  Launcher.exe
  launcher-build.json
  product.yml
  Runtime/win-x64/
  Docs/zh-CN/
  Licenses/
  PortableData/
    home/           Harness home: sessions, settings, credentials
    workspace/      directory the application starts in
    launcher.json   the state root this medium was told to use, if any
```

`home/` 存放会话、设置与凭据，`workspace/` 是应用启动时的工作目录，`launcher.json` 记录本介质被指定的状态目录（如有）。全部足迹都留在介质上，包括单文件载体首次运行时解包的原生载荷。启动器把 `PKG_NATIVE_CACHE_PATH` 与 `NARB_NATIVE_CACHE_DIR` 指向 `home/native-cache`，因此一次运行不会在操作者配置文件中留下任何东西；若不重定向，载体会把数十兆字节解包到 `%USERPROFILE%\.cache\pkg`。

用验收样机验证整条路径，它会让构建好的 `Launcher.exe` 在 `PATH` 指向空目录的条件下运行：

```sh
node --import tsx/esm apps/portable/scripts/probe-portable-launch.ts --distribution C:\absolute\distribution --out C:\absolute\launcher-evidence.json
```

样机在无任何解释器可达的条件下启动启动器，读取它呈现的身份、运行方式、状态目录与完整性，从菜单启动应用，沿启动令牌访问已认证界面以及该界面引用的每一个资产，测量介质自有的 home 与工作目录，随后把 `product.yml` 移开再跑一次菜单，以证明所呈现的身份来自构建而非文件。它期望的身份取自该发行目录自己的 `launcher-build.json`，而不是写死在样机里的名字，因此它能驱动任何发布方的产品。在这些资产中，它要求客户端携带两个互不相同的内联产品 logo，并要求样式表携带只显示其中一个的那条选择器——这正是品牌标志能在两种主题下都成立的原因。报告会列出该次运行在介质之外写入的全部内容；该清单为空。

## Windows 载体证据

v1 载体是现有 `@yao-pkg/pkg --sea` Windows x64 可执行文件及其必需的 `-rg.exe` sidecar。载体样机在系统 Node.js 和 Python 均不可用的环境中，以隔离的临时 `DSH_HOME`、`--no-open` 和动态端口启动一个已经构建好的可执行文件；验证范围包括带认证信息的启动 URL、令牌交换、Web 启动数据、JavaScript 与 CSS 资产、干净的生命周期释放、退出码 0，以及状态只写入临时 home。

[carrier-evidence.json](carrier-evidence.json) 中的对比记录：SEA 载体为 246,261,760 字节、2 个文件，以 `dsh web --no-open --port 0` 启动；对应的 Desktop 解包样本为 616,488,582 字节、11,734 个文件，通过 Electron 壳启动。因此 v1 固定采用 SEA；Desktop 只作为确定性文件树处理的实现参考，不作为产品壳。

使用已经构建的绝对路径复现对比：

```sh
node --import tsx/esm apps/portable/scripts/compare-carriers.ts --sea C:\absolute\deepseek-harness-sdk-runtime-win-x64.exe --desktop C:\absolute\win-unpacked --out C:\absolute\carrier-evidence.json
```

## 里程碑边界

本工作区交付面向 Windows 10/11 x64 与 NTFS 的开发协议和通过验证的载体基础、从已校验元数据通往品牌化客户端构建的 `client-env` 桥梁、生成发行版所携带 Runtime 的命令，以及带状态根选择的启动器骨架与免安装运行。发布方品牌与精简消费组合本身不在本工作区内，见 [发布方品牌与消费端组合](../../.agents/notes/implemented/architecture/2026-09-12-publisher-branding-and-consumer-composition.zh.md)。

单用户安装与卸载建立在这个启动器之上，但不属于它：装机记录、ASCII 目录名、单用户注册表项与受保护根检查均已存在并带测试，但目前没有任何菜单项驱动它们。本工作区仍不实现修复、备份、凭据 vault、介质制作或离线 DevKit；也不加入签名、更新服务或 DRM，不构成可销售产品。

完整产品仍处于 [便携智能体实验盘产品](../../.agents/notes/proposed/feature/2026-09-11-portable-agent-usb-product.zh.md) 提案阶段。已实现的协议、威胁边界与载体选择记录在 [便携产品元数据与 SEA 载体](../../.agents/notes/implemented/architecture/2026-09-11-portable-product-metadata-and-sea-carrier.zh.md)。
