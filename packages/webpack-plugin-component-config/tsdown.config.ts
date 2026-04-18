import { defineConfig } from 'tsdown';

export default defineConfig({
  target: false,
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  fixedExtension: false,
  outputOptions: {
    exports: 'named',
  },
  deps: {
    alwaysBundle: ['rattail']
  }
});
