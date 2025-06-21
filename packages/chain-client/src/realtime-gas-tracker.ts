import { EventEmitter } from 'events';
import WebSocket from 'ws';
import winston from 'winston';
import { ethers } from 'ethers';
import { CostTracker } from './zero-latency-config';

export interface GasTrackerConfig {
  // Performance requirements aligned with zero-latency config
  performance: {
    maxGasLatency: number;          // Target: <10ms gas updates
    updateFrequencyMs: number;      // Gas update frequency
    maxHistoryLength: number;       // Maximum gas history to store  
    cacheValidityMs: number;        // Cache validity period
    predictionAccuracyTarget: number; // Target prediction accuracy %
  };

  // Data source configuration aligned with zero-latency config
  dataSources: {
    bloxroute: {
      enabled: boolean;
      endpoint: string;             // 'wss://api.blxrbdn.com/ws'
      authToken: string;
      chains: string[];
      costPerUpdate: number;        // Cost tracking integration
      updateFrequencyMs: number;    // <50ms updates
      predictionEnabled: boolean;
    };
    
    flashbots: {
      enabled: boolean;
      endpoint: string;             // 'wss://relay.flashbots.net/ws'
      bundleEndpoint: string;
      authKey: string;
      free: boolean;                // Free service flag
      updateFrequencyMs: number;    // <100ms updates
      mevProtectionEnabled: boolean;
    };
    
    ethgasstation: {
      enabled: boolean;
      endpoint: string;
      apiKey: string;
      costPerCall: number;          // API cost tracking
      updateFrequencyMs: number;    // Update frequency
      backupOnly: boolean;          // Use as backup only
    };
    
    chainlink: {
      enabled: boolean;
      feeds: Record<string, string>; // chain -> feed address
      costPerCall: number;
      updateFrequencyMs: number;
      rpcEndpoints: string[];
    };
  };
  
  // Prediction engine configuration
  prediction: {
    enabled: boolean;
    historyWindow: number;          // milliseconds
    updateInterval: number;         // milliseconds  
    confidenceThreshold: number;    // minimum confidence for predictions
    trendAnalysisEnabled: boolean;  // Enable trend analysis
    optimizeForStrategy: 'arbitrage' | 'mev' | 'copy-trading' | 'general';
  };

  // Chain-specific configurations
  chains: {
    [chain: string]: {
      enabled: boolean;
      defaultGasMultiplier: number; // Safety multiplier
      maxGasPrice: string;          // Maximum acceptable gas price
      minGasPrice: string;          // Minimum gas price
      blockTime: number;            // Expected block time
      finalizationDepth: number;    // Blocks for finalization
      priorityFeeStrategy: 'conservative' | 'aggressive' | 'adaptive';
    };
  };

  // Reconnection and reliability
  reconnection: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    enableCircuitBreaker: boolean;
  };
}

export interface GasPrice {
  chain: string;
  slow: string;
  standard: string;
  fast: string;
  instant: string;
  baseFee?: string;
  maxPriorityFee?: string;
  maxFeePerGas?: string;
  timestamp: number;
  blockNumber: number;
  confidence: number;
  source: string;
  predictedIncrease?: number; // percentage
}

export interface GasPrediction {
  chain: string;
  currentGas: GasPrice;
  nextBlockPrediction: GasPrice;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  timeToOptimal: number; // milliseconds until optimal gas price
}

// Enterprise-grade monitoring interfaces aligned with smart route engine
export interface GasTrackerMetrics {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  averageLatency: number;
  peakLatency: number;
  predictionAccuracy: number;
  cacheHitRate: number;
  uptime: number;
  dataSourcesOnline: number;
  totalDataSources: number;
  gasTrackingPerSecond: number;
  memoryUsage: number;
  errorCount: number;
  latencyDistribution: {
    under5ms: number;
    under10ms: number;
    under25ms: number;
    under50ms: number;
    over50ms: number;
  };
}

export interface GasSystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  dataSourcesOnline: number;
  totalDataSources: number;
  lastSuccessfulUpdate: number;
  predictionEngineStatus: 'running' | 'stopped' | 'error';
  memoryPressure: 'low' | 'medium' | 'high';
  errorRate: number;
  connectionStability: number;
  averageResponseTime: number;
}

export interface GasAnalytics {
  totalPredictionsMade: number;
  accuratePredictions: number;
  predictionAccuracyRate: number;
  trendPredictionAccuracy: number;
  optimalTimingHits: number;
  gasSavingsGenerated: string; // USD value
  topPerformingChains: string[];
  dataSourceReliability: { [source: string]: number };
  chainPerformance: { [chain: string]: number };
}

/**
 * Real-time gas tracker with predictive analytics
 * Updates: <50ms latency, block-by-block tracking
 */
export class RealTimeGasTracker extends EventEmitter {
  private logger: winston.Logger;
  private config: GasTrackerConfig;
  
  private bloxrouteWs?: WebSocket;
  private flashbotsWs?: WebSocket;
  
  private currentGasPrices = new Map<string, GasPrice>();
  private gasHistory = new Map<string, GasPrice[]>();
  private blockNumbers = new Map<string, number>();
  
  private predictionInterval?: ReturnType<typeof setInterval>;
  private reconnectAttempts = new Map<string, number>();

  // Enterprise-grade monitoring and analytics
  private metrics: GasTrackerMetrics;
  private systemHealth: GasSystemHealth;
  private analytics: GasAnalytics;
  private startTime: number;
  private updateCounter = 0;
  private latencyHistory: number[] = [];
  private errorCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  
  // Performance tracking
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private metricsTimer?: ReturnType<typeof setInterval>;

  constructor(config: GasTrackerConfig, logger: winston.Logger, private costTracker?: CostTracker) {
    super();
    this.config = config;
    this.logger = logger;
    this.startTime = Date.now();
    
    // Initialize enterprise monitoring systems
    this.metrics = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      averageLatency: 0,
      peakLatency: 0,
      predictionAccuracy: 0,
      cacheHitRate: 0,
      uptime: 0,
      dataSourcesOnline: 0,
      totalDataSources: 0,
      gasTrackingPerSecond: 0,
      memoryUsage: 0,
      errorCount: 0,
      latencyDistribution: {
        under5ms: 0,
        under10ms: 0,
        under25ms: 0,
        under50ms: 0,
        over50ms: 0
      }
    };

    this.systemHealth = {
      status: 'healthy',
      dataSourcesOnline: 0,
      totalDataSources: 0,
      lastSuccessfulUpdate: 0,
      predictionEngineStatus: 'stopped',
      memoryPressure: 'low',
      errorRate: 0,
      connectionStability: 100,
      averageResponseTime: 0
    };

    this.analytics = {
      totalPredictionsMade: 0,
      accuratePredictions: 0,
      predictionAccuracyRate: 0,
      trendPredictionAccuracy: 0,
      optimalTimingHits: 0,
      gasSavingsGenerated: '0',
      topPerformingChains: [],
      dataSourceReliability: {},
      chainPerformance: {}
    };
  }

  /**
   * Initialize all gas tracking connections
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.initializeBloxrouteStream(),
      this.initializeFlashbotsStream()
    ]);
    
    this.startPredictionEngine();
    
    // Start enterprise monitoring systems
    this.startHealthMonitoring();
    this.startMetricsCollection();
    
    // Update system health
    this.systemHealth.dataSourcesOnline = this.getActiveDataSources();
    this.systemHealth.totalDataSources = this.getTotalDataSources();
    this.systemHealth.predictionEngineStatus = this.config.prediction.enabled ? 'running' : 'stopped';
    this.systemHealth.lastSuccessfulUpdate = Date.now();
    
    this.logger.info('Real-time gas tracker initialized', {
      dataSources: this.systemHealth.totalDataSources,
      onlineDataSources: this.systemHealth.dataSourcesOnline,
      predictionEnabled: this.config.prediction.enabled,
      version: '2.0.0-enterprise'
    });
    
    this.emit('initialized', {
      systemHealth: this.getSystemHealth(),
      metrics: this.getMetrics()
    });
  }

  /**
   * Get current gas price for a chain
   */
  getCurrentGasPrice(chain: string): GasPrice | null {
    return this.currentGasPrices.get(chain) || null;
  }

  /**
   * Get gas prediction for optimal timing
   */
  getGasPrediction(chain: string): GasPrediction | null {
    const current = this.currentGasPrices.get(chain);
    const history = this.gasHistory.get(chain) || [];
    
    if (!current || history.length < 10) {
      return null;
    }

    const prediction = this.predictNextBlockGas(chain);
    const trend = this.calculateGasTrend(chain);
    const timeToOptimal = this.calculateOptimalTiming(chain);

    return {
      chain,
      currentGas: current,
      nextBlockPrediction: prediction,
      trend,
      confidence: this.calculatePredictionConfidence(chain),
      timeToOptimal
    };
  }

  /**
   * Get optimal gas price for immediate execution
   */
  getOptimalGasForSpeed(chain: string, targetConfirmationTime: number): GasPrice | null {
    const prediction = this.getGasPrediction(chain);
    if (!prediction) return null;

    const current = prediction.currentGas;
    
    // Adjust based on target confirmation time
    let multiplier = 1.0;
    if (targetConfirmationTime <= 12000) { // 1 block
      multiplier = 1.5;
    } else if (targetConfirmationTime <= 36000) { // 3 blocks
      multiplier = 1.2;
    } else if (targetConfirmationTime <= 60000) { // 5 blocks
      multiplier = 1.1;
    }

    const optimizedGas = {
      ...current,
      fast: (BigInt(current.fast) * BigInt(Math.floor(multiplier * 100)) / BigInt(100)).toString(),
      instant: (BigInt(current.instant) * BigInt(Math.floor(multiplier * 100)) / BigInt(100)).toString(),
      confidence: Math.max(70, current.confidence - 10) // Slight confidence reduction for predictions
    };

    // Validate gas prices using ethers utilities
    return this.validateAndNormalizeGasPrice(optimizedGas);
  }

  /**
   * Validate and normalize gas prices using ethers utilities
   */
  private validateAndNormalizeGasPrice(gasPrice: GasPrice): GasPrice {
    try {
      // Validate gas price values using ethers
      const validatedGas = {
        ...gasPrice,
        slow: ethers.parseUnits(ethers.formatUnits(gasPrice.slow, 'wei'), 'wei').toString(),
        standard: ethers.parseUnits(ethers.formatUnits(gasPrice.standard, 'wei'), 'wei').toString(),
        fast: ethers.parseUnits(ethers.formatUnits(gasPrice.fast, 'wei'), 'wei').toString(),
        instant: ethers.parseUnits(ethers.formatUnits(gasPrice.instant, 'wei'), 'wei').toString()
      };

      // Apply chain-specific limits if configured
      const chainConfig = this.config.chains[gasPrice.chain];
      if (chainConfig) {
        const maxGas = BigInt(chainConfig.maxGasPrice);
        const minGas = BigInt(chainConfig.minGasPrice);

        validatedGas.slow = this.clampGasPrice(validatedGas.slow, minGas, maxGas);
        validatedGas.standard = this.clampGasPrice(validatedGas.standard, minGas, maxGas);
        validatedGas.fast = this.clampGasPrice(validatedGas.fast, minGas, maxGas);
        validatedGas.instant = this.clampGasPrice(validatedGas.instant, minGas, maxGas);
      }

      return validatedGas;
    } catch (error) {
      this.logger.warn('Gas price validation failed, using original values', {
        chain: gasPrice.chain,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return gasPrice;
    }
  }

  /**
   * Clamp gas price between min and max values
   */
  private clampGasPrice(gasPrice: string, min: bigint, max: bigint): string {
    const price = BigInt(gasPrice);
    if (price < min) return min.toString();
    if (price > max) return max.toString();
    return gasPrice;
  }

  /**
   * Calculate transaction fee estimate using ethers utilities
   */
  calculateTransactionFee(gasPrice: GasPrice, gasLimit: number = 21000): {
    slowFee: string;
    standardFee: string;
    fastFee: string;
    instantFee: string;
    feesInEth: {
      slow: string;
      standard: string;
      fast: string;
      instant: string;
    };
  } {
    const gasLimitBig = BigInt(gasLimit);
    
    const slowFee = (BigInt(gasPrice.slow) * gasLimitBig).toString();
    const standardFee = (BigInt(gasPrice.standard) * gasLimitBig).toString();
    const fastFee = (BigInt(gasPrice.fast) * gasLimitBig).toString();
    const instantFee = (BigInt(gasPrice.instant) * gasLimitBig).toString();

    return {
      slowFee,
      standardFee,
      fastFee,
      instantFee,
      feesInEth: {
        slow: ethers.formatEther(slowFee),
        standard: ethers.formatEther(standardFee),
        fast: ethers.formatEther(fastFee),
        instant: ethers.formatEther(instantFee)
      }
    };
  }

  /**
   * Convert gas price between different units
   */
  convertGasPrice(value: string, fromUnit: 'wei' | 'gwei' | 'ether', toUnit: 'wei' | 'gwei' | 'ether'): string {
    try {
      // Convert to wei first (base unit)
      let weiValue: bigint;
      switch (fromUnit) {
        case 'wei':
          weiValue = BigInt(value);
          break;
        case 'gwei':
          weiValue = ethers.parseUnits(value, 'gwei');
          break;
        case 'ether':
          weiValue = ethers.parseUnits(value, 'ether');
          break;
        default:
          throw new Error(`Unsupported from unit: ${fromUnit}`);
      }

      // Convert from wei to target unit
      switch (toUnit) {
        case 'wei':
          return weiValue.toString();
        case 'gwei':
          return ethers.formatUnits(weiValue, 'gwei');
        case 'ether':
          return ethers.formatUnits(weiValue, 'ether');
        default:
          throw new Error(`Unsupported to unit: ${toUnit}`);
      }
    } catch (error) {
      this.logger.error('Gas price conversion failed', {
        value,
        fromUnit,
        toUnit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return value; // Return original value on error
    }
  }

  // BloxRoute Integration (Premium Real-time Gas)
  private async initializeBloxrouteStream(): Promise<void> {
    if (!this.config.dataSources.bloxroute.enabled || !this.config.dataSources.bloxroute.authToken) {
      this.logger.warn('BloxRoute is disabled or auth token not provided');
      return;
    }

    this.bloxrouteWs = new WebSocket(this.config.dataSources.bloxroute.endpoint, {
      headers: {
        'Authorization': this.config.dataSources.bloxroute.authToken
      }
    });

    this.bloxrouteWs.on('open', () => {
      this.logger.info('BloxRoute gas stream connected');
      this.subscribeToBloxrouteGas();
    });

    this.bloxrouteWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.processBloxrouteMessage(message);
      } catch (error) {
        this.logger.warn('Failed to parse BloxRoute message', { error });
      }
    });

    this.bloxrouteWs.on('close', () => {
      this.logger.warn('BloxRoute gas stream disconnected');
      this.scheduleReconnect('bloxroute', () => this.initializeBloxrouteStream());
    });

    this.bloxrouteWs.on('error', (error) => {
      this.logger.error('BloxRoute WebSocket error', { error });
    });
  }

  private subscribeToBloxrouteGas(): void {
    if (!this.bloxrouteWs || this.bloxrouteWs.readyState !== WebSocket.OPEN) return;

    for (const chain of this.config.dataSources.bloxroute.chains) {
      const subscription = {
        method: 'subscribe',
        params: {
          type: 'gas_price',
          chain: chain,
          include_predictions: this.config.dataSources.bloxroute.predictionEnabled
        }
      };

      this.bloxrouteWs.send(JSON.stringify(subscription));
    }
  }

  private processBloxrouteMessage(message: any): void {
    if (message.type === 'gas_price_update') {
      const data = message.data;
      
      // Track cost for BloxRoute usage
      if (this.costTracker) {
        this.costTracker.addCost('gas-tracking', this.config.dataSources.bloxroute.costPerUpdate, 'bloxroute');
      }
      
      const gasPrice: GasPrice = {
        chain: data.chain,
        slow: data.slow || data.safeLow,
        standard: data.standard || data.average,
        fast: data.fast,
        instant: data.fastest || data.fast,
        baseFee: data.baseFee,
        maxPriorityFee: data.maxPriorityFee,
        maxFeePerGas: data.maxFeePerGas,
        timestamp: Date.now(),
        blockNumber: data.blockNumber || 0,
        confidence: 95, // BloxRoute is highly reliable
        source: 'bloxroute',
        predictedIncrease: data.predictedChange
      };

      this.updateGasPrice(data.chain, gasPrice);
    }
  }

  // Flashbots Integration (MEV + Gas)
  private async initializeFlashbotsStream(): Promise<void> {
    if (!this.config.dataSources.flashbots.enabled || !this.config.dataSources.flashbots.authKey) {
      this.logger.warn('Flashbots is disabled or auth key not provided');
      return;
    }

    this.flashbotsWs = new WebSocket(this.config.dataSources.flashbots.endpoint, {
      headers: {
        'X-Flashbots-Signature': this.config.dataSources.flashbots.authKey
      }
    });

    this.flashbotsWs.on('open', () => {
      this.logger.info('Flashbots gas stream connected');
      this.subscribeToFlashbotsGas();
    });

    this.flashbotsWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.processFlashbotsMessage(message);
      } catch (error) {
        this.logger.warn('Failed to parse Flashbots message', { error });
      }
    });

    this.flashbotsWs.on('close', () => {
      this.logger.warn('Flashbots gas stream disconnected');
      this.scheduleReconnect('flashbots', () => this.initializeFlashbotsStream());
    });

    this.flashbotsWs.on('error', (error) => {
      this.logger.error('Flashbots WebSocket error', { error });
    });
  }

  private subscribeToFlashbotsGas(): void {
    if (!this.flashbotsWs || this.flashbotsWs.readyState !== WebSocket.OPEN) return;

    const subscription = {
      method: 'eth_subscribe',
      params: [
        'gasPrice',
        {
          includeBaseFee: true,
          includePriorityFee: true,
          includePredictions: true
        }
      ]
    };

    this.flashbotsWs.send(JSON.stringify(subscription));
  }

  private processFlashbotsMessage(message: any): void {
    if (message.params && message.params.result) {
      const data = message.params.result;
      
      // Track cost for Flashbots usage (if not free)
      if (this.costTracker && !this.config.dataSources.flashbots.free) {
        this.costTracker.addCost('gas-tracking', 0, 'flashbots'); // Free service
      }
      
      const gasPrice: GasPrice = {
        chain: 'ethereum', // Flashbots is Ethereum-specific
        slow: data.safeLow || '1000000000',
        standard: data.standard || '2000000000',
        fast: data.fast || '3000000000',
        instant: data.instant || '5000000000',
        baseFee: data.baseFeePerGas,
        maxPriorityFee: data.maxPriorityFeePerGas,
        maxFeePerGas: data.maxFeePerGas,
        timestamp: Date.now(),
        blockNumber: parseInt(data.blockNumber || '0'),
        confidence: 90,
        source: 'flashbots'
      };

      this.updateGasPrice('ethereum', gasPrice);
    }
  }

  // Gas Prediction Engine
  private startPredictionEngine(): void {
    if (!this.config.prediction.enabled) {
      this.logger.info('Gas prediction engine is disabled');
      return;
    }

    this.predictionInterval = setInterval(() => {
      this.runPredictionAlgorithms();
    }, this.config.prediction.updateInterval);
  }

  private runPredictionAlgorithms(): void {
    for (const chain of ['ethereum', 'bsc', 'polygon']) {
      const prediction = this.predictNextBlockGas(chain);
      if (prediction) {
        this.emit('gasPrediction', { chain, prediction });
      }
    }
  }

  private predictNextBlockGas(chain: string): GasPrice {
    const current = this.currentGasPrices.get(chain);
    const history = this.gasHistory.get(chain) || [];
    
    if (!current || history.length < 5) {
      return current || this.getDefaultGasPrice(chain);
    }

    // Simple moving average with trend analysis
    const recentHistory = history.slice(-10);
    const prices = recentHistory.map(h => parseFloat(h.fast));
    
    // Calculate trend
    const trend = this.calculateTrendSlope(prices);
    const movingAverage = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    // Predict next value
    const predictedPrice = movingAverage + (trend * 2); // 2 blocks ahead
    const confidence = this.calculatePredictionConfidence(chain);
    
    return {
      ...current,
      fast: Math.max(1000000000, predictedPrice).toString(), // Minimum 1 gwei
      instant: Math.max(1500000000, predictedPrice * 1.2).toString(),
      timestamp: Date.now() + 12000, // Next block (~12 seconds)
      confidence: confidence,
      source: 'predicted'
    };
  }

  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumX2 = values.reduce((sum, _, i) => sum + (i * i), 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateGasTrend(chain: string): 'increasing' | 'decreasing' | 'stable' {
    const history = this.gasHistory.get(chain) || [];
    if (history.length < 5) return 'stable';

    const recent = history.slice(-5);
    const prices = recent.map(h => parseFloat(h.fast));
    const trend = this.calculateTrendSlope(prices);

    if (Math.abs(trend) < 50000000) return 'stable'; // Less than 0.05 gwei change
    return trend > 0 ? 'increasing' : 'decreasing';
  }

  private calculateOptimalTiming(chain: string): number {
    const prediction = this.getGasPrediction(chain);
    if (!prediction) return 0;

    const current = parseFloat(prediction.currentGas.fast);
    const predicted = parseFloat(prediction.nextBlockPrediction.fast);
    
    // If gas is decreasing, wait for next block
    if (predicted < current * 0.95) {
      return 12000; // Wait for next block
    }
    
    // If gas is increasing rapidly, execute immediately
    if (predicted > current * 1.1) {
      return 0; // Execute now
    }
    
    // Stable gas, no timing advantage
    return 0;
  }

  private calculatePredictionConfidence(chain: string): number {
    const history = this.gasHistory.get(chain) || [];
    if (history.length < 10) return 50;

    // Calculate variance in recent gas prices
    const recent = history.slice(-10);
    const prices = recent.map(h => parseFloat(h.fast));
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower variance = higher confidence
    const coefficientOfVariation = standardDeviation / mean;
    const confidence = Math.max(30, Math.min(95, 100 - (coefficientOfVariation * 200)));
    
    return Math.round(confidence);
  }

  private updateGasPrice(chain: string, gasPrice: GasPrice): void {
    const updateStartTime = Date.now();
    
    try {
      // Update current price
      this.currentGasPrices.set(chain, gasPrice);
      
      // Store in history
      if (!this.gasHistory.has(chain)) {
        this.gasHistory.set(chain, []);
      }
      
      const history = this.gasHistory.get(chain)!;
      history.push(gasPrice);
      
      // Keep only recent history based on performance config
      const maxHistory = this.config.performance.maxHistoryLength;
      if (history.length > maxHistory) {
        history.shift();
      }
      
      // Update block number tracking
      if (gasPrice.blockNumber > (this.blockNumbers.get(chain) || 0)) {
        this.blockNumbers.set(chain, gasPrice.blockNumber);
        this.emit('newBlock', { chain, blockNumber: gasPrice.blockNumber });
      }
      
      // Track performance metrics
      const updateLatency = Date.now() - updateStartTime;
      this.latencyHistory.push(updateLatency);
      if (this.latencyHistory.length > 100) {
        this.latencyHistory.shift(); // Keep last 100 measurements
      }
      
      this.updateCounter++;
      this.metrics.successfulUpdates++;
      this.systemHealth.lastSuccessfulUpdate = Date.now();
      
      // Check latency against target
      if (updateLatency > this.config.performance.maxGasLatency) {
        this.logger.warn('Gas update latency exceeded target', {
          chain,
          latency: updateLatency,
          target: this.config.performance.maxGasLatency
        });
      }
      
      // Emit real-time update
      this.emit('gasUpdate', { chain, gasPrice, latency: updateLatency });
      
    } catch (error) {
      this.handleUpdateError(error, chain);
    }
  }

  /**
   * Handle gas update errors with proper tracking
   */
  private handleUpdateError(error: any, chain: string): void {
    this.errorCount++;
    this.metrics.failedUpdates++;
    
    this.logger.error('Gas price update failed', {
      chain,
      error: error.message,
      stack: error.stack
    });
    
    this.emit('updateError', { chain, error });
  }

  private getDefaultGasPrice(chain: string): GasPrice {
    const defaults: Record<string, Partial<GasPrice>> = {
      ethereum: {
        slow: '1000000000',
        standard: '2000000000',
        fast: '3000000000',
        instant: '5000000000'
      },
      bsc: {
        slow: '3000000000',
        standard: '5000000000',
        fast: '10000000000',
        instant: '20000000000'
      },
      polygon: {
        slow: '30000000000',
        standard: '50000000000',
        fast: '100000000000',
        instant: '200000000000'
      }
    };

    const chainDefaults = defaults[chain] || defaults['ethereum'];
    
    if (!chainDefaults) {
      // Fallback if no defaults found
      return {
        chain,
        slow: '1000000000',
        standard: '2000000000', 
        fast: '3000000000',
        instant: '5000000000',
        timestamp: Date.now(),
        blockNumber: 0,
        confidence: 50,
        source: 'default'
      };
    }
    
    return {
      chain,
      slow: chainDefaults.slow || '1000000000',
      standard: chainDefaults.standard || '2000000000',
      fast: chainDefaults.fast || '3000000000',
      instant: chainDefaults.instant || '5000000000',
      timestamp: Date.now(),
      blockNumber: 0,
      confidence: 50,
      source: 'default'
    };
  }

  // Reconnection Logic
  private scheduleReconnect(source: string, reconnectFn: () => Promise<void>): void {
    const attempts = this.reconnectAttempts.get(source) || 0;
    
    if (attempts >= 5) {
      this.logger.error('Max gas tracker reconnection attempts reached', { source });
      return;
    }

    const delay = 1000 * Math.pow(2, attempts);
    this.reconnectAttempts.set(source, attempts + 1);

    setTimeout(() => {
      this.logger.info('Attempting gas tracker reconnection', { source, attempt: attempts + 1 });
      reconnectFn().catch(error => {
        this.logger.error('Gas tracker reconnection failed', { source, error });
      });
    }, delay);
  }

  // === ENTERPRISE MONITORING METHODS ===

  /**
   * Start health monitoring system
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Health check every 30 seconds
  }

  /**
   * Start metrics collection system
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, 5000); // Update metrics every 5 seconds
  }

  /**
   * Get number of active data sources
   */
  private getActiveDataSources(): number {
    let active = 0;
    if (this.config.dataSources.bloxroute.enabled && this.bloxrouteWs?.readyState === WebSocket.OPEN) active++;
    if (this.config.dataSources.flashbots.enabled && this.flashbotsWs?.readyState === WebSocket.OPEN) active++;
    if (this.config.dataSources.ethgasstation.enabled) active++;
    if (this.config.dataSources.chainlink.enabled) active++;
    return active;
  }

  /**
   * Get total number of configured data sources
   */
  private getTotalDataSources(): number {
    let total = 0;
    if (this.config.dataSources.bloxroute.enabled) total++;
    if (this.config.dataSources.flashbots.enabled) total++;
    if (this.config.dataSources.ethgasstation.enabled) total++;
    if (this.config.dataSources.chainlink.enabled) total++;
    return total;
  }

  /**
   * Get current system health
   */
  getSystemHealth(): GasSystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Get current metrics
   */
  getMetrics(): GasTrackerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current analytics
   */
  getAnalytics(): GasAnalytics {
    return { ...this.analytics };
  }

  /**
   * Export comprehensive system analytics for monitoring
   */
  exportAnalytics(): {
    timestamp: number;
    metrics: GasTrackerMetrics;
    systemHealth: GasSystemHealth;
    analytics: GasAnalytics;
    dataSourceStatus: { [source: string]: boolean };
    chainStatus: { [chain: string]: { 
      lastUpdate: number; 
      gasPrice: GasPrice | null; 
      historyLength: number; 
    }};
    costSummary?: any;
  } {
    const now = Date.now();
    
    // Build data source status
    const dataSourceStatus: { [source: string]: boolean } = {
      bloxroute: this.config.dataSources.bloxroute.enabled && this.bloxrouteWs?.readyState === WebSocket.OPEN,
      flashbots: this.config.dataSources.flashbots.enabled && this.flashbotsWs?.readyState === WebSocket.OPEN,
      ethgasstation: this.config.dataSources.ethgasstation.enabled,
      chainlink: this.config.dataSources.chainlink.enabled
    };
    
    // Build chain status
    const chainStatus: { [chain: string]: { lastUpdate: number; gasPrice: GasPrice | null; historyLength: number } } = {};
    this.currentGasPrices.forEach((gasPrice, chain) => {
      chainStatus[chain] = {
        lastUpdate: gasPrice.timestamp,
        gasPrice,
        historyLength: this.gasHistory.get(chain)?.length || 0
      };
    });
    
    return {
      timestamp: now,
      metrics: this.getMetrics(),
      systemHealth: this.getSystemHealth(),
      analytics: this.getAnalytics(),
      dataSourceStatus,
      chainStatus,
      costSummary: this.costTracker?.getSpendingSummary()
    };
  }

  /**
   * Generate comprehensive system report
   */
  generateSystemReport(): {
    summary: string;
    status: 'healthy' | 'degraded' | 'critical';
    recommendations: string[];
    performance: {
      latencyStatus: string;
      dataSourceAvailability: string;
      predictionAccuracy: string;
    };
  } {
    const health = this.getSystemHealth();
    const metrics = this.getMetrics();
    
    const recommendations: string[] = [];
    
    // Check latency performance
    let latencyStatus = 'optimal';
    if (metrics.averageLatency > this.config.performance.maxGasLatency * 2) {
      latencyStatus = 'poor';
      recommendations.push('Consider optimizing data source connections or increasing timeout values');
    } else if (metrics.averageLatency > this.config.performance.maxGasLatency) {
      latencyStatus = 'acceptable';
      recommendations.push('Monitor latency trends and consider optimization if it continues to increase');
    }
    
    // Check data source availability
    let dataSourceAvailability = 'excellent';
    const availability = health.dataSourcesOnline / health.totalDataSources;
    if (availability < 0.5) {
      dataSourceAvailability = 'poor';
      recommendations.push('Multiple data sources are offline. Check API keys and network connectivity');
    } else if (availability < 0.8) {
      dataSourceAvailability = 'limited';
      recommendations.push('Some data sources are offline. Verify configurations and network status');
    }
    
    // Check prediction accuracy (if enabled)
    let predictionAccuracy = 'not-available';
    if (this.config.prediction.enabled) {
      if (this.analytics.predictionAccuracyRate > 0.8) {
        predictionAccuracy = 'excellent';
      } else if (this.analytics.predictionAccuracyRate > 0.6) {
        predictionAccuracy = 'good';
      } else if (this.analytics.predictionAccuracyRate > 0.4) {
        predictionAccuracy = 'poor';
        recommendations.push('Prediction accuracy is low. Consider tuning prediction parameters');
      } else {
        predictionAccuracy = 'very-poor';
        recommendations.push('Prediction system needs immediate attention. Review historical data and model parameters');
      }
    }
    
    return {
      summary: `Gas tracker status: ${health.status}. ${health.dataSourcesOnline}/${health.totalDataSources} sources online. Average latency: ${metrics.averageLatency.toFixed(2)}ms.`,
      status: health.status,
      recommendations,
      performance: {
        latencyStatus,
        dataSourceAvailability,
        predictionAccuracy
      }
    };
  }

  /**
   * Perform system health check
   */
  private performHealthCheck(): void {
    const now = Date.now();
    
    // Update basic health metrics
    this.systemHealth.dataSourcesOnline = this.getActiveDataSources();
    this.systemHealth.errorRate = this.errorCount / Math.max(this.updateCounter, 1);
    
    // Calculate connection stability based on recent activity
    const timeSinceLastUpdate = now - this.systemHealth.lastSuccessfulUpdate;
    if (timeSinceLastUpdate < 30000) { // Less than 30 seconds
      this.systemHealth.connectionStability = 100;
    } else if (timeSinceLastUpdate < 120000) { // Less than 2 minutes
      this.systemHealth.connectionStability = 75;
    } else if (timeSinceLastUpdate < 300000) { // Less than 5 minutes
      this.systemHealth.connectionStability = 50;
    } else {
      this.systemHealth.connectionStability = 25;
    }
    
    // Update average response time based on recent latency
    if (this.latencyHistory.length > 0) {
      const recentLatencies = this.latencyHistory.slice(-10); // Last 10 measurements
      this.systemHealth.averageResponseTime = recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length;
    }
    
    // Determine system status
    const onlinePercentage = this.systemHealth.dataSourcesOnline / this.systemHealth.totalDataSources;
    if (onlinePercentage >= 0.8 && this.systemHealth.errorRate < 0.1) {
      this.systemHealth.status = 'healthy';
    } else if (onlinePercentage >= 0.5 && this.systemHealth.errorRate < 0.2) {
      this.systemHealth.status = 'degraded';
    } else {
      this.systemHealth.status = 'critical';
    }
    
    // Update memory pressure
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    if (memUsageMB < 100) {
      this.systemHealth.memoryPressure = 'low';
    } else if (memUsageMB < 200) {
      this.systemHealth.memoryPressure = 'medium';
    } else {
      this.systemHealth.memoryPressure = 'high';
    }

    // Log critical health issues
    if (this.systemHealth.status === 'critical') {
      this.logger.error('Gas tracker health is critical', {
        timestamp: now,
        dataSourcesOnline: this.systemHealth.dataSourcesOnline,
        totalDataSources: this.systemHealth.totalDataSources,
        errorRate: this.systemHealth.errorRate,
        connectionStability: this.systemHealth.connectionStability,
        memoryPressure: this.systemHealth.memoryPressure
      });
    }

    this.emit('healthCheck', this.systemHealth);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    
    // Update basic metrics
    this.metrics.uptime = now - this.startTime;
    this.metrics.cacheHitRate = this.cacheHits / Math.max(this.cacheHits + this.cacheMisses, 1);
    this.metrics.errorCount = this.errorCount;
    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    
    // Update latency metrics
    if (this.latencyHistory.length > 0) {
      this.metrics.averageLatency = this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length;
      this.metrics.peakLatency = Math.max(...this.latencyHistory);
      
      // Update latency distribution
      this.latencyHistory.forEach(latency => {
        if (latency < 5) this.metrics.latencyDistribution.under5ms++;
        else if (latency < 10) this.metrics.latencyDistribution.under10ms++;
        else if (latency < 25) this.metrics.latencyDistribution.under25ms++;
        else if (latency < 50) this.metrics.latencyDistribution.under50ms++;
        else this.metrics.latencyDistribution.over50ms++;
      });
    }
    
    // Calculate gas tracking per second
    this.metrics.gasTrackingPerSecond = this.updateCounter / Math.max((now - this.startTime) / 1000, 1);
    
    this.emit('metricsUpdate', this.metrics);
  }

  /**
   * Cleanup all connections
   */
  async destroy(): Promise<void> {
    // Clear all timers
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval as NodeJS.Timeout);
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer as NodeJS.Timeout);
    }
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer as NodeJS.Timeout);
    }

    // Close WebSocket connections
    [this.bloxrouteWs, this.flashbotsWs].forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // Clear data structures
    this.currentGasPrices.clear();
    this.gasHistory.clear();
    this.blockNumbers.clear();
    this.latencyHistory.length = 0;
    
    this.removeAllListeners();
    this.logger.info('Real-time gas tracker destroyed');
  }
} 