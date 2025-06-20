import { EventEmitter } from 'events';
import winston from 'winston';
import axios from 'axios';
import NodeCache from 'node-cache';

export interface PriceSource {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  rateLimit: number; // requests per minute
  timeout: number;
  supportedChains: string[];
  apiKey?: string;
  baseUrl: string;
}

export interface TokenPrice {
  address: string;
  symbol: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: number;
  source: string;
  confidence: number; // 0-100
}

export interface PriceOracleConfig {
  sources: PriceSource[];
  cacheTimeout: number; // seconds
  maxRetries: number;
  retryDelay: number;
  enableBackupSources: boolean;
  priceDeviationThreshold: number; // percentage
}

export interface PriceComparisonResult {
  prices: TokenPrice[];
  averagePrice: number;
  deviation: number;
  confidence: number;
  recommendedPrice: number;
}

/**
 * Multi-source price oracle system that aggregates token prices from various sources
 * with intelligent caching, rate limiting, and confidence scoring.
 * 
 * Features:
 * - Multiple redundant price sources (CoinGecko, DexScreener, Jupiter, etc.)
 * - Intelligent caching with TTL to reduce API calls
 * - Rate limiting to prevent API quota violations
 * - Cross-source price validation and confidence scoring
 * - Automatic source health monitoring
 * - Graceful fallback mechanisms
 * 
 * @example
 * ```typescript
 * const oracle = new PriceOracle(config, logger);
 * const price = await oracle.getTokenPrice('0x...', 'ethereum');
 * const comparison = await oracle.comparePricesAcrossSources('0x...', 'ethereum');
 * ```
 */
export class PriceOracle extends EventEmitter {
  private logger: winston.Logger;
  private config: PriceOracleConfig;
  private priceCache: NodeCache;
  private sources: Map<string, PriceSource> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    averageResponseTime: 0
  };

  /**
   * Creates a new PriceOracle instance with the specified configuration.
   * Automatically sets up price sources, caching, and health monitoring.
   * 
   * @param config - Configuration object containing source settings, cache timeout, etc.
   * @param logger - Winston logger instance for logging operations
   */
  constructor(config: PriceOracleConfig, logger: winston.Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.priceCache = new NodeCache({ 
      stdTTL: config.cacheTimeout,
      checkperiod: config.cacheTimeout * 0.2 
    });
    
    this.setupPriceSources();
    this.startHealthChecks();
  }

  private setupPriceSources(): void {
    // CoinGecko - Primary source
    this.addPriceSource({
      id: 'coingecko',
      name: 'CoinGecko',
      priority: 1,
      isActive: true,
      rateLimit: 50, // 50 requests per minute for free tier
      timeout: 10000,
      supportedChains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana'],
      apiKey: process.env.COINGECKO_API_KEY,
      baseUrl: 'https://api.coingecko.com/api/v3'
    });

    // CoinMarketCap - Secondary source
    this.addPriceSource({
      id: 'coinmarketcap',
      name: 'CoinMarketCap',
      priority: 2,
      isActive: !!process.env.COINMARKETCAP_API_KEY,
      rateLimit: 200, // 200 requests per month for free tier
      timeout: 10000,
      supportedChains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism'],
      apiKey: process.env.COINMARKETCAP_API_KEY,
      baseUrl: 'https://pro-api.coinmarketcap.com/v1'
    });

    // DexScreener - DEX-specific prices
    this.addPriceSource({
      id: 'dexscreener',
      name: 'DexScreener',
      priority: 3,
      isActive: true,
      rateLimit: 300, // 300 requests per minute
      timeout: 8000,
      supportedChains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana'],
      baseUrl: 'https://api.dexscreener.com/latest'
    });

    // Jupiter API for Solana
    this.addPriceSource({
      id: 'jupiter',
      name: 'Jupiter',
      priority: 4,
      isActive: true,
      rateLimit: 600, // 600 requests per minute
      timeout: 5000,
      supportedChains: ['solana'],
      baseUrl: 'https://price.jup.ag/v4'
    });

    // Moralis for multiple chains
    this.addPriceSource({
      id: 'moralis',
      name: 'Moralis',
      priority: 5,
      isActive: !!process.env.MORALIS_API_KEY,
      rateLimit: 500, // Depends on plan
      timeout: 10000,
      supportedChains: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism'],
      apiKey: process.env.MORALIS_API_KEY,
      baseUrl: 'https://deep-index.moralis.io/api/v2'
    });

    this.logger.info('Price sources initialized', {
      totalSources: this.sources.size,
      activeSources: Array.from(this.sources.values()).filter(s => s.isActive).length
    });
  }

  private addPriceSource(source: PriceSource): void {
    this.sources.set(source.id, source);
    this.rateLimits.set(source.id, { count: 0, resetTime: Date.now() + 60000 });
  }

  /**
   * Retrieves the current price for a token from the best available source.
   * 
   * This method implements intelligent source selection, trying sources in priority order
   * while respecting rate limits. Results are cached to minimize API calls.
   * 
   * @param address - Token contract address (or 'native' for native tokens)
   * @param chain - Blockchain name (ethereum, bsc, polygon, etc.)
   * @returns Promise resolving to TokenPrice object or null if not found
   * 
   * @example
   * ```typescript
   * // Get USDC price on Ethereum
   * const price = await oracle.getTokenPrice('0xA0b86a33E6441e27a4E54E7cb03FA3a84F8C0F4F', 'ethereum');
   * if (price) {
   *   console.log(`USDC: $${price.priceUsd}`);
   * }
   * ```
   */
  async getTokenPrice(address: string, chain: string): Promise<TokenPrice | null> {
    const cacheKey = `${chain}-${address.toLowerCase()}`;
    
    // Check cache first
    const cached = this.priceCache.get<TokenPrice>(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.totalRequests++;
    const startTime = Date.now();

    try {
      // Get available sources for this chain
      const availableSources = this.getAvailableSources(chain);
      
      if (availableSources.length === 0) {
        throw new Error(`No price sources available for chain: ${chain}`);
      }

      // Try sources in priority order
      for (const source of availableSources) {
        if (!this.checkRateLimit(source.id)) {
          continue;
        }

        try {
          const price = await this.fetchPriceFromSource(source, address, chain);
          if (price) {
            this.priceCache.set(cacheKey, price);
            this.stats.successfulRequests++;
            this.updateResponseTime(Date.now() - startTime);
            
            this.emit('priceUpdated', { address, chain, price });
            return price;
          }
        } catch (error: any) {
          this.logger.warn('Price fetch failed from source', {
            source: source.id,
            address,
            chain,
            error: error.message
          });
        }
      }

      throw new Error('All price sources failed');
    } catch (error: any) {
      this.stats.failedRequests++;
      this.logger.error('Failed to get token price', {
        address,
        chain,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Retrieves prices for multiple tokens efficiently using batched requests.
   * 
   * This method processes tokens in batches to respect rate limits and includes
   * small delays between batches to prevent overwhelming APIs.
   * 
   * @param addresses - Array of token contract addresses
   * @param chain - Blockchain name (ethereum, bsc, polygon, etc.)
   * @returns Promise resolving to Map of address -> TokenPrice
   * 
   * @example
   * ```typescript
   * const tokens = ['0x...', '0x...', '0x...'];
   * const prices = await oracle.getMultipleTokenPrices(tokens, 'ethereum');
   * prices.forEach((price, address) => {
   *   console.log(`${address}: $${price.priceUsd}`);
   * });
   * ```
   */
  async getMultipleTokenPrices(addresses: string[], chain: string): Promise<Map<string, TokenPrice>> {
    const results = new Map<string, TokenPrice>();
    
    // Process in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const promises = batch.map(address => 
        this.getTokenPrice(address, chain).then(price => ({ address, price }))
      );
      
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.price) {
          results.set(result.value.address, result.value.price);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  async comparePricesAcrossSources(address: string, chain: string): Promise<PriceComparisonResult> {
    const availableSources = this.getAvailableSources(chain);
    const prices: TokenPrice[] = [];
    
    // Fetch from multiple sources in parallel
    const promises = availableSources.map(source => 
      this.fetchPriceFromSource(source, address, chain).catch(() => null)
    );
    
    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    });
    
    if (prices.length === 0) {
      throw new Error('No prices available from any source');
    }
    
    // Calculate statistics
    const priceValues = prices.map(p => p.priceUsd);
    const averagePrice = priceValues.reduce((sum, price) => sum + price, 0) / priceValues.length;
    
    const deviations = priceValues.map(price => Math.abs(price - averagePrice) / averagePrice * 100);
    const maxDeviation = Math.max(...deviations);
    
    // Calculate confidence based on consistency
    const confidence = Math.max(0, 100 - maxDeviation);
    
    // Recommended price is the median to avoid outliers
    const sortedPrices = [...priceValues].sort((a, b) => a - b);
    const recommendedPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
    
    return {
      prices,
      averagePrice,
      deviation: maxDeviation,
      confidence,
      recommendedPrice
    };
  }

  private async fetchPriceFromSource(source: PriceSource, address: string, chain: string): Promise<TokenPrice | null> {
    try {
      switch (source.id) {
        case 'coingecko':
          return await this.fetchCoinGeckoPrice(source, address, chain);
        case 'coinmarketcap':
          return await this.fetchCoinMarketCapPrice(source, address, chain);
        case 'dexscreener':
          return await this.fetchDexScreenerPrice(source, address, chain);
        case 'jupiter':
          return await this.fetchJupiterPrice(source, address);
        case 'moralis':
          return await this.fetchMoralisPrice(source, address, chain);
        default:
          throw new Error(`Unsupported price source: ${source.id}`);
      }
    } catch (error: any) {
      this.logger.debug('Price fetch failed', {
        source: source.id,
        address,
        chain,
        error: error.message
      });
      return null;
    }
  }

  private async fetchCoinGeckoPrice(source: PriceSource, address: string, chain: string): Promise<TokenPrice | null> {
    const platformMap: Record<string, string> = {
      ethereum: 'ethereum',
      bsc: 'binance-smart-chain',
      polygon: 'polygon-pos',
      arbitrum: 'arbitrum-one',
      optimism: 'optimistic-ethereum',
      solana: 'solana'
    };

    const platform = platformMap[chain];
    if (!platform) {
      throw new Error(`Unsupported chain for CoinGecko: ${chain}`);
    }

    const url = `${source.baseUrl}/simple/token_price/${platform}`;
    const params = {
      contract_addresses: address,
      vs_currencies: 'usd',
      include_market_cap: 'true',
      include_24hr_vol: 'true',
      include_24hr_change: 'true'
    };

    if (source.apiKey) {
      (params as any).x_cg_pro_api_key = source.apiKey;
    }

    const response = await axios.get(url, {
      params,
      timeout: source.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = response.data[address.toLowerCase()];
    if (!data) {
      return null;
    }

    return {
      address,
      symbol: 'UNKNOWN', // CoinGecko doesn't always return symbol in this endpoint
      priceUsd: data.usd || 0,
      priceChange24h: data.usd_24h_change || 0,
      volume24h: data.usd_24h_vol || 0,
      marketCap: data.usd_market_cap || 0,
      lastUpdated: Date.now(),
      source: source.id,
      confidence: 95
    };
  }

  private async fetchDexScreenerPrice(source: PriceSource, address: string, chain: string): Promise<TokenPrice | null> {
    const url = `${source.baseUrl}/dex/tokens/${address}`;
    
    const response = await axios.get(url, {
      timeout: source.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });

    const pairs = response.data.pairs || [];
    if (pairs.length === 0) {
      return null;
    }

    // Find the pair with highest liquidity on the requested chain
    const chainPairs = pairs.filter((pair: any) => pair.chainId === chain);
    if (chainPairs.length === 0) {
      return null;
    }

    const bestPair = chainPairs.reduce((best: any, current: any) => {
      return parseFloat(current.liquidity?.usd || '0') > parseFloat(best.liquidity?.usd || '0') ? current : best;
    });

    return {
      address,
      symbol: bestPair.baseToken?.symbol || 'UNKNOWN',
      priceUsd: parseFloat(bestPair.priceUsd || '0'),
      priceChange24h: parseFloat(bestPair.priceChange?.h24 || '0'),
      volume24h: parseFloat(bestPair.volume?.h24 || '0'),
      marketCap: parseFloat(bestPair.marketCap || '0'),
      lastUpdated: Date.now(),
      source: source.id,
      confidence: 85
    };
  }

  private async fetchJupiterPrice(source: PriceSource, address: string): Promise<TokenPrice | null> {
    const url = `${source.baseUrl}/price`;
    const params = {
      ids: address,
      vsToken: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC on Solana
    };

    const response = await axios.get(url, {
      params,
      timeout: source.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = response.data.data[address];
    if (!data) {
      return null;
    }

    return {
      address,
      symbol: data.symbol || 'UNKNOWN',
      priceUsd: parseFloat(data.price || '0'),
      priceChange24h: 0, // Jupiter doesn't provide 24h change
      volume24h: 0,
      marketCap: 0,
      lastUpdated: Date.now(),
      source: source.id,
      confidence: 80
    };
  }

  private async fetchCoinMarketCapPrice(source: PriceSource, address: string, chain: string): Promise<TokenPrice | null> {
    try {
      if (!source.apiKey) {
        throw new Error('CoinMarketCap API key is required');
      }

      // First, try to get token info by contract address
      const infoUrl = `${source.baseUrl}/cryptocurrency/info`;
      const infoParams = {
        address: address,
        aux: 'urls,logo,description,tags,platform,date_added,notice,status'
      };

      const infoResponse = await axios.get(infoUrl, {
        params: infoParams,
        timeout: source.timeout,
        headers: {
          'Accept': 'application/json',
          'X-CMC_PRO_API_KEY': source.apiKey
        }
      });

      if (!infoResponse.data.data || Object.keys(infoResponse.data.data).length === 0) {
        return null; // Token not found in CoinMarketCap
      }

      // Get the token ID from the response
      const tokenData = Object.values(infoResponse.data.data)[0] as any;
      const tokenId = tokenData.id;

      // Now get the price data using the token ID
      const priceUrl = `${source.baseUrl}/cryptocurrency/quotes/latest`;
      const priceParams = {
        id: tokenId.toString(),
        convert: 'USD'
      };

      const priceResponse = await axios.get(priceUrl, {
        params: priceParams,
        timeout: source.timeout,
        headers: {
          'Accept': 'application/json',
          'X-CMC_PRO_API_KEY': source.apiKey
        }
      });

      const priceData = priceResponse.data.data[tokenId];
      if (!priceData || !priceData.quote || !priceData.quote.USD) {
        return null;
      }

      const quote = priceData.quote.USD;

      return {
        address,
        symbol: priceData.symbol || 'UNKNOWN',
        priceUsd: quote.price || 0,
        priceChange24h: quote.percent_change_24h || 0,
        volume24h: quote.volume_24h || 0,
        marketCap: quote.market_cap || 0,
        lastUpdated: new Date(quote.last_updated).getTime(),
        source: source.id,
        confidence: 92 // CoinMarketCap is generally reliable
      };
    } catch (error: any) {
      this.logger.debug('CoinMarketCap price fetch failed', {
        address,
        chain,
        error: error.response?.data || error.message
      });
      return null;
    }
  }

  private async fetchMoralisPrice(source: PriceSource, address: string, chain: string): Promise<TokenPrice | null> {
    const url = `${source.baseUrl}/erc20/${address}/price`;
    const params = {
      chain: chain
    };

    const response = await axios.get(url, {
      params,
      timeout: source.timeout,
      headers: {
        'Accept': 'application/json',
        'X-API-Key': source.apiKey || ''
      }
    });

    const data = response.data;
    if (!data) {
      return null;
    }

    return {
      address,
      symbol: data.symbol || 'UNKNOWN',
      priceUsd: parseFloat(data.usdPrice || '0'),
      priceChange24h: parseFloat(data.priceChange24h || '0'),
      volume24h: 0,
      marketCap: 0,
      lastUpdated: Date.now(),
      source: source.id,
      confidence: 90
    };
  }

  private getAvailableSources(chain: string): PriceSource[] {
    return Array.from(this.sources.values())
      .filter(source => 
        source.isActive && 
        source.supportedChains.includes(chain)
      )
      .sort((a, b) => a.priority - b.priority);
  }

  private checkRateLimit(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    if (!source) return false;

    const rateLimit = this.rateLimits.get(sourceId);
    if (!rateLimit) return false;

    const now = Date.now();
    
    // Reset counter if minute has passed
    if (now >= rateLimit.resetTime) {
      rateLimit.count = 0;
      rateLimit.resetTime = now + 60000;
    }

    // Check if we've exceeded the rate limit
    if (rateLimit.count >= source.rateLimit) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  private updateResponseTime(responseTime: number): void {
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.successfulRequests - 1) + responseTime) / 
      this.stats.successfulRequests;
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      const healthChecks = Array.from(this.sources.values()).map(source => 
        this.checkSourceHealth(source)
      );
      
      await Promise.allSettled(healthChecks);
    }, 300000); // Every 5 minutes
  }

  private async checkSourceHealth(source: PriceSource): Promise<void> {
    try {
      // Test with a known token (WETH on Ethereum)
      const testAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      const testChain = 'ethereum';
      
      if (source.supportedChains.includes(testChain)) {
        const startTime = Date.now();
        await this.fetchPriceFromSource(source, testAddress, testChain);
        const responseTime = Date.now() - startTime;
        
        if (responseTime > source.timeout) {
          this.logger.warn('Price source slow response', {
            source: source.id,
            responseTime,
            timeout: source.timeout
          });
        }
      }
    } catch (error: any) {
      this.logger.warn('Price source health check failed', {
        source: source.id,
        error: error.message
      });
      
      // Temporarily disable source if it's consistently failing
      // Implementation would track consecutive failures
    }
  }

  getStats() {
    return {
      ...this.stats,
      activeSources: Array.from(this.sources.values()).filter(s => s.isActive).length,
      totalSources: this.sources.size,
      cacheSize: this.priceCache.keys().length,
      cacheHitRate: this.stats.totalRequests > 0 ? (this.stats.cacheHits / this.stats.totalRequests) * 100 : 0
    };
  }

  async enableSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (source) {
      source.isActive = true;
      this.logger.info('Price source enabled', { sourceId });
    }
  }

  async disableSource(sourceId: string): Promise<void> {
    const source = this.sources.get(sourceId);
    if (source) {
      source.isActive = false;
      this.logger.info('Price source disabled', { sourceId });
    }
  }

  clearCache(): void {
    this.priceCache.flushAll();
    this.logger.info('Price cache cleared');
  }

  async close(): Promise<void> {
    this.priceCache.close();
    this.removeAllListeners();
    this.logger.info('Price oracle closed');
  }
} 