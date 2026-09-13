---
description: "消费者浏览器面 bundle：在 dsh-web-app 之上叠加发布者品牌，并去掉插件与 Cordis 等开发面控件，面向已发布的消费者产物。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-consumer-web

[English](README.md) | 中文

## 概述

消费者 Web 面 = `dsh-web-app` + 发布者品牌 − 开发面控件：它在 web roster 之上叠加 `@deepseek-ai/dsh-client-ui-brand-product`，并禁用插件管理、Cordis 配置、HMR、实验性 Cordis 等对已发布消费者产物无用的行。通过 `consumer` profile（`dsh-base` → `dsh-web-app` → `dsh-consumer-web`）组合使用；你通常不会直接改动此 bundle。它不含运行时代码——其实质是一份 patch 文档。

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

以 `product` 客户端构建运行内置 `consumer` profile，界面即呈现发布者品牌。品牌填充以 `DSH_CLIENT_BUILD_PROFILE === 'product'` 自门控；无该 profile 时品牌插槽保留其声明外壳的回退，被禁用的开发面行无论何时都保持关闭。

### 它相对 web 面改变了什么

本 bundle 插入 `ui-brand-product`，以发布者在构建期定死的标题、logo、欢迎语与强调色占据侧栏标志与名称插槽、会话首屏标志与欢迎插槽。它禁用七行开发面控件——`plugin-inventory`、`cordis-host-runner`、`cordis-client-runner`、`client-hmr`、`ui-settings-plugin-inventory`、`ui-settings-plugins`、`ui-cordis`——因此设置面保留对话、项目、历史、工具调用呈现、模型与凭据设置及必要偏好，而不含插件与 Cordis 编辑面。

### 替换品牌

使用其他身份的部署组合另一个占据相同品牌插槽的包，或修改构建编排校验的 `product.yml`。参见 [ui-brand-product 参考](../../client/ui-brand-product/README.zh.md) 了解构建期取值契约。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本 bundle 是一份套在 `dsh-web-app` 层之上的静态 patch 文档。它不挂载服务、不发出事件、不保留可变状态；每个具名行的包拥有该行的行为与不变式。

### 组合机制

patch 会替换目标行的整个 `config` 而非合并；`disabled: true` 行只把该行从 active 集合移除，而其 id 仍归 `dsh-web-app` 层所有。`insert` 与 `disable` 清单逐行写在 [`cordis.patch.yml`](cordis.patch.yml) 中。

### 源码映射

| 文件 | 作用 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | bundle 本体：品牌 insert 与开发面 disable，附逐行理由注释 |
| [`src/index.ts`](src/index.ts) | 包入口；不含运行时 API |
| — | 不发布运行时不变式伴生入口；本包是静态 patch-list 载体。 |
| [`tests/consumer-web.spec.ts`](tests/consumer-web.spec.ts) | manifest 声明与 patch 内容校验 |

### 不变式归属

本包不发布不变式伴生入口，因为它是静态 patch-list 载体：被插入的品牌行与被禁用行各自的拥有包分别携带自身不变式，bundle 无可检查的可变关系。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

想深入了解品牌契约或 profile 分层时阅读以下页面。

- [ui-brand-product](../../client/ui-brand-product/README.zh.md) —— 发布者品牌填充及其构建期取值契约。
- [app-boot profile 一节](../../boot/app-boot/README.zh.md) —— profile 如何解析、分层与定制。
- [Bundle 包地图](../README.zh.md) —— 构建在 dsh 核心之上的各面。

-----

<a id="model-experience"></a>
## 模型体验

间接地，经由每个被插入或被禁用行的包——该包拥有该行的模型面行为；品牌行是浏览器呈现，被禁用的行是模型无关的开发面。

#### KV Cache 影响

本 bundle 自身不添加请求前缀；它插入或禁用的每一行都模型无关。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制说明消费者面何时需要额外关注、覆写该落在何处。它们是当前包约束，不是一般对比或任务积压。

- **品牌在构建期定死** —— 发布者身份、文案、颜色与 logo 由 `product` 客户端构建内联；运行期没有任何面可以改变它们。
- **开发面是隐藏而非删除** —— 被禁用的行仍保持安装以便 profile 解析，但不再出现在 active 集合中。
- **品牌行在 `product` 构建 profile 之外不生效** —— 未以 `product` 构建的 consumer profile 保留官方品牌或声明外壳的回退。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
