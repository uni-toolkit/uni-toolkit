import fs from 'node:fs';
import path from 'node:path';
import type { ProjectAnalysis } from '@uni_toolkit/uniapp-miniprogram-devtool/dist/core.cjs';

const { analyzeProject } = require('@uni_toolkit/uniapp-miniprogram-devtool/dist/core.cjs') as {
  analyzeProject: (targetRoot: string) => ProjectAnalysis;
};

function isMpWeixinRoot(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'app.json')) && fs.existsSync(path.join(dir, 'app.js'));
}

export function resolveTargetDir(projectRoot: string): string {
  const root = path.resolve(projectRoot);
  if (isMpWeixinRoot(root)) return root;
  const candidates = ['unpackage/dist/dev/mp-weixin', 'dist/dev/mp-weixin'];
  for (const candidate of candidates) {
    const dir = path.join(root, candidate);
    if (isMpWeixinRoot(dir)) return dir;
  }
  throw new Error(`在 ${root} 下未找到 mp-weixin 产物目录（已尝试 ${candidates.map((c) => `./${c}`).join('、')}）`);
}

const analysisCache = new Map<string, ProjectAnalysis>();

export function loadAnalysis(targetDir: string, refresh = false): ProjectAnalysis {
  if (!refresh) {
    const cached = analysisCache.get(targetDir);
    if (cached) return cached;
  }
  const analysis = analyzeProject(targetDir);
  analysisCache.set(targetDir, analysis);
  return analysis;
}

export function normalizeRoute(route: string): string {
  const withoutQuery = route.split('?')[0] || route;
  return withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
}

export interface KeymapSummary {
  page: string;
  keys: Array<{ source: string; key: string; kind: string; confidence: string }>;
}

export function summarizeAnalysis(analysis: ProjectAnalysis): KeymapSummary[] {
  return Object.values(analysis.pages).map((page) => ({
    page: page.page,
    keys: page.keys.map((item) => ({
      source: item.sourceName || item.generatedName || 'unknown',
      key: item.key,
      kind: item.kind,
      confidence: item.confidence,
    })),
  }));
}

export interface NamedRow {
  source: string;
  key: string;
  kind: string;
  confidence: string;
  value: unknown;
}

export function buildNamedRows(
  analysis: ProjectAnalysis,
  route: string,
  data: Record<string, unknown>,
): { found: boolean; rows: NamedRow[]; unmappedKeys: string[] } {
  const page = analysis.pages[route];
  const rows: NamedRow[] = [];
  const mappedKeys = new Set<string>();
  if (page) {
    for (const item of page.keys) {
      mappedKeys.add(item.key);
      // 分析结果可能滞后于当前页面数据（源码删了该变量、状态已变化）；
      // data 里不存在该键时不要生成行，否则会报告一个快照中不存在的 key（value: undefined）
      if (!Object.hasOwn(data, item.key)) continue;
      rows.push({
        source: item.sourceName || item.generatedName || 'unknown',
        key: item.key,
        kind: item.kind,
        confidence: item.confidence,
        value: data[item.key],
      });
    }
  }
  const unmappedKeys = Object.keys(data).filter((key) => !mappedKeys.has(key) && key !== '__webviewId__');
  return { found: Boolean(page), rows, unmappedKeys };
}
