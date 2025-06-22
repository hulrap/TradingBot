/**
 * @file Data Processing Pipeline Types
 * 
 * Stream processing, data aggregation, analysis workflows, and
 * real-time data transformation types for the processing package.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { Address, TokenInfo } from '../blockchain/addresses';
import type { DataSourceId } from '../data-sources/integrations';

// ========================================
// PIPELINE CORE TYPES
// ========================================

/**
 * Pipeline identifier.
 */
type PipelineId = string;

/**
 * Pipeline stage types.
 */
type PipelineStageType = 
  | 'input'
  | 'filter'
  | 'transform'
  | 'aggregate'
  | 'analyze'
  | 'validate'
  | 'output'
  | 'branch'
  | 'merge'
  | 'custom';

/**
 * Pipeline execution status.
 */
type PipelineStatus = 
  | 'idle'
  | 'running'
  | 'paused'
  | 'error'
  | 'completed'
  | 'cancelled';

/**
 * Data processing modes.
 */
type ProcessingMode = 
  | 'realtime'
  | 'batch'
  | 'micro-batch'
  | 'event-driven'
  | 'hybrid';

// ========================================
// PIPELINE CONFIGURATION
// ========================================

/**
 * Pipeline stage configuration.
 */
interface PipelineStage {
  /** Stage identifier. */
  id: string;
  
  /** Stage name. */
  name: string;
  
  /** Stage type. */
  type: PipelineStageType;
  
  /** Stage configuration. */
  config: {
    /** Processing function. */
    processor: string;
    
    /** Stage parameters. */
    parameters: Record<string, unknown>;
    
    /** Input schema. */
    inputSchema?: Record<string, unknown>;
    
    /** Output schema. */
    outputSchema?: Record<string, unknown>;
    
    /** Validation rules. */
    validation?: Array<{
      field: string;
      rule: string;
      message: string;
    }>;
  };
  
  /** Execution settings. */
  execution: {
    /** Timeout in milliseconds. */
    timeout: number;
    
    /** Retry configuration. */
    retry: {
      maxAttempts: number;
      backoffMs: number;
    };
    
    /** Parallel execution. */
    parallel: boolean;
    
    /** Batch size. */
    batchSize?: number;
  };
  
  /** Error handling. */
  errorHandling: {
    /** Continue on error. */
    continueOnError: boolean;
    
    /** Dead letter queue. */
    deadLetterQueue?: string;
    
    /** Error callback. */
    onError?: string;
  };
  
  /** Dependencies. */
  dependencies: string[];
  
  /** Output destinations. */
  outputs: string[];
}

/**
 * Pipeline configuration.
 */
interface PipelineConfig {
  /** Pipeline identifier. */
  id: PipelineId;
  
  /** Pipeline name. */
  name: string;
  
  /** Pipeline description. */
  description?: string;
  
  /** Processing mode. */
  mode: ProcessingMode;
  
  /** Pipeline stages. */
  stages: PipelineStage[];
  
  /** Data sources. */
  sources: Array<{
    sourceId: DataSourceId;
    subscriptionId?: string;
    inputStage: string;
  }>;
  
  /** Output destinations. */
  outputs: Array<{
    type: 'callback' | 'queue' | 'database' | 'webhook';
    config: Record<string, unknown>;
  }>;
  
  /** Pipeline settings. */
  settings: {
    /** Maximum parallel executions. */
    maxConcurrency: number;
    
    /** Buffer size. */
    bufferSize: number;
    
    /** Flush interval. */
    flushInterval: number;
    
    /** Enable monitoring. */
    enableMonitoring: boolean;
    
    /** Enable debugging. */
    enableDebug: boolean;
  };
  
  /** Resource limits. */
  resources: {
    /** Memory limit in MB. */
    memoryLimit: number;
    
    /** CPU limit in percentage. */
    cpuLimit: number;
    
    /** Disk limit in MB. */
    diskLimit: number;
  };
}

// ========================================
// STREAM PROCESSING TYPES
// ========================================

/**
 * Stream data item.
 */
interface StreamDataItem {
  /** Item identifier. */
  id: string;
  
  /** Item timestamp. */
  timestamp: number;
  
  /** Source identifier. */
  sourceId: DataSourceId;
  
  /** Data payload. */
  data: Record<string, unknown>;
  
  /** Metadata. */
  metadata: {
    /** Pipeline ID. */
    pipelineId: PipelineId;
    
    /** Stage ID. */
    stageId: string;
    
    /** Processing start time. */
    startTime: number;
    
    /** Item version. */
    version: number;
    
    /** Item tags. */
    tags: string[];
  };
}

/**
 * Stream window configuration.
 */
interface StreamWindow {
  /** Window type. */
  type: 'tumbling' | 'sliding' | 'session' | 'count';
  
  /** Window size. */
  size: number;
  
  /** Window slide interval. */
  slide?: number;
  
  /** Session timeout. */
  sessionTimeout?: number;
  
  /** Window key. */
  key?: string;
  
  /** Late data handling. */
  lateDataHandling: {
    /** Maximum lateness. */
    maxLateness: number;
    
    /** Action for late data. */
    action: 'drop' | 'emit' | 'buffer';
  };
}

/**
 * Stream aggregation configuration.
 */
interface StreamAggregation {
  /** Aggregation functions. */
  functions: Array<{
    /** Function name. */
    name: string;
    
    /** Input field. */
    inputField: string;
    
    /** Output field. */
    outputField: string;
    
    /** Aggregation type. */
    type: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'median' | 'percentile' | 'custom';
    
    /** Custom parameters. */
    parameters?: Record<string, unknown>;
  }>;
  
  /** Grouping keys. */
  groupBy: string[];
  
  /** Window configuration. */
  window: StreamWindow;
  
  /** Trigger condition. */
  trigger: {
    /** Trigger type. */
    type: 'time' | 'count' | 'custom';
    
    /** Trigger value. */
    value: number;
    
    /** Custom condition. */
    condition?: string;
  };
}

// ========================================
// ANALYSIS TYPES
// ========================================

/**
 * Analysis task configuration.
 */
interface AnalysisTask {
  /** Task identifier. */
  id: string;
  
  /** Task name. */
  name: string;
  
  /** Analysis type. */
  type: 'statistical' | 'ml' | 'rule-based' | 'custom';
  
  /** Input data requirements. */
  inputs: {
    /** Required fields. */
    fields: string[];
    
    /** Data types. */
    types: Record<string, string>;
    
    /** Minimum data points. */
    minDataPoints: number;
    
    /** Time window. */
    timeWindow?: number;
  };
  
  /** Analysis configuration. */
  config: {
    /** Algorithm parameters. */
    algorithm: string;
    
    /** Model parameters. */
    parameters: Record<string, unknown>;
    
    /** Confidence threshold. */
    confidenceThreshold: number;
    
    /** Output format. */
    outputFormat: 'json' | 'csv' | 'binary';
  };
  
  /** Performance requirements. */
  performance: {
    /** Maximum execution time. */
    maxExecutionTime: number;
    
    /** Memory requirements. */
    maxMemory: number;
    
    /** CPU requirements. */
    maxCpu: number;
  };
  
  /** Output configuration. */
  output: {
    /** Output fields. */
    fields: string[];
    
    /** Storage location. */
    storage?: string;
    
    /** Notification callback. */
    callback?: string;
  };
}

/**
 * Analysis result.
 */
interface AnalysisResult {
  /** Task identifier. */
  taskId: string;
  
  /** Result identifier. */
  resultId: string;
  
  /** Analysis timestamp. */
  timestamp: number;
  
  /** Result data. */
  data: Record<string, unknown>;
  
  /** Confidence score. */
  confidence: number;
  
  /** Analysis metadata. */
  metadata: {
    /** Execution time. */
    executionTime: number;
    
    /** Data points analyzed. */
    dataPoints: number;
    
    /** Algorithm version. */
    algorithmVersion: string;
    
    /** Model accuracy. */
    modelAccuracy?: number;
  };
  
  /** Warnings. */
  warnings: string[];
  
  /** Error information. */
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

// ========================================
// PIPELINE EXECUTION TYPES
// ========================================

/**
 * Pipeline execution context.
 */
interface PipelineExecutionContext {
  /** Execution identifier. */
  executionId: string;
  
  /** Pipeline identifier. */
  pipelineId: PipelineId;
  
  /** Execution start time. */
  startTime: number;
  
  /** Current stage. */
  currentStage: string;
  
  /** Execution parameters. */
  parameters: Record<string, unknown>;
  
  /** Shared state. */
  state: Record<string, unknown>;
  
  /** Metrics. */
  metrics: {
    /** Items processed. */
    itemsProcessed: number;
    
    /** Items failed. */
    itemsFailed: number;
    
    /** Processing rate. */
    processingRate: number;
    
    /** Memory usage. */
    memoryUsage: number;
    
    /** CPU usage. */
    cpuUsage: number;
  };
}

/**
 * Pipeline execution result.
 */
interface PipelineExecutionResult {
  /** Execution identifier. */
  executionId: string;
  
  /** Pipeline identifier. */
  pipelineId: PipelineId;
  
  /** Execution status. */
  status: PipelineStatus;
  
  /** Start time. */
  startTime: number;
  
  /** End time. */
  endTime?: number;
  
  /** Duration. */
  duration?: number;
  
  /** Stage results. */
  stages: Array<{
    stageId: string;
    status: 'success' | 'error' | 'skipped';
    duration: number;
    itemsProcessed: number;
    error?: string;
  }>;
  
  /** Output data. */
  output: Record<string, unknown>;
  
  /** Execution metrics. */
  metrics: {
    /** Total items processed. */
    totalItems: number;
    
    /** Success rate. */
    successRate: number;
    
    /** Average processing time. */
    avgProcessingTime: number;
    
    /** Throughput. */
    throughput: number;
    
    /** Resource usage. */
    resourceUsage: {
      memory: number;
      cpu: number;
      disk: number;
    };
  };
  
  /** Errors. */
  errors: Array<{
    stageId: string;
    error: string;
    timestamp: number;
    itemId?: string;
  }>;
}

// ========================================
// MONITORING TYPES
// ========================================

/**
 * Pipeline monitoring configuration.
 */
interface PipelineMonitoringConfig {
  /** Pipeline identifier. */
  pipelineId: PipelineId;
  
  /** Monitoring enabled. */
  enabled: boolean;
  
  /** Metrics collection. */
  metrics: {
    /** Collection interval. */
    interval: number;
    
    /** Metrics to collect. */
    collect: string[];
    
    /** Retention period. */
    retention: number;
  };
  
  /** Alerting configuration. */
  alerts: Array<{
    /** Alert name. */
    name: string;
    
    /** Alert condition. */
    condition: string;
    
    /** Alert threshold. */
    threshold: number;
    
    /** Alert actions. */
    actions: string[];
  }>;
  
  /** Health checks. */
  healthChecks: {
    /** Check interval. */
    interval: number;
    
    /** Timeout. */
    timeout: number;
    
    /** Health check functions. */
    checks: string[];
  };
}

/**
 * Pipeline performance metrics.
 */
interface PipelineMetrics {
  /** Pipeline identifier. */
  pipelineId: PipelineId;
  
  /** Measurement timestamp. */
  timestamp: number;
  
  /** Measurement period. */
  period: number;
  
  /** Throughput metrics. */
  throughput: {
    /** Items per second. */
    itemsPerSecond: number;
    
    /** Bytes per second. */
    bytesPerSecond: number;
    
    /** Peak throughput. */
    peakThroughput: number;
  };
  
  /** Latency metrics. */
  latency: {
    /** Average latency. */
    average: number;
    
    /** P95 latency. */
    p95: number;
    
    /** P99 latency. */
    p99: number;
    
    /** Maximum latency. */
    max: number;
  };
  
  /** Resource usage. */
  resources: {
    /** Memory usage percentage. */
    memoryUsage: number;
    
    /** CPU usage percentage. */
    cpuUsage: number;
    
    /** Disk usage percentage. */
    diskUsage: number;
    
    /** Network usage. */
    networkUsage: {
      bytesIn: number;
      bytesOut: number;
    };
  };
  
  /** Error metrics. */
  errors: {
    /** Total errors. */
    total: number;
    
    /** Error rate. */
    rate: number;
    
    /** Error types. */
    types: Record<string, number>;
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  PipelineId,
  PipelineStageType,
  PipelineStatus,
  ProcessingMode,
  PipelineStage,
  PipelineConfig,
  StreamDataItem,
  StreamWindow,
  StreamAggregation,
  AnalysisTask,
  AnalysisResult,
  PipelineExecutionContext,
  PipelineExecutionResult,
  PipelineMonitoringConfig,
  PipelineMetrics
}; 