import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/*.ts'],
  format: ['cjs', 'esm'],
  clean: true,
  outDir: 'dist',
  dts: true,
})