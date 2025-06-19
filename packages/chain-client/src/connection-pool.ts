import { EventEmitter } from 'events';
import winston from 'winston';
import { RPCManager, RPCRequest, RPCResponse } from './rpc-manager';

export interface ConnectionPoolConfig {
  maxConcurrentConnections: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  healthCheckIntervalMs: number;
  loadBalancingStrategy: 'round-robin' | 'least-connections' | 'weighted' | 'latency-based';
}

export interface PooledConnection {
  id: string;
  chain: string;
  provider: string;
  isActive: boolean;
  isHealthy: boolean;
  createdAt: number;
  lastUsed: number;
  requestCount: number;
  activeRequests: number;
  latency: number;
  errorCount: number;
}

export interface LoadBalancingStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalRequests: number;
  averageLatency: number;
  errorRate: number;
  connectionUtilization: number;
}

export class ConnectionPool extends EventEmitter {
  private logger: winston.Logger;
  private rpcManager: RPCManager;
  private config: ConnectionPoolConfig;
  private connections: Map<string, PooledConnection> = new Map();
  private requestQueues: Map<string, RPCRequest[]> = new Map(); // chain -> queue
  private roundRobinCounters: Map<string, number> = new Map(); // chain -> counter
  private stats: LoadBalancingStats;

  constructor(
    rpcManager: RPCManager,
    config: ConnectionPoolConfig,
    logger: winston.Logger
  ) {
    super();
    this.rpcManager = rpcManager;
    this.config = config;
    this.logger = logger;
    
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalRequests: 0,
      averageLatency: 0,
      errorRate: 0,
      connectionUtilization: 0
    };

    this.initializeConnectionPools();
    this.startHealthChecks();
    this.startIdleConnectionCleanup();
    this.startStatsCollection();
  }

  private initializeConnectionPools(): void {
    // Initialize connection pools for each chain
    const chains = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana'];
    
    for (const chain of chains) {
      this.requestQueues.set(chain, []);
      this.roundRobinCounters.set(chain, 0);
      
      // Create initial connections
      this.createInitialConnections(chain);
    }

    this.logger.info('Connection pools initialized for all chains', {
      chains: chains.length,
      maxConcurrentPerChain: this.config.maxConcurrentConnections
    });
  }

  private async createInitialConnections(chain: string): Promise<void> {
    const initialConnectionCount = Math.min(3, this.config.maxConcurrentConnections);
    
    for (let i = 0; i < initialConnectionCount; i++) {
      try {
        await this.createConnection(chain);
      } catch (error: any) {
        this.logger.warn('Failed to create initial connection', {
          chain,
          attempt: i + 1,
          error: error.message
        });
      }
    }
  }

  private async createConnection(chain: string, preferredProvider?: string): Promise<PooledConnection | null> {
    try {
      // Get optimal provider for this chain
      const providerId = preferredProvider || await this.rpcManager.getOptimalProvider(chain, 'eth_blockNumber');
      
      if (!providerId) {
        throw new Error(`No available providers for chain: ${chain}`);
      }

      const connectionId = `${chain}-${providerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const connection: PooledConnection = {
        id: connectionId,
        chain,
        provider: providerId,
        isActive: true,
        isHealthy: true,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
        activeRequests: 0,
        latency: 0,
        errorCount: 0
      };

      this.connections.set(connectionId, connection);
      this.updateStats();

      this.logger.debug('Connection created', {
        connectionId,
        chain,
        provider: providerId,
        totalConnections: this.connections.size
      });

      this.emit('connectionCreated', connection);
      return connection;
    } catch (error: any) {
      this.logger.error('Failed to create connection', {
        chain,
        preferredProvider,
        error: error.message
      });
      return null;
    }
  }

  // Enhanced request routing with load balancing
  async executeRequest(request: RPCRequest): Promise<RPCResponse> {
    const startTime = Date.now();
    
    try {
      // Select optimal connection based on load balancing strategy
      const connection = await this.selectConnection(request.chain, request.priority);
      
      if (!connection) {
        throw new Error(`No available connections for chain: ${request.chain}`);
      }

      // Update connection metrics
      connection.activeRequests++;
      connection.lastUsed = Date.now();
      
      // Execute request through RPC manager
      const response = await this.rpcManager.makeRequest({
        ...request,
        // Force use of specific provider
        provider: connection.provider
      } as any);

      // Update connection metrics on success
      const latency = Date.now() - startTime;
      this.updateConnectionMetrics(connection, latency, true);
      
      return response;
    } catch (error: any) {
      // Find and update connection metrics on failure
      const connection = Array.from(this.connections.values())
        .find(c => c.chain === request.chain && c.activeRequests > 0);
      
      if (connection) {
        const latency = Date.now() - startTime;
        this.updateConnectionMetrics(connection, latency, false);
      }

      throw error;
    }
  }

  // Smart connection selection based on strategy
  private async selectConnection(chain: string, priority: string = 'medium'): Promise<PooledConnection | null> {
    let availableConnections = Array.from(this.connections.values())
      .filter(conn => 
        conn.chain === chain && 
        conn.isActive && 
        conn.isHealthy &&
        conn.activeRequests < this.getMaxRequestsPerConnection()
      );

    // If no connections available, try to create a new one
    if (availableConnections.length === 0) {
      const newConnection = await this.createConnection(chain);
      if (newConnection) {
        availableConnections = [newConnection];
      } else {
        // As last resort, use any available connection even if overloaded
        availableConnections = Array.from(this.connections.values())
          .filter(conn => conn.chain === chain && conn.isActive && conn.isHealthy);
      }
    }

    if (availableConnections.length === 0) {
      return null;
    }

    // Apply load balancing strategy
    switch (this.config.loadBalancingStrategy) {
      case 'round-robin':
        return this.selectRoundRobin(availableConnections, chain);
      
      case 'least-connections':
        return this.selectLeastConnections(availableConnections);
      
      case 'weighted':
        return this.selectWeighted(availableConnections, priority);
      
      case 'latency-based':
        return this.selectLatencyBased(availableConnections);
      
      default:
        return availableConnections[0];
    }
  }

  private selectRoundRobin(connections: PooledConnection[], chain: string): PooledConnection {
    const counter = this.roundRobinCounters.get(chain) || 0;
    const selected = connections[counter % connections.length];
    this.roundRobinCounters.set(chain, counter + 1);
    return selected;
  }

  private selectLeastConnections(connections: PooledConnection[]): PooledConnection {
    return connections.reduce((best, current) => 
      current.activeRequests < best.activeRequests ? current : best
    );
  }

  private selectWeighted(connections: PooledConnection[], priority: string): PooledConnection {
    // Weight based on provider quality and current load
    const weightedConnections = connections.map(conn => {
      let weight = 100; // Base weight
      
      // Adjust for active requests (less load = higher weight)
      weight -= conn.activeRequests * 20;
      
      // Adjust for latency (lower latency = higher weight)
      weight -= Math.min(conn.latency / 10, 50);
      
      // Adjust for error rate
      const errorRate = conn.errorCount / Math.max(conn.requestCount, 1);
      weight -= errorRate * 100;
      
      // Bonus for premium providers if high priority
      if (priority === 'critical' || priority === 'high') {
        const providerStatus = this.rpcManager.getProviderStatus(conn.chain)
          .find(p => p.provider.id === conn.provider);
        if (providerStatus?.provider.tier === 'premium') {
          weight += 30;
        }
      }
      
      return { connection: conn, weight: Math.max(weight, 1) };
    });

    // Select based on weighted random
    const totalWeight = weightedConnections.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of weightedConnections) {
      random -= item.weight;
      if (random <= 0) {
        return item.connection;
      }
    }
    
    return weightedConnections[0].connection;
  }

  private selectLatencyBased(connections: PooledConnection[]): PooledConnection {
    // Sort by latency (ascending) and select from top performers
    const sortedByLatency = connections.sort((a, b) => a.latency - b.latency);
    
    // Select from top 3 performers with some randomization to avoid overloading single connection
    const topPerformers = sortedByLatency.slice(0, Math.min(3, sortedByLatency.length));
    return topPerformers[Math.floor(Math.random() * topPerformers.length)];
  }

  private updateConnectionMetrics(connection: PooledConnection, latency: number, success: boolean): void {
    connection.activeRequests = Math.max(0, connection.activeRequests - 1);
    connection.requestCount++;
    
    // Update latency with exponential moving average
    connection.latency = connection.latency === 0 
      ? latency 
      : (connection.latency * 0.8) + (latency * 0.2);
    
    if (!success) {
      connection.errorCount++;
      
      // Mark as unhealthy if error rate is too high
      const errorRate = connection.errorCount / connection.requestCount;
      if (errorRate > 0.1 && connection.requestCount > 10) {
        connection.isHealthy = false;
        this.logger.warn('Connection marked as unhealthy due to high error rate', {
          connectionId: connection.id,
          errorRate: errorRate.toFixed(3),
          errorCount: connection.errorCount,
          requestCount: connection.requestCount
        });
      }
    }

    this.updateStats();
  }

  private getMaxRequestsPerConnection(): number {
    // Dynamic limit based on total pool size and configuration
    const totalConnections = this.connections.size;
    const baseLimit = 10;
    
    // Allow more concurrent requests if we have fewer connections
    return totalConnections < 5 ? baseLimit * 2 : baseLimit;
  }

  // Health check system for connections
  private startHealthChecks(): void {
    const healthCheck = async () => {
      const unhealthyConnections: string[] = [];
      
      for (const [connectionId, connection] of this.connections.entries()) {
        try {
          // Test connection with a simple request
          const testRequest: RPCRequest = {
            id: `health-${Date.now()}`,
            method: connection.chain === 'solana' ? 'getHealth' : 'eth_blockNumber',
            params: [],
            chain: connection.chain,
            priority: 'low',
            timestamp: Date.now()
          };

          const startTime = Date.now();
          await this.rpcManager.makeRequest(testRequest);
          const latency = Date.now() - startTime;

          // Update health metrics
          connection.isHealthy = true;
          connection.latency = (connection.latency * 0.9) + (latency * 0.1);

        } catch (error: any) {
          connection.errorCount++;
          
          // Mark as unhealthy after multiple failures
          if (connection.errorCount > 5) {
            connection.isHealthy = false;
            unhealthyConnections.push(connectionId);
            
            this.logger.warn('Connection health check failed', {
              connectionId: connection.id,
              chain: connection.chain,
              provider: connection.provider,
              errorCount: connection.errorCount
            });
          }
        }
      }

      // Remove persistently unhealthy connections
      for (const connectionId of unhealthyConnections) {
        this.removeConnection(connectionId);
      }

      this.updateStats();
    };

    // Run health checks every interval
    setInterval(healthCheck, this.config.healthCheckIntervalMs);
    
    // Initial health check after 10 seconds
    setTimeout(healthCheck, 10000);
  }

  private startIdleConnectionCleanup(): void {
    const cleanup = () => {
      const now = Date.now();
      const connectionsToRemove: string[] = [];

      for (const [connectionId, connection] of this.connections.entries()) {
        // Remove idle connections
        const idleTime = now - connection.lastUsed;
        const isIdle = idleTime > this.config.idleTimeoutMs;
        const hasMinConnections = this.getConnectionCountForChain(connection.chain) > 2;

        if (isIdle && hasMinConnections && connection.activeRequests === 0) {
          connectionsToRemove.push(connectionId);
        }
      }

      for (const connectionId of connectionsToRemove) {
        this.removeConnection(connectionId);
        this.logger.debug('Removed idle connection', { connectionId });
      }
    };

    // Run cleanup every 5 minutes
    setInterval(cleanup, 5 * 60 * 1000);
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.emit('connectionRemoved', connection);
      this.updateStats();
    }
  }

  private getConnectionCountForChain(chain: string): number {
    return Array.from(this.connections.values())
      .filter(conn => conn.chain === chain && conn.isActive).length;
  }

  private updateStats(): void {
    const allConnections = Array.from(this.connections.values());
    
    this.stats.totalConnections = allConnections.length;
    this.stats.activeConnections = allConnections.filter(c => c.isActive && c.activeRequests > 0).length;
    this.stats.idleConnections = allConnections.filter(c => c.isActive && c.activeRequests === 0).length;
    
    const totalRequests = allConnections.reduce((sum, c) => sum + c.requestCount, 0);
    const totalErrors = allConnections.reduce((sum, c) => sum + c.errorCount, 0);
    const totalLatency = allConnections.reduce((sum, c) => sum + (c.latency * c.requestCount), 0);
    
    this.stats.totalRequests = totalRequests;
    this.stats.errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    this.stats.averageLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
    
    const maxPossibleActiveRequests = allConnections.length * this.getMaxRequestsPerConnection();
    const currentActiveRequests = allConnections.reduce((sum, c) => sum + c.activeRequests, 0);
    this.stats.connectionUtilization = maxPossibleActiveRequests > 0 
      ? (currentActiveRequests / maxPossibleActiveRequests) * 100 
      : 0;
  }

  private startStatsCollection(): void {
    // Log detailed stats every 10 minutes
    setInterval(() => {
      const chainStats = this.getChainStats();
      
      this.logger.info('Connection Pool Statistics', {
        ...this.stats,
        chainBreakdown: chainStats
      });
    }, 10 * 60 * 1000);
  }

  private getChainStats(): Record<string, any> {
    const chainStats: Record<string, any> = {};
    
    for (const connection of this.connections.values()) {
      if (!chainStats[connection.chain]) {
        chainStats[connection.chain] = {
          totalConnections: 0,
          activeConnections: 0,
          healthyConnections: 0,
          totalRequests: 0,
          averageLatency: 0,
          errorRate: 0
        };
      }
      
      const stats = chainStats[connection.chain];
      stats.totalConnections++;
      
      if (connection.activeRequests > 0) stats.activeConnections++;
      if (connection.isHealthy) stats.healthyConnections++;
      
      stats.totalRequests += connection.requestCount;
      stats.averageLatency += connection.latency;
      stats.errorRate += connection.errorCount;
    }
    
    // Calculate averages
    for (const chainStat of Object.values(chainStats) as any[]) {
      if (chainStat.totalConnections > 0) {
        chainStat.averageLatency = chainStat.averageLatency / chainStat.totalConnections;
        chainStat.errorRate = chainStat.totalRequests > 0 
          ? (chainStat.errorRate / chainStat.totalRequests) * 100 
          : 0;
      }
    }
    
    return chainStats;
  }

  // Public API methods
  getStats(): LoadBalancingStats {
    return { ...this.stats };
  }

  getConnectionStats(): PooledConnection[] {
    return Array.from(this.connections.values()).map(conn => ({ ...conn }));
  }

  getConnectionStatsForChain(chain: string): PooledConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.chain === chain)
      .map(conn => ({ ...conn }));
  }

  async scaleConnections(chain: string, targetCount: number): Promise<void> {
    const currentCount = this.getConnectionCountForChain(chain);
    
    if (targetCount > currentCount) {
      // Scale up
      const connectionsToAdd = Math.min(
        targetCount - currentCount,
        this.config.maxConcurrentConnections - currentCount
      );
      
      for (let i = 0; i < connectionsToAdd; i++) {
        await this.createConnection(chain);
      }
      
      this.logger.info('Scaled up connections', {
        chain,
        previousCount: currentCount,
        newCount: this.getConnectionCountForChain(chain),
        targetCount
      });
    } else if (targetCount < currentCount) {
      // Scale down
      const connectionsToRemove = currentCount - targetCount;
      const chainConnections = Array.from(this.connections.values())
        .filter(conn => conn.chain === chain && conn.activeRequests === 0)
        .sort((a, b) => a.lastUsed - b.lastUsed); // Remove least recently used first
      
      for (let i = 0; i < Math.min(connectionsToRemove, chainConnections.length); i++) {
        this.removeConnection(chainConnections[i].id);
      }
      
      this.logger.info('Scaled down connections', {
        chain,
        previousCount: currentCount,
        newCount: this.getConnectionCountForChain(chain),
        targetCount
      });
    }
  }

  async optimizeForLatency(chain: string): Promise<void> {
    // Run latency optimization on the RPC manager
    await this.rpcManager.optimizeForLatency(chain);
    
    // Recreate connections to use optimized providers
    const chainConnections = Array.from(this.connections.values())
      .filter(conn => conn.chain === chain);
    
    // Remove half of the connections and let them be recreated with better providers
    const connectionsToRecreate = Math.floor(chainConnections.length / 2);
    const oldestConnections = chainConnections
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, connectionsToRecreate);
    
    for (const connection of oldestConnections) {
      this.removeConnection(connection.id);
    }
    
    // Create new connections which will use the optimized providers
    for (let i = 0; i < connectionsToRecreate; i++) {
      await this.createConnection(chain);
    }
    
    this.logger.info('Connection pool optimized for latency', {
      chain,
      recreatedConnections: connectionsToRecreate
    });
  }

  async close(): Promise<void> {
    // Clear all connections
    this.connections.clear();
    this.requestQueues.clear();
    this.roundRobinCounters.clear();
    
    this.logger.info('Connection pool closed');
  }
}