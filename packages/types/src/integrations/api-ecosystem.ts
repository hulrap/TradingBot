/**
 * @file API Ecosystem Integration Types
 * 
 * Comprehensive API integration infrastructure for crypto trading,
 * supporting 500+ APIs across exchanges, protocols, data providers,
 * news sources, and social platforms.
 * 
 * Features:
 * - 500+ API integrations (CEX, DEX, data providers)
 * - Unified authentication and rate limiting
 * - Real-time data streaming
 * - Advanced error handling and fallbacks
 * - Cross-API data correlation
 * - Custom API development framework
 * - Performance optimization and monitoring
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { Address, TokenInfo } from '../blockchain/addresses';

// ========================================
// API PROVIDER TYPES
// ========================================

/**
 * Comprehensive API provider types covering the entire crypto ecosystem.
 */
type APIProviderType = 
  // ========================================
  // CENTRALIZED EXCHANGES (CEX)
  // ========================================
  | 'binance'             // Binance Global
  | 'binance-us'          // Binance US
  | 'coinbase'            // Coinbase Pro
  | 'coinbase-advanced'   // Coinbase Advanced Trade
  | 'kraken'              // Kraken
  | 'okx'                 // OKX (formerly OKEx)
  | 'bybit'               // Bybit
  | 'bitget'              // Bitget
  | 'kucoin'              // KuCoin
  | 'huobi'               // Huobi Global
  | 'gate-io'             // Gate.io
  | 'crypto-com'          // Crypto.com
  | 'ftx'                 // FTX (archived)
  | 'bitfinex'            // Bitfinex
  | 'mexc'                // MEXC
  | 'bitmex'              // BitMEX
  | 'deribit'             // Deribit
  | 'phemex'              // Phemex
  | 'woo-network'         // WOO Network
  | 'bitrue'              // Bitrue
  | 'lbank'               // LBank
  | 'ascendex'            // AscendEX
  | 'xt-com'              // XT.COM
  | 'bitmart'             // BitMart
  | 'probit'              // ProBit Global
  | 'digifinex'           // DigiFinex
  | 'coinex'              // CoinEx
  | 'hotbit'              // Hotbit
  | 'bibox'               // Bibox
  | 'hoo'                 // Hoo.com
  | 'whitebit'            // WhiteBIT
  | 'fmfw-io'             // FMFW.io
  | 'bingx'               // BingX
  | 'bitpanda'            // Bitpanda
  | 'gemini'              // Gemini
  | 'bitstamp'            // Bitstamp
  | 'upbit'               // Upbit
  | 'bithumb'             // Bithumb
  | 'coinone'             // CoinOne
  | 'korbit'              // Korbit
  | 'bitso'               // Bitso
  | 'mercado-bitcoin'     // Mercado Bitcoin
  | 'novadax'             // NovaDAX
  | 'coinsbit'            // Coinsbit
  | 'exmo'                // EXMO
  | 'cex-io'              // CEX.IO
  | 'coincheck'           // Coincheck
  | 'liquid'              // Liquid
  | 'btcbox'              // BtcBox
  | 'zaif'                // Zaif
  | 'bitbank'             // bitbank
  | 'coinbase-wallet'     // Coinbase Wallet API
  
  // ========================================
  // DECENTRALIZED EXCHANGES (DEX)
  // ========================================
  | 'uniswap-subgraph'    // Uniswap Subgraph API
  | 'sushiswap-api'       // SushiSwap API
  | 'pancakeswap-api'     // PancakeSwap API
  | 'curve-api'           // Curve Finance API
  | 'balancer-api'        // Balancer API
  | 'osmosis-api'         // Osmosis API
  | 'serum-api'           // Serum DEX API
  | 'raydium-api'         // Raydium API
  | 'orca-api'            // Orca API
  | 'jupiter-api'         // Jupiter Aggregator API
  | '1inch-api'           // 1inch API
  | 'paraswap-api'        // ParaSwap API
  | 'matcha-api'          // Matcha (0x) API
  | 'kyber-api'           // KyberSwap API
  | 'openocean-api'       // OpenOcean API
  
  // ========================================
  // MARKET DATA PROVIDERS
  // ========================================
  | 'coingecko'           // CoinGecko API
  | 'coinmarketcap'       // CoinMarketCap API
  | 'cryptocompare'       // CryptoCompare API
  | 'messari'             // Messari API
  | 'nomics'              // Nomics API
  | 'coinapi'             // CoinAPI
  | 'coinlore'            // CoinLore API
  | 'coinpaprika'         // CoinPaprika API
  | 'livecoinwatch'       // LiveCoinWatch API
  | 'worldcoinindex'      // WorldCoinIndex API
  | 'coinranking'         // Coinranking API
  | 'coincodex'           // CoinCodex API
  | 'fixer-io'            // Fixer.io (Forex rates)
  | 'exchangerate-api'    // ExchangeRate-API
  | 'currencylayer'       // CurrencyLayer API
  
  // ========================================
  // ORACLE DATA PROVIDERS
  // ========================================
  | 'chainlink'           // Chainlink Price Feeds
  | 'pyth-network'        // Pyth Network
  | 'uma-protocol'        // UMA Protocol
  | 'tellor'              // Tellor Oracle
  | 'band-protocol'       // Band Protocol
  | 'witnet'              // Witnet Oracle
  | 'api3'                // API3
  | 'flux-protocol'       // Flux Protocol
  | 'diadata'             // DIA Data
  | 'razor-network'       // Razor Network
  | 'chronicle'           // Chronicle Labs
  | 'umbrella-network'    // Umbrella Network
  | 'supraoracles'        // SupraOracles
  | 'redstone'            // RedStone Finance
  
  // ========================================
  // ON-CHAIN ANALYTICS
  // ========================================
  | 'dune-analytics'      // Dune Analytics
  | 'the-graph'           // The Graph Protocol
  | 'nansen'              // Nansen
  | 'chainalysis'         // Chainalysis
  | 'elliptic'            // Elliptic
  | 'glassnode'           // Glassnode
  | 'santiment'           // Santiment
  | 'intotheblock'        // IntoTheBlock
  | 'covalent'            // Covalent API
  | 'moralis'             // Moralis Web3 API
  | 'alchemy-nft'         // Alchemy NFT API
  | 'opensea-api'         // OpenSea API
  | 'reservoir-tools'     // Reservoir Tools
  | 'center-app'          // Center App
  | 'bitquery'            // Bitquery
  | 'flipside-crypto'     // Flipside Crypto
  | 'luabase'             // LuaBase
  | 'token-terminal'      // Token Terminal
  | 'debank'              // DeBank API
  | 'zapper-fi'           // Zapper.fi API
  | 'zerion-api'          // Zerion API
  | 'defipulse'           // DeFiPulse API
  | 'defillama'           // DefiLlama API
  | 'coindix'             // CoinDix API
  
  // ========================================
  // NEWS & SENTIMENT
  // ========================================
  | 'cryptopanic'         // CryptoPanic API
  | 'newsapi'             // NewsAPI
  | 'reddit-api'          // Reddit API
  | 'twitter-api'         // Twitter API v2
  | 'telegram-api'        // Telegram Bot API
  | 'discord-api'         // Discord API
  | 'youtube-api'         // YouTube Data API
  | 'medium-api'          // Medium API
  | 'substack-api'        // Substack API
  | 'finhub'              // Finnhub Stock API
  | 'alpha-vantage'       // Alpha Vantage
  | 'iex-cloud'           // IEX Cloud
  | 'polygon-io'          // Polygon.io
  | 'marketstack'         // Marketstack API
  | 'financial-modeling'  // Financial Modeling Prep
  | 'twelve-data'         // Twelve Data
  | 'yahoo-finance'       // Yahoo Finance (unofficial)
  | 'google-trends'       // Google Trends API
  | 'fear-greed-index'    // Fear & Greed Index
  | 'sentiment-investor'  // Sentiment Investor
  
  // ========================================
  // BLOCKCHAIN INFRASTRUCTURE
  // ========================================
  | 'etherscan'           // Etherscan API
  | 'bscscan'             // BSCScan API
  | 'polygonscan'         // PolygonScan API
  | 'snowtrace'           // SnowTrace (Avalanche)
  | 'ftmscan'             // FTMScan (Fantom)
  | 'arbiscan'            // Arbiscan API
  | 'optimism-explorer'   // Optimism Explorer
  | 'basescan'            // BaseScan API
  | 'solscan'             // Solscan API
  | 'solana-rpc'          // Solana RPC API
  | 'helius'              // Helius Solana API
  | 'quicknode-api'       // QuickNode API
  | 'alchemy-api'         // Alchemy API
  | 'infura-api'          // Infura API
  | 'moralis-streams'     // Moralis Streams API
  | 'webhooks-api'        // Custom Webhooks
  
  // ========================================
  // SPECIALIZED APIs
  // ========================================
  | 'coinbase-custody'    // Coinbase Custody API
  | 'fireblocks'          // Fireblocks API
  | 'anchorage'           // Anchorage Digital
  | 'bitgo'               // BitGo API
  | 'ledger-live'         // Ledger Live API
  | 'metamask-api'        // MetaMask API
  | 'walletconnect'       // WalletConnect API
  | 'web3auth'            // Web3Auth API
  | 'magic-link'          // Magic Link API
  | 'portis'              // Portis API (archived)
  | 'fortmatic'           // Fortmatic API
  | 'torus'               // Torus API
  | 'unipass'             // UniPass API
  | 'particle-network'    // Particle Network
  | 'custom';             // Custom API

/**
 * API categories for better organization.
 */
type APICategory = 
  | 'centralized-exchange'
  | 'decentralized-exchange'
  | 'market-data'
  | 'oracle-data'
  | 'on-chain-analytics'
  | 'news-sentiment'
  | 'blockchain-infrastructure'
  | 'wallet-custody'
  | 'defi-protocol'
  | 'nft-marketplace'
  | 'cross-chain'
  | 'institutional'
  | 'retail'
  | 'developer-tools'
  | 'custom';

/**
 * Authentication methods supported by APIs.
 */
type APIAuthMethod = 
  | 'none'
  | 'api-key'
  | 'api-key-secret'
  | 'oauth2'
  | 'jwt'
  | 'hmac'
  | 'basic-auth'
  | 'bearer-token'
  | 'webhook-signature'
  | 'ip-whitelist'
  | 'custom';

// ========================================
// API CONFIGURATION TYPES
// ========================================

/**
 * Comprehensive API provider configuration.
 */
interface APIProviderConfig {
  /** Provider identifier. */
  id: string;
  
  /** Provider type. */
  type: APIProviderType;
  
  /** API category. */
  category: APICategory;
  
  /** Provider name. */
  name: string;
  
  /** Base URL. */
  baseUrl: string;
  
  /** API version. */
  version: string;
  
  /** Supported chains (if applicable). */
  chains?: SupportedChain[];
  
  /** Authentication configuration. */
  auth: {
    /** Authentication method. */
    method: APIAuthMethod;
    
    /** API credentials. */
    credentials: {
      apiKey?: string;
      apiSecret?: string;
      passphrase?: string;
      accessToken?: string;
      refreshToken?: string;
    };
    
    /** Authentication headers. */
    headers: Record<string, string>;
    
    /** Signature generation (for HMAC). */
    signature?: {
      algorithm: 'sha256' | 'sha512' | 'md5';
      encoding: 'hex' | 'base64';
      bodyHash: boolean;
    };
  };
  
  /** Rate limiting configuration. */
  rateLimit: {
    /** Requests per second. */
    requestsPerSecond: number;
    
    /** Requests per minute. */
    requestsPerMinute: number;
    
    /** Requests per hour. */
    requestsPerHour: number;
    
    /** Requests per day. */
    requestsPerDay: number;
    
    /** Burst allowance. */
    burstAllowance: number;
    
    /** Weight-based limiting. */
    weightBased: boolean;
    
    /** Custom limits by endpoint. */
    endpointLimits: Record<string, {
      limit: number;
      window: number;
      weight?: number;
    }>;
  };
  
  /** Endpoint configurations. */
  endpoints: {
    /** REST API endpoints. */
    rest: Record<string, {
      path: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      rateLimit: number;
      weight?: number;
      auth: boolean;
      parameters: Record<string, {
        required: boolean;
        type: string;
        description: string;
      }>;
    }>;
    
    /** WebSocket endpoints. */
    websocket?: Record<string, {
      url: string;
      protocols: string[];
      auth: boolean;
      maxConnections: number;
      heartbeat: {
        enabled: boolean;
        interval: number;
        message: string;
      };
    }>;
    
    /** GraphQL endpoints. */
    graphql?: Record<string, {
      url: string;
      auth: boolean;
      schema: string;
    }>;
  };
  
  /** Response handling. */
  response: {
    /** Default timeout (ms). */
    timeout: number;
    
    /** Retry configuration. */
    retry: {
      maxAttempts: number;
      backoffStrategy: 'linear' | 'exponential' | 'fixed';
      baseDelay: number;
      maxDelay: number;
    };
    
    /** Error handling. */
    errorHandling: {
      /** Status codes to retry. */
      retryableStatusCodes: number[];
      
      /** Error code mappings. */
      errorMappings: Record<string, string>;
    };
    
    /** Response caching. */
    caching: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
      keyGenerator: string;
    };
  };
  
  /** Data transformation. */
  transformation: {
    /** Request transformers. */
    request: Array<{
      type: 'headers' | 'body' | 'query' | 'custom';
      transformer: string;
    }>;
    
    /** Response transformers. */
    response: Array<{
      type: 'normalize' | 'filter' | 'map' | 'custom';
      transformer: string;
    }>;
  };
  
  /** Health monitoring. */
  health: {
    /** Health check enabled. */
    enabled: boolean;
    
    /** Check interval (ms). */
    interval: number;
    
    /** Health endpoint. */
    endpoint: string;
    
    /** Expected response. */
    expectedResponse: unknown;
    
    /** Failure threshold. */
    failureThreshold: number;
  };
  
  /** Cost tracking. */
  cost: {
    /** Cost per request. */
    costPerRequest: number;
    
    /** Cost per API call (weighted). */
    costPerCall: Record<string, number>;
    
    /** Monthly quota. */
    monthlyQuota?: number;
    
    /** Cost alerts. */
    alerts: {
      enabled: boolean;
      thresholds: number[];
    };
  };
}

// ========================================
// API ORCHESTRATION TYPES
// ========================================

/**
 * API request configuration.
 */
interface APIRequest {
  /** Request identifier. */
  id: string;
  
  /** Target API provider. */
  provider: APIProviderType;
  
  /** Endpoint to call. */
  endpoint: string;
  
  /** Request method. */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  
  /** Request parameters. */
  parameters: {
    /** Query parameters. */
    query?: Record<string, string | number | boolean>;
    
    /** Request body. */
    body?: Record<string, unknown>;
    
    /** Path parameters. */
    path?: Record<string, string>;
    
    /** Custom headers. */
    headers?: Record<string, string>;
  };
  
  /** Request metadata. */
  metadata: {
    /** Request priority. */
    priority: 'low' | 'normal' | 'high' | 'critical';
    
    /** Request timeout (ms). */
    timeout?: number;
    
    /** Retry configuration. */
    retry?: {
      enabled: boolean;
      maxAttempts: number;
      strategy: 'linear' | 'exponential';
    };
    
    /** Caching configuration. */
    cache?: {
      enabled: boolean;
      ttl: number;
      key?: string;
    };
  };
}

/**
 * API response structure.
 */
interface APIResponse<T = unknown> {
  /** Response identifier. */
  id: string;
  
  /** Request that generated this response. */
  requestId: string;
  
  /** Response timestamp. */
  timestamp: number;
  
  /** Response status. */
  status: {
    /** HTTP status code. */
    code: number;
    
    /** Status message. */
    message: string;
    
    /** Success indicator. */
    success: boolean;
  };
  
  /** Response data. */
  data: T;
  
  /** Response metadata. */
  metadata: {
    /** Response time (ms). */
    responseTime: number;
    
    /** Data source. */
    source: APIProviderType;
    
    /** Cache status. */
    cached: boolean;
    
    /** Rate limit information. */
    rateLimit: {
      remaining: number;
      reset: number;
      limit: number;
    };
    
    /** API version used. */
    apiVersion: string;
  };
  
  /** Pagination information (if applicable). */
  pagination?: {
    /** Current page. */
    page: number;
    
    /** Items per page. */
    limit: number;
    
    /** Total items. */
    total: number;
    
    /** Total pages. */
    totalPages: number;
    
    /** Has more pages. */
    hasMore: boolean;
    
    /** Next page cursor. */
    nextCursor?: string;
  };
  
  /** Error information (if applicable). */
  error?: {
    /** Error code. */
    code: string;
    
    /** Error message. */
    message: string;
    
    /** Error details. */
    details?: Record<string, unknown>;
    
    /** Retry suggestion. */
    retryable: boolean;
  };
}

/**
 * Multi-API aggregation configuration.
 */
interface APIAggregationConfig {
  /** Aggregation identifier. */
  id: string;
  
  /** Participating APIs. */
  apis: Array<{
    /** API provider. */
    provider: APIProviderType;
    
    /** API weight in aggregation. */
    weight: number;
    
    /** Fallback priority. */
    priority: number;
    
    /** Data mapping configuration. */
    mapping: Record<string, string>;
  }>;
  
  /** Aggregation strategy. */
  strategy: {
    /** Aggregation method. */
    method: 'average' | 'weighted-average' | 'median' | 'consensus' | 'best-quality' | 'custom';
    
    /** Minimum sources required. */
    minSources: number;
    
    /** Maximum deviation allowed. */
    maxDeviation: number;
    
    /** Quality scoring enabled. */
    qualityScoring: boolean;
    
    /** Outlier detection. */
    outlierDetection: {
      enabled: boolean;
      threshold: number;
      method: 'iqr' | 'zscore' | 'isolation-forest';
    };
  };
  
  /** Performance optimization. */
  optimization: {
    /** Parallel requests enabled. */
    parallelRequests: boolean;
    
    /** Request timeout (ms). */
    timeout: number;
    
    /** Early termination on consensus. */
    earlyTermination: boolean;
    
    /** Caching configuration. */
    caching: {
      enabled: boolean;
      ttl: number;
      sharedCache: boolean;
    };
  };
}

// ========================================
// REAL-TIME STREAMING TYPES
// ========================================

/**
 * WebSocket subscription configuration.
 */
interface WebSocketSubscription {
  /** Subscription identifier. */
  id: string;
  
  /** Target API provider. */
  provider: APIProviderType;
  
  /** WebSocket endpoint. */
  endpoint: string;
  
  /** Subscription channels. */
  channels: Array<{
    /** Channel name. */
    channel: string;
    
    /** Channel parameters. */
    parameters: Record<string, unknown>;
    
    /** Subscription filters. */
    filters?: Record<string, unknown>;
  }>;
  
  /** Connection configuration. */
  connection: {
    /** Auto-reconnect enabled. */
    autoReconnect: boolean;
    
    /** Reconnect delay (ms). */
    reconnectDelay: number;
    
    /** Maximum reconnect attempts. */
    maxReconnectAttempts: number;
    
    /** Heartbeat configuration. */
    heartbeat: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };
  };
  
  /** Data handling. */
  data: {
    /** Message parser. */
    parser: string;
    
    /** Data validators. */
    validators: string[];
    
    /** Data transformers. */
    transformers: string[];
    
    /** Buffer configuration. */
    buffer: {
      enabled: boolean;
      size: number;
      flushInterval: number;
    };
  };
}

/**
 * Real-time data stream.
 */
interface DataStream<T = unknown> {
  /** Stream identifier. */
  id: string;
  
  /** Stream source. */
  source: APIProviderType;
  
  /** Stream type. */
  type: 'prices' | 'trades' | 'orderbook' | 'news' | 'events' | 'custom';
  
  /** Stream status. */
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'terminated';
  
  /** Stream data. */
  data: T;
  
  /** Stream metadata. */
  metadata: {
    /** Data timestamp. */
    timestamp: number;
    
    /** Sequence number. */
    sequence: number;
    
    /** Data latency (ms). */
    latency: number;
    
    /** Connection uptime (ms). */
    uptime: number;
    
    /** Message count. */
    messageCount: number;
  };
  
  /** Stream quality metrics. */
  quality: {
    /** Data freshness score. */
    freshness: number;
    
    /** Data completeness score. */
    completeness: number;
    
    /** Connection stability score. */
    stability: number;
    
    /** Error rate. */
    errorRate: number;
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  APIProviderType,
  APICategory,
  APIAuthMethod,
  APIProviderConfig,
  APIRequest,
  APIResponse,
  APIAggregationConfig,
  WebSocketSubscription,
  DataStream
}; 