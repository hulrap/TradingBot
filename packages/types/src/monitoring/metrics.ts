/**
 * @file Performance Metrics and System Health Types.
 * 
 * Monitoring and metrics types for trading bot system health,
 * performance tracking, and operational metrics collection.
 * 
 * Features:
 * - System performance metrics (CPU, memory, network)
 * - Trading performance metrics (execution times, success rates)
 * - Health check definitions and status
 * - Metric aggregation and historical data
 * - Custom metric definitions.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';

// ========================================
// CORE METRIC TYPES
// ========================================

/**
 * Metric identifier.
 */
type MetricId = string;

/**
 * Metric types.
 */
type MetricType = 
  | 'counter'       // Monotonically increasing counter
  | 'gauge'         // Instantaneous value
  | 'histogram'     // Distribution of values
  | 'summary'       // Summary statistics
  | 'timer'         // Timing measurements
  | 'rate'          // Rate per unit time
  | 'ratio';        // Ratio between two values

/**
 * Metric units.
 */
type MetricUnit = 
  | 'bytes'
  | 'milliseconds'
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'percent'
  | 'count'
  | 'rate'
  | 'usd'
  | 'wei'
  | 'gwei'
  | 'gas'
  | 'tps'
  | 'bps';

/**
 * Metric aggregation configuration.
 */
interface MetricAggregation {
  /** Aggregation function. */
  function: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile' | 'stddev';
  
  /** Aggregation window. */
  window: number;
  
  /** Percentile value (for percentile aggregation). */
  percentile?: number;
  
  /** Aggregation tags. */
  groupBy: string[];
}

/**
 * Metric metadata.
 */
interface MetricMetadata {
  /** Metric source. */
  source: string;
  
  /** Metric collection method. */
  collectionMethod: 'push' | 'pull' | 'calculated';
  
  /** Metric collection interval. */
  interval: number;
  
  /** Metric retention period. */
  retention: number;
  
  /** Metric aggregation rules. */
  aggregation: MetricAggregation[];
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Base metric interface.
 */
interface Metric {
  /** Metric identifier. */
  id: MetricId;
  
  /** Metric name. */
  name: string;
  
  /** Metric description. */
  description: string;
  
  /** Metric type. */
  type: MetricType;
  
  /** Metric unit. */
  unit: MetricUnit;
  
  /** Metric value. */
  value: number;
  
  /** Metric timestamp. */
  timestamp: number;
  
  /** Metric tags for grouping. */
  tags: Record<string, string>;
  
  /** Metric metadata. */
  metadata: MetricMetadata;
}

// ========================================
// SYSTEM METRICS
// ========================================

/**
 * System performance metrics.
 */
interface SystemMetrics {
  /** Measurement timestamp. */
  timestamp: number;
  
  /** CPU metrics. */
  cpu: {
    usage: number;              // CPU usage percentage
    loadAverage: number[];      // 1, 5, 15 minute load averages
    cores: number;              // Number of CPU cores
    frequency: number;          // CPU frequency in MHz
  };
  
  /** Memory metrics. */
  memory: {
    used: number;               // Used memory in bytes
    available: number;          // Available memory in bytes
    total: number;              // Total memory in bytes
    usage: number;              // Memory usage percentage
    buffers: number;            // Buffer memory in bytes
    cached: number;             // Cached memory in bytes
    swap: {
      used: number;
      total: number;
      usage: number;
    };
  };
  
  /** Disk metrics. */
  disk: {
    usage: Array<{
      mount: string;
      used: number;
      available: number;
      total: number;
      usage: number;
    }>;
    io: {
      readBytes: number;
      writeBytes: number;
      readOps: number;
      writeOps: number;
    };
  };
  
  /** Network metrics. */
  network: {
    interfaces: Array<{
      name: string;
      bytesReceived: number;
      bytesSent: number;
      packetsReceived: number;
      packetsSent: number;
      errors: number;
      drops: number;
    }>;
    connections: {
      active: number;
      established: number;
      listening: number;
    };
  };
  
  /** Process metrics. */
  process: {
    uptime: number;             // Process uptime in seconds
    threads: number;            // Number of threads
    fileDescriptors: number;    // Open file descriptors
    heapUsed: number;          // Heap memory used
    heapTotal: number;         // Total heap memory
    external: number;          // External memory usage
    rss: number;               // Resident set size
  };
}

/**
 * System health status.
 */
type HealthStatus = 
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

/**
 * Health check result.
 */
interface HealthCheck {
  /** Check identifier. */
  id: string;
  
  /** Check name. */
  name: string;
  
  /** Health status. */
  status: HealthStatus;
  
  /** Check timestamp. */
  timestamp: number;
  
  /** Response time in milliseconds. */
  responseTime: number;
  
  /** Check details. */
  details: {
    message: string;
    metadata: Record<string, string | number | boolean>;
  };
  
  /** Check dependencies. */
  dependencies: string[];
}

/**
 * System health summary.
 */
interface SystemHealth {
  /** Overall health status. */
  status: HealthStatus;
  
  /** Health check results. */
  checks: HealthCheck[];
  
  /** Health score (0-100). */
  score: number;
  
  /** Health timestamp. */
  timestamp: number;
  
  /** Health metadata. */
  metadata: {
    version: string;
    uptime: number;
    environment: string;
  };
}

// ========================================
// TRADING METRICS
// ========================================

/**
 * Trading performance metrics.
 */
interface TradingMetrics {
  /** Measurement period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Order execution metrics. */
  orders: {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    successRate: number;
    averageExecutionTime: number;
    medianExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
  };
  
  /** Route performance metrics. */
  routes: {
    discovered: number;
    executed: number;
    optimizationTime: number;
    averageHops: number;
    successRate: number;
  };
  
  /** Volume metrics. */
  volume: {
    totalUSD: string;
    totalTrades: number;
    averageTradeSize: string;
    largestTrade: string;
    byChain: Record<SupportedChain, {
      volumeUSD: string;
      trades: number;
    }>;
  };
  
  /** Profit metrics. */
  profit: {
    totalUSD: string;
    averagePerTrade: string;
    profitableTradesRate: number;
    largestProfit: string;
    largestLoss: string;
    sharpeRatio: number;
    maxDrawdown: string;
  };
  
  /** Gas metrics. */
  gas: {
    totalSpent: string;
    averagePerTrade: string;
    savedFromOptimization: string;
    optimizationRate: number;
  };
  
  /** Slippage metrics. */
  slippage: {
    average: number;
    median: number;
    p95: number;
    p99: number;
    exceedsThreshold: number;
  };
  
  /** MEV metrics. */
  mev: {
    protectedTrades: number;
    protectionRate: number;
    mevSavings: string;
    averageProtectionCost: string;
  };
}

/**
 * Bot performance metrics.
 */
interface BotMetrics {
  /** Bot identifier. */
  botId: string;
  
  /** Bot type. */
  botType: string;
  
  /** Measurement period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Bot status. */
  status: {
    isActive: boolean;
    uptime: number;
    lastActivity: number;
    errorCount: number;
  };
  
  /** Trading metrics. */
  trading: TradingMetrics;
  
  /** Resource usage. */
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
  };
  
  /** Custom bot metrics. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Chain-specific metrics.
 */
interface ChainMetrics {
  /** Target chain. */
  chain: SupportedChain;
  
  /** Measurement timestamp. */
  timestamp: number;
  
  /** Connection metrics. */
  connection: {
    latency: number;
    uptime: number;
    errorRate: number;
    requestsPerSecond: number;
  };
  
  /** Block metrics. */
  blocks: {
    currentHeight: number;
    averageBlockTime: number;
    confirmationTime: number;
    reorganizations: number;
  };
  
  /** Transaction pool metrics. */
  mempool: {
    size: number;
    averageGasPrice: string;
    congestionLevel: 'low' | 'medium' | 'high' | 'extreme';
  };
  
  /** Gas metrics. */
  gas: {
    currentPrice: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    volatility: number;
  };
  
  /** Network activity. */
  activity: {
    transactionsPerSecond: number;
    totalValueLocked: string;
    dexVolume24h: string;
  };
}

// ========================================
// AGGREGATED METRICS
// ========================================

/**
 * Time series data point.
 */
interface TimeSeriesPoint {
  /** Timestamp. */
  timestamp: number;
  
  /** Value. */
  value: number;
  
  /** Additional dimensions. */
  dimensions: Record<string, string>;
}

/**
 * Time series data.
 */
interface TimeSeries {
  /** Metric identifier. */
  metricId: MetricId;
  
  /** Time series data points. */
  points: TimeSeriesPoint[];
  
  /** Aggregation metadata. */
  metadata: {
    aggregation: string;
    window: number;
    retention: number;
  };
}

/**
 * Metric summary statistics.
 */
interface MetricSummary {
  /** Metric identifier. */
  metricId: MetricId;
  
  /** Summary period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Summary statistics. */
  stats: {
    count: number;
    sum: number;
    average: number;
    minimum: number;
    maximum: number;
    standardDeviation: number;
    percentiles: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
  
  /** Trend analysis. */
  trend: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
    slope: number;
  };
}

// ========================================
// METRIC COLLECTION TYPES
// ========================================

/**
 * Metric definition.
 */
interface MetricDefinition {
  /** Metric identifier. */
  id: MetricId;
  
  /** Metric name. */
  name: string;
  
  /** Metric type. */
  type: MetricType;
  
  /** Metric unit. */
  unit: MetricUnit;
  
  /** Data source. */
  source: string;
  
  /** Collection query/expression. */
  query: string;
  
  /** Metric tags. */
  tags: Record<string, string>;
  
  /** Thresholds for alerting. */
  thresholds: {
    warning: number;
    critical: number;
  };
}

/**
 * Metric filter.
 */
interface MetricFilter {
  /** Filter type. */
  type: 'include' | 'exclude';
  
  /** Filter condition. */
  condition: string;
  
  /** Filter parameters. */
  parameters: Record<string, string | number | boolean | string[]>;
}

/**
 * Metric collection configuration.
 */
interface MetricCollectionConfig {
  /** Collection identifier. */
  id: string;
  
  /** Metrics to collect. */
  metrics: MetricDefinition[];
  
  /** Collection interval in seconds. */
  interval: number;
  
  /** Collection method. */
  method: 'push' | 'pull';
  
  /** Collection filters. */
  filters: MetricFilter[];
  
  /** Storage configuration. */
  storage: {
    retention: number;
    aggregations: MetricAggregation[];
    compression: boolean;
  };
}

/**
 * Metric batch.
 */
interface MetricBatch {
  /** Batch identifier. */
  id: string;
  
  /** Batch timestamp. */
  timestamp: number;
  
  /** Metrics in batch. */
  metrics: Metric[];
  
  /** Batch metadata. */
  metadata: {
    source: string;
    collectionId: string;
    count: number;
  };
}

// ========================================
// MONITORING DASHBOARD TYPES
// ========================================

/**
 * Dashboard widget types.
 */
type WidgetType = 
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'gauge'
  | 'counter'
  | 'table'
  | 'heatmap'
  | 'status-indicator';

/**
 * Dashboard widget.
 */
interface DashboardWidget {
  /** Widget identifier. */
  id: string;
  
  /** Widget title. */
  title: string;
  
  /** Widget type. */
  type: WidgetType;
  
  /** Widget configuration. */
  config: {
    metrics: MetricId[];
    timeRange: {
      start: number;
      end: number;
    };
    refreshInterval: number;
    visualization: Record<string, string | number | boolean | Record<string, unknown>>;
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
 * Monitoring dashboard.
 */
interface MonitoringDashboard {
  /** Dashboard identifier. */
  id: string;
  
  /** Dashboard name. */
  name: string;
  
  /** Dashboard description. */
  description?: string;
  
  /** Dashboard widgets. */
  widgets: DashboardWidget[];
  
  /** Dashboard metadata. */
  metadata: {
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    isPublic: boolean;
    tags: string[];
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Standard metric collection intervals.
 */
const METRIC_INTERVALS = {
  REAL_TIME: 1,           // 1 second
  HIGH_FREQUENCY: 5,      // 5 seconds
  NORMAL: 30,             // 30 seconds
  LOW_FREQUENCY: 300,     // 5 minutes
  HOURLY: 3600,           // 1 hour
  DAILY: 86400            // 24 hours
} as const;

/**
 * Default metric retention periods.
 */
const METRIC_RETENTION = {
  SHORT_TERM: 86400,      // 1 day
  MEDIUM_TERM: 604800,    // 7 days
  LONG_TERM: 2592000,     // 30 days
  ARCHIVE: 31536000       // 1 year
} as const;

/**
 * Health check timeout values.
 */
const HEALTH_CHECK_TIMEOUTS = {
  FAST: 1000,             // 1 second
  NORMAL: 5000,           // 5 seconds
  SLOW: 30000             // 30 seconds
} as const;

// ========================================
// ADDITIONAL MISSING TYPES
// ========================================

/**
 * Metrics collector configuration (alias for MetricCollectionConfig).
 */
interface MetricsCollectorConfig extends MetricCollectionConfig {}

/**
 * Application-specific metrics.
 */
interface ApplicationMetrics {
  /** Application name. */
  applicationName: string;
  
  /** Version. */
  version: string;
  
  /** Performance metrics. */
  performance: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeUsers: number;
  };
  
  /** Resource usage. */
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  
  /** Custom application metrics. */
  custom: Record<string, number>;
}

/**
 * Business metrics.
 */
interface BusinessMetrics {
  /** Revenue metrics. */
  revenue: {
    totalRevenue: string;
    revenueGrowth: number;
    averageRevenuePerUser: string;
  };
  
  /** User metrics. */
  users: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    churnRate: number;
  };
  
  /** Trading metrics. */
  trading: {
    totalVolume: string;
    totalTrades: number;
    successRate: number;
  };
}

/**
 * Metrics snapshot.
 */
interface MetricsSnapshot {
  /** Snapshot timestamp. */
  timestamp: number;
  
  /** System metrics. */
  system: SystemMetrics;
  
  /** Application metrics. */
  application?: ApplicationMetrics;
  
  /** Business metrics. */
  business?: BusinessMetrics;
  
  /** Snapshot metadata. */
  metadata: {
    version: string;
    source: string;
    duration: number;
  };
}

/**
 * Metrics history.
 */
interface MetricsHistory {
  /** Metric identifier. */
  metricId: MetricId;
  
  /** Historical data points. */
  data: Array<{
    timestamp: number;
    value: number;
    tags: Record<string, string>;
  }>;
  
  /** History metadata. */
  metadata: {
    startTime: number;
    endTime: number;
    resolution: number;
    count: number;
  };
}

/**
 * Metrics alert.
 */
interface MetricsAlert {
  /** Alert identifier. */
  id: string;
  
  /** Metric being monitored. */
  metricId: MetricId;
  
  /** Alert conditions. */
  conditions: {
    threshold: number;
    operator: 'gt' | 'lt' | 'eq' | 'ne';
    duration: number;
  };
  
  /** Alert status. */
  status: 'active' | 'resolved' | 'suppressed';
  
  /** Alert timestamps. */
  timestamps: {
    created: number;
    triggered?: number;
    resolved?: number;
  };
}

/**
 * Metrics export configuration.
 */
interface MetricsExport {
  /** Export format. */
  format: 'json' | 'csv' | 'prometheus';
  
  /** Export filters. */
  filters: {
    metrics: MetricId[];
    timeRange: {
      start: number;
      end: number;
    };
    tags?: Record<string, string>;
  };
  
  /** Export destination. */
  destination: {
    type: 'file' | 'url' | 'stream';
    config: Record<string, unknown>;
  };
}

/**
 * Custom metric definition.
 */
interface CustomMetric {
  /** Metric identifier. */
  id: MetricId;
  
  /** Metric name. */
  name: string;
  
  /** Calculation expression. */
  expression: string;
  
  /** Dependencies. */
  dependencies: MetricId[];
  
  /** Custom parameters. */
  parameters: Record<string, unknown>;
}

/**
 * Metrics aggregator (alias for MetricAggregation).
 */
interface MetricsAggregator extends MetricAggregation {}

// ========================================
// ADDITIONAL CONSTANTS
// ========================================

/**
 * Default metrics configuration.
 */
const DEFAULT_METRICS_CONFIG = {
  collection: {
    interval: METRIC_INTERVALS.NORMAL,
    batchSize: 100,
    timeout: 5000,
    retries: 3
  },
  storage: {
    retention: METRIC_RETENTION.MEDIUM_TERM,
    compression: true,
    aggregation: ['avg', 'sum', 'min', 'max']
  },
  alerts: {
    enabled: true,
    defaultThresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      errorRate: 5
    }
  }
} as const;

/**
 * Metrics retention periods.
 */
const METRICS_RETENTION_PERIODS = {
  HIGH_FREQUENCY: 3600,        // 1 hour
  NORMAL_FREQUENCY: 86400,     // 1 day
  LOW_FREQUENCY: 604800,       // 7 days
  AGGREGATED: 2592000,         // 30 days
  ARCHIVE: 31536000            // 1 year
} as const;

// Consolidated export declaration
export type {
  MetricId,
  MetricType,
  MetricUnit,
  MetricAggregation,
  MetricMetadata,
  Metric,
  SystemMetrics,
  HealthStatus,
  HealthCheck,
  SystemHealth,
  TradingMetrics,
  BotMetrics,
  ChainMetrics,
  TimeSeriesPoint,
  TimeSeries,
  MetricSummary,
  MetricDefinition,
  MetricFilter,
  MetricCollectionConfig,
  MetricBatch,
  WidgetType,
  DashboardWidget,
  MonitoringDashboard,
  MetricsCollectorConfig,
  ApplicationMetrics,
  BusinessMetrics,
  MetricsSnapshot,
  MetricsHistory,
  MetricsAlert,
  MetricsExport,
  CustomMetric,
  MetricsAggregator
};

export {
  METRIC_INTERVALS,
  METRIC_RETENTION,
  HEALTH_CHECK_TIMEOUTS,
  DEFAULT_METRICS_CONFIG,
  METRICS_RETENTION_PERIODS
};
