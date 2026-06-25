# @uni_toolkit/vite-plugin-sourcemap-pro

一个用于 Vite / uni-app 项目的 sourcemap 强制关闭插件。插件会在构建配置、Rollup 输出配置以及插件 hook 执行过程中尽量关闭或移除 sourcemap，适用于需要彻底禁用 sourcemap 的场景。

> [!TIP]
> 该插件对所有端生效，包括 H5、App、小程序等平台。推荐仅在开发环境下按需使用，避免影响生产构建链路中的排查能力。

## 功能特性

- 所有端生效，不限制 `UNI_PLATFORM`
- 强制关闭 `build.sourcemap`
- 强制关闭 `css.devSourcemap`
- 强制关闭 `esbuild.sourcemap`
- 强制设置 Rollup 输出 `sourcemap: false`

## 安装

```bash
npm install @uni_toolkit/vite-plugin-sourcemap-pro -D
# 或
pnpm add @uni_toolkit/vite-plugin-sourcemap-pro -D
# 或
yarn add @uni_toolkit/vite-plugin-sourcemap-pro -D
```

## 使用方法

推荐只在开发环境下启用：

```ts
import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import killPluginSourcemaps from '@uni_toolkit/vite-plugin-sourcemap-pro';

export default defineConfig({
  plugins: [
    process.env.NODE_ENV === 'development' && killPluginSourcemaps(), // 此插件需要放在 uni 之前调用
    uni(),
  ],
});
```

也可以使用命名导出：

```ts
import { killPluginSourcemaps } from '@uni_toolkit/vite-plugin-sourcemap-pro';
```

## 许可证

[MIT](/LICENSE)
