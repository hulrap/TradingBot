/**
 * @file Trading Route Types and Optimization.
 * 
 * Route discovery, optimization, and execution types for multi-hop
 * trading across DEXes and blockchains.
 * 
 * Features:
 * - Multi-hop route discovery and validation
 * - Route optimization algorithms (Livshits engine)
 * - Cross-chain routing and bridge integration
 * - Route quality assessment and ranking
 * - Dynamic route caching and precomputation.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address, TokenInfo } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';

// ========================================
// CORE ROUTE TYPES
// ========================================

/**
 * Route identifier.
 */
type RouteId = string;

/**
 * Route optimization objectives.
 */
type OptimizationObjective =
  | 'best-price'      // Maximize output amount
  | 'lowest-gas'      // Minimize gas costs
  | 'fastest'         // Minimize execution time
  | 'lowest-slippage' // Minimize price impact
  | 'best-ratio'      // Optimal price/gas ratio
  | 'mev-resistant'   // MEV protection priority
  | 'balanced';       // Balanced optimization

/**
 * Route status enumeration.
 */
type RouteStatus =
  | 'valid'      // Route is valid and executable
  | 'stale'      // Route data is outdated
  | 'invalid'    // Route is no longer valid
  | 'expired'    // Route has expired
  | 'failed'     // Route validation failed
  | 'blocked';   // Route is temporarily blocked

// ========================================
// ROUTE STEP TYPES (moved before RouteStep)
// ========================================

/**
 * Route step metadata.
 */
interface RouteStepMetadata {
  /** Pool reserves. */
  reserves?: {
    token0: string;
    token1: string;
  };
  
  /** Pool fee tier (for v3 pools). */
  feeTier?: number;
  
  /** Pool utilization percentage. */
  utilization?: number;
  
  /** Historical volume. */
  volume24h?: string;
  
  /** Pool TVL. */
  tvl?: string;
  
  /** Price oracle data. */
  oracle?: {
    price: string;
    timestamp: number;
    source: string;
  };
  
  /** Custom step data. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Individual step in a trading route.
 */
interface RouteStep {
  /** Step identifier. */
  id: string;
  
  /** Step sequence number. */
  sequence: number;
  
  /** DEX protocol used for this step. */
  protocol: string;
  
  /** DEX name/identifier. */
  dexName: string;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Pool/pair address. */
  poolAddress: Address;
  
  /** Pool type. */
  poolType: 'v2' | 'v3' | 'stable' | 'concentrated' | 'custom';
  
  /** Input token. */
  tokenIn: TokenInfo;
  
  /** Output token. */
  tokenOut: TokenInfo;
  
  /** Input amount. */
  amountIn: string;
  
  /** Expected output amount. */
  amountOut: string;
  
  /** Pool fee (in basis points). */
  fee: number;
  
  /** Price impact for this step. */
  priceImpact: number;
  
  /** Liquidity available. */
  liquidity: string;
  
  /** Gas estimate for this step. */
  gasEstimate: string;
  
  /** Execution data/calldata. */
  calldata?: string;
  
  /** Step metadata. */
  metadata: RouteStepMetadata;
}

// ========================================
// ROUTE QUALITY AND OPTIMIZATION TYPES (moved before SwapRoute)
// ========================================

/**
 * Route quality assessment.
 */
interface RouteQuality {
  /** Overall quality score (0-100). */
  score: number;
  
  /** Price efficiency score. */
  priceEfficiency: number;
  
  /** Gas efficiency score. */
  gasEfficiency: number;
  
  /** Liquidity depth score. */
  liquidityScore: number;
  
  /** Route reliability score. */
  reliabilityScore: number;
  
  /** MEV resistance score. */
  mevResistance: number;
  
  /** Total price impact. */
  totalPriceImpact: number;
  
  /** Slippage estimation. */
  estimatedSlippage: number;
  
  /** Route complexity penalty. */
  complexityPenalty: number;
  
  /** Quality assessment timestamp. */
  assessedAt: number;
}

/**
 * Route optimization information.
 */
interface RouteOptimization {
  /** Optimization objective used. */
  objective: OptimizationObjective;
  
  /** Algorithm used. */
  algorithm: 'dijkstra' | 'bellman-ford' | 'livshits' | 'genetic' | 'custom';
  
  /** Optimization parameters. */
  parameters: {
    maxHops: number;
    maxSlippage: number;
    gasLimit: string;
    deadline: number;
  };
  
  /** Alternative routes considered. */
  alternativesConsidered: number;
  
  /** Optimization time (ms). */
  optimizationTime: number;
  
  /** Confidence level. */
  confidence: number;
  
  /** Optimization metadata. */
  metadata: Record<string, string | number | boolean>;
}

/**
 * Cross-chain route information.
 */
interface CrossChainRoute {
  /** Source chain. */
  sourceChain: SupportedChain;
  
  /** Destination chain. */
  destinationChain: SupportedChain;
  
  /** Bridge protocol used. */
  bridgeProtocol: string;
  
  /** Bridge contract address. */
  bridgeAddress: Address;
  
  /** Bridge fee. */
  bridgeFee: string;
  
  /** Bridge fee token. */
  bridgeFeeToken: TokenInfo;
  
  /** Estimated bridge time. */
  bridgeTime: number;
  
  /** Bridge slippage. */
  bridgeSlippage: number;
  
  /** Bridge metadata. */
  bridgeMetadata: {
    minAmount: string;
    maxAmount: string;
    dailyLimit: string;
    security: 'low' | 'medium' | 'high';
    attestations: number;
  };
}

/**
 * Route metadata and context.
 */
interface RouteMetadata {
  /** Human-readable description. */
  description?: string;
  
  /** Route strategy/purpose. */
  strategy?: string;
  
  /** Priority level. */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Route tags. */
  tags: string[];
  
  /** Expected profit (for arbitrage). */
  expectedProfit?: string;
  
  /** Risk assessment. */
  riskLevel: 'low' | 'medium' | 'high';
  
  /** MEV protection enabled. */
  mevProtection: boolean;
  
  /** Private mempool usage. */
  privateMempool: boolean;
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

// ========================================
// ROUTE STRUCTURES
// ========================================

/**
 * Complete trading route from input to output token.
 */
interface SwapRoute {
  /** Unique route identifier. */
  id: RouteId;
  
  /** Route creation timestamp. */
  createdAt: number;
  
  /** Route expiration timestamp. */
  expiresAt: number;
  
  /** Route status. */
  status: RouteStatus;
  
  /** Input token information. */
  tokenIn: TokenInfo;
  
  /** Output token information. */
  tokenOut: TokenInfo;
  
  /** Input amount. */
  amountIn: string;
  
  /** Expected output amount. */
  amountOut: string;
  
  /** Route steps. */
  steps: RouteStep[];
  
  /** Route quality metrics. */
  quality: RouteQuality;
  
  /** Route optimization data. */
  optimization: RouteOptimization;
  
  /** Cross-chain information. */
  crossChain?: CrossChainRoute;
  
  /** Route metadata. */
  metadata: RouteMetadata;
}

// ========================================
// ROUTE DISCOVERY TYPES (moved before RouteDiscoveryRequest)
// ========================================

/**
 * Route discovery configuration options.
 */
interface RouteDiscoveryOptions {
  /** Maximum number of hops. */
  maxHops: number;
  
  /** Maximum slippage tolerance. */
  maxSlippage: number;
  
  /** Maximum gas limit. */
  maxGasLimit: string;
  
  /** Optimization objective. */
  objective: OptimizationObjective;
  
  /** Include cross-chain routes. */
  includeCrossChain: boolean;
  
  /** DEX whitelist. */
  dexWhitelist?: string[];
  
  /** DEX blacklist. */
  dexBlacklist?: string[];
  
  /** Token whitelist for intermediate hops. */
  tokenWhitelist?: Address[];
  
  /** Token blacklist for intermediate hops. */
  tokenBlacklist?: Address[];
  
  /** Minimum liquidity per step. */
  minLiquidity: string;
  
  /** Maximum price impact per step. */
  maxPriceImpactPerStep: number;
  
  /** Use cached routes. */
  useCachedRoutes: boolean;
  
  /** Cache expiry time. */
  cacheExpiryMs: number;
}

/**
 * Route discovery request parameters.
 */
interface RouteDiscoveryRequest {
  /** Input token. */
  tokenIn: TokenInfo;
  
  /** Output token. */
  tokenOut: TokenInfo;
  
  /** Input amount. */
  amountIn: string;
  
  /** Target chains (empty = same chain). */
  targetChains?: SupportedChain[];
  
  /** Discovery options. */
  options: RouteDiscoveryOptions;
  
  /** Request timestamp. */
  timestamp: number;
  
  /** Request deadline. */
  deadline: number;
}

/**
 * Route discovery result.
 */
interface RouteDiscoveryResult {
  /** Request identifier. */
  requestId: string;
  
  /** Discovery status. */
  status: 'success' | 'partial' | 'failed' | 'timeout';
  
  /** Found routes. */
  routes: SwapRoute[];
  
  /** Best route (highest quality). */
  bestRoute?: SwapRoute;
  
  /** Discovery statistics. */
  stats: {
    totalRoutesFound: number;
    routesAnalyzed: number;
    discoveryTime: number;
    cacheMisses: number;
    cacheHits: number;
  };
  
  /** Discovery errors. */
  errors: string[];
  
  /** Discovery warnings. */
  warnings: string[];
}

// ========================================
// ROUTE CACHING TYPES
// ========================================

/**
 * Cached route entry.
 */
interface CachedRoute {
  /** Cache key. */
  key: string;
  
  /** Cached route. */
  route: SwapRoute;
  
  /** Cache timestamp. */
  cachedAt: number;
  
  /** Cache expiry timestamp. */
  expiresAt: number;
  
  /** Cache hit count. */
  hitCount: number;
  
  /** Last accessed timestamp. */
  lastAccessed: number;
  
  /** Cache metadata. */
  metadata: {
    source: 'discovery' | 'precomputed' | 'user';
    version: string;
    size: number;
  };
}

/**
 * Route cache configuration.
 */
interface RouteCacheConfig {
  /** Maximum cache size. */
  maxSize: number;
  
  /** Default TTL in milliseconds. */
  defaultTtl: number;
  
  /** Cache eviction strategy. */
  evictionStrategy: 'lru' | 'lfu' | 'ttl' | 'size';
  
  /** Precompute popular routes. */
  precomputeRoutes: boolean;
  
  /** Precompute interval. */
  precomputeInterval: number;
  
  /** Cache warming enabled. */
  warmingEnabled: boolean;
  
  /** Cache statistics tracking. */
  statsEnabled: boolean;
}

// ========================================
// ROUTE ANALYTICS TYPES
// ========================================

/**
 * Route performance analytics.
 */
interface RouteAnalytics {
  /** Route identifier. */
  routeId: RouteId;
  
  /** Analytics period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Usage statistics. */
  usage: {
    executionCount: number;
    totalVolume: string;
    successRate: number;
    averageExecutionTime: number;
  };
  
  /** Performance metrics. */
  performance: {
    averageSlippage: number;
    averageGasCost: string;
    averagePriceImpact: number;
    profitability: number;
  };
  
  /** Quality trends. */
  qualityTrends: {
    scoreHistory: Array<{
      timestamp: number;
      score: number;
    }>;
    averageScore: number;
    scoreStability: number;
  };
  
  /** Error statistics. */
  errors: {
    totalErrors: number;
    errorTypes: Record<string, number>;
    errorRate: number;
  };
}

/**
 * Route comparison result.
 */
interface RouteComparison {
  /** Routes being compared. */
  routes: SwapRoute[];
  
  /** Comparison criteria. */
  criteria: {
    objective: OptimizationObjective;
    weights: Record<string, number>;
  };
  
  /** Ranking results. */
  ranking: Array<{
    routeId: RouteId;
    rank: number;
    score: number;
    advantages: string[];
    disadvantages: string[];
  }>;
  
  /** Comparison summary. */
  summary: {
    bestRoute: RouteId;
    averageQuality: number;
    qualityRange: {
      min: number;
      max: number;
    };
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Maximum hops per route by optimization objective.
 */
const MAX_HOPS_BY_OBJECTIVE = {
  bestPrice: 4,
  lowestGas: 2,
  fastest: 2,
  lowestSlippage: 3,
  bestRatio: 3,
  mevResistant: 2,
  balanced: 3
} as const;

/**
 * Default route discovery timeouts.
 */
const DISCOVERY_TIMEOUTS = {
  FAST: 1000,      // 1 second
  STANDARD: 3000,  // 3 seconds
  THOROUGH: 10000, // 10 seconds
  COMPREHENSIVE: 30000 // 30 seconds
} as const;

/**
 * Route quality thresholds.
 */
const QUALITY_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 75,
  ACCEPTABLE: 60,
  POOR: 40,
  UNACCEPTABLE: 20
} as const;

/**
 * Common intermediate tokens for routing.
 */
const COMMON_INTERMEDIATE_TOKENS = {
  ethereum: [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    '0xA0b86a33E6441F95D7Fbc0bD4F00B8Df06d1A4Fc', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
  ],
  bsc: [
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
    '0x55d398326f99059fF775485246999027B3197955'  // USDT
  ],
  polygon: [
    '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'  // USDT
  ],
  arbitrum: [
    '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
    '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // USDC
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'  // USDT
  ],
  optimism: [
    '0x4200000000000000000000000000000000000006', // WETH
    '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC
    '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'  // USDT
  ],
  avalanche: [],
  fantom: [],
  solana: [],
  base: []
} as const;

// Consolidated export declaration
export type {
  RouteId,
  OptimizationObjective,
  RouteStatus,
  RouteStepMetadata,
  RouteStep,
  RouteQuality,
  RouteOptimization,
  CrossChainRoute,
  RouteMetadata,
  SwapRoute,
  RouteDiscoveryOptions,
  RouteDiscoveryRequest,
  RouteDiscoveryResult,
  CachedRoute,
  RouteCacheConfig,
  RouteAnalytics,
  RouteComparison
};

export {
  MAX_HOPS_BY_OBJECTIVE,
  DISCOVERY_TIMEOUTS,
  QUALITY_THRESHOLDS,
  COMMON_INTERMEDIATE_TOKENS
};
