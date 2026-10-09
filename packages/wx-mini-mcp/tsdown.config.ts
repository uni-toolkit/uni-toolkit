import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outDir: 'build',
  clean: true,
  sourcemap: true,
  fixedExtension: false,
});
