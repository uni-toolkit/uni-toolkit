import { spawn } from 'node:child_process';
import http from 'node:http';

interface TemplateNode {
  id: string;
  tag: string;
  kind: 'element' | 'component' | 'text';
  snippet: string;
  keyRefs: string[];
  attrs: Array<{
    name: string;
    value: string;
  }>;
  text: string | null;
  children: TemplateNode[];
}

export interface RuntimeSnapshot {
  connected: boolean;
  status: string;
  route: string;
  rows: Array<{
    source: string;
    key: string;
    value: unknown;
    kind: string;
    confidence: string;
    expressionSummary: string;
    wxmlUsages: string[];
  }>;
  updatedAt: string;
  templateTree?: TemplateNode | null;
  debug?: {
    pageId?: number | string;
    rawRoute?: string;
    keymapPages?: string[];
    error?: string;
  };
  rawData?: Record<string, unknown>;
}

export interface WebPanel {
  url: string;
  update(snapshot: RuntimeSnapshot): void;
  close(): void;
}

interface WebPanelOptions {
  port?: number;
  onReconnect?: () => void | Promise<void>;
}

const DEFAULT_SNAPSHOT: RuntimeSnapshot = {
  connected: false,
  status: '正在启动...',
  route: '',
  rows: [],
  updatedAt: new Date().toISOString(),
};

function html(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>try{var t=localStorage.getItem('umpd-theme');if(t==='dark'||t==='light')document.documentElement.classList.add(t);}catch(e){}</script>
<title>uniappx 运行时映射</title>
<style>
:root { --background:#f3f3f3; --foreground:oklch(0.145 0 0); --card:oklch(1 0 0); --muted:oklch(0.97 0 0); --muted-foreground:oklch(0.556 0 0); --border:oklch(0.922 0 0); --primary:oklch(0.205 0 0); --primary-foreground:oklch(0.985 0 0); --primary-hover:oklch(0.205 0 0 / 90%); --accent:oklch(0.97 0 0); --destructive:oklch(0.577 0.245 27.325); --success:#16a34a; --link:#2563eb; --amber:#b45309; --tint-1:#fafafa; --tint-2:#f4f4f5; --match-bg:#fef9c3; --active-muted:oklch(0.985 0 0 / 70%); --snippet-foreground:#3f3f46; --shadow:0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1); --shadow-hover:0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1); --shadow-xs:0 1px 2px 0 rgba(0,0,0,.05); --pre-bg:oklch(0.145 0 0); --pre-fg:oklch(0.985 0 0); --pre-border:transparent; --radius:0.625rem; --sans:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; --mono:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
:root.dark { --background:oklch(0.145 0 0); --foreground:oklch(0.985 0 0); --card:oklch(0.205 0 0); --muted:oklch(0.269 0 0); --muted-foreground:oklch(0.708 0 0); --border:oklch(1 0 0 / 10%); --primary:oklch(0.922 0 0); --primary-foreground:oklch(0.205 0 0); --primary-hover:oklch(0.922 0 0 / 90%); --accent:oklch(0.269 0 0); --destructive:oklch(0.704 0.191 22.216); --success:#4ade80; --link:#60a5fa; --amber:#fbbf24; --tint-1:oklch(0.19 0 0); --tint-2:oklch(0.269 0 0); --match-bg:rgba(250,204,21,.15); --active-muted:oklch(0.205 0 0 / 70%); --snippet-foreground:#d4d4d8; --shadow:0 1px 3px 0 rgba(0,0,0,.4), 0 1px 2px -1px rgba(0,0,0,.4); --shadow-hover:0 4px 6px -1px rgba(0,0,0,.5), 0 2px 4px -2px rgba(0,0,0,.5); --shadow-xs:0 1px 2px 0 rgba(0,0,0,.3); --pre-bg:oklch(0.145 0 0); --pre-fg:oklch(0.985 0 0); --pre-border:oklch(1 0 0 / 10%); }
@media (prefers-color-scheme: dark) { :root:not(.light) { --background:oklch(0.145 0 0); --foreground:oklch(0.985 0 0); --card:oklch(0.205 0 0); --muted:oklch(0.269 0 0); --muted-foreground:oklch(0.708 0 0); --border:oklch(1 0 0 / 10%); --primary:oklch(0.922 0 0); --primary-foreground:oklch(0.205 0 0); --primary-hover:oklch(0.922 0 0 / 90%); --accent:oklch(0.269 0 0); --destructive:oklch(0.704 0.191 22.216); --success:#4ade80; --link:#60a5fa; --amber:#fbbf24; --tint-1:oklch(0.19 0 0); --tint-2:oklch(0.269 0 0); --match-bg:rgba(250,204,21,.15); --active-muted:oklch(0.205 0 0 / 70%); --snippet-foreground:#d4d4d8; --shadow:0 1px 3px 0 rgba(0,0,0,.4), 0 1px 2px -1px rgba(0,0,0,.4); --shadow-hover:0 4px 6px -1px rgba(0,0,0,.5), 0 2px 4px -2px rgba(0,0,0,.5); --shadow-xs:0 1px 2px 0 rgba(0,0,0,.3); --pre-bg:oklch(0.145 0 0); --pre-fg:oklch(0.985 0 0); --pre-border:oklch(1 0 0 / 10%); } }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; color:var(--foreground); background:var(--background); font:14px/1.6 var(--sans); -webkit-font-smoothing:antialiased; transition:background-color .2s ease, color .2s ease; }
header { padding:32px clamp(18px,5vw,64px) 20px; display:flex; justify-content:space-between; gap:24px; align-items:flex-end; }
h1 { margin:0; font-size:24px; font-weight:700; letter-spacing:-0.025em; }
.header-side { display:flex; align-items:center; gap:12px; }
.meta { color:var(--muted-foreground); text-align:right; font-size:13px; }
main { padding:0 clamp(18px,5vw,64px) 64px; display:grid; gap:18px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:calc(var(--radius) * 1.4); box-shadow:var(--shadow); overflow:hidden; transition:box-shadow .2s ease; }
.card:hover { box-shadow:var(--shadow-hover); }
.toolbar { display:flex; justify-content:space-between; gap:18px; padding:16px 20px; border-bottom:1px solid var(--border); align-items:center; }
.actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.toggles { display:flex; flex-wrap:wrap; gap:10px; padding:16px 20px; }
.toggle-group { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.toggle-label { color:var(--muted-foreground); font-size:12px; text-transform:uppercase; letter-spacing:.05em; font-weight:500; }
button { appearance:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; height:36px; padding:0 16px; border:1px solid transparent; border-radius:8px; background:var(--primary); color:var(--primary-foreground); font:500 14px/1 var(--sans); cursor:pointer; box-shadow:var(--shadow-xs); transition:background-color .15s ease, border-color .15s ease, color .15s ease; }
button:hover { background:var(--primary-hover); }
button.secondary { background:var(--card); color:var(--foreground); border-color:var(--border); box-shadow:var(--shadow-xs); }
button.secondary:hover { background:var(--accent); }
button.secondary.active { background:var(--primary); color:var(--primary-foreground); border-color:var(--primary); }
button:disabled { cursor:not-allowed; opacity:.5; }
.theme-toggle { width:36px; padding:0; background:var(--card); color:var(--foreground); border-color:var(--border); box-shadow:var(--shadow-xs); flex:0 0 auto; }
.theme-toggle:hover { background:var(--accent); }
.theme-toggle svg { width:16px; height:16px; }
.theme-toggle .icon-sun { display:none; }
:root.dark .theme-toggle .icon-sun { display:block; }
:root.dark .theme-toggle .icon-moon { display:none; }
@media (prefers-color-scheme: dark) { :root:not(.light) .theme-toggle .icon-sun { display:block; } :root:not(.light) .theme-toggle .icon-moon { display:none; } }
input { height:36px; border:1px solid var(--border); background:var(--card); border-radius:8px; padding:0 12px; min-width:220px; font:400 14px/1 var(--sans); color:var(--foreground); box-shadow:var(--shadow-xs); }
input::placeholder { color:var(--muted-foreground); }
input:focus { outline:none; border-color:var(--primary); }
.status { display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; }
.dot { width:8px; height:8px; border-radius:999px; background:var(--destructive); box-shadow:0 0 0 3px rgba(220,38,38,.12); }
.connected .dot { background:var(--success); box-shadow:0 0 0 3px rgba(22,163,74,.12); }
.route { color:var(--link); font-weight:600; }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; padding:12px 16px; border-bottom:1px solid var(--border); vertical-align:top; }
th { color:var(--muted-foreground); font-size:12px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; }
tr.flash { animation: flash 1.05s ease-out; }
@keyframes flash { 0% { background:rgba(250,204,21,.35); } 100% { background:transparent; } }
.key { display:inline-grid; min-width:28px; min-height:28px; padding:0 8px; place-items:center; color:var(--primary-foreground); background:var(--primary); border-radius:6px; font:600 13px/1 var(--mono); }
.value { font-size:14px; font-weight:600; font-family:var(--mono); word-break:break-word; }
.diff { color:var(--amber); font-size:12px; margin-top:4px; font-family:var(--mono); }
.unknown-group-row td { background:var(--tint-1); }
.event-group-row td { background:var(--tint-2); }
.unknown-group-toggle, .event-group-toggle { display:flex; width:100%; justify-content:space-between; gap:12px; align-items:center; color:var(--foreground); font-weight:600; text-decoration:none; }
.unknown-group-toggle:hover, .event-group-toggle:hover { text-decoration:none; }
.unknown-group-meta, .event-group-meta { color:var(--muted-foreground); font-size:12px; font-weight:500; }
.muted { color:var(--muted-foreground); }
.empty { padding:36px 24px; color:var(--muted-foreground); }
.diagnostics { padding:0 20px 20px; }
.diagnostics-card { border-top:1px solid var(--border); padding-top:16px; }
.diagnostics-grid { display:grid; gap:12px; margin-top:12px; }
.diagnostic-item { border:1px solid var(--border); border-radius:8px; background:var(--card); padding:12px 14px; }
.diagnostic-head { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; align-items:center; }
.diagnostic-title { font-weight:600; font-size:14px; }
.diagnostic-meta { color:var(--muted-foreground); font-size:12px; }
.diagnostic-expression { margin-top:8px; font-size:13px; color:var(--foreground); font-family:var(--mono); word-break:break-word; }
.diagnostic-usages { margin-top:10px; display:flex; flex-wrap:wrap; gap:8px; }
.snippet { display:inline-block; border:1px solid var(--border); border-radius:6px; padding:3px 8px; background:var(--muted); color:var(--snippet-foreground); font:12px/1.4 var(--mono); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.template-explorer { padding:0 20px 20px; }
.template-shell { padding-top:16px; display:grid; grid-template-columns:minmax(280px, 420px) minmax(0, 1fr); gap:16px; }
.template-tree, .template-detail { border:1px solid var(--border); border-radius:var(--radius); background:var(--card); min-height:220px; }
.template-pane-title { padding:12px 16px; border-bottom:1px solid var(--border); font-weight:600; font-size:14px; }
.template-pane-body { padding:12px 16px; }
.template-tools { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; align-items:center; }
.template-search { width:100%; margin-bottom:12px; }
.template-search.with-tools { margin-bottom:0; flex:1 1 220px; min-width:180px; }
.template-list { display:grid; gap:4px; }
.template-node { display:block; border:1px solid transparent; background:transparent; width:100%; height:auto; text-align:left; padding:6px 10px; border-radius:6px; cursor:pointer; color:var(--foreground); box-shadow:none; font:400 13px/1.5 var(--mono); }
.template-node:hover { background:var(--accent); }
.template-node.active { background:var(--primary); color:var(--primary-foreground); }
.template-node.active .template-kind { color:var(--active-muted); }
.template-node.match:not(.active) { background:var(--match-bg); }
.template-node-row { display:flex; align-items:center; gap:8px; }
.template-indent { display:inline-block; width:calc(var(--depth) * 12px); flex:0 0 calc(var(--depth) * 12px); }
.template-toggle { display:inline-grid; place-items:center; width:18px; height:18px; border-radius:4px; border:1px solid var(--border); background:var(--card); font-size:11px; color:var(--muted-foreground); }
.template-toggle.placeholder { visibility:hidden; }
.template-tag { font-weight:600; }
.template-kind { font-size:11px; color:var(--muted-foreground); }
.template-count { margin-left:auto; font-size:11px; color:inherit; opacity:.7; }
.template-highlight { box-shadow:inset 0 0 0 1px rgba(250,204,21,.9); }
.template-summary { color:var(--muted-foreground); font-size:12px; margin-top:6px; }
.template-detail-grid { display:grid; gap:12px; }
.template-detail-block { display:grid; gap:6px; }
.template-detail-label { color:var(--muted-foreground); font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.05em; }
.template-breadcrumb { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.template-crumb { display:inline-flex; align-items:center; gap:8px; }
.template-sep { color:var(--muted-foreground); }
.template-bindings { display:grid; gap:10px; }
.binding-card { border:1px solid var(--border); border-radius:8px; background:var(--card); padding:12px 14px; }
.binding-head { display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between; align-items:center; }
.binding-value { margin-top:6px; font-size:14px; font-family:var(--mono); word-break:break-word; }
.binding-snippets { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.binding-table-wrap { overflow:auto; border:1px solid var(--border); border-radius:8px; background:var(--card); }
.binding-table { width:100%; border-collapse:collapse; }
.binding-table th, .binding-table td { padding:10px 12px; border-bottom:1px solid var(--border); text-align:left; vertical-align:top; }
.binding-table th { font-size:11px; font-weight:500; color:var(--muted-foreground); text-transform:uppercase; letter-spacing:.05em; }
.binding-table tr:last-child td { border-bottom:0; }
.mini-link { appearance:none; height:auto; background:transparent; border:0; padding:0; margin:0; color:inherit; cursor:pointer; border-radius:0; box-shadow:none; font:inherit; }
.mini-link:hover { text-decoration:underline; background:transparent; }
.mini-link.key-link { display:inline-grid; }
.debug { padding:0 20px 20px; }
details { border-top:1px solid var(--border); padding:16px 0 0; }
summary { cursor:pointer; color:var(--foreground); font-size:14px; font-weight:600; }
pre { overflow:auto; max-height:320px; background:var(--pre-bg); color:var(--pre-fg); border:1px solid var(--pre-border); border-radius:8px; padding:16px; font:13px/1.6 var(--mono); scrollbar-width:thin; scrollbar-color:var(--border) transparent; }
pre::-webkit-scrollbar { width:8px; height:8px; }
pre::-webkit-scrollbar-track { background:transparent; }
pre::-webkit-scrollbar-thumb { background:var(--border); border-radius:999px; }
pre::-webkit-scrollbar-thumb:hover { background:var(--muted-foreground); }
pre::-webkit-scrollbar-corner { background:transparent; }
code { background:var(--muted); border:1px solid var(--border); border-radius:6px; padding:1px 6px; font:12px/1.5 var(--mono); white-space:pre-wrap; word-break:break-word; }
.pages { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
.page-pill { border:1px solid var(--border); border-radius:999px; padding:3px 10px; font-size:12px; color:var(--muted-foreground); background:var(--card); }
.page-pill.active { color:var(--primary-foreground); background:var(--primary); border-color:var(--primary); }
@media (max-width: 760px) { header, .toolbar { display:block; } .actions { justify-content:flex-start; margin-top:12px; } .toggles { padding-top:0; } .template-shell { grid-template-columns:1fr; } .header-side { margin-top:12px; } .meta { text-align:left; } input { width:100%; } table, thead, tbody, tr, th, td { display:block; } thead { display:none; } tr { padding:12px 0; border-bottom:1px solid var(--border); } td { border:0; padding:6px 16px; } td::before { display:block; color:var(--muted-foreground); font-size:11px; text-transform:uppercase; letter-spacing:.05em; } td:nth-child(1)::before { content:'变量名'; } td:nth-child(2)::before { content:'key'; } td:nth-child(3)::before { content:'值'; } td:nth-child(4)::before { content:'类型'; } .unknown-group-row td::before { content:'' !important; display:none; } }
</style>
</head>
<body>
<header>
  <div><h1>uniapp-miniprogram-devtool</h1><div class="muted">查看编译后小程序 key 对应的运行时变量值。</div></div>
  <div class="header-side"><button id="theme-toggle" class="theme-toggle" type="button" aria-label="切换深色 / 浅色模式" title="切换深色 / 浅色模式"><svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg></button><div class="meta"><div id="updated">-</div><div>每 300ms 自动刷新</div></div></div>
</header>
<main>
  <section id="card" class="card">
    <div class="toolbar">
      <div id="status" class="status"><span class="dot"></span><span>正在启动...</span></div>
      <div class="actions"><input id="filter" placeholder="筛选变量名 / key / 值"><button id="refresh" type="button">立即刷新</button><button id="reconnect" class="secondary" type="button">重新连接</button><div>页面：<span id="route" class="route">-</span></div></div>
    </div>
    <div class="toggles">
      <div class="toggle-group">
        <span class="toggle-label">视图</span>
        <button id="view-business" class="secondary active" type="button">业务变量</button>
        <button id="view-all" class="secondary" type="button">全部变量</button>
      </div>
      <div class="toggle-group">
        <span class="toggle-label">变化</span>
        <button id="toggle-changed" class="secondary" type="button">仅看变化项</button>
      </div>
    </div>
    <div id="content" class="empty">等待连接微信开发者工具自动化...</div>
    <div id="template-explorer" class="template-explorer"></div>
    <div id="diagnostics" class="diagnostics"></div>
    <div id="debug" class="debug">
      <details id="debug-details">
        <summary>调试信息</summary>
        <div id="debug-meta"></div>
        <div id="debug-pages" class="pages"></div>
        <pre id="debug-pre"></pre>
      </details>
    </div>
  </section>
</main>
<script>
window.__lastValues = window.__lastValues || {};
window.__changedKeys = window.__changedKeys || {};
window.__lastSnapshot = null;
window.__pendingDebugData = null;
window.__lastDebugFingerprint = '';
window.__lastDebugBodyText = '';
window.__refreshing = false;
window.__lastTemplateFingerprint = '';
window.__lastDiagnosticsFingerprint = '';
window.__currentView = 'business';
window.__showChangedOnly = false;
window.__unknownRowsCollapsed = true;
window.__eventRowsCollapsed = true;
window.__selectedTemplateNodeId = '';
window.__collapsedTemplateNodes = {};
window.__templateSearch = '';
window.__templateBoundOnly = false;
window.__templateChangedOnly = false;
window.__pinTemplateSelection = false;
window.__scrollTemplateSelection = false;
var cardEl = document.getElementById('card');
var statusTextEl = document.getElementById('status').lastElementChild;
var routeEl = document.getElementById('route');
var updatedEl = document.getElementById('updated');
var filterEl = document.getElementById('filter');
var contentEl = document.getElementById('content');
var templateExplorerEl = document.getElementById('template-explorer');
var diagnosticsEl = document.getElementById('diagnostics');
var debugDetailsEl = document.getElementById('debug-details');
var debugMetaEl = document.getElementById('debug-meta');
var debugPagesEl = document.getElementById('debug-pages');
var debugPreEl = document.getElementById('debug-pre');
var viewBusinessEl = document.getElementById('view-business');
var viewAllEl = document.getElementById('view-all');
var toggleChangedEl = document.getElementById('toggle-changed');
var NON_BUSINESS_KINDS = {
  'css-var': true,
  'virtual-host-class': true,
  'virtual-host-style': true,
  'virtual-host-hidden': true,
  'element-id': true,
  'static-asset': true
};
function formatValue(value) {
  if (typeof value === 'undefined') return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch (error) { return String(value); }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (ch) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; });
}
function matches(row, filter) {
  if (!filter) return true;
  var text = [row.source, row.key, row.kind, row.confidence, formatValue(row.value)].join(' ').toLowerCase();
  return text.indexOf(filter.toLowerCase()) >= 0;
}
function isBusinessRow(row) {
  return !NON_BUSINESS_KINDS[row.kind];
}
function isDiagnosticRow(row) {
  return row.kind === 'unknown' || row.confidence === 'low' || row.confidence === 'medium';
}
function isUnknownUnknownRow(row) {
  return String(row.source || '').toLowerCase() === 'unknown' && String(row.kind || '').toLowerCase() === 'unknown';
}
function isEventRow(row) {
  return row.kind === 'event-handler';
}
function renderToolbarState() {
  viewBusinessEl.classList.toggle('active', window.__currentView === 'business');
  viewAllEl.classList.toggle('active', window.__currentView === 'all');
  toggleChangedEl.classList.toggle('active', !!window.__showChangedOnly);
  toggleChangedEl.textContent = window.__showChangedOnly ? '显示全部项' : '仅看变化项';
}
function templateNodeHasBinding(node) {
  if ((node.keyRefs || []).length) return true;
  return (node.children || []).some(templateNodeHasBinding);
}
function templateNodeHasChanged(node, route, rowsByKey) {
  if (templateNodeHasChangedBinding(node, route, rowsByKey)) return true;
  return (node.children || []).some(function (child) {
    return templateNodeHasChanged(child, route, rowsByKey);
  });
}
function flattenTemplateNodes(node, output, depth, route, rowsByKey) {
  if (!node) return;
  if (window.__templateBoundOnly && !templateNodeHasBinding(node)) return;
  if (window.__templateChangedOnly && !templateNodeHasChanged(node, route, rowsByKey)) return;
  output.push({ node: node, depth: depth });
  if (window.__collapsedTemplateNodes[node.id]) return;
  (node.children || []).forEach(function (child) {
    flattenTemplateNodes(child, output, depth + 1, route, rowsByKey);
  });
}
function findTemplateNodeById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (var index = 0; index < (node.children || []).length; index += 1) {
    var found = findTemplateNodeById(node.children[index], id);
    if (found) return found;
  }
  return null;
}
function findTemplatePathById(node, id, ancestors) {
  if (!node) return null;
  if (node.id === id) return ancestors.concat(node);
  for (var index = 0; index < (node.children || []).length; index += 1) {
    var found = findTemplatePathById(node.children[index], id, ancestors.concat(node));
    if (found) return found;
  }
  return null;
}
function hasChangedBinding(route, row) {
  var changed = window.__changedKeys[(route || '') + ':' + row.key];
  return !!(changed && Date.now() - changed.at < 1200);
}
function templateNodeHasChangedBinding(node, route, rowsByKey) {
  return (node.keyRefs || []).some(function (key) {
    return rowsByKey[key] && hasChangedBinding(route, rowsByKey[key]);
  });
}
function expandChangedTemplateNodes(root, route, rowsByKey) {
  var firstChangedNodeId = '';
  function walk(node, ancestors) {
    var changedHere = templateNodeHasChangedBinding(node, route, rowsByKey);
    var changedInChildren = false;
    (node.children || []).forEach(function (child) {
      if (walk(child, ancestors.concat(node))) changedInChildren = true;
    });
    if (changedHere || changedInChildren) {
      ancestors.forEach(function (ancestor) {
        delete window.__collapsedTemplateNodes[ancestor.id];
      });
      delete window.__collapsedTemplateNodes[node.id];
      if (!firstChangedNodeId && changedHere) firstChangedNodeId = node.id;
      return true;
    }
    return false;
  }
  (root.children || []).forEach(function (child) {
    walk(child, []);
  });
  return firstChangedNodeId;
}
function templateNodeLabel(node) {
  return node.kind === 'text' ? (node.text || '#text') : '<' + node.tag + '>';
}
function templateNodeSearchText(node, rowsByKey) {
  var bindingTexts = (node.keyRefs || []).map(function (key) {
    var row = rowsByKey[key];
    return row ? [row.source, row.key, row.expressionSummary, formatValue(row.value)].join(' ') : key;
  }).join(' ');
  return [templateNodeLabel(node), node.snippet || '', bindingTexts].join(' ').toLowerCase();
}
function findFirstTemplateMatch(root, query, rowsByKey) {
  if (!query) return null;
  function walk(node, ancestors) {
    if (templateNodeSearchText(node, rowsByKey).indexOf(query) >= 0) {
      return { node: node, ancestors: ancestors };
    }
    for (var index = 0; index < (node.children || []).length; index += 1) {
      var child = node.children[index];
      var found = walk(child, ancestors.concat(node));
      if (found) return found;
    }
    return null;
  }
  for (var i = 0; i < (root.children || []).length; i += 1) {
    var found = walk(root.children[i], []);
    if (found) return found;
  }
  return null;
}
function findFirstTemplateNodeByKey(root, key) {
  function walk(node, ancestors) {
    if ((node.keyRefs || []).indexOf(key) >= 0) return { node: node, ancestors: ancestors };
    for (var index = 0; index < (node.children || []).length; index += 1) {
      var child = node.children[index];
      var found = walk(child, ancestors.concat(node));
      if (found) return found;
    }
    return null;
  }
  for (var i = 0; i < (root.children || []).length; i += 1) {
    var found = walk(root.children[i], []);
    if (found) return found;
  }
  return null;
}
function selectTemplateNodeByKey(snapshot, key) {
  if (!snapshot || !snapshot.templateTree) return;
  var found = findFirstTemplateNodeByKey(snapshot.templateTree, key);
  if (!found) return;
  window.__selectedTemplateNodeId = found.node.id;
  found.ancestors.forEach(function (ancestor) {
    delete window.__collapsedTemplateNodes[ancestor.id];
  });
  window.__scrollTemplateSelection = true;
  render(snapshot, true);
}
function countChangedTemplateNodes(nodes, route, rowsByKey) {
  var total = 0;
  nodes.forEach(function (node) {
    if (templateNodeHasChangedBinding(node, route, rowsByKey)) total += 1;
  });
  return total;
}
function renderTemplateExplorer(data, force) {
  var root = data.templateTree;
  if (!root || !(root.children || []).length) {
    var emptyHtml = '<div class="template-shell"><div class="template-tree"><div class="template-pane-title">模板树</div><div class="template-pane-body muted">当前页面没有可解析的模板结构。</div></div><div class="template-detail"><div class="template-pane-title">节点详情</div><div class="template-pane-body muted">选择模板节点后可查看关联变量与当前值。</div></div></div>';
    if (force || window.__lastTemplateFingerprint !== 'empty') {
      window.__lastTemplateFingerprint = 'empty';
      templateExplorerEl.innerHTML = emptyHtml;
    }
    return;
  }
  if (!window.__selectedTemplateNodeId) {
    window.__selectedTemplateNodeId = root.children[0] ? root.children[0].id : root.id;
  }
  var rowsByKey = {};
  (data.rows || []).forEach(function (row) {
    rowsByKey[row.key] = row;
  });
  var searchQuery = String(window.__templateSearch || '').trim().toLowerCase();
  var matched = findFirstTemplateMatch(root, searchQuery, rowsByKey);
  if (matched && !window.__pinTemplateSelection) {
    window.__selectedTemplateNodeId = matched.node.id;
    matched.ancestors.forEach(function (ancestor) {
      delete window.__collapsedTemplateNodes[ancestor.id];
    });
  }
  var flattened = [];
  root.children.forEach(function (child) {
    flattenTemplateNodes(child, flattened, 0, data.route, rowsByKey);
  });
  var selectedNode = findTemplateNodeById(root, window.__selectedTemplateNodeId) || root.children[0] || root;
  if (flattened.length && !flattened.some(function (item) { return item.node.id === selectedNode.id; })) {
    selectedNode = flattened[0].node;
  }
  window.__selectedTemplateNodeId = selectedNode.id;
  var visibleNodes = flattened.map(function (item) { return item.node; });
  var selectedPath = findTemplatePathById(root, selectedNode.id, []) || [selectedNode];
  var breadcrumbNodes = selectedPath.filter(function (node) { return node.id !== 'root'; });
  var selectedNodeIndex = visibleNodes.findIndex(function (node) { return node.id === selectedNode.id; });
  var prevNode = selectedNodeIndex > 0 ? visibleNodes[selectedNodeIndex - 1] : null;
  var nextNode = selectedNodeIndex >= 0 && selectedNodeIndex < visibleNodes.length - 1 ? visibleNodes[selectedNodeIndex + 1] : null;
  var hasAnyChangedNode = visibleNodes.some(function (node) { return templateNodeHasChangedBinding(node, data.route, rowsByKey); });
  var changedNodeCount = countChangedTemplateNodes(visibleNodes, data.route, rowsByKey);
  var detailRows = (selectedNode.keyRefs || []).map(function (key) {
    return rowsByKey[key];
  }).filter(Boolean);
  var nextHtml = '<div class="template-shell">' +
    '<div class="template-tree">' +
      '<div class="template-pane-title">模板树</div>' +
      '<div class="template-pane-body">' +
        '<div class="template-tools">' +
          '<input class="template-search with-tools" data-role="template-search" placeholder="搜索标签 / 片段 / 变量" value="' + escapeHtml(window.__templateSearch || '') + '">' +
          '<button class="secondary ' + (window.__templateBoundOnly ? 'active' : '') + '" data-role="toggle-bound-only" type="button">' + (window.__templateBoundOnly ? '显示全部节点' : '仅显示有绑定节点') + '</button>' +
          '<button class="secondary ' + (window.__templateChangedOnly ? 'active' : '') + '" data-role="toggle-changed-only" type="button">' + (window.__templateChangedOnly ? '显示全部变化范围' : '仅显示变化节点') + '</button>' +
          '<button class="secondary ' + (window.__pinTemplateSelection ? 'active' : '') + '" data-role="toggle-pin-selection" type="button">' + (window.__pinTemplateSelection ? '取消固定选中' : '固定当前选中') + '</button>' +
          '<button class="secondary" data-role="expand-changed" type="button"' + (hasAnyChangedNode ? '' : ' disabled') + '>展开变化节点</button>' +
        '</div>' +
        '<div class="template-summary">当前可见节点 ' + visibleNodes.length + ' 个，变化节点 ' + changedNodeCount + ' 个。</div>' +
        '<div class="template-list">' + flattened.map(function (item) {
        var node = item.node;
        var depth = item.depth;
        var isSelected = node.id === selectedNode.id;
        var hasChildren = !!((node.children || []).length);
        var bindingCount = (node.keyRefs || []).length;
        var hasChange = (node.keyRefs || []).some(function (key) { return rowsByKey[key] && hasChangedBinding(data.route, rowsByKey[key]); });
        var isMatch = searchQuery && templateNodeSearchText(node, rowsByKey).indexOf(searchQuery) >= 0;
        var title = templateNodeLabel(node);
        return '<button class="template-node ' + (isSelected ? 'active ' : '') + (hasChange ? 'template-highlight ' : '') + (isMatch ? 'match' : '') + '" type="button" data-role="select-node" data-node-id="' + escapeHtml(node.id) + '">' +
          '<span class="template-node-row">' +
            '<span class="template-indent" style="--depth:' + depth + ';"></span>' +
            '<span class="template-toggle ' + (hasChildren ? '' : 'placeholder') + '" data-role="' + (hasChildren ? 'toggle-node' : '') + '" data-node-id="' + escapeHtml(node.id) + '">' + (hasChildren ? (window.__collapsedTemplateNodes[node.id] ? '+' : '-') : '+') + '</span>' +
            '<span class="template-tag">' + escapeHtml(title) + '</span>' +
            '<span class="template-kind">' + escapeHtml(node.kind) + '</span>' +
            '<span class="template-count">' + bindingCount + ' 个绑定</span>' +
          '</span>' +
        '</button>';
      }).join('') + '</div>' +
        (!flattened.length ? '<div class="muted">当前筛选下没有可展示的模板节点。</div>' : '') +
        (searchQuery && !matched ? '<div class="muted">没有找到匹配节点。</div>' : '') +
        (searchQuery && matched && window.__pinTemplateSelection ? '<div class="muted">已固定当前选中节点，搜索结果仅高亮不自动跳转。</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="template-detail">' +
      '<div class="template-pane-title">节点详情</div>' +
      '<div class="template-pane-body"><div class="template-detail-grid">' +
        '<div class="template-detail-block"><div><button class="secondary" type="button" data-role="select-node" data-node-id="' + escapeHtml(prevNode ? prevNode.id : '') + '"' + (prevNode ? '' : ' disabled') + '>上一个节点</button> <button class="secondary" type="button" data-role="select-node" data-node-id="' + escapeHtml(nextNode ? nextNode.id : '') + '"' + (nextNode ? '' : ' disabled') + '>下一个节点</button></div></div>' +
        '<div class="template-detail-block"><div class="template-detail-label">节点</div><div>' + escapeHtml(templateNodeLabel(selectedNode)) + '</div></div>' +
        '<div class="template-detail-block"><div class="template-detail-label">路径</div><div class="template-breadcrumb">' + breadcrumbNodes.map(function (node, index) {
          return '<span class="template-crumb"><button class="mini-link" type="button" data-role="select-node" data-node-id="' + escapeHtml(node.id) + '">' + escapeHtml(templateNodeLabel(node)) + '</button>' + (index < breadcrumbNodes.length - 1 ? '<span class="template-sep">/</span>' : '') + '</span>';
        }).join('') + '</div></div>' +
        '<div class="template-detail-block"><div class="template-detail-label">模板片段</div><code>' + escapeHtml(selectedNode.snippet || '-') + '</code></div>' +
        '<div class="template-detail-block"><div class="template-detail-label">属性</div><div>' + ((selectedNode.attrs || []).length ? selectedNode.attrs.map(function (attr) { return '<code>' + escapeHtml(attr.name + (attr.value ? '="' + attr.value + '"' : '')) + '</code>'; }).join(' ') : '<span class="muted">无</span>') + '</div></div>' +
        '<div class="template-detail-block"><div class="template-detail-label">关联变量</div><div class="template-bindings">' + (detailRows.length ? detailRows.map(function (row) {
          var snippets = (row.wxmlUsages || []).slice(0, 2).map(function (snippet) { return '<span class="snippet">' + escapeHtml(snippet) + '</span>'; }).join('');
          return '<div class="binding-card">' +
            '<div class="binding-head"><strong><button class="mini-link" type="button" data-role="locate-key" data-key="' + escapeHtml(row.key) + '">' + escapeHtml(row.source) + '</button></strong><span class="muted"><button class="mini-link" type="button" data-role="locate-key" data-key="' + escapeHtml(row.key) + '">' + escapeHtml(row.key) + '</button> / ' + escapeHtml(row.confidence) + '</span></div>' +
            '<div class="binding-value">' + escapeHtml(formatValue(row.value)) + '</div>' +
            '<div class="muted">' + escapeHtml(row.expressionSummary || '-') + '</div>' +
            (snippets ? '<div class="binding-snippets">' + snippets + '</div>' : '') +
          '</div>';
        }).join('') : '<div class="muted">当前节点没有关联到可识别的运行时变量。</div>') + '</div></div>' +
        '<div class="template-detail-block"><div class="template-detail-label">该节点变量表</div>' + (detailRows.length ? '<div class="binding-table-wrap"><table class="binding-table"><thead><tr><th>变量名</th><th>Key</th><th>值</th><th>类型</th></tr></thead><tbody>' + detailRows.map(function (row) {
          var changed = hasChangedBinding(data.route, row);
          var diff = changed ? window.__changedKeys[(data.route || '') + ':' + row.key] : null;
          return '<tr>' +
            '<td><strong><button class="mini-link" type="button" data-role="locate-key" data-key="' + escapeHtml(row.key) + '">' + escapeHtml(row.source) + '</button></strong><div class="muted">' + escapeHtml(row.confidence) + '</div></td>' +
            '<td><button class="mini-link key-link" type="button" data-role="locate-key" data-key="' + escapeHtml(row.key) + '"><span class="key">' + escapeHtml(row.key) + '</span></button></td>' +
            '<td>' + escapeHtml(formatValue(row.value)) + (diff ? '<div class="diff">' + escapeHtml(diff.from) + ' -> ' + escapeHtml(diff.to) + '</div>' : '') + '</td>' +
            '<td>' + escapeHtml(row.kind) + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>' : '<div class="muted">当前节点没有可展示的变量表。</div>') + '</div>' +
      '</div></div>' +
    '</div>' +
  '</div>';
  var templateFingerprint = nextHtml;
  if (force || templateFingerprint !== window.__lastTemplateFingerprint) {
    window.__lastTemplateFingerprint = templateFingerprint;
    templateExplorerEl.innerHTML = nextHtml;
  }
  if (window.__scrollTemplateSelection) {
    window.__scrollTemplateSelection = false;
    var activeNodeEl = templateExplorerEl.querySelector('.template-node.active');
    activeNodeEl && activeNodeEl.scrollIntoView && activeNodeEl.scrollIntoView({ block: 'nearest' });
  }
}
function renderDebug(data, force) {
  var debug = data.debug || {};
  var pages = debug.keymapPages || [];
  var active = data.route || '';
  var fingerprint = JSON.stringify({
    status: data.status || '',
    route: active,
    pageId: debug.pageId == null ? null : debug.pageId,
    rawRoute: debug.rawRoute || '',
    keymapPages: pages
  });
  window.__pendingDebugData = data;
  var debugChanged = fingerprint !== window.__lastDebugFingerprint;
  if (debugChanged || force) {
    window.__lastDebugFingerprint = fingerprint;
    debugMetaEl.innerHTML =
      '<div class="muted">pageId: ' + escapeHtml(debug.pageId == null ? '-' : debug.pageId) + '</div>' +
      '<div class="muted">rawRoute: ' + escapeHtml(debug.rawRoute || '-') + '</div>' +
      '<div class="muted">status: ' + escapeHtml(data.status || '-') + '</div>';
    debugPagesEl.innerHTML = pages.map(function (page) {
      return '<span class="page-pill ' + (page === active ? 'active' : '') + '">' + escapeHtml(page) + '</span>';
    }).join('');
  } else if (!debugDetailsEl.open) {
    return;
  }
  if (debugDetailsEl.open) {
    var debugBodyText = JSON.stringify({ debug: debug, rawData: data.rawData || {} }, null, 2);
    if (debugBodyText !== window.__lastDebugBodyText) {
      debugPreEl.textContent = debugBodyText;
      window.__lastDebugBodyText = debugBodyText;
    }
  } else {
    if (window.__lastDebugBodyText !== '展开调试信息后可查看原始页面数据。') {
      debugPreEl.textContent = '展开调试信息后可查看原始页面数据。';
      window.__lastDebugBodyText = '展开调试信息后可查看原始页面数据。';
    }
  }
}
function renderDiagnostics(data, rows, force) {
  var diagnosticRows = rows.filter(isDiagnosticRow);
  if (!diagnosticRows.length) {
    if (force || window.__lastDiagnosticsFingerprint !== 'empty') {
      window.__lastDiagnosticsFingerprint = 'empty';
      diagnosticsEl.innerHTML = '<div class="diagnostics-card"><div class="diagnostic-head"><div class="diagnostic-title">低置信度 / 未识别诊断</div><div class="diagnostic-meta">当前页面没有需要额外诊断的项</div></div></div>';
    }
    return;
  }
  var nextHtml = '<div class="diagnostics-card">' +
    '<div class="diagnostic-head">' +
    '<div class="diagnostic-title">低置信度 / 未识别诊断</div>' +
    '<div class="diagnostic-meta">当前页面共 ' + diagnosticRows.length + ' 项，建议优先检查 kind=unknown 或 confidence=low 的项</div>' +
    '</div>' +
    '<div class="diagnostics-grid">' + diagnosticRows.map(function (row) {
      var usages = (row.wxmlUsages || []).slice(0, 3).map(function (snippet) {
        return '<span class="snippet">' + escapeHtml(snippet) + '</span>';
      }).join('');
      return '<div class="diagnostic-item">' +
        '<div class="diagnostic-head">' +
          '<div class="diagnostic-title">' + escapeHtml(row.key) + ' -> ' + escapeHtml(row.source || 'unknown') + '</div>' +
          '<div class="diagnostic-meta">kind: ' + escapeHtml(row.kind) + ' / confidence: ' + escapeHtml(row.confidence) + '</div>' +
        '</div>' +
        '<div class="diagnostic-expression">表达式：' + escapeHtml(row.expressionSummary || '-') + '</div>' +
        '<div class="diagnostic-expression">当前值：' + escapeHtml(formatValue(row.value)) + '</div>' +
        (usages ? '<div class="diagnostic-usages">' + usages + '</div>' : '') +
      '</div>';
    }).join('') + '</div>' +
  '</div>';
  if (force || nextHtml !== window.__lastDiagnosticsFingerprint) {
    window.__lastDiagnosticsFingerprint = nextHtml;
    diagnosticsEl.innerHTML = nextHtml;
  }
}
function renderRuntimeRow(data, row, now) {
  var id = (data.route || '') + ':' + row.key;
  var changed = window.__changedKeys[id] && now - window.__changedKeys[id].at < 1200;
  var diff = changed ? '<div class="diff">' + escapeHtml(window.__changedKeys[id].from) + ' -> ' + escapeHtml(window.__changedKeys[id].to) + '</div>' : '';
  return '<tr class="' + (changed ? 'flash' : '') + '"><td><strong><button class="mini-link" type="button" data-role="locate-key" data-key="' + escapeHtml(row.key) + '">' + escapeHtml(row.source) + '</button></strong><div class="muted">' + escapeHtml(row.confidence) + '</div></td><td><button class="mini-link key-link" type="button" data-role="locate-key" data-key="' + escapeHtml(row.key) + '"><span class="key">' + escapeHtml(row.key) + '</span></button></td><td class="value">' + escapeHtml(formatValue(row.value)) + diff + '</td><td>' + escapeHtml(row.kind) + '</td></tr>';
}
function renderUnknownGroupRow(data, rows, now) {
  var changedCount = rows.filter(function (row) {
    var changed = window.__changedKeys[(data.route || '') + ':' + row.key];
    return !!(changed && now - changed.at < 1200);
  }).length;
  var sampleKeys = rows.slice(0, 8).map(function (row) { return row.key; }).join(', ');
  var meta = rows.length + ' 项' + (changedCount ? ' / ' + changedCount + ' 项有变化' : '') + (sampleKeys ? ' / ' + sampleKeys : '');
  return '<tr class="unknown-group-row">' +
    '<td colspan="4"><button class="mini-link unknown-group-toggle" type="button" data-role="toggle-unknown-group">' +
      '<span>' + (window.__unknownRowsCollapsed ? '+' : '-') + ' unknown 变量集合</span>' +
      '<span class="unknown-group-meta">' + escapeHtml(meta) + '</span>' +
    '</button></td>' +
  '</tr>';
}
function renderEventGroupRow(data, rows, now) {
  var changedCount = rows.filter(function (row) {
    var changed = window.__changedKeys[(data.route || '') + ':' + row.key];
    return !!(changed && now - changed.at < 1200);
  }).length;
  var sampleKeys = rows.slice(0, 8).map(function (row) { return row.key; }).join(', ');
  var meta = rows.length + ' 项' + (changedCount ? ' / ' + changedCount + ' 项有变化' : '') + (sampleKeys ? ' / ' + sampleKeys : '');
  return '<tr class="event-group-row">' +
    '<td colspan="4"><button class="mini-link event-group-toggle" type="button" data-role="toggle-event-group">' +
      '<span>' + (window.__eventRowsCollapsed ? '+' : '-') + ' 事件集合</span>' +
      '<span class="event-group-meta">' + escapeHtml(meta) + '</span>' +
    '</button></td>' +
  '</tr>';
}
function render(data, force) {
  var filter = filterEl.value || '';
  var allRows = data.rows || [];
  cardEl.className = 'card' + (data.connected ? ' connected' : '');
  statusTextEl.textContent = data.status || (data.connected ? '已连接' : '未连接');
  routeEl.textContent = data.route || '-';
  updatedEl.textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : '-';
  renderToolbarState();
  renderDebug(data, force);
  renderTemplateExplorer(data, force);
  var now = Date.now();
  allRows.forEach(function (row) {
    var id = (data.route || '') + ':' + row.key;
    var current = formatValue(row.value);
    if (Object.prototype.hasOwnProperty.call(window.__lastValues, id) && window.__lastValues[id] !== current) {
      window.__changedKeys[id] = { at: now, from: window.__lastValues[id], to: current };
    }
    window.__lastValues[id] = current;
  });
  var rows = allRows
    .filter(function (row) { return window.__currentView === 'all' ? true : isBusinessRow(row); })
    .filter(function (row) {
      if (!window.__showChangedOnly) return true;
      var changed = window.__changedKeys[(data.route || '') + ':' + row.key];
      return !!(changed && now - changed.at < 1200);
    })
    .filter(function (row) { return matches(row, filter); });
  var fingerprint = JSON.stringify({
    connected: data.connected,
    status: data.status,
    route: data.route,
    rows: rows,
    filter: filter,
    view: window.__currentView,
    changedOnly: window.__showChangedOnly,
    unknownRowsCollapsed: window.__unknownRowsCollapsed,
    eventRowsCollapsed: window.__eventRowsCollapsed
  });
  renderDiagnostics(data, allRows, force);
  if (!force && fingerprint === window.__lastUniappxFingerprint) return;
  window.__lastUniappxFingerprint = fingerprint;
  if (!rows.length) {
    contentEl.className = 'empty';
    contentEl.textContent = data.connected ? '当前筛选条件下没有可展示的运行时变量。' : '等待连接微信开发者工具自动化...';
    return;
  }
  contentEl.className = '';
  var eventRows = rows.filter(isEventRow);
  var unknownRows = rows.filter(isUnknownUnknownRow);
  var knownRows = rows.filter(function (row) { return !isEventRow(row) && !isUnknownUnknownRow(row); });
  var bodyHtml = knownRows.map(function (row) { return renderRuntimeRow(data, row, now); }).join('');
  if (eventRows.length) {
    bodyHtml += renderEventGroupRow(data, eventRows, now);
    if (!window.__eventRowsCollapsed) {
      bodyHtml += eventRows.map(function (row) { return renderRuntimeRow(data, row, now); }).join('');
    }
  }
  if (unknownRows.length) {
    bodyHtml += renderUnknownGroupRow(data, unknownRows, now);
    if (!window.__unknownRowsCollapsed) {
      bodyHtml += unknownRows.map(function (row) { return renderRuntimeRow(data, row, now); }).join('');
    }
  }
  contentEl.innerHTML = '<table><thead><tr><th>变量名</th><th>Key</th><th>值</th><th>类型</th></tr></thead><tbody>' + bodyHtml + '</tbody></table>';
}
async function refresh(force) {
  if (window.__refreshing) return;
  window.__refreshing = true;
  try {
    var res = await fetch('/api/snapshot?ts=' + Date.now(), { cache: 'no-store' });
    window.__lastSnapshot = await res.json();
    render(window.__lastSnapshot, !!force);
  } catch (error) {
    statusTextEl.textContent = '面板连接已断开';
  } finally {
    window.__refreshing = false;
  }
}
async function reconnect() {
  statusTextEl.textContent = '正在重新连接...';
  try {
    await fetch('/api/reconnect', { method: 'POST', cache: 'no-store' });
  } catch (error) {}
  window.__lastUniappxFingerprint = '';
  window.__lastDebugFingerprint = '';
  refresh(true);
}
debugDetailsEl.addEventListener('toggle', function () {
  if (!debugDetailsEl.open || !window.__pendingDebugData) return;
  var data = window.__pendingDebugData;
  var debugBodyText = JSON.stringify({ debug: data.debug || {}, rawData: data.rawData || {} }, null, 2);
  debugPreEl.textContent = debugBodyText;
  window.__lastDebugBodyText = debugBodyText;
});
document.getElementById('refresh').addEventListener('click', function () {
  window.__lastUniappxFingerprint = '';
  window.__lastDebugFingerprint = '';
  refresh(true);
});
document.getElementById('reconnect').addEventListener('click', reconnect);
contentEl.addEventListener('click', function (event) {
  var target = event.target;
  while (target && target !== contentEl) {
    var role = target.getAttribute && target.getAttribute('data-role');
    var key = target.getAttribute && target.getAttribute('data-key');
    if (role === 'toggle-unknown-group') {
      window.__unknownRowsCollapsed = !window.__unknownRowsCollapsed;
      window.__lastUniappxFingerprint = '';
      if (window.__lastSnapshot) render(window.__lastSnapshot, true);
      return;
    }
    if (role === 'toggle-event-group') {
      window.__eventRowsCollapsed = !window.__eventRowsCollapsed;
      window.__lastUniappxFingerprint = '';
      if (window.__lastSnapshot) render(window.__lastSnapshot, true);
      return;
    }
    if (role === 'locate-key' && key) {
      selectTemplateNodeByKey(window.__lastSnapshot, key);
      return;
    }
    target = target.parentNode;
  }
});
templateExplorerEl.addEventListener('click', function (event) {
  var target = event.target;
  while (target && target !== templateExplorerEl) {
    var role = target.getAttribute && target.getAttribute('data-role');
    var nodeId = target.getAttribute && target.getAttribute('data-node-id');
    var key = target.getAttribute && target.getAttribute('data-key');
    if (role === 'toggle-node' && nodeId) {
      window.__collapsedTemplateNodes[nodeId] = !window.__collapsedTemplateNodes[nodeId];
      if (window.__lastSnapshot) render(window.__lastSnapshot, true);
      return;
    }
    if (role === 'expand-changed') {
      if (window.__lastSnapshot && window.__lastSnapshot.templateTree) {
        var rowsByKey = {};
        (window.__lastSnapshot.rows || []).forEach(function (row) {
          rowsByKey[row.key] = row;
        });
        var firstChangedNodeId = expandChangedTemplateNodes(window.__lastSnapshot.templateTree, window.__lastSnapshot.route, rowsByKey);
        if (firstChangedNodeId) window.__selectedTemplateNodeId = firstChangedNodeId;
        window.__scrollTemplateSelection = true;
        render(window.__lastSnapshot, true);
      }
      return;
    }
    if (role === 'toggle-bound-only') {
      window.__templateBoundOnly = !window.__templateBoundOnly;
      window.__scrollTemplateSelection = true;
      if (window.__lastSnapshot) render(window.__lastSnapshot, true);
      return;
    }
    if (role === 'toggle-changed-only') {
      window.__templateChangedOnly = !window.__templateChangedOnly;
      window.__scrollTemplateSelection = true;
      if (window.__lastSnapshot) render(window.__lastSnapshot, true);
      return;
    }
    if (role === 'toggle-pin-selection') {
      window.__pinTemplateSelection = !window.__pinTemplateSelection;
      if (window.__lastSnapshot) render(window.__lastSnapshot, true);
      return;
    }
    if (role === 'locate-key' && key) {
      selectTemplateNodeByKey(window.__lastSnapshot, key);
      return;
    }
    if (role === 'select-node' && nodeId) {
      window.__selectedTemplateNodeId = nodeId;
      if (window.__lastSnapshot) render(window.__lastSnapshot, true);
      return;
    }
    target = target.parentNode;
  }
});
templateExplorerEl.addEventListener('input', function (event) {
  var target = event.target;
  if (target && target.getAttribute && target.getAttribute('data-role') === 'template-search') {
    window.__templateSearch = target.value || '';
    if (window.__lastSnapshot) render(window.__lastSnapshot, true);
  }
});
viewBusinessEl.addEventListener('click', function () {
  window.__currentView = 'business';
  window.__lastUniappxFingerprint = '';
  if (window.__lastSnapshot) render(window.__lastSnapshot, true);
});
viewAllEl.addEventListener('click', function () {
  window.__currentView = 'all';
  window.__lastUniappxFingerprint = '';
  if (window.__lastSnapshot) render(window.__lastSnapshot, true);
});
toggleChangedEl.addEventListener('click', function () {
  window.__showChangedOnly = !window.__showChangedOnly;
  window.__lastUniappxFingerprint = '';
  if (window.__lastSnapshot) render(window.__lastSnapshot, true);
});
filterEl.addEventListener('input', function () { if (window.__lastSnapshot) render(window.__lastSnapshot, true); });
var themeToggleEl = document.getElementById('theme-toggle');
function isDarkTheme() {
  if (document.documentElement.classList.contains('dark')) return true;
  if (document.documentElement.classList.contains('light')) return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
if (themeToggleEl) {
  themeToggleEl.addEventListener('click', function () {
    var dark = !isDarkTheme();
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
    try { localStorage.setItem('umpd-theme', dark ? 'dark' : 'light'); } catch (error) {}
  });
}
renderToolbarState();
refresh(true);
setInterval(function () { refresh(false); }, 300);
</script>
</body>
</html>`;
}

function openBrowser(url: string): void {
  if (process.env.UNIAPP_MINIPROGRAM_DEVTOOL_NO_OPEN === '1' || process.env.UNIAPPX_KEYMAP_NO_OPEN === '1') return;
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  spawn(command, args, { detached: true, stdio: 'ignore' })
    .on('error', () => {})
    .unref();
}

function defaultWebPanelPort(): number {
  return Number(process.env.UNIAPP_MINIPROGRAM_DEVTOOL_PORT || process.env.UNIAPPX_KEYMAP_PORT || 17890);
}

async function listen(server: http.Server, preferredPort: number): Promise<number> {
  if (preferredPort <= 0) {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(0, '127.0.0.1');
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('无法解析本地 Web 面板端口。');
    return address.port;
  }

  for (let offset = 0; offset < 20; offset += 1) {
    const port = preferredPort + offset;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
      });
      return port;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE' && code !== 'EACCES' && code !== 'EPERM') throw error;
    }
  }
  throw new Error(`未找到可用的本地 Web 面板端口，尝试范围：${preferredPort} - ${preferredPort + 19}`);
}

export async function startWebPanel(options: number | WebPanelOptions = defaultWebPanelPort()): Promise<WebPanel> {
  const normalized = typeof options === 'number' ? { port: options } : options;
  const preferredPort = normalized.port ?? defaultWebPanelPort();
  let snapshot = { ...DEFAULT_SNAPSHOT };
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/snapshot')) {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(snapshot));
      return;
    }
    if (req.url?.startsWith('/api/reconnect')) {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: false, error: '请求方法不支持' }));
        return;
      }
      snapshot = { ...snapshot, connected: false, status: '已发起重新连接...', updatedAt: new Date().toISOString() };
      Promise.resolve(normalized.onReconnect?.())
        .then(() => {
          res.writeHead(202, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          res.end(JSON.stringify({ ok: true }));
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          snapshot = {
            ...snapshot,
            connected: false,
            status: `重新连接失败：${message}`,
            updatedAt: new Date().toISOString(),
          };
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          res.end(JSON.stringify({ ok: false, error: message }));
        });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html());
  });

  const actualPort = await listen(server, preferredPort);
  const url = `http://127.0.0.1:${actualPort}`;
  openBrowser(url);

  return {
    url,
    update(next) {
      snapshot = next;
    },
    close() {
      server.close();
    },
  };
}
