import type { ProjectAnalysis } from './core';

function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderHtmlReport(result: ProjectAnalysis): string {
  const pages = Object.values(result.pages);
  const pageCards = pages
    .map((page) => {
      const rows = page.keys
        .map((item) => {
          const source = item.sourceName || item.generatedName || 'unknown';
          const usage =
            item.wxmlUsages.map((u) => `<code>${escapeHtml(u.snippet)}</code>`).join('<br>') ||
            '<span class="muted">not found</span>';
          return `<tr>
        <td><span class="key">${escapeHtml(item.key)}</span></td>
        <td>${escapeHtml(source)}</td>
        <td><span class="pill ${escapeHtml(item.confidence)}">${escapeHtml(item.confidence)}</span></td>
        <td><code>${escapeHtml(item.expressionSummary || item.expression)}</code></td>
        <td>${usage}</td>
      </tr>`;
        })
        .join('\n');

      const sourcePreview = page.sourceMap?.sourcesContent?.[0]
        ? `<details><summary>Source preview</summary><pre>${escapeHtml(page.sourceMap.sourcesContent[0])}</pre></details>`
        : '';

      return `<section class="card">
      <div class="card-title">
        <h2>${escapeHtml(page.page)}</h2>
        <span>${escapeHtml(page.jsFile)}</span>
      </div>
      <table>
        <thead><tr><th>Compiled key</th><th>Readable source</th><th>Confidence</th><th>Compiled expression</th><th>WXML usage</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">No __returned__ keys found.</td></tr>'}</tbody>
      </table>
      ${sourcePreview}
    </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>try{var t=localStorage.getItem('umpd-theme');if(t==='dark'||t==='light')document.documentElement.classList.add(t);}catch(e){}</script>
<title>uniappx keymap report</title>
<style>
:root { --background:#f3f3f3; --foreground:oklch(0.145 0 0); --card:oklch(1 0 0); --muted:oklch(0.97 0 0); --muted-foreground:oklch(0.556 0 0); --border:oklch(0.922 0 0); --primary:oklch(0.205 0 0); --primary-foreground:oklch(0.985 0 0); --radius:0.625rem; --green:#15803d; --green-bg:#f0fdf4; --green-border:#bbf7d0; --amber:#b45309; --amber-bg:#fffbeb; --amber-border:#fde68a; --red:#b91c1c; --red-bg:#fef2f2; --red-border:#fecaca; --shadow:0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1); --shadow-hover:0 4px 6px -1px rgba(0,0,0,.1), 0 2px 4px -2px rgba(0,0,0,.1); --shadow-xs:0 1px 2px 0 rgba(0,0,0,.05); --pre-bg:oklch(0.145 0 0); --pre-fg:oklch(0.985 0 0); --pre-border:transparent; --sans:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; --mono:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
:root.dark { --background:oklch(0.145 0 0); --foreground:oklch(0.985 0 0); --card:oklch(0.205 0 0); --muted:oklch(0.269 0 0); --muted-foreground:oklch(0.708 0 0); --border:oklch(1 0 0 / 10%); --primary:oklch(0.922 0 0); --primary-foreground:oklch(0.205 0 0); --green:#4ade80; --green-bg:rgba(34,197,94,.12); --green-border:rgba(34,197,94,.3); --amber:#fbbf24; --amber-bg:rgba(245,158,11,.12); --amber-border:rgba(245,158,11,.3); --red:#f87171; --red-bg:rgba(239,68,68,.12); --red-border:rgba(239,68,68,.3); --shadow:0 1px 3px 0 rgba(0,0,0,.4), 0 1px 2px -1px rgba(0,0,0,.4); --shadow-hover:0 4px 6px -1px rgba(0,0,0,.5), 0 2px 4px -2px rgba(0,0,0,.5); --shadow-xs:0 1px 2px 0 rgba(0,0,0,.3); --pre-bg:oklch(0.145 0 0); --pre-fg:oklch(0.985 0 0); --pre-border:oklch(1 0 0 / 10%); }
@media (prefers-color-scheme: dark) { :root:not(.light) { --background:oklch(0.145 0 0); --foreground:oklch(0.985 0 0); --card:oklch(0.205 0 0); --muted:oklch(0.269 0 0); --muted-foreground:oklch(0.708 0 0); --border:oklch(1 0 0 / 10%); --primary:oklch(0.922 0 0); --primary-foreground:oklch(0.205 0 0); --green:#4ade80; --green-bg:rgba(34,197,94,.12); --green-border:rgba(34,197,94,.3); --amber:#fbbf24; --amber-bg:rgba(245,158,11,.12); --amber-border:rgba(245,158,11,.3); --red:#f87171; --red-bg:rgba(239,68,68,.12); --red-border:rgba(239,68,68,.3); --shadow:0 1px 3px 0 rgba(0,0,0,.4), 0 1px 2px -1px rgba(0,0,0,.4); --shadow-hover:0 4px 6px -1px rgba(0,0,0,.5), 0 2px 4px -2px rgba(0,0,0,.5); --shadow-xs:0 1px 2px 0 rgba(0,0,0,.3); --pre-bg:oklch(0.145 0 0); --pre-fg:oklch(0.985 0 0); --pre-border:oklch(1 0 0 / 10%); } }
* { box-sizing: border-box; }
body { margin:0; color:var(--foreground); background:var(--background); font:14px/1.6 var(--sans); -webkit-font-smoothing:antialiased; transition:background-color .2s ease, color .2s ease; }
header { padding:40px clamp(20px, 5vw, 64px) 24px; background:var(--card); border-bottom:1px solid var(--border); }
h1 { margin:0 0 8px; font-size:28px; font-weight:700; letter-spacing:-0.025em; }
header p { margin:0; color:var(--muted-foreground); max-width:900px; }
main { padding:24px clamp(20px, 5vw, 64px) 64px; display:grid; gap:20px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:calc(var(--radius) * 1.4); box-shadow:var(--shadow); overflow:hidden; transition:box-shadow .2s ease; }
.card:hover { box-shadow:var(--shadow-hover); }
.card-title { display:flex; justify-content:space-between; gap:16px; align-items:baseline; padding:16px 20px; border-bottom:1px solid var(--border); }
h2 { margin:0; font-size:16px; font-weight:600; letter-spacing:-0.01em; }
.card-title span, .muted { color:var(--muted-foreground); }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; vertical-align:top; padding:12px 16px; border-bottom:1px solid var(--border); }
tbody tr:last-child td { border-bottom:0; }
th { font-size:12px; font-weight:500; text-transform:uppercase; color:var(--muted-foreground); letter-spacing:.05em; }
code { background:var(--muted); border:1px solid var(--border); border-radius:6px; padding:1px 6px; font:13px/1.5 var(--mono); white-space:pre-wrap; word-break:break-word; }
.key { display:inline-grid; place-items:center; min-width:28px; min-height:28px; padding:0 8px; border-radius:6px; background:var(--primary); color:var(--primary-foreground); font:600 13px/1 var(--mono); }
.pill { display:inline-flex; align-items:center; border:1px solid var(--border); border-radius:calc(var(--radius) * 0.6); padding:2px 8px; font-size:12px; font-weight:500; }
.pill.high { color:var(--green); background:var(--green-bg); border-color:var(--green-border); }
.pill.medium { color:var(--amber); background:var(--amber-bg); border-color:var(--amber-border); }
.pill.low { color:var(--red); background:var(--red-bg); border-color:var(--red-border); }
.pill.generated { color:var(--muted-foreground); background:var(--muted); }
details { padding:16px 20px 20px; }
summary { cursor:pointer; color:var(--foreground); font-size:14px; font-weight:600; }
pre { overflow:auto; background:var(--pre-bg); color:var(--pre-fg); border:1px solid var(--pre-border); border-radius:8px; padding:16px; font:13px/1.6 var(--mono); scrollbar-width:thin; scrollbar-color:var(--border) transparent; }
pre::-webkit-scrollbar { width:8px; height:8px; }
pre::-webkit-scrollbar-track { background:transparent; }
pre::-webkit-scrollbar-thumb { background:var(--border); border-radius:999px; }
pre::-webkit-scrollbar-thumb:hover { background:var(--muted-foreground); }
pre::-webkit-scrollbar-corner { background:transparent; }
.theme-toggle { position:fixed; top:16px; right:16px; z-index:10; display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; padding:0; border:1px solid var(--border); border-radius:8px; background:var(--card); color:var(--foreground); cursor:pointer; box-shadow:var(--shadow-xs); }
.theme-toggle:hover { background:var(--muted); }
.theme-toggle svg { width:16px; height:16px; }
.theme-toggle .icon-sun { display:none; }
:root.dark .theme-toggle .icon-sun { display:block; }
:root.dark .theme-toggle .icon-moon { display:none; }
@media (prefers-color-scheme: dark) { :root:not(.light) .theme-toggle .icon-sun { display:block; } :root:not(.light) .theme-toggle .icon-moon { display:none; } }
@media (max-width: 760px) { .card-title { display:block; } table, thead, tbody, tr, th, td { display:block; } thead { display:none; } td { border-bottom:0; padding:8px 16px; } tr { border-bottom:1px solid var(--border); padding:10px 0; } }
</style>
</head>
<body>
<button id="theme-toggle" class="theme-toggle" type="button" aria-label="切换深色 / 浅色模式" title="切换深色 / 浅色模式">
  <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
  <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
</button>
<header>
  <h1>uniappx keymap</h1>
  <p>Generated at ${escapeHtml(result.generatedAt)} for <code>${escapeHtml(result.targetRoot)}</code>. This report makes compiled mini-program keys like <code>a</code>, <code>b</code>, <code>c</code> readable during development.</p>
</header>
<main>${pageCards || '<p>No pages found.</p>'}</main>
<script>
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  function isDark() {
    if (root.classList.contains('dark')) return true;
    if (root.classList.contains('light')) return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  btn.addEventListener('click', function () {
    var dark = !isDark();
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
    try { localStorage.setItem('umpd-theme', dark ? 'dark' : 'light'); } catch (error) {}
  });
})();
</script>
</body>
</html>`;
}
