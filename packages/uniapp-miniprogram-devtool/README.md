# uniapp-miniprogram-devtool

一个用于调试 `uni-app` / `uni-app x` 编译到微信小程序产物的运行时变量观察工具。

`uni-app` / `uni-app x` 在编译微信小程序时，会把模板返回值里的 key 压缩成 `a`、`b`、`c` 这类短字段。例如源码里写的是：

```ts
const message = ref('测试')
const count = ref(1)
```

编译产物里可能变成：

```js
const __returned__ = {
  a: common_vendor.t(common_vendor.unref(message)),
  b: common_vendor.t(common_vendor.unref(count))
}
```

这个工具会读取编译产物和 sourcemap，推断出：

```txt
a -> message
b -> count
```

然后通过微信开发者工具 automator 读取当前页面运行时 `page.data`，在 Web Panel 中展示最新值。

## 特性

- 不修改 `app.js`、页面 JS、WXML 等编译产物。
- 读取页面 JS、WXML、sourcemap，分析 `a/b/c` 到源码变量的映射关系。
- 通过微信开发者工具 automator 读取运行时 `page.data`。
- 默认启动 Web Panel，展示当前页面变量值。
- 支持过滤、手动刷新、值变化高亮、Debug 面板。

## 注意事项

- `manifest.json` 里需要配置合适的 `appid`，以避免微信开发者工具连接失败
- 使用此工具前，请先推出微信开发者工具，确保它没有在后台运行
- 需要开启微信开发者工具的服务端口，以便 `automator` 能够连接

## 安装

```bash
pnpm add -D uniapp-miniprogram-devtool
```

或者直接临时执行：

```bash
pnpm dlx uniapp-miniprogram-devtool \
  ./unpackage/dist/dev/mp-weixin \
  -w /Volumes/Elements/Applications/wechatwebdevtools.app
```

## 快速开始

`mp-weixin` 产物目录和微信开发者工具路径都是必填参数。产物目录可以直接作为第一个参数传入，也可以用 `-p`；微信开发者工具路径推荐用 `-w`。

### 配置项

| 配置 | 缩写 / 别名 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `mp-weixin` 产物目录 | 位置参数、`-p`、`--proj`、`--project` | 是 | - | `uni-app` / `uni-app x` 的微信小程序编译产物目录，一般是 `unpackage/dist/dev/mp-weixin` |
| 微信开发者工具路径 | `-w`、`--wd`、`--wechat-devtools` | 是 | - | 微信开发者工具 `.app` 路径；工具会自动解析到 `Contents/MacOS/cli` |
| 微信开发者工具 CLI 路径 | `--cli-path` | 否 | - | 如果已经拿到 `cli` 二进制路径，可以用它替代 `-w` |
| Web Panel 端口 | `--port` | 否 | `17890` | 本地 Web Panel 端口；如果被占用会自动尝试后续端口 |
| 查看帮助 | `-h`、`--help` | 否 | - | 打印命令行帮助 |

### 环境变量

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `UNIAPP_MINIPROGRAM_DEVTOOL_PORT` | `17890` | 未传 `--port` 时使用的 Web Panel 端口 |
| `UNIAPP_MINIPROGRAM_DEVTOOL_NO_OPEN` | - | 设为 `1` 时不自动打开浏览器 |

启动示例：

```bash
pnpm exec umpd \
  ./unpackage/dist/dev/mp-weixin \
  -w /Volumes/Elements/Applications/wechatwebdevtools.app
```

这里不需要你手动去找 `cli` 文件。直接传 `.app` 路径即可，工具内部会自动解析到：

```txt
/Volumes/Elements/Applications/wechatwebdevtools.app/Contents/MacOS/cli
```

如果你确实已经拿到了微信开发者工具的 `cli` 二进制路径，也可以显式传：

```bash
pnpm exec umpd \
  -p ./unpackage/dist/dev/mp-weixin \
  --cli-path /Applications/wechatwebdevtools.app/Contents/MacOS/cli
```

## 微信开发者工具要求

需要开启微信开发者工具的服务端口：

```txt
微信开发者工具 -> 设置 -> 安全设置 -> 服务端口
```

如果没有开启，automator 无法连接微信开发者工具。

## Web Panel

启动后会自动打开本地页面，默认地址：

```txt
http://127.0.0.1:17890
```

如果端口被占用，会自动尝试后续端口。

Web Panel 当前包含：

- 当前页面 route
- 变量映射和运行时值
- 300ms 自动刷新
- `Refresh now` 手动刷新
- 过滤框
- 值变化高亮
- Debug 面板：显示 `pageId`、`rawRoute`、`keymapPages`、原始 `page.data`

## 常用参数

```bash
umpd <mp-weixin 产物目录> -w <wechatwebdevtools.app 路径>
umpd <mp-weixin 产物目录> -w <wechatwebdevtools.app 路径> --port 17890
umpd -p <mp-weixin 产物目录> -w <wechatwebdevtools.app 路径>
umpd --project <mp-weixin 产物目录> --wechat-devtools <wechatwebdevtools.app 路径>
umpd -p <mp-weixin 产物目录> --cli-path <微信开发者工具 cli 路径>
```

## 工作原理

1. 读取你显式传入的 `mp-weixin` 编译产物目录。
2. 解析页面 JS 中的 `const __returned__ = { ... }`。
3. 从表达式中推断 `a -> message`、`b -> count` 这类映射。
4. 读取 WXML 和 sourcemap 辅助展示。
5. 通过 `miniprogram-automator` 连接微信开发者工具。
6. 读取当前页面的 `page.data`。
7. 将映射后的变量和值展示到 Web Panel。

## 限制

- 当前主要针对 `uni-app` / `uni-app x` 开发模式下的微信小程序产物。
- 运行时值依赖微信开发者工具 automator 能力。
- 工具不会修改编译产物，因此无法像注入脚本那样直接进入小程序运行时，只能通过 automator 读取数据。

## 开发

```bash
pnpm install
pnpm run build
pnpm test
```

本地启动：

```bash
pnpm dev -- ./unpackage/dist/dev/mp-weixin -w /Volumes/Elements/Applications/wechatwebdevtools.app
```

本仓库里的可执行入口文件是：

```txt
bin/umpd.js
```

## 发版

项目使用 `rattail` 作为发版工具。

```bash
pnpm release
```

仅生成变更日志：

```bash
pnpm changelog
```

## License

[MIT](/LICENSE)
