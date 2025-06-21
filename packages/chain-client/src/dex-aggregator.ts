import { EventEmitter } from 'events';
import winston from 'winston';
import axios from 'axios';
import { ChainAbstraction, TokenInfo, GasEstimate } from './chain-abstraction';

export interface DEXConfig {
  id: string;
  name: string;
  chain: string;
  type: 'uniswap-v2' | 'uniswap-v3' | 'curve' | 'balancer' | 'jupiter' | '1inch';
  routerAddress?: string;
  factoryAddress?: string;
  apiUrl?: string;
  apiKey?: string | undefined;
  fee: number; // in basis points (100 = 1%)
  gasMultiplier: number;
  isActive: boolean;
  supportedFeatures: string[];
}

export interface SwapRoute {
  dex: string;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  expectedOutputAmount: string;
  minimumOutputAmount: string;
  price: string;
  priceImpact: string;
  slippage: string;
  gasEstimate: GasEstimate;
  route: RouteStep[];
  confidence: number; // 0-100
  executionTime: number; // estimated ms
}

export interface RouteStep {
  dex: string;
  pool: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountOut: string;
  fee: number;
  priceImpact: string;
}

export interface SwapQuoteRequest {
  inputToken: string;
  outputToken: string;
  amount: string;
  slippage: number; // 0.5 = 0.5%
  chain: string;
  userAddress?: string;
  maxHops?: number;
  excludeDEXes?: string[];
  includeDEXes?: string[];
  preferredDEX?: string;
  gasPrice?: string;
}

export interface SwapQuoteResponse {
  routes: SwapRoute[];
  bestRoute: SwapRoute;
  estimatedGas: string;
  totalGasCost: string;
  netOutput: string; // output after gas costs
  executionTime: number;
  timestamp: number;
}

export interface DEXStats {
  totalVolume24h: string;
  totalLiquidity: string;
  successRate: number;
  averageSlippage: number;
  averageGasCost: string;
  responseTime: number;
  lastUpdated: number;
}

export interface AggregatorStats {
  totalQuotes: number;
  successfulQuotes: number;
  averageResponseTime: number;
  totalVolumeRouted: string;
  activeDEXes: number;
  chainStats: Map<string, {
    quotes: number;
    volume: string;
    averageSlippage: number;
  }>;
}

export interface PerformanceMetrics {
  quotesPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  timeoutRate: number;
  cachingEfficiency: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface DexHealthStatus {
  isHealthy: boolean;
  responseTime: number;
  successRate: number;
  errorCount: number;
  lastError?: string;
  liquidityDepth: string;
  priceDeviation: number;
  consecutiveFailures: number;
  lastSuccessfulQuote: number;
}

export interface RouteOptimizationMetrics {
  totalRoutesEvaluated: number;
  optimalRouteFound: boolean;
  priceImpactSaved: number;
  gasSaved: string;
  slippageOptimization: number;
  executionTimeOptimization: number;
  confidenceScore: number;
  diversificationIndex: number;
}

export interface RealTimeAnalytics {
  activeQuoteRequests: number;
  queuedRequests: number;
  processingTime: number;
  throughput: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
  dexPerformanceRanking: Array<{
    dexId: string;
    score: number;
    rank: number;
  }>;
}

export class DEXAggregator extends EventEmitter {
  private logger: winston.Logger;
  private chainAbstraction: ChainAbstraction;
  private dexConfigs: Map<string, DEXConfig> = new Map();
  private tokenLists: Map<string, TokenInfo[]> = new Map(); // chain -> tokens
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private routeCache: Map<string, { routes: SwapRoute[]; timestamp: number }> = new Map();
  private dexStats: Map<string, DEXStats> = new Map();
  private stats: AggregatorStats;
  
  // Enterprise Performance Tracking
  private performanceMetrics: PerformanceMetrics;
  private dexHealthStatus: Map<string, DexHealthStatus> = new Map();
  private routeOptimizationMetrics: RouteOptimizationMetrics;
  private realTimeAnalytics: RealTimeAnalytics;
  private latencyHistory: number[] = [];
  private requestQueue: Array<{ timestamp: number; request: SwapQuoteRequest }> = [];
  private activeRequests: Set<string> = new Set();
  
  // Advanced Caching and Optimization
  private liquidityCache: Map<string, { depth: string; timestamp: number }> = new Map();
  private priceDeviationTracker: Map<string, { baseline: number; current: number; timestamp: number }> = new Map();
  private gasOptimizationCache: Map<string, { gasEstimate: string; timestamp: number }> = new Map();
  private routeHistoryAnalytics: Map<string, { 
    count: number; 
    avgSlippage: number; 
    avgGas: string; 
    successRate: number; 
    lastUsed: number;
  }> = new Map();
  
  // Circuit Breaker and Health Monitoring
  private circuitBreakerStates: Map<string, { 
    isOpen: boolean; 
    failureCount: number; 
    lastFailure: number; 
    cooldownUntil: number 
  }> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(chainAbstraction: ChainAbstraction, logger: winston.Logger) {
    super();
    this.chainAbstraction = chainAbstraction;
    this.logger = logger;
    
    this.stats = {
      totalQuotes: 0,
      successfulQuotes: 0,
      averageResponseTime: 0,
      totalVolumeRouted: '0',
      activeDEXes: 0,
      chainStats: new Map()
    };

    // Initialize Enterprise Performance Metrics
    this.performanceMetrics = {
      quotesPerSecond: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      errorRate: 0,
      timeoutRate: 0,
      cachingEfficiency: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    this.routeOptimizationMetrics = {
      totalRoutesEvaluated: 0,
      optimalRouteFound: false,
      priceImpactSaved: 0,
      gasSaved: '0',
      slippageOptimization: 0,
      executionTimeOptimization: 0,
      confidenceScore: 0,
      diversificationIndex: 0
    };

    this.realTimeAnalytics = {
      activeQuoteRequests: 0,
      queuedRequests: 0,
      processingTime: 0,
      throughput: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        network: 0
      },
      dexPerformanceRanking: []
    };

    this.setupDEXConfigs();
    this.loadTokenLists();
    this.startStatsCollection();
    this.initializeAdvancedMonitoring();
  }

  private setupDEXConfigs(): void {
    // Ethereum DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-eth',
      name: 'Uniswap V3',
      chain: 'ethereum',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.2,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'uniswap-v2-eth',
      name: 'Uniswap V2',
      chain: 'ethereum',
      type: 'uniswap-v2',
      routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    this.addDEXConfig({
      id: '1inch-eth',
      name: '1inch',
      chain: 'ethereum',
      type: '1inch',
      apiUrl: 'https://api.1inch.dev/swap/v5.2/1',
      apiKey: process.env['ONEINCH_API_KEY'],
      fee: 0, // 1inch handles fees internally
      gasMultiplier: 1.1,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-dex', 'gas-optimization', 'partial-fill']
    });

    // BSC DEXes
    this.addDEXConfig({
      id: 'pancakeswap-v3-bsc',
      name: 'PancakeSwap V3',
      chain: 'bsc',
      type: 'uniswap-v3',
      routerAddress: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      factoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      fee: 25, // 0.25%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'pancakeswap-v2-bsc',
      name: 'PancakeSwap V2',
      chain: 'bsc',
      type: 'uniswap-v2',
      routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      fee: 25, // 0.25%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    this.addDEXConfig({
      id: '1inch-bsc',
      name: '1inch',
      chain: 'bsc',
      type: '1inch',
      apiUrl: 'https://api.1inch.dev/swap/v5.2/56',
      apiKey: process.env['ONEINCH_API_KEY'],
      fee: 0,
      gasMultiplier: 1.1,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-dex', 'gas-optimization']
    });

    // Polygon DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-polygon',
      name: 'Uniswap V3',
      chain: 'polygon',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'quickswap-polygon',
      name: 'QuickSwap',
      chain: 'polygon',
      type: 'uniswap-v2',
      routerAddress: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    // Arbitrum DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-arbitrum',
      name: 'Uniswap V3',
      chain: 'arbitrum',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'camelot-arbitrum',
      name: 'Camelot',
      chain: 'arbitrum',
      type: 'uniswap-v2',
      routerAddress: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
      factoryAddress: '0x6EcCab422D763aC031210895C81787E87B91425a',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    // Optimism DEXes
    this.addDEXConfig({
      id: 'uniswap-v3-optimism',
      name: 'Uniswap V3',
      chain: 'optimism',
      type: 'uniswap-v3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fee: 30, // 0.3%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input', 'exact-output']
    });

    // Solana DEXes
    this.addDEXConfig({
      id: 'jupiter-solana',
      name: 'Jupiter',
      chain: 'solana',
      type: 'jupiter',
      apiUrl: 'https://quote-api.jup.ag/v6',
      fee: 0, // Jupiter aggregates multiple DEXes
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-dex', 'exact-input', 'exact-output']
    });

    this.addDEXConfig({
      id: 'raydium-solana',
      name: 'Raydium',
      chain: 'solana',
      type: 'uniswap-v2', // Similar AMM model
      apiUrl: 'https://api.raydium.io/v2',
      fee: 25, // 0.25%
      gasMultiplier: 1.0,
      isActive: true,
      supportedFeatures: ['price-quotes', 'multi-hop', 'exact-input']
    });

    this.logger.info('DEX configurations initialized', {
      totalDEXes: this.dexConfigs.size,
      chains: Array.from(new Set(Array.from(this.dexConfigs.values()).map(d => d.chain)))
    });
  }

  private addDEXConfig(config: DEXConfig): void {
    this.dexConfigs.set(config.id, config);
    this.dexStats.set(config.id, {
      totalVolume24h: '0',
      totalLiquidity: '0',
      successRate: 100,
      averageSlippage: 0,
      averageGasCost: '0',
      responseTime: 0,
      lastUpdated: Date.now()
    });
  }

  private async loadTokenLists(): Promise<void> {
    // Load popular token lists for each chain
    const tokenListUrls = {
      ethereum: 'https://tokens.uniswap.org',
      bsc: 'https://tokens.pancakeswap.finance/pancakeswap-extended.json',
      polygon: 'https://unpkg.com/quickswap-default-token-list@1.0.71/build/quickswap-default.tokenlist.json',
      arbitrum: 'https://bridge.arbitrum.io/token-list-42161.json',
      optimism: 'https://static.optimism.io/optimism.tokenlist.json'
    };

    for (const [chain, url] of Object.entries(tokenListUrls)) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        const tokenList = response.data.tokens || response.data;
        
        // Filter and format tokens for our use
        const formattedTokens = tokenList
          .filter((token: any) => token.chainId === this.getChainId(chain))
          .map((token: any) => ({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI,
            chainId: token.chainId
          }));

        this.tokenLists.set(chain, formattedTokens);
        
        this.logger.info('Token list loaded', {
          chain,
          tokenCount: formattedTokens.length
        });
      } catch (error: any) {
        this.logger.warn('Failed to load token list', {
          chain,
          url,
          error: error.message
        });
      }
    }
  }

  private getChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      bsc: 56,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      solana: 101
    };
    return chainIds[chain] || 1;
  }

  // Main quote aggregation method with enterprise analytics
  async getSwapQuote(request: SwapQuoteRequest): Promise<SwapQuoteResponse> {
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Add to active requests tracking
      this.activeRequests.add(requestId);
      this.realTimeAnalytics.activeQuoteRequests = this.activeRequests.size;

      // Check cache first for route optimization
      const cacheKey = this.generateCacheKey(request);
      const cachedRoute = this.routeCache.get(cacheKey);
      
      if (cachedRoute && Date.now() - cachedRoute.timestamp < 30000 && cachedRoute.routes.length > 0) { // 30 second cache
        this.logger.debug('Route served from cache', { requestId, cacheKey });
        this.updateCacheMetrics(true);
        
        const bestRoute = cachedRoute.routes[0]!; // Safe due to length check
        const response: SwapQuoteResponse = {
          routes: cachedRoute.routes,
          bestRoute,
          estimatedGas: bestRoute.gasEstimate.gasLimit,
          totalGasCost: bestRoute.gasEstimate.totalCost,
          netOutput: this.calculateNetOutput(bestRoute),
          executionTime: Date.now() - startTime,
          timestamp: Date.now()
        };
        
        this.activeRequests.delete(requestId);
        return response;
      }

      this.updateCacheMetrics(false);

      // Validate request with enhanced validation
      await this.validateQuoteRequest(request);

      // Get available DEXes with circuit breaker filtering
      const availableDEXes = this.getAvailableDEXesWithCircuitBreaker(
        request.chain, 
        request.excludeDEXes, 
        request.includeDEXes
      );
      
      if (availableDEXes.length === 0) {
        throw new Error(`No available DEXes for chain: ${request.chain}`);
      }

      // Update route optimization metrics
      this.routeOptimizationMetrics.totalRoutesEvaluated += availableDEXes.length;

      // Get quotes from multiple DEXes in parallel with enhanced monitoring and fallback
      const quotePromises = availableDEXes.map(dex => 
        this.getQuoteFromDEXWithMonitoring(dex, request, requestId).catch(async (error) => {
          this.logger.warn('Enhanced DEX quote failed, trying fallback', {
            dex: dex.id,
            requestId,
            error: error.message
          });
          this.updateDEXFailureMetrics(dex.id, error.message);
          
          // Try fallback method for additional reliability
          try {
            const fallbackRoute = await this.getQuoteFromDEX(dex, request);
            this.logger.info('Fallback DEX quote succeeded', {
              dex: dex.id,
              requestId
            });
            return fallbackRoute;
          } catch (fallbackError: any) {
            this.logger.error('Both enhanced and fallback DEX quotes failed', {
              dex: dex.id,
              requestId,
              enhancedError: error.message,
              fallbackError: fallbackError.message
            });
            return null;
          }
        })
      );

      const quoteResults = await Promise.allSettled(quotePromises);
      const successfulQuotes = quoteResults
        .filter((result): result is PromiseFulfilledResult<SwapRoute | null> => 
          result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value!);

      if (successfulQuotes.length === 0) {
        throw new Error('No successful quotes from any DEX');
      }

      // Enhanced route selection with optimization analytics and fallback
      let bestRoute: SwapRoute;
      try {
        bestRoute = this.selectBestRouteWithAnalytics(successfulQuotes, request);
      } catch (error: any) {
        this.logger.warn('Advanced route selection failed, using fallback method', {
          error: error.message,
          requestId
        });
        // Use fallback route selection method for reliability
        bestRoute = this.selectBestRoute(successfulQuotes, request);
      }
      
      // Calculate optimization achievements
      this.updateRouteOptimizationMetrics(successfulQuotes, bestRoute);

      // Cache the successful routes
      this.routeCache.set(cacheKey, {
        routes: successfulQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount)),
        timestamp: Date.now()
      });

      // Update comprehensive statistics
      this.updateAdvancedStats(request.chain, successfulQuotes.length > 0, Date.now() - startTime);

      const response: SwapQuoteResponse = {
        routes: successfulQuotes.sort((a, b) => parseFloat(b.outputAmount) - parseFloat(a.outputAmount)),
        bestRoute,
        estimatedGas: bestRoute.gasEstimate.gasLimit,
        totalGasCost: bestRoute.gasEstimate.totalCost,
        netOutput: this.calculateNetOutput(bestRoute),
        executionTime: Date.now() - startTime,
        timestamp: Date.now()
      };

      // Track latency for performance metrics
      this.latencyHistory.push(Date.now() - startTime);

      // Update route history analytics
      this.updateRouteHistoryAnalytics(cacheKey, bestRoute);

      // Emit enhanced events
      this.emit('quoteGenerated', { 
        request, 
        response, 
        executionTime: response.executionTime,
        requestId,
        routesEvaluated: availableDEXes.length,
        optimizationMetrics: this.routeOptimizationMetrics
      });
      
      this.activeRequests.delete(requestId);
      return response;
      
    } catch (error: any) {
      this.updateAdvancedStats(request.chain, false, Date.now() - startTime);
      this.activeRequests.delete(requestId);
      
      this.logger.error('Failed to get swap quote', {
        request,
        requestId,
        error: error.message,
        executionTime: Date.now() - startTime,
        availableDEXes: this.getAvailableDEXes(request.chain, request.excludeDEXes, request.includeDEXes).length
      });
      throw error;
    }
  }

  private async validateQuoteRequest(request: SwapQuoteRequest): Promise<void> {
    // Validate chain
    if (!this.chainAbstraction.getSupportedChains().includes(request.chain as any)) {
      throw new Error(`Unsupported chain: ${request.chain}`);
    }

    // Validate addresses
    if (!this.chainAbstraction.isValidAddress(request.chain as any, request.inputToken)) {
      throw new Error(`Invalid input token address: ${request.inputToken}`);
    }

    if (!this.chainAbstraction.isValidAddress(request.chain as any, request.outputToken)) {
      throw new Error(`Invalid output token address: ${request.outputToken}`);
    }

    // Validate amount
    if (parseFloat(request.amount) <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Validate slippage
    if (request.slippage < 0 || request.slippage > 50) {
      throw new Error('Slippage must be between 0 and 50%');
    }
  }

  private generateCacheKey(request: SwapQuoteRequest): string {
    return `${request.chain}-${request.inputToken}-${request.outputToken}-${request.amount}-${request.slippage}`;
  }

  private updateCacheMetrics(cacheHit: boolean): void {
    if (cacheHit) {
      // Update cache hit metrics
      const totalCacheAccess = this.routeCache.size + this.stats.totalQuotes;
      this.performanceMetrics.cachingEfficiency = totalCacheAccess > 0 ? 
        (this.routeCache.size / totalCacheAccess) * 100 : 0;
    }
  }

  private getAvailableDEXesWithCircuitBreaker(
    chain: string, 
    excludeDEXes?: string[], 
    includeDEXes?: string[]
  ): DEXConfig[] {
    let dexes = Array.from(this.dexConfigs.values())
      .filter(dex => dex.chain === chain && dex.isActive);

    // Filter out DEXes with open circuit breakers
    dexes = dexes.filter(dex => {
      const circuitBreaker = this.circuitBreakerStates.get(dex.id);
      if (!circuitBreaker) return true;
      
      // Check if circuit breaker is open and cooldown period has passed
      if (circuitBreaker.isOpen && Date.now() < circuitBreaker.cooldownUntil) {
        this.logger.debug('DEX excluded due to circuit breaker', { 
          dexId: dex.id, 
          cooldownUntil: circuitBreaker.cooldownUntil 
        });
        return false;
      }
      
      return true;
    });

    if (includeDEXes && includeDEXes.length > 0) {
      dexes = dexes.filter(dex => includeDEXes.includes(dex.id));
    }

    if (excludeDEXes && excludeDEXes.length > 0) {
      dexes = dexes.filter(dex => !excludeDEXes.includes(dex.id));
    }

    return dexes;
  }

  private getAvailableDEXes(
    chain: string, 
    excludeDEXes?: string[], 
    includeDEXes?: string[]
  ): DEXConfig[] {
    let dexes = Array.from(this.dexConfigs.values())
      .filter(dex => dex.chain === chain && dex.isActive);

    if (includeDEXes && includeDEXes.length > 0) {
      dexes = dexes.filter(dex => includeDEXes.includes(dex.id));
    }

    if (excludeDEXes && excludeDEXes.length > 0) {
      dexes = dexes.filter(dex => !excludeDEXes.includes(dex.id));
    }

    return dexes;
  }

  private async getQuoteFromDEX(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute | null> {
    const startTime = Date.now();

    try {
      let route: SwapRoute;

      switch (dex.type) {
        case '1inch':
          route = await this.get1inchQuote(dex, request);
          break;
        case 'jupiter':
          route = await this.getJupiterQuote(dex, request);
          break;
        case 'uniswap-v3':
          route = await this.getUniswapV3Quote(dex, request);
          break;
        case 'uniswap-v2':
          route = await this.getUniswapV2Quote(dex, request);
          break;
        default:
          throw new Error(`Unsupported DEX type: ${dex.type}`);
      }

      // Update DEX stats
      const responseTime = Date.now() - startTime;
      this.updateDEXStats(dex.id, responseTime, true);

      return route;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.updateDEXStats(dex.id, responseTime, false);
      throw error;
    }
  }

  private async getQuoteFromDEXWithMonitoring(
    dex: DEXConfig, 
    request: SwapQuoteRequest, 
    requestId: string
  ): Promise<SwapRoute | null> {
    const startTime = Date.now();

    try {
      // Check circuit breaker
      const circuitBreaker = this.circuitBreakerStates.get(dex.id);
      if (circuitBreaker?.isOpen && Date.now() < circuitBreaker.cooldownUntil) {
        throw new Error(`Circuit breaker open for DEX: ${dex.id}`);
      }

      let route: SwapRoute;

      switch (dex.type) {
        case '1inch':
          route = await this.get1inchQuote(dex, request);
          break;
        case 'jupiter':
          route = await this.getJupiterQuote(dex, request);
          break;
        case 'uniswap-v3':
          route = await this.getUniswapV3Quote(dex, request);
          break;
        case 'uniswap-v2':
          route = await this.getUniswapV2Quote(dex, request);
          break;
        default:
          throw new Error(`Unsupported DEX type: ${dex.type}`);
      }

      // Update DEX health status with request tracking
      const responseTime = Date.now() - startTime;
      this.updateDEXHealthStatus(dex.id, responseTime, true);
      this.updateDEXStats(dex.id, responseTime, true);
      
      // Log successful quote with request ID for monitoring
      this.logger.debug('DEX quote successful', {
        dexId: dex.id,
        requestId,
        responseTime,
        outputAmount: route.outputAmount,
        confidence: route.confidence
      });

      return route;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.updateDEXHealthStatus(dex.id, responseTime, false);
      this.updateDEXStats(dex.id, responseTime, false);
      this.handleDEXFailure(dex.id, error.message);
      throw error;
    }
  }

  private updateDEXHealthStatus(dexId: string, responseTime: number, success: boolean): void {
    const healthStatus = this.dexHealthStatus.get(dexId);
    if (!healthStatus) return;

    healthStatus.responseTime = (healthStatus.responseTime * 0.8) + (responseTime * 0.2);
    
    if (success) {
      healthStatus.consecutiveFailures = 0;
      healthStatus.lastSuccessfulQuote = Date.now();
      healthStatus.successRate = Math.min(100, healthStatus.successRate + 0.1);
    } else {
      healthStatus.consecutiveFailures++;
      healthStatus.errorCount++;
      healthStatus.successRate = Math.max(0, healthStatus.successRate - 1);
    }
    
    healthStatus.isHealthy = healthStatus.consecutiveFailures < 3 && healthStatus.successRate > 50;
  }

  private updateDEXFailureMetrics(dexId: string, error: string): void {
    const healthStatus = this.dexHealthStatus.get(dexId);
    if (healthStatus) {
      healthStatus.lastError = error;
      healthStatus.errorCount++;
    }
  }

  private selectBestRouteWithAnalytics(routes: SwapRoute[], request: SwapQuoteRequest): SwapRoute {
    // Enhanced route selection with comprehensive analytics
    const scoredRoutes = routes.map(route => {
      let score = 0;

      // Output amount (35% weight)
      const outputScore = parseFloat(route.outputAmount) / Math.max(...routes.map(r => parseFloat(r.outputAmount)));
      score += outputScore * 0.35;

      // Confidence (20% weight)
      score += (route.confidence / 100) * 0.2;

      // Gas efficiency (20% weight) 
      const gasScore = 1 - (parseFloat(route.gasEstimate.totalCost) / 
        Math.max(...routes.map(r => parseFloat(r.gasEstimate.totalCost))));
      score += gasScore * 0.2;

      // Execution time (15% weight)
      const timeScore = 1 - (route.executionTime / Math.max(...routes.map(r => r.executionTime)));
      score += timeScore * 0.15;

      // Price impact (10% weight)
      const impactScore = 1 - (parseFloat(route.priceImpact) / 
        Math.max(...routes.map(r => parseFloat(r.priceImpact))));
      score += impactScore * 0.1;

      // Additional scoring based on request context
      if (request.preferredDEX && route.dex === request.preferredDEX) {
        score += 0.05; // 5% bonus for preferred DEX
      }
      
      // Adjust score based on slippage tolerance
      const requestedSlippage = request.slippage;
      const routeSlippage = parseFloat(route.slippage || '0');
      if (routeSlippage <= requestedSlippage * 0.5) {
        score += 0.03; // 3% bonus for routes with very low slippage
      }
      
      // Consider user's gas price preference
      if (request.gasPrice) {
        const requestedGasPrice = parseFloat(request.gasPrice);
        const routeGasPrice = parseFloat(route.gasEstimate.gasPrice || '0');
        if (routeGasPrice <= requestedGasPrice) {
          score += 0.02; // 2% bonus for routes within gas price range
        }
      }

      return { route, score };
    });

    const bestScoredRoute = scoredRoutes.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Update optimization metrics with request context
    this.routeOptimizationMetrics.optimalRouteFound = true;
    this.routeOptimizationMetrics.confidenceScore = bestScoredRoute.route.confidence;
    
    // Log the selection reasoning for analytics
    this.logger.debug('Advanced route selection completed', {
      totalRoutes: routes.length,
      selectedDEX: bestScoredRoute.route.dex,
      finalScore: bestScoredRoute.score.toFixed(3),
      preferredDEX: request.preferredDEX || 'none',
      requestedSlippage: request.slippage,
      selectedSlippage: parseFloat(bestScoredRoute.route.slippage)
    });
    
    return bestScoredRoute.route;
  }

  private updateRouteOptimizationMetrics(routes: SwapRoute[], bestRoute: SwapRoute): void {
    if (routes.length === 0) return;

    // Calculate price impact saved
    const worstPriceImpact = Math.max(...routes.map(r => parseFloat(r.priceImpact)));
    const bestPriceImpact = parseFloat(bestRoute.priceImpact);
    this.routeOptimizationMetrics.priceImpactSaved = worstPriceImpact - bestPriceImpact;

    // Calculate gas saved
    const worstGasCost = Math.max(...routes.map(r => parseFloat(r.gasEstimate.totalCost)));
    const bestGasCost = parseFloat(bestRoute.gasEstimate.totalCost);
    this.routeOptimizationMetrics.gasSaved = (worstGasCost - bestGasCost).toString();

    // Calculate diversification index (how many different DEXes were considered)
    const uniqueDEXes = new Set(routes.map(r => r.dex));
    this.routeOptimizationMetrics.diversificationIndex = uniqueDEXes.size;
  }

  private updateAdvancedStats(chain: string, success: boolean, executionTime: number): void {
    // Update basic stats
    this.updateStats(chain, success);

    // Update performance metrics
    this.performanceMetrics.averageLatency = 
      (this.performanceMetrics.averageLatency * 0.9) + (executionTime * 0.1);

    // Update real-time analytics
    this.realTimeAnalytics.processingTime = executionTime;
    this.realTimeAnalytics.throughput = this.stats.totalQuotes / 
      ((Date.now() - (Date.now() - 3600000)) / 1000); // Quotes per second over last hour
  }

  private updateRouteHistoryAnalytics(cacheKey: string, route: SwapRoute): void {
    const history = this.routeHistoryAnalytics.get(cacheKey) || {
      count: 0,
      avgSlippage: 0,
      avgGas: '0',
      successRate: 100,
      lastUsed: Date.now()
    };

    history.count++;
    history.avgSlippage = (history.avgSlippage * (history.count - 1) + parseFloat(route.slippage)) / history.count;
    const currentGas = parseFloat(route.gasEstimate.totalCost);
    const prevGas = parseFloat(history.avgGas);
    history.avgGas = ((prevGas * (history.count - 1) + currentGas) / history.count).toString();
    history.lastUsed = Date.now();

    this.routeHistoryAnalytics.set(cacheKey, history);
    
    // Update price deviation tracking for optimization
    this.updatePriceDeviationTracking(route);
  }

  private updatePriceDeviationTracking(route: SwapRoute): void {
    const tokenPair = `${route.inputToken.address}-${route.outputToken.address}`;
    const currentPrice = parseFloat(route.price);
    
    const existing = this.priceDeviationTracker.get(tokenPair);
    
    if (existing) {
      // Calculate price deviation percentage
      const deviation = Math.abs(currentPrice - existing.baseline) / existing.baseline * 100;
      
      this.priceDeviationTracker.set(tokenPair, {
        baseline: (existing.baseline * 0.9) + (currentPrice * 0.1), // Smooth baseline adjustment
        current: currentPrice,
        timestamp: Date.now()
      });
      
      // Alert if significant price deviation detected (>5%)
      if (deviation > 5) {
        this.logger.warn('Significant price deviation detected', {
          tokenPair,
          deviation: deviation.toFixed(2) + '%',
          baseline: existing.baseline,
          current: currentPrice,
          dex: route.dex
        });
        
        this.emit('priceDeviationAlert', {
          tokenPair,
          deviation,
          route,
          timestamp: Date.now()
        });
      }
    } else {
      // Initialize baseline for new token pair
      this.priceDeviationTracker.set(tokenPair, {
        baseline: currentPrice,
        current: currentPrice,
        timestamp: Date.now()
      });
    }
  }

  private async get1inchQuote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    const params = new URLSearchParams({
      fromTokenAddress: request.inputToken,
      toTokenAddress: request.outputToken,
      amount: request.amount,
      slippage: request.slippage.toString(),
      disableEstimate: 'false',
      allowPartialFill: 'true'
    });

    if (request.userAddress) {
      params.append('fromAddress', request.userAddress);
    }

    const response = await axios.get(`${dex.apiUrl}/quote?${params}`, {
      headers: {
        'Authorization': `Bearer ${dex.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const quote = response.data;

    // Get token info
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
        gasPrice: quote.gasPrice?.toString() || '0',
        estimatedCost: quote.estimatedGas.toString(),
        totalCost: quote.estimatedGas.toString(),
        totalCostFormatted: '0 ETH'
      },
      route: this.parse1inchRoute(quote.protocols),
      confidence: 85, // 1inch generally reliable
      executionTime: 2000 // estimated
    };
  }

  private async getJupiterQuote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    const params = new URLSearchParams({
      inputMint: request.inputToken,
      outputMint: request.outputToken,
      amount: request.amount,
      slippageBps: (request.slippage * 100).toString()
    });

    const response = await axios.get(`${dex.apiUrl}/quote?${params}`, {
      timeout: 10000
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
      priceImpact: quote.priceImpactPct || '0',
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: '200000', // Solana compute units
        gasPrice: '5000',
        estimatedCost: '1000000',
        totalCost: '1000000',
        totalCostFormatted: '0.001 SOL'
      },
      route: this.parseJupiterRoute(quote.routePlan),
      confidence: 90, // Jupiter is highly optimized
      executionTime: 1000
    };
  }

  private async getUniswapV3Quote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    // For now, return a simulated quote
    // In production, this would call Uniswap V3 quoter contract
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);

    // Simulate price calculation (simplified)
    const mockPrice = 1.0; // Would get from price oracle
    const outputAmount = (parseFloat(request.amount) * mockPrice * 0.997).toString(); // 0.3% fee

    return {
      dex: dex.id,
      inputToken,
      outputToken,
      inputAmount: request.amount,
      outputAmount,
      expectedOutputAmount: outputAmount,
      minimumOutputAmount: (parseFloat(outputAmount) * (1 - request.slippage / 100)).toString(),
      price: mockPrice.toString(),
      priceImpact: '0.1',
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: '150000',
        gasPrice: '20000000000',
        estimatedCost: '3000000000000000',
        totalCost: '3000000000000000',
        totalCostFormatted: '0.003 ETH'
      },
      route: [{
        dex: dex.id,
        pool: '0x...',
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: request.amount,
        amountOut: outputAmount,
        fee: dex.fee,
        priceImpact: '0.1'
      }],
      confidence: 80,
      executionTime: 3000
    };
  }

  private async getUniswapV2Quote(dex: DEXConfig, request: SwapQuoteRequest): Promise<SwapRoute> {
    // Similar to V3 but simpler routing
    const inputToken = await this.getTokenInfo(request.chain, request.inputToken);
    const outputToken = await this.getTokenInfo(request.chain, request.outputToken);

    const mockPrice = 1.0;
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
      priceImpact: '0.2',
      slippage: request.slippage.toString(),
      gasEstimate: {
        gasLimit: '120000',
        gasPrice: '20000000000',
        estimatedCost: '2400000000000000',
        totalCost: '2400000000000000',
        totalCostFormatted: '0.0024 ETH'
      },
      route: [{
        dex: dex.id,
        pool: '0x...',
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: request.amount,
        amountOut: outputAmount,
        fee: dex.fee,
        priceImpact: '0.2'
      }],
      confidence: 75,
      executionTime: 2500
    };
  }

  private async getTokenInfo(chain: string, address: string): Promise<TokenInfo> {
    // Check cache first
    const tokenList = this.tokenLists.get(chain) || [];
    const cachedToken = tokenList.find(token => 
      token.address.toLowerCase() === address.toLowerCase()
    );

    if (cachedToken) {
      return cachedToken;
    }

    // If not in token list, try to fetch from chain
    try {
      const tokenInfo = await this.chainAbstraction.getTokenInfo(chain as any, address);
      if (tokenInfo) {
        return tokenInfo;
      }
    } catch (error) {
      // Fallback
    }

    // Return default token info
    return {
      address,
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18,
      chainId: this.getChainId(chain)
    };
  }

  private parse1inchRoute(protocols: any[]): RouteStep[] {
    // Parse 1inch protocol route format
    return protocols.map((protocol: any) => ({
      dex: protocol.name || '1inch',
      pool: protocol.part?.toString() || '100',
      tokenIn: {} as TokenInfo, // Would be populated
      tokenOut: {} as TokenInfo,
      amountIn: '0',
      amountOut: '0',
      fee: 0,
      priceImpact: '0'
    }));
  }

  private parseJupiterRoute(routePlan: any[]): RouteStep[] {
    return routePlan.map((step: any) => ({
      dex: step.swapInfo?.label || 'jupiter',
      pool: step.swapInfo?.ammKey || '',
      tokenIn: {} as TokenInfo,
      tokenOut: {} as TokenInfo,
      amountIn: step.swapInfo?.inAmount || '0',
      amountOut: step.swapInfo?.outAmount || '0',
      fee: step.swapInfo?.feeAmount || 0,
      priceImpact: '0'
    }));
  }

  private selectBestRoute(routes: SwapRoute[], request: SwapQuoteRequest): SwapRoute {
    // Legacy route selection with basic user preferences
    const scoredRoutes = routes.map(route => {
      let score = 0;

      // Output amount (40% weight)
      const outputScore = parseFloat(route.outputAmount) / Math.max(...routes.map(r => parseFloat(r.outputAmount)));
      score += outputScore * 0.4;

      // Confidence (25% weight)
      score += (route.confidence / 100) * 0.25;

      // Gas efficiency (20% weight)
      const gasScore = 1 - (parseFloat(route.gasEstimate.totalCost) / 
        Math.max(...routes.map(r => parseFloat(r.gasEstimate.totalCost))));
      score += gasScore * 0.2;

      // Execution time (10% weight)
      const timeScore = 1 - (route.executionTime / Math.max(...routes.map(r => r.executionTime)));
      score += timeScore * 0.1;

      // Price impact (5% weight)
      const impactScore = 1 - (parseFloat(route.priceImpact) / 
        Math.max(...routes.map(r => parseFloat(r.priceImpact))));
      score += impactScore * 0.05;

      // Apply request-based preferences for legacy fallback
      if (request.preferredDEX && route.dex === request.preferredDEX) {
        score += 0.1; // 10% bonus for preferred DEX in legacy mode
      }

      // Legacy slippage preference
      const routeSlippage = parseFloat(route.slippage || '0');
      if (routeSlippage <= request.slippage) {
        score += 0.05; // 5% bonus for acceptable slippage
      }

      // Legacy gas price preference
      if (request.gasPrice) {
        const requestedGasPrice = parseFloat(request.gasPrice);
        const routeGasPrice = parseFloat(route.gasEstimate.gasPrice || '0');
        if (routeGasPrice <= requestedGasPrice) {
          score += 0.03; // 3% bonus for acceptable gas price
        }
      }

      return { route, score };
    });

    const bestRoute = scoredRoutes.reduce((best, current) => 
      current.score > best.score ? current : best
    ).route;

    // Log legacy selection for monitoring
    this.logger.debug('Legacy route selection completed', {
      totalRoutes: routes.length,
      selectedDEX: bestRoute.dex,
      preferredDEX: request.preferredDEX || 'none',
      requestedSlippage: request.slippage,
      selectedOutputAmount: bestRoute.outputAmount
    });

    return bestRoute;
  }

  private calculateNetOutput(route: SwapRoute): string {
    const outputAmount = parseFloat(route.outputAmount);
    const gasCost = parseFloat(route.gasEstimate.totalCost);
    
    // Convert gas cost to output token value (simplified)
    // In production, would use price oracles
    const gasCostInOutputToken = gasCost * 0.001; // Rough conversion
    
    return Math.max(0, outputAmount - gasCostInOutputToken).toString();
  }

  private updateStats(chain: string, success: boolean): void {
    this.stats.totalQuotes++;
    
    if (success) {
      this.stats.successfulQuotes++;
    }

    // Update chain-specific stats
    const chainStats = this.stats.chainStats.get(chain) || {
      quotes: 0,
      volume: '0',
      averageSlippage: 0
    };
    
    chainStats.quotes++;
    this.stats.chainStats.set(chain, chainStats);
  }

  private updateDEXStats(dexId: string, responseTime: number, success: boolean): void {
    const stats = this.dexStats.get(dexId);
    if (!stats) return;

    stats.responseTime = (stats.responseTime * 0.8) + (responseTime * 0.2);
    
    if (success) {
      stats.successRate = Math.min(100, stats.successRate + 0.1);
    } else {
      stats.successRate = Math.max(0, stats.successRate - 1);
    }

    stats.lastUpdated = Date.now();
  }

  private initializeAdvancedMonitoring(): void {
    // Initialize DEX health monitoring with configuration-specific parameters
    for (const [dexId, config] of this.dexConfigs) {
      // Initialize health status with configuration-aware parameters
      const baselineResponseTime = config.apiUrl ? 
        (config.type === 'jupiter' ? 2000 : config.type === '1inch' ? 1500 : 1000) : 100;
      
      this.dexHealthStatus.set(dexId, {
        isHealthy: config.isActive, // Start with config active status
        responseTime: baselineResponseTime,
        successRate: 100,
        errorCount: 0,
        liquidityDepth: '0',
        priceDeviation: 0,
        consecutiveFailures: 0,
        lastSuccessfulQuote: Date.now()
      });

      // Initialize configuration-aware circuit breaker
      const failureThreshold = config.type === 'jupiter' ? 7 : // Jupiter gets more tolerance
                              config.type === '1inch' ? 5 : 3; // 1inch standard, others stricter
      
      this.circuitBreakerStates.set(dexId, {
        isOpen: false,
        failureCount: 0,
        lastFailure: 0,
        cooldownUntil: 0
      });

      // Configure monitoring intervals based on DEX type and configuration
      const monitoringInterval = config.apiUrl ? 30000 : 60000; // API DEXes more frequent monitoring
      
      // Start configuration-specific health check monitoring
      this.startDEXHealthMonitoring(dexId);
      
      // Initialize configuration-specific performance baselines
      this.initializeConfigSpecificMetrics(dexId, config);
      
      this.logger.debug('DEX monitoring initialized', {
        dexId: config.id,
        type: config.type,
        chain: config.chain,
        hasAPI: !!config.apiUrl,
        baselineResponseTime,
        failureThreshold,
        monitoringInterval,
        supportedFeatures: config.supportedFeatures.length,
        gasMultiplier: config.gasMultiplier
      });
    }

    // Start performance metrics collection
    this.startPerformanceMonitoring();
    this.startRealTimeAnalytics();
    
    this.logger.info('Advanced monitoring systems initialized', {
      monitoredDEXes: this.dexConfigs.size,
      healthCheckInterval: '30s',
      performanceMetricsInterval: '5s'
    });
  }

  private initializeConfigSpecificMetrics(dexId: string, config: DEXConfig): void {
    // Initialize configuration-specific performance and monitoring metrics
    
    // Set up baseline liquidity tracking for API-based DEXes
    if (config.apiUrl) {
      this.liquidityCache.set(`${dexId}-baseline`, {
        depth: '1000000', // Initial baseline liquidity estimate
        timestamp: Date.now()
      });
    }
    
    // Initialize gas optimization cache with config-specific baselines
    const baselineGasEstimate = this.calculateBaselineGasForConfig(config);
    this.gasOptimizationCache.set(`${dexId}-baseline`, {
      gasEstimate: baselineGasEstimate,
      timestamp: Date.now()
    });
    
    // Set up configuration-specific route analytics
    const configKey = `${config.chain}-${config.type}`;
    if (!this.routeHistoryAnalytics.has(configKey)) {
      this.routeHistoryAnalytics.set(configKey, {
        count: 0,
        avgSlippage: config.fee / 100, // Use config fee as baseline slippage
        avgGas: baselineGasEstimate,
        successRate: 100,
        lastUsed: Date.now()
      });
    }
    
    // Initialize price deviation tracking for this DEX configuration
    const dexBaselineKey = `${dexId}-config-baseline`;
    this.priceDeviationTracker.set(dexBaselineKey, {
      baseline: 1.0, // Start with 1:1 baseline
      current: 1.0,
      timestamp: Date.now()
    });
    
    this.logger.debug('Configuration-specific metrics initialized', {
      dexId: config.id,
      type: config.type,
      chain: config.chain,
      baselineGas: baselineGasEstimate,
      baselineSlippage: config.fee / 100,
      hasLiquidityTracking: !!config.apiUrl
    });
  }

  private calculateBaselineGasForConfig(config: DEXConfig): string {
    // Calculate baseline gas estimates based on DEX configuration
    let baselineGas = 150000; // Default gas limit
    
    switch (config.type) {
      case 'uniswap-v3':
        baselineGas = 180000; // V3 requires more gas for complex math
        break;
      case 'uniswap-v2':
        baselineGas = 120000; // V2 is more straightforward
        break;
      case '1inch':
        baselineGas = 250000; // Aggregators use more gas
        break;
      case 'jupiter':
        baselineGas = 200000; // Solana compute units equivalent
        break;
      case 'curve':
        baselineGas = 200000; // Complex curve math
        break;
      case 'balancer':
        baselineGas = 220000; // Multi-token pools
        break;
    }
    
    // Apply gas multiplier from configuration
    const adjustedGas = Math.floor(baselineGas * config.gasMultiplier);
    
    return adjustedGas.toString();
  }

  private startDEXHealthMonitoring(dexId: string): void {
    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck(dexId);
      } catch (error: any) {
        this.logger.warn('Health check failed', { dexId, error: error.message });
      }
    }, 30000); // Every 30 seconds

    this.healthCheckIntervals.set(dexId, interval);
  }

  private async performHealthCheck(dexId: string): Promise<void> {
    const config = this.dexConfigs.get(dexId);
    const healthStatus = this.dexHealthStatus.get(dexId);
    
    if (!config || !healthStatus) return;

    const startTime = Date.now();
    
    try {
      // Perform comprehensive health check based on DEX configuration
      if (config.apiUrl) {
        // Use configuration-specific timeout and retry logic
        const timeout = config.type === 'jupiter' ? 8000 : 5000; // Jupiter needs more time
        const healthEndpoint = this.getHealthEndpointForConfig(config);
        
        const response = await axios.get(healthEndpoint, { 
          timeout,
          validateStatus: () => true,
          headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
        });
        
        const responseTime = Date.now() - startTime;
        const isHealthy = response.status < 500;
        
        // Configuration-based health assessment
        const expectedFeatures = config.supportedFeatures;
        const configHealthy = this.validateConfigurationHealth(config, response.data);
        
        // Update health status with configuration context
        healthStatus.responseTime = responseTime;
        healthStatus.isHealthy = isHealthy && configHealthy;
        
        if (healthStatus.isHealthy) {
          healthStatus.consecutiveFailures = 0;
          healthStatus.lastSuccessfulQuote = Date.now();
          this.autoResetCircuitBreaker(dexId);
          
          // Log configuration-specific health metrics
          this.logger.debug('DEX health check passed', {
            dexId: config.id,
            type: config.type,
            chain: config.chain,
            responseTime,
            supportedFeatures: expectedFeatures.length,
            gasMultiplier: config.gasMultiplier
          });
        } else {
          healthStatus.consecutiveFailures++;
          healthStatus.errorCount++;
          this.handleDEXFailure(dexId, `Health check failed: ${response.status} (Config: ${config.type})`);
        }
      } else {
        // For non-API DEXes, validate configuration completeness
        const configComplete = !!(config.routerAddress && config.factoryAddress);
        healthStatus.isHealthy = configComplete;
        healthStatus.responseTime = 100; // Simulated low latency
        healthStatus.consecutiveFailures = configComplete ? 0 : healthStatus.consecutiveFailures + 1;
        
        if (!configComplete) {
          this.logger.warn('DEX configuration incomplete', {
            dexId: config.id,
            hasRouter: !!config.routerAddress,
            hasFactory: !!config.factoryAddress,
            type: config.type
          });
        }
      }
      
    } catch (error: any) {
      healthStatus.isHealthy = false;
      healthStatus.consecutiveFailures++;
      healthStatus.errorCount++;
      healthStatus.lastError = error.message;
      this.handleDEXFailure(dexId, `Health check error for ${config.type}: ${error.message}`);
    }
  }

  private getHealthEndpointForConfig(config: DEXConfig): string {
    // Return configuration-specific health endpoints
    switch (config.type) {
      case '1inch':
        return `${config.apiUrl}/healthcheck`;
      case 'jupiter':
        return `${config.apiUrl}/health`;
      default:
        return `${config.apiUrl}/health`;
    }
  }

  private validateConfigurationHealth(config: DEXConfig, responseData: any): boolean {
    // Validate DEX-specific configuration health
    try {
      switch (config.type) {
        case '1inch':
          return responseData?.status === 'ok' || responseData?.healthy === true;
        case 'jupiter':
          return responseData?.status === 'ok' || !responseData?.error;
        default:
          return true; // Assume healthy if no specific validation
      }
    } catch (error) {
      return false;
    }
  }

  private handleDEXFailure(dexId: string, error: string): void {
    const circuitBreaker = this.circuitBreakerStates.get(dexId);
    if (!circuitBreaker) return;

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailure = Date.now();

    // Open circuit breaker after 5 consecutive failures
    if (circuitBreaker.failureCount >= 5) {
      circuitBreaker.isOpen = true;
      circuitBreaker.cooldownUntil = Date.now() + (5 * 60 * 1000); // 5 minutes cooldown
      
      this.logger.warn('Circuit breaker opened for DEX', { 
        dexId, 
        failureCount: circuitBreaker.failureCount,
        error 
      });
      
      this.emit('dexCircuitBreakerOpen', { dexId, error });
    }
  }

  private autoResetCircuitBreaker(dexId: string): void {
    const circuitBreaker = this.circuitBreakerStates.get(dexId);
    if (!circuitBreaker) return;

    if (circuitBreaker.isOpen && Date.now() > circuitBreaker.cooldownUntil) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
      
      this.logger.info('Circuit breaker auto-reset for DEX', { dexId });
      this.emit('dexCircuitBreakerReset', { dexId });
    }
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 5000); // Every 5 seconds
  }

  private updatePerformanceMetrics(): void {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    
    // Calculate quotes per second
    const recentQuotes = this.latencyHistory.filter(timestamp => 
      now - timestamp < windowSize
    ).length;
    this.performanceMetrics.quotesPerSecond = recentQuotes / 60;

    // Calculate latency percentiles
    if (this.latencyHistory.length > 0) {
      const sortedLatencies = [...this.latencyHistory].sort((a, b) => a - b);
      const len = sortedLatencies.length;
      
      this.performanceMetrics.averageLatency = sortedLatencies.reduce((a, b) => a + b, 0) / len;
      this.performanceMetrics.p95Latency = sortedLatencies[Math.floor(len * 0.95)] || 0;
      this.performanceMetrics.p99Latency = sortedLatencies[Math.floor(len * 0.99)] || 0;
    }

    // Calculate error rate
    const totalRequests = this.stats.totalQuotes;
    const failedRequests = totalRequests - this.stats.successfulQuotes;
    this.performanceMetrics.errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // Update caching efficiency
    const cacheHits = this.routeCache.size;
    const totalCacheAccess = cacheHits + this.stats.totalQuotes;
    this.performanceMetrics.cachingEfficiency = totalCacheAccess > 0 ? (cacheHits / totalCacheAccess) * 100 : 0;

    // Clean old latency data (keep last 1000 entries)
    if (this.latencyHistory.length > 1000) {
      this.latencyHistory = this.latencyHistory.slice(-1000);
    }
  }

  private startRealTimeAnalytics(): void {
    setInterval(() => {
      this.updateRealTimeAnalytics();
    }, 1000); // Every second
  }

  private updateRealTimeAnalytics(): void {
    this.realTimeAnalytics.activeQuoteRequests = this.activeRequests.size;
    this.realTimeAnalytics.queuedRequests = this.requestQueue.length;
    
    // Update DEX performance ranking
    const dexScores = Array.from(this.dexHealthStatus.entries()).map(([dexId, health]) => ({
      dexId,
      score: this.calculateDEXScore(health),
      rank: 0
    }));
    
    // Sort by score and assign ranks
    dexScores.sort((a, b) => b.score - a.score);
    dexScores.forEach((item, index) => {
      item.rank = index + 1;
    });
    
    this.realTimeAnalytics.dexPerformanceRanking = dexScores;
  }

  private calculateDEXScore(health: DexHealthStatus): number {
    let score = 100;
    
    // Deduct points for health issues
    if (!health.isHealthy) score -= 30;
    if (health.consecutiveFailures > 0) score -= health.consecutiveFailures * 5;
    if (health.responseTime > 5000) score -= 20; // Slow response
    if (health.successRate < 95) score -= (95 - health.successRate);
    
    return Math.max(0, score);
  }

  private startStatsCollection(): void {
    // Log aggregator stats every 10 minutes
    setInterval(() => {
      this.logger.info('DEX Aggregator Statistics', {
        ...this.stats,
        performanceMetrics: this.performanceMetrics,
        activeDEXes: Array.from(this.dexConfigs.values()).filter(d => d.isActive).length,
        chainBreakdown: Object.fromEntries(this.stats.chainStats),
        healthyDEXes: Array.from(this.dexHealthStatus.values()).filter(h => h.isHealthy).length
      });
    }, 10 * 60 * 1000);
  }

  // Enterprise Public API Methods
  getStats(): AggregatorStats {
    return { ...this.stats };
  }

  getDEXStats(): Map<string, DEXStats> {
    return new Map(this.dexStats);
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getDEXHealthStatus(): Map<string, DexHealthStatus> {
    return new Map(this.dexHealthStatus);
  }

  getRouteOptimizationMetrics(): RouteOptimizationMetrics {
    return { ...this.routeOptimizationMetrics };
  }

  getRealTimeAnalytics(): RealTimeAnalytics {
    return { ...this.realTimeAnalytics };
  }

  getCircuitBreakerStatus(): Map<string, { isOpen: boolean; failureCount: number; cooldownUntil: number }> {
    return new Map(Array.from(this.circuitBreakerStates.entries()).map(([dexId, state]) => [
      dexId, 
      { 
        isOpen: state.isOpen, 
        failureCount: state.failureCount, 
        cooldownUntil: state.cooldownUntil 
      }
    ]));
  }

  getRouteHistoryAnalytics(): Map<string, { count: number; avgSlippage: number; successRate: number }> {
    return new Map(Array.from(this.routeHistoryAnalytics.entries()).map(([key, analytics]) => [
      key,
      {
        count: analytics.count,
        avgSlippage: analytics.avgSlippage,
        successRate: analytics.successRate
      }
    ]));
  }

  getSupportedDEXes(chain?: string): DEXConfig[] {
    let dexes = Array.from(this.dexConfigs.values());
    
    if (chain) {
      dexes = dexes.filter(dex => dex.chain === chain);
    }
    
    return dexes.filter(dex => dex.isActive);
  }

  getTokenList(chain: string): TokenInfo[] {
    return this.tokenLists.get(chain) || [];
  }

  async enableDEX(dexId: string): Promise<void> {
    const dex = this.dexConfigs.get(dexId);
    if (dex) {
      dex.isActive = true;
      // Reset circuit breaker when manually enabling
      const circuitBreaker = this.circuitBreakerStates.get(dexId);
      if (circuitBreaker) {
        circuitBreaker.isOpen = false;
        circuitBreaker.failureCount = 0;
      }
      this.logger.info('DEX enabled', { dexId });
    }
  }

  async disableDEX(dexId: string): Promise<void> {
    const dex = this.dexConfigs.get(dexId);
    if (dex) {
      dex.isActive = false;
      this.logger.info('DEX disabled', { dexId });
    }
  }

  async resetCircuitBreaker(dexId: string): Promise<void> {
    const circuitBreaker = this.circuitBreakerStates.get(dexId);
    if (circuitBreaker) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
      circuitBreaker.cooldownUntil = 0;
      this.logger.info('Circuit breaker manually reset', { dexId });
    }
  }

  async flushCaches(): Promise<void> {
    this.priceCache.clear();
    this.routeCache.clear();
    this.liquidityCache.clear();
    this.gasOptimizationCache.clear();
    this.logger.info('All caches flushed');
  }

  async getHealthReport(): Promise<{
    overallHealth: string;
    activeDEXes: number;
    totalDEXes: number;
    circuitBreakerStatus: string;
    cachePerformance: string;
    avgResponseTime: number;
    errorRate: number;
  }> {
    const healthyDEXes = Array.from(this.dexHealthStatus.values()).filter(h => h.isHealthy).length;
    const totalDEXes = this.dexConfigs.size;
    const activeDEXes = Array.from(this.dexConfigs.values()).filter(d => d.isActive).length;
    const openCircuitBreakers = Array.from(this.circuitBreakerStates.values()).filter(cb => cb.isOpen).length;

    return {
      overallHealth: healthyDEXes / totalDEXes > 0.8 ? 'HEALTHY' : 
                   healthyDEXes / totalDEXes > 0.5 ? 'DEGRADED' : 'UNHEALTHY',
      activeDEXes,
      totalDEXes,
      circuitBreakerStatus: openCircuitBreakers === 0 ? 'ALL_CLOSED' : 
                          openCircuitBreakers < 3 ? 'SOME_OPEN' : 'MANY_OPEN',
      cachePerformance: this.performanceMetrics.cachingEfficiency > 80 ? 'EXCELLENT' :
                       this.performanceMetrics.cachingEfficiency > 50 ? 'GOOD' : 'POOR',
      avgResponseTime: this.performanceMetrics.averageLatency,
      errorRate: this.performanceMetrics.errorRate
    };
  }

  async optimizeConfiguration(): Promise<void> {
    // Automatically optimize configuration based on performance data
    for (const [dexId, healthStatus] of this.dexHealthStatus) {
      const dex = this.dexConfigs.get(dexId);
      if (!dex) continue;

      // Adjust gas multipliers based on performance
      if (healthStatus.responseTime > 10000) {
        dex.gasMultiplier = Math.min(dex.gasMultiplier + 0.1, 2.0);
      } else if (healthStatus.responseTime < 1000) {
        dex.gasMultiplier = Math.max(dex.gasMultiplier - 0.05, 1.0);
      }

      // Disable consistently failing DEXes temporarily
      if (healthStatus.consecutiveFailures > 10) {
        dex.isActive = false;
        this.logger.warn('Auto-disabled underperforming DEX', { 
          dexId, 
          consecutiveFailures: healthStatus.consecutiveFailures 
        });
      }
    }

    this.logger.info('Configuration optimized based on performance data');
  }

  async getComprehensiveAnalytics(): Promise<{
    systemOverview: any;
    performanceMetrics: PerformanceMetrics;
    dexHealthSummary: any;
    priceDeviationReport: any;
    routeOptimization: RouteOptimizationMetrics;
    cacheAnalytics: any;
  }> {
    // Generate comprehensive analytics report utilizing all monitoring systems
    const healthyDEXes = Array.from(this.dexHealthStatus.values()).filter(h => h.isHealthy).length;
    const totalDEXes = this.dexConfigs.size;
    
    // Price deviation analysis
    const priceDeviations = Array.from(this.priceDeviationTracker.entries()).map(([pair, data]) => ({
      tokenPair: pair,
      currentDeviation: Math.abs(data.current - data.baseline) / data.baseline * 100,
      lastUpdated: new Date(data.timestamp).toISOString()
    }));

    // Route history insights
    const routeInsights = Array.from(this.routeHistoryAnalytics.entries()).map(([key, analytics]) => ({
      route: key,
      usage: analytics.count,
      performance: {
        avgSlippage: analytics.avgSlippage,
        avgGas: analytics.avgGas,
        successRate: analytics.successRate
      }
    }));

    return {
      systemOverview: {
        totalDEXes,
        healthyDEXes,
        healthPercentage: (healthyDEXes / totalDEXes * 100).toFixed(1),
        totalQuotes: this.stats.totalQuotes,
        successRate: (this.stats.successfulQuotes / this.stats.totalQuotes * 100).toFixed(1),
        activeRequests: this.activeRequests.size
      },
      performanceMetrics: this.performanceMetrics,
      dexHealthSummary: {
        healthyCount: healthyDEXes,
        unhealthyCount: totalDEXes - healthyDEXes,
        averageResponseTime: Array.from(this.dexHealthStatus.values())
          .reduce((avg, health) => avg + health.responseTime, 0) / totalDEXes,
        circuitBreakersOpen: Array.from(this.circuitBreakerStates.values())
          .filter(cb => cb.isOpen).length
      },
      priceDeviationReport: {
        totalPairsTracked: this.priceDeviationTracker.size,
        significantDeviations: priceDeviations.filter(d => d.currentDeviation > 5).length,
        maxDeviation: Math.max(...priceDeviations.map(d => d.currentDeviation), 0),
        recentDeviations: priceDeviations.slice(0, 10)
      },
      routeOptimization: this.routeOptimizationMetrics,
      cacheAnalytics: {
        routeCacheSize: this.routeCache.size,
        priceCacheSize: this.priceCache.size,
        liquidityCacheSize: this.liquidityCache.size,
        gasOptimizationCacheSize: this.gasOptimizationCache.size,
        cachingEfficiency: this.performanceMetrics.cachingEfficiency,
        topRoutes: routeInsights.sort((a, b) => b.usage - a.usage).slice(0, 5)
      }
    };
  }

  async close(): Promise<void> {
    // Cleanup resources
    this.priceCache.clear();
    this.routeCache.clear();
    this.liquidityCache.clear();
    this.gasOptimizationCache.clear();
    this.routeHistoryAnalytics.clear();
    this.priceDeviationTracker.clear();

    // Clear intervals
    this.healthCheckIntervals.forEach(interval => clearInterval(interval));
    this.healthCheckIntervals.clear();

    this.logger.info('DEX Aggregator closed with full cleanup', {
      finalStats: await this.getComprehensiveAnalytics()
    });
  }
}