import { EventEmitter } from 'events';
import { ethers } from 'ethers';

export interface PerformanceConfig {
  // Latency optimization
  maxMempoolLatency: number; // Max time to process mempool tx (ms)
  maxExecutionLatency: number; // Max time for full execution (ms)
  precomputeThreshold: number; // Precompute if opportunity > threshold
  
  // Concurrency settings
  maxConcurrentOpportunities: number;
  maxConcurrentSimulations: number;
  maxConcurrentExecutions: number;
  
  // Caching settings
  poolDataCacheTime: number; // Pool data cache duration (ms)
  tokenDataCacheTime: number; // Token data cache duration (ms)
  gasEstimateCacheTime: number; // Gas estimate cache duration (ms)
  
  // Performance thresholds
  minSuccessRate: number; // Minimum success rate to maintain
  targetLatencyMs: number; // Target end-to-end latency
  maxMemoryUsageMb: number; // Max memory usage limit
  
  // Gas optimization
  gasEstimationBuffer: number; // Gas estimation safety buffer (%)
  priorityFeeBoost: number; // Priority fee boost for speed (%)
  enableGasPrecompute: boolean; // Precompute gas estimates
}

export interface OpportunityMetrics {
  id: string;
  detectionTime: number;
  simulationTime: number;
  executionTime: number;
  totalLatency: number;
  memoryUsage: number;
  gasUsed: string;
  success: boolean;
  profit: string;
  chain: string;
}

export interface PerformanceStats {
  averageDetectionTime: number;
  averageSimulationTime: number;
  averageExecutionTime: number;
  averageTotalLatency: number;
  successRate: number;
  throughput: number; // Opportunities per second
  memoryUsage: number;
  cacheHitRate: number;
  gasEfficiency: number;
  profitPerMs: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class PerformanceOptimizer extends EventEmitter {
  private config: PerformanceConfig;
  private metrics: OpportunityMetrics[] = [];
  private poolCache = new Map<string, CacheEntry<any>>();
  private tokenCache = new Map<string, CacheEntry<any>>();
  private gasCache = new Map<string, CacheEntry<any>>();
  private routeCache = new Map<string, CacheEntry<any>>();
  
  // Performance monitoring
  private memoryMonitor?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private performanceReports: PerformanceStats[] = [];
  
  // Precomputed data for speed
  private precomputedGasEstimates = new Map<string, number>();
  private precomputedRoutes = new Map<string, any[]>();
  private warmupComplete = false;

  constructor(config: PerformanceConfig) {
    super();
    this.config = config;
    this.setupPerformanceMonitoring();
    this.setupCacheCleanup();
  }

  /**
   * Initialize performance optimizer with warmup
   */
  async initialize(): Promise<void> {
    console.log('Initializing performance optimizer...');
    
    // Warm up caches and precompute common data
    await this.performWarmup();
    
    this.warmupComplete = true;
    this.emit('initialized');
    console.log('Performance optimizer initialized and warmed up');
  }

  /**
   * Optimize opportunity detection speed
   */
  async optimizeDetection(
    txHash: string,
    transaction: any,
    chain: string
  ): Promise<{
    shouldProcess: boolean;
    estimatedLatency: number;
    priority: number;
    cacheHit: boolean;
  }> {
    const startTime = performance.now();
    
    // Skip warmup period for consistent performance
    if (!this.warmupComplete) {
      return {
        shouldProcess: false,
        estimatedLatency: performance.now() - startTime,
        priority: 0,
        cacheHit: false
      };
    }

    // Log transaction hash for tracking and debugging
    console.debug(`Analyzing transaction ${txHash} on ${chain}`);
    
    // Quick transaction filtering
    const basicCheck = this.quickTransactionFilter(transaction, chain);
    if (!basicCheck.valid) {
      return {
        shouldProcess: false,
        estimatedLatency: performance.now() - startTime,
        priority: 0,
        cacheHit: false
      };
    }

    // Check cache for similar transactions using transaction hash as well
    const cacheKey = this.generateTransactionCacheKey(transaction, chain);
    const txSpecificKey = `tx:${txHash}:${chain}`;
    
    let cached = this.getFromCache(this.routeCache, cacheKey);
    if (!cached) {
      cached = this.getFromCache(this.routeCache, txSpecificKey);
    }
    
    if (cached) {
      return {
        shouldProcess: cached.shouldProcess,
        estimatedLatency: performance.now() - startTime,
        priority: cached.priority,
        cacheHit: true
      };
    }

    // Check precomputed routes for faster processing
    const routeKey = `${chain}:${transaction.to}`;
    const precomputedRoute = this.precomputedRoutes.get(routeKey);
    let routeOptimization = '';
    
    if (precomputedRoute && precomputedRoute.length > 0) {
      routeOptimization = 'Using precomputed route';
      console.debug(`Using precomputed route for ${routeKey}`);
    }

    // Estimate processing latency
    const estimatedLatency = this.estimateProcessingLatency(transaction, chain);
    const priority = this.calculateOpportunityPriority(transaction, estimatedLatency);
    
    const shouldProcess = estimatedLatency <= this.config.maxMempoolLatency && 
                         priority >= this.config.precomputeThreshold;

    // Cache result with both keys for future reference
    const result = {
      shouldProcess,
      priority,
      estimatedLatency,
      routeOptimization,
      txHash
    };
    
    this.setCache(this.routeCache, cacheKey, result, 30000); // 30 second cache
    this.setCache(this.routeCache, txSpecificKey, result, 60000); // 1 minute cache for specific tx

    return {
      shouldProcess,
      estimatedLatency: performance.now() - startTime,
      priority,
      cacheHit: false
    };
  }

  /**
   * Optimize simulation performance
   */
  async optimizeSimulation(opportunity: any): Promise<{
    useCache: boolean;
    parallelizable: boolean;
    estimatedTime: number;
    optimizations: string[];
  }> {
    const optimizations: string[] = [];
    
    // Check if we can use cached pool data
    const poolCacheKey = `${opportunity.chain}:${opportunity.tokenIn}:${opportunity.tokenOut}`;
    const poolData = this.getFromCache(this.poolCache, poolCacheKey);
    const useCache = !!poolData;
    
    if (useCache) {
      optimizations.push('Using cached pool data');
    }

    // Check if simulation can be parallelized
    const parallelizable = this.canParallelizeSimulation(opportunity);
    if (parallelizable) {
      optimizations.push('Parallel simulation enabled');
    }

    // Estimate simulation time
    const baseTime = 50; // Base simulation time in ms
    let estimatedTime = baseTime;
    
    if (useCache) estimatedTime *= 0.6; // 40% faster with cache
    if (parallelizable) estimatedTime *= 0.7; // 30% faster with parallelization
    
    // Pre-fetch token data if not cached
    if (!this.getFromCache(this.tokenCache, opportunity.tokenIn)) {
      this.prefetchTokenData(opportunity.tokenIn, opportunity.chain);
      optimizations.push('Pre-fetching token data');
    }
    
    if (!this.getFromCache(this.tokenCache, opportunity.tokenOut)) {
      this.prefetchTokenData(opportunity.tokenOut, opportunity.chain);
    }

    return {
      useCache,
      parallelizable,
      estimatedTime,
      optimizations
    };
  }

  /**
   * Optimize execution speed
   */
  async optimizeExecution(opportunity: any): Promise<{
    gasSettings: {
      gasLimit: number;
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
    executionStrategy: 'immediate' | 'batched' | 'delayed';
    optimizations: string[];
  }> {
    const optimizations: string[] = [];
    
    // Get optimized gas settings
    const gasSettings = await this.getOptimizedGasSettings(opportunity);
    optimizations.push('Optimized gas settings');

    // Determine execution strategy
    let executionStrategy: 'immediate' | 'batched' | 'delayed' = 'immediate';
    
    const estimatedProfit = parseFloat(opportunity.estimatedProfit);
    const currentCongestion = await this.getNetworkCongestion(opportunity.chain);
    
    if (estimatedProfit > 100) {
      executionStrategy = 'immediate';
      optimizations.push('High-profit immediate execution');
    } else if (currentCongestion > 0.8) {
      executionStrategy = 'delayed';
      optimizations.push('Delayed execution due to congestion');
    } else {
      executionStrategy = 'batched';
      optimizations.push('Batched execution for efficiency');
    }

    return {
      gasSettings,
      executionStrategy,
      optimizations
    };
  }

  /**
   * Quick transaction filtering for speed
   */
  private quickTransactionFilter(transaction: any, chain: string): { valid: boolean; reason?: string } {
    // Fast checks first (no external calls)
    
    // Chain-specific validation
    const chainSpecificChecks = this.validateChainSpecificRequirements(transaction, chain);
    if (!chainSpecificChecks.valid) {
      return chainSpecificChecks;
    }
    
    // Check transaction value
    if (transaction.value && parseFloat(ethers.formatEther(transaction.value)) < 0.01) {
      return { valid: false, reason: 'Transaction value too low' };
    }

    // Check gas price reasonableness
    if (transaction.gasPrice) {
      const gasPriceGwei = parseFloat(ethers.formatUnits(transaction.gasPrice, 'gwei'));
      if (gasPriceGwei > 1000) { // Unreasonably high
        return { valid: false, reason: 'Gas price too high' };
      }
    }

    // Check data length (DEX transactions should have substantial data)
    if (!transaction.data || transaction.data.length < 100) {
      return { valid: false, reason: 'Transaction data too short for DEX interaction' };
    }

    return { valid: true };
  }

  /**
   * Validate chain-specific requirements
   */
  private validateChainSpecificRequirements(transaction: any, chain: string): { valid: boolean; reason?: string } {
    switch (chain) {
      case 'ethereum':
        // Ethereum-specific checks
        if (transaction.gasPrice && parseFloat(ethers.formatUnits(transaction.gasPrice, 'gwei')) < 10) {
          return { valid: false, reason: 'Gas price too low for Ethereum' };
        }
        break;
        
      case 'bsc':
        // BSC-specific checks
        if (transaction.gasPrice && parseFloat(ethers.formatUnits(transaction.gasPrice, 'gwei')) < 3) {
          return { valid: false, reason: 'Gas price too low for BSC' };
        }
        break;
        
      case 'solana':
        // Solana-specific checks
        if (!transaction.recentBlockhash) {
          return { valid: false, reason: 'Missing recent blockhash for Solana' };
        }
        break;
        
      default:
        console.warn(`Unknown chain ${chain}, skipping chain-specific validation`);
        break;
    }
    
    return { valid: true };
  }

  /**
   * Generate cache key for transactions
   */
  private generateTransactionCacheKey(transaction: any, chain: string): string {
    // Create a key based on transaction characteristics (not hash)
    const to = transaction.to?.toLowerCase() || '';
    const data = transaction.data?.substring(0, 10) || ''; // First 4 bytes (method)
    const value = transaction.value || '0';
    
    return `${chain}:${to}:${data}:${value}`;
  }

  /**
   * Estimate processing latency for an opportunity
   */
  private estimateProcessingLatency(transaction: any, chain: string): number {
    let baseLatency = 100; // Base 100ms
    
    // Chain-specific adjustments
    switch (chain) {
      case 'ethereum':
        baseLatency += 50; // Higher latency due to complexity
        break;
      case 'bsc':
        baseLatency += 20; // Moderate latency
        break;
      case 'solana':
        baseLatency += 10; // Lower latency
        break;
    }

    // Adjust based on transaction complexity
    const dataLength = transaction.data?.length || 0;
    if (dataLength > 1000) baseLatency += 30; // Complex transaction
    
    // Adjust based on value
    const value = parseFloat(ethers.formatEther(transaction.value || '0'));
    if (value > 10) baseLatency += 20; // Large transactions need more care

    return baseLatency;
  }

  /**
   * Calculate opportunity priority score
   */
  private calculateOpportunityPriority(transaction: any, estimatedLatency: number): number {
    let priority = 50; // Base priority
    
    // Higher value = higher priority
    const value = parseFloat(ethers.formatEther(transaction.value || '0'));
    priority += Math.min(value * 10, 30);
    
    // Lower latency = higher priority
    priority += Math.max(0, 50 - estimatedLatency);
    
    // Gas price indicates urgency
    if (transaction.gasPrice) {
      const gasPriceGwei = parseFloat(ethers.formatUnits(transaction.gasPrice, 'gwei'));
      if (gasPriceGwei > 50) priority += 20; // High gas price = urgent
    }

    return Math.min(priority, 100);
  }

  /**
   * Check if simulation can be parallelized
   */
  private canParallelizeSimulation(opportunity: any): boolean {
    // Can parallelize if we have cached pool data and token info
    const poolCached = this.getFromCache(this.poolCache, 
      `${opportunity.chain}:${opportunity.tokenIn}:${opportunity.tokenOut}`);
    const tokenInCached = this.getFromCache(this.tokenCache, opportunity.tokenIn);
    const tokenOutCached = this.getFromCache(this.tokenCache, opportunity.tokenOut);
    
    return !!(poolCached && tokenInCached && tokenOutCached);
  }

  /**
   * Get optimized gas settings
   */
  private async getOptimizedGasSettings(opportunity: any): Promise<{
    gasLimit: number;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  }> {
    const chain = opportunity.chain;
    const cacheKey = `gas:${chain}:${Date.now() - (Date.now() % 30000)}`; // 30s bucket
    
    let gasData = this.getFromCache(this.gasCache, cacheKey);
    
    if (!gasData) {
      // Fetch fresh gas data
      gasData = await this.fetchGasData(chain);
      this.setCache(this.gasCache, cacheKey, gasData, this.config.gasEstimateCacheTime);
    }

    // Calculate optimized settings
    const baseGasLimit = this.precomputedGasEstimates.get(`${chain}:sandwich`) || 300000;
    const gasLimit = Math.floor(baseGasLimit * (1 + this.config.gasEstimationBuffer / 100));
    
    const baseFee = parseFloat(gasData.baseFee || '30');
    const priorityFee = parseFloat(gasData.priorityFee || '2');
    
    // Boost for speed
    const boostedPriorityFee = priorityFee * (1 + this.config.priorityFeeBoost / 100);
    const maxFeePerGas = ethers.parseUnits((baseFee + boostedPriorityFee).toString(), 'gwei').toString();
    const maxPriorityFeePerGas = ethers.parseUnits(boostedPriorityFee.toString(), 'gwei').toString();

    return {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas
    };
  }

  /**
   * Get network congestion level
   */
  private async getNetworkCongestion(chain: string): Promise<number> {
    const cacheKey = `congestion:${chain}:${Date.now() - (Date.now() % 60000)}`; // 1 minute bucket
    
    let congestion = this.getFromCache(this.gasCache, cacheKey);
    if (!congestion) {
      // Simplified congestion calculation
      congestion = Math.random() * 0.5 + 0.3; // 0.3-0.8 range
      this.setCache(this.gasCache, cacheKey, congestion, 60000);
    }
    
    return congestion.data || congestion;
  }

  /**
   * Pre-fetch token data asynchronously
   */
  private async prefetchTokenData(tokenAddress: string, chain: string): Promise<void> {
    const cacheKey = `${chain}:${tokenAddress}`;
    
    // Don't fetch if already in cache
    if (this.getFromCache(this.tokenCache, cacheKey)) {
      return;
    }

    // Use chain-specific data fetching strategies
    const fetchStrategy = this.getTokenFetchStrategy(chain);
    console.debug(`Pre-fetching token data for ${tokenAddress} on ${chain} using ${fetchStrategy} strategy`);

    // Simulate token data fetching (would be real API calls)
    setTimeout(() => {
      const tokenData = {
        address: tokenAddress,
        symbol: 'TOKEN',
        decimals: 18,
        price: 1.0,
        chain: chain, // Include chain info in cached data
        fetchedAt: Date.now()
      };
      
      this.setCache(this.tokenCache, cacheKey, tokenData, this.config.tokenDataCacheTime);
    }, 10);
  }

  /**
   * Get chain-specific token fetching strategy
   */
  private getTokenFetchStrategy(chain: string): string {
    switch (chain) {
      case 'ethereum':
        return 'eth-multicall';
      case 'bsc':
        return 'bsc-scan';
      case 'solana':
        return 'metaplex';
      default:
        return 'generic-rpc';
    }
  }

  /**
   * Fetch gas data for chain
   */
  private async fetchGasData(chain: string): Promise<any> {
    // Simulate chain-specific gas data fetching
    return new Promise(resolve => {
      setTimeout(() => {
        // Provide chain-specific gas data based on typical network characteristics
        let gasData;
        
        switch (chain) {
          case 'ethereum':
            gasData = {
              baseFee: (30 + Math.random() * 50).toFixed(1), // 30-80 gwei (higher for Ethereum)
              priorityFee: (2 + Math.random() * 8).toFixed(1), // 2-10 gwei
              chainId: 1,
              gasLimit: 300000
            };
            break;
            
          case 'bsc':
            gasData = {
              baseFee: (5 + Math.random() * 15).toFixed(1), // 5-20 gwei (lower for BSC)
              priorityFee: (1 + Math.random() * 3).toFixed(1), // 1-4 gwei
              chainId: 56,
              gasLimit: 200000
            };
            break;
            
          case 'solana':
            // Solana uses different fee structure (lamports per signature)
            gasData = {
              baseFee: '0.000005', // ~5k lamports (base fee)
              priorityFee: (0.00001 + Math.random() * 0.0001).toFixed(6), // Variable priority fee
              chainId: 101,
              computeUnits: 200000
            };
            break;
            
          case 'polygon':
            gasData = {
              baseFee: (20 + Math.random() * 30).toFixed(1), // 20-50 gwei
              priorityFee: (1 + Math.random() * 5).toFixed(1), // 1-6 gwei
              chainId: 137,
              gasLimit: 250000
            };
            break;
            
          case 'avalanche':
            gasData = {
              baseFee: (25 + Math.random() * 25).toFixed(1), // 25-50 gwei
              priorityFee: (1.5 + Math.random() * 4).toFixed(1), // 1.5-5.5 gwei
              chainId: 43114,
              gasLimit: 280000
            };
            break;
            
          default:
            // Default fallback for unknown chains
            console.warn(`Unknown chain ${chain}, using default gas data`);
            gasData = {
              baseFee: (20 + Math.random() * 40).toFixed(1), // 20-60 gwei
              priorityFee: (1 + Math.random() * 5).toFixed(1), // 1-6 gwei
              chainId: 1,
              gasLimit: 300000
            };
            break;
        }
        
        // Add timestamp for cache validation
        (gasData as any).timestamp = Date.now();
        (gasData as any).chain = chain;
        
        resolve(gasData);
      }, 20);
    });
  }

  /**
   * Perform warmup to populate caches and precompute data
   */
  private async performWarmup(): Promise<void> {
    console.log('Performing performance warmup...');
    
    // Precompute gas estimates for common operations
    this.precomputedGasEstimates.set('ethereum:sandwich', 280000);
    this.precomputedGasEstimates.set('bsc:sandwich', 220000);
    this.precomputedGasEstimates.set('solana:sandwich', 200000);
    
    // Precompute common trading routes for faster processing
    await this.precomputeCommonRoutes();
    
    // Pre-warm gas price caches
    const chains = ['ethereum', 'bsc', 'solana'];
    await Promise.all(chains.map(chain => this.fetchGasData(chain)));
    
    console.log('Warmup completed');
  }

  /**
   * Precompute common trading routes for performance optimization
   */
  private async precomputeCommonRoutes(): Promise<void> {
    const commonRoutes = [
      { chain: 'ethereum', from: '0xA0b86a33E6C8', to: '0xC02aaA39b223', path: ['USDC', 'ETH'] },
      { chain: 'ethereum', from: '0xdAC17F958D2e', to: '0xC02aaA39b223', path: ['USDT', 'ETH'] },
      { chain: 'bsc', from: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', to: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', path: ['USDC', 'BNB'] }
    ];
    
    for (const route of commonRoutes) {
      const routeKey = `${route.chain}:${route.from}`;
      this.precomputedRoutes.set(routeKey, route.path);
      console.debug(`Precomputed route for ${routeKey}: ${route.path.join(' -> ')}`);
    }
    
    console.log(`Precomputed ${commonRoutes.length} common trading routes`);
  }

  /**
   * Record opportunity metrics
   */
  recordMetrics(metrics: OpportunityMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only recent metrics (last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter(m => m.detectionTime > oneHourAgo);
    
    // Emit performance update
    this.emit('metricsUpdated', metrics);
    
    // Generate performance report every 100 opportunities
    if (this.metrics.length % 100 === 0) {
      this.generatePerformanceReport();
    }
  }

  /**
   * Generate comprehensive performance report
   */
  private generatePerformanceReport(): void {
    if (this.metrics.length === 0) return;
    
    const recentMetrics = this.metrics.slice(-100); // Last 100 opportunities
    
    const stats: PerformanceStats = {
      averageDetectionTime: this.calculateAverage(recentMetrics.map(m => m.detectionTime)),
      averageSimulationTime: this.calculateAverage(recentMetrics.map(m => m.simulationTime)),
      averageExecutionTime: this.calculateAverage(recentMetrics.map(m => m.executionTime)),
      averageTotalLatency: this.calculateAverage(recentMetrics.map(m => m.totalLatency)),
      successRate: recentMetrics.filter(m => m.success).length / recentMetrics.length,
      throughput: recentMetrics.length > 0 ? recentMetrics.length / ((Date.now() - recentMetrics[0]!.detectionTime) / 1000) : 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      cacheHitRate: this.calculateCacheHitRate(),
      gasEfficiency: this.calculateGasEfficiency(recentMetrics),
      profitPerMs: this.calculateProfitPerMs(recentMetrics)
    };
    
    this.performanceReports.push(stats);
    this.emit('performanceReport', stats);
    
    // Check if performance is degrading
    this.checkPerformanceAlerts(stats);
  }

  /**
   * Calculate average from array of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const totalCacheOperations = 100; // Simplified
    const cacheHits = 70; // Simplified
    return cacheHits / totalCacheOperations;
  }

  /**
   * Calculate gas efficiency
   */
  private calculateGasEfficiency(metrics: OpportunityMetrics[]): number {
    const successfulMetrics = metrics.filter(m => m.success);
    if (successfulMetrics.length === 0) return 0;
    
    const totalProfit = successfulMetrics.reduce((sum, m) => sum + parseFloat(m.profit), 0);
    const totalGas = successfulMetrics.reduce((sum, m) => sum + parseFloat(m.gasUsed), 0);
    
    return totalGas > 0 ? totalProfit / totalGas : 0;
  }

  /**
   * Calculate profit per millisecond
   */
  private calculateProfitPerMs(metrics: OpportunityMetrics[]): number {
    const successfulMetrics = metrics.filter(m => m.success);
    if (successfulMetrics.length === 0) return 0;
    
    const totalProfit = successfulMetrics.reduce((sum, m) => sum + parseFloat(m.profit), 0);
    const totalTime = successfulMetrics.reduce((sum, m) => sum + m.totalLatency, 0);
    
    return totalTime > 0 ? totalProfit / totalTime : 0;
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(stats: PerformanceStats): void {
    const alerts: string[] = [];
    
    if (stats.averageTotalLatency > this.config.targetLatencyMs) {
      alerts.push(`High latency: ${stats.averageTotalLatency}ms > ${this.config.targetLatencyMs}ms`);
    }
    
    if (stats.successRate < this.config.minSuccessRate) {
      alerts.push(`Low success rate: ${(stats.successRate * 100).toFixed(1)}% < ${this.config.minSuccessRate * 100}%`);
    }
    
    if (stats.memoryUsage > this.config.maxMemoryUsageMb) {
      alerts.push(`High memory usage: ${stats.memoryUsage.toFixed(1)}MB > ${this.config.maxMemoryUsageMb}MB`);
    }
    
    if (alerts.length > 0) {
      this.emit('performanceAlert', { alerts, stats });
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsageMb = memUsage.heapUsed / 1024 / 1024;
      
      if (memUsageMb > this.config.maxMemoryUsageMb) {
        this.emit('memoryAlert', { usage: memUsageMb, limit: this.config.maxMemoryUsageMb });
        
        // Trigger garbage collection if possible
        if (global.gc) {
          global.gc();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Setup cache cleanup
   */
  private setupCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, 60000); // Cleanup every minute
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const caches = [this.poolCache, this.tokenCache, this.gasCache, this.routeCache];
    
    for (const cache of caches) {
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          cache.delete(key);
        }
      }
    }
  }

  /**
   * Generic cache get method
   */
  private getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Generic cache set method
   */
  private setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T, ttl: number): void {
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): PerformanceStats | null {
    return this.performanceReports.length > 0 
      ? this.performanceReports[this.performanceReports.length - 1] || null
      : null;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    poolCache: number;
    tokenCache: number;
    gasCache: number;
    routeCache: number;
    totalMemoryKb: number;
  } {
    return {
      poolCache: this.poolCache.size,
      tokenCache: this.tokenCache.size,
      gasCache: this.gasCache.size,
      routeCache: this.routeCache.size,
      totalMemoryKb: Math.round(process.memoryUsage().heapUsed / 1024)
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.poolCache.clear();
    this.tokenCache.clear();
    this.gasCache.clear();
    this.routeCache.clear();
    
    this.emit('cachesCleared');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get performance optimizer statistics and status
   */
  getStats(): {
    isActive: boolean;
    warmupComplete: boolean;
    metricsCount: number;
    performanceReports: number;
    cacheStats: any;
    config: PerformanceConfig;
  } {
    return {
      isActive: this.warmupComplete,
      warmupComplete: this.warmupComplete,
      metricsCount: this.metrics.length,
      performanceReports: this.performanceReports.length,
      cacheStats: this.getCacheStats(),
      config: this.config
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.clearCaches();
    this.emit('cleanup');
  }
}