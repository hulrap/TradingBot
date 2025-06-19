'use strict';

var events = require('events');
var axios2 = require('axios');
var WebSocket = require('ws');
var ethers = require('ethers');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var axios2__default = /*#__PURE__*/_interopDefault(axios2);
var WebSocket__default = /*#__PURE__*/_interopDefault(WebSocket);

// Multi-chain RPC Infrastructure
// Built with tsup

var RPCManager = class extends events.EventEmitter {
  constructor(logger, config) {
    super();
    this.config = config;
    this.logger = logger;
    this.setupDefaultProviders();
    this.startHealthChecks();
    this.startQueueProcessor();
    this.startMetricsCollection();
    this.startCostTracking();
  }
  logger;
  providers = /* @__PURE__ */ new Map();
  endpoints = /* @__PURE__ */ new Map();
  requestQueue = /* @__PURE__ */ new Map();
  // chain -> requests
  responseCache = /* @__PURE__ */ new Map();
  axiosInstances = /* @__PURE__ */ new Map();
  wsConnections = /* @__PURE__ */ new Map();
  metrics = /* @__PURE__ */ new Map();
  isProcessingQueue = false;
  healthCheckInterval;
  costTracker = /* @__PURE__ */ new Map();
  setupDefaultProviders() {
    this.config.providers.forEach((provider) => {
      this.providers.set(provider.id, provider);
      this.metrics.set(provider.id, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: provider.latency,
        costToday: 0,
        lastHealthCheck: Date.now(),
        isHealthy: true
      });
      const httpClient = axios2__default.default.create({
        baseURL: provider.url,
        timeout: this.config.requestTimeout,
        headers: provider.apiKey ? {
          "Authorization": `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json"
        } : {
          "Content-Type": "application/json"
        }
      });
      httpClient.interceptors.response.use(
        (response) => {
          this.updateMetrics(provider.id, true, response.config.metadata?.startTime);
          return response;
        },
        (error) => {
          this.updateMetrics(provider.id, false, error.config?.metadata?.startTime);
          return Promise.reject(error);
        }
      );
      this.axiosInstances.set(provider.id, httpClient);
      this.costTracker.set(provider.id, []);
      if (!this.requestQueue.has(provider.chain)) {
        this.requestQueue.set(provider.chain, []);
      }
      this.metrics.get(provider.id).requests = 0;
      this.metrics.get(provider.id).errors = 0;
      this.metrics.get(provider.id).latency = 0;
      this.metrics.get(provider.id).cost = 0;
      this.logger.info("RPC provider added", {
        id: provider.id,
        name: provider.name,
        chain: provider.chain,
        tier: provider.tier,
        priority: provider.priority
      });
    });
    this.logger.info("Default RPC providers configured", {
      totalProviders: this.providers.size,
      chains: Array.from(new Set(Array.from(this.providers.values()).map((p) => p.chain)))
    });
  }
  updateMetrics(providerId, success, startTime) {
    const metrics = this.metrics.get(providerId);
    if (!metrics)
      return;
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
    metrics.isHealthy = metrics.successfulRequests / metrics.totalRequests > 0.8;
    this.metrics.set(providerId, metrics);
  }
  startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }
  async performHealthChecks() {
    const healthCheckPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        const client = this.axiosInstances.get(provider.id);
        if (!client)
          return;
        const startTime = Date.now();
        await client.post("", {
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1
        });
        const latency = Date.now() - startTime;
        const metrics = this.metrics.get(provider.id);
        metrics.lastHealthCheck = Date.now();
        metrics.isHealthy = true;
        metrics.averageLatency = (metrics.averageLatency + latency) / 2;
        provider.latency = metrics.averageLatency;
        this.emit("healthCheck", { providerId: provider.id, healthy: true, latency });
      } catch (error) {
        const metrics = this.metrics.get(provider.id);
        metrics.isHealthy = false;
        metrics.lastHealthCheck = Date.now();
        this.emit("healthCheck", { providerId: provider.id, healthy: false, error });
        this.blacklistProvider(provider.id);
      }
    });
    await Promise.allSettled(healthCheckPromises);
  }
  blacklistProvider(providerId) {
    const metrics = this.metrics.get(providerId);
    if (metrics) {
      metrics.blacklistedUntil = Date.now() + this.config.blacklistDuration;
      this.emit("providerBlacklisted", { providerId, until: metrics.blacklistedUntil });
    }
  }
  startCostTracking() {
    setInterval(() => {
      this.cleanupOldCostData();
    }, 60 * 60 * 1e3);
  }
  cleanupOldCostData() {
    const cutoff = Date.now() - this.config.costTrackingWindow * 60 * 60 * 1e3;
    this.costTracker.forEach((costs, providerId) => {
      const filteredCosts = costs.filter((entry) => entry.timestamp > cutoff);
      this.costTracker.set(providerId, filteredCosts);
    });
  }
  addCostEntry(providerId, cost) {
    const costs = this.costTracker.get(providerId) || [];
    costs.push({ timestamp: Date.now(), cost });
    this.costTracker.set(providerId, costs);
    const metrics = this.metrics.get(providerId);
    const todayStart = (/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0);
    const todayCosts = costs.filter((entry) => entry.timestamp >= todayStart);
    metrics.costToday = todayCosts.reduce((total, entry) => total + entry.cost, 0);
  }
  getAvailableProviders() {
    const now = Date.now();
    return Array.from(this.providers.values()).filter((provider) => {
      const metrics = this.metrics.get(provider.id);
      if (!provider.isActive)
        return false;
      if (metrics.blacklistedUntil && metrics.blacklistedUntil > now)
        return false;
      if (!metrics.isHealthy)
        return false;
      if (metrics.costToday >= this.config.dailyBudget)
        return false;
      return true;
    }).sort((a, b) => {
      const tierWeight = { premium: 3, standard: 2, fallback: 1 };
      const aTierScore = tierWeight[a.tier] * 1e3;
      const bTierScore = tierWeight[b.tier] * 1e3;
      const aMetrics = this.metrics.get(a.id);
      const bMetrics = this.metrics.get(b.id);
      const aScore = aTierScore + a.priority + aMetrics.successfulRequests / aMetrics.totalRequests * 100 - a.latency;
      const bScore = bTierScore + b.priority + bMetrics.successfulRequests / bMetrics.totalRequests * 100 - b.latency;
      return bScore - aScore;
    });
  }
  async makeRequest(method, params = [], options = {}) {
    const request = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      method,
      params,
      chain: "",
      priority: "medium",
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.retries || this.config.maxRetries
    };
    return this.executeRequest(request, options);
  }
  async executeRequest(request, options) {
    const availableProviders = this.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error("No available RPC providers");
    }
    let targetProvider = availableProviders[0];
    if (options.preferredProvider) {
      const preferred = availableProviders.find((p) => p.id === options.preferredProvider);
      if (preferred)
        targetProvider = preferred;
    }
    const startTime = Date.now();
    try {
      const client = this.axiosInstances.get(targetProvider.id);
      const config = {
        metadata: { startTime }
      };
      const response = await client.post("", {
        jsonrpc: "2.0",
        method: request.method,
        params: request.params,
        id: request.id
      }, config);
      const latency = Date.now() - startTime;
      const requestCost = targetProvider.cost / 1e3;
      this.addCostEntry(targetProvider.id, requestCost);
      const rpcResponse = {
        id: request.id,
        result: response.data.result,
        error: response.data.error,
        latency,
        provider: targetProvider.id
      };
      this.emit("requestCompleted", { request, response: rpcResponse, provider: targetProvider.id });
      if (rpcResponse.error) {
        throw new Error(`RPC Error: ${rpcResponse.error.message}`);
      }
      return rpcResponse;
    } catch (error) {
      this.emit("requestFailed", { request, error, provider: targetProvider.id });
      if (request.retryCount < request.maxRetries) {
        request.retryCount++;
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay * Math.pow(2, request.retryCount)));
        const filteredProviders = availableProviders.filter((p) => p.id !== targetProvider.id);
        if (filteredProviders.length > 0) {
          return this.executeRequest(request, { ...options, preferredProvider: void 0 });
        }
      }
      throw error;
    }
  }
  async batchRequest(requests) {
    const batchPromises = requests.map((req) => this.makeRequest(req.method, req.params));
    return Promise.all(batchPromises);
  }
  getProviderMetrics(providerId) {
    if (providerId) {
      const metrics = this.metrics.get(providerId);
      if (!metrics)
        throw new Error(`Provider ${providerId} not found`);
      return metrics;
    }
    return new Map(this.metrics);
  }
  getProviderStatus() {
    return Array.from(this.providers.values()).map((provider) => ({
      provider,
      metrics: this.metrics.get(provider.id)
    }));
  }
  async addProvider(provider) {
    this.providers.set(provider.id, provider);
    this.metrics.set(provider.id, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: provider.latency,
      costToday: 0,
      lastHealthCheck: Date.now(),
      isHealthy: true
    });
    const httpClient = axios2__default.default.create({
      baseURL: provider.url,
      timeout: this.config.requestTimeout,
      headers: provider.apiKey ? {
        "Authorization": `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json"
      } : {
        "Content-Type": "application/json"
      }
    });
    this.axiosInstances.set(provider.id, httpClient);
    this.costTracker.set(provider.id, []);
    this.emit("providerAdded", provider);
  }
  removeProvider(providerId) {
    this.providers.delete(providerId);
    this.metrics.delete(providerId);
    this.axiosInstances.delete(providerId);
    this.costTracker.delete(providerId);
    const ws = this.wsConnections.get(providerId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(providerId);
    }
    this.emit("providerRemoved", providerId);
  }
  setProviderActive(providerId, active) {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.isActive = active;
      this.emit("providerStatusChanged", { providerId, active });
    }
  }
  getTotalCosts() {
    const now = Date.now();
    const todayStart = (/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0);
    const windowStart = now - this.config.costTrackingWindow * 60 * 60 * 1e3;
    let dailyTotal = 0;
    let windowTotal = 0;
    const breakdown = {};
    this.costTracker.forEach((costs, providerId) => {
      const dailyCosts = costs.filter((entry) => entry.timestamp >= todayStart);
      const windowCosts = costs.filter((entry) => entry.timestamp >= windowStart);
      const dailySum = dailyCosts.reduce((sum, entry) => sum + entry.cost, 0);
      const windowSum = windowCosts.reduce((sum, entry) => sum + entry.cost, 0);
      dailyTotal += dailySum;
      windowTotal += windowSum;
      breakdown[providerId] = dailySum;
    });
    return { daily: dailyTotal, window: windowTotal, breakdown };
  }
  optimizeForCost() {
    const providers = Array.from(this.providers.values());
    providers.forEach((provider) => {
      const metrics = this.metrics.get(provider.id);
      const costEfficiency = metrics.successfulRequests / (metrics.costToday + 1);
      provider.priority = Math.floor(costEfficiency * 100);
    });
    this.emit("optimizedForCost");
  }
  optimizeForSpeed() {
    const providers = Array.from(this.providers.values());
    providers.forEach((provider) => {
      const metrics = this.metrics.get(provider.id);
      provider.priority = Math.floor(1e3 / (metrics.averageLatency + 1));
    });
    this.emit("optimizedForSpeed");
  }
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.wsConnections.forEach((ws) => ws.close());
    this.wsConnections.clear();
    this.providers.clear();
    this.metrics.clear();
    this.axiosInstances.clear();
    this.costTracker.clear();
    this.requestQueue.clear();
    this.removeAllListeners();
  }
  // WebSocket Connection Management
  async createWebSocketConnection(chain) {
    const endpoint = this.selectBestProvider(chain, "high");
    if (!endpoint || !endpoint.provider.wsUrl) {
      this.logger.warn("No WebSocket endpoint available for chain", { chain });
      return null;
    }
    const wsKey = `${chain}-${endpoint.provider.id}`;
    if (this.wsConnections.has(wsKey)) {
      this.wsConnections.get(wsKey)?.close();
    }
    try {
      const ws = new WebSocket__default.default(endpoint.provider.wsUrl);
      ws.on("open", () => {
        this.logger.info("WebSocket connected", {
          chain,
          provider: endpoint.provider.id
        });
        this.emit("wsConnected", { chain, provider: endpoint.provider.id });
      });
      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit("wsMessage", { chain, provider: endpoint.provider.id, message });
        } catch (error) {
          this.logger.error("Error parsing WebSocket message:", error);
        }
      });
      ws.on("error", (error) => {
        this.logger.error("WebSocket error", {
          chain,
          provider: endpoint.provider.id,
          error: error.message
        });
        this.emit("wsError", { chain, provider: endpoint.provider.id, error });
      });
      ws.on("close", () => {
        this.logger.warn("WebSocket disconnected", {
          chain,
          provider: endpoint.provider.id
        });
        this.wsConnections.delete(wsKey);
        this.emit("wsDisconnected", { chain, provider: endpoint.provider.id });
        setTimeout(() => {
          this.createWebSocketConnection(chain);
        }, 5e3);
      });
      this.wsConnections.set(wsKey, ws);
      return ws;
    } catch (error) {
      this.logger.error("Failed to create WebSocket connection", {
        chain,
        provider: endpoint.provider.id,
        error: error.message
      });
      return null;
    }
  }
  // Queue-based request processing for rate limiting
  async queueRequest(request) {
    return new Promise((resolve, reject) => {
      const queue = this.requestQueue.get(request.chain) || [];
      queue.push(request);
      this.requestQueue.set(request.chain, queue);
      request.resolve = resolve;
      request.reject = reject;
    });
  }
  async startQueueProcessor() {
    if (this.isProcessingQueue)
      return;
    this.isProcessingQueue = true;
    const processQueue = async () => {
      for (const [chain, queue] of this.requestQueue.entries()) {
        if (queue.length === 0)
          continue;
        const endpoint = this.selectBestProvider(chain);
        if (!endpoint)
          continue;
        const rateLimit = endpoint.provider.rateLimit;
        const requestsToProcess = Math.min(queue.length, rateLimit);
        for (let i = 0; i < requestsToProcess; i++) {
          const request = queue.shift();
          if (!request)
            continue;
          try {
            const response = await this.makeRequest(request.method, request.params, {
              timeout: request.timeout,
              retries: request.retries,
              preferredProvider: request.preferredProvider
            });
            request.resolve(response);
          } catch (error) {
            request.reject(error);
          }
        }
      }
    };
    setInterval(processQueue, 1e3);
  }
  // Health Check System
  selectBestProvider(chain, priority = "medium") {
    const chainProviders = Array.from(this.endpoints.values()).filter(
      (endpoint) => endpoint.provider.chain === chain && endpoint.isHealthy && !endpoint.isBlacklisted
    );
    if (chainProviders.length === 0) {
      this.logger.warn("No healthy providers available for chain", { chain });
      return null;
    }
    chainProviders.sort((a, b) => {
      const tierWeight = { premium: 3, standard: 2, fallback: 1 };
      const tierDiff = tierWeight[b.provider.tier] - tierWeight[a.provider.tier];
      if (tierDiff !== 0)
        return tierDiff;
      const successRateDiff = b.successRate - a.successRate;
      if (Math.abs(successRateDiff) > 5)
        return successRateDiff;
      const latencyDiff = a.latency - b.latency;
      if (Math.abs(latencyDiff) > 100)
        return latencyDiff;
      const priorityDiff = b.provider.priority - a.provider.priority;
      if (priorityDiff !== 0)
        return priorityDiff;
      return a.lastUsed - b.lastUsed;
    });
    if (priority === "critical") {
      return chainProviders[0];
    }
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
  updateEndpointMetrics(endpoint, latency, success) {
    endpoint.requestCount++;
    if (success) {
      endpoint.latency = endpoint.latency * 0.9 + latency * 0.1;
      endpoint.consecutiveErrors = 0;
    } else {
      endpoint.errorCount++;
      endpoint.consecutiveErrors++;
    }
    endpoint.successRate = (endpoint.requestCount - endpoint.errorCount) / endpoint.requestCount * 100;
  }
  updateGlobalMetrics(providerId, latency, success) {
    const metrics = this.metrics.get(providerId);
    if (!metrics)
      return;
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    metrics.successRate = metrics.successfulRequests / metrics.totalRequests * 100;
    metrics.averageLatency = metrics.averageLatency * 0.95 + latency * 0.05;
    const provider = this.providers.get(providerId);
    if (provider) {
      metrics.requests++;
      metrics.latency = metrics.latency * 0.9 + latency * 0.1;
      if (!success) {
        metrics.errors++;
      }
      const cost = provider.cost / 1e3 * (metrics.requests / 1e3);
      metrics.cost += cost;
      metrics.costToday += cost;
    }
  }
  startMetricsCollection() {
    const resetDailyCost = () => {
      const now = /* @__PURE__ */ new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      setTimeout(() => {
        this.metrics.forEach((metrics) => {
          metrics.costToday = 0;
        });
        this.logger.info("Daily RPC cost metrics reset");
        setInterval(() => {
          this.metrics.forEach((metrics) => {
            metrics.costToday = 0;
          });
          this.logger.info("Daily RPC cost metrics reset");
        }, 24 * 60 * 60 * 1e3);
      }, msUntilMidnight);
    };
    resetDailyCost();
    setInterval(() => {
      this.logger.info("RPC Metrics Summary", {
        totalRequests: this.metrics.totalRequests,
        successRate: this.metrics.successRate.toFixed(2) + "%",
        averageLatency: this.metrics.averageLatency.toFixed(0) + "ms",
        costToday: "$" + this.metrics.costToday.toFixed(6),
        healthyProviders: Array.from(this.endpoints.values()).filter((e) => e.isHealthy).length,
        blacklistedProviders: Array.from(this.endpoints.values()).filter((e) => e.isBlacklisted).length
      });
    }, 5 * 60 * 1e3);
  }
  // Utility methods
  isCacheable(method) {
    const cacheableMethods = [
      "eth_blockNumber",
      "eth_gasPrice",
      "eth_getBalance",
      "eth_getTransactionCount",
      "eth_call",
      "getHealth"
    ];
    return cacheableMethods.includes(method);
  }
  getCacheKey(request) {
    return `${request.chain}:${request.method}:${JSON.stringify(request.params)}`;
  }
  cacheResponse(request, response) {
    const cacheKey = this.getCacheKey(request);
    const cacheDuration = this.getCacheDuration(request.method);
    this.responseCache.set(cacheKey, {
      response,
      expiry: Date.now() + cacheDuration
    });
    if (this.responseCache.size > 1e4) {
      this.cleanupCache();
    }
  }
  getCacheDuration(method) {
    const durations = {
      "eth_blockNumber": 1e3,
      // 1 second
      "eth_gasPrice": 5e3,
      // 5 seconds  
      "eth_getBalance": 1e4,
      // 10 seconds
      "eth_getTransactionCount": 1e4,
      // 10 seconds
      "eth_call": 3e4,
      // 30 seconds
      "getHealth": 6e4
      // 1 minute
    };
    return durations[method] || 3e4;
  }
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.responseCache.entries()) {
      if (value.expiry < now) {
        this.responseCache.delete(key);
      }
    }
  }
  isRetryableError(error) {
    const retryableErrors = [
      "ECONNRESET",
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "Network Error",
      "timeout"
    ];
    return retryableErrors.some(
      (retryableError) => error.message?.includes(retryableError) || error.code?.includes(retryableError)
    );
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  // Public API methods
  getMetrics() {
    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      averageLatency: this.metrics.averageLatency,
      successRate: this.metrics.successRate,
      costToday: this.metrics.costToday,
      providerStats: new Map(this.metrics.map((metrics) => [
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
  async optimizeForLatency(chain) {
    const endpoints = Array.from(this.endpoints.values()).filter((e) => e.provider.chain === chain && e.isHealthy);
    const latencyTests = endpoints.map(async (endpoint) => {
      const testRequest = {
        id: `latency-test-${Date.now()}`,
        method: chain === "solana" ? "getHealth" : "eth_blockNumber",
        params: [],
        chain,
        priority: "low",
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 0
      };
      const startTime = Date.now();
      try {
        await this.executeRequest(testRequest, {});
        return { endpoint, latency: Date.now() - startTime };
      } catch (error) {
        return { endpoint, latency: 999999 };
      }
    });
    const results = await Promise.all(latencyTests);
    results.sort((a, b) => a.latency - b.latency);
    results.forEach((result, index) => {
      const priorityBoost = Math.max(0, 20 - index * 2);
      result.endpoint.provider.priority += priorityBoost;
    });
    this.logger.info("Latency optimization completed", {
      chain,
      results: results.map((r) => ({
        provider: r.endpoint.provider.id,
        latency: r.latency,
        newPriority: r.endpoint.provider.priority
      }))
    });
  }
  async getOptimalProvider(chain, method) {
    const endpoint = this.selectBestProvider(chain, "high");
    return endpoint?.provider.id || null;
  }
  getConnectionStatus() {
    const status = {};
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
  async close() {
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    this.wsConnections.clear();
    this.isProcessingQueue = false;
    this.logger.info("RPC Manager closed");
  }
};
var ConnectionPool = class extends events.EventEmitter {
  logger;
  rpcManager;
  config;
  connections = /* @__PURE__ */ new Map();
  providerPools = /* @__PURE__ */ new Map();
  requestQueue = [];
  metrics = {
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
  healthCheckInterval;
  scaleTimer;
  cleanupTimer;
  constructor(rpcManager, config, logger) {
    super();
    this.rpcManager = rpcManager;
    this.config = config;
    this.logger = logger;
    this.startHealthChecks();
    this.startAutoScaling();
    this.startCleanupTimer();
  }
  // Connection Management
  async getConnection(providerId, priority = 1) {
    const startTime = Date.now();
    try {
      const existingConnection = this.getIdleConnection(providerId);
      if (existingConnection) {
        this.markConnectionBusy(existingConnection);
        this.updateMetrics("connectionAcquired", Date.now() - startTime);
        return existingConnection;
      }
      if (this.canCreateNewConnection(providerId)) {
        const newConnection = await this.createConnection(providerId);
        this.markConnectionBusy(newConnection);
        this.updateMetrics("connectionCreated", Date.now() - startTime);
        return newConnection;
      }
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = this.requestQueue.findIndex((item) => item.resolve === resolve);
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
        this.requestQueue.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return a.timestamp - b.timestamp;
        });
      });
    } catch (error) {
      this.updateMetrics("connectionError", Date.now() - startTime);
      throw error;
    }
  }
  releaseConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }
    this.markConnectionIdle(connection);
    this.processQueue();
    this.updateMetrics("connectionReleased");
  }
  async destroyConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection)
      return;
    const providerPool = this.providerPools.get(connection.providerId);
    if (providerPool) {
      providerPool.delete(connectionId);
    }
    this.connections.delete(connectionId);
    this.metrics.connectionsDestroyed++;
    this.updateConnectionCounts();
    this.emit("connectionDestroyed", connection);
    this.processQueue();
  }
  // Load Balancing
  selectConnectionByStrategy(providerId) {
    const providerPool = this.providerPools.get(providerId);
    if (!providerPool || providerPool.size === 0)
      return null;
    const availableConnections = Array.from(providerPool).map((id) => this.connections.get(id)).filter((conn) => conn.isActive && !conn.isBusy && conn.consecutiveErrors < conn.maxConsecutiveErrors);
    if (availableConnections.length === 0)
      return null;
    switch (this.config.loadBalancer.strategy) {
      case "round-robin":
        return this.roundRobinSelection(availableConnections);
      case "least-connections":
        return this.leastConnectionsSelection(availableConnections);
      case "weighted":
        return this.weightedSelection(availableConnections);
      case "latency-based":
        return this.latencyBasedSelection(availableConnections);
      default:
        return availableConnections[0];
    }
  }
  roundRobinSelection(connections) {
    const currentIndex = this.config.loadBalancer.currentIndex || 0;
    const selectedConnection = connections[currentIndex % connections.length];
    this.config.loadBalancer.currentIndex = (currentIndex + 1) % connections.length;
    return selectedConnection;
  }
  leastConnectionsSelection(connections) {
    return connections.reduce(
      (least, current) => current.requestCount < least.requestCount ? current : least
    );
  }
  weightedSelection(connections) {
    const weights = this.config.loadBalancer.weights || /* @__PURE__ */ new Map();
    const weightedConnections = connections.map((conn) => ({
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
  latencyBasedSelection(connections) {
    return connections.sort((a, b) => {
      const latencyDiff = a.averageResponseTime - b.averageResponseTime;
      if (Math.abs(latencyDiff) > 10) {
        return latencyDiff;
      }
      return b.healthScore - a.healthScore;
    })[0];
  }
  // Connection Creation and Management
  async createConnection(providerId) {
    const connectionId = `conn_${providerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection = {
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
    if (!this.providerPools.has(providerId)) {
      this.providerPools.set(providerId, /* @__PURE__ */ new Set());
    }
    this.providerPools.get(providerId).add(connectionId);
    this.metrics.connectionsCreated++;
    this.updateConnectionCounts();
    this.emit("connectionCreated", connection);
    return connection;
  }
  getIdleConnection(providerId) {
    return this.selectConnectionByStrategy(providerId);
  }
  canCreateNewConnection(providerId) {
    const currentConnections = this.connections.size;
    const providerConnections = this.providerPools.get(providerId)?.size || 0;
    return currentConnections < this.config.maxConnections && providerConnections < this.config.maxConnections;
  }
  markConnectionBusy(connection) {
    connection.isBusy = true;
    connection.lastUsed = Date.now();
    connection.requestCount++;
    this.updateConnectionCounts();
  }
  markConnectionIdle(connection) {
    connection.isBusy = false;
    this.updateConnectionCounts();
  }
  async processQueue() {
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];
      let availableConnection = null;
      for (const [providerId] of this.providerPools) {
        availableConnection = this.getIdleConnection(providerId);
        if (availableConnection)
          break;
      }
      if (!availableConnection) {
        let newConnection = null;
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
          break;
        }
        availableConnection = newConnection;
      }
      this.requestQueue.shift();
      clearTimeout(request.timeout);
      this.markConnectionBusy(availableConnection);
      request.resolve(availableConnection);
    }
  }
  // Health Monitoring
  startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }
  async performHealthChecks() {
    const healthCheckPromises = Array.from(this.connections.values()).map(async (connection) => {
      try {
        const startTime = Date.now();
        await this.simulateHealthCheck(connection);
        const responseTime = Date.now() - startTime;
        connection.averageResponseTime = connection.averageResponseTime * 0.8 + responseTime * 0.2;
        connection.consecutiveErrors = 0;
        connection.healthScore = Math.min(100, connection.healthScore + 10);
        this.metrics.healthChecksPassed++;
      } catch (error) {
        connection.consecutiveErrors++;
        connection.errorCount++;
        connection.healthScore = Math.max(0, connection.healthScore - 20);
        this.metrics.healthChecksFailed++;
        if (connection.consecutiveErrors >= connection.maxConsecutiveErrors) {
          connection.isActive = false;
          this.emit("connectionUnhealthy", connection);
        }
      }
    });
    await Promise.allSettled(healthCheckPromises);
    this.updateConnectionCounts();
  }
  async simulateHealthCheck(connection) {
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.95 || connection.healthScore > 80) {
          resolve(void 0);
        } else {
          reject(new Error("Health check failed"));
        }
      }, Math.random() * 100 + 10);
    });
  }
  // Auto-scaling
  startAutoScaling() {
    this.scaleTimer = setInterval(() => {
      this.evaluateScaling();
    }, 1e4);
  }
  evaluateScaling() {
    const utilization = this.getUtilization();
    if (utilization > this.config.scaleUpThreshold) {
      this.scaleUp();
    } else if (utilization < this.config.scaleDownThreshold) {
      this.scaleDown();
    }
  }
  getUtilization() {
    const totalConnections = this.connections.size;
    if (totalConnections === 0)
      return 0;
    const busyConnections = Array.from(this.connections.values()).filter((conn) => conn.isBusy).length;
    return busyConnections / totalConnections * 100;
  }
  async scaleUp() {
    let targetProviderId = null;
    let maxLoad = 0;
    for (const [providerId, connectionIds] of this.providerPools) {
      const providerConnections = Array.from(connectionIds).map((id) => this.connections.get(id)).filter((conn) => conn.isActive);
      const busyCount = providerConnections.filter((conn) => conn.isBusy).length;
      const load = busyCount / Math.max(providerConnections.length, 1);
      if (load > maxLoad && this.canCreateNewConnection(providerId)) {
        maxLoad = load;
        targetProviderId = providerId;
      }
    }
    if (targetProviderId) {
      try {
        await this.createConnection(targetProviderId);
        this.emit("scaledUp", { providerId: targetProviderId, totalConnections: this.connections.size });
      } catch (error) {
        this.emit("scaleUpFailed", { providerId: targetProviderId, error });
      }
    }
  }
  scaleDown() {
    const idleConnections = Array.from(this.connections.values()).filter((conn) => !conn.isBusy && conn.isActive).sort((a, b) => a.lastUsed - b.lastUsed);
    if (idleConnections.length > this.config.minConnections) {
      const connectionToRemove = idleConnections[0];
      this.destroyConnection(connectionToRemove.id);
      this.emit("scaledDown", {
        connectionId: connectionToRemove.id,
        totalConnections: this.connections.size
      });
    }
  }
  // Cleanup
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredConnections();
    }, 6e4);
  }
  cleanupExpiredConnections() {
    const now = Date.now();
    const connectionsToRemove = [];
    for (const connection of this.connections.values()) {
      if (now - connection.createdAt > this.config.maxConnectionAge) {
        connectionsToRemove.push(connection.id);
      } else if (!connection.isBusy && now - connection.lastUsed > this.config.idleTimeout) {
        connectionsToRemove.push(connection.id);
      } else if (!connection.isActive) {
        connectionsToRemove.push(connection.id);
      }
    }
    connectionsToRemove.forEach((id) => this.destroyConnection(id));
    if (connectionsToRemove.length > 0) {
      this.emit("cleanupCompleted", { removedConnections: connectionsToRemove.length });
    }
  }
  // Metrics and Monitoring
  updateConnectionCounts() {
    const connections = Array.from(this.connections.values());
    this.metrics.totalConnections = connections.length;
    this.metrics.activeConnections = connections.filter((conn) => conn.isActive).length;
    this.metrics.busyConnections = connections.filter((conn) => conn.isBusy).length;
    this.metrics.idleConnections = connections.filter((conn) => !conn.isBusy && conn.isActive).length;
    this.metrics.poolUtilization = this.getUtilization();
  }
  updateMetrics(event, duration) {
    switch (event) {
      case "connectionAcquired":
        this.metrics.totalRequests++;
        this.metrics.successfulRequests++;
        if (duration) {
          this.metrics.averageResponseTime = this.metrics.averageResponseTime * 0.9 + duration * 0.1;
        }
        break;
      case "connectionError":
        this.metrics.totalRequests++;
        this.metrics.failedRequests++;
        break;
    }
  }
  // Public API
  getMetrics() {
    return { ...this.metrics };
  }
  getConnectionStatus() {
    return Array.from(this.connections.values()).map((connection) => ({
      connection,
      provider: connection.providerId,
      status: !connection.isActive ? "unhealthy" : connection.isBusy ? "busy" : "idle"
    }));
  }
  getProviderStats() {
    const stats = /* @__PURE__ */ new Map();
    for (const [providerId, connectionIds] of this.providerPools) {
      const connections = Array.from(connectionIds).map((id) => this.connections.get(id)).filter((conn) => conn);
      const activeConnections = connections.filter((conn) => conn.isActive);
      const busyConnections = connections.filter((conn) => conn.isBusy);
      const avgResponseTime = activeConnections.length > 0 ? activeConnections.reduce((sum, conn) => sum + conn.averageResponseTime, 0) / activeConnections.length : 0;
      const avgHealthScore = activeConnections.length > 0 ? activeConnections.reduce((sum, conn) => sum + conn.healthScore, 0) / activeConnections.length : 0;
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
  async warmup(providerId, targetConnections) {
    const existingConnections = this.providerPools.get(providerId)?.size || 0;
    const connectionsToCreate = Math.max(0, targetConnections - existingConnections);
    const creationPromises = Array.from(
      { length: connectionsToCreate },
      () => this.createConnection(providerId)
    );
    await Promise.allSettled(creationPromises);
    this.emit("warmupCompleted", { providerId, connectionsCreated: connectionsToCreate });
  }
  drain() {
    return new Promise((resolve) => {
      this.requestQueue.forEach((request) => {
        clearTimeout(request.timeout);
        request.reject(new Error("Pool is draining"));
      });
      this.requestQueue.length = 0;
      const checkIdle = () => {
        const busyConnections = Array.from(this.connections.values()).filter((conn) => conn.isBusy);
        if (busyConnections.length === 0) {
          resolve();
        } else {
          setTimeout(checkIdle, 100);
        }
      };
      checkIdle();
    });
  }
  destroy() {
    if (this.healthCheckInterval)
      clearInterval(this.healthCheckInterval);
    if (this.scaleTimer)
      clearInterval(this.scaleTimer);
    if (this.cleanupTimer)
      clearInterval(this.cleanupTimer);
    this.requestQueue.forEach((request) => {
      clearTimeout(request.timeout);
      request.reject(new Error("Pool destroyed"));
    });
    this.connections.clear();
    this.providerPools.clear();
    this.requestQueue.length = 0;
    this.removeAllListeners();
  }
};
var ChainAbstraction = class extends events.EventEmitter {
  constructor(rpcManager, connectionPool, logger, config) {
    super();
    this.config = config;
    this.rpcManager = rpcManager;
    this.connectionPool = connectionPool;
    this.logger = logger;
    this.setupChainConfigs();
    this.initializeProviders();
    this.initializeTokenLists();
    this.initializeGasOracles();
  }
  logger;
  rpcManager;
  connectionPool;
  chains = /* @__PURE__ */ new Map();
  providers = /* @__PURE__ */ new Map();
  tokenLists = /* @__PURE__ */ new Map();
  gasOracles = /* @__PURE__ */ new Map();
  solanaConnection = null;
  setupChainConfigs() {
    this.chains.set("ethereum", {
      chainId: 1,
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      rpcUrls: [
        "https://ethereum.publicnode.com",
        "https://rpc.ankr.com/eth",
        "https://eth-mainnet.public.blastapi.io"
      ],
      wsUrls: [
        "wss://ethereum.publicnode.com",
        "wss://rpc.ankr.com/eth/ws"
      ],
      blockExplorerUrl: "https://etherscan.io",
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: true,
        mev: true,
        layer2: false
      }
    });
    this.chains.set("bsc", {
      chainId: 56,
      name: "Binance Smart Chain",
      symbol: "BNB",
      decimals: 18,
      rpcUrls: [
        "https://bsc-dataseed1.binance.org",
        "https://bsc-dataseed2.binance.org",
        "https://rpc.ankr.com/bsc"
      ],
      wsUrls: [
        "wss://bsc-ws-node.nariox.org:443",
        "wss://bsc.publicnode.com"
      ],
      blockExplorerUrl: "https://bscscan.com",
      nativeCurrency: {
        name: "Binance Coin",
        symbol: "BNB",
        decimals: 18
      },
      features: {
        eip1559: false,
        flashbots: false,
        mev: true,
        layer2: false
      }
    });
    this.chains.set("polygon", {
      chainId: 137,
      name: "Polygon",
      symbol: "MATIC",
      decimals: 18,
      rpcUrls: [
        "https://polygon-rpc.com",
        "https://rpc.ankr.com/polygon",
        "https://polygon-mainnet.public.blastapi.io"
      ],
      wsUrls: [
        "wss://polygon-bor.publicnode.com",
        "wss://rpc.ankr.com/polygon/ws"
      ],
      blockExplorerUrl: "https://polygonscan.com",
      nativeCurrency: {
        name: "Polygon",
        symbol: "MATIC",
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: false,
        mev: true,
        layer2: true
      }
    });
    this.chains.set("arbitrum", {
      chainId: 42161,
      name: "Arbitrum One",
      symbol: "ETH",
      decimals: 18,
      rpcUrls: [
        "https://arb1.arbitrum.io/rpc",
        "https://rpc.ankr.com/arbitrum",
        "https://arbitrum-mainnet.public.blastapi.io"
      ],
      wsUrls: [
        "wss://arb1.arbitrum.io/ws",
        "wss://rpc.ankr.com/arbitrum/ws"
      ],
      blockExplorerUrl: "https://arbiscan.io",
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: false,
        mev: true,
        layer2: true
      }
    });
    this.chains.set("optimism", {
      chainId: 10,
      name: "Optimism",
      symbol: "ETH",
      decimals: 18,
      rpcUrls: [
        "https://mainnet.optimism.io",
        "https://rpc.ankr.com/optimism",
        "https://optimism-mainnet.public.blastapi.io"
      ],
      wsUrls: [
        "wss://optimism-mainnet.public.blastapi.io",
        "wss://rpc.ankr.com/optimism/ws"
      ],
      blockExplorerUrl: "https://optimistic.etherscan.io",
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18
      },
      features: {
        eip1559: true,
        flashbots: false,
        mev: true,
        layer2: true
      }
    });
    this.chains.set("solana", {
      chainId: 101,
      // Solana mainnet-beta
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      rpcUrls: [
        "https://api.mainnet-beta.solana.com",
        "https://rpc.ankr.com/solana",
        "https://solana-api.projectserum.com"
      ],
      wsUrls: [
        "wss://api.mainnet-beta.solana.com",
        "wss://rpc.ankr.com/solana/ws"
      ],
      blockExplorerUrl: "https://solscan.io",
      nativeCurrency: {
        name: "Solana",
        symbol: "SOL",
        decimals: 9
      },
      features: {
        eip1559: false,
        flashbots: false,
        mev: true,
        layer2: false
      }
    });
    this.logger.info("Chain configurations initialized", {
      chains: Array.from(this.chains.keys())
    });
  }
  async initializeProviders() {
    for (const [chainName, chainConfig] of this.chains) {
      if (chainName === "solana") {
        continue;
      }
      const provider = new ethers.ethers.FallbackProvider(
        chainConfig.rpcUrls.map((url, index) => ({
          provider: new ethers.ethers.JsonRpcProvider(url),
          priority: index + 1,
          weight: 1
        }))
      );
      this.providers.set(chainName, provider);
    }
  }
  initializeTokenLists() {
    const commonTokens = {
      ethereum: [
        {
          address: "0xA0b86a33E6441e27a4E54E7cb03FA3a84F8C0F4F",
          name: "USD Coin",
          symbol: "USDC",
          decimals: 6,
          logoURI: "https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png"
        },
        {
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          name: "Tether USD",
          symbol: "USDT",
          decimals: 6,
          logoURI: "https://assets.coingecko.com/coins/images/325/thumb/Tether-logo.png"
        },
        {
          address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          name: "Wrapped Ether",
          symbol: "WETH",
          decimals: 18,
          logoURI: "https://assets.coingecko.com/coins/images/2518/thumb/weth.png"
        }
      ],
      bsc: [
        {
          address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
          name: "USD Coin",
          symbol: "USDC",
          decimals: 18,
          logoURI: "https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png"
        },
        {
          address: "0x55d398326f99059fF775485246999027B3197955",
          name: "Tether USD",
          symbol: "USDT",
          decimals: 18,
          logoURI: "https://assets.coingecko.com/coins/images/325/thumb/Tether-logo.png"
        },
        {
          address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
          name: "Wrapped BNB",
          symbol: "WBNB",
          decimals: 18,
          logoURI: "https://assets.coingecko.com/coins/images/825/thumb/bnb-icon2_2x.png"
        }
      ]
    };
    for (const [chain, tokens] of Object.entries(commonTokens)) {
      const tokenMap = /* @__PURE__ */ new Map();
      for (const token of tokens) {
        tokenMap.set(token.address.toLowerCase(), token);
      }
      this.tokenLists.set(chain, tokenMap);
    }
  }
  initializeGasOracles() {
    const gasOracles = {
      ethereum: {
        fast: () => this.getGasPrice("ethereum", "fast"),
        standard: () => this.getGasPrice("ethereum", "standard"),
        safe: () => this.getGasPrice("ethereum", "safe")
      },
      bsc: {
        fast: () => this.getGasPrice("bsc", "fast"),
        standard: () => this.getGasPrice("bsc", "standard"),
        safe: () => this.getGasPrice("bsc", "safe")
      }
    };
    for (const [chain, oracle] of Object.entries(gasOracles)) {
      this.gasOracles.set(chain, oracle);
    }
  }
  // Public API Methods
  getChainConfig(chain) {
    return this.chains.get(chain);
  }
  getSupportedChains() {
    return Array.from(this.chains.keys());
  }
  isChainSupported(chain) {
    return this.chains.has(chain);
  }
  async getProvider(chain) {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Provider not available for chain: ${chain}`);
    }
    return provider;
  }
  // Block and Transaction Methods
  async getBlockNumber(chain) {
    if (chain === "solana") {
      return this.getSolanaSlot();
    }
    const provider = await this.getProvider(chain);
    return provider.getBlockNumber();
  }
  async getBlock(chain, blockNumber) {
    if (chain === "solana") {
      return this.getSolanaBlock(blockNumber);
    }
    const provider = await this.getProvider(chain);
    const block = await provider.getBlock(blockNumber);
    if (!block) {
      throw new Error(`Block ${blockNumber} not found on ${chain}`);
    }
    return {
      number: block.number,
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      gasLimit: block.gasLimit.toString(),
      gasUsed: block.gasUsed.toString(),
      baseFeePerGas: block.baseFeePerGas?.toString(),
      transactions: block.transactions
    };
  }
  async getTransaction(chain, hash) {
    if (chain === "solana") {
      return this.getSolanaTransaction(hash);
    }
    const provider = await this.getProvider(chain);
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt)
      return null;
    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      transactionIndex: receipt.index,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.gasPrice.toString(),
      status: receipt.status || 0,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.index
      })),
      confirmations: receipt.confirmations
    };
  }
  // Gas Management
  async getGasPrice(chain, speed = "standard") {
    if (chain === "solana") {
      return { gasLimit: "200000" };
    }
    const provider = await this.getProvider(chain);
    const chainConfig = this.getChainConfig(chain);
    if (chainConfig.features.eip1559) {
      const feeData = await provider.getFeeData();
      let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.ethers.parseUnits("2", "gwei");
      let maxFeePerGas = feeData.maxFeePerGas || ethers.ethers.parseUnits("20", "gwei");
      const multipliers = {
        safe: 0.8,
        standard: 1,
        fast: 1.2
      };
      const multiplier = multipliers[speed];
      maxPriorityFeePerGas = maxPriorityFeePerGas * BigInt(Math.floor(multiplier * 100)) / BigInt(100);
      maxFeePerGas = maxFeePerGas * BigInt(Math.floor(multiplier * 100)) / BigInt(100);
      return {
        type: 2,
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString()
      };
    } else {
      const gasPrice = await provider.getFeeData();
      let price = gasPrice.gasPrice || ethers.ethers.parseUnits("5", "gwei");
      const multipliers = {
        safe: 0.8,
        standard: 1,
        fast: 1.2
      };
      const multiplier = multipliers[speed];
      price = price * BigInt(Math.floor(multiplier * 100)) / BigInt(100);
      return {
        type: 0,
        gasPrice: price.toString()
      };
    }
  }
  async estimateGas(chain, transaction) {
    if (chain === "solana") {
      return "200000";
    }
    const provider = await this.getProvider(chain);
    const gasEstimate = await provider.estimateGas(transaction);
    const multiplied = gasEstimate * BigInt(Math.floor(this.config.gasMultiplier * 100)) / BigInt(100);
    return multiplied.toString();
  }
  // Token Management
  async getTokenInfo(chain, address) {
    const tokenList = this.tokenLists.get(chain);
    const cachedToken = tokenList?.get(address.toLowerCase());
    if (cachedToken) {
      return cachedToken;
    }
    return this.fetchTokenInfoFromChain(chain, address);
  }
  async fetchTokenInfoFromChain(chain, address) {
    if (chain === "solana") {
      return this.fetchSolanaTokenInfo(address);
    }
    try {
      const provider = await this.getProvider(chain);
      const abi = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)"
      ];
      const contract = new ethers.ethers.Contract(address, abi, provider);
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals()
      ]);
      const tokenInfo = {
        address: address.toLowerCase(),
        name,
        symbol,
        decimals
      };
      const tokenList = this.tokenLists.get(chain);
      if (tokenList) {
        tokenList.set(address.toLowerCase(), tokenInfo);
      }
      return tokenInfo;
    } catch (error) {
      console.error(`Failed to fetch token info for ${address} on ${chain}:`, error);
      return null;
    }
  }
  async getTokenBalance(chain, tokenAddress, walletAddress) {
    if (chain === "solana") {
      return this.getSolanaTokenBalance(tokenAddress, walletAddress);
    }
    const provider = await this.getProvider(chain);
    if (tokenAddress === "native" || tokenAddress === ethers.ethers.ZeroAddress) {
      const balance2 = await provider.getBalance(walletAddress);
      return balance2.toString();
    }
    const abi = ["function balanceOf(address) view returns (uint256)"];
    const contract = new ethers.ethers.Contract(tokenAddress, abi, provider);
    const balance = await contract.balanceOf(walletAddress);
    return balance.toString();
  }
  // DEX Integration
  async getSwapQuote(chain, inputToken, outputToken, inputAmount, slippage = this.config.defaultSlippage) {
    if (chain === "solana") {
      return this.getSolanaSwapQuote(inputToken, outputToken, inputAmount, slippage);
    }
    return this.get0xSwapQuote(chain, inputToken, outputToken, inputAmount, slippage);
  }
  async executeSwap(chain, quote, signer) {
    if (chain === "solana") {
      return this.executeSolanaSwap(quote, signer);
    }
    return this.executeEVMSwap(chain, quote, signer);
  }
  // Cross-chain bridge operations
  async getBridgeQuote(fromChain, toChain, token, amount) {
    throw new Error("Bridge operations not yet implemented");
  }
  // Utility Methods
  formatAmount(amount, decimals) {
    return ethers.ethers.formatUnits(amount, decimals);
  }
  parseAmount(amount, decimals) {
    return ethers.ethers.parseUnits(amount, decimals).toString();
  }
  isValidAddress(chain, address) {
    if (chain === "solana") {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }
    return ethers.ethers.isAddress(address);
  }
  // Private helper methods for Solana
  async getSolanaSlot() {
    throw new Error("Solana slot fetching not implemented");
  }
  async getSolanaBlock(slot) {
    throw new Error("Solana block fetching not implemented");
  }
  async getSolanaTransaction(signature) {
    throw new Error("Solana transaction fetching not implemented");
  }
  async fetchSolanaTokenInfo(mint) {
    throw new Error("Solana token info fetching not implemented");
  }
  async getSolanaTokenBalance(mint, owner) {
    throw new Error("Solana token balance fetching not implemented");
  }
  async getSolanaSwapQuote(inputMint, outputMint, amount, slippage) {
    throw new Error("Solana swap quotes not implemented");
  }
  async executeSolanaSwap(quote, signer) {
    throw new Error("Solana swap execution not implemented");
  }
  // Private helper methods for EVM chains
  async get0xSwapQuote(chain, inputToken, outputToken, inputAmount, slippage) {
    this.getChainConfig(chain);
    const inputTokenInfo = await this.getTokenInfo(chain, inputToken);
    const outputTokenInfo = await this.getTokenInfo(chain, outputToken);
    if (!inputTokenInfo || !outputTokenInfo) {
      throw new Error("Token info not found");
    }
    const outputAmount = BigInt(inputAmount) * BigInt(98) / BigInt(100);
    return {
      inputToken: inputTokenInfo,
      outputToken: outputTokenInfo,
      inputAmount,
      outputAmount: outputAmount.toString(),
      route: [
        {
          protocol: "Uniswap V3",
          percentage: 100
        }
      ],
      gasEstimate: await this.getGasPrice(chain, "fast"),
      priceImpact: "0.1",
      minimumReceived: (outputAmount * BigInt(1e4 - Math.floor(slippage * 100)) / BigInt(1e4)).toString(),
      slippage: slippage.toString()
    };
  }
  async executeEVMSwap(chain, quote, signer) {
    throw new Error("EVM swap execution not implemented");
  }
  // Event methods
  async waitForTransaction(chain, hash, confirmations = 1) {
    if (chain === "solana") {
      throw new Error("Solana transaction waiting not implemented");
    }
    const provider = await this.getProvider(chain);
    const receipt = await provider.waitForTransaction(hash, confirmations);
    if (!receipt)
      return null;
    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      transactionIndex: receipt.index,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.gasPrice.toString(),
      status: receipt.status || 0,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.index
      })),
      confirmations: receipt.confirmations
    };
  }
  destroy() {
    this.providers.clear();
    this.chains.clear();
    this.tokenLists.clear();
    this.gasOracles.clear();
    this.removeAllListeners();
  }
};
var DEXAggregator = class extends events.EventEmitter {
  logger;
  chainAbstraction;
  dexConfigs = /* @__PURE__ */ new Map();
  tokenLists = /* @__PURE__ */ new Map();
  // chain -> tokens
  priceCache = /* @__PURE__ */ new Map();
  routeCache = /* @__PURE__ */ new Map();
  dexStats = /* @__PURE__ */ new Map();
  stats;
  constructor(chainAbstraction, logger) {
    super();
    this.chainAbstraction = chainAbstraction;
    this.logger = logger;
    this.stats = {
      totalQuotes: 0,
      successfulQuotes: 0,
      averageResponseTime: 0,
      totalVolumeRouted: "0",
      activeDEXes: 0,
      chainStats: /* @__PURE__ */ new Map()
    };
    this.setupDEXConfigs();
    this.loadTokenLists();
    this.startStatsCollection();
  }
  setupDEXConfigs() {
    this.addDEXConfig({
      id: "uniswap-v3-eth",
      name: "Uniswap V3",
      chain: "ethereum",
      type: "uniswap-v3",
      routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      fee: 30,
      // 0.3%
      gasMultiplier: 1.2,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input", "exact-output"]
    });
    this.addDEXConfig({
      id: "uniswap-v2-eth",
      name: "Uniswap V2",
      chain: "ethereum",
      type: "uniswap-v2",
      routerAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      factoryAddress: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
      fee: 30,
      // 0.3%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input"]
    });
    this.addDEXConfig({
      id: "1inch-eth",
      name: "1inch",
      chain: "ethereum",
      type: "1inch",
      apiUrl: "https://api.1inch.dev/swap/v5.2/1",
      apiKey: process.env.ONEINCH_API_KEY,
      fee: 0,
      // 1inch handles fees internally
      gasMultiplier: 1.1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-dex", "gas-optimization", "partial-fill"]
    });
    this.addDEXConfig({
      id: "pancakeswap-v3-bsc",
      name: "PancakeSwap V3",
      chain: "bsc",
      type: "uniswap-v3",
      routerAddress: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
      factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
      fee: 25,
      // 0.25%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input", "exact-output"]
    });
    this.addDEXConfig({
      id: "pancakeswap-v2-bsc",
      name: "PancakeSwap V2",
      chain: "bsc",
      type: "uniswap-v2",
      routerAddress: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
      factoryAddress: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
      fee: 25,
      // 0.25%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input"]
    });
    this.addDEXConfig({
      id: "1inch-bsc",
      name: "1inch",
      chain: "bsc",
      type: "1inch",
      apiUrl: "https://api.1inch.dev/swap/v5.2/56",
      apiKey: process.env.ONEINCH_API_KEY,
      fee: 0,
      gasMultiplier: 1.1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-dex", "gas-optimization"]
    });
    this.addDEXConfig({
      id: "uniswap-v3-polygon",
      name: "Uniswap V3",
      chain: "polygon",
      type: "uniswap-v3",
      routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      fee: 30,
      // 0.3%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input", "exact-output"]
    });
    this.addDEXConfig({
      id: "quickswap-polygon",
      name: "QuickSwap",
      chain: "polygon",
      type: "uniswap-v2",
      routerAddress: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
      factoryAddress: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
      fee: 30,
      // 0.3%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input"]
    });
    this.addDEXConfig({
      id: "uniswap-v3-arbitrum",
      name: "Uniswap V3",
      chain: "arbitrum",
      type: "uniswap-v3",
      routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      fee: 30,
      // 0.3%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input", "exact-output"]
    });
    this.addDEXConfig({
      id: "camelot-arbitrum",
      name: "Camelot",
      chain: "arbitrum",
      type: "uniswap-v2",
      routerAddress: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d",
      factoryAddress: "0x6EcCab422D763aC031210895C81787E87B91425a",
      fee: 30,
      // 0.3%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input"]
    });
    this.addDEXConfig({
      id: "uniswap-v3-optimism",
      name: "Uniswap V3",
      chain: "optimism",
      type: "uniswap-v3",
      routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      fee: 30,
      // 0.3%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input", "exact-output"]
    });
    this.addDEXConfig({
      id: "jupiter-solana",
      name: "Jupiter",
      chain: "solana",
      type: "jupiter",
      apiUrl: "https://quote-api.jup.ag/v6",
      fee: 0,
      // Jupiter aggregates multiple DEXes
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-dex", "exact-input", "exact-output"]
    });
    this.addDEXConfig({
      id: "raydium-solana",
      name: "Raydium",
      chain: "solana",
      type: "uniswap-v2",
      // Similar AMM model
      apiUrl: "https://api.raydium.io/v2",
      fee: 25,
      // 0.25%
      gasMultiplier: 1,
      isActive: true,
      supportedFeatures: ["price-quotes", "multi-hop", "exact-input"]
    });
    this.logger.info("DEX configurations initialized", {
      totalDEXes: this.dexConfigs.size,
      chains: Array.from(new Set(Array.from(this.dexConfigs.values()).map((d) => d.chain)))
    });
  }
  addDEXConfig(config) {
    this.dexConfigs.set(config.id, config);
    this.dexStats.set(config.id, {
      totalVolume24h: "0",
      totalLiquidity: "0",
      successRate: 100,
      averageSlippage: 0,
      averageGasCost: "0",
      responseTime: 0,
      lastUpdated: Date.now()
    });
  }
  async loadTokenLists() {
    const tokenListUrls = {
      ethereum: "https://tokens.uniswap.org",
      bsc: "https://tokens.pancakeswap.finance/pancakeswap-extended.json",
      polygon: "https://unpkg.com/quickswap-default-token-list@1.0.71/build/quickswap-default.tokenlist.json",
      arbitrum: "https://bridge.arbitrum.io/token-list-42161.json",
      optimism: "https://static.optimism.io/optimism.tokenlist.json"
    };
    for (const [chain, url] of Object.entries(tokenListUrls)) {
      try {
        const response = await axios2__default.default.get(url, { timeout: 1e4 });
        const tokenList = response.data.tokens || response.data;
        const formattedTokens = tokenList.filter((token) => token.chainId === this.getChainId(chain)).map((token) => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          chainId: token.chainId
        }));
        this.tokenLists.set(chain, formattedTokens);
        this.logger.info("Token list loaded", {
          chain,
          tokenCount: formattedTokens.length
        });
      } catch (error) {
        this.logger.warn("Failed to load token list", {
          chain,
          url,
          error: error.message
        });
      }
    }
  }
  getChainId(chain) {
    const chainIds = {
      ethereum: 1,
      bsc: 56,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      solana: 101
    };
    return chainIds[chain] || 1;
  }
  // Main quote aggregation method
  async getSwapQuote(request) {
    const startTime = Date.now();
    try {
      await this.validateQuoteRequest(request);
      const availableDEXes = this.getAvailableDEXes(request.chain, request.excludeDEXes, request.includeDEXes);
      if (availableDEXes.length === 0) {
        throw new Error(`No available DEXes for chain: ${request.chain}`);
      }
      const quotePromises = availableDEXes.map(
        (dex) => this.getQuoteFromDEX(dex, request).catch((error) => {
          this.logger.warn("DEX quote failed", {
            dex: dex.id,
            error: error.message
          });
          return null;
        })
      );
      const quoteResults = await Promise.allSettled(quotePromises);
      const successfulQuotes = quoteResults.filter((result) => result.status === "fulfilled" && result.value !== null).map((result) => result.value);
      if (successfulQuotes.length === 0) {
        throw new Error("No successful quotes from any DEX");
      }
      const bestRoute = this.selectBestRoute(successfulQuotes, request);
      this.updateStats(request.chain, successfulQuotes.length > 0);
      const response = {
        routes: successfulQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount)),
        bestRoute,
        estimatedGas: bestRoute.gasEstimate.gasLimit,
        totalGasCost: bestRoute.gasEstimate.totalCost,
        netOutput: this.calculateNetOutput(bestRoute),
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };
      this.emit("quoteGenerated", { request, response, executionTime: response.executionTime });
      return response;
    } catch (error) {
      this.updateStats(request.chain, false);
      this.logger.error("Failed to get swap quote", {
        request,
        error: error.message,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }
  async validateQuoteRequest(request) {
    if (!this.chainAbstraction.getSupportedChains().includes(request.chain)) {
      throw new Error(`Unsupported chain: ${request.chain}`);
    }
    if (!this.chainAbstraction.isValidAddress(request.chain, request.inputToken)) {
      throw new Error(`Invalid input token address: ${request.inputToken}`);
    }
    if (!this.chainAbstraction.isValidAddress(request.chain, request.outputToken)) {
      throw new Error(`Invalid output token address: ${request.outputToken}`);
    }
    if (parseFloat(request.amount) <= 0) {
      throw new Error("Amount must be greater than 0");
    }
    if (request.slippage < 0 || request.slippage > 50) {
      throw new Error("Slippage must be between 0 and 50%");
    }
  }
  getAvailableDEXes(chain, excludeDEXes, includeDEXes) {
    let dexes = Array.from(this.dexConfigs.values()).filter((dex) => dex.chain === chain && dex.isActive);
    if (includeDEXes && includeDEXes.length > 0) {
      dexes = dexes.filter((dex) => includeDEXes.includes(dex.id));
    }
    if (excludeDEXes && excludeDEXes.length > 0) {
      dexes = dexes.filter((dex) => !excludeDEXes.includes(dex.id));
    }
    return dexes;
  }
  async getQuoteFromDEX(dex, request) {
    const startTime = Date.now();
    try {
      let route;
      switch (dex.type) {
        case "1inch":
          route = await this.get1inchQuote(dex, request);
          break;
        case "jupiter":
          route = await this.getJupiterQuote(dex, request);
          break;
        case "uniswap-v3":
          route = await this.getUniswapV3Quote(dex, request);
          break;
        case "uniswap-v2":
          route = await this.getUniswapV2Quote(dex, request);
          break;
        default:
          throw new Error(`Unsupported DEX type: ${dex.type}`);
      }
      const responseTime = Date.now() - startTime;
      this.updateDEXStats(dex.id, responseTime, true);
      return route;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateDEXStats(dex.id, responseTime, false);
      throw error;
    }
  }
  async get1inchQuote(dex, request) {
    const params = new URLSearchParams({
      fromTokenAddress: request.inputToken,
      toTokenAddress: request.outputToken,
      amount: request.amount,
      slippage: request.slippage.toString(),
      disableEstimate: "false",
      allowPartialFill: "true"
    });
    if (request.userAddress) {
      params.append("fromAddress", request.userAddress);
    }
    const response = await axios2__default.default.get(`${dex.apiUrl}/quote?${params}`, {
      headers: {
        "Authorization": `Bearer ${dex.apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 1e4
    });
    const quote = response.data;
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);
    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount: quote.toTokenAmount,
      expectedOutputAmount: quote.toTokenAmount,
      minimumOutputAmount: quote.toTokenAmount,
      price: (parseFloat(quote.toTokenAmount) / parseFloat(request.amount)).toString(),
      priceImpact: (quote.estimatedGas / parseFloat(quote.toTokenAmount) * 100).toString(),
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: quote.estimatedGas.toString(),
        gasPrice: quote.gasPrice?.toString() || "0",
        totalCost: quote.estimatedGas.toString(),
        totalCostFormatted: "0 ETH"
      },
      route: this.parse1inchRoute(quote.protocols),
      confidence: 85,
      // 1inch generally reliable
      executionTime: 2e3
      // estimated
    };
  }
  async getJupiterQuote(dex, request) {
    const params = new URLSearchParams({
      inputMint: request.inputToken,
      outputMint: request.outputToken,
      amount: request.amount,
      slippageBps: (request.slippage * 100).toString()
    });
    const response = await axios2__default.default.get(`${dex.apiUrl}/quote?${params}`, {
      timeout: 1e4
    });
    const quote = response.data;
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);
    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount: quote.outAmount,
      expectedOutputAmount: quote.outAmount,
      minimumOutputAmount: quote.otherAmountThreshold,
      price: (parseFloat(quote.outAmount) / parseFloat(request.amount)).toString(),
      priceImpact: quote.priceImpactPct || "0",
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: "200000",
        // Solana compute units
        gasPrice: "5000",
        totalCost: "1000000",
        totalCostFormatted: "0.001 SOL"
      },
      route: this.parseJupiterRoute(quote.routePlan),
      confidence: 90,
      // Jupiter is highly optimized
      executionTime: 1e3
    };
  }
  async getUniswapV3Quote(dex, request) {
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);
    const mockPrice = 1;
    const outputAmount = (parseFloat(request.amount) * mockPrice * 0.997).toString();
    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount,
      expectedOutputAmount: outputAmount,
      minimumOutputAmount: (parseFloat(outputAmount) * (1 - request.slippage / 100)).toString(),
      price: mockPrice.toString(),
      priceImpact: "0.1",
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: "150000",
        gasPrice: "20000000000",
        totalCost: "3000000000000000",
        totalCostFormatted: "0.003 ETH"
      },
      route: [{
        dex: dex.id,
        pool: "0x...",
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: request.amount,
        amountOut: outputAmount,
        fee: dex.fee,
        priceImpact: "0.1"
      }],
      confidence: 80,
      executionTime: 3e3
    };
  }
  async getUniswapV2Quote(dex, request) {
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);
    const mockPrice = 1;
    const outputAmount = (parseFloat(request.amount) * mockPrice * 0.997).toString();
    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount,
      expectedOutputAmount: outputAmount,
      minimumOutputAmount: (parseFloat(outputAmount) * (1 - request.slippage / 100)).toString(),
      price: mockPrice.toString(),
      priceImpact: "0.2",
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: "120000",
        gasPrice: "20000000000",
        totalCost: "2400000000000000",
        totalCostFormatted: "0.0024 ETH"
      },
      route: [{
        dex: dex.id,
        pool: "0x...",
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: request.amount,
        amountOut: outputAmount,
        fee: dex.fee,
        priceImpact: "0.2"
      }],
      confidence: 75,
      executionTime: 2500
    };
  }
  async getTokenInfo(chain, address) {
    const tokenList = this.tokenLists.get(chain) || [];
    const cachedToken = tokenList.find(
      (token) => token.address.toLowerCase() === address.toLowerCase()
    );
    if (cachedToken) {
      return cachedToken;
    }
    try {
      const balance = await this.chainAbstraction.getBalance(chain, address, address);
      if (balance.token) {
        return balance.token;
      }
    } catch (error) {
    }
    return {
      address,
      symbol: "UNKNOWN",
      name: "Unknown Token",
      decimals: 18,
      chainId: this.getChainId(chain)
    };
  }
  parse1inchRoute(protocols) {
    return protocols.map((protocol) => ({
      dex: protocol.name || "1inch",
      pool: protocol.part?.toString() || "100",
      tokenIn: {},
      // Would be populated
      tokenOut: {},
      amountIn: "0",
      amountOut: "0",
      fee: 0,
      priceImpact: "0"
    }));
  }
  parseJupiterRoute(routePlan) {
    return routePlan.map((step) => ({
      dex: step.swapInfo?.label || "jupiter",
      pool: step.swapInfo?.ammKey || "",
      tokenIn: {},
      tokenOut: {},
      amountIn: step.swapInfo?.inAmount || "0",
      amountOut: step.swapInfo?.outAmount || "0",
      fee: step.swapInfo?.feeAmount || 0,
      priceImpact: "0"
    }));
  }
  selectBestRoute(routes, request) {
    const scoredRoutes = routes.map((route) => {
      let score = 0;
      const outputScore = parseFloat(route.outputAmount) / Math.max(...routes.map((r) => parseFloat(r.outputAmount)));
      score += outputScore * 0.4;
      score += route.confidence / 100 * 0.25;
      const gasScore = 1 - parseFloat(route.gasEstimate.totalCost) / Math.max(...routes.map((r) => parseFloat(r.gasEstimate.totalCost)));
      score += gasScore * 0.2;
      const timeScore = 1 - route.executionTime / Math.max(...routes.map((r) => r.executionTime));
      score += timeScore * 0.1;
      const impactScore = 1 - parseFloat(route.priceImpact) / Math.max(...routes.map((r) => parseFloat(r.priceImpact)));
      score += impactScore * 0.05;
      return { route, score };
    });
    return scoredRoutes.reduce(
      (best, current) => current.score > best.score ? current : best
    ).route;
  }
  calculateNetOutput(route) {
    const outputAmount = parseFloat(route.outputAmount);
    const gasCost = parseFloat(route.gasEstimate.totalCost);
    const gasCostInOutputToken = gasCost * 1e-3;
    return Math.max(0, outputAmount - gasCostInOutputToken).toString();
  }
  updateStats(chain, success) {
    this.stats.totalQuotes++;
    if (success) {
      this.stats.successfulQuotes++;
    }
    const chainStats = this.stats.chainStats.get(chain) || {
      quotes: 0,
      volume: "0",
      averageSlippage: 0
    };
    chainStats.quotes++;
    this.stats.chainStats.set(chain, chainStats);
  }
  updateDEXStats(dexId, responseTime, success) {
    const stats = this.dexStats.get(dexId);
    if (!stats)
      return;
    stats.responseTime = stats.responseTime * 0.8 + responseTime * 0.2;
    if (success) {
      stats.successRate = Math.min(100, stats.successRate + 0.1);
    } else {
      stats.successRate = Math.max(0, stats.successRate - 1);
    }
    stats.lastUpdated = Date.now();
  }
  startStatsCollection() {
    setInterval(() => {
      this.logger.info("DEX Aggregator Statistics", {
        ...this.stats,
        activeDEXes: Array.from(this.dexConfigs.values()).filter((d) => d.isActive).length,
        chainBreakdown: Object.fromEntries(this.stats.chainStats)
      });
    }, 10 * 60 * 1e3);
  }
  // Public API methods
  getStats() {
    return { ...this.stats };
  }
  getDEXStats() {
    return new Map(this.dexStats);
  }
  getSupportedDEXes(chain) {
    let dexes = Array.from(this.dexConfigs.values());
    if (chain) {
      dexes = dexes.filter((dex) => dex.chain === chain);
    }
    return dexes.filter((dex) => dex.isActive);
  }
  getTokenList(chain) {
    return this.tokenLists.get(chain) || [];
  }
  async enableDEX(dexId) {
    const dex = this.dexConfigs.get(dexId);
    if (dex) {
      dex.isActive = true;
      this.logger.info("DEX enabled", { dexId });
    }
  }
  async disableDEX(dexId) {
    const dex = this.dexConfigs.get(dexId);
    if (dex) {
      dex.isActive = false;
      this.logger.info("DEX disabled", { dexId });
    }
  }
  async close() {
    this.priceCache.clear();
    this.routeCache.clear();
    this.logger.info("DEX Aggregator closed");
  }
};

exports.ChainAbstraction = ChainAbstraction;
exports.ConnectionPool = ConnectionPool;
exports.DEXAggregator = DEXAggregator;
exports.RPCManager = RPCManager;
//# sourceMappingURL=out.js.map
//# sourceMappingURL=index.js.map