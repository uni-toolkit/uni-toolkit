import fs from 'node:fs';
import path from 'node:path';

export type Confidence = 'high' | 'medium' | 'low' | 'generated';

export interface SourceMapInfo {
  path: string;
  sources: string[];
  sourcesContent: string[];
  names: string[];
}

export interface WxmlUsage {
  index: number;
  snippet: string;
}

export interface TemplateAttribute {
  name: string;
  value: string;
}

export interface TemplateNode {
  id: string;
  tag: string;
  kind: 'element' | 'component' | 'text';
  snippet: string;
  keyRefs: string[];
  attrs: TemplateAttribute[];
  text: string | null;
  children: TemplateNode[];
}

export interface KeyMapItem {
  key: string;
  sourceName: string | null;
  generatedName: string | null;
  kind: string;
  confidence: Confidence;
  expressionSummary: string;
  expression: string;
  wxmlUsages: WxmlUsage[];
}

export interface PageAnalysis {
  page: string;
  jsFile: string;
  wxmlFile: string | null;
  sourceMap: SourceMapInfo | null;
  keys: KeyMapItem[];
  templateTree: TemplateNode | null;
}

export interface ProjectAnalysis {
  tool: 'uniappx-keymap-devtools';
  version: string;
  targetRoot: string;
  generatedAt: string;
  pages: Record<string, PageAnalysis>;
}

interface GeneratedPattern {
  re: RegExp;
  name: string;
  kind: string;
}

interface ParsedProperty {
  key: string;
  expression: string;
}

interface InferredExpression {
  sourceName: string | null;
  generatedName: string | null;
  kind: string;
  confidence: Confidence;
  expressionSummary: string;
}

const TEMPLATE_EXTENSIONS = ['.wxml'];
const NATIVE_TEMPLATE_TAGS = new Set([
  'view',
  'text',
  'image',
  'button',
  'input',
  'textarea',
  'scroll-view',
  'swiper',
  'swiper-item',
  'icon',
  'progress',
  'rich-text',
  'checkbox',
  'checkbox-group',
  'radio',
  'radio-group',
  'switch',
  'slider',
  'picker',
  'picker-view',
  'picker-view-column',
  'navigator',
  'form',
  'label',
  'map',
  'canvas',
  'camera',
  'video',
  'live-player',
  'live-pusher',
  'movable-area',
  'movable-view',
  'cover-view',
  'cover-image',
  'slot',
  'block',
  'template',
  'ad',
  'open-data',
  'official-account',
  'editor',
  'page-meta',
  'navigation-bar',
  'match-media',
  'sticky-section',
  'sticky-header',
]);

const GENERATED_PATTERNS: GeneratedPattern[] = [
  {
    re: /\bsei\s*\(\s*common_vendor\.gei|common_vendor\.sei\s*\(\s*common_vendor\.gei|\bgei\s*\(/,
    name: 'generated element id',
    kind: 'element-id',
  },
  { re: /common_assets\._imports_\d+|\b_imports_\d+\b/, name: 'generated static asset', kind: 'static-asset' },
  { re: /u_s_b_h/, name: 'generated CSS var --status-bar-height', kind: 'css-var' },
  { re: /u_s_a_i_b/, name: 'generated CSS var --uni-safe-area-inset-bottom', kind: 'css-var' },
  { re: /virtualHostClass/, name: 'generated virtualHostClass', kind: 'virtual-host-class' },
  { re: /virtualHostStyle/, name: 'generated virtualHostStyle', kind: 'virtual-host-style' },
  { re: /virtualHostHidden/, name: 'generated virtualHostHidden', kind: 'virtual-host-hidden' },
];

function walkFiles(root: string, predicate?: (file: string) => boolean): string[] {
  const output: string[] = [];
  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (!predicate || predicate(full)) output.push(full);
    }
  }
  walk(root);
  return output;
}

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join('/');
}

function stripJsComments(input: string): string {
  let output = '';
  let state: 'normal' | 'line' | 'block' | '"' | "'" | '`' = 'normal';

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];
    const next = input[index + 1];

    if (state === 'normal') {
      if (ch === '/' && next === '/') {
        state = 'line';
        output += '  ';
        index += 1;
      } else if (ch === '/' && next === '*') {
        state = 'block';
        output += '  ';
        index += 1;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        state = ch;
        output += ch;
      } else {
        output += ch;
      }
    } else if (state === 'line') {
      if (ch === '\n') {
        state = 'normal';
        output += ch;
      } else {
        output += ' ';
      }
    } else if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'normal';
        output += '  ';
        index += 1;
      } else {
        output += ch === '\n' ? '\n' : ' ';
      }
    } else {
      output += ch;
      if (ch === '\\') {
        index += 1;
        output += input[index] || '';
      } else if (ch === state) {
        state = 'normal';
      }
    }
  }
  return output;
}

function findMatchingBrace(input: string, openIndex: number): number {
  let depth = 0;
  let state: 'normal' | '"' | "'" | '`' = 'normal';

  for (let index = openIndex; index < input.length; index += 1) {
    const ch = input[index];
    if (state === 'normal') {
      if (ch === '"' || ch === "'" || ch === '`') state = ch;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return index;
      }
    } else if (ch === '\\') {
      index += 1;
    } else if (ch === state) {
      state = 'normal';
    }
  }
  return -1;
}

export function extractReturnedObject(js: string): string | null {
  const marker = 'const __returned__ =';
  const start = js.indexOf(marker);
  if (start !== -1) {
    const open = js.indexOf('{', start + marker.length);
    if (open === -1) return null;
    const close = findMatchingBrace(js, open);
    if (close === -1) return null;
    return js.slice(open + 1, close);
  }
  return extractRenderReturnObject(js) || extractSetupRenderReturnObject(js);
}

function extractRenderReturnObject(js: string): string | null {
  const marker = 'function _sfc_render';
  const start = js.indexOf(marker);
  if (start === -1) return null;

  const open = js.indexOf('{', start + marker.length);
  if (open === -1) return null;
  const close = findMatchingBrace(js, open);
  if (close === -1) return null;

  const body = js.slice(open + 1, close);
  let state: 'normal' | '"' | "'" | '`' = 'normal';
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;

  for (let index = 0; index < body.length; index += 1) {
    const ch = body[index];
    if (state === 'normal') {
      if (ch === '"' || ch === "'" || ch === '`') {
        state = ch;
      } else if (ch === '(') {
        depthParen += 1;
      } else if (ch === ')') {
        depthParen -= 1;
      } else if (ch === '[') {
        depthBracket += 1;
      } else if (ch === ']') {
        depthBracket -= 1;
      } else if (ch === '{') {
        depthBrace += 1;
      } else if (ch === '}') {
        depthBrace -= 1;
      } else if (
        depthParen === 0 &&
        depthBracket === 0 &&
        depthBrace === 0 &&
        body.startsWith('return', index) &&
        !/[A-Za-z0-9_$]/.test(body[index - 1] || '') &&
        !/[A-Za-z0-9_$]/.test(body[index + 6] || '')
      ) {
        let probe = index + 6;
        while (/\s/.test(body[probe] || '')) probe += 1;
        if (body[probe] !== '{') return null;
        const returnClose = findMatchingBrace(body, probe);
        if (returnClose === -1) return null;
        return body.slice(probe + 1, returnClose);
      }
    } else if (ch === '\\') {
      index += 1;
    } else if (ch === state) {
      state = 'normal';
    }
  }

  return null;
}

function extractSetupRenderReturnObject(js: string): string | null {
  const re = /return\s*\([^)]*\)\s*=>\s*\{/g;
  let match: RegExpExecArray | null = re.exec(js);

  while (match) {
    const currentMatch = match;
    match = re.exec(js);
    const open = js.indexOf('{', currentMatch.index);
    if (open === -1) continue;
    const close = findMatchingBrace(js, open);
    if (close === -1) continue;
    const body = js.slice(open + 1, close);
    const returned = extractTopLevelReturnObject(body);
    if (returned) return returned;
  }

  return null;
}

function extractTopLevelReturnObject(body: string): string | null {
  let state: 'normal' | '"' | "'" | '`' = 'normal';
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;

  for (let index = 0; index < body.length; index += 1) {
    const ch = body[index];
    if (state === 'normal') {
      if (ch === '"' || ch === "'" || ch === '`') {
        state = ch;
      } else if (ch === '(') {
        depthParen += 1;
      } else if (ch === ')') {
        depthParen -= 1;
      } else if (ch === '[') {
        depthBracket += 1;
      } else if (ch === ']') {
        depthBracket -= 1;
      } else if (ch === '{') {
        depthBrace += 1;
      } else if (ch === '}') {
        depthBrace -= 1;
      } else if (
        depthParen === 0 &&
        depthBracket === 0 &&
        depthBrace === 0 &&
        body.startsWith('return', index) &&
        !/[A-Za-z0-9_$]/.test(body[index - 1] || '') &&
        !/[A-Za-z0-9_$]/.test(body[index + 6] || '')
      ) {
        let probe = index + 6;
        while (/\s/.test(body[probe] || '')) probe += 1;
        if (body[probe] !== '{') continue;
        const returnClose = findMatchingBrace(body, probe);
        if (returnClose === -1) return null;
        return body.slice(probe + 1, returnClose);
      }
    } else if (ch === '\\') {
      index += 1;
    } else if (ch === state) {
      state = 'normal';
    }
  }

  return null;
}

export function splitTopLevelProperties(body: string): string[] {
  const props: string[] = [];
  let state: 'normal' | '"' | "'" | '`' = 'normal';
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let start = 0;

  function push(end: number): void {
    const part = body.slice(start, end).trim();
    if (part) props.push(part);
    start = end + 1;
  }

  for (let index = 0; index < body.length; index += 1) {
    const ch = body[index];
    if (state === 'normal') {
      if (ch === '"' || ch === "'" || ch === '`') state = ch;
      else if (ch === '(') depthParen += 1;
      else if (ch === ')') depthParen -= 1;
      else if (ch === '{') depthBrace += 1;
      else if (ch === '}') depthBrace -= 1;
      else if (ch === '[') depthBracket += 1;
      else if (ch === ']') depthBracket -= 1;
      else if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) push(index);
    } else if (ch === '\\') {
      index += 1;
    } else if (ch === state) {
      state = 'normal';
    }
  }
  push(body.length);
  return props;
}

export function parseProperty(part: string): ParsedProperty | null {
  let state: 'normal' | '"' | "'" | '`' = 'normal';
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;

  for (let index = 0; index < part.length; index += 1) {
    const ch = part[index];
    if (state === 'normal') {
      if (ch === '"' || ch === "'" || ch === '`') state = ch;
      else if (ch === '(') depthParen += 1;
      else if (ch === ')') depthParen -= 1;
      else if (ch === '{') depthBrace += 1;
      else if (ch === '}') depthBrace -= 1;
      else if (ch === '[') depthBracket += 1;
      else if (ch === ']') depthBracket -= 1;
      else if (ch === ':' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
        const rawKey = part.slice(0, index).trim();
        const key = rawKey.replace(/^['"]|['"]$/g, '');
        return { key, expression: part.slice(index + 1).trim() };
      }
    } else if (ch === '\\') {
      index += 1;
    } else if (ch === state) {
      state = 'normal';
    }
  }
  return null;
}

function extractSetupBindings(js: string): Set<string> {
  const names = new Set<string>();
  const blocked = new Set(['__returned__', 'common_vendor', '_sfc_main']);
  const variableRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g;
  const functionRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let match: RegExpExecArray | null = variableRe.exec(js);

  while (match) {
    if (!blocked.has(match[1])) names.add(match[1]);
    match = variableRe.exec(js);
  }
  match = functionRe.exec(js);
  while (match) {
    if (!blocked.has(match[1])) names.add(match[1]);
    match = functionRe.exec(js);
  }
  return names;
}

export function inferFromExpression(expression: string, setupBindings: Set<string>): InferredExpression {
  const normalized = expression.replace(/\s+/g, ' ');
  for (const item of GENERATED_PATTERNS) {
    if (item.re.test(expression)) {
      return {
        sourceName: null,
        generatedName: item.name,
        kind: item.kind,
        confidence: 'generated',
        expressionSummary: normalized,
      };
    }
  }

  const eventMatch = expression.match(/(?:\bcommon_vendor\.)?\bo\s*\(/);
  if (eventMatch) {
    return {
      sourceName: inferEventSourceName(expression),
      generatedName: 'event handler',
      kind: 'event-handler',
      confidence: 'high',
      expressionSummary: normalized,
    };
  }

  const unrefMatch = expression.match(/(?:common_vendor\.)?unref\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/);
  if (unrefMatch) {
    return {
      sourceName: unrefMatch[1],
      generatedName: null,
      kind: 'binding',
      confidence: 'high',
      expressionSummary: normalized,
    };
  }

  const refValueMatch = expression.match(/\b([A-Za-z_$][\w$]*)\.value\b/);
  if (refValueMatch && setupBindings.has(refValueMatch[1])) {
    return {
      sourceName: refValueMatch[1],
      generatedName: null,
      kind: 'binding',
      confidence: 'high',
      expressionSummary: normalized,
    };
  }

  const instanceValueMatch = expression.match(/\$(?:data|setup|props|options)\.([A-Za-z_$][\w$]*)/);
  if (instanceValueMatch) {
    return {
      sourceName: instanceValueMatch[1],
      generatedName: null,
      kind: 'binding',
      confidence: 'high',
      expressionSummary: normalized,
    };
  }

  const directNames: string[] = [];
  for (const name of setupBindings) {
    const re = new RegExp(`(^|[^\\w$])${escapeRegExp(name)}([^\\w$]|$)`);
    if (re.test(expression)) directNames.push(name);
  }

  if (directNames.length === 1) {
    return {
      sourceName: directNames[0],
      generatedName: null,
      kind: 'binding',
      confidence: 'medium',
      expressionSummary: normalized,
    };
  }

  if (directNames.length > 1) {
    return {
      sourceName: directNames.join(', '),
      generatedName: null,
      kind: 'expression',
      confidence: 'medium',
      expressionSummary: normalized,
    };
  }

  return {
    sourceName: null,
    generatedName: null,
    kind: 'unknown',
    confidence: 'low',
    expressionSummary: normalized,
  };
}

function inferEventSourceName(expression: string): string | null {
  const directMatch = expression.match(/(?:\bcommon_vendor\.)?\bo\s*\(\s*([A-Za-z_$][\w$]*)/);
  if (directMatch) return directMatch[1];

  const methodMatch = expression.match(/\$(?:options|setup|ctx)\.([A-Za-z_$][\w$]*)/);
  if (methodMatch) return methodMatch[1];

  const assignmentMatch = expression.match(/\$data\.([A-Za-z_$][\w$]*)\s*=/);
  if (assignmentMatch) return `${assignmentMatch[1]} setter`;

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findWxmlUsages(wxml: string, key: string): WxmlUsage[] {
  if (!wxml) return [];
  const usages: WxmlUsage[] = [];
  const re = new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(key)}([^A-Za-z0-9_$]|$)`, 'g');
  let match: RegExpExecArray | null = re.exec(wxml);

  while (match) {
    const index = match.index + match[1].length;
    const start = Math.max(0, index - 45);
    const end = Math.min(wxml.length, index + key.length + 45);
    const snippet = wxml.slice(start, end).replace(/\s+/g, ' ').trim();
    usages.push({ index, snippet });
    if (usages.length >= 8) break;
    match = re.exec(wxml);
  }
  return usages;
}

function isTemplateEventAttribute(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    normalized.startsWith('bind') ||
    normalized.startsWith('catch') ||
    normalized.startsWith('capture-bind') ||
    normalized.startsWith('capture-catch') ||
    normalized.startsWith('mut-bind') ||
    normalized.startsWith('@')
  );
}

function stripTemplateEventAttributes(wxml: string): string {
  return wxml.replace(/<[^>]+>/g, (tag) =>
    tag.replace(/\s+([:@A-Za-z0-9._-]+)(?:=(?:"[^"]*"|'[^']*'))?/g, (attribute, name: string) =>
      isTemplateEventAttribute(name) ? '' : attribute,
    ),
  );
}

function inferEventSourceNameFromUsages(usages: WxmlUsage[], key: string): string | null {
  const keyPattern = escapeRegExp(key);
  for (const usage of usages) {
    const match = usage.snippet.match(
      new RegExp(`\\b(?:capture-)?(?:bind|catch|mut-bind)([A-Za-z0-9_-]*)\\s*=\\s*["']\\{\\{${keyPattern}\\}\\}`),
    );
    if (match) return match[1] ? `${match[1]} event` : 'event handler';
  }
  return null;
}

function extractTemplateKeyRefs(source: string, keys: string[]): string[] {
  const matched = new Set<string>();
  for (const key of keys) {
    const re = new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(key)}([^A-Za-z0-9_$]|$)`);
    if (re.test(source)) matched.add(key);
  }
  return Array.from(matched);
}

function normalizeSnippet(value: string, limit = 120): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function classifyTemplateTag(tag: string): 'element' | 'component' {
  return NATIVE_TEMPLATE_TAGS.has(tag) ? 'element' : 'component';
}

function parseTemplateAttributes(source: string): TemplateAttribute[] {
  const attrs: TemplateAttribute[] = [];
  const attrSource = source.replace(/^<[^/\s>]+/, '').replace(/\/?>$/, '');
  const re = /([:@A-Za-z0-9._-]+)(?:=(?:"([^"]*)"|'([^']*)'))?/g;
  let match: RegExpExecArray | null = re.exec(attrSource);
  while (match) {
    if (!isTemplateEventAttribute(match[1])) {
      attrs.push({
        name: match[1],
        value: match[2] ?? match[3] ?? '',
      });
    }
    match = re.exec(attrSource);
  }
  return attrs;
}

function parseTemplateTree(wxml: string, keys: KeyMapItem[]): TemplateNode | null {
  if (!wxml.trim()) return null;

  const keyNames = keys.map((item) => item.key);
  const root: TemplateNode = {
    id: 'root',
    tag: 'page',
    kind: 'element',
    snippet: 'page',
    keyRefs: [],
    attrs: [],
    text: null,
    children: [],
  };
  const stack: TemplateNode[] = [root];
  const tokenRe = /<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g;
  let match: RegExpExecArray | null = tokenRe.exec(wxml);
  let counter = 0;

  while (match) {
    const token = match[0];
    if (!token || token.startsWith('<!--')) {
      match = tokenRe.exec(wxml);
      continue;
    }

    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop();
      match = tokenRe.exec(wxml);
      continue;
    }

    if (token.startsWith('<')) {
      const tagMatch = token.match(/^<\s*([^\s/>]+)/);
      if (!tagMatch) {
        match = tokenRe.exec(wxml);
        continue;
      }
      const tag = tagMatch[1];
      counter += 1;
      const node: TemplateNode = {
        id: `node-${counter}`,
        tag,
        kind: classifyTemplateTag(tag),
        snippet: normalizeSnippet(token),
        keyRefs: extractTemplateKeyRefs(token, keyNames),
        attrs: parseTemplateAttributes(token),
        text: null,
        children: [],
      };
      stack[stack.length - 1].children.push(node);
      if (!/\/>$/.test(token) && !token.startsWith('<input')) stack.push(node);
      match = tokenRe.exec(wxml);
      continue;
    }

    const text = normalizeSnippet(token, 80);
    if (!text) {
      match = tokenRe.exec(wxml);
      continue;
    }
    counter += 1;
    stack[stack.length - 1].children.push({
      id: `node-${counter}`,
      tag: '#text',
      kind: 'text',
      snippet: text,
      keyRefs: extractTemplateKeyRefs(token, keyNames),
      attrs: [],
      text,
      children: [],
    });
    match = tokenRe.exec(wxml);
  }

  return root;
}

function readSourceMap(targetRoot: string, jsFile: string): SourceMapInfo | null {
  const js = fs.readFileSync(jsFile, 'utf8');
  const match = js.match(/\/\/# sourceMappingURL=(.+)$/m);
  if (!match) return null;

  const mapPath = path.resolve(path.dirname(jsFile), match[1]);
  if (!mapPath.startsWith(path.dirname(targetRoot)) || !fs.existsSync(mapPath)) return null;

  try {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8')) as Partial<SourceMapInfo>;
    return {
      path: normalizeSlashes(path.relative(targetRoot, mapPath)),
      sources: Array.isArray(map.sources) ? map.sources : [],
      sourcesContent: Array.isArray(map.sourcesContent) ? map.sourcesContent : [],
      names: Array.isArray(map.names) ? map.names : [],
    };
  } catch (_error) {
    return null;
  }
}

function findTemplateFile(jsFile: string): string | null {
  for (const extension of TEMPLATE_EXTENSIONS) {
    const file = jsFile.replace(/\.js$/, extension);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

export function analyzePage(targetRoot: string, jsFile: string): PageAnalysis {
  const js = fs.readFileSync(jsFile, 'utf8');
  const jsNoComments = stripJsComments(js);
  const relJs = normalizeSlashes(path.relative(targetRoot, jsFile));
  const page = relJs.replace(/\.js$/, '');
  const wxmlFile = findTemplateFile(jsFile);
  const wxml = wxmlFile ? fs.readFileSync(wxmlFile, 'utf8') : '';
  const displayWxml = stripTemplateEventAttributes(wxml);
  const sourceMap = readSourceMap(targetRoot, jsFile);
  const setupBindings = extractSetupBindings(jsNoComments);
  const body = extractReturnedObject(jsNoComments);
  const keys: KeyMapItem[] = [];

  if (body) {
    for (const part of splitTopLevelProperties(body)) {
      const parsed = parseProperty(part);
      if (!parsed || !parsed.key) continue;
      const inferred = inferFromExpression(parsed.expression, setupBindings);
      const wxmlUsages = findWxmlUsages(inferred.kind === 'event-handler' ? wxml : displayWxml, parsed.key);
      const sourceName =
        inferred.sourceName ||
        (inferred.kind === 'event-handler' ? inferEventSourceNameFromUsages(wxmlUsages, parsed.key) : null);
      keys.push({
        key: parsed.key,
        ...inferred,
        sourceName,
        expression: parsed.expression,
        wxmlUsages,
      });
    }
  }

  const templateTree = parseTemplateTree(displayWxml, keys);

  return {
    page,
    jsFile: relJs,
    wxmlFile: wxmlFile ? normalizeSlashes(path.relative(targetRoot, wxmlFile)) : null,
    sourceMap,
    keys,
    templateTree,
  };
}

export function analyzeProject(targetRoot: string): ProjectAnalysis {
  if (!fs.existsSync(targetRoot)) throw new Error(`Target does not exist: ${targetRoot}`);

  const jsFiles = walkFiles(
    targetRoot,
    (file) => file.endsWith('.js') && !file.includes(`${path.sep}common${path.sep}`),
  );
  const pageFiles = jsFiles.filter((file) => {
    const js = fs.readFileSync(file, 'utf8');
    return js.includes('const __returned__ =') || js.includes('function _sfc_render') || !!findTemplateFile(file);
  });

  const pages: Record<string, PageAnalysis> = {};
  for (const file of pageFiles) {
    const page = analyzePage(targetRoot, file);
    pages[page.page] = page;
  }

  return {
    tool: 'uniappx-keymap-devtools',
    version: '0.1.0',
    targetRoot,
    generatedAt: new Date().toISOString(),
    pages,
  };
}
