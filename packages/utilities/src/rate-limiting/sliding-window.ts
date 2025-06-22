/**
 * @file Sliding window rate limiter
 * @package @trading-bot/utilities
 * 
 * Production-grade sliding window implementation with sub-window precision,
 * memory-efficient tracking, accurate rate limiting, and comprehensive validation.
. *///

import type { SlidingWindowConfig, RateLimitResult, SlidingWindowState } from '../../../types/src/utilities/rate-limiting';

/**
 * Sliding window rate limiter with sub-window precision and production-grade features
. *///
export class SlidingWindow {
  private readonly windowSize: number;
  private readonly maxRequests: number;
  private readonly precision: number;
  private readonly subWindowSize: number;
  private readonly windows: Map<number, number>;
  private totalRequests: number;
  private lastCleanup: number;

  /**
   *
   * @param config
  . *///
  constructor(config: SlidingWindowConfig) {
    this.validateConfig(config);

    this.windowSize = config.windowSize;
    this.maxRequests = config.maxRequests;
    this.precision = config.precision ?? 10;
    this.subWindowSize = this.windowSize / this.precision;
    this.windows = new Map();
    this.totalRequests = 0;
    this.lastCleanup = Date.now();
  }

  /**
   * Validate sliding window configuration
   * @param config
  . *///
  private validateConfig(config: SlidingWindowConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('SlidingWindowConfig is required and must be an object');
    }

    if (!Number.isInteger(config.windowSize) || config.windowSize <= 0) {
      throw new Error('windowSize must be a positive integer');
    }

    if (!Number.isInteger(config.maxRequests) || config.maxRequests <= 0) {
      throw new Error('maxRequests must be a positive integer');
    }

    if (config.precision !== undefined && (!Number.isInteger(config.precision) || config.precision <= 0 || config.precision > 1000)) {
      throw new Error('precision must be a positive integer between 1 and 1000');
    }

    // Ensure sub-window size is reasonable
    const precision = config.precision ?? 10;
    const subWindowSize = config.windowSize / precision;
    if (subWindowSize < 100) {
      throw new Error('sub-window size too small (minimum 100ms) - reduce precision or increase windowSize');
    }
  }

  /**
   * Attempt to consume request quota with comprehensive validation
   * @param requests
  . *///
  consume(requests: number = 1): RateLimitResult {
    try {
      // Input validation
      if (!Number.isInteger(requests) || requests <= 0) {
        throw new Error('requests must be a positive integer');
      }

      if (requests > this.maxRequests) {
        throw new Error('requested amount cannot exceed maximum requests per window');
      }

      const now = Date.now();
      
      // Periodic cleanup to prevent memory leaks
      this.performPeriodicCleanup(now);
      
      // Clean expired windows
      this.cleanExpiredWindows(now);
      
      // Calculate current usage
      const currentUsage = this.getCurrentUsage(now);
      const canConsume = currentUsage + requests <= this.maxRequests;
      
      if (canConsume) {
        this.addRequests(now, requests);
      }

      return {
        allowed: canConsume,
        remaining: Math.max(0, this.maxRequests - currentUsage - (canConsume ? requests : 0)),
        resetTime: this.getResetTime(now),
        limit: this.maxRequests,
        retryAfter: canConsume ? 0 : this.getRetryAfter(now, requests)
      };
    } catch (error) {
      // Fail closed on errors - deny the request
      return {
        allowed: false,
        remaining: 0,
        resetTime: this.windowSize,
        limit: this.maxRequests,
        retryAfter: this.windowSize
      };
    }
  }

  /**
   * Add requests to current sub-window with validation
   * @param timestamp
   * @param requests
  . *///
  private addRequests(timestamp: number, requests: number): void {
    const windowKey = this.getWindowKey(timestamp);
    const current = this.windows.get(windowKey) || 0;
    
    // Prevent overflow
    const newValue = Math.min(current + requests, this.maxRequests);
    this.windows.set(windowKey, newValue);
    this.totalRequests += (newValue - current);
  }

  /**
   * Get current usage across sliding window with enhanced precision
   * @param timestamp
  . *///
  private getCurrentUsage(timestamp: number): number {
    let usage = 0;
    const currentWindow = this.getWindowKey(timestamp);
    const windowStart = currentWindow - this.precision + 1;

    for (let i = 0; i < this.precision; i++) {
      const windowKey = windowStart + i;
      const windowRequests = this.windows.get(windowKey) || 0;
      
      if (windowKey === currentWindow) {
        // For current window, apply time-based fraction
        const windowStartTime = windowKey * this.subWindowSize;
        const windowEndTime = windowStartTime + this.subWindowSize;
        const timeInWindow = Math.min(timestamp - windowStartTime, windowEndTime - windowStartTime);
        const fraction = Math.min(Math.max(0, timeInWindow / this.subWindowSize), 1);
        
        // Apply fraction to account for partial window usage
        usage += windowRequests * fraction;
      } else if (windowKey < currentWindow && windowKey >= windowStart) {
        // Full count for previous windows still in range
        usage += windowRequests;
      }
    }

    return Math.max(0, Math.floor(usage));
  }

  /**
   * Clean expired sub-windows with enhanced memory management
   * @param timestamp
  . *///
  private cleanExpiredWindows(timestamp: number): void {
    const currentWindow = this.getWindowKey(timestamp);
    const expiredBefore = currentWindow - this.precision + 1;
    
    for (const [windowKey, requests] of Array.from(this.windows.entries())) {
      if (windowKey < expiredBefore) {
        this.windows.delete(windowKey);
        this.totalRequests = Math.max(0, this.totalRequests - requests);
      }
    }
  }

  /**
   * Perform periodic cleanup to prevent memory leaks
   * @param timestamp
  . *///
  private performPeriodicCleanup(timestamp: number): void {
    // Clean up every 5 minutes
    if (timestamp - this.lastCleanup > 300000) {
      // Remove very old windows that might have been missed
      const cutoff = this.getWindowKey(timestamp - this.windowSize * 2);
      
      for (const [windowKey] of Array.from(this.windows.entries())) {
        if (windowKey < cutoff) {
          this.windows.delete(windowKey);
        }
      }
      
      // Recalculate total requests for consistency
      this.totalRequests = Array.from(this.windows.values()).reduce((sum, count) => sum + count, 0);
      this.lastCleanup = timestamp;
    }
  }

  /**
   * Get sub-window key for timestamp with bounds checking
   * @param timestamp
  . *///
  private getWindowKey(timestamp: number): number {
    if (timestamp < 0 || !Number.isFinite(timestamp)) {
      throw new Error('Invalid timestamp provided');
    }
    return Math.floor(timestamp / this.subWindowSize);
  }

  /**
   * Get time until window resets with precision handling
   * @param timestamp
  . *///
  private getResetTime(timestamp: number): number {
    const currentWindow = this.getWindowKey(timestamp);
    const oldestWindowInRange = currentWindow - this.precision + 1;
    const oldestWindowStartTime = oldestWindowInRange * this.subWindowSize;
    const resetTime = oldestWindowStartTime + this.windowSize;
    
    return Math.max(0, resetTime - timestamp);
  }

  /**
   * Get retry after time for specific request count with enhanced calculation
   * @param timestamp
   * @param requests
  . *///
  private getRetryAfter(timestamp: number, requests: number): number {
    // Find the earliest time when we can accommodate the requests
    let testTime = timestamp;
    const maxLookAhead = this.windowSize;
    const step = Math.max(this.subWindowSize / 10, 100); // Fine-grained search with minimum step
    
    for (let elapsed = step; elapsed < maxLookAhead; elapsed += step) {
      testTime = timestamp + elapsed;
      
      try {
        const usage = this.getCurrentUsage(testTime);
        
        if (usage + requests <= this.maxRequests) {
          return Math.ceil(elapsed);
        }
      } catch (error) {
        // Continue searching if calculation fails
        continue;
      }
    }
    
    // If no slot found, return full window reset time
    return Math.max(this.getResetTime(timestamp), this.windowSize / this.precision);
  }

  /**
   * Get current window state with comprehensive information
  . *///
  getState(): SlidingWindowState {
    const now = Date.now();
    this.cleanExpiredWindows(now);
    
    const currentUsage = this.getCurrentUsage(now);
    
    return {
      windowSize: this.windowSize,
      maxRequests: this.maxRequests,
      precision: this.precision,
      currentUsage,
      activeWindows: this.windows.size,
      utilizationPercent: Math.round((currentUsage / this.maxRequests) * 100 * 100) / 100
    };
  }

  /**
   * Reset all windows with memory cleanup
  . *///
  reset(): void {
    this.windows.clear();
    this.totalRequests = 0;
    this.lastCleanup = Date.now();
  }

  /**
   * Check if window can accommodate requests without consuming
   * @param requests
  . *///
  canConsume(requests: number = 1): boolean {
    if (!Number.isInteger(requests) || requests <= 0) {
      return false;
    }

    try {
      const now = Date.now();
      this.cleanExpiredWindows(now);
      const currentUsage = this.getCurrentUsage(now);
      return currentUsage + requests <= this.maxRequests;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current usage without modifying state
  . *///
  getCurrentUsageCount(): number {
    try {
      const now = Date.now();
      return this.getCurrentUsage(now);
    } catch (error) {
      return 0;
    }
  }
}

/**
 * Create sliding window rate limiter
 * @param config
. *///
export function createSlidingWindow(config: SlidingWindowConfig): SlidingWindow {
  return new SlidingWindow(config);
}

/**
 * Sliding window utilities
. *///
export const slidingWindowUtils = {
  createSlidingWindow,
  
  // Common configurations
  configs: {
    strict: { windowSize: 60000, maxRequests: 10, precision: 12 }, // 10 req/min
    moderate: { windowSize: 60000, maxRequests: 100, precision: 20 }, // 100 req/min
    lenient: { windowSize: 60000, maxRequests: 1000, precision: 30 }, // 1000 req/min
    api: { windowSize: 300000, maxRequests: 5000, precision: 50 }, // 5000 req/5min
    trading: { windowSize: 60000, maxRequests: 50, precision: 20 }, // 50 req/min
    burst: { windowSize: 10000, maxRequests: 20, precision: 10 } // 20 req/10sec
  },
  
  // Window size helpers
  windowSizes: {
    second: 1000,
    minute: 60000,
    hour: 3600000,
    day: 86400000
  }
};
