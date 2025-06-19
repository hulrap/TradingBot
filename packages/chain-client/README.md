# Multi-Chain RPC Infrastructure

## Overview

The Multi-Chain RPC Infrastructure provides a comprehensive solution for interacting with multiple blockchain networks through a unified interface. This package implements **Task 5.1 (RPC Infrastructure Setup)**, **Task 5.2 (Enhanced Chain Abstraction Layer)**, and **Task 5.3 (Advanced DEX Integration Layer)** with enterprise-grade reliability, performance optimization, and intelligent routing.

## Features

### 🚀 Task 5.1: RPC Infrastructure Setup
- **Tiered RPC Strategy**: Premium, standard, and fallback provider tiers
- **Premium Provider Integration**: QuickNode, Alchemy, Chainstack, NodeReal, Helius
- **Connection Pooling**: Advanced connection management with load balancing
- **Rate Limiting**: Intelligent rate limiting per provider and tier
- **Health Monitoring**: Continuous health checks with automatic failover
- **Latency Optimization**: Real-time latency monitoring and provider ranking
- **Cost Optimization**: Daily cost tracking and budget management
- **Caching System**: Smart response caching with configurable TTL

### 🔗 Task 5.2: Enhanced Chain Abstraction Layer
- **Multi-Chain Support**: Ethereum, BSC, Polygon, Arbitrum, Optimism, Solana
- **Unified Interface**: Common API across all supported chains
- **Address Validation**: Chain-specific address format validation
- **Gas Estimation**: Accurate gas estimation for all networks
- **Transaction Building**: Simplified transaction construction and signing
- **Balance Queries**: Native and token balance checking
- **Block Information**: Real-time block data retrieval
- **Chain State Monitoring**: Network health and sync status

### 🔄 Task 5.3: Advanced DEX Integration Layer
- **Multi-DEX Support**: Uniswap V2/V3, PancakeSwap, QuickSwap, Camelot, Jupiter, 1inch
- **Quote Aggregation**: Best price discovery across multiple DEXes
- **Smart Routing**: Optimal path finding with multi-hop support
- **Slippage Protection**: Configurable slippage tolerance
- **Gas Optimization**: Gas-aware route selection
- **Token Lists**: Comprehensive token information for all chains
- **Performance Tracking**: DEX performance metrics and reliability scores

## Supported Networks

| Chain | Chain ID | Native Token | DEX Support | Status |
|-------|----------|--------------|-------------|---------|
| Ethereum | 1 | ETH | Uniswap V2/V3, 1inch | ✅ Active |
| BSC | 56 | BNB | PancakeSwap V2/V3, 1inch | ✅ Active |
| Polygon | 137 | MATIC | Uniswap V3, QuickSwap | ✅ Active |
| Arbitrum | 42161 | ETH | Uniswap V3, Camelot | ✅ Active |
| Optimism | 10 | ETH | Uniswap V3 | ✅ Active |
| Solana | 101 | SOL | Jupiter, Raydium | ✅ Active |

## Installation

```bash
# Install the package
npm install @trading-bot/chain-client

# Install peer dependencies
npm install winston axios ws ethers @solana/web3.js p-queue p-retry
```

## Quick Start

```typescript
import winston from 'winston';
import { 
  RPCManager, 
  ConnectionPool, 
  ChainAbstraction, 
  DEXAggregator 
} from '@trading-bot/chain-client';

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Initialize RPC infrastructure
const rpcManager = new RPCManager(logger);
const connectionPool = new ConnectionPool(
  rpcManager,
  {
    maxConcurrentConnections: 10,
    connectionTimeoutMs: 5000,
    idleTimeoutMs: 300000,
    retryAttempts: 3,
    retryDelayMs: 1000,
    healthCheckIntervalMs: 30000,
    loadBalancingStrategy: 'weighted'
  },
  logger
);

// Initialize chain abstraction
const chainAbstraction = new ChainAbstraction(
  rpcManager,
  connectionPool,
  logger
);

// Initialize DEX aggregator
const dexAggregator = new DEXAggregator(chainAbstraction, logger);
```

## Environment Configuration

Create a `.env` file with your RPC provider credentials:

```bash
# Premium RPC Providers
QUICKNODE_API_KEY=your_quicknode_api_key
QUICKNODE_ETH_URL=https://your-endpoint.quiknode.pro/
ALCHEMY_API_KEY=your_alchemy_api_key
CHAINSTACK_API_KEY=your_chainstack_api_key
NODEREAL_API_KEY=your_nodereal_api_key
HELIUS_API_KEY=your_helius_api_key
INFURA_API_KEY=your_infura_api_key
ONEINCH_API_KEY=your_1inch_api_key

# Configuration
RPC_RATE_LIMIT_PREMIUM=100
RPC_RATE_LIMIT_STANDARD=10
RPC_COST_OPTIMIZATION_ENABLED=true
RPC_MAX_DAILY_COST=10.00
```

## Usage Examples

### 1. Get Token Balance

```typescript
// Get ETH balance
const ethBalance = await chainAbstraction.getBalance(
  'ethereum',
  '0x742d35Cc6648C1532C2B2a4f43C421B4C43C421B'
);

console.log(`ETH Balance: ${ethBalance.balanceFormatted} ETH`);

// Get ERC-20 token balance
const usdcBalance = await chainAbstraction.getBalance(
  'ethereum',
  '0x742d35Cc6648C1532C2B2a4f43C421B4C43C421B',
  '0xA0b86a33E6441e27a4E54E7cb03FA3a84F8C0F4F' // USDC address
);

console.log(`USDC Balance: ${usdcBalance.balanceFormatted} USDC`);
```

### 2. Get Swap Quote

```typescript
// Get best swap quote across multiple DEXes
const quoteRequest = {
  inputToken: '0xA0b86a33E6441e27a4E54E7cb03FA3a84F8C0F4F', // USDC
  outputToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  amount: '1000000000', // 1000 USDC (6 decimals)
  slippage: 0.5, // 0.5%
  chain: 'ethereum',
  userAddress: '0x742d35Cc6648C1532C2B2a4f43C421B4C43C421B'
};

const quote = await dexAggregator.getSwapQuote(quoteRequest);

console.log(`Best Route: ${quote.bestRoute.dex}`);
console.log(`Output Amount: ${quote.bestRoute.outputAmount}`);
console.log(`Gas Cost: ${quote.bestRoute.gasEstimate.totalCostFormatted}`);
console.log(`Net Output: ${quote.netOutput}`);
```

### 3. Send Transaction

```typescript
// Build and send transaction
const txRequest = {
  to: '0xRecipientAddress',
  value: '1000000000000000000', // 1 ETH in wei
  gasLimit: '21000'
};

const tx = await chainAbstraction.sendTransaction(
  'ethereum',
  txRequest,
  'your_private_key'
);

console.log(`Transaction Hash: ${tx.hash}`);

// Wait for confirmation
const receipt = await chainAbstraction.waitForTransaction(
  'ethereum',
  tx.hash,
  2 // Wait for 2 confirmations
);

console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
```

### 4. Monitor Chain State

```typescript
// Get current chain state
const chainState = await chainAbstraction.getChainState('ethereum');

console.log(`Latest Block: ${chainState.latestBlock}`);
console.log(`Gas Price: ${chainState.gasPrice}`);
console.log(`Chain Healthy: ${chainState.isHealthy}`);
```

### 5. RPC Performance Monitoring

```typescript
// Get RPC metrics
const rpcMetrics = rpcManager.getMetrics();
console.log(`Success Rate: ${rpcMetrics.successRate.toFixed(2)}%`);
console.log(`Average Latency: ${rpcMetrics.averageLatency.toFixed(0)}ms`);
console.log(`Daily Cost: $${rpcMetrics.costToday.toFixed(6)}`);

// Get connection pool stats
const poolStats = connectionPool.getStats();
console.log(`Active Connections: ${poolStats.activeConnections}`);
console.log(`Connection Utilization: ${poolStats.connectionUtilization.toFixed(1)}%`);

// Get DEX aggregator stats
const dexStats = dexAggregator.getStats();
console.log(`Total Quotes: ${dexStats.totalQuotes}`);
console.log(`Success Rate: ${(dexStats.successfulQuotes / dexStats.totalQuotes * 100).toFixed(1)}%`);
```

## Advanced Configuration

### Load Balancing Strategies

```typescript
const connectionPool = new ConnectionPool(rpcManager, {
  loadBalancingStrategy: 'weighted', // Options: round-robin, least-connections, weighted, latency-based
  maxConcurrentConnections: 20,
  healthCheckIntervalMs: 30000
}, logger);
```

### RPC Provider Prioritization

```typescript
// Optimize for latency
await rpcManager.optimizeForLatency('ethereum');

// Get provider status
const providerStatus = rpcManager.getProviderStatus('ethereum');
console.log('Provider Health:', providerStatus.map(p => ({
  provider: p.provider.name,
  healthy: p.isHealthy,
  latency: p.latency,
  successRate: p.successRate
})));
```

### DEX Configuration

```typescript
// Enable/disable specific DEXes
await dexAggregator.disableDEX('uniswap-v2-eth');
await dexAggregator.enableDEX('1inch-eth');

// Get supported DEXes for a chain
const ethDEXes = dexAggregator.getSupportedDEXes('ethereum');
console.log('Available DEXes:', ethDEXes.map(d => d.name));
```

## Performance Optimizations

### 1. Response Caching
- Automatic caching of frequently requested data
- Configurable TTL per method type
- Cache cleanup and memory management

### 2. Connection Pooling
- Reuse connections across requests
- Automatic scaling based on demand
- Idle connection cleanup

### 3. Smart Provider Selection
- Multi-factor scoring algorithm
- Real-time performance metrics
- Automatic failover and recovery

### 4. Request Queuing
- Rate-limit compliant request processing
- Priority-based queue management
- Batch processing optimization

## Error Handling

The infrastructure includes comprehensive error handling:

```typescript
try {
  const quote = await dexAggregator.getSwapQuote(request);
} catch (error) {
  if (error.message.includes('No available providers')) {
    // Handle RPC provider issues
    console.log('RPC connectivity issues detected');
  } else if (error.message.includes('No successful quotes')) {
    // Handle DEX unavailability
    console.log('All DEXes unavailable for this pair');
  } else {
    // Handle other errors
    console.log('Unexpected error:', error.message);
  }
}
```

## Monitoring and Alerts

### RPC Health Monitoring
- Provider blacklisting after consecutive failures
- Automatic recovery and re-enablement
- Real-time latency tracking
- Cost optimization alerts

### DEX Performance Tracking
- Success rate monitoring per DEX
- Response time tracking
- Slippage analysis
- Volume routing statistics

## Security Considerations

1. **API Key Management**: Store API keys securely in environment variables
2. **Rate Limiting**: Respect provider rate limits to avoid blacklisting
3. **Error Handling**: Never expose sensitive information in error messages
4. **Connection Security**: Use HTTPS/WSS for all provider connections
5. **Input Validation**: Validate all user inputs before processing

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Maintain backward compatibility where possible

## License

MIT License - see LICENSE file for details.

## Support

For support, please check the documentation or create an issue in the repository.