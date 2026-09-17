# Agent Note: Directory entry types come from lstat, not from Dirent predicates

Status: implemented

[English](2026-09-17-packaged-readdir-entry-types.md) | 中文

## Problem

打包后的可执行文件无法创建会话。服务器对 `session/create` 返回 `gateway/internal`，消息为 `TypeError: child.isDirectory is not a function`，发生在 profile 模块回退修复流程遍历某个 profile 自有的 `node_modules` 时。同一棵树从源码启动可以正常创建会话，因此该故障只存在于产品实际交付的载体中。

该载体是 pkg 基于虚拟文件系统的单文件可执行产物。在其中，`readdir` 与 `readdirSync` 返回的是条目的普通记录：记录带 `name`，但不带 `Dirent` 的判定方法。对这些记录调用 `entry.isDirectory()` 或 `entry.isSymbolicLink()` 会在运行期抛错，而这条代码路径能通过类型检查，也能通过所有从源码运行的测试。

[Portable Runtime build path](../../implemented/architecture/2026-09-13-portable-runtime-build-path.zh.md) 负责载体决策本身；本缺陷是该决策向调用方收的代价。已有一处调用点（`packages/preset/agent-presets/src/discovery.ts` 中的预设根扫描）正是因为这个原因改用 `lstat`。而 `packages/boot/app-boot/src/profile.ts` 中修复 profile 模块回退的流程没有改，它的 `ownedPackageNames` 扫描在每次创建会话的打包启动中都会走到那个会失败的调用。

## Decision

`ownedPackageNames` 用 `readdirSync(modulesDir)` 只取名称，并通过 `lstatSync` 解析每个条目的类型，因此它从不对 `readdir` 返回的值调用判定方法。条目的 `lstat` 报 ENOENT 时结果为 `undefined` 并按“不存在”处理：并发清理可能在列举与类型读取之间删除某个自有链接，这不算错误。

两个包管理器分支的含义未变。以 `@` 开头的目录会再向下走一层，把其下每个符号链接记为 `@scope/name`；其余条目在自身是符号链接时记入自己的名字。自有目录下的非链接条目仍被跳过而不是删除，因此该扫描不会移除启动器并不拥有的目录。

`packages/session/session-persistence-jsonl/src/index.ts` 无需改动。它有四处用 `withFileTypes` 读取条目，每处都只用 `entry.name`，没有对条目调用判定方法。

## Alternatives considered

**保留判定方法，改为规范化 readdir 结果。** 由一个共享辅助函数检查每个条目，只对不是真正 `Dirent` 实例的记录回退到 `lstat`。被否决的原因：它需要一个两个调用点都已依赖的包来安置，而且会让类型标注继续声称是 Dirent、运行期却不是——正是造成本缺陷的那种不一致仍可被写出来。两个调用点不足以支撑一个新的共享包。

**给每个判定方法调用加运行期检查。** 在每处写成 `entry.isDirectory?.() ?? …`，是用分散的绕行换取修复，并且让下一位作者仍可自由地再写出未加保护的调用。

**引入 glob 依赖来枚举目录。** 一个受维护的遍历器能去掉手写的枚举，但会增加一个依赖，并在这些包里已有的目录遍历之外再加第二套实现。

## Consequences

打包后的 profile 扫描不再依赖 `Dirent` 实例，因此在产品交付的载体上，会触发模块回退修复的启动可以创建会话。

条目类型现在由每个条目一次 `lstat` 得到，而不再随列举结果一并返回。被遍历的目录是单个 profile 自己的模块根，条目数为数十，且该扫描本来每次启动只跑一次。

该缺陷只能从打包后的可执行文件触达，而 agent 沙箱无法启动它：打包启动器会继承被阻断的网络并在 `realpath` 上失败，所以沙箱里的结果不能作为任何一方的证据。在本地钉住该行为的是 `packages/boot/app-boot/tests/profile.spec.ts` 中断言自有目录下的嵌套非链接条目在一次修复后仍然存在（该断言会走到 `lstat` 分支），以及此前上报的 `session/create` 失败本身。确认载体已恢复正常需要在正常桌面会话中进行。
