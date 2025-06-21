module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.config.js', '*.config.ts'],
  rules: {
    'no-console': 'warn', // Allow console for simulation logging
    '@typescript-eslint/no-explicit-any': 'warn', // Allow any for trading simulation
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error',
    'no-magic-numbers': ['warn', { 
      ignore: [-1, 0, 1, 2, 4, 5, 6, 9, 10, 16, 20, 36, 40, 50, 60, 100, 1000, 10000, 60000, 100000, 150000, 2000, 20e-9, 0.001, 0.01, 0.02, 0.1, 0.15, 0.2, 0.3, 0.5, 1.2, 1.5, 5000], // Trading simulation constants
      ignoreArrayIndexes: true,
      ignoreDefaultValues: true
    }]
  }
}; 