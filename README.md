# uni-app toolkit

uni-app 项目设计的插件集合，提供各种实用的构建工具和开发插件。

## 📦 插件列表

### @uni_toolkit/vite-plugin-component-config

一个用于 uni-app 项目的 `Vite 插件`，用于处理 Vue 文件中的 `<component-config>` 标签，将配置提取并合并到对应的 `小程序 JSON 文件` 中 (可用于实现 `跨分包自定义组件引用`、组件引用 `插件`)。

- [@uni_toolkit/vite-plugin-component-config](./packages/vite-plugin-component-config/README.md)

### @uni_toolkit/webpack-plugin-component-config

一个用于 uni-app 项目的 `Webpack 插件`，用于处理 Vue 文件中的 `<component-config>` 标签，将配置提取并合并到对应的 `小程序 JSON 文件` 中 (可用于实现 `跨分包自定义组件引用`、组件引用 `插件`)。

- [@uni_toolkit/webpack-plugin-component-config](./packages/webpack-plugin-component-config/README.md)

### @uni_toolkit/unplugin-compress-json

一个用于压缩 JSON 文件的 `unplugin 插件`，支持 Vite 和 Webpack。自动压缩 `JSON 文件` ，减小文件体积。

- [@uni_toolkit/unplugin-compress-json](./packages/unplugin-compress-json/README.md)

### @uni_toolkit/unplugin-json-optimization

一个用于分包优化 JSON 文件生成的 unplugin 插件，支持 Vite 和 Webpack。自动优化分包 `JSON 文件` 生成，减小主包体积。

- [@uni_toolkit/unplugin-json-optimization](./packages/unplugin-json-optimization/README.md)

## 📄 许可证

[MIT](LICENSE)
