import fs from 'node:fs';
import automator from 'miniprogram-automator';

type MiniProgram = Awaited<ReturnType<typeof automator.launch>>;

export type MiniProgramApi = MiniProgram;

export interface ConnectOptions {
  projectPath?: string;
  cliPath?: string;
  force?: boolean;
}

export interface RuntimePageState {
  route: string;
  stackLength: number;
  data?: Record<string, unknown>;
}

export function resolveDefaultCliPath(): string | undefined {
  const candidates =
    process.platform === 'win32'
      ? ['C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat']
      : process.platform === 'darwin'
        ? ['/Applications/wechatwebdevtools.app/Contents/MacOS/cli']
        : [];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

let miniProgram: MiniProgramApi | null = null;
let connecting: Promise<MiniProgramApi> | null = null;
let activeProjectPath = '';

export interface LogEntry {
  time: string;
  text: string;
}

const MAX_LOG_ENTRIES = 200;
const consoleLogs: LogEntry[] = [];
const exceptions: LogEntry[] = [];

function pushLog(list: LogEntry[], payload: unknown): void {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  list.push({ time: new Date().toISOString(), text: text.length > 2000 ? text.slice(0, 2000) + '…' : text });
  if (list.length > MAX_LOG_ENTRIES) list.splice(0, list.length - MAX_LOG_ENTRIES);
}

export function getConsoleLogs(): LogEntry[] {
  return consoleLogs;
}

export function getExceptions(): LogEntry[] {
  return exceptions;
}

export function clearConsoleLogs(): void {
  consoleLogs.length = 0;
}

export function clearExceptions(): void {
  exceptions.length = 0;
}

export function currentSession(): { connected: boolean; projectPath: string } {
  return { connected: miniProgram !== null, projectPath: activeProjectPath };
}

export async function ensureMiniProgram(options: ConnectOptions = {}): Promise<MiniProgramApi> {
  if (miniProgram && !options.force) return miniProgram;
  if (connecting) return connecting;

  connecting = (async () => {
    await disconnect();

    const projectPath = options.projectPath || process.env.WEAPP_PROJECT_PATH;
    if (!projectPath) {
      throw new Error('缺少小程序项目路径：请传 projectPath，或设置环境变量 WEAPP_PROJECT_PATH');
    }
    if (!fs.existsSync(projectPath)) {
      throw new Error(`小程序项目路径不存在：${projectPath}`);
    }

    const cliPath = options.cliPath || process.env.WECHAT_DEVTOOLS_CLI_PATH || resolveDefaultCliPath();
    if (!cliPath) {
      throw new Error(
        '未找到微信开发者工具 CLI：请传 cliPath，或设置环境变量 WECHAT_DEVTOOLS_CLI_PATH（并确认 设置 -> 安全设置 -> 服务端口 已开启）',
      );
    }

    const instance = (await automator.launch({
      cliPath,
      projectPath,
      timeout: Number(process.env.WEAPP_LAUNCH_TIMEOUT || 45_000),
    })) as MiniProgramApi;
    // 每次新连接清空并重新挂日志/异常监听
    clearConsoleLogs();
    clearExceptions();
    instance.on('console', (payload) => pushLog(consoleLogs, payload));
    instance.on('exception', (payload) => pushLog(exceptions, payload));
    miniProgram = instance;
    activeProjectPath = projectPath;
    return instance;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

export async function disconnect(): Promise<void> {
  if (!miniProgram) return;
  const instance = miniProgram;
  miniProgram = null;
  activeProjectPath = '';
  try {
    await instance.disconnect();
  } catch {
    // 忽略断开时的 websocket 报错
  }
}

// Page.getData 在当前开发者工具版本会挂起，改为在逻辑层 evaluate 直接读 getCurrentPages()
export async function readCurrentPage(mp: MiniProgramApi, withData = true): Promise<RuntimePageState | null> {
  return mp.evaluate((full: boolean) => {
    const pages = getCurrentPages();
    const top = pages[pages.length - 1] as any;
    if (!top) return null;
    return {
      route: top.route || '',
      stackLength: pages.length,
      data: full ? top.data || {} : undefined,
    };
  }, withData);
}

// 刚连接上时模拟器可能还在加载，等页面就绪后再操作
export async function waitForPage(mp: MiniProgramApi, attempts = 20): Promise<RuntimePageState | null> {
  for (let i = 0; i < attempts; i++) {
    const state = await readCurrentPage(mp, false);
    if (state) return state;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

// automator 的 d.ts 把 send 标成了 private，实际运行时是公开的（callWxMethod 等内部都走它）
interface Sendable {
  send(method: string, params?: Record<string, unknown>): Promise<{ result: unknown }>;
}

// 在逻辑层执行函数声明字符串（小程序运行时禁用 new Function/eval，只能在 Node 侧拼好源码下发）
export async function callAppFunction(
  mp: MiniProgramApi,
  functionDeclaration: string,
  args: unknown[] = [],
): Promise<unknown> {
  const { result } = await (mp as unknown as Sendable).send('App.callFunction', { functionDeclaration, args });
  return result;
}

// 取栈顶页面实例并执行回调。fn 会被内联进函数声明，不能引用 Node 侧闭包变量，参数走 args 传入
export async function evaluateOnPage<Args extends unknown[], R>(
  mp: MiniProgramApi,
  fn: (top: any, ...args: Args) => R,
  ...args: Args
): Promise<R> {
  const declaration = `function () {
    var pages = getCurrentPages();
    var top = pages[pages.length - 1];
    if (!top) throw new Error('当前没有已加载的页面');
    var fn = ${fn.toString()};
    return fn.apply(null, [top].concat(Array.prototype.slice.call(arguments)));
  }`;
  return (await callAppFunction(mp, declaration, args)) as R;
}
