/**
 * @file Validation utility types for the utilities package.
 * @package @trading-bot/types
 */

/**
 * Utility error interface.
 */
interface UtilityError {
  /** Error code. */
  code: string;
  
  /** Error message. */
  message: string;
  
  /** Additional error details. */
  details?: {
    field?: string;
    value?: string | number | boolean;
    expected?: string;
    actual?: string;
    path?: string;
  };
  
  /** Error timestamp. */
  timestamp: number;
}

/**
 * Supported blockchain chains for utilities.
 */
type UtilitySupportedChain = 'ethereum' | 'bsc' | 'polygon' | 'avalanche' | 'fantom' | 'arbitrum' | 'optimism' | 'bitcoin' | 'solana' | 'litecoin';

/**
 * Address validation result for utilities.
 */
interface UtilityAddressValidationResult {
  /** Whether address is valid. */
  isValid: boolean;
  
  /** Detected chain. */
  chain?: UtilitySupportedChain;
  
  /** Address format. */
  format?: string;
  
  /** Checksum validation result. */
  checksum?: boolean;
  
  /** Validation error message. */
  error?: string;
  
  /** Normalized address. */
  normalized?: string;
  
  /** Display format. */
  displayFormat?: string;
}

/**
 * Batch address validation result.
 */
interface BatchAddressValidationResult {
  address: string;
  result: UtilityAddressValidationResult;
}

/**
 * Amount validation result.
 */
interface AmountValidationResult {
  /** Whether the amount is valid. */
  isValid: boolean;
  
  /** Parsed amount as string. */
  amount?: string;
  
  /** Amount in smallest unit (wei, satoshi, etc.). */
  amountInSmallestUnit?: string;
  
  /** Token decimals used. */
  decimals?: number;
  
  /** Validation error message. */
  error?: string;
  
  /** Validation warnings. */
  warnings?: string[];
  
  /** Amount metadata. */
  metadata?: {
    formatted: string;
    scientific: string;
    percentage?: number;
  };
}

/**
 * Amount validation options.
 */
interface AmountValidationOptions {
  /** Minimum allowed amount. */
  min?: string;
  
  /** Maximum allowed amount. */
  max?: string;
  
  /** Token decimals. */
  decimals?: number;
  
  /** Allow zero amounts. */
  allowZero?: boolean;
  
  /** Allow negative amounts. */
  allowNegative?: boolean;
  
  /** Maximum decimal places. */
  maxDecimals?: number;
  
  /** Validation context. */
  context?: 'trading' | 'transfer' | 'approval' | 'stake';
}

/**
 * Batch amount validation input.
 */
interface BatchAmountValidationInput {
  amount: string | number;
  options?: AmountValidationOptions;
}

/**
 * Batch amount validation result.
 */
interface BatchAmountValidationResult {
  amount: string | number;
  result: AmountValidationResult;
}

/**
 * Configuration validation result.
 */
interface ConfigValidationResult<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Whether the configuration is valid. */
  isValid: boolean;
  
  /** Validated and normalized configuration. */
  config?: T;
  
  /** Validation errors. */
  errors: Array<{
    field: keyof T | string;
    message: string;
    value?: T[keyof T];
    code?: string;
  }>;
  
  /** Validation warnings. */
  warnings: Array<{
    field: keyof T | string;
    message: string;
    value?: T[keyof T];
    code?: string;
  }>;
  
  /** Applied defaults. */
  defaults?: Partial<T>;
}

/**
 * Schema validation options.
 */
interface SchemaValidationOptions {
  /** Allow unknown fields. */
  allowUnknown?: boolean;
  
  /** Strip unknown fields. */
  stripUnknown?: boolean;
  
  /** Abort on first error. */
  abortEarly?: boolean;
  
  /** Convert types automatically. */
  convert?: boolean;
  
  /** Validation context. */
  context?: {
    userId?: string;
    requestId?: string;
    source?: string;
    environment?: 'development' | 'staging' | 'production';
    metadata?: Record<string, string | number | boolean>;
  };
  
  /** Strict mode validation. */
  strict?: boolean;
  
  /** Validate string formats. */
  validateFormats?: boolean;
  
  /** Allow undefined keywords. */
  allowUndefinedKeywords?: boolean;
  
  /** Remove additional properties. */
  removeAdditional?: boolean;
  
  /** Use default values. */
  useDefaults?: boolean;
  
  /** Coerce types. */
  coerceTypes?: boolean;
}

/**
 * Field validation rule.
 */
interface ValidationRule<T = string | number | boolean> {
  /** Rule type. */
  type: 'required' | 'type' | 'min' | 'max' | 'pattern' | 'custom' | 'enum';
  
  /** Rule value/parameter. */
  value?: T | RegExp | T[];
  
  /** Custom validation function. */
  validator?: (value: T, context?: ValidationContext) => boolean | string;
  
  /** Error message. */
  message?: string;
  
  /** Rule enabled conditionally. */
  condition?: (context: ValidationContext) => boolean;
}

/**
 * Field schema definition.
 */
interface FieldSchema<T = string | number | boolean | Record<string, unknown> | unknown[] | Date | bigint> {
  /** Field type. */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'bigint';
  
  /** Field is required. */
  required?: boolean;
  
  /** Default value. */
  default?: T;
  
  /** Validation rules. */
  rules?: Array<ValidationRule<T>>;
  
  /** Nested schema for objects/arrays. */
  schema?: Record<string, FieldSchema>;
  
  /** Field description. */
  description?: string;
  
  /** Field examples. */
  examples?: T[];
}

/**
 * Validation schema.
 */
interface ValidationSchema {
  /** Schema fields. */
  fields: Record<string, FieldSchema>;
  
  /** Schema options. */
  options?: SchemaValidationOptions;
  
  /** Schema metadata. */
  metadata?: {
    name?: string;
    version?: string;
    description?: string;
  };
}

/**
 * JSON Schema interface for schema validation.
 */
interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  enum?: Array<string | number | boolean>;
  const?: string | number | boolean;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  additionalProperties?: boolean | JSONSchema;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  $ref?: string;
  title?: string;
  description?: string;
  default?: string | number | boolean | Record<string, unknown> | null;
  examples?: Array<string | number | boolean | Record<string, unknown> | null>;
}

/**
 * Schema validation error detail.
 */
interface SchemaValidationError {
  path: string;
  keyword: string;
  message: string;
  value?: string | number | boolean | Record<string, unknown> | null;
  schema?: JSONSchema;
  code?: string;
}

/**
 * URL validation result.
 */
interface URLValidationResult {
  /** Whether the URL is valid. */
  isValid: boolean;
  
  /** Parsed URL components. */
  components?: {
    protocol: string;
    hostname: string;
    port?: number;
    pathname: string;
    search?: string;
    hash?: string;
  };
  
  /** URL type. */
  type?: 'http' | 'https' | 'ws' | 'wss' | 'ftp' | 'other';
  
  /** Validation error. */
  error?: string;
  
  /** Security warnings. */
  warnings?: string[];
}

/**
 * Email validation result.
 */
interface EmailValidationResult {
  /** Whether the email is valid. */
  isValid: boolean;
  
  /** Normalized email address. */
  normalized?: string;
  
  /** Email components. */
  components?: {
    local: string;
    domain: string;
    subdomain?: string;
    tld: string;
  };
  
  /** Validation error. */
  error?: string;
  
  /** Email type suggestions. */
  suggestions?: string[];
}

/**
 * Password validation result.
 */
interface PasswordValidationResult {
  /** Whether the password is valid. */
  isValid: boolean;
  
  /** Password strength score (0-100). */
  strength: number;
  
  /** Strength level. */
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  
  /** Validation errors. */
  errors: string[];
  
  /** Password analysis. */
  analysis: {
    length: number;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumbers: boolean;
    hasSymbols: boolean;
    hasRepeatedChars: boolean;
    hasSequentialChars: boolean;
    commonPassword: boolean;
  };
  
  /** Improvement suggestions. */
  suggestions: string[];
}

/**
 * Password validation options.
 */
interface PasswordValidationOptions {
  /** Minimum length. */
  minLength?: number;
  
  /** Maximum length. */
  maxLength?: number;
  
  /** Require lowercase letters. */
  requireLowercase?: boolean;
  
  /** Require uppercase letters. */
  requireUppercase?: boolean;
  
  /** Require numbers. */
  requireNumbers?: boolean;
  
  /** Require symbols. */
  requireSymbols?: boolean;
  
  /** Forbidden patterns. */
  forbiddenPatterns?: RegExp[];
  
  /** Common password blacklist. */
  useCommonPasswordCheck?: boolean;
}

/**
 * JSON validation result.
 */
interface JSONValidationResult<T = Record<string, unknown> | unknown[] | string | number | boolean | null> {
  /** Whether the JSON is valid. */
  isValid: boolean;
  
  /** Parsed JSON object. */
  data?: T;
  
  /** JSON validation error. */
  error?: {
    message: string;
    line?: number;
    column?: number;
    offset?: number;
  };
  
  /** JSON statistics. */
  stats?: {
    size: number;
    depth: number;
    keys: number;
    arrays: number;
    objects: number;
  };
}

/**
 * Decimal amount parsing result.
 */
interface DecimalAmountParseResult {
  success: boolean;
  amount?: string;
  amountInSmallestUnit?: bigint;
  error?: string;
}

/**
 * Amount conversion result.
 */
interface AmountConversionResult {
  success: boolean;
  convertedAmount?: string;
  error?: string;
}

/**
 * Generic validation context.
 */
interface ValidationContext {
  /** Validation target type. */
  type: 'address' | 'amount' | 'config' | 'schema' | 'url' | 'email' | 'password' | 'json';
  
  /** Source of the validation request. */
  source?: string;
  
  /** User ID for user-specific validation. */
  userId?: string;
  
  /** Request metadata. */
  metadata?: {
    requestId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    environment?: 'development' | 'staging' | 'production';
    version?: string;
    additional?: Record<string, string | number | boolean>;
  };
  
  /** Validation timestamp. */
  timestamp: number;
}

/**
 * Validation statistics.
 */
interface ValidationStats {
  /** Total validations performed. */
  total: number;
  
  /** Successful validations.. */
  successful: number;
  
  /** Failed validations. */
  failed: number;
  
  /** Success rate percentage. */
  successRate: number;
  
  /** Average validation time in ms. */
  averageTime: number;
  
  /** Most common error types. */
  commonErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Field validation result.
 */
interface FieldValidationResult<T = string | number | boolean | Record<string, unknown>> {
  isValid: boolean;
  value?: T;
  errors: Array<{
    field: string;
    message: string;
    value?: T;
    code?: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    value?: T;
    code?: string;
  }>;
  hasDefault: boolean;
  defaultValue?: T;
}

/**
 * Type validation result.
 */
interface TypeValidationResult<T = string | number | boolean | Record<string, unknown>> {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: T;
    code?: string;
  }>;
}

/**
 * Rule validation result.
 */
interface RuleValidationResult<T = string | number | boolean | Record<string, unknown>> {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value?: T;
    code?: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
    value?: T;
    code?: string;
  }>;
}

// ========================================
// ADDITIONAL MISSING TYPES
// ========================================

/**
 * Validation error type.
 */
interface ValidationError {
  /** Error code. */
  code: string;
  
  /** Error message. */
  message: string;
  
  /** Field that failed validation. */
  field?: string;
  
  /** Invalid value. */
  value?: unknown;
  
  /** Validation context. */
  context?: ValidationContext;
}

/**
 * Generic validation result.
 */
interface ValidationResult<T = unknown> {
  /** Whether validation passed. */
  isValid: boolean;
  
  /** Validated value. */
  value?: T;
  
  /** Validation errors. */
  errors: ValidationError[];
  
  /** Validation warnings. */
  warnings?: ValidationError[];
}

/**
 * Validator function type.
 */
type Validator<T = unknown> = (value: T, context?: ValidationContext) => ValidationResult<T>;

/**
 * Validation constraint.
 */
interface ValidationConstraint {
  /** Constraint type. */
  type: string;
  
  /** Constraint parameters. */
  parameters: Record<string, unknown>;
  
  /** Error message. */
  message?: string;
}

/**
 * Field validation configuration.
 */
interface FieldValidation {
  /** Field name. */
  field: string;
  
  /** Field validator. */
  validator: Validator;
  
  /** Field constraints. */
  constraints: ValidationConstraint[];
  
  /** Field is required. */
  required: boolean;
}

/**
 * Schema validation configuration.
 */
interface SchemaValidation {
  /** Schema name. */
  name: string;
  
  /** Field validations. */
  fields: FieldValidation[];
  
  /** Schema options. */
  options: SchemaValidationOptions;
}

/**
 * Conditional validation.
 */
interface ConditionalValidation {
  /** Condition to check. */
  condition: (value: unknown, context?: ValidationContext) => boolean;
  
  /** Validator to apply if condition is true. */
  validator: Validator;
  
  /** Alternative validator if condition is false. */
  alternative?: Validator;
}

/**
 * Custom validation function.
 */
interface CustomValidation {
  /** Validation name. */
  name: string;
  
  /** Validation function. */
  validate: Validator;
  
  /** Validation description. */
  description?: string;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Common validation messages.
 */
const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_TYPE: 'Invalid type provided',
  INVALID_FORMAT: 'Invalid format',
  TOO_SHORT: 'Value is too short',
  TOO_LONG: 'Value is too long',
  OUT_OF_RANGE: 'Value is out of allowed range',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_URL: 'Invalid URL format',
  INVALID_ADDRESS: 'Invalid blockchain address',
  INVALID_AMOUNT: 'Invalid amount format'
} as const;

/**
 * Common validators.
 */
const COMMON_VALIDATORS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  hexAddress: /^0x[a-fA-F0-9]{40}$/,
  positiveNumber: /^\d*\.?\d+$/,
  integer: /^-?\d+$/
} as const;

// Consolidated export declaration
export type {
  UtilityError,
  UtilitySupportedChain,
  UtilityAddressValidationResult,
  BatchAddressValidationResult,
  AmountValidationResult,
  AmountValidationOptions,
  BatchAmountValidationInput,
  BatchAmountValidationResult,
  ConfigValidationResult,
  SchemaValidationOptions,
  ValidationRule,
  FieldSchema,
  ValidationSchema,
  JSONSchema,
  SchemaValidationError,
  URLValidationResult,
  EmailValidationResult,
  PasswordValidationResult,
  PasswordValidationOptions,
  JSONValidationResult,
  DecimalAmountParseResult,
  AmountConversionResult,
  ValidationContext,
  ValidationStats,
  FieldValidationResult,
  TypeValidationResult,
  RuleValidationResult,
  ValidationError,
  ValidationResult,
  Validator,
  ValidationConstraint,
  FieldValidation,
  SchemaValidation,
  ConditionalValidation,
  CustomValidation
};

export {
  VALIDATION_MESSAGES,
  COMMON_VALIDATORS
}; 