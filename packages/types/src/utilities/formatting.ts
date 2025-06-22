/**
 * @file Formatting utility types for the utilities package.
 * @package @trading-bot/types
 */

/** Number formatting options. */
interface NumberFormatOptions {
  /** Locale for formatting. */
  locale?: string;
  
  /** Number of decimal places (alias for maximumFractionDigits). */
  decimals?: number;
  
  /** Use thousands separator. */
  useGrouping?: boolean;
  
  /** Thousands separator character (custom). */
  groupingSeparator?: string;
  
  /** Decimal separator character (custom). */
  decimalSeparator?: string;
  
  /** Minimum decimal places. */
  minimumFractionDigits?: number;
  
  /** Maximum decimal places. */
  maximumFractionDigits?: number;
  
  /** Minimum significant digits. */
  minimumSignificantDigits?: number;
  
  /** Maximum significant digits. */
  maximumSignificantDigits?: number;
  
  /** Number notation style. */
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  
  /** Compact display style. */
  compactDisplay?: 'short' | 'long';
  
  /** Sign display style. */
  signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero';
  
  /** Rounding mode. */
  roundingMode?: 'ceil' | 'floor' | 'expand' | 'trunc' | 'halfCeil' | 'halfFloor' | 'halfExpand' | 'halfTrunc' | 'halfEven';
  
  /** Rounding priority. */
  roundingPriority?: 'auto' | 'morePrecision' | 'lessPrecision';
  
  /** Rounding increment. */
  roundingIncrement?: number;
  
  /** Trailing zero display. */
  trailingZeroDisplay?: 'auto' | 'stripIfInteger';
  
  /** Use scientific notation for small/large numbers (custom). */
  useScientific?: boolean;
  
  /** Scientific notation threshold (custom). */
  scientificThreshold?: number;
}

/** Currency formatting options. */
interface CurrencyFormatOptions extends NumberFormatOptions {
  /** Currency code (USD, EUR, etc.). */
  currency: string;
  
  /** Currency display style. */
  currencyDisplay?: 'symbol' | 'code' | 'name';
  
  /** Currency symbol position. */
  currencyPosition?: 'before' | 'after';
  
  /** Custom currency symbol. */
  customSymbol?: string;
}

/** Price formatting options. */
interface PriceFormatOptions {
  /** Currency code. */
  currency?: string;
  
  /** Locale for formatting. */
  locale?: string;
  
  /** Minimum decimal places. */
  minimumFractionDigits?: number;
  
  /** Maximum decimal places. */
  maximumFractionDigits?: number;
  
  /** Show currency symbol/code. */
  showCurrency?: boolean;
  
  /** Use compact notation. */
  compact?: boolean;
}

/** Percentage formatting options. */
interface PercentageFormatOptions {
  /** Locale for formatting. */
  locale?: string;
  
  /** Minimum decimal places. */
  minimumFractionDigits?: number;
  
  /** Maximum decimal places. */
  maximumFractionDigits?: number;
  
  /** Always show +/- sign. */
  showSign?: boolean;
  
  /** Multiplier (default 100 for percentage). */
  multiplier?: number;
}

/** Large number formatting options. */
interface LargeNumberFormatOptions {
  /** Locale for formatting. */
  locale?: string;
  
  /** Decimal precision. */
  precision?: number;
  
  /** Use short suffixes (K, M, B) vs long (thousand, million, billion). */
  useShortSuffix?: boolean;
}

/** Token amount formatting options. */
interface TokenAmountFormatOptions {
  /** Locale for formatting. */
  locale?: string;
  
  /** Minimum decimal places. */
  minimumFractionDigits?: number;
  
  /** Maximum decimal places. */
  maximumFractionDigits?: number;
  
  /** Show full precision (all decimals). */
  showFullPrecision?: boolean;
  
  /** Use compact notation. */
  compact?: boolean;
}

/** Scientific notation formatting options. */
interface ScientificFormatOptions {
  /** Locale for formatting. */
  locale?: string;
  
  /** Decimal precision. */
  precision?: number;
  
  /** Force scientific notation. */
  forceExponent?: boolean;
}

/** Time formatting options. */
interface TimeFormatOptions {
  /** Time format style. */
  style?: 'short' | 'medium' | 'long' | 'full' | 'relative' | 'duration';
  
  /** Timezone. */
  timeZone?: string;
  
  /** Include milliseconds. */
  includeMs?: boolean;
  
  /** Date format pattern. */
  pattern?: string;
  
  /** Locale for formatting. */
  locale?: string;
}

/** Duration formatting options. */
interface DurationFormatOptions {
  /** Display style. */
  style?: 'short' | 'long' | 'compact';
  
  /** Precision level. */
  precision?: 'ms' | 's' | 'm' | 'h' | 'd';
  
  /** Maximum number of units to display. */
  maxUnits?: number;
}

/** Address formatting options. */
interface AddressFormatOptions {
  /** Number of characters to show at start and end. */
  chars?: number;
  
  /** Separator for truncation. */
  separator?: string;
  
  /** Include chain prefix. */
  includeChain?: boolean;
  
  /** Force lowercase. */
  lowercase?: boolean;
  
  /** Include checksum. */
  includeChecksum?: boolean;
}

/** Address display name options. */
interface AddressDisplayOptions {
  /** Display name. */
  name?: string;
  
  /** Fallback name if primary name not available. */
  fallback?: string;
  
  /** Show address alongside name. */
  showAddress?: boolean;
  
  /** Address formatting options. */
  addressOptions?: AddressFormatOptions;
}

/** Context types for address formatting. */
type AddressFormatContext = 'list' | 'detail' | 'tooltip' | 'mobile' | 'desktop';

/** Context types for time formatting. */
type TimeFormatContext = 'chart' | 'log' | 'trade' | 'notification' | 'tooltip';

/** Context types for number formatting. */
type NumberFormatContext = 'price' | 'amount' | 'percentage' | 'gas' | 'large' | 'scientific';

/** Blockchain address types. */
type AddressType = 'ethereum' | 'bitcoin' | 'solana' | 'cosmos' | 'unknown';

/** Supported blockchain networks. */
type SupportedChain = 'ethereum' | 'bsc' | 'polygon' | 'avalanche' | 'fantom' | 'arbitrum' | 'optimism' | 'bitcoin' | 'solana';

/** Trading market types. */
type TradingMarket = 'NYSE' | 'NASDAQ' | 'LSE' | 'TSE' | 'crypto';

/** Market session status types. */
type MarketSessionStatus = 'open' | 'closed' | 'pre-market' | 'after-hours' | 'always-open';

/** Address validation result. */
interface AddressValidationResult {
  /** Whether address is valid. */
  isValid: boolean;
  
  /** Address type if valid. */
  type: AddressType;
  
  /** Detected chain. */
  chain?: SupportedChain;
  
  /** Validation errors. */
  errors: string[];
  
  /** Additional metadata. */
  metadata?: {
    /** Checksummed address for EVM. */
    checksummed?: string;
    
    /** Is contract address. */
    isContract?: boolean;
    
    /** Address format. */
    format?: string;
  };
}

/** Market session information. */
interface MarketSessionInfo {
  /** Current session status. */
  status: MarketSessionStatus;
  
  /** Next status change time. */
  nextChange?: Date;
  
  /** Status message. */
  message: string;
}

/** Common crypto currencies. */
type CryptoCurrency = 'BTC' | 'ETH' | 'USDC' | 'USDT' | 'BNB' | 'ADA' | 'SOL' | 'MATIC' | 'AVAX' | 'FTM';

/** Fiat currencies. */
type FiatCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'KRW' | 'INR';

/** All supported currencies. */
type SupportedCurrency = CryptoCurrency | FiatCurrency;

/** Currency metadata. */
interface CurrencyInfo {
  /** Currency code. */
  code: SupportedCurrency;
  
  /** Display symbol. */
  symbol: string;
  
  /** Full name. */
  name: string;
  
  /** Default decimal places. */
  decimals: number;
  
  /** Currency type. */
  type: 'crypto' | 'fiat';
  
  /** Whether it's a stablecoin. */
  isStablecoin?: boolean;
}

/** Price change information. */
interface PriceChangeInfo {
  /** Current price. */
  current: number;
  
  /** Previous price. */
  previous: number;
  
  /** Absolute change. */
  change: number;
  
  /** Percentage change. */
  changePercent: number;
  
  /** Change direction. */
  direction: 'up' | 'down' | 'neutral';
}

/** Enhanced price change information with formatted strings. */
interface FormattedPriceChangeInfo extends PriceChangeInfo {
  /** Formatted absolute change string. */
  formattedChange?: string;
  
  /** Formatted percentage change string. */
  formattedPercent?: string;
  
  /** Formatted current price string. */
  formattedCurrent?: string;
  
  /** Formatted previous price string. */
  formattedPrevious?: string;
}

/** Formatting preset configurations. */
interface FormattingPresets {
  /** Address format presets. */
  address: Record<string, AddressFormatOptions>;
  
  /** Number format presets. */
  number: Record<string, NumberFormatOptions>;
  
  /** Time format presets. */
  time: Record<string, TimeFormatOptions>;
  
  /** Currency format presets. */
  currency: Record<string, CurrencyFormatOptions>;
}

// ========================================
// ADDITIONAL MISSING TYPES
// ========================================

/**
 * Number format type (alias for NumberFormatOptions).
 */
interface NumberFormat extends NumberFormatOptions {}

/**
 * Currency format type (alias for CurrencyFormatOptions).
 */
interface CurrencyFormat extends CurrencyFormatOptions {}

/**
 * Percentage format type (alias for PercentageFormatOptions).
 */
interface PercentageFormat extends PercentageFormatOptions {}

/**
 * Date format configuration.
 */
interface DateFormat {
  /** Date format style. */
  style?: 'short' | 'medium' | 'long' | 'full';
  
  /** Custom date pattern. */
  pattern?: string;
  
  /** Locale for formatting. */
  locale?: string;
  
  /** Timezone. */
  timeZone?: string;
}

/**
 * Time format type (alias for TimeFormatOptions).
 */
interface TimeFormat extends TimeFormatOptions {}

/**
 * Address display format.
 */
interface AddressDisplayFormat extends AddressFormatOptions {
  /** Display style. */
  style?: 'full' | 'truncated' | 'minimal';
}

/**
 * Token amount format (alias for TokenAmountFormatOptions).
 */
interface TokenAmountFormat extends TokenAmountFormatOptions {}

/**
 * Price format (alias for PriceFormatOptions).
 */
interface PriceFormat extends PriceFormatOptions {}

/**
 * General formatting options.
 */
interface FormattingOptions {
  /** Locale configuration. */
  locale?: string;
  
  /** Timezone. */
  timeZone?: string;
  
  /** Currency. */
  currency?: string;
  
  /** Number format. */
  numberFormat?: NumberFormatOptions;
  
  /** Date format. */
  dateFormat?: DateFormat;
  
  /** Accessibility options. */
  accessibility?: AccessibilityFormat;
}

/**
 * Locale configuration.
 */
interface LocaleConfig {
  /** Locale code. */
  code: string;
  
  /** Display name. */
  name: string;
  
  /** Default currency. */
  currency: string;
  
  /** Number formatting defaults. */
  numberDefaults: NumberFormatOptions;
  
  /** Date formatting defaults. */
  dateDefaults: DateFormat;
}

/**
 * Formatting context information.
 */
interface FormattingContext {
  /** Context type. */
  type: 'display' | 'export' | 'print' | 'mobile';
  
  /** User locale. */
  locale?: string;
  
  /** Device type. */
  device?: 'mobile' | 'tablet' | 'desktop';
  
  /** Screen size. */
  screenSize?: 'small' | 'medium' | 'large';
}

/**
 * Formatting rule configuration.
 */
interface FormattingRule {
  /** Rule condition. */
  condition: (value: unknown, context?: FormattingContext) => boolean;
  
  /** Format to apply. */
  format: Record<string, unknown>;
  
  /** Rule priority. */
  priority?: number;
}

/**
 * Conditional format configuration.
 */
interface ConditionalFormat {
  /** Format rules. */
  rules: FormattingRule[];
  
  /** Default format. */
  default: Record<string, unknown>;
}

/**
 * Custom formatter function.
 */
interface CustomFormatter {
  /** Formatter name. */
  name: string;
  
  /** Format function. */
  format: (value: unknown, options?: Record<string, unknown>) => string;
  
  /** Formatter description. */
  description?: string;
}

/**
 * Formatting provider interface.
 */
interface FormattingProvider {
  /** Provider name. */
  name: string;
  
  /** Supported formats. */
  formats: string[];
  
  /** Format method. */
  format: (value: unknown, format: string, options?: Record<string, unknown>) => string;
}

/**
 * Formatting cache interface.
 */
interface FormattingCache {
  /** Get cached format. */
  get: (key: string) => string | undefined;
  
  /** Set cached format. */
  set: (key: string, value: string) => void;
  
  /** Clear cache. */
  clear: () => void;
}

/**
 * Formatting preset (alias for FormattingPresets).
 */
interface FormattingPreset extends FormattingPresets {}

/**
 * Responsive format configuration.
 */
interface ResponsiveFormat {
  /** Breakpoints. */
  breakpoints: {
    small: Record<string, unknown>;
    medium: Record<string, unknown>;
    large: Record<string, unknown>;
  };
}

/**
 * Accessibility format options.
 */
interface AccessibilityFormat {
  /** High contrast mode. */
  highContrast?: boolean;
  
  /** Screen reader optimized. */
  screenReader?: boolean;
  
  /** Use semantic markup. */
  semantic?: boolean;
  
  /** ARIA labels. */
  ariaLabels?: Record<string, string>;
}

/**
 * Validation format options.
 */
interface ValidationFormat {
  /** Show validation errors. */
  showErrors?: boolean;
  
  /** Error message format. */
  errorFormat?: string;
  
  /** Highlight invalid values. */
  highlightInvalid?: boolean;
}

/**
 * Export format configuration.
 */
interface ExportFormat {
  /** Export format type. */
  type: 'csv' | 'json' | 'xlsx' | 'pdf';
  
  /** Format options. */
  options: Record<string, unknown>;
  
  /** File extension. */
  extension: string;
}

/**
 * Print format configuration.
 */
interface PrintFormat {
  /** Page size. */
  pageSize?: 'A4' | 'letter' | 'legal';
  
  /** Orientation. */
  orientation?: 'portrait' | 'landscape';
  
  /** Print styles. */
  styles?: Record<string, string>;
}

/**
 * Display configuration.
 */
interface DisplayConfig {
  /** Theme. */
  theme?: 'light' | 'dark' | 'auto';
  
  /** Color scheme. */
  colorScheme?: Record<string, string>;
  
  /** Typography. */
  typography?: Record<string, string>;
}

/**
 * Format metadata.
 */
interface FormatMetadata {
  /** Format version. */
  version: string;
  
  /** Creation timestamp. */
  created: number;
  
  /** Last modified. */
  modified: number;
  
  /** Format author. */
  author?: string;
}

/**
 * Formatting error.
 */
interface FormattingError {
  /** Error code. */
  code: string;
  
  /** Error message. */
  message: string;
  
  /** Original value. */
  value?: unknown;
  
  /** Format attempted. */
  format?: string;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default format configurations.
 */
const DEFAULT_FORMATS = {
  number: {
    locale: 'en-US',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  },
  currency: {
    locale: 'en-US',
    currency: 'USD',
    currencyDisplay: 'symbol'
  },
  percentage: {
    locale: 'en-US',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  },
  date: {
    locale: 'en-US',
    style: 'medium'
  },
  time: {
    locale: 'en-US',
    style: 'medium'
  },
  address: {
    chars: 6,
    separator: '...'
  }
} as const;

/**
 * Locale configurations.
 */
const LOCALE_CONFIGS = {
  'en-US': {
    code: 'en-US',
    name: 'English (US)',
    currency: 'USD',
    numberDefaults: { useGrouping: true },
    dateDefaults: { style: 'medium' }
  },
  'en-GB': {
    code: 'en-GB',
    name: 'English (UK)',
    currency: 'GBP',
    numberDefaults: { useGrouping: true },
    dateDefaults: { style: 'medium' }
  },
  'zh-CN': {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    currency: 'CNY',
    numberDefaults: { useGrouping: true },
    dateDefaults: { style: 'medium' }
  }
} as const;

/**
 * Format presets.
 */
const FORMAT_PRESETS = {
  trading: {
    price: { minimumFractionDigits: 2, maximumFractionDigits: 8 },
    volume: { notation: 'compact', compactDisplay: 'short' },
    percentage: { showSign: true, minimumFractionDigits: 2 }
  },
  dashboard: {
    large: { notation: 'compact', compactDisplay: 'short' },
    small: { maximumFractionDigits: 2 },
    address: { chars: 4, separator: '...' }
  },
  mobile: {
    compact: { notation: 'compact' },
    address: { chars: 4 },
    time: { style: 'short' }
  }
} as const;

// Consolidated export declaration
export type {
  NumberFormatOptions,
  CurrencyFormatOptions,
  PriceFormatOptions,
  PercentageFormatOptions,
  LargeNumberFormatOptions,
  TokenAmountFormatOptions,
  ScientificFormatOptions,
  TimeFormatOptions,
  DurationFormatOptions,
  AddressFormatOptions,
  AddressDisplayOptions,
  AddressFormatContext,
  TimeFormatContext,
  NumberFormatContext,
  AddressType,
  SupportedChain,
  TradingMarket,
  MarketSessionStatus,
  AddressValidationResult,
  MarketSessionInfo,
  CryptoCurrency,
  FiatCurrency,
  SupportedCurrency,
  CurrencyInfo,
  PriceChangeInfo,
  FormattedPriceChangeInfo,
  FormattingPresets,
  NumberFormat,
  CurrencyFormat,
  PercentageFormat,
  DateFormat,
  TimeFormat,
  AddressDisplayFormat,
  TokenAmountFormat,
  PriceFormat,
  FormattingOptions,
  LocaleConfig,
  FormattingContext,
  FormattingRule,
  ConditionalFormat,
  CustomFormatter,
  FormattingProvider,
  FormattingCache,
  FormattingPreset,
  ResponsiveFormat,
  AccessibilityFormat,
  ValidationFormat,
  ExportFormat,
  PrintFormat,
  DisplayConfig,
  FormatMetadata,
  FormattingError
};

export {
  DEFAULT_FORMATS,
  LOCALE_CONFIGS,
  FORMAT_PRESETS
}; 