/**
 * @file Token bucket rate limiter
 * @package @trading-bot/utilities
 * 
 * Production-grade token bucket implementation with leak detection,
 * burst capacity, high-precision timing, and comprehensive validation.
. *////

import type { TokenBucketConfig, RateLimitResult, TokenBucketState } from '../../../types/src/utilities/rate-limiting';

/**
 * Token bucket rate limiter with production-grade features
. *////
export class TokenBucket {
  private readonly capacity: number;
  private tokens: number;
  private readonly refillRate: number;
  private lastRefill: number;
  private readonly maxBurst: number;

  /**
   *
   * @param config
  . *////
  constructor(config: TokenBucketConfig) {
    this.validateConfig(config);

    this.capacity = config.capacity;
    this.tokens = config.initialTokens ?? config.capacity;
    this.refillRate = config.refillRate;
    this.lastRefill = Date.now();
    this.maxBurst = config.maxBurst ?? config.capacity;

    // Ensure initial tokens don't exceed capacity or burst
    this.tokens = Math.min(this.tokens, this.capacity, this.maxBurst);
  }

  /**
   * Validate token bucket configuration
   * @param config
  . *////
  private validateConfig(config: TokenBucketConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('TokenBucketConfig is required and must be an object');
    }

    if (!Number.isInteger(config.capacity) || config.capacity <= 0) {
      throw new Error('capacity must be a positive integer');
    }

    if (!Number.isFinite(config.refillRate) || config.refillRate <= 0) {
      throw new Error('refillRate must be a positive number');
    }

    if (config.initialTokens !== undefined && (!Number.isInteger(config.initialTokens) || config.initialTokens < 0)) {
      throw new Error('initialTokens must be a non-negative integer');
    }

    if (config.maxBurst !== undefined && (!Number.isInteger(config.maxBurst) || config.maxBurst <= 0)) {
      throw new Error('maxBurst must be a positive integer');
    }

    if (config.initialTokens !== undefined && config.initialTokens > config.capacity) {
      throw new Error('initialTokens cannot exceed capacity');
    }

    if (config.maxBurst !== undefined && config.maxBurst > config.capacity) {
      throw new Error('maxBurst cannot exceed capacity');
    }
  }

  /**
   * Attempt to consume tokens with comprehensive validation
   * @param tokens
  . *////
  consume(tokens: number = 1): RateLimitResult {
    try {
      // Input validation
      if (!Number.isInteger(tokens) || tokens <= 0) {
        throw new Error('tokens must be a positive integer');
      }

      if (tokens > this.capacity) {
        throw new Error('requested tokens cannot exceed bucket capacity');
      }

      this.refill();
      
      // Check if request exceeds burst capacity
      if (tokens > this.maxBurst) {
        return {
          allowed: false,
          remaining: Math.floor(this.tokens),
          resetTime: this.getResetTime(),
          limit: this.capacity,
          retryAfter: this.getRetryAfter(tokens)
        };
      }
      
      const canConsume = this.tokens >= tokens;
      
      if (canConsume) {
        this.tokens -= tokens;
        // Ensure tokens never go negative due to floating point precision
        this.tokens = Math.max(0, this.tokens);
      }

      return {
        allowed: canConsume,
        remaining: Math.floor(this.tokens),
        resetTime: this.getResetTime(),
        limit: this.capacity,
        retryAfter: canConsume ? 0 : this.getRetryAfter(tokens)
      };
    } catch (error) {
      // Fail closed on errors - deny the request
      return {
        allowed: false,
        remaining: 0,
        resetTime: this.getResetTime(),
        limit: this.capacity,
        retryAfter: Math.ceil(this.capacity / this.refillRate) * 1000
      };
    }
  }

  /**
   * Refill tokens based on elapsed time with precision safeguards
  . *////
  private refill(): void {
    const now = Date.now();
    const elapsed = Math.max(0, (now - this.lastRefill) / 1000); // Convert to seconds, ensure non-negative
    
    if (elapsed > 0) {
      const tokensToAdd = elapsed * this.refillRate;
      
      // Apply burst limit during refill with precision safeguards
      const newTokenCount = this.tokens + tokensToAdd;
      this.tokens = Math.min(Math.min(this.capacity, newTokenCount), this.maxBurst);
      
      // Ensure tokens stay within bounds
      this.tokens = Math.max(0, Math.min(this.tokens, this.capacity));
      
      this.lastRefill = now;
    }
  }

  /**
   * Get time until bucket is reset (full) with precision handling
  . */
  private getResetTime(): number {
    if (this.tokens >= this.capacity) {
      return 0;
    }
    
    const tokensNeeded = this.capacity - this.tokens;
    const timeToFull = (tokensNeeded / this.refillRate) * 1000; // Convert to ms
    
    return Math.max(0, Math.ceil(timeToFull));
  }

  /**
   * Get retry after time for specific token count with bounds checking
   * @param tokens
  . */
  private getRetryAfter(tokens: number): number {
    const tokensNeeded = Math.max(0, tokens - this.tokens);
    if (tokensNeeded <= 0) {
      return 0;
    }
    
    const timeToWait = (tokensNeeded / this.refillRate) * 1000; // Convert to ms
    const maxWaitTime = (this.capacity / this.refillRate) * 1000; // Maximum possible wait
    
    return Math.max(0, Math.min(Math.ceil(timeToWait), maxWaitTime));
  }

  /**
   * Get current bucket state with comprehensive information
  . */
  getState(): TokenBucketState {
    this.refill();
    
    return {
      tokens: Math.floor(this.tokens * 100) / 100, // Round to 2 decimal places
      capacity: this.capacity,
      refillRate: this.refillRate,
      utilizationPercent: Math.round(((this.capacity - this.tokens) / this.capacity) * 100 * 100) / 100
    };
  }

  /**
   * Reset bucket to initial state with validation
  . */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Check if bucket can accommodate tokens without consuming
   * @param tokens
  . */
  canConsume(tokens: number = 1): boolean {
    if (!Number.isInteger(tokens) || tokens <= 0) {
      return false;
    }

    this.refill();
    return this.tokens >= tokens && tokens <= this.maxBurst;
  }

  /**
   * Get available tokens count
  . */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Create token bucket rate limiter
 * @param config
. */
export function createTokenBucket(config: TokenBucketConfig): TokenBucket {
  return new TokenBucket(config);
}

/**
 * Token bucket utilities
. */
export const tokenBucketUtils = {
  createTokenBucket,
  
  // Common configurations
  configs: {
    strict: { capacity: 10, refillRate: 1, maxBurst: 10 },
    moderate: { capacity: 50, refillRate: 10, maxBurst: 20 },
    lenient: { capacity: 100, refillRate: 50, maxBurst: 50 },
    api: { capacity: 1000, refillRate: 100, maxBurst: 200 },
    trading: { capacity: 10, refillRate: 2, maxBurst: 5 }
  }
};
