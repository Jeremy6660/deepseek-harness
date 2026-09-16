# Agent Note: 品牌化产品构建入口

Status: implemented

[English](2026-09-13-product-branded-build-entry-point.md) | 中文

## 问题

品牌化客户端构建会内联 15 个来自已校验 `product.yml` 的 `DSH_CLIENT_*` 值。`scripts/client-build-environment.ts` 的 `product` profile 从进程环境读取这些值，缺失任何一个都会明确失败，但仓库里没有任何东西把它们放进去。`apps/portable` 已经提供 `client-env`，它把精确的 15 键对象以 JSON 打印到标准输出；[发布方品牌里程碑](../architecture/2026-09-12-publisher-branding-and-consumer-composition.zh.md)也把它记录为从已校验元数据通往品牌化构建的桥梁——但这座桥梁的另一端没有消费者。

缺口在于中间那一步：发布方必须读懂那段 JSON，再在自己的 shell 里把它重写成环境变量，然后才运行构建。这条说明无法跨 shell 移植、无法校验，把仓库命令变成了复制粘贴仪式。发布方若在 README 撰写时所用之外的 shell 上照做，最终得到的是一个只提缺少某个变量、却不提是哪一步丢掉了它的构建错误。

## 决策

`pnpm run build:product --root <绝对 staging 目录>` 执行由一份已校验便携 staging 根目录品牌化的完整客户端构建。发布方提供的是一份目录，而不是一套环境变量。

`scripts/build-product.ts` 拥有该入口。它要求绝对的 `--root`，通过 `tsx` 以源码方式运行 `client-env` 子命令向 `apps/portable` 索取发布方取值，经 `resolveClientBuildEnvironment(environment, 'product')` 解析后交给共享构建序列。它绝不重述 `product.yml` schema：便携 CLI 始终是该封闭 schema 到 `DSH_CLIENT_*` 的唯一映射，因此 schema 变更不会把构建入口落在后面。被产品 schema 拒绝的 staging 根目录会在任何构建阶段开始前，以 CLI 自有的 JSON 错误退出码 2 结束。

`scripts/build.ts` 导出 `runRootBuild(clientEnvironment, environment)`，即默认入口与 `--profile` 入口原本就在运行的序列。两个入口现在都调用它，因此发布方构建不可能悄悄跳过 `build:native-system`、`build:lib` 或 `build:web`。默认入口的可观察行为不变。

构建记录保持原有形状：product 构建写入 14 个发布方取值加上 `DSH_CLIENT_BUILD_PROFILE=product`，与 `official` 已有的键集对称性一致。

## 考虑过的替代方案

**在 `tsconfig.base.json` 中加一条 `@deepseek-ai/dsh-portable` 路径别名，直接 import 该映射。**这是最短路径，给出带类型、进程内、无子进程的调用。它失败的原因是：基础 `paths` 映射中每一条都指向 `packages/` 或 `vendor/`，而该 facade 是所有导入方（含 `scripts/`）的解析配置；第一条 `apps/` 条目会让一个应用工作区可以从任何地方当作库导入。改为生成已文档化的 CLI，在不开阔该 facade 的前提下保持了同一个单一事实来源。

**在 `scripts/` 内解析 `product.yml`。**这能完全去掉子进程，但它会复制一套严格 schema——拒绝未知字段、拒绝远程资产与路径遍历、校验 PNG——而 `apps/portable` 已经拥有并测试了这套 schema。同一封闭 schema 的两份解析器会漂移，而第二份恰好是守护已发布字节的那一份。

**给 `scripts/build.ts` 加 `--product-root` 开关，而不是新增文件。**一个入口同时服务两种情况，但开关形式在发布方忘记传参时无法失败。`pnpm run build:product` 不带参数会悄悄执行一次无品牌的默认构建，并写入一份看起来成功的记录。独立入口让缺失的根目录成为硬错误。

**保留已文档化的手动导出。**这是改动之前的状态。它在 README 撰写时所用的 shell 上可用，在其他地方不可用，并且让仓库自己 `client-env` 的输出不被仓库自己交付的任何东西消费。

## 后果

发布方路径现在是一条命令，`client-env` 桥梁有了消费者，因此 `scripts/build-product.spec.ts` 会一起检验这份契约的两端。

该入口在运行时通过源码路径而非包依赖依赖 `apps/portable`，因此它在 `tsx` 下从 `src` 运行 CLI。将来若移动该工作区的 CLI 入口，必须同步更新 `scripts/build-product.ts`；类型图不会捕捉到这一点。

product 构建会用发布方取值覆盖共享的、被 gitignore 的 `.dsh-build/client-build-environment.json` 记录，正如 `build:official` 已经会用官方取值覆盖它一样。此后若 built Web 测试或 release 打包期望仓库自身的环境，必须在发布方构建之后重新构建；目前没有任何东西能区分「该记录是一次 product 构建」与「该记录已过期」。

对发布方而言完整构建仍然端到端执行；只有环境变量的搬运被移除。品牌化构建仍是一次完整的 `build:native-system` 加 `build:lib` 加 `build:web`。
