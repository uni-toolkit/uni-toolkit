# @uni_toolkit/vite-plugin-component-insight

一个用于 uni-app Vue3 项目的 Vite 插件，用于分析组件被哪些页面使用、使用了多少次，并结合主包与分包关系在控制台输出建议。

## 功能特性

- 分析组件被哪些页面使用
- 基于构建产物中的 usingComponents 统计组件依赖次数，包含嵌套组件链路
- 结合主包和分包信息生成建议
- 默认在控制台直接输出分析结果和建议
- 按需输出 Markdown 报告，便于归档和二次处理
- 兼容 uni-app Vue3 小程序构建流程，支持 easycom 解析结果

## 安装

```bash
npm install @uni_toolkit/vite-plugin-component-insight -D
# 或
pnpm add @uni_toolkit/vite-plugin-component-insight -D
# 或
yarn add @uni_toolkit/vite-plugin-component-insight -D
```

## 使用方法

```ts
import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import componentInsight from '@uni_toolkit/vite-plugin-component-insight';

export default defineConfig({
  plugins: [
    uni(),
    componentInsight(),
  ],
});
```

插件默认不会生成文件，会在控制台直接输出分析结果和建议。

如果需要输出 Markdown，可以这样配置：

```ts
componentInsight({
  reportMarkdownPath: 'logs/component-insight-report.md',
})
```

如果只想生成 Markdown、不输出控制台，可以这样配置：

```ts
componentInsight({
  logToConsole: false,
  reportMarkdownPath: 'logs/component-insight-report.md',
})
```

## 配置项

```ts
interface VitePluginComponentInsightOptions {
  reportMarkdownPath?: string;
  logToConsole?: boolean;
  exclude?: string[];
  include?: string[];
}
```

- reportMarkdownPath: 自定义 Markdown 报告输出路径，不传则不生成 Markdown
- logToConsole: 是否输出控制台日志，默认开启
- exclude: 指定过滤的文件，默认过滤  node_modules 和 uni_modules
- include: 指定包含的文件, 默认为空

## 许可证

[MIT](/LICENSE)