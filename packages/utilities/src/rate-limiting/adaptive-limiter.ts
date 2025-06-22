/**
 * @file Adaptive rate limiter
 * @package @trading-bot/utilities
 * 
 * Production-grade adaptive rate limiter that dynamically adjusts limits
 * based on system performance, error rates, latency, and load conditions.
. */

import type { RateLimitResult, AdaptiveLimiterConfig, RequestMetrics, AdaptiveMetrics, RateLimiterState } from '../../../types/src/utilities/rate-limiting';

/**
 * Adaptive rate limiter with dynamic limit adjustment
. */
export class AdaptiveLimiter {
  private readonly config: Required<AdaptiveLimiterConfig>;
  private currentLimit: number;
  private requests: RequestMetrics[];
  private requestCount: number;
  private lastAdjustment: number;
  private consecutiveAdjustments: number;
  private adjustmentDirection: 'up' | 'down' | 'stable';
  private readonly keyLimits: Map<string, { count: number; resetTime: number }>;

  /**
   *
   * @param config
  . */
  constructor(config: AdaptiveLimiterConfig) {
    // Input validation
    this.validateConfig(config);

    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      strategy: config.strategy ?? 'sliding-window',
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
      keyGenerator: config.keyGenerator ?? (() => 'default'),
      targetSuccessRate: config.targetSuccessRate,
      targetLatency: config.targetLatency,
      adjustmentFactor: config.adjustmentFactor ?? 0.1,
      minLimit: config.minLimit ?? Math.floor(config.maxRequests * 0.1),
      maxLimit: config.maxLimit ?? config.maxRequests * 2,
      measurementWindow: config.measurementWindow ?? 60000,
      minSamples: config.minSamples ?? 10
    };

    this.currentLimit = config.maxRequests;
    this.requests = [];
    this.requestCount = 0;
    this.lastAdjustment = Date.now();
    this.consecutiveAdjustments = 0;
    this.adjustmentDirection = 'stable';
    this.keyLimits = new Map();
  }

  /**
   * Validate configuration parameters
   * @param config
  . */
  private validateConfig(config: AdaptiveLimiterConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('AdaptiveLimiterConfig is required and must be an object');
    }

    if (!Number.isInteger(config.maxRequests) || config.maxRequests <= 0) {
      throw new Error('maxRequests must be a positive integer');
    }

    if (!Number.isInteger(config.windowMs) || config.windowMs <= 0) {
      throw new Error('windowMs must be a positive integer');
    }

    if (config.targetSuccessRate < 0 || config.targetSuccessRate > 1) {
      throw new Error('targetSuccessRate must be between 0 and 1');
    }

    if (!Number.isInteger(config.targetLatency) || config.targetLatency <= 0) {
      throw new Error('targetLatency must be a positive integer');
    }

    if (config.adjustmentFactor !== undefined && (config.adjustmentFactor <= 0 || config.adjustmentFactor > 1)) {
      throw new Error('adjustmentFactor must be between 0 and 1');
    }

    if (config.minLimit !== undefined && (!Number.isInteger(config.minLimit) || config.minLimit <= 0)) {
      throw new Error('minLimit must be a positive integer');
    }

    if (config.maxLimit !== undefined && (!Number.isInteger(config.maxLimit) || config.maxLimit <= 0)) {
      throw new Error('maxLimit must be a positive integer');
    }

    if (config.minLimit !== undefined && config.maxLimit !== undefined && config.minLimit > config.maxLimit) {
      throw new Error('minLimit cannot be greater than maxLimit');
    }

    if (config.measurementWindow !== undefined && (!Number.isInteger(config.measurementWindow) || config.measurementWindow <= 0)) {
      throw new Error('measurementWindow must be a positive integer');
    }

    if (config.minSamples !== undefined && (!Number.isInteger(config.minSamples) || config.minSamples <= 0)) {
      throw new Error('minSamples must be a positive integer');
    }
  }

  /**
   * Attempt to consume request quota with adaptive adjustment
   * @param key
  . */
  consume(key?: string): RateLimitResult {
    try {
      const now = Date.now();
      const rateLimitKey = key || this.config.keyGenerator({});
      
      this.cleanOldRequests(now);
      
      // Check per-key limits if key is provided
      if (rateLimitKey !== 'default') {
        const keyLimit = this.keyLimits.get(rateLimitKey);
        if (keyLimit && keyLimit.count >= this.currentLimit && now < keyLimit.resetTime) {
          return {
            allowed: false,
            remaining: 0,
            resetTime: keyLimit.resetTime - now,
            limit: this.currentLimit,
            retryAfter: keyLimit.resetTime - now
          };
        }
      }
      
      // Check if request is allowed under current limit
      const currentRequests = this.getCurrentRequestCount(now);
      const allowed = currentRequests < this.currentLimit;
      
      if (allowed) {
        this.requestCount++;
        
        // Update per-key tracking
        if (rateLimitKey !== 'default') {
          const keyLimit = this.keyLimits.get(rateLimitKey) || { count: 0, resetTime: now + this.config.windowMs };
          keyLimit.count++;
          if (now >= keyLimit.resetTime) {
            keyLimit.count = 1;
            keyLimit.resetTime = now + this.config.windowMs;
          }
          this.keyLimits.set(rateLimitKey, keyLimit);
        }
      }

      // Trigger adaptive adjustment if enough time has passed
      if (now - this.lastAdjustment >= this.config.measurementWindow) {
        this.adjustLimit(now);
      }

      return {
        allowed,
        remaining: Math.max(0, this.currentLimit - currentRequests - (allowed ? 1 : 0)),
        resetTime: this.getResetTime(now),
        limit: this.currentLimit,
        retryAfter: allowed ? 0 : this.getRetryAfter(now)
      };
    } catch (error) {
      // Fail open with conservative limits on error
      return {
        allowed: this.requestCount < Math.floor(this.config.maxRequests * 0.1),
        remaining: 0,
        resetTime: this.config.windowMs,
        limit: this.currentLimit,
        retryAfter: this.config.windowMs
      };
    }
  }

  /**
   * Record request completion for adaptive learning
   * @param success
   * @param latency
   * @param errorType
   * @param statusCode
  . */
  recordRequest(success: boolean, latency: number, errorType?: string, statusCode?: number): void {
    if (typeof success !== 'boolean') {
      throw new Error('success must be a boolean');
    }
    if (!Number.isFinite(latency) || latency < 0) {
      throw new Error('latency must be a non-negative number');
    }
    if (statusCode !== undefined && (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599)) {
      throw new Error('statusCode must be a valid HTTP status code (100-599)');
    }

    const now = Date.now();
    
    const requestMetrics: RequestMetrics = {
      timestamp: now,
      success,
      latency,
      errorType: errorType || ''
    };

    if (statusCode !== undefined) {
      requestMetrics.statusCode = statusCode;
    }

    this.requests.push(requestMetrics);

    // Keep only recent requests to prevent memory leaks
    this.cleanOldRequests(now);
  }

  /**
   * Adjust rate limit based on system performance
   * @param timestamp
  . */
  private adjustLimit(timestamp: number): void {
    const metrics = this.calculateMetrics(timestamp);
    
    if (metrics.sampleCount < this.config.minSamples) {
      return; // Not enough data for adjustment
    }

    const shouldIncrease = this.shouldIncreaseLimit(metrics);
    const shouldDecrease = this.shouldDecreaseLimit(metrics);
    
    let adjustment = 0;
    let newDirection: 'up' | 'down' | 'stable' = 'stable';

    if (shouldIncrease && !shouldDecrease) {
      adjustment = this.calculateIncreaseAmount(metrics);
      newDirection = 'up';
    } else if (shouldDecrease && !shouldIncrease) {
      adjustment = -this.calculateDecreaseAmount(metrics);
      newDirection = 'down';
    }

    if (adjustment !== 0) {
      this.applyAdjustment(adjustment, newDirection);
    }

    this.lastAdjustment = timestamp;
  }

  /**
   * Calculate performance metrics
   * @param timestamp
  . */
  private calculateMetrics(timestamp: number): AdaptiveMetrics {
    const recentRequests = this.requests.filter(
      req => timestamp - req.timestamp <= this.config.measurementWindow
    );

    if (recentRequests.length === 0) {
      return {
        successRate: 1,
        averageLatency: 0,
        errorRate: 0,
        sampleCount: 0,
        latencyTrend: 'stable',
        errorTypes: {}
      };
    }

    const successCount = recentRequests.filter(req => req.success).length;
    const successRate = successCount / recentRequests.length;
    const averageLatency = recentRequests.reduce((sum, req) => sum + req.latency, 0) / recentRequests.length;
    const errorRate = 1 - successRate;

    // Calculate latency trend with proper bounds checking
    const midpoint = Math.floor(recentRequests.length / 2);
    const firstHalf = recentRequests.slice(0, midpoint);
    const secondHalf = recentRequests.slice(midpoint);
    
    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return {
        successRate,
        averageLatency,
        errorRate,
        sampleCount: recentRequests.length,
        latencyTrend: 'stable',
        errorTypes: {}
      };
    }

    const firstHalfLatency = firstHalf.reduce((sum, req) => sum + req.latency, 0) / firstHalf.length;
    const secondHalfLatency = secondHalf.reduce((sum, req) => sum + req.latency, 0) / secondHalf.length;
    
    const latencyDiff = secondHalfLatency - firstHalfLatency;
    const latencyTrend = Math.abs(latencyDiff) < 50 ? 'stable' :
                        latencyDiff > 0 ? 'increasing' : 'decreasing';

    // Count error types with validation
    const errorTypes: Record<string, number> = {};
    recentRequests.forEach(req => {
      if (!req.success && req.errorType && req.errorType.length > 0) {
        errorTypes[req.errorType] = (errorTypes[req.errorType] || 0) + 1;
      }
    });

    return {
      successRate,
      averageLatency,
      errorRate,
      sampleCount: recentRequests.length,
      latencyTrend,
      errorTypes
    };
  }

  /**
   * Determine if limit should be increased
   * @param metrics
  . */
  private shouldIncreaseLimit(metrics: AdaptiveMetrics): boolean {
    return (
      metrics.successRate >= this.config.targetSuccessRate &&
      metrics.averageLatency <= this.config.targetLatency &&
      metrics.latencyTrend !== 'increasing' &&
      this.currentLimit < this.config.maxLimit
    );
  }

  /**
   * Determine if limit should be decreased
   * @param metrics
  . */
  private shouldDecreaseLimit(metrics: AdaptiveMetrics): boolean {
    return (
      metrics.successRate < this.config.targetSuccessRate ||
      metrics.averageLatency > this.config.targetLatency * 1.5 ||
      metrics.latencyTrend === 'increasing' ||
      metrics.errorRate > 0.1
    ) && this.currentLimit > this.config.minLimit;
  }

  /**
   * Calculate amount to increase limit
   * @param metrics
  . */
  private calculateIncreaseAmount(metrics: AdaptiveMetrics): number {
    let factor = this.config.adjustmentFactor;
    
    // More aggressive increase if performing very well
    if (metrics.successRate > 0.98 && metrics.averageLatency < this.config.targetLatency * 0.5) {
      factor *= 2;
    }
    
    // Conservative increase if recently decreased
    if (this.adjustmentDirection === 'down') {
      factor *= 0.5;
    }
    
    return Math.ceil(this.currentLimit * factor);
  }

  /**
   * Calculate amount to decrease limit
   * @param metrics
  . */
  private calculateDecreaseAmount(metrics: AdaptiveMetrics): number {
    let factor = this.config.adjustmentFactor;
    
    // More aggressive decrease if performing poorly
    if (metrics.successRate < 0.8 || metrics.averageLatency > this.config.targetLatency * 2) {
      factor *= 2;
    }
    
    // Even more aggressive if many consecutive adjustments down
    if (this.adjustmentDirection === 'down' && this.consecutiveAdjustments > 3) {
      factor *= 1.5;
    }
    
    return Math.ceil(this.currentLimit * factor);
  }

  /**
   * Apply limit adjustment with bounds checking
   * @param adjustment
   * @param direction
  . */
  private applyAdjustment(adjustment: number, direction: 'up' | 'down' | 'stable'): void {
    const newLimit = Math.max(
      this.config.minLimit,
      Math.min(this.config.maxLimit, this.currentLimit + adjustment)
    );

    if (newLimit !== this.currentLimit) {
      this.currentLimit = newLimit;
      
      if (direction === this.adjustmentDirection) {
        this.consecutiveAdjustments++;
      } else {
        this.consecutiveAdjustments = 1;
        this.adjustmentDirection = direction;
      }
    }
  }

  /**
   * Get current request count in window
   * @param timestamp
  . */
  private getCurrentRequestCount(timestamp: number): number {
    return this.requests.filter(
      req => timestamp - req.timestamp <= this.config.windowMs
    ).length;
  }

  /**
   * Clean old requests outside measurement window to prevent memory leaks
   * @param timestamp
  . */
  private cleanOldRequests(timestamp: number): void {
    const cutoff = timestamp - Math.max(this.config.windowMs, this.config.measurementWindow);
    const initialLength = this.requests.length;
    this.requests = this.requests.filter(req => req.timestamp > cutoff);
    
    // Track cleanup efficiency for performance monitoring
    const cleanedCount = initialLength - this.requests.length;
    if (cleanedCount > 0 && initialLength > 1000) {
      // Log significant cleanup events for monitoring
      console.debug(`AdaptiveLimiter: Cleaned ${cleanedCount}/${initialLength} old requests (${Math.round((cleanedCount / initialLength) * 100)}% reduction)`);
    }
    
    // Clean expired key limits
    const initialKeyCount = this.keyLimits.size;
    for (const [key, limit] of Array.from(this.keyLimits.entries())) {
      if (timestamp >= limit.resetTime) {
        this.keyLimits.delete(key);
      }
    }
    
    // Track key cleanup for monitoring
    const cleanedKeys = initialKeyCount - this.keyLimits.size;
    if (cleanedKeys > 0 && initialKeyCount > 100) {
      console.debug(`AdaptiveLimiter: Cleaned ${cleanedKeys}/${initialKeyCount} expired key limits`);
    }
  }

  /**
   * Get time until window resets
   * @param timestamp
  . */
  private getResetTime(timestamp: number): number {
    const oldestRequest = this.requests[0];
    if (!oldestRequest) return 0;
    
    return Math.max(0, (oldestRequest.timestamp + this.config.windowMs) - timestamp);
  }

  /**
   * Get retry after time with proper calculation
   * @param timestamp
  . */
  private getRetryAfter(timestamp: number): number {
    const oldestRequest = this.requests[0];
    if (!oldestRequest) {
      return Math.ceil(this.config.windowMs / this.currentLimit);
    }
    
    // Calculate time until oldest request expires
    const timeUntilOldestExpires = (oldestRequest.timestamp + this.config.windowMs) - timestamp;
    const averageRetryTime = Math.ceil(this.config.windowMs / this.currentLimit);
    
    return Math.max(0, Math.min(timeUntilOldestExpires, averageRetryTime));
  }

  /**
   * Get current limiter state with proper typing
  . */
  getState(): RateLimiterState {
    const now = Date.now();
    const metrics = this.calculateMetrics(now);
    const currentRequests = this.getCurrentRequestCount(now);
    
    return {
      currentLimit: this.currentLimit,
      originalLimit: this.config.maxRequests,
      minLimit: this.config.minLimit,
      maxLimit: this.config.maxLimit,
      utilizationPercent: (currentRequests / this.currentLimit) * 100,
      adjustmentDirection: this.adjustmentDirection,
      consecutiveAdjustments: this.consecutiveAdjustments,
      recentMetrics: metrics
    };
  }

  /**
   * Reset limiter state with memory cleanup
  . */
  reset(): void {
    this.currentLimit = this.config.maxRequests;
    this.requests = [];
    this.requestCount = 0;
    this.lastAdjustment = Date.now();
    this.consecutiveAdjustments = 0;
    this.adjustmentDirection = 'stable';
    this.keyLimits.clear();
  }
}

/**
 * Create adaptive rate limiter
 * @param config
. */
export function createAdaptiveLimiter(config: AdaptiveLimiterConfig): AdaptiveLimiter {
  return new AdaptiveLimiter(config);
}

/**
 * Adaptive limiter utilities
. */
export const adaptiveLimiterUtils = {
  createAdaptiveLimiter,
  
  // Common configurations
  configs: {
    conservative: {
      maxRequests: 100,
      windowMs: 60000,
      targetSuccessRate: 0.98,
      targetLatency: 500,
      adjustmentFactor: 0.05
    },
    balanced: {
      maxRequests: 100,
      windowMs: 60000,
      targetSuccessRate: 0.95,
      targetLatency: 1000,
      adjustmentFactor: 0.1
    },
    aggressive: {
      maxRequests: 100,
      windowMs: 60000,
      targetSuccessRate: 0.90,
      targetLatency: 2000,
      adjustmentFactor: 0.2
    },
    trading: {
      maxRequests: 50,
      windowMs: 60000,
      targetSuccessRate: 0.99,
      targetLatency: 200,
      adjustmentFactor: 0.05,
      minLimit: 5,
      maxLimit: 200
    }
  }
};
