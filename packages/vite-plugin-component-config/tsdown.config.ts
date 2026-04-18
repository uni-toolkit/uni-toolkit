import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  target: false,
  fixedExtension: false,
  deps: {
    alwaysBundle: ['rattail'],
  },
});
