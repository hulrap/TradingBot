/**
 * @file Currency formatting utilities
 * @package @trading-bot/utilities
 * 
 * Production-grade currency formatting with multiple currency support,
 * locale-aware formatting, and trading-specific display formats.
. */

import type { 
  CurrencyFormatOptions,
  CurrencyInfo,
  FormattedPriceChangeInfo,
  SupportedCurrency,
  CryptoCurrency,
  FiatCurrency
} from '../../../types/src/utilities/formatting';

/**
 * Format currency with comprehensive options
 * @param amount
 * @param options
. */
export function formatCurrency(
  amount: number | string,
  options: CurrencyFormatOptions
): string {
  const {
    currency,
    currencyDisplay = 'symbol',
    currencyPosition = 'before',
    customSymbol,
    locale = 'en-US',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    useGrouping = true
  } = options;

  try {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (!isFinite(numAmount)) {
      return 'Invalid Amount';
    }

    // Use custom symbol if provided
    if (customSymbol) {
      const formattedNumber = new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
        useGrouping
      }).format(numAmount);
      
      return currencyPosition === 'before' 
        ? `${customSymbol}${formattedNumber}`
        : `${formattedNumber} ${customSymbol}`;
    }

    // Use Intl.NumberFormat for standard currencies
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay,
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping
    });

    return formatter.format(numAmount);

  } catch (error) {
    console.warn('Currency formatting failed:', error);
    return `${currency} ${amount}`;
  }
}

/**
 * Format price change with direction and styling
 * @param current
 * @param previous
 * @param options
 * @param options.currency
 * @param options.showPercentage
 * @param options.showAbsolute
 * @param options.locale
 * @param options.precision
. */
export function formatPriceChange(
  current: number,
  previous: number,
  options: {
    currency?: SupportedCurrency;
    showPercentage?: boolean;
    showAbsolute?: boolean;
    locale?: string;
    precision?: number;
  } = {}
): FormattedPriceChangeInfo {
  const {
    currency = 'USD',
    showPercentage = true,
    showAbsolute = true,
    locale = 'en-US',
    precision = 2
  } = options;

  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;
  
  let direction: 'up' | 'down' | 'neutral' = 'neutral';
  if (change > 0) direction = 'up';
  else if (change < 0) direction = 'down';

  // Format values if requested
  const result: FormattedPriceChangeInfo = {
    current,
    previous,
    change,
    changePercent,
    direction
  };

  // Add formatted strings if requested
  if (showAbsolute) {
    result.formattedChange = formatDynamicPrice(Math.abs(change), currency, { locale });
    result.formattedCurrent = formatDynamicPrice(current, currency, { locale });
    result.formattedPrevious = formatDynamicPrice(previous, currency, { locale });
  }

  if (showPercentage) {
    const sign = direction === 'up' ? '+' : direction === 'down' ? '-' : '';
    result.formattedPercent = `${sign}${Math.abs(changePercent).toFixed(precision)}%`;
  }

  return result;
}

/**
 * Format market cap with appropriate scaling
 * @param marketCap
 * @param options
 * @param options.currency
 * @param options.locale
 * @param options.useCompact
. */
export function formatMarketCap(
  marketCap: number,
  options: {
    currency?: FiatCurrency;
    locale?: string;
    useCompact?: boolean;
  } = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    useCompact = true
  } = options;

  if (!isFinite(marketCap) || marketCap < 0) {
    return 'N/A';
  }

  const formatOptions: CurrencyFormatOptions = {
    currency,
    locale,
    notation: useCompact ? 'compact' : 'standard',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: marketCap >= 1e9 ? 1 : 2
  };

  return formatCurrency(marketCap, formatOptions);
}

/**
 * Format trading volume
 * @param volume
 * @param options
 * @param options.currency
 * @param options.timeframe
 * @param options.locale
 * @param options.useCompact
. */
export function formatTradingVolume(
  volume: number,
  options: {
    currency?: SupportedCurrency;
    timeframe?: '24h' | '1h' | '7d' | '30d';
    locale?: string;
    useCompact?: boolean;
  } = {}
): string {
  const {
    currency = 'USD',
    timeframe = '24h',
    locale = 'en-US',
    useCompact = true
  } = options;

  if (!isFinite(volume) || volume < 0) {
    return 'N/A';
  }

  const formatOptions: CurrencyFormatOptions = {
    currency,
    locale,
    notation: useCompact ? 'compact' : 'standard',
    compactDisplay: 'short',
    minimumFractionDigits: 0,
    maximumFractionDigits: volume >= 1e6 ? 1 : 2
  };

  const formattedVolume = formatCurrency(volume, formatOptions);
  return `${formattedVolume} (${timeframe})`;
}

/**
 * Format price with dynamic precision based on value
 * @param price
 * @param currency
 * @param options
 * @param options.locale
 * @param options.maxPrecision
. */
export function formatDynamicPrice(
  price: number,
  currency: SupportedCurrency = 'USD',
  options: {
    locale?: string;
    maxPrecision?: number;
  } = {}
): string {
  const {
    locale = 'en-US',
    maxPrecision = 8
  } = options;

  if (!isFinite(price)) {
    return 'N/A';
  }

  // Dynamic precision based on price magnitude
  let minimumFractionDigits = 2;
  let maximumFractionDigits = 2;

  if (price >= 1000) {
    minimumFractionDigits = 0;
    maximumFractionDigits = 2;
  } else if (price >= 100) {
    minimumFractionDigits = 2;
    maximumFractionDigits = 2;
  } else if (price >= 1) {
    minimumFractionDigits = 2;
    maximumFractionDigits = 4;
  } else if (price >= 0.01) {
    minimumFractionDigits = 4;
    maximumFractionDigits = 6;
  } else if (price >= 0.0001) {
    minimumFractionDigits = 6;
    maximumFractionDigits = 8;
  } else {
    minimumFractionDigits = 8;
    maximumFractionDigits = Math.min(maxPrecision, 12);
  }

  const formatOptions: CurrencyFormatOptions = {
    currency,
    locale,
    minimumFractionDigits,
    maximumFractionDigits
  };

  return formatCurrency(price, formatOptions);
}

/**
 * Currency metadata registry
. */
export const currencyRegistry: Record<SupportedCurrency, CurrencyInfo> = {
  // Cryptocurrencies
  BTC: { code: 'BTC', symbol: '₿', name: 'Bitcoin', decimals: 8, type: 'crypto' },
  ETH: { code: 'ETH', symbol: 'Ξ', name: 'Ethereum', decimals: 18, type: 'crypto' },
  USDC: { code: 'USDC', symbol: 'USDC', name: 'USD Coin', decimals: 6, type: 'crypto', isStablecoin: true },
  USDT: { code: 'USDT', symbol: 'USDT', name: 'Tether', decimals: 6, type: 'crypto', isStablecoin: true },
  BNB: { code: 'BNB', symbol: 'BNB', name: 'BNB', decimals: 18, type: 'crypto' },
  ADA: { code: 'ADA', symbol: 'ADA', name: 'Cardano', decimals: 6, type: 'crypto' },
  SOL: { code: 'SOL', symbol: 'SOL', name: 'Solana', decimals: 9, type: 'crypto' },
  MATIC: { code: 'MATIC', symbol: 'MATIC', name: 'Polygon', decimals: 18, type: 'crypto' },
  AVAX: { code: 'AVAX', symbol: 'AVAX', name: 'Avalanche', decimals: 18, type: 'crypto' },
  FTM: { code: 'FTM', symbol: 'FTM', name: 'Fantom', decimals: 18, type: 'crypto' },
  
  // Fiat currencies
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, type: 'fiat' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, type: 'fiat' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, type: 'fiat' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0, type: 'fiat' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2, type: 'fiat' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimals: 0, type: 'fiat' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimals: 2, type: 'fiat' }
};

/**
 * Crypto-specific currency registry
. */
export const cryptoRegistry: Record<CryptoCurrency, CurrencyInfo> = {
  BTC: currencyRegistry.BTC,
  ETH: currencyRegistry.ETH,
  USDC: currencyRegistry.USDC,
  USDT: currencyRegistry.USDT,
  BNB: currencyRegistry.BNB,
  ADA: currencyRegistry.ADA,
  SOL: currencyRegistry.SOL,
  MATIC: currencyRegistry.MATIC,
  AVAX: currencyRegistry.AVAX,
  FTM: currencyRegistry.FTM
};

/**
 * Get all supported cryptocurrencies
. */
export function getSupportedCryptocurrencies(): CryptoCurrency[] {
  return Object.keys(cryptoRegistry) as CryptoCurrency[];
}

/**
 * Get cryptocurrency information
 * @param currency
. */
export function getCryptocurrencyInfo(currency: CryptoCurrency): CurrencyInfo {
  return cryptoRegistry[currency];
}

/**
 * Format cryptocurrency amount with appropriate decimals
 * @param amount
 * @param currency
 * @param options
 * @param options.locale
 * @param options.showSymbol
 * @param options.useNativeDecimals
 * @param options.maxPrecision
. */
export function formatCryptocurrencyAmount(
  amount: number,
  currency: CryptoCurrency,
  options: {
    locale?: string;
    showSymbol?: boolean;
    useNativeDecimals?: boolean;
    maxPrecision?: number;
  } = {}
): string {
  const {
    locale = 'en-US',
    showSymbol = true,
    useNativeDecimals = true,
    maxPrecision = 8
  } = options;

  const cryptoInfo = getCryptocurrencyInfo(currency);
  const decimals = useNativeDecimals ? cryptoInfo.decimals : 2;
  
  const formatOptions: CurrencyFormatOptions = {
    currency,
    locale,
    currencyPosition: 'after',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, maxPrecision),
    ...(showSymbol && { customSymbol: cryptoInfo.symbol })
  };

  return formatCurrency(amount, formatOptions);
}

/**
 * Check if currency is a valid cryptocurrency
 * @param currency
. */
export function isValidCryptocurrency(currency: string): currency is CryptoCurrency {
  return currency in cryptoRegistry;
}

/**
 * Get cryptocurrency by symbol
 * @param symbol
. */
export function getCryptocurrencyBySymbol(symbol: string): CryptoCurrency | null {
  const entries = Object.entries(cryptoRegistry);
  const found = entries.find(([, info]) => info.symbol.toLowerCase() === symbol.toLowerCase());
  return found ? found[0] as CryptoCurrency : null;
}

/**
 * Get all stablecoins
. */
export function getStablecoins(): CryptoCurrency[] {
  return getSupportedCryptocurrencies().filter(currency => 
    cryptoRegistry[currency].isStablecoin
  );
}

/**
 * Format crypto trading pair
 * @param baseCurrency
 * @param quoteCurrency
 * @param separator
. */
export function formatCryptoPair(
  baseCurrency: CryptoCurrency,
  quoteCurrency: SupportedCurrency,
  separator: string = '/'
): string {
  return formatCurrencyPair(baseCurrency, quoteCurrency, separator);
}

/**
 * Get currency information
 * @param currency
. */
export function getCurrencyInfo(currency: SupportedCurrency): CurrencyInfo | null {
  return currencyRegistry[currency] || null;
}

/**
 * Format currency pair
 * @param baseCurrency
 * @param quoteCurrency
 * @param separator
. */
export function formatCurrencyPair(
  baseCurrency: SupportedCurrency,
  quoteCurrency: SupportedCurrency,
  separator: string = '/'
): string {
  return `${baseCurrency}${separator}${quoteCurrency}`;
}

/**
 * Common crypto currency formatters
. */
export const cryptoFormatters = {
  btc: (amount: number) => formatCurrency(amount, { 
    currency: 'BTC', 
    customSymbol: '₿',
    minimumFractionDigits: 8,
    maximumFractionDigits: 8
  }),
  eth: (amount: number) => formatCurrency(amount, { 
    currency: 'ETH', 
    customSymbol: 'Ξ',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  }),
  usdc: (amount: number) => formatCurrency(amount, { 
    currency: 'USDC', 
    customSymbol: 'USDC',
    currencyPosition: 'after'
  }),
  usdt: (amount: number) => formatCurrency(amount, { 
    currency: 'USDT', 
    customSymbol: 'USDT',
    currencyPosition: 'after'
  }),
  bnb: (amount: number) => formatCurrency(amount, {
    currency: 'BNB',
    customSymbol: 'BNB',
    currencyPosition: 'after',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }),
  sol: (amount: number) => formatCurrency(amount, {
    currency: 'SOL',
    customSymbol: 'SOL',
    currencyPosition: 'after',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  })
};

/**
 * Fiat currency formatters
. */
export const fiatFormatters = {
  usd: (amount: number) => formatCurrency(amount, { currency: 'USD' }),
  eur: (amount: number) => formatCurrency(amount, { currency: 'EUR' }),
  gbp: (amount: number) => formatCurrency(amount, { currency: 'GBP' }),
  jpy: (amount: number) => formatCurrency(amount, { 
    currency: 'JPY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  cny: (amount: number) => formatCurrency(amount, { currency: 'CNY' }),
  krw: (amount: number) => formatCurrency(amount, { 
    currency: 'KRW',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }),
  inr: (amount: number) => formatCurrency(amount, { currency: 'INR' })
};

/**
 * Trading-specific formatters
. */
export const tradingFormatters = {
  price: (amount: number, currency: SupportedCurrency = 'USD') => 
    formatDynamicPrice(amount, currency),
  
  marketCap: (amount: number, currency: FiatCurrency = 'USD') => 
    formatMarketCap(amount, { currency }),
  
  volume: (amount: number, currency: SupportedCurrency = 'USD', timeframe: '24h' | '1h' | '7d' | '30d' = '24h') => 
    formatTradingVolume(amount, { currency, timeframe }),
  
  priceChange: (current: number, previous: number, currency: SupportedCurrency = 'USD') =>
    formatPriceChange(current, previous, { currency }),
  
  pair: (base: SupportedCurrency, quote: SupportedCurrency) =>
    formatCurrencyPair(base, quote)
};

/**
 * Currency formatting utilities
. */
export const currencyFormattingUtils = {
  formatCurrency,
  formatPriceChange,
  formatMarketCap,
  formatTradingVolume,
  formatDynamicPrice,
  formatCryptocurrencyAmount,
  getCurrencyInfo,
  getCryptocurrencyInfo,
  formatCurrencyPair,
  formatCryptoPair,
  getSupportedCryptocurrencies,
  getCryptocurrencyBySymbol,
  getStablecoins,
  isValidCryptocurrency,
  cryptoFormatters,
  fiatFormatters,
  tradingFormatters,
  currencyRegistry,
  cryptoRegistry
};

/**
 * Validate currency code
 * @param currency
. */
export function isValidCurrency(currency: string): currency is SupportedCurrency {
  return currency in currencyRegistry;
}

/**
 * Get currency decimals
 * @param currency
. */
export function getCurrencyDecimals(currency: SupportedCurrency): number {
  const info = getCurrencyInfo(currency);
  return info?.decimals ?? 2;
}

/**
 * Check if currency is stablecoin
 * @param currency
. */
export function isStablecoin(currency: SupportedCurrency): boolean {
  const info = getCurrencyInfo(currency);
  return info?.isStablecoin ?? false;
}

/**
 * Check if currency is cryptocurrency
 * @param currency
. */
export function isCryptocurrency(currency: SupportedCurrency): boolean {
  const info = getCurrencyInfo(currency);
  return info?.type === 'crypto';
}

/**
 * Check if currency is fiat
 * @param currency
. */
export function isFiatCurrency(currency: SupportedCurrency): boolean {
  const info = getCurrencyInfo(currency);
  return info?.type === 'fiat';
}
