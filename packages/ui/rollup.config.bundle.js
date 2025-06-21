/**
 * Rollup Bundle Configuration for Trading Bot UI Library
 * 
 * Optimized bundle configuration for creating minified, production-ready bundles
 * with advanced optimization, code splitting, and tree shaking.
 */

import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import analyze from 'rollup-plugin-analyzer';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  input: 'index.tsx',
  output: [
    {
      file: 'dist/index.bundle.js',
      format: 'umd',
      name: 'TradingBotUI',
      sourcemap: true,
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM'
      }
    },
    {
      file: 'dist/index.bundle.min.js',
      format: 'umd',
      name: 'TradingBotUI',
      sourcemap: true,
      plugins: [terser()],
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM'
      }
    }
  ],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      declaration: false,
      declarationMap: false,
      outDir: 'dist',
      compilerOptions: {
        declarationDir: undefined,
        declaration: false
      }
    }),
    postcss({
      extract: 'styles.css',
      minimize: true,
      sourceMap: true
    }),
    analyze({
      summaryOnly: true,
      skipFormatted: false
    }),
    visualizer({
      filename: 'dist/bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  external: ['react', 'react-dom'],
  treeshake: {
    preset: 'recommended',
    moduleSideEffects: false
  }
}); 