import fs from 'node:fs';
import path from 'node:path';
import { parseJson } from '@dcloudio/uni-cli-shared';
import { getOutputJsonPath, isMiniProgram } from '@uni_toolkit/shared';
import { merge } from 'rattail';
import { createFilter, type FilterPattern, type PluginOption } from 'vite';

export interface ComponentConfigPluginOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
  replaceSameKey?: boolean;
}

export default function vitePluginComponentConfig(
  options: ComponentConfigPluginOptions = {
    include: ['**/*.{vue,nvue,uvue}'],
    exclude: [],
  },
): PluginOption {
  const map: Map<string, Record<string, any>> = new Map();
  const replaceSameKey = !!options.replaceSameKey;
  return {
    name: 'vite-plugin-component-config',
    enforce: 'pre',
    transform(code, id) {
      if (!isMiniProgram()) {
        return;
      }
      if (!createFilter(options.include, options.exclude)(id)) {
        return;
      }
      const matches = code.match(/<component-config>([\s\S]*?)<\/component-config>/g);
      if (!matches) {
        return;
      }

      matches.forEach((match) => {
        const content = match.replace(/<component-config>|<\/component-config>/g, '');
        const componentConfig = parseJson(content.toString(), true, path.basename(id));
        map.set(getOutputJsonPath(id), componentConfig);
      });

      return code.replace(/<component-config>[\s\S]*?<\/component-config>/g, '');
    },
    closeBundle() {
      if (map.size === 0) {
        return;
      }
      for (const [outputPath, config] of map) {
        if (!fs.existsSync(outputPath)) {
          continue;
        }
        const content = fs.readFileSync(outputPath, 'utf-8');
        const json = JSON.parse(content);
        const result = replaceSameKey ? { ...json, ...config } : merge(json, config);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      }
    },
  };
}
