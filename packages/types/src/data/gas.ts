/**
 * @file Gas Price Types and Optimization.
 * 
 * Gas price tracking, prediction, and optimization types for
 * multi-chain gas cost management and strategy optimization.
 * 
 * Features:
 * - Multi-chain gas price tracking
 * - Gas price prediction and forecasting
 * - Gas optimization strategies
 * - Historical gas analytics
 * - Gas price alerts and notifications.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { TransactionType } from '../blockchain/transactions';

// ========================================
// CORE GAS TYPES
// ========================================

/**
 * Gas price sources.
 */
type GasSource = 
  | 'eth-gas-station'
  | 'gas-now'
  | 'blocknative'
  | 'flashbots'
  | 'bloxroute'
  | 'polygon-gas'
  | 'bsc-gas'
  | 'node-rpc'
  | 'internal'
  | 'composite';

/**
 * Gas price tiers for different urgency levels.
 */
type GasTier = 'slow' | 'standard' | 'fast' | 'instant' | 'custom';

/**
 * Gas price unit types.
 */
type GasUnit = 'gwei' | 'wei' | 'lamports' | 'units';

// ========================================
// GAS PRICE STRUCTURES (moved before use)
// ========================================

/**
 * Individual gas price tier.
 */
interface GasPriceTier {
  /** Gas price. */
  gasPrice: string;
  
  /** Gas price unit. */
  unit: GasUnit;
  
  /** Max fee per gas (EIP-1559). */
  maxFeePerGas?: string;
  
  /** Max priority fee per gas (EIP-1559). */
  maxPriorityFeePerGas?: string;
  
  /** Estimated confirmation time (seconds). */
  estimatedTime: number;
  
  /** Confidence level (0-1). */
  confidence: number;
  
  /** Success probability. */
  successRate: number;
}

/**
 * Gas price metadata.
 */
interface GasPriceMetadata {
  /** Block number when fetched. */
  blockNumber?: number;
  
  /** Pending transaction count. */
  pendingTxCount?: number;
  
  /** Base fee next block. */
  nextBaseFee?: string;
  
  /** Fee history data. */
  feeHistory?: {
    blocks: number;
    percentiles: number[];
    fees: string[][];
  };
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Current gas price information.
 */
interface GasPrice {
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Gas price source. */
  source: GasSource;
  
  /** Timestamp of gas price data. */
  timestamp: number;
  
  /** Gas price tiers. */
  tiers: {
    slow: GasPriceTier;
    standard: GasPriceTier;
    fast: GasPriceTier;
    instant: GasPriceTier;
  };
  
  /** Base fee (EIP-1559 chains). */
  baseFee?: string;
  
  /** Network congestion level. */
  congestion: 'low' | 'medium' | 'high' | 'extreme';
  
  /** Gas price metadata. */
  metadata: GasPriceMetadata;
}

// ========================================
// GAS OPTIMIZATION TYPES (moved before use)
// ========================================

/**
 * Gas strategy parameters.
 */
interface GasStrategyParameters {
  /** Base gas multiplier. */
  baseMultiplier: number;
  
  /** Maximum gas price. */
  maxGasPrice: string;
  
  /** Minimum gas price. */
  minGasPrice: string;
  
  /** Priority fee multiplier. */
  priorityFeeMultiplier: number;
  
  /** Gas price escalation strategy. */
  escalation: {
    enabled: boolean;
    incrementPercentage: number;
    maxAttempts: number;
    intervalMs: number;
  };
  
  /** Time-based adjustments. */
  timeAdjustments: {
    enabled: boolean;
    peakHourMultiplier: number;
    offPeakMultiplier: number;
    weekendMultiplier: number;
  };
}

/**
 * Dynamic gas adjustment rules.
 */
interface GasDynamicRules {
  /** Network congestion adjustments. */
  congestionRules: {
    lowCongestion: number;    // Multiplier for low congestion
    mediumCongestion: number; // Multiplier for medium congestion
    highCongestion: number;   // Multiplier for high congestion
    extremeCongestion: number; // Multiplier for extreme congestion
  };
  
  /** Mempool size adjustments. */
  mempoolRules: {
    lowMempool: number;    // < 1000 pending txs
    mediumMempool: number; // 1000-5000 pending txs
    highMempool: number;   // 5000-10000 pending txs
    extremeMempool: number; // > 10000 pending txs
  };
  
  /** Block fullness adjustments. */
  blockFullnessRules: {
    belowTarget: number;   // Block < 50% full
    nearTarget: number;    // Block 50-80% full
    aboveTarget: number;   // Block 80-95% full
    atCapacity: number;    // Block > 95% full
  };
}

/**
 * Gas strategy performance metrics.
 */
interface GasStrategyPerformance {
  /** Performance period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Total transactions. */
  totalTransactions: number;
  
  /** Success metrics. */
  success: {
    successfulTxs: number;
    successRate: number;
    averageConfirmationTime: number;
  };
  
  /** Cost metrics. */
  costs: {
    totalGasCost: string;
    averageGasCost: string;
    gasSavings: string;
    overpaymentRate: number;
  };
  
  /** Speed metrics. */
  speed: {
    averageConfirmationBlocks: number;
    fastestConfirmation: number;
    slowestConfirmation: number;
  };
  
  /** Efficiency score. */
  efficiencyScore: number;
}

/**
 * Gas optimization strategy.
 */
interface GasOptimizationStrategy {
  /** Strategy identifier. */
  id: string;
  
  /** Strategy name. */
  name: string;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Optimization objective. */
  objective: 'cost' | 'speed' | 'success-rate' | 'balanced';
  
  /** Strategy parameters. */
  parameters: GasStrategyParameters;
  
  /** Dynamic adjustment rules. */
  dynamicRules: GasDynamicRules;
  
  /** Strategy performance. */
  performance: GasStrategyPerformance;
}

// ========================================
// GAS PREDICTION TYPES (moved before use)
// ========================================

/**
 * Individual gas price prediction point.
 */
interface GasPricePredictionPoint {
  /** Predicted gas price. */
  gasPrice: string;
  
  /** Prediction confidence. */
  confidence: number;
  
  /** Upper bound. */
  upperBound: string;
  
  /** Lower bound. */
  lowerBound: string;
  
  /** Probability of execution. */
  executionProbability: number;
}

/**
 * Gas price forecast for specific time horizon.
 */
interface GasPriceForecast {
  /** Time horizon. */
  horizon: string;
  
  /** Predicted gas prices by tier. */
  predictions: {
    slow: GasPricePredictionPoint;
    standard: GasPricePredictionPoint;
    fast: GasPricePredictionPoint;
    instant: GasPricePredictionPoint;
  };
  
  /** Prediction confidence. */
  confidence: number;
  
  /** Prediction range. */
  range: {
    min: string;
    max: string;
    mostLikely: string;
  };
}

/**
 * Gas price prediction.
 */
interface GasPricePrediction {
  /** Target chain. */
  chain: SupportedChain;
  
  /** Prediction timestamp. */
  timestamp: number;
  
  /** Time horizons. */
  horizons: {
    next1Block: GasPriceForecast;
    next5Blocks: GasPriceForecast;
    next10Blocks: GasPriceForecast;
    next1Hour: GasPriceForecast;
    next4Hours: GasPriceForecast;
    next24Hours: GasPriceForecast;
  };
  
  /** Prediction model information. */
  model: {
    name: string;
    version: string;
    accuracy: number;
    lastTrained: number;
  };
  
  /** Market factors. */
  factors: {
    networkActivity: number;
    dexVolume: number;
    nftActivity: number;
    bridgeActivity: number;
    arbitrageActivity: number;
  };
}

// ========================================
// GAS ANALYTICS TYPES
// ========================================

/**
 * Historical gas analytics.
 */
interface GasAnalytics {
  /** Target chain. */
  chain: SupportedChain;
  
  /** Analysis period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Price statistics. */
  priceStats: {
    average: string;
    median: string;
    min: string;
    max: string;
    standardDeviation: number;
    percentiles: {
      p10: string;
      p25: string;
      p50: string;
      p75: string;
      p90: string;
      p95: string;
      p99: string;
    };
  };
  
  /** Time-based patterns. */
  patterns: {
    hourlyAverage: Record<string, string>;
    dailyAverage: Record<string, string>;
    weeklyTrends: Array<{
      week: number;
      average: string;
      volume: number;
    }>;
  };
  
  /** Congestion analysis. */
  congestion: {
    averageCongestionLevel: number;
    peakCongestionTimes: Array<{
      time: number;
      level: string;
      duration: number;
    }>;
    congestionCorrelation: number;
  };
  
  /** Cost optimization insights. */
  insights: {
    optimalTimes: Array<{
      time: number;
      gasSavings: string;
    }>;
    costDistribution: Record<GasTier, number>;
    savingsOpportunities: string[];
  };
}

// ========================================
// GAS MONITORING TYPES (moved before use)
// ========================================

/**
 * Gas alert parameters.
 */
interface GasAlertParameters {
  /** Gas price threshold. */
  threshold?: string;
  
  /** Percentage change threshold. */
  changePercentage?: number;
  
  /** Time window for analysis. */
  timeWindow?: number;
  
  /** Minimum duration. */
  minDuration?: number;
  
  /** Congestion level threshold. */
  congestionLevel?: 'medium' | 'high' | 'extreme';
  
  /** Custom conditions. */
  customConditions?: Record<string, string | number | boolean>;
}

/**
 * Gas price alert configuration.
 */
interface GasAlert {
  /** Alert identifier. */
  id: string;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Alert type. */
  type: 'threshold' | 'spike' | 'drop' | 'trend' | 'congestion';
  
  /** Alert parameters. */
  parameters: GasAlertParameters;
  
  /** Alert status. */
  status: 'active' | 'paused' | 'triggered' | 'expired';
  
  /** Notification settings. */
  notifications: {
    webhook?: string;
    email?: string;
    slack?: string;
    telegram?: string;
  };
  
  /** Alert metadata. */
  metadata: {
    name: string;
    description?: string;
    createdAt: number;
    lastTriggered?: number;
    triggerCount: number;
  };
}

// ========================================
// GAS ESTIMATION TYPES (moved before use)
// ========================================

/**
 * Detailed gas cost breakdown.
 */
interface GasCostBreakdown {
  /** Gas price. */
  gasPrice: string;
  
  /** Gas usage. */
  gasUsage: string;
  
  /** Total cost in native token. */
  totalCostNative: string;
  
  /** Total cost in USD. */
  totalCostUsd: string;
  
  /** Base fee component. */
  baseFee?: string;
  
  /** Priority fee component. */
  priorityFee?: string;
  
  /** Estimated confirmation time. */
  confirmationTime: number;
}

/**
 * Gas cost estimation for transaction.
 */
interface GasCostEstimation {
  /** Transaction type. */
  transactionType: TransactionType;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Estimated gas usage. */
  gasUsage: string;
  
  /** Gas cost by tier. */
  costs: {
    slow: GasCostBreakdown;
    standard: GasCostBreakdown;
    fast: GasCostBreakdown;
    instant: GasCostBreakdown;
  };
  
  /** Estimation confidence. */
  confidence: number;
  
  /** Estimation timestamp. */
  timestamp: number;
  
  /** Estimation metadata. */
  metadata: {
    source: 'simulation' | 'historical' | 'static';
    accuracy: number;
    factors: string[];
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default gas limits by transaction type.
 */
const DEFAULT_GAS_LIMITS = {
  swap: {
    ethereum: '200000',
    bsc: '180000',
    polygon: '150000',
    arbitrum: '250000',
    optimism: '220000',
    avalanche: '160000',
    fantom: '140000',
    solana: '1400000',
    base: '200000'
  },
  transfer: {
    ethereum: '21000',
    bsc: '21000',
    polygon: '21000',
    arbitrum: '21000',
    optimism: '21000',
    avalanche: '21000',
    fantom: '21000',
    solana: '5000',
    base: '21000'
  },
  approve: {
    ethereum: '60000',
    bsc: '55000',
    polygon: '50000',
    arbitrum: '70000',
    optimism: '65000',
    avalanche: '55000',
    fantom: '50000',
    solana: '5000',
    base: '60000'
  },
  contractCall: {
    ethereum: '150000',
    bsc: '140000',
    polygon: '130000',
    arbitrum: '180000',
    optimism: '170000',
    avalanche: '140000',
    fantom: '130000',
    solana: '200000',
    base: '150000'
  },
  deployment: {
    ethereum: '1500000',
    bsc: '1200000',
    polygon: '1000000',
    arbitrum: '2000000',
    optimism: '1800000',
    avalanche: '1200000',
    fantom: '1000000',
    solana: '2000000',
    base: '1500000'
  },
  multicall: {
    ethereum: '400000',
    bsc: '350000',
    polygon: '300000',
    arbitrum: '500000',
    optimism: '450000',
    avalanche: '350000',
    fantom: '300000',
    solana: '1000000',
    base: '400000'
  },
  bridge: {
    ethereum: '300000',
    bsc: '250000',
    polygon: '200000',
    arbitrum: '400000',
    optimism: '350000',
    avalanche: '250000',
    fantom: '200000',
    solana: '300000',
    base: '300000'
  },
  stake: {
    ethereum: '180000',
    bsc: '160000',
    polygon: '140000',
    arbitrum: '220000',
    optimism: '200000',
    avalanche: '160000',
    fantom: '140000',
    solana: '200000',
    base: '180000'
  },
  unstake: {
    ethereum: '160000',
    bsc: '140000',
    polygon: '120000',
    arbitrum: '200000',
    optimism: '180000',
    avalanche: '140000',
    fantom: '120000',
    solana: '200000',
    base: '160000'
  },
  yieldFarm: {
    ethereum: '250000',
    bsc: '220000',
    polygon: '200000',
    arbitrum: '300000',
    optimism: '280000',
    avalanche: '220000',
    fantom: '200000',
    solana: '400000',
    base: '250000'
  },
  liquidity: {
    ethereum: '220000',
    bsc: '200000',
    polygon: '180000',
    arbitrum: '280000',
    optimism: '260000',
    avalanche: '200000',
    fantom: '180000',
    solana: '300000',
    base: '220000'
  },
  governance: {
    ethereum: '120000',
    bsc: '100000',
    polygon: '80000',
    arbitrum: '150000',
    optimism: '140000',
    avalanche: '100000',
    fantom: '80000',
    solana: '100000',
    base: '120000'
  },
  other: {
    ethereum: '100000',
    bsc: '90000',
    polygon: '80000',
    arbitrum: '120000',
    optimism: '110000',
    avalanche: '90000',
    fantom: '80000',
    solana: '150000',
    base: '100000'
  }
} as const;

/**
 * Gas price safety thresholds (in GWEI for EVM chains).
 */
const GAS_SAFETY_THRESHOLDS = {
  ethereum: { warning: '50', critical: '200' },
  bsc: { warning: '10', critical: '50' },
  polygon: { warning: '100', critical: '500' },
  arbitrum: { warning: '2', critical: '10' },
  optimism: { warning: '2', critical: '10' },
  avalanche: { warning: '30', critical: '100' },
  fantom: { warning: '100', critical: '500' },
  solana: { warning: '0.001', critical: '0.01' },
  base: { warning: '2', critical: '10' }
} as const;

// Consolidated export declaration
export type {
  GasSource,
  GasTier,
  GasUnit,
  GasPriceTier,
  GasPriceMetadata,
  GasPrice,
  GasStrategyParameters,
  GasDynamicRules,
  GasStrategyPerformance,
  GasOptimizationStrategy,
  GasPricePredictionPoint,
  GasPriceForecast,
  GasPricePrediction,
  GasAnalytics,
  GasAlertParameters,
  GasAlert,
  GasCostBreakdown,
  GasCostEstimation
};

export {
  DEFAULT_GAS_LIMITS,
  GAS_SAFETY_THRESHOLDS
};
