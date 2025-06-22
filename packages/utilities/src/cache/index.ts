/**
 * @file Cache utilities index - exports all cache implementations
 * @package @trading-bot/utilities
. */

// Memory Cache exports
export {
  MemoryCache,
  createMemoryCache,
  memoryCache
} from './memory-cache';

// TTL Cache exports
export {
  TTLCache,
  createTTLCache,
  ttlCache
} from './ttl-cache';

// Redis Cache exports
export {
  RedisCache,
  createRedisCache,
  redisCache
} from './redis-cache';

// Re-export cache types for convenience
export type {
  MemoryCacheConfig,
  TTLCacheConfig,
  RedisCacheConfig,
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
  CacheHealthStatus,
  CacheStats,
  CacheSerializationOptions,
  CacheClusterConfig,
  CacheMonitoringConfig
} from '@trading-bot/types/src/utilities/cache/cache'; 