import path from 'node:path';

export function getOutputJsonPath(filePath: string) {
  const relativePath = path.relative(process.env.UNI_INPUT_DIR!, filePath);
  const { name, dir } = path.parse(relativePath);

  return path.join(process.env.UNI_OUTPUT_DIR!, dir, `${name}.json`);
}

export function isMiniProgram() {
  return process.env.UNI_PLATFORM?.startsWith('mp-');
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export interface VueQuery {
  vue?: boolean;
  src?: boolean;
  type?: 'script' | 'template' | 'style' | 'custom' | 'page';
  index?: number;
  lang?: string;
  raw?: boolean;
  setup?: boolean;
  'lang.ts'?: string;
  'lang.js'?: string;
}

export function parseVueRequest(id: string) {
  const [filename, rawQuery] = id.split(`?`, 2);
  const query = Object.fromEntries(new URLSearchParams(rawQuery)) as VueQuery;
  if (query.vue != null) {
    query.vue = true;
  }
  if (query.src != null) {
    query.src = true;
  }
  if (query.index != null) {
    query.index = Number(query.index);
  }
  if (query.raw != null) {
    query.raw = true;
  }
  return {
    filename,
    query,
  };
}
