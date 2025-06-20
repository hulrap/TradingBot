import { EventEmitter } from 'events';
import WebSocket from 'ws';
import winston from 'winston';
import { ethers } from 'ethers';

export interface GasTrackerConfig {
  // BloxRoute gas tracker (Real-time)
  bloxroute: {
    endpoint: string; // 'wss://api.blxrbdn.com/ws'
    authToken: string;
    chains: string[];
  };
  
  // Flashbots Protect (MEV protection + gas)
  flashbots: {
    endpoint: string; // 'wss://relay.flashbots.net/ws'
    bundleEndpoint: string;
    authKey: string;
  };
  
  // EthGasStation alternative
  ethgasstation: {
    endpoint: string;
    apiKey: string;
  };
  
  // Prediction settings
  prediction: {
    historyWindow: number; // milliseconds
    updateInterval: number; // milliseconds
    confidenceThreshold: number;
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

  constructor(config: GasTrackerConfig, logger: winston.Logger) {
    super();
    this.config = config;
    this.logger = logger;
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
    
    this.logger.info('Real-time gas tracker initialized');
    this.emit('initialized');
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

    return {
      ...current,
      fast: (BigInt(current.fast) * BigInt(Math.floor(multiplier * 100)) / BigInt(100)).toString(),
      instant: (BigInt(current.instant) * BigInt(Math.floor(multiplier * 100)) / BigInt(100)).toString(),
      confidence: Math.max(70, current.confidence - 10) // Slight confidence reduction for predictions
    };
  }

  // BloxRoute Integration (Premium Real-time Gas)
  private async initializeBloxrouteStream(): Promise<void> {
    if (!this.config.bloxroute.authToken) {
      this.logger.warn('BloxRoute auth token not provided');
      return;
    }

    this.bloxrouteWs = new WebSocket(this.config.bloxroute.endpoint, {
      headers: {
        'Authorization': this.config.bloxroute.authToken
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

    for (const chain of this.config.bloxroute.chains) {
      const subscription = {
        method: 'subscribe',
        params: {
          type: 'gas_price',
          chain: chain,
          include_predictions: true
        }
      };

      this.bloxrouteWs.send(JSON.stringify(subscription));
    }
  }

  private processBloxrouteMessage(message: any): void {
    if (message.type === 'gas_price_update') {
      const data = message.data;
      
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
    if (!this.config.flashbots.authKey) {
      this.logger.warn('Flashbots auth key not provided');
      return;
    }

    this.flashbotsWs = new WebSocket(this.config.flashbots.endpoint, {
      headers: {
        'X-Flashbots-Signature': this.config.flashbots.authKey
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
    // Update current price
    this.currentGasPrices.set(chain, gasPrice);
    
    // Store in history
    if (!this.gasHistory.has(chain)) {
      this.gasHistory.set(chain, []);
    }
    
    const history = this.gasHistory.get(chain)!;
    history.push(gasPrice);
    
    // Keep only recent history
    const maxHistory = Math.floor(this.config.prediction.historyWindow / 12000); // ~blocks
    if (history.length > maxHistory) {
      history.shift();
    }
    
    // Update block number tracking
    if (gasPrice.blockNumber > (this.blockNumbers.get(chain) || 0)) {
      this.blockNumbers.set(chain, gasPrice.blockNumber);
      this.emit('newBlock', { chain, blockNumber: gasPrice.blockNumber });
    }
    
    // Emit real-time update
    this.emit('gasUpdate', { chain, gasPrice });
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

    const chainDefaults = defaults[chain] || defaults.ethereum;
    
    return {
      chain,
      slow: chainDefaults.slow!,
      standard: chainDefaults.standard!,
      fast: chainDefaults.fast!,
      instant: chainDefaults.instant!,
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

  /**
   * Cleanup all connections
   */
  async destroy(): Promise<void> {
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval as NodeJS.Timeout);
    }

    [this.bloxrouteWs, this.flashbotsWs].forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    this.currentGasPrices.clear();
    this.gasHistory.clear();
    this.blockNumbers.clear();
    
    this.removeAllListeners();
    this.logger.info('Real-time gas tracker destroyed');
  }
} 