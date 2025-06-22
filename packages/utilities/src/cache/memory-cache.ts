/**
 * @file Production-grade in-memory cache with LRU eviction, TTL support, and enterprise features
 * @package @trading-bot/utilities
. */

import { EventEmitter } from 'events';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

import type {
  MemoryCacheConfig,
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
} from '@trading-bot/types/src/utilities/cache/cache';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Enhanced cache entry with comprehensive metadata
. */
interface MemoryCacheEntry<T> {
  value: T | string | Buffer;
  metadata: CacheEntryMetadata;
  tags: Set<string>;
  compressed: boolean;
  serialized: boolean;
}

/**
 * Memory usage tracking
. */
interface MemoryUsage {
  totalBytes: number;
  entryCount: number;
  averageSize: number;
  largestEntry: number;
}

/**
 * Production-grade in-memory cache implementation
. */
export class MemoryCache<T = unknown> extends EventEmitter {
  private readonly cache = new Map<string, MemoryCacheEntry<T>>();
  private readonly tagIndex = new Map<string, Set<string>>();
  private readonly accessOrder = new Map<string, number>();
  private readonly hotKeys = new Map<string, number>();
  private cleanupTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  private memoryUsage: MemoryUsage = {
    totalBytes: 0,
    entryCount: 0,
    averageSize: 0,
    largestEntry: 0
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
  constructor(private readonly config: MemoryCacheConfig) {
    super();
    this.validateConfig();
    this.startCleanup();
    this.startMonitoring();
    this.emit('connect');
  }

  /**
   * Get value from cache with advanced features
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

      if (this.isExpired(entry)) {
        this.deleteEntry(key);
        this.metrics.misses++;
        this.updateMetrics();
        this.emitEvent('expire', { key });
        return undefined;
      }

      // Update access tracking
      if (options?.updateAccess !== false) {
        this.updateAccess(key, entry);
      }

      let {value} = entry;
      
      // Decompress if needed
      if (entry.compressed && Buffer.isBuffer(value)) {
        const decompressed = await gunzipAsync(value);
        value = JSON.parse(decompressed.toString()) as T;
      } else if (entry.serialized && typeof value === 'string') {
        value = JSON.parse(value) as T;
      }

      this.metrics.hits++;
      this.trackAccessTime(Date.now() - startTime);
      this.updateMetrics();
      this.emitEvent('hit', { key, value });
      
      return value as T;
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { key, error });
      throw new Error(`Cache get failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set value in cache with comprehensive options
   * @param key
   * @param value
   * @param options
  . */
  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Evict if at max size and key doesn't exist
      if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
        await this.evictLRU();
      }

      const now = Date.now();
      const ttlMs = ((options?.ttl || this.config.defaultTtl || 3600) * 1000);
      
      let processedValue: T | string | Buffer = value;
      let compressed = false;
      let serialized = false;

      // Serialize if needed
      if (typeof value === 'object') {
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
        expiresAt: now + ttlMs,
        hits: 0,
        size: this.calculateSize(processedValue)
      };

      const entry: MemoryCacheEntry<T> = {
        value: processedValue,
        metadata,
        tags: new Set(options?.tags || []),
        compressed,
        serialized
      };

      // Update tag index
      this.updateTagIndex(key, entry.tags);

      // Remove old entry if exists
      if (this.cache.has(key)) {
        this.removeFromTagIndex(key);
      }

      this.cache.set(key, entry);
      this.updateAccess(key, entry);
      this.updateMemoryUsage();

      this.metrics.sets++;
      this.trackAccessTime(Date.now() - startTime);
      this.updateMetrics();
      this.emitEvent('set', { key, value, options });
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { key, error });
      throw new Error(`Cache set failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Cache delete failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Cache warming - preload data
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
   * Advanced cache invalidation
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
      if (options.tags) {
        for (const tag of options.tags) {
          const keys = this.tagIndex.get(tag);
          if (keys) {
            for (const key of keys) {
              if (await this.delete(key)) {
                invalidated++;
              }
            }
          }
        }
      }

      // Invalidate by patterns
      if (options.patterns) {
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
      throw new Error(`Cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Clear all cache entries
  . */
  clear(): void {
    const {size} = this.cache;
    this.cache.clear();
    this.tagIndex.clear();
    this.accessOrder.clear();
    this.hotKeys.clear();
    this.memoryUsage = { totalBytes: 0, entryCount: 0, averageSize: 0, largestEntry: 0 };
    
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
   * Get cache health status
  . */
  getHealth(): CacheHealthStatus {
    const now = Date.now();
    const memoryUsagePercent = (this.memoryUsage.totalBytes / (1024 * 1024 * 100)) * 100; // % of 100MB
    const {hitRate} = this.metrics;
    const errorRate = this.metrics.errors && this.metrics.errors > 0 ? this.metrics.errors / (this.metrics.hits + this.metrics.misses + this.metrics.sets) || 0 : 0;
    
    const issues: string[] = [];
    if (hitRate < 0.8) issues.push('Low hit rate');
    if (memoryUsagePercent > 80) issues.push('High memory usage');
    if (errorRate > 0.01) issues.push('High error rate');
    if (this.cache.size >= this.config.maxSize * 0.9) issues.push('Near capacity');

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
   * Get all keys
  . */
  keys(): string[] {
    return Array.from(this.cache.keys());
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
   * Cleanup expired entries
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
   * Destroy cache and cleanup resources
  . */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
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
    if (!this.config.maxSize || this.config.maxSize <= 0) {
      throw new Error('maxSize must be a positive number');
    }
  }

  /**
   *
   * @param entry
  . */
  private isExpired(entry: MemoryCacheEntry<T>): boolean {
    return Date.now() > entry.metadata.expiresAt;
  }

  /**
   *
   * @param key
  . */
  private deleteEntry(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.removeFromTagIndex(key);
      this.accessOrder.delete(key);
      this.hotKeys.delete(key);
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

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < lruTime) {
        lruTime = accessTime;
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
   * @param key
   * @param entry
  . */
  private updateAccess(key: string, entry: MemoryCacheEntry<T>): void {
    const now = Date.now();
    entry.metadata.accessedAt = now;
    entry.metadata.hits++;
    this.accessOrder.set(key, now);
    
    // Track hot keys
    const hits = this.hotKeys.get(key) || 0;
    this.hotKeys.set(key, hits + 1);
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
    
    for (const entry of this.cache.values()) {
      const size = entry.metadata.size || 0;
      totalBytes += size;
      if (size > largestEntry) {
        largestEntry = size;
      }
    }
    
    this.memoryUsage = {
      totalBytes,
      entryCount: this.cache.size,
      averageSize: this.cache.size > 0 ? totalBytes / this.cache.size : 0,
      largestEntry
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
    
    // Update hot keys list
    const sortedKeys = Array.from(this.hotKeys.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([key]) => key);
    
    this.metrics.hotKeys = sortedKeys;
  }

  /**
   *
  . */
  private startCleanup(): void {
    const interval = this.config.cleanupInterval || 300000; // 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, interval);
  }

  /**
   *
  . */
  private startMonitoring(): void {
    // Update metrics every 30 seconds
    this.monitoringTimer = setInterval(() => {
      this.updateMetrics();
      this.updateMemoryUsage();
    }, 30000);
  }

  /**
   *
   * @param type
   * @param data
  . */
  private emitEvent(type: CacheEventType, data?: unknown): void {
    const event: CacheEvent = {
      type,
      cacheName: this.config.name || '',
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
 * Create a production-grade memory cache instance
 * @param config
. */
export function createMemoryCache<T = unknown>(config: MemoryCacheConfig): MemoryCache<T> {
  return new MemoryCache<T>(config);
}

/**
 * Default memory cache factory with production defaults
 * @param options
. */
export const memoryCache = <T = unknown>(options: Partial<MemoryCacheConfig> = {}) => {
  const config: MemoryCacheConfig = {
    maxSize: 10000,
    defaultTtl: 3600,
    cleanupInterval: 300000,
    name: 'trading-bot-memory-cache',
    namespace: 'tb',
    ...options
  };
  
  return createMemoryCache<T>(config);
};
