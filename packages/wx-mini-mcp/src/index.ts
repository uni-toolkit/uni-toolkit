#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { disconnect } from './session.js';
import { registerCallMethodTool } from './tools/call-method.js';
import { registerConnectTools } from './tools/connect.js';
import { registerCurrentPageTool } from './tools/current-page.js';
import { registerEvaluateTool } from './tools/evaluate.js';
import { registerKeymapTool } from './tools/keymap.js';
import { registerLogTools } from './tools/logs.js';
import { registerNavigateTool } from './tools/navigate.js';
import { registerScreenshotTool } from './tools/screenshot.js';
import { registerSetDataTool } from './tools/set-data.js';
import { registerWxApiTools } from './tools/wx-api.js';

const server = new McpServer(
  { name: 'wx-mini-mcp', version: '0.1.0' },
  {
    instructions: [
      '微信小程序自动化（微信开发者工具 + miniprogram-automator）。使用要点：',
      '1. 先 mp_connect 连接项目；uni-app 项目传 mp-weixin 产物目录（如 unpackage/dist/dev/mp-weixin）。',
      '2. page.data 的 key 是编译产物；uni-app 项目用 mp_current_page(translate:true) 或 uni_keymap 翻译回源码变量名。',
      '3. 触发页面交互用 mp_call_method 传源码方法名（如 changeTitle），等价于用户点击；不要尝试模拟触摸事件。',
      '4. 同项目的 mp_connect 会复用当前连接；force:true 或 automator launch 会重载模拟器并重置页面状态。需要观察交互结果时，先 mp_call_method 再 mp_screenshot，中途不要强制重连。',
      '5. mp_call_wx 调用 wx.* API；mp_mock_wx 可 mock 其返回值；mp_evaluate 在逻辑层执行任意 JS；mp_set_data 直接改页面 data；mp_get_logs / mp_get_exceptions 读取控制台日志与运行时异常。',
    ].join('\n'),
  },
);

registerConnectTools(server);
registerCurrentPageTool(server);
registerNavigateTool(server);
registerScreenshotTool(server);
registerWxApiTools(server);
registerCallMethodTool(server);
registerSetDataTool(server);
registerEvaluateTool(server);
registerLogTools(server);
registerKeymapTool(server);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error('wx-mini-mcp 已启动（stdio）');
}

process.on('SIGINT', () => {
  void disconnect().finally(() => process.exit(130));
});
process.on('SIGTERM', () => {
  void disconnect().finally(() => process.exit(143));
});

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
