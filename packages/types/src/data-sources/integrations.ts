/**
 * @file Data Source Integration Types
 * 
 * External data source integration types, API client configurations,
 * feed management, and data quality assessment.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { Address, TokenInfo } from '../blockchain/addresses';

// ========================================
// DATA SOURCE TYPES
// ========================================

/**
 * Data source identifier.
 */
type DataSourceId = string;

/**
 * Data source types.
 */
type DataSourceType = 
  | 'price-feed'
  | 'gas-feed'
  | 'mempool'
  | 'dex-data'
  | 'oracle'
  | 'news'
  | 'social'
  | 'onchain-analytics';

/**
 * Data source status.
 */
type DataSourceStatus = 
  | 'active'
  | 'inactive'
  | 'error'
  | 'rate-limited'
  | 'maintenance'
  | 'deprecated';

/**
 * API authentication methods.
 */
type AuthMethod = 
  | 'none'
  | 'api-key'
  | 'bearer-token'
  | 'basic-auth'
  | 'oauth'
  | 'signature'
  | 'custom';

// ========================================
// API CLIENT CONFIGURATION
// ========================================

/**
 * API endpoint configuration.
 */
interface APIEndpoint {
  /** Endpoint URL. */
  url: string;
  
  /** HTTP method. */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  
  /** Request timeout. */
  timeout: number;
  
  /** Retry configuration. */
  retry: {
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
    baseDelay: number;
    maxDelay: number;
  };
  
  /** Rate limiting. */
  rateLimit: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  
  /** Custom headers. */
  headers?: Record<string, string>;
  
  /** Query parameters. */
  queryParams?: Record<string, string | number | boolean>;
}

/**
 * Authentication configuration.
 */
interface AuthConfig {
  /** Authentication method. */
  method: AuthMethod;
  
  /** Authentication credentials. */
  credentials: {
    apiKey?: string;
    secret?: string;
    token?: string;
    username?: string;
    password?: string;
    customHeaders?: Record<string, string>;
  };
  
  /** Token refresh settings. */
  refresh?: {
    enabled: boolean;
    endpoint: string;
    intervalMs: number;
    beforeExpiryMs: number;
  };
}

/**
 * Data source API configuration.
 */
interface DataSourceAPIConfig {
  /** Source identifier. */
  sourceId: DataSourceId;
  
  /** Source name. */
  name: string;
  
  /** Source type. */
  type: DataSourceType;
  
  /** Base URL. */
  baseUrl: string;
  
  /** API endpoints. */
  endpoints: Record<string, APIEndpoint>;
  
  /** Authentication. */
  auth: AuthConfig;
  
  /** WebSocket settings. */
  websocket?: {
    url: string;
    protocols?: string[];
    keepAlive: boolean;
    reconnectDelay: number;
    maxReconnectAttempts: number;
  };
  
  /** Data format. */
  format: 'json' | 'xml' | 'csv' | 'protobuf' | 'custom';
  
  /** Supported chains. */
  chains: SupportedChain[];
  
  /** Quality settings. */
  quality: {
    reliability: number;
    latency: number;
    updateFrequency: number;
  };
}

// ========================================
// FEED MANAGEMENT TYPES
// ========================================

/**
 * Feed subscription configuration.
 */
interface FeedSubscription {
  /** Subscription ID. */
  id: string;
  
  /** Data source. */
  sourceId: DataSourceId;
  
  /** Subscription type. */
  type: 'realtime' | 'polling' | 'webhook';
  
  /** Subscription parameters. */
  params: {
    symbols?: string[];
    tokens?: TokenInfo[];
    pairs?: Array<{
      base: TokenInfo;
      quote: TokenInfo;
    }>;
    chains?: SupportedChain[];
    filters?: Record<string, unknown>;
  };
  
  /** Update settings. */
  updates: {
    frequency: number;
    batchSize: number;
    bufferTime: number;
  };
  
  /** Quality requirements. */
  quality: {
    minReliability: number;
    maxLatency: number;
    maxAge: number;
  };
  
  /** Callback configuration. */
  callback: {
    onData: (data: unknown) => void;
    onError: (error: DataSourceError) => void;
    onStatusChange: (status: DataSourceStatus) => void;
  };
  
  /** Subscription status. */
  status: 'active' | 'paused' | 'error' | 'cancelled';
  
  /** Creation timestamp. */
  createdAt: number;
}

/**
 * Feed aggregation configuration.
 */
interface FeedAggregationConfig {
  /** Aggregation ID. */
  id: string;
  
  /** Source feeds. */
  sources: Array<{
    sourceId: DataSourceId;
    subscriptionId: string;
    weight: number;
    priority: number;
  }>;
  
  /** Aggregation strategy. */
  strategy: 'weighted-average' | 'median' | 'best-quality' | 'consensus' | 'custom';
  
  /** Quality scoring. */
  qualityScoring: {
    latencyWeight: number;
    reliabilityWeight: number;
    freshnessWeight: number;
    volumeWeight: number;
  };
  
  /** Outlier detection. */
  outlierDetection: {
    enabled: boolean;
    threshold: number;
    method: 'zscore' | 'iqr' | 'custom';
  };
  
  /** Output configuration. */
  output: {
    updateFrequency: number;
    minSources: number;
    maxAge: number;
  };
}

// ========================================
// DATA QUALITY TYPES
// ========================================

/**
 * Data quality metrics.
 */
interface DataQualityMetrics {
  /** Reliability score (0-100). */
  reliability: number;
  
  /** Freshness score (0-100). */
  freshness: number;
  
  /** Accuracy score (0-100). */
  accuracy: number;
  
  /** Completeness score (0-100). */
  completeness: number;
  
  /** Consistency score (0-100). */
  consistency: number;
  
  /** Overall quality score (0-100). */
  overallScore: number;
  
  /** Quality trends. */
  trends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

/**
 * Data source performance metrics.
 */
interface DataSourceMetrics {
  /** Source identifier. */
  sourceId: DataSourceId;
  
  /** Performance metrics. */
  performance: {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    uptime: number;
    successRate: number;
    errorRate: number;
  };
  
  /** Request statistics. */
  requests: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
    timeouts: number;
  };
  
  /** Data quality. */
  quality: DataQualityMetrics;
  
  /** Cost metrics. */
  costs: {
    totalRequests: number;
    estimatedCost: number;
    costPerRequest: number;
  };
  
  /** Measurement period. */
  period: {
    start: number;
    end: number;
  };
}

// ========================================
// ERROR HANDLING TYPES
// ========================================

/**
 * Data source error types.
 */
type DataSourceErrorType = 
  | 'network'
  | 'authentication'
  | 'rate-limit'
  | 'timeout'
  | 'parsing'
  | 'validation'
  | 'service-unavailable'
  | 'unknown';

/**
 * Data source error.
 */
interface DataSourceError {
  /** Error type. */
  type: DataSourceErrorType;
  
  /** Error code. */
  code: string;
  
  /** Error message. */
  message: string;
  
  /** Source of error. */
  sourceId: DataSourceId;
  
  /** Error timestamp. */
  timestamp: number;
  
  /** Request details. */
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    params: Record<string, unknown>;
  };
  
  /** Response details. */
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
  
  /** Error context. */
  context: {
    subscriptionId?: string;
    retryAttempt?: number;
    duration?: number;
  };
  
  /** Recovery suggestions. */
  recovery?: {
    retryable: boolean;
    backoffMs?: number;
    maxRetries?: number;
    suggestions: string[];
  };
}

// ========================================
// SPECIALIZED SOURCE TYPES
// ========================================

/**
 * Oracle data configuration.
 */
interface OracleConfig {
  /** Oracle type. */
  type: 'chainlink' | 'pyth' | 'band' | 'api3' | 'custom';
  
  /** Contract addresses by chain. */
  contracts: Record<SupportedChain, {
    feedRegistry?: Address;
    feeds: Record<string, Address>;
  }>;
  
  /** Update conditions. */
  updateConditions: {
    priceDeviation: number;
    timeDeviation: number;
    heartbeat: number;
  };
  
  /** Data validation. */
  validation: {
    minValue?: number;
    maxValue?: number;
    maxAge: number;
    requiredDecimals: number;
  };
}

/**
 * Social sentiment data configuration.
 */
interface SocialSentimentConfig {
  /** Social platforms. */
  platforms: Array<'twitter' | 'reddit' | 'telegram' | 'discord'>;
  
  /** Keywords to track. */
  keywords: string[];
  
  /** Tokens to track. */
  tokens: TokenInfo[];
  
  /** Sentiment analysis. */
  analysis: {
    model: 'rule-based' | 'ml' | 'hybrid';
    languages: string[];
    confidence: number;
  };
  
  /** Aggregation settings. */
  aggregation: {
    timeWindow: number;
    weightByFollowers: boolean;
    weightByEngagement: boolean;
  };
}

/**
 * News data configuration. */
interface NewsDataConfig {
  /** News sources. */
  sources: string[];
  
  /** Categories. */
  categories: string[];
  
  /** Keywords. */
  keywords: string[];
  
  /** Languages. */
  languages: string[];
  
  /** Content analysis. */
  analysis: {
    sentiment: boolean;
    entities: boolean;
    topics: boolean;
    relevance: boolean;
  };
  
  /** Filtering. */
  filters: {
    minRelevance: number;
    excludeSpam: boolean;
    requireVerification: boolean;
  };
}

// ========================================
// WEBHOOK TYPES
// ========================================

/**
 * Webhook configuration. */
interface WebhookConfig {
  /** Webhook URL. */
  url: string;
  
  /** HTTP method. */
  method: 'POST' | 'PUT';
  
  /** Authentication. */
  auth?: {
    type: 'signature' | 'header' | 'query';
    secret: string;
    algorithm?: 'sha256' | 'sha512';
  };
  
  /** Headers. */
  headers: Record<string, string>;
  
  /** Retry settings. */
  retry: {
    maxAttempts: number;
    backoffMs: number;
    timeoutMs: number;
  };
  
  /** Event filters. */
  filters: {
    eventTypes: string[];
    conditions: Record<string, unknown>;
  };
}

/**
 * Webhook event. */
interface WebhookEvent {
  /** Event ID. */
  id: string;
  
  /** Event type. */
  type: string;
  
  /** Source ID. */
  sourceId: DataSourceId;
  
  /** Event timestamp. */
  timestamp: number;
  
  /** Event data. */
  data: Record<string, unknown>;
  
  /** Event signature. */
  signature?: string;
  
  /** Delivery attempts. */
  attempts: Array<{
    timestamp: number;
    status: number;
    error?: string;
    responseTime: number;
  }>;
}

// ========================================
// EXPORTS
// ========================================

export type {
  DataSourceId,
  DataSourceType,
  DataSourceStatus,
  AuthMethod,
  DataSourceErrorType,
  APIEndpoint,
  AuthConfig,
  DataSourceAPIConfig,
  FeedSubscription,
  FeedAggregationConfig,
  DataQualityMetrics,
  DataSourceMetrics,
  DataSourceError,
  OracleConfig,
  SocialSentimentConfig,
  NewsDataConfig,
  WebhookConfig,
  WebhookEvent
}; 