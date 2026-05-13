import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/*.ts',
  ],
  format: 'cjs',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
});
