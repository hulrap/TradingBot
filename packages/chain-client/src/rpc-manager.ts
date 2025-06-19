import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import WebSocket from 'ws';
import winston from 'winston';

export interface RPCProvider {
  id: string;
  name: string;
  tier: 'premium' | 'standard' | 'fallback';
  url: string;
  wsUrl?: string;
  apiKey?: string;
  rateLimit: number; // requests per second
  maxConnections: number;
  cost: number; // cost per 1000 requests
  latency: number; // average latency in ms
  successRate: number; // success rate percentage
  isActive: boolean;
  priority: number; // higher number = higher priority
}

export interface RPCEndpoint {
  provider: RPCProvider;
  isHealthy: boolean;
  latency: number;
  successRate: number;
  lastUsed: number;
  requestCount: number;
  errorCount: number;
  consecutiveErrors: number;
  isBlacklisted: boolean;
  blacklistUntil?: number;
}

export interface RPCRequest {
  id: string;
  method: string;
  params: any[];
  chain: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retries?: number;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface RPCResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  latency: number;
  provider: string;
}

export interface RPCMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  successRate: number;
  costToday: number;
  providerStats: Map<string, {
    requests: number;
    errors: number;
    latency: number;
    cost: number;
  }>;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  costToday: number;
  blacklistedUntil?: number;
  lastHealthCheck: number;
  isHealthy: boolean;
}

export interface RPCManagerConfig {
  providers: RPCProvider[];
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
  blacklistDuration: number;
  requestTimeout: number;
  dailyBudget: number; // USD
  costTrackingWindow: number; // hours
}

export class RPCManager extends EventEmitter {
  private logger: winston.Logger;
  private providers: Map<string, RPCProvider> = new Map();
  private endpoints: Map<string, RPCEndpoint> = new Map();
  private requestQueue: Map<string, RPCRequest[]> = new Map(); // chain -> requests
  private responseCache: Map<string, { response: any; expiry: number }> = new Map();
  private axiosInstances: Map<string, AxiosInstance> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  private isProcessingQueue = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private costTracker: Map<string, { timestamp: number; cost: number }[]> = new Map();

  constructor(logger: winston.Logger, private config: RPCManagerConfig) {
    super();
    this.logger = logger;
    this.setupDefaultProviders();
    this.startHealthChecks();
    this.startQueueProcessor();
    this.startMetricsCollection();
    this.startCostTracking();
  }

  private setupDefaultProviders(): void {
    this.config.providers.forEach(provider => {
      this.providers.set(provider.id, provider);
      
      // Initialize metrics
      this.metrics.set(provider.id, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: provider.latency,
        costToday: 0,
        lastHealthCheck: Date.now(),
        isHealthy: true
      });

      // Initialize HTTP client
      const httpClient = axios.create({
        baseURL: provider.url,
        timeout: this.config.requestTimeout,
        headers: provider.apiKey ? {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        }
      });

      // Add response interceptor for metrics
      httpClient.interceptors.response.use(
        response => {
          this.updateMetrics(provider.id, true, response.config.metadata?.startTime);
          return response;
        },
        error => {
          this.updateMetrics(provider.id, false, error.config?.metadata?.startTime);
          return Promise.reject(error);
        }
      );

      this.axiosInstances.set(provider.id, httpClient);
      this.costTracker.set(provider.id, []);

      // Initialize request queue for this chain
      if (!this.requestQueue.has(provider.chain)) {
        this.requestQueue.set(provider.chain, []);
      }

      // Initialize provider stats
      this.metrics.get(provider.id)!.requests = 0;
      this.metrics.get(provider.id)!.errors = 0;
      this.metrics.get(provider.id)!.latency = 0;
      this.metrics.get(provider.id)!.cost = 0;

      this.logger.info('RPC provider added', {
        id: provider.id,
        name: provider.name,
        chain: provider.chain,
        tier: provider.tier,
        priority: provider.priority
      });
    });

    this.logger.info('Default RPC providers configured', {
      totalProviders: this.providers.size,
      chains: Array.from(new Set(Array.from(this.providers.values()).map(p => p.chain)))
    });
  }

  private updateMetrics(providerId: string, success: boolean, startTime?: number): void {
    const metrics = this.metrics.get(providerId);
    if (!metrics) return;

    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    if (startTime) {
      const latency = Date.now() - startTime;
      metrics.averageLatency = (metrics.averageLatency + latency) / 2;
    }

    metrics.isHealthy = (metrics.successfulRequests / metrics.totalRequests) > 0.8;
    this.metrics.set(providerId, metrics);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.providers.values()).map(async provider => {
      try {
        const client = this.axiosInstances.get(provider.id);
        if (!client) return;

        const startTime = Date.now();
        await client.post('', {
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        });

        const latency = Date.now() - startTime;
        const metrics = this.metrics.get(provider.id)!;
        metrics.lastHealthCheck = Date.now();
        metrics.isHealthy = true;
        metrics.averageLatency = (metrics.averageLatency + latency) / 2;

        // Update provider latency
        provider.latency = metrics.averageLatency;

        this.emit('healthCheck', { providerId: provider.id, healthy: true, latency });
      } catch (error) {
        const metrics = this.metrics.get(provider.id)!;
        metrics.isHealthy = false;
        metrics.lastHealthCheck = Date.now();

        this.emit('healthCheck', { providerId: provider.id, healthy: false, error });
        
        // Temporarily blacklist provider
        this.blacklistProvider(provider.id);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  private blacklistProvider(providerId: string): void {
    const metrics = this.metrics.get(providerId);
    if (metrics) {
      metrics.blacklistedUntil = Date.now() + this.config.blacklistDuration;
      this.emit('providerBlacklisted', { providerId, until: metrics.blacklistedUntil });
    }
  }

  private startCostTracking(): void {
    setInterval(() => {
      this.cleanupOldCostData();
    }, 60 * 60 * 1000); // Every hour
  }

  private cleanupOldCostData(): void {
    const cutoff = Date.now() - (this.config.costTrackingWindow * 60 * 60 * 1000);
    
    this.costTracker.forEach((costs, providerId) => {
      const filteredCosts = costs.filter(entry => entry.timestamp > cutoff);
      this.costTracker.set(providerId, filteredCosts);
    });
  }

  private addCostEntry(providerId: string, cost: number): void {
    const costs = this.costTracker.get(providerId) || [];
    costs.push({ timestamp: Date.now(), cost });
    this.costTracker.set(providerId, costs);

    // Update daily cost in metrics
    const metrics = this.metrics.get(providerId)!;
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayCosts = costs.filter(entry => entry.timestamp >= todayStart);
    metrics.costToday = todayCosts.reduce((total, entry) => total + entry.cost, 0);
  }

  private getAvailableProviders(): RPCProvider[] {
    const now = Date.now();
    
    return Array.from(this.providers.values())
      .filter(provider => {
        const metrics = this.metrics.get(provider.id)!;
        
        // Filter out inactive providers
        if (!provider.isActive) return false;
        
        // Filter out blacklisted providers
        if (metrics.blacklistedUntil && metrics.blacklistedUntil > now) return false;
        
        // Filter out unhealthy providers
        if (!metrics.isHealthy) return false;
        
        // Filter out providers over budget
        if (metrics.costToday >= this.config.dailyBudget) return false;
        
        return true;
      })
      .sort((a, b) => {
        // Sort by tier priority first, then by success rate and latency
        const tierWeight = { premium: 3, standard: 2, fallback: 1 };
        const aTierScore = tierWeight[a.tier] * 1000;
        const bTierScore = tierWeight[b.tier] * 1000;
        
        const aMetrics = this.metrics.get(a.id)!;
        const bMetrics = this.metrics.get(b.id)!;
        
        const aScore = aTierScore + a.priority + (aMetrics.successfulRequests / aMetrics.totalRequests) * 100 - a.latency;
        const bScore = bTierScore + b.priority + (bMetrics.successfulRequests / bMetrics.totalRequests) * 100 - b.latency;
        
        return bScore - aScore;
      });
  }

  public async makeRequest(method: string, params: any[] = [], options: {
    timeout?: number;
    retries?: number;
    preferredProvider?: string;
  } = {}): Promise<RPCResponse> {
    const request: RPCRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method,
      params,
      chain: '',
      priority: 'medium',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.retries || this.config.maxRetries
    };

    return this.executeRequest(request, options);
  }

  private async executeRequest(request: RPCRequest, options: any): Promise<RPCResponse> {
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No available RPC providers');
    }

    // Use preferred provider if specified and available
    let targetProvider = availableProviders[0];
    if (options.preferredProvider) {
      const preferred = availableProviders.find(p => p.id === options.preferredProvider);
      if (preferred) targetProvider = preferred;
    }

    const startTime = Date.now();

    try {
      const client = this.axiosInstances.get(targetProvider.id)!;
      
      // Add metadata for metrics
      const config: AxiosRequestConfig = {
        metadata: { startTime }
      };

      const response = await client.post('', {
        jsonrpc: '2.0',
        method: request.method,
        params: request.params,
        id: request.id
      }, config);

      const latency = Date.now() - startTime;

      // Track cost
      const requestCost = (targetProvider.cost / 1000);
      this.addCostEntry(targetProvider.id, requestCost);

      const rpcResponse: RPCResponse = {
        id: request.id,
        result: response.data.result,
        error: response.data.error,
        latency,
        provider: targetProvider.id
      };

      this.emit('requestCompleted', { request, response: rpcResponse, provider: targetProvider.id });

      if (rpcResponse.error) {
        throw new Error(`RPC Error: ${rpcResponse.error.message}`);
      }

      return rpcResponse;

    } catch (error) {
      this.emit('requestFailed', { request, error, provider: targetProvider.id });

      // Retry with different provider if possible
      if (request.retryCount < request.maxRetries) {
        request.retryCount++;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, request.retryCount)));
        
        // Temporarily blacklist failed provider for this request
        const filteredProviders = availableProviders.filter(p => p.id !== targetProvider.id);
        if (filteredProviders.length > 0) {
          return this.executeRequest(request, { ...options, preferredProvider: undefined });
        }
      }

      throw error;
    }
  }

  public async batchRequest(requests: Array<{ method: string; params: any[] }>): Promise<RPCResponse[]> {
    const batchPromises = requests.map(req => this.makeRequest(req.method, req.params));
    return Promise.all(batchPromises);
  }

  public getProviderMetrics(providerId?: string): ProviderMetrics | Map<string, ProviderMetrics> {
    if (providerId) {
      const metrics = this.metrics.get(providerId);
      if (!metrics) throw new Error(`Provider ${providerId} not found`);
      return metrics;
    }
    return new Map(this.metrics);
  }

  public getProviderStatus(): Array<{ provider: RPCProvider; metrics: ProviderMetrics }> {
    return Array.from(this.providers.values()).map(provider => ({
      provider,
      metrics: this.metrics.get(provider.id)!
    }));
  }

  public async addProvider(provider: RPCProvider): Promise<void> {
    this.providers.set(provider.id, provider);
    
    // Initialize metrics
    this.metrics.set(provider.id, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: provider.latency,
      costToday: 0,
      lastHealthCheck: Date.now(),
      isHealthy: true
    });

    // Initialize HTTP client
    const httpClient = axios.create({
      baseURL: provider.url,
      timeout: this.config.requestTimeout,
      headers: provider.apiKey ? {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    });

    this.axiosInstances.set(provider.id, httpClient);
    this.costTracker.set(provider.id, []);

    this.emit('providerAdded', provider);
  }

  public removeProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.metrics.delete(providerId);
    this.axiosInstances.delete(providerId);
    this.costTracker.delete(providerId);

    // Close WebSocket if exists
    const ws = this.wsConnections.get(providerId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(providerId);
    }

    this.emit('providerRemoved', providerId);
  }

  public setProviderActive(providerId: string, active: boolean): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.isActive = active;
      this.emit('providerStatusChanged', { providerId, active });
    }
  }

  public getTotalCosts(): { daily: number; window: number; breakdown: Record<string, number> } {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const windowStart = now - (this.config.costTrackingWindow * 60 * 60 * 1000);

    let dailyTotal = 0;
    let windowTotal = 0;
    const breakdown: Record<string, number> = {};

    this.costTracker.forEach((costs, providerId) => {
      const dailyCosts = costs.filter(entry => entry.timestamp >= todayStart);
      const windowCosts = costs.filter(entry => entry.timestamp >= windowStart);

      const dailySum = dailyCosts.reduce((sum, entry) => sum + entry.cost, 0);
      const windowSum = windowCosts.reduce((sum, entry) => sum + entry.cost, 0);

      dailyTotal += dailySum;
      windowTotal += windowSum;
      breakdown[providerId] = dailySum;
    });

    return { daily: dailyTotal, window: windowTotal, breakdown };
  }

  public optimizeForCost(): void {
    // Reorder providers to prioritize cost-effective ones
    const providers = Array.from(this.providers.values());
    providers.forEach(provider => {
      const metrics = this.metrics.get(provider.id)!;
      const costEfficiency = metrics.successfulRequests / (metrics.costToday + 1);
      provider.priority = Math.floor(costEfficiency * 100);
    });

    this.emit('optimizedForCost');
  }

  public optimizeForSpeed(): void {
    // Reorder providers to prioritize low-latency ones
    const providers = Array.from(this.providers.values());
    providers.forEach(provider => {
      const metrics = this.metrics.get(provider.id)!;
      provider.priority = Math.floor(1000 / (metrics.averageLatency + 1));
    });

    this.emit('optimizedForSpeed');
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all WebSocket connections
    this.wsConnections.forEach(ws => ws.close());
    this.wsConnections.clear();

    // Clear all data
    this.providers.clear();
    this.metrics.clear();
    this.axiosInstances.clear();
    this.costTracker.clear();
    this.requestQueue.clear();

    this.removeAllListeners();
  }

  // WebSocket Connection Management
  async createWebSocketConnection(chain: string): Promise<WebSocket | null> {
    const endpoint = this.selectBestProvider(chain, 'high');
    if (!endpoint || !endpoint.provider.wsUrl) {
      this.logger.warn('No WebSocket endpoint available for chain', { chain });
      return null;
    }

    const wsKey = `${chain}-${endpoint.provider.id}`;
    
    // Close existing connection if any
    if (this.wsConnections.has(wsKey)) {
      this.wsConnections.get(wsKey)?.close();
    }

    try {
      const ws = new WebSocket(endpoint.provider.wsUrl);
      
      ws.on('open', () => {
        this.logger.info('WebSocket connected', {
          chain,
          provider: endpoint.provider.id
        });
        this.emit('wsConnected', { chain, provider: endpoint.provider.id });
      });

      ws.on('message', (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit('wsMessage', { chain, provider: endpoint.provider.id, message });
        } catch (error) {
          this.logger.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('error', (error: any) => {
        this.logger.error('WebSocket error', {
          chain,
          provider: endpoint.provider.id,
          error: error.message
        });
        this.emit('wsError', { chain, provider: endpoint.provider.id, error });
      });

      ws.on('close', () => {
        this.logger.warn('WebSocket disconnected', {
          chain,
          provider: endpoint.provider.id
        });
        this.wsConnections.delete(wsKey);
        this.emit('wsDisconnected', { chain, provider: endpoint.provider.id });
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          this.createWebSocketConnection(chain);
        }, 5000);
      });

      this.wsConnections.set(wsKey, ws);
      return ws;
    } catch (error: any) {
      this.logger.error('Failed to create WebSocket connection', {
        chain,
        provider: endpoint.provider.id,
        error: error.message
      });
      return null;
    }
  }

  // Queue-based request processing for rate limiting
  async queueRequest(request: RPCRequest): Promise<RPCResponse> {
    return new Promise((resolve, reject) => {
      const queue = this.requestQueue.get(request.chain) || [];
      queue.push(request);
      this.requestQueue.set(request.chain, queue);

      // Store resolve/reject functions
      (request as any).resolve = resolve;
      (request as any).reject = reject;
    });
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    const processQueue = async () => {
      for (const [chain, queue] of this.requestQueue.entries()) {
        if (queue.length === 0) continue;

        // Process requests based on rate limits
        const endpoint = this.selectBestProvider(chain);
        if (!endpoint) continue;

        const rateLimit = endpoint.provider.rateLimit;
        const requestsToProcess = Math.min(queue.length, rateLimit);

        for (let i = 0; i < requestsToProcess; i++) {
          const request = queue.shift();
          if (!request) continue;

          try {
            const response = await this.makeRequest(request.method, request.params, {
              timeout: request.timeout,
              retries: request.retries,
              preferredProvider: request.preferredProvider
            });
            (request as any).resolve(response);
          } catch (error) {
            (request as any).reject(error);
          }
        }
      }
    };

    // Process queue every second
    setInterval(processQueue, 1000);
  }

  // Health Check System
  private selectBestProvider(chain: string, priority: string = 'medium'): RPCEndpoint | null {
    const chainProviders = Array.from(this.endpoints.values())
      .filter(endpoint => 
        endpoint.provider.chain === chain && 
        endpoint.isHealthy && 
        !endpoint.isBlacklisted
      );

    if (chainProviders.length === 0) {
      this.logger.warn('No healthy providers available for chain', { chain });
      return null;
    }

    // Sort by multiple criteria
    chainProviders.sort((a, b) => {
      // 1. Priority tier (premium > standard > fallback)
      const tierWeight = { premium: 3, standard: 2, fallback: 1 };
      const tierDiff = tierWeight[b.provider.tier] - tierWeight[a.provider.tier];
      if (tierDiff !== 0) return tierDiff;

      // 2. Success rate
      const successRateDiff = b.successRate - a.successRate;
      if (Math.abs(successRateDiff) > 5) return successRateDiff;

      // 3. Latency (lower is better)
      const latencyDiff = a.latency - b.latency;
      if (Math.abs(latencyDiff) > 100) return latencyDiff;

      // 4. Provider priority
      const priorityDiff = b.provider.priority - a.provider.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // 5. Load balancing - prefer less recently used
      return a.lastUsed - b.lastUsed;
    });

    // For critical requests, always use the best provider
    if (priority === 'critical') {
      return chainProviders[0];
    }

    // For other requests, use weighted random selection from top 3
    const topProviders = chainProviders.slice(0, Math.min(3, chainProviders.length));
    const weights = topProviders.map((_, index) => Math.pow(2, topProviders.length - index - 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < topProviders.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return topProviders[i];
      }
    }

    return topProviders[0];
  }

  // Metrics and monitoring
  private updateEndpointMetrics(endpoint: RPCEndpoint, latency: number, success: boolean): void {
    endpoint.requestCount++;
    
    if (success) {
      endpoint.latency = (endpoint.latency * 0.9) + (latency * 0.1);
      endpoint.consecutiveErrors = 0;
    } else {
      endpoint.errorCount++;
      endpoint.consecutiveErrors++;
    }

    endpoint.successRate = ((endpoint.requestCount - endpoint.errorCount) / endpoint.requestCount) * 100;
  }

  private updateGlobalMetrics(providerId: string, latency: number, success: boolean): void {
    const metrics = this.metrics.get(providerId);
    if (!metrics) return;

    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
    metrics.averageLatency = (metrics.averageLatency * 0.95) + (latency * 0.05);

    // Update provider-specific stats
    const provider = this.providers.get(providerId);
    if (provider) {
      metrics.requests++;
      metrics.latency = (metrics.latency * 0.9) + (latency * 0.1);
      
      if (!success) {
        metrics.errors++;
      }

      // Update cost
      const cost = (provider.cost / 1000) * (metrics.requests / 1000);
      metrics.cost += cost;
      metrics.costToday += cost;
    }
  }

  private startMetricsCollection(): void {
    // Reset daily cost at midnight
    const resetDailyCost = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      setTimeout(() => {
        this.metrics.forEach(metrics => {
          metrics.costToday = 0;
        });
        this.logger.info('Daily RPC cost metrics reset');
        
        // Set up recurring daily reset
        setInterval(() => {
          this.metrics.forEach(metrics => {
            metrics.costToday = 0;
          });
          this.logger.info('Daily RPC cost metrics reset');
        }, 24 * 60 * 60 * 1000);
      }, msUntilMidnight);
    };

    resetDailyCost();

    // Log metrics every 5 minutes
    setInterval(() => {
      this.logger.info('RPC Metrics Summary', {
        totalRequests: this.metrics.totalRequests,
        successRate: this.metrics.successRate.toFixed(2) + '%',
        averageLatency: this.metrics.averageLatency.toFixed(0) + 'ms',
        costToday: '$' + this.metrics.costToday.toFixed(6),
        healthyProviders: Array.from(this.endpoints.values()).filter(e => e.isHealthy).length,
        blacklistedProviders: Array.from(this.endpoints.values()).filter(e => e.isBlacklisted).length
      });
    }, 5 * 60 * 1000);
  }

  // Utility methods
  private isCacheable(method: string): boolean {
    const cacheableMethods = [
      'eth_blockNumber',
      'eth_gasPrice',
      'eth_getBalance',
      'eth_getTransactionCount',
      'eth_call',
      'getHealth'
    ];
    return cacheableMethods.includes(method);
  }

  private getCacheKey(request: RPCRequest): string {
    return `${request.chain}:${request.method}:${JSON.stringify(request.params)}`;
  }

  private cacheResponse(request: RPCRequest, response: any): void {
    const cacheKey = this.getCacheKey(request);
    const cacheDuration = this.getCacheDuration(request.method);
    
    this.responseCache.set(cacheKey, {
      response,
      expiry: Date.now() + cacheDuration
    });

    // Clean up expired cache entries
    if (this.responseCache.size > 10000) {
      this.cleanupCache();
    }
  }

  private getCacheDuration(method: string): number {
    const durations: Record<string, number> = {
      'eth_blockNumber': 1000,      // 1 second
      'eth_gasPrice': 5000,         // 5 seconds  
      'eth_getBalance': 10000,      // 10 seconds
      'eth_getTransactionCount': 10000, // 10 seconds
      'eth_call': 30000,            // 30 seconds
      'getHealth': 60000            // 1 minute
    };
    
    return durations[method] || 30000;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (value.expiry < now) {
        this.responseCache.delete(key);
      }
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'Network Error',
      'timeout'
    ];
    
    return retryableErrors.some(retryableError => 
      error.message?.includes(retryableError) || 
      error.code?.includes(retryableError)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  getMetrics(): RPCMetrics {
    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      averageLatency: this.metrics.averageLatency,
      successRate: this.metrics.successRate,
      costToday: this.metrics.costToday,
      providerStats: new Map(this.metrics.map(metrics => [
        metrics.id,
        {
          requests: metrics.requests,
          errors: metrics.errors,
          latency: metrics.latency,
          cost: metrics.cost
        }
      ]))
    };
  }

  getProviderStatus(chain?: string): RPCEndpoint[] {
    let endpoints = Array.from(this.endpoints.values());
    
    if (chain) {
      endpoints = endpoints.filter(e => e.provider.chain === chain);
    }
    
    return endpoints.sort((a, b) => b.provider.priority - a.provider.priority);
  }

  async optimizeForLatency(chain: string): Promise<void> {
    // Run latency tests on all providers for the chain
    const endpoints = Array.from(this.endpoints.values())
      .filter(e => e.provider.chain === chain && e.isHealthy);

    const latencyTests = endpoints.map(async (endpoint) => {
      const testRequest: RPCRequest = {
        id: `latency-test-${Date.now()}`,
        method: chain === 'solana' ? 'getHealth' : 'eth_blockNumber',
        params: [],
        chain,
        priority: 'low',
        timestamp: Date.now()
      };

      const startTime = Date.now();
      try {
        await this.executeRequest(testRequest, {});
        return { endpoint, latency: Date.now() - startTime };
      } catch (error) {
        return { endpoint, latency: 999999 }; // Max latency for failed requests
      }
    });

    const results = await Promise.all(latencyTests);
    
    // Update priorities based on latency results
    results.sort((a, b) => a.latency - b.latency);
    results.forEach((result, index) => {
      const priorityBoost = Math.max(0, 20 - (index * 2));
      result.endpoint.provider.priority += priorityBoost;
    });

    this.logger.info('Latency optimization completed', {
      chain,
      results: results.map(r => ({
        provider: r.endpoint.provider.id,
        latency: r.latency,
        newPriority: r.endpoint.provider.priority
      }))
    });
  }

  async getOptimalProvider(chain: string, method: string): Promise<string | null> {
    const endpoint = this.selectBestProvider(chain, 'high');
    return endpoint?.provider.id || null;
  }

  getConnectionStatus(): { [chain: string]: boolean } {
    const status: { [chain: string]: boolean } = {};
    
    for (const provider of this.providers.values()) {
      if (!status[provider.chain]) {
        status[provider.chain] = false;
      }
      
      const endpoint = this.endpoints.get(provider.id);
      if (endpoint?.isHealthy && !endpoint.isBlacklisted) {
        status[provider.chain] = true;
      }
    }
    
    return status;
  }

  async close(): Promise<void> {
    // Close all WebSocket connections
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    this.wsConnections.clear();

    // Clear intervals and timeouts
    this.isProcessingQueue = false;

    this.logger.info('RPC Manager closed');
  }
}