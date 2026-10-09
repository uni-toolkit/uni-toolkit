import fs from 'node:fs';
import { createRequire } from 'node:module';
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

interface WebSocketLike {
  once(event: 'open' | 'error', listener: (...args: any[]) => void): this;
  terminate(): void;
}

interface WebSocketConstructor {
  new (endpoint: string, options: { handshakeTimeout: number }): WebSocketLike;
}

interface Constructor<T = unknown> {
  new (...args: any[]): T;
}

interface MiniProgramInternals {
  connection?: {
    transport?: {
      once(event: 'close', listener: () => void): void;
    };
  };
}

const require = createRequire(import.meta.url);
const WebSocket = require('ws') as WebSocketConstructor;
const Transport = require('miniprogram-automator/out/Transport').default as Constructor;
const Connection = require('miniprogram-automator/out/Connection').default as Constructor;
const MiniProgramConstructor = require('miniprogram-automator/out/MiniProgram').default as Constructor<MiniProgramApi>;

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

// automator.connect 无法取消握手。直接用它内部相同的 Connection/MiniProgram
// 构造链，并给 ws 设置 handshakeTimeout，超时后可主动销毁底层 socket。
export async function connectDirect(endpoint: string, timeout = CONNECT_PROBE_TIMEOUT): Promise<MiniProgramApi | null> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: WebSocketLike;

    const finish = (instance: MiniProgramApi | null) => {
      if (settled) {
        if (instance) void Promise.resolve(instance.disconnect()).catch(() => {});
        return;
      }
      settled = true;
      resolve(instance);
    };

    try {
      socket = new WebSocket(endpoint, { handshakeTimeout: timeout });
    } catch {
      resolve(null);
      return;
    }

    socket.once('error', () => {
      socket.terminate();
      finish(null);
    });
    socket.once('open', () => {
      const transport = new Transport(socket);
      const connection = new Connection(transport);
      const instance = new MiniProgramConstructor(connection);
      const timer = setTimeout(() => {
        socket.terminate();
        finish(null);
      }, timeout);

      void instance
        .checkVersion()
        .then(() => finish(instance))
        .catch(() => {
          socket.terminate();
          finish(null);
        })
        .finally(() => clearTimeout(timer));
    });
  });
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
      // 探测到 launch 之间端口被抢占，试下一个；其他错误直接抛出
      if (!(err instanceof Error) || !err.message.includes('in use')) throw err;
      lastError = err;
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

const connector: SessionConnector<MiniProgramApi> = {
  async connect(endpoint) {
    const instance = await connectDirect(endpoint);
    return instance ? prepareInstance(instance) : null;
  },
  async launch(projectPath, cliPath, startPort) {
    const connection = await launchOnFreePort(projectPath, cliPath, startPort);
    return { ...connection, instance: prepareInstance(connection.instance) };
  },
  async disconnect(instance) {
    await instance.disconnect();
  },
  onClose(instance, listener) {
    const internals = instance as unknown as MiniProgramInternals;
    internals.connection?.transport?.once('close', listener);
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
    if (reusable) return reusable;
    throw new Error('缺少小程序项目路径：请传 projectPath，或设置环境变量 WEAPP_PROJECT_PATH');
  }
  if (!fs.existsSync(requestedProjectPath)) {
    throw new Error(`小程序项目路径不存在：${requestedProjectPath}`);
  }
  const projectPath = fs.realpathSync.native(path.resolve(requestedProjectPath));
  const reusable = !options.force ? manager.reuse(projectPath) : null;
  if (reusable) return reusable;

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

  return manager.ensure({
    projectPath,
    cliPath,
    startPort,
    explicitEndpoint: process.env.WEAPP_WS_ENDPOINT,
    force: options.force,
  });
}

export async function disconnect(): Promise<void> {
  await manager.disconnect();
}

const CONNECTION_ERROR = /Connection closed|WebSocket is not open|ECONN(?:REFUSED|RESET|ABORTED)|EPIPE|socket hang up/i;

export async function withMiniProgram<T>(operation: (instance: MiniProgramApi) => Promise<T>): Promise<T> {
  const instance = await ensureMiniProgram();
  try {
    return await operation(instance);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (CONNECTION_ERROR.test(message)) manager.invalidate(instance);
    throw error;
  }
}
