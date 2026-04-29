# uni-app toolkit

为 uni-app 项目设计的插件集合，提供各种实用的构建工具和开发插件。

## 📦 插件列表

| 插件 | 适用环境 | 说明 | 文档 |
| --- | --- | --- | --- |
| `@uni_toolkit/vite-plugin-component-insight` | Vite | 分析组件被哪些页面使用、使用多少次，并结合主包与分包关系给出优化建议。 | [查看文档](./packages/vite-plugin-component-insight/README.md) |
| `@uni_toolkit/webpack-plugin-component-insight` | Webpack | 分析组件被哪些页面使用、使用多少次，并结合主包与分包关系在控制台输出优化建议。 | [查看文档](./packages/webpack-plugin-component-insight/README.md) |
| `@uni_toolkit/vite-plugin-component-config` | Vite | 处理 Vue 文件中的 `<component-config>` 标签，将配置提取并合并到对应的小程序 JSON 文件中，可用于跨分包自定义组件引用和组件引用插件。 | [查看文档](./packages/vite-plugin-component-config/README.md) |
| `@uni_toolkit/webpack-plugin-component-config` | Webpack | 处理 Vue 文件中的 `<component-config>` 标签，将配置提取并合并到对应的小程序 JSON 文件中，可用于跨分包自定义组件引用和组件引用插件。 | [查看文档](./packages/webpack-plugin-component-config/README.md) |
| `@uni_toolkit/unplugin-compress-json` | Vite / Webpack | 压缩 JSON 文件，减小文件体积。 | [查看文档](./packages/unplugin-compress-json/README.md) |
| `@uni_toolkit/unplugin-json-optimization` | Vite | 优化分包 JSON 文件生成，减小主包体积。 | [查看文档](./packages/unplugin-json-optimization/README.md) |

## 贡献者

感谢这些贡献者对本仓库的支持与完善：

[![贡献者](https://contrib.rocks/image?repo=uni-toolkit/uni-toolkit)](https://github.com/uni-toolkit/uni-toolkit/graphs/contributors)

## 交流群

扫码加入 uni-app 交流群

![uni-app 交流群](./assets/group.png)

## 📄 许可证

[MIT](LICENSE)
