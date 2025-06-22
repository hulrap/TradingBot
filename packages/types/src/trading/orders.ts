/**
 * @file Trading Order Types and Execution.
 * 
 * Order structures, execution parameters, order management, and
 * trading operation types for multi-chain trading operations.
 * 
 * Features:
 * - Comprehensive order types and parameters
 * - Order execution and status tracking
 * - Advanced order types (limit, stop, etc.)
 * - Order validation and risk management
 * - Batch order operations.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address, TokenInfo } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';
import type { TransactionHash } from '../blockchain/transactions';

// ========================================
// CORE ORDER TYPES
// ========================================

/**
 * Order identifier.
 */
type OrderId = string;

/**
 * Order types available for trading.
 */
type OrderType =
  | 'market'         // Market order - execute immediately at best price
  | 'limit'          // Limit order - execute at specific price or better
  | 'stop'           // Stop loss order
  | 'stop-limit'     // Stop limit order
  | 'take-profit'    // Take profit order
  | 'oco'            // One-cancels-other order
  | 'iceberg'        // Iceberg order (hidden quantity)
  | 'twap'           // Time-weighted average price
  | 'vwap'           // Volume-weighted average price
  | 'bracket'        // Bracket order (profit + stop)
  | 'trailing-stop'  // Trailing stop order
  | 'fill-or-kill'   // Fill or kill order
  | 'immediate-or-cancel'; // Immediate or cancel order

/**
 * Order status enumeration.
 */
type OrderStatus =
  | 'pending'        // Order created, not yet submitted
  | 'open'           // Order active in the market
  | 'partially-filled' // Order partially executed
  | 'filled'         // Order completely executed
  | 'cancelled'      // Order cancelled by user
  | 'expired'        // Order expired
  | 'rejected'       // Order rejected by system
  | 'suspended'      // Order temporarily suspended
  | 'failed';        // Order failed during execution

/**
 * Order side (buy/sell direction).
 */
type OrderSide = 'buy' | 'sell';

/**
 * Time in force options.
 */
type TimeInForce =
  | 'GTC'    // Good till cancelled
  | 'IOC'    // Immediate or cancel
  | 'FOK'    // Fill or kill
  | 'GTD'    // Good till date
  | 'DAY'    // Good for day
  | 'GFS';   // Good for session

// ========================================
// METADATA AND CONTEXT TYPES (moved before BaseOrder)
// ========================================

/**
 * Order metadata and context information.
 */
interface OrderMetadata {
  /** Human-readable description. */
  description?: string;
  
  /** Order strategy/reason. */
  strategy?: string;
  
  /** Risk level assessment. */
  riskLevel: 'low' | 'medium' | 'high';
  
  /** Expected profit/loss. */
  expectedPnL?: string;
  
  /** Stop loss configuration. */
  stopLoss?: {
    enabled: boolean;
    price: string;
    percentage: number;
  };
  
  /** Take profit configuration. */
  takeProfit?: {
    enabled: boolean;
    price: string;
    percentage: number;
  };
  
  /** MEV protection settings. */
  mevProtection: {
    enabled: boolean;
    type?: 'flashbots' | 'private-pool';
    maxMevPenalty?: string;
  };
  
  /** Order priority. */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Custom tags. */
  tags: string[];
  
  /** Additional custom data. */
  custom: Record<string, string | number | boolean>;
}

// ========================================
// EXECUTION TYPES (moved before OrderExecution)
// ========================================

/**
 * Route information for multi-hop executions.
 */
interface ExecutionRoute {
  /** DEX/protocol used. */
  protocol: string;
  
  /** Pool/pair address. */
  poolAddress: Address;
  
  /** Input token. */
  tokenIn: Address;
  
  /** Output token. */
  tokenOut: Address;
  
  /** Amount in. */
  amountIn: string;
  
  /** Amount out. */
  amountOut: string;
  
  /** Pool fee. */
  fee: number;
  
  /** Price impact. */
  priceImpact: number;
}

/**
 * Execution quality metrics.
 */
interface ExecutionQuality {
  /** Price improvement vs. Expected. */
  priceImprovement: number;
  
  /** Slippage vs. Tolerance. */
  slippageRatio: number;
  
  /** Execution speed (ms). */
  executionSpeed: number;
  
  /** Market impact. */
  marketImpact: number;
  
  /** Execution efficiency score. */
  efficiencyScore: number;
  
  /** Compared to benchmark price. */
  benchmarkComparison: number;
}

// ========================================
// VALIDATION TYPES (moved before OrderValidationResult)
// ========================================

/**
 * Order validation error.
 */
interface OrderValidationError {
  /** Error code. */
  code: string;
  
  /** Error message. */
  message: string;
  
  /** Error field/parameter. */
  field?: string;
  
  /** Suggested fix. */
  suggestion?: string;
}

/**
 * Order execution estimation.
 */
interface OrderEstimation {
  /** Estimated execution price. */
  estimatedPrice: string;
  
  /** Estimated output amount. */
  estimatedOutput: string;
  
  /** Estimated gas cost. */
  estimatedGasCost: string;
  
  /** Estimated total cost. */
  estimatedTotalCost: string;
  
  /** Estimated slippage. */
  estimatedSlippage: number;
  
  /** Estimated execution time. */
  estimatedExecutionTime: number;
  
  /** Price impact. */
  priceImpact: number;
  
  /** Liquidity depth. */
  liquidityDepth: string;
}

/**
 * Order risk assessment.
 */
interface OrderRiskAssessment {
  /** Overall risk score (0-100). */
  riskScore: number;
  
  /** Risk factors. */
  factors: {
    liquidityRisk: number;
    volatilityRisk: number;
    slippageRisk: number;
    gasRisk: number;
    mevRisk: number;
    counterpartyRisk: number;
  };
  
  /** Risk warnings. */
  warnings: string[];
  
  /** Recommended actions. */
  recommendations: string[];
}

// ========================================
// ORDER STRUCTURES
// ========================================

/**
 * Base order interface with common properties.
 */
interface BaseOrder {
  /** Unique order identifier. */
  id: OrderId;
  
  /** Order type. */
  type: OrderType;
  
  /** Order side (buy/sell). */
  side: OrderSide;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Input token information. */
  tokenIn: TokenInfo;
  
  /** Output token information. */
  tokenOut: TokenInfo;
  
  /** Order amount (input token). */
  amount: string;
  
  /** Order status. */
  status: OrderStatus;
  
  /** Time in force. */
  timeInForce: TimeInForce;
  
  /** Order creation timestamp. */
  createdAt: number;
  
  /** Order update timestamp. */
  updatedAt: number;
  
  /** Order expiration timestamp. */
  expiresAt?: number;
  
  /** Associated bot/strategy ID. */
  botId?: string;
  
  /** Order metadata. */
  metadata: OrderMetadata;
}

/**
 * Market order - execute immediately at current market price.
 */
interface MarketOrder extends BaseOrder {
  type: 'market';
  
  /** Maximum slippage tolerance. */
  slippageTolerance: number;
  
  /** Minimum output amount (after slippage). */
  minOutputAmount: string;
  
  /** Execution deadline. */
  deadline: number;
}

/**
 * Limit order - execute at specific price or better.
 */
interface LimitOrder extends BaseOrder {
  type: 'limit';
  
  /** Limit price. */
  limitPrice: string;
  
  /** Post-only flag (maker only). */
  postOnly?: boolean;
  
  /** Reduce-only flag. */
  reduceOnly?: boolean;
}

/**
 * Stop order - trigger market order when price hits stop level.
 */
interface StopOrder extends BaseOrder {
  type: 'stop';
  
  /** Stop trigger price. */
  stopPrice: string;
  
  /** Stop trigger direction. */
  stopDirection: 'above' | 'below';
  
  /** Slippage tolerance for market execution. */
  slippageTolerance: number;
}

/**
 * Stop-limit order - trigger limit order when price hits stop level.
 */
interface StopLimitOrder extends BaseOrder {
  type: 'stop-limit';
  
  /** Stop trigger price. */
  stopPrice: string;
  
  /** Limit price for execution. */
  limitPrice: string;
  
  /** Stop trigger direction. */
  stopDirection: 'above' | 'below';
}

/**
 * Take profit order.
 */
interface TakeProfitOrder extends BaseOrder {
  type: 'take-profit';
  
  /** Profit target price. */
  targetPrice: string;
  
  /** Profit percentage. */
  profitPercentage: number;
  
  /** Execution type when triggered. */
  executionType: 'market' | 'limit';
  
  /** Limit price (if execution type is limit). */
  limitPrice?: string;
}

/**
 * One-cancels-other order.
 */
interface OCOOrder {
  /** OCO order ID. */
  id: string;
  
  /** Primary order (usually limit). */
  primaryOrder: LimitOrder;
  
  /** Secondary order (usually stop). */
  secondaryOrder: StopOrder | StopLimitOrder;
  
  /** OCO status. */
  status: 'active' | 'primary-filled' | 'secondary-filled' | 'cancelled';
  
  /** Creation timestamp. */
  createdAt: number;
}

/**
 * Trailing stop order.
 */
interface TrailingStopOrder extends BaseOrder {
  type: 'trailing-stop';
  
  /** Trail amount (absolute). */
  trailAmount?: string;
  
  /** Trail percentage. */
  trailPercentage?: number;
  
  /** Current stop price. */
  currentStopPrice: string;
  
  /** Highest/lowest price since activation. */
  extremePrice: string;
  
  /** Last price update timestamp. */
  lastPriceUpdate: number;
}

/**
 * Union type for all order types.
 */
type Order = 
  | MarketOrder 
  | LimitOrder 
  | StopOrder 
  | StopLimitOrder 
  | TakeProfitOrder 
  | TrailingStopOrder;

// ========================================
// ORDER EXECUTION TYPES
// ========================================

/**
 * Order execution parameters.
 */
interface OrderExecution {
  /** Order being executed. */
  orderId: OrderId;
  
  /** Execution timestamp. */
  timestamp: number;
  
  /** Executed amount. */
  executedAmount: string;
  
  /** Execution price. */
  executionPrice: string;
  
  /** Transaction hash. */
  transactionHash: TransactionHash;
  
  /** Gas used. */
  gasUsed: string;
  
  /** Gas price. */
  gasPrice: string;
  
  /** Execution fee. */
  fee: string;
  
  /** Slippage experienced. */
  actualSlippage: number;
  
  /** Execution venue/DEX. */
  venue: string;
  
  /** Route taken for execution. */
  route?: ExecutionRoute[];
  
  /** Execution quality metrics. */
  quality: ExecutionQuality;
}

// ========================================
// ORDER VALIDATION TYPES
// ========================================

/**
 * Order validation result.
 */
interface OrderValidationResult {
  /** Whether order is valid. */
  isValid: boolean;
  
  /** Validation errors. */
  errors: OrderValidationError[];
  
  /** Validation warnings. */
  warnings: string[];
  
  /** Estimated execution parameters. */
  estimation?: OrderEstimation;
  
  /** Risk assessment. */
  risk: OrderRiskAssessment;
}

// ========================================
// BATCH ORDER OPERATIONS
// ========================================

/**
 * Batch order request.
 */
interface BatchOrderRequest {
  /** Batch identifier. */
  id: string;
  
  /** Orders in the batch. */
  orders: Order[];
  
  /** Batch execution mode. */
  mode: 'sequential' | 'parallel' | 'atomic';
  
  /** Batch configuration. */
  config: {
    maxConcurrency: number;
    timeout: number;
    continueOnError: boolean;
    rollbackOnFailure: boolean;
  };
  
  /** Batch metadata. */
  metadata: {
    strategy?: string;
    description?: string;
    tags: string[];
  };
}

/**
 * Batch order result.
 */
interface BatchOrderResult {
  /** Batch identifier. */
  id: string;
  
  /** Overall batch status. */
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  
  /** Individual order results. */
  results: Array<OrderExecution | OrderValidationError>;
  
  /** Batch statistics. */
  stats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    totalValue: string;
    totalFees: string;
    averageExecutionTime: number;
  };
  
  /** Batch execution time. */
  executionTime: number;
  
  /** Batch errors. */
  errors: string[];
}

// ========================================
// ORDER BOOK TYPES
// ========================================

/**
 * Order book entry.
 */
interface OrderBookEntry {
  /** Price level. */
  price: string;
  
  /** Quantity at this price. */
  quantity: string;
  
  /** Number of orders. */
  orderCount: number;
  
  /** Timestamp of last update. */
  timestamp: number;
}

/**
 * Order book snapshot.
 */
interface OrderBook {
  /** Trading pair. */
  pair: string;
  
  /** Bid orders (buy orders). */
  bids: OrderBookEntry[];
  
  /** Ask orders (sell orders). */
  asks: OrderBookEntry[];
  
  /** Last update timestamp. */
  timestamp: number;
  
  /** Sequence number. */
  sequence?: number;
  
  /** Best bid price. */
  bestBid?: string;
  
  /** Best ask price. */
  bestAsk?: string;
  
  /** Spread. */
  spread?: string;
  
  /** Mid price. */
  midPrice?: string;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default slippage tolerances by order type.
 */
const DEFAULT_SLIPPAGE_TOLERANCE = {
  market: 2.0,
  limit: 0.0,
  stop: 3.0,
  stopLimit: 0.5,
  takeProfit: 1.0,
  oco: 2.0,
  iceberg: 1.5,
  twap: 1.0,
  vwap: 1.0,
  bracket: 2.0,
  trailingStop: 2.5,
  fillOrKill: 1.0,
  immediateOrCancel: 1.5
} as const;

/**
 * Order priority levels.
 */
const ORDER_PRIORITIES = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4
} as const;

/**
 * Maximum order sizes by chain (in USD).
 */
const MAX_ORDER_SIZES = {
  ethereum: '1000000',
  bsc: '500000',
  polygon: '300000',
  arbitrum: '800000',
  optimism: '600000',
  avalanche: '400000',
  fantom: '200000',
  solana: '700000',
  base: '500000'
} as const;

// Consolidated export declaration
export type {
  OrderId,
  OrderType,
  OrderStatus,
  OrderSide,
  TimeInForce,
  OrderMetadata,
  ExecutionRoute,
  ExecutionQuality,
  OrderValidationError,
  OrderEstimation,
  OrderRiskAssessment,
  BaseOrder,
  MarketOrder,
  LimitOrder,
  StopOrder,
  StopLimitOrder,
  TakeProfitOrder,
  OCOOrder,
  TrailingStopOrder,
  Order,
  OrderExecution,
  OrderValidationResult,
  BatchOrderRequest,
  BatchOrderResult,
  OrderBookEntry,
  OrderBook
};

export {
  DEFAULT_SLIPPAGE_TOLERANCE,
  ORDER_PRIORITIES,
  MAX_ORDER_SIZES
};
