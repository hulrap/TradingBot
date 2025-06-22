/**
 * @file Trading Position and Portfolio Types.
 * 
 * Position tracking, portfolio management, and performance analysis
 * types for trading operations across multiple chains and strategies.
 * 
 * Features:
 * - Multi-chain position tracking
 * - Portfolio aggregation and analysis  
 * - Risk management and exposure tracking
 * - Performance metrics and PnL calculation
 * - Position sizing and allocation.
 * 
 * @version 1.0.0
 * @package @trading-bot/types. */

import type { OrderId } from './orders';
import type { TokenInfo } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';


// ========================================
// CORE POSITION TYPES
// ========================================

/**
 * Position identifier.. 
 */
type PositionId = string;

/**
 * Position status enumeration.
 */
type PositionStatus =
  | 'open'      // Position is currently open
  | 'closed'    // Position has been closed
  | 'partial'   // Position partially closed
  | 'liquidated' // Position was liquidated
  | 'expired'   // Position expired
  | 'suspended' // Position temporarily suspended
  | 'error';    // Position in error state

/**
 * Position direction.
 */
type PositionSide = 'long' | 'short' | 'neutral';

/**
 * Position type classification.
 */
type PositionType =
  | 'spot'        // Spot trading position
  | 'margin'      // Margin trading position
  | 'futures'     // Futures position
  | 'options'     // Options position
  | 'perpetual'   // Perpetual swap position
  | 'liquidity'   // Liquidity provision position
  | 'staking'     // Staking position
  | 'yield'       // Yield farming position
  | 'arbitrage'   // Arbitrage position
  | 'synthetic';  // Synthetic asset position

// ========================================
// POSITION STRUCTURES
// ========================================

/**
 * Profit and Loss calculation.
 */
interface PositionPnL {
  /** PnL in quote token. */
  quoteToken: string;
  
  /** PnL in USD. */
  usd: string;
  
  /** PnL percentage. */
  percentage: number;
  
  /** PnL calculation timestamp. */
  timestamp: number;
  
  /** Price basis for calculation. */
  priceBasis: string;
}

/**
 * Position costs and fees.
 */
interface PositionCosts {
  /** Entry fees paid. */
  entryFees: string;
  
  /** Exit fees paid. */
  exitFees: string;
  
  /** Funding fees (for perpetuals). */
  fundingFees: string;
  
  /** Gas costs. */
  gasCosts: string;
  
  /** Borrow costs (for margin). */
  borrowCosts: string;
  
  /** Other miscellaneous costs. */
  otherCosts: string;
  
  /** Total costs. */
  total: string;
  
  /** Cost basis adjustment. */
  costBasisAdjustment: string;
}

/**
 * Position risk metrics.
 */
interface PositionRisk {
  /** Position risk score (0-100). */
  riskScore: number;
  
  /** Value at Risk (VaR). */
  valueAtRisk: {
    oneDay: string;
    oneWeek: string;
    oneMonth: string;
  };
  
  /** Maximum drawdown. */
  maxDrawdown: string;
  
  /** Stop loss price. */
  stopLoss?: string;
  
  /** Take profit price. */
  takeProfit?: string;
  
  /** Liquidation price (for margin/futures). */
  liquidationPrice?: string;
  
  /** Margin ratio (for margin positions). */
  marginRatio?: number;
  
  /** Leverage used. */
  leverage?: number;
  
  /** Risk warnings. */
  warnings: string[];
}

/**
 * Position metadata and context.
 */
interface PositionMetadata {
  /** Trading strategy that created position. */
  strategy?: string;
  
  /** Bot ID that manages position. */
  botId?: string;
  
  /** Position tags. */
  tags: string[];
  
  /** Position notes. */
  notes?: string;
  
  /** External reference ID. */
  externalId?: string;
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Core trading position.
 */
interface Position {
  /** Unique position identifier. */
  id: PositionId;
  
  /** Position type. */
  type: PositionType;
  
  /** Position status. */
  status: PositionStatus;
  
  /** Position side. */
  side: PositionSide;
  
  /** Target blockchain. */
  chain: SupportedChain;
  
  /** Base token (what we're holding). */
  baseToken: TokenInfo;
  
  /** Quote token (what we're pricing against). */
  quoteToken: TokenInfo;
  
  /** Trading pair symbol. */
  symbol: string;
  
  /** Position size (in base token). */
  size: string;
  
  /** Current market value (in quote token). */
  marketValue: string;
  
  /** Average entry price. */
  entryPrice: string;
  
  /** Current market price. */
  currentPrice: string;
  
  /** Unrealized PnL. */
  unrealizedPnL: PositionPnL;
  
  /** Realized PnL. */
  realizedPnL: PositionPnL;
  
  /** Position costs and fees. */
  costs: PositionCosts;
  
  /** Risk metrics. */
  risk: PositionRisk;
  
  /** Position timestamps. */
  timestamps: {
    opened: number;
    lastUpdate: number;
    closed?: number;
  };
  
  /** Associated orders. */
  orders: OrderId[];
  
  /** Position metadata. */
  metadata: PositionMetadata;
}

// ========================================
// PORTFOLIO TYPES
// ========================================

/**
 * Portfolio summary statistics.
 */
interface PortfolioSummary {
  /** Total portfolio value (USD). */
  totalValue: string;
  
  /** Total cost basis. */
  totalCostBasis: string;
  
  /** Total unrealized PnL. */
  totalUnrealizedPnL: string;
  
  /** Total realized PnL. */
  totalRealizedPnL: string;
  
  /** Total PnL percentage. */
  totalPnLPercentage: number;
  
  /** Number of positions. */
  positionCount: number;
  
  /** Number of open positions. */
  openPositions: number;
  
  /** Number of chains used. */
  chainCount: number;
  
  /** Top performing position. */
  topPerformer?: {
    positionId: PositionId;
    pnlPercentage: number;
  };
  
  /** Worst performing position. */
  worstPerformer?: {
    positionId: PositionId;
    pnlPercentage: number;
  };
}

/**
 * Performance metrics for a specific time period.
 */
interface PerformancePeriod {
  /** Period identifier. */
  period: string;
  
  /** Start timestamp. */
  startTime: number;
  
  /** End timestamp. */
  endTime: number;
  
  /** Returns. */
  returns: {
    absolute: string;
    percentage: number;
    annualized: number;
  };
  
  /** Volatility. */
  volatility: {
    daily: number;
    annualized: number;
  };
  
  /** Maximum drawdown. */
  maxDrawdown: {
    value: string;
    percentage: number;
    duration: number;
  };
  
  /** Win/loss statistics. */
  winLoss: {
    winRate: number;
    avgWin: string;
    avgLoss: string;
    winLossRatio: number;
  };
  
  /** Trading frequency. */
  frequency: {
    totalTrades: number;
    avgTradesPerDay: number;
    avgHoldingPeriod: number;
  };
}

/**
 * Portfolio performance analytics.
 */
interface PortfolioPerformance {
  /** Time periods for analysis. */
  periods: {
    '1d': PerformancePeriod;
    '7d': PerformancePeriod;
    '30d': PerformancePeriod;
    '90d': PerformancePeriod;
    '1y': PerformancePeriod;
    'all': PerformancePeriod;
  };
  
  /** Performance benchmarks. */
  benchmarks?: {
    btc: number;
    eth: number;
    sp500: number;
    custom?: Record<string, number>;
  };
  
  /** Performance ratios. */
  ratios: {
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    informationRatio: number;
  };
  
  /** Risk-adjusted returns. */
  riskAdjustedReturns: {
    alpha: number;
    beta: number;
    treynorRatio: number;
  };
}

/**
 * Portfolio allocation breakdown.
 */
interface PortfolioAllocation {
  /** Allocation by token. */
  byToken: Array<{
    token: TokenInfo;
    value: string;
    percentage: number;
    positions: PositionId[];
  }>;
  
  /** Allocation by chain. */
  byChain: Array<{
    chain: SupportedChain;
    value: string;
    percentage: number;
    positions: PositionId[];
  }>;
  
  /** Allocation by strategy. */
  byStrategy: Array<{
    strategy: string;
    value: string;
    percentage: number;
    positions: PositionId[];
  }>;
  
  /** Allocation by position type. */
  byType: Array<{
    type: PositionType;
    value: string;
    percentage: number;
    positions: PositionId[];
  }>;
  
  /** Concentration metrics. */
  concentration: {
    herfindahlIndex: number;
    topTenConcentration: number;
    effectiveAssets: number;
  };
}

/**
 * Portfolio risk assessment.
 */
interface PortfolioRisk {
  /** Overall portfolio risk score. */
  riskScore: number;
  
  /** Value at Risk metrics. */
  valueAtRisk: {
    confidence99: {
      oneDay: string;
      oneWeek: string;
      oneMonth: string;
    };
    confidence95: {
      oneDay: string;
      oneWeek: string;
      oneMonth: string;
    };
  };
  
  /** Conditional Value at Risk. */
  conditionalVaR: {
    oneDay: string;
    oneWeek: string;
    oneMonth: string;
  };
  
  /** Correlation matrix. */
  correlations: Array<{
    asset1: string;
    asset2: string;
    correlation: number;
  }>;
  
  /** Risk factors. */
  factors: {
    marketRisk: number;
    liquidityRisk: number;
    concentrationRisk: number;
    leverageRisk: number;
    operationalRisk: number;
  };
  
  /** Risk limits. */
  limits: {
    maxLeverage: number;
    maxDrawdown: string;
    maxCorrelation: number;
  };
  
  /** Risk warnings. */
  warnings: string[];
}

/**
 * Portfolio metadata and context.
 */
interface PortfolioMetadata {
  /** Portfolio description. */
  description?: string;
  
  /** Portfolio strategy. */
  strategy?: string;
  
  /** Investment objectives. */
  objectives: string[];
  
  /** Risk tolerance. */
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  
  /** Investment horizon. */
  investmentHorizon: 'short' | 'medium' | 'long';
  
  /** Portfolio tags. */
  tags: string[];
  
  /** Benchmark. */
  benchmark?: string;
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Portfolio aggregating multiple positions.
 */
interface Portfolio {
  /** Portfolio identifier. */
  id: string;
  
  /** Portfolio name. */
  name: string;
  
  /** Portfolio owner. */
  userId: string;
  
  /** Positions in portfolio. */
  positions: Position[];
  
  /** Portfolio summary. */
  summary: PortfolioSummary;
  
  /** Portfolio performance. */
  performance: PortfolioPerformance;
  
  /** Portfolio allocation. */
  allocation: PortfolioAllocation;
  
  /** Portfolio risk metrics. */
  risk: PortfolioRisk;
  
  /** Portfolio timestamps. */
  timestamps: {
    created: number;
    lastUpdate: number;
  };
  
  /** Portfolio metadata. */
  metadata: PortfolioMetadata;
}

// ========================================
// POSITION MANAGEMENT TYPES
// ========================================

/**
 * Position sizing strategy.
 */
interface PositionSizing {
  /** Sizing method. */
  method: 'fixed' | 'percentage' | 'risk-based' | 'kelly' | 'volatility';
  
  /** Base size parameters. */
  parameters: {
    fixedAmount?: string;
    percentage?: number;
    riskPerTrade?: number;
    kellyFraction?: number;
    volatilityTarget?: number;
  };
  
  /** Size constraints. */
  constraints: {
    minSize: string;
    maxSize: string;
    maxPositions: number;
    maxExposure: string;
  };
  
  /** Dynamic adjustments. */
  adjustments: {
    volatilityAdjustment: boolean;
    momentumAdjustment: boolean;
    correlationAdjustment: boolean;
  };
}

/**
 * Position scaling configuration.
 */
interface PositionScaling {
  /** Scaling enabled. */
  enabled: boolean;
  
  /** Scale in strategy. */
  scaleIn: {
    enabled: boolean;
    intervals: number;
    priceDecrement: number;
    sizeMultiplier: number;
  };
  
  /** Scale out strategy. */
  scaleOut: {
    enabled: boolean;
    intervals: number;
    priceIncrement: number;
    sizeReduction: number;
  };
  
  /** Scaling limits. */
  limits: {
    maxScaleIns: number;
    maxScaleOuts: number;
    maxTotalSize: string;
  };
}

/**
 * Position tracking configuration.
 */
interface PositionTracking {
  /** Real-time tracking. */
  realTime: {
    enabled: boolean;
    interval: number;
    priceFeeds: string[];
  };
  
  /** Historical tracking. */
  historical: {
    retention: number;
    granularity: string;
    compression: boolean;
  };
  
  /** Performance tracking. */
  performance: {
    benchmarks: string[];
    metrics: string[];
    reporting: {
      frequency: string;
      recipients: string[];
    };
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  PositionId,
  PositionStatus,
  PositionSide,
  PositionType,
  Position,
  PositionPnL,
  PositionCosts,
  PositionRisk,
  PositionMetadata,
  Portfolio,
  PortfolioSummary,
  PortfolioPerformance,
  PerformancePeriod,
  PortfolioAllocation,
  PortfolioRisk,
  PortfolioMetadata,
  PositionSizing,
  PositionScaling,
  PositionTracking
};
