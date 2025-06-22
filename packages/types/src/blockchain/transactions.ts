/**
 * @file Blockchain Transaction Types.
 * 
 * Transaction structures, gas estimation, execution metadata,
 * and transaction status management for multi-chain operations.
 * 
 * Features:
 * - Comprehensive transaction structures
 * - Gas estimation and optimization
 * - Transaction status tracking
 * - MEV protection and bundling
 * - Batch transaction operations.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address } from './addresses';
import type { SupportedChain } from './chain';

// ========================================
// CORE TRANSACTION TYPES
// ========================================

/**
 * Transaction hash identifier.
 */
type TransactionHash = string;

/**
 * Transaction status enumeration.
 */
type TransactionStatus = 
  | 'pending'      // Transaction created but not submitted
  | 'submitted'    // Transaction submitted to mempool
  | 'confirmed'    // Transaction included in block
  | 'success'      // Transaction executed successfully
  | 'failed'       // Transaction failed during execution
  | 'cancelled'    // Transaction cancelled by user
  | 'expired'      // Transaction expired (deadline passed)
  | 'replaced'     // Transaction replaced by higher gas
  | 'stuck';       // Transaction stuck in mempool

/**
 * Transaction type classifications.
 */
type TransactionType =
  | 'swap'           // Token swap transaction
  | 'transfer'       // Token transfer
  | 'approve'        // Token approval
  | 'contract-call'  // Smart contract interaction
  | 'deployment'     // Contract deployment
  | 'multicall'      // Batch transaction
  | 'bridge'         // Cross-chain bridge
  | 'stake'          // Staking operation
  | 'unstake'        // Unstaking operation
  | 'yield-farm'     // Yield farming
  | 'liquidity'      // Liquidity provision
  | 'governance'     // Governance voting
  | 'other';         // Other transaction types

// ========================================
// GAS TYPES (DEFINED BEFORE USAGE)
// ========================================

/**
 * Gas optimization strategies.
 */
type GasStrategy = 
  | 'slow'        // Lowest gas price, slower confirmation
  | 'standard'    // Standard gas price, normal confirmation
  | 'fast'        // Higher gas price, faster confirmation
  | 'instant'     // Highest gas price, fastest confirmation
  | 'custom'      // User-defined gas parameters
  | 'dynamic'     // Dynamic gas based on network conditions
  | 'optimized';  // AI-optimized gas strategy

/**
 * Gas estimation details.
 */
interface GasEstimation {
  /** Estimated gas usage. */
  estimatedGas: string;
  
  /** Gas estimation accuracy. */
  accuracy: 'low' | 'medium' | 'high';
  
  /** Estimation timestamp. */
  timestamp: number;
  
  /** Estimation source. */
  source: 'simulation' | 'historical' | 'static' | 'rpc';
  
  /** Buffer percentage added. */
  bufferPercentage: number;
  
  /** Total estimated cost in native token. */
  estimatedCost: string;
  
  /** Estimation confidence. */
  confidence: number;
}

/**
 * Gas configuration for transactions.
 */
interface GasConfig {
  /** Gas limit. */
  gasLimit: string;
  
  /** Gas price (legacy). */
  gasPrice?: string;
  
  /** Base fee per gas (EIP-1559). */
  baseFeePerGas?: string;
  
  /** Max fee per gas (EIP-1559). */
  maxFeePerGas?: string;
  
  /** Max priority fee per gas (EIP-1559). */
  maxPriorityFeePerGas?: string;
  
  /** Gas estimation metadata. */
  estimation: GasEstimation;
  
  /** Gas optimization strategy. */
  strategy: GasStrategy;
}

// ========================================
// RETRY AND BUNDLE TYPES (DEFINED BEFORE USAGE)
// ========================================

/**
 * Conditions for transaction retry.
 */
type RetryCondition = 
  | 'nonce-too-low'
  | 'gas-price-too-low'
  | 'insufficient-funds'
  | 'network-congestion'
  | 'rpc-error'
  | 'timeout';

/**
 * Transaction retry configuration.
 */
interface RetryConfig {
  /** Enable automatic retry. */
  enabled: boolean;
  
  /** Maximum retry attempts. */
  maxAttempts: number;
  
  /** Retry delay multiplier. */
  delayMultiplier: number;
  
  /** Base delay in milliseconds. */
  baseDelay: number;
  
  /** Gas price increase per retry. */
  gasPriceIncrement: number;
  
  /** Conditions for retry. */
  retryConditions: RetryCondition[];
}

/**
 * Transaction bundle configuration.
 */
interface BundleConfig {
  /** Bundle ID. */
  id: string;
  
  /** Bundle type. */
  type: 'flashbots' | 'bloxroute' | 'eden' | 'custom';
  
  /** Target block number. */
  targetBlock?: number;
  
  /** Bundle priority. */
  priority: number;
  
  /** Maximum bundle size. */
  maxSize: number;
  
  /** Bundle timeout. */
  timeout: number;
  
  /** Bundle simulation required. */
  requireSimulation: boolean;
  
  /** Bundle replacement allowed. */
  allowReplacement: boolean;
}

/**
 * Transaction metadata and context.
 */
interface TransactionMetadata {
  /** Human-readable description. */
  description?: string;
  
  /** Associated bot/strategy ID. */
  botId?: string;
  
  /** Trading pair involved. */
  tradingPair?: string;
  
  /** Expected profit/loss. */
  expectedPnL?: string;
  
  /** Slippage tolerance. */
  slippageTolerance?: number;
  
  /** Deadline timestamp. */
  deadline?: number;
  
  /** MEV protection enabled. */
  mevProtection: boolean;
  
  /** Private mempool usage. */
  privateMempool: boolean;
  
  /** Bundle configuration. */
  bundle?: BundleConfig;
  
  /** Retry configuration. */
  retry?: RetryConfig;
  
  /** Custom tags. */
  tags: string[];
  
  /** Additional custom data. */
  custom: Record<string, string | number | boolean>;
}

// ========================================
// TRANSACTION STRUCTURES
// ========================================

/**
 * Base transaction information.
 */
interface BaseTransaction {
  /** Transaction hash. */
  hash?: TransactionHash;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Transaction type. */
  type: TransactionType;
  
  /** From address. */
  from: Address;
  
  /** To address. */
  to: Address;
  
  /** Transaction value. */
  value: string;
  
  /** Transaction data/input. */
  data?: string;
  
  /** Transaction nonce. */
  nonce?: number;
  
  /** Gas configuration. */
  gas: GasConfig;
  
  /** Transaction status. */
  status: TransactionStatus;
  
  /** Creation timestamp. */
  createdAt: number;
  
  /** Submission timestamp. */
  submittedAt?: number;
  
  /** Confirmation timestamp. */
  confirmedAt?: number;
  
  /** Transaction metadata. */
  metadata: TransactionMetadata;
}

// ========================================
// MEV PROTECTION TYPES
// ========================================

/**
 * MEV protection configuration.
 */
interface MEVProtection {
  /** Protection type. */
  type: 'flashbots' | 'private-pool' | 'commit-reveal' | 'none';
  
  /** Protection level. */
  level: 'basic' | 'standard' | 'maximum';
  
  /** Anti-frontrunning enabled. */
  antiFrontrunning: boolean;
  
  /** Anti-sandwich enabled. */
  antiSandwich: boolean;
  
  /** Time preference. */
  timePreference: 'speed' | 'protection' | 'balanced';
  
  /** Maximum MEV penalty tolerated. */
  maxMevPenalty: string;
}

// ========================================
// EXECUTION RESULT TYPES (DEFINED BEFORE USAGE)
// ========================================

/**
 * Transaction error information.
 */
interface TransactionError {
  /** Error code. */
  code: string;
  
  /** Error message. */
  message: string;
  
  /** Error type. */
  type: 'revert' | 'out-of-gas' | 'invalid-nonce' | 'insufficient-funds' | 'other';
  
  /** Revert reason. */
  revertReason?: string;
  
  /** Gas used before failure. */
  gasUsed?: string;
  
  /** Recovery suggestions. */
  suggestions?: string[];
}

/**
 * Transaction log entry.
 */
interface TransactionLog {
  /** Log address. */
  address: Address;
  
  /** Log topics. */
  topics: string[];
  
  /** Log data. */
  data: string;
  
  /** Log index. */
  logIndex: number;
  
  /** Block number. */
  blockNumber: number;
  
  /** Transaction hash. */
  transactionHash: TransactionHash;
  
  /** Decoded log data. */
  decoded?: {
    name: string;
    signature: string;
    inputs: Array<{
      name: string;
      type: string;
      value: string | number | boolean | bigint | string[];
    }>;
  };
}

/**
 * State change from transaction.
 */
interface StateChange {
  /** Changed address. */
  address: Address;
  
  /** Change type. */
  type: 'balance' | 'nonce' | 'code' | 'storage';
  
  /** Previous value. */
  before: string;
  
  /** New value. */
  after: string;
  
  /** Storage slot (for storage changes). */
  slot?: string;
}

/**
 * Transaction execution result.
 */
interface TransactionResult {
  /** Transaction hash. */
  hash: TransactionHash;
  
  /** Execution status. */
  status: TransactionStatus;
  
  /** Block number. */
  blockNumber?: number;
  
  /** Block hash. */
  blockHash?: string;
  
  /** Transaction index in block. */
  transactionIndex?: number;
  
  /** Gas used. */
  gasUsed?: string;
  
  /** Effective gas price. */
  effectiveGasPrice?: string;
  
  /** Transaction fee. */
  fee?: string;
  
  /** Execution error. */
  error?: TransactionError;
  
  /** Execution logs. */
  logs?: TransactionLog[];
  
  /** State changes. */
  stateChanges?: StateChange[];
  
  /** Execution time. */
  executionTime?: number;
  
  /** Confirmation time. */
  confirmationTime?: number;
}

// ========================================
// REPLACEMENT TYPES
// ========================================

/**
 * Transaction replacement configuration.
 */
interface ReplacementConfig {
  /** Allow transaction replacement. */
  enabled: boolean;
  
  /** Replacement type. */
  type: 'cancel' | 'speedup' | 'reprice';
  
  /** Minimum gas price increase. */
  minIncrease: string;
  
  /** Maximum gas price. */
  maxGasPrice: string;
  
  /** Replacement deadline. */
  deadline: number;
}

// ========================================
// BATCH OPERATIONS
// ========================================

/**
 * Batch transaction request.
 */
interface BatchTransactionRequest {
  /** Batch ID. */
  id: string;
  
  /** Transactions in batch. */
  transactions: BaseTransaction[];
  
  /** Batch execution mode. */
  mode: 'sequential' | 'parallel' | 'atomic';
  
  /** Batch configuration. */
  config: {
    maxConcurrency: number;
    timeout: number;
    failFast: boolean;
    rollbackOnFailure: boolean;
  };
  
  /** Batch retry policy. */
  retryPolicy?: RetryConfig;
}

/**
 * Batch execution result.
 */
interface BatchTransactionResult {
  /** Batch ID. */
  id: string;
  
  /** Overall batch status. */
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  
  /** Individual transaction results. */
  results: TransactionResult[];
  
  /** Batch statistics. */
  stats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    totalGasUsed: string;
    totalFees: string;
    executionTime: number;
  };
  
  /** Batch errors. */
  errors: string[];
}

// ========================================
// SIMULATION TYPES (DEFINED BEFORE USAGE)
// ========================================

/**
 * State override for simulation.
 */
interface StateOverride {
  /** Override balance. */
  balance?: string;
  
  /** Override nonce. */
  nonce?: number;
  
  /** Override code. */
  code?: string;
  
  /** Override storage. */
  state?: Record<string, string>;
}

/**
 * Transaction execution trace.
 */
interface ExecutionTrace {
  /** Trace type. */
  type: 'call' | 'create' | 'suicide' | 'reward';
  
  /** From address. */
  from: Address;
  
  /** To address. */
  to: Address;
  
  /** Input data. */
  input: string;
  
  /** Output data. */
  output: string;
  
  /** Gas used. */
  gasUsed: string;
  
  /** Sub-traces. */
  calls?: ExecutionTrace[];
}

/**
 * Gas usage breakdown.
 */
interface GasBreakdown {
  /** Base transaction cost. */
  baseCost: string;
  
  /** Data cost. */
  dataCost: string;
  
  /** Execution cost. */
  executionCost: string;
  
  /** Storage cost. */
  storageCost: string;
  
  /** Refund amount. */
  refund: string;
  
  /** Total gas used. */
  total: string;
}

/**
 * Transaction simulation request.
 */
interface SimulationRequest {
  /** Transaction to simulate. */
  transaction: BaseTransaction;
  
  /** Block number for simulation. */
  blockNumber?: number;
  
  /** State overrides. */
  stateOverrides?: Record<Address, StateOverride>;
  
  /** Simulation options. */
  options: {
    trace: boolean;
    validateGas: boolean;
    returnEvents: boolean;
    returnStateChanges: boolean;
  };
}

/**
 * Transaction simulation result.
 */
interface SimulationResult {
  /** Simulation success. */
  success: boolean;
  
  /** Gas used. */
  gasUsed: string;
  
  /** Return value. */
  returnValue?: string;
  
  /** Execution error. */
  error?: TransactionError;
  
  /** State changes. */
  stateChanges: StateChange[];
  
  /** Events emitted. */
  events: TransactionLog[];
  
  /** Execution trace. */
  trace?: ExecutionTrace;
  
  /** Gas breakdown. */
  gasBreakdown?: GasBreakdown;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Standard gas limits for common operations.
 */
const STANDARD_GAS_LIMITS: Record<TransactionType, string> = {
  swap: '200000',
  transfer: '21000',
  approve: '60000',
  ['contract-call']: '150000',
  deployment: '500000',
  multicall: '400000',
  bridge: '300000',
  stake: '180000',
  unstake: '160000',
  ['yield-farm']: '250000',
  liquidity: '220000',
  governance: '120000',
  other: '100000'
} as const;

/**
 * Gas strategy multipliers.
 */
const GAS_STRATEGY_MULTIPLIERS: Record<GasStrategy, number> = {
  slow: 0.8,
  standard: 1.0,
  fast: 1.2,
  instant: 1.5,
  custom: 1.0,
  dynamic: 1.0,
  optimized: 1.0
} as const;

// ========================================
// EXPORTS
// ========================================

export type {
  TransactionHash,
  TransactionStatus,
  TransactionType,
  BaseTransaction,
  GasConfig,
  GasEstimation,
  GasStrategy,
  TransactionMetadata,
  BundleConfig,
  MEVProtection,
  TransactionResult,
  TransactionError,
  TransactionLog,
  StateChange,
  RetryConfig,
  RetryCondition,
  ReplacementConfig,
  BatchTransactionRequest,
  BatchTransactionResult,
  SimulationRequest,
  StateOverride,
  SimulationResult,
  ExecutionTrace,
  GasBreakdown
};

export {
  STANDARD_GAS_LIMITS,
  GAS_STRATEGY_MULTIPLIERS
};
