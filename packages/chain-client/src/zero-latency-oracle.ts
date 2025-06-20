import { EventEmitter } from 'events';
import WebSocket from 'ws';
import winston from 'winston';

export interface ZeroLatencyConfig {
  // Pyth Network - Ultra low latency (sub-second)
  pyth: {
    endpoint: string; // 'wss://hermes.pyth.network/ws'
    priceIds: Record<string, string>; // token -> pyth price feed ID
    confidence: number;
  };
  
  // Binance WebSocket - High frequency updates
  binance: {
    endpoint: string; // 'wss://stream.binance.com:9443/ws'
    symbols: string[]; // ['ETHUSDT', 'BTCUSDT']
  };
  
  // DexScreener WebSocket - DEX-specific prices
  dexscreener: {
    endpoint: string; // 'wss://io.dexscreener.com/dex/screener'
    pairs: string[];
  };
  
  // Chainlink Price Feeds - On-chain accuracy
  chainlink: {
    feeds: Record<string, string>; // token -> chainlink feed address
    updateThreshold: number; // minimum price change to emit
  };
}

export interface TokenPrice {
  address: string;
  symbol: string;
  priceUsd: number;
  confidence: number;
  timestamp: number;
  source: string;
  deviation?: number;
}

/**
 * Zero-latency price oracle using WebSocket streams
 * Updates: <100ms latency, sub-second price feeds
 */
export class ZeroLatencyOracle extends EventEmitter {
  private logger: winston.Logger;
  private config: ZeroLatencyConfig;
  
  private pythWs?: WebSocket;
  private binanceWs?: WebSocket;
  private dexScreenerWs?: WebSocket;
  
  private latestPrices = new Map<string, TokenPrice>();
  private priceHistories = new Map<string, TokenPrice[]>();
  private subscriptions = new Set<string>();
  
  private reconnectAttempts = new Map<string, number>();
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;

  constructor(config: ZeroLatencyConfig, logger: winston.Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize all WebSocket connections
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.initializePythStream(),
      this.initializeBinanceStream(),
      this.initializeDexScreenerStream()
    ]);
    
    this.logger.info('Zero-latency oracle initialized');
    this.emit('initialized');
  }

  /**
   * Get latest price with confidence scoring
   */
  getPrice(tokenAddress: string): TokenPrice | null {
    return this.latestPrices.get(tokenAddress.toLowerCase()) || null;
  }

  /**
   * Subscribe to real-time price updates for a token
   */
  subscribeToToken(tokenAddress: string, symbol: string): void {
    const key = tokenAddress.toLowerCase();
    this.subscriptions.add(key);
    
    // Subscribe to all relevant streams
    this.subscribePyth(symbol);
    this.subscribeBinance(symbol);
    this.subscribeDexScreener(tokenAddress);
    
    this.logger.debug('Subscribed to token', { tokenAddress, symbol });
  }

  /**
   * Unsubscribe from token updates
   */
  unsubscribeFromToken(tokenAddress: string): void {
    const key = tokenAddress.toLowerCase();
    this.subscriptions.delete(key);
    this.latestPrices.delete(key);
    
    this.logger.debug('Unsubscribed from token', { tokenAddress });
  }

  // Pyth Network Integration (Ultra Low Latency)
  private async initializePythStream(): Promise<void> {
    this.pythWs = new WebSocket(this.config.pyth.endpoint);
    
    this.pythWs.on('open', () => {
      this.logger.info('Pyth WebSocket connected');
      this.resetReconnectAttempts('pyth');
    });

    this.pythWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.processPythMessage(message);
      } catch (error) {
        this.logger.warn('Failed to parse Pyth message', { error });
      }
    });

    this.pythWs.on('close', () => {
      this.logger.warn('Pyth WebSocket disconnected');
      this.scheduleReconnect('pyth', () => this.initializePythStream());
    });

    this.pythWs.on('error', (error) => {
      this.logger.error('Pyth WebSocket error', { error });
    });
  }

  private subscribePyth(symbol: string): void {
    if (!this.pythWs || this.pythWs.readyState !== WebSocket.OPEN) return;
    
    const priceId = this.config.pyth.priceIds[symbol];
    if (!priceId) return;

    const subscription = {
      method: 'subscribe',
      params: {
        type: 'price',
        ids: [priceId]
      }
    };

    this.pythWs.send(JSON.stringify(subscription));
  }

  private processPythMessage(message: any): void {
    if (message.type === 'price_update') {
      const priceData = message.price_feed;
      const price = parseFloat(priceData.price.price) * Math.pow(10, priceData.price.expo);
      const confidence = parseFloat(priceData.price.conf) * Math.pow(10, priceData.price.expo);
      
      // Find token address from price ID mapping
      const symbol = Object.keys(this.config.pyth.priceIds).find(
        key => this.config.pyth.priceIds[key] === priceData.id
      );
      
      if (!symbol) return;

      const tokenPrice: TokenPrice = {
        address: symbol, // Will be mapped to actual address
        symbol,
        priceUsd: price,
        confidence: (price - confidence) / price * 100,
        timestamp: Date.now(),
        source: 'pyth'
      };

      this.updatePrice(symbol, tokenPrice);
    }
  }

  // Binance WebSocket Integration (High Frequency)
  private async initializeBinanceStream(): Promise<void> {
    const symbols = this.config.binance.symbols.map(s => s.toLowerCase()).join('/');
    const wsUrl = `${this.config.binance.endpoint}/${symbols}@ticker`;
    
    this.binanceWs = new WebSocket(wsUrl);

    this.binanceWs.on('open', () => {
      this.logger.info('Binance WebSocket connected');
      this.resetReconnectAttempts('binance');
    });

    this.binanceWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.processBinanceMessage(message);
      } catch (error) {
        this.logger.warn('Failed to parse Binance message', { error });
      }
    });

    this.binanceWs.on('close', () => {
      this.logger.warn('Binance WebSocket disconnected');
      this.scheduleReconnect('binance', () => this.initializeBinanceStream());
    });

    this.binanceWs.on('error', (error) => {
      this.logger.error('Binance WebSocket error', { error });
    });
  }

  private subscribeBinance(symbol: string): void {
    // Binance subscription handled via URL, no additional subscription needed
  }

  private processBinanceMessage(message: any): void {
    if (message.s && message.c) { // symbol and current price
      const symbol = message.s.replace('USDT', '').toLowerCase();
      const price = parseFloat(message.c);
      
      const tokenPrice: TokenPrice = {
        address: symbol,
        symbol,
        priceUsd: price,
        confidence: 99, // Binance is highly reliable
        timestamp: Date.now(),
        source: 'binance'
      };

      this.updatePrice(symbol, tokenPrice);
    }
  }

  // DexScreener WebSocket Integration (DEX-specific)
  private async initializeDexScreenerStream(): Promise<void> {
    this.dexScreenerWs = new WebSocket(this.config.dexscreener.endpoint);

    this.dexScreenerWs.on('open', () => {
      this.logger.info('DexScreener WebSocket connected');
      this.resetReconnectAttempts('dexscreener');
    });

    this.dexScreenerWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.processDexScreenerMessage(message);
      } catch (error) {
        this.logger.warn('Failed to parse DexScreener message', { error });
      }
    });

    this.dexScreenerWs.on('close', () => {
      this.logger.warn('DexScreener WebSocket disconnected');
      this.scheduleReconnect('dexscreener', () => this.initializeDexScreenerStream());
    });

    this.dexScreenerWs.on('error', (error) => {
      this.logger.error('DexScreener WebSocket error', { error });
    });
  }

  private subscribeDexScreener(tokenAddress: string): void {
    if (!this.dexScreenerWs || this.dexScreenerWs.readyState !== WebSocket.OPEN) return;

    const subscription = {
      method: 'subscribe',
      params: {
        type: 'token',
        address: tokenAddress
      }
    };

    this.dexScreenerWs.send(JSON.stringify(subscription));
  }

  private processDexScreenerMessage(message: any): void {
    if (message.type === 'price_update' && message.data) {
      const data = message.data;
      
      const tokenPrice: TokenPrice = {
        address: data.address,
        symbol: data.symbol || 'UNKNOWN',
        priceUsd: parseFloat(data.priceUsd || '0'),
        confidence: 85,
        timestamp: Date.now(),
        source: 'dexscreener'
      };

      this.updatePrice(data.address, tokenPrice);
    }
  }

  /**
   * Update price with confidence scoring across sources
   */
  private updatePrice(identifier: string, newPrice: TokenPrice): void {
    const key = identifier.toLowerCase();
    const existing = this.latestPrices.get(key);
    
    // Confidence-weighted price aggregation
    if (existing && existing.source !== newPrice.source) {
      const weightedPrice = this.calculateWeightedPrice(existing, newPrice);
      this.latestPrices.set(key, weightedPrice);
    } else {
      this.latestPrices.set(key, newPrice);
    }
    
    // Store price history for trend analysis
    this.storePriceHistory(key, newPrice);
    
    // Emit real-time update
    this.emit('priceUpdate', { identifier: key, price: newPrice });
  }

  private calculateWeightedPrice(existing: TokenPrice, newPrice: TokenPrice): TokenPrice {
    const existingWeight = existing.confidence / 100;
    const newWeight = newPrice.confidence / 100;
    const totalWeight = existingWeight + newWeight;
    
    const weightedPriceUsd = (
      (existing.priceUsd * existingWeight) + 
      (newPrice.priceUsd * newWeight)
    ) / totalWeight;
    
    return {
      ...newPrice,
      priceUsd: weightedPriceUsd,
      confidence: Math.min(95, (existing.confidence + newPrice.confidence) / 2),
      source: `${existing.source}+${newPrice.source}`
    };
  }

  private storePriceHistory(key: string, price: TokenPrice): void {
    if (!this.priceHistories.has(key)) {
      this.priceHistories.set(key, []);
    }
    
    const history = this.priceHistories.get(key)!;
    history.push(price);
    
    // Keep only last 100 price points
    if (history.length > 100) {
      history.shift();
    }
  }

  // Reconnection Logic
  private scheduleReconnect(source: string, reconnectFn: () => Promise<void>): void {
    const attempts = this.reconnectAttempts.get(source) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached', { source });
      this.emit('connectionFailed', { source });
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, attempts);
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

  /**
   * Get price trend analysis
   */
  getPriceTrend(tokenAddress: string, timeWindow: number = 60000): {
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
    volatility: number;
  } {
    const key = tokenAddress.toLowerCase();
    const history = this.priceHistories.get(key) || [];
    
    if (history.length < 2) {
      return { trend: 'stable', changePercent: 0, volatility: 0 };
    }

    const cutoff = Date.now() - timeWindow;
    const recentPrices = history.filter(p => p.timestamp >= cutoff);
    
    if (recentPrices.length < 2) {
      return { trend: 'stable', changePercent: 0, volatility: 0 };
    }

    const firstPrice = recentPrices[0].priceUsd;
    const lastPrice = recentPrices[recentPrices.length - 1].priceUsd;
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Calculate volatility (standard deviation)
    const prices = recentPrices.map(p => p.priceUsd);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / mean * 100;

    const trend = Math.abs(changePercent) < 0.1 ? 'stable' : 
                 changePercent > 0 ? 'up' : 'down';

    return { trend, changePercent, volatility };
  }

  /**
   * Cleanup all connections
   */
  async destroy(): Promise<void> {
    [this.pythWs, this.binanceWs, this.dexScreenerWs].forEach(ws => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    this.latestPrices.clear();
    this.priceHistories.clear();
    this.subscriptions.clear();
    
    this.removeAllListeners();
    this.logger.info('Zero-latency oracle destroyed');
  }
} 