/**
 * @file Production-grade exponential backoff retry utility
 * @package @trading-bot/utilities
 * 
 * Enterprise-grade retry mechanism with exponential backoff, jitter,
 * circuit breaker integration, and comprehensive error handling.
. */

import type { 
  RetryConfig, 
  RetryResult, 
  RetryAttempt,
  ExponentialBackoffConfig,
  RetryOperationContext,
  RetryErrorCode,
  RetryStrategy
} from '@trading-bot/types/src/utilities/retry/retry';
import type { UtilityError } from '@trading-bot/types/src/utilities/validation/validation';

/**
 * Default retry configuration
. */
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  strategy: 'exponential',
  maxDelay: 30000,
  jitter: true,
  retryCondition: (error: any) => {
    // Default: retry on network errors, rate limits, and server errors
    return error?.code === 'NETWORK_ERROR' ||
           error?.code === 'RATE_LIMITED' ||
           error?.status >= 500 ||
           error?.code === 'ECONNRESET' ||
           error?.code === 'ETIMEDOUT';
  },
  abortSignal: undefined as any // Will be handled properly in constructor
};

/**
 * Exponential backoff retry implementation
. */
export class ExponentialBackoffRetry {
  private readonly config: Required<RetryConfig>;
  private aborted = false;


  /**
   *
   * @param config
  . */
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
      baseDelay: config.baseDelay ?? DEFAULT_CONFIG.baseDelay,
      strategy: config.strategy ?? DEFAULT_CONFIG.strategy,
      maxDelay: config.maxDelay ?? DEFAULT_CONFIG.maxDelay,
      jitter: config.jitter ?? DEFAULT_CONFIG.jitter,
      retryCondition: config.retryCondition ?? DEFAULT_CONFIG.retryCondition,
      abortSignal: config.abortSignal ?? undefined as any
    };
    
    this.validateConfig();
    
    if (this.config.abortSignal) {
      this.config.abortSignal.addEventListener('abort', () => {
        this.aborted = true;
      });
    }
  }

  /**
   * Execute operation with exponential backoff retry
   * @param operation
   * @param context
  . */
  async execute<T>(
    operation: () => Promise<T>,
    context?: Partial<RetryOperationContext>
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const operationContext = this.createOperationContext(context, startTime);
    const history: RetryAttempt[] = [];
    let lastError: any;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (this.aborted) {
        throw this.createAbortError(operationContext);
      }

      const attemptStartTime = Date.now();
      
      try {
        const result = await operation();
        const duration = Date.now() - attemptStartTime;
        const successAttempt: RetryAttempt = {
          attempt: attempt + 1,
          delay: 0,
          timestamp: attemptStartTime,
          duration,
          success: true
        };
        
        history.push(successAttempt);
        
        return {
          result,
          attempts: attempt + 1,
          elapsedTime: Date.now() - startTime,
          success: true,
          history
        };
      } catch (error) {
        lastError = error;
        const duration = Date.now() - attemptStartTime;
        const normalizedError = this.normalizeError(error);
        
        // Check if we should retry
        const shouldRetry = attempt < this.config.maxRetries && 
                          (this.config.retryCondition?.(error, attempt + 1) ?? false);
        
        const delay = shouldRetry ? this.calculateDelay(attempt) : 0;
        
        const failedAttempt: RetryAttempt = {
          attempt: attempt + 1,
          delay,
          error: normalizedError,
          timestamp: attemptStartTime,
          duration,
          success: false
        };
        
        history.push(failedAttempt);
        
        if (!shouldRetry) {
          break;
        }

        // Wait before next attempt
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    return {
      attempts: this.config.maxRetries + 1,
      elapsedTime: Date.now() - startTime,
      success: false,
      error: this.normalizeError(lastError),
      history
    };
  }

  /**
   * Calculate delay for given attempt using exponential backoff
   * @param attempt
  . */
  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case 'fixed':
        delay = this.config.baseDelay;
        break;
      
      case 'linear':
        delay = this.config.baseDelay * (attempt + 1);
        break;
      
      case 'exponential':
        delay = this.config.baseDelay * Math.pow(2, attempt);
        break;
      
      case 'custom':
        // For custom strategy, use exponential as fallback
        delay = this.config.baseDelay * Math.pow(2, attempt);
        break;
      
      default:
        delay = this.config.baseDelay;
    }

    // Apply maximum delay limit
    delay = Math.min(delay, this.config.maxDelay);

    // Apply jitter if enabled
    if (this.config.jitter) {
      delay = this.applyJitter(delay);
    }

    return Math.floor(delay);
  }

  /**
   * Apply jitter to delay to avoid thundering herd
   * @param delay
  . */
  protected applyJitter(delay: number): number {
    if (typeof this.config.jitter === 'number') {
      // Fixed jitter amount
      const jitterAmount = this.config.jitter;
      return delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    } 
      // Full jitter (random between 0 and delay)
      return Math.random() * delay;
    
  }

  /**
   * Sleep for specified milliseconds with abort support
   * @param ms
  . */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      
      const cleanup = () => {
        clearTimeout(timeout);
        if (this.config.abortSignal) {
          this.config.abortSignal.removeEventListener('abort', abortHandler);
        }
      };
      
      const abortHandler = () => {
        cleanup();
        reject(this.createAbortError());
      };
      
      if (this.config.abortSignal) {
        if (this.config.abortSignal.aborted) {
          cleanup();
          reject(this.createAbortError());
          return;
        }
        
        this.config.abortSignal.addEventListener('abort', abortHandler, { once: true });
      }
      
      // Clean up after timeout resolves
      setTimeout(cleanup, ms);
    });
  }

  /**
   * Create operation context
   * @param context
   * @param startTime
  . */
  private createOperationContext(
    context?: Partial<RetryOperationContext>,
    startTime: number = Date.now()
  ): RetryOperationContext {
    const operationContext: RetryOperationContext = {
      operationName: context?.operationName || 'exponential-backoff-retry',
      category: context?.category || 'other',
      metadata: context?.metadata || {},
      requestId: context?.requestId || this.generateRequestId(),
      startTime
    };

    if (context?.userId !== undefined) {
      operationContext.userId = context.userId;
    }

    if (context?.parentOperationId !== undefined) {
      operationContext.parentOperationId = context.parentOperationId;
    }

    return operationContext;
  }

  /**
   * Generate unique request ID
  . */
  private generateRequestId(): string {
    return `eb_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create abort error
   * @param context
  . */
  private createAbortError(context?: RetryOperationContext): UtilityError {
    return {
      code: 'OPERATION_ABORTED' as RetryErrorCode,
      message: 'Operation was aborted',
      details: {
        reason: 'AbortSignal was triggered',
        context
      },
      timestamp: Date.now()
    };
  }

  /**
   * Normalize error to consistent format
   * @param error
  . */
  private normalizeError(error: any): UtilityError {
    if (error?.code && error?.message && error?.timestamp) {
      return error;
    }

    return {
      code: error?.code || 'UNKNOWN_ERROR',
      message: error?.message || String(error),
      details: {
        originalError: error,
        stack: error?.stack
      },
      timestamp: Date.now()
    };
  }

  /**
   * Validate configuration
  . */
  private validateConfig(): void {
    if (this.config.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }
    if (this.config.baseDelay <= 0) {
      throw new Error('baseDelay must be greater than 0');
    }
    if (this.config.maxDelay <= 0) {
      throw new Error('maxDelay must be greater than 0');
    }
    if (this.config.baseDelay > this.config.maxDelay) {
      throw new Error('baseDelay cannot be greater than maxDelay');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<RetryConfig> {
    return { ...this.config };
  }

  /**
   * Check if operation should be retried based on error
   * @param error
   * @param attempt
   */
  shouldRetry(error: any, attempt: number): boolean {
    return attempt <= this.config.maxRetries && 
           (this.config.retryCondition?.(error, attempt) ?? false);
  }

  /**
   * Create new instance with updated configuration
   * @param newConfig
  . */
  withConfig(newConfig: Partial<RetryConfig>): ExponentialBackoffRetry {
    return new ExponentialBackoffRetry({ ...this.config, ...newConfig });
  }
}

/**
 * Enhanced exponential backoff with additional configuration
. */
export class EnhancedExponentialBackoff extends ExponentialBackoffRetry {
  private readonly enhancedConfig: Required<ExponentialBackoffConfig>;

  /**
   *
   * @param config
  . */
  constructor(config: Partial<ExponentialBackoffConfig> = {}) {
    super(config);
    
    this.enhancedConfig = {
      ...this.getConfig(),
      exponentialBase: config.exponentialBase ?? 2,
      maxExponentialDelay: config.maxExponentialDelay ?? config.maxDelay ?? 300000
    };
  }

  /**
   * Calculate delay using enhanced exponential backoff
   * @param attempt
  . */
  protected calculateEnhancedDelay(attempt: number): number {
    const {baseDelay} = this.enhancedConfig;
    const {exponentialBase} = this.enhancedConfig;
    const maxDelay = Math.min(
      this.enhancedConfig.maxDelay,
      this.enhancedConfig.maxExponentialDelay
    );

    let delay = baseDelay * Math.pow(exponentialBase, attempt);
    delay = Math.min(delay, maxDelay);

    if (this.enhancedConfig.jitter) {
      delay = this.applyJitter(delay);
    }

    return Math.floor(delay);
  }

  /**
   * Get enhanced configuration
  . */
  getEnhancedConfig(): Required<ExponentialBackoffConfig> {
    return { ...this.enhancedConfig };
  }
}

/**
 * Simple exponential backoff retry function
 * @param operation
 * @param config
. */
export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retry = new ExponentialBackoffRetry(config);
  const result = await retry.execute(operation);
  
  if (result.success && result.result !== undefined) {
    return result.result;
  }
  
  throw result.error || new Error('Operation failed after all retries');
}

/**
 * Create a retry decorator for functions
 * @param fn
 * @param config
. */
export function withExponentialBackoff<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: Partial<RetryConfig> = {}
): T {
  return (async (...args: Parameters<T>) => {
    return retryWithExponentialBackoff(() => fn(...args), config);
  }) as T;
}

/**
 * Pre-configured retry strategies
. */
export const retryStrategies = {
  /**
   * Quick retry for fast operations
   * @param config
  . */
  quick: (config?: Partial<RetryConfig>) => new ExponentialBackoffRetry({
    maxRetries: 2,
    baseDelay: 100,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 1000,
    jitter: true,
    ...config
  }),

  /**
   * Standard retry for most operations
   * @param config
  . */
  standard: (config?: Partial<RetryConfig>) => new ExponentialBackoffRetry({
    maxRetries: 3,
    baseDelay: 1000,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 10000,
    jitter: true,
    ...config
  }),

  /**
   * Aggressive retry for critical operations
   * @param config
  . */
  aggressive: (config?: Partial<RetryConfig>) => new ExponentialBackoffRetry({
    maxRetries: 5,
    baseDelay: 500,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 30000,
    jitter: true,
    ...config
  }),

  /**
   * Network-specific retry configuration
   * @param config
  . */
  network: (config?: Partial<RetryConfig>) => new ExponentialBackoffRetry({
    maxRetries: 4,
    baseDelay: 2000,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 60000,
    jitter: true,
    retryCondition: (error: any) => {
      return error?.code === 'NETWORK_ERROR' ||
             error?.code === 'ECONNRESET' ||
             error?.code === 'ETIMEDOUT' ||
             error?.code === 'ENOTFOUND' ||
             error?.status >= 500;
    },
    ...config
  }),

  /**
   * Trading-specific retry configuration
   * @param config
  . */
  trading: (config?: Partial<RetryConfig>) => new ExponentialBackoffRetry({
    maxRetries: 2,
    baseDelay: 250,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 2000,
    jitter: 100, // Fixed jitter amount
    retryCondition: (error: any) => {
      // Only retry on technical errors, not market-related errors
      return error?.code === 'NETWORK_ERROR' ||
             error?.code === 'RATE_LIMITED' ||
             error?.status >= 500;
    },
    ...config
  })
};

/**
 * Exponential backoff utilities
. */
export const exponentialBackoffUtils = {
  ExponentialBackoffRetry,
  EnhancedExponentialBackoff,
  retryWithExponentialBackoff,
  withExponentialBackoff,
  retryStrategies,
  
  /**
   * Calculate backoff delay
   * @param attempt
   * @param baseDelay
   * @param maxDelay
   * @param strategy
  . */
  calculateBackoffDelay: (
    attempt: number, 
    baseDelay: number = 1000, 
    maxDelay: number = 30000,
    strategy: RetryStrategy = 'exponential'
  ): number => {
    let delay: number;
    
    switch (strategy) {
      case 'fixed':
        delay = baseDelay;
        break;
      case 'linear':
        delay = baseDelay * (attempt + 1);
        break;
      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt);
        break;
      default:
        delay = baseDelay * Math.pow(2, attempt);
    }
    
    return Math.min(delay, maxDelay);
  },
  
  /**
   * Add jitter to delay
   * @param delay
   * @param jitterFactor
  . */
  addJitter: (delay: number, jitterFactor: number = 0.1): number => {
    const jitter = delay * jitterFactor;
    return delay + (Math.random() * jitter * 2 - jitter);
  },
  
  /**
   * Check if error is retryable
   * @param error
  . */
  isRetryableError: (error: any): boolean => {
    return error?.code === 'NETWORK_ERROR' ||
           error?.code === 'RATE_LIMITED' ||
           error?.status >= 500 ||
           error?.code === 'ECONNRESET' ||
           error?.code === 'ETIMEDOUT';
  },

  /**
   * Create retry condition for specific error types
   * @param errorCodes
  . */
  createRetryCondition: (errorCodes: string[]): ((error: any, attempt: number) => boolean) => {
    return (error: any, _attempt: number) => {
      return errorCodes.includes(error?.code) || 
             (error?.status >= 500 && error?.status < 600);
    };
  },

  /**
   * Batch retry multiple operations
   * @param operations
   * @param config
  . */
  batchRetry: async <T>(
    operations: (() => Promise<T>)[],
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>[]> => {
    const retry = new ExponentialBackoffRetry(config);
    const results = await Promise.allSettled(
      operations.map(op => retry.execute(op))
    );
    
    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : {
            attempts: 0,
            elapsedTime: 0,
            success: false,
            error: result.reason,
            history: []
          }
    );
  }
};
