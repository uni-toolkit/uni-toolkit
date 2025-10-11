# @uni_toolkit/webpack-plugin-component-config

一个用于 UniApp 项目的 Webpack 插件，用于处理 Vue 文件中的 `<component-config>` 标签，将配置提取并合并到对应的 `小程序 JSON 文件` 中。

## 功能特性

- 🎯 **配置提取**：从 Vue 文件的 `<component-config>` 标签中提取 JSON 配置
- 🔄 **自动合并**：将提取的配置自动合并到对应的 JSON 文件中
- 🎨 **文件过滤**：支持自定义文件匹配规则
- 🚀 **小程序优化**：专为小程序环境设计，只在 `mp-` 平台下生效
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

```vue
<template>
  <view class="container">
    <text>Hello World</text>
  </view>
</template>

<script>
export default {
  name: 'MyComponent'
}
</script>

<component-config>
{
  "usingComponents": {
    "custom-button": "/components/custom-button"
  },
  "componentPlaceholder": {  
    "test": "view",  
  }  
}
</component-config>
```

## 配置选项

```typescript
interface ComponentConfigPluginOptions {
  include?: FilterPattern;  // 包含的文件模式，默认: ["**/*.{vue,nvue,uvue}"]
  exclude?: FilterPattern;  // 排除的文件模式，默认: []
}
```

## 注意事项

1. **平台限制**：插件只在小程序环境下生效
2. **JSON 格式**：`<component-config>` 标签内的内容必须是有效的 JSON 格式

## 许可证

MIT
