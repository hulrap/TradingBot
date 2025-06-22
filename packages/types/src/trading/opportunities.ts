/**
 * @file Trading Opportunity Types.
 * 
 * Opportunity detection, classification, and evaluation types for
 * various trading strategies including arbitrage, MEV, and yield farming.
 * 
 * Features:
 * - Multi-strategy opportunity detection
 * - Opportunity scoring and ranking
 * - Risk assessment and validation
 * - Real-time opportunity tracking
 * - Historical opportunity analysis.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SwapRoute } from './routes';
import type { Address, TokenInfo } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';


// ========================================
// CORE OPPORTUNITY TYPES
// ========================================

/**
 * Opportunity identifier.
 */
type OpportunityId = string;

/**
 * Trading opportunity types.
 */
type OpportunityType =
  | 'arbitrage'      // Price difference arbitrage
  | 'sandwich'       // MEV sandwich attacks
  | 'frontrun'       // MEV frontrunning
  | 'backrun'        // MEV backrunning
  | 'liquidation'    // Liquidation opportunities
  | 'yield-farming'  // Yield farming optimization
  | 'flash-loan'     // Flash loan arbitrage
  | 'cross-chain'    // Cross-chain arbitrage
  | 'dex-arb'        // DEX-to-DEX arbitrage
  | 'cex-dex'        // CEX-to-DEX arbitrage
  | 'statistical'    // Statistical arbitrage
  | 'governance'     // Governance arbitrage
  | 'nft-arb'        // NFT arbitrage
  | 'options-arb'    // Options arbitrage
  | 'funding-rate';  // Funding rate arbitrage

/**
 * Opportunity status enumeration.
 */
type OpportunityStatus =
  | 'detected'    // Opportunity just detected
  | 'validated'   // Opportunity validated and viable
  | 'executing'   // Currently being executed
  | 'executed'    // Successfully executed
  | 'failed'      // Execution failed
  | 'expired'     // Opportunity expired
  | 'cancelled'   // Execution cancelled
  | 'stale'       // Opportunity data is stale
  | 'blocked';    // Opportunity blocked by filters

/**
 * Opportunity priority levels.
 */
type OpportunityPriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

// ========================================
// OPPORTUNITY ANALYSIS TYPES (moved before BaseOpportunity)
// ========================================

/**
 * Opportunity risk assessment.
 */
interface OpportunityRisk {
  /** Overall risk score (0-100). */
  riskScore: number;
  
  /** Risk factors breakdown. */
  factors: {
    /** Market/price risk. */
    marketRisk: number;
    
    /** Liquidity risk. */
    liquidityRisk: number;
    
    /** Execution risk. */
    executionRisk: number;
    
    /** Gas price risk. */
    gasRisk: number;
    
    /** Competition risk. */
    competitionRisk: number;
    
    /** Smart contract risk. */
    contractRisk: number;
    
    /** Slippage risk. */
    slippageRisk: number;
    
    /** MEV risk. */
    mevRisk: number;
  };
  
  /** Risk mitigation strategies. */
  mitigation: string[];
  
  /** Risk warnings. */
  warnings: string[];
  
  /** Maximum acceptable loss. */
  maxLoss: string;
  
  /** Stop-loss recommendations. */
  stopLoss?: {
    price: string;
    percentage: number;
  };
}

/**
 * Opportunity execution complexity.
 */
interface OpportunityComplexity {
  /** Complexity score (0-100). */
  score: number;
  
  /** Number of transactions required. */
  transactionCount: number;
  
  /** Number of contracts involved. */
  contractCount: number;
  
  /** Cross-chain operations required. */
  crossChainRequired: boolean;
  
  /** Flash loans required. */
  flashLoansRequired: boolean;
  
  /** MEV protection required. */
  mevProtectionRequired: boolean;
  
  /** Execution dependencies. */
  dependencies: string[];
  
  /** Estimated execution time. */
  estimatedExecutionTime: number;
  
  /** Success probability. */
  successProbability: number;
}

/**
 * Opportunity metadata and context.
 */
interface OpportunityMetadata {
  /** Detection source. */
  source: string;
  
  /** Detection algorithm. */
  algorithm: string;
  
  /** Detection confidence. */
  confidence: number;
  
  /** Historical performance. */
  historical?: {
    similarOpportunities: number;
    averageProfit: string;
    successRate: number;
    lastSeen: number;
  };
  
  /** Market conditions. */
  marketConditions: {
    volatility: number;
    volume24h: string;
    liquidityIndex: number;
    gasPrice: string;
    networkCongestion: 'low' | 'medium' | 'high';
  };
  
  /** Custom tags. */
  tags: string[];
  
  /** Additional custom data. */
  custom: Record<string, string | number | boolean>;
}

// ========================================
// BASE OPPORTUNITY INTERFACE
// ========================================

/**
 * Base opportunity interface with common properties.
 */
interface BaseOpportunity {
  /** Unique opportunity identifier. */
  id: OpportunityId;
  
  /** Opportunity type. */
  type: OpportunityType;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Opportunity status. */
  status: OpportunityStatus;
  
  /** Priority level. */
  priority: OpportunityPriority;
  
  /** Detection timestamp. */
  detectedAt: number;
  
  /** Opportunity expiration. */
  expiresAt: number;
  
  /** Expected profit in USD. */
  expectedProfitUsd: string;
  
  /** Profit confidence (0-1). */
  profitConfidence: number;
  
  /** Required capital in USD. */
  requiredCapitalUsd: string;
  
  /** Gas cost estimate in USD. */
  gasCostUsd: string;
  
  /** Net profit (profit - gas). */
  netProfitUsd: string;
  
  /** Profit percentage. */
  profitPercentage: number;
  
  /** Risk assessment. */
  risk: OpportunityRisk;
  
  /** Execution complexity. */
  complexity: OpportunityComplexity;
  
  /** Opportunity metadata. */
  metadata: OpportunityMetadata;
}

// ========================================
// ARBITRAGE OPPORTUNITIES
// ========================================

/**
 * Arbitrage opportunity between exchanges/pools.
 */
interface ArbitrageOpportunity extends BaseOpportunity {
  type: 'arbitrage' | 'dex-arb' | 'cex-dex' | 'cross-chain';
  
  /** Token being arbitraged. */
  token: TokenInfo;
  
  /** Buy venue information. */
  buyVenue: {
    name: string;
    type: 'dex' | 'cex' | 'pool';
    address?: Address;
    price: string;
    liquidity: string;
    fee: number;
  };
  
  /** Sell venue information. */
  sellVenue: {
    name: string;
    type: 'dex' | 'cex' | 'pool';
    address?: Address;
    price: string;
    liquidity: string;
    fee: number;
  };
  
  /** Price spread percentage. */
  priceSpread: number;
  
  /** Maximum trade size. */
  maxTradeSize: string;
  
  /** Optimal trade size. */
  optimalTradeSize: string;
  
  /** Buy route. */
  buyRoute: SwapRoute;
  
  /** Sell route. */
  sellRoute: SwapRoute;
  
  /** Cross-chain information (if applicable). */
  crossChain?: {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    bridgeProtocol: string;
    bridgeFee: string;
    bridgeTime: number;
  };
  
  /** Historical data. */
  historical: {
    averageSpread: number;
    maxSpread: number;
    frequency: number;
    lastOccurrence: number;
  };
}

// ========================================
// MEV OPPORTUNITIES
// ========================================

/**
 * MEV sandwich opportunity.
 */
interface SandwichOpportunity extends BaseOpportunity {
  type: 'sandwich';
  
  /** Victim transaction details. */
  victimTx: {
    hash: string;
    from: Address;
    to: Address;
    value: string;
    gasPrice: string;
    deadline: number;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
    amountIn: string;
    minAmountOut: string;
    slippageTolerance: number;
  };
  
  /** Target pool information. */
  targetPool: {
    address: Address;
    protocol: string;
    token0: TokenInfo;
    token1: TokenInfo;
    reserves: {
      token0: string;
      token1: string;
    };
    fee: number;
  };
  
  /** Frontrun transaction parameters. */
  frontrunTx: {
    amountIn: string;
    expectedAmountOut: string;
    gasPrice: string;
    priceImpact: number;
  };
  
  /** Backrun transaction parameters. */
  backrunTx: {
    amountIn: string;
    expectedAmountOut: string;
    gasPrice: string;
    priceImpact: number;
  };
  
  /** MEV bundle configuration. */
  bundle: {
    targetBlock: number;
    bundleSize: number;
    bribesRequired: string;
    bundleScore: number;
  };
  
  /** Competition analysis. */
  competition: {
    competitorCount: number;
    averageGasPrice: string;
    maxObservedGasPrice: string;
    estimatedCompetition: 'low' | 'medium' | 'high';
  };
}

/**
 * MEV frontrunning opportunity.
 */
interface FrontrunOpportunity extends BaseOpportunity {
  type: 'frontrun';
  
  /** Target transaction to frontrun. */
  targetTx: {
    hash: string;
    from: Address;
    gasPrice: string;
    value: string;
    data: string;
    impact: 'price-increase' | 'arbitrage' | 'liquidation';
  };
  
  /** Frontrun strategy. */
  strategy: {
    type: 'copy-trade' | 'arbitrage-setup' | 'liquidity-provision';
    parameters: Record<string, string | number | boolean>;
  };
  
  /** Gas bidding strategy. */
  gasBidding: {
    minGasPrice: string;
    maxGasPrice: string;
    bidStrategy: 'linear' | 'exponential' | 'competitive';
    currentBid: string;
  };
  
  /** Timing requirements. */
  timing: {
    maxDelay: number;
    optimalDelay: number;
    blockTargets: number[];
  };
}

// ========================================
// SPECIALIZED OPPORTUNITIES
// ========================================

/**
 * Liquidation opportunity.
 */
interface LiquidationOpportunity extends BaseOpportunity {
  type: 'liquidation';
  
  /** Lending protocol. */
  protocol: string;
  
  /** Account to liquidate. */
  account: Address;
  
  /** Collateral information. */
  collateral: {
    token: TokenInfo;
    amount: string;
    value: string;
  };
  
  /** Debt information. */
  debt: {
    token: TokenInfo;
    amount: string;
    value: string;
  };
  
  /** Health factor. */
  healthFactor: number;
  
  /** Liquidation parameters. */
  liquidationParams: {
    maxLiquidationAmount: string;
    liquidationBonus: number;
    penaltyRate: number;
    minHealthFactor: number;
  };
  
  /** Flash loan requirements. */
  flashLoan?: {
    required: boolean;
    amount: string;
    fee: number;
    provider: string;
  };
}

/**
 * Yield farming opportunity.
 */
interface YieldFarmOpportunity extends BaseOpportunity {
  type: 'yield-farming';
  
  /** Yield protocol. */
  protocol: string;
  
  /** Pool/farm information. */
  pool: {
    address: Address;
    tokens: TokenInfo[];
    apy: number;
    tvl: string;
    rewards: Array<{
      token: TokenInfo;
      rate: string;
      apy: number;
    }>;
  };
  
  /** Entry strategy. */
  entryStrategy: {
    requiredTokens: TokenInfo[];
    swapRoutes: SwapRoute[];
    totalCost: string;
  };
  
  /** Exit strategy. */
  exitStrategy: {
    unstakingTime: number;
    withdrawalFees: number;
    swapRoutes: SwapRoute[];
  };
  
  /** Risk factors. */
  riskFactors: {
    impermanentLoss: number;
    smartContractRisk: number;
    liquidityRisk: number;
    tokenRisk: number;
  };
}

// ========================================
// OPPORTUNITY FILTERING AND RANKING
// ========================================

/**
 * Opportunity filter criteria.
 */
interface OpportunityFilter {
  /** Opportunity types to include. */
  types?: OpportunityType[];
  
  /** Minimum profit threshold. */
  minProfitUsd?: string;
  
  /** Minimum profit percentage. */
  minProfitPercentage?: number;
  
  /** Maximum risk score. */
  maxRiskScore?: number;
  
  /** Target chains. */
  chains?: SupportedChain[];
  
  /** Maximum complexity score. */
  maxComplexity?: number;
  
  /** Minimum confidence level. */
  minConfidence?: number;
  
  /** Maximum capital requirement. */
  maxCapitalUsd?: string;
  
  /** Priority levels. */
  priorities?: OpportunityPriority[];
  
  /** Custom filters. */
  custom?: Record<string, string | number | boolean>;
}

/**
 * Opportunity ranking criteria.
 */
interface OpportunityRanking {
  /** Ranking weights. */
  weights: {
    profit: number;
    risk: number;
    confidence: number;
    speed: number;
    complexity: number;
  };
  
  /** Ranking algorithm. */
  algorithm: 'weighted-score' | 'profit-first' | 'risk-adjusted' | 'custom';
  
  /** Risk tolerance. */
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  
  /** Time horizon. */
  timeHorizon: 'immediate' | 'short-term' | 'medium-term';
}

/**
 * Opportunity ranking result.
 */
interface OpportunityRankingResult {
  /** Ranked opportunities. */
  opportunities: Array<{
    opportunity: BaseOpportunity;
    rank: number;
    score: number;
    reasoning: string[];
  }>;
  
  /** Ranking metadata. */
  metadata: {
    totalOpportunities: number;
    rankingTime: number;
    algorithm: string;
    criteria: OpportunityRanking;
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Minimum profit thresholds by opportunity type.
 */
const MIN_PROFIT_THRESHOLDS = {
  arbitrage: '10',
  sandwich: '50',
  frontrun: '20',
  backrun: '15',
  liquidation: '100',
  yieldFarming: '500',
  flashLoan: '25',
  crossChain: '100',
  dexArb: '15',
  cexDex: '30',
  statistical: '20',
  governance: '200',
  nftArb: '50',
  optionsArb: '100',
  fundingRate: '75'
} as const;

/**
 * Opportunity expiration times (in milliseconds).
 */
const OPPORTUNITY_EXPIRY_TIMES = {
  arbitrage: 30000,      // 30 seconds
  sandwich: 15000,       // 15 seconds  
  frontrun: 10000,       // 10 seconds
  backrun: 5000,         // 5 seconds
  liquidation: 300000,   // 5 minutes
  yieldFarming: 3600000, // 1 hour
  flashLoan: 30000,     // 30 seconds
  crossChain: 1800000,  // 30 minutes
  dexArb: 20000,        // 20 seconds
  cexDex: 60000,        // 1 minute
  statistical: 600000,   // 10 minutes
  governance: 86400000,  // 24 hours
  nftArb: 1800000,      // 30 minutes
  optionsArb: 3600000,  // 1 hour
  fundingRate: 28800000 // 8 hours
} as const;

// Consolidated export declaration
export type {
  OpportunityId,
  OpportunityType,
  OpportunityStatus,
  OpportunityPriority,
  OpportunityRisk,
  OpportunityComplexity,
  OpportunityMetadata,
  BaseOpportunity,
  ArbitrageOpportunity,
  SandwichOpportunity,
  FrontrunOpportunity,
  LiquidationOpportunity,
  YieldFarmOpportunity,
  OpportunityFilter,
  OpportunityRanking,
  OpportunityRankingResult
};

export {
  MIN_PROFIT_THRESHOLDS,
  OPPORTUNITY_EXPIRY_TIMES
};
