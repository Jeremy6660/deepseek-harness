# Agent Note：便携产品元数据与 SEA 载体

Status: implemented

[English](2026-09-11-portable-product-metadata-and-sea-carrier.md) | 中文

## 问题

提议中的[便携智能体实验盘产品](../../proposed/feature/2026-09-11-portable-agent-usb-product.zh.md)在开展 Launcher、品牌、安装、修复或介质写入之前，需要一个可信的构建边界。此前便携 staging 目录没有严格的产品身份、确定性的不可变文件清单、用户数据归属规则，也没有产品级证据证明现有运行时载体能在没有系统 Node.js 或 Python 的情况下承担 Windows x64 里程碑。

## 决策

仓库新增私有 `apps/portable` 工作区，负责产品配置校验、确定性封装、发行目录验证和载体对比。该工作区接入根构建与类型检查图，但不属于公开 release package 家族，也不提供面向消费者的 Launcher。

### 产品配置

`product.yml` 使用封闭的 v1 schema，记录稳定产品 ID、语义版本、英文与简体中文产品标题、发行方名称和售后声明、本地 PNG Logo、双语欢迎语、明暗模式十六进制主色、上游仓库、40 位 Git revision 和双语非官方产品归属声明。

校验会拒绝缺失和未知字段、自定义 YAML 标签、非法版本、revision 与颜色、非本地或越界资产、SVG 与远程资源、链接、内容不是 PNG 的 Logo，以及试图提供 HTML、CSS、脚本或事件处理器的配置。错误会指出配置路径和修正方向。

### 清单与归属

`manifest.json` v1 记录产品身份、上游 revision、`win32/x64` 目标，以及按路径排序、包含角色、字节数和 SHA-256 摘要的文件条目。角色只允许 `launcher`、`runtime`、`recovery`、`metadata`、`source`、`developer`、`documentation` 和 `license`。

封装只接受显式绝对 staging 根目录。路径策略拒绝绝对或越界形式、反斜杠、冒号、Windows 保留名、尾随点或空格、Unicode 规范化歧义、大小写不敏感冲突、链接、junction 和不支持的文件系统条目。`PortableData/**` 归用户所有，永不进入清单，在验证中被忽略并保留。实现不会发现、格式化或写入可移动介质。

`manifest.sha256` 是只覆盖 `manifest.json` 的一行标准 SHA-256。验证会计算所有清单归属文件的摘要，报告不可变区域中的额外文件，并以 `missing`、`modified`、`unexpected` 或 `unsupported-entry` 表示可恢复的内容问题；无效清单和危险路径会立即失败。相同输入会产生逐字节一致的 JSON 顺序和摘要。

### 威胁边界

校验和证明内容与受信清单一致，可检测意外或孤立的内容损坏。由于本里程碑不添加数字签名、更新服务、DRM 或外部信任根，因此不能抵御同时替换可执行内容与清单的攻击，也不能建立发行方身份。验证过程不会修复或删除内容。

### 载体证据

Windows x64 载体样机以空的可执行程序搜索路径、临时 `DSH_HOME`、临时缓存和用户配置根目录，将已经构建好的现有 `@yao-pkg/pkg --sea` 可执行文件作为 `dsh web --no-open --port 0` 启动。样机会确认系统 Node.js 和 Python 未参与运行、CLI 输出带认证信息的启动 URL、令牌交换和 Cookie 认证成功、根页面包含 Web 启动数据、JavaScript 与 CSS 资产可加载、关闭时 Host 生命周期已释放且退出码为 0，并且观察到的全部状态都位于临时 home。

仓库中的[载体证据](../../../../apps/portable/carrier-evidence.json)记录：SEA 可执行文件及必需的 `-rg.exe` sidecar 共 246,261,760 字节、2 个文件；同一台机器上的 Desktop 解包参考为 616,488,582 字节、11,734 个文件，并通过 Electron 壳启动。SEA 通过 `dsh web` 启动，修复单位为文件，因此被固定为 v1 载体。Desktop 继续作为确定性运行时文件树算法的参考，而不是备用产品壳。SEA 构建路径通过当前 Node 进程调用固定版本的 `@yao-pkg/pkg` 入口，避免封装过程改变仓库依赖布局；SDK runtime 也显式声明了运行时加载的 session-title 包。

Desktop 参考 smoke 现在校验当前预构建 `@deepseek-ai/node-addon-system` 的协议，不再校验已经移除的 `fs-ext` 构建布局。这使 [Desktop 捆绑运行时](2026-09-08-desktop-bundled-runtime-and-external-plugins.zh.md)行为与仓库实际封装的运行时保持一致。

## 备选方案

**v1 使用 Desktop Electron 壳。** 该样本的文件数和体积显著更大，并引入本里程碑不需要的壳。它仍适合作为文件树实现参考。

**SEA 样机失败时自动切换载体。** 载体失败会阻塞本里程碑；应修复并重新验证 SEA 构建路径，而不是静默改变产品架构。

**扫描并写入可移动磁盘。** 介质选择与制作存在破坏设备的风险，属于后续里程碑。本工作区只处理显式 staging 目录。

**允许远程或可编程品牌配置。** 远程资产以及任意 HTML、CSS 或脚本会扩大执行与隐私边界。v1 只接受有类型约束的文案、颜色和本地 PNG。

**把 SHA-256 当作发行方认证。** 未签名校验和没有独立信任锚。协议只描述相对于受信清单的完整性，不声称抵御协同替换。

## 后果

项目现在拥有一套确定且机器可读的产品身份、不可变归属和发行验证协议，以及 Windows x64 载体的可执行证据。聚焦测试覆盖恶意配置、路径安全、稳定序列化、Unicode 与空文件、归属排除、链接和所有验证结果；Desktop runtime-tree 回归覆盖继续保留。

本里程碑没有完成提议中的完整产品。消费者品牌、精简组合、Launcher、安装与卸载、修复、备份、凭据处理、介质制作、离线 DevKit 组装、签名和销售资格仍是产品提案下的后续工作。工作区 README 是已实现 CLI 与格式的操作参考。
