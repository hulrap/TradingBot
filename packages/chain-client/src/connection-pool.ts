import { EventEmitter } from 'events';
import winston from 'winston';
import { RPCManager, RPCRequest, RPCResponse } from './rpc-manager';

export interface PoolConnection {
  id: string;
  providerId: string;
  isActive: boolean;
  isBusy: boolean;
  lastUsed: number;
  createdAt: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  consecutiveErrors: number;
  maxConsecutiveErrors: number;
  healthScore: number; // 0-100
}

export interface LoadBalancer {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'latency-based';
  weights?: Map<string, number>;
  currentIndex?: number;
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  maxConnectionAge: number; // milliseconds
  idleTimeout: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  maxConsecutiveErrors: number;
  connectionTimeout: number; // milliseconds
  retryDelay: number; // milliseconds
  scaleUpThreshold: number; // percentage of busy connections
  scaleDownThreshold: number; // percentage of idle connections
  loadBalancer: LoadBalancer;
}

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  busyConnections: number;
  idleConnections: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  poolUtilization: number; // percentage
  connectionsCreated: number;
  connectionsDestroyed: number;
  healthChecksPassed: number;
  healthChecksFailed: number;
}

export class ConnectionPool extends EventEmitter {
  private logger: winston.Logger;
  private rpcManager: RPCManager;
  private config: ConnectionPoolConfig;
  private connections: Map<string, PoolConnection> = new Map();
  private providerPools: Map<string, Set<string>> = new Map();
  private requestQueue: Array<{
    resolve: (connection: PoolConnection) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    priority: number;
    timestamp: number;
  }> = [];
  
  private metrics: PoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    busyConnections: 0,
    idleConnections: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    poolUtilization: 0,
    connectionsCreated: 0,
    connectionsDestroyed: 0,
    healthChecksPassed: 0,
    healthChecksFailed: 0
  };

  private healthCheckInterval?: NodeJS.Timeout;
  private scaleTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    rpcManager: RPCManager,
    config: ConnectionPoolConfig,
    logger: winston.Logger
  ) {
    super();
    this.rpcManager = rpcManager;
    this.config = config;
    this.logger = logger;
    
    this.startHealthChecks();
    this.startAutoScaling();
    this.startCleanupTimer();
  }

  // Connection Management
  public async getConnection(providerId: string, priority: number = 1): Promise<PoolConnection> {
    const startTime = Date.now();
    
    try {
      // Try to get an existing idle connection
      const existingConnection = this.getIdleConnection(providerId);
      if (existingConnection) {
        this.markConnectionBusy(existingConnection);
        this.updateMetrics('connectionAcquired', Date.now() - startTime);
        return existingConnection;
      }

      // Check if we can create a new connection
      if (this.canCreateNewConnection(providerId)) {
        const newConnection = await this.createConnection(providerId);
        this.markConnectionBusy(newConnection);
        this.updateMetrics('connectionCreated', Date.now() - startTime);
        return newConnection;
      }

      // Queue the request if pool is full
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = this.requestQueue.findIndex(item => item.resolve === resolve);
          if (index !== -1) {
            this.requestQueue.splice(index, 1);
          }
          reject(new Error(`Connection request timeout after ${this.config.connectionTimeout}ms`));
        }, this.config.connectionTimeout);

        this.requestQueue.push({
          resolve,
          reject,
          timeout,
          priority,
          timestamp: Date.now()
        });

        // Sort queue by priority (higher priority first) and timestamp
        this.requestQueue.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return a.timestamp - b.timestamp;
        });
      });

    } catch (error) {
      this.updateMetrics('connectionError', Date.now() - startTime);
      throw error;
    }
  }

  public releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    this.markConnectionIdle(connection);
    this.processQueue();
    this.updateMetrics('connectionReleased');
  }

  public async destroyConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from pools
    const providerPool = this.providerPools.get(connection.providerId);
    if (providerPool) {
      providerPool.delete(connectionId);
    }

    // Remove from connections
    this.connections.delete(connectionId);

    // Update metrics
    this.metrics.connectionsDestroyed++;
    this.updateConnectionCounts();

    this.emit('connectionDestroyed', connection);

    // Process any queued requests
    this.processQueue();
  }

  // Load Balancing
  public selectConnectionByStrategy(providerId: string): PoolConnection | null {
    const providerPool = this.providerPools.get(providerId);
    if (!providerPool || providerPool.size === 0) return null;

    const availableConnections = Array.from(providerPool)
      .map(id => this.connections.get(id)!)
      .filter(conn => conn.isActive && !conn.isBusy && conn.consecutiveErrors < conn.maxConsecutiveErrors);

    if (availableConnections.length === 0) return null;

    switch (this.config.loadBalancer.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(availableConnections);
      
      case 'least-connections':
        return this.leastConnectionsSelection(availableConnections);
      
      case 'weighted':
        return this.weightedSelection(availableConnections);
      
      case 'latency-based':
        return this.latencyBasedSelection(availableConnections);
      
      default:
        return availableConnections[0];
    }
  }

  private roundRobinSelection(connections: PoolConnection[]): PoolConnection {
    const currentIndex = this.config.loadBalancer.currentIndex || 0;
    const selectedConnection = connections[currentIndex % connections.length];
    this.config.loadBalancer.currentIndex = (currentIndex + 1) % connections.length;
    return selectedConnection;
  }

  private leastConnectionsSelection(connections: PoolConnection[]): PoolConnection {
    return connections.reduce((least, current) => 
      current.requestCount < least.requestCount ? current : least
    );
  }

  private weightedSelection(connections: PoolConnection[]): PoolConnection {
    const weights = this.config.loadBalancer.weights || new Map();
    const weightedConnections = connections.map(conn => ({
      connection: conn,
      weight: weights.get(conn.providerId) || 1
    }));

    const totalWeight = weightedConnections.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of weightedConnections) {
      random -= item.weight;
      if (random <= 0) {
        return item.connection;
      }
    }

    return connections[0];
  }

  private latencyBasedSelection(connections: PoolConnection[]): PoolConnection {
    // Sort by average response time (lower is better) and health score (higher is better)
    return connections.sort((a, b) => {
      const latencyDiff = a.averageResponseTime - b.averageResponseTime;
      if (Math.abs(latencyDiff) > 10) { // 10ms threshold
        return latencyDiff;
      }
      return b.healthScore - a.healthScore;
    })[0];
  }

  // Connection Creation and Management
  private async createConnection(providerId: string): Promise<PoolConnection> {
    const connectionId = `conn_${providerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const connection: PoolConnection = {
      id: connectionId,
      providerId,
      isActive: true,
      isBusy: false,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      consecutiveErrors: 0,
      maxConsecutiveErrors: this.config.maxConsecutiveErrors,
      healthScore: 100
    };

    this.connections.set(connectionId, connection);

    // Add to provider pool
    if (!this.providerPools.has(providerId)) {
      this.providerPools.set(providerId, new Set());
    }
    this.providerPools.get(providerId)!.add(connectionId);

    // Update metrics
    this.metrics.connectionsCreated++;
    this.updateConnectionCounts();

    this.emit('connectionCreated', connection);

    return connection;
  }

  private getIdleConnection(providerId: string): PoolConnection | null {
    return this.selectConnectionByStrategy(providerId);
  }

  private canCreateNewConnection(providerId: string): boolean {
    const currentConnections = this.connections.size;
    const providerConnections = this.providerPools.get(providerId)?.size || 0;
    
    return currentConnections < this.config.maxConnections && 
           providerConnections < this.config.maxConnections;
  }

  private markConnectionBusy(connection: PoolConnection): void {
    connection.isBusy = true;
    connection.lastUsed = Date.now();
    connection.requestCount++;
    this.updateConnectionCounts();
  }

  private markConnectionIdle(connection: PoolConnection): void {
    connection.isBusy = false;
    this.updateConnectionCounts();
  }

  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];
      
      // Find any available connection (round-robin across providers)
      let availableConnection: PoolConnection | null = null;
      
      for (const [providerId] of this.providerPools) {
        availableConnection = this.getIdleConnection(providerId);
        if (availableConnection) break;
      }

      if (!availableConnection) {
        // Try to create a new connection for any provider
        let newConnection: PoolConnection | null = null;
        
        for (const [providerId] of this.providerPools) {
          if (this.canCreateNewConnection(providerId)) {
            try {
              newConnection = await this.createConnection(providerId);
              break;
            } catch (error) {
              continue;
            }
          }
        }

        if (!newConnection) {
          break; // No connections available, stop processing queue
        }

        availableConnection = newConnection;
      }

      // Remove request from queue and fulfill it
      this.requestQueue.shift();
      clearTimeout(request.timeout);
      
      this.markConnectionBusy(availableConnection);
      request.resolve(availableConnection);
    }
  }

  // Health Monitoring
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.connections.values()).map(async connection => {
      try {
        const startTime = Date.now();
        
        // Simulate health check (in real implementation, this would be an actual request)
        await this.simulateHealthCheck(connection);
        
        const responseTime = Date.now() - startTime;
        
        // Update connection health metrics
        connection.averageResponseTime = (connection.averageResponseTime * 0.8) + (responseTime * 0.2);
        connection.consecutiveErrors = 0;
        connection.healthScore = Math.min(100, connection.healthScore + 10);
        
        this.metrics.healthChecksPassed++;
        
      } catch (error) {
        connection.consecutiveErrors++;
        connection.errorCount++;
        connection.healthScore = Math.max(0, connection.healthScore - 20);
        
        this.metrics.healthChecksFailed++;
        
        // Deactivate connection if too many consecutive errors
        if (connection.consecutiveErrors >= connection.maxConsecutiveErrors) {
          connection.isActive = false;
          this.emit('connectionUnhealthy', connection);
        }
      }
    });

    await Promise.allSettled(healthCheckPromises);
    this.updateConnectionCounts();
  }

  private async simulateHealthCheck(connection: PoolConnection): Promise<void> {
    // Simulate health check delay and potential failure
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        // 95% success rate for healthy connections
        if (Math.random() < 0.95 || connection.healthScore > 80) {
          resolve(undefined);
        } else {
          reject(new Error('Health check failed'));
        }
      }, Math.random() * 100 + 10); // 10-110ms delay
    });
  }

  // Auto-scaling
  private startAutoScaling(): void {
    this.scaleTimer = setInterval(() => {
      this.evaluateScaling();
    }, 10000); // Check every 10 seconds
  }

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
      this.destroyConnection(connectionToRemove.id);
      this.emit('scaledDown', { 
        connectionId: connectionToRemove.id, 
        totalConnections: this.connections.size 
      });
    }
  }

  // Cleanup
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredConnections();
    }, 60000); // Check every minute
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

  // Metrics and Monitoring
  private updateConnectionCounts(): void {
    const connections = Array.from(this.connections.values());
    
    this.metrics.totalConnections = connections.length;
    this.metrics.activeConnections = connections.filter(conn => conn.isActive).length;
    this.metrics.busyConnections = connections.filter(conn => conn.isBusy).length;
    this.metrics.idleConnections = connections.filter(conn => !conn.isBusy && conn.isActive).length;
    this.metrics.poolUtilization = this.getUtilization();
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
    if (this.scaleTimer) clearInterval(this.scaleTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

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