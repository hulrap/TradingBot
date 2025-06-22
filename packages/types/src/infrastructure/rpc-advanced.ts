/**
 * @file Advanced RPC Infrastructure Types
 * 
 * Enterprise-grade RPC management, multi-tier fallback systems,
 * latency-optimized provider selection, and advanced connection pooling.
 * 
 * Features:
 * - Multi-tier RPC fallback systems
 * - Latency-optimized provider selection
 * - Enterprise-grade connection pooling
 * - Advanced load balancing strategies
 * - Real-time health monitoring
 * - Geographic distribution optimization
 * - Cost optimization algorithms
 * - Performance analytics and reporting
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';

// ========================================
// RPC PROVIDER TYPES
// ========================================

/**
 * Comprehensive RPC provider types covering all major providers.
 */
type RPCProviderType = 
  // ========================================
  // TIER 1 PROVIDERS (Premium)
  // ========================================
  | 'alchemy'             // Alchemy API
  | 'infura'              // Infura
  | 'quicknode'           // QuickNode
  | 'moralis'             // Moralis API
  | 'chainstack'          // Chainstack
  | 'getblock'            // GetBlock
  | 'nodereal'            // NodeReal
  | 'blast-api'           // Blast API
  | 'ankr'                // Ankr API
  | 'pocket'              // Pocket Network
  | 'figment'             // Figment DataHub
  | 'blockdaemon'         // BlockDaemon
  | 'nownodes'            // NOWNodes
  | 'allnodes'            // AllNodes
  
  // ========================================
  // TIER 2 PROVIDERS (Standard)
  // ========================================
  | 'public-rpc'          // Public RPC endpoints
  | 'chainlist'           // ChainList RPC
  | 'rpc-fast'            // RPC.fast
  | 'llamarpc'            // LlamaRPC
  | 'etherscan'           // Etherscan API
  | 'bscscan'             // BSCScan API
  | 'polygonscan'         // PolygonScan API
  | 'arbiscan'            // Arbiscan API
  | 'optimism-scan'       // Optimism Explorer
  | 'snowtrace'           // Snowtrace (Avalanche)
  | 'ftmscan'             // FTMScan (Fantom)
  
  // ========================================
  // TIER 3 PROVIDERS (Community/Free)
  // ========================================
  | 'cloudflare'          // Cloudflare Ethereum Gateway
  | 'mycrypto'            // MyCrypto API
  | 'ethereum-nodes'      // Community Ethereum nodes
  | 'flashbots'           // Flashbots Protect RPC
  | 'eden-network'        // Eden Network RPC
  | 'securerpc'           // SecureRPC
  | 'bloxroute'           // bloXroute RPC
  
  // ========================================
  // SPECIALIZED PROVIDERS
  // ========================================
  | 'custom'              // Custom RPC endpoint
  | 'websocket'           // WebSocket RPC
  | 'ipc'                 // Inter-process communication
  | 'local-node'          // Local blockchain node
  | 'proxy'               // RPC proxy/relay
  | 'load-balancer';      // Load balancer endpoint

/**
 * RPC provider tier classification.
 */
type RPCProviderTier = 
  | 'premium'             // Tier 1 - Premium providers
  | 'standard'            // Tier 2 - Standard providers
  | 'community'           // Tier 3 - Community providers
  | 'custom'              // Custom configuration
  | 'fallback';           // Emergency fallback

/**
 * RPC request priority levels.
 */
type RPCRequestPriority = 
  | 'critical'            // Critical system operations
  | 'high'                // High priority trading
  | 'normal'              // Normal operations
  | 'low'                 // Background tasks
  | 'batch';              // Batch processing

/**
 * Load balancing strategies for RPC requests.
 */
type LoadBalancingStrategy = 
  | 'round-robin'         // Round-robin distribution
  | 'weighted-round-robin' // Weighted round-robin
  | 'least-connections'   // Least active connections
  | 'least-response-time' // Fastest response time
  | 'random'              // Random selection
  | 'geographic'          // Geographic proximity
  | 'cost-optimized'      // Cost optimization
  | 'performance-based'   // Performance-based routing
  | 'hybrid'              // Hybrid strategy
  | 'custom';             // Custom algorithm

// ========================================
// PROVIDER CONFIGURATION TYPES
// ========================================

/**
 * Comprehensive RPC provider configuration.
 */
interface RPCProviderConfig {
  /** Provider identifier. */
  id: string;
  
  /** Provider type. */
  type: RPCProviderType;
  
  /** Provider tier. */
  tier: RPCProviderTier;
  
  /** Provider name. */
  name: string;
  
  /** Supported chains. */
  chains: SupportedChain[];
  
  /** Endpoint configuration. */
  endpoints: {
    /** HTTP endpoints. */
    http: Array<{
      url: string;
      region: string;
      priority: number;
      rateLimit: number;
    }>;
    
    /** WebSocket endpoints. */
    websocket?: Array<{
      url: string;
      region: string;
      priority: number;
      protocols: string[];
    }>;
    
    /** Custom endpoints. */
    custom?: Record<string, string>;
  };
  
  /** Authentication configuration. */
  auth: {
    /** Authentication type. */
    type: 'none' | 'api-key' | 'basic' | 'bearer' | 'custom';
    
    /** API key. */
    apiKey?: string;
    
    /** Secret key. */
    secretKey?: string;
    
    /** Custom headers. */
    headers?: Record<string, string>;
    
    /** Authentication rotation. */
    rotation?: {
      enabled: boolean;
      intervalHours: number;
      keys: string[];
    };
  };
  
  /** Rate limiting configuration. */
  rateLimit: {
    /** Requests per second. */
    requestsPerSecond: number;
    
    /** Requests per minute. */
    requestsPerMinute: number;
    
    /** Requests per hour. */
    requestsPerHour: number;
    
    /** Requests per day. */
    requestsPerDay: number;
    
    /** Burst capacity. */
    burstCapacity: number;
    
    /** Compute units per second. */
    computeUnitsPerSecond?: number;
  };
  
  /** Cost configuration. */
  cost: {
    /** Cost per request. */
    costPerRequest: number;
    
    /** Cost per compute unit. */
    costPerComputeUnit?: number;
    
    /** Monthly quota. */
    monthlyQuota?: number;
    
    /** Billing tier. */
    billingTier: 'free' | 'paid' | 'enterprise';
  };
  
  /** Performance characteristics. */
  performance: {
    /** Expected latency (ms). */
    expectedLatency: number;
    
    /** Reliability score (0-100). */
    reliabilityScore: number;
    
    /** Uptime percentage. */
    uptimePercent: number;
    
    /** Geographic regions. */
    regions: string[];
    
    /** Performance tier. */
    tier: 'enterprise' | 'production' | 'development';
  };
  
  /** Feature support. */
  features: {
    /** Archive node access. */
    archiveNode: boolean;
    
    /** Trace API support. */
    traceApi: boolean;
    
    /** Debug API support. */
    debugApi: boolean;
    
    /** WebSocket support. */
    websockets: boolean;
    
    /** Batch requests. */
    batchRequests: boolean;
    
    /** EIP-1559 support. */
    eip1559: boolean;
    
    /** MEV protection. */
    mevProtection: boolean;
    
    /** Private mempool. */
    privateMempool: boolean;
  };
  
  /** Health check configuration. */
  healthCheck: {
    /** Health check enabled. */
    enabled: boolean;
    
    /** Check interval (ms). */
    interval: number;
    
    /** Timeout (ms). */
    timeout: number;
    
    /** Failure threshold. */
    failureThreshold: number;
    
    /** Recovery threshold. */
    recoveryThreshold: number;
    
    /** Health check method. */
    method: 'ping' | 'eth_blockNumber' | 'custom';
  };
}

/**
 * Multi-tier fallback configuration.
 */
interface RPCFallbackConfig {
  /** Fallback strategy. */
  strategy: 'immediate' | 'delayed' | 'progressive' | 'adaptive';
  
  /** Tier configurations. */
  tiers: Array<{
    /** Tier level. */
    tier: RPCProviderTier;
    
    /** Providers in this tier. */
    providers: string[];
    
    /** Activation delay (ms). */
    activationDelay: number;
    
    /** Maximum concurrent requests. */
    maxConcurrentRequests: number;
    
    /** Circuit breaker configuration. */
    circuitBreaker: {
      enabled: boolean;
      failureThreshold: number;
      resetTimeout: number;
    };
  }>;
  
  /** Global fallback settings. */
  global: {
    /** Maximum fallback attempts. */
    maxFallbackAttempts: number;
    
    /** Total timeout (ms). */
    totalTimeout: number;
    
    /** Emergency providers. */
    emergencyProviders: string[];
    
    /** Fallback notification. */
    notification: {
      enabled: boolean;
      channels: string[];
      severity: 'info' | 'warning' | 'critical';
    };
  };
}

/**
 * Advanced connection pool configuration.
 */
interface RPCConnectionPoolConfig {
  /** Pool identifier. */
  id: string;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Pool size configuration. */
  size: {
    /** Minimum connections. */
    min: number;
    
    /** Maximum connections. */
    max: number;
    
    /** Target connections. */
    target: number;
    
    /** Scaling factor. */
    scalingFactor: number;
  };
  
  /** Connection lifecycle. */
  lifecycle: {
    /** Connection timeout (ms). */
    connectionTimeout: number;
    
    /** Idle timeout (ms). */
    idleTimeout: number;
    
    /** Maximum lifetime (ms). */
    maxLifetime: number;
    
    /** Keep-alive interval (ms). */
    keepAliveInterval: number;
  };
  
  /** Load balancing. */
  loadBalancing: {
    /** Strategy. */
    strategy: LoadBalancingStrategy;
    
    /** Provider weights. */
    weights: Record<string, number>;
    
    /** Sticky sessions. */
    stickySession: boolean;
    
    /** Health-based routing. */
    healthBasedRouting: boolean;
  };
  
  /** Performance optimization. */
  optimization: {
    /** Connection prewarming. */
    prewarming: boolean;
    
    /** Request batching. */
    batching: {
      enabled: boolean;
      maxBatchSize: number;
      batchTimeout: number;
    };
    
    /** Response caching. */
    caching: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    };
    
    /** Request coalescing. */
    coalescing: boolean;
  };
  
  /** Monitoring and metrics. */
  monitoring: {
    /** Metrics collection. */
    metricsEnabled: boolean;
    
    /** Health checks. */
    healthChecks: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };
    
    /** Performance tracking. */
    performanceTracking: {
      enabled: boolean;
      sampleRate: number;
      historySize: number;
    };
  };
}

// ========================================
// PERFORMANCE AND MONITORING TYPES
// ========================================

/**
 * RPC provider performance metrics.
 */
interface RPCProviderMetrics {
  /** Provider identifier. */
  providerId: string;
  
  /** Measurement period. */
  period: {
    start: number;
    end: number;
    duration: number;
  };
  
  /** Request statistics. */
  requests: {
    /** Total requests. */
    total: number;
    
    /** Successful requests. */
    successful: number;
    
    /** Failed requests. */
    failed: number;
    
    /** Timeout requests. */
    timeouts: number;
    
    /** Rate limited requests. */
    rateLimited: number;
    
    /** Requests per second. */
    requestsPerSecond: number;
  };
  
  /** Latency metrics. */
  latency: {
    /** Average latency (ms). */
    average: number;
    
    /** Median latency (ms). */
    median: number;
    
    /** P95 latency (ms). */
    p95: number;
    
    /** P99 latency (ms). */
    p99: number;
    
    /** Maximum latency (ms). */
    max: number;
    
    /** Minimum latency (ms). */
    min: number;
  };
  
  /** Reliability metrics. */
  reliability: {
    /** Uptime percentage. */
    uptime: number;
    
    /** Success rate. */
    successRate: number;
    
    /** Error rate. */
    errorRate: number;
    
    /** Connection stability. */
    connectionStability: number;
  };
  
  /** Cost metrics. */
  cost: {
    /** Total cost. */
    totalCost: number;
    
    /** Cost per request. */
    costPerRequest: number;
    
    /** Cost per successful request. */
    costPerSuccessfulRequest: number;
    
    /** Monthly projection. */
    monthlyProjection: number;
  };
  
  /** Geographic performance. */
  geographic: {
    /** Performance by region. */
    byRegion: Record<string, {
      latency: number;
      reliability: number;
      requestCount: number;
    }>;
    
    /** Optimal regions. */
    optimalRegions: string[];
  };
}

/**
 * Real-time RPC health status.
 */
interface RPCHealthStatus {
  /** Provider identifier. */
  providerId: string;
  
  /** Overall health status. */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  
  /** Health score (0-100). */
  healthScore: number;
  
  /** Last health check. */
  lastCheck: number;
  
  /** Health indicators. */
  indicators: {
    /** Connectivity. */
    connectivity: {
      status: 'connected' | 'disconnected' | 'unstable';
      lastConnected: number;
      connectionTime: number;
    };
    
    /** Response time. */
    responseTime: {
      current: number;
      average: number;
      threshold: number;
      status: 'optimal' | 'acceptable' | 'slow' | 'critical';
    };
    
    /** Error rate. */
    errorRate: {
      current: number;
      threshold: number;
      status: 'low' | 'moderate' | 'high' | 'critical';
    };
    
    /** Rate limiting. */
    rateLimiting: {
      currentUsage: number;
      limit: number;
      resetTime: number;
      status: 'available' | 'throttled' | 'exhausted';
    };
  };
  
  /** Recent issues. */
  issues: Array<{
    type: 'connectivity' | 'latency' | 'errors' | 'rate-limit';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: number;
    resolved: boolean;
  }>;
  
  /** Health trends. */
  trends: {
    /** Health score trend. */
    healthScore: number[];
    
    /** Latency trend. */
    latency: number[];
    
    /** Error rate trend. */
    errorRate: number[];
    
    /** Trend direction. */
    direction: 'improving' | 'stable' | 'degrading';
  };
}

/**
 * RPC optimization recommendations.
 */
interface RPCOptimizationRecommendations {
  /** Timestamp. */
  timestamp: number;
  
  /** Analysis period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Provider recommendations. */
  providers: Array<{
    /** Provider ID. */
    providerId: string;
    
    /** Recommendation type. */
    type: 'optimize' | 'replace' | 'remove' | 'add';
    
    /** Priority. */
    priority: 'low' | 'medium' | 'high' | 'critical';
    
    /** Recommendation. */
    recommendation: string;
    
    /** Expected improvement. */
    expectedImprovement: {
      latency?: number;
      reliability?: number;
      cost?: number;
      performance?: number;
    };
    
    /** Implementation effort. */
    effort: 'low' | 'medium' | 'high';
  }>;
  
  /** Configuration recommendations. */
  configuration: Array<{
    /** Setting path. */
    setting: string;
    
    /** Current value. */
    currentValue: unknown;
    
    /** Recommended value. */
    recommendedValue: unknown;
    
    /** Justification. */
    justification: string;
    
    /** Impact assessment. */
    impact: 'low' | 'medium' | 'high';
  }>;
  
  /** Architecture recommendations. */
  architecture: Array<{
    /** Component. */
    component: 'load-balancer' | 'connection-pool' | 'caching' | 'fallback';
    
    /** Recommendation. */
    recommendation: string;
    
    /** Benefits. */
    benefits: string[];
    
    /** Implementation complexity. */
    complexity: 'simple' | 'moderate' | 'complex';
  }>;
}

// ========================================
// EXPORTS
// ========================================

export type {
  RPCProviderType,
  RPCProviderTier,
  RPCRequestPriority,
  LoadBalancingStrategy,
  RPCProviderConfig,
  RPCFallbackConfig,
  RPCConnectionPoolConfig,
  RPCProviderMetrics,
  RPCHealthStatus,
  RPCOptimizationRecommendations
}; 