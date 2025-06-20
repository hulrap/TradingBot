import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { MempoolMonitor, type MempoolConfig, type PendingTransaction } from '@trading-bot/chain-client';

export interface ArbitrageOpportunity {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  buyExchange: {
    name: string;
    price: number;
    liquidity: string;
    router: string;
  };
  sellExchange: {
    name: string;
    price: number;
    liquidity: string;
    router: string;
  };
  profitPercent: number;
  profitUsd: number;
  requiredCapital: string;
  maxTradeSize: string;
  timeWindow: number; // milliseconds
  gasEstimate: string;
  slippage: {
    buy: number;
    sell: number;
  };
  confidence: number; // 0-1
  chain: string;
  timestamp: number;
}

export interface ExchangeData {
  name: string;
  router: string;
  factory: string;
  fee: number; // basis points
  isActive: boolean;
}

export interface PriceData {
  exchange: string;
  price: number;
  liquidity: string;
  volume24h: string;
  timestamp: number;
  blockNumber?: number;
}

export interface ArbitrageConfig {
  minProfitPercent: number;
  maxSlippage: number;
  minLiquidity: string;
  maxGasPrice: string;
  enabledExchanges: string[];
  enabledChains: string[];
  scanInterval: number;
  confidenceThreshold: number;
}

/**
 * Arbitrage Opportunity Detector
 * Uses shared MempoolMonitor and implements arbitrage-specific detection
 */
export class ArbitrageDetector extends EventEmitter {
  private config: ArbitrageConfig;
  private mempoolMonitor: MempoolMonitor;
  private providers = new Map<string, ethers.Provider>();
  
  private isScanning = false;
  private priceCache = new Map<string, Map<string, PriceData>>(); // token -> exchange -> price
  private scanTimer?: NodeJS.Timeout;
  
  // Exchange configurations
  private exchanges = new Map<string, ExchangeData>();
  
  constructor(config: ArbitrageConfig) {
    super();
    this.config = config;
    
    // Initialize exchanges
    this.initializeExchanges();
    
    // Create mempool monitor with arbitrage-specific config
    const mempoolConfig: MempoolConfig = {
      enableRealtimeSubscription: true,
      subscriptionFilters: {
        minTradeValue: '1000', // $1k minimum for arbitrage
        maxGasPrice: config.maxGasPrice,
        whitelistedDexes: config.enabledExchanges,
        blacklistedTokens: []
      },
      batchSize: 5,
      processingDelayMs: 100, // Fast processing for arbitrage
      heartbeatIntervalMs: 30000,
      reconnectDelayMs: 5000,
      maxReconnectAttempts: 5
    };
    
    this.mempoolMonitor = new MempoolMonitor(mempoolConfig);
    this.setupMempoolEvents();
  }

  /**
   * Initialize supported exchanges
   */
  private initializeExchanges(): void {
    const exchangeConfigs: ExchangeData[] = [
      {
        name: 'uniswap-v2',
        router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
        fee: 300, // 0.3%
        isActive: true
      },
      {
        name: 'uniswap-v3',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        fee: 300, // Variable, using 0.3% as default
        isActive: true
      },
      {
        name: 'sushiswap',
        router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
        fee: 300,
        isActive: true
      },
      {
        name: 'pancakeswap',
        router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
        fee: 250, // 0.25%
        isActive: true
      }
    ];

    for (const exchange of exchangeConfigs) {
      if (this.config.enabledExchanges.includes(exchange.name)) {
        this.exchanges.set(exchange.name, exchange);
      }
    }
  }

  /**
   * Setup mempool monitor events
   */
  private setupMempoolEvents(): void {
    this.mempoolMonitor.on('transactionBatch', ({ chain, transactions }: { chain: string; transactions: PendingTransaction[] }) => {
      this.processTransactionBatch(transactions, chain);
    });

    this.mempoolMonitor.on('error', (error: any) => {
      console.error('Mempool monitor error:', error);
      this.emit('error', error);
    });

    this.mempoolMonitor.on('heartbeatMissed', (chain: string) => {
      console.warn(`Mempool heartbeat missed for ${chain}`);
      this.emit('warning', `Mempool connection issue: ${chain}`);
    });
  }

  /**
   * Initialize providers and start detection
   */
  async initialize(providers: {
    ethereum?: ethers.Provider;
    bsc?: ethers.Provider;
  }): Promise<void> {
    try {
      // Store providers
      if (providers.ethereum) {
        this.providers.set('ethereum', providers.ethereum);
      }
      if (providers.bsc) {
        this.providers.set('bsc', providers.bsc);
      }

      // Initialize mempool monitor
      await this.mempoolMonitor.initialize(providers);

      console.log('Arbitrage detector initialized');
      this.emit('initialized');

    } catch (error) {
      console.error('Failed to initialize arbitrage detector:', error);
      throw error;
    }
  }

  /**
   * Start arbitrage opportunity detection
   */
  async startDetection(): Promise<void> {
    try {
      this.isScanning = true;

      // Start mempool monitoring
      await this.mempoolMonitor.startMonitoring();

      // Start periodic price scanning
      this.startPriceScanning();

      console.log('Arbitrage detection started');
      this.emit('detectionStarted');

    } catch (error) {
      console.error('Failed to start arbitrage detection:', error);
      throw error;
    }
  }

  /**
   * Start periodic price scanning
   */
  private startPriceScanning(): void {
    this.scanTimer = setInterval(async () => {
      await this.scanForOpportunities();
    }, this.config.scanInterval);

    // Run initial scan
    this.scanForOpportunities();
  }

  /**
   * Scan for arbitrage opportunities across exchanges
   */
  private async scanForOpportunities(): Promise<void> {
    if (!this.isScanning) return;

    try {
      // Get popular token addresses to scan (simplified - in production would use a token list)
      const tokensToScan = [
        '0xA0b86a33E6409c15CdCB4D7d0c33F81e1C1b8b4F', // Example token 1
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0xA0b86a33E6409c15CdCB4D7d0c33F81e1C1b8b4F'  // Example token 2
      ];

      for (const tokenAddress of tokensToScan) {
        await this.scanTokenAcrossExchanges(tokenAddress);
      }

    } catch (error) {
      console.warn('Error during opportunity scanning:', error);
    }
  }

  /**
   * Scan a specific token across all exchanges
   */
  private async scanTokenAcrossExchanges(tokenAddress: string): Promise<void> {
    try {
      const prices: PriceData[] = [];

      // Fetch prices from all exchanges
      for (const [exchangeName, exchange] of this.exchanges) {
        if (!exchange.isActive) continue;

        for (const [chain, provider] of this.providers) {
          try {
            const priceData = await this.fetchTokenPrice(
              tokenAddress,
              exchangeName,
              chain,
              provider
            );
            
            if (priceData) {
              prices.push(priceData);
            }
          } catch (error) {
            console.warn(`Failed to fetch price for ${tokenAddress} on ${exchangeName}:`, error);
          }
        }
      }

      // Find arbitrage opportunities
      if (prices.length >= 2) {
        const opportunities = this.findArbitrageOpportunities(tokenAddress, prices);
        
        for (const opportunity of opportunities) {
          if (this.isValidOpportunity(opportunity)) {
            this.emit('opportunityFound', opportunity);
          }
        }
      }

    } catch (error) {
      console.warn(`Error scanning token ${tokenAddress}:`, error);
    }
  }

  /**
   * Fetch token price from a specific exchange
   */
  private async fetchTokenPrice(
    tokenAddress: string,
    exchangeName: string,
    chain: string,
    provider: ethers.Provider
  ): Promise<PriceData | null> {
    try {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) return null;

      // Get pair address (simplified - would use proper pair detection)
      const wethAddress = chain === 'ethereum' 
        ? '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' 
        : '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // WBNB

      // Create pair contract
      const pairABI = [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)'
      ];

      // Get pair address (simplified - would calculate using factory)
      const pairAddress = await this.getPairAddress(tokenAddress, wethAddress, exchange.factory, provider);
      if (!pairAddress) return null;

      const pairContract = new ethers.Contract(pairAddress, pairABI, provider);
      
      const getReservesMethod = pairContract['getReserves'];
      const token0Method = pairContract['token0'];
      
      if (!getReservesMethod || !token0Method) {
        throw new Error('Pair contract does not support required methods');
      }
      
      const [reserves, token0] = await Promise.all([
        getReservesMethod.call(pairContract),
        token0Method.call(pairContract)
      ]);

      // Calculate price
      const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
      const tokenReserve = isToken0 ? reserves.reserve0 : reserves.reserve1;
      const wethReserve = isToken0 ? reserves.reserve1 : reserves.reserve0;
      
      const price = Number(wethReserve) / Number(tokenReserve);
      
      return {
        exchange: exchangeName,
        price,
        liquidity: (Number(tokenReserve) + Number(wethReserve)).toString(),
        volume24h: '0', // Would fetch from subgraph or API
        timestamp: Date.now(),
        blockNumber: await provider.getBlockNumber()
      };

    } catch (error) {
      console.warn(`Failed to fetch price for ${tokenAddress} on ${exchangeName}:`, error);
      return null;
    }
  }

  /**
   * Get pair address for two tokens
   */
  private async getPairAddress(
    tokenA: string,
    tokenB: string,
    factoryAddress: string,
    provider: ethers.Provider
  ): Promise<string | null> {
    try {
      const factoryABI = [
        'function getPair(address tokenA, address tokenB) external view returns (address pair)'
      ];

      const factory = new ethers.Contract(factoryAddress, factoryABI, provider);
      const getPairMethod = factory['getPair'];
      
      if (!getPairMethod) {
        throw new Error('Factory does not support getPair');
      }
      
      const pairAddress = await getPairMethod.call(factory, tokenA, tokenB);
      
      return pairAddress === ethers.ZeroAddress ? null : pairAddress;

    } catch (error) {
      return null;
    }
  }

  /**
   * Find arbitrage opportunities from price data
   */
  private findArbitrageOpportunities(
    tokenAddress: string,
    prices: PriceData[]
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    // Sort prices to find best buy and sell opportunities
    const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
    
    for (let i = 0; i < sortedPrices.length - 1; i++) {
      const buyPrice = sortedPrices[i];
      if (!buyPrice) continue;
      
      for (let j = i + 1; j < sortedPrices.length; j++) {
        const sellPrice = sortedPrices[j];
        if (!sellPrice) continue;
        
        const profitPercent = ((sellPrice.price - buyPrice.price) / buyPrice.price) * 100;
        
        if (profitPercent > this.config.minProfitPercent) {
          const opportunity: ArbitrageOpportunity = {
            id: `arb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tokenAddress,
            tokenSymbol: 'TOKEN', // Would fetch from contract
            buyExchange: {
              name: buyPrice.exchange,
              price: buyPrice.price,
              liquidity: buyPrice.liquidity,
              router: this.exchanges.get(buyPrice.exchange)?.router || ''
            },
            sellExchange: {
              name: sellPrice.exchange,
              price: sellPrice.price,
              liquidity: sellPrice.liquidity,
              router: this.exchanges.get(sellPrice.exchange)?.router || ''
            },
            profitPercent,
            profitUsd: 0, // Would calculate based on trade size
            requiredCapital: '1000', // Would calculate optimal size
            maxTradeSize: Math.min(
              parseFloat(buyPrice.liquidity),
              parseFloat(sellPrice.liquidity)
            ).toString(),
            timeWindow: 30000, // 30 seconds
            gasEstimate: '150000', // Would estimate properly
            slippage: {
              buy: 0.5, // Would calculate based on liquidity
              sell: 0.5
            },
            confidence: this.calculateConfidence(buyPrice, sellPrice),
            chain: 'ethereum', // Would determine from exchange
            timestamp: Date.now()
          };

          opportunities.push(opportunity);
        }
      }
    }

    return opportunities;
  }

  /**
   * Calculate confidence score for an opportunity
   */
  private calculateConfidence(buyPrice: PriceData, sellPrice: PriceData): number {
    let confidence = 1.0;

    // Age of price data
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    const buyAge = now - buyPrice.timestamp;
    const sellAge = now - sellPrice.timestamp;
    
    if (buyAge > maxAge || sellAge > maxAge) {
      confidence *= 0.7;
    }

    // Liquidity levels
    const minLiquidity = parseFloat(this.config.minLiquidity);
    const buyLiquidity = parseFloat(buyPrice.liquidity);
    const sellLiquidity = parseFloat(sellPrice.liquidity);
    
    if (buyLiquidity < minLiquidity || sellLiquidity < minLiquidity) {
      confidence *= 0.6;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Validate if opportunity meets criteria
   */
  private isValidOpportunity(opportunity: ArbitrageOpportunity): boolean {
    return (
      opportunity.profitPercent >= this.config.minProfitPercent &&
      opportunity.confidence >= this.config.confidenceThreshold &&
      opportunity.slippage.buy <= this.config.maxSlippage &&
      opportunity.slippage.sell <= this.config.maxSlippage
    );
  }

  /**
   * Process transaction batch from mempool monitor
   */
  private processTransactionBatch(transactions: PendingTransaction[], _chain: string): void {
    // Check if any transactions might affect our arbitrage opportunities
    for (const tx of transactions) {
      if (this.isRelevantTransaction(tx)) {
        // Re-scan affected tokens quickly
        this.handleRelevantTransaction(tx);
      }
    }
  }

  /**
   * Check if transaction is relevant to arbitrage detection
   */
  private isRelevantTransaction(tx: PendingTransaction): boolean {
    // Check if transaction is to one of our monitored exchanges
    for (const exchange of this.exchanges.values()) {
      if (tx.to?.toLowerCase() === exchange.router.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Handle relevant transaction
   */
  private async handleRelevantTransaction(tx: PendingTransaction): Promise<void> {
    // Extract token addresses from transaction data and trigger quick re-scan
    // This would parse the transaction data to identify affected tokens
    console.log(`Processing relevant transaction: ${tx.hash}`);
    
    // Trigger immediate opportunity scan for affected tokens
    // In production, would parse transaction to extract token addresses
    this.emit('relevantTransaction', tx);
  }

  /**
   * Stop arbitrage detection
   */
  async stopDetection(): Promise<void> {
    try {
      this.isScanning = false;

      if (this.scanTimer) {
        clearInterval(this.scanTimer);
      }

      await this.mempoolMonitor.stopMonitoring();

      console.log('Arbitrage detection stopped');
      this.emit('detectionStopped');

    } catch (error) {
      console.error('Error stopping arbitrage detection:', error);
      throw error;
    }
  }

  /**
   * Get detection statistics
   */
  getStats(): {
    isScanning: boolean;
    mempoolStats: any;
    priceDataEntries: number;
    supportedExchanges: string[];
  } {
    return {
      isScanning: this.isScanning,
      mempoolStats: this.mempoolMonitor.getStats(),
      priceDataEntries: this.priceCache.size,
      supportedExchanges: Array.from(this.exchanges.keys())
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ArbitrageConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }
} 