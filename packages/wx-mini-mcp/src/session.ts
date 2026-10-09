import fs from 'node:fs';
import net from 'node:net';
import automator from 'miniprogram-automator';
import { clearConsoleLogs, clearExceptions, getConsoleLogs, getExceptions, pushLog } from './logs.js';

type MiniProgram = Awaited<ReturnType<typeof automator.launch>>;

export type MiniProgramApi = MiniProgram;

export interface ConnectOptions {
  projectPath?: string;
  cliPath?: string;
  force?: boolean;
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
// 代际计数：disconnect 时递增，使进行中的 launch 结果作废，避免断开返回后又装上活会话
let generation = 0;

const DEFAULT_AUTOMATOR_HOST = '127.0.0.1';
const DEFAULT_AUTOMATOR_PORT = 9420;
// 上次成功 launch 的自动化端口，下次优先直连避免 cli auto 重载项目导致模拟器刷新
let lastAutomatorPort: number | null = null;

function wsEndpoint(host: string, port: number): string {
  return `ws://${host}:${port}`;
}

// 直连目标：显式配置的地址优先，其次是本进程上次 launch 记住的端口
function reconnectEndpoint(): string | null {
  if (process.env.WEAPP_WS_ENDPOINT) return process.env.WEAPP_WS_ENDPOINT;
  if (lastAutomatorPort !== null) {
    return wsEndpoint(process.env.WEAPP_AUTOMATOR_HOST || DEFAULT_AUTOMATOR_HOST, lastAutomatorPort);
  }
  return null;
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

async function tryConnect(endpoint: string): Promise<MiniProgramApi | null> {
  try {
    return (await automator.connect({ wsEndpoint: endpoint })) as MiniProgramApi;
  } catch {
    return null; // 端点上没有自动化窗口
  }
}

function launch(projectPath: string, cliPath: string, port?: number) {
  return automator.launch({
    cliPath,
    projectPath,
    port,
    timeout: Number(process.env.WEAPP_LAUNCH_TIMEOUT || 45_000),
  });
}

// 优先直连已开启自动化的项目窗口（disconnect 只关 ws，窗口和自动化端口还在）；
// 直连失败再回退 launch（cli auto 会重载项目窗口，导致模拟器重新编译刷新）
async function connectOrLaunch(cliPath: string, projectPath: string, force: boolean): Promise<MiniProgramApi> {
  const host = process.env.WEAPP_AUTOMATOR_HOST || DEFAULT_AUTOMATOR_HOST;
  const port = Number(process.env.WEAPP_AUTOMATOR_PORT || DEFAULT_AUTOMATOR_PORT);

  if (!force) {
    const endpoint = reconnectEndpoint();
    if (endpoint) {
      const instance = await tryConnect(endpoint);
      if (instance) return instance;
    }

    // 首选端口被占用：多半是已有自动化窗口在跑（比如手动开着的开发者工具），优先直接复用；
    // 占用的不是自动化服务（连不上）才退回 launch，交给 automator 自动分配端口
    if (!(await isPortFree(port))) {
      const instance = await tryConnect(wsEndpoint(host, port));
      if (instance) {
        lastAutomatorPort = port;
        return instance;
      }
      return (await launch(projectPath, cliPath)) as MiniProgramApi;
    }
  }

  const instance = (await launch(projectPath, cliPath, port)) as MiniProgramApi;
  lastAutomatorPort = port;
  return instance;
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

    const myGeneration = generation;
    const instance = await connectOrLaunch(cliPath, projectPath, Boolean(options.force));
    if (myGeneration !== generation) {
      // launch 期间有人调用了 disconnect，这个实例直接丢弃，不能装成活会话
      try {
        await instance.disconnect();
      } catch {
        // 忽略断开时的 websocket 报错
      }
      throw new Error('连接过程中已被断开');
    }
    // 每次新连接清空并重新挂日志/异常监听
    clearConsoleLogs();
    clearExceptions();
    instance.on('console', (payload) => pushLog(getConsoleLogs(), payload));
    instance.on('exception', (payload) => pushLog(getExceptions(), payload));
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
  generation++;
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
