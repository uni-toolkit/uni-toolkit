import automator = require('miniprogram-automator');

import type { KeyMapItem, ProjectAnalysis, TemplateNode } from './core';

interface InspectorOptions {
  projectPath: string;
  getAnalysis: () => ProjectAnalysis;
  intervalMs?: number;
  cliPath?: string;
  port?: number;
  suppressTerminal?: boolean;
  onSnapshot?: (snapshot: {
    connected: boolean;
    status: string;
    route: string;
    rows: RuntimeRow[];
    updatedAt: string;
    debug?: Record<string, unknown>;
    rawData?: Record<string, unknown>;
    templateTree?: TemplateNode | null;
  }) => void;
}

export interface RuntimeRow {
  source: string;
  key: string;
  value: unknown;
  kind: string;
  confidence: string;
  expressionSummary: string;
  wxmlUsages: string[];
}

function normalizeRoute(route: string): string {
  const withoutQuery = route.split('?')[0] || route;
  return withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
}

interface RuntimePageState {
  route: string;
  rawRoute: string;
  pageId: number | string;
  data: Record<string, unknown>;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readRuntimePageState(miniProgram: any): Promise<RuntimePageState | null> {
  // Use the underlying automator protocol directly instead of cached Page objects.
  // This tracks refresh/navigation better because App.getCurrentPage returns the latest pageId/path.
  const current = await miniProgram.send('App.getCurrentPage');
  if (!current || current.pageId == null) return null;

  const dataResult = await miniProgram.send('Page.getData', { pageId: current.pageId });
  const rawRoute = String(current.path || '');
  return {
    route: normalizeRoute(rawRoute),
    rawRoute,
    pageId: current.pageId,
    data: (dataResult?.data || {}) as Record<string, unknown>,
  };
}

function printableRows(items: KeyMapItem[], data: Record<string, unknown>): RuntimeRow[] {
  return items
    .filter((item) => item.kind !== 'event-handler')
    .map((item) => ({
      source: item.sourceName || item.generatedName || 'unknown',
      key: item.key,
      value: data[item.key],
      kind: item.kind,
      confidence: item.confidence,
      expressionSummary: item.expressionSummary,
      wxmlUsages: item.wxmlUsages.map((usage) => usage.snippet),
    }));
}

function explainAutomatorFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return [
    '连接微信开发者工具自动化失败。',
    message,
    '',
    '请检查：',
    '1. 已安装微信开发者工具。',
    '2. 微信开发者工具 -> 设置 -> 安全设置 -> 服务端口 已开启。',
    '3. 该 mp-weixin 编译产物可以被微信开发者工具正常打开。',
  ].join('\n');
}

export async function startAutomatorInspector(options: InspectorOptions): Promise<() => void> {
  const miniProgram = await automator.launch({
    projectPath: options.projectPath,
    cliPath: options.cliPath,
    port: options.port || 9420,
    timeout: 45_000,
    trustProject: true,
  });

  let closed = false;
  let lastText = '';
  let busy = false;
  const intervalMs = options.intervalMs || 500;

  async function poll(): Promise<void> {
    if (closed || busy) return;
    busy = true;
    try {
      const state = await withTimeout(readRuntimePageState(miniProgram), 1500, '读取当前页面数据');
      if (!state) {
        options.onSnapshot?.({
          connected: true,
          status: '已连接，等待当前页面加载',
          route: '',
          rows: [],
          updatedAt: new Date().toISOString(),
          debug: { keymapPages: Object.keys(options.getAnalysis().pages) },
          templateTree: null,
        });
        return;
      }
      const route = state.route;
      const analysis = options.getAnalysis();
      const pageAnalysis = analysis.pages[route];
      if (!pageAnalysis) {
        options.onSnapshot?.({
          connected: true,
          status: '已连接，但当前页面没有可用映射',
          route,
          rows: [],
          updatedAt: new Date().toISOString(),
          debug: { pageId: state.pageId, rawRoute: state.rawRoute, keymapPages: Object.keys(analysis.pages) },
          rawData: state.data,
          templateTree: null,
        });
        const text = `当前页面：${route}\n未找到当前页面的 key 映射。`;
        if (!options.suppressTerminal && text !== lastText) {
          lastText = text;
          console.clear();
          console.log(text);
        }
        return;
      }

      const rows = printableRows(pageAnalysis.keys, state.data || {});
      options.onSnapshot?.({
        connected: true,
        status: '已连接',
        route,
        rows,
        updatedAt: new Date().toISOString(),
        debug: { pageId: state.pageId, rawRoute: state.rawRoute, keymapPages: Object.keys(analysis.pages) },
        rawData: state.data,
        templateTree: pageAnalysis.templateTree,
      });
      const text = JSON.stringify({ route, rows });
      if (!options.suppressTerminal && text !== lastText) {
        lastText = text;
        console.clear();
        console.log('已在 Web 面板中展示最新运行时变量值。');
        console.log('当前页面：', route);
        console.log('按 Ctrl+C 停止。');
      }
    } catch (error) {
      const text = `读取运行时数据失败：${error instanceof Error ? error.message : String(error)}`;
      options.onSnapshot?.({
        connected: false,
        status: text,
        route: '',
        rows: [],
        updatedAt: new Date().toISOString(),
        debug: { error: text, keymapPages: Object.keys(options.getAnalysis().pages) },
        templateTree: null,
      });
      if (!options.suppressTerminal && text !== lastText) {
        lastText = text;
        console.clear();
        console.log(text);
      }
    } finally {
      busy = false;
    }
  }

  const timer = setInterval(() => void poll(), intervalMs);
  await poll();

  return () => {
    closed = true;
    clearInterval(timer);
    try {
      miniProgram.disconnect();
    } catch (_error) {
      // Ignore shutdown errors from the DevTools websocket.
    }
  };
}

export { explainAutomatorFailure };
