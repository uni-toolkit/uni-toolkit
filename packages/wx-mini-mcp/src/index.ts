import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  callAppFunction,
  clearConsoleLogs,
  clearExceptions,
  currentSession,
  disconnect,
  ensureMiniProgram,
  evaluateOnPage,
  getConsoleLogs,
  getExceptions,
  type LogEntry,
  readCurrentPage,
  waitForPage,
} from './connection.js';
import { buildNamedRows, loadAnalysis, normalizeRoute, resolveTargetDir, summarizeAnalysis } from './keymap.js';

function defaultProjectRoot(): string {
  return currentSession().projectPath || process.env.WEAPP_PROJECT_PATH || process.cwd();
}

function text(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

// 日志类工具的公共骨架：读缓冲区（可选清空）
function registerLogTool(
  name: string,
  description: string,
  emptyHint: string,
  get: () => LogEntry[],
  clearBuffer: () => void,
): void {
  server.tool(
    name,
    description,
    { clear: z.boolean().optional().describe('读取后清空缓冲，默认 false') },
    async ({ clear }) => {
      await ensureMiniProgram();
      const logs = get().slice();
      if (clear) clearBuffer();
      return text(logs.length > 0 ? logs : emptyHint);
    },
  );
}

const server = new McpServer(
  { name: 'wx-mini-mcp', version: '0.1.0' },
  {
    instructions: [
      '微信小程序自动化（微信开发者工具 + miniprogram-automator）。使用要点：',
      '1. 先 mp_connect 连接项目；uni-app 项目传 mp-weixin 产物目录（如 unpackage/dist/dev/mp-weixin）。',
      '2. page.data 的 key 是编译产物；uni-app 项目用 mp_current_page(translate:true) 或 uni_keymap 翻译回源码变量名。',
      '3. 触发页面交互用 mp_call_method 传源码方法名（如 changeTitle），等价于用户点击；不要尝试模拟触摸事件。',
      '4. 每次连接（mp_connect / automator launch）都会重载模拟器、重置页面状态；需要观察交互结果时，先 mp_call_method 再 mp_screenshot，中途不要重连。',
      '5. mp_call_wx 调用 wx.* API；mp_mock_wx 可 mock 其返回值；mp_evaluate 在逻辑层执行任意 JS；mp_set_data 直接改页面 data；mp_get_logs / mp_get_exceptions 读取控制台日志与运行时异常。',
    ].join('\n'),
  },
);

server.tool(
  'mp_connect',
  '启动微信开发者工具并连接小程序项目（惰性连接，后续工具会自动复用）。前置条件：开发者工具 设置 -> 安全设置 -> 服务端口 已开启',
  {
    projectPath: z
      .string()
      .optional()
      .describe('小程序项目目录（含 project.config.json）。也可用环境变量 WEAPP_PROJECT_PATH'),
    cliPath: z.string().optional().describe('微信开发者工具 CLI 路径。不传则按平台探测默认安装路径'),
    force: z.boolean().optional().describe('强制断开重连'),
  },
  async ({ projectPath, cliPath, force }) => {
    await ensureMiniProgram({ projectPath, cliPath, force });
    return text(`已连接：${currentSession().projectPath}`);
  },
);

server.tool('mp_disconnect', '断开与微信开发者工具的自动化连接', {}, async () => {
  await disconnect();
  return text('已断开');
});

server.tool(
  'mp_current_page',
  '获取当前页面信息：route、页面栈、page.data。translate 为 true 时（uni-app 项目）把编译后的混淆 key 翻译回源码变量名',
  {
    withData: z.boolean().optional().describe('是否返回完整 page.data，默认 true'),
    translate: z.boolean().optional().describe('uni-app 项目：结合 keymap 把混淆 key 翻译回源码变量名，默认 false'),
  },
  async ({ withData, translate }) => {
    const mp = await ensureMiniProgram();
    const state = await readCurrentPage(mp, withData !== false);
    if (!state) return text('当前没有已加载的页面');
    if (!translate || !state.data) return text(state);

    const targetDir = resolveTargetDir(defaultProjectRoot());
    const analysis = loadAnalysis(targetDir);
    const { found, rows, unmappedKeys } = buildNamedRows(analysis, normalizeRoute(state.route), state.data);
    return text({ route: state.route, keymapFound: found, rows, unmappedKeys });
  },
);

server.tool(
  'mp_navigate',
  '小程序内页面导航。tabBar 页面必须用 switchTab；普通页面用 navigateTo；url 使用以 / 开头的绝对路径',
  {
    url: z.string().describe('目标页面路径，如 /pages/index/index'),
    method: z.enum(['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navigateBack']).optional(),
  },
  async ({ url, method = 'navigateTo' }) => {
    const mp = await ensureMiniProgram();
    if (method === 'navigateBack') {
      await mp.navigateBack();
    } else {
      await mp[method](url);
    }
    return text(`已执行 ${method} ${url}`);
  },
);

server.tool('mp_screenshot', '截取开发者工具模拟器当前画面，返回 PNG 图片', {}, async () => {
  const mp = await ensureMiniProgram();
  const file = path.join(os.tmpdir(), `wx-mini-mcp-${Date.now()}.png`);
  await mp.screenshot({ path: file });
  const base64 = await fs.promises.readFile(file, 'base64');
  await fs.promises.unlink(file).catch(() => {});
  return { content: [{ type: 'image' as const, data: base64, mimeType: 'image/png' as const }] };
});

server.tool(
  'mp_call_wx',
  '在小程序逻辑层调用 wx API，例如 wx.showToast。method 为 wx 上的方法名，args 为参数数组',
  {
    method: z.string().describe('wx 方法名，如 showToast'),
    args: z.array(z.unknown()).optional().describe('参数数组，如 [{ "title": "hi" }]'),
  },
  async ({ method, args }) => {
    const mp = await ensureMiniProgram();
    const result = await mp.callWxMethod(method, ...(args || []));
    return text(result ?? '已调用');
  },
);

server.tool(
  'mp_call_method',
  '调用当前页面实例上的方法，等价于触发一次用户交互（本 MCP 无模拟点击能力，这是触发页面事件的正确方式）。uni-app 项目直接传源码方法名（如 changeTitle），会自动经 keymap 翻译成编译后的事件 id；原生小程序传 methods 里的方法名即可',
  {
    method: z.string().describe('方法名：uni-app 源码方法名（自动翻译），或实例上的函数名/事件 id（如 e0）'),
    args: z.array(z.unknown()).optional().describe('传给方法的参数数组。不传时事件处理器自动收到 { type: "tap" }'),
  },
  async ({ method, args }) => {
    const mp = await ensureMiniProgram();
    const state = await waitForPage(mp);
    if (!state) return text('当前没有已加载的页面');

    let resolved = method;
    let isEventHandler = /^e\d+$/.test(method);
    // uni-app：把源码方法名翻译成编译后的事件 id（如 changeTitle -> e0）
    if (!isEventHandler) {
      try {
        const analysis = loadAnalysis(resolveTargetDir(defaultProjectRoot()));
        const page = analysis.pages[normalizeRoute(state.route)];
        const hit = page?.keys.find(
          (k) => (k.sourceName === method || k.generatedName === method) && k.kind === 'event-handler',
        );
        if (hit) {
          resolved = hit.key;
          isEventHandler = true;
        }
      } catch {
        // 非 uni-app 项目（无产物目录），按原名调用
      }
    }

    const callArgs = args && args.length > 0 ? args : isEventHandler ? [{ type: 'tap' }] : [];
    const called = await evaluateOnPage(
      mp,
      (top: any, fn: string, a: unknown[]) => {
        let target = fn;
        if (typeof top[target] !== 'function') {
          // uni-app：keymap 里的 key 是 data 键，data 里的值才是实例上的事件 id（data.c === 'e0'）
          const viaData = top.data && typeof top.data[target] === 'string' ? top.data[target] : null;
          if (viaData && typeof top[viaData] === 'function') target = viaData;
        }
        if (typeof top[target] !== 'function') {
          const available = Object.keys(top).filter((k) => typeof top[k] === 'function');
          throw new Error(`页面实例上不存在方法 ${fn}，可用：${available.join(', ')}`);
        }
        return { target, result: top[target](...a) ?? null };
      },
      resolved,
      callArgs,
    );
    return text({ called: method, resolvedAs: called.target, result: called.result ?? '已调用' });
  },
);

server.tool(
  'mp_set_data',
  '直接修改当前页面的 data（等价于页面内 this.setData），用于数据驱动测试。注意：uni-app 项目要用编译后的 key（如 b 而不是 title，可用 mp_current_page 或 uni_keymap 查映射），且绕过 Vue 状态，页面重渲染后可能被覆盖',
  {
    data: z.record(z.unknown()).describe('要设置的数据对象，如 { "b": "abc" }'),
  },
  async ({ data }) => {
    const mp = await ensureMiniProgram();
    const state = await waitForPage(mp);
    if (!state) return text('当前没有已加载的页面');
    await evaluateOnPage(
      mp,
      (top: any, d: Record<string, unknown>) => {
        top.setData(d);
      },
      data,
    );
    return text('已设置');
  },
);

server.tool(
  'mp_mock_wx',
  'Mock wx.* API 的返回值（如模拟 wx.login 成功、wx.request 返回测试数据）。restore: true 时恢复原始实现',
  {
    method: z.string().describe('wx 方法名，如 login、request、getSystemInfoSync'),
    result: z.unknown().optional().describe('Mock 的返回对象；不传则返回空对象'),
    restore: z.boolean().optional().describe('true = 恢复原始实现（忽略 result）'),
  },
  async ({ method, result, restore }) => {
    const mp = await ensureMiniProgram();
    if (restore) {
      await mp.restoreWxMethod(method);
      return text(`已恢复 wx.${method}`);
    }
    await mp.mockWxMethod(method, result ?? {});
    return text(`已 mock wx.${method}`);
  },
);

server.tool(
  'mp_evaluate',
  '在小程序逻辑层（App Service）执行任意 JavaScript 并返回结果。可直接访问 getCurrentPages()、getApp()、wx 等全局对象；表达式自动返回值，多行语句用 return',
  {
    code: z
      .string()
      .describe(
        '要执行的 JS 代码，如 "getCurrentPages().length" 或 "const p = getCurrentPages(); return p.length"（结果需可 JSON 序列化）',
      ),
  },
  async ({ code }) => {
    const mp = await ensureMiniProgram();
    // 先在本地做语法检查，选定表达式或语句体形式再发送；
    // 运行时异常直接抛出，不能重试——代码可能已经部分执行过，重试会让副作用执行两次
    const attempts = [`function () { return (${code}\n); }`, `function () { ${code}\n }`];
    let declaration: string | undefined;
    let syntaxError: unknown;
    for (const candidate of attempts) {
      try {
        new Function(`(${candidate})`);
        declaration = candidate;
        break;
      } catch (error) {
        syntaxError = error;
      }
    }
    if (declaration === undefined) throw syntaxError;
    const result = await callAppFunction(mp, declaration);
    return text(result === undefined || result === null ? '已执行（无返回值）' : result);
  },
);

registerLogTool(
  'mp_get_logs',
  '获取小程序控制台日志（连接期间持续收集，最多保留最近 200 条；重新连接会清空）',
  '暂无日志',
  getConsoleLogs,
  clearConsoleLogs,
);

registerLogTool(
  'mp_get_exceptions',
  '获取小程序运行时异常（连接期间持续收集，最多保留最近 200 条；重新连接会清空）',
  '暂无异常',
  getExceptions,
  clearExceptions,
);

server.tool(
  'uni_keymap',
  '分析 uni-app / uni-app x 项目的 mp-weixin 编译产物，返回混淆 key 与源码变量名的映射表（uni-app 专用，其余 MCP 不具备的能力）',
  {
    projectRoot: z
      .string()
      .optional()
      .describe('uni-app 项目根目录或 mp-weixin 产物目录。不传则依次尝试已连接项目、WEAPP_PROJECT_PATH、当前目录'),
    refresh: z.boolean().optional().describe('忽略缓存重新分析（代码重新编译后用）'),
  },
  async ({ projectRoot, refresh }) => {
    const targetDir = resolveTargetDir(projectRoot || defaultProjectRoot());
    const analysis = loadAnalysis(targetDir, refresh);
    return text({ targetDir, generatedAt: analysis.generatedAt, pages: summarizeAnalysis(analysis) });
  },
);

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
