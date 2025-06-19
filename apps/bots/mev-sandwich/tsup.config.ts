import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  target: 'node18',
  external: [
    // Keep external dependencies to reduce bundle size
    'axios',
    'ethers',
    '@solana/web3.js',
    '@flashbots/ethers-provider-bundle',
    'winston',
    'dotenv',
    'better-sqlite3',
    'ws'
  ]
});