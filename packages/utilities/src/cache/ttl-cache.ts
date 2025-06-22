/**
 * @file Production-grade TTL-based cache with automatic expiration and enterprise features
 * @package @trading-bot/utilities
. */

import { EventEmitter } from 'events';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

import type {
  TTLCacheConfig,
  CachePerformanceMetrics,
  CacheEntryMetadata,
  CacheOptions,
  CacheEvent,
  CacheEventType,
  BatchCacheOperation,
  BatchCacheResult,
  CacheInvalidationOptions,
  CacheWarmingOptions,
  CacheKeyPattern,
  CacheHealthStatus
} from '../../../types/src/utilities/cache';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Enhanced TTL cache entry with comprehensive metadata
. */
interface TTLCacheEntry<T> {
  value: T | string | Buffer;
  metadata: CacheEntryMetadata;
  tags: Set<string>;
  compressed: boolean;
  serialized: boolean;
  timer: NodeJS.Timeout;
}

/**
 * TTL cache memory usage tracking
. */
interface TTLMemoryUsage {
  totalBytes: number;
  entryCount: number;
  averageSize: number;
  largestEntry: number;
  timerCount: number;
}

/**
 * Production-grade TTL cache with automatic expiration
. */
export class TTLCache<T = unknown> extends EventEmitter {
  private readonly cache = new Map<string, TTLCacheEntry<T>>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly expirationQueue = new Map<number, Set<string>>();
  private cleanupTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private memoryUsage: TTLMemoryUsage = {
    totalBytes: 0,
    entryCount: 0,
    averageSize: 0,
    largestEntry: 0,
    timerCount: 0
  };

  private readonly metrics: CachePerformanceMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
    hitRate: 0,
    lastUpdated: Date.now(),
    memoryUsage: 0,
    averageAccessTime: 0,
    hotKeys: [],
    evictions: 0,
    errors: 0
  };

  /**
   *
   * @param config
  . */
  constructor(private readonly config: TTLCacheConfig) {
    super();
    this.validateConfig();
    this.startCleanup();
    this.startMonitoring();
    this.emitEvent('connect');
  }

  /**
   * Get value from cache with TTL validation
   * @param key
   * @param options
   * @param options.updateAccess
  . */
  async get(key: string, options?: { updateAccess?: boolean }): Promise<T | undefined> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.metrics.misses++;
        this.updateMetrics();
        this.emitEvent('miss', { key });
        return undefined;
      }

      // Check if expired
      if (this.isExpired(entry)) {
        this.deleteEntry(key);
        this.metrics.misses++;
        this.updateMetrics();
        this.emitEvent('expire', { key });
        return undefined;
      }

      // Update access tracking if enabled
      if (options?.updateAccess !== false) {
        this.updateAccess(key, entry);
      }

      let value: T;

      // Handle compressed data
      if (entry.compressed && Buffer.isBuffer(entry.value)) {
        const decompressed = await gunzipAsync(entry.value);
        value = entry.serialized ? JSON.parse(decompressed.toString()) : decompressed.toString() as T;
      } else if (entry.serialized && typeof entry.value === 'string') {
        value = JSON.parse(entry.value);
      } else {
        value = entry.value as T;
      }

      this.metrics.hits++;
      this.trackAccessTime(Date.now() - startTime);
      this.updateMetrics();
      this.emitEvent('hit', { key, value });
      
      return value;
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { key, error });
      throw new Error(`TTL cache get failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set value in cache with comprehensive TTL management
   * @param key
   * @param value
   * @param options
  . */
  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Remove existing entry if present
      if (this.cache.has(key)) {
        this.deleteEntry(key);
      }

      // Check size limit and evict if necessary
      if (this.config.maxSize && this.cache.size >= this.config.maxSize) {
        await this.evictLRU();
      }

      const now = Date.now();
      const ttlMs = ((options?.ttl || this.config.defaultTtl) * 1000);
      const expiresAt = now + ttlMs;

      let processedValue: T | string | Buffer = value;
      let compressed = false;
      let serialized = false;

      // Serialize if needed
      if (typeof value === 'object' && value !== null) {
        processedValue = JSON.stringify(value);
        serialized = true;
      }

      // Compress if enabled and value is large enough
      if (options?.compress && typeof processedValue === 'string' && processedValue.length > 1024) {
        processedValue = await gzipAsync(Buffer.from(processedValue));
        compressed = true;
      }

      const metadata: CacheEntryMetadata = {
        createdAt: now,
        accessedAt: now,
        expiresAt,
        hits: 0,
        size: this.calculateSize(processedValue)
      };

      // Create expiration timer
      const timer = setTimeout(() => {
        this.deleteEntry(key);
        this.emitEvent('expire', { key });
      }, ttlMs);

      const entry: TTLCacheEntry<T> = {
        value: processedValue,
        metadata,
        tags: new Set(options?.tags || []),
        compressed,
        serialized,
        timer
      };

      // Update indexes
      this.updateTagIndex(key, entry.tags);
      this.updateExpirationQueue(key, expiresAt);

      this.cache.set(key, entry);
      this.updateMemoryUsage();

      this.metrics.sets++;
      this.trackAccessTime(Date.now() - startTime);
      this.updateMetrics();
      this.emitEvent('set', { key, value, options });
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { key, error });
      throw new Error(`TTL cache set failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete value from cache
   * @param key
  . */
  async delete(key: string): Promise<boolean> {
    try {
      const existed = this.cache.has(key);
      
      if (existed) {
        this.deleteEntry(key);
        this.metrics.deletes++;
        this.updateMetrics();
        this.emitEvent('delete', { key });
      }
      
      return existed;
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { key, error });
      throw new Error(`TTL cache delete failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch operations for high performance
   * @param operations
  . */
  async batch(operations: BatchCacheOperation<T>[]): Promise<BatchCacheResult<T>[]> {
    const results: BatchCacheResult<T>[] = [];
    
    for (const operation of operations) {
      try {
        let result: BatchCacheResult<T>;
        
        switch (operation.type) {
          case 'get': {
            const value = await this.get(operation.key);
            result = { key: operation.key, success: true, value: value as T };
            break;
          }
            
          case 'set': {
            await this.set(operation.key, operation.value!, operation.options);
            result = { key: operation.key, success: true };
            break;
          }
            
          case 'delete': {
            const deleted = await this.delete(operation.key);
            result = { key: operation.key, success: deleted };
            break;
          }
            
          default:
            result = { key: operation.key, success: false, error: 'Unknown operation type' };
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          key: operation.key,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  /**
   * Cache warming with TTL considerations
   * @param options
  . */
  async warm(options: CacheWarmingOptions): Promise<void> {
    const concurrency = options.concurrency || 5;
    const chunks = this.chunkArray(options.keys, concurrency);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (key) => {
          try {
            const value = await options.dataProvider(key);
            await this.set(key, value);
          } catch (error) {
            this.emitEvent('error', { key, error });
          }
        })
      );
    }
    
    this.emit('warmed', { keys: options.keys });
  }

  /**
   * Advanced cache invalidation with TTL awareness
   * @param options
  . */
  async invalidate(options: CacheInvalidationOptions): Promise<number> {
    let invalidated = 0;
    
    try {
      if (options.all) {
        invalidated = this.cache.size;
        this.clear();
        return invalidated;
      }

      // Invalidate by keys
      if (options.keys) {
        for (const key of options.keys) {
          if (await this.delete(key)) {
            invalidated++;
          }
        }
      }

      // Invalidate by tags
      if (options.tags?.length) {
        for (const tag of options.tags) {
          const keys = this.tagIndex.get(tag);
          if (keys) {
            for (const key of Array.from(keys)) {
              if (await this.delete(key)) {
                invalidated++;
              }
            }
          }
        }
      }

      // Invalidate by patterns
      if (options.patterns?.length) {
        for (const pattern of options.patterns) {
          const matchingKeys = this.matchPattern(pattern);
          for (const key of matchingKeys) {
            if (await this.delete(key)) {
              invalidated++;
            }
          }
        }
      }

      this.emit('invalidate', { invalidated, options });
      return invalidated;
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { error });
      throw new Error(`TTL cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if key exists and is not expired
   * @param key
  . */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.deleteEntry(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries and timers
  . */
  clear(): void {
    const {size} = this.cache;
    
    // Clear all timers
    for (const entry of this.cache.values()) {
      clearTimeout(entry.timer);
    }
    
    this.cache.clear();
    this.tagIndex.clear();
    this.expirationQueue.clear();
    this.memoryUsage = { totalBytes: 0, entryCount: 0, averageSize: 0, largestEntry: 0, timerCount: 0 };
    
    this.metrics.deletes += size;
    this.updateMetrics();
    this.emitEvent('clear', { deletedCount: size });
  }

  /**
   * Get cache size
  . */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get comprehensive performance metrics
  . */
  getMetrics(): CachePerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get TTL cache health status
  . */
  getHealth(): CacheHealthStatus {
    const now = Date.now();
    const memoryUsagePercent = (this.memoryUsage.totalBytes / (1024 * 1024 * 100)) * 100; // % of 100MB
    const {hitRate} = this.metrics;
    const errorRate = this.metrics.errors && this.metrics.errors > 0 ? this.metrics.errors / (this.metrics.hits + this.metrics.misses + this.metrics.sets) || 0 : 0;
    const timerOverhead = this.memoryUsage.timerCount / this.cache.size || 0;
    
    const issues: string[] = [];
    if (hitRate < 0.8) issues.push('Low hit rate');
    if (memoryUsagePercent > 80) issues.push('High memory usage');
    if (errorRate > 0.01) issues.push('High error rate');
    if (this.cache.size >= (this.config.maxSize || 1000) * 0.9) issues.push('Near capacity');
    if (timerOverhead > 1.2) issues.push('High timer overhead');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length > 0) status = 'degraded';
    if (issues.length > 2 || errorRate > 0.05) status = 'unhealthy';

    return {
      status,
      lastCheck: now,
      duration: 0,
      details: {
        connectivity: true,
        latency: this.metrics.averageAccessTime || 0,
        memoryUsage: memoryUsagePercent,
        errorRate
      },
      issues
    };
  }

  /**
   * Get remaining TTL for a key in seconds
   * @param key
  . */
  ttl(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return -1;
    
    if (this.isExpired(entry)) {
      this.deleteEntry(key);
      return 0;
    }
    
    const remaining = entry.metadata.expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Update TTL for existing key
   * @param key
   * @param ttl
  . */
  updateTTL(key: string, ttl: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Clear existing timer
    clearTimeout(entry.timer);

    const ttlMs = ttl * 1000;
    const newExpiresAt = Date.now() + ttlMs;
    
    // Update metadata
    entry.metadata.expiresAt = newExpiresAt;

    // Create new timer
    entry.timer = setTimeout(() => {
      this.deleteEntry(key);
      this.emitEvent('expire', { key });
    }, ttlMs);

    // Update expiration queue
    this.updateExpirationQueue(key, newExpiresAt);
    this.updateMemoryUsage();

    return true;
  }

  /**
   * Get all keys (non-expired)
  . */
  keys(): string[] {
    const validKeys: string[] = [];
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        validKeys.push(key);
      } else {
        this.deleteEntry(key);
      }
    }
    return validKeys;
  }

  /**
   * Get all values (non-expired)
  . */
  async values(): Promise<T[]> {
    const values: T[] = [];
    for (const key of this.cache.keys()) {
      const value = await this.get(key, { updateAccess: false });
      if (value !== undefined) {
        values.push(value);
      }
    }
    return values;
  }

  /**
   * Manual cleanup of expired entries
  . */
  cleanup(): number {
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.deleteEntry(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.metrics.deletes += removed;
      this.updateMetrics();
      this.emit('cleanup', { removedCount: removed });
    }

    return removed;
  }

  /**
   * Destroy cache and cleanup all resources
  . */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    
    // Clear all entry timers
    for (const entry of this.cache.values()) {
      clearTimeout(entry.timer);
    }
    
    this.clear();
    this.emitEvent('disconnect');
    this.removeAllListeners();
  }

  // Private helper methods

  /**
   *
  . */
  private validateConfig(): void {
    if (!this.config.defaultTtl || this.config.defaultTtl <= 0) {
      throw new Error('defaultTtl must be a positive number');
    }
    if (this.config.maxSize && this.config.maxSize <= 0) {
      throw new Error('maxSize must be a positive number if specified');
    }
  }

  /**
   *
   * @param entry
  . */
  private isExpired(entry: TTLCacheEntry<T>): boolean {
    return Date.now() > entry.metadata.expiresAt;
  }

  /**
   *
   * @param key
  . */
  private deleteEntry(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      this.removeFromTagIndex(key);
      this.removeFromExpirationQueue(key, entry.metadata.expiresAt);
      this.cache.delete(key);
      this.updateMemoryUsage();
    }
  }

  /**
   *
  . */
  private async evictLRU(): Promise<void> {
    let lruKey: string | undefined;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.accessedAt < lruTime) {
        lruTime = entry.metadata.accessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.deleteEntry(lruKey);
      this.metrics.evictions = (this.metrics.evictions || 0) + 1;
      this.emitEvent('evict', { key: lruKey });
    }
  }

  /**
   *
   * @param _key
   * @param entry
  . */
  private updateAccess(_key: string, entry: TTLCacheEntry<T>): void {
    const now = Date.now();
    entry.metadata.accessedAt = now;
    entry.metadata.hits++;
  }

  /**
   *
   * @param key
   * @param tags
  . */
  private updateTagIndex(key: string, tags: Set<string>): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  /**
   *
   * @param key
  . */
  private removeFromTagIndex(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        const keys = this.tagIndex.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }
  }

  /**
   *
   * @param key
   * @param expiresAt
  . */
  private updateExpirationQueue(key: string, expiresAt: number): void {
    const bucket = Math.floor(expiresAt / 1000) * 1000; // Round to nearest second
    if (!this.expirationQueue.has(bucket)) {
      this.expirationQueue.set(bucket, new Set());
    }
    this.expirationQueue.get(bucket)!.add(key);
  }

  /**
   *
   * @param key
   * @param expiresAt
  . */
  private removeFromExpirationQueue(key: string, expiresAt: number): void {
    const bucket = Math.floor(expiresAt / 1000) * 1000;
    const keys = this.expirationQueue.get(bucket);
    if (keys) {
      keys.delete(key);
      if (keys.size === 0) {
        this.expirationQueue.delete(bucket);
      }
    }
  }

  /**
   *
   * @param pattern
  . */
  private matchPattern(pattern: CacheKeyPattern): string[] {
    const regex = new RegExp(pattern.pattern.replace(/\*/g, '.*'));
    const matchingKeys: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
        if (pattern.limit && matchingKeys.length >= pattern.limit) {
          break;
        }
      }
    }
    
    return matchingKeys;
  }

  /**
   *
   * @param value
  . */
  private calculateSize(value: unknown): number {
    if (Buffer.isBuffer(value)) {
      return value.length;
    }
    if (typeof value === 'string') {
      return Buffer.byteLength(value, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }

  /**
   *
  . */
  private updateMemoryUsage(): void {
    let totalBytes = 0;
    let largestEntry = 0;
    let timerCount = 0;
    
    for (const entry of this.cache.values()) {
      const size = entry.metadata.size || 0;
      totalBytes += size;
      if (size > largestEntry) {
        largestEntry = size;
      }
      timerCount++;
    }
    
    this.memoryUsage = {
      totalBytes,
      entryCount: this.cache.size,
      averageSize: this.cache.size > 0 ? totalBytes / this.cache.size : 0,
      largestEntry,
      timerCount
    };
    
    this.metrics.memoryUsage = totalBytes;
  }

  /**
   *
   * @param duration
  . */
  private trackAccessTime(duration: number): void {
    const currentAvg = this.metrics.averageAccessTime || 0;
    const totalOps = this.metrics.hits + this.metrics.sets;
    this.metrics.averageAccessTime = ((currentAvg * (totalOps - 1)) + duration) / totalOps;
  }

  /**
   *
  . */
  private updateMetrics(): void {
    this.metrics.size = this.cache.size;
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
    this.metrics.lastUpdated = Date.now();
  }

  /**
   *
  . */
  private startCleanup(): void {
    const interval = this.config.checkInterval || 60000; // Default 1 minute
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   *
  . */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      const health = this.getHealth();
      if (health.status === 'unhealthy') {
        this.emit('health-degraded', health);
      }
      
      // Emit metrics periodically
      this.emit('metrics', this.getMetrics());
    }, 30000); // Check every 30 seconds
  }

  /**
   *
   * @param type
   * @param data
  . */
  private emitEvent(type: CacheEventType, data?: unknown): void {
    const event: CacheEvent = {
      type,
      cacheName: this.config.name || 'ttl-cache',
      timestamp: Date.now(),
      data
    };
    
    this.emit(type, event);
    this.emit('event', event);
  }

  /**
   *
   * @param array
   * @param size
  . */
  private chunkArray<U>(array: U[], size: number): U[][] {
    const chunks: U[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Create a production-grade TTL cache instance
 * @param config
. */
export function createTTLCache<T = unknown>(config: TTLCacheConfig): TTLCache<T> {
  return new TTLCache<T>(config);
}

/**
 * Default TTL cache factory with production defaults
 * @param options
. */
export const ttlCache = <T = unknown>(options: Partial<TTLCacheConfig> = {}) => {
  const config: TTLCacheConfig = {
    defaultTtl: 3600, // 1 hour
    checkInterval: 300000, // 5 minutes
    maxSize: 10000,
    name: 'trading-bot-ttl-cache',
    namespace: 'ttl',
    ...options
  };
  
  return createTTLCache<T>(config);
};
