import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

// Supported price sources
type PriceSource = 'chainlink' | 'coingecko' | 'binance' | 'uniswap' | 'jupiter' | 'cache';

// Price data structure
interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
  source: PriceSource;
  confidence: number; // 0-1 score
}

// Price feed configuration
interface PriceFeedConfig {
  sources: PriceSource[];
  cacheMaxAge: number; // milliseconds
  timeout: number;
  retries: number;
  fallbackToCache: boolean;
}

// Token mapping for different chains
interface TokenMapping {
  ethereum: { [symbol: string]: string };
  bsc: { [symbol: string]: string };
  polygon: { [symbol: string]: string };
  arbitrum: { [symbol: string]: string };
  optimism: { [symbol: string]: string };
  solana: { [symbol: string]: string };
}

// Default configuration
const DEFAULT_CONFIG: PriceFeedConfig = {
  sources: ['chainlink', 'coingecko', 'binance'],
  cacheMaxAge: 30000, // 30 seconds
  timeout: 5000,
  retries: 3,
  fallbackToCache: true
};

// Common token mappings
const TOKEN_MAPPINGS: TokenMapping = {
  ethereum: {
    'ETH': '0x0000000000000000000000000000000000000000',
    'WETH': '0xC02aaA39b223FE8dD0e5B4F27eAD9083C756Cc2',
    'USDC': '0xA0b86a33E6441e95e19D4d7DFbe73ae1BB5C9FF8',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  bsc: {
    'BNB': '0x0000000000000000000000000000000000000000',
    'WBNB': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    'BUSD': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    'USDT': '0x55d398326f99059fF775485246999027B3197955'
  },
  polygon: {
    'MATIC': '0x0000000000000000000000000000000000000000',
    'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
  },
  arbitrum: {
    'ETH': '0x0000000000000000000000000000000000000000',
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    'USDC': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
  },
  optimism: {
    'ETH': '0x0000000000000000000000000000000000000000',
    'WETH': '0x4200000000000000000000000000000000000006',
    'USDC': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    'USDT': '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'
  },
  solana: {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  }
};

/**
 * Comprehensive price oracle service with multiple data sources
 */
export class PriceOracle extends EventEmitter {
  private cache = new Map<string, PriceData>();
  private config: PriceFeedConfig;
  private httpClient: AxiosInstance;
  private isInitialized = false;

  constructor(config: Partial<PriceFeedConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.httpClient = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': 'TradingBot-PriceOracle/1.0',
        'Accept': 'application/json'
      }
    });

    this.setupAxiosInterceptors();
  }

  /**
   * Initialize the price oracle
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test connectivity to price sources
      await this.testConnectivity();
      
      // Start periodic cache cleanup
      this.startCacheCleanup();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      console.log('Price Oracle initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Price Oracle:', error);
      throw error;
    }
  }

  /**
   * Get current price for a token
   */
  async getPrice(symbol: string, chain: keyof TokenMapping = 'ethereum'): Promise<PriceData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const cacheKey = `${symbol.toLowerCase()}_${chain}`;
    
    // Check cache first
    const cachedPrice = this.cache.get(cacheKey);
    if (cachedPrice && this.isCacheValid(cachedPrice)) {
      return cachedPrice;
    }

    try {
      // Fetch from multiple sources in parallel
      const pricePromises = this.config.sources.map(source => 
        this.fetchPriceFromSource(symbol, chain, source)
      );

      const results = await Promise.allSettled(pricePromises);
      const validPrices = results
        .filter((result): result is PromiseFulfilledResult<PriceData> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      if (validPrices.length === 0) {
        if (this.config.fallbackToCache && cachedPrice) {
          console.warn(`No fresh price data for ${symbol}, using cached data`);
          return cachedPrice;
        }
        throw new Error(`No price data available for ${symbol} on ${chain}`);
      }

      // Use consensus price (median of valid prices)
      const consensusPrice = this.calculateConsensusPrice(validPrices);
      
      // Cache the result
      this.cache.set(cacheKey, consensusPrice);
      
      this.emit('priceUpdated', consensusPrice);
      
      return consensusPrice;
    } catch (error) {
      if (this.config.fallbackToCache && cachedPrice) {
        console.warn(`Error fetching price for ${symbol}, using cached data:`, error);
        return cachedPrice;
      }
      throw error;
    }
  }

  /**
   * Get multiple prices in batch
   */
  async getPrices(symbols: string[], chain: keyof TokenMapping = 'ethereum'): Promise<{ [symbol: string]: PriceData }> {
    const pricePromises = symbols.map(async symbol => {
      try {
        const price = await this.getPrice(symbol, chain);
        return { symbol, price };
      } catch (error) {
        console.error(`Failed to get price for ${symbol}:`, error);
        return { symbol, price: null };
      }
    });

    const results = await Promise.allSettled(pricePromises);
    const prices: { [symbol: string]: PriceData } = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.price) {
        prices[symbols[index]] = result.value.price;
      }
    });

    return prices;
  }

  /**
   * Fetch price from specific source
   */
  private async fetchPriceFromSource(
    symbol: string, 
    chain: keyof TokenMapping, 
    source: PriceSource
  ): Promise<PriceData | null> {
    try {
      switch (source) {
        case 'coingecko':
          return await this.fetchFromCoinGecko(symbol);
        case 'binance':
          return await this.fetchFromBinance(symbol);
        case 'chainlink':
          return await this.fetchFromChainlink(symbol, chain);
        case 'uniswap':
          return await this.fetchFromUniswap(symbol, chain);
        case 'jupiter':
          return await this.fetchFromJupiter(symbol);
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error fetching price from ${source}:`, error);
      return null;
    }
  }

  /**
   * Fetch price from CoinGecko API
   */
  private async fetchFromCoinGecko(symbol: string): Promise<PriceData | null> {
    try {
      const coinGeckoIds: { [symbol: string]: string } = {
        'ETH': 'ethereum',
        'BTC': 'bitcoin',
        'WBTC': 'wrapped-bitcoin',
        'USDC': 'usd-coin',
        'USDT': 'tether',
        'DAI': 'dai',
        'BNB': 'binancecoin',
        'MATIC': 'matic-network',
        'SOL': 'solana'
      };

      const coinId = coinGeckoIds[symbol.toUpperCase()];
      if (!coinId) return null;

      const response = await this.httpClient.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_last_updated_at=true`
      );

      const data = response.data[coinId];
      if (!data) return null;

      return {
        symbol: symbol.toUpperCase(),
        price: data.usd,
        timestamp: Date.now(),
        source: 'coingecko',
        confidence: 0.9
      };
    } catch (error) {
      console.error('CoinGecko API error:', error);
      return null;
    }
  }

  /**
   * Fetch price from Binance API
   */
  private async fetchFromBinance(symbol: string): Promise<PriceData | null> {
    try {
      const binanceSymbol = `${symbol.toUpperCase()}USDT`;
      
      const response = await this.httpClient.get(
        `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`
      );

      if (!response.data || !response.data.price) return null;

      return {
        symbol: symbol.toUpperCase(),
        price: parseFloat(response.data.price),
        timestamp: Date.now(),
        source: 'binance',
        confidence: 0.95
      };
    } catch (error) {
      // Binance might not have all trading pairs
      return null;
    }
  }

  /**
   * Fetch price from Chainlink (simulation - would need actual oracle contracts)
   */
  private async fetchFromChainlink(symbol: string, chain: keyof TokenMapping): Promise<PriceData | null> {
    // This would integrate with actual Chainlink price feeds
    // For now, return null to indicate not available
    return null;
  }

  /**
   * Fetch price from Uniswap (simulation)
   */
  private async fetchFromUniswap(symbol: string, chain: keyof TokenMapping): Promise<PriceData | null> {
    // This would integrate with Uniswap V3 TWAP oracles
    // For now, return null to indicate not available
    return null;
  }

  /**
   * Fetch price from Jupiter (Solana)
   */
  private async fetchFromJupiter(symbol: string): Promise<PriceData | null> {
    try {
      const tokenMint = TOKEN_MAPPINGS.solana[symbol.toUpperCase()];
      if (!tokenMint) return null;

      const response = await this.httpClient.get(
        `https://price.jup.ag/v4/price?ids=${tokenMint}`
      );

      const data = response.data.data[tokenMint];
      if (!data) return null;

      return {
        symbol: symbol.toUpperCase(),
        price: data.price,
        timestamp: Date.now(),
        source: 'jupiter',
        confidence: 0.85
      };
    } catch (error) {
      console.error('Jupiter API error:', error);
      return null;
    }
  }

  /**
   * Calculate consensus price from multiple sources
   */
  private calculateConsensusPrice(prices: PriceData[]): PriceData {
    if (prices.length === 1) {
      return prices[0];
    }

    // Sort prices by value
    const sortedPrices = prices.sort((a, b) => a.price - b.price);
    
    // Use median price
    const medianIndex = Math.floor(sortedPrices.length / 2);
    const medianPrice = sortedPrices.length % 2 === 0
      ? (sortedPrices[medianIndex - 1].price + sortedPrices[medianIndex].price) / 2
      : sortedPrices[medianIndex].price;

    // Calculate weighted confidence
    const totalConfidence = prices.reduce((sum, p) => sum + p.confidence, 0);
    const avgConfidence = totalConfidence / prices.length;

    // Find the source with highest confidence for the median price
    const bestSource = prices.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      symbol: prices[0].symbol,
      price: medianPrice,
      timestamp: Date.now(),
      source: bestSource.source,
      confidence: Math.min(avgConfidence, 0.98) // Cap confidence
    };
  }

  /**
   * Check if cached price is still valid
   */
  private isCacheValid(priceData: PriceData): boolean {
    return Date.now() - priceData.timestamp < this.config.cacheMaxAge;
  }

  /**
   * Setup axios interceptors for retry logic
   */
  private setupAxiosInterceptors(): void {
    this.httpClient.interceptors.response.use(
      response => response,
      async error => {
        const config = error.config;
        
        if (!config || config.__retryCount >= this.config.retries) {
          return Promise.reject(error);
        }

        config.__retryCount = (config.__retryCount || 0) + 1;
        
        // Exponential backoff
        const delay = Math.pow(2, config.__retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.httpClient(config);
      }
    );
  }

  /**
   * Test connectivity to price sources
   */
  private async testConnectivity(): Promise<void> {
    try {
      // Test CoinGecko
      await this.httpClient.get('https://api.coingecko.com/api/v3/ping');
      
      // Test Binance
      await this.httpClient.get('https://api.binance.com/api/v3/ping');
      
      console.log('Price source connectivity test passed');
    } catch (error) {
      console.warn('Some price sources may be unavailable:', error);
    }
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, priceData] of this.cache.entries()) {
        if (now - priceData.timestamp > this.config.cacheMaxAge * 2) {
          this.cache.delete(key);
        }
      }
    }, this.config.cacheMaxAge);
  }

  /**
   * Get cached prices for debugging
   */
  getCachedPrices(): { [key: string]: PriceData } {
    const cached: { [key: string]: PriceData } = {};
    for (const [key, value] of this.cache.entries()) {
      cached[key] = value;
    }
    return cached;
  }

  /**
   * Clear all cached prices
   */
  clearCache(): void {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get oracle health status
   */
  getHealthStatus(): {
    isInitialized: boolean;
    cacheSize: number;
    configuredSources: PriceSource[];
    lastActivity: number;
  } {
    return {
      isInitialized: this.isInitialized,
      cacheSize: this.cache.size,
      configuredSources: this.config.sources,
      lastActivity: Date.now()
    };
  }
}

// Export singleton instance
export const priceOracle = new PriceOracle();

// Helper function for easy price retrieval
export async function getTokenPrice(
  symbol: string, 
  chain: keyof TokenMapping = 'ethereum'
): Promise<number> {
  const priceData = await priceOracle.getPrice(symbol, chain);
  return priceData.price;
}

// Helper function for safe price conversion
export async function convertToUSD(
  amount: string | number, 
  fromSymbol: string, 
  chain: keyof TokenMapping = 'ethereum'
): Promise<number> {
  const price = await getTokenPrice(fromSymbol, chain);
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  return amountNum * price;
}

export type { PriceData, PriceSource, PriceFeedConfig, TokenMapping };