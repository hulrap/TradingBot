import { ChainAbstraction } from './chain-abstraction';
import { RPCManager } from './rpc-manager';
import { ConnectionPool } from './connection-pool';
import winston from 'winston';

// RPC Infrastructure Exports
export { 
  RPCManager,
  type RPCProvider,
  type RPCEndpoint,
  type RPCRequest,
  type RPCResponse,
  type RPCMetrics,
  type ProviderMetrics,
  type RPCManagerConfig
} from './rpc-manager';

export {
  ConnectionPool,
  type ConnectionPoolConfig,
  type PoolConnection,
  type LoadBalancingStrategy,
  type PoolMetrics,
  type QueuedRequest,
  type CircuitBreakerState,
  type ProviderStats
} from './connection-pool';

export {
  ChainAbstraction,
  type ChainConfig,
  type TokenInfo,
  type WalletBalance,
  type TransactionRequest,
  type TransactionReceipt,
  type TransactionLog,
  type BlockInfo,
  type GasSettings,
  type GasEstimate,
  type SwapQuote,
  type ChainState,
  type ChainAbstractionConfig,
  type SupportedChain
} from './chain-abstraction';

export {
  DEXAggregator,
  type DEXConfig,
  type SwapRoute,
  type RouteStep,
  type SwapQuoteRequest,
  type SwapQuoteResponse,
  type DEXStats,
  type AggregatorStats,
  type PerformanceMetrics,
  type DexHealthStatus,
  type RouteOptimizationMetrics,
  type RealTimeAnalytics
} from './dex-aggregator';

export {
  MempoolMonitor,
  type MempoolConfig,
  type PendingTransaction,
  type MEVSignature,
  type DEXInteraction,
  type TokenTransfer,
  type LiquidationRisk,
  type SolanaTransaction,
  type LatencyDistribution,
  type MempoolStats
} from './mempool-monitor';

// Note: PriceOracle functionality is now handled by ZeroLatencyOracle and other advanced components

// Enhanced Chain Client Exports
export {
  EnhancedChainClient,
  createEnhancedChainClient,
  type EnhancedChainClientConfig,
  type TradeExecutionResult,
  type OpportunityMetrics
} from './enhanced-chain-client';

// Zero-Latency Infrastructure Exports
export {
  ZeroLatencyOracle,
  type ZeroLatencyConfig as ZeroLatencyOracleConfig,
  type TokenPrice as ZLTokenPrice,
  type PriceAggregate,
  type PriceTrend,
  type RateLimitConfig,
  type AlertConfig,
  type ChainlinkPrice,
  type AlertEvent
} from './zero-latency-oracle';

export {
  RealTimeGasTracker,
  type GasTrackerConfig,
  type GasPrice,
  type GasPrediction,
  type GasTrackerMetrics,
  type GasSystemHealth,
  type GasAnalytics
} from './realtime-gas-tracker';

export {
  SmartRouteEngine,
  type ProtocolConfig,
  type LiquidityPool,
  type PrecomputedRoute,
  type RouteStep as SRERouteStep,
  type OpportunityMatrix,
  type PerformanceMetrics as SREPerformanceMetrics,
  type SystemHealth as SRESystemHealth,
  type RouteAnalytics,
  type AlertConfig as SREAlertConfig,
  type CircuitBreakerState as SRECircuitBreakerState,
  type TestResult
} from './smart-route-engine';

export {
  createZeroLatencyConfig,
  CostTracker,
  DynamicBridgeMonitor,
  DynamicCostManager,
  type ZeroLatencyConfig,
  type RateLimitConfig as ZLRateLimitConfig,
  type AlertConfig as ZLAlertConfig
} from './zero-latency-config';

// Route Engine Exports (Alternative Implementation)
export {
  SmartRouteEngine as AlternativeRouteEngine,
  type PoolLiquidity,
  type MarketPrice,
  type GasMetrics as REGasMetrics,
  type RouteAnalytics as RERouteAnalytics,
  type ProtocolConfig as REProtocolConfig,
  type PrecomputedRoute as REPrecomputedRoute,
  type RouteStep as RERouteStep
} from './route-engine';

// Factory function for creating chain clients
export function createChainClient(chain: string, privateKey: string, rpcUrl: string) {
  // Create logger
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()]
  });

  // Validate private key format
  if (!privateKey || privateKey.length < 64) {
    throw new Error('Invalid private key: must be a valid hex string');
  }

  // Ensure private key has 0x prefix
  const formattedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  
  // Log private key usage (without exposing the actual key)
  logger.info('Chain client created with wallet integration', {
    chain,
    hasPrivateKey: !!formattedPrivateKey,
    keyLength: formattedPrivateKey.length,
    rpcUrl: rpcUrl.replace(/\/\/.*@/, '//***@') // Hide credentials in URL
  });

  // Create RPC manager
  const rpcManager = new RPCManager(logger, {
    providers: [{
      id: 'default',
      name: 'Default Provider',
      chain: chain,
      tier: 'standard',
      url: rpcUrl,
      rateLimit: 10,
      maxConnections: 5,
      cost: 0.1,
      latency: 100,
      successRate: 95,
      isActive: true,
      priority: 1
    }],
    maxRetries: 3,
    retryDelay: 1000,
    healthCheckInterval: 60000,
    blacklistDuration: 300000,
    requestTimeout: 30000,
    dailyBudget: 100,
    costTrackingWindow: 24
  });

  // Create connection pool
  const connectionPool = new ConnectionPool(rpcManager, {
    maxConnections: 10,
    minConnections: 2,
    maxConnectionsPerProvider: 5,
    maxConnectionAge: 3600000,
    idleTimeout: 300000,
    connectionTimeout: 30000,
    healthCheckInterval: 60000,
    healthCheckTimeout: 5000,
    maxConsecutiveErrors: 3,
    healthScoreThreshold: 70,
    unhealthyConnectionQuarantine: 60000,
    scaleUpThreshold: 80,
    scaleDownThreshold: 20,
    scaleUpDelay: 10000,
    scaleDownDelay: 30000,
    maxScaleOperationsPerMinute: 10,
    loadBalancer: {
      strategy: 'round-robin'
    },
    preWarmConnections: true,
    enableConnectionPooling: true,
    enableRequestQueuing: true,
    maxQueueSize: 100,
    queueTimeout: 30000,
    circuitBreakerConfig: {
      enabled: true,
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 60000
    },
    enableMetrics: true,
    enableTracing: false,
    enableCaching: true,
    compressionEnabled: true,
    keepAliveEnabled: true,
    enableRateLimiting: true,
    maxRequestsPerSecond: 100,
    enableTLSVerification: true,
    allowedCertificates: []
  }, logger);

  // Create ChainAbstraction config with private key integration
  const config = {
    defaultChain: chain as any,
    enabledChains: [chain as any],
    rpcManager,
    gasMultiplier: 1.2,
    maxGasPrice: '100',
    defaultSlippage: 0.5,
    // Store private key for transaction signing capabilities
    signingKey: formattedPrivateKey
  };

  const chainAbstraction = new ChainAbstraction(rpcManager, connectionPool, logger, config);
  
  // Log successful client creation with wallet capabilities
  logger.info('Chain client successfully created with signing capabilities', {
    chain,
    walletEnabled: true,
    signerConfigured: true
  });

  return chainAbstraction;
}