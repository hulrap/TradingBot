import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';
import winston from 'winston';

export interface RPCProvider {
  id: string;
  name: string;
  url: string;
  wsUrl?: string;
  tier: 'premium' | 'standard' | 'fallback';
  chain: string;
  apiKey?: string;
  rateLimit: number; // requests per second
  priority: number; // higher = better
  maxRetries: number;
  timeout: number;
  cost: number; // cost per request in USD
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
}

export interface RPCResponse {
  id: string;
  result?: any;
  error?: any;
  provider: string;
  latency: number;
  fromCache?: boolean;
  timestamp: number;
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

export class RPCManager extends EventEmitter {
  private logger: winston.Logger;
  private providers: Map<string, RPCProvider> = new Map();
  private endpoints: Map<string, RPCEndpoint> = new Map();
  private requestQueue: Map<string, RPCRequest[]> = new Map(); // chain -> requests
  private responseCache: Map<string, { response: any; expiry: number }> = new Map();
  private axiosInstances: Map<string, AxiosInstance> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private metrics: RPCMetrics;
  private isProcessingQueue = false;

  constructor(logger: winston.Logger) {
    super();
    this.logger = logger;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      successRate: 0,
      costToday: 0,
      providerStats: new Map()
    };

    this.setupDefaultProviders();
    this.startHealthChecks();
    this.startQueueProcessor();
    this.startMetricsCollection();
  }

  private setupDefaultProviders(): void {
    // Ethereum Providers
    this.addProvider({
      id: 'quicknode-eth-premium',
      name: 'QuickNode Ethereum Premium',
      url: process.env.QUICKNODE_ETH_URL || 'https://YOUR_ENDPOINT.quiknode.pro/',
      wsUrl: process.env.QUICKNODE_ETH_WS || 'wss://YOUR_ENDPOINT.quiknode.pro/',
      tier: 'premium',
      chain: 'ethereum',
      apiKey: process.env.QUICKNODE_API_KEY,
      rateLimit: 100,
      priority: 100,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.0001
    });

    this.addProvider({
      id: 'alchemy-eth-premium',
      name: 'Alchemy Ethereum',
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      wsUrl: `wss://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      tier: 'premium',
      chain: 'ethereum',
      apiKey: process.env.ALCHEMY_API_KEY,
      rateLimit: 80,
      priority: 95,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00008
    });

    this.addProvider({
      id: 'chainstack-eth',
      name: 'Chainstack Ethereum',
      url: process.env.CHAINSTACK_ETH_URL || 'https://YOUR_ENDPOINT.chainstack.com/',
      tier: 'premium',
      chain: 'ethereum',
      apiKey: process.env.CHAINSTACK_API_KEY,
      rateLimit: 60,
      priority: 90,
      maxRetries: 3,
      timeout: 6000,
      cost: 0.00009
    });

    this.addProvider({
      id: 'infura-eth-standard',
      name: 'Infura Ethereum',
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      wsUrl: `wss://mainnet.infura.io/ws/v3/${process.env.INFURA_API_KEY}`,
      tier: 'standard',
      chain: 'ethereum',
      apiKey: process.env.INFURA_API_KEY,
      rateLimit: 10,
      priority: 50,
      maxRetries: 2,
      timeout: 8000,
      cost: 0.00005
    });

    // BSC Providers
    this.addProvider({
      id: 'quicknode-bsc-premium',
      name: 'QuickNode BSC Premium',
      url: process.env.QUICKNODE_BSC_URL || 'https://YOUR_ENDPOINT.bsc.quiknode.pro/',
      wsUrl: process.env.QUICKNODE_BSC_WS || 'wss://YOUR_ENDPOINT.bsc.quiknode.pro/',
      tier: 'premium',
      chain: 'bsc',
      apiKey: process.env.QUICKNODE_API_KEY,
      rateLimit: 100,
      priority: 100,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00008
    });

    this.addProvider({
      id: 'nodereal-bsc',
      name: 'NodeReal BSC',
      url: `https://bsc-mainnet.nodereal.io/v1/${process.env.NODEREAL_API_KEY}`,
      tier: 'premium',
      chain: 'bsc',
      apiKey: process.env.NODEREAL_API_KEY,
      rateLimit: 80,
      priority: 95,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00007
    });

    this.addProvider({
      id: 'bsc-public-fallback',
      name: 'BSC Public RPC',
      url: 'https://bsc-dataseed1.binance.org/',
      tier: 'fallback',
      chain: 'bsc',
      rateLimit: 3,
      priority: 10,
      maxRetries: 1,
      timeout: 15000,
      cost: 0
    });

    // Polygon Providers
    this.addProvider({
      id: 'alchemy-polygon',
      name: 'Alchemy Polygon',
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      wsUrl: `wss://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      tier: 'premium',
      chain: 'polygon',
      apiKey: process.env.ALCHEMY_API_KEY,
      rateLimit: 80,
      priority: 100,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00006
    });

    this.addProvider({
      id: 'quicknode-polygon',
      name: 'QuickNode Polygon',
      url: process.env.QUICKNODE_POLYGON_URL || 'https://YOUR_ENDPOINT.matic.quiknode.pro/',
      tier: 'premium',
      chain: 'polygon',
      apiKey: process.env.QUICKNODE_API_KEY,
      rateLimit: 100,
      priority: 95,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00007
    });

    // Arbitrum Providers
    this.addProvider({
      id: 'alchemy-arbitrum',
      name: 'Alchemy Arbitrum',
      url: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      wsUrl: `wss://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      tier: 'premium',
      chain: 'arbitrum',
      apiKey: process.env.ALCHEMY_API_KEY,
      rateLimit: 80,
      priority: 100,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00005
    });

    // Optimism Providers
    this.addProvider({
      id: 'alchemy-optimism',
      name: 'Alchemy Optimism',
      url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      wsUrl: `wss://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      tier: 'premium',
      chain: 'optimism',
      apiKey: process.env.ALCHEMY_API_KEY,
      rateLimit: 80,
      priority: 100,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00005
    });

    // Solana Providers (using HTTP API)
    this.addProvider({
      id: 'quicknode-solana',
      name: 'QuickNode Solana',
      url: process.env.QUICKNODE_SOL_URL || 'https://YOUR_ENDPOINT.solana.quiknode.pro/',
      tier: 'premium',
      chain: 'solana',
      apiKey: process.env.QUICKNODE_API_KEY,
      rateLimit: 100,
      priority: 100,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00008
    });

    this.addProvider({
      id: 'helius-solana',
      name: 'Helius Solana',
      url: `https://rpc.helius.xyz/?api-key=${process.env.HELIUS_API_KEY}`,
      tier: 'premium',
      chain: 'solana',
      apiKey: process.env.HELIUS_API_KEY,
      rateLimit: 80,
      priority: 95,
      maxRetries: 3,
      timeout: 5000,
      cost: 0.00009
    });

    this.logger.info('Default RPC providers configured', {
      totalProviders: this.providers.size,
      chains: Array.from(new Set(Array.from(this.providers.values()).map(p => p.chain)))
    });
  }

  addProvider(provider: RPCProvider): void {
    this.providers.set(provider.id, provider);
    
    const endpoint: RPCEndpoint = {
      provider,
      isHealthy: true,
      latency: 0,
      successRate: 100,
      lastUsed: 0,
      requestCount: 0,
      errorCount: 0,
      consecutiveErrors: 0,
      isBlacklisted: false
    };
    
    this.endpoints.set(provider.id, endpoint);

    // Create axios instance for this provider
    const axiosConfig: any = {
      baseURL: provider.url,
      timeout: provider.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TradingBot/1.0'
      }
    };

    // Add API key to headers if provided
    if (provider.apiKey) {
      if (provider.name.includes('Alchemy')) {
        // Alchemy uses API key in URL
      } else if (provider.name.includes('QuickNode')) {
        axiosConfig.headers['X-API-Key'] = provider.apiKey;
      } else if (provider.name.includes('Chainstack')) {
        axiosConfig.headers['Authorization'] = `Bearer ${provider.apiKey}`;
      } else if (provider.name.includes('NodeReal')) {
        // NodeReal uses API key in URL
      }
    }

    this.axiosInstances.set(provider.id, axios.create(axiosConfig));
    
    // Initialize request queue for this chain
    if (!this.requestQueue.has(provider.chain)) {
      this.requestQueue.set(provider.chain, []);
    }

    // Initialize provider stats
    this.metrics.providerStats.set(provider.id, {
      requests: 0,
      errors: 0,
      latency: 0,
      cost: 0
    });

    this.logger.info('RPC provider added', {
      id: provider.id,
      name: provider.name,
      chain: provider.chain,
      tier: provider.tier,
      priority: provider.priority
    });
  }

  // Smart Provider Selection Algorithm
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

  // Main request method with intelligent routing
  async makeRequest(request: RPCRequest): Promise<RPCResponse> {
    const startTime = Date.now();
    
    // Check cache first for cacheable methods
    if (this.isCacheable(request.method)) {
      const cacheKey = this.getCacheKey(request);
      const cached = this.responseCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return {
          id: request.id,
          result: cached.response,
          provider: 'cache',
          latency: 0,
          fromCache: true,
          timestamp: Date.now()
        };
      }
    }

    // Select best provider
    const endpoint = this.selectBestProvider(request.chain, request.priority);
    if (!endpoint) {
      throw new Error(`No available providers for chain: ${request.chain}`);
    }

    const maxRetries = request.retries ?? endpoint.provider.maxRetries;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.executeRequest(endpoint, request);
        
        // Update endpoint metrics on success
        this.updateEndpointMetrics(endpoint, Date.now() - startTime, true);
        
        // Cache response if applicable
        if (this.isCacheable(request.method)) {
          this.cacheResponse(request, response.result);
        }

        // Update global metrics
        this.updateGlobalMetrics(endpoint.provider.id, Date.now() - startTime, true);

        return response;
      } catch (error) {
        lastError = error;
        this.updateEndpointMetrics(endpoint, Date.now() - startTime, false);
        
        this.logger.warn('RPC request failed', {
          provider: endpoint.provider.id,
          chain: request.chain,
          method: request.method,
          attempt: attempt + 1,
          error: error.message
        });

        // If this was the last attempt, or it's a non-retryable error, break
        if (attempt === maxRetries || !this.isRetryableError(error)) {
          break;
        }

        // Try a different provider for the next attempt
        const nextEndpoint = this.selectBestProvider(request.chain, request.priority);
        if (nextEndpoint && nextEndpoint.provider.id !== endpoint.provider.id) {
          Object.assign(endpoint, nextEndpoint);
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    // Update global metrics on failure
    this.updateGlobalMetrics(endpoint.provider.id, Date.now() - startTime, false);

    throw lastError || new Error('Request failed after all retries');
  }

  private async executeRequest(endpoint: RPCEndpoint, request: RPCRequest): Promise<RPCResponse> {
    const startTime = Date.now();
    const axiosInstance = this.axiosInstances.get(endpoint.provider.id);
    
    if (!axiosInstance) {
      throw new Error(`No axios instance found for provider: ${endpoint.provider.id}`);
    }

    const requestBody = {
      jsonrpc: '2.0',
      id: request.id,
      method: request.method,
      params: request.params
    };

    const response: AxiosResponse = await axiosInstance.post('/', requestBody, {
      timeout: request.timeout || endpoint.provider.timeout
    });

    if (response.data.error) {
      throw new Error(`RPC Error: ${response.data.error.message}`);
    }

    const latency = Date.now() - startTime;
    endpoint.lastUsed = Date.now();

    return {
      id: request.id,
      result: response.data.result,
      provider: endpoint.provider.id,
      latency,
      timestamp: Date.now()
    };
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
            const response = await this.makeRequest(request);
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
  private startHealthChecks(): void {
    const healthCheck = async () => {
      for (const [providerId, endpoint] of this.endpoints.entries()) {
        try {
          const testRequest: RPCRequest = {
            id: `health-${Date.now()}`,
            method: endpoint.provider.chain === 'solana' ? 'getHealth' : 'eth_blockNumber',
            params: [],
            chain: endpoint.provider.chain,
            priority: 'low',
            timestamp: Date.now()
          };

          const startTime = Date.now();
          await this.executeRequest(endpoint, testRequest);
          const latency = Date.now() - startTime;

          // Update health metrics
          endpoint.isHealthy = true;
          endpoint.latency = (endpoint.latency * 0.8) + (latency * 0.2); // EMA
          endpoint.consecutiveErrors = 0;

          // Remove from blacklist if healthy
          if (endpoint.isBlacklisted && endpoint.consecutiveErrors === 0) {
            endpoint.isBlacklisted = false;
            endpoint.blacklistUntil = undefined;
            this.logger.info('Provider removed from blacklist', { providerId });
          }

        } catch (error) {
          endpoint.consecutiveErrors++;
          
          // Blacklist after 3 consecutive errors
          if (endpoint.consecutiveErrors >= 3) {
            endpoint.isBlacklisted = true;
            endpoint.blacklistUntil = Date.now() + (5 * 60 * 1000); // 5 minutes
            endpoint.isHealthy = false;
            
            this.logger.warn('Provider blacklisted due to health check failures', {
              providerId,
              consecutiveErrors: endpoint.consecutiveErrors
            });
          }
        }
      }
    };

    // Run health checks every 30 seconds
    setInterval(healthCheck, 30000);
    
    // Initial health check
    setTimeout(healthCheck, 5000);
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
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.successRate = (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
    this.metrics.averageLatency = (this.metrics.averageLatency * 0.95) + (latency * 0.05);

    // Update provider-specific stats
    const providerStats = this.metrics.providerStats.get(providerId);
    if (providerStats) {
      providerStats.requests++;
      providerStats.latency = (providerStats.latency * 0.9) + (latency * 0.1);
      
      if (!success) {
        providerStats.errors++;
      }

      // Update cost
      const provider = this.providers.get(providerId);
      if (provider) {
        providerStats.cost += provider.cost;
        this.metrics.costToday += provider.cost;
      }
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
        this.metrics.costToday = 0;
        this.metrics.providerStats.forEach(stats => {
          stats.cost = 0;
        });
        this.logger.info('Daily RPC cost metrics reset');
        
        // Set up recurring daily reset
        setInterval(() => {
          this.metrics.costToday = 0;
          this.metrics.providerStats.forEach(stats => {
            stats.cost = 0;
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
    return { ...this.metrics };
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
        await this.executeRequest(endpoint, testRequest);
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