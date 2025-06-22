/**
 * @file Number formatting utilities
 * @package @trading-bot/utilities
 * 
 * Production-grade number formatting with locale support, precision control,
 * and various display formats for trading applications.
. */

import type { 
  NumberFormatOptions,
  PriceFormatOptions,
  PercentageFormatOptions,
  LargeNumberFormatOptions,
  TokenAmountFormatOptions,
  ScientificFormatOptions,
  NumberFormatContext
} from '@trading-bot/types/src/utilities/formatting/formatting';

/**
 * Format number with comprehensive options
 * @param value
 * @param options
. */
export function formatNumber(
  value: number | bigint | string,
  options: NumberFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    minimumFractionDigits = 0,
    maximumFractionDigits = 20,
    minimumSignificantDigits,
    maximumSignificantDigits,
    useGrouping = true,
    notation = 'standard',
    compactDisplay = 'short',
    signDisplay = 'auto',
    roundingMode = 'halfExpand',
    roundingPriority = 'auto',
    roundingIncrement,
    trailingZeroDisplay = 'auto'
  } = options;

  try {
    // Convert to number if needed
    const numValue = typeof value === 'string' ? parseFloat(value) : 
                     typeof value === 'bigint' ? Number(value) : value;

    // Handle special cases
    if (!isFinite(numValue)) {
      if (isNaN(numValue)) return 'NaN';
      return numValue > 0 ? '∞' : '-∞';
    }

    // Create Intl.NumberFormat options with type assertion for newer properties
    const formatOptions: Intl.NumberFormatOptions & Record<string, unknown> = {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
      notation,
      compactDisplay,
      signDisplay
    };

    // Add newer properties conditionally (for TypeScript compatibility)
    if (roundingMode) formatOptions.roundingMode = roundingMode;
    if (roundingPriority) formatOptions.roundingPriority = roundingPriority;
    if (trailingZeroDisplay) formatOptions.trailingZeroDisplay = trailingZeroDisplay;

    // Add significant digits and rounding increment if specified
    if (minimumSignificantDigits !== undefined) {
      formatOptions.minimumSignificantDigits = minimumSignificantDigits;
    }
    if (maximumSignificantDigits !== undefined) {
      formatOptions.maximumSignificantDigits = maximumSignificantDigits;
    }
    if (roundingIncrement !== undefined) {
      formatOptions.roundingIncrement = roundingIncrement;
    }

    return new Intl.NumberFormat(locale, formatOptions).format(numValue);

  } catch (error) {
    // Fallback to simple formatting
    console.warn('Number formatting failed, using fallback:', error);
    return String(value);
  }
}

/**
 * Format price with appropriate precision
 * @param price
 * @param options
. */
export function formatPrice(
  price: number | string,
  options: PriceFormatOptions = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    minimumFractionDigits,
    maximumFractionDigits,
    showCurrency = true,
    compact = false
  } = options;

  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (!isFinite(numPrice)) {
    return showCurrency ? `${currency} 0.00` : '0.00';
  }

  // Auto-determine precision based on price magnitude
  let minDigits = minimumFractionDigits;
  let maxDigits = maximumFractionDigits;

  if (minDigits === undefined || maxDigits === undefined) {
    if (numPrice >= 1000) {
      minDigits = minDigits ?? 2;
      maxDigits = maxDigits ?? 2;
    } else if (numPrice >= 1) {
      minDigits = minDigits ?? 2;
      maxDigits = maxDigits ?? 4;
    } else if (numPrice >= 0.01) {
      minDigits = minDigits ?? 4;
      maxDigits = maxDigits ?? 6;
    } else if (numPrice >= 0.0001) {
      minDigits = minDigits ?? 6;
      maxDigits = maxDigits ?? 8;
    } else {
      minDigits = minDigits ?? 8;
      maxDigits = maxDigits ?? 12;
    }
  }

  const formatOptions: NumberFormatOptions = {
    locale,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short'
  };

  const formattedNumber = formatNumber(numPrice, formatOptions);
  
  return showCurrency ? `${currency} ${formattedNumber}` : formattedNumber;
}

/**
 * Format percentage with proper precision
 * @param value
 * @param options
. */
export function formatPercentage(
  value: number,
  options: PercentageFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSign = false,
    multiplier = 100
  } = options;

  const percentage = value * multiplier;
  
  const formatOptions: NumberFormatOptions = {
    locale,
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay: showSign ? 'always' : 'auto'
  };

  return `${formatNumber(percentage, formatOptions)  }%`;
}

/**
 * Format large numbers with appropriate suffixes
 * @param value
 * @param options
. */
export function formatLargeNumber(
  value: number,
  options: LargeNumberFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    precision = 2,
    useShortSuffix = true
  } = options;

  if (!isFinite(value)) {
    return String(value);
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // Define suffixes
  const suffixes = useShortSuffix 
    ? ['', 'K', 'M', 'B', 'T', 'P', 'E']
    : ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion'];

  // Find appropriate suffix
  let suffixIndex = 0;
  let scaledValue = absValue;

  while (scaledValue >= 1000 && suffixIndex < suffixes.length - 1) {
    scaledValue /= 1000;
    suffixIndex++;
  }

  // Format the scaled value
  const formatOptions: NumberFormatOptions = {
    locale,
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  };

  const formattedValue = formatNumber(scaledValue, formatOptions);
  const suffix = suffixes[suffixIndex];

  return `${sign}${formattedValue}${suffix ? (useShortSuffix ? suffix : ` ${suffix}`) : ''}`;
}

/**
 * Format token amount with appropriate decimals
 * @param amount
 * @param decimals
 * @param options
. */
export function formatTokenAmount(
  amount: bigint | string | number,
  decimals: number,
  options: TokenAmountFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    minimumFractionDigits,
    maximumFractionDigits,
    showFullPrecision = false,
    compact = false
  } = options;

  try {
    // Convert to bigint if needed
    const amountBigInt = typeof amount === 'bigint' ? amount :
                        typeof amount === 'string' ? BigInt(amount) :
                        BigInt(Math.floor(amount));

    // Convert to decimal
    const divisor = BigInt(10 ** decimals);
    const integerPart = amountBigInt / divisor;
    const fractionalPart = amountBigInt % divisor;

    // Build decimal string
    let decimalString = integerPart.toString();
    
    if (fractionalPart > 0n || showFullPrecision) {
      const fractionalString = fractionalPart.toString().padStart(decimals, '0');
      
      if (showFullPrecision) {
        decimalString += `.${  fractionalString}`;
      } else {
        // Remove trailing zeros
        const trimmedFractional = fractionalString.replace(/0+$/, '');
        if (trimmedFractional) {
          decimalString += `.${  trimmedFractional}`;
        }
      }
    }

    const numValue = parseFloat(decimalString);
    
    // Auto-determine precision if not specified
    let minDigits = minimumFractionDigits;
    let maxDigits = maximumFractionDigits;

    if (!showFullPrecision && (minDigits === undefined || maxDigits === undefined)) {
      if (numValue >= 1000) {
        minDigits = minDigits ?? 2;
        maxDigits = maxDigits ?? 4;
      } else if (numValue >= 1) {
        minDigits = minDigits ?? 2;
        maxDigits = maxDigits ?? 6;
      } else {
        minDigits = minDigits ?? 0;
        maxDigits = maxDigits ?? 8;
      }
    }

    const formatOptions: NumberFormatOptions = {
      locale,
      minimumFractionDigits: showFullPrecision ? decimals : minDigits || 0,
      maximumFractionDigits: showFullPrecision ? decimals : maxDigits || 0,
      notation: compact ? 'compact' : 'standard',
      useGrouping: !showFullPrecision
    };

    return formatNumber(numValue, formatOptions);

  } catch (error) {
    console.warn('Token amount formatting failed:', error);
    return String(amount);
  }
}

/**
 * Format scientific notation numbers
 * @param value
 * @param options
. */
export function formatScientific(
  value: number,
  options: ScientificFormatOptions = {}
): string {
  const {
    locale = 'en-US',
    precision = 2,
    forceExponent = false
  } = options;

  if (!isFinite(value)) {
    return String(value);
  }

  const shouldUseScientific = forceExponent || 
    Math.abs(value) >= 1e6 || 
    (Math.abs(value) < 1e-4 && value !== 0);

  if (shouldUseScientific) {
    const formatOptions: NumberFormatOptions = {
      locale,
      notation: 'scientific',
      minimumFractionDigits: 0,
      maximumFractionDigits: precision
    };

    return formatNumber(value, formatOptions);
  } 
    return formatNumber(value, {
      locale,
      minimumFractionDigits: 0,
      maximumFractionDigits: precision
    });
  
}

/**
 * Format numbers for different contexts
 * @param value
 * @param context
 * @param options
. */
export function formatByContext(
  value: number,
  context: NumberFormatContext,
  options: Record<string, unknown> & { decimals?: number } = {}
): string {
  switch (context) {
    case 'price':
      return formatPrice(value, options as PriceFormatOptions);
    
    case 'amount':
      return formatTokenAmount(value, options.decimals ?? 18, options as TokenAmountFormatOptions);
    
    case 'percentage':
      return formatPercentage(value, options as PercentageFormatOptions);
    
    case 'gas':
      return formatLargeNumber(value, { precision: 0, ...(options as LargeNumberFormatOptions) });
    
    case 'large':
      return formatLargeNumber(value, options as LargeNumberFormatOptions);
    
    case 'scientific':
      return formatScientific(value, options as ScientificFormatOptions);
    
    default:
      return formatNumber(value, options as NumberFormatOptions);
  }
}

/**
 * Parse formatted number string back to number
 * @param formatted
 * @param locale
. */
export function parseFormattedNumber(
  formatted: string,
  locale: string = 'en-US'
): number | null {
  if (!formatted || typeof formatted !== 'string') {
    return null;
  }

  try {
    // Get locale-specific number format symbols
    const localeInfo = new Intl.NumberFormat(locale).formatToParts(1234.5);
    const groupSeparator = localeInfo.find(part => part.type === 'group')?.value || ',';
    const decimalSeparator = localeInfo.find(part => part.type === 'decimal')?.value || '.';

    // Remove currency symbols and extra spaces
    let cleaned = formatted.replace(/[$€£¥₿Ξ]/g, '').trim();
    
    // Handle percentage
    const isPercentage = cleaned.endsWith('%');
    if (isPercentage) {
      cleaned = cleaned.slice(0, -1).trim();
    }
    
    // Handle compact notation (K, M, B, T)
    const compactMatch = cleaned.match(/([0-9.,\s]+)\s*([KMBT])$/i);
    if (compactMatch) {
      let baseValueStr = (compactMatch[1] || '0').trim();
      
      // Handle locale-specific separators
      if (groupSeparator !== ',' && decimalSeparator !== '.') {
        baseValueStr = baseValueStr.replace(new RegExp(`\\${groupSeparator}`, 'g'), '');
        baseValueStr = baseValueStr.replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.');
      } else {
        baseValueStr = baseValueStr.replace(/[,\s]/g, '');
      }
      
      const baseValue = parseFloat(baseValueStr);
      const multiplier = (compactMatch[2] || '').toUpperCase();
      const multipliers = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
      cleaned = String(baseValue * multipliers[multiplier as keyof typeof multipliers]);
    } else {
      // Handle locale-specific number formatting
      if (groupSeparator !== ',' || decimalSeparator !== '.') {
        // Remove grouping separators and normalize decimal separator
        cleaned = cleaned.replace(new RegExp(`\\${groupSeparator}`, 'g'), '');
        cleaned = cleaned.replace(new RegExp(`\\${decimalSeparator}`, 'g'), '.');
      } else {
        // Standard English format - remove grouping separators (commas, spaces)
        cleaned = cleaned.replace(/[,\s]/g, '');
      }
    }
    
    // Parse the number
    const parsed = parseFloat(cleaned);
    
    if (isNaN(parsed)) {
      return null;
    }
    
    // Apply percentage division if needed
    return isPercentage ? parsed / 100 : parsed;
    
  } catch (error) {
    return null;
  }
}

/**
 * Number formatting utilities
. */
export const numberFormattingUtils = {
  formatNumber,
  formatPrice,
  formatPercentage,
  formatLargeNumber,
  formatTokenAmount,
  formatScientific,
  formatByContext,
  parseFormattedNumber,
  
  // Predefined formatters
  formatters: {
    usd: (value: number) => formatPrice(value, { currency: 'USD' }),
    eur: (value: number) => formatPrice(value, { currency: 'EUR' }),
    btc: (value: number) => formatTokenAmount(value, 8, { compact: false }),
    eth: (value: number) => formatTokenAmount(value, 18, { compact: false }),
    gwei: (value: number) => `${formatNumber(value, { maximumFractionDigits: 2 })  } Gwei`,
    gas: (value: number) => formatLargeNumber(value, { precision: 0 }),
    percent: (value: number) => formatPercentage(value, { showSign: true }),
    basis: (value: number) => `${formatNumber(value * 10000, { maximumFractionDigits: 0 })  } bps`
  }
};
