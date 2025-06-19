import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // Disable type declarations temporarily
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node18',
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
  outDir: 'dist',
  banner: {
    js: '// Multi-chain RPC Infrastructure\n// Built with tsup'
  }
});