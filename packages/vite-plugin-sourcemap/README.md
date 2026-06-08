# @uni_toolkit/vite-plugin-sourcemap

一个用于 uni-app Vue3 小程序项目的 sourcemap 开关插件，可按 `NODE_ENV` 或在所有环境下开启 `build.sourcemap`。

## 特性

- 只在 `小程序` 平台生效
- 默认在开发环境开启 sourcemap，生产环境关闭 sourcemap
- 支持通过 `mode: 'all'` 在所有环境开启 sourcemap
- 支持 uni-app 和 uni-app-x

## 安装

```bash
npm install @uni_toolkit/vite-plugin-sourcemap -D
# 或
pnpm add @uni_toolkit/vite-plugin-sourcemap -D
# 或
yarn add @uni_toolkit/vite-plugin-sourcemap -D
```

## 使用方法

```ts
import { defineConfig } from 'vite';
import uni from "@dcloudio/vite-plugin-uni";
import sourcemap from '@uni_toolkit/vite-plugin-sourcemap';

export default defineConfig({
  plugins: [
    uni(),
    sourcemap(), // 插件需要放在 uni 插件后面，以确保正确覆盖 sourcemap 配置
  ],
});
```

默认在小程序平台下等价于：

```ts
export default defineConfig({
  // ...
  build: {
    sourcemap: process.env.NODE_ENV === 'development',
  },
});
```

## 配置项

```ts
interface VitePluginSourcemapOptions {
  mode?: 'development' | 'production' | 'all';
}
```

- `mode`: 指定在哪些环境下开启 sourcemap，默认 `development`
  - `development`: 仅当 `NODE_ENV=development` 时开启
  - `production`: 仅当 `NODE_ENV=production` 时开启
  - `all`: 所有环境都开启

示例：

```ts
import { defineConfig } from 'vite';
import uni from "@dcloudio/vite-plugin-uni";
import sourcemap from '@uni_toolkit/vite-plugin-sourcemap';

export default defineConfig({
  plugins: [
    uni(),
    sourcemap({
      mode: 'production',
    }), // 插件需要放在 uni 插件后面，以确保正确覆盖 sourcemap 配置
  ],
});
```

在所有环境开启 sourcemap：

```ts
import { defineConfig } from 'vite';
import uni from "@dcloudio/vite-plugin-uni";
import sourcemap from '@uni_toolkit/vite-plugin-sourcemap';

export default defineConfig({
  plugins: [
    uni(),
    sourcemap({
      mode: 'all',
    }), // 插件需要放在 uni 插件后面，以确保正确覆盖 sourcemap 配置
  ],
});
```

## 许可证

[MIT](/LICENSE)
