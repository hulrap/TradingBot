/**
 * @file Production-grade retry utility with jitter support
 * @package @trading-bot/utilities
 * 
 * Advanced retry mechanism with multiple jitter strategies to prevent
 * thundering herd problems and improve system resilience.
. */

import type { 
  RetryResult, 
  RetryAttempt,
  JitterRetryConfig, 
  JitterStrategy,
  RetryOperationContext,
  RetryErrorCode,
  RetryStrategy
} from '@trading-bot/types/src/utilities/retry/retry';
import type { UtilityError } from '@trading-bot/types/src/utilities/validation/validation';

/**
 * Default jitter retry configuration
. */
const DEFAULT_JITTER_CONFIG: Required<JitterRetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  strategy: 'exponential',
  maxDelay: 30000,
  jitter: true,
  jitterStrategy: 'full',
  jitterMultiplier: 1.0,
  correlationId: '',
  retryCondition: (error: any) => {
    return error?.code === 'NETWORK_ERROR' ||
           error?.code === 'RATE_LIMITED' ||
           error?.status >= 500 ||
           error?.code === 'ECONNRESET' ||
           error?.code === 'ETIMEDOUT' ||
           error?.code === 'ENOTFOUND';
  },
  abortSignal: undefined as any
};

/**
 * Jitter-based retry implementation
. */
export class RetryWithJitter {
  private readonly config: Required<JitterRetryConfig>;
  private readonly correlationState = new Map<string, number>();
  private aborted = false;

  /**
   *
   * @param config
  . */
  constructor(config: Partial<JitterRetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? DEFAULT_JITTER_CONFIG.maxRetries,
      baseDelay: config.baseDelay ?? DEFAULT_JITTER_CONFIG.baseDelay,
      strategy: config.strategy ?? DEFAULT_JITTER_CONFIG.strategy,
      maxDelay: config.maxDelay ?? DEFAULT_JITTER_CONFIG.maxDelay,
      jitter: config.jitter ?? DEFAULT_JITTER_CONFIG.jitter,
      jitterStrategy: config.jitterStrategy ?? DEFAULT_JITTER_CONFIG.jitterStrategy,
      jitterMultiplier: config.jitterMultiplier ?? DEFAULT_JITTER_CONFIG.jitterMultiplier,
      correlationId: config.correlationId ?? this.generateCorrelationId(),
      retryCondition: config.retryCondition ?? DEFAULT_JITTER_CONFIG.retryCondition,
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
   * Execute operation with jitter-based retry
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
        
        const shouldRetry = attempt < this.config.maxRetries && 
                          (this.config.retryCondition?.(error, attempt + 1) ?? false);
        
        const delay = shouldRetry ? this.calculateJitteredDelay(attempt) : 0;
        
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

        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }

    return {
      attempts: this.config.maxRetries + 1,
      elapsedTime: Date.now() - startTime,
      success: false,
      error: this.normalizeError(lastError),
      history
    };
  }

  /**
   * Calculate jittered delay based on strategy
   * @param attempt
  . */
  private calculateJitteredDelay(attempt: number): number {
    const baseDelay = this.calculateBaseDelay(attempt);
    
    switch (this.config.jitterStrategy) {
      case 'none':
        return baseDelay;
      
      case 'full':
        return this.applyFullJitter(baseDelay);
      
      case 'equal':
        return this.applyEqualJitter(baseDelay);
      
      case 'decorrelated':
        return this.applyDecorrelatedJitter(baseDelay, attempt);
      
      case 'exponential':
        return this.applyExponentialJitter(baseDelay, attempt);
      
      default:
        return this.applyFullJitter(baseDelay);
    }
  }

  /**
   * Calculate base delay before jitter
   * @param attempt
  . */
  private calculateBaseDelay(attempt: number): number {
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
        delay = this.config.baseDelay * Math.pow(2, attempt);
    }

    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Full jitter: random delay between 0 and base delay
   * @param baseDelay
  . */
  private applyFullJitter(baseDelay: number): number {
    return Math.random() * baseDelay * this.config.jitterMultiplier;
  }

  /**
   * Equal jitter: base delay / 2 + random(0, base delay / 2)
   * @param baseDelay
  . */
  private applyEqualJitter(baseDelay: number): number {
    const half = baseDelay / 2;
    return half + (Math.random() * half * this.config.jitterMultiplier);
  }

  /**
   * Decorrelated jitter: maintains correlation with previous delays
   * @param baseDelay
   * @param _attempt
  . */
  private applyDecorrelatedJitter(baseDelay: number, _attempt: number): number {
    const {correlationId} = this.config;
    const previousDelay = this.correlationState.get(correlationId) || baseDelay;
    
    // Decorrelated jitter formula: min(cap, random_between(base, previous_delay * 3))
    const min = this.config.baseDelay;
    const max = Math.min(this.config.maxDelay, previousDelay * 3);
    const jitteredDelay = min + Math.random() * (max - min) * this.config.jitterMultiplier;
    
    this.correlationState.set(correlationId, jitteredDelay);
    return jitteredDelay;
  }

  /**
   * Exponential jitter: exponential backoff with randomization
   * @param _baseDelay
   * @param attempt
  . */
  private applyExponentialJitter(_baseDelay: number, attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt);
    const jitterRange = exponentialDelay * 0.1; // 10% jitter
    const jitter = (Math.random() * jitterRange * 2 - jitterRange) * this.config.jitterMultiplier;
    
    return Math.min(exponentialDelay + jitter, this.config.maxDelay);
  }

  /**
   * Sleep with abort signal support
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
      operationName: context?.operationName || 'jitter-retry',
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
    return `jr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate correlation ID
  . */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
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
    if (this.config.jitterMultiplier < 0) {
      throw new Error('jitterMultiplier must be non-negative');
    }
  }

  /**
   * Get current configuration
  . */
  getConfig(): Required<JitterRetryConfig> {
    return { ...this.config };
  }

  /**
   * Create new instance with updated configuration
   * @param newConfig
  . */
  withConfig(newConfig: Partial<JitterRetryConfig>): RetryWithJitter {
    return new RetryWithJitter({ ...this.config, ...newConfig });
  }

  /**
   * Reset correlation state
  . */
  resetCorrelationState(): void {
    this.correlationState.clear();
  }

  /**
   * Get correlation state for debugging
  . */
  getCorrelationState(): Map<string, number> {
    return new Map(this.correlationState);
  }
}

/**
 * Simple retry with jitter function
 * @param operation
 * @param config
. */
export async function retryWithJitter<T>(
  operation: () => Promise<T>,
  config: Partial<JitterRetryConfig> = {}
): Promise<T> {
  const retry = new RetryWithJitter(config);
  const result = await retry.execute(operation);
  
  if (result.success && result.result !== undefined) {
    return result.result;
  }
  
  throw result.error || new Error('Operation failed after all retries');
}

/**
 * Pre-configured jitter strategies
. */
export const jitterStrategies = {
  /**
   * AWS recommended full jitter
   * @param config
  . */
  awsFullJitter: (config?: Partial<JitterRetryConfig>) => new RetryWithJitter({
    maxRetries: 3,
    baseDelay: 1000,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 20000,
    jitterStrategy: 'full',
    jitterMultiplier: 1.0,
    ...config
  }),

  /**
   * Google Cloud recommended equal jitter
   * @param config
  . */
  gcpEqualJitter: (config?: Partial<JitterRetryConfig>) => new RetryWithJitter({
    maxRetries: 4,
    baseDelay: 1000,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 32000,
    jitterStrategy: 'equal',
    jitterMultiplier: 1.0,
    ...config
  }),

  /**
   * Decorrelated jitter for distributed systems
   * @param config
  . */
  decorrelated: (config?: Partial<JitterRetryConfig>) => new RetryWithJitter({
    maxRetries: 5,
    baseDelay: 500,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 30000,
    jitterStrategy: 'decorrelated',
    jitterMultiplier: 1.0,
    ...config
  }),

  /**
   * Trading-specific jitter for market operations
   * @param config
  . */
  trading: (config?: Partial<JitterRetryConfig>) => new RetryWithJitter({
    maxRetries: 2,
    baseDelay: 100,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 2000,
    jitterStrategy: 'equal',
    jitterMultiplier: 0.5,
    retryCondition: (error: any) => {
      return error?.code === 'NETWORK_ERROR' ||
             error?.status >= 500 ||
             error?.code === 'RATE_LIMITED';
    },
    ...config
  }),

  /**
   * High-frequency operations with minimal jitter
   * @param config
  . */
  highFrequency: (config?: Partial<JitterRetryConfig>) => new RetryWithJitter({
    maxRetries: 1,
    baseDelay: 50,
    strategy: 'fixed' as RetryStrategy,
    maxDelay: 200,
    jitterStrategy: 'equal',
    jitterMultiplier: 0.2,
    ...config
  }),

  /**
   * Robust retry with decorrelated jitter for critical operations
   * @param config
  . */
  robust: (config?: Partial<JitterRetryConfig>) => new RetryWithJitter({
    maxRetries: 7,
    baseDelay: 1000,
    strategy: 'exponential' as RetryStrategy,
    maxDelay: 60000,
    jitterStrategy: 'decorrelated',
    jitterMultiplier: 1.5,
    ...config
  })
};

/**
 * Jitter utility functions
. */
export const jitterUtils = {
  RetryWithJitter,
  retryWithJitter,
  jitterStrategies,
  
  /**
   * Calculate jitter for given parameters
   * @param baseDelay
   * @param strategy
   * @param multiplier
  . */
  calculateJitter: (
    baseDelay: number,
    strategy: JitterStrategy = 'full',
    multiplier: number = 1.0
  ): number => {
    switch (strategy) {
      case 'none':
        return baseDelay;
      case 'full':
        return Math.random() * baseDelay * multiplier;
      case 'equal': {
        const half = baseDelay / 2;
        return half + (Math.random() * half * multiplier);
      }
      case 'exponential': {
        const jitterRange = baseDelay * 0.1;
        return baseDelay + (Math.random() * jitterRange * 2 - jitterRange) * multiplier;
      }
      case 'decorrelated': {
        // Simplified decorrelated jitter without state
        const min = baseDelay * 0.5;
        const max = baseDelay * 2;
        return min + Math.random() * (max - min) * multiplier;
      }
      default:
        return Math.random() * baseDelay * multiplier;
    }
  },
  
  /**
   * Test jitter distribution for given strategy
   * @param baseDelay
   * @param strategy
   * @param samples
   * @param multiplier
  . */
  testJitterDistribution: (
    baseDelay: number,
    strategy: JitterStrategy,
    samples: number = 1000,
    multiplier: number = 1.0
  ): { min: number; max: number; avg: number; values: number[] } => {
    const values: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      const jitteredDelay = jitterUtils.calculateJitter(baseDelay, strategy, multiplier);
      values.push(jitteredDelay);
    }
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      values
    };
  },

  /**
   * Compare jitter strategies
   * @param baseDelay
   * @param strategies
   * @param samples
  . */
  compareStrategies: (
    baseDelay: number,
    strategies: JitterStrategy[] = ['none', 'full', 'equal', 'decorrelated', 'exponential'],
    samples: number = 1000
  ): Record<JitterStrategy, { min: number; max: number; avg: number; variance: number }> => {
    const results: any = {};
    
    strategies.forEach(strategy => {
      const distribution = jitterUtils.testJitterDistribution(baseDelay, strategy, samples);
      const variance = distribution.values.reduce((sum, val) => {
        return sum + Math.pow(val - distribution.avg, 2);
      }, 0) / distribution.values.length;
      
      results[strategy] = {
        min: distribution.min,
        max: distribution.max,
        avg: distribution.avg,
        variance
      };
    });
    
    return results;
  },

  /**
   * Recommend jitter strategy based on use case
   * @param useCase
  . */
  recommendStrategy: (useCase: 'api' | 'database' | 'trading' | 'distributed' | 'high-frequency'): JitterStrategy => {
    switch (useCase) {
      case 'api':
        return 'full';
      case 'database':
        return 'equal';
      case 'trading':
        return 'equal';
      case 'distributed':
        return 'decorrelated';
      case 'high-frequency':
        return 'exponential';
      default:
        return 'full';
    }
  }
};
