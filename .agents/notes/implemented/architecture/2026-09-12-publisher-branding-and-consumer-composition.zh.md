# Agent Note：发布者品牌化与精简消费者组合

Status: implemented

[English](2026-09-12-publisher-branding-and-consumer-composition.md) | 中文

## 问题

[便携产品元数据](../../proposed/feature/2026-09-11-portable-agent-usb-product.zh.md)里程碑交付了封闭、机器可读的产品身份（`product.yml`）和经过验证的载体，但没有任何东西消费这份身份：发布者标题、Logo、主色、欢迎语、归属声明和售后声明从未在 Web 客户端呈现，也没有一套精简组合能为消费者发布隐藏插件、包、Cordis 与实验性等开发面控件。

## 决策

发布者品牌在构建期定死，经现有 `DSH_CLIENT_*` 客户端构建环境注入，再由一个新品牌插件包呈现。一个新的 `consumer` profile 在 Web 应用之上叠加一个精简 bundle 来隐藏开发面控件。

### 构建期 product profile

`scripts/client-build-environment.ts` 新增 `product` 客户端构建 profile。`productClientBuildEnvironment(environment)` 读取固定键集——`DSH_CLIENT_TITLE`、双语 `DSH_CLIENT_TITLE_EN/ZH`、`DSH_CLIENT_WELCOME_EN/ZH`、`DSH_CLIENT_ATTRIBUTION_EN/ZH`、`DSH_CLIENT_SUPPORT_EN/ZH`、`DSH_CLIENT_PRIMARY_LIGHT`、`DSH_CLIENT_PRIMARY_DARK`、`DSH_CLIENT_LOGO`、`DSH_CLIENT_LOGO_DARK`、`DSH_CLIENT_COMMIT_HASH` 与 `DSH_CLIENT_VERSION`——并在打包器内联之前重新校验它们的形状：非空字符串、`#RRGGBB` 颜色、两个 Logo 各自的 `data:image/png;base64,` 前缀、Git commit hash 与语义版本。缺失或畸形值会使构建立即失败。`official` profile 保持不变。`pnpm run build:product --root <绝对 staging 目录>` 由一份已校验的便携 staging 根目录提供这些取值，发布方无需再把它们重写成 shell 环境变量语法（见[品牌化产品构建入口](../process/2026-09-13-product-branded-build-entry-point.zh.md)）。

### 品牌包

新客户端包 `@deepseek-ai/dsh-client-ui-brand-product`（`packages/client/ui-brand-product`）注入 `slots`、`locale` 与 `theme`，并自门控于 `process.env.DSH_CLIENT_BUILD_PROFILE === 'product'`，因此官方品牌包（`ui-brand-official`，门控于 `'official'`）与本包互斥。它注册 `product` locale 命名空间（`title`、`welcome`、`attribution`、`support`），从内联环境组装；把 `--dsw-alias-brand-primary` token 覆盖为发布者明/暗主色；并占据 `sidebar.brand.mark`、`sidebar.brand.name`、`conversation.hero.brand.mark` 以及新的 `conversation.hero.welcome` 插槽。Logo 标记通过新的 `BrandImage` primitive 渲染，每种配色各一个，由一条以布局 presenter 已写入的主题属性为限定条件的 CSS module 规则切换。

`ui-primitives` 新增 primitive `BrandImage`，用 `src`、`alt`、`size`、`className` 渲染 `<img src>`；发布者 Logo 是 base64 PNG data URI，因此不涉及任何远程拉取或 HTML/CSS/脚本内容。

`ui-conversation` 新增插槽 `conversation.hero.welcome` 承载空会话欢迎语；其默认回退是现有 `hero.headline` 文案，因此非 product 构建保留原有 hero。

### 消费者组合

新 bundle `@deepseek-ai/dsh-consumer-web`（`packages/bundle/consumer-web`）插入 `ui-brand-product`，并禁用 `web-app` roster 拥有的七个开发面行：`plugin-inventory`、`cordis-host-runner`、`cordis-client-runner`、`client-hmr`、`ui-settings-plugin-inventory`、`ui-settings-plugins` 与 `ui-cordis`。`disabled: true` 行只会从活动集减去——该行仍归 `web-app` 所有，因此禁用不会重新添加行，也不会在 plane 之间移动它。

新 `consumer` profile 加入 `app-boot` 的 `PROFILE_TEMPLATES`，组合为 `dsh-base → dsh-web-app → dsh-consumer-web`，`patchReload: 'live'`（与 `web` 对齐）。开发者 `web` profile 保持完整。

### 安全边界

消费者侧不会重新打开 `apps/portable` 已经封闭的边界：品牌包只读取构建期内联、已经校验过的 `DSH_CLIENT_*` 字符串，绝不读取 `product.yml` 文件，不使用 `dangerouslySetInnerHTML`，Logo 以 `<img>` 渲染且 `src` 是 `data:image/png;base64,` data URI（测试断言非远程）。`product.yml` 绝不进入消费者设置。品牌命名按品牌规范使用 `DSH` 缩写与“基于 DeepSeek Harness 构建”的描述性措辞。

## 备选方案

**纯 `DSH_CLIENT_*` 环境扩展而不新增品牌包。** 这无法呈现 Logo（需要 primitive）、主色（需要 theme token 覆盖）或带 locale 语义的双语文案，并且会把发布者字典拆散到八个以上的环境键。

**只有品牌包而没有构建期输入通道。** 包可以占据插槽，但没有每个发布者各自的值可渲染。

**就地精简 `web` profile。** 开发者 `web` profile 必须保持完整；消费者发布是叠加在其上的独立品牌组合。

**新增专用品牌色 token 而非覆盖 `--dsw-alias-brand-primary`。** 该 alias 驱动派生 token（按钮填充、焦点环）。此处覆盖它即把发布者颜色当作品牌强调色；若后续里程碑需要区分两者，仍可新增专用 token。

## 后果

客户端现在能在 product 构建中呈现发布者品牌文案、Logo 与主色，`--profile consumer` 提供精简组合，隐藏插件、包、Cordis、HMR 与实验性控件，同时保留对话、项目选择、会话历史、工具调用呈现、模型与凭据设置以及必要偏好。聚焦测试覆盖插槽占据、locale 命名空间注册、theme 覆盖、profile 门控、data URI 非远程 Logo 断言、新 primitive、consumer bundle 的 disable 清单，以及欢迎插槽的默认回退与占据。

重放组装组合的 keyless Web 快照在 consumer bundle 改变树之后必须重录；重录需要真实 provider key，仍是已知阻塞点。客户端中的品牌编辑目前没有对应 UI 行，记为后续工作；未来若出现品牌编辑 surface，必须在消费者组合中一并禁用。
