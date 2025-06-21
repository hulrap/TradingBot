/**
 * @fileoverview Trading Bot ESLint Preset Configuration
 * 
 * Comprehensive ESLint configuration for financial trading applications with
 * enterprise-grade code quality standards, security rules, accessibility
 * compliance, and modern development best practices.
 * 
 * @version 2.0.0
 * @author Trading Bot Development Team
 * @license MIT
 */

module.exports = {
  // Extend industry-standard presets
  extends: [
    "next",
    "turbo", 
    "prettier",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:security/recommended"
  ],

  // Parser configuration for TypeScript
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    },
    project: true,
    babelOptions: {
      presets: [require.resolve("next/babel")]
    }
  },

  // Environment and settings
  env: {
    browser: true,
    node: true,
    es2022: true,
    jest: true
  },

  settings: {
    react: {
      version: "detect"
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true
      }
    }
  },

  // Enhanced rules for trading bot development
  rules: {
    // Next.js specific rules
    "@next/next/no-html-link-for-pages": "off",
    "@next/next/no-img-element": "warn",
    
    // React best practices
    "react/jsx-key": "error", // Override base config
    "react/jsx-no-bind": ["error", { allowArrowFunctions: true }],
    "react/jsx-pascal-case": "error",
    "react/jsx-fragments": ["error", "syntax"],
    "react/prop-types": "off", // Using TypeScript
    "react/react-in-jsx-scope": "off", // Not needed in Next.js
    "react/display-name": "error",
    "react/self-closing-comp": "error",

    // TypeScript rules
    "@typescript-eslint/no-unused-vars": ["error", { 
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_"
    }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    "@typescript-eslint/explicit-function-return-type": ["warn", {
      allowExpressions: true,
      allowTypedFunctionExpressions: true
    }],

    // Import organization
    "import/order": ["error", {
      groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      alphabetize: { order: "asc" }
    }],
    "import/no-duplicates": "error",
    "import/first": "error",
    "import/newline-after-import": "error",

    // Security rules for financial applications
    "security/detect-object-injection": "error",
    "security/detect-unsafe-regex": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-buffer-noassert": "error",

    // Code quality
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error",
    "no-console": "warn",
    "no-debugger": "error",
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],

    // Financial app specific
    "no-magic-numbers": ["warn", { 
      ignore: [-1, 0, 1, 2, 100, 1000],
      ignoreArrayIndexes: true
    }],
    "no-loss-of-precision": "error",
    "no-implicit-coercion": "error"
  },

  // File-specific overrides
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
        "no-magic-numbers": "off"
      }
    },
    {
      files: ["*.config.js", "*.config.ts", ".eslintrc.js"],
      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
}; 