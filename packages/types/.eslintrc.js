/**
 * ESLint Configuration for Trading Bot Types Package
 * 
 * Enterprise-grade linting rules for TypeScript type definitions
 * with focus on type safety, consistency, and maintainability.
 */

module.exports = {
  root: true,
  extends: [
    "@trading-bot/config/eslint",
  ],
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  rules: {
    // Types package specific rules
    "@typescript-eslint/no-explicit-any": "warn", // Allow any in type definitions
    "@typescript-eslint/ban-types": "off", // Allow certain banned types for flexibility
    
    // Enforce consistent type definitions
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    "@typescript-eslint/consistent-type-imports": ["error", {
      prefer: "type-imports",
      disallowTypeAnnotations: false,
    }],
    
    // Documentation requirements for types
    "jsdoc/require-jsdoc": ["error", {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        ArrowFunctionExpression: false,
        FunctionExpression: false,
      },
      contexts: [
        "TSInterfaceDeclaration",
        "TSTypeAliasDeclaration",
        "TSEnumDeclaration",
      ],
    }],
    
    // Type safety
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-argument": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
  },
  overrides: [
    {
      files: ["*.test.ts", "*.spec.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "jsdoc/require-jsdoc": "off",
      },
    },
  ],
}; 