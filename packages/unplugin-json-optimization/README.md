# @uni_toolkit/unplugin-json-optimization

一个用于分包优化 JSON 文件生成的 unplugin 插件，支持 Vite。

> [!WARNING]
> 该包（`unplugin-json-optimization`）已废弃，不再维护。
>
> 建议将 JSON 文件手动处理为 JavaScript 文件

## 功能特性

- 🗜️ **自动优化产物** - 自动优化分包 JSON 文件的生成
- ⚡ **零配置** - 开箱即用
- 🎯 **精确匹配** - 只处理 `.json` 文件，不影响其他资源

## 安装

```bash
# npm
npm install @uni_toolkit/unplugin-json-optimization -D

# yarn
yarn add @uni_toolkit/unplugin-json-optimization -D

# pnpm
pnpm add @uni_toolkit/unplugin-json-optimization -D
```

## 使用方法

### Vite

```ts
// vite.config.js
import { defineConfig } from 'vite'
import uni from "@dcloudio/vite-plugin-uni"
import jsonOptimization from '@uni_toolkit/unplugin-json-optimization/vite'

export default defineConfig({
  plugins: [
    uni(),
    jsonOptimization(),
  ],
})
```

## 配置选项

```typescript
interface ComponentConfigPluginOptions {
  include?: FilterPattern;  // 包含的文件模式，默认: ["**/*.{vue,nvue,uvue}"]
  exclude?: FilterPattern;  // 排除的文件模式，默认: []
}
```

## License

[MIT](/LICENSE)
