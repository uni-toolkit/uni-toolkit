import fs from 'node:fs';
import {
  getOutputJsonPath,
  isMiniProgram,
  matchComponentConfigs,
  removeComponentConfigs,
  removeComponentConfigTags,
  resolvePlatformConfig,
} from '@uni_toolkit/shared';
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
      const matches = matchComponentConfigs(code);
      if (!matches) {
        return;
      }

      matches.forEach((match) => {
        const content = removeComponentConfigTags(match);
        const componentConfig = resolvePlatformConfig(JSON.parse(content));
        map.set(getOutputJsonPath(id), componentConfig);
      });

      return removeComponentConfigs(code);
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
