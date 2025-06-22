/**
 * @file Retry utility types for the utilities package.
 * @package @trading-bot/types
 */

/** Jitter strategies for retry timing. */
type JitterStrategy = 'none' | 'full' | 'equal' | 'decorrelated' | 'exponential';

/** Retry backoff strategies. */
type RetryStrategy = 'fixed' | 'exponential' | 'linear' | 'custom';

/** Circuit breaker states. */
type CircuitState = 'closed' | 'open' | 'half-open';

/** Base retry configuration. */
interface RetryConfig {
  /** Maximum retry attempts. */
  maxRetries: number;
  
  /** Base delay in milliseconds. */
  baseDelay: number;
  
  /** Backoff strategy. */
  strategy?: RetryStrategy;
  
  /** Maximum delay in milliseconds. */
  maxDelay?: number;
  
  /** Jitter to add to delay. */
  jitter?: boolean | number;
  
  /** Retry condition function. */
  retryCondition?: (error: unknown, attempt: number) => boolean;
  
  /** Abort signal for cancellation. */
  abortSignal?: AbortSignal;
}

/** Extended retry configuration with jitter options. */
interface JitterRetryConfig extends RetryConfig {
  /** Jitter strategy. */
  jitterStrategy?: JitterStrategy;
  
  /** Jitter multiplier. */
  jitterMultiplier?: number;
  
  /** Correlation ID for decorrelated jitter. */
  correlationId?: string;
}

/** Retry attempt details. */
interface RetryAttempt {
  /** Attempt number. */
  attempt: number;
  
  /** Delay before this attempt. */
  delay: number;
  
  /** Error that occurred (if any). */
  error?: Error | string;
  
  /** Timestamp of the attempt. */
  timestamp: number;
  
  /** Duration of the attempt. */
  duration?: number;
  
  /** Success status. */
  success?: boolean;
}

/** Retry operation result. */
interface RetryResult<T> {
  /** Operation result. */
  result?: T;
  
  /** Number of attempts made. */
  attempts: number;
  
  /** Total elapsed time. */
  elapsedTime: number;
  
  /** Whether operation succeeded. */
  success: boolean;
  
  /** Final error if failed. */
  error?: Error | string;
  
  /** Retry history. */
  history: RetryAttempt[];
}

/** Exponential backoff configuration. */
interface ExponentialBackoffConfig extends RetryConfig {
  /** Exponential base multiplier. */
  exponentialBase?: number;
  
  /** Maximum exponential multiplier. */
  maxExponentialDelay?: number;
}

// Circuit Breaker Types (part of retry utilities)

/** Circuit breaker configuration. */
interface CircuitBreakerConfig {
  /** Failure threshold. */
  failureThreshold: number;
  
  /** Recovery timeout in milliseconds. */
  recoveryTimeout: number;
  
  /** Monitoring window in milliseconds. */
  monitoringWindow: number;
  
  /** Expected failure rate threshold. */
  expectedFailureRate?: number;
  
  /** Minimum throughput threshold. */
  minimumThroughput?: number;
}

/** Circuit breaker state transition. */
interface CircuitBreakerStateTransition {
  /** Previous state. */
  from: CircuitState;
  
  /** New state. */
  to: CircuitState;
  
  /** Transition timestamp. */
  timestamp: number;
  
  /** Reason for transition. */
  reason: string;
  
  /** Additional context. */
  context?: {
    failureCount?: number;
    successCount?: number;
    threshold?: number;
    duration?: number;
    triggerReason?: string;
    additional?: Record<string, string | number | boolean>;
  };
}

/** Circuit breaker state. */
interface CircuitBreakerState {
  /** Current state. */
  state: CircuitState;
  
  /** Failure count. */
  failures: number;
  
  /** Success count. */
  successes: number;
  
  /** Last failure time. */
  lastFailure?: number;
  
  /** Next attempt time. */
  nextAttempt?: number;
  
  /** State transition history. */
  history: CircuitBreakerStateTransition[];
}

/** Circuit breaker request tracking. */
interface CircuitBreakerRequest {
  /** Request timestamp. */
  timestamp: number;
  
  /** Request success status. */
  success: boolean;
  
  /** Request duration. */
  duration: number;
  
  /** Request error (if any). */
  error?: Error | string;
  
  /** Request metadata. */
  metadata?: {
    operationName?: string;
    requestId?: string;
    userId?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    additional?: Record<string, string | number | boolean>;
  };
}

/** Circuit breaker window metrics. */
interface CircuitBreakerWindowMetrics {
  /** Total requests in window. */
  totalRequests: number;
  
  /** Total failures in window. */
  totalFailures: number;
  
  /** Total successes in window. */
  totalSuccesses: number;
  
  /** Failure rate in window. */
  failureRate: number;
  
  /** Success rate in window. */
  successRate: number;
  
  /** Window start time. */
  windowStart: number;
  
  /** Window end time. */
  windowEnd: number;
}

/** Circuit breaker metrics. */
interface CircuitBreakerMetrics {
  /** Total requests ever. */
  totalRequests: number;
  
  /** Total failures ever. */
  totalFailures: number;
  
  /** Total successes ever. */
  totalSuccesses: number;
  
  /** Overall success rate. */
  successRate: number;
  
  /** Overall failure rate. */
  failureRate: number;
  
  /** Average response time. */
  averageResponseTime: number;
  
  /** Last failure time. */
  lastFailureTime?: number;
  
  /** Last success time. */
  lastSuccessTime?: number;
  
  /** Number of state transitions. */
  stateTransitions: number;
  
  /** Time in current state. */
  timeInCurrentState: number;
  
  /** Current window metrics. */
  windowMetrics?: CircuitBreakerWindowMetrics;
}

/** Circuit breaker events. */
type CircuitBreakerEvent = 
  | 'state-change'
  | 'request-success'
  | 'request-failure'
  | 'threshold-reached'
  | 'recovery-started'
  | 'recovery-succeeded'
  | 'recovery-failed'
  | 'metrics-updated'
  | 'window-reset';

/** Circuit breaker event data. */
interface CircuitBreakerEventData {
  /** Event type. */
  event: CircuitBreakerEvent;
  
  /** Event timestamp. */
  timestamp: number;
  
  /** Current state. */
  currentState: CircuitState;
  
  /** Event-specific data. */
  data?: {
    error?: Error | string;
    request?: CircuitBreakerRequest;
    stateTransition?: CircuitBreakerStateTransition;
    metrics?: Partial<CircuitBreakerMetrics>;
    additional?: Record<string, string | number | boolean>;
  };
  
  /** Circuit breaker metrics at time of event. */
  metrics?: CircuitBreakerMetrics;
}

/** Event listener type. */
type CircuitBreakerEventListener = (
  event: CircuitBreakerEvent,
  data: CircuitBreakerEventData
) => void;

/** Circuit breaker dashboard data. */
interface CircuitBreakerDashboardData {
  /** Status information. */
  status: {
    /** Current state. */
    state: CircuitState;
    
    /** Whether circuit is healthy. */
    healthy: boolean;
    
    /** Current failure count. */
    failures: number;
    
    /** Current success count. */
    successes: number;
    
    /** Time since last state change. */
    timeSinceStateChange: number;
  };
  
  /** Performance metrics. */
  performance: {
    /** Success rate percentage. */
    successRate: number;
    
    /** Failure rate percentage. */
    failureRate: number;
    
    /** Average response time. */
    averageResponseTime: number;
    
    /** Total requests processed. */
    totalRequests: number;
    
    /** Requests per second. */
    requestsPerSecond?: number;
  };
  
  /** Timing information. */
  timing: {
    /** Time in current state. */
    timeInCurrentState: number;
    
    /** Number of state transitions. */
    stateTransitions: number;
    
    /** Last failure time. */
    lastFailureTime?: number;
    
    /** Last success time. */
    lastSuccessTime?: number;
    
    /** Next recovery attempt time. */
    nextRecoveryAttempt?: number;
  };
  
  /** Recent activity. */
  recentActivity: {
    /** Recent requests. */
    requests: CircuitBreakerRequest[];
    
    /** Recent state transitions. */
    transitions: CircuitBreakerStateTransition[];
    
    /** Recent events. */
    events: CircuitBreakerEventData[];
  };
}

/** Retry strategy configuration. */
interface RetryStrategyConfig {
  /** Strategy name. */
  name: string;
  
  /** Strategy description. */
  description: string;
  
  /** Base configuration. */
  config: RetryConfig;
  
  /** Recommended use cases. */
  useCases: string[];
  
  /** Performance characteristics. */
  characteristics: {
    /** Typical retry count. */
    typicalRetries: number;
    
    /** Maximum delay. */
    maxDelay: number;
    
    /** Suitable for time-sensitive operations. */
    timeSensitive: boolean;
    
    /** Resource intensive. */
    resourceIntensive: boolean;
  };
}

/** Retry utility error codes. */
type RetryErrorCode = 
  | 'MAX_RETRIES_EXCEEDED'
  | 'OPERATION_ABORTED'
  | 'CIRCUIT_OPEN'
  | 'INVALID_CONFIG'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

/** Retry operation context. */
interface RetryOperationContext {
  /** Operation name/identifier. */
  operationName?: string;
  
  /** Operation category. */
  category?: 'network' | 'database' | 'api' | 'trading' | 'file' | 'other';
  
  /** Request metadata. */
  metadata?: {
    endpoint?: string;
    method?: string;
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
    tags?: string[];
    source?: string;
    additional?: Record<string, string | number | boolean>;
  };
  
  /** User ID. */
  userId?: string;
  
  /** Request ID for tracking. */
  requestId?: string;
  
  /** Parent operation ID. */
  parentOperationId?: string;
  
  /** Start timestamp. */
  startTime: number;
}

// ========================================
// ADDITIONAL MISSING TYPES
// ========================================

/**
 * Retry policy configuration.
 */
interface RetryPolicy {
  /** Policy name. */
  name: string;
  
  /** Base retry configuration. */
  config: RetryConfig;
  
  /** Policy-specific options. */
  options: {
    backoffMultiplier?: number;
    jitterEnabled?: boolean;
    maxDelay?: number;
  };
  
  /** Policy description. */
  description?: string;
}

/**
 * Linear backoff configuration.
 */
interface LinearBackoff {
  /** Linear increment. */
  increment: number;
  
  /** Maximum delay. */
  maxDelay: number;
  
  /** Initial delay. */
  initialDelay: number;
}

/**
 * Fixed delay configuration.
 */
interface FixedDelay {
  /** Fixed delay amount. */
  delay: number;
  
  /** Jitter amount. */
  jitter?: number;
}

/**
 * Custom backoff configuration.
 */
interface CustomBackoff {
  /** Custom backoff function. */
  calculateDelay: (attempt: number, error?: Error) => number;
  
  /** Backoff name. */
  name: string;
  
  /** Backoff description. */
  description?: string;
}

/**
 * Retry options.
 */
interface RetryOptions {
  /** Retry configuration. */
  config: RetryConfig;
  
  /** Context information. */
  context?: RetryOperationContext;
  
  /** Callback for retry events. */
  onRetry?: (attempt: RetryAttempt) => void;
  
  /** Callback for completion. */
  onComplete?: (result: RetryResult<unknown>) => void;
}

/**
 * Retry context information.
 */
interface RetryContext {
  /** Current attempt number. */
  attempt: number;
  
  /** Total attempts allowed. */
  maxAttempts: number;
  
  /** Last error encountered. */
  lastError?: Error;
  
  /** Elapsed time. */
  elapsedTime: number;
  
  /** Retry history. */
  history: RetryAttempt[];
}

/**
 * Retry metrics tracking.
 */
interface RetryMetrics {
  /** Total retry operations. */
  totalOperations: number;
  
  /** Successful operations. */
  successfulOperations: number;
  
  /** Failed operations. */
  failedOperations: number;
  
  /** Average attempts per operation. */
  averageAttempts: number;
  
  /** Average success time. */
  averageSuccessTime: number;
  
  /** Common failure reasons. */
  failureReasons: Record<string, number>;
}

/**
 * Circuit breaker interface.
 */
interface CircuitBreaker {
  /** Circuit breaker state. */
  state: CircuitBreakerState;
  
  /** Circuit breaker configuration. */
  config: CircuitBreakerConfig;
  
  /** Execute operation with circuit breaker. */
  execute<T>(operation: () => Promise<T>): Promise<T>;
  
  /** Get circuit breaker metrics. */
  getMetrics(): CircuitBreakerMetrics;
  
  /** Reset circuit breaker state. */
  reset(): void;
}

/**
 * Bulkhead configuration.
 */
interface BulkheadConfig {
  /** Maximum concurrent executions. */
  maxConcurrency: number;
  
  /** Queue size for waiting operations. */
  queueSize: number;
  
  /** Timeout for queued operations. */
  queueTimeout: number;
}

/**
 * Bulkhead interface.
 */
interface Bulkhead {
  /** Bulkhead configuration. */
  config: BulkheadConfig;
  
  /** Current execution count. */
  currentExecutions: number;
  
  /** Queue size. */
  queueSize: number;
  
  /** Execute operation with bulkhead. */
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

/**
 * Timeout configuration.
 */
interface TimeoutConfig {
  /** Timeout duration in milliseconds. */
  duration: number;
  
  /** Action on timeout. */
  onTimeout?: () => void;
  
  /** Timeout error message. */
  errorMessage?: string;
}

/**
 * Rate limiter interface.
 */
interface RateLimiter {
  /** Check if operation is allowed. */
  isAllowed(): boolean;
  
  /** Wait for next allowed operation. */
  waitForNext(): Promise<void>;
  
  /** Get current rate limit status. */
  getStatus(): {
    remaining: number;
    resetTime: number;
    limit: number;
  };
}

/**
 * Rate limit configuration.
 */
interface RateLimitConfig {
  /** Requests per time window. */
  requests: number;
  
  /** Time window in milliseconds. */
  window: number;
  
  /** Burst allowance. */
  burst?: number;
}

/**
 * Rate limit result.
 */
interface RateLimitResult {
  /** Whether request is allowed. */
  allowed: boolean;
  
  /** Remaining requests in window. */
  remaining: number;
  
  /** Time until window reset. */
  resetTime: number;
  
  /** Retry after duration if not allowed. */
  retryAfter?: number;
}

/**
 * Resilience pattern configuration.
 */
interface ResiliencePattern {
  /** Pattern name. */
  name: string;
  
  /** Pattern type. */
  type: 'retry' | 'circuit-breaker' | 'bulkhead' | 'timeout' | 'rate-limit';
  
  /** Pattern configuration. */
  config: Record<string, unknown>;
  
  /** Pattern enabled. */
  enabled: boolean;
}

/**
 * Resilience configuration.
 */
interface ResilienceConfig {
  /** Resilience patterns to apply. */
  patterns: ResiliencePattern[];
  
  /** Pattern execution order. */
  order: string[];
  
  /** Global configuration. */
  global: {
    enabled: boolean;
    metricsEnabled: boolean;
    loggingEnabled: boolean;
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default retry configurations.
 */
const DEFAULT_RETRY_CONFIGS = {
  NETWORK: {
    maxRetries: 3,
    baseDelay: 1000,
    strategy: 'exponential' as const,
    maxDelay: 10000
  },
  DATABASE: {
    maxRetries: 5,
    baseDelay: 500,
    strategy: 'exponential' as const,
    maxDelay: 5000
  },
  API: {
    maxRetries: 3,
    baseDelay: 2000,
    strategy: 'linear' as const,
    maxDelay: 8000
  },
  TRADING: {
    maxRetries: 2,
    baseDelay: 100,
    strategy: 'fixed' as const,
    maxDelay: 1000
  }
} as const;

/**
 * Circuit breaker default configurations.
 */
const CIRCUIT_BREAKER_DEFAULTS = {
  FAST_FAIL: {
    failureThreshold: 5,
    recoveryTimeout: 10000,
    monitoringWindow: 60000
  },
  GRADUAL_RECOVERY: {
    failureThreshold: 10,
    recoveryTimeout: 30000,
    monitoringWindow: 120000
  },
  SENSITIVE: {
    failureThreshold: 3,
    recoveryTimeout: 5000,
    monitoringWindow: 30000
  }
} as const;

// Consolidated export declaration
export type {
  JitterStrategy,
  RetryStrategy,
  CircuitState,
  RetryConfig,
  JitterRetryConfig,
  RetryAttempt,
  RetryResult,
  ExponentialBackoffConfig,
  CircuitBreakerConfig,
  CircuitBreakerStateTransition,
  CircuitBreakerState,
  CircuitBreakerRequest,
  CircuitBreakerWindowMetrics,
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
  CircuitBreakerEventData,
  CircuitBreakerEventListener,
  CircuitBreakerDashboardData,
  RetryStrategyConfig,
  RetryErrorCode,
  RetryOperationContext,
  RetryPolicy,
  LinearBackoff,
  FixedDelay,
  CustomBackoff,
  RetryOptions,
  RetryContext,
  RetryMetrics,
  CircuitBreaker,
  BulkheadConfig,
  Bulkhead,
  TimeoutConfig,
  RateLimiter,
  RateLimitConfig,
  RateLimitResult,
  ResiliencePattern,
  ResilienceConfig
};

export {
  DEFAULT_RETRY_CONFIGS,
  CIRCUIT_BREAKER_DEFAULTS
}; 