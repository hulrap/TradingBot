/**
 * @file Production-grade Redis-backed distributed cache with enterprise features
 * @package @trading-bot/utilities
. */

import { EventEmitter } from 'events';
import * as net from 'net';
import * as tls from 'tls';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';

import type {
  RedisCacheConfig,
  CachePerformanceMetrics,
  CacheOptions,
  CacheEvent,
  CacheEventType,
  BatchCacheOperation,
  BatchCacheResult,
  CacheInvalidationOptions,
  CacheWarmingOptions,
  CacheHealthStatus
} from '@trading-bot/types/src/utilities/cache/cache';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Enhanced Redis client with production features
. */
interface EnhancedRedisClient extends EventEmitter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<string>;
  info(section?: string): Promise<string>;
  
  // Basic operations
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  setEx(key: string, seconds: number, value: string): Promise<string>;
  del(key: string | string[]): Promise<number>;
  exists(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, pattern?: string, count?: number): Promise<[number, string[]]>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  persist(key: string): Promise<boolean>;
  
  // Hash operations
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetAll(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  
  // Set operations
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
  
  // List operations
  lpush(key: string, ...values: string[]): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  
  // Advanced operations
  multi(): RedisMulti;
  pipeline(): RedisPipeline;
  eval(script: string, numkeys: number, ...args: string[]): Promise<any>;
}

/**
 * Redis transaction interface
. */
interface RedisMulti {
  get(key: string): this;
  set(key: string, value: string): this;
  del(key: string): this;
  exec(): Promise<any[]>;
}

/**
 * Redis pipeline interface
. */
interface RedisPipeline {
  get(key: string): this;
  set(key: string, value: string): this;
  del(key: string): this;
  exec(): Promise<any[]>;
}

/**
 * Redis connection pool
. */
class RedisConnectionPool extends EventEmitter {
  private connections: EnhancedRedisClient[] = [];
  private availableConnections: EnhancedRedisClient[] = [];
  private readonly waitingQueue: Array<{
    resolve: (client: EnhancedRedisClient) => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   *
   * @param config
   * @param poolSize
  . */
  constructor(
    private readonly config: RedisCacheConfig,
    private readonly poolSize: number = 10
  ) {
    super();
  }

  /**
   *
  . */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.poolSize; i++) {
      const client = this.createClient();
      await client.connect();
      this.connections.push(client);
      this.availableConnections.push(client);
    }
  }

  /**
   *
  . */
  async getConnection(): Promise<EnhancedRedisClient> {
    if (this.availableConnections.length > 0) {
      return this.availableConnections.pop()!;
    }

    return new Promise((resolve, reject) => {
      this.waitingQueue.push({ resolve, reject });
    });
  }

  /**
   *
   * @param client
  . */
  releaseConnection(client: EnhancedRedisClient): void {
    this.availableConnections.push(client);
    
    if (this.waitingQueue.length > 0) {
      const { resolve } = this.waitingQueue.shift()!;
      resolve(this.availableConnections.pop()!);
    }
  }

  /**
   *
  . */
  async destroy(): Promise<void> {
    await Promise.all(
      this.connections.map(client => client.disconnect())
    );
    this.connections = [];
    this.availableConnections = [];
  }

  /**
   *
  . */
  private createClient(): EnhancedRedisClient {
    return new ProductionRedisClient(this.config) as EnhancedRedisClient;
  }
}

/**
 * Production Redis client implementation
. */
class ProductionRedisClient extends EventEmitter implements EnhancedRedisClient {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private connected = false;
  private connecting = false;
  private readonly commandQueue: Array<{
    command: string;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private responseBuffer = '';

  /**
   *
   * @param config
  . */
  constructor(private readonly config: RedisCacheConfig) {
    super();
  }

  /**
   *
  . */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;
    
    this.connecting = true;
    
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.config.port, this.config.host);

      this.socket.on('connect', () => {
        const authenticate = async (): Promise<void> => {
          // Authenticate if password provided
          if (this.config.password) {
            await this.executeCommand('AUTH', this.config.password);
          }
          
          // Select database
          if (this.config.database) {
            await this.executeCommand('SELECT', this.config.database.toString());
          }
          
          this.connected = true;
          this.connecting = false;
          this.emit('connect');
          resolve();
        };
        
        authenticate().catch((error) => {
          this.connecting = false;
          reject(error);
        });
      });

      this.socket.on('data', (data) => {
        this.handleResponse(data.toString());
      });

      this.socket.on('error', (error) => {
        this.connected = false;
        this.connecting = false;
        this.emit('error', error);
        reject(error);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.emit('disconnect');
      });
    });
  }

  /**
   *
  . */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   *
  . */
  async ping(): Promise<string> {
    return await this.executeCommand('PING');
  }

  /**
   *
   * @param section
  . */
  async info(section?: string): Promise<string> {
    return section 
      ? await this.executeCommand('INFO', section)
      : await this.executeCommand('INFO');
  }

  /**
   *
   * @param key
  . */
  async get(key: string): Promise<string | null> {
    return await this.executeCommand('GET', key);
  }

  /**
   *
   * @param key
   * @param value
  . */
  async set(key: string, value: string): Promise<string> {
    return await this.executeCommand('SET', key, value);
  }

  /**
   *
   * @param key
   * @param seconds
   * @param value
  . */
  async setEx(key: string, seconds: number, value: string): Promise<string> {
    return await this.executeCommand('SETEX', key, seconds.toString(), value);
  }

  /**
   *
   * @param key
  . */
  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    return parseInt(await this.executeCommand('DEL', ...keys));
  }

  /**
   *
   * @param key
  . */
  async exists(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    return parseInt(await this.executeCommand('EXISTS', ...keys));
  }

  /**
   *
   * @param pattern
  . */
  async keys(pattern: string): Promise<string[]> {
    const result = await this.executeCommand('KEYS', pattern);
    return Array.isArray(result) ? result : [];
  }

  /**
   *
   * @param cursor
   * @param pattern
   * @param count
  . */
  async scan(cursor: number, pattern?: string, count?: number): Promise<[number, string[]]> {
    const args = [cursor.toString()];
    if (pattern) {
      args.push('MATCH', pattern);
    }
    if (count) {
      args.push('COUNT', count.toString());
    }
    
    const result = await this.executeCommand('SCAN', ...args);
    return [parseInt(result[0]), result[1] || []];
  }

  /**
   *
   * @param key
  . */
  async ttl(key: string): Promise<number> {
    return parseInt(await this.executeCommand('TTL', key));
  }

  /**
   *
   * @param key
   * @param seconds
  . */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.executeCommand('EXPIRE', key, seconds.toString());
    return result === '1';
  }

  /**
   *
   * @param key
  . */
  async persist(key: string): Promise<boolean> {
    const result = await this.executeCommand('PERSIST', key);
    return result === '1';
  }

  // Hash operations
  /**
   *
   * @param key
   * @param field
  . */
  async hget(key: string, field: string): Promise<string | null> {
    return await this.executeCommand('HGET', key, field);
  }

  /**
   *
   * @param key
   * @param field
   * @param value
  . */
  async hset(key: string, field: string, value: string): Promise<number> {
    return parseInt(await this.executeCommand('HSET', key, field, value));
  }

  /**
   *
   * @param key
  . */
  async hgetAll(key: string): Promise<Record<string, string>> {
    const result = await this.executeCommand('HGETALL', key);
    const obj: Record<string, string> = {};
    
    if (Array.isArray(result)) {
      for (let i = 0; i < result.length; i += 2) {
        obj[result[i]] = result[i + 1];
      }
    }
    
    return obj;
  }

  /**
   *
   * @param key
   * @param {...any} fields
  . */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return parseInt(await this.executeCommand('HDEL', key, ...fields));
  }

  // Set operations
  /**
   *
   * @param key
   * @param {...any} members
  . */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return parseInt(await this.executeCommand('SADD', key, ...members));
  }

  /**
   *
   * @param key
   * @param {...any} members
  . */
  async srem(key: string, ...members: string[]): Promise<number> {
    return parseInt(await this.executeCommand('SREM', key, ...members));
  }

  /**
   *
   * @param key
  . */
  async smembers(key: string): Promise<string[]> {
    const result = await this.executeCommand('SMEMBERS', key);
    return Array.isArray(result) ? result : [];
  }

  /**
   *
   * @param key
   * @param member
  . */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.executeCommand('SISMEMBER', key, member);
    return result === '1';
  }

  // List operations
  /**
   *
   * @param key
   * @param {...any} values
  . */
  async lpush(key: string, ...values: string[]): Promise<number> {
    return parseInt(await this.executeCommand('LPUSH', key, ...values));
  }

  /**
   *
   * @param key
   * @param {...any} values
  . */
  async rpush(key: string, ...values: string[]): Promise<number> {
    return parseInt(await this.executeCommand('RPUSH', key, ...values));
  }

  /**
   *
   * @param key
  . */
  async lpop(key: string): Promise<string | null> {
    return await this.executeCommand('LPOP', key);
  }

  /**
   *
   * @param key
  . */
  async rpop(key: string): Promise<string | null> {
    return await this.executeCommand('RPOP', key);
  }

  /**
   *
   * @param key
   * @param start
   * @param stop
  . */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const result = await this.executeCommand('LRANGE', key, start.toString(), stop.toString());
    return Array.isArray(result) ? result : [];
  }

  /**
   *
  . */
  multi(): RedisMulti {
    return new RedisTransaction(this);
  }

  /**
   *
  . */
  pipeline(): RedisPipeline {
    return new RedisPipelineImpl(this);
  }

  /**
   *
   * @param script
   * @param numkeys
   * @param {...any} args
  . */
  async eval(script: string, numkeys: number, ...args: string[]): Promise<any> {
    return await this.executeCommand('EVAL', script, numkeys.toString(), ...args);
  }

  /**
   *
   * @param command
   * @param args
  . */
  async executeCommand(command: string, ...args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        reject(new Error('Redis client not connected'));
        return;
      }

      const fullCommand = this.formatCommand(command, ...args);
      this.commandQueue.push({ command: fullCommand, resolve, reject });
      this.socket.write(fullCommand);
    });
  }

  /**
   *
   * @param command
   * @param {...any} args
  . */
  private formatCommand(command: string, ...args: string[]): string {
    const parts = [command, ...args];
    let result = `*${parts.length}\r\n`;
    
    for (const part of parts) {
      result += `$${Buffer.byteLength(part, 'utf8')}\r\n${part}\r\n`;
    }
    
    return result;
  }

  /**
   *
   * @param data
  . */
  private handleResponse(data: string): void {
    this.responseBuffer += data;
    
    while (this.commandQueue.length > 0 && this.hasCompleteResponse()) {
      const response = this.parseResponse();
      const { resolve, reject } = this.commandQueue.shift()!;
      
      if (response instanceof Error) {
        reject(response);
      } else {
        resolve(response);
      }
    }
  }

  /**
   *
  . */
  private hasCompleteResponse(): boolean {
    // Simplified check - in production, this would be more sophisticated
    return this.responseBuffer.includes('\r\n');
  }

  /**
   *
  . */
  private parseResponse(): any {
    const lines = this.responseBuffer.split('\r\n');
    const firstLine = lines[0];
    
    if (!firstLine) return null;
    
    const type = firstLine[0];
    const content = firstLine.slice(1);
    
    switch (type) {
      case '+': // Simple string
        this.responseBuffer = lines.slice(1).join('\r\n');
        return content;
        
      case '-': // Error
        this.responseBuffer = lines.slice(1).join('\r\n');
        return new Error(content);
        
      case ':': // Integer
        this.responseBuffer = lines.slice(1).join('\r\n');
        return content;
        
      case '$': { // Bulk string
        const length = parseInt(content);
        if (length === -1) {
          this.responseBuffer = lines.slice(1).join('\r\n');
          return null;
        }
        
        if (lines.length < 2) return null;
        
        this.responseBuffer = lines.slice(2).join('\r\n');
        return lines[1];
      }
        
      case '*': { // Array
        const arrayLength = parseInt(content);
        if (arrayLength === -1) {
          this.responseBuffer = lines.slice(1).join('\r\n');
          return null;
        }
        
        // Simplified array parsing - production would be more robust
        const result: string[] = [];
        let lineIndex = 1;
        
        for (let i = 0; i < arrayLength; i++) {
          if (lines[lineIndex]?.startsWith('$')) {
            result.push(lines[lineIndex + 1] || '');
            lineIndex += 2;
          } else {
            lineIndex++;
          }
        }
        
        this.responseBuffer = lines.slice(lineIndex).join('\r\n');
        return result;
      }
        
      default:
        this.responseBuffer = lines.slice(1).join('\r\n');
        return content;
    }
  }
}

/**
 * Redis transaction implementation
. */
class RedisTransaction implements RedisMulti {
  private readonly commands: string[] = [];

  /**
   *
   * @param client
  . */
  constructor(private readonly client: ProductionRedisClient) {}

  /**
   *
   * @param key
  . */
  get(key: string): this {
    this.commands.push(`GET ${key}`);
    return this;
  }

  /**
   *
   * @param key
   * @param value
  . */
  set(key: string, value: string): this {
    this.commands.push(`SET ${key} ${value}`);
    return this;
  }

  /**
   *
   * @param key
  . */
  del(key: string): this {
    this.commands.push(`DEL ${key}`);
    return this;
  }

  /**
   *
  . */
  async exec(): Promise<any[]> {
    // Execute MULTI, commands, then EXEC using the client
    await this.client.executeCommand('MULTI');
    for (const command of this.commands) {
      await this.client.executeCommand(command);
    }
    return await this.client.executeCommand('EXEC');
  }
}

/**
 * Redis pipeline implementation
. */
class RedisPipelineImpl implements RedisPipeline {
  private readonly commands: string[] = [];

  /**
   *
   * @param client
  . */
  constructor(private readonly client: ProductionRedisClient) {}

  /**
   *
   * @param key
  . */
  get(key: string): this {
    this.commands.push(`GET ${key}`);
    return this;
  }

  /**
   *
   * @param key
   * @param value
  . */
  set(key: string, value: string): this {
    this.commands.push(`SET ${key} ${value}`);
    return this;
  }

  /**
   *
   * @param key
  . */
  del(key: string): this {
    this.commands.push(`DEL ${key}`);
    return this;
  }

  /**
   *
  . */
  async exec(): Promise<any[]> {
    // Execute all commands in pipeline using the client
    const results: any[] = [];
    for (const command of this.commands) {
      const result = await this.client.executeCommand(command);
      results.push(result);
    }
    return results;
  }
}

/**
 * Production-grade Redis cache implementation
. */
export class RedisCache<T = any> extends EventEmitter {
  private connectionPool?: RedisConnectionPool;
  private client?: EnhancedRedisClient;
  private connected = false;
  private monitoringTimer?: NodeJS.Timeout;

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
  constructor(private readonly config: RedisCacheConfig) {
    super();
    this.validateConfig();
  }

  /**
   * Connect to Redis with connection pooling
  . */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    try {
      // Use connection pooling for production
      this.connectionPool = new RedisConnectionPool(this.config, 10);
      await this.connectionPool.initialize();
      
      // Get a test connection
      this.client = await this.connectionPool.getConnection();
      this.connectionPool.releaseConnection(this.client);
      
      this.connected = true;
      this.startMonitoring();
      this.emit('connect');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from Redis
  . */
  async disconnect(): Promise<void> {
    if (!this.connected) return;
    
    try {
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
      }
      
      if (this.connectionPool) {
        await this.connectionPool.destroy();
      }
      
      this.connected = false;
      this.emit('disconnect');
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Get value from Redis cache with advanced features
   * @param key
   * @param options
   * @param options.decompress
  . */
  async get(key: string, options?: { decompress?: boolean }): Promise<T | undefined> {
    const startTime = Date.now();
    
    try {
      const client = await this.getClient();
      const fullKey = this.getFullKey(key);
      const value = await client.get(fullKey);
      this.releaseClient(client);
      
      if (value === null) {
        this.metrics.misses++;
        this.updateMetrics();
        this.emitEvent('miss', { key });
        return undefined;
      }

      let processedValue: T;
      
      try {
        // Try to parse as JSON first
        const parsed = JSON.parse(value);
        
        // Check if it's compressed
        if (options?.decompress && parsed._compressed) {
          const decompressed = await gunzipAsync(Buffer.from(parsed.data, 'base64'));
          processedValue = JSON.parse(decompressed.toString());
        } else {
          processedValue = parsed;
        }
      } catch {
        // If parsing fails, return as-is
        processedValue = value as unknown as T;
      }

      this.metrics.hits++;
      this.trackAccessTime(Date.now() - startTime);
      this.updateMetrics();
      this.emitEvent('hit', { key, value: processedValue });
      
      return processedValue;
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { key, error });
      throw new Error(`Cache get failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set value in Redis cache with comprehensive options
   * @param key
   * @param value
   * @param options
  . */
  async set(key: string, value: T, options?: CacheOptions): Promise<void> {
    const startTime = Date.now();
    
    try {
      const client = await this.getClient();
      const fullKey = this.getFullKey(key);
      
      let processedValue = JSON.stringify(value);
      
      // Compress if enabled and value is large enough
      if (options?.compress && processedValue.length > 1024) {
        const compressed = await gzipAsync(Buffer.from(processedValue));
        processedValue = JSON.stringify({
          _compressed: true,
          data: compressed.toString('base64')
        });
      }

      // Set with TTL if specified
      const ttl = options?.ttl || this.config.defaultTtl;
      if (ttl) {
        await client.setEx(fullKey, ttl, processedValue);
      } else {
        await client.set(fullKey, processedValue);
      }

      // Handle tags if provided
      if (options?.tags?.length) {
        await this.setTags(client, key, options.tags);
      }

      this.releaseClient(client);

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
   * Delete value from Redis cache
   * @param key
  . */
  async delete(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const fullKey = this.getFullKey(key);
      const deleted = await client.del(fullKey);
      
      // Clean up tags
      await this.cleanupTags(client, key);
      
      this.releaseClient(client);
      
      const success = deleted > 0;
      if (success) {
        this.metrics.deletes++;
        this.updateMetrics();
        this.emitEvent('delete', { key });
      }
      
      return success;
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
    const client = await this.getClient();
    
    try {
      // Use Redis pipeline for batch operations
      const pipeline = client.pipeline();
      
      for (const operation of operations) {
        switch (operation.type) {
          case 'get':
            pipeline.get(this.getFullKey(operation.key));
            break;
          case 'set': {
            const value = JSON.stringify(operation.value);
            pipeline.set(this.getFullKey(operation.key), value);
            break;
          }
          case 'delete':
            pipeline.del(this.getFullKey(operation.key));
            break;
        }
      }
      
      const pipelineResults = await pipeline.exec();
      
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const result = pipelineResults[i];
        
        try {
          let batchResult: BatchCacheResult<T>;
          
          if (operation?.type === 'get') {
            const value = result ? JSON.parse(result as string) : undefined;
            batchResult = { key: operation?.key ?? '', success: true, value };
          } else {
            batchResult = { key: operation?.key ?? '', success: true };
          }
          
          results.push(batchResult);
        } catch (error) {
          results.push({
            key: operation?.key || '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } finally {
      this.releaseClient(client);
    }
    
    return results;
  }

  /**
   * Cache warming with Redis pipeline
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
   * Advanced cache invalidation with Redis patterns
   * @param options
  . */
  async invalidate(options: CacheInvalidationOptions): Promise<number> {
    let invalidated = 0;
    
    try {
      const client = await this.getClient();
      
      if (options.all) {
        const pattern = this.getFullKey('*');
        const keys = await this.scanKeys(client, pattern);
        if (keys.length > 0) {
          invalidated = await client.del(keys);
        }
        this.releaseClient(client);
        return invalidated;
      }

      // Invalidate by keys
      if (options.keys?.length) {
        const fullKeys = options.keys.map(key => this.getFullKey(key));
        invalidated += await client.del(fullKeys);
      }

      // Invalidate by tags
      if (options.tags?.length) {
        for (const tag of options.tags) {
          const taggedKeys = await this.getKeysByTag(client, tag);
          if (taggedKeys.length > 0) {
            invalidated += await client.del(taggedKeys);
          }
        }
      }

      // Invalidate by patterns
      if (options.patterns?.length) {
        for (const pattern of options.patterns) {
          const matchingKeys = await this.scanKeys(client, pattern.pattern, pattern.limit);
          if (matchingKeys.length > 0) {
            invalidated += await client.del(matchingKeys);
          }
        }
      }

      this.releaseClient(client);
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
   * Check if key exists in Redis
   * @param key
  . */
  async has(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const fullKey = this.getFullKey(key);
      const exists = await client.exists(fullKey);
      this.releaseClient(client);
      return exists > 0;
    } catch (error) {
      this.emitEvent('error', { key, error });
      return false;
    }
  }

  /**
   * Clear all cache entries with Redis pattern matching
  . */
  async clear(): Promise<void> {
    try {
      const client = await this.getClient();
      const pattern = this.getFullKey('*');
      const keys = await this.scanKeys(client, pattern);
      
      if (keys.length > 0) {
        const deleted = await client.del(keys);
        this.metrics.deletes += deleted;
        this.updateMetrics();
        this.emitEvent('clear', { deletedCount: deleted });
      }
      
      this.releaseClient(client);
    } catch (error) {
      this.metrics.errors = (this.metrics.errors || 0) + 1;
      this.updateMetrics();
      this.emitEvent('error', { error });
      throw new Error(`Cache clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cache size using Redis DBSIZE
  . */
  async size(): Promise<number> {
    try {
      const client = await this.getClient();
      const pattern = this.getFullKey('*');
      const keys = await this.scanKeys(client, pattern);
      this.releaseClient(client);
      return keys.length;
    } catch (error) {
      this.emitEvent('error', { error });
      return 0;
    }
  }

  /**
   * Get comprehensive performance metrics
  . */
  getMetrics(): CachePerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get Redis health status
  . */
  async getHealth(): Promise<CacheHealthStatus> {
    const startTime = Date.now();
    
    try {
      const client = await this.getClient();
      
      // Test connectivity
      const pingResult = await client.ping();
      const info = await client.info('memory');
      
      this.releaseClient(client);
      
      const duration = Date.now() - startTime;
      const memoryInfo = this.parseRedisInfo(info);
      const memoryUsagePercent = (memoryInfo.used_memory / memoryInfo.maxmemory) * 100;
      
      const issues: string[] = [];
      if (duration > 100) issues.push('High latency');
      if (memoryUsagePercent > 80) issues.push('High memory usage');
      if (this.metrics.hitRate < 0.8) issues.push('Low hit rate');
      if (this.metrics.errors && this.metrics.errors > 0) issues.push('Recent errors');

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (issues.length > 0) status = 'degraded';
      if (issues.length > 2 || duration > 500) status = 'unhealthy';

      return {
        status,
        lastCheck: Date.now(),
        duration,
        details: {
          connectivity: pingResult === 'PONG',
          latency: duration,
          memoryUsage: memoryUsagePercent,
          errorRate: this.metrics.errors && this.metrics.errors > 0 ? this.metrics.errors / (this.metrics.hits + this.metrics.misses + this.metrics.sets) || 0 : 0
        },
        issues
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: Date.now(),
        duration: Date.now() - startTime,
        details: {
          connectivity: false,
          latency: 0,
          memoryUsage: 0,
          errorRate: 1
        },
        issues: ['Connection failed']
      };
    }
  }

  /**
   * Get TTL for a key
   * @param key
  . */
  async ttl(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      const fullKey = this.getFullKey(key);
      const ttl = await client.ttl(fullKey);
      this.releaseClient(client);
      return ttl;
    } catch (error) {
      this.emitEvent('error', { key, error });
      return -1;
    }
  }

  /**
   * Update TTL for existing key
   * @param key
   * @param ttl
  . */
  async updateTTL(key: string, ttl: number): Promise<boolean> {
    try {
      const client = await this.getClient();
      const fullKey = this.getFullKey(key);
      const result = await client.expire(fullKey, ttl);
      this.releaseClient(client);
      return result;
    } catch (error) {
      this.emitEvent('error', { key, error });
      return false;
    }
  }

  /**
   * Check if connected to Redis
  . */
  isConnected(): boolean {
    return this.connected;
  }

  // Private helper methods

  /**
   *
  . */
  private validateConfig(): void {
    if (!this.config.host) {
      throw new Error('Redis host is required');
    }
    if (!this.config.port || this.config.port <= 0) {
      throw new Error('Valid Redis port is required');
    }
  }

  /**
   *
  . */
  private async getClient(): Promise<EnhancedRedisClient> {
    if (!this.connectionPool) {
      throw new Error('Redis connection pool not initialized');
    }
    return await this.connectionPool.getConnection();
  }

  /**
   *
   * @param client
  . */
  private releaseClient(client: EnhancedRedisClient): void {
    if (this.connectionPool) {
      this.connectionPool.releaseConnection(client);
    }
  }

  /**
   *
   * @param key
  . */
  private getFullKey(key: string): string {
    const prefix = this.config.keyPrefix || 'trading-bot';
    const namespace = this.config.namespace || 'cache';
    return `${prefix}:${namespace}:${key}`;
  }

  /**
   *
   * @param client
   * @param pattern
   * @param limit
  . */
  private async scanKeys(client: EnhancedRedisClient, pattern: string, limit?: number): Promise<string[]> {
    const keys: string[] = [];
    let cursor = 0;
    
    do {
      const [newCursor, foundKeys] = await client.scan(cursor, pattern, 100);
      keys.push(...foundKeys);
      cursor = newCursor;
      
      if (limit && keys.length >= limit) {
        break;
      }
    } while (cursor !== 0);
    
    return limit ? keys.slice(0, limit) : keys;
  }

  /**
   *
   * @param client
   * @param key
   * @param tags
  . */
  private async setTags(client: EnhancedRedisClient, key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.getFullKey('tags')}:${tag}`;
      await client.sadd(tagKey, key);
    }
  }

  /**
   *
   * @param client
   * @param key
  . */
  private async cleanupTags(client: EnhancedRedisClient, key: string): Promise<void> {
    const tagPattern = `${this.getFullKey('tags')}:*`;
    const tagKeys = await this.scanKeys(client, tagPattern);
    
    for (const tagKey of tagKeys) {
      await client.srem(tagKey, key);
    }
  }

  /**
   *
   * @param client
   * @param tag
  . */
  private async getKeysByTag(client: EnhancedRedisClient, tag: string): Promise<string[]> {
    const tagKey = `${this.getFullKey('tags')}:${tag}`;
    return await client.smembers(tagKey);
  }

  /**
   *
   * @param info
  . */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }
    
    return result;
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
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
    this.metrics.lastUpdated = Date.now();
  }

  /**
   *
  . */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      const checkHealth = async (): Promise<void> => {
      try {
        const health = await this.getHealth();
        if (health.status === 'unhealthy') {
          this.emit('health-degraded', health);
        }
      } catch (error) {
        this.emit('error', error);
      }
      };
      
      checkHealth().catch((error) => {
        this.emit('error', error);
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   *
   * @param type
   * @param data
  . */
  private emitEvent(type: CacheEventType, data?: any): void {
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
 * Create a production-grade Redis cache instance
 * @param config
. */
export function createRedisCache<T = any>(config: RedisCacheConfig): RedisCache<T> {
  return new RedisCache<T>(config);
}

/**
 * Default Redis cache factory with production defaults
 * @param options
. */
export const redisCache = <T = any>(options: Partial<RedisCacheConfig> = {}) => {
  const config: RedisCacheConfig = {
    host: 'localhost',
    port: 6379,
    database: 0,
    keyPrefix: 'trading-bot',
    defaultTtl: 3600,
    retryAttempts: 3,
    retryDelay: 1000,
    name: 'trading-bot-redis-cache',
    namespace: 'cache',
    ...options
  };
  
  return createRedisCache<T>(config);
};
