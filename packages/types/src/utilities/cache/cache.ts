/**
 * @file Cache utility types for the utilities package.
 * @package @trading-bot/types
 */

/**
 * Base cache configuration interface.
 */
interface UtilityCacheConfig {
  /** Cache name for identification. */
  name?: string;
  
  /** Cache namespace for key prefixing. */
  namespace?: string;
}

/**
 * Memory cache specific configuration.
 */
interface MemoryCacheConfig extends UtilityCacheConfig {
  /** Maximum number of items to store. */
  maxSize: number;
  
  /** Default TTL in seconds. */
  defaultTtl?: number;
  
  /** Cleanup interval in milliseconds. */
  cleanupInterval?: number;
}

/**
 * TTL cache specific configuration.
 */
interface TTLCacheConfig extends UtilityCacheConfig {
  /** Default TTL in seconds. */
  defaultTtl: number;
  
  /** Cleanup check interval in milliseconds. */
  checkInterval?: number;
  
  /** Maximum cache size. */
  maxSize?: number;
}

/**
 * Redis cache specific configuration.
 */
interface RedisCacheConfig extends UtilityCacheConfig {
  /** Redis host. */
  host: string;
  
  /** Redis port. */
  port: number;
  
  /** Redis password. */
  password?: string;
  
  /** Redis database number. */
  database?: number;
  
  /** Key prefix for all cache entries. */
  keyPrefix?: string;
  
  /** Default TTL in seconds. */
  defaultTtl?: number;
  
  /** Connection retry attempts. */
  retryAttempts?: number;
  
  /** Retry delay in milliseconds. */
  retryDelay?: number;
}

/**
 * Cache statistics interface.
 */
interface CacheStats {
  /** Number of cache hits. */
  hits: number;
  
  /** Number of cache misses. */
  misses: number;
  
  /** Number of set operations. */
  sets: number;
  
  /** Number of delete operations. */
  deletes: number;
  
  /** Current cache size. */
  size: number;
  
  /** Hit rate (0-1). */
  hitRate: number;
  
  /** Last update timestamp. */
  lastUpdated: number;
}

/**
 * Cache performance metrics.
 */
interface CachePerformanceMetrics extends CacheStats {
  /** Memory usage in bytes. */
  memoryUsage?: number;
  
  /** Average access time in milliseconds. */
  averageAccessTime?: number;
  
  /** Hot keys (most accessed). */
  hotKeys?: string[];
  
  /** Number of evictions. */
  evictions?: number;
  
  /** Number of errors. */
  errors?: number;
}

/**
 * Cache entry metadata.
 */
interface CacheEntryMetadata {
  /** Creation timestamp. */
  createdAt: number;
  
  /** Last access timestamp. */
  accessedAt: number;
  
  /** Expiration timestamp. */
  expiresAt: number;
  
  /** Number of hits for this entry. */
  hits: number;
  
  /** Entry size in bytes. */
  size?: number;
}

/**
 * Cache options for operations.
 */
interface CacheOptions {
  /** TTL override in seconds. */
  ttl?: number;
  
  /** Tags for cache invalidation. */
  tags?: string[];
  
  /** Cache compression. */
  compress?: boolean;
  
  /** Metadata to store with entry. */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Batch cache operation request.
 */
interface BatchCacheOperation<T = string | number | Record<string, unknown>> {
  /** Operation type. */
  type: 'get' | 'set' | 'delete';
  
  /** Cache key. */
  key: string;
  
  /** Value for set operations. */
  value?: T;
  
  /** Options for the operation. */
  options?: CacheOptions;
}

/**
 * Batch cache operation result.
 */
interface BatchCacheResult<T = string | number | Record<string, unknown>> {
  /** Operation key. */
  key: string;
  
  /** Operation success. */
  success: boolean;
  
  /** Retrieved value for get operations. */
  value?: T;
  
  /** Error if operation failed. */
  error?: string;
}

/**
 * Cache event types.
 */
type CacheEventType = 
  | 'hit' 
  | 'miss' 
  | 'set' 
  | 'delete' 
  | 'clear' 
  | 'expire' 
  | 'evict'
  | 'connect'
  | 'disconnect'
  | 'error';

/**
 * Cache event data.
 */
interface CacheEvent<T = string | number | Record<string, unknown>> {
  /** Event type. */
  type: CacheEventType;
  
  /** Cache instance name. */
  cacheName?: string;
  
  /** Affected key. */
  key?: string;
  
  /** Event timestamp. */
  timestamp: number;
  
  /** Additional event data. */
  data?: {
    key?: string;
    value?: T;
    error?: Error | string;
    options?: CacheOptions;
    deletedCount?: number;
    invalidated?: number;
  };
}

/**
 * Cache key pattern for bulk operations.
 */
interface CacheKeyPattern {
  /** Pattern string (supports wildcards). */
  pattern: string;
  
  /** Maximum number of keys to match. */
  limit?: number;
  
  /** Offset for pagination. */
  offset?: number;
}

/**
 * Cache invalidation options.
 */
interface CacheInvalidationOptions {
  /** Keys to invalidate. */
  keys?: string[];
  
  /** Patterns to match for invalidation. */
  patterns?: CacheKeyPattern[];
  
  /** Tags to invalidate. */
  tags?: string[];
  
  /** Invalidate all. */
  all?: boolean;
}

/**
 * Cache warming options.
 */
interface CacheWarmingOptions<T = string | number | Record<string, unknown>> {
  /** Keys to warm. */
  keys: string[];
  
  /** Data provider function. */
  dataProvider: (key: string) => Promise<T>;
  
  /** Concurrency limit. */
  concurrency?: number;
  
  /** Warming priority. */
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Cache serialization options.
 */
interface CacheSerializationOptions<T = string | number | Record<string, unknown>> {
  /** Serialization method. */
  method: 'json' | 'msgpack' | 'custom';
  
  /** Custom serializer. */
  serializer?: {
    serialize: (value: T) => string | Buffer;
    deserialize: (data: string | Buffer) => T;
  };
  
  /** Compression options. */
  compression?: {
    enabled: boolean;
    algorithm: 'gzip' | 'deflate' | 'brotli';
    level?: number;
  };
}

/**
 * Cache cluster configuration.
 */
interface CacheClusterConfig {
  /** Cluster nodes. */
  nodes: Array<{
    host: string;
    port: number;
    role: 'master' | 'slave';
  }>;
  
  /** Cluster options. */
  options: {
    maxRedirections: number;
    retryDelayOnClusterDown: number;
    enableOfflineQueue: boolean;
  };
}

/**
 * Cache monitoring configuration.
 */
interface CacheMonitoringConfig {
  /** Metrics collection enabled. */
  enabled: boolean;
  
  /** Metrics collection interval. */
  interval: number;
  
  /** Metrics to collect. */
  metrics: Array<'hits' | 'misses' | 'sets' | 'deletes' | 'size' | 'memory'>;
  
  /** Alert thresholds. */
  alerts: {
    hitRateThreshold: number;
    memoryThreshold: number;
    errorRateThreshold: number;
  };
}

/**
 * Cache health status.
 */
interface CacheHealthStatus {
  /** Health status. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Last health check timestamp. */
  lastCheck: number;
  
  /** Health check duration. */
  duration: number;
  
  /** Health details. */
  details: {
    connectivity: boolean;
    latency: number;
    memoryUsage: number;
    errorRate: number;
  };
  
  /** Health issues. */
  issues: string[];
}

// ========================================
// ADDITIONAL MISSING TYPES
// ========================================

/**
 * Cache strategy types.
 */
type CacheStrategy = 'memory' | 'redis' | 'hybrid' | 'distributed';

/**
 * Cache policy configuration.
 */
interface CachePolicy {
  /** Cache strategy. */
  strategy: CacheStrategy;
  
  /** TTL in seconds. */
  ttl: number;
  
  /** Maximum cache size. */
  maxSize?: number;
  
  /** Eviction policy. */
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
}

/**
 * Cache entry interface.
 */
interface CacheEntry<T = unknown> {
  /** Entry key. */
  key: string;
  
  /** Entry value. */
  value: T;
  
  /** Entry metadata. */
  metadata: CacheEntryMetadata;
}

/**
 * Cache key type.
 */
type CacheKey = string;

/**
 * Cache value type.
 */
type CacheValue = unknown;

/**
 * Cache configuration (alias to avoid duplicate with system config).
 */
interface CacheConfig extends UtilityCacheConfig {
  /** Cache type. */
  type: 'memory' | 'redis' | 'hybrid';
  
  /** Cache policy. */
  policy: CachePolicy;
}

/**
 * Cache provider interface.
 */
interface CacheProvider {
  /** Provider name. */
  name: string;
  
  /** Get value from cache. */
  get<T>(key: CacheKey): Promise<T | undefined>;
  
  /** Set value in cache. */
  set<T>(key: CacheKey, value: T, options?: CacheOptions): Promise<void>;
  
  /** Delete value from cache. */
  delete(key: CacheKey): Promise<boolean>;
  
  /** Clear all cache entries. */
  clear(): Promise<void>;
  
  /** Get cache statistics. */
  getStats(): Promise<CacheStats>;
}

/**
 * TTL cache implementation.
 */
interface TTLCache extends CacheProvider {
  /** TTL cache configuration. */
  config: TTLCacheConfig;
  
  /** Set TTL for key. */
  setTTL(key: CacheKey, ttl: number): Promise<void>;
  
  /** Get TTL for key. */
  getTTL(key: CacheKey): Promise<number>;
}

/**
 * LRU cache implementation.
 */
interface LRUCache extends CacheProvider {
  /** LRU cache configuration. */
  config: MemoryCacheConfig;
  
  /** Get recently used keys. */
  getRecentlyUsed(): CacheKey[];
}

/**
 * LFU cache implementation.
 */
interface LFUCache extends CacheProvider {
  /** LFU cache configuration. */
  config: MemoryCacheConfig;
  
  /** Get frequently used keys. */
  getFrequentlyUsed(): CacheKey[];
}

/**
 * FIFO cache implementation.
 */
interface FIFOCache extends CacheProvider {
  /** FIFO cache configuration. */
  config: MemoryCacheConfig;
  
  /** Get insertion order. */
  getInsertionOrder(): CacheKey[];
}

/**
 * Multi-tier cache implementation.
 */
interface MultiTierCache extends CacheProvider {
  /** Cache tiers. */
  tiers: CacheProvider[];
  
  /** Promote entry to higher tier. */
  promote(key: CacheKey): Promise<void>;
}

/**
 * Distributed cache implementation.
 */
interface DistributedCache extends CacheProvider {
  /** Cluster configuration. */
  cluster: CacheClusterConfig;
  
  /** Synchronize with cluster. */
  sync(): Promise<void>;
}

/**
 * Cache invalidation configuration.
 */
interface CacheInvalidation {
  /** Invalidation strategy. */
  strategy: 'immediate' | 'lazy' | 'scheduled';
  
  /** Invalidation triggers. */
  triggers: string[];
  
  /** Cascade invalidation. */
  cascade?: boolean;
}

/**
 * Cache eviction configuration.
 */
interface CacheEviction {
  /** Eviction policy. */
  policy: 'lru' | 'lfu' | 'fifo' | 'random';
  
  /** Eviction threshold. */
  threshold: number;
  
  /** Batch size for eviction. */
  batchSize?: number;
}

/**
 * Cache compression configuration.
 */
interface CacheCompression {
  /** Compression algorithm. */
  algorithm: 'gzip' | 'deflate' | 'brotli';
  
  /** Compression level. */
  level: number;
  
  /** Minimum size for compression. */
  minSize: number;
}

/**
 * Cache encryption configuration.
 */
interface CacheEncryption {
  /** Encryption algorithm. */
  algorithm: 'aes-256-gcm' | 'aes-128-gcm';
  
  /** Encryption key. */
  key: string;
  
  /** Key rotation interval. */
  keyRotation?: number;
}

/**
 * Cache metrics interface.
 */
interface CacheMetrics extends CacheStats {
  /** Cache operations per second. */
  operationsPerSecond: number;
  
  /** Average operation latency. */
  averageLatency: number;
  
  /** Error rate. */
  errorRate: number;
}

/**
 * Cache health interface.
 */
interface CacheHealth {
  /** Health status. */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Health checks. */
  checks: Array<{
    name: string;
    status: boolean;
    message?: string;
  }>;
  
  /** Last health check. */
  lastCheck: number;
}

/**
 * Cache warming interface.
 */
interface CacheWarming {
  /** Warming strategy. */
  strategy: 'eager' | 'lazy' | 'scheduled';
  
  /** Keys to warm. */
  keys: CacheKey[];
  
  /** Warming progress. */
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
}

/**
 * Cache prefetch configuration.
 */
interface CachePrefetch {
  /** Prefetch strategy. */
  strategy: 'predictive' | 'pattern' | 'manual';
  
  /** Prefetch triggers. */
  triggers: string[];
  
  /** Prefetch limit. */
  limit: number;
}

/**
 * Cache partition configuration.
 */
interface CachePartition {
  /** Partition key. */
  key: string;
  
  /** Partition strategy. */
  strategy: 'hash' | 'range' | 'list';
  
  /** Partition count. */
  count: number;
}

/**
 * Cache replication configuration.
 */
interface CacheReplication {
  /** Replication factor. */
  factor: number;
  
  /** Replication strategy. */
  strategy: 'sync' | 'async';
  
  /** Replica nodes. */
  replicas: string[];
}

/**
 * Cache consistency configuration.
 */
interface CacheConsistency {
  /** Consistency level. */
  level: 'eventual' | 'strong' | 'weak';
  
  /** Conflict resolution. */
  conflictResolution: 'last-write-wins' | 'version-vector';
}

/**
 * Cache synchronization configuration.
 */
interface CacheSynchronization {
  /** Sync interval. */
  interval: number;
  
  /** Sync strategy. */
  strategy: 'push' | 'pull' | 'bidirectional';
  
  /** Conflict handling. */
  conflictHandling: 'merge' | 'overwrite' | 'reject';
}

/**
 * Cache backup configuration.
 */
interface CacheBackup {
  /** Backup interval. */
  interval: number;
  
  /** Backup location. */
  location: string;
  
  /** Backup format. */
  format: 'json' | 'binary' | 'compressed';
  
  /** Retention period. */
  retention: number;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default cache configurations.
 */
const DEFAULT_CACHE_CONFIGS = {
  MEMORY: {
    type: 'memory' as const,
    maxSize: 1000,
    defaultTtl: 3600,
    cleanupInterval: 60000
  },
  REDIS: {
    type: 'redis' as const,
    host: 'localhost',
    port: 6379,
    defaultTtl: 3600,
    retryAttempts: 3
  },
  HYBRID: {
    type: 'hybrid' as const,
    l1: { type: 'memory', maxSize: 100 },
    l2: { type: 'redis', host: 'localhost' }
  }
} as const;

/**
 * Cache size limits.
 */
const CACHE_SIZE_LIMITS = {
  SMALL: {
    maxEntries: 100,
    maxMemory: '10MB'
  },
  MEDIUM: {
    maxEntries: 1000,
    maxMemory: '100MB'
  },
  LARGE: {
    maxEntries: 10000,
    maxMemory: '1GB'
  },
  UNLIMITED: {
    maxEntries: Infinity,
    maxMemory: 'unlimited'
  }
} as const;

// Consolidated export declaration
export type {
  UtilityCacheConfig,
  MemoryCacheConfig,
  TTLCacheConfig,
  RedisCacheConfig,
  CacheStats,
  CachePerformanceMetrics,
  CacheEntryMetadata,
  CacheOptions,
  BatchCacheOperation,
  BatchCacheResult,
  CacheEventType,
  CacheEvent,
  CacheKeyPattern,
  CacheInvalidationOptions,
  CacheWarmingOptions,
  CacheSerializationOptions,
  CacheClusterConfig,
  CacheMonitoringConfig,
  CacheHealthStatus,
  CacheStrategy,
  CachePolicy,
  CacheEntry,
  CacheKey,
  CacheValue,
  CacheConfig,
  CacheProvider,
  TTLCache,
  LRUCache,
  LFUCache,
  FIFOCache,
  MultiTierCache,
  DistributedCache,
  CacheInvalidation,
  CacheEviction,
  CacheCompression,
  CacheEncryption,
  CacheMetrics,
  CacheHealth,
  CacheWarming,
  CachePrefetch,
  CachePartition,
  CacheReplication,
  CacheConsistency,
  CacheSynchronization,
  CacheBackup
};

export {
  DEFAULT_CACHE_CONFIGS,
  CACHE_SIZE_LIMITS
}; 