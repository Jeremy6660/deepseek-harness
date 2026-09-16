---
description: "面向 Web 客户端侧栏与会话首屏的发布者品牌填充，仅在 product 构建中生效；呈现发布者固定的标题、深浅两版 logo、欢迎语与强调色。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-product

[English](README.md) | 中文

## 概述

本包在 `product` 客户端构建中呈现发布者品牌。它占据侧栏标志与名称插槽、会话首屏标志与欢迎插槽，注册 `product` locale 命名空间承载发布者的双语标题与欢迎语，并覆盖品牌强调色 token。每个标志插槽都渲染 logo 的两套配色，由一条以主题属性为键的样式表规则只显示其中一个，因此本包无需读取主题状态即可在两种主题下成立。所有值都在构建期从 `DSH_CLIENT_*` 环境内联；本包不保留可变状态，也不影响模型请求。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

将本包组合进消费者构建，然后以 `product` profile 构建客户端，让其填充得以注册。`product` profile 要求完整的发布者值集——title/welcome/attribution/support（双语）、主色明暗两套、以及每套配色各一份以 data URI 提供的 PNG logo——每一项都在任何字节内联之前由构建编排校验。

### 品牌在构建期定死的内容

`DSH_CLIENT_BUILD_PROFILE === 'product'` 是唯一的门。当它成立时，本包读取内联的 `DSH_CLIENT_*` 值并：

- 用发布者 logo 的两套配色（`DSH_CLIENT_LOGO` 与 `DSH_CLIENT_LOGO_DARK`，各为 `data:image/png;base64,…` URI，绝非远程 URL）占据 `sidebar.brand.mark` 与 `conversation.hero.brand.mark`，样式表只显示其中之一；
- 用发布者标题占据 `sidebar.brand.name`，用发布者欢迎语占据 `conversation.hero.welcome`；
- 注册 `product` locale 命名空间，承载双语 title/welcome/attribution/support；
- 用发布者的明暗强调色覆盖 `--dsw-alias-brand-primary`。

任何其他 profile 都让每个被占据的插槽保留其声明外壳的回退。插件仍会照常加载并通过校验；只有注册受 profile 门控。

### 替换品牌

使用其他品牌的部署会组合另一个占据相同插槽的包，或修改构建编排校验的 `product.yml`。占据插槽是唯一的组合路径；运行中的客户端不存在品牌配置面。

### 安全边界

本包只读取构建期内联的 `DSH_CLIENT_*` 字符串。它不读取文件、不加载远程资源、不注入 HTML/CSS/脚本，并通过 `src` 为 data-URI PNG 的普通 `<img>` 渲染 logo。发布者值在构建期定死，无法改变已发布产物的品牌。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

浏览器半部通过字面量 `process.env.DSH_CLIENT_*` 访问读取内联环境（[`src/client/env.ts`](src/client/env.ts)），并在 [`src/client/locales.ts`](src/client/locales.ts) 中组装双语字典。填充以两组声明感知的注册安装——每个声明包一组——通过嵌套的 `ctx.slots.inject()` 调用完成，因此无论本行在声明者之前还是之后激活，每组都能工作，并在卸载时一并撤回。locale 字典与主题 token 覆盖都通过 `ctx.effect` 安装，其 disposer 随插件一起卸载。node 半部是一个空 Loader 座位。浏览器标题仍是构建环境的事（`DSH_CLIENT_TITLE`），不在 slot 系统之内。

配色切换由 [`src/client/Brand.module.css`](src/client/Brand.module.css) 承担。每个标志填充渲染两个 `BrandImage`，每套配色一个，样式表在 `body:not([data-ds-dark-theme])` 与 `body[data-ds-dark-theme]` 下设置它们的 `display`——那个属性由 `ui-layout` 的主题 presenter 写入。被隐藏的一方是 `display: none` 而非透明，这样它会离开侧栏的 flex 行、不占间隙；每条选择器都带 `body` 属性，因此压过宿主外壳提供的单类名规则。没有任何组件订阅 `theme/change`，一次主题切换只花一次样式重算，不触发重渲染。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当品牌面不够用时阅读以下页面。它们从本包占据的插槽进入渲染这些插槽的外壳。

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明 `sidebar.brand.mark` 与 `sidebar.brand.name` 并渲染其回退。
- [ui-conversation](../ui-conversation/README.zh.md)——在首屏声明 `conversation.hero.brand.mark` 与 `conversation.hero.welcome`。
- [Web 客户端架构](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.zh.md)——浏览器插件行如何加载并注册 slot。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了发布者品牌呈现的供给方式。它们是当前包约束，不是品牌设计对比或任务积压。

- **品牌在构建期定死**——发布者身份、文案、颜色与 logo 已内联；运行期没有任何面可以改变它们。
- **只有一组填充**——替代呈现属于占据相同插槽的另一个 Cordis 包。
- **浏览器标题独立**——`DSH_CLIENT_TITLE` 在构建时选择标题文本，而非通过 UI slot。
- **配色切换跟随主题属性而非主题服务**——宿主外壳若不渲染 `data-ds-dark-theme` 属性，两种主题下都会显示浅色版标志。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。本包不保留可变状态，四个 slot occupant 通过两个事务性 effect 安装和释放。
