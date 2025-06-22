/**
 * @file Formatting utilities index - exports all formatting implementations
 * @package @trading-bot/utilities
. */

// Address formatting exports
export {
  formatAddress,
  formatAddressForContext,
  formatAddressList,
  createAddressDisplayName,
  extractAddress,
  validateAddressFormat,
  compareAddresses,
  addressFormattingUtils
} from './address-formatter';

// Currency formatting exports
export {
  formatCurrency,
  formatPriceChange,
  formatMarketCap,
  formatTradingVolume,
  formatDynamicPrice,
  currencyRegistry,
  cryptoRegistry,
  getSupportedCryptocurrencies,
  getCryptocurrencyInfo,
  formatCryptocurrencyAmount,
  isValidCryptocurrency,
  getCryptocurrencyBySymbol,
  getStablecoins,
  formatCryptoPair,
  getCurrencyInfo,
  formatCurrencyPair,
  cryptoFormatters,
  fiatFormatters,
  tradingFormatters,
  currencyFormattingUtils,
  isValidCurrency,
  getCurrencyDecimals,
  isStablecoin,
  isCryptocurrency,
  isFiatCurrency
} from './currency-formatter';

// Number formatting exports
export {
  formatNumber,
  formatPrice,
  formatPercentage,
  formatLargeNumber,
  formatTokenAmount,
  formatScientific,
  formatByContext,
  parseFormattedNumber,
  numberFormattingUtils
} from './number-formatter';

// Time formatting exports
export {
  formatTime,
  formatDuration,
  formatTimeForContext,
  formatTimeRange,
  formatTradingSession,
  getMarketSessionStatus,
  parseTimeString,
  timeFormattingUtils
} from './time-formatter';

// Re-export formatting types for convenience
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
  FormattingPresets
} from '@trading-bot/types/src/utilities/formatting/formatting'; 