/**
 * ESLint Configuration for Trading Bot UI Package
 * 
 * This configuration provides institutional-grade code quality standards specifically
 * tailored for React/TypeScript UI component development. It extends the base trading
 * bot configuration with additional rules for accessibility, component patterns,
 * and UI best practices.
 * 
 * @fileoverview Comprehensive ESLint configuration for UI components
 * @version 1.0.0
 * @author Trading Bot Development Team
 */

module.exports = {
  // Mark this as root configuration to prevent ESLint from looking up the directory tree
  root: true,
  
  // Inherit base trading bot configuration with Next.js, Turbo, and Prettier
  extends: [
    "@trading-bot/config/eslint-preset",
    // Additional UI-specific configurations
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],

  // Specify the parser for TypeScript
  parser: "@typescript-eslint/parser",
  
  // Parser options for TypeScript and JSX
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    },
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname
  },

  // Define plugins for enhanced linting capabilities
  plugins: [
    "react",
    "react-hooks",
    "jsx-a11y",
    "@typescript-eslint",
    "import",
    "unused-imports"
  ],

  // Configure settings for React version detection
  settings: {
    react: {
      version: "detect"
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json"
      }
    }
  },

  // Environment configuration
  env: {
    browser: true,
    es2022: true,
    node: true
  },

  // Custom rules for UI component development
  rules: {
    // React specific rules
    "react/react-in-jsx-scope": "off", // Not needed in Next.js
    "react/prop-types": "off", // Using TypeScript for prop validation
    "react/display-name": "error",
    "react/no-unused-prop-types": "error",
    "react/no-unused-state": "error",
    "react/prefer-stateless-function": "warn",
    "react/self-closing-comp": "error",
    "react/jsx-boolean-value": ["error", "never"],
    "react/jsx-curly-brace-presence": ["error", { "props": "never", "children": "never" }],
    "react/jsx-fragments": ["error", "syntax"],
    "react/jsx-no-useless-fragment": "error",
    "react/jsx-pascal-case": "error",

    // React Hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Accessibility rules
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/anchor-has-content": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error",

    // TypeScript specific rules
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],

    // Import/Export rules
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true }
      }
    ],
    "import/no-unused-modules": "error",
    "import/no-duplicates": "error",
    "unused-imports/no-unused-imports": "error",

    // General code quality rules
    "no-console": "warn",
    "no-debugger": "error",
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error"
  },

  // Override rules for specific file patterns
  overrides: [
    {
      // Configuration for TypeScript files
      files: ["**/*.ts", "**/*.tsx"],
      rules: {
        // Allow any in config files where it might be necessary
        "@typescript-eslint/no-explicit-any": "warn",
        // Require explicit return types for public functions
        "@typescript-eslint/explicit-function-return-type": [
          "warn",
          {
            "allowExpressions": true,
            "allowTypedFunctionExpressions": true,
            "allowHigherOrderFunctions": true
          }
        ]
      }
    },
    {
      // Configuration for test files
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
      env: {
        jest: true
      },
      rules: {
        // Allow any in tests for mocking
        "@typescript-eslint/no-explicit-any": "off",
        // Allow non-null assertions in tests
        "@typescript-eslint/no-non-null-assertion": "off",
        // Allow console in tests
        "no-console": "off"
      }
    },
    {
      // Configuration for Storybook files
      files: ["**/*.stories.ts", "**/*.stories.tsx"],
      rules: {
        // Allow default exports in Storybook files
        "import/no-default-export": "off",
        // Allow any for Storybook args
        "@typescript-eslint/no-explicit-any": "off"
      }
    },
    {
      // Configuration for configuration files
      files: ["*.config.js", "*.config.ts", ".eslintrc.js"],
      env: {
        node: true
      },
      rules: {
        // Allow require in config files
        "@typescript-eslint/no-var-requires": "off",
        // Allow any in config files
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ],

  // Ignore patterns for files that shouldn't be linted
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    "coverage/",
    "*.min.js",
    "public/"
  ]
}; 