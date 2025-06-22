/**
 * @file Advanced MEV and Livshits Algorithm Types
 * 
 * Sophisticated MEV detection, Ben Livshits routing algorithms, and
 * advanced arbitrage opportunity analysis based on academic research.
 * 
 * Features:
 * - Ben Livshits DeFi routing algorithms
 * - Advanced MEV detection and protection
 * - Sophisticated arbitrage matrix computations
 * - Cross-chain opportunity detection
 * - Zero-latency oracle integration
 * - Enterprise-grade monitoring systems
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { Address, TokenInfo } from '../blockchain/addresses';
import type { DEXProtocol, DEXId } from '../data/dex';

// ========================================
// LIVSHITS ROUTING ALGORITHM TYPES
// ========================================

/**
 * Ben Livshits optimization objectives for routing algorithms.
 */
type OptimizationObjective = 
  | 'max-profit'          // Maximize arbitrage profit
  | 'min-gas'             // Minimize gas costs
  | 'min-slippage'        // Minimize price impact
  | 'max-speed'           // Fastest execution
  | 'max-reliability'     // Highest success rate
  | 'balanced'            // Balanced optimization
  | 'custom';             // Custom objective function

/**
 * Livshits heuristic types for route discovery.
 */
type LivshitsHeuristic = 
  | 'graph-traversal'     // Graph-based protocol traversal
  | 'liquidity-weighted'  // Liquidity-weighted path finding
  | 'gas-optimized'       // Gas-cost optimized routing
  | 'risk-adjusted'       // Risk-adjusted profitability
  | 'temporal-arbitrage'  // Time-sensitive opportunities
  | 'cross-chain'         // Cross-chain optimization
  | 'mev-resistant'       // MEV-resistant routing
  | 'hybrid';             // Hybrid approach

/**
 * Protocol graph node representing a DEX or protocol.
 */
interface ProtocolGraphNode {
  /** Protocol identifier. */
  protocolId: DEXId;
  
  /** Protocol type. */
  protocol: DEXProtocol;
  
  /** Supported chains. */
  chains: SupportedChain[];
  
  /** Connected protocols. */
  connections: Set<DEXId>;
  
  /** Efficiency metrics. */
  efficiency: {
    gasEfficiency: number;        // Gas cost efficiency (0-100)
    liquidityScore: number;       // Liquidity availability (0-100)
    reliabilityScore: number;     // Historical success rate (0-100)
    speedScore: number;           // Execution speed (0-100)
  };
  
  /** Last update timestamp. */
  lastUpdated: number;
}

/**
 * Token graph representing swappable token relationships.
 */
interface TokenGraphNode {
  /** Token information. */
  token: TokenInfo;
  
  /** Directly swappable tokens. */
  connections: Map<Address, {
    /** Available protocols for this pair. */
    protocols: DEXId[];
    
    /** Best liquidity depth. */
    liquidityDepth: string;
    
    /** Historical volume. */
    volume24h: string;
    
    /** Price impact for standard size. */
    priceImpact: number;
  }>;
  
  /** Token centrality score in the graph. */
  centralityScore: number;
  
  /** Last graph update. */
  lastUpdated: number;
}

/**
 * Livshits opportunity matrix for precomputed arbitrage paths.
 */
interface LivshitsOpportunityMatrix {
  /** Chain identifier. */
  chain: SupportedChain;
  
  /** Matrix dimensions. */
  dimensions: {
    tokenCount: number;
    protocolCount: number;
    totalPairs: number;
  };
  
  /** Precomputed opportunity routes. */
  opportunities: Map<string, Map<string, PrecomputedRoute[]>>;
  
  /** Matrix computation metadata. */
  metadata: {
    computationTime: number;
    lastUpdated: number;
    algorithmVersion: string;
    heuristicUsed: LivshitsHeuristic;
    convergenceAchieved: boolean;
  };
  
  /** Performance statistics. */
  performance: {
    opportunitiesFound: number;
    averageProfitability: number;
    gasEfficiencyScore: number;
    riskScore: number;
  };
}

/**
 * Precomputed route based on Livshits algorithms.
 */
interface PrecomputedRoute {
  /** Route identifier. */
  id: string;
  
  /** Input token. */
  tokenIn: TokenInfo;
  
  /** Output token. */
  tokenOut: TokenInfo;
  
  /** Route path through protocols. */
  path: RouteHop[];
  
  /** Expected profitability. */
  profitability: {
    /** Expected profit in USD. */
    expectedProfitUSD: string;
    
    /** Expected profit percentage. */
    expectedProfitPercent: number;
    
    /** Confidence interval. */
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  };
  
  /** Risk assessment. */
  risk: {
    /** Overall risk score (0-100). */
    riskScore: number;
    
    /** MEV vulnerability. */
    mevRisk: number;
    
    /** Liquidation risk. */
    liquidationRisk: number;
    
    /** Slippage risk. */
    slippageRisk: number;
    
    /** Gas price volatility risk. */
    gasRisk: number;
  };
  
  /** Execution parameters. */
  execution: {
    /** Estimated gas cost. */
    gasEstimate: string;
    
    /** Expected execution time. */
    executionTimeMs: number;
    
    /** Required confirmations. */
    confirmations: number;
    
    /** MEV protection enabled. */
    mevProtected: boolean;
  };
  
  /** Route validation. */
  validation: {
    /** Route is currently valid. */
    isValid: boolean;
    
    /** Validation timestamp. */
    validatedAt: number;
    
    /** Validation errors. */
    errors: string[];
    
    /** Validation warnings. */
    warnings: string[];
  };
  
  /** Livshits-specific metrics. */
  livshitsMetrics: {
    /** Heuristic score. */
    heuristicScore: number;
    
    /** Graph distance. */
    graphDistance: number;
    
    /** Centrality bonus. */
    centralityBonus: number;
    
    /** Liquidity penalty. */
    liquidityPenalty: number;
  };
}

/**
 * Route hop in a multi-protocol path.
 */
interface RouteHop {
  /** Protocol used for this hop. */
  protocol: DEXProtocol;
  
  /** Pool or pair address. */
  poolAddress: Address;
  
  /** Input token for this hop. */
  tokenIn: TokenInfo;
  
  /** Output token for this hop. */
  tokenOut: TokenInfo;
  
  /** Amount in. */
  amountIn: string;
  
  /** Expected amount out. */
  expectedAmountOut: string;
  
  /** Price impact for this hop. */
  priceImpact: number;
  
  /** Gas cost for this hop. */
  gasEstimate: string;
  
  /** Pool liquidity depth. */
  liquidityDepth: string;
  
  /** Pool fee. */
  fee: number;
}

// ========================================
// MEV DETECTION AND PROTECTION TYPES
// ========================================

/**
 * MEV attack types and signatures.
 */
type MEVAttackType = 
  | 'front-running'       // Front-running attacks
  | 'back-running'        // Back-running attacks
  | 'sandwich'            // Sandwich attacks
  | 'atomic-arbitrage'    // Atomic arbitrage
  | 'liquidation'         // MEV liquidations
  | 'jit-liquidity'       // Just-in-time liquidity
  | 'time-bandit'         // Time bandit attacks
  | 'uncle-bandit'        // Uncle bandit attacks
  | 'selfish-mining'      // Selfish mining
  | 'censorship'          // Transaction censorship
  | 'reorg'               // Chain reorganization
  | 'flashloan'           // Flash loan exploitation
  | 'governance'          // Governance attacks
  | 'oracle-manipulation' // Oracle price manipulation
  | 'cross-chain'         // Cross-chain MEV
  | 'unknown';            // Unknown MEV type

/**
 * MEV signature patterns for detection.
 */
interface MEVSignature {
  /** Attack type. */
  type: MEVAttackType;
  
  /** Pattern confidence (0-100). */
  confidence: number;
  
  /** Detection patterns. */
  patterns: {
    /** Transaction pattern. */
    txPattern: string[];
    
    /** Gas price pattern. */
    gasPricePattern: number[];
    
    /** Timing pattern. */
    timingPattern: number[];
    
    /** Value pattern. */
    valuePattern: string[];
  };
  
  /** Historical frequency. */
  frequency: {
    /** Daily occurrences. */
    daily: number;
    
    /** Weekly occurrences. */
    weekly: number;
    
    /** Monthly occurrences. */
    monthly: number;
  };
  
  /** Impact assessment. */
  impact: {
    /** Average value extracted. */
    averageValue: string;
    
    /** Maximum observed value. */
    maxValue: string;
    
    /** Affected user count. */
    affectedUsers: number;
  };
}

/**
 * Real-time MEV detection result.
 */
interface MEVDetectionResult {
  /** Detection timestamp. */
  timestamp: number;
  
  /** Transaction hash being analyzed. */
  transactionHash: string;
  
  /** Block number. */
  blockNumber: number;
  
  /** Detected MEV attacks. */
  detectedAttacks: Array<{
    /** Attack type. */
    type: MEVAttackType;
    
    /** Detection confidence. */
    confidence: number;
    
    /** Estimated extracted value. */
    extractedValue: string;
    
    /** Affected transactions. */
    affectedTxs: string[];
    
    /** Attack metadata. */
    metadata: Record<string, unknown>;
  }>;
  
  /** Protection recommendations. */
  recommendations: Array<{
    /** Recommendation type. */
    type: 'avoid' | 'delay' | 'private-pool' | 'gas-adjust' | 'route-change';
    
    /** Recommendation message. */
    message: string;
    
    /** Urgency level. */
    urgency: 'low' | 'medium' | 'high' | 'critical';
    
    /** Additional parameters. */
    parameters: Record<string, unknown>;
  }>;
  
  /** Risk assessment. */
  riskAssessment: {
    /** Overall risk level. */
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    
    /** MEV probability. */
    mevProbability: number;
    
    /** Potential loss estimate. */
    potentialLoss: string;
    
    /** Confidence in assessment. */
    confidence: number;
  };
}

/**
 * MEV protection configuration.
 */
interface MEVProtectionConfig {
  /** Protection enabled. */
  enabled: boolean;
  
  /** Protection strategies. */
  strategies: {
    /** Use private mempool. */
    privateMempool: boolean;
    
    /** Use Flashbots protection. */
    flashbotsProtection: boolean;
    
    /** Dynamic gas pricing. */
    dynamicGasPricing: boolean;
    
    /** Transaction timing randomization. */
    timingRandomization: boolean;
    
    /** Route obfuscation. */
    routeObfuscation: boolean;
    
    /** Commit-reveal schemes. */
    commitReveal: boolean;
  };
  
  /** Protection thresholds. */
  thresholds: {
    /** Maximum MEV risk tolerance. */
    maxMEVRisk: number;
    
    /** Minimum protection score required. */
    minProtectionScore: number;
    
    /** Maximum acceptable slippage increase. */
    maxSlippageIncrease: number;
    
    /** Maximum gas premium for protection. */
    maxGasPremium: number;
  };
  
  /** Advanced settings. */
  advanced: {
    /** Custom protection algorithms. */
    customAlgorithms: string[];
    
    /** Machine learning models. */
    mlModels: string[];
    
    /** Real-time adaptation. */
    adaptiveProtection: boolean;
    
    /** Cross-chain coordination. */
    crossChainCoordination: boolean;
  };
}

// ========================================
// ZERO-LATENCY ORACLE TYPES
// ========================================

/**
 * Zero-latency price oracle configuration.
 */
interface ZeroLatencyOracleConfig {
  /** Target latency in milliseconds. */
  targetLatencyMs: number;
  
  /** Price update sources. */
  sources: {
    /** Pyth Network configuration. */
    pyth: {
      endpoint: string;
      priceIds: Record<string, string>;
      confidence: number;
      updateThreshold: number;
    };
    
    /** Chainlink feed configuration. */
    chainlink: {
      feeds: Record<string, Address>;
      updateThreshold: number;
      stalenessThreshold: number;
    };
    
    /** CEX price feeds. */
    cex: {
      binance: boolean;
      coinbase: boolean;
      kraken: boolean;
      okx: boolean;
    };
    
    /** DEX price aggregation. */
    dex: {
      uniswapV3: boolean;
      curve: boolean;
      balancer: boolean;
      sushiswap: boolean;
    };
  };
  
  /** Price aggregation settings. */
  aggregation: {
    /** Aggregation method. */
    method: 'weighted-average' | 'median' | 'best-quality' | 'consensus';
    
    /** Minimum sources required. */
    minSources: number;
    
    /** Quality weighting enabled. */
    qualityWeighting: boolean;
    
    /** Outlier detection. */
    outlierDetection: boolean;
  };
  
  /** Performance optimization. */
  performance: {
    /** Maximum cache size. */
    maxCacheSize: number;
    
    /** Cache TTL in milliseconds. */
    cacheTTL: number;
    
    /** Prefetch popular pairs. */
    prefetchEnabled: boolean;
    
    /** Precompute derivatives. */
    precomputeDerivatives: boolean;
  };
}

/**
 * Zero-latency price point with quality metrics.
 */
interface ZeroLatencyPrice {
  /** Token address. */
  tokenAddress: Address;
  
  /** Price in USD. */
  priceUSD: string;
  
  /** Price timestamp. */
  timestamp: number;
  
  /** Price confidence (0-100). */
  confidence: number;
  
  /** Source breakdown. */
  sources: Array<{
    /** Source name. */
    source: string;
    
    /** Source price. */
    price: string;
    
    /** Source weight. */
    weight: number;
    
    /** Source latency. */
    latency: number;
  }>;
  
  /** Quality metrics. */
  quality: {
    /** Data freshness score. */
    freshness: number;
    
    /** Source diversity score. */
    diversity: number;
    
    /** Price stability score. */
    stability: number;
    
    /** Volume support score. */
    volumeSupport: number;
  };
  
  /** Market context. */
  market: {
    /** 24h volume. */
    volume24h: string;
    
    /** Market cap. */
    marketCap: string;
    
    /** Price change 24h. */
    change24h: number;
    
    /** Volatility index. */
    volatility: number;
  };
}

// ========================================
// CROSS-CHAIN ARBITRAGE TYPES
// ========================================

/**
 * Cross-chain arbitrage opportunity.
 */
interface CrossChainArbitrageOpportunity {
  /** Opportunity identifier. */
  id: string;
  
  /** Source chain. */
  sourceChain: SupportedChain;
  
  /** Destination chain. */
  destinationChain: SupportedChain;
  
  /** Arbitrage token. */
  token: TokenInfo;
  
  /** Price differential. */
  priceDifferential: {
    /** Source price. */
    sourcePrice: string;
    
    /** Destination price. */
    destinationPrice: string;
    
    /** Price difference. */
    difference: string;
    
    /** Percentage difference. */
    percentageDiff: number;
  };
  
  /** Bridge requirements. */
  bridge: {
    /** Bridge protocol. */
    protocol: string;
    
    /** Bridge fee. */
    fee: string;
    
    /** Bridge time. */
    timeMinutes: number;
    
    /** Minimum bridge amount. */
    minAmount: string;
    
    /** Maximum bridge amount. */
    maxAmount: string;
  };
  
  /** Profitability analysis. */
  profitability: {
    /** Gross profit. */
    grossProfit: string;
    
    /** Net profit after fees. */
    netProfit: string;
    
    /** Profit margin percentage. */
    marginPercent: number;
    
    /** Break-even amount. */
    breakEvenAmount: string;
  };
  
  /** Risk factors. */
  risks: {
    /** Bridge failure risk. */
    bridgeRisk: number;
    
    /** Price movement risk. */
    priceRisk: number;
    
    /** Liquidity risk. */
    liquidityRisk: number;
    
    /** Regulatory risk. */
    regulatoryRisk: number;
  };
  
  /** Execution strategy. */
  execution: {
    /** Recommended execution size. */
    recommendedSize: string;
    
    /** Execution steps. */
    steps: Array<{
      step: number;
      action: string;
      chain: SupportedChain;
      estimatedTime: number;
    }>;
    
    /** Total execution time. */
    totalTimeMinutes: number;
  };
}

// ========================================
// PERFORMANCE MONITORING TYPES
// ========================================

/**
 * Livshits algorithm performance metrics.
 */
interface LivshitsPerformanceMetrics {
  /** Algorithm execution metrics. */
  execution: {
    /** Average computation time. */
    avgComputationTime: number;
    
    /** Matrix recomputation cycles. */
    recomputationCycles: number;
    
    /** Route discovery success rate. */
    discoverySuccessRate: number;
    
    /** Graph traversal efficiency. */
    graphTraversalEfficiency: number;
  };
  
  /** Opportunity detection metrics. */
  opportunities: {
    /** Total opportunities found. */
    totalOpportunities: number;
    
    /** Profitable opportunities. */
    profitableOpportunities: number;
    
    /** Average profit margin. */
    avgProfitMargin: number;
    
    /** Success rate of executed opportunities. */
    executionSuccessRate: number;
  };
  
  /** System performance metrics. */
  system: {
    /** Memory usage MB. */
    memoryUsageMB: number;
    
    /** CPU utilization percentage. */
    cpuUtilization: number;
    
    /** Cache hit rate. */
    cacheHitRate: number;
    
    /** API response time. */
    apiResponseTime: number;
  };
  
  /** Quality metrics. */
  quality: {
    /** Prediction accuracy. */
    predictionAccuracy: number;
    
    /** False positive rate. */
    falsePositiveRate: number;
    
    /** Risk assessment accuracy. */
    riskAssessmentAccuracy: number;
    
    /** Model drift detection. */
    modelDrift: number;
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  OptimizationObjective,
  LivshitsHeuristic,
  MEVAttackType,
  ProtocolGraphNode,
  TokenGraphNode,
  LivshitsOpportunityMatrix,
  PrecomputedRoute,
  RouteHop,
  MEVSignature,
  MEVDetectionResult,
  MEVProtectionConfig,
  ZeroLatencyOracleConfig,
  ZeroLatencyPrice,
  CrossChainArbitrageOpportunity,
  LivshitsPerformanceMetrics
}; 