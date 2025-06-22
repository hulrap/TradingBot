/**
 * @file Mempool Monitoring and Transaction Analysis Types.
 * 
 * Mempool transaction tracking, MEV detection, and transaction
 * analysis types for real-time blockchain monitoring.
 * 
 * Features:
 * - Real-time mempool monitoring
 * - MEV opportunity detection
 * - Transaction classification and analysis
 * - Frontrunning and sandwich detection
 * - Mempool statistics and analytics.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address, TokenInfo } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';
import type { TransactionHash, TransactionType } from '../blockchain/transactions';

// ========================================
// CORE MEMPOOL TYPES
// ========================================

/**
 * Mempool data sources.
 */
type MempoolSource = 
  | 'bloxroute'
  | 'flashbots'
  | 'alchemy'
  | 'quicknode'
  | 'infura'
  | 'node-rpc'
  | 'chainstack'
  | 'tenderly'
  | 'blocknative'
  | 'internal';

/**
 * Transaction classification in mempool.
 */
type TransactionClass = 
  | 'normal'         // Regular transaction
  | 'arbitrage'      // Arbitrage opportunity
  | 'sandwich'       // Sandwich attack
  | 'frontrun'       // Frontrunning transaction
  | 'backrun'        // Backrunning transaction
  | 'liquidation'    // Liquidation transaction
  | 'mev'            // General MEV transaction
  | 'bot'            // Bot transaction
  | 'whale'          // Large transaction
  | 'spam'           // Spam/dust transaction
  | 'failed';        // Failed transaction

/**
 * MEV signature types.
 */
type MEVSignature = 
  | 'sandwich-attack'
  | 'frontrun-dex'
  | 'backrun-arbitrage'
  | 'liquidation-mev'
  | 'nft-snipe'
  | 'token-snipe'
  | 'copy-trade'
  | 'wash-trade'
  | 'price-manipulation';

// ========================================
// TRANSACTION ANALYSIS TYPES (moved before use)
// ========================================

/**
 * Token transfer information.
 */
interface TokenTransfer {
  /** Transfer type. */
  type: 'ERC20' | 'ERC721' | 'ERC1155' | 'native';
  
  /** Token information. */
  token: TokenInfo;
  
  /** From address. */
  from: Address;
  
  /** To address. */
  to: Address;
  
  /** Amount transferred. */
  amount: string;
  
  /** Token ID (for NFTs). */
  tokenId?: string;
  
  /** Transfer value in USD. */
  valueUsd?: string;
}

/**
 * DEX interaction details.
 */
interface DEXInteraction {
  /** DEX protocol. */
  protocol: string;
  
  /** Interaction type. */
  type: 'swap' | 'add-liquidity' | 'remove-liquidity' | 'stake' | 'unstake';
  
  /** Token pairs involved. */
  pairs: Array<{
    tokenA: TokenInfo;
    tokenB: TokenInfo;
    amountA: string;
    amountB: string;
  }>;
  
  /** Slippage tolerance. */
  slippage?: number;
  
  /** Deadline. */
  deadline?: number;
  
  /** Router address. */
  router?: Address;
  
  /** Pool addresses. */
  pools?: Address[];
}

/**
 * Decoded transaction information.
 */
interface DecodedTransaction {
  /** Contract interface. */
  contractInterface?: string;
  
  /** Function name. */
  functionName?: string;
  
  /** Function signature. */
  functionSignature?: string;
  
  /** Decoded parameters. */
  parameters?: Array<{
    name: string;
    type: string;
    value: string | number | boolean | bigint | string[];
  }>;
  
  /** Token transfers. */
  tokenTransfers?: TokenTransfer[];
  
  /** DEX interaction. */
  dexInteraction?: DEXInteraction;
  
  /** Human-readable description. */
  description?: string;
}

/**
 * Transaction classification details.
 */
interface TransactionClassification {
  /** Primary classification. */
  primary: TransactionClass;
  
  /** Secondary classifications. */
  secondary: TransactionClass[];
  
  /** Classification confidence. */
  confidence: number;
  
  /** Classification reason. */
  reason: string;
  
  /** Transaction value in USD. */
  valueUsd?: string;
  
  /** Gas cost in USD. */
  gasCostUsd?: string;
  
  /** Transaction priority score. */
  priorityScore: number;
}

/**
 * MEV analysis for transaction.
 */
interface MEVAnalysis {
  /** Is MEV transaction. */
  isMEV: boolean;
  
  /** MEV confidence score. */
  confidence: number;
  
  /** Detected MEV signatures. */
  signatures: MEVSignature[];
  
  /** MEV type classification. */
  type?: 'sandwich' | 'arbitrage' | 'frontrun' | 'liquidation' | 'other';
  
  /** Potential profit estimation. */
  estimatedProfit?: string;
  
  /** Victim transactions (for sandwich). */
  victimTxs?: TransactionHash[];
  
  /** Bundle information. */
  bundle?: {
    bundleId: string;
    position: number;
    totalTransactions: number;
  };
  
  /** MEV metadata. */
  metadata: {
    detectionAlgorithm: string;
    riskScore: number;
    impactScore: number;
    flags: string[];
  };
}

/**
 * Transaction metadata.
 */
interface MempoolTransactionMetadata {
  /** Detection latency. */
  detectionLatency: number;
  
  /** Mempool position. */
  mempoolPosition?: number;
  
  /** Gas price rank. */
  gasPriceRank?: number;
  
  /** Replacement transactions. */
  replacements?: TransactionHash[];
  
  /** Parent transactions. */
  parents?: TransactionHash[];
  
  /** Child transactions. */
  children?: TransactionHash[];
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

// ========================================
// PENDING TRANSACTION TYPES
// ========================================

/**
 * Pending transaction in mempool.
 */
interface PendingTransaction {
  /** Transaction hash. */
  hash: TransactionHash;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Transaction details. */
  transaction: {
    from: Address;
    to: Address;
    value: string;
    data: string;
    gasLimit: string;
    gasPrice: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce: number;
    type: number;
  };
  
  /** Detection timestamp. */
  detectedAt: number;
  
  /** Data source. */
  source: MempoolSource;
  
  /** Transaction classification. */
  classification: TransactionClassification;
  
  /** MEV analysis. */
  mevAnalysis: MEVAnalysis;
  
  /** Decoded transaction. */
  decoded?: DecodedTransaction;
  
  /** Transaction metadata. */
  metadata: MempoolTransactionMetadata;
}

// ========================================
// MEMPOOL MONITORING TYPES (moved before use)
// ========================================

/**
 * Mempool monitoring filters.
 */
interface MempoolFilters {
  /** Minimum transaction value (USD). */
  minValueUsd?: string;
  
  /** Maximum transaction value (USD). */
  maxValueUsd?: string;
  
  /** Minimum gas price. */
  minGasPrice?: string;
  
  /** Address whitelist. */
  addressWhitelist?: Address[];
  
  /** Address blacklist. */
  addressBlacklist?: Address[];
  
  /** Contract whitelist. */
  contractWhitelist?: Address[];
  
  /** Token whitelist. */
  tokenWhitelist?: Address[];
  
  /** Function signature whitelist. */
  functionWhitelist?: string[];
  
  /** Transaction types to monitor. */
  transactionTypes?: TransactionType[];
  
  /** Classifications to include. */
  includeClasses?: TransactionClass[];
  
  /** Classifications to exclude. */
  excludeClasses?: TransactionClass[];
  
  /** MEV signatures to detect. */
  mevSignatures?: MEVSignature[];
}

/**
 * Mempool alert conditions.
 */
interface MempoolAlertConditions {
  /** Transaction value threshold. */
  minValueUsd?: string;
  
  /** Gas price threshold. */
  gasThreshold?: string;
  
  /** MEV confidence threshold. */
  mevConfidenceThreshold?: number;
  
  /** Transaction count threshold. */
  txCountThreshold?: number;
  
  /** Time window for analysis. */
  timeWindow?: number;
  
  /** Specific addresses to monitor. */
  watchAddresses?: Address[];
  
  /** Custom conditions. */
  customConditions?: Record<string, string | number | boolean>;
}

/**
 * Mempool alert configuration.
 */
interface MempoolAlertConfig {
  /** Alert identifier. */
  id: string;
  
  /** Alert type. */
  type: 'large-transaction' | 'mev-detected' | 'gas-spike' | 'unusual-activity';
  
  /** Alert conditions. */
  conditions: MempoolAlertConditions;
  
  /** Alert actions. */
  actions: Array<{
    type: 'webhook' | 'email' | 'slack' | 'telegram';
    endpoint: string;
    template?: string;
  }>;
  
  /** Alert metadata. */
  metadata: {
    name: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
  };
}

/**
 * Mempool state snapshot.
 */
interface MempoolState {
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Snapshot timestamp. */
  timestamp: number;
  
  /** Pending transaction count. */
  pendingCount: number;
  
  /** Queued transaction count. */
  queuedCount: number;
  
  /** Average gas price. */
  averageGasPrice: string;
  
  /** Gas price percentiles. */
  gasPricePercentiles: {
    p10: string;
    p25: string;
    p50: string;
    p75: string;
    p90: string;
    p95: string;
    p99: string;
  };
  
  /** Transaction classification distribution. */
  classificationDistribution: Record<TransactionClass, number>;
  
  /** MEV transaction statistics. */
  mevStats: {
    totalMEVTxs: number;
    mevPercentage: number;
    averageMEVProfit: string;
    topMEVTypes: Array<{
      type: MEVSignature;
      count: number;
    }>;
  };
  
  /** Congestion metrics. */
  congestion: {
    level: 'low' | 'medium' | 'high' | 'extreme';
    score: number;
    basedOn: string[];
  };
}

/**
 * Mempool monitoring configuration.
 */
interface MempoolMonitorConfig {
  /** Monitor identifier. */
  id: string;
  
  /** Target chains. */
  chains: SupportedChain[];
  
  /** Data sources. */
  sources: MempoolSource[];
  
  /** Monitoring filters. */
  filters: MempoolFilters;
  
  /** Detection settings. */
  detection: {
    enableMEVDetection: boolean;
    enableClassification: boolean;
    enableDecoding: boolean;
    realTimeProcessing: boolean;
  };
  
  /** Alert configuration. */
  alerts: MempoolAlertConfig[];
  
  /** Performance settings. */
  performance: {
    maxPendingTxs: number;
    processingTimeout: number;
    batchSize: number;
    retentionPeriod: number;
  };
}

// ========================================
// MEMPOOL ANALYTICS TYPES
// ========================================

/**
 * Mempool analytics.
 */
interface MempoolAnalytics {
  /** Target chain. */
  chain: SupportedChain;
  
  /** Analysis period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Transaction volume statistics. */
  volume: {
    totalTransactions: number;
    averagePerMinute: number;
    peakTps: number;
    totalValueUsd: string;
  };
  
  /** Gas price analytics. */
  gasPrice: {
    average: string;
    median: string;
    standardDeviation: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    volatility: number;
  };
  
  /** MEV analytics. */
  mev: {
    totalMEVTxs: number;
    mevPercentage: number;
    totalMEVValueUsd: string;
    averageMEVProfit: string;
    topMEVBots: Array<{
      address: Address;
      txCount: number;
      totalProfit: string;
    }>;
    mevTypeDistribution: Record<MEVSignature, number>;
  };
  
  /** Block inclusion analytics. */
  inclusion: {
    averageInclusionTime: number;
    inclusionRate: number;
    droppedTxRate: number;
    replacementRate: number;
  };
  
  /** Network patterns. */
  patterns: {
    hourlyDistribution: Record<string, number>;
    dayOfWeekDistribution: Record<string, number>;
    seasonalTrends: Array<{
      period: string;
      txCount: number;
      avgGasPrice: string;
    }>;
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Transaction classification thresholds.
 */
const CLASSIFICATION_THRESHOLDS = {
  WHALE_TX_USD: '100000',
  LARGE_TX_USD: '10000',
  MEV_CONFIDENCE: 0.8,
  SANDWICH_CONFIDENCE: 0.9,
  FRONTRUN_CONFIDENCE: 0.85,
  BOT_PATTERN_CONFIDENCE: 0.75
} as const;

/**
 * MEV detection patterns.
 */
const MEV_PATTERNS = {
  SANDWICH_GAS_PREMIUM: 1.5,     // Gas price multiplier for sandwich detection
  FRONTRUN_TIME_WINDOW: 30000,   // 30 seconds
  BACKRUN_TIME_WINDOW: 60000,    // 60 seconds
  MIN_PROFIT_THRESHOLD: '50',     // USD
  MAX_SLIPPAGE_TOLERANCE: 5.0     // 5%
} as const;

/**
 * Mempool size thresholds by chain.
 */
const MEMPOOL_SIZE_THRESHOLDS = {
  ethereum: { normal: 5000, congested: 15000, extreme: 30000 },
  bsc: { normal: 2000, congested: 8000, extreme: 15000 },
  polygon: { normal: 3000, congested: 10000, extreme: 20000 },
  arbitrum: { normal: 1000, congested: 3000, extreme: 6000 },
  optimism: { normal: 1000, congested: 3000, extreme: 6000 },
  avalanche: { normal: 1500, congested: 5000, extreme: 10000 },
  fantom: { normal: 1000, congested: 3000, extreme: 6000 },
  solana: { normal: 2000, congested: 8000, extreme: 15000 },
  base: { normal: 1000, congested: 3000, extreme: 6000 }
} as const;

// Consolidated export declaration
export type {
  MempoolSource,
  TransactionClass,
  MEVSignature,
  TokenTransfer,
  DEXInteraction,
  DecodedTransaction,
  TransactionClassification,
  MEVAnalysis,
  MempoolTransactionMetadata,
  PendingTransaction,
  MempoolFilters,
  MempoolAlertConditions,
  MempoolAlertConfig,
  MempoolState,
  MempoolMonitorConfig,
  MempoolAnalytics
};

export {
  CLASSIFICATION_THRESHOLDS,
  MEV_PATTERNS,
  MEMPOOL_SIZE_THRESHOLDS
};
