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
  type RPCMetrics
} from './rpc-manager';

export {
  ConnectionPool,
  type ConnectionPoolConfig,
  type PoolConnection,
  type LoadBalancer,
  type PoolMetrics
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
  type AggregatorStats
} from './dex-aggregator';

export {
  MempoolMonitor,
  type MempoolConfig,
  type PendingTransaction,
  type SolanaTransaction,
  type MempoolStats
} from './mempool-monitor';

export {
  PriceOracle,
  type PriceSource,
  type TokenPrice,
  type PriceOracleConfig,
  type PriceComparisonResult
} from './price-oracle';

// Factory function for creating chain clients
export function createChainClient(chain: string, privateKey: string, rpcUrl: string) {
  // Create logger
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()]
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
    maxConnectionAge: 3600000,
    idleTimeout: 300000,
    healthCheckInterval: 60000,
    maxConsecutiveErrors: 3,
    connectionTimeout: 30000,
    retryDelay: 1000,
    scaleUpThreshold: 80,
    scaleDownThreshold: 20,
    loadBalancer: {
      strategy: 'round-robin'
    }
  }, logger);

  // Create ChainAbstraction config
  const config = {
    defaultChain: chain as any,
    enabledChains: [chain as any],
    rpcManager,
    gasMultiplier: 1.2,
    maxGasPrice: '100',
    defaultSlippage: 0.5
  };

  return new ChainAbstraction(rpcManager, connectionPool, logger, config);
}