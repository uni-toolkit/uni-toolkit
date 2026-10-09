# @uni_toolkit/wx-mini-mcp

微信小程序 MCP Server：通过 `miniprogram-automator` 连接微信开发者工具，让 AI 客户端（Claude Desktop、Kimi Code、Cursor 等）直接查看和操作运行中的小程序。

## 前置条件

- Node.js >= 18
- 已安装微信开发者工具，并开启：**设置 → 安全设置 → 服务端口**
- 一个可在开发者工具中打开的小程序项目

## 安装与构建

本包位于 uni-toolkit monorepo 内，在仓库根目录执行：

```bash
pnpm install
pnpm build wx-mini-mcp
```

调试可以用官方 inspector（在本包目录下）：

```bash
pnpm run inspector
```

## 客户端配置

```json
{
  "mcpServers": {
    "wx-mini-mcp": {
      "command": "node",
      "args": ["/path/to/wx-mini-mcp/build/index.js"],
      "env": {
        "WEAPP_PROJECT_PATH": "/path/to/your/miniprogram"
      }
    }
  }
}
```

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `WEAPP_PROJECT_PATH` | 默认小程序项目路径（`mp_connect` 不传 `projectPath` 时使用） |
| `WECHAT_DEVTOOLS_CLI_PATH` | 微信开发者工具 CLI 路径；不传则按平台探测默认安装路径（macOS `/Applications/wechatwebdevtools.app`，Windows `C:/Program Files (x86)/Tencent/微信web开发者工具`） |
| `WEAPP_LAUNCH_TIMEOUT` | 启动超时毫秒数，默认 45000 |

## 工具列表

| Tool | 说明 |
| --- | --- |
| `mp_connect` | 启动并连接开发者工具（惰性连接，后续工具自动复用） |
| `mp_disconnect` | 断开自动化连接 |
| `mp_current_page` | 当前页面 route、页面栈、`page.data`；`translate: true` 时把混淆 key 翻译回源码变量名 |
| `mp_navigate` | 页面导航（navigateTo / redirectTo / reLaunch / switchTab / navigateBack） |
| `mp_screenshot` | 截取模拟器画面，返回 PNG |
| `mp_call_wx` | 调用 `wx.*` API |
| `mp_call_method` | 调用页面实例方法，等价于触发用户交互（模拟点击的替代方案）。uni-app 项目直接传源码方法名，自动经 keymap 翻译成事件 id |
| `mp_set_data` | 直接修改当前页面的 data（等价于页面内 `this.setData`），用于数据驱动测试 |
| `mp_mock_wx` | Mock `wx.*` API 的返回值（`restore: true` 恢复原始实现） |
| `mp_evaluate` | 在小程序逻辑层执行任意 JavaScript 并返回结果，可访问 `getCurrentPages()`、`getApp()`、`wx` |
| `mp_get_logs` | 获取控制台日志（连接期间持续收集，最多 200 条） |
| `mp_get_exceptions` | 获取运行时异常（连接期间持续收集，最多 200 条） |
| `uni_keymap` | 分析 uni-app / uni-app x 的 mp-weixin 产物，输出混淆 key ↔ 源码变量名映射表 |

服务器在 `initialize` 握手时下发了 `instructions`，把上述使用要点（先连接、keymap 翻译、用 `mp_call_method` 触发交互、连接会重置状态等）直接告知 AI 客户端，无需额外提示词。

## uni-app keymap 能力

这是与其他小程序自动化 MCP 的差异化能力：常规工具读到的 `page.data` 是编译后的混淆 key（`a`、`b`…），`mp_current_page` 传 `translate: true` 或 `uni_keymap` 借助 [uni-toolkit](https://github.com/uni-toolkit/uni-toolkit) 的 `uniapp-miniprogram-devtool` 分析逻辑（解析 `__returned__`、sourcemap、WXML 使用点），把它们翻译回源码变量名。

产物目录探测规则：项目根目录下的 `./unpackage/dist/dev/mp-weixin`（HBuilderX 项目）或 `./dist/dev/mp-weixin`（CLI/Vite 项目）；直接传产物目录本身也可以。分析结果有缓存，代码重新编译后用 `refresh: true` 刷新。

## 进阶：通过页面实例调用方法（模拟事件）

**优先用 `mp_call_method` 工具**：直接传 uni-app 源码方法名（如 `changeTitle`），工具内部自动完成「源码名 → keymap 键 → data 值 → 实例事件 id」的解析链（如 `changeTitle → c → 'e0' → top.e0()`），事件处理器在不传 `args` 时自动补 `{ type: 'tap' }`。

如果需要脱离 MCP 写独立脚本（如 CI 场景），等价的底层做法如下。两点关键背景：

- `miniprogram-automator` 的 `page.callMethod()` / `page.getData()` 在当前开发者工具版本会**挂起**，稳定的做法是 `mp.evaluate()` 里直接操作 `getCurrentPages()` 拿到的页面实例
- uni-app 编译后，源码 methods（如 `changeTitle`）**不会**以原名挂在页面实例上，而是被改写成 `e0`、`e1` 等事件 id。用 `uni_keymap` 查映射表即可知道某个源码方法对应哪个 `eN`（`kind: "event-handler"`）

示例（`miniprogram-automator` 本身是独立库，直接安装使用即可）：

```js
const automator = require('miniprogram-automator');

(async () => {
  const mp = await automator.launch({
    cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    projectPath: '/path/to/unpackage/dist/dev/mp-weixin',
  });

  // 等待页面加载
  for (let i = 0; i < 30; i++) {
    if (await mp.evaluate(() => getCurrentPages().length) > 0) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // keymap 显示 changeTitle 编译后是 e0；调用它等价于点击 bindtap
  await mp.evaluate(() => {
    const pages = getCurrentPages();
    pages[pages.length - 1].e0({ type: 'tap' });
  });

  // 读回数据验证（同样是 evaluate，不要用 page.getData()）
  const title = await mp.evaluate(() => {
    const pages = getCurrentPages();
    return pages[pages.length - 1].data.b; // keymap: b = title
  });
  console.log(title);

  await mp.disconnect();
})();
```

注意事项：

- 每次 `automator.launch()` 都会触发模拟器**重新加载**，页面状态被重置；所以要截图验证结果时，必须在**同一个连接会话**内先调方法再 `mp.screenshot()`，不能断开重连后再截
- 非 uni-app 的原生小程序项目里，methods 会以原名挂在页面实例上，可直接 `pages[n].methodName(...args)`，不需要查 keymap
- 冷启动后第一个自动化命令可能因模拟器未就绪而超时，重试一次即可

## 注意

- `mp_current_page` 默认返回**编译后的 key**；uni-app / uni-app x 项目传 `translate: true` 自动翻译回源码变量名
- stdio 模式下所有日志都走 stderr，不要往 stdout 写任何东西
