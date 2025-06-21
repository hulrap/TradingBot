import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  treeshake: true,
  platform: 'node',
  external: [
    'crypto',
    'bcryptjs',
    'jose'
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '"use strict";'
    };
  }
}); 