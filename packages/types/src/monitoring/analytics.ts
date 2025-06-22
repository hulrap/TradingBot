/**
 * @file Trading Bot Analytics Types.
 * @package @trading-bot/types
 */

import type { Address } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';
import type { OrderType } from '../trading/orders';
import type { OpportunityType } from '../trading/opportunities';

// ========================================
// BASIC ANALYTICS TYPES  
// ========================================

/**
 * Metric identifier type.
 */
type MetricId = string;

/**
 * Metric type enumeration.
 */
type MetricType = 
  | 'counter'
  | 'gauge' 
  | 'histogram'
  | 'summary'
  | 'timer';

/**
 * Metric value type.
 */
type MetricValue = number | string;

/**
 * Metric tags for categorization.
 */
type MetricTags = Record<string, string>;

/**
 * Basic metric interface.
 */
interface Metric {
  /** Metric identifier. */
  id: MetricId;
  
  /** Metric name. */
  name: string;
  
  /** Metric type. */
  type: MetricType;
  
  /** Metric value. */
  value: MetricValue;
  
  /** Metric tags. */
  tags: MetricTags;
  
  /** Timestamp. */
  timestamp: number;
}

/**
 * Metric aggregation configuration.
 */
interface MetricAggregation {
  /** Aggregation type. */
  type: 'sum' | 'avg' | 'min' | 'max' | 'count';
  
  /** Time window. */
  window: number;
  
  /** Group by fields. */
  groupBy?: string[];
}

/**
 * Metric query interface.
 */
interface MetricQuery {
  /** Metrics to query. */
  metrics: MetricId[];
  
  /** Time range. */
  timeRange: {
    start: number;
    end: number;
  };
  
  /** Filters. */
  filters?: Record<string, string | number>;
  
  /** Aggregation. */
  aggregation?: MetricAggregation;
}

/**
 * Metric filter interface.
 */
interface MetricFilter {
  /** Field to filter on. */
  field: string;
  
  /** Filter operator. */
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  
  /** Filter value. */
  value: string | number | (string | number)[];
}

/**
 * Metric group by configuration.
 */
interface MetricGroupBy {
  /** Fields to group by. */
  fields: string[];
  
  /** Aggregation for each group. */
  aggregation: MetricAggregation;
}

/**
 * Metric query result.
 */
interface MetricResult {
  /** Metric ID. */
  metricId: MetricId;
  
  /** Result data points. */
  data: Array<{
    timestamp: number;
    value: MetricValue;
    tags?: MetricTags;
  }>;
  
  /** Aggregation metadata. */
  metadata?: {
    aggregation: string;
    window: number;
    count: number;
  };
}

/**
 * Dashboard widget interface.
 */
interface DashboardWidget {
  /** Widget ID. */
  id: string;
  
  /** Widget title. */
  title: string;
  
  /** Widget type. */
  type: 'chart' | 'metric' | 'table' | 'gauge';
  
  /** Widget configuration. */
  config: {
    metrics: MetricId[];
    visualization: Record<string, unknown>;
  };
  
  /** Widget layout. */
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Dashboard layout interface.
 */
interface DashboardLayout {
  /** Layout name. */
  name: string;
  
  /** Grid configuration. */
  grid: {
    columns: number;
    rows: number;
  };
  
  /** Widgets in layout. */
  widgets: DashboardWidget[];
}

/**
 * Dashboard interface.
 */
interface Dashboard {
  /** Dashboard ID. */
  id: string;
  
  /** Dashboard name. */
  name: string;
  
  /** Dashboard layout. */
  layout: DashboardLayout;
  
  /** Dashboard metadata. */
  metadata: {
    createdAt: number;
    updatedAt: number;
    owner: string;
  };
}

/**
 * Report types.
 */
type ReportType = 'trading' | 'performance' | 'risk' | 'analytics';

/**
 * Report formats.
 */
type ReportFormat = 'json' | 'pdf' | 'csv' | 'html';

/**
 * Report configuration.
 */
interface ReportConfig {
  /** Report type. */
  type: ReportType;
  
  /** Report format. */
  format: ReportFormat;
  
  /** Report parameters. */
  parameters: Record<string, unknown>;
  
  /** Generation schedule. */
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
  };
}

/**
 * Report interface.
 */
interface Report {
  /** Report ID. */
  id: string;
  
  /** Report configuration. */
  config: ReportConfig;
  
  /** Report content. */
  content: unknown;
  
  /** Generation metadata. */
  metadata: {
    generatedAt: number;
    size: number;
    status: 'pending' | 'completed' | 'failed';
  };
}

/**
 * Strategy analytics interface.
 */
interface StrategyAnalytics {
  /** Strategy name. */
  strategy: string;
  
  /** Performance metrics. */
  performance: {
    totalTrades: number;
    successRate: number;
    profitLoss: string;
    maxDrawdown: string;
  };
  
  /** Time period. */
  period: {
    start: number;
    end: number;
  };
}

/**
 * Risk analytics interface.
 */
interface RiskAnalytics {
  /** Risk metrics. */
  metrics: {
    valueAtRisk: string;
    conditionalValueAtRisk: string;
    sharpeRatio: number;
    volatility: number;
  };
  
  /** Risk score. */
  riskScore: number;
  
  /** Risk level. */
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * Analytics query interface.
 */
interface AnalyticsQuery {
  /** Query type. */
  type: 'performance' | 'risk' | 'trading' | 'strategy';
  
  /** Query parameters. */
  parameters: Record<string, unknown>;
  
  /** Time range. */
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Analytics filter interface.
 */
interface AnalyticsFilter {
  /** Filter field. */
  field: string;
  
  /** Filter value. */
  value: unknown;
  
  /** Filter operator. */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in';
}

/**
 * Analytics result interface.
 */
interface AnalyticsResult {
  /** Query that generated this result. */
  query: AnalyticsQuery;
  
  /** Result data. */
  data: unknown;
  
  /** Result metadata. */
  metadata: {
    executionTime: number;
    recordCount: number;
    fromCache: boolean;
  };
}

// ========================================
// ROUTE ANALYTICS TYPES
// ========================================

/**
 * Route performance analytics.
 */
interface RoutePerformanceAnalytics {
  /** Route identifier. */
  routeId: string;
  
  /** Analysis period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Route performance metrics. */
  performance: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    medianExecutionTime: number;
    p95ExecutionTime: number;
    averageSlippage: number;
    medianSlippage: number;
    maxSlippage: number;
  };
  
  /** Route efficiency metrics. */
  efficiency: {
    averageGasCost: string;
    gasEfficiency: number;
    priceImpact: number;
    profitMargin: number;
    volumeCapacity: string;
  };
  
  /** Route usage patterns. */
  usage: {
    executionsByHour: Record<string, number>;
    executionsByDay: Record<string, number>;
    popularTokenPairs: Array<{
      tokenA: Address;
      tokenB: Address;
      count: number;
      volume: string;
    }>;
    averageTradeSize: string;
    medianTradeSize: string;
  };
  
  /** Route quality trends. */
  trends: {
    qualityScore: Array<{
      timestamp: number;
      score: number;
    }>;
    executionTime: Array<{
      timestamp: number;
      time: number;
    }>;
    slippageTrend: Array<{
      timestamp: number;
      slippage: number;
    }>;
  };
}

/**
 * Route comparison analysis.
 */
interface RouteComparisonAnalysis {
  /** Primary route. */
  primaryRoute: string;
  
  /** Comparison routes. */
  comparisonRoutes: string[];
  
  /** Comparison period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Comparison metrics. */
  metrics: {
    executionTime: {
      primary: number;
      comparisons: Record<string, number>;
      bestRoute: string;
      improvement: number;
    };
    slippage: {
      primary: number;
      comparisons: Record<string, number>;
      bestRoute: string;
      improvement: number;
    };
    gasCost: {
      primary: string;
      comparisons: Record<string, string>;
      bestRoute: string;
      savings: string;
    };
    successRate: {
      primary: number;
      comparisons: Record<string, number>;
      bestRoute: string;
      improvement: number;
    };
  };
  
  /** Recommendation. */
  recommendation: {
    suggestedRoute: string;
    reason: string;
    expectedImprovement: number;
    confidence: number;
  };
}

// ========================================
// TRADING ANALYTICS TYPES
// ========================================

/**
 * Trading statistics.
 */
interface TradingStats {
  /** Statistics period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Overall trading metrics. */
  overall: {
    totalTrades: number;
    totalVolume: string;
    totalProfit: string;
    totalLoss: string;
    netProfit: string;
    successRate: number;
    averageProfit: string;
    averageLoss: string;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: string;
    maxDrawdownPercent: number;
  };
  
  /** Trading by chain. */
  byChain: Record<SupportedChain, {
    trades: number;
    volume: string;
    profit: string;
    successRate: number;
  }>;
  
  /** Trading by order type. */
  byOrderType: Record<OrderType, {
    count: number;
    volume: string;
    successRate: number;
    averageExecutionTime: number;
  }>;
  
  /** Trading by opportunity type. */
  byOpportunityType: Record<OpportunityType, {
    count: number;
    volume: string;
    profit: string;
    successRate: number;
    averageProfit: string;
  }>;
  
  /** Time-based analysis. */
  temporal: {
    hourlyDistribution: Record<string, {
      trades: number;
      volume: string;
      profit: string;
    }>;
    dayOfWeekDistribution: Record<string, {
      trades: number;
      volume: string;
      profit: string;
    }>;
    monthlyTrends: Array<{
      month: string;
      trades: number;
      volume: string;
      profit: string;
      successRate: number;
    }>;
  };
  
  /** Token analysis. */
  tokens: {
    mostTraded: Array<{
      tokenAddress: Address;
      symbol: string;
      trades: number;
      volume: string;
      profit: string;
    }>;
    mostProfitable: Array<{
      tokenAddress: Address;
      symbol: string;
      trades: number;
      profit: string;
      roi: number;
    }>;
    tokenPairAnalysis: Array<{
      tokenA: Address;
      tokenB: Address;
      trades: number;
      volume: string;
      profit: string;
      successRate: number;
    }>;
  };
}

/**
 * Performance analytics.
 */
interface PerformanceAnalytics {
  /** Analytics period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Financial performance. */
  financial: {
    totalReturn: string;
    totalReturnPercent: number;
    annualizedReturn: number;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: string;
    maxDrawdownPercent: number;
    recoveryTime: number;
    profitFactor: number;
    winRate: number;
    averageWin: string;
    averageLoss: string;
    largestWin: string;
    largestLoss: string;
  };
  
  /** Risk metrics. */
  risk: {
    valueAtRisk: string;
    conditionalValueAtRisk: string;
    beta: number;
    alpha: number;
    correlation: number;
    downside_deviation: number;
    upside_deviation: number;
    trackingError: number;
  };
  
  /** Operational metrics. */
  operational: {
    averageExecutionTime: number;
    medianExecutionTime: number;
    systemUptime: number;
    errorRate: number;
    averageLatency: number;
    throughput: number;
    capacityUtilization: number;
  };
  
  /** Benchmarking. */
  benchmark: {
    benchmarkReturn: number;
    excessReturn: number;
    informationRatio: number;
    treynorRatio: number;
    jensenAlpha: number;
    battingAverage: number;
  };
}

// ========================================
// USER ANALYTICS TYPES
// ========================================

/**
 * User behavior analytics.
 */
interface UserAnalytics {
  /** User identifier. */
  userId: string;
  
  /** Analysis period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Activity metrics. */
  activity: {
    loginCount: number;
    sessionDuration: number;
    averageSessionDuration: number;
    pageViews: number;
    uniquePages: number;
    lastActivity: number;
    activeHours: Record<string, number>;
  };
  
  /** Trading behavior. */
  trading: {
    totalTrades: number;
    averageTradeSize: string;
    preferredChains: SupportedChain[];
    preferredTokens: Address[];
    riskTolerance: 'low' | 'medium' | 'high';
    tradingFrequency: 'low' | 'medium' | 'high';
    profitability: number;
  };
  
  /** Feature usage. */
  features: {
    mostUsedFeatures: Array<{
      feature: string;
      usageCount: number;
      timeSpent: number;
    }>;
    featureAdoption: Record<string, {
      adopted: boolean;
      firstUsed?: number;
      usageFrequency: number;
    }>;
  };
  
  /** Preferences. */
  preferences: {
    defaultChain: SupportedChain;
    slippageTolerance: number;
    gasStrategy: string;
    notificationSettings: Record<string, boolean>;
    uiTheme: string;
  };
}

/**
 * Cohort analysis.
 */
interface CohortAnalysis {
  /** Cohort definition. */
  cohort: {
    name: string;
    definition: string;
    timeframe: {
      start: number;
      end: number;
    };
  };
  
  /** Cohort metrics. */
  metrics: {
    totalUsers: number;
    activeUsers: number;
    retentionRate: number;
    churnRate: number;
    averageLifetimeValue: string;
    averageRevenue: string;
  };
  
  /** Retention analysis. */
  retention: Array<{
    period: number;
    retainedUsers: number;
    retentionRate: number;
    churnedUsers: number;
    churnRate: number;
  }>;
  
  /** Behavioral patterns. */
  patterns: {
    commonActions: Array<{
      action: string;
      frequency: number;
      percentage: number;
    }>;
    dropoffPoints: Array<{
      step: string;
      dropoffRate: number;
      usersLost: number;
    }>;
  };
}

// ========================================
// MARKET ANALYTICS TYPES
// ========================================

/**
 * Market analytics.
 */
interface MarketAnalytics {
  /** Market identifier. */
  marketId: string;
  
  /** Analysis period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Volume analysis. */
  volume: {
    totalVolume: string;
    averageDailyVolume: string;
    volumeDistribution: Array<{
      hour: number;
      volume: string;
      percentage: number;
    }>;
    topTokensByVolume: Array<{
      tokenAddress: Address;
      symbol: string;
      volume: string;
      trades: number;
    }>;
  };
  
  /** Liquidity analysis. */
  liquidity: {
    totalLiquidity: string;
    averageLiquidity: string;
    liquidityUtilization: number;
    liquidityProviders: number;
    liquidityDistribution: Record<string, string>;
  };
  
  /** Price analysis. */
  price: {
    volatility: number;
    averageSpread: number;
    priceImpact: number;
    arbitrageOpportunities: number;
    priceEfficiency: number;
  };
  
  /** DEX comparison. */
  dexComparison: Array<{
    dexName: string;
    volume: string;
    liquidity: string;
    trades: number;
    averageSlippage: number;
    marketShare: number;
  }>;
}

// ========================================
// REPORTING TYPES
// ========================================

/**
 * Report section.
 */
interface ReportSection {
  /** Section identifier. */
  id: string;
  
  /** Section title. */
  title: string;
  
  /** Section type. */
  type: 'chart' | 'table' | 'text' | 'metric' | 'custom';
  
  /** Section content. */
  content: string | number | Record<string, unknown> | unknown[]  ;
  
  /** Section metadata. */
  metadata: {
    order: number;
    visible: boolean;
    collapsible: boolean;
  };
}

/**
 * Analytics report.
 */
interface AnalyticsReport {
  /** Report identifier. */
  id: string;
  
  /** Report type. */
  type: 'trading' | 'performance' | 'route' | 'user' | 'market' | 'custom';
  
  /** Report metadata. */
  metadata: {
    title: string;
    description?: string;
    author: string;
    createdAt: number;
    period: {
      start: number;
      end: number;
    };
    parameters: Record<string, string | number | boolean | string[]>;
  };
  
  /** Report sections. */
  sections: ReportSection[];
  
  /** Report summary. */
  summary: {
    keyMetrics: Array<{
      name: string;
      value: string | number;
      unit?: string;
      change?: number;
      changeType?: 'increase' | 'decrease' | 'stable';
    }>;
    insights: string[];
    recommendations: string[];
  };
  
  /** Report format. */
  format: 'json' | 'pdf' | 'html' | 'csv' | 'excel';
}

// ========================================
// DASHBOARD ANALYTICS TYPES
// ========================================

/**
 * Analytics widget.
 */
interface AnalyticsWidget {
  /** Widget identifier. */
  id: string;
  
  /** Widget configuration. */
  config: {
    type: 'line-chart' | 'bar-chart' | 'pie-chart' | 'metric-card' | 'table' | 'heatmap';
    title: string;
    dataSource: string;
    query: Record<string, string | number | boolean | Record<string, unknown>>;
    visualization: Record<string, string | number | boolean | Record<string, unknown>>;
  };
  
  /** Widget layout. */
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Widget data. */
  data?: string | number | Record<string, unknown> | unknown[] | null;
  
  /** Widget metadata. */
  metadata: {
    lastUpdated: number;
    refreshInterval: number;
    isLoading: boolean;
    hasError: boolean;
    errorMessage?: string;
  };
}

/**
 * Analytics dashboard configuration.
 */
interface AnalyticsDashboard {
  /** Dashboard identifier. */
  id: string;
  
  /** Dashboard metadata. */
  metadata: {
    name: string;
    description?: string;
    owner: string;
    createdAt: number;
    updatedAt: number;
    isPublic: boolean;
    tags: string[];
  };
  
  /** Dashboard layout. */
  layout: {
    grid: {
      columns: number;
      rows: number;
      gap: number;
    };
    widgets: AnalyticsWidget[];
  };
  
  /** Dashboard filters. */
  filters: {
    timeRange: {
      start: number;
      end: number;
      preset?: string;
    };
    chains?: SupportedChain[];
    tokens?: Address[];
    custom: Record<string, string | number | boolean>;
  };
  
  /** Refresh configuration. */
  refresh: {
    interval: number;
    autoRefresh: boolean;
    lastRefresh: number;
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Standard analytics periods.
 */
const ANALYTICS_PERIODS = {
  LAST_HOUR: 3600,
  LAST_24_HOURS: 86400,
  LAST_7_DAYS: 604800,
  LAST_30_DAYS: 2592000,
  LAST_90_DAYS: 7776000,
  LAST_YEAR: 31536000
} as const;

/**
 * Performance benchmarks.
 */
const PERFORMANCE_BENCHMARKS = {
  EXCELLENT_SUCCESS_RATE: 0.95,
  GOOD_SUCCESS_RATE: 0.85,
  ACCEPTABLE_SUCCESS_RATE: 0.75,
  EXCELLENT_EXECUTION_TIME: 500,    // ms
  GOOD_EXECUTION_TIME: 1000,        // ms
  ACCEPTABLE_EXECUTION_TIME: 2000   // ms
} as const;

/**
 * Default metric aggregations.
 */
const DEFAULT_METRIC_AGGREGATIONS = {
  COUNT: { type: 'count' as const, window: 3600 },
  AVERAGE: { type: 'avg' as const, window: 3600 },
  SUM: { type: 'sum' as const, window: 3600 },
  MAX: { type: 'max' as const, window: 3600 },
  MIN: { type: 'min' as const, window: 3600 }
} as const;

/**
 * Supported time ranges for analytics.
 */
const SUPPORTED_TIME_RANGES = {
  LAST_HOUR: '1h',
  LAST_DAY: '1d',
  LAST_WEEK: '7d',
  LAST_MONTH: '30d',
  LAST_QUARTER: '90d',
  LAST_YEAR: '1y'
} as const;

// Consolidated export declaration
export type {
  MetricId,
  MetricType,
  MetricValue,
  MetricTags,
  Metric,
  MetricAggregation,
  MetricQuery,
  MetricFilter,
  MetricGroupBy,
  MetricResult,
  DashboardWidget,
  DashboardLayout,
  Dashboard,
  ReportType,
  ReportFormat,
  ReportConfig,
  Report,
  StrategyAnalytics,
  RiskAnalytics,
  AnalyticsQuery,
  AnalyticsFilter,
  AnalyticsResult,
  RoutePerformanceAnalytics,
  RouteComparisonAnalysis,
  TradingStats,
  PerformanceAnalytics,
  UserAnalytics,
  CohortAnalysis,
  MarketAnalytics,
  ReportSection,
  AnalyticsReport,
  AnalyticsWidget,
  AnalyticsDashboard
};

export {
  ANALYTICS_PERIODS,
  PERFORMANCE_BENCHMARKS,
  DEFAULT_METRIC_AGGREGATIONS,
  SUPPORTED_TIME_RANGES
};
