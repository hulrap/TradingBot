module.exports = {
  root: true,
  extends: [
    '@trading-bot/config/eslint-preset'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: './tsconfig.json'
  },
  env: {
    node: true,
    es2022: true
  },
  rules: {
    // Security-focused rules for crypto package
    'no-console': ['warn', { allow: ['error'] }],
    'no-debugger': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off', // Too restrictive for crypto operations
    'prefer-const': 'error',
    'no-var': 'error'
  },
  ignorePatterns: [
    'dist/**/*',
    'node_modules/**/*',
    '*.js'
  ]
}; 