import { EventEmitter } from 'events';
import winston from 'winston';
import { RPCManager } from './rpc-manager';

// Core Connection Pool Types and Interfaces
export interface PoolConnection {
  id: string;
  providerId: string;
  endpoint: string;
  isActive: boolean;
  isBusy: boolean;
  isHealthy: boolean;
  lastUsed: number;
  createdAt: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  consecutiveErrors: number;
  maxConsecutiveErrors: number;
  healthScore: number; // 0-100
  version: string;
  metadata: {
    userAgent: string;
    connectionType: 'websocket' | 'http' | 'ipc';
    compressionEnabled: boolean;
    keepAliveEnabled: boolean;
    maxRequestsPerSecond: number;
    requestQueue: number;
    bytesSent: number;
    bytesReceived: number;
  };
  statistics: {
    totalRequestTime: number;
    fastestResponse: number;
    slowestResponse: number;
    uptime: number;
    downtime: number;
    lastHealthCheck: number;
    healthCheckCount: number;
    healthCheckFailures: number;
  };
}

export interface LoadBalancingStrategy {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'latency-based' | 'health-based' | 'adaptive';
  weights?: Map<string, number>;
  currentIndex?: number;
  adaptiveFactors?: {
    latencyWeight: number;
    healthWeight: number;
    loadWeight: number;
    reliabilityWeight: number;
  };
}

export interface ConnectionPoolConfig {
  // Core Configuration
  maxConnections: number;
  minConnections: number;
  maxConnectionsPerProvider: number;
  maxConnectionAge: number; // milliseconds
  idleTimeout: number; // milliseconds
  connectionTimeout: number; // milliseconds
  
  // Health and Monitoring
  healthCheckInterval: number; // milliseconds
  healthCheckTimeout: number; // milliseconds
  maxConsecutiveErrors: number;
  healthScoreThreshold: number; // 0-100
  unhealthyConnectionQuarantine: number; // milliseconds
  
  // Auto-scaling
  scaleUpThreshold: number; // percentage of busy connections
  scaleDownThreshold: number; // percentage of idle connections
  scaleUpDelay: number; // milliseconds
  scaleDownDelay: number; // milliseconds
  maxScaleOperationsPerMinute: number;
  
  // Load Balancing
  loadBalancer: LoadBalancingStrategy;
  
  // Performance Optimization
  preWarmConnections: boolean;
  enableConnectionPooling: boolean;
  enableRequestQueuing: boolean;
  maxQueueSize: number;
  queueTimeout: number; // milliseconds
  
  // Circuit Breaker
  circuitBreakerConfig: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number; // milliseconds
    monitoringPeriod: number; // milliseconds
  };
  
  // Advanced Features
  enableMetrics: boolean;
  enableTracing: boolean;
  enableCaching: boolean;
  compressionEnabled: boolean;
  keepAliveEnabled: boolean;
  
  // Security
  enableRateLimiting: boolean;
  maxRequestsPerSecond: number;
  enableTLSVerification: boolean;
  allowedCertificates?: string[];
}

export interface QueuedRequest {
  id: string;
  priority: number;
  timestamp: number;
  timeout: NodeJS.Timeout;
  providerId?: string | undefined;
  metadata: {
    source: string;
    tags: string[];
    retryCount: number;
    maxRetries: number;
  };
  resolve: (connection: PoolConnection) => void;
  reject: (error: Error) => void;
}

export interface PoolMetrics {
  // Connection Metrics
  totalConnections: number;
  activeConnections: number;
  busyConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  
  // Request Metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  queuedRequests: number;
  timeoutRequests: number;
  
  // Performance Metrics
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  
  // Pool Health
  poolUtilization: number; // percentage
  poolHealthScore: number; // 0-100
  
  // Lifecycle Metrics
  connectionsCreated: number;
  connectionsDestroyed: number;
  connectionsRecycled: number;
  
  // Health Check Metrics
  healthChecksPassed: number;
  healthChecksFailed: number;
  healthCheckLatency: number;
  
  // Auto-scaling Metrics
  scaleUpEvents: number;
  scaleDownEvents: number;
  
  // Error Metrics
  connectionErrors: number;
  timeoutErrors: number;
  networkErrors: number;
  circuitBreakerTrips: number;
  
  // Resource Usage
  memoryUsage: number;
  cpuUsage: number;
  networkBandwidth: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
  monitoringStartTime: number;
}

export interface ProviderStats {
  providerId: string;
  totalConnections: number;
  activeConnections: number;
  busyConnections: number;
  averageResponseTime: number;
  healthScore: number;
  successRate: number;
  requestsPerSecond: number;
  totalRequests: number;
  errorRate: number;
  circuitBreakerState: CircuitBreakerState;
}

/**
 * Enterprise-grade Connection Pool for High-Performance Blockchain Operations
 * 
 * Features:
 * - Advanced load balancing with multiple strategies
 * - Intelligent health monitoring and auto-healing
 * - Circuit breaker pattern for fault tolerance
 * - Real-time metrics and performance optimization
 * - Auto-scaling based on demand patterns
 * - Connection lifecycle management
 * - Request queuing with priority support
 */
export class ConnectionPool extends EventEmitter {
  private readonly logger: winston.Logger;
  private readonly rpcManager: RPCManager;
  private readonly config: ConnectionPoolConfig;
  
  // Core Connection Management
  private connections: Map<string, PoolConnection> = new Map();
  private providerPools: Map<string, Set<string>> = new Map();
  private connectionsByHealth: Map<number, Set<string>> = new Map();
  
  // Request Management
  private requestQueue: QueuedRequest[] = [];
  private requestHistory: Array<{ timestamp: number; duration: number; success: boolean }> = [];
  
  // Circuit Breaker Management
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Performance Tracking
  private metrics: PoolMetrics;
  private responseTimes: number[] = [];
  private performanceSnapshots: Array<{ timestamp: number; metrics: PoolMetrics }> = [];
  
  // Internal State
  private isInitialized: boolean = false;
  private isDestroying: boolean = false;
  private lastScaleOperation: number = 0;
  private scaleOperationCount: number = 0;
  
  // Timers and Intervals
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsUpdateInterval?: NodeJS.Timeout;
  private scaleEvaluationInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private circuitBreakerResetInterval?: NodeJS.Timeout;

  constructor(
    rpcManager: RPCManager,
    config: ConnectionPoolConfig,
    logger: winston.Logger
  ) {
    super();
    
    this.rpcManager = rpcManager;
    this.config = this.validateAndEnhanceConfig(config);
    this.logger = logger.child({ component: 'ConnectionPool' });
    
    // Initialize metrics
    this.metrics = this.initializeMetrics();
    
    // Initialize health score buckets
    this.initializeHealthBuckets();
    
    // Bind methods to preserve context
    this.bindMethods();
    
    // Start initialization process
    this.initialize().catch(error => {
      this.logger.error('Failed to initialize connection pool', { error: error.message });
      this.emit('initializationFailed', error);
    });
  }

  /**
   * Validate and enhance configuration with intelligent defaults
   */
  private validateAndEnhanceConfig(config: ConnectionPoolConfig): ConnectionPoolConfig {
    const enhanced: ConnectionPoolConfig = {
      // Core Configuration
      maxConnections: Math.max(config.maxConnections || 50, 5),
      minConnections: Math.max(config.minConnections || 5, 1),
      maxConnectionsPerProvider: Math.max(config.maxConnectionsPerProvider || 20, 2),
      maxConnectionAge: Math.max(config.maxConnectionAge || 3600000, 60000), // 1 hour
      idleTimeout: Math.max(config.idleTimeout || 300000, 30000), // 5 minutes
      connectionTimeout: Math.max(config.connectionTimeout || 30000, 5000), // 30 seconds
      
      // Health and Monitoring
      healthCheckInterval: Math.max(config.healthCheckInterval || 30000, 10000), // 30 seconds
      healthCheckTimeout: Math.max(config.healthCheckTimeout || 5000, 1000), // 5 seconds
      maxConsecutiveErrors: Math.max(config.maxConsecutiveErrors || 5, 1),
      healthScoreThreshold: Math.max(Math.min(config.healthScoreThreshold || 70, 100), 0),
      unhealthyConnectionQuarantine: Math.max(config.unhealthyConnectionQuarantine || 60000, 10000),
      
      // Auto-scaling
      scaleUpThreshold: Math.max(Math.min(config.scaleUpThreshold || 80, 100), 0),
      scaleDownThreshold: Math.max(Math.min(config.scaleDownThreshold || 20, 100), 0),
      scaleUpDelay: Math.max(config.scaleUpDelay || 10000, 1000),
      scaleDownDelay: Math.max(config.scaleDownDelay || 30000, 5000),
      maxScaleOperationsPerMinute: Math.max(config.maxScaleOperationsPerMinute || 10, 1),
      
      // Load Balancing
      loadBalancer: {
        strategy: config.loadBalancer?.strategy || 'adaptive',
        weights: config.loadBalancer?.weights || new Map(),
        currentIndex: 0,
        adaptiveFactors: {
          latencyWeight: 0.3,
          healthWeight: 0.3,
          loadWeight: 0.2,
          reliabilityWeight: 0.2,
          ...config.loadBalancer?.adaptiveFactors
        }
      },
      
      // Performance Optimization
      preWarmConnections: config.preWarmConnections !== false,
      enableConnectionPooling: config.enableConnectionPooling !== false,
      enableRequestQueuing: config.enableRequestQueuing !== false,
      maxQueueSize: Math.max(config.maxQueueSize || 1000, 10),
      queueTimeout: Math.max(config.queueTimeout || 30000, 5000),
      
      // Circuit Breaker
      circuitBreakerConfig: {
        enabled: config.circuitBreakerConfig?.enabled !== false,
        failureThreshold: Math.max(config.circuitBreakerConfig?.failureThreshold || 5, 1),
        resetTimeout: Math.max(config.circuitBreakerConfig?.resetTimeout || 60000, 10000),
        monitoringPeriod: Math.max(config.circuitBreakerConfig?.monitoringPeriod || 60000, 10000)
      },
      
      // Advanced Features
      enableMetrics: config.enableMetrics !== false,
      enableTracing: config.enableTracing !== false,
      enableCaching: config.enableCaching !== false,
      compressionEnabled: config.compressionEnabled !== false,
      keepAliveEnabled: config.keepAliveEnabled !== false,
      
      // Security
      enableRateLimiting: config.enableRateLimiting !== false,
      maxRequestsPerSecond: Math.max(config.maxRequestsPerSecond || 100, 1),
      enableTLSVerification: config.enableTLSVerification !== false,
      allowedCertificates: config.allowedCertificates || []
    };
    
    // Validate configuration consistency
    if (enhanced.minConnections > enhanced.maxConnections) {
      enhanced.minConnections = enhanced.maxConnections;
    }
    
    if (enhanced.scaleDownThreshold >= enhanced.scaleUpThreshold) {
      enhanced.scaleDownThreshold = Math.max(enhanced.scaleUpThreshold - 10, 0);
    }
    
    return enhanced;
  }

  /**
   * Initialize default metrics structure
   */
  private initializeMetrics(): PoolMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      busyConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      queuedRequests: 0,
      timeoutRequests: 0,
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      poolUtilization: 0,
      poolHealthScore: 100,
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      connectionsRecycled: 0,
      healthChecksPassed: 0,
      healthChecksFailed: 0,
      healthCheckLatency: 0,
      scaleUpEvents: 0,
      scaleDownEvents: 0,
      connectionErrors: 0,
      timeoutErrors: 0,
      networkErrors: 0,
      circuitBreakerTrips: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      networkBandwidth: 0
    };
  }

  /**
   * Initialize health score buckets for efficient connection management
   */
  private initializeHealthBuckets(): void {
    for (let i = 0; i <= 100; i += 10) {
      this.connectionsByHealth.set(i, new Set());
    }
  }

  /**
   * Bind methods to preserve context for async operations
   */
  private bindMethods(): void {
    this.performHealthCheck = this.performHealthCheck.bind(this);
    this.updateMetrics = this.updateMetrics.bind(this);
    this.evaluateScaling = this.evaluateScaling.bind(this);
    this.cleanupConnections = this.cleanupConnections.bind(this);
    this.resetCircuitBreakers = this.resetCircuitBreakers.bind(this);
  }

  /**
   * Track connection acquisition metrics
   */
  private trackConnectionAcquisition(connection: PoolConnection, duration: number): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    
    // Update response time metrics
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000); // Keep last 1000 measurements
    }
    
    // Update average response time
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime * 0.9) + (duration * 0.1);
    
    // Update connection statistics
    connection.statistics.totalRequestTime += duration;
    connection.averageResponseTime = (connection.averageResponseTime * 0.8) + (duration * 0.2);
    
    this.logger.debug('Connection acquisition tracked', {
      connectionId: connection.id,
      providerId: connection.providerId,
      duration,
      totalRequests: this.metrics.totalRequests
    });
  }

  /**
   * Check if we can create a new connection
   */
  private canCreateNewConnection(providerId?: string): boolean {
    const totalConnections = this.connections.size;
    
    // Check global connection limit
    if (totalConnections >= this.config.maxConnections) {
      return false;
    }
    
    // Check provider-specific limit if specified
    if (providerId) {
      const providerConnections = this.providerPools.get(providerId)?.size || 0;
      if (providerConnections >= this.config.maxConnectionsPerProvider) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Select provider for new connection creation
   */
  private selectProviderForNewConnection(): string | null {
    // Get all available providers from RPC manager
    const availableProviders = Array.from(this.providerPools.keys());
    if (availableProviders.length === 0) {
      // If no providers in pool yet, try to get from RPC manager
      return 'default'; // Fallback provider
    }
    
    // Select provider with least connections
    let selectedProvider: string | null = null;
    let minConnections = Infinity;
    
    for (const providerId of availableProviders) {
      const connectionCount = this.providerPools.get(providerId)?.size || 0;
      if (connectionCount < minConnections && connectionCount < this.config.maxConnectionsPerProvider) {
        minConnections = connectionCount;
        selectedProvider = providerId;
      }
    }
    
    return selectedProvider;
  }

  /**
   * Get provider endpoint
   */
  private async getProviderEndpoint(providerId: string): Promise<string> {
    // Reference RPC manager for provider information
    if (this.rpcManager) {
      this.logger.debug('Getting endpoint for provider via RPC manager', { providerId });
    }
    
    // For now, return a mock endpoint (to be enhanced with actual RPC manager integration)
    return `wss://rpc-${providerId}.example.com`;
  }

  /**
   * Add connection to health bucket
   */
  private addConnectionToHealthBucket(connection: PoolConnection): void {
    const healthBucket = Math.floor(connection.healthScore / 10) * 10;
    const bucket = this.connectionsByHealth.get(healthBucket);
    if (bucket) {
      bucket.add(connection.id);
    }
  }

  /**
   * Update connection health bucket placement
   */
  private updateConnectionHealthBucket(connection: PoolConnection): void {
    // Remove from all buckets first
    for (const bucket of this.connectionsByHealth.values()) {
      bucket.delete(connection.id);
    }
    
    // Add to correct bucket
    this.addConnectionToHealthBucket(connection);
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(): void {
    const connections = Array.from(this.connections.values());
    
    this.metrics.totalConnections = connections.length;
    this.metrics.activeConnections = connections.filter(c => c.isActive).length;
    this.metrics.busyConnections = connections.filter(c => c.isBusy).length;
    this.metrics.idleConnections = connections.filter(c => !c.isBusy && c.isActive).length;
    this.metrics.unhealthyConnections = connections.filter(c => !c.isHealthy).length;
    
    // Calculate pool utilization
    this.metrics.poolUtilization = this.metrics.totalConnections > 0 
      ? (this.metrics.busyConnections / this.metrics.totalConnections) * 100 
      : 0;
    
    // Calculate pool health score
    const healthyConnections = connections.filter(c => c.isHealthy);
    this.metrics.poolHealthScore = healthyConnections.length > 0
      ? healthyConnections.reduce((sum, c) => sum + c.healthScore, 0) / healthyConnections.length
      : 0;
  }

  /**
   * Check if circuit breaker is open for provider
   */
  private isCircuitBreakerOpen(providerId: string): boolean {
    if (!this.config.circuitBreakerConfig.enabled) {
      return false;
    }
    
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker) {
      return false;
    }
    
    const now = Date.now();
    
    switch (circuitBreaker.state) {
      case 'open':
        // Check if we should transition to half-open
        if (now >= circuitBreaker.nextAttemptTime) {
          circuitBreaker.state = 'half-open';
          circuitBreaker.successCount = 0;
          this.logger.info('Circuit breaker transitioning to half-open', { providerId });
          return false;
        }
        return true;
      
      case 'half-open':
        return false; // Allow limited requests
      
      case 'closed':
      default:
        return false;
    }
  }

  /**
   * Start metrics tracking
   */
  private startMetricsTracking(): void {
    this.metricsUpdateInterval = setInterval(() => {
      this.updateMetrics('periodic');
      this.updatePerformanceMetrics();
      this.updateConnectionCounts();
      
      // Reset scale operation count every minute
      this.scaleOperationCount = 0;
    }, 10000) as NodeJS.Timeout; // Update every 10 seconds
  }

  /**
   * Start auto-scaling monitoring
   */
  private startAutoScaling(): void {
    this.scaleEvaluationInterval = setInterval(() => {
      this.evaluateScaling();
    }, this.config.scaleUpDelay) as NodeJS.Timeout;
  }

  /**
   * Start cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupConnections();
      this.cleanupExpiredConnections();
    }, 60000) as NodeJS.Timeout; // Cleanup every minute
  }

  /**
   * Start circuit breaker management
   */
  private startCircuitBreakerManagement(): void {
    this.circuitBreakerResetInterval = setInterval(() => {
      this.resetCircuitBreakers();
    }, this.config.circuitBreakerConfig.monitoringPeriod) as NodeJS.Timeout;
  }

  /**
   * Pre-warm connections
   */
  private async preWarmConnections(): Promise<void> {
    const targetConnections = Math.min(this.config.minConnections, this.config.maxConnections);
    const creationPromises: Promise<PoolConnection>[] = [];
    
    for (let i = 0; i < targetConnections; i++) {
      creationPromises.push(this.createConnection('default'));
    }
    
    const results = await Promise.allSettled(creationPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    this.logger.info('Pre-warming completed', {
      target: targetConnections,
      successful,
      failed: targetConnections - successful
    });
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (this.responseTimes.length === 0) return;

    // Calculate percentiles
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const count = sorted.length;
    
    this.metrics.medianResponseTime = sorted[Math.floor(count * 0.5)] || 0;
    this.metrics.p95ResponseTime = sorted[Math.floor(count * 0.95)] || 0;
    this.metrics.p99ResponseTime = sorted[Math.floor(count * 0.99)] || 0;
    
    // Calculate requests per second
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(r => now - r.timestamp < 60000); // Last minute
    this.metrics.requestsPerSecond = recentRequests.length / 60;
    
    // Update request history
    this.requestHistory.push({
      timestamp: now,
      duration: this.metrics.averageResponseTime,
      success: true
    });
    
    // Keep only last 5 minutes of history
    this.requestHistory = this.requestHistory.filter(r => now - r.timestamp < 300000);
    
    // Store performance snapshot for trend analysis
    const snapshot = {
      timestamp: now,
      metrics: { ...this.metrics }
    };
    this.performanceSnapshots.push(snapshot);
    
    // Keep only last hour of snapshots (every 10 seconds = 360 snapshots)
    if (this.performanceSnapshots.length > 360) {
      this.performanceSnapshots = this.performanceSnapshots.slice(-360);
    }
  }

  /**
   * Cleanup connections
   */
  private cleanupConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const connection of this.connections.values()) {
      let shouldRemove = false;

      // Remove connections that are too old
      if (now - connection.createdAt > this.config.maxConnectionAge) {
        shouldRemove = true;
        this.logger.debug('Removing aged connection', {
          connectionId: connection.id,
          age: now - connection.createdAt
        });
      }
      
      // Remove idle connections that have been idle too long
      else if (!connection.isBusy && 
               now - connection.lastUsed > this.config.idleTimeout) {
        shouldRemove = true;
        this.logger.debug('Removing idle connection', {
          connectionId: connection.id,
          idleTime: now - connection.lastUsed
        });
      }
      
      // Remove unhealthy connections that have been quarantined long enough
      else if (!connection.isHealthy && 
               now - connection.statistics.lastHealthCheck > this.config.unhealthyConnectionQuarantine) {
        shouldRemove = true;
        this.logger.debug('Removing quarantined unhealthy connection', {
          connectionId: connection.id,
          quarantineTime: now - connection.statistics.lastHealthCheck
        });
      }

      if (shouldRemove) {
        connectionsToRemove.push(connection.id);
      }
    }

    // Remove identified connections
    for (const connectionId of connectionsToRemove) {
      this.destroyConnection(connectionId);
    }

    if (connectionsToRemove.length > 0) {
      this.emit('cleanupCompleted', { 
        removedConnections: connectionsToRemove.length,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Reset circuit breakers
   */
  private resetCircuitBreakers(): void {
    const now = Date.now();
    
    for (const [providerId, circuitBreaker] of this.circuitBreakers) {
      // Reset monitoring period stats
      if (now - circuitBreaker.monitoringStartTime >= this.config.circuitBreakerConfig.monitoringPeriod) {
        circuitBreaker.failureCount = 0;
        circuitBreaker.successCount = 0;
        circuitBreaker.monitoringStartTime = now;
      }
      
      // Transition from open to half-open if enough time has passed
      if (circuitBreaker.state === 'open' && now >= circuitBreaker.nextAttemptTime) {
        circuitBreaker.state = 'half-open';
        circuitBreaker.successCount = 0;
        
        this.logger.info('Circuit breaker reset to half-open', { providerId });
        this.emit('circuitBreakerReset', { providerId, state: 'half-open', timestamp: now });
      }
    }
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(providerId: string): void {
    if (!this.config.circuitBreakerConfig.enabled) return;

    let circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker) {
      circuitBreaker = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0,
        monitoringStartTime: Date.now()
      };
      this.circuitBreakers.set(providerId, circuitBreaker);
    }

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    // Trip circuit breaker if failure threshold exceeded
    if (circuitBreaker.failureCount >= this.config.circuitBreakerConfig.failureThreshold &&
        circuitBreaker.state === 'closed') {
      
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = Date.now() + this.config.circuitBreakerConfig.resetTimeout;
      
      this.metrics.circuitBreakerTrips++;
      
      this.logger.warn('Circuit breaker tripped', {
        providerId,
        failureCount: circuitBreaker.failureCount,
        resetTime: new Date(circuitBreaker.nextAttemptTime).toISOString()
      });
      
      this.emit('circuitBreakerTripped', {
        providerId,
        failureCount: circuitBreaker.failureCount,
        nextAttemptTime: circuitBreaker.nextAttemptTime,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Quarantine unhealthy connections
   */
  private async quarantineUnhealthyConnections(): Promise<void> {
    const unhealthyConnections = Array.from(this.connections.values())
      .filter(conn => !conn.isHealthy || conn.consecutiveErrors >= conn.maxConsecutiveErrors);

    for (const connection of unhealthyConnections) {
      if (connection.isActive) {
        connection.isActive = false;
        
        this.logger.info('Connection quarantined', {
          connectionId: connection.id,
          providerId: connection.providerId,
          healthScore: connection.healthScore,
          consecutiveErrors: connection.consecutiveErrors
        });
        
        this.emit('connectionQuarantined', {
          connection,
          reason: connection.consecutiveErrors >= connection.maxConsecutiveErrors 
            ? 'excessive_errors' 
            : 'low_health_score',
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Destroy a connection and clean up resources
   */
  public async destroyConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn('Attempted to destroy unknown connection', { connectionId });
      return;
    }

    try {
      // Remove from provider pool
      const providerPool = this.providerPools.get(connection.providerId);
      if (providerPool) {
        providerPool.delete(connectionId);
        if (providerPool.size === 0) {
          this.providerPools.delete(connection.providerId);
        }
      }

      // Remove from health buckets
      for (const bucket of this.connectionsByHealth.values()) {
        bucket.delete(connectionId);
      }

      // Remove from connections map
      this.connections.delete(connectionId);

      // Update metrics
      this.metrics.connectionsDestroyed++;
      this.updateConnectionMetrics();

      this.logger.debug('Connection destroyed', {
        connectionId,
        providerId: connection.providerId,
        uptime: Date.now() - connection.createdAt
      });

      this.emit('connectionDestroyed', {
        connectionId,
        providerId: connection.providerId,
        uptime: Date.now() - connection.createdAt,
        timestamp: Date.now()
      });

      // Process any queued requests that might now be able to proceed
      this.processQueuedRequests();

    } catch (error) {
      this.logger.error('Error destroying connection', {
        connectionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Initialize the connection pool
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing connection pool', {
        maxConnections: this.config.maxConnections,
        minConnections: this.config.minConnections,
        loadBalancingStrategy: this.config.loadBalancer.strategy
      });

      // Start all monitoring and management services
      this.startHealthChecks();
      this.startMetricsTracking();
      this.startAutoScaling();
      this.startCleanupProcess();
      this.startCircuitBreakerManagement();

      // Pre-warm connections if enabled
      if (this.config.preWarmConnections) {
        await this.preWarmConnections();
      }

      this.isInitialized = true;
      this.emit('initialized', {
        timestamp: Date.now(),
        configuration: this.config
      });

      this.logger.info('Connection pool initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize connection pool', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  // Connection Acquisition and Management

  /**
   * Get a connection from the pool with intelligent selection
   */
  public async getConnection(providerId?: string, priority: number = 1): Promise<PoolConnection> {
    if (this.isDestroying) {
      throw new Error('Connection pool is being destroyed');
    }

    if (!this.isInitialized) {
      throw new Error('Connection pool is not yet initialized');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Try to get an existing connection
      const existingConnection = await this.acquireExistingConnection(providerId);
      if (existingConnection) {
        this.trackConnectionAcquisition(existingConnection, Date.now() - startTime);
        return existingConnection;
      }

      // Try to create a new connection
      const newConnection = await this.createNewConnectionIfPossible(providerId);
      if (newConnection) {
        this.trackConnectionAcquisition(newConnection, Date.now() - startTime);
        return newConnection;
      }

      // Queue the request if pool is full
      if (this.config.enableRequestQueuing) {
        return await this.queueConnectionRequest(requestId, providerId, priority);
      }

      throw new Error('No connections available and queuing is disabled');

    } catch (error) {
      this.metrics.failedRequests++;
      this.logger.warn('Failed to acquire connection', {
        requestId,
        providerId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  public releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn('Attempted to release unknown connection', { connectionId });
      return;
    }

    // Mark connection as idle
    connection.isBusy = false;
    connection.lastUsed = Date.now();

    // Update health bucket placement
    this.updateConnectionHealthBucket(connection);

    // Process any queued requests
    this.processQueuedRequests();

    // Update metrics
    this.updateConnectionMetrics();

    this.emit('connectionReleased', {
      connectionId,
      providerId: connection.providerId,
      timestamp: Date.now()
    });
  }

  /**
   * Acquire an existing idle connection using load balancing
   */
  private async acquireExistingConnection(providerId?: string): Promise<PoolConnection | null> {
    const startTime = Date.now();

    try {
      // Get available connections
      const availableConnections = this.getAvailableConnections(providerId);
      if (availableConnections.length === 0) return null;

      // Select connection using load balancing strategy
      const selectedConnection = this.selectConnectionByStrategy(availableConnections);
      if (!selectedConnection) return null;

      // Check circuit breaker
      if (!this.isCircuitBreakerOpen(selectedConnection.providerId)) {
        selectedConnection.isBusy = true;
        selectedConnection.lastUsed = Date.now();
        selectedConnection.requestCount++;

        this.updateConnectionHealthBucket(selectedConnection);
        return selectedConnection;
      }

      return null;
    } catch (error) {
      this.logger.warn('Error acquiring existing connection', {
        providerId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      return null;
    }
  }

  /**
   * Get available connections with optional provider filtering
   */
  private getAvailableConnections(providerId?: string): PoolConnection[] {
    const connections = Array.from(this.connections.values()).filter(conn => {
      // Basic availability checks
      if (!conn.isActive || conn.isBusy || !conn.isHealthy) return false;
      
      // Provider filtering
      if (providerId && conn.providerId !== providerId) return false;
      
      // Health score threshold
      if (conn.healthScore < this.config.healthScoreThreshold) return false;
      
      // Circuit breaker check
      if (this.isCircuitBreakerOpen(conn.providerId)) return false;
      
      return true;
    });

    return connections.sort((a, b) => {
      // Primary sort by health score (higher is better)
      if (a.healthScore !== b.healthScore) {
        return b.healthScore - a.healthScore;
      }
      // Secondary sort by response time (lower is better)
      return a.averageResponseTime - b.averageResponseTime;
    });
  }

  /**
   * Select connection using configured load balancing strategy
   */
  private selectConnectionByStrategy(connections: PoolConnection[]): PoolConnection | null {
    if (connections.length === 0) return null;

    switch (this.config.loadBalancer.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(connections);
      
      case 'least-connections':
        return this.leastConnectionsSelection(connections);
      
      case 'weighted':
        return this.weightedSelection(connections);
      
      case 'latency-based':
        return this.latencyBasedSelection(connections);
      
      case 'health-based':
        return this.healthBasedSelection(connections);
      
      case 'adaptive':
        return this.adaptiveSelection(connections);
      
      default:
        return connections[0] || null;
    }
  }

  /**
   * Round-robin connection selection
   */
  private roundRobinSelection(connections: PoolConnection[]): PoolConnection | null {
    if (connections.length === 0) return null;
    
    const currentIndex = this.config.loadBalancer.currentIndex || 0;
    const selectedConnection = connections[currentIndex % connections.length];
    this.config.loadBalancer.currentIndex = (currentIndex + 1) % connections.length;
    return selectedConnection || null;
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelection(connections: PoolConnection[]): PoolConnection | null {
    if (connections.length === 0) return null;
    
    return connections.reduce((least, current) => 
      current.requestCount < least.requestCount ? current : least
    );
  }

  /**
   * Weighted selection based on provider weights
   */
  private weightedSelection(connections: PoolConnection[]): PoolConnection | null {
    if (connections.length === 0) return null;
    
    const weights = this.config.loadBalancer.weights || new Map();
    const weightedConnections = connections.map(conn => ({
      connection: conn,
      weight: weights.get(conn.providerId) || 1
    }));

    const totalWeight = weightedConnections.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) return connections[0] || null;

    let random = Math.random() * totalWeight;
    for (const item of weightedConnections) {
      random -= item.weight;
      if (random <= 0) {
        return item.connection;
      }
    }

    return connections[0] || null;
  }

  /**
   * Latency-based selection
   */
  private latencyBasedSelection(connections: PoolConnection[]): PoolConnection | null {
    if (connections.length === 0) return null;
    
    return connections.sort((a, b) => {
      const latencyDiff = a.averageResponseTime - b.averageResponseTime;
      if (Math.abs(latencyDiff) > 10) { // 10ms threshold
        return latencyDiff;
      }
      return b.healthScore - a.healthScore;
    })[0] || null;
  }

  /**
   * Health-based selection
   */
  private healthBasedSelection(connections: PoolConnection[]): PoolConnection | null {
    if (connections.length === 0) return null;
    
    return connections.sort((a, b) => {
      // Primary: health score (higher is better)
      if (a.healthScore !== b.healthScore) {
        return b.healthScore - a.healthScore;
      }
      // Secondary: error rate (lower is better)
      const aErrorRate = a.requestCount > 0 ? a.errorCount / a.requestCount : 0;
      const bErrorRate = b.requestCount > 0 ? b.errorCount / b.requestCount : 0;
      return aErrorRate - bErrorRate;
    })[0] || null;
  }

  /**
   * Adaptive selection using multiple factors
   */
  private adaptiveSelection(connections: PoolConnection[]): PoolConnection | null {
    if (connections.length === 0) return null;
    
    const factors = this.config.loadBalancer.adaptiveFactors!;
    const scored = connections.map(conn => {
      const errorRate = conn.requestCount > 0 ? conn.errorCount / conn.requestCount : 0;
      const normalizedLatency = Math.min(conn.averageResponseTime / 1000, 1); // Normalize to 0-1
      const normalizedHealth = conn.healthScore / 100;
      const normalizedLoad = Math.min(conn.requestCount / 1000, 1); // Normalize to 0-1
      const normalizedReliability = 1 - errorRate;

      const score = (
        (normalizedHealth * factors.healthWeight) +
        ((1 - normalizedLatency) * factors.latencyWeight) +
        ((1 - normalizedLoad) * factors.loadWeight) +
        (normalizedReliability * factors.reliabilityWeight)
      );

      return { connection: conn, score };
    });

    return scored.sort((a, b) => b.score - a.score)[0]?.connection || null;
  }

  /**
   * Create a new connection if possible
   */
  private async createNewConnectionIfPossible(providerId?: string): Promise<PoolConnection | null> {
    try {
      // Check if we can create new connections
      if (!this.canCreateNewConnection(providerId)) {
        return null;
      }

      // Use first available provider if none specified
      const targetProviderId = providerId || this.selectProviderForNewConnection();
      if (!targetProviderId) {
        return null;
      }

      return await this.createConnection(targetProviderId);
    } catch (error) {
      this.logger.warn('Failed to create new connection', {
        providerId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(providerId: string): Promise<PoolConnection> {
    const connectionId = `conn_${providerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Get provider endpoint
      const endpoint = await this.getProviderEndpoint(providerId);
      
      const connection: PoolConnection = {
        id: connectionId,
        providerId,
        endpoint,
        isActive: true,
        isBusy: false,
        isHealthy: true,
        lastUsed: Date.now(),
        createdAt: Date.now(),
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        consecutiveErrors: 0,
        maxConsecutiveErrors: this.config.maxConsecutiveErrors,
        healthScore: 100,
        version: '1.0',
        metadata: {
          userAgent: 'ChainClient/1.0',
          connectionType: 'websocket',
          compressionEnabled: this.config.compressionEnabled,
          keepAliveEnabled: this.config.keepAliveEnabled,
          maxRequestsPerSecond: this.config.maxRequestsPerSecond,
          requestQueue: 0,
          bytesSent: 0,
          bytesReceived: 0
        },
        statistics: {
          totalRequestTime: 0,
          fastestResponse: Infinity,
          slowestResponse: 0,
          uptime: 0,
          downtime: 0,
          lastHealthCheck: Date.now(),
          healthCheckCount: 0,
          healthCheckFailures: 0
        }
      };

      // Store the connection
      this.connections.set(connectionId, connection);

      // Add to provider pool
      if (!this.providerPools.has(providerId)) {
        this.providerPools.set(providerId, new Set());
      }
      this.providerPools.get(providerId)!.add(connectionId);

      // Add to health bucket
      this.addConnectionToHealthBucket(connection);

      // Update metrics
      this.metrics.connectionsCreated++;
      this.updateConnectionMetrics();

      const creationTime = Date.now() - startTime;
      this.logger.debug('Connection created successfully', {
        connectionId,
        providerId,
        endpoint,
        creationTime
      });

      this.emit('connectionCreated', {
        connection,
        creationTime,
        timestamp: Date.now()
      });

      return connection;
    } catch (error) {
      this.metrics.connectionErrors++;
      this.logger.error('Failed to create connection', {
        connectionId,
        providerId,
        error: error instanceof Error ? error.message : String(error),
        creationTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Queue a connection request
   */
  private async queueConnectionRequest(
    requestId: string,
    providerId: string | undefined,
    priority: number
  ): Promise<PoolConnection> {
    return new Promise((resolve, reject) => {
      // Check queue size limit
      if (this.requestQueue.length >= this.config.maxQueueSize) {
        reject(new Error('Request queue is full'));
        return;
      }

      // Create timeout
      const timeout = setTimeout(() => {
        const index = this.requestQueue.findIndex(req => req.id === requestId);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
        }
        this.metrics.timeoutRequests++;
        reject(new Error(`Connection request timeout after ${this.config.queueTimeout}ms`));
      }, this.config.queueTimeout);

      // Create queued request
      const queuedRequest: QueuedRequest = {
        id: requestId,
        priority,
        timestamp: Date.now(),
        timeout,
        providerId: providerId || undefined,
        metadata: {
          source: 'connection-pool',
          tags: ['queued-request'],
          retryCount: 0,
          maxRetries: 3
        },
        resolve,
        reject
      };

      // Add to queue
      this.requestQueue.push(queuedRequest);

      // Sort by priority (higher first) then timestamp (older first)
      this.requestQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      this.metrics.queuedRequests++;

      this.logger.debug('Request queued', {
        requestId,
        providerId,
        priority,
        queueSize: this.requestQueue.length
      });

      this.emit('requestQueued', {
        requestId,
        providerId,
        priority,
        queueSize: this.requestQueue.length,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Process queued requests
   */
  private async processQueuedRequests(): Promise<void> {
    while (this.requestQueue.length > 0) {
      // Get available connection
      let availableConnection = await this.acquireExistingConnection();
      if (!availableConnection) {
        // Try to create new connection
        const newConnection = await this.createNewConnectionIfPossible();
        if (!newConnection) {
          break; // No connections available
        }
        availableConnection = newConnection;
      }

      // Get next request from queue
      const request = this.requestQueue.shift();
      if (!request) break;

      // Clear timeout
      clearTimeout(request.timeout);

      // Mark connection as busy
      availableConnection.isBusy = true;
      availableConnection.lastUsed = Date.now();
      availableConnection.requestCount++;

      // Update metrics
      this.metrics.queuedRequests--;

      // Resolve the request
      request.resolve(availableConnection);

      this.logger.debug('Queued request fulfilled', {
        requestId: request.id,
        connectionId: availableConnection.id,
        providerId: availableConnection.providerId,
        waitTime: Date.now() - request.timestamp
      });

      this.emit('queuedRequestFulfilled', {
        requestId: request.id,
        connectionId: availableConnection.id,
        providerId: availableConnection.providerId,
        waitTime: Date.now() - request.timestamp,
        timestamp: Date.now()
      });
    }
  }

  // Health Check and Monitoring

  /**
   * Start health check monitoring
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval) as NodeJS.Timeout;

    this.logger.debug('Health check monitoring started', {
      interval: this.config.healthCheckInterval
    });
  }

  /**
   * Perform comprehensive health checks on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    const connections = Array.from(this.connections.values());

    if (connections.length === 0) return;

    this.logger.debug('Starting health check cycle', {
      connectionCount: connections.length
    });

    // Perform health checks in parallel with controlled concurrency
    const healthCheckPromises = connections.map(async (connection) => {
      try {
        await this.checkConnectionHealth(connection);
        this.metrics.healthChecksPassed++;
      } catch (error) {
        this.metrics.healthChecksFailed++;
        this.handleUnhealthyConnection(connection, error as Error);
      }
    });

    await Promise.allSettled(healthCheckPromises);

    // Update overall health metrics
    const healthCheckDuration = Date.now() - startTime;
    this.metrics.healthCheckLatency = (this.metrics.healthCheckLatency * 0.8) + (healthCheckDuration * 0.2);

    // Clean up unhealthy connections
    await this.quarantineUnhealthyConnections();

    // Update connection metrics
    this.updateConnectionMetrics();

    this.logger.debug('Health check cycle completed', {
      duration: healthCheckDuration,
      passed: this.metrics.healthChecksPassed,
      failed: this.metrics.healthChecksFailed
    });

    this.emit('healthCheckCompleted', {
      duration: healthCheckDuration,
      connectionCount: connections.length,
      healthyConnections: connections.filter(c => c.isHealthy).length,
      timestamp: Date.now()
    });
  }

  /**
   * Check individual connection health
   */
  private async checkConnectionHealth(connection: PoolConnection): Promise<void> {
    const startTime = Date.now();

    try {
      // Skip health check if connection is busy or recently checked
      if (connection.isBusy || 
          (Date.now() - connection.statistics.lastHealthCheck) < (this.config.healthCheckInterval / 2)) {
        return;
      }

      // Perform actual health check (simulated for now)
      await this.simulateHealthCheck(connection);

      const responseTime = Date.now() - startTime;

      // Update connection statistics
      connection.statistics.lastHealthCheck = Date.now();
      connection.statistics.healthCheckCount++;
      connection.averageResponseTime = (connection.averageResponseTime * 0.8) + (responseTime * 0.2);

      // Update fastest/slowest response times
      if (responseTime < connection.statistics.fastestResponse) {
        connection.statistics.fastestResponse = responseTime;
      }
      if (responseTime > connection.statistics.slowestResponse) {
        connection.statistics.slowestResponse = responseTime;
      }

      // Reset consecutive errors on successful health check
      connection.consecutiveErrors = 0;
      connection.isHealthy = true;

      // Improve health score gradually
      connection.healthScore = Math.min(100, connection.healthScore + 5);

      // Update health bucket placement
      this.updateConnectionHealthBucket(connection);

    } catch (error) {
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simulate health check (replace with actual implementation)
   */
  private async simulateHealthCheck(connection: PoolConnection): Promise<void> {
    // Simulate variable response time and potential failures
    const baseDelay = 10 + Math.random() * 50; // 10-60ms
    const healthFactor = connection.healthScore / 100;
    const actualDelay = baseDelay * (2 - healthFactor); // Unhealthy connections are slower

    await new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate failure based on health score
        const failureChance = (100 - connection.healthScore) / 1000; // 0-10% failure rate
        if (Math.random() < failureChance) {
          reject(new Error('Simulated health check failure'));
        } else {
          resolve(undefined);
        }
      }, actualDelay);
    });
  }

  /**
   * Handle unhealthy connection
   */
  private handleUnhealthyConnection(connection: PoolConnection, error: Error): void {
    connection.consecutiveErrors++;
    connection.errorCount++;
    connection.statistics.healthCheckFailures++;
    connection.healthScore = Math.max(0, connection.healthScore - 15);

    // Mark as unhealthy if too many consecutive errors
    if (connection.consecutiveErrors >= connection.maxConsecutiveErrors) {
      connection.isHealthy = false;
      connection.isActive = false;

      this.logger.warn('Connection marked as unhealthy', {
        connectionId: connection.id,
        providerId: connection.providerId,
        consecutiveErrors: connection.consecutiveErrors,
        healthScore: connection.healthScore,
        error: error.message
      });

      this.emit('connectionUnhealthy', {
        connection,
        error: error.message,
        timestamp: Date.now()
      });

      // Update circuit breaker
      this.recordCircuitBreakerFailure(connection.providerId);
    }

    // Update health bucket placement
    this.updateConnectionHealthBucket(connection);
  }

  // Auto-scaling and Cleanup Methods (integrated into the main class above)
  
  private evaluateScaling(): void {
    const utilization = this.getUtilization();
    
    // Scale up if utilization is high
    if (utilization > this.config.scaleUpThreshold) {
      this.scaleUp();
    }
    
    // Scale down if utilization is low
    else if (utilization < this.config.scaleDownThreshold) {
      this.scaleDown();
    }
  }

  private getUtilization(): number {
    const totalConnections = this.connections.size;
    if (totalConnections === 0) return 0;
    
    const busyConnections = Array.from(this.connections.values())
      .filter(conn => conn.isBusy).length;
    
    return (busyConnections / totalConnections) * 100;
  }

  private async scaleUp(): Promise<void> {
    const now = Date.now();
    
    // Rate limit scaling operations
    if (now - this.lastScaleOperation < this.config.scaleUpDelay) {
      return; // Too soon since last operation
    }
    
    if (this.scaleOperationCount >= this.config.maxScaleOperationsPerMinute) {
      return; // Hit rate limit
    }

    // Find the provider with the highest load
    let targetProviderId: string | null = null;
    let maxLoad = 0;

    for (const [providerId, connectionIds] of this.providerPools) {
      const providerConnections = Array.from(connectionIds)
        .map(id => this.connections.get(id)!)
        .filter(conn => conn.isActive);
      
      const busyCount = providerConnections.filter(conn => conn.isBusy).length;
      const load = busyCount / Math.max(providerConnections.length, 1);
      
      if (load > maxLoad && this.canCreateNewConnection(providerId)) {
        maxLoad = load;
        targetProviderId = providerId;
      }
    }

    if (targetProviderId) {
      try {
        await this.createConnection(targetProviderId);
        this.metrics.scaleUpEvents++;
        this.lastScaleOperation = now;
        this.scaleOperationCount++;
        this.emit('scaledUp', { providerId: targetProviderId, totalConnections: this.connections.size });
      } catch (error) {
        this.emit('scaleUpFailed', { providerId: targetProviderId, error });
      }
    }
  }

  private scaleDown(): void {
    // Find the oldest, idle connection to remove
    const idleConnections = Array.from(this.connections.values())
      .filter(conn => !conn.isBusy && conn.isActive)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    if (idleConnections.length > this.config.minConnections) {
      const connectionToRemove = idleConnections[0];
      if (connectionToRemove) {
        this.destroyConnection(connectionToRemove.id);
        this.metrics.scaleDownEvents++;
        this.emit('scaledDown', { 
          connectionId: connectionToRemove.id, 
          totalConnections: this.connections.size 
        });
      }
    }
  }

  private cleanupExpiredConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const connection of this.connections.values()) {
      // Remove connections that are too old
      if (now - connection.createdAt > this.config.maxConnectionAge) {
        connectionsToRemove.push(connection.id);
      }
      
      // Remove idle connections that have been idle too long
      else if (!connection.isBusy && 
               now - connection.lastUsed > this.config.idleTimeout) {
        connectionsToRemove.push(connection.id);
      }
      
      // Remove unhealthy connections
      else if (!connection.isActive) {
        connectionsToRemove.push(connection.id);
      }
    }

    connectionsToRemove.forEach(id => this.destroyConnection(id));
    
    if (connectionsToRemove.length > 0) {
      this.emit('cleanupCompleted', { removedConnections: connectionsToRemove.length });
    }
  }

  // Metrics and Monitoring - keeping the enhanced updateConnectionMetrics method from above
  private updateConnectionCounts(): void {
    const connections = Array.from(this.connections.values());
    
    this.metrics.totalConnections = connections.length;
    this.metrics.activeConnections = connections.filter(conn => conn.isActive).length;
    this.metrics.busyConnections = connections.filter(conn => conn.isBusy).length;
    this.metrics.idleConnections = connections.filter(conn => !conn.isBusy && conn.isActive).length;
    this.metrics.unhealthyConnections = connections.filter(conn => !conn.isHealthy).length;
    this.metrics.poolUtilization = this.getUtilization();
    
    // Calculate pool health score
    const healthyConnections = connections.filter(c => c.isHealthy);
    this.metrics.poolHealthScore = healthyConnections.length > 0
      ? healthyConnections.reduce((sum, c) => sum + c.healthScore, 0) / healthyConnections.length
      : 0;
  }

  private updateMetrics(event: string, duration?: number): void {
    switch (event) {
      case 'connectionAcquired':
        this.metrics.totalRequests++;
        this.metrics.successfulRequests++;
        if (duration) {
          this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * 0.9) + (duration * 0.1);
        }
        break;
        
      case 'connectionError':
        this.metrics.totalRequests++;
        this.metrics.failedRequests++;
        break;
        
      case 'connectionCreated':
      case 'connectionReleased':
      case 'periodic':
        // Metrics updated in other methods
        break;
    }
  }

  // Public API
  public getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  public getConnectionStatus(): Array<{
    connection: PoolConnection;
    provider: string;
    status: 'active' | 'busy' | 'idle' | 'unhealthy';
  }> {
    return Array.from(this.connections.values()).map(connection => ({
      connection,
      provider: connection.providerId,
      status: !connection.isActive ? 'unhealthy' :
              connection.isBusy ? 'busy' :
              'idle'
    }));
  }

  public getProviderStats(): Map<string, {
    totalConnections: number;
    activeConnections: number;
    busyConnections: number;
    averageResponseTime: number;
    healthScore: number;
  }> {
    const stats = new Map();

    for (const [providerId, connectionIds] of this.providerPools) {
      const connections = Array.from(connectionIds)
        .map(id => this.connections.get(id)!)
        .filter(conn => conn);

      const activeConnections = connections.filter(conn => conn.isActive);
      const busyConnections = connections.filter(conn => conn.isBusy);
      
      const avgResponseTime = activeConnections.length > 0 ?
        activeConnections.reduce((sum, conn) => sum + conn.averageResponseTime, 0) / activeConnections.length : 0;
      
      const avgHealthScore = activeConnections.length > 0 ?
        activeConnections.reduce((sum, conn) => sum + conn.healthScore, 0) / activeConnections.length : 0;

      stats.set(providerId, {
        totalConnections: connections.length,
        activeConnections: activeConnections.length,
        busyConnections: busyConnections.length,
        averageResponseTime: avgResponseTime,
        healthScore: avgHealthScore
      });
    }

    return stats;
  }

  public async warmup(providerId: string, targetConnections: number): Promise<void> {
    const existingConnections = this.providerPools.get(providerId)?.size || 0;
    const connectionsToCreate = Math.max(0, targetConnections - existingConnections);

    const creationPromises = Array.from({ length: connectionsToCreate }, () =>
      this.createConnection(providerId)
    );

    await Promise.allSettled(creationPromises);
    this.emit('warmupCompleted', { providerId, connectionsCreated: connectionsToCreate });
  }

  public drain(): Promise<void> {
    return new Promise((resolve) => {
      // Stop accepting new requests
      this.requestQueue.forEach(request => {
        clearTimeout(request.timeout);
        request.reject(new Error('Pool is draining'));
      });
      this.requestQueue.length = 0;

      // Wait for all busy connections to become idle
      const checkIdle = () => {
        const busyConnections = Array.from(this.connections.values())
          .filter(conn => conn.isBusy);

        if (busyConnections.length === 0) {
          resolve();
        } else {
          setTimeout(checkIdle, 100);
        }
      };

      checkIdle();
    });
  }

  public destroy(): void {
    // Clear all timers
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.scaleEvaluationInterval) clearInterval(this.scaleEvaluationInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.metricsUpdateInterval) clearInterval(this.metricsUpdateInterval);
    if (this.circuitBreakerResetInterval) clearInterval(this.circuitBreakerResetInterval);

    // Reject any pending requests
    this.requestQueue.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Pool destroyed'));
    });

    // Clear all data structures
    this.connections.clear();
    this.providerPools.clear();
    this.requestQueue.length = 0;

    this.removeAllListeners();
  }
}