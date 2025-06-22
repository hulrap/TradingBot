/**
 * @file Validation utilities index - exports all validation implementations
 * @package @trading-bot/utilities
. */

// Address validation exports
export {
  validateAddress,
  validateAddresses,
  validateEthereumAddress,
  validateEVMAddress,
  validateSolanaAddress,
  validateBitcoinAddress,
  validateLitecoinAddress,
  normalizeAddress,
  getAddressInfo,
  formatAddressForDisplay,
  generateEthereumChecksum,
  addressValidationUtils
} from './address-validator';

// Amount validation exports
export {
  validateAmount,
  validateAmounts,
  getStandardDecimals,
  convertAmountDecimals,
  parseToSmallestUnit,
  isValidAmount,
  amountValidationUtils
} from './amount-validator';

// Configuration validation exports
export {
  validateConfig,
  createSchema,
  configValidationUtils
} from './config-validator';

// Schema validation exports
export {
  validateJSONSchema,
  parseAndValidateJSON,
  schemaValidationUtils
} from './schema-validator';

// Re-export validation types for convenience
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
  RuleValidationResult
} from '../../../types/src/utilities/validation'; 