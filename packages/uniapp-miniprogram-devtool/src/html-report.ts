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
<title>uniappx keymap report</title>
<style>
:root { --ink:#18231f; --muted:#68736d; --paper:#f7f0df; --card:#fffaf0; --line:#dfd3b9; --green:#1f7a54; --amber:#a66b00; --red:#a43b32; }
* { box-sizing: border-box; }
body { margin:0; color:var(--ink); background:radial-gradient(circle at 20% 0%, #d8f0c8 0, transparent 28rem), linear-gradient(135deg, #f7f0df, #efe1c1); font:15px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
header { padding:42px clamp(20px, 5vw, 70px) 24px; }
h1 { margin:0 0 8px; font:800 clamp(32px, 6vw, 72px)/.95 Georgia, 'Times New Roman', serif; letter-spacing:-.05em; }
header p { margin:0; color:var(--muted); max-width:900px; }
main { padding:0 clamp(20px, 5vw, 70px) 60px; display:grid; gap:22px; }
.card { background:rgba(255,250,240,.92); border:1px solid var(--line); border-radius:24px; box-shadow:0 22px 70px rgba(61,44,15,.12); overflow:hidden; }
.card-title { display:flex; justify-content:space-between; gap:16px; align-items:flex-end; padding:22px 24px; border-bottom:1px solid var(--line); }
h2 { margin:0; font:700 26px/1.1 Georgia, 'Times New Roman', serif; }
.card-title span, .muted { color:var(--muted); }
table { width:100%; border-collapse:collapse; }
th, td { text-align:left; vertical-align:top; padding:14px 16px; border-bottom:1px solid #eadfc7; }
th { font-size:12px; text-transform:uppercase; color:var(--muted); letter-spacing:.08em; }
code { background:#f0e5cd; border:1px solid #e1d2b6; border-radius:7px; padding:2px 5px; white-space:pre-wrap; word-break:break-word; }
.key { display:inline-grid; place-items:center; min-width:34px; min-height:34px; border-radius:12px; background:var(--ink); color:var(--paper); font-weight:800; }
.pill { display:inline-block; border-radius:999px; padding:3px 9px; color:white; font-size:12px; }
.pill.high { background:var(--green); } .pill.medium { background:var(--amber); } .pill.low { background:var(--red); } .pill.generated { background:#4d665b; }
details { padding:16px 24px 24px; }
summary { cursor:pointer; color:var(--green); font-weight:700; }
pre { overflow:auto; background:#1e2924; color:#f8f0dc; border-radius:16px; padding:18px; }
@media (max-width: 760px) { .card-title { display:block; } table, thead, tbody, tr, th, td { display:block; } thead { display:none; } td { border-bottom:0; padding:8px 16px; } tr { border-bottom:1px solid var(--line); padding:10px 0; } }
</style>
</head>
<body>
<header>
  <h1>uniappx keymap</h1>
  <p>Generated at ${escapeHtml(result.generatedAt)} for <code>${escapeHtml(result.targetRoot)}</code>. This report makes compiled mini-program keys like <code>a</code>, <code>b</code>, <code>c</code> readable during development.</p>
</header>
<main>${pageCards || '<p>No pages found.</p>'}</main>
</body>
</html>`;
}
