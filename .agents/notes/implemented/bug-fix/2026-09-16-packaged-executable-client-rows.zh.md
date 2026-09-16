# Agent Note: 客户端 row 穿过打包可执行文件的模块代理解析

Status: implemented

[English](2026-09-16-packaged-executable-client-rows.md) | 中文

## 问题

便携发行目录里那个打包后的 Runtime 给浏览器提供的是一张空的启动图。`globalThis["__DSH_BOOT__"]` 里没有任何 entry，页面在任何插件运行之前就以 `client-modules: HTML did not preload @deepseek-ai/dsh-client-modules/client.js` 失败。同一棵树从源码启动则组合出 49 个 entry。没有任何东西大声失败：空组合也是一份合法的组合，于是登记表把它发布了出去，而第一个提出异议的组件是浏览器。

[Profile 插件 bundle](../architecture/2026-08-05-profile-plugin-bundles.zh.md) 记录了布局为何不同。打包可执行文件无法把操作系统链接指向 pkg 的虚拟文件系统，因此安装回退路径写出的是真正的代理包：一份生成的 manifest，其 `dsh.moduleFallback.targets` 给出它所代表的那些虚拟模块 URL，外加每个目标一个 `entry-N.js` re-export 壳。客户端模块解析则从 Loader 解析出的模块 URL 之上最近的那份 `package.json` 来归类一个 row——读它的 `dsh.client` 声明与 `exports["./client"]` bundle。对代理而言，那份最近的 manifest 就是生成出来的那一份，它不声明 `dsh.client`，其 `exports["./client"]` 指向的是一个 re-export 壳而不是插件工厂。于是每个被代理的包都被判为没有浏览器半侧——引导件自己那一行也不例外——宿主注入的图因此为空。

## 决定

`ClientModuleRegistry` 会跟随纯重定向的 manifest 走到它所代表的那个包。`moduleProxyTarget(manifest)` 读取代理自身的 `dsh.moduleFallback.targets` 记录并返回包根目标；`nearestPackage` 从该 URL 重新开始它的 manifest 向上查找，最多跟随四跳，并用它抵达的那份 manifest 归类该 row。`dsh.client` 声明与 `./client` bundle 路径都在那里读取，因此该 row 拿到的是可执行文件持有的真实 bundle，而不是代理的壳。

跳数上限存在，是因为代理的目标是登记表并不拥有的生成内容：成环只会让该包不被归类，而不会打转。否定结论与其他结论一样，按 Loader specifier 与所属 tree base URL 缓存，因此触达上限这件事不会在每次 flush 时被重新走一遍。

源码启动不受影响。它们解析到的是真实 manifest，`moduleProxyTarget` 在第一个候选上就返回 undefined，整个查找保持原样。

## 考虑过的替代方案

**把 `dsh.client` 写进生成的代理 manifest。** 代理是从它所代表的包生成的，把一份声明拷进去就是复制了一份权威，而真实包变更、代理却没有重新生成时两者就会漂移。目标里已经写着真实的包，声明可以在它被撰写的地方读取。

**用相对路径爬升把代理的 `exports["./client"]` 指向真实 bundle。** 这只解决提供出去的字节，不解决归类：一个不携带 `dsh.client` 的代理仍然组合不出 row，因此那次爬升永远不会被请求。它还会把真实包导出表的第二份副本塞进生成内容。

**让回退路径改写操作系统链接而不是代理。** 载体做不到：pkg 的虚拟文件系统里没有任何操作系统链接能指名的路径。这是 [Profile 插件 bundle](../architecture/2026-08-05-profile-plugin-bundles.zh.md) 已经定下的约束，因此不构成候选。

**直接拒绝被代理的包。** 打包发行目录里的每个浏览器插件都是被代理的，所以这等于拒绝整个客户端，而不是拒绝这个缺陷。

## 后果

打包后的 Runtime 能组合并提供品牌化客户端：修复之后，同一份发行目录报告 49 个 entry 与 2 个 batch，两个内联产品 logo 与配色切换规则都到达浏览器。

登记表现在读取一个公共 manifest schema 刻意不暴露的字段。[package-manifest](../../../../packages/util/package-manifest/README.zh.md) 把客户端模块列为 `moduleFallback` 的读取方之一。

这个缺陷从代理回退路径落地那一刻就存在，而没有任何测试覆盖它。既有的解析测试全都搭在开发态文件布局上，那里的包是真实目录，代理层从未被走到。`packages/client/modules/tests/node-half.client.spec.ts` 现在会写出代理夹具，并覆盖穿过代理的归类、所提供 bundle 的字节、经所属 tree 的 Loader 解析，以及跳数上限。
