/**
 * Rollup Configuration for Trading Bot UI Library
 * 
 * Main build configuration for creating optimized ES modules and CommonJS bundles
 * with TypeScript support and external dependency handling.
 */

import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';

export default defineConfig([
  // ES Module build
  {
    input: 'index.tsx',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      peerDepsExternal(),
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
        extract: false,
        minimize: true
      })
    ],
    external: ['react', 'react-dom']
  },
  
  // CommonJS build
  {
    input: 'index.tsx',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      peerDepsExternal(),
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
        extract: false,
        minimize: true
      })
    ],
    external: ['react', 'react-dom']
  },

  // Utils build
  {
    input: 'utils.ts',
    output: [
      {
        file: 'dist/utils.esm.js',
        format: 'esm',
        sourcemap: true
      },
      {
        file: 'dist/utils.js',
        format: 'cjs',
        sourcemap: true
      }
    ],
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      typescript({
        declaration: false,
        declarationMap: false,
        outDir: 'dist',
        compilerOptions: {
          declarationDir: undefined,
          declaration: false
        }
      })
    ]
  }
]); 