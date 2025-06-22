module.exports = {
  root: false, // Not root since bot folder is the workspace root
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'jsdoc',
    'prefer-arrow'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    // TypeScript specific rules - more practical
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/explicit-function-return-type': 'off', // Too strict for large codebases
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Too strict for large codebases
    '@typescript-eslint/no-explicit-any': 'warn', // Keep as warning, not error
    '@typescript-eslint/no-non-null-assertion': 'warn', // Warning instead of error
    '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Warning instead of error
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'off', // Too strict, causes many false positives
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/prefer-readonly': 'warn',
    
    // Import organization - simplified
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    'import/no-unused-modules': 'off', // Too aggressive for utilities package
    'import/no-cycle': ['error', { maxDepth: 10 }],
    'import/no-self-import': 'error',
    
    // JSDoc requirements - relaxed for productivity
    'jsdoc/require-jsdoc': [
      'warn',
      {
        require: {
          FunctionDeclaration: false, // Don't require for all functions
          ClassDeclaration: true,
          MethodDefinition: false, // Don't require for all methods
          ArrowFunctionExpression: false,
          FunctionExpression: false
        },
        contexts: [
          'ExportNamedDeclaration[declaration.type="FunctionDeclaration"]' // Only for exported functions
        ]
      }
    ],
    'jsdoc/require-description': 'off', // Too strict
    'jsdoc/require-param': 'off', // Too strict
    'jsdoc/require-param-description': 'off', // Too strict
    'jsdoc/require-returns': 'off', // Too strict
    'jsdoc/require-returns-description': 'off', // Too strict
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-types': 'error',
    
    // Arrow function preferences - relaxed
    'prefer-arrow/prefer-arrow-functions': 'off', // Too strict, allow regular functions
    
    // General code quality
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'warn',
    'object-shorthand': 'warn',
    'prefer-destructuring': ['warn', { object: true, array: false }],
    
    // Performance and best practices
    'no-loop-func': 'error',
    'no-new-object': 'error',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Consistency - relaxed
    'consistent-return': 'warn',
    'default-case': 'warn',
    'eqeqeq': ['error', 'always'],
    'no-else-return': 'warn',
    'no-return-assign': 'error',
    'no-useless-return': 'warn'
  },
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    '*.js',
    '*.d.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
    '.eslintrc.js'
  ],
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'jsdoc/require-jsdoc': 'off'
      }
    }
  ]
}; 