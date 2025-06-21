import { EventEmitter } from 'events';
import WebSocket from 'ws';
import winston from 'winston';
import { ethers } from 'ethers';

export interface ZeroLatencyConfig {
  // Pyth Network - Ultra low latency (sub-second)
  pyth: {
    endpoint: string; // 'wss://hermes.pyth.network/ws'
    priceIds: Record<string, string>; // token -> pyth price feed ID
    confidence: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  
  // Binance WebSocket - High frequency updates
  binance: {
    endpoint: string; // 'wss://stream.binance.com:9443/ws'
    symbols: string[]; // ['ETHUSDT', 'BTCUSDT']
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  
  // DexScreener WebSocket - DEX-specific prices
  dexscreener: {
    endpoint: string; // 'wss://io.dexscreener.com/dex/screener'
    pairs: string[];
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  
  // Chainlink Price Feeds - On-chain accuracy
  chainlink: {
    feeds: Record<string, string>; // token -> chainlink feed address
    updateThreshold: number; // minimum price change to emit
    rpcEndpoints: string[];
  };

  // Performance optimization
  performance: {
    maxLatencyMs: number; // Target: <100ms
    priceValidityMs: number; // How long prices remain valid
    maxHistoryLength: number; // Maximum price history to store
    aggregationIntervalMs: number; // Price aggregation interval
  };

  // Rate limiting per source
  rateLimiting: {
    pyth: RateLimitConfig;
    binance: RateLimitConfig;
    dexscreener: RateLimitConfig;
    chainlink: RateLimitConfig;
  };

  // Alert configuration
  alerts: AlertConfig;
}

export interface TokenPrice {
  address: string;
  symbol: string;
  priceUsd: number;
  confidence: number;
  timestamp: number;
  source: string;
  deviation?: number;
  volume24h?: number;
  marketCap?: number;
  change24h?: number;
}

export interface PriceAggregate {
  address: string;
  symbol: string;
  weightedPrice: number;
  confidence: number;
  sources: TokenPrice[];
  deviation: number;
  lastUpdated: number;
  qualityScore: number;
}

export interface PriceTrend {
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  volatility: number;
  momentum: number;
  strength: number;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  timeWindowMs: number;
}

export interface AlertConfig {
  priceDeviationThreshold: number; // Alert if price deviates more than this %
  connectionFailureThreshold: number; // Alert after this many connection failures
  latencyThreshold: number; // Alert if latency exceeds this (ms)
  qualityScoreThreshold: number; // Alert if quality drops below this
  enableSlackAlerts?: boolean;
  enableEmailAlerts?: boolean;
  webhookUrl?: string;
}

export interface ChainlinkPrice {
  address: string;
  symbol: string;
  priceUsd: number;
  decimals: number;
  updatedAt: number;
  roundId: number;
}

export interface AlertEvent {
  type: 'price_deviation' | 'connection_failure' | 'high_latency' | 'low_quality' | 'chainlink_stale';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  timestamp: number;
}

/**
 * Enterprise-grade zero-latency price oracle with sub-100ms updates
 * 
 * This oracle provides institutional-quality price feeds with sophisticated aggregation,
 * confidence scoring, rate limiting, Chainlink integration, and comprehensive alerting.
 * 
 * Features:
 * - Multi-source price aggregation (Pyth Network, Binance, DexScreener, Chainlink)
 * - Sub-100ms latency targeting with real-time WebSocket streams
 * - Advanced confidence scoring and quality metrics
 * - Sophisticated rate limiting per data source
 * - Professional reconnection logic with exponential backoff
 * - Comprehensive alerting system with multiple notification channels
 * - Chainlink on-chain price feed integration for ultimate accuracy
 * - Price trend analysis with momentum and volatility calculations
 * - Enterprise-grade monitoring and performance tracking
 * 
 * @example
 * ```typescript
 * const oracle = new ZeroLatencyOracle(config, logger);
 * await oracle.initialize();
 * 
 * oracle.subscribeToToken('0x...', 'USDC');
 * const price = oracle.getPrice('0x...');
 * const comprehensive = oracle.getComprehensivePrice('0x...');
 * ```
 */
export class ZeroLatencyOracle extends EventEmitter {
  private logger: winston.Logger;
  private config: ZeroLatencyConfig;
  
  // WebSocket connections
  private pythWs?: WebSocket;
  private binanceWs?: WebSocket;
  private dexScreenerWs?: WebSocket;
  
  // Price data storage
  private latestPrices = new Map<string, TokenPrice>();
  private aggregatedPrices = new Map<string, PriceAggregate>();
  private priceHistories = new Map<string, TokenPrice[]>();
  private chainlinkPrices = new Map<string, ChainlinkPrice>();
  private subscriptions = new Set<string>();
  
  // Connection management
  private reconnectAttempts = new Map<string, number>();
  private connectionHealth = new Map<string, {
    isConnected: boolean;
    lastPing: number;
    responseTime: number;
    errorCount: number;
    successCount: number;
  }>();

  // Rate limiting system
  private rateLimiters = new Map<string, {
    requests: number[];
    burstCount: number;
  }>();

  // Chainlink providers
  private chainlinkProviders: ethers.Provider[] = [];

  // Alerting system
  private alertHistory = new Map<string, number>(); // Alert type -> last alert time
  private activeAlerts = new Set<string>();

  // Performance statistics
  private stats = {
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    averageLatency: 0,
    lastUpdateTime: 0,
    activeConnections: 0,
    qualityScore: 100,
    chainlinkUpdates: 0,
    alertsTriggered: 0,
  };

  /**
   * Initialize the Zero-Latency Oracle with comprehensive configuration
   * 
   * @param config - Complete oracle configuration including data sources, rate limits, and alerts
   * @param logger - Winston logger instance for structured logging
   */
  constructor(config: ZeroLatencyConfig, logger: winston.Logger) {
    super();
    this.config = config;
    this.logger = logger;
    
    // Initialize rate limiters for all sources
    this.initializeRateLimiters();
    
    // Initialize Chainlink providers
    this.initializeChainlinkProviders();
    
    // Start monitoring systems
    this.initializeHealthMonitoring();
    this.initializeAlertingSystem();
    
    this.logger.info('Zero-latency oracle constructed', {
      sources: ['pyth', 'binance', 'dexscreener', 'chainlink'],
      rateLimiting: 'enabled',
      alerting: 'enabled'
    });
  }

  /**
   * Initialize all WebSocket connections with advanced error handling
   */
  async initialize(): Promise<void> {
    try {
      await Promise.allSettled([
        this.initializePythStream(),
        this.initializeBinanceStream(),
        this.initializeDexScreenerStream()
      ]);
      
      this.startPerformanceMonitoring();
      this.startPriceAggregation();
      
      this.logger.info('Zero-latency oracle initialized successfully', {
        activeConnections: this.stats.activeConnections,
        config: {
          maxLatency: this.config.performance.maxLatencyMs,
          priceValidity: this.config.performance.priceValidityMs
        }
      });
      
      this.emit('initialized', this.getStatus());
    } catch (error) {
      this.logger.error('Oracle initialization failed', { error });
      throw error;
    }
  }

  /**
   * Get latest aggregated price with institutional-grade confidence
   */
  getPrice(tokenAddress: string): PriceAggregate | null {
    const key = tokenAddress.toLowerCase();
    const aggregate = this.aggregatedPrices.get(key);
    
    if (!aggregate) {
      return null;
    }
    
    // Check if price is still valid
    const age = Date.now() - aggregate.lastUpdated;
    if (age > this.config.performance.priceValidityMs) {
      this.logger.warn('Price data expired', { 
        tokenAddress, 
        age, 
        maxAge: this.config.performance.priceValidityMs 
      });
      return null;
    }
    
    return aggregate;
  }

  /**
   * Get comprehensive price data including trends and analysis
   */
  getComprehensivePrice(tokenAddress: string): {
    price: PriceAggregate | null;
    trend: PriceTrend;
    history: TokenPrice[];
    quality: number;
  } {
    const price = this.getPrice(tokenAddress);
    const trend = this.getPriceTrend(tokenAddress);
    const history = this.getPriceHistory(tokenAddress);
    const quality = this.calculatePriceQuality(tokenAddress);
    
    return { price, trend, history, quality };
  }

  /**
   * Subscribe to real-time price updates with enhanced validation
   */
  subscribeToToken(tokenAddress: string, symbol: string): void {
    const key = tokenAddress.toLowerCase();
    this.subscriptions.add(key);
    
    // Subscribe to all available streams
    this.subscribePyth(symbol);
    this.subscribeDexScreener(tokenAddress);
    
    this.logger.info('Token subscription added', { 
      tokenAddress, 
      symbol, 
      totalSubscriptions: this.subscriptions.size 
    });
    
    this.emit('subscriptionAdded', { tokenAddress, symbol });
  }

  /**
   * Unsubscribe from token updates with cleanup
   */
  unsubscribeFromToken(tokenAddress: string): void {
    const key = tokenAddress.toLowerCase();
    this.subscriptions.delete(key);
    this.latestPrices.delete(key);
    this.aggregatedPrices.delete(key);
    this.priceHistories.delete(key);
    
    this.logger.info('Token subscription removed', { 
      tokenAddress, 
      remainingSubscriptions: this.subscriptions.size 
    });
    
    this.emit('subscriptionRemoved', { tokenAddress });
  }

  // Enhanced Pyth Network Integration
  private async initializePythStream(): Promise<void> {
    try {
      this.pythWs = new WebSocket(this.config.pyth.endpoint);
      this.setupConnectionHealth('pyth');
      
      this.pythWs.on('open', () => {
        this.logger.info('Pyth WebSocket connected');
        this.updateConnectionHealth('pyth', true);
        this.resetReconnectAttempts('pyth');
        this.stats.activeConnections++;
      });

      this.pythWs.on('message', (data: Buffer) => {
        const startTime = Date.now();
        try {
          const message = JSON.parse(data.toString());
          this.processPythMessage(message);
          this.updateLatencyMetrics(Date.now() - startTime);
        } catch (error) {
          this.logger.warn('Pyth message processing failed', { error });
          this.stats.failedUpdates++;
        }
      });

      this.pythWs.on('close', () => {
        this.logger.warn('Pyth WebSocket disconnected');
        this.updateConnectionHealth('pyth', false);
        this.stats.activeConnections--;
        this.scheduleReconnect('pyth', () => this.initializePythStream());
      });

      this.pythWs.on('error', (error) => {
        this.logger.error('Pyth WebSocket error', { error });
        this.updateConnectionError('pyth');
      });

      this.pythWs.on('pong', () => {
        this.updateConnectionHealth('pyth', true, Date.now());
      });
    } catch (error) {
      this.logger.error('Pyth initialization failed', { error });
      throw error;
    }
  }

  private subscribePyth(symbol: string): void {
    if (!this.pythWs || this.pythWs.readyState !== WebSocket.OPEN) {
      this.logger.warn('Pyth WebSocket not ready for subscription', { symbol });
      return;
    }
    
    const priceId = this.config.pyth.priceIds[symbol];
    if (!priceId) {
      this.logger.warn('Pyth price ID not found', { symbol });
      return;
    }

    const subscription = {
      method: 'subscribe',
      params: {
        type: 'price',
        ids: [priceId],
        binary: false,
        verbose: true
      }
    };

    this.pythWs.send(JSON.stringify(subscription));
    this.logger.debug('Pyth subscription sent', { symbol, priceId });
  }

  private processPythMessage(message: any): void {
    if (message.type === 'price_update') {
      const priceData = message.price_feed;
      if (!priceData?.price) return;

      const price = parseFloat(priceData.price.price) * Math.pow(10, priceData.price.expo);
      const confidence = parseFloat(priceData.price.conf) * Math.pow(10, priceData.price.expo);
      
      // Find symbol from price ID mapping
      const symbol = Object.keys(this.config.pyth.priceIds).find(
        key => this.config.pyth.priceIds[key] === priceData.id
      );
      
      if (!symbol) {
        this.logger.warn('Symbol not found for Pyth price ID', { priceId: priceData.id });
        return;
      }

      const tokenPrice: TokenPrice = {
        address: symbol.toLowerCase(),
        symbol,
        priceUsd: price,
        confidence: Math.max(0, Math.min(100, ((price - confidence) / price) * 100)),
        timestamp: Date.now(),
        source: 'pyth',
        deviation: (confidence / price) * 100
      };

      this.updatePrice(symbol.toLowerCase(), tokenPrice);
      this.stats.successfulUpdates++;
    }
  }

  // Enhanced Binance WebSocket Integration
  private async initializeBinanceStream(): Promise<void> {
    try {
      const symbols = this.config.binance.symbols.map(s => s.toLowerCase()).join('/');
      const wsUrl = `${this.config.binance.endpoint}/${symbols}@ticker`;
      
      this.binanceWs = new WebSocket(wsUrl);
      this.setupConnectionHealth('binance');

      this.binanceWs.on('open', () => {
        this.logger.info('Binance WebSocket connected');
        this.updateConnectionHealth('binance', true);
        this.resetReconnectAttempts('binance');
        this.stats.activeConnections++;
      });

      this.binanceWs.on('message', (data: Buffer) => {
        const startTime = Date.now();
        try {
          const message = JSON.parse(data.toString());
          this.processBinanceMessage(message);
          this.updateLatencyMetrics(Date.now() - startTime);
        } catch (error) {
          this.logger.warn('Binance message processing failed', { error });
          this.stats.failedUpdates++;
        }
      });

      this.binanceWs.on('close', () => {
        this.logger.warn('Binance WebSocket disconnected');
        this.updateConnectionHealth('binance', false);
        this.stats.activeConnections--;
        this.scheduleReconnect('binance', () => this.initializeBinanceStream());
      });

      this.binanceWs.on('error', (error) => {
        this.logger.error('Binance WebSocket error', { error });
        this.updateConnectionError('binance');
      });
    } catch (error) {
      this.logger.error('Binance initialization failed', { error });
      throw error;
    }
  }

  private processBinanceMessage(message: any): void {
    if (message.s && message.c) {
      const symbol = message.s.replace('USDT', '').toLowerCase();
      const price = parseFloat(message.c);
      const change24h = parseFloat(message.P || '0');
      const volume24h = parseFloat(message.v || '0');
      
      const tokenPrice: TokenPrice = {
        address: symbol,
        symbol: symbol.toUpperCase(),
        priceUsd: price,
        confidence: 98, // Binance is highly reliable
        timestamp: Date.now(),
        source: 'binance',
        change24h,
        volume24h
      };

      this.updatePrice(symbol, tokenPrice);
      this.stats.successfulUpdates++;
    }
  }

  // Enhanced DexScreener WebSocket Integration
  private async initializeDexScreenerStream(): Promise<void> {
    try {
      this.dexScreenerWs = new WebSocket(this.config.dexscreener.endpoint);
      this.setupConnectionHealth('dexscreener');

      this.dexScreenerWs.on('open', () => {
        this.logger.info('DexScreener WebSocket connected');
        this.updateConnectionHealth('dexscreener', true);
        this.resetReconnectAttempts('dexscreener');
        this.stats.activeConnections++;
      });

      this.dexScreenerWs.on('message', (data: Buffer) => {
        const startTime = Date.now();
        try {
          const message = JSON.parse(data.toString());
          this.processDexScreenerMessage(message);
          this.updateLatencyMetrics(Date.now() - startTime);
        } catch (error) {
          this.logger.warn('DexScreener message processing failed', { error });
          this.stats.failedUpdates++;
        }
      });

      this.dexScreenerWs.on('close', () => {
        this.logger.warn('DexScreener WebSocket disconnected');
        this.updateConnectionHealth('dexscreener', false);
        this.stats.activeConnections--;
        this.scheduleReconnect('dexscreener', () => this.initializeDexScreenerStream());
      });

      this.dexScreenerWs.on('error', (error) => {
        this.logger.error('DexScreener WebSocket error', { error });
        this.updateConnectionError('dexscreener');
      });
    } catch (error) {
      this.logger.error('DexScreener initialization failed', { error });
      throw error;
    }
  }

  private subscribeDexScreener(tokenAddress: string): void {
    if (!this.dexScreenerWs || this.dexScreenerWs.readyState !== WebSocket.OPEN) {
      this.logger.warn('DexScreener WebSocket not ready', { tokenAddress });
      return;
    }

    const subscription = {
      method: 'subscribe',
      params: {
        type: 'token',
        address: tokenAddress,
        chains: ['ethereum', 'bsc', 'polygon']
      }
    };

    this.dexScreenerWs.send(JSON.stringify(subscription));
    this.logger.debug('DexScreener subscription sent', { tokenAddress });
  }

  private processDexScreenerMessage(message: any): void {
    if (message.type === 'price_update' && message.data) {
      const data = message.data;
      
      const tokenPrice: TokenPrice = {
        address: data.address.toLowerCase(),
        symbol: data.symbol || 'UNKNOWN',
        priceUsd: parseFloat(data.priceUsd || '0'),
        confidence: 85,
        timestamp: Date.now(),
        source: 'dexscreener',
        volume24h: parseFloat(data.volume24h || '0'),
        marketCap: parseFloat(data.marketCap || '0')
      };

      this.updatePrice(data.address.toLowerCase(), tokenPrice);
      this.stats.successfulUpdates++;
    }
  }

  /**
   * Advanced price aggregation with confidence-weighted averaging
   */
  private updatePrice(identifier: string, newPrice: TokenPrice): void {
    const key = identifier.toLowerCase();
    
    // Store individual price
    this.latestPrices.set(`${key}-${newPrice.source}`, newPrice);
    
    // Update price history
    this.storePriceHistory(key, newPrice);
    
    // Aggregate prices from all sources
    this.aggregatePrices(key);
    
    // Emit real-time update
    this.emit('priceUpdate', { 
      identifier: key, 
      price: newPrice,
      aggregate: this.aggregatedPrices.get(key)
    });

    this.stats.totalUpdates++;
    this.stats.lastUpdateTime = Date.now();
  }

  private aggregatePrices(identifier: string): void {
    const key = identifier.toLowerCase();
    
    // Get all prices for this token from different sources
    const sourcePrices: TokenPrice[] = [];
    for (const [priceKey, price] of this.latestPrices) {
      if (priceKey.startsWith(key + '-')) {
        // Check if price is still fresh
        const age = Date.now() - price.timestamp;
        if (age <= this.config.performance.priceValidityMs) {
          sourcePrices.push(price);
        }
      }
    }

    if (sourcePrices.length === 0) {
      this.aggregatedPrices.delete(key);
      return;
    }

    // Calculate weighted average based on confidence and recency
    let totalWeight = 0;
    let weightedSum = 0;
    let totalConfidence = 0;

    sourcePrices.forEach(price => {
      // Weight based on confidence and recency
      const ageWeight = Math.max(0.1, 1 - (Date.now() - price.timestamp) / this.config.performance.priceValidityMs);
      const confidenceWeight = price.confidence / 100;
      const weight = ageWeight * confidenceWeight;
      
      weightedSum += price.priceUsd * weight;
      totalWeight += weight;
      totalConfidence += price.confidence;
    });

    const weightedPrice = weightedSum / totalWeight;
    const avgConfidence = totalConfidence / sourcePrices.length;

    // Calculate price deviation
    const deviations = sourcePrices.map(p => Math.abs(p.priceUsd - weightedPrice) / weightedPrice * 100);
    const maxDeviation = Math.max(...deviations);

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(sourcePrices, maxDeviation);

    const aggregate: PriceAggregate = {
      address: key,
      symbol: sourcePrices[0]?.symbol || 'UNKNOWN',
      weightedPrice,
      confidence: Math.min(100, avgConfidence * (1 - maxDeviation / 100)),
      sources: sourcePrices,
      deviation: maxDeviation,
      lastUpdated: Date.now(),
      qualityScore
    };

    this.aggregatedPrices.set(key, aggregate);
    
    this.emit('priceAggregated', { identifier: key, aggregate });
  }

  private calculateQualityScore(prices: TokenPrice[], deviation: number): number {
    // Quality score based on multiple factors
    const sourceCount = prices.length;
    const avgConfidence = prices.reduce((sum, p) => sum + p.confidence, 0) / prices.length;
    const recencyScore = Math.min(...prices.map(p => 
      Math.max(0, 1 - (Date.now() - p.timestamp) / this.config.performance.priceValidityMs)
    ));

    const diversityScore = Math.min(100, (sourceCount / 3) * 100); // Max 3 sources
    const consistencyScore = Math.max(0, 100 - deviation);
    
    return (diversityScore * 0.3 + consistencyScore * 0.4 + avgConfidence * 0.2 + recencyScore * 100 * 0.1);
  }

  private storePriceHistory(key: string, price: TokenPrice): void {
    if (!this.priceHistories.has(key)) {
      this.priceHistories.set(key, []);
    }
    
    const history = this.priceHistories.get(key)!;
    history.push(price);
    
    // Keep only recent history
    const maxLength = this.config.performance.maxHistoryLength || 100;
    if (history.length > maxLength) {
      history.splice(0, history.length - maxLength);
    }
  }

  /**
   * Advanced price trend analysis with momentum calculation
   */
  getPriceTrend(tokenAddress: string, timeWindow: number = 60000): PriceTrend {
    const key = tokenAddress.toLowerCase();
    const history = this.priceHistories.get(key) || [];
    
    if (history.length < 2) {
      return { 
        trend: 'stable', 
        changePercent: 0, 
        volatility: 0, 
        momentum: 0, 
        strength: 0 
      };
    }

    const cutoff = Date.now() - timeWindow;
    const recentPrices = history.filter(p => p.timestamp >= cutoff);
    
    if (recentPrices.length < 2) {
      return { 
        trend: 'stable', 
        changePercent: 0, 
        volatility: 0, 
        momentum: 0, 
        strength: 0 
      };
    }

    // Ensure we have valid price data
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    
    if (!firstPrice || !lastPrice) {
      return { 
        trend: 'stable', 
        changePercent: 0, 
        volatility: 0, 
        momentum: 0, 
        strength: 0 
      };
    }

    const changePercent = ((lastPrice.priceUsd - firstPrice.priceUsd) / firstPrice.priceUsd) * 100;
    
    // Calculate volatility (standard deviation)
    const prices = recentPrices.map(p => p.priceUsd);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / mean * 100;

    // Calculate momentum (rate of change acceleration)
    const momentum = this.calculateMomentum(recentPrices);
    
    // Calculate trend strength
    const strength = Math.min(100, Math.abs(changePercent) * (1 + momentum / 100));

    const trend = Math.abs(changePercent) < 0.1 ? 'stable' : 
                 changePercent > 0 ? 'up' : 'down';

    return { trend, changePercent, volatility, momentum, strength };
  }

  private calculateMomentum(prices: TokenPrice[]): number {
    if (prices.length < 3) return 0;

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const currentPrice = prices[i];
      const previousPrice = prices[i-1];
      if (currentPrice && previousPrice) {
        const change = (currentPrice.priceUsd - previousPrice.priceUsd) / previousPrice.priceUsd * 100;
        changes.push(change);
      }
    }

    if (changes.length < 2) return 0;

    // Calculate acceleration of price changes
    let acceleration = 0;
    for (let i = 1; i < changes.length; i++) {
      const currentChange = changes[i];
      const previousChange = changes[i-1];
      if (currentChange !== undefined && previousChange !== undefined) {
        acceleration += currentChange - previousChange;
      }
    }

    return changes.length > 1 ? acceleration / (changes.length - 1) : 0;
  }

  private getPriceHistory(tokenAddress: string): TokenPrice[] {
    const key = tokenAddress.toLowerCase();
    return this.priceHistories.get(key) || [];
  }

  private calculatePriceQuality(tokenAddress: string): number {
    const aggregate = this.aggregatedPrices.get(tokenAddress.toLowerCase());
    return aggregate ? aggregate.qualityScore : 0;
  }

  // Enhanced connection management
  private setupConnectionHealth(source: string): void {
    this.connectionHealth.set(source, {
      isConnected: false,
      lastPing: 0,
      responseTime: 0,
      errorCount: 0,
      successCount: 0
    });
  }

  private updateConnectionHealth(source: string, connected: boolean, pingTime?: number): void {
    const health = this.connectionHealth.get(source);
    if (health) {
      health.isConnected = connected;
      if (pingTime) {
        health.lastPing = pingTime;
        health.responseTime = Date.now() - pingTime;
      }
      if (connected) {
        health.successCount++;
      }
    }
  }

  private updateConnectionError(source: string): void {
    const health = this.connectionHealth.get(source);
    if (health) {
      health.errorCount++;
      health.isConnected = false;
    }
  }

  private updateLatencyMetrics(latency: number): void {
    this.stats.averageLatency = (this.stats.averageLatency + latency) / 2;
  }

  // Enhanced reconnection logic
  private scheduleReconnect(source: string, reconnectFn: () => Promise<void>): void {
    const attempts = this.reconnectAttempts.get(source) || 0;
    const config = source === 'pyth' ? this.config.pyth :
                  source === 'binance' ? this.config.binance :
                  this.config.dexscreener;
    
    if (attempts >= config.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached', { source });
      this.emit('connectionFailed', { source, attempts });
      return;
    }

    const delay = config.reconnectDelay * Math.pow(2, attempts);
    this.reconnectAttempts.set(source, attempts + 1);

    setTimeout(() => {
      this.logger.info('Attempting reconnection', { source, attempt: attempts + 1 });
      reconnectFn().catch(error => {
        this.logger.error('Reconnection failed', { source, error });
      });
    }, delay);
  }

  private resetReconnectAttempts(source: string): void {
    this.reconnectAttempts.set(source, 0);
  }

  // Performance monitoring
  private initializeHealthMonitoring(): void {
    // Ping connections periodically
    setInterval(() => {
      this.pingConnections();
    }, 30000); // Every 30 seconds

    // Update quality scores
    setInterval(() => {
      this.updateQualityScores();
    }, 10000); // Every 10 seconds
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.calculatePerformanceMetrics();
      this.emit('performanceUpdate', this.getPerformanceStats());
    }, 5000); // Every 5 seconds
  }

  private startPriceAggregation(): void {
    setInterval(() => {
      // Re-aggregate all prices to ensure freshness
      for (const identifier of this.subscriptions) {
        this.aggregatePrices(identifier);
      }
    }, this.config.performance.aggregationIntervalMs || 1000);
  }

  private pingConnections(): void {
    if (this.pythWs?.readyState === WebSocket.OPEN) {
      this.pythWs.ping();
    }
    if (this.binanceWs?.readyState === WebSocket.OPEN) {
      this.binanceWs.ping();
    }
    if (this.dexScreenerWs?.readyState === WebSocket.OPEN) {
      this.dexScreenerWs.ping();
    }
  }

  private updateQualityScores(): void {
    let totalQuality = 0;
    let count = 0;

    for (const [, aggregate] of this.aggregatedPrices) {
      totalQuality += aggregate.qualityScore;
      count++;
    }

    this.stats.qualityScore = count > 0 ? totalQuality / count : 100;
  }

  private calculatePerformanceMetrics(): void {
    // Calculate success rate
    const totalRequests = this.stats.successfulUpdates + this.stats.failedUpdates;
    const successRate = totalRequests > 0 ? (this.stats.successfulUpdates / totalRequests) * 100 : 100;
    
    // Update overall quality based on performance
    this.stats.qualityScore = Math.min(this.stats.qualityScore, successRate);
  }

  // Public API methods
  getStatus(): {
    isInitialized: boolean;
    activeConnections: number;
    subscriptions: number;
    performanceStats: any;
    connectionHealth: any;
  } {
    return {
      isInitialized: this.stats.activeConnections > 0,
      activeConnections: this.stats.activeConnections,
      subscriptions: this.subscriptions.size,
      performanceStats: this.getPerformanceStats(),
      connectionHealth: Object.fromEntries(this.connectionHealth)
    };
  }

  getPerformanceStats() {
    return {
      ...this.stats,
      avgLatencyMs: Math.round(this.stats.averageLatency),
      successRate: this.stats.totalUpdates > 0 ? 
        (this.stats.successfulUpdates / this.stats.totalUpdates) * 100 : 100,
      uptime: Date.now() - (this.stats.lastUpdateTime || Date.now())
    };
  }

  getAllPrices(): Map<string, PriceAggregate> {
    return new Map(this.aggregatedPrices);
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  // Rate Limiting System Implementation
  private initializeRateLimiters(): void {
    const sources = ['pyth', 'binance', 'dexscreener', 'chainlink'];
    
    sources.forEach(source => {
      this.rateLimiters.set(source, {
        requests: [],
        burstCount: 0
      });
    });
    
    // Clean up old requests every second
    setInterval(() => {
      this.cleanupRateLimiters();
    }, 1000);
    
    this.logger.debug('Rate limiters initialized for all sources');
  }

  private cleanupRateLimiters(): void {
    const now = Date.now();
    
    for (const [source, limiter] of this.rateLimiters) {
      const config = this.config.rateLimiting[source as keyof typeof this.config.rateLimiting];
      
      // Remove old requests outside the time window
      limiter.requests = limiter.requests.filter(
        timestamp => now - timestamp < config.timeWindowMs
      );
      
      // Reset burst count if enough time has passed
      if (limiter.requests.length === 0) {
        limiter.burstCount = 0;
      }
    }
  }

  private checkRateLimit(source: string): boolean {
    const limiter = this.rateLimiters.get(source);
    const config = this.config.rateLimiting[source as keyof typeof this.config.rateLimiting];
    
    if (!limiter || !config) {
      this.logger.warn('Rate limiter not found for source', { source });
      return true; // Allow by default
    }

    const now = Date.now();
    
    // Check burst limit
    if (limiter.burstCount >= config.burstLimit) {
      this.logger.debug('Burst limit exceeded', { source, burstCount: limiter.burstCount });
      return false;
    }
    
    // Check requests per second
    const recentRequests = limiter.requests.filter(
      timestamp => now - timestamp < config.timeWindowMs
    );
    
    const requestsPerSecond = recentRequests.length / (config.timeWindowMs / 1000);
    
    if (requestsPerSecond >= config.requestsPerSecond) {
      this.logger.debug('Rate limit exceeded', { 
        source, 
        requestsPerSecond: requestsPerSecond.toFixed(2),
        limit: config.requestsPerSecond 
      });
      return false;
    }
    
    // Record this request
    limiter.requests.push(now);
    limiter.burstCount++;
    
    return true;
  }

  // Chainlink Integration Implementation
  private initializeChainlinkProviders(): void {
    this.config.chainlink.rpcEndpoints.forEach((endpoint, index) => {
      try {
        const provider = new ethers.JsonRpcProvider(endpoint);
        this.chainlinkProviders.push(provider);
        this.logger.debug('Chainlink provider initialized', { endpoint: `endpoint_${index}` });
      } catch (error) {
        this.logger.error('Failed to initialize Chainlink provider', { endpoint, error });
      }
    });
    
    if (this.chainlinkProviders.length === 0) {
      this.logger.warn('No Chainlink providers initialized');
      return;
    }
    
    // Start periodic Chainlink price updates
    setInterval(() => {
      this.updateChainlinkPrices();
    }, 30000); // Every 30 seconds
    
    this.logger.info('Chainlink integration initialized', { 
      providers: this.chainlinkProviders.length,
      feeds: Object.keys(this.config.chainlink.feeds).length
    });
  }

  private async updateChainlinkPrices(): Promise<void> {
    if (this.chainlinkProviders.length === 0) return;
    
    const promises = Object.entries(this.config.chainlink.feeds).map(
      ([symbol, feedAddress]) => this.fetchChainlinkPrice(symbol, feedAddress)
    );
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const symbol = Object.keys(this.config.chainlink.feeds)[index];
        if (!symbol) return;
        
        this.chainlinkPrices.set(symbol.toLowerCase(), result.value);
        this.stats.chainlinkUpdates++;
        
        // Convert to TokenPrice format and update
        const tokenPrice: TokenPrice = {
          address: symbol.toLowerCase(),
          symbol: result.value.symbol,
          priceUsd: result.value.priceUsd,
          confidence: 99, // Chainlink is highly reliable
          timestamp: Date.now(),
          source: 'chainlink'
        };
        
        this.updatePrice(symbol.toLowerCase(), tokenPrice);
      }
    });
  }

  private async fetchChainlinkPrice(symbol: string, feedAddress: string): Promise<ChainlinkPrice | null> {
    if (!this.checkRateLimit('chainlink')) {
      return null;
    }
    
    for (const provider of this.chainlinkProviders) {
      try {
        // Chainlink price feed ABI (minimal)
        const feedAbi = [
          "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
          "function decimals() external view returns (uint8)"
        ];
        
        const contract = new ethers.Contract(feedAddress, feedAbi, provider);
        
        const [roundData, decimals] = await Promise.all([
          contract['latestRoundData']?.(),
          contract['decimals']?.()
        ]);
        
        const price = Number(roundData.answer) / Math.pow(10, Number(decimals));
        const updatedAt = Number(roundData.updatedAt) * 1000; // Convert to milliseconds
        
        // Check if data is stale (older than 1 hour)
        if (Date.now() - updatedAt > 3600000) {
          this.triggerAlert({
            type: 'chainlink_stale',
            severity: 'medium',
            message: `Chainlink feed for ${symbol} is stale`,
            data: { symbol, feedAddress, updatedAt, staleness: Date.now() - updatedAt },
            timestamp: Date.now()
          });
        }
        
        return {
          address: feedAddress,
          symbol,
          priceUsd: price,
          decimals: Number(decimals),
          updatedAt,
          roundId: Number(roundData.roundId)
        };
      } catch (error) {
        this.logger.debug('Chainlink fetch failed, trying next provider', { 
          symbol, 
          feedAddress, 
          error: (error as Error).message 
        });
        continue;
      }
    }
    
    this.logger.warn('All Chainlink providers failed', { symbol, feedAddress });
    return null;
  }

  // Enhanced Alerting System Implementation
  private initializeAlertingSystem(): void {
    // Check for alerts every 10 seconds
    setInterval(() => {
      this.evaluateAlerts();
    }, 10000);
    
    // Clean up old alert history every hour
    setInterval(() => {
      this.cleanupAlertHistory();
    }, 3600000);
    
    this.logger.info('Alerting system initialized', {
      priceDeviationThreshold: this.config.alerts.priceDeviationThreshold,
      latencyThreshold: this.config.alerts.latencyThreshold,
      qualityThreshold: this.config.alerts.qualityScoreThreshold
    });
  }

  private evaluateAlerts(): void {
    // Check price deviations
    this.checkPriceDeviations();
    
    // Check latency alerts
    this.checkLatencyAlerts();
    
    // Check quality score alerts
    this.checkQualityAlerts();
    
    // Check connection health alerts
    this.checkConnectionAlerts();
  }

  private checkPriceDeviations(): void {
    for (const [key, aggregate] of this.aggregatedPrices) {
      if (aggregate.deviation > this.config.alerts.priceDeviationThreshold) {
        const alertKey = `price_deviation_${key}`;
        
        if (!this.isAlertThrottled(alertKey)) {
          this.triggerAlert({
            type: 'price_deviation',
            severity: aggregate.deviation > this.config.alerts.priceDeviationThreshold * 2 ? 'high' : 'medium',
            message: `Price deviation detected for ${aggregate.symbol}`,
            data: {
              symbol: aggregate.symbol,
              deviation: aggregate.deviation,
              threshold: this.config.alerts.priceDeviationThreshold,
              sources: aggregate.sources.length
            },
            timestamp: Date.now()
          });
        }
      }
    }
  }

  private checkLatencyAlerts(): void {
    if (this.stats.averageLatency > this.config.alerts.latencyThreshold) {
      const alertKey = 'high_latency';
      
      if (!this.isAlertThrottled(alertKey)) {
        this.triggerAlert({
          type: 'high_latency',
          severity: this.stats.averageLatency > this.config.alerts.latencyThreshold * 2 ? 'high' : 'medium',
          message: 'High latency detected in price updates',
          data: {
            averageLatency: this.stats.averageLatency,
            threshold: this.config.alerts.latencyThreshold
          },
          timestamp: Date.now()
        });
      }
    }
  }

  private checkQualityAlerts(): void {
    if (this.stats.qualityScore < this.config.alerts.qualityScoreThreshold) {
      const alertKey = 'low_quality';
      
      if (!this.isAlertThrottled(alertKey)) {
        this.triggerAlert({
          type: 'low_quality',
          severity: this.stats.qualityScore < this.config.alerts.qualityScoreThreshold * 0.8 ? 'high' : 'medium',
          message: 'Low quality score detected',
          data: {
            qualityScore: this.stats.qualityScore,
            threshold: this.config.alerts.qualityScoreThreshold
          },
          timestamp: Date.now()
        });
      }
    }
  }

  private checkConnectionAlerts(): void {
    for (const [source, health] of this.connectionHealth) {
      if (health.errorCount >= this.config.alerts.connectionFailureThreshold) {
        const alertKey = `connection_failure_${source}`;
        
        if (!this.isAlertThrottled(alertKey)) {
          this.triggerAlert({
            type: 'connection_failure',
            severity: health.errorCount >= this.config.alerts.connectionFailureThreshold * 2 ? 'critical' : 'high',
            message: `Connection failures detected for ${source}`,
            data: {
              source,
              errorCount: health.errorCount,
              successCount: health.successCount,
              threshold: this.config.alerts.connectionFailureThreshold
            },
            timestamp: Date.now()
          });
        }
      }
    }
  }

  private isAlertThrottled(alertKey: string): boolean {
    const lastAlert = this.alertHistory.get(alertKey) || 0;
    const throttleTime = 300000; // 5 minutes
    
    return Date.now() - lastAlert < throttleTime;
  }

  private triggerAlert(alert: AlertEvent): void {
    this.stats.alertsTriggered++;
    this.alertHistory.set(`${alert.type}_${Date.now()}`, alert.timestamp);
    this.activeAlerts.add(alert.type);
    
    // Log the alert
    this.logger.warn('Alert triggered', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      data: alert.data
    });
    
    // Emit alert event
    this.emit('alert', alert);
    
    // Send external notifications
    this.sendAlertNotifications(alert);
    
    // Auto-resolve after some time
    setTimeout(() => {
      this.activeAlerts.delete(alert.type);
    }, 600000); // 10 minutes
  }

  private async sendAlertNotifications(alert: AlertEvent): Promise<void> {
    const notifications: Promise<void>[] = [];
    
    // Webhook notification
    if (this.config.alerts.webhookUrl) {
      notifications.push(this.sendWebhookAlert(alert));
    }
    
    await Promise.allSettled(notifications);
  }

  private async sendWebhookAlert(alert: AlertEvent): Promise<void> {
    try {
      const response = await fetch(this.config.alerts.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `🚨 Oracle Alert: ${alert.message}`,
          severity: alert.severity,
          type: alert.type,
          timestamp: new Date(alert.timestamp).toISOString(),
          data: alert.data
        })
      });
      
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }
      
      this.logger.debug('Webhook alert sent successfully', { type: alert.type });
    } catch (error) {
      this.logger.error('Failed to send webhook alert', { 
        error: (error as Error).message,
        type: alert.type 
      });
    }
  }

  private cleanupAlertHistory(): void {
    const oneHourAgo = Date.now() - 3600000;
    
    for (const [key, timestamp] of this.alertHistory) {
      if (timestamp < oneHourAgo) {
        this.alertHistory.delete(key);
      }
    }
  }

  /**
   * Get comprehensive oracle status including all subsystems
   * 
   * @returns Complete status object with performance, health, and alert information
   */
  getComprehensiveStatus(): {
    oracle: any;
    rateLimiting: any;
    chainlink: any;
    alerts: any;
  } {
    return {
      oracle: this.getStatus(),
      rateLimiting: this.getRateLimitingStatus(),
      chainlink: this.getChainlinkStatus(),
      alerts: this.getAlertStatus()
    };
  }

  private getRateLimitingStatus() {
    const status: any = {};
    
    for (const [source, limiter] of this.rateLimiters) {
      const config = this.config.rateLimiting[source as keyof typeof this.config.rateLimiting];
      const recentRequests = limiter.requests.filter(
        timestamp => Date.now() - timestamp < config.timeWindowMs
      );
      
      status[source] = {
        requestsInWindow: recentRequests.length,
        limit: config.requestsPerSecond,
        burstCount: limiter.burstCount,
        burstLimit: config.burstLimit,
        utilizationPercent: (recentRequests.length / config.requestsPerSecond) * 100
      };
    }
    
    return status;
  }

  private getChainlinkStatus() {
    return {
      providers: this.chainlinkProviders.length,
      feeds: Object.keys(this.config.chainlink.feeds).length,
      latestPrices: Object.fromEntries(this.chainlinkPrices),
      totalUpdates: this.stats.chainlinkUpdates
    };
  }

  private getAlertStatus() {
    return {
      totalTriggered: this.stats.alertsTriggered,
      activeAlerts: Array.from(this.activeAlerts),
      recentAlerts: Array.from(this.alertHistory.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
    };
  }

  /**
   * Cleanup all connections and resources
   */
  async destroy(): Promise<void> {
    try {
      // Close all WebSocket connections
      const connections = [this.pythWs, this.binanceWs, this.dexScreenerWs];
      await Promise.allSettled(
        connections.map(ws => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'Oracle shutdown');
          }
        })
      );

      // Clear all data structures
      this.latestPrices.clear();
      this.aggregatedPrices.clear();
      this.priceHistories.clear();
      this.subscriptions.clear();
      this.connectionHealth.clear();
      this.reconnectAttempts.clear();
      
      // Remove all listeners
      this.removeAllListeners();
      
      this.logger.info('Zero-latency oracle destroyed successfully');
      this.emit('destroyed');
    } catch (error) {
      this.logger.error('Error during oracle destruction', { error });
      throw error;
    }
  }
} 