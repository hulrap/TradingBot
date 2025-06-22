/**
 * @file Connection Management Types
 * 
 * Connection handling, WebSocket management, RPC pooling, and 
 * provider-specific connection types for the connections package.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';

// ========================================
// CONNECTION STATE TYPES
// ========================================

/**
 * Connection state enumeration.
 */
type ConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'suspended';

/**
 * Connection type enumeration.
 */
type ConnectionType = 'http' | 'websocket' | 'ipc' | 'custom';

/**
 * Connection health status.
 */
type ConnectionHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Load balancing strategies.
 */
type LoadBalancingStrategy = 
  | 'round-robin'
  | 'least-connections'
  | 'weighted-round-robin'
  | 'random'
  | 'consistent-hash'
  | 'least-response-time';

// ========================================
// CONNECTION INTERFACE TYPES
// ========================================

/**
 * Connection statistics.
 */
interface ConnectionStats {
  /** Total requests made. */
  totalRequests: number;
  
  /** Successful requests. */
  successfulRequests: number;
  
  /** Failed requests. */
  failedRequests: number;
  
  /** Average response time in ms. */
  averageResponseTime: number;
  
  /** Current active connections. */
  activeConnections: number;
  
  /** Last successful request timestamp. */
  lastSuccessfulRequest: number;
  
  /** Connection uptime. */
  uptime: number;
  
  /** Bytes sent/received. */
  bytesTransferred: {
    sent: number;
    received: number;
  };
}

/**
 * Connection configuration.
 */
interface ConnectionConfig {
  /** Connection URL. */
  url: string;
  
  /** Connection type. */
  type: ConnectionType;
  
  /** Connection timeout. */
  timeout: number;
  
  /** Reconnection settings. */
  reconnect: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  
  /** Keep-alive settings. */
  keepAlive: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  
  /** Authentication. */
  auth?: {
    type: 'basic' | 'bearer' | 'api-key' | 'custom';
    credentials: Record<string, string>;
  };
  
  /** Custom headers. */
  headers?: Record<string, string>;
  
  /** Rate limiting. */
  rateLimit?: {
    requestsPerSecond: number;
    burstSize: number;
  };
}

/**
 * Connection event types.
 */
type ConnectionEvent = 
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'reconnect'
  | 'timeout'
  | 'message'
  | 'health-check';

/**
 * Connection event data.
 */
interface ConnectionEventData {
  /** Event type. */
  type: ConnectionEvent;
  
  /** Connection ID. */
  connectionId: string;
  
  /** Event timestamp. */
  timestamp: number;
  
  /** Event data. */
  data?: Record<string, unknown>;
  
  /** Error information. */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ========================================
// WEBSOCKET SPECIFIC TYPES
// ========================================

/**
 * WebSocket subscription.
 */
interface WebSocketSubscription {
  /** Subscription ID. */
  id: string;
  
  /** Subscription channel/topic. */
  channel: string;
  
  /** Subscription parameters. */
  params: Record<string, unknown>;
  
  /** Callback function. */
  callback: (data: unknown) => void;
  
  /** Error callback. */
  onError?: (error: Error) => void;
  
  /** Subscription status. */
  status: 'active' | 'paused' | 'cancelled';
  
  /** Creation timestamp. */
  createdAt: number;
}

/**
 * WebSocket pool configuration.
 */
interface WebSocketPoolConfig {
  /** Maximum connections. */
  maxConnections: number;
  
  /** Connection distribution strategy. */
  distributionStrategy: 'round-robin' | 'least-subscriptions' | 'hash-based';
  
  /** Health check interval. */
  healthCheckInterval: number;
  
  /** Connection lifecycle. */
  lifecycle: {
    idleTimeout: number;
    maxAge: number;
    gracefulShutdownTimeout: number;
  };
}

// ========================================
// RPC SPECIFIC TYPES
// ========================================

/**
 * RPC request structure.
 */
interface RPCRequest {
  /** Request ID. */
  id: string | number;
  
  /** RPC method. */
  method: string;
  
  /** Method parameters. */
  params: unknown[];
  
  /** JSON-RPC version. */
  jsonrpc: '2.0';
}

/**
 * RPC response structure.
 */
interface RPCResponse<T = unknown> {
  /** Request ID. */
  id: string | number;
  
  /** Response result. */
  result?: T;
  
  /** Response error. */
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  
  /** JSON-RPC version. */
  jsonrpc: '2.0';
}

/**
 * RPC batch request.
 */
interface RPCBatchRequest {
  /** Batch ID. */
  batchId: string;
  
  /** Individual requests. */
  requests: RPCRequest[];
  
  /** Batch timeout. */
  timeout: number;
  
  /** Batch priority. */
  priority: 'low' | 'normal' | 'high';
}

/**
 * RPC client configuration.
 */
interface RPCClientConfig {
  /** Batch settings. */
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    batchTimeout: number;
  };
  
  /** Caching settings. */
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  
  /** Retry settings. */
  retry: {
    maxAttempts: number;
    retryableErrors: number[];
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
  };
}

// ========================================
// CONNECTION POOL TYPES
// ========================================

/**
 * Connection pool statistics.
 */
interface ConnectionPoolStats {
  /** Total connections. */
  totalConnections: number;
  
  /** Active connections. */
  activeConnections: number;
  
  /** Idle connections. */
  idleConnections: number;
  
  /** Failed connections. */
  failedConnections: number;
  
  /** Pool utilization percentage. */
  utilization: number;
  
  /** Average connection age. */
  averageConnectionAge: number;
  
  /** Pool performance metrics. */
  performance: {
    averageAcquisitionTime: number;
    averageResponseTime: number;
    throughput: number;
  };
}

/**
 * Connection pool configuration.
 */
interface ConnectionPoolConfig {
  /** Pool size limits. */
  size: {
    min: number;
    max: number;
    target: number;
  };
  
  /** Connection timeouts. */
  timeouts: {
    acquisition: number;
    idle: number;
    lifetime: number;
  };
  
  /** Health monitoring. */
  health: {
    checkInterval: number;
    maxFailures: number;
    recoveryDelay: number;
  };
  
  /** Load balancing. */
  loadBalancing: {
    strategy: LoadBalancingStrategy;
    weights?: Record<string, number>;
  };
}

// ========================================
// PROVIDER SPECIFIC TYPES
// ========================================

/**
 * Chain provider configuration.
 */
interface ChainProviderConfig {
  /** Target chain. */
  chain: SupportedChain;
  
  /** Provider type. */
  type: 'alchemy' | 'infura' | 'quicknode' | 'moralis' | 'custom';
  
  /** Provider-specific settings. */
  settings: {
    apiKey?: string;
    projectId?: string;
    endpoints: {
      http: string[];
      websocket?: string[];
    };
    rateLimit: {
      requestsPerSecond: number;
      requestsPerDay?: number;
    };
  };
  
  /** Provider features. */
  features: {
    archive: boolean;
    trace: boolean;
    debug: boolean;
    mempool: boolean;
    webhooks: boolean;
  };
}

/**
 * Multi-chain provider configuration.
 */
interface MultiChainProviderConfig {
  /** Provider configurations by chain. */
  chains: Record<SupportedChain, ChainProviderConfig>;
  
  /** Global settings. */
  global: {
    fallbackEnabled: boolean;
    healthCheckInterval: number;
    failoverThreshold: number;
  };
  
  /** Cross-chain coordination. */
  coordination: {
    enabled: boolean;
    syncTolerance: number;
    blockHeightThreshold: number;
  };
}

// ========================================
// HEALTH MONITORING TYPES
// ========================================

/**
 * Connection health check result.
 */
interface ConnectionHealthCheck {
  /** Connection ID. */
  connectionId: string;
  
  /** Health status. */
  status: ConnectionHealth;
  
  /** Check timestamp. */
  timestamp: number;
  
  /** Latency measurement. */
  latency: number;
  
  /** Error information. */
  error?: string;
  
  /** Additional metrics. */
  metrics: {
    successRate: number;
    averageLatency: number;
    lastSuccessfulRequest: number;
  };
}

/**
 * Health monitor configuration.
 */
interface HealthMonitorConfig {
  /** Check interval. */
  interval: number;
  
  /** Check timeout. */
  timeout: number;
  
  /** Health thresholds. */
  thresholds: {
    latency: number;
    successRate: number;
    errorRate: number;
  };
  
  /** Notification settings. */
  notifications: {
    enabled: boolean;
    channels: string[];
    escalation: boolean;
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  ConnectionState,
  ConnectionType,
  ConnectionHealth,
  LoadBalancingStrategy,
  ConnectionEvent,
  ConnectionStats,
  ConnectionConfig,
  ConnectionEventData,
  WebSocketSubscription,
  WebSocketPoolConfig,
  RPCRequest,
  RPCResponse,
  RPCBatchRequest,
  RPCClientConfig,
  ConnectionPoolStats,
  ConnectionPoolConfig,
  ChainProviderConfig,
  MultiChainProviderConfig,
  ConnectionHealthCheck,
  HealthMonitorConfig
}; 