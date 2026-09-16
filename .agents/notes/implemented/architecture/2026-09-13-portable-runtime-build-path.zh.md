# Agent Note: Portable Runtime build path

Status: implemented

[English](2026-09-13-portable-runtime-build-path.md) | 中文

## Problem

[便携产品元数据与 SEA 载体](2026-09-11-portable-product-metadata-and-sea-carrier.zh.md) 已将 `@yao-pkg/pkg --sea` 固定为 v1 Windows x64 载体，并记录了实测的载体对比；但它所实测的那个载体，任何持有产品元数据的人都无法从仓库复现。仓库中唯一能产出 SEA 可执行文件的命令 `scripts/build-exe-for-python-sdk.ts` 是以 official 客户端 profile 打包 Python wheel 的 runtime，并写入 wheel 自己的 staging 闭包；而 `apps/portable/scripts/compare-carriers.ts` 只接受已经存在的可执行文件。于是发行版可以声明其产品身份与载体选择，而仓库中没有任何命令能产出这些声明所描述的 Runtime——第一个里程碑因此依赖于一份产物，而不是一次构建。

## Decision

`pnpm run build:portable-runtime --root <绝对 staging> --out <绝对目录>` 构建便携发行版所携带的 Windows x64 Runtime，输入为一份检出加一个包含已校验 `product.yml` 的 staging 根目录。`scripts/build-portable-runtime.ts` 即该命令，也是唯一的复现路径。

### 输入与产出

输入为绝对 staging 根目录、绝对输出目录，以及检出本身：锁定的依赖闭包、为目标声明可执行文件名的 `python/sdk-runtime/platforms.json`，和根 `devDependencies` 中的 `@yao-pkg/pkg`。

产出全部位于输出目录内：SEA 可执行文件、其 `-rg.exe` ripgrep sidecar，以及 `runtime-build.json`。记录包含 schema 版本、产品 id 与版本、完整 40 位上游修订号、`win32/x64` 目标及其 pkg 与 Node 固定版本、客户端构建 profile、`@yao-pkg/pkg` 的声明版本与实装版本，以及每个产出文件的字节数与 SHA-256。命令在报告成功前先写入并回读该记录。

### 版本固定

目标固定为 `node24-win-x64`。Node 范围来自该三元组，pkg 版本来自锁定的根清单，客户端构建环境来自 staging 根目录的已校验元数据，经 `product` 客户端构建 profile 得到。由于记录覆盖上述全部内容，发行版能够准确说明产出其 Runtime 的输入，而不是仅凭产品版本暗示。

### 复用的 SEA 流水线

`scripts/build-exe-for-python-sdk.ts` 导出 `Target`、`BuildCli` 与 `SingleExeBuild`，且 `SingleExeBuild` 接受 `SingleExeBuildRoots` 覆盖其部署暂存目录与产物输出目录。便携命令以 `.dsh-build/portable-runtime/win-x64/closure` 作为便携专用暂存根、`dist-exe/portable-runtime` 作为产物目录来构造该流水线，因此部署、hoist 还原、链接实体化与打包逻辑只存在一份，而两个产品各自保有独立闭包。

Runtime 内嵌的品牌化客户端构建，与 `build:product` 所拥有的根构建是同一次。`scripts/build-product.ts` 导出 `PRODUCT_CLIENT_BUILD_PROFILE`、`publisherEnvironment` 与 `portableProductIdentity`；便携命令经与 `client-env` 相同的已校验 CLI 桥梁读取产品身份，并以 `product` 客户端环境运行 `runRootBuild`，再以 `--skip-build` 打包。产品元数据因此只有一份解析实现，而启动器构建期的身份内联读取的正是该实现的产物。

`scripts/build-exe-for-python-sdk.ts` 仅在 `import.meta.main` 下执行，因此导入其类不会运行 Python wheel 的构建。

## Alternatives considered

**在 `apps/portable` 内另写一套 SEA 流水线。** pkg 调用方式、资产 glob、legacy hoist 还原与链接实体化编码了来之不易的打包行为。第二份副本会与已固定的路径产生漂移，并重开载体笔记已经封定的决定。

**复用 Python wheel 的 staging 根目录。** `pnpm deploy` 会清空其暂存目录。使用 wheel 根目录的便携构建会以品牌化产物替换 wheel 的暂存闭包，使 wheel 携带产品品牌。两者必须分开，这不是整洁问题而是必须。

**让启动器构建 Runtime。** 启动器交付给用户并启动应用；一个还要运行 `pnpm` 的启动器需要仓库在场，并会把发行版的字节变成只在构建机上可复现的东西。

**用 Node 自带的 `--experimental-sea-config` 构建 SEA 可执行文件。** Cordis 插件树在 Windows 上所需的资产与虚拟文件系统行为，pkg 已经实现。切换载体等于在没有新证据的情况下重开已固定的 v1 载体决定。

**只记录可执行文件摘要。** 缺少客户端构建 profile 与 pkg 固定版本时，发行版只能证明文件的相等性，无法说明它由何产出。当同一产品版本的两个构建彼此不同，记录是唯一能说明原因的东西。

## Consequences

第一个里程碑现在可复现：一条有文档的命令把已校验 staging 根目录变成发行版所携带的 Runtime，载体样机再端到端复验结果。`apps/portable/README.md` 是该命令、其输入、产出与固定版本的操作参考。

便携命令新增两个仓库内根目录 `.dsh-build/` 与 `dist-exe/`（均已在忽略列表中），并且必须在打包前执行完整客户端构建；`--skip-build` 存在的前提是这些产物已对应当前 staging 根目录的元数据，它不是打包另一产品产物的受支持方式。Runtime 文件是发行版封装的输入，封装会以 `runtime` 角色记录它们；本次变更不封装任何发行版，也不写入介质。
