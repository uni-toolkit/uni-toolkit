import type { UnpluginFactory } from 'unplugin';
import type { Options } from './types';
import { createUnplugin } from 'unplugin';
import type { OutputAsset, OutputChunk } from 'rollup';
import { createFilter } from '@rollup/pluginutils';
import path from 'node:path';

export const unpluginFactory: UnpluginFactory<Options | undefined> = (
  options = {
    includes: ['**/*.json'],
    excludes: ['pages.json', '**/uni_modules/**/*.json'],
  },
) => {
  const jsonFiles = new Set<string>();
  const inputDir = process.env.UNI_INPUT_DIR;
  return {
    name: 'unplugin-json-optimization',
    enforce: 'post',
    load(id) {
      if (!id.endsWith('.json') || !createFilter(options.includes, options.excludes)(id)) {
        return null;
      }
      if (!jsonFiles.has(id)) {
        jsonFiles.add(id);
      }
    },
    generateBundle(_: unknown, bundle: Record<string, OutputChunk | OutputAsset>) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        // 仅处理根目录下编译过的 JSON 文件，避免 json 文件和页面 js 文件合并
        if (chunk.type !== 'chunk' || !chunk.moduleIds || !chunk.moduleIds.length || fileName.includes('/')) {
          continue;
        }
        const id = chunk.moduleIds.find((id) => jsonFiles.has(id));
        if (id) {
          const relativePath = path.relative(inputDir!, id);
          const { dir, name } = path.parse(relativePath);
          chunk.fileName = `${path.join(dir, name)}.js`;
        }
      }
    },
  };
};

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory);

export default unplugin;
