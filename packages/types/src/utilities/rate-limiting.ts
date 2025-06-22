/**
 * @file Rate limiting utility types for the utilities package.
 * @package @trading-bot/types
 */

/** Base rate limiting configuration. */
interface RateLimitConfig {
  /** Maximum requests. */
  maxRequests: number;
  
  /** Time window in milliseconds. */
  windowMs: number;
  
  /** Rate limit strategy. */
  strategy?: 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';
  
  /** Skip successful requests. */
  skipSuccessfulRequests?: boolean;
  
  /** Skip failed requests. */
  skipFailedRequests?: boolean;
  
  /** Rate limit identifier. */
  keyGenerator?: (context: {
    userId?: string;
    ip?: string;
    endpoint?: string;
    method?: string;
    apiKey?: string;
    sessionId?: string;
    additional?: Record<string, string | number | boolean>;
  }) => string;
}

/** Token bucket configuration. */
interface TokenBucketConfig {
  /** Maximum tokens in bucket. */
  capacity: number;
  
  /** Token refill rate per second. */
  refillRate: number;
  
  /** Initial token count. */
  initialTokens?: number;
  
  /** Maximum burst size. */
  maxBurst?: number;
}

/** Sliding window configuration. */
interface SlidingWindowConfig {
  /** Window size in milliseconds. */
  windowSize: number;
  
  /** Maximum requests per window. */
  maxRequests: number;
  
  /** Number of sub-windows. */
  precision?: number;
}

/** Rate limiting result. */
interface RateLimitResult {
  /** Whether request is allowed. */
  allowed: boolean;
  
  /** Remaining requests. */
  remaining: number;
  
  /** Time until reset (ms). */
  resetTime: number;
  
  /** Current limit. */
  limit: number;
  
  /** Time to retry (ms). */
  retryAfter?: number;
}

/** Adaptive rate limiter configuration. */
interface AdaptiveLimiterConfig extends RateLimitConfig {
  /** Target success rate (0.0 to 1.0). */
  targetSuccessRate: number;
  
  /** Target latency in milliseconds. */
  targetLatency: number;
  
  /** Adjustment factor for rate changes. */
  adjustmentFactor?: number;
  
  /** Minimum allowed rate limit. */
  minLimit?: number;
  
  /** Maximum allowed rate limit. */
  maxLimit?: number;
  
  /** Measurement window size (ms). */
  measurementWindow?: number;
  
  /** Minimum samples before adjusting. */
  minSamples?: number;
}

/** Request metrics for adaptive rate limiting. */
interface RequestMetrics {
  timestamp: number;
  success: boolean;
  latency: number;
  statusCode?: number;
  errorType?: string;
}

/** Performance metrics for adaptive rate limiter. */
interface AdaptiveMetrics {
  successRate: number;
  averageLatency: number;
  errorRate: number;
  sampleCount: number;
  latencyTrend: 'increasing' | 'decreasing' | 'stable';
  errorTypes: Record<string, number>;
}

/** Rate limiter state information. */
interface RateLimiterState {
  currentLimit: number;
  originalLimit: number;
  minLimit: number;
  maxLimit: number;
  utilizationPercent: number;
  adjustmentDirection: 'up' | 'down' | 'stable';
  consecutiveAdjustments: number;
  recentMetrics: AdaptiveMetrics;
}

/** Token bucket state information. */
interface TokenBucketState {
  tokens: number;
  capacity: number;
  refillRate: number;
  utilizationPercent: number;
}

/** Sliding window state information. */
interface SlidingWindowState {
  windowSize: number;
  maxRequests: number;
  precision: number;
  currentUsage: number;
  activeWindows: number;
  utilizationPercent: number;
}

// ========================================
// ADDITIONAL MISSING TYPES
// ========================================

/**
 * Rate limiting strategy types.
 */
type RateLimitStrategy = 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket' | 'adaptive';

/**
 * Leaky bucket configuration.
 */
interface LeakyBucketConfig {
  /** Bucket capacity. */
  capacity: number;
  
  /** Leak rate per second. */
  leakRate: number;
  
  /** Current bucket level. */
  currentLevel?: number;
  
  /** Overflow handling. */
  overflowStrategy?: 'drop' | 'queue' | 'reject';
}

/**
 * Fixed window configuration.
 */
interface FixedWindowConfig {
  /** Window duration in milliseconds. */
  windowMs: number;
  
  /** Maximum requests per window. */
  limit: number;
  
  /** Window start alignment. */
  alignment?: 'calendar' | 'sliding';
}

/**
 * Adaptive rate limit configuration.
 */
interface AdaptiveRateLimit {
  /** Base rate limit. */
  baseLimit: number;
  
  /** Target metrics. */
  targets: {
    successRate: number;
    latency: number;
    errorRate: number;
  };
  
  /** Adjustment parameters. */
  adjustment: {
    factor: number;
    minLimit: number;
    maxLimit: number;
    cooldown: number;
  };
}

/**
 * Rate limiting context.
 */
interface RateLimitContext {
  /** Request identifier. */
  requestId: string;
  
  /** User identifier. */
  userId?: string;
  
  /** API key. */
  apiKey?: string;
  
  /** IP address. */
  ipAddress?: string;
  
  /** Request metadata. */
  metadata: {
    endpoint: string;
    method: string;
    userAgent?: string;
    timestamp: number;
  };
}

/**
 * Rate limit state (alias for RateLimiterState for compatibility).
 */
interface RateLimitState extends RateLimiterState {}

/**
 * Rate limit quota configuration.
 */
interface RateLimitQuota {
  /** Quota identifier. */
  id: string;
  
  /** Quota type. */
  type: QuotaType;
  
  /** Quota limit. */
  limit: number;
  
  /** Time period. */
  period: number;
  
  /** Current usage. */
  used: number;
  
  /** Reset timestamp. */
  resetTime: number;
}

/**
 * Quota types.
 */
type QuotaType = 'requests' | 'bandwidth' | 'operations' | 'tokens' | 'custom';

// ========================================
// CONSTANTS
// ========================================

/**
 * Default rate limit configurations.
 */
const DEFAULT_RATE_LIMITS = {
  API: {
    maxRequests: 1000,
    windowMs: 3600000, // 1 hour
    strategy: 'sliding-window' as const
  },
  USER: {
    maxRequests: 100,
    windowMs: 300000, // 5 minutes
    strategy: 'token-bucket' as const
  },
  ANONYMOUS: {
    maxRequests: 10,
    windowMs: 60000, // 1 minute
    strategy: 'fixed-window' as const
  },
  BOT: {
    maxRequests: 50,
    windowMs: 60000, // 1 minute
    strategy: 'leaky-bucket' as const
  }
} as const;

/**
 * Burst allowances for different rate limiting strategies.
 */
const BURST_ALLOWANCES = {
  TOKEN_BUCKET: {
    maxBurst: 10,
    refillRate: 1,
    burstWindow: 1000
  },
  LEAKY_BUCKET: {
    maxBurst: 5,
    leakRate: 0.5,
    burstWindow: 2000
  },
  ADAPTIVE: {
    initialBurst: 20,
    maxBurst: 50,
    adjustmentFactor: 1.5
  }
} as const;

// Consolidated export declaration
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
  SlidingWindowState,
  RateLimitStrategy,
  LeakyBucketConfig,
  FixedWindowConfig,
  AdaptiveRateLimit,
  RateLimitContext,
  RateLimitState,
  RateLimitQuota,
  QuotaType
};

export {
  DEFAULT_RATE_LIMITS,
  BURST_ALLOWANCES
}; 