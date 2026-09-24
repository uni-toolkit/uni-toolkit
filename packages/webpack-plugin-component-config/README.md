# @uni_toolkit/webpack-plugin-component-config

一个用于 UniApp 项目的 Webpack 插件，用于处理 Vue 文件中的 `<component-config>` 标签，将配置提取并合并到对应的 `小程序 JSON 文件` 中。

> [!IMPORTANT]
> 从 `0.4.0` 起，`<component-config>` 的 JSON 内容不再支持条件编译。整个 `<component-config>` 仍可在外层使用 `#ifdef MP` 包裹；需要区分具体小程序平台时，请使用顶层 `mp-*` 配置。

## 功能特性

- 🎯 **配置提取**：从 Vue 文件的 `<component-config>` 标签中提取 JSON 配置
- 🔄 **自动合并**：将提取的配置自动合并到对应的 JSON 文件中
- 🎨 **文件过滤**：支持自定义文件匹配规则
- 🔀 **平台配置**：支持通过 `mp-*` 键声明特定小程序平台的配置
- 🚀 **小程序优化**：专为小程序环境设计，只在小程序平台下生效
- 📦 **零侵入**：不修改原始 Vue 文件，保持代码完整性

## 安装

```bash
npm install @uni_toolkit/webpack-plugin-component-config -D
# 或
pnpm add @uni_toolkit/webpack-plugin-component-config -D
# 或
yarn add @uni_toolkit/webpack-plugin-component-config -D
```

## 使用方法

### 配置 vue.config.js

```javascript
const WebpackComponentConfigPlugin = require('@uni_toolkit/webpack-plugin-component-config').default;

module.exports = {
  configureWebpack: {
    plugins: [
      new WebpackComponentConfigPlugin()
    ]
  }
};
```

### 修改 Vue 文件

`<component-config>` 内容使用原生 `JSON.parse` 解析，必须是严格 JSON，内部不能包含条件编译指令。可以像下面这样在整个标签外层使用 `#ifdef MP`。

```vue
// custom-component.vue
<template>
  <view class="container">
    <text>Hello World</text>
    <test></test>
  </view>
</template>

<script>
import test from '../sub1/test' // 引入子包中的vue组件
export default {
  name: 'MyComponent',
  components: {
    test
  }
}
</script>

// #ifdef MP
<component-config>
{
  "styleIsolation": "apply-shared",
  "componentPlaceholder": {
    "test": "view"
  }
}
</component-config>
// #endif
```

需要区分平台时，请在顶层使用平台键声明专属配置；当前平台配置会合并到通用配置中，其他平台配置不会写入产物：

```json
{
  "x": 1,
  "mp-weixin": { "y": 2 },
  "mp-alipay": { "z": 3 }
}
```

编译到 `mp-weixin` 时得到 `{ "x": 1, "y": 2 }`，编译到 `mp-alipay` 时得到 `{ "x": 1, "z": 3 }`，其他小程序平台只得到 `{ "x": 1 }`。

编译到小程序端生成的 `JSON 文件` 如下所示

```json
{
  "component": true,
  "usingComponents": {
    "test": "../sub1/test"
  },
  "styleIsolation": "apply-shared",
  "componentPlaceholder": {
    "test": "view"
  }
}
```

## 配置选项

```typescript
interface ComponentConfigPluginOptions {
  include?: FilterPattern;  // 包含的文件模式，默认: ["**/*.{vue,nvue}"]
  exclude?: FilterPattern;  // 排除的文件模式，默认: []
  replaceSameKey?: boolean; // 开启后同名 key 直接用 component-config 覆盖 JSON，默认: false
}
```

> `replaceSameKey` 开启后，最终写回时使用浅合并策略：`{ ...json, ...config }`。
> 适合 `usingComponents`、数组、空对象这类同名字段需要整体替换的场景。

## 注意事项

1. **平台限制**：插件只在小程序环境下生效
2. **JSON 格式**：`<component-config>` 标签内必须是严格 JSON，不支持注释、尾逗号、单引号等 JavaScript 扩展语法

## 许可证

[MIT](/LICENSE)
