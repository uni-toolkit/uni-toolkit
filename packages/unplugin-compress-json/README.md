# @uni_toolkit/unplugin-compress-json

一个用于压缩 JSON 文件的 unplugin 插件，支持 Vite 和 Webpack。

## 功能特性

- 🗜️ **自动压缩** - 自动移除 JSON 文件中的空白字符和换行符
- 🔧 **多构建工具支持** - 支持 Vite、Webpack、Rollup 等构建工具
- ⚡ **零配置** - 开箱即用，默认仅在生产环境启用
- 🎯 **精确匹配** - 只处理 `.json` 文件，不影响其他资源
- 🌍 **环境控制** - 支持配置在开发环境、生产环境或所有环境下启用

## 安装

```bash
# npm
npm install @uni_toolkit/unplugin-compress-json -D

# yarn
yarn add @uni_toolkit/unplugin-compress-json -D

# pnpm
pnpm add @uni_toolkit/unplugin-compress-json -D
```

## 使用方法

### Vite

```ts
// vite.config.js
import { defineConfig } from 'vite'
import CompressJson from '@uni_toolkit/unplugin-compress-json/vite'

export default defineConfig({
  plugins: [
    CompressJson(), // 默认仅在生产环境启用
    // 或者自定义配置
    // CompressJson({ mode: 'all' }), // 在所有环境下都启用
    // CompressJson({ mode: 'development' }), // 仅在开发环境启用
  ],
})
```

### Vue CLI

```ts
// vue.config.js
const CompressJson = require('@uni_toolkit/unplugin-compress-json/webpack')

module.exports = {
  configureWebpack: {
    plugins: [
      CompressJson(), // 默认仅在生产环境启用
      // 或者自定义配置
      // CompressJson({ mode: 'all' }), // 在所有环境下都启用
    ],
  },
}
```

## 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `mode` | `'development' \| 'production' \| 'all'` | `'production'` | 控制插件在哪些环境下启用 |

### mode 选项说明

- `'development'`: 仅在开发环境启用（`NODE_ENV === 'development'`）
- `'production'`: 仅在生产环境启用（`NODE_ENV === 'production'`）
- `'all'`: 在所有环境下都启用

## 工作原理

插件会在构建过程中自动检测所有 `.json` 文件，并移除其中的：
- 空格
- 制表符
- 换行符
- 其他空白字符

**压缩前：**
```json
{
  "name": "example",
  "version": "1.0.0",
  "description": "这是一个示例"
}
```

**压缩后：**
```json
{"name":"example","version":"1.0.0","description":"这是一个示例"}
```

## 注意事项

- 插件只处理构建输出中的 `.json` 文件
- 不会修改源代码文件
- 默认仅在生产环境启用，避免开发时的不必要处理
- 可以通过 `mode` 选项灵活控制启用环境

## License

[MIT](/LICENSE)
