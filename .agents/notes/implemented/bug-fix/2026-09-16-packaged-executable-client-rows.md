# Agent Note: Client rows resolve through a packaged executable's module proxies

Status: implemented

English | [中文](2026-09-16-packaged-executable-client-rows.zh.md)

## Problem

A portable distribution's packaged Runtime served the browser an empty boot graph. `globalThis["__DSH_BOOT__"]` carried no entries, and the page failed before any plugin ran with `client-modules: HTML did not preload @deepseek-ai/dsh-client-modules/client.js`. The same tree launched from source composed 49 entries. Nothing failed loudly: an empty composition is a valid composition, so the registry published it and the browser was the first component to object.

[Profile plugin bundles](../architecture/2026-08-05-profile-plugin-bundles.md) records why the layout differs. A packaged executable cannot point an operating-system link into pkg's virtual filesystem, so the installation fallback writes real proxy packages: a generated manifest whose `dsh.moduleFallback.targets` names the virtual module URLs it stands in for, plus one `entry-N.js` re-export shim per target. Client-module resolution classified a row from the nearest `package.json` above the module URL the Loader resolved — its `dsh.client` declaration and its `exports["./client"]` bundle. For a proxy that nearest manifest is the generated one, which declares no `dsh.client` and whose `exports["./client"]` names a re-export shim rather than a plugin factory. Every proxied package was therefore classified as having no browser half, the modules row included, and the graph the host injected was empty.

## Decision

`ClientModuleRegistry` follows a redirect-only manifest to the package it stands in for. `moduleProxyTarget(manifest)` reads the proxy's own `dsh.moduleFallback.targets` record and returns the package-root target; `nearestPackage` restarts its manifest walk at that URL, bounded at four redirects, and classifies the row from the manifest it reaches. The `dsh.client` declaration and the `./client` bundle path are both read there, so the row is served the real bundle the executable holds rather than the proxy's shim.

The redirect bound exists because a proxy's targets are generated content the registry does not own: a cycle leaves the package unclassified instead of looping. The negative verdict is cached per Loader specifier and owning-tree base URL like any other, so a bound that was reached is not re-walked on every flush.

Source launches are unaffected. They resolve to real manifests, `moduleProxyTarget` returns undefined on the first candidate, and the walk keeps its original shape.

## Alternatives considered

**Write `dsh.client` into the generated proxy manifest.** The proxy is generated from the package it stands in for, so copying one declaration into it duplicates an authority that then drifts whenever the real package changes and the proxy is not regenerated. The targets already name the real package, so the declaration can be read where it is authored.

**Point the proxy's `exports["./client"]` at the real bundle by relative climbing.** This addresses only the served bytes, not the classification: a proxy that carries no `dsh.client` still composes no row, so the climb would never be requested. It would also put a second copy of the real package's export map into generated content.

**Make the fallback write operating-system links instead of proxies.** The carrier cannot: pkg's virtual filesystem has no path an operating-system link can name. This is the constraint [Profile plugin bundles](../architecture/2026-08-05-profile-plugin-bundles.md) already settled, so it was not a candidate.

**Reject proxied packages outright.** Every browser plugin in a packaged distribution is proxied, so this rejects the whole client rather than the defect.

## Consequences

The packaged Runtime composes and serves the branded client: after the fix the same distribution reports 49 entries and 2 batches, and both inlined product logos and the palette-switch rule reach the browser.

The registry now reads a field the public manifest schema deliberately does not expose. [package-manifest](../../../../packages/util/package-manifest/README.md) names client modules among `moduleFallback`'s readers.

The defect was present from the moment the proxy fallback shipped and no test covered it. Every existing resolution test built a development file layout, where packages are real directories, so the proxy layer was never exercised. `packages/client/modules/tests/node-half.client.spec.ts` now writes a proxy fixture and covers classification through a proxy, the served bundle bytes, resolution through the owning tree's Loader, and the redirect bound.
