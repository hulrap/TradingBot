import { EventEmitter } from 'events';
import winston from 'winston';
import NodeCache from 'node-cache';
import { ethers } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
// Note: Some imports commented out until they're properly exported from chain-client
// import { PriceOracle, TokenPrice, DEXAggregator, ChainAbstraction } from '@trading-bot/chain-client';

// Temporary type definitions until properly exported
interface TokenPrice {
  address: string;
  symbol: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: number;
  source: string;
  confidence: number;
}

interface PriceOracle {
  getTokenPrice(address: string, chain: string): Promise<TokenPrice | null>;
  on(event: string, listener: Function): void;
}

interface DEXAggregator {
  // Add minimal interface as needed
}

interface ChainAbstraction {
  // Add minimal interface as needed
}

export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  totalSupply?: string;
  verified: boolean;
  chain: string;
  logoURI?: string;
  lastUpdated: number;
  source: string;
}

export interface TokenMetadataConfig {
  cacheTimeout: number; // seconds
  enablePriceUpdates: boolean;
  enableVerification: boolean;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

export interface PoolMetadata {
  address: string;
  token0: TokenMetadata;
  token1: TokenMetadata;
  reserve0: string;
  reserve1: string;
  fee: number; // basis points
  liquidity: string;
  dexType: string;
  chain: string;
  lastUpdated: number;
}

export class TokenMetadataService extends EventEmitter {
  private logger: winston.Logger;
  private config: TokenMetadataConfig;
  private cache: NodeCache;
  private poolCache: NodeCache;
  private priceOracle: PriceOracle;
  // These services are planned for future use but not currently utilized
  // @ts-ignore - Planned for future use
  private _dexAggregator: DEXAggregator;
  // @ts-ignore - Planned for future use  
  private _chainAbstraction: ChainAbstraction;
  
  // Provider connections for different chains
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private solanaConnection?: Connection;

  // Token contract ABIs
  private readonly ERC20_ABI = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function totalSupply() view returns (uint256)'
  ];

  private readonly PAIR_ABI = [
    'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function kLast() view returns (uint256)'
  ];

  // Well-known token addresses for verification
  private readonly VERIFIED_TOKENS: Record<string, Record<string, TokenMetadata>> = {
    ethereum: {
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        priceUsd: 0,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        verified: true,
        chain: 'ethereum',
        lastUpdated: 0,
        source: 'builtin'
      },
      '0xA0b86a33E6417Ac30B0aA1cd9e6C8a1e1a5b3d4e': {
        address: '0xA0b86a33E6417Ac30B0aA1cd9e6C8a1e1a5b3d4e',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        priceUsd: 1.0,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        verified: true,
        chain: 'ethereum',
        lastUpdated: 0,
        source: 'builtin'
      }
    },
    bsc: {
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': {
        address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        symbol: 'WBNB',
        name: 'Wrapped BNB',
        decimals: 18,
        priceUsd: 0,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        verified: true,
        chain: 'bsc',
        lastUpdated: 0,
        source: 'builtin'
      }
    },
    solana: {
      'So11111111111111111111111111111111111111112': {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        priceUsd: 0,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        verified: true,
        chain: 'solana',
        lastUpdated: 0,
        source: 'builtin'
      }
    }
  };

  constructor(
    config: TokenMetadataConfig,
    priceOracle: PriceOracle,
    dexAggregator: DEXAggregator,
    chainAbstraction: ChainAbstraction,
    logger: winston.Logger
  ) {
    super();
    this.config = config;
    this.priceOracle = priceOracle;
    this._dexAggregator = dexAggregator;
    this._chainAbstraction = chainAbstraction;
    this.logger = logger;
    
    this.cache = new NodeCache({ 
      stdTTL: config.cacheTimeout,
      checkperiod: config.cacheTimeout * 0.2 
    });
    
    this.poolCache = new NodeCache({
      stdTTL: 300, // 5 minutes for pool data
      checkperiod: 60
    });

    this.setupProviders();
    this.setupEventHandlers();
  }

  private setupProviders(): void {
    // Initialize providers from environment variables
    if (process.env['ETH_RPC_URL']) {
      this.providers.set('ethereum', new ethers.JsonRpcProvider(process.env['ETH_RPC_URL']));
    }
    if (process.env['BSC_RPC_URL']) {
      this.providers.set('bsc', new ethers.JsonRpcProvider(process.env['BSC_RPC_URL']));
    }
    if (process.env['SOL_RPC_URL']) {
      this.solanaConnection = new Connection(process.env['SOL_RPC_URL']);
    }

    this.logger.info('Token metadata service providers initialized', {
      evmChains: Array.from(this.providers.keys()),
      solanaAvailable: !!this.solanaConnection
    });
  }

  private setupEventHandlers(): void {
    // Listen for price updates
    this.priceOracle.on('priceUpdated', ({ address, chain, price }: { address: string; chain: string; price: TokenPrice }) => {
      this.updateCachedTokenPrice(address, chain, price);
    });
  }

  private updateCachedTokenPrice(address: string, chain: string, price: TokenPrice): void {
    const cacheKey = `${chain}-${address.toLowerCase()}`;
    const cached = this.cache.get<TokenMetadata>(cacheKey);
    
    if (cached) {
      cached.priceUsd = price.priceUsd;
      cached.priceChange24h = price.priceChange24h;
      cached.volume24h = price.volume24h;
      cached.marketCap = price.marketCap;
      cached.lastUpdated = Date.now();
      
      this.cache.set(cacheKey, cached);
      this.emit('tokenUpdated', { address, chain, metadata: cached });
    }
  }

  async getTokenMetadata(address: string, chain: string): Promise<TokenMetadata | null> {
    const cacheKey = `${chain}-${address.toLowerCase()}`;
    
    // Check cache first
    const cached = this.cache.get<TokenMetadata>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Check if it's a well-known verified token
      const verified = this.VERIFIED_TOKENS[chain]?.[address.toLowerCase()];
      if (verified) {
        // Still get real-time price
        const price = await this.priceOracle.getTokenPrice(address, chain);
        if (price) {
          verified.priceUsd = price.priceUsd;
          verified.priceChange24h = price.priceChange24h;
          verified.volume24h = price.volume24h;
          verified.marketCap = price.marketCap;
          verified.lastUpdated = Date.now();
        }
        
        this.cache.set(cacheKey, verified);
        return verified;
      }

      // Fetch metadata from blockchain
      const metadata = await this.fetchTokenMetadataFromChain(address, chain);
      if (!metadata) {
        return null;
      }

      // Get price data
      const price = await this.priceOracle.getTokenPrice(address, chain);
      if (price) {
        metadata.priceUsd = price.priceUsd;
        metadata.priceChange24h = price.priceChange24h;
        metadata.volume24h = price.volume24h;
        metadata.marketCap = price.marketCap;
      }

      // Cache the result
      this.cache.set(cacheKey, metadata);
      
      this.emit('tokenFetched', { address, chain, metadata });
      return metadata;

    } catch (error: any) {
      this.logger.error('Failed to get token metadata', {
        address,
        chain,
        error: error.message
      });
      return null;
    }
  }

  async getMultipleTokenMetadata(addresses: string[], chain: string): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();
    
    // Process in batches
    const batchSize = this.config.batchSize;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const promises = batch.map(address => 
        this.getTokenMetadata(address, chain).then(metadata => ({ address, metadata }))
      );
      
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.metadata) {
          results.set(result.value.address, result.value.metadata);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  async getPoolMetadata(poolAddress: string, chain: string): Promise<PoolMetadata | null> {
    const cacheKey = `pool-${chain}-${poolAddress.toLowerCase()}`;
    
    // Check cache first
    const cached = this.poolCache.get<PoolMetadata>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const poolData = await this.fetchPoolDataFromChain(poolAddress, chain);
      if (!poolData) {
        return null;
      }

      // Get token metadata for both tokens
      const [token0Metadata, token1Metadata] = await Promise.all([
        this.getTokenMetadata(poolData.token0Address, chain),
        this.getTokenMetadata(poolData.token1Address, chain)
      ]);

      if (!token0Metadata || !token1Metadata) {
        this.logger.warn('Failed to get token metadata for pool', {
          poolAddress,
          chain,
          token0: poolData.token0Address,
          token1: poolData.token1Address
        });
        return null;
      }

      const poolMetadata: PoolMetadata = {
        address: poolAddress,
        token0: token0Metadata,
        token1: token1Metadata,
        reserve0: poolData.reserve0,
        reserve1: poolData.reserve1,
        fee: poolData.fee,
        liquidity: poolData.liquidity,
        dexType: poolData.dexType,
        chain,
        lastUpdated: Date.now()
      };

      this.poolCache.set(cacheKey, poolMetadata);
      return poolMetadata;

    } catch (error: any) {
      this.logger.error('Failed to get pool metadata', {
        poolAddress,
        chain,
        error: error.message
      });
      return null;
    }
  }

  private async fetchTokenMetadataFromChain(address: string, chain: string): Promise<TokenMetadata | null> {
    if (chain === 'solana') {
      return this.fetchSolanaTokenMetadata(address);
    } else {
      return this.fetchEvmTokenMetadata(address, chain);
    }
  }

  private async fetchEvmTokenMetadata(address: string, chain: string): Promise<TokenMetadata | null> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`No provider available for chain: ${chain}`);
    }

    try {
      const tokenContract = new ethers.Contract(address, this.ERC20_ABI, provider);
      
      const [decimals, symbol, name, totalSupply] = await Promise.all([
        tokenContract['decimals']?.().catch(() => 18) || 18,
        tokenContract['symbol']?.().catch(() => 'UNKNOWN') || 'UNKNOWN',
        tokenContract['name']?.().catch(() => 'Unknown Token') || 'Unknown Token',
        tokenContract['totalSupply']?.().catch(() => '0') || '0'
      ]);

      return {
        address,
        symbol,
        name,
        decimals: Number(decimals),
        priceUsd: 0, // Will be filled by price oracle
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        totalSupply: totalSupply.toString(),
        verified: this.isVerifiedToken(address, chain),
        chain,
        lastUpdated: Date.now(),
        source: 'blockchain'
      };

    } catch (error: any) {
      this.logger.debug('Failed to fetch EVM token metadata', {
        address,
        chain,
        error: error.message
      });
      return null;
    }
  }

  private async fetchSolanaTokenMetadata(address: string): Promise<TokenMetadata | null> {
    if (!this.solanaConnection) {
      throw new Error('Solana connection not available');
    }

    try {
      const mintPublicKey = new PublicKey(address);
      const accountInfo = await this.solanaConnection.getAccountInfo(mintPublicKey);
      
      if (!accountInfo) {
        return null;
      }

      // Parse Solana token mint data
      // This is a simplified implementation - in production would use proper SPL Token parsing
      const decimals = accountInfo.data[44]; // Decimals are at offset 44 in mint account
      
      return {
        address,
        symbol: 'UNKNOWN', // Would need to fetch from metadata
        name: 'Unknown Token',
        decimals: decimals || 9,
        priceUsd: 0,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        verified: this.isVerifiedToken(address, 'solana'),
        chain: 'solana',
        lastUpdated: Date.now(),
        source: 'blockchain'
      };

    } catch (error: any) {
      this.logger.debug('Failed to fetch Solana token metadata', {
        address,
        error: error.message
      });
      return null;
    }
  }

  private async fetchPoolDataFromChain(poolAddress: string, chain: string): Promise<{
    token0Address: string;
    token1Address: string;
    reserve0: string;
    reserve1: string;
    fee: number;
    liquidity: string;
    dexType: string;
  } | null> {
    if (chain === 'solana') {
      // Solana pool data would be fetched differently
      return null;
    }

    const provider = this.providers.get(chain);
    if (!provider) {
      return null;
    }

    try {
      const pairContract = new ethers.Contract(poolAddress, this.PAIR_ABI, provider);
      
      const [token0Address, token1Address, reserves] = await Promise.all([
        pairContract['token0']?.() || '',
        pairContract['token1']?.() || '',
        pairContract['getReserves']?.() || { reserve0: 0, reserve1: 0 }
      ]);

      return {
        token0Address,
        token1Address,
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        fee: 300, // Default 0.3% - would need to detect actual fee
        liquidity: (reserves.reserve0 + reserves.reserve1).toString(),
        dexType: 'uniswap-v2' // Would need to detect actual DEX type
      };

    } catch (error: any) {
      this.logger.debug('Failed to fetch pool data', {
        poolAddress,
        chain,
        error: error.message
      });
      return null;
    }
  }

  private isVerifiedToken(address: string, chain: string): boolean {
    return !!this.VERIFIED_TOKENS[chain]?.[address.toLowerCase()];
  }

  async refreshTokenPrice(address: string, chain: string): Promise<TokenPrice | null> {
    try {
      const price = await this.priceOracle.getTokenPrice(address, chain);
      if (price) {
        this.updateCachedTokenPrice(address, chain, price);
      }
      return price;
    } catch (error: any) {
      this.logger.error('Failed to refresh token price', {
        address,
        chain,
        error: error.message
      });
      return null;
    }
  }

  async refreshPoolData(poolAddress: string, chain: string): Promise<PoolMetadata | null> {
    // Clear from cache to force refresh
    const cacheKey = `pool-${chain}-${poolAddress.toLowerCase()}`;
    this.poolCache.del(cacheKey);
    
    return this.getPoolMetadata(poolAddress, chain);
  }

  getStats() {
    return {
      tokensCached: this.cache.keys().length,
      poolsCached: this.poolCache.keys().length,
      supportedChains: Array.from(this.providers.keys()).concat(this.solanaConnection ? ['solana'] : []),
      cacheHitRate: this.cache.getStats()
    };
  }

  clearCache(): void {
    this.cache.flushAll();
    this.poolCache.flushAll();
    this.logger.info('Token metadata cache cleared');
  }

  async close(): Promise<void> {
    this.cache.close();
    this.poolCache.close();
    this.removeAllListeners();
    this.logger.info('Token metadata service closed');
  }
} 