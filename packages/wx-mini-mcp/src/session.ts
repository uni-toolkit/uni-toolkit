import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import automator from 'miniprogram-automator';
import { clearConsoleLogs, clearExceptions, getConsoleLogs, getExceptions, pushLog } from './logs.js';
import { type SessionConnector, SessionManager } from './session-manager.js';

type MiniProgram = Awaited<ReturnType<typeof automator.launch>>;

export type MiniProgramApi = MiniProgram;

export interface ConnectOptions {
  projectPath?: string;
  cliPath?: string;
  force?: boolean;
}

interface MiniProgramInternals {
  connection?: {
    transport?: {
      on(event: 'close', listener: () => void): void;
    };
  };
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

const DEFAULT_AUTOMATOR_HOST = '127.0.0.1';
const DEFAULT_AUTOMATOR_PORT = 9420;

function wsEndpoint(host: string, port: number): string {
  return `ws://${host}:${port}`;
}

// 与 licia/getPort（automator 内部用的探测）保持一致：不传 host，按 Node 默认绑定检测。
// 传入 127.0.0.1 会漏检 IPv6-only 占用的端口，导致探测结果与 automator 不一致
async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
}

const CONNECT_PROBE_TIMEOUT = 3_000;

// automator.connect 无法取消握手，用 Promise.race 做超时兜底；
// 超时后才连上的实例打 expired 标记立即 disconnect，不留无人持有的悬挂连接
async function tryConnect(endpoint: string): Promise<MiniProgramApi | null> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      resolve(null);
    }, CONNECT_PROBE_TIMEOUT);
  });
  const attempt = (automator.connect({ wsEndpoint: endpoint }) as Promise<MiniProgramApi>)
    .then((instance) => {
      if (!expired) return instance;
      try {
        instance.disconnect();
      } catch {
        // 连接可能已被开发者工具关闭
      }
      return null;
    })
    .catch(() => null);
  // race 落定后清掉探测定时器，避免成功的连接留下挂着的 3 秒 timer 拖住事件循环
  const result = await Promise.race([attempt, timeout]);
  clearTimeout(timer);
  return result;
}

function launch(projectPath: string, cliPath: string, port: number) {
  return automator.launch({
    cliPath,
    projectPath,
    port,
    timeout: Number(process.env.WEAPP_LAUNCH_TIMEOUT || 45_000),
  });
}

// 自己探测并指定端口 launch，而不是交给 automator 自动分配：
// automator 不会暴露实际使用的端口（MiniProgram 的 connection 是 private），
// 不记录端口的话，下次重连无法直连、只能再次 launch 导致模拟器刷新
const PORT_SCAN_LIMIT = 20;

async function launchOnFreePort(
  projectPath: string,
  cliPath: string,
  startPort: number,
): Promise<{ instance: MiniProgramApi; endpoint: string }> {
  let lastError: unknown;
  const host = process.env.WEAPP_AUTOMATOR_HOST || DEFAULT_AUTOMATOR_HOST;
  for (let port = startPort; port < startPort + PORT_SCAN_LIMIT; port++) {
    if (!(await isPortFree(port))) continue;
    try {
      const instance = (await launch(projectPath, cliPath, port)) as MiniProgramApi;
      return { instance, endpoint: wsEndpoint(host, port) };
    } catch (err) {
      // 端口在探测后被抢占：属于别人，直接试下一个端口
      if (err instanceof Error && err.message.includes('in use')) {
        lastError = err;
        continue;
      }
      // launch 的 checkVersion 偶发在窗口未就绪时失败，此时窗口已打开，直连同端口恢复；不成才抛原始错误
      const recovered = await tryConnect(wsEndpoint(host, port));
      if (recovered) return { instance: recovered, endpoint: wsEndpoint(host, port) };
      throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`端口 ${startPort}~${startPort + PORT_SCAN_LIMIT - 1} 均被占用，无法启动自动化`);
}

function prepareInstance(instance: MiniProgramApi): MiniProgramApi {
  clearConsoleLogs();
  clearExceptions();
  instance.on('console', (payload) => pushLog(getConsoleLogs(), payload));
  instance.on('exception', (payload) => pushLog(getExceptions(), payload));
  return instance;
}

const connector: SessionConnector = {
  async connect(endpoint) {
    const instance = await tryConnect(endpoint);
    return instance ? prepareInstance(instance) : null;
  },
  async launch(projectPath, cliPath, startPort) {
    const connection = await launchOnFreePort(projectPath, cliPath, startPort);
    return { ...connection, instance: prepareInstance(connection.instance) };
  },
  onClose(instance, listener) {
    // ws 意外断开（窗口被关、开发者工具退出）时清空会话，下次调用自动重连而不是报 "Connection closed"
    // automator 的 Connection 不转发 close，要听在它内部的 transport 上（两者都是 private，走运行时访问）
    // 用 on 而非 once，避免时序竞争下漏挂
    const internals = instance as unknown as MiniProgramInternals;
    internals.connection?.transport?.on('close', listener);
  },
};

const manager = new SessionManager(connector);

export function currentSession(): { connected: boolean; projectPath: string } {
  return manager.currentSession();
}

export async function ensureMiniProgram(options: ConnectOptions = {}): Promise<MiniProgramApi> {
  const requestedProjectPath = options.projectPath || process.env.WEAPP_PROJECT_PATH;
  if (!requestedProjectPath) {
    const reusable = !options.force ? manager.reuse() : null;
    if (reusable) return reusable as Promise<MiniProgramApi>;
    throw new Error('缺少小程序项目路径：请传 projectPath，或设置环境变量 WEAPP_PROJECT_PATH');
  }
  if (!fs.existsSync(requestedProjectPath)) {
    throw new Error(`小程序项目路径不存在：${requestedProjectPath}`);
  }
  const projectPath = fs.realpathSync.native(path.resolve(requestedProjectPath));
  const reusable = !options.force ? manager.reuse(projectPath) : null;
  if (reusable) return reusable as Promise<MiniProgramApi>;

  const cliPath = options.cliPath || process.env.WECHAT_DEVTOOLS_CLI_PATH || resolveDefaultCliPath();
  if (!cliPath) {
    throw new Error(
      '未找到微信开发者工具 CLI：请传 cliPath，或设置环境变量 WECHAT_DEVTOOLS_CLI_PATH（并确认 设置 -> 安全设置 -> 服务端口 已开启）',
    );
  }

  const startPort = Number(process.env.WEAPP_AUTOMATOR_PORT || DEFAULT_AUTOMATOR_PORT);
  if (!Number.isInteger(startPort) || startPort < 1 || startPort > 65_535) {
    throw new Error(`WEAPP_AUTOMATOR_PORT 必须是 1~65535 的整数，当前值：${process.env.WEAPP_AUTOMATOR_PORT}`);
  }

  return (await manager.ensure({
    projectPath,
    cliPath,
    startPort,
    explicitEndpoint: process.env.WEAPP_WS_ENDPOINT,
    force: options.force,
  })) as MiniProgramApi;
}

export async function disconnect(): Promise<void> {
  await manager.disconnect();
}
