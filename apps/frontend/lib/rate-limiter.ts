import { NextRequest } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private defaultLimit: number;
  private defaultWindow: number;

  constructor(defaultLimit: number = 100, defaultWindow: number = 15 * 60 * 1000) {
    this.defaultLimit = defaultLimit;
    this.defaultWindow = defaultWindow;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  async check(
    request: NextRequest,
    limit: number = this.defaultLimit,
    window: number = this.defaultWindow
  ): Promise<{
    success: boolean;
    remaining: number;
    resetTime: number;
    error?: string;
  }> {
    const identifier = this.getIdentifier(request);
    const now = Date.now();
    const key = `${identifier}:${Math.floor(now / window)}`;

    // Get or create rate limit entry
    if (!this.store[key]) {
      this.store[key] = {
        count: 0,
        resetTime: now + window
      };
    }

    const entry = this.store[key];

    // Check if limit exceeded
    if (entry.count >= limit) {
      return {
        success: false,
        remaining: 0,
        resetTime: entry.resetTime,
        error: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetTime - now) / 1000)} seconds.`
      };
    }

    // Increment counter
    entry.count++;

    return {
      success: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime
    };
  }

  private getIdentifier(request: NextRequest): string {
    // Try to get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id');
    if (userId) {
      return `user:${userId}`;
    }

    // Fall back to IP address from headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
    return `ip:${ip}`;
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  // Get current status for a request
  getStatus(request: NextRequest): {
    count: number;
    remaining: number;
    resetTime: number;
  } {
    const identifier = this.getIdentifier(request);
    const now = Date.now();
    const key = `${identifier}:${Math.floor(now / this.defaultWindow)}`;
    
    const entry = this.store[key];
    if (!entry) {
      return {
        count: 0,
        remaining: this.defaultLimit,
        resetTime: now + this.defaultWindow
      };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, this.defaultLimit - entry.count),
      resetTime: entry.resetTime
    };
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Rate limiting middleware
export function withRateLimit(
  limit: number = 100,
  window: number = 15 * 60 * 1000 // 15 minutes
) {
  return async (request: NextRequest) => {
    const result = await rateLimiter.check(request, limit, window);
    
    return {
      ...result,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
      }
    };
  };
}

// Different rate limits for different endpoint types
export const authRateLimit = withRateLimit(5, 15 * 60 * 1000); // 5 requests per 15 minutes
export const apiRateLimit = withRateLimit(100, 15 * 60 * 1000); // 100 requests per 15 minutes
export const tradingRateLimit = withRateLimit(50, 60 * 1000); // 50 requests per minute