import { defineConfig } from 'tsdown'

export default defineConfig({
  target: false,
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  fixedExtension: false,
  deps: {
    onlyBundle: ['lodash-es'],
    alwaysBundle: ['lodash-es'],
  },
  outputOptions: {
    exports: 'named',
  },
})
