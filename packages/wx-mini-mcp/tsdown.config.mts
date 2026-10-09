import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  fixedExtension: false,
});
