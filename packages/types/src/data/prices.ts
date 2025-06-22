/**
 * @file Price Data Types and Aggregation.
 * 
 * Price data structures, aggregation methods, and price feed
 * management for multi-source price collection and analysis.
 * 
 * Features:
 * - Multi-source price aggregation
 * - Real-time and historical price data
 * - Price quality scoring and validation
 * - OHLCV candlestick data
 * - Price alerts and notifications.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { TokenInfo } from '../blockchain/addresses';

// ========================================
// CORE PRICE TYPES
// ========================================

/**
 * Price source identifier.
 */
type PriceSource = 
  | 'pyth'
  | 'chainlink'
  | 'binance'
  | 'coinbase'
  | 'kraken'
  | 'uniswap-v3'
  | 'uniswap-v2'
  | 'sushiswap'
  | 'pancakeswap'
  | 'dexscreener'
  | 'coingecko'
  | 'coinmarketcap'
  | 'internal'
  | 'composite';

/**
 * Price update type.
 */
type PriceUpdateType = 'realtime' | 'interval' | 'on-demand' | 'historical';

/**
 * Price confidence levels.
 */
type PriceConfidence = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';

// ========================================
// AGGREGATION AND STATISTICS TYPES (moved before use)
// ========================================

/**
 * Price aggregation methods.
 */
type AggregationMethod = 
  | 'mean'              // Simple average
  | 'weighted-mean'     // Weighted by confidence/volume
  | 'median'            // Median price
  | 'vwap'              // Volume weighted average
  | 'twap'              // Time weighted average
  | 'best-bid-offer'    // Best bid/offer
  | 'liquidity-weighted' // Weighted by liquidity
  | 'confidence-weighted'; // Weighted by confidence

/**
 * Individual price change.
 */
interface PriceChange {
  /** Absolute change. */
  absolute: string;
  
  /** Percentage change. */
  percentage: number;
  
  /** Previous price. */
  previousPrice: string;
  
  /** Change direction. */
  direction: 'up' | 'down' | 'neutral';
}

/**
 * Price change indicators.
 */
interface PriceChanges {
  /** Change from 1 minute ago. */
  change1m?: PriceChange;
  
  /** Change from 5 minutes ago. */
  change5m?: PriceChange;
  
  /** Change from 1 hour ago. */
  change1h?: PriceChange;
  
  /** Change from 24 hours ago. */
  change24h?: PriceChange;
  
  /** Change from 7 days ago. */
  change7d?: PriceChange;
  
  /** Change from 30 days ago. */
  change30d?: PriceChange;
}

/**
 * Price statistics.
 */
interface PriceStatistics {
  /** Minimum price from sources. */
  min: string;
  
  /** Maximum price from sources. */
  max: string;
  
  /** Standard deviation. */
  standardDeviation: number;
  
  /** Variance. */
  variance: number;
  
  /** Coefficient of variation. */
  coefficientOfVariation: number;
  
  /** Interquartile range. */
  iqr: number;
  
  /** Number of outliers detected. */
  outliers: number;
}

/**
 * Price quality assessment.
 */
interface PriceQuality {
  /** Overall quality score (0-100). */
  score: number;
  
  /** Quality factors. */
  factors: {
    /** Data freshness score. */
    freshness: number;
    
    /** Source diversity score. */
    diversity: number;
    
    /** Price consistency score. */
    consistency: number;
    
    /** Volume support score. */
    volumeSupport: number;
    
    /** Source reliability score. */
    reliability: number;
  };
  
  /** Quality warnings. */
  warnings: string[];
  
  /** Quality recommendations. */
  recommendations: string[];
}

/**
 * Price metadata and quality indicators.
 */
interface PriceMetadata {
  /** Source-specific price ID. */
  sourceId?: string;
  
  /** Data freshness (how old is the data). */
  freshness: number;
  
  /** Source reliability score. */
  reliability: number;
  
  /** Bid-ask spread. */
  spread?: number;
  
  /** Number of sources contributing. */
  sourceCount?: number;
  
  /** Deviation from other sources. */
  deviation?: number;
  
  /** Custom source data. */
  custom: Record<string, string | number | boolean>;
}

// ========================================
// PRICE DATA STRUCTURES
// ========================================

/**
 * Individual price point from a source.
 */
interface PricePoint {
  /** Price source. */
  source: PriceSource;
  
  /** Token information. */
  token: TokenInfo;
  
  /** Price in USD. */
  priceUsd: string;
  
  /** Price in base currency (if different). */
  priceBase?: string;
  
  /** Base currency. */
  baseCurrency?: string;
  
  /** Price timestamp. */
  timestamp: number;
  
  /** Price confidence score (0-1). */
  confidence: number;
  
  /** Volume (24h). */
  volume24h?: string;
  
  /** Market cap. */
  marketCap?: string;
  
  /** Price metadata. */
  metadata: PriceMetadata;
}

/**
 * Aggregated price from multiple sources.
 */
interface AggregatedPrice {
  /** Token information. */
  token: TokenInfo;
  
  /** Aggregated price in USD. */
  priceUsd: string;
  
  /** Price confidence level. */
  confidence: PriceConfidence;
  
  /** Aggregation timestamp. */
  timestamp: number;
  
  /** Contributing sources. */
  sources: PricePoint[];
  
  /** Aggregation method used. */
  aggregationMethod: AggregationMethod;
  
  /** Price statistics. */
  statistics: PriceStatistics;
  
  /** Quality metrics. */
  quality: PriceQuality;
  
  /** Price change indicators. */
  changes: PriceChanges;
}

// ========================================
// HISTORICAL PRICE DATA
// ========================================

/**
 * Time intervals for historical data.
 */
type TimeInterval = 
  | '1m' | '5m' | '15m' | '30m'
  | '1h' | '4h' | '12h'
  | '1d' | '3d' | '7d'
  | '1w' | '1M';

/**
 * OHLCV candlestick data.
 */
interface Candlestick {
  /** Token information. */
  token: TokenInfo;
  
  /** Candle period start timestamp. */
  timestamp: number;
  
  /** Time interval. */
  interval: TimeInterval;
  
  /** Open price. */
  open: string;
  
  /** High price. */
  high: string;
  
  /** Low price. */
  low: string;
  
  /** Close price. */
  close: string;
  
  /** Volume. */
  volume: string;
  
  /** Number of trades. */
  trades?: number;
  
  /** Price source. */
  source: PriceSource;
  
  /** Data quality score. */
  quality: number;
}

/**
 * Historical price query.
 */
interface HistoricalPriceQuery {
  /** Token to query. */
  token: TokenInfo;
  
  /** Start timestamp. */
  startTime: number;
  
  /** End timestamp. */
  endTime: number;
  
  /** Time interval. */
  interval: TimeInterval;
  
  /** Preferred sources. */
  sources?: PriceSource[];
  
  /** Maximum number of data points. */
  limit?: number;
  
  /** Include volume data. */
  includeVolume: boolean;
  
  /** Aggregation method for multiple sources. */
  aggregation?: AggregationMethod;
}

/**
 * Historical price result.
 */
interface HistoricalPriceResult {
  /** Query parameters. */
  query: HistoricalPriceQuery;
  
  /** Candlestick data. */
  data: Candlestick[];
  
  /** Data statistics. */
  statistics: {
    totalCandles: number;
    completeness: number;
    averageQuality: number;
    sourceCoverage: Record<PriceSource, number>;
  };
  
  /** Query metadata. */
  metadata: {
    executionTime: number;
    cacheHit: boolean;
    dataAge: number;
  };
}

// ========================================
// PRICE FEEDS AND SUBSCRIPTIONS (moved before use)
// ========================================

/**
 * Price alert action.
 */
interface AlertAction {
  /** Action type. */
  type: 'webhook' | 'email' | 'sms' | 'telegram' | 'discord' | 'log';
  
  /** Action parameters. */
  parameters: Record<string, string | number | boolean>;
  
  /** Action retry configuration. */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * Price alert configuration.
 */
interface PriceAlertConfig {
  /** Alert identifier. */
  id: string;
  
  /** Alert type. */
  type: 'price-threshold' | 'price-change' | 'quality-degradation' | 'source-failure';
  
  /** Alert parameters. */
  parameters: {
    threshold?: string;
    changePercentage?: number;
    timeWindow?: number;
    minQuality?: number;
  };
  
  /** Alert actions. */
  actions: AlertAction[];
  
  /** Alert metadata. */
  metadata: {
    name: string;
    description?: string;
    enabled: boolean;
  };
}

/**
 * Price feed configuration.
 */
interface PriceFeedConfig {
  /** Feed identifier. */
  id: string;
  
  /** Tokens to track. */
  tokens: TokenInfo[];
  
  /** Price sources to use. */
  sources: PriceSource[];
  
  /** Update frequency. */
  updateInterval: number;
  
  /** Aggregation method. */
  aggregationMethod: AggregationMethod;
  
  /** Quality thresholds. */
  qualityThresholds: {
    minConfidence: number;
    minSources: number;
    maxDeviation: number;
    maxAge: number;
  };
  
  /** Alert configuration. */
  alerts?: PriceAlertConfig[];
  
  /** Feed metadata. */
  metadata: {
    name: string;
    description?: string;
    tags: string[];
  };
}

/**
 * Price feed subscription.
 */
interface PriceFeedSubscription {
  /** Subscription identifier. */
  id: string;
  
  /** Feed identifier. */
  feedId: string;
  
  /** Subscriber callback. */
  callback: (price: AggregatedPrice) => void;
  
  /** Subscription filters. */
  filters?: {
    tokens?: string[];
    minPriceChange?: number;
    minQuality?: number;
  };
  
  /** Subscription status. */
  status: 'active' | 'paused' | 'error';
  
  /** Subscription metadata. */
  metadata: {
    createdAt: number;
    lastUpdate?: number;
    errorCount: number;
  };
}

// ========================================
// PRICE ANALYSIS TYPES
// ========================================

/**
 * Price trend analysis.
 */
interface PriceTrend {
  /** Token analyzed. */
  token: TokenInfo;
  
  /** Analysis period. */
  period: {
    start: number;
    end: number;
    interval: TimeInterval;
  };
  
  /** Trend direction. */
  direction: 'bullish' | 'bearish' | 'sideways';
  
  /** Trend strength. */
  strength: 'weak' | 'moderate' | 'strong';
  
  /** Trend indicators. */
  indicators: {
    sma: number[];
    ema: number[];
    rsi: number;
    macd: {
      macd: number;
      signal: number;
      histogram: number;
    };
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
    };
  };
  
  /** Support and resistance levels. */
  levels: {
    support: string[];
    resistance: string[];
  };
  
  /** Analysis confidence. */
  confidence: number;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Price source reliability scores.
 */
const SOURCE_RELIABILITY = {
  pyth: 0.95,
  chainlink: 0.95,
  binance: 0.90,
  coinbase: 0.88,
  kraken: 0.87,
  uniswapV3: 0.85,
  uniswapV2: 0.80,
  sushiswap: 0.78,
  pancakeswap: 0.75,
  dexscreener: 0.70,
  coingecko: 0.65,
  coinmarketcap: 0.65,
  internal: 0.50,
  composite: 0.85
} as const;

/**
 * Default update intervals by source (milliseconds).
 */
const DEFAULT_UPDATE_INTERVALS = {
  pyth: 1000,         // 1 second
  chainlink: 10000,   // 10 seconds
  binance: 2000,      // 2 seconds
  coinbase: 5000,     // 5 seconds
  kraken: 5000,       // 5 seconds
  uniswapV3: 15000,  // 15 seconds
  uniswapV2: 30000,  // 30 seconds
  sushiswap: 30000,   // 30 seconds
  pancakeswap: 30000, // 30 seconds
  dexscreener: 60000, // 1 minute
  coingecko: 300000,  // 5 minutes
  coinmarketcap: 300000, // 5 minutes
  internal: 10000,    // 10 seconds
  composite: 5000     // 5 seconds
} as const;

// Consolidated export declaration
export type {
  PriceSource,
  PriceUpdateType,
  PriceConfidence,
  AggregationMethod,
  PriceChange,
  PriceChanges,
  PriceStatistics,
  PriceQuality,
  PriceMetadata,
  PricePoint,
  AggregatedPrice,
  TimeInterval,
  Candlestick,
  HistoricalPriceQuery,
  HistoricalPriceResult,
  AlertAction,
  PriceAlertConfig,
  PriceFeedConfig,
  PriceFeedSubscription,
  PriceTrend
};

export {
  SOURCE_RELIABILITY,
  DEFAULT_UPDATE_INTERVALS
};
