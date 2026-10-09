# @uni_toolkit/wx-mini-mcp

让 Codex、Claude Desktop、Cursor 等支持 MCP 的 AI 客户端直接查看和操作微信小程序。

它通过微信开发者工具的自动化接口连接正在开发的小程序，可以读取页面状态、调用页面方法、跳转页面、截图、查看日志，以及调用或 Mock `wx.*` API。

> 这是一个由 AI 客户端启动的 MCP Server，不需要在小程序业务代码中安装或导入。

## 使用前准备

- Node.js 18 或更高版本
- 已安装微信开发者工具
- 在微信开发者工具中开启 **设置 -> 安全设置 -> 服务端口**
- 小程序项目已经编译，产物目录中存在 `project.config.json`

### 项目路径怎么选

`WEAPP_PROJECT_PATH` 必须指向微信开发者工具能够直接打开的目录。

| 项目类型 | 常见路径 |
| --- | --- |
| uni-app CLI / Vite | `/your-project/dist/dev/mp-weixin` |
| HBuilderX 创建的 uni-app / uni-app x | `/your-project/unpackage/dist/dev/mp-weixin` |
| 原生微信小程序 | 包含 `project.config.json` 的项目根目录 |

使用 uni-app 时，请先保持微信小程序开发构建运行，例如：

```bash
pnpm dev:mp-weixin
```

## 配置 MCP 客户端

### Claude Desktop、Cursor 等 JSON 配置

将以下内容加入客户端的 MCP 配置，并把项目路径替换为绝对路径：

```json
{
  "mcpServers": {
    "wx-mini-mcp": {
      "command": "npx",
      "args": ["-y", "@uni_toolkit/wx-mini-mcp"],
      "env": {
        "WEAPP_PROJECT_PATH": "/absolute/path/to/dist/dev/mp-weixin"
      }
    }
  }
}
```

### Codex

在 Codex 的 `config.toml` 中加入：

```toml
[mcp_servers.wx-mini-mcp]
command = "npx"
args = ["-y", "@uni_toolkit/wx-mini-mcp"]

[mcp_servers.wx-mini-mcp.env]
WEAPP_PROJECT_PATH = "/absolute/path/to/dist/dev/mp-weixin"
```

保存配置并重启 AI 客户端。客户端应当能够看到以 `mp_` 开头的工具以及 `uni_keymap`。

## 开始使用

不需要记住工具参数，直接向 AI 描述操作即可。

### 连接并检查页面

```text
连接微信小程序，读取当前页面路由和页面数据。
```

对于 uni-app 项目，可以要求使用源码变量名：

```text
读取当前页面状态，并把编译后的 key 翻译成源码变量名。
```

### 操作页面并截图

```text
调用当前页面的 submit 方法，然后截图确认页面结果。
```

```text
跳转到 /pages/profile/index，读取页面数据并检查运行时异常。
```

### 调试接口和状态

```text
把 wx.request Mock 成成功响应，然后执行当前页面的 loadData 方法。
```

```text
读取最近的控制台日志和运行时异常，帮我分析问题。
```

## 可用工具

| Tool | 用途 |
| --- | --- |
| `mp_connect` | 启动微信开发者工具并连接项目；同一项目会复用连接 |
| `mp_disconnect` | 断开当前自动化连接 |
| `mp_current_page` | 读取当前路由、页面栈和 `page.data`；uni-app 可翻译源码变量名 |
| `mp_navigate` | 执行 `navigateTo`、`redirectTo`、`reLaunch`、`switchTab` 或 `navigateBack` |
| `mp_screenshot` | 截取当前模拟器画面 |
| `mp_call_method` | 调用当前页面方法；uni-app 可以直接传源码方法名 |
| `mp_call_wx` | 调用 `wx.*` API |
| `mp_mock_wx` | Mock 或恢复 `wx.*` API |
| `mp_set_data` | 直接修改当前页面的 `page.data` |
| `mp_evaluate` | 在小程序逻辑层执行 JavaScript |
| `mp_get_logs` | 读取连接期间收集的控制台日志 |
| `mp_get_exceptions` | 读取连接期间收集的运行时异常 |
| `uni_keymap` | 分析 uni-app 编译产物中的短 key 与源码变量名映射 |

## uni-app 项目说明

uni-app 编译到微信小程序后，页面数据和事件可能会被转换为 `a`、`b`、`e0` 等短名称。本包会分析编译产物中的页面 JS 和 WXML，恢复它们与源码变量或方法之间的关系。

- 读取数据时，让 AI 使用 `mp_current_page` 的 `translate: true`
- 调用页面方法时，直接传源码方法名，`mp_call_method` 会查找对应的编译后事件
- 编译产物更新后，如果映射结果没有变化，让 AI 使用 `refresh: true` 重新分析
- `mp_set_data` 使用的是编译后的 key，而不是源码变量名；可以先通过 `mp_current_page` 或 `uni_keymap` 查询

分析 keymap 不强制要求 sourcemap。开发构建开启 sourcemap 有助于源码定位，但页面数据翻译主要依赖编译后的 JS 和 WXML。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `WEAPP_PROJECT_PATH` | 无 | 默认项目路径；建议在 MCP 客户端配置中设置 |
| `WECHAT_DEVTOOLS_CLI_PATH` | 自动探测 | 微信开发者工具 CLI 的绝对路径 |
| `WEAPP_LAUNCH_TIMEOUT` | `45000` | 启动微信开发者工具的超时时间，单位毫秒 |
| `WEAPP_AUTOMATOR_PORT` | `9420` | 自动化服务首选端口；被占用时会继续查找空闲端口 |
| `WEAPP_AUTOMATOR_HOST` | `127.0.0.1` | 自动化服务主机名 |
| `WEAPP_WS_ENDPOINT` | 无 | 已启动的自动化 WebSocket 地址；设置后优先尝试直接连接 |

默认 CLI 路径：

- macOS：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
- Windows：`C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat`

微信开发者工具安装在其他位置时，在 MCP 配置中设置：

```json
{
  "env": {
    "WEAPP_PROJECT_PATH": "/absolute/path/to/mp-weixin",
    "WECHAT_DEVTOOLS_CLI_PATH": "/absolute/path/to/wechat-devtools-cli"
  }
}
```

## 连接与页面状态

- 第一次连接会通过微信开发者工具 CLI 启动项目，模拟器可能需要一些时间才能就绪
- 同一 MCP 会话内会复用连接，不需要在每次操作前重新连接
- `force: true` 会重新启动自动化并刷新模拟器，页面状态也会重置
- 需要观察一次交互的结果时，应在同一连接中依次调用页面方法、读取状态和截图
- `WEAPP_WS_ENDPOINT` 可用于复用已经开启的自动化端口；直连失败时会自动回退到 CLI 启动

## 常见问题

### 提示缺少项目路径

确认 MCP 配置中的 `WEAPP_PROJECT_PATH` 是绝对路径，并且目标目录包含 `project.config.json`。

### 找不到微信开发者工具 CLI

设置 `WECHAT_DEVTOOLS_CLI_PATH`。该值应当指向 `cli` 或 `cli.bat` 文件，而不是应用目录。

### 无法连接或连接超时

确认微信开发者工具的服务端口已开启，并检查项目的 `appid` 是否有效。首次冷启动较慢时，可以等待模拟器加载完成后重试一次。

### 页面数据只有 `a`、`b` 等短 key

这是 uni-app 编译结果。让 AI 使用 `mp_current_page` 的 `translate: true`，或者调用 `uni_keymap` 查看映射。

### 调用方法后截图没有变化

不要在调用方法和截图之间强制重连。重新连接会刷新模拟器并丢失刚才的页面状态。

## 安全提示

`mp_evaluate` 可以在小程序逻辑层执行任意 JavaScript。只应在可信的本地开发项目中启用本 MCP Server，并在执行修改数据或调用接口的操作前确认 AI 客户端发起的工具请求。

## License

[MIT](../../LICENSE)
