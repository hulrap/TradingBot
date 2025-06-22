/**
 * @file Trading amount validation utilities
 * @package @trading-bot/utilities
 * 
 * Production-grade amount validation with precise decimal arithmetic,
 * bounds checking, and trading-specific validations.
. */

import type { 
  AmountValidationResult, 
  AmountValidationOptions,
  BatchAmountValidationInput,
  BatchAmountValidationResult,
  DecimalAmountParseResult,
  AmountConversionResult
} from '@trading-bot/types/src/utilities/validation/validation';

/**
 * Precision constants for decimal arithmetic
. */
const VALIDATION_CONSTANTS = {
  MAX_SAFE_DECIMAL_PLACES: 18,
  WEI_PER_ETHER: BigInt('1000000000000000000'), // 10^18
  SATOSHI_PER_BTC: BigInt('100000000'), // 10^8
  MAX_BIGINT_STRING_LENGTH: 100, // Prevent extremely large numbers
  SCIENTIFIC_NOTATION_THRESHOLD: 1e-6,
  LARGE_NUMBER_WARNING_THRESHOLD: BigInt('1000000000000000000000000') // 10^24
} as const;

/**
 * Token decimal configurations for standard tokens
. */
const STANDARD_DECIMALS: Record<string, number> = {
  ETH: 18,
  BTC: 8,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  WETH: 18,
  BNB: 18,
  MATIC: 18,
  AVAX: 18,
  SOL: 9,
  LINK: 18,
  UNI: 18,
  AAVE: 18,
  CRV: 18,
  COMP: 18
} as const;

/**
 * Context-specific validation thresholds
. */
const CONTEXT_THRESHOLDS = {
  trading: {
    minDustThreshold: (decimals: number) => decimals >= 18 ? 
      BigInt('1000000000000000') : // 0.001 ETH equivalent
      BigInt(10) ** BigInt(Math.max(0, decimals - 3)),
    maxAmount: (decimals: number) => BigInt(10) ** BigInt(decimals + 9) // 1 billion tokens
  },
  transfer: {
    minAmount: BigInt(1) // 1 smallest unit
  },
  approval: {
    maxUint256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  },
  stake: {
    minAmount: (decimals: number) => BigInt(10) ** BigInt(decimals) // 1 full token
  }
} as const;

/**
 * Validate trading amount with comprehensive checks
 * @param amount
 * @param options
. */
export function validateAmount(
  amount: string | number,
  options: AmountValidationOptions = {}
): AmountValidationResult {
  const startTime = performance.now();
  
  const {
    min = '0',
    max,
    decimals = 18,
    allowZero = false,
    allowNegative = false,
    maxDecimals = decimals,
    context = 'trading'
  } = options;

  try {
    // Input validation
    if (amount === undefined || amount === null) {
      return createErrorResult('Amount cannot be null or undefined');
    }

    // Convert input to string for consistent handling
    const amountStr = normalizeAmountInput(amount);
    if (!amountStr.success) {
      return createErrorResult(amountStr.error!);
    }

    // Basic format validation
    const formatValidation = validateAmountFormat(amountStr.value!);
    if (!formatValidation.isValid) {
      return formatValidation;
    }

    // Parse and normalize amount
    const parsed = parseDecimalAmount(amountStr.value!, decimals);
    if (!parsed.success) {
      return createErrorResult(parsed.error || 'Failed to parse amount');
    }

    const normalizedAmount = parsed.amount!;
    const amountBigInt = parsed.amountInSmallestUnit!;

    // Zero validation
    if (amountBigInt === BigInt(0) && !allowZero) {
      return createErrorResult('Zero amounts are not allowed');
    }

    // Negative validation
    if (amountBigInt < BigInt(0) && !allowNegative) {
      return createErrorResult('Negative amounts are not allowed');
    }

    // Decimal places validation
    const decimalPlaces = countDecimalPlaces(normalizedAmount);
    if (decimalPlaces > maxDecimals) {
      return createErrorResult(
        `Amount has too many decimal places. Maximum allowed: ${maxDecimals}, found: ${decimalPlaces}`
      );
    }

    // Range validation
    const rangeValidation = validateAmountRange(amountBigInt, min, max, decimals);
    if (!rangeValidation.isValid) {
      return rangeValidation;
    }

    // Context-specific validation
    const contextValidation = validateAmountContext(normalizedAmount, amountBigInt, context, decimals);
    if (!contextValidation.isValid) {
      return contextValidation;
    }

    // Generate metadata
    const metadata = generateAmountMetadata(normalizedAmount, amountBigInt, decimals);

    // Generate warnings
    const warnings = generateAmountWarnings(normalizedAmount, amountBigInt, context, decimals);

    const endTime = performance.now();
    const validationTime = endTime - startTime;

    const result: AmountValidationResult = {
      isValid: true,
      amount: normalizedAmount,
      amountInSmallestUnit: amountBigInt.toString(),
      decimals,
      metadata,
      warnings
    };

    // Add performance metadata in development
    if (process.env.NODE_ENV === 'development') {
      (result as AmountValidationResult & { performance?: { validationTimeMs: number; parsedSuccessfully: boolean } }).performance = {
        validationTimeMs: validationTime,
        parsedSuccessfully: true
      };
    }

    return result;

  } catch (error) {
    return createErrorResult(
      `Amount validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate multiple amounts in batch
 * @param amounts
 * @param globalOptions
. */
export function validateAmounts(
  amounts: BatchAmountValidationInput[],
  globalOptions: AmountValidationOptions = {}
): BatchAmountValidationResult[] {
  if (!Array.isArray(amounts)) {
    throw new Error('Amounts must be an array');
  }

  return amounts.map(({ amount, options }) => ({
    amount,
    result: validateAmount(amount, { ...globalOptions, ...options })
  }));
}

/**
 * Normalize amount input to string
 * @param amount
. */
function normalizeAmountInput(amount: string | number): { success: boolean; value?: string; error?: string } {
  if (typeof amount === 'string') {
    return { success: true, value: amount.trim() };
  }
  
  if (typeof amount === 'number') {
    if (!isFinite(amount)) {
      return { success: false, error: 'Amount cannot be infinite or NaN' };
    }
    
    // Handle very large or very small numbers that might lose precision
    if (Math.abs(amount) > Number.MAX_SAFE_INTEGER) {
      return { success: false, error: 'Number too large, use string representation' };
    }
    
    return { success: true, value: amount.toString() };
  }
  
  return { success: false, error: 'Amount must be a string or number' };
}

/**
 * Validate amount format (basic string/number format)
 * @param amount
. */
function validateAmountFormat(amount: string): AmountValidationResult {
  if (!amount || amount.length === 0) {
    return createErrorResult('Amount cannot be empty');
  }

  // Check for valid numeric format with improved regex
  const numericRegex = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
  if (!numericRegex.test(amount)) {
    return createErrorResult('Invalid numeric format');
  }

  // Additional checks for edge cases
  if (amount === '.') {
    return createErrorResult('Invalid number format: standalone decimal point');
  }

  if (amount.includes('..')) {
    return createErrorResult('Invalid number format: multiple decimal points');
  }

  // Check for leading zeros (except for decimal numbers)
  if (/^-?0\d/.test(amount) && !amount.includes('.')) {
    return createErrorResult('Invalid number format: leading zeros not allowed');
  }

  // Check string length to prevent extremely long inputs
  if (amount.length > VALIDATION_CONSTANTS.MAX_BIGINT_STRING_LENGTH) {
    return createErrorResult('Amount string too long');
  }

  return { isValid: true };
}

/**
 * Parse decimal amount with precision handling
 * @param amount
 * @param decimals
. */
function parseDecimalAmount(
  amount: string,
  decimals: number
): DecimalAmountParseResult {
  try {
    // Handle scientific notation
    let normalizedAmount = amount.trim();
    if (normalizedAmount.includes('e') || normalizedAmount.includes('E')) {
      const numValue = parseFloat(normalizedAmount);
      if (!isFinite(numValue)) {
        return {
          success: false,
          error: 'Invalid scientific notation'
        };
      }
      normalizedAmount = numValue.toFixed(Math.min(decimals, VALIDATION_CONSTANTS.MAX_SAFE_DECIMAL_PLACES));
    }

    // Remove leading + sign if present
    if (normalizedAmount.startsWith('+')) {
      normalizedAmount = normalizedAmount.slice(1);
    }

    // Split integer and decimal parts
    const parts = normalizedAmount.split('.');
    const integerPart = parts[0] || '0';
    const decimalPart = parts[1] || '';

    // Validate decimal places don't exceed token decimals
    if (decimalPart.length > decimals) {
      return {
        success: false,
        error: `Too many decimal places. Token supports ${decimals} decimals, found ${decimalPart.length}`
      };
    }

    // Validate integer part
    if (!/^-?\d+$/.test(integerPart)) {
      return {
        success: false,
        error: 'Invalid integer part'
      };
    }

    // Validate decimal part
    if (decimalPart && !/^\d+$/.test(decimalPart)) {
      return {
        success: false,
        error: 'Invalid decimal part'
      };
    }

    // Pad decimal part to token decimals
    const paddedDecimalPart = decimalPart.padEnd(decimals, '0');
    
    // Combine and convert to BigInt
    const isNegative = integerPart.startsWith('-');
    const absoluteIntegerPart = isNegative ? integerPart.slice(1) : integerPart;
    const combinedString = absoluteIntegerPart + paddedDecimalPart;
    
    let amountInSmallestUnit = BigInt(combinedString);
    if (isNegative) {
      amountInSmallestUnit = -amountInSmallestUnit;
    }

    // Reconstruct normalized amount (remove trailing zeros from decimal part)
    const trimmedDecimalPart = decimalPart.replace(/0+$/, '');
    const reconstructed = trimmedDecimalPart ? 
      `${integerPart}.${trimmedDecimalPart}` : 
      integerPart;

    return {
      success: true,
      amount: reconstructed,
      amountInSmallestUnit
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to parse amount: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Count decimal places in a number string
 * @param amount
. */
function countDecimalPlaces(amount: string): number {
  const parts = amount.split('.');
  return parts.length > 1 ? (parts[1] || '').length : 0;
}

/**
 * Validate amount is within specified range
 * @param amountBigInt
 * @param min
 * @param max
 * @param decimals
. */
function validateAmountRange(
  amountBigInt: bigint,
  min: string,
  max: string | undefined,
  decimals: number
): AmountValidationResult {
  try {
    // Validate minimum
    const minParsed = parseDecimalAmount(min, decimals);
    if (!minParsed.success) {
      return createErrorResult(`Invalid minimum amount: ${minParsed.error}`);
    }

    if (amountBigInt < minParsed.amountInSmallestUnit!) {
      return createErrorResult(
        `Amount ${formatFromSmallestUnit(amountBigInt, decimals)} is below minimum ${min}`
      );
    }

    // Validate maximum if provided
    if (max) {
      const maxParsed = parseDecimalAmount(max, decimals);
      if (!maxParsed.success) {
        return createErrorResult(`Invalid maximum amount: ${maxParsed.error}`);
      }

      if (amountBigInt > maxParsed.amountInSmallestUnit!) {
        return createErrorResult(
          `Amount ${formatFromSmallestUnit(amountBigInt, decimals)} exceeds maximum ${max}`
        );
      }
    }

    return { isValid: true };

  } catch (error) {
    return createErrorResult(
      `Range validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate amount based on trading context
 * @param amount
 * @param amountBigInt
 * @param context
 * @param decimals
. */
function validateAmountContext(
  amount: string,
  amountBigInt: bigint,
  context: string,
  decimals: number
): AmountValidationResult {
  switch (context) {
    case 'trading':
      return validateTradingAmount(amount, amountBigInt, decimals);
    case 'transfer':
      return validateTransferAmount(amount, amountBigInt, decimals);
    case 'approval':
      return validateApprovalAmount(amount, amountBigInt, decimals);
    case 'stake':
      return validateStakeAmount(amount, amountBigInt, decimals);
    default:
      return { isValid: true }; // No specific validation for unknown contexts
  }
}

/**
 * Validate trading-specific requirements
 * @param amount
 * @param amountBigInt
 * @param decimals
. */
function validateTradingAmount(
  amount: string,
  amountBigInt: bigint,
  decimals: number
): AmountValidationResult {
  // Check for dust amounts in trading
  const dustThreshold = CONTEXT_THRESHOLDS.trading.minDustThreshold(decimals);

  if (amountBigInt > BigInt(0) && amountBigInt < dustThreshold) {
    return createErrorResult(
      `Amount too small for trading. Minimum: ${formatFromSmallestUnit(dustThreshold, decimals)}`
    );
  }

  // Check for unreasonably large amounts
  const maxTradingAmount = CONTEXT_THRESHOLDS.trading.maxAmount(decimals);
  if (amountBigInt > maxTradingAmount) {
    return createErrorResult('Amount too large for trading operations');
  }

  // Additional validation for trading amounts - check for specific patterns
  const numericAmount = parseFloat(amount);
  if (numericAmount > 0 && numericAmount < 0.000001) {
    return createErrorResult('Trading amount too small to be economically viable');
  }

  return { isValid: true };
}

/**
 * Validate transfer-specific requirements
 * @param amount
 * @param amountBigInt
 * @param decimals
. */
function validateTransferAmount(
  amount: string,
  amountBigInt: bigint,
  decimals: number
): AmountValidationResult {
  // Transfers can be smaller than trading amounts
  const minTransferAmount = CONTEXT_THRESHOLDS.transfer.minAmount;

  if (amountBigInt < minTransferAmount && amountBigInt !== BigInt(0)) {
    return createErrorResult('Transfer amount must be at least 1 smallest unit');
  }

  // Validate that decimal places don't exceed what the network can handle
  const decimalPlaces = countDecimalPlaces(amount);
  if (decimalPlaces > decimals) {
    return createErrorResult(`Transfer amount has too many decimal places for this token (max: ${decimals})`);
  }

  return { isValid: true };
}

/**
 * Validate approval amount
 * @param amount
 * @param amountBigInt
 * @param decimals
. */
function validateApprovalAmount(
  amount: string,
  amountBigInt: bigint,
  decimals: number
): AmountValidationResult {
  // Check for common approval patterns
  const {maxUint256} = CONTEXT_THRESHOLDS.approval;
  
  // Allow max uint256 for unlimited approval
  if (amountBigInt === maxUint256) {
    return { isValid: true };
  }

  // Check for reasonable approval amounts
  if (amountBigInt < BigInt(0)) {
    return createErrorResult('Approval amount cannot be negative');
  }

  // Validate decimal precision for approval amounts
  const decimalPlaces = countDecimalPlaces(amount);
  if (decimalPlaces > decimals) {
    return createErrorResult(`Approval amount precision exceeds token decimals (max: ${decimals})`);
  }

  // Check for common unlimited approval patterns
  const numericAmount = parseFloat(amount);
  if (numericAmount > 1e20) {
    // This might be an unlimited approval in disguise
    if (amountBigInt !== maxUint256) {
      return createErrorResult('Very large approval amount detected - consider using max uint256 for unlimited approval');
    }
  }

  return { isValid: true };
}

/**
 * Validate staking amount
 * @param amount
 * @param amountBigInt
 * @param decimals
. */
function validateStakeAmount(
  amount: string,
  amountBigInt: bigint,
  decimals: number
): AmountValidationResult {
  // Minimum staking amounts are usually higher
  const minStakeAmount = CONTEXT_THRESHOLDS.stake.minAmount(decimals);

  if (amountBigInt < minStakeAmount && amountBigInt !== BigInt(0)) {
    return createErrorResult(
      `Minimum staking amount is ${formatFromSmallestUnit(minStakeAmount, decimals)}`
    );
  }

  // Validate staking amount precision
  const decimalPlaces = countDecimalPlaces(amount);
  if (decimalPlaces > decimals) {
    return createErrorResult(`Staking amount has too many decimal places (max: ${decimals})`);
  }

  // Check for reasonable staking amounts (not too large)
  const numericAmount = parseFloat(amount);
  if (numericAmount > 1e10) {
    return createErrorResult('Staking amount is unusually large - please verify the amount');
  }

  return { isValid: true };
}

/**
 * Generate amount metadata
 * @param amount
 * @param amountBigInt
 * @param decimals
. */
function generateAmountMetadata(
  amount: string,
  amountBigInt: bigint,
  decimals: number
): { formatted: string; scientific: string; percentage?: number } {
  const formatted = formatAmount(amount, decimals);
  const numericValue = parseFloat(amount);
  const scientific = (numericValue < VALIDATION_CONSTANTS.SCIENTIFIC_NOTATION_THRESHOLD || 
                     amountBigInt > BigInt(10) ** BigInt(decimals + 6)) ? 
    numericValue.toExponential(3) : 
    amount;

  return {
    formatted,
    scientific
  };
}

/**
 * Generate warnings for amount
 * @param amount
 * @param amountBigInt
 * @param context
 * @param decimals
. */
function generateAmountWarnings(
  amount: string,
  amountBigInt: bigint,
  context: string,
  decimals: number
): string[] {
  const warnings: string[] = [];

  // Warning for very small amounts
  if (amountBigInt > BigInt(0) && amountBigInt < BigInt(1000)) {
    warnings.push('Amount is very small and may incur high relative gas costs');
  }

  // Warning for very large amounts
  if (amountBigInt > VALIDATION_CONSTANTS.LARGE_NUMBER_WARNING_THRESHOLD) {
    warnings.push('Amount is very large, please verify the decimal places');
  }

  // Context-specific warnings
  if (context === 'trading') {
    const numericAmount = parseFloat(amount);
    if (numericAmount > 1000000) {
      warnings.push('Large trading amount detected, consider breaking into smaller trades');
    }
    
    // Check for potential precision loss
    if (decimals > 8 && countDecimalPlaces(amount) > 8) {
      warnings.push('High precision amount may be subject to rounding in some systems');
    }
  }

  if (context === 'approval') {
    if (amountBigInt === CONTEXT_THRESHOLDS.approval.maxUint256) {
      warnings.push('Unlimited approval granted - consider using limited approvals for security');
    }
  }

  return warnings;
}

/**
 * Format amount from smallest unit to human readable
 * @param amountBigInt
 * @param decimals
. */
function formatFromSmallestUnit(amountBigInt: bigint, decimals: number): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const integerPart = amountBigInt / divisor;
  const fractionalPart = amountBigInt % divisor;

  if (fractionalPart === BigInt(0)) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.replace(/0+$/, '');
  
  return `${integerPart}.${trimmedFractional}`;
}

/**
 * Format amount for display with smart formatting
 * @param amount
 * @param decimals
. */
function formatAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  
  if (num === 0) return '0';
  if (Math.abs(num) < 0.000001) return num.toExponential(2);
  if (Math.abs(num) < 1) return num.toFixed(Math.min(6, decimals));
  if (Math.abs(num) < 1000) return num.toFixed(Math.min(4, decimals));
  if (Math.abs(num) < 1000000) return `${(num / 1000).toFixed(2)  }K`;
  if (Math.abs(num) < 1000000000) return `${(num / 1000000).toFixed(2)  }M`;
  return `${(num / 1000000000).toFixed(2)  }B`;
}

/**
 * Create error result helper
 * @param message
. */
function createErrorResult(message: string): AmountValidationResult {
  return {
    isValid: false,
    error: message
  };
}

/**
 * Get standard decimals for common tokens
 * @param symbol
. */
export function getStandardDecimals(symbol: string): number {
  return STANDARD_DECIMALS[symbol.toUpperCase()] || 18;
}

/**
 * Convert amount between different decimal precisions
 * @param amount
 * @param fromDecimals
 * @param toDecimals
. */
export function convertAmountDecimals(
  amount: string,
  fromDecimals: number,
  toDecimals: number
): AmountConversionResult {
  try {
    const parsed = parseDecimalAmount(amount, fromDecimals);
    if (!parsed.success) {
      return { success: false, error: parsed.error || 'Failed to parse amount' };
    }

    const amountBigInt = parsed.amountInSmallestUnit!;
    
    if (fromDecimals === toDecimals) {
      return { success: true, convertedAmount: amount };
    }

    let convertedBigInt: bigint;
    
    if (fromDecimals > toDecimals) {
      // Reducing precision - potential loss of data
      const divisor = BigInt(10) ** BigInt(fromDecimals - toDecimals);
      convertedBigInt = amountBigInt / divisor;
      
      // Check for precision loss
      const remainder = amountBigInt % divisor;
      if (remainder !== BigInt(0)) {
        return { 
          success: false, 
          error: `Precision loss detected when converting from ${fromDecimals} to ${toDecimals} decimals` 
        };
      }
    } else {
      // Increasing precision
      const multiplier = BigInt(10) ** BigInt(toDecimals - fromDecimals);
      convertedBigInt = amountBigInt * multiplier;
    }

    const convertedAmount = formatFromSmallestUnit(convertedBigInt, toDecimals);
    
    return { success: true, convertedAmount };

  } catch (error) {
    return {
      success: false,
      error: `Decimal conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse amount to smallest unit (wei, satoshi, etc.)
 * @param amount
 * @param decimals
. */
export function parseToSmallestUnit(amount: string, decimals: number): bigint {
  const parsed = parseDecimalAmount(amount, decimals);
  return parsed.success ? parsed.amountInSmallestUnit! : BigInt(0);
}

/**
 * Check if amount is valid without full validation details
 * @param amount
 * @param options
. */
export function isValidAmount(amount: string | number, options?: AmountValidationOptions): boolean {
  return validateAmount(amount, options).isValid;
}

/**
 * Amount validation utilities
. */
export const amountValidationUtils = {
  validateAmount,
  validateAmounts,
  getStandardDecimals,
  convertAmountDecimals,
  formatFromSmallestUnit,
  parseDecimalAmount,
  isValidAmount,
  parseToSmallestUnit,
  
  // Additional utilities
  formatAmount,
  normalizeAmountInput,
  createErrorResult,
  
  // Constants
  VALIDATION_CONSTANTS,
  STANDARD_DECIMALS,
  CONTEXT_THRESHOLDS
};
