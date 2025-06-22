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
    'jsdoc'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'prettier'
  ],
  rules: {
    // ========================================
    // STRICT TYPE SAFETY (ENHANCED)
    // ========================================
    '@typescript-eslint/no-explicit-any': 'error', // Upgraded from warn
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    
    // Enhanced type checking
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowString: false,
        allowNumber: false,
        allowNullableObject: false,
        allowNullableBoolean: false,
        allowNullableString: false,
        allowNullableNumber: false,
        allowAny: false
      }
    ],
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-unnecessary-type-constraint': 'error',
    '@typescript-eslint/no-redundant-type-constituents': 'error',
    
    // ========================================
    // CRITICAL TYPE DEFINITION RULES
    // ========================================
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'error', // Re-enabled for types
    '@typescript-eslint/no-empty-interface': [
      'error',
      {
        allowSingleExtends: true // Allow extending for type composition
      }
    ],
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: {
          'Function': {
            message: 'Prefer specific function type, e.g. `() => void`.',
            fixWith: '() => void'
          },
          'Object': {
            message: 'Prefer specific object type, e.g. `Record<string, unknown>`.',
            fixWith: 'Record<string, unknown>'
          },
          '{}': {
            message: 'Prefer specific object type, e.g. `Record<string, unknown>`.',
            fixWith: 'Record<string, unknown>'
          },
          'object': {
            message: 'Use Record<string, unknown> instead',
            fixWith: 'Record<string, unknown>'
          }
        },
        extendDefaults: false
      }
    ],
    
    // Type definition standards
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
        fixStyle: 'separate-type-imports'
      }
    ],
    '@typescript-eslint/consistent-type-exports': [
      'error',
      {
        fixMixedExportsWithInlineTypeSpecifier: true
      }
    ],
    '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
    '@typescript-eslint/consistent-generic-constructors': ['error', 'constructor'],
    
    // ========================================
    // CODE QUALITY & COMPLEXITY (NEW)
    // ========================================
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/prefer-readonly-parameter-types': 'off', // Disabled for types package - interfaces need flexible parameters
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-literal-enum-member': 'error',
    '@typescript-eslint/prefer-enum-initializers': 'error',
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-includes': 'error',
    '@typescript-eslint/prefer-string-starts-ends-with': 'error',
    '@typescript-eslint/prefer-reduce-type-parameter': 'error',
    
    // Array and object consistency
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/member-delimiter-style': [
      'error',
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false
        }
      }
    ],
    '@typescript-eslint/type-annotation-spacing': [
      'error',
      {
        before: false,
        after: true,
        overrides: {
          arrow: {
            before: true,
            after: true
          }
        }
      }
    ],
    
    // ========================================
    // COMPLEXITY LIMITS (NEW)
    // ========================================
    'complexity': ['error', { max: 15 }], // Cognitive complexity limit
    'max-depth': ['error', { max: 4 }], // Nesting depth limit
    'max-lines': ['error', { max: 1500, skipBlankLines: true, skipComments: true }], // File length limit
    'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
    'max-params': ['error', { max: 8 }], // Parameter limit for type definitions
    'max-statements': ['error', { max: 50 }], // Statement limit
    'max-nested-callbacks': ['error', { max: 4 }],
    
    // ========================================
    // ENHANCED IMPORT RULES
    // ========================================
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'type'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        },
        warnOnUnassignedImports: true
      }
    ],
    'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',
    'import/no-absolute-path': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
    'import/no-namespace': 'error', // Prefer named imports
    'import/no-default-export': 'error', // Consistency with named exports
    'import/no-anonymous-default-export': 'error',
    'import/group-exports': 'error', // Group exports together
    'import/exports-last': 'error', // Exports at end of file
    
    // ========================================
    // ENHANCED JSDOC REQUIREMENTS
    // ========================================
    'jsdoc/require-jsdoc': [
      'error',
      {
        require: {
          FunctionDeclaration: false,
          ClassDeclaration: false,
          MethodDefinition: false
        },
        contexts: [
          'TSInterfaceDeclaration',
          'TSTypeAliasDeclaration',
          'TSEnumDeclaration',
          'TSMethodSignature'
        ]
      }
    ],
    'jsdoc/require-description': 'error',
    'jsdoc/require-description-complete-sentence': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-types': 'off', // TypeScript handles this
    'jsdoc/require-param': 'off', // Not applicable to type definitions
    'jsdoc/require-returns': 'off', // Not applicable to type definitions
    'jsdoc/check-line-alignment': ['error', 'always'],
    'jsdoc/check-indentation': 'error',
    'jsdoc/no-blank-blocks': 'error',
    'jsdoc/no-blank-block-descriptions': 'error',
    'jsdoc/require-asterisk-prefix': 'error',
    'jsdoc/require-description-complete-sentence': 'error',
    
    // ========================================
    // ENHANCED CODE QUALITY
    // ========================================
    'no-console': 'error',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-let': 'off', // Allow let for legitimate use cases
    'no-magic-numbers': [
      'error',
      {
        ignore: [-1, 0, 1, 2, 100, 1000],
        ignoreArrayIndexes: true,
        enforceConst: true,
        detectObjects: false
      }
    ],
    'no-duplicate-imports': 'error',
    'no-useless-rename': 'error',
    'object-shorthand': 'error',
    'prefer-destructuring': [
      'error',
      {
        array: false,
        object: true
      }
    ],
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    
    // ========================================
    // ENHANCED NAMING CONVENTIONS
    // ========================================
    '@typescript-eslint/naming-convention': [
      'error',
      // Interfaces
      {
        selector: 'interface',
        format: ['PascalCase'],
        custom: {
          regex: '^I[A-Z]',
          match: false // Don't prefix with I
        }
      },
      // Type aliases
      {
        selector: 'typeAlias',
        format: ['PascalCase']
      },
      // Enums
      {
        selector: 'enum',
        format: ['PascalCase']
      },
      // Enum members
      {
        selector: 'enumMember',
        format: ['UPPER_CASE', 'PascalCase']
      },
      // Type parameters
      {
        selector: 'typeParameter',
        format: ['PascalCase'],
        prefix: ['T', 'K', 'V', 'P', 'U', 'R']
      },
      // Variables and functions
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase']
      },
      {
        selector: 'function',
        format: ['camelCase']
      },
      // Class members
      {
        selector: 'classProperty',
        format: ['camelCase'],
        leadingUnderscore: 'allow'
      },
      {
        selector: 'classMethod',
        format: ['camelCase'],
        leadingUnderscore: 'allow'
      },
      // Object literal properties
      {
        selector: 'objectLiteralProperty',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow'
      }
    ],
    
    // ========================================
    // SECURITY & BEST PRACTICES
    // ========================================
    'no-constructor-return': 'error',
    'no-promise-executor-return': 'error',
    'no-unreachable-loop': 'error',
    'no-use-before-define': 'off', // Handled by TypeScript
    '@typescript-eslint/no-use-before-define': [
      'error',
      {
        functions: false,
        classes: true,
        variables: true,
        enums: true,
        typedefs: true,
        ignoreTypeReferences: false
      }
    ],
    'no-unused-expressions': 'off', // Handled by TypeScript
    '@typescript-eslint/no-unused-expressions': 'error',
    
    // Performance considerations
    '@typescript-eslint/prefer-regexp-exec': 'error',
    '@typescript-eslint/prefer-return-this-type': 'error',
    '@typescript-eslint/prefer-ts-expect-error': 'error',
    '@typescript-eslint/require-array-sort-compare': 'error'
  },
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    '*.js',
    '*.d.ts',
    '.eslintrc.js'
  ],
  overrides: [
    {
      files: ['src/index.ts', 'src/**/index.ts'],
      rules: {
        'jsdoc/require-jsdoc': 'off', // Index files are just re-exports
        'import/no-default-export': 'off', // Allow default exports in index files
        'import/exports-last': 'off', // Mixed exports/re-exports in index
        'max-lines': ['error', { max: 2000 }] // Index files can be longer
      }
    },
    {
      // Configuration files might need more flexibility
      files: ['src/config/**/*.ts'],
      rules: {
        'max-lines': ['error', { max: 2000 }], // Config files can be longer
        'max-statements': ['error', { max: 100 }],
        '@typescript-eslint/prefer-readonly-parameter-types': 'off' // Config objects are often mutable
      }
    },
    {
      // Constant files (for exported constants)
      files: ['**/constants.ts', '**/*constants.ts'],
      rules: {
        'no-magic-numbers': 'off', // Constants files contain magic numbers by definition
        'max-lines': ['error', { max: 1000 }]
      }
    }
  ]
}; 