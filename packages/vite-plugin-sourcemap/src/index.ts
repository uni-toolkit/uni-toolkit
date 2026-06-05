import type { PluginOption, UserConfig } from 'vite';

export interface VitePluginSourcemapOptions {
  mode?: 'development' | 'production';
}

export default function vitePluginSourcemap(
  options: VitePluginSourcemapOptions = { mode: 'development' },
): PluginOption {
  return {
    name: 'vite-plugin-sourcemap',
    apply: 'build',
    config(config): UserConfig {
      if (process.env.UNI_PLATFORM?.startsWith('mp-')) {
        config.build!.sourcemap = options.mode === process.env.NODE_ENV;
      }
      return config;
    },
  };
}
