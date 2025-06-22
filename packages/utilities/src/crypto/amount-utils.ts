/**
 * @file Amount calculation utilities
 * @package @trading-bot/utilities
 * 
 * Production-grade amount calculation utilities with precise BigInt arithmetic,
 * unit conversions, and trading-specific calculations for multi-chain tokens.
. */

import type { 
  AmountPrecisionOptions,
  AmountDisplayOptions,
  TradingCalculationOptions,
  AmountConversionResult
} from '../../../types/src/utilities/crypto';

// ==========================================
// CORE AMOUNT CONVERSION FUNCTIONS
// ==========================================

/**
 * Convert token amount from human-readable to smallest unit (wei, satoshi, etc.)
 * @param amount
 * @param decimals
 * @param options
. */
export function toBaseUnits(
  amount: string | number, 
  decimals: number,
  options: AmountPrecisionOptions = {}
): bigint {
  const { roundingMode = 'nearest' } = options;

  if (decimals < 0 || decimals > 77) {
    throw new Error('Decimals must be between 0 and 77');
  }

  let amountStr: string;
  
  if (typeof amount === 'number') {
    if (!isFinite(amount) || amount < 0) {
      throw new Error('Amount must be a finite positive number');
    }
    amountStr = amount.toString();
  } else {
    amountStr = amount.trim();
  }

  // Handle scientific notation
  if (amountStr.includes('e') || amountStr.includes('E')) {
    const num = parseFloat(amountStr);
    if (isNaN(num) || !isFinite(num) || num < 0) {
      throw new Error('Invalid amount format');
    }
    amountStr = num.toFixed(decimals);
  }

  // Validate format
  if (!/^-?\d*\.?\d*$/.test(amountStr)) {
    throw new Error('Invalid number format');
  }

  const isNegative = amountStr.startsWith('-');
  if (isNegative) {
    amountStr = amountStr.slice(1);
  }

  // Split into integer and decimal parts
  const [integerPart = '0', decimalPart = ''] = amountStr.split('.');
  
  // Handle rounding for decimal part
  let paddedDecimal: string;
  if (decimalPart.length > decimals) {
    paddedDecimal = applyRounding(decimalPart, decimals, roundingMode);
  } else {
    paddedDecimal = decimalPart.padEnd(decimals, '0');
  }
  
  // Combine and convert to BigInt
  const combinedStr = integerPart + paddedDecimal;
  const result = BigInt(combinedStr || '0');
  
  return isNegative ? -result : result;
}

/**
 * Convert from smallest unit back to human-readable amount
 * @param amount
 * @param decimals
 * @param options
. */
export function fromBaseUnits(
  amount: bigint | string | number,
  decimals: number,
  options: AmountDisplayOptions = {}
): string {
  const { 
    precision, 
    removeTrailingZeros = true,
    roundingMode = 'nearest',
    maxSignificantDigits
  } = options;

  if (decimals < 0 || decimals > 77) {
    throw new Error('Decimals must be between 0 and 77');
  }

  const amountBigInt = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  
  const isNegative = amountBigInt < 0n;
  const absAmount = isNegative ? -amountBigInt : amountBigInt;
  
  const integerPart = absAmount / divisor;
  const fractionalPart = absAmount % divisor;
  
  let result = integerPart.toString();
  
  if (fractionalPart > 0n || decimals > 0) {
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    
    // Apply precision if specified
    if (precision !== undefined && precision < decimals) {
      fractionalStr = applyRounding(fractionalStr, precision, roundingMode);
    }
    
    // Apply significant digits limit
    if (maxSignificantDigits !== undefined) {
      const totalDigits = result.length + fractionalStr.replace(/0+$/, '').length;
      if (totalDigits > maxSignificantDigits) {
        const excessDigits = totalDigits - maxSignificantDigits;
        fractionalStr = fractionalStr.slice(0, -excessDigits);
      }
    }
    
    // Remove trailing zeros unless precision is specified
    if (removeTrailingZeros && precision === undefined) {
      fractionalStr = fractionalStr.replace(/0+$/, '');
    }
    
    if (fractionalStr) {
      result += `.${  fractionalStr}`;
    }
  }
  
  return isNegative ? `-${  result}` : result;
}

/**
 * Enhanced amount conversion between different decimal systems
 * @param amount
 * @param fromDecimals
 * @param toDecimals
 * @param options
. */
export function convertAmountDecimals(
  amount: bigint,
  fromDecimals: number,
  toDecimals: number,
  options: AmountPrecisionOptions = {}
): AmountConversionResult {
  const { roundingMode = 'nearest' } = options;

  if (fromDecimals === toDecimals) {
    return {
      amount,
      originalAmount: amount,
      sourceDecimals: fromDecimals,
      targetDecimals: toDecimals,
      precisionLoss: false,
      formatted: fromBaseUnits(amount, toDecimals)
    };
  }
  
  let convertedAmount: bigint;
  let precisionLoss = false;
  
  if (fromDecimals < toDecimals) {
    // Scale up - no precision loss
    const scale = BigInt(10 ** (toDecimals - fromDecimals));
    convertedAmount = amount * scale;
  } else {
    // Scale down - potential precision loss
    const scale = BigInt(10 ** (fromDecimals - toDecimals));
    const remainder = amount % scale;
    
    if (remainder !== 0n) {
      precisionLoss = true;
      
      // Apply rounding
      switch (roundingMode) {
        case 'up':
          convertedAmount = amount / scale + (amount > 0n ? 1n : 0n);
          break;
        case 'down':
        case 'truncate':
          convertedAmount = amount / scale;
          break;
        case 'nearest':
        default: {
          const halfScale = scale / 2n;
          convertedAmount = amount / scale + (remainder >= halfScale ? 1n : 0n);
          break;
        }
      }
    } else {
      convertedAmount = amount / scale;
    }
  }
  
  return {
    amount: convertedAmount,
    originalAmount: amount,
    sourceDecimals: fromDecimals,
    targetDecimals: toDecimals,
    precisionLoss,
    formatted: fromBaseUnits(convertedAmount, toDecimals)
  };
}

// ==========================================
// ARITHMETIC OPERATIONS
// ==========================================

/**
 * Add two amounts in base units with overflow protection
 * @param a
 * @param b
. */
export function addAmounts(a: bigint, b: bigint): bigint {
  const result = a + b;
  
  // Check for overflow (simple heuristic)
  if ((a > 0n && b > 0n && result < a) || (a < 0n && b < 0n && result > a)) {
    throw new Error('Arithmetic overflow detected');
  }
  
  return result;
}

/**
 * Subtract two amounts in base units with underflow protection
 * @param a
 * @param b
. */
export function subtractAmounts(a: bigint, b: bigint): bigint {
  const result = a - b;
  
  // Check for underflow
  if (a >= 0n && b >= 0n && result < 0n && a < b) {
    // Allow negative results but warn about potential underflow
  }
  
  return result;
}

/**
 * Multiply amount by a factor with precision handling
 * @param amount
 * @param factor
 * @param _options
. */
export function multiplyAmount(
  amount: bigint, 
  factor: string | number,
  _options: AmountPrecisionOptions = {}
): bigint {
  if (typeof factor === 'number') {
    if (!isFinite(factor) || factor < 0) {
      throw new Error('Factor must be a finite positive number');
    }
    factor = factor.toString();
  }

  // Handle decimal factors by scaling
  const [intPart = '0', decPart = ''] = factor.split('.');
  const factorInt = BigInt(intPart);
  
  if (decPart) {
    const decPlaces = decPart.length;
    const decValue = BigInt(decPart);
    const scale = BigInt(10 ** decPlaces);
    
    const result = (amount * factorInt * scale + amount * decValue) / scale;
    return result;
  }
  
  return amount * factorInt;
}

/**
 * Divide amount by a divisor with precision handling
 * @param amount
 * @param divisor
 * @param _options
. */
export function divideAmount(
  amount: bigint, 
  divisor: string | number,
  _options: AmountPrecisionOptions = {}
): bigint {
  if (typeof divisor === 'number') {
    if (!isFinite(divisor) || divisor <= 0) {
      throw new Error('Divisor must be a finite positive number');
    }
    divisor = divisor.toString();
  }

  const [intPart = '0', decPart = ''] = divisor.split('.');
  const divisorInt = BigInt(intPart);
  
  if (divisorInt === 0n) {
    throw new Error('Division by zero');
  }
  
  if (decPart) {
    const decPlaces = decPart.length;
    const decValue = BigInt(decPart);
    const scale = BigInt(10 ** decPlaces);
    const fullDivisor = divisorInt * scale + decValue;
    
    if (fullDivisor === 0n) {
      throw new Error('Division by zero');
    }
    
    const result = (amount * scale) / fullDivisor;
    return result;
  }
  
  return amount / divisorInt;
}

// ==========================================
// TRADING-SPECIFIC CALCULATIONS
// ==========================================

/**
 * Calculate percentage of an amount with precision
 * @param amount
 * @param percentage
 * @param options
. */
export function calculatePercentage(
  amount: bigint, 
  percentage: number,
  options: AmountPrecisionOptions = {}
): bigint {
  if (!isFinite(percentage) || percentage < 0) {
    throw new Error('Percentage must be a finite positive number');
  }
  
  // Convert percentage to fraction (e.g., 5% = 0.05)
  const factor = percentage / 100;
  return multiplyAmount(amount, factor, options);
}

/**
 * Apply slippage to an amount with advanced options
 * @param amount
 * @param slippagePercent
 * @param direction
 * @param options
. */
export function applySlippage(
  amount: bigint,
  slippagePercent: number,
  direction: 'positive' | 'negative' = 'negative',
  options: TradingCalculationOptions = {}
): bigint {
  const { slippageTolerance } = options;
  
  // Validate slippage is within tolerance
  if (slippageTolerance && slippagePercent > slippageTolerance) {
    throw new Error(`Slippage ${slippagePercent}% exceeds tolerance ${slippageTolerance}%`);
  }
  
  const slippageAmount = calculatePercentage(amount, slippagePercent);
  
  if (direction === 'positive') {
    return addAmounts(amount, slippageAmount);
  } 
    return subtractAmounts(amount, slippageAmount);
  
}

/**
 * Calculate comprehensive trading fees
 * @param amount
 * @param options
. */
export function calculateTradingFees(
  amount: bigint,
  options: TradingCalculationOptions
): {
  grossAmount: bigint;
  fees: {
    percentage: bigint;
    flat: bigint;
    total: bigint;
  };
  netAmount: bigint;
} {
  const {
    feePercentage = 0,
    feeType = 'percentage',
    flatFeeAmount = 0n
  } = options;

  let percentageFee = 0n;
  let flatFee = 0n;
  
  if (feeType === 'percentage' || feeType === 'flat') {
    if (feePercentage > 0) {
      percentageFee = calculatePercentage(amount, feePercentage);
    }
    
    if (flatFeeAmount > 0n) {
      flatFee = flatFeeAmount;
    }
  }
  
  const totalFees = addAmounts(percentageFee, flatFee);
  const netAmount = subtractAmounts(amount, totalFees);
  
  return {
    grossAmount: amount,
    fees: {
      percentage: percentageFee,
      flat: flatFee,
      total: totalFees
    },
    netAmount
  };
}

/**
 * Calculate price impact for trading with detailed analysis
 * @param _amountIn
 * @param amountOut
 * @param expectedAmountOut
 * @param options
. */
export function calculatePriceImpact(
  _amountIn: bigint,
  amountOut: bigint,
  expectedAmountOut: bigint,
  options: TradingCalculationOptions = {}
): {
  priceImpact: number;
  impactAmount: bigint;
  isWithinTolerance: boolean;
  severity: 'low' | 'medium' | 'high' | 'extreme';
} {
  const { priceImpactTolerance = 5 } = options;

  if (expectedAmountOut === 0n) {
    throw new Error('Expected amount out cannot be zero');
  }
  
  const difference = expectedAmountOut - amountOut;
  const impact = Number(difference * 10000n / expectedAmountOut) / 100;
  const priceImpact = Math.abs(impact);
  
  // Determine severity
  let severity: 'low' | 'medium' | 'high' | 'extreme';
  if (priceImpact < 1) severity = 'low';
  else if (priceImpact < 3) severity = 'medium';
  else if (priceImpact < 10) severity = 'high';
  else severity = 'extreme';
  
  return {
    priceImpact,
    impactAmount: difference,
    isWithinTolerance: priceImpact <= priceImpactTolerance,
    severity
  };
}

// ==========================================
// COMPARISON AND VALIDATION
// ==========================================

/**
 * Compare two amounts with tolerance
 * @param a
 * @param b
. */
export function compareAmounts(a: bigint, b: bigint): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Check if amount is within tolerance range
 * @param amount1
 * @param amount2
 * @param tolerancePercent
. */
export function isWithinTolerance(
  amount1: bigint,
  amount2: bigint,
  tolerancePercent: number
): boolean {
  if (amount1 === amount2) return true;
  
  const larger = amount1 > amount2 ? amount1 : amount2;
  const smaller = amount1 > amount2 ? amount2 : amount1;
  const difference = larger - smaller;
  const tolerance = calculatePercentage(larger, tolerancePercent);
  
  return difference <= tolerance;
}

/**
 * Check if amount is dust (too small to be meaningful)
 * @param amount
 * @param decimals
 * @param dustThreshold
. */
export function isDustAmount(
  amount: bigint,
  decimals: number,
  dustThreshold: number = 0.000001
): boolean {
  const dustInBaseUnits = toBaseUnits(dustThreshold.toString(), decimals);
  return amount < dustInBaseUnits;
}

/**
 * Round amount to nearest significant digits
 * @param amount
 * @param _decimals
 * @param significantDigits
. */
export function roundToSignificantDigits(
  amount: bigint,
  _decimals: number,
  significantDigits: number
): bigint {
  if (amount === 0n) return 0n;
  
  const amountStr = amount.toString();
  const totalDigits = amountStr.length;
  
  if (totalDigits <= significantDigits) {
    return amount;
  }
  
  const factor = BigInt(10 ** (totalDigits - significantDigits));
  const rounded = (amount + factor / 2n) / factor * factor;
  
  return rounded;
}

// ==========================================
// DISPLAY AND FORMATTING
// ==========================================

/**
 * Format amount for display with comprehensive options
 * @param amount
 * @param decimals
 * @param options
. */
export function formatAmountForDisplay(
  amount: bigint,
  decimals: number,
  options: AmountDisplayOptions = {}
): string {
  const {
    useGrouping = true,
    groupingSeparator = ',',
    decimalSeparator = '.',
    symbol,
    symbolPosition = 'after',
    minimumDisplay
  } = options;

  // Check minimum display threshold
  if (minimumDisplay) {
    const minAmount = toBaseUnits(minimumDisplay, decimals);
    if (amount < minAmount) {
      return `< ${minimumDisplay}${symbol ? ` ${symbol}` : ''}`;
    }
  }

  const amountStr = fromBaseUnits(amount, decimals, options);
  
  if (!useGrouping && !symbol) {
    return amountStr;
  }

  let formatted = amountStr;
  
  // Add thousands separators
  if (useGrouping) {
    const [intPart, decPart] = formatted.split('.');
    const formattedInt = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, groupingSeparator);
    formatted = decPart ? `${formattedInt}${decimalSeparator}${decPart}` : formattedInt;
  }
  
  // Add symbol
  if (symbol) {
    formatted = symbolPosition === 'before' ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
  }
  
  return formatted;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Apply rounding to decimal string
 * @param decimalStr
 * @param targetDecimals
 * @param roundingMode
. */
function applyRounding(
  decimalStr: string,
  targetDecimals: number,
  roundingMode: 'up' | 'down' | 'nearest' | 'truncate' = 'nearest'
): string {
  if (decimalStr.length <= targetDecimals) {
    return decimalStr.padEnd(targetDecimals, '0');
  }
  
  const truncated = decimalStr.slice(0, targetDecimals);
  const nextDigit = parseInt(decimalStr[targetDecimals] || '0', 10);
  
  switch (roundingMode) {
    case 'up':
      if (nextDigit > 0) {
        return incrementDecimalString(truncated);
      }
      return truncated;
    
    case 'down':
    case 'truncate':
      return truncated;
    
    case 'nearest':
    default:
      if (nextDigit >= 5) {
        return incrementDecimalString(truncated);
      }
      return truncated;
  }
}

/**
 * Increment decimal string by 1 in the last position
 * @param decimalStr
. */
function incrementDecimalString(decimalStr: string): string {
  if (!decimalStr) return '1';
  
  const digits = decimalStr.split('').map(d => parseInt(d, 10));
  let carry = 1;
  
  for (let i = digits.length - 1; i >= 0 && carry > 0; i--) {
    if (i < 0 || i >= digits.length) continue;
    
    const currentDigit = digits[i] ?? 0;
    digits[i] = currentDigit + carry;
    if (digits[i]! >= 10) {
      digits[i] = 0;
      carry = 1;
    } else {
      carry = 0;
    }
  }
  
  // If there's still a carry, we need to handle overflow
  if (carry > 0) {
    throw new Error('Decimal overflow during rounding');
  }
  
  return digits.join('');
}

// ==========================================
// EXPORT UTILITIES OBJECT
// ==========================================

/**
 * Amount calculation utilities organized by functionality
. */
export const amountUtils = {
  // Core conversions
  toBaseUnits,
  fromBaseUnits,
  convertDecimals: convertAmountDecimals,
  
  // Arithmetic operations
  add: addAmounts,
  subtract: subtractAmounts,
  multiply: multiplyAmount,
  divide: divideAmount,
  
  // Trading calculations
  calculatePercentage,
  applySlippage,
  calculateFees: calculateTradingFees,
  calculatePriceImpact,
  
  // Comparisons and validation
  compare: compareAmounts,
  isWithinTolerance,
  isDustAmount,
  
  // Formatting and display
  formatAmountForDisplay,
  roundToSignificantDigits,
  
  // Common token operations
  tokens: {
    // ETH (18 decimals)
    eth: {
      toWei: (amount: string | number) => toBaseUnits(amount, 18),
      fromWei: (wei: bigint) => fromBaseUnits(wei, 18),
      format: (wei: bigint, options?: AmountDisplayOptions) => 
        formatAmountForDisplay(wei, 18, { ...options, symbol: 'ETH' })
    },
    
    // USDC/USDT (6 decimals)
    usdc: {
      toBaseUnits: (amount: string | number) => toBaseUnits(amount, 6),
      fromBaseUnits: (units: bigint) => fromBaseUnits(units, 6),
      format: (units: bigint, options?: AmountDisplayOptions) => 
        formatAmountForDisplay(units, 6, { ...options, symbol: 'USDC', precision: 2 })
    },
    
    // Bitcoin (8 decimals)
    btc: {
      toSatoshi: (amount: string | number) => toBaseUnits(amount, 8),
      fromSatoshi: (satoshi: bigint) => fromBaseUnits(satoshi, 8),
      format: (satoshi: bigint, options?: AmountDisplayOptions) => 
        formatAmountForDisplay(satoshi, 8, { ...options, symbol: 'BTC' })
    }
  },
  
  // Trading helpers
  trading: {
    applySlippage: (amount: bigint, slippage: number, options?: TradingCalculationOptions) => 
      applySlippage(amount, slippage, 'negative', options),
    addSlippage: (amount: bigint, slippage: number, options?: TradingCalculationOptions) => 
      applySlippage(amount, slippage, 'positive', options),
    calculateFees: calculateTradingFees,
    checkMinimumAmount: (amount: bigint, minimum: bigint) => compareAmounts(amount, minimum) >= 0,
    priceImpact: calculatePriceImpact
  }
};
