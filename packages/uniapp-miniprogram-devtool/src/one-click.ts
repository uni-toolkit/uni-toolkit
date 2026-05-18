import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { explainAutomatorFailure, startAutomatorInspector } from './automator-inspector';
import { analyzeProject, type ProjectAnalysis } from './core';
import { renderHtmlReport } from './html-report';
import { startWebPanel } from './web-panel';

const OUTPUT_DIR = path.join(os.tmpdir(), 'uniapp-miniprogram-devtool');
const PROJECT_OPTIONS = ['--project', '--proj', '-p'];
const WECHAT_DEVTOOLS_OPTIONS = ['--wechat-devtools', '--wd', '-w'];
const CLI_PATH_OPTIONS = ['--cli-path'];
const PORT_OPTIONS = ['--port'];
const AUTOMATOR_PORT_OPTIONS = ['--automator-port'];
const VALUE_OPTIONS = new Set([
  ...PROJECT_OPTIONS,
  ...WECHAT_DEVTOOLS_OPTIONS,
  ...CLI_PATH_OPTIONS,
  ...PORT_OPTIONS,
  ...AUTOMATOR_PORT_OPTIONS,
]);

function isMpWeixinRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'app.json')) && fs.existsSync(path.join(dir, 'app.js'));
}

function safeStat(file: string): fs.Stats | null {
  try {
    return fs.statSync(file);
  } catch (_error) {
    return null;
  }
}

function normalizeCliPath(value: string): string {
  const resolved = path.resolve(value);
  if (resolved.endsWith('.app')) return path.join(resolved, 'Contents', 'MacOS', 'cli');
  return resolved;
}

function getOptionValue(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) return argv[index + 1];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function getAnyOptionValue(argv: string[], names: string[]): string | undefined {
  for (const name of names) {
    const value = getOptionValue(argv, name);
    if (value) return value;
  }
  return undefined;
}

function firstPositionalArg(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const optionName = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (VALUE_OPTIONS.has(optionName)) {
      if (!arg.includes('=')) index += 1;
      continue;
    }
    if (!arg.startsWith('-')) return arg;
  }
  return undefined;
}

function getRequiredTarget(argv: string[]): string {
  const explicitTarget = getAnyOptionValue(argv, PROJECT_OPTIONS) || firstPositionalArg(argv);
  if (!explicitTarget) {
    throw new Error(
      '请显式传入 uni-app / uni-app x 微信小程序编译产物目录，例如：umpd -p ./unpackage/dist/dev/mp-weixin',
    );
  }

  const resolved = path.resolve(explicitTarget);
  if (!isMpWeixinRoot(resolved)) {
    throw new Error(`不是有效的 mp-weixin 产物目录：${resolved}。请确认该目录包含 app.json 和 app.js。`);
  }
  return resolved;
}

function getRequiredCliPath(argv: string[]): string {
  const rawCliPath = getAnyOptionValue(argv, CLI_PATH_OPTIONS) || getAnyOptionValue(argv, WECHAT_DEVTOOLS_OPTIONS);
  if (!rawCliPath) {
    throw new Error('请显式传入微信开发者工具路径，例如：umpd -w /Volumes/Elements/Applications/wechatwebdevtools.app');
  }

  const cliPath = normalizeCliPath(rawCliPath);
  if (!fs.existsSync(cliPath)) {
    throw new Error(`不是有效的微信开发者工具路径：${rawCliPath}。可以通过 -w 直接传 .app 路径。`);
  }

  return cliPath;
}

function writeText(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function latestTreeMtime(root: string): number {
  let latest = 0;
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_error) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'common') continue;
        walk(full);
      } else if (/\.(js|wxml|map)$/.test(entry.name)) {
        latest = Math.max(latest, safeStat(full)?.mtimeMs || 0);
      }
    }
  }
  walk(root);
  return latest;
}

function generate(targetRoot: string): ProjectAnalysis {
  const result = analyzeProject(targetRoot);
  const keymapPath = path.join(OUTPUT_DIR, 'uniapp-miniprogram-devtool.json');
  const htmlPath = path.join(OUTPUT_DIR, 'uniapp-miniprogram-devtool.html');

  writeText(keymapPath, JSON.stringify(result, null, 2));
  writeText(htmlPath, renderHtmlReport(result));

  return result;
}

function printStartup(targetRoot: string, result: ProjectAnalysis): void {
  const htmlPath = path.join(OUTPUT_DIR, 'uniapp-miniprogram-devtool.html');
  const pageCount = Object.keys(result.pages).length;
  const keyCount = Object.values(result.pages).reduce((sum, page) => sum + page.keys.length, 0);

  console.clear();
  console.log('uniapp-miniprogram-devtool');
  console.log('目标目录:', targetRoot);
  console.log('页面数:', pageCount, '键数量:', keyCount);
  console.log('报告文件:', htmlPath);
  console.log('');
  console.log('正在启动并连接微信开发者工具自动化...');
}

export async function main(argv: string[]): Promise<void> {
  const cliPath = getRequiredCliPath(argv);
  const panelPort = Number(
    getOptionValue(argv, '--port') ||
      process.env.UNIAPP_MINIPROGRAM_DEVTOOL_PORT ||
      process.env.UNIAPPX_KEYMAP_PORT ||
      17890,
  );
  const rawAutomatorPort =
    getAnyOptionValue(argv, AUTOMATOR_PORT_OPTIONS) || process.env.UNIAPP_MINIPROGRAM_DEVTOOL_AUTOMATOR_PORT;
  const automatorPort = rawAutomatorPort ? Number(rawAutomatorPort) : undefined;
  const targetRoot = getRequiredTarget(argv);
  let lastMtime = 0;
  let currentAnalysis = generate(targetRoot);
  printStartup(targetRoot, currentAnalysis);

  let pollTimer: NodeJS.Timeout | undefined;
  let stopInspector: (() => void) | undefined;
  let reconnectPromise: Promise<void> | null = null;
  let shuttingDown = false;

  function updatePanelStatus(status: string): void {
    webPanel.update({ connected: false, status, route: '', rows: [], updatedAt: new Date().toISOString() });
  }

  function disposeInspector(): void {
    stopInspector?.();
    stopInspector = undefined;
  }

  async function reconnectInspector(status = '正在启动微信开发者工具自动化...'): Promise<void> {
    if (shuttingDown) return;
    if (reconnectPromise) return reconnectPromise;

    updatePanelStatus(status);
    reconnectPromise = (async () => {
      disposeInspector();
      regenerateIfNeeded(true);
      try {
        stopInspector = await startAutomatorInspector({
          projectPath: targetRoot,
          getAnalysis: () => currentAnalysis,
          intervalMs: 500,
          cliPath,
          port: automatorPort,
          suppressTerminal: true,
          onSnapshot: (snapshot) => webPanel.update(snapshot),
        });
        process.exitCode = 0;
      } catch (error) {
        const message = explainAutomatorFailure(error);
        webPanel.update({
          connected: false,
          status: message,
          route: '',
          rows: [],
          updatedAt: new Date().toISOString(),
        });
        console.error(message);
        process.exitCode = 1;
      } finally {
        reconnectPromise = null;
      }
    })();

    return reconnectPromise;
  }

  async function shutdown(exitCode?: number): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    pollTimer && clearInterval(pollTimer);
    disposeInspector();
    webPanel.close();
    if (typeof exitCode === 'number') process.exit(exitCode);
  }

  const webPanel = await startWebPanel({
    port: panelPort,
    onReconnect: () => reconnectInspector('正在重新连接微信开发者工具自动化...'),
  });
  console.log('Web 面板:', webPanel.url);
  console.log('运行时变量值会显示在 Web 面板中，按 Ctrl+C 停止。');
  updatePanelStatus('正在启动微信开发者工具自动化...');

  function regenerateIfNeeded(force = false): void {
    const mtime = latestTreeMtime(targetRoot);
    if (force || mtime !== lastMtime) {
      lastMtime = mtime;
      currentAnalysis = generate(targetRoot);
    }
  }

  regenerateIfNeeded(true);

  pollTimer = setInterval(() => regenerateIfNeeded(), 1200);

  process.once('SIGINT', () => void shutdown(130));
  process.once('SIGTERM', () => void shutdown(143));

  await reconnectInspector();
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error?.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
}
