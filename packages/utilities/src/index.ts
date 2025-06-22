/**
 * @file Main utilities package exports
 * @package @trading-bot/utilities
 * 
 * Production-grade utilities for trading bot operations with comprehensive
 * functionality across cache, validation, formatting, rate limiting, and crypto.
. */

// Cache utilities - All cache implementations
export { 
  MemoryCache,
  createMemoryCache,
  memoryCache,
  TTLCache,
  createTTLCache,
  ttlCache,
  RedisCache,
  createRedisCache,
  redisCache
} from './cache';

// Crypto utilities - All crypto implementations
export {
  // Address utilities (crypto-specific)
  toChecksumAddress,
  isValidChecksum,
  convertAddress,
  isValidAddressFormat,
  addressFromPublicKey,
  batchValidateAddresses,
  addressUtils,
  
  // Amount utilities (crypto-specific)
  toBaseUnits,
  fromBaseUnits,
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  divideAmount,
  calculatePercentage,
  applySlippage,
  calculateTradingFees,
  calculatePriceImpact,
  isWithinTolerance,
  isDustAmount,
  roundToSignificantDigits,
  formatAmountForDisplay,
  amountUtils,
  
  // Signature utilities
  signMessage,
  signMessageExtended,
  verifySignatureExtended,
  verifySignature,
  recoverPublicKey,
  generateKeyPair,
  deriveKeyFromSeed,
  deriveKeyFromPassword,
  signEthereumTransaction,
  createEthereumPersonalSignMessage,
  generateRandomHex,
  signatureUtils
} from './crypto';

// Formatting utilities - All formatting implementations
export {
  // Number formatting
  formatNumber,
  formatPercentage,
  formatLargeNumber,
  formatTokenAmount,
  formatScientific,
  formatByContext,
  parseFormattedNumber,
  numberFormattingUtils,
  
  // Address formatting
  formatAddress,
  formatAddressForContext,
  formatAddressList,
  createAddressDisplayName,
  extractAddress,
  validateAddressFormat,
  addressFormattingUtils,
  
  // Time formatting
  formatTime,
  formatDuration,
  formatTimeForContext,
  formatTimeRange,
  formatTradingSession,
  getMarketSessionStatus,
  parseTimeString,
  timeFormattingUtils,
  
  // Currency formatting
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
} from './formatting';

// Rate limiting utilities - All rate limiting implementations
export {
  // Token Bucket
  TokenBucket,
  createTokenBucket,
  tokenBucketUtils,
  
  // Sliding Window
  SlidingWindow,
  createSlidingWindow,
  slidingWindowUtils,
  
  // Adaptive Limiter
  AdaptiveLimiter,
  createAdaptiveLimiter,
  adaptiveLimiterUtils
} from './rate-limiting';

// Validation utilities - All validation implementations
export {
  // Address validation
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
  addressValidationUtils,
  
  // Amount validation
  validateAmount,
  validateAmounts,
  getStandardDecimals,
  convertAmountDecimals,
  parseToSmallestUnit,
  isValidAmount,
  amountValidationUtils,
  
  // Configuration validation
  validateConfig,
  createSchema,
  configValidationUtils,
  
  // Schema validation
  validateJSONSchema,
  parseAndValidateJSON,
  schemaValidationUtils
} from './validation';

// Retry utilities - All retry implementations
export {
  // Circuit Breaker
  CircuitBreaker,
  createCircuitBreaker,
  circuitBreakerStrategies,
  circuitBreakerUtils,
  
  // Exponential Backoff
  ExponentialBackoffRetry,
  EnhancedExponentialBackoff,
  retryWithExponentialBackoff,
  withExponentialBackoff,
  retryStrategies,
  exponentialBackoffUtils,
  
  // Retry with Jitter
  RetryWithJitter,
  retryWithJitter,
  jitterStrategies,
  jitterUtils
} from './retry';

// Preset configurations organized by utility type


// Preset configurations organized by utility type
export const presets = {
  // Cache presets - Memory Cache
  memoryCache: {
    small: { maxSize: 100, defaultTtl: 300, cleanupInterval: 60000 }, // 5 minutes TTL, 1 min cleanup
    medium: { maxSize: 1000, defaultTtl: 900, cleanupInterval: 300000 }, // 15 minutes TTL, 5 min cleanup
    large: { maxSize: 10000, defaultTtl: 3600, cleanupInterval: 600000 }, // 1 hour TTL, 10 min cleanup
    trading: { maxSize: 5000, defaultTtl: 60, cleanupInterval: 30000 }, // 1 minute TTL, 30 sec cleanup
    highFrequency: { maxSize: 50000, defaultTtl: 30, cleanupInterval: 15000 }, // 30 sec TTL, 15 sec cleanup
  },
  
  // Cache presets - TTL Cache
  ttlCache: {
    small: { defaultTtl: 300, maxSize: 100, checkInterval: 60000 }, // 5 minutes TTL, 1 min check
    medium: { defaultTtl: 900, maxSize: 1000, checkInterval: 180000 }, // 15 minutes TTL, 3 min check
    large: { defaultTtl: 3600, maxSize: 10000, checkInterval: 300000 }, // 1 hour TTL, 5 min check
    trading: { defaultTtl: 60, maxSize: 5000, checkInterval: 30000 }, // 1 minute TTL, 30 sec check
    session: { defaultTtl: 1800, maxSize: 2000, checkInterval: 300000 }, // 30 min sessions, 5 min check
  },
  
  // Cache presets - Redis Cache
  redisCache: {
    local: { host: 'localhost', port: 6379, database: 0, defaultTtl: 3600, keyPrefix: 'tb' },
    development: { host: 'localhost', port: 6379, database: 1, defaultTtl: 1800, keyPrefix: 'tb-dev' },
    production: { host: 'localhost', port: 6379, database: 0, defaultTtl: 7200, keyPrefix: 'tb-prod', retryAttempts: 5 },
    trading: { host: 'localhost', port: 6379, database: 2, defaultTtl: 300, keyPrefix: 'tb-trading', retryAttempts: 3 },
    session: { host: 'localhost', port: 6379, database: 3, defaultTtl: 1800, keyPrefix: 'tb-session' },
  },
  
  // Rate limiting presets - Token Bucket
  tokenBucket: {
    strict: { capacity: 10, refillRate: 1, maxBurst: 10 },
    moderate: { capacity: 50, refillRate: 10, maxBurst: 20 },
    lenient: { capacity: 100, refillRate: 50, maxBurst: 50 },
    api: { capacity: 1000, refillRate: 100, maxBurst: 200 },
    trading: { capacity: 10, refillRate: 2, maxBurst: 5 },
    burst: { capacity: 20, refillRate: 5, maxBurst: 20 }
  },
  
  // Rate limiting presets - Sliding Window
  slidingWindow: {
    strict: { windowSize: 60000, maxRequests: 10, precision: 12 }, // 10 req/min
    moderate: { windowSize: 60000, maxRequests: 100, precision: 20 }, // 100 req/min
    lenient: { windowSize: 60000, maxRequests: 1000, precision: 30 }, // 1000 req/min
    api: { windowSize: 300000, maxRequests: 5000, precision: 50 }, // 5000 req/5min
    trading: { windowSize: 60000, maxRequests: 50, precision: 20 }, // 50 req/min
    burst: { windowSize: 10000, maxRequests: 20, precision: 10 }, // 20 req/10sec
    microservice: { windowSize: 1000, maxRequests: 100, precision: 10 } // 100 req/sec
  },
  
  // Rate limiting presets - Adaptive Limiter
  adaptiveLimiter: {
    conservative: { maxRequests: 100, windowMs: 60000, targetSuccessRate: 0.98, targetLatency: 500, adjustmentFactor: 0.05 },
    balanced: { maxRequests: 100, windowMs: 60000, targetSuccessRate: 0.95, targetLatency: 1000, adjustmentFactor: 0.1 },
    aggressive: { maxRequests: 100, windowMs: 60000, targetSuccessRate: 0.90, targetLatency: 2000, adjustmentFactor: 0.2 },
    trading: { maxRequests: 50, windowMs: 60000, targetSuccessRate: 0.99, targetLatency: 200, adjustmentFactor: 0.05, minLimit: 5, maxLimit: 200 },
    resilient: { maxRequests: 200, windowMs: 60000, targetSuccessRate: 0.95, targetLatency: 1500, adjustmentFactor: 0.15, minLimit: 20, maxLimit: 500 }
  },
  
  // Validation presets
  validation: {
    // Schema validation presets
    schema: {
      strict: { allowUnknown: false, stripUnknown: false, abortEarly: false, convert: false, strict: true },
      lenient: { allowUnknown: true, stripUnknown: true, abortEarly: false, convert: true, strict: false },
      convert: { allowUnknown: false, stripUnknown: false, abortEarly: false, convert: true, strict: false },
      trading: { allowUnknown: false, stripUnknown: true, abortEarly: false, convert: true, strict: true },
      api: { allowUnknown: false, stripUnknown: true, abortEarly: true, convert: true, strict: false }
    },
    
    // Address validation presets
    address: {
      ethereum: { chain: 'ethereum' as const, requireChecksum: false },
      bitcoin: { chain: 'bitcoin' as const, allowLegacy: true, allowSegwit: true },
      solana: { chain: 'solana' as const, validateLength: true },
      multichain: { autoDetect: true, allowAmbiguous: false },
      strict: { requireChecksum: true, validateFormat: true, normalizeCase: true }
    },
    
    // Amount validation presets
    amount: {
      trading: { 
        context: 'trading' as const, 
        allowZero: false, 
        allowNegative: false, 
        maxDecimals: 18,
        min: '0.000001'
      },
      transfer: { 
        context: 'transfer' as const, 
        allowZero: false, 
        allowNegative: false, 
        maxDecimals: 18,
        min: '0'
      },
      approval: { 
        context: 'approval' as const, 
        allowZero: true, 
        allowNegative: false, 
        maxDecimals: 18 
      },
      stake: { 
        context: 'stake' as const, 
        allowZero: false, 
        allowNegative: false, 
        maxDecimals: 18,
        min: '1'
      },
      precise: { 
        allowZero: true, 
        allowNegative: true, 
        maxDecimals: 18, 
        decimals: 18 
      },
      display: { 
        allowZero: true, 
        allowNegative: true, 
        maxDecimals: 8, 
        decimals: 8 
      }
    },
    
    // JSON validation presets
    json: {
      strict: { strict: true, validateFormats: true, allowUndefinedKeywords: false, removeAdditional: false },
      lenient: { strict: false, validateFormats: false, allowUndefinedKeywords: true, removeAdditional: true },
      api: { strict: true, validateFormats: true, allowUndefinedKeywords: false, removeAdditional: true, useDefaults: true },
      config: { strict: false, validateFormats: true, allowUndefinedKeywords: false, removeAdditional: true, useDefaults: true, coerceTypes: true }
    }
  },
  
  // Formatting presets
  formatting: {
    // Number formatting presets
    number: {
      precise: { minimumFractionDigits: 8, maximumFractionDigits: 18, useGrouping: true },
      standard: { minimumFractionDigits: 2, maximumFractionDigits: 8, useGrouping: true },
      compact: { notation: 'compact' as const, compactDisplay: 'short' as const, useGrouping: true },
      scientific: { notation: 'scientific' as const, maximumFractionDigits: 6 },
      percentage: { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'auto' as const }
    },
    
    // Currency formatting presets  
    currency: {
      usd: { currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 },
      crypto: { currencyPosition: 'after' as const, minimumFractionDigits: 4, maximumFractionDigits: 8 },
      trading: { minimumFractionDigits: 2, maximumFractionDigits: 8, compact: true },
      display: { showCurrency: true, minimumFractionDigits: 2, maximumFractionDigits: 4 }
    },
    
    // Address formatting presets
    address: {
      short: { chars: 4, separator: '...', includeChecksum: true },
      medium: { chars: 6, separator: '...', includeChecksum: true },
      long: { chars: 8, separator: '...', includeChecksum: true },
      mobile: { chars: 4, separator: '...', includeChain: false },
      desktop: { chars: 6, separator: '...', includeChain: false },
      tooltip: { chars: 12, separator: '...', includeChain: true }
    },
    
    // Time formatting presets
    time: {
      short: { style: 'short' as const, timeZone: 'UTC' },
      medium: { style: 'medium' as const, timeZone: 'UTC' },
      long: { style: 'long' as const, timeZone: 'UTC' },
      full: { style: 'full' as const, timeZone: 'UTC', includeMs: true },
      relative: { style: 'relative' as const },
      trading: { style: 'medium' as const, timeZone: 'UTC' },
      chart: { style: 'short' as const, timeZone: 'UTC' },
      log: { style: 'full' as const, includeMs: true, timeZone: 'UTC' }
    },
    
    // Duration formatting presets
    duration: {
      compact: { style: 'compact' as const, precision: 's' as const, maxUnits: 2 },
      short: { style: 'short' as const, precision: 'ms' as const, maxUnits: 3 },
      long: { style: 'long' as const, precision: 'ms' as const, maxUnits: 4 }
    }
  },
  
  // Crypto presets
  crypto: {
    // Signature algorithms
    signatures: {
      ethereum: { algorithm: 'secp256k1' as const, messageEncoding: 'utf8' as const },
      bitcoin: { algorithm: 'secp256k1' as const, messageEncoding: 'utf8' as const },
      solana: { algorithm: 'ed25519' as const, messageEncoding: 'utf8' as const },
      general: { algorithm: 'rsa' as const, messageEncoding: 'utf8' as const }
    },
    
    // Amount precision settings
    amounts: {
      precise: { precision: 18, roundingMode: 'nearest' as const, removeTrailingZeros: true },
      trading: { precision: 8, roundingMode: 'nearest' as const, removeTrailingZeros: true },
      display: { precision: 4, roundingMode: 'down' as const, removeTrailingZeros: true, useGrouping: true },
      minimal: { precision: 2, roundingMode: 'down' as const, removeTrailingZeros: true }
    },
    
    // Trading calculation settings
    trading: {
      conservative: { slippageTolerance: 0.5, priceImpactTolerance: 1.0, feePercentage: 0.3 },
      moderate: { slippageTolerance: 1.0, priceImpactTolerance: 2.0, feePercentage: 0.25 },
      aggressive: { slippageTolerance: 2.0, priceImpactTolerance: 5.0, feePercentage: 0.1 },
      arbitrage: { slippageTolerance: 0.1, priceImpactTolerance: 0.5, feePercentage: 0.05 }
    }
  },
  
  // Retry presets - Exponential Backoff
  retry: {
    quick: { maxRetries: 2, baseDelay: 100, strategy: 'exponential' as const, maxDelay: 1000, jitter: true },
    standard: { maxRetries: 3, baseDelay: 1000, strategy: 'exponential' as const, maxDelay: 10000, jitter: true },
    aggressive: { maxRetries: 5, baseDelay: 500, strategy: 'exponential' as const, maxDelay: 30000, jitter: true },
    network: { maxRetries: 4, baseDelay: 2000, strategy: 'exponential' as const, maxDelay: 60000, jitter: true },
    trading: { maxRetries: 2, baseDelay: 250, strategy: 'exponential' as const, maxDelay: 2000, jitter: 100 },
    critical: { maxRetries: 7, baseDelay: 1000, strategy: 'exponential' as const, maxDelay: 120000, jitter: true },
    highFrequency: { maxRetries: 1, baseDelay: 50, strategy: 'fixed' as const, maxDelay: 200, jitter: true }
  },
  
  // Retry presets - Jitter Strategies
  jitterRetry: {
    awsFullJitter: { maxRetries: 3, baseDelay: 1000, strategy: 'exponential' as const, maxDelay: 20000, jitterStrategy: 'full' as const, jitterMultiplier: 1.0 },
    gcpEqualJitter: { maxRetries: 4, baseDelay: 1000, strategy: 'exponential' as const, maxDelay: 32000, jitterStrategy: 'equal' as const, jitterMultiplier: 1.0 },
    decorrelated: { maxRetries: 5, baseDelay: 500, strategy: 'exponential' as const, maxDelay: 30000, jitterStrategy: 'decorrelated' as const, jitterMultiplier: 1.0 },
    trading: { maxRetries: 2, baseDelay: 100, strategy: 'exponential' as const, maxDelay: 2000, jitterStrategy: 'equal' as const, jitterMultiplier: 0.5 },
    highFrequency: { maxRetries: 1, baseDelay: 50, strategy: 'fixed' as const, maxDelay: 200, jitterStrategy: 'equal' as const, jitterMultiplier: 0.2 },
    robust: { maxRetries: 7, baseDelay: 1000, strategy: 'exponential' as const, maxDelay: 60000, jitterStrategy: 'decorrelated' as const, jitterMultiplier: 1.5 }
  },
  
  // Circuit Breaker presets
  circuitBreaker: {
    api: { failureThreshold: 3, recoveryTimeout: 30000, monitoringWindow: 60000, expectedFailureRate: 0.3, minimumThroughput: 5 },
    database: { failureThreshold: 5, recoveryTimeout: 60000, monitoringWindow: 120000, expectedFailureRate: 0.1, minimumThroughput: 10 },
    trading: { failureThreshold: 2, recoveryTimeout: 10000, monitoringWindow: 30000, expectedFailureRate: 0.2, minimumThroughput: 3 },
    network: { failureThreshold: 4, recoveryTimeout: 45000, monitoringWindow: 90000, expectedFailureRate: 0.4, minimumThroughput: 8 },
    critical: { failureThreshold: 1, recoveryTimeout: 5000, monitoringWindow: 15000, expectedFailureRate: 0.1, minimumThroughput: 1 },
    lenient: { failureThreshold: 10, recoveryTimeout: 120000, monitoringWindow: 300000, expectedFailureRate: 0.6, minimumThroughput: 20 }
  }
};

// Type exports for TypeScript users - Cache types
export type {
  MemoryCacheConfig,
  TTLCacheConfig,
  RedisCacheConfig,
  CachePerformanceMetrics,
  CacheEntryMetadata,
  CacheOptions,
  CacheEvent,
  CacheEventType,
  BatchCacheOperation,
  BatchCacheResult,
  CacheInvalidationOptions,
  CacheWarmingOptions,
  CacheKeyPattern,
  CacheHealthStatus,
  CacheStats,
  CacheSerializationOptions,
  CacheClusterConfig,
  CacheMonitoringConfig
} from '../../types/src/utilities/cache';

// Type exports for TypeScript users - Crypto types
export type {
  CryptoHashOptions,
  EncryptionOptions,
  SignatureOptions,
  SignatureVerificationOptions,
  SignatureResult,
  KeyPairResult,
  KeyDerivationOptions,
  AmountPrecisionOptions,
  AmountDisplayOptions,
  TradingCalculationOptions,
  AmountConversionResult,
  ExtendedSignatureOptions,
  ExtendedSignatureResult,
  SignatureVerificationResult
} from '../../types/src/utilities/crypto';

// Type exports for TypeScript users - Formatting types
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
} from '../../types/src/utilities/formatting';

// Type exports for TypeScript users - Rate Limiting types
export type {
  RateLimitConfig,
  TokenBucketConfig,
  SlidingWindowConfig,
  RateLimitResult,
  AdaptiveLimiterConfig,
  RequestMetrics,
  AdaptiveMetrics,
  RateLimiterState,
  TokenBucketState,
  SlidingWindowState
} from '../../types/src/utilities/rate-limiting';

// Type exports for TypeScript users - Retry types
export type {
  RetryConfig,
  JitterRetryConfig,
  RetryAttempt,
  RetryResult,
  ExponentialBackoffConfig,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerMetrics,
  CircuitBreakerEventData,
  CircuitBreakerDashboardData,
  CircuitBreakerStateTransition,
  CircuitBreakerRequest,
  CircuitBreakerWindowMetrics,
  RetryOperationContext,
  RetryStrategyConfig,
  JitterStrategy,
  RetryStrategy,
  CircuitState,
  RetryErrorCode,
  CircuitBreakerEvent,
  CircuitBreakerEventListener
} from '../../types/src/utilities/retry';

// Type exports for TypeScript users - Validation types
export type {
  AmountValidationResult,
  AmountValidationOptions,
  BatchAmountValidationInput,
  BatchAmountValidationResult,
  UtilityAddressValidationResult,
  BatchAddressValidationResult,
  UtilitySupportedChain as SupportedChain,
  ConfigValidationResult,
  ValidationSchema,
  FieldSchema,
  ValidationRule,
  SchemaValidationOptions,
  JSONValidationResult,
  JSONSchema,
  DecimalAmountParseResult,
  FieldValidationResult,
  TypeValidationResult,
  RuleValidationResult,
  SchemaValidationError
} from '../../types/src/utilities/validation';

/**
 * Usage examples:
 * 
 * // Cache utilities with presets
 * const tradingCache = memoryCache(presets.memoryCache.trading);
 * const sessionCache = ttlCache(presets.ttlCache.session);
 * const prodCache = redisCache(presets.redisCache.production);
 * 
 * // Crypto utilities with presets
 * const ethSignature = signMessage(message, privateKey, presets.crypto.signatures.ethereum);
 * const preciseAmount = toBaseUnits('1.23456789', 18, presets.crypto.amounts.precise);
 * const tradingFees = calculateTradingFees(amount, presets.crypto.trading.conservative);
 * 
 * // Address utilities
 * const checksumAddr = toChecksumAddress('0x742d35cc6fa58c2a7c5f7b8e4a7b2b2b2b2b2b2b');
 * const isValid = addressUtils.ethereum.isValid(address);
 * 
 * // Amount utilities with token helpers
 * const weiAmount = amountUtils.tokens.eth.toWei('1.5');
 * const formattedUSDC = amountUtils.tokens.usdc.format(amount);
 * 
 * // Signature utilities
 * const keyPair = generateKeyPair('secp256k1');
 * const signature = signatureUtils.ethereum.personalSign(message, privateKey);
 * 
 * // Formatting utilities with presets
 * const formattedNumber = formatNumber(1234.5678, presets.formatting.number.standard);
 * const compactPrice = formatCurrency(1234567, presets.formatting.currency.trading);
 * const shortAddress = formatAddress('0x742d35cc...', presets.formatting.address.short);
 * const relativeTime = formatTime(timestamp, presets.formatting.time.relative);
 * 
 * // Utility-specific formatters
 * const btcPrice = cryptoFormatters.btc(0.12345678);
 * const ethAmount = numberFormattingUtils.formatters.eth(1500000000000000000n);
 * const tradingTime = timeFormattingUtils.formatters.trading(Date.now());
 * const shortAddr = addressFormattingUtils.chains.ethereum(address, 4);
 * 
 * // Complex formatting scenarios
 * const priceChange = formatPriceChange(100, 95, { currency: 'USD', showPercentage: true });
 * const marketCap = formatMarketCap(1500000000, { currency: 'USD', useCompact: true });
 * const duration = formatDuration(3661000, presets.formatting.duration.short);
 * 
 * // Rate limiting utilities with presets
 * const apiLimiter = createTokenBucket(presets.tokenBucket.api);
 * const tradingWindow = createSlidingWindow(presets.slidingWindow.trading);
 * const adaptiveLimiter = createAdaptiveLimiter(presets.adaptiveLimiter.balanced);
 * 
 * // Rate limiting usage patterns
 * const tokenResult = apiLimiter.consume(5); // Try to consume 5 tokens
 * const windowResult = tradingWindow.consume(1); // Try to consume 1 request slot
 * const adaptiveResult = adaptiveLimiter.consume('user123'); // Rate limit by user
 * 
 * // Rate limiting with utility helpers
 * const strictBucket = tokenBucketUtils.configs.strict;
 * const lenientWindow = slidingWindowUtils.configs.lenient;
 * const conservativeAdaptive = adaptiveLimiterUtils.configs.conservative;
 * 
 * // Rate limiting state monitoring
 * const bucketState = apiLimiter.getState();
 * const windowState = tradingWindow.getState();
 * const adaptiveState = adaptiveLimiter.getState();
 * 
 * // Advanced rate limiting with metrics
 * adaptiveLimiter.recordRequest(true, 150); // Record successful request with 150ms latency
 * const canProceed = apiLimiter.canConsume(10); // Check availability without consuming
 * 
 * // Validation utilities with presets
 * const addressValidation = validateAddress('0x742d35cc6fa58c2a7c5f7b8e4a7b2b2b2b2b2b2b', 'ethereum');
 * const amountValidation = validateAmount('1.5', presets.validation.amount.trading);
 * const configValidation = validateConfig(userConfig, tradingConfigSchema, presets.validation.schema.strict);
 * const jsonValidation = validateJSONSchema(data, schema, presets.validation.json.api);
 * 
 * // Address validation scenarios
 * const ethAddr = validateEthereumAddress('0x742d35cc6fa58c2a7c5f7b8e4a7b2b2b2b2b2b2b');
 * const btcAddr = validateBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
 * const solAddr = validateSolanaAddress('11111111111111111111111111111112');
 * const evmAddr = validateEVMAddress('0x742d35cc...', 'polygon');
 * const normalizedAddr = normalizeAddress(address, 'ethereum');
 * const addrInfo = getAddressInfo(address);
 * const displayAddr = formatAddressForDisplay(address, 'ethereum', 6);
 * 
 * // Amount validation scenarios
 * const tradingAmount = validateAmount('1500.50', { ...presets.validation.amount.trading, decimals: 18 });
 * const transferAmount = validateAmount('0.001', presets.validation.amount.transfer);
 * const stakeAmount = validateAmount('100', presets.validation.amount.stake);
 * const batchAmounts = validateAmounts([
 *   { amount: '1.5', options: presets.validation.amount.trading },
 *   { amount: '100', options: presets.validation.amount.stake }
 * ]);
 * 
 * // Amount conversion and utilities
 * const converted = convertAmountDecimals('1.5', 6, 18); // USDC to ETH decimals
 * const smallestUnit = parseToSmallestUnit('1.5', 18); // Get wei amount
 * const standardDecimals = getStandardDecimals('USDC'); // Returns 6
 * const isValid = isValidAmount('1.5', presets.validation.amount.trading);
 * 
 * // Configuration validation with schema
 * const tradingSchema = configValidationUtils.createTradingConfigSchema();
 * const dbSchema = configValidationUtils.createDatabaseConfigSchema();
 * const customSchema = createSchema()
 *   .field('apiKey').type('string').required().min(10).end()
 *   .field('timeout').type('number').min(1000).max(30000).default(5000).end()
 *   .build();
 * 
 * // JSON schema validation
 * const userSchema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string', minLength: 1 },
 *     age: { type: 'number', minimum: 0 },
 *     email: { type: 'string', format: 'email' }
 *   },
 *   required: ['name', 'email']
 * };
 * const jsonResult = validateJSONSchema(userData, userSchema, presets.validation.json.strict);
 * const parsedJson = parseAndValidateJSON(jsonString, userSchema);
 * 
 * // Validation utility helpers
 * const ethValidation = addressValidationUtils.isEVMAddress('0x742d35cc...');
 * const chainDetection = addressValidationUtils.detectChain(address);
 * const amountFormatted = amountValidationUtils.formatAmount('1500.123456', 18);
 * const quickStringVal = configValidationUtils.validateString('test', { min: 2, max: 50 });
 * const quickNumberVal = configValidationUtils.validateNumber(42, { min: 0, max: 100 });
 * const formatValid = schemaValidationUtils.validateFormat('test@example.com', 'email');
 * 
 * // Retry utilities with presets
 * const quickRetry = new ExponentialBackoffRetry(presets.retry.quick);
 * const standardJitter = new RetryWithJitter(presets.jitterRetry.standard);
 * const apiCircuitBreaker = new CircuitBreaker(presets.circuitBreaker.api);
 * 
 * // Retry operation execution
 * const result = await quickRetry.execute(async () => {
 *   return await riskyOperation();
 * });
 * 
 * // Jitter retry with correlation
 * const jitterResult = await retryWithJitter(async () => {
 *   return await networkCall();
 * }, presets.jitterRetry.decorrelated);
 * 
 * // Circuit breaker protection
 * const protectedResult = await apiCircuitBreaker.execute(
 *   async () => await apiCall(),
 *   async () => await fallbackResponse() // Fallback when circuit is open
 * );
 * 
 * // Retry strategies and utilities
 * const tradingRetry = retryStrategies.trading();
 * const awsJitter = jitterStrategies.awsFullJitter();
 * const databaseBreaker = circuitBreakerStrategies.database();
 * 
 * // Retry with function decoration
 * const retryableFunction = withExponentialBackoff(originalFunction, presets.retry.network);
 * const jitterFunction = jitterUtils.RetryWithJitter.wrap(asyncFunction, presets.jitterRetry.robust);
 * 
 * // Circuit breaker monitoring
 * const breakerState = apiCircuitBreaker.getState();
 * const breakerMetrics = apiCircuitBreaker.getMetrics();
 * const dashboardData = apiCircuitBreaker.getDashboardData();
 * 
 * // Retry utility helpers
 * const backoffDelay = exponentialBackoffUtils.calculateBackoffDelay(3, 1000, 30000, 'exponential');
 * const jitteredDelay = jitterUtils.calculateJitter(5000, 'full', 1.0);
 * const breakerHealth = circuitBreakerUtils.createDashboardData(apiCircuitBreaker);
 * 
 * // Batch retry operations
 * const batchResults = await exponentialBackoffUtils.batchRetry([
 *   () => operation1(),
 *   () => operation2(),
 *   () => operation3()
 * ], presets.retry.standard);
 * 
 * // Advanced retry scenarios
 * const enhancedRetry = new EnhancedExponentialBackoff({
 *   ...presets.retry.aggressive,
 *   exponentialBase: 2.5,
 *   maxExponentialDelay: 60000
 * });
 * 
 * // Circuit breaker with event handling
 * apiCircuitBreaker.on('state-change', (event, data) => {
 *   console.log('Circuit breaker state changed:', data.transition);
 * });
 * 
 * apiCircuitBreaker.on('threshold-reached', (event, data) => {
 *   console.log('Failure threshold reached:', data.failures);
 * });
. */
