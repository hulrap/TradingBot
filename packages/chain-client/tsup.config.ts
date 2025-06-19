import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  external: [
    'winston',
    'axios',
    'ws',
    'ethers',
    '@solana/web3.js',
    'p-queue',
    'p-retry'
  ],
  treeshake: true,
  minify: false, // Keep readable for debugging
  target: 'node18',
  outDir: 'dist',
  banner: {
    js: '// Multi-chain RPC Infrastructure\n// Built with tsup'
  }
});