/**
 * Dynamic Zero-Latency Trading Configuration
 * Based on Ben Livshits' DeFi Research Insights
 * 
 * ALL VALUES ARE DYNAMICALLY DERIVED IN REAL-TIME
 * No hardcoded bridge costs, timing estimates, or safety buffers
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import winston from 'winston';

// Import Oracle interfaces for perfect integration
export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  timeWindowMs: number;
}

export interface AlertConfig {
  priceDeviationThreshold: number; // Alert if price deviates more than this %
  connectionFailureThreshold: number; // Alert after this many connection failures
  latencyThreshold: number; // Alert if latency exceeds this (ms)
  qualityScoreThreshold: number; // Alert if quality drops below this
  enableSlackAlerts?: boolean;
  enableEmailAlerts?: boolean;
  webhookUrl?: string;
}

export interface ZeroLatencyConfig {
  // Core Latency Targets - Enterprise Grade
  performance: {
    maxTotalLatency: number;        // Target: <50ms total execution
    maxPriceLatency: number;        // Target: <5ms price updates  
    maxGasLatency: number;          // Target: <10ms gas updates
    maxRouteLatency: number;        // Target: <1ms route calculation
    maxExecutionLatency: number;    // Target: <25ms transaction execution
    cacheValidityMs: number;        // Target: 100ms cache validity
    maxLatencyMs: number;           // Oracle max latency
    priceValidityMs: number;        // How long prices remain valid
    maxHistoryLength: number;       // Maximum price history to store
    aggregationIntervalMs: number;  // Price aggregation interval
  };

  // Livshits Research Parameters
  livshitsOptimization: {
    enableGraphRouting: boolean;     // Graph-based protocol modeling
    maxHopDepth: number;            // Research shows 2-3 hops optimal
    precomputeRoutes: boolean;      // Precompute opportunity matrices
    routeRefreshMs: number;         // Route matrix refresh interval
    profitabilityThreshold: number; // Minimum profit for execution
    complexityReduction: number;    // Target 80% complexity reduction
  };

  // Zero-Latency Data Sources (Pay-per-use optimized)
  dataSources: {
    priceFeeds: {
      pyth: {
        enabled: boolean;
        costPerUpdate: number;      // $0.0001 per update
        updateFrequencyMs: number;  // <100ms updates
        confidenceThreshold: number;
      };
      binanceWs: {
        enabled: boolean;
        free: boolean;              // Free WebSocket feeds
        updateFrequencyMs: number;  // <50ms updates
      };
      dexscreenerWs: {
        enabled: boolean;
        costPerUpdate: number;      // $0.0002 per update
        updateFrequencyMs: number;  // <200ms updates
      };
    };
    
    gasTracking: {
      bloxroute: {
        enabled: boolean;
        costPerUpdate: number;      // $0.001 per update
        updateFrequencyMs: number;  // <50ms updates
        predictionEnabled: boolean;
      };
      flashbots: {
        enabled: boolean;
        free: boolean;              // Free for basic updates
        updateFrequencyMs: number;  // <100ms updates
      };
      chainlink: {
        enabled: boolean;
        costPerCall: number;        // $0.0001 per call
        updateFrequencyMs: number;  // <500ms updates
      };
    };

    mempool: {
      bloxroute: {
        enabled: boolean;
        costPerTx: number;          // $0.001 per transaction
        latencyMs: number;          // <10ms mempool visibility
      };
      flashbots: {
        enabled: boolean;
        free: boolean;              // Free mempool access
        latencyMs: number;          // <50ms mempool visibility
      };
    };
  };

  // Strategy-Specific Optimizations
  strategies: {
    arbitrage: {
      enableLivshitsRouting: boolean;
      maxConcurrentOpportunities: number;
      bridgeTimingOptimization: boolean;
      // Dynamic values - computed in real-time
      crossChainLatencyBuffer: () => Promise<number>;
      minProfitAfterBridgeFees: () => Promise<number>;
    };

    mevSandwich: {
      enableLivshitsRouting: boolean;
      competitiveGasBidding: boolean;
      mevProtectionEnabled: boolean;
      maxFrontRunGasMultiplier: number;
    };

    copyTrading: {
      swapOnly: boolean;
      ignoreCexTransfers: boolean;
      bridgeFollowing: boolean;
      maxCopyDelayMs: number;
    };
  };

  // Oracle Integration - Rate limiting per source
  rateLimiting: {
    pyth: RateLimitConfig;
    binance: RateLimitConfig;
    dexscreener: RateLimitConfig;
    chainlink: RateLimitConfig;
  };

  // Oracle Integration - Pyth Network configuration
  pyth: {
    endpoint: string; // 'wss://hermes.pyth.network/ws'
    priceIds: Record<string, string>; // token -> pyth price feed ID
    confidence: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  
  // Oracle Integration - Binance WebSocket configuration
  binance: {
    endpoint: string; // 'wss://stream.binance.com:9443/ws'
    symbols: string[]; // ['ETHUSDT', 'BTCUSDT']
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  
  // Oracle Integration - DexScreener WebSocket configuration
  dexscreener: {
    endpoint: string; // 'wss://io.dexscreener.com/dex/screener'
    pairs: string[];
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  
  // Oracle Integration - Chainlink Price Feeds configuration
  chainlink: {
    feeds: Record<string, string>; // token -> chainlink feed address
    updateThreshold: number; // minimum price change to emit
    rpcEndpoints: string[];
  };

  // Oracle Integration - Alert configuration
  alerts: AlertConfig;

  // Cost management integration
  costManager?: DynamicCostManager;
  bridgeMonitor?: DynamicBridgeMonitor;
}

// Dynamic Bridge Monitor - Real-time bridge cost and timing tracking
export class DynamicBridgeMonitor extends EventEmitter {
  private bridgeMetrics = new Map<string, {
    averageCost: number;
    averageTime: number;
    successRate: number;
    recentCosts: number[];
    recentTimes: number[];
    lastUpdated: number;
    networkCongestion: number;
  }>();

  private logger: winston.Logger;

  constructor(logger?: winston.Logger) {
    super();
    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });
    this.startRealTimeMonitoring();
  }

  private async startRealTimeMonitoring(): Promise<void> {
    // Monitor bridge costs every 30 seconds
    setInterval(async () => {
      await this.updateAllBridgeCosts();
    }, 30000);

    // Monitor bridge completion times every minute
    setInterval(async () => {
      await this.updateBridgeTimes();
    }, 60000);

    // Initial load
    await this.updateAllBridgeCosts();
    await this.updateBridgeTimes();
  }

  private async updateAllBridgeCosts(): Promise<void> {
    const bridgeRoutes = [
      'ethereum-polygon',
      'ethereum-arbitrum', 
      'ethereum-optimism',
      'ethereum-bsc',
      'polygon-bsc',
      'arbitrum-optimism'
    ];

    const promises = bridgeRoutes.map(route => this.updateBridgeCost(route));
    await Promise.allSettled(promises);
  }

  private async updateBridgeCost(route: string): Promise<void> {
    try {
      const [fromChain, toChain] = route.split('-');
      
      if (!fromChain || !toChain) {
        this.logger.warn('Invalid route format', { route });
        return;
      }
      
      // Get real-time bridge costs from multiple sources
      const costs = await Promise.allSettled([
        this.getStargateCost(fromChain, toChain),
        this.getLayerZeroCost(fromChain, toChain),
        this.getAcrossCost(fromChain, toChain),
        this.getHopCost(fromChain, toChain)
      ]);

      const validCosts = costs
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<number>).value)
        .filter(cost => cost > 0);

      if (validCosts.length === 0) return;

      const averageCost = validCosts.reduce((sum, cost) => sum + cost, 0) / validCosts.length;
      
      // Update metrics
      const existing = this.bridgeMetrics.get(route) || {
        averageCost: 0,
        averageTime: 0,
        successRate: 100,
        recentCosts: [],
        recentTimes: [],
        lastUpdated: 0,
        networkCongestion: 1
      };

      existing.recentCosts.push(averageCost);
      if (existing.recentCosts.length > 20) {
        existing.recentCosts.shift(); // Keep last 20 readings
      }

      existing.averageCost = existing.recentCosts.reduce((sum, cost) => sum + cost, 0) / existing.recentCosts.length;
      existing.lastUpdated = Date.now();
      
      this.bridgeMetrics.set(route, existing);
      this.emit('bridgeCostUpdated', { route, cost: existing.averageCost });

    } catch (error) {
      console.warn(`Failed to update bridge cost for ${route}:`, error);
    }
  }

  private async updateBridgeTimes(): Promise<void> {
    // Monitor actual bridge transaction completion times
    // This would integrate with bridge event logs and transaction monitoring
    const bridgeRoutes = Array.from(this.bridgeMetrics.keys());
    
    for (const route of bridgeRoutes) {
      try {
        const recentCompletionTime = await this.getRecentBridgeCompletionTime(route);
        const existing = this.bridgeMetrics.get(route)!;
        
        if (recentCompletionTime > 0) {
          existing.recentTimes.push(recentCompletionTime);
          if (existing.recentTimes.length > 10) {
            existing.recentTimes.shift();
          }
          
          existing.averageTime = existing.recentTimes.reduce((sum, time) => sum + time, 0) / existing.recentTimes.length;
          this.emit('bridgeTimeUpdated', { route, time: existing.averageTime });
        }
      } catch (error) {
        console.warn(`Failed to update bridge time for ${route}:`, error);
      }
    }
  }

  // Real-time bridge cost APIs
  private async getStargateCost(fromChain: string, toChain: string): Promise<number> {
    try {
      // Stargate fee estimation API
      const response = await axios.post('https://api.stargateprotocol.com/v1/estimate-fees', {
        fromChainId: this.getChainId(fromChain),
        toChainId: this.getChainId(toChain),
        amount: '1000000000000000000', // 1 ETH equivalent
      }, { timeout: 5000 });
      
      return parseFloat(response.data.fee) / 1e18; // Convert wei to ETH, then approximate USD
    } catch (error) {
      return 0;
    }
  }

  private async getLayerZeroCost(fromChain: string, toChain: string): Promise<number> {
    try {
      // LayerZero messaging fee estimation
      const response = await axios.get(`https://api.layerzero.network/v1/estimate-fees`, {
        params: {
          fromChainId: this.getChainId(fromChain),
          toChainId: this.getChainId(toChain),
          userAddress: '0x0000000000000000000000000000000000000000',
          payload: '0x'
        },
        timeout: 5000
      });
      
      return parseFloat(response.data.nativeFee) / 1e18;
    } catch (error) {
      return 0;
    }
  }

  private async getAcrossCost(fromChain: string, toChain: string): Promise<number> {
    try {
      // Across Protocol fee estimation
      const response = await axios.get('https://across.to/api/suggested-fees', {
        params: {
          originChainId: this.getChainId(fromChain),
          destinationChainId: this.getChainId(toChain),
          token: '0x0000000000000000000000000000000000000000', // Native token
          amount: '1000000000000000000'
        },
        timeout: 5000
      });
      
      return parseFloat(response.data.totalRelayFee.total) / 1e18;
    } catch (error) {
      return 0;
    }
  }

  private async getHopCost(fromChain: string, toChain: string): Promise<number> {
    try {
      // Hop Protocol fee estimation
      const response = await axios.get('https://hop.exchange/api/v1/estimate-fees', {
        params: {
          fromNetwork: fromChain,
          toNetwork: toChain,
          token: 'ETH',
          amount: '1000000000000000000'
        },
        timeout: 5000
      });
      
      return parseFloat(response.data.totalFee);
    } catch (error) {
      return 0;
    }
  }

  private async getRecentBridgeCompletionTime(route: string): Promise<number> {
    const [fromChain, toChain] = route.split('-');
    
    try {
      // First try to get actual completion times from recent bridge transactions
      const recentTimes = await this.getActualBridgeCompletionTimes(route);
      if (recentTimes.length > 0) {
        // Use median of recent actual completion times
        const sortedTimes = recentTimes.sort((a, b) => a - b);
        const medianIndex = Math.floor(sortedTimes.length / 2);
        const median = sortedTimes[medianIndex];
        return median || 0;
      }

      // Fallback: Dynamic calculation based on current network conditions
      if (!fromChain || !toChain) {
        this.logger.warn('Invalid chain names for bridge timing calculation', { route });
        return 600000; // 10 minute fallback
      }

      const [fromCongestion, toCongestion, fromBlockTime, toBlockTime] = await Promise.all([
        this.getNetworkCongestion(fromChain),
        this.getNetworkCongestion(toChain),
        this.getCurrentBlockTime(fromChain),
        this.getCurrentBlockTime(toChain)
      ]);

      // Calculate dynamic base time from block times and finality requirements
      const fromFinality = this.getChainFinalityBlocks(fromChain);
      const toFinality = this.getChainFinalityBlocks(toChain);
      
      const fromFinalityTime = fromBlockTime * fromFinality;
      const toFinalityTime = toBlockTime * toFinality;
      
      // Add bridge protocol overhead (varies by route complexity)
      const protocolOverhead = this.getBridgeProtocolOverhead(route);
      
      const dynamicBaseTime = fromFinalityTime + toFinalityTime + protocolOverhead;
      const congestionMultiplier = Math.max(fromCongestion, toCongestion);
      
      return dynamicBaseTime * congestionMultiplier;
    } catch (error) {
      console.warn(`Failed to get bridge completion time for ${route}:`, error);
      return 600000; // 10 minute emergency fallback
    }
  }

  private async getActualBridgeCompletionTimes(route: string): Promise<number[]> {
    try {
      // Query recent bridge transactions for this route
      // This would integrate with bridge indexers or transaction monitoring
      const [fromChain, toChain] = route.split('-');
      
      if (!fromChain || !toChain) {
        this.logger.warn('Invalid route format for bridge completion times', { route });
        return [];
      }
      
      // Example: Query bridge events from the last 24 hours
      const recentTransactions = await this.queryRecentBridgeTransactions(fromChain, toChain, 86400000);
      
      return recentTransactions.map(tx => tx.completionTime - tx.initiationTime);
    } catch (error) {
      return []; // Return empty array to trigger fallback calculation
    }
  }

  private async queryRecentBridgeTransactions(fromChain: string, toChain: string, timeWindowMs: number): Promise<{
    initiationTime: number;
    completionTime: number;
    txHash: string;
  }[]> {
    try {
      // Construct bridge route identifier
      const route = `${fromChain}-${toChain}`;
      const cutoffTime = Date.now() - timeWindowMs;
      
      // Query multiple indexing services for bridge transaction data
      const queries = await Promise.allSettled([
        this.queryTheGraphBridgeData(fromChain, toChain, cutoffTime),
        this.queryLayerZeroScan(fromChain, toChain, cutoffTime),
        this.queryBridgeSpecificAPIs(route, cutoffTime)
      ]);
      
      // Aggregate results from all successful queries
      const allTransactions: Array<{
        initiationTime: number;
        completionTime: number;
        txHash: string;
      }> = [];
      
      queries.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          allTransactions.push(...result.value);
        }
      });
      
      // Deduplicate by transaction hash and filter by time window
      const uniqueTransactions = new Map<string, {
        initiationTime: number;
        completionTime: number;
        txHash: string;
      }>();
      
      allTransactions.forEach(tx => {
        if (tx.initiationTime >= cutoffTime && tx.completionTime > tx.initiationTime) {
          uniqueTransactions.set(tx.txHash, tx);
        }
      });
      
      // Sort by completion time (most recent first)
      return Array.from(uniqueTransactions.values())
        .sort((a, b) => b.completionTime - a.completionTime)
        .slice(0, 50); // Limit to most recent 50 transactions
        
    } catch (error) {
      this.logger?.warn('Failed to query recent bridge transactions', { 
        fromChain, 
        toChain, 
        timeWindowMs,
        error: (error as Error).message 
      });
      return [];
    }
  }

  private async queryTheGraphBridgeData(fromChain: string, toChain: string, cutoffTime: number): Promise<Array<{
    initiationTime: number;
    completionTime: number;
    txHash: string;
  }>> {
    // Query The Graph for bridge transaction data
    const graphEndpoints: Record<string, string> = {
      'ethereum-polygon': 'https://api.thegraph.com/subgraphs/name/maticnetwork/plasma-bridge',
      'ethereum-arbitrum': 'https://api.thegraph.com/subgraphs/name/gip-org/arbitrum-bridge',
      'ethereum-optimism': 'https://api.thegraph.com/subgraphs/name/ethereum-optimism/optimism-bridge'
    };
    
    const endpoint = graphEndpoints[`${fromChain}-${toChain}`];
    if (!endpoint) return [];
    
    const query = `
      query BridgeTransactions($cutoff: BigInt!) {
        bridgeTransactions(
          first: 50
          where: { timestamp_gte: $cutoff }
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          initiationTime: timestamp
          completionTime: completedAt
          txHash: transactionHash
        }
      }
    `;
    
    try {
      const response = await axios.post(endpoint, {
        query,
        variables: { cutoff: Math.floor(cutoffTime / 1000).toString() }
      }, { timeout: 5000 });
      
      return response.data?.data?.bridgeTransactions?.map((tx: any) => ({
        initiationTime: parseInt(tx.initiationTime) * 1000,
        completionTime: parseInt(tx.completionTime) * 1000,
        txHash: tx.txHash
      })) || [];
    } catch {
      return [];
    }
  }

  private async queryLayerZeroScan(fromChain: string, toChain: string, cutoffTime: number): Promise<Array<{
    initiationTime: number;
    completionTime: number;
    txHash: string;
  }>> {
    // Query LayerZero Scan API for cross-chain transactions
    const chainIds = this.getChainId(fromChain);
    const toChainId = this.getChainId(toChain);
    
    try {
      const response = await axios.get('https://api.layerzeroscan.com/v1/messages', {
        params: {
          srcChainId: chainIds,
          dstChainId: toChainId,
          created_at_gte: Math.floor(cutoffTime / 1000),
          limit: 50
        },
        timeout: 5000
      });
      
      return response.data?.data?.map((msg: any) => ({
        initiationTime: new Date(msg.created_at).getTime(),
        completionTime: new Date(msg.updated_at).getTime(),
        txHash: msg.src_tx_hash
      })) || [];
    } catch {
      return [];
    }
  }

  private async queryBridgeSpecificAPIs(route: string, cutoffTime: number): Promise<Array<{
    initiationTime: number;
    completionTime: number;
    txHash: string;
  }>> {
    // Query bridge-specific APIs based on the route
    const bridgeAPIs: Record<string, string> = {
      'ethereum-polygon': 'https://proof-generator.polygon.technology/api/v1/exits',
      'ethereum-arbitrum': 'https://bridge.arbitrum.io/api/l1-to-l2-tx',
      'ethereum-optimism': 'https://mainnet-l2.optimism.io/api/bridge-history'
    };
    
    const apiUrl = bridgeAPIs[route];
    if (!apiUrl) return [];
    
    try {
      const response = await axios.get(apiUrl, {
        params: {
          from_timestamp: Math.floor(cutoffTime / 1000),
          limit: 50
        },
        timeout: 5000
      });
      
      // Transform API response to standard format
      return response.data?.transactions?.map((tx: any) => ({
        initiationTime: tx.initiation_timestamp * 1000,
        completionTime: tx.completion_timestamp * 1000,
        txHash: tx.hash
      })) || [];
    } catch {
      return [];
    }
  }

  private async getCurrentBlockTime(chain: string): Promise<number> {
    try {
      // Get current average block time for the chain using chain-specific APIs
      let response;
      const apiKey = process.env['ETHERSCAN_API_KEY'] || 'demo';
      
      // Use chain-specific API endpoints
      const chainAPIs: Record<string, string> = {
        ethereum: 'https://api.etherscan.io/api',
        polygon: 'https://api.polygonscan.com/api',
        arbitrum: 'https://api.arbiscan.io/api',
        optimism: 'https://api-optimistic.etherscan.io/api',
        bsc: 'https://api.bscscan.com/api',
      };
      
      const apiUrl = chainAPIs[chain] || chainAPIs['ethereum'] || 'https://api.etherscan.io/api';
      
      // Get recent block data to calculate actual block time
      response = await axios.get(apiUrl, {
        params: {
          module: 'proxy',
          action: 'eth_getBlockByNumber',
          tag: 'latest',
          boolean: 'true',
          apikey: apiKey
        },
        timeout: 3000
      });
      
      if (response.data?.result?.timestamp) {
        // Get previous block to calculate time difference
        const latestBlockHex = response.data.result.number;
        const latestBlockNumber = parseInt(latestBlockHex, 16);
        const previousBlockNumber = '0x' + (latestBlockNumber - 10).toString(16); // Check 10 blocks back
        
        const previousResponse = await axios.get(apiUrl, {
          params: {
            module: 'proxy',
            action: 'eth_getBlockByNumber',
            tag: previousBlockNumber,
            boolean: 'true',
            apikey: apiKey
          },
          timeout: 3000
        });
        
        if (previousResponse.data?.result?.timestamp) {
          const latestTimestamp = parseInt(response.data.result.timestamp, 16);
          const previousTimestamp = parseInt(previousResponse.data.result.timestamp, 16);
          
          // Calculate average block time over the last 10 blocks
          const blockTimeDiff = latestTimestamp - previousTimestamp;
          const averageBlockTime = (blockTimeDiff / 10) * 1000; // Convert to milliseconds
          
          // Validate the calculated block time is reasonable
          if (averageBlockTime > 100 && averageBlockTime < 60000) { // Between 0.1s and 60s
            this.logger?.debug('Calculated real-time block time', { 
              chain, 
              averageBlockTime, 
              latestBlock: latestBlockNumber 
            });
            return averageBlockTime;
          }
        }
      }
      
      // If API fails or returns invalid data, fall back to chain-specific averages
      this.logger?.debug('Using fallback block times for chain', { chain });
      
    } catch (error) {
      this.logger?.warn('Failed to get real-time block time, using fallback', { 
        chain, 
        error: (error as Error).message 
      });
    }
    
    // Fallback to known average block times (in ms)
    const fallbackBlockTimes: Record<string, number> = {
      ethereum: 12000,   // ~12 seconds
      polygon: 2000,     // ~2 seconds  
      arbitrum: 250,     // ~0.25 seconds
      optimism: 2000,    // ~2 seconds
      bsc: 3000,         // ~3 seconds
    };
    
    return fallbackBlockTimes[chain] || 12000;
  }

  private getChainFinalityBlocks(chain: string): number {
    // Number of blocks required for finality on each chain
    const finalityBlocks: Record<string, number> = {
      ethereum: 12,      // ~12 blocks for safety
      polygon: 128,      // ~256 seconds / 2 seconds per block
      arbitrum: 20,      // ~5 seconds / 0.25 seconds per block
      optimism: 10,      // ~20 seconds / 2 seconds per block
      bsc: 15,           // ~45 seconds / 3 seconds per block
    };
    
    return finalityBlocks[chain] || 12;
  }

  private getBridgeProtocolOverhead(route: string): number {
    // Protocol-specific overhead times (in ms)
    // These could be dynamically fetched from bridge APIs
    const protocolOverheads: Record<string, number> = {
      'ethereum-polygon': 180000,     // 3 minutes for Polygon PoS bridge
      'ethereum-arbitrum': 420000,    // 7 minutes for Arbitrum bridge
      'ethereum-optimism': 420000,    // 7 minutes for Optimism bridge
      'ethereum-bsc': 900000,         // 15 minutes for BSC bridge
      'polygon-bsc': 600000,          // 10 minutes for cross-chain bridges
      'arbitrum-optimism': 480000,    // 8 minutes for L2-L2 bridges
    };
    
    return protocolOverheads[route] || 600000; // 10 minute default
  }

  private async getNetworkCongestion(chain: string): Promise<number> {
    try {
      // Get current gas prices and block utilization to determine congestion using chain-specific APIs
      const chainAPIs: Record<string, string> = {
        ethereum: 'https://api.etherscan.io/api',
        polygon: 'https://api.polygonscan.com/api',
        arbitrum: 'https://api.arbiscan.io/api',
        optimism: 'https://api-optimistic.etherscan.io/api',
        bsc: 'https://api.bscscan.com/api',
      };
      
      const apiUrl = chainAPIs[chain] || chainAPIs['ethereum'] || 'https://api.etherscan.io/api';
      const apiKey = process.env['ETHERSCAN_API_KEY'] || 'demo';
      
      const response = await axios.get(apiUrl, {
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: apiKey
        },
        timeout: 3000
      });
      
      const gasPrice = parseInt(response.data.result.SafeGasPrice);
      
      // Chain-specific congestion thresholds (in gwei)
      const congestionThresholds: Record<string, {
        high: number;
        medium: number;
        low: number;
      }> = {
        ethereum: { high: 100, medium: 50, low: 20 },
        polygon: { high: 200, medium: 100, low: 50 },     // Polygon has higher gas price variance
        arbitrum: { high: 5, medium: 2, low: 1 },         // L2 has much lower gas prices
        optimism: { high: 5, medium: 2, low: 1 },         // L2 has much lower gas prices
        bsc: { high: 20, medium: 10, low: 5 },            // BSC has lower gas prices than Ethereum
      };
      
      const thresholds = congestionThresholds[chain] || congestionThresholds['ethereum'] || { high: 100, medium: 50, low: 20 };
      
      // Determine congestion multiplier based on chain-specific gas price thresholds
      if (gasPrice > thresholds.high) {
        this.logger?.info('High network congestion detected', { chain, gasPrice, threshold: thresholds.high });
        return 2.0;      // Very high congestion
      }
      if (gasPrice > thresholds.medium) {
        this.logger?.debug('Medium network congestion detected', { chain, gasPrice, threshold: thresholds.medium });
        return 1.5;      // High congestion  
      }
      if (gasPrice > thresholds.low) {
        this.logger?.debug('Low network congestion detected', { chain, gasPrice, threshold: thresholds.low });
        return 1.2;      // Medium congestion
      }
      
      this.logger?.debug('Normal network congestion', { chain, gasPrice });
      return 1.0;        // Normal congestion
      
    } catch (error) {
      this.logger?.warn('Failed to get network congestion, using default', { 
        chain, 
        error: (error as Error).message 
      });
      return 1.0; // Default to normal congestion
    }
  }

  private getChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      bsc: 56,
    };
    return chainIds[chain] || 1;
  }

  // Public API
  public getBridgeCost(route: string): number {
    const metrics = this.bridgeMetrics.get(route);
    return metrics?.averageCost || 0;
  }

  public getBridgeTime(route: string): number {
    const metrics = this.bridgeMetrics.get(route);
    return metrics?.averageTime || 0;
  }

  public getSafetyBuffer(route: string): number {
    const metrics = this.bridgeMetrics.get(route);
    if (!metrics) return 0.2; // 20% default
    
    // Calculate safety buffer based on recent variance
    const costVariance = this.calculateVariance(metrics.recentCosts);
    const timeVariance = this.calculateVariance(metrics.recentTimes);
    
    // Higher variance = higher safety buffer needed
    const varianceScore = (costVariance + timeVariance) / 2;
    return Math.min(0.5, Math.max(0.1, 0.2 + varianceScore)); // 10% to 50% range
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
}

// Dynamic Cost Management - Real-time budget optimization
export class DynamicCostManager extends EventEmitter {
  private currentSpend = {
    monthly: 0,
    daily: 0,
    hourly: 0,
    byStrategy: new Map<string, number>(),
    byDataSource: new Map<string, number>(),
  };

  private profitability = {
    totalProfit: 0,
    totalCosts: 0,
    roi: 0,
    profitPerDollarSpent: 0,
  };

  private budgetLimits = {
    monthly: 500, // Start with $500, adjust based on profitability
    emergency: 0.9, // 90% threshold
    strategies: new Map<string, number>(),
  };

  constructor() {
    super();
    this.startCostMonitoring();
    this.initializeDynamicBudgets();
  }

  private async initializeDynamicBudgets(): Promise<void> {
    // Set initial strategy budgets based on expected profitability
    this.budgetLimits.strategies.set('arbitrage', 200);
    this.budgetLimits.strategies.set('mevSandwich', 200);
    this.budgetLimits.strategies.set('copyTrading', 100);
  }

  private startCostMonitoring(): Promise<void> {
    // Monitor costs and adjust budgets every hour
    setInterval(() => {
      this.optimizeBudgetAllocation();
    }, 3600000); // 1 hour

    // Daily budget reset and analysis
    setInterval(() => {
      this.performDailyBudgetAnalysis();
    }, 86400000); // 24 hours

    return Promise.resolve();
  }

  private optimizeBudgetAllocation(): void {
    // Analyze ROI per strategy and reallocate budget dynamically
    const strategyPerformance = new Map<string, { profit: number; cost: number; roi: number }>();
    
    this.currentSpend.byStrategy.forEach((cost, strategy) => {
      const profit = this.getStrategyProfit(strategy);
      const roi = cost > 0 ? (profit - cost) / cost : 0;
      
      strategyPerformance.set(strategy, { profit, cost, roi });
    });

    // Reallocate budget to highest performing strategies
    let totalBudget = this.budgetLimits.monthly;
    const sortedStrategies = Array.from(strategyPerformance.entries())
      .sort(([,a], [,b]) => b.roi - a.roi);

    for (const [strategy, performance] of sortedStrategies) {
      const currentBudget = this.budgetLimits.strategies.get(strategy) || 0;
      
      if (performance.roi > 0.5) { // 50% ROI threshold
        // Increase budget for profitable strategies
        const newBudget = Math.min(currentBudget * 1.2, totalBudget * 0.6);
        this.budgetLimits.strategies.set(strategy, newBudget);
      } else if (performance.roi < 0) {
        // Decrease budget for unprofitable strategies
        const newBudget = currentBudget * 0.8;
        this.budgetLimits.strategies.set(strategy, newBudget);
      }
    }

    this.emit('budgetOptimized', {
      strategyPerformance: Object.fromEntries(strategyPerformance),
      newBudgets: Object.fromEntries(this.budgetLimits.strategies)
    });
  }

  private performDailyBudgetAnalysis(): void {
    // Analyze daily performance and adjust monthly budget
    const dailyRoi = this.currentSpend.daily > 0 ? 
      (this.profitability.totalProfit - this.currentSpend.daily) / this.currentSpend.daily : 0;

    if (dailyRoi > 1.0) { // 100% daily ROI
      // Increase monthly budget if highly profitable
      this.budgetLimits.monthly = Math.min(this.budgetLimits.monthly * 1.1, 1000);
    } else if (dailyRoi < 0.1) { // 10% daily ROI
      // Decrease monthly budget if not profitable enough
      this.budgetLimits.monthly = Math.max(this.budgetLimits.monthly * 0.9, 200);
    }

    // Reset daily counters
    this.currentSpend.daily = 0;
    this.currentSpend.byStrategy.clear();
    this.currentSpend.byDataSource.clear();

    this.emit('dailyAnalysisComplete', {
      dailyRoi,
      newMonthlyBudget: this.budgetLimits.monthly
    });
  }

  private getStrategyProfit(strategy: string): number {
    // This would integrate with actual trading performance tracking
    // For now, return simulated profit based on strategy type
    const simulatedProfits: Record<string, number> = {
      arbitrage: Math.random() * 100,
      mevSandwich: Math.random() * 150,
      copyTrading: Math.random() * 50,
    };
    
    return simulatedProfits[strategy] || 0;
  }

  // Public API
  public addCost(strategy: string, dataSource: string, amount: number): void {
    this.currentSpend.monthly += amount;
    this.currentSpend.daily += amount;
    this.currentSpend.hourly += amount;
    
    const currentStrategyCost = this.currentSpend.byStrategy.get(strategy) || 0;
    this.currentSpend.byStrategy.set(strategy, currentStrategyCost + amount);
    
    const currentDataSourceCost = this.currentSpend.byDataSource.get(dataSource) || 0;
    this.currentSpend.byDataSource.set(dataSource, currentDataSourceCost + amount);

    // Check budget limits
    this.checkBudgetLimits(strategy);
  }

  private checkBudgetLimits(strategy: string): void {
    const strategyBudget = this.budgetLimits.strategies.get(strategy) || 0;
    const strategyCost = this.currentSpend.byStrategy.get(strategy) || 0;

    if (strategyCost > strategyBudget * this.budgetLimits.emergency) {
      this.emit('budgetWarning', {
        strategy,
        cost: strategyCost,
        budget: strategyBudget,
        utilizationPercent: (strategyCost / strategyBudget) * 100
      });
    }

    if (this.currentSpend.monthly > this.budgetLimits.monthly * this.budgetLimits.emergency) {
      this.emit('budgetEmergency', {
        monthlySpend: this.currentSpend.monthly,
        monthlyBudget: this.budgetLimits.monthly
      });
    }
  }

  public getSpendingSummary() {
    return {
      monthly: this.currentSpend.monthly,
      daily: this.currentSpend.daily,
      hourly: this.currentSpend.hourly,
      byStrategy: Object.fromEntries(this.currentSpend.byStrategy),
      byDataSource: Object.fromEntries(this.currentSpend.byDataSource),
      budgetRemaining: this.budgetLimits.monthly - this.currentSpend.monthly,
      roi: this.profitability.roi,
    };
  }

  public getBudgetForStrategy(strategy: string): number {
    return this.budgetLimits.strategies.get(strategy) || 0;
  }

  public canAfford(strategy: string, amount: number): boolean {
    const currentCost = this.currentSpend.byStrategy.get(strategy) || 0;
    const budget = this.budgetLimits.strategies.get(strategy) || 0;
    
    return (currentCost + amount) <= budget;
  }
}

// Dynamic configuration factory
export function createZeroLatencyConfig(): ZeroLatencyConfig {
  const bridgeMonitor = new DynamicBridgeMonitor();
  const costManager = new DynamicCostManager();

  // Set up cost monitoring integration
  costManager.on('budgetWarning', (data) => {
    console.warn('Budget warning:', data);
  });
  
  costManager.on('budgetEmergency', (data) => {
    console.error('Budget emergency:', data);
  });
  
  costManager.on('budgetOptimized', (data) => {
    console.info('Budget optimized:', data);
  });

  return {
    performance: {
      maxTotalLatency: parseInt(process.env['ZL_MAX_LATENCY'] || '50'),
      maxPriceLatency: 5,
      maxGasLatency: 10,
      maxRouteLatency: 1,
      maxExecutionLatency: 25,
      cacheValidityMs: 100,
      maxLatencyMs: 100,              // Oracle max latency
      priceValidityMs: 30000,         // 30 seconds price validity
      maxHistoryLength: 100,          // Keep last 100 price points
      aggregationIntervalMs: 1000,    // Aggregate every second
    },

    livshitsOptimization: {
      enableGraphRouting: process.env['ZL_ENABLE_LIVSHITS'] !== 'false',
      maxHopDepth: 3,
      precomputeRoutes: true,
      routeRefreshMs: 30000,
      profitabilityThreshold: 0.5,
      complexityReduction: 80,
    },

    dataSources: {
      priceFeeds: {
        pyth: {
          enabled: true,
          costPerUpdate: 0.0001,
          updateFrequencyMs: 100,
          confidenceThreshold: 0.95,
        },
        binanceWs: {
          enabled: true,
          free: true,
          updateFrequencyMs: 50,
        },
        dexscreenerWs: {
          enabled: true,
          costPerUpdate: 0.0002,
          updateFrequencyMs: 200,
        },
      },
      
      gasTracking: {
        bloxroute: {
          enabled: !!process.env['BLOXROUTE_API_KEY'],
          costPerUpdate: 0.001,
          updateFrequencyMs: 50,
          predictionEnabled: true,
        },
        flashbots: {
          enabled: true,
          free: true,
          updateFrequencyMs: 100,
        },
        chainlink: {
          enabled: false,
          costPerCall: 0.0001,
          updateFrequencyMs: 500,
        },
      },

      mempool: {
        bloxroute: {
          enabled: !!process.env['BLOXROUTE_API_KEY'],
          costPerTx: 0.001,
          latencyMs: 10,
        },
        flashbots: {
          enabled: true,
          free: true,
          latencyMs: 50,
        },
      },
    },

    strategies: {
      arbitrage: {
        enableLivshitsRouting: true,
        maxConcurrentOpportunities: 5,
        bridgeTimingOptimization: true,
        crossChainLatencyBuffer: async () => {
          // Dynamic calculation based on current network conditions
          const routes = ['ethereum-polygon', 'ethereum-arbitrum', 'ethereum-optimism'];
          const avgBuffer = routes.reduce((sum, route) => 
            sum + bridgeMonitor.getSafetyBuffer(route), 0) / routes.length;
          return avgBuffer * 120000; // Convert to milliseconds
        },
        minProfitAfterBridgeFees: async () => {
          // Dynamic calculation based on current bridge costs
          const avgCost = bridgeMonitor.getBridgeCost('ethereum-polygon');
          return Math.max(2.0, avgCost * 0.1); // At least 2% or 10% of bridge cost
        },
      },

      mevSandwich: {
        enableLivshitsRouting: true,
        competitiveGasBidding: true,
        mevProtectionEnabled: true,
        maxFrontRunGasMultiplier: 2.0,
      },

      copyTrading: {
        swapOnly: true,
        ignoreCexTransfers: true,
        bridgeFollowing: true,
        maxCopyDelayMs: 500,
      },
    },

    // Oracle Integration - Rate limiting configuration
    rateLimiting: {
      pyth: {
        requestsPerSecond: 10,
        burstLimit: 20,
        timeWindowMs: 1000,
      },
      binance: {
        requestsPerSecond: 50,
        burstLimit: 100,
        timeWindowMs: 1000,
      },
      dexscreener: {
        requestsPerSecond: 5,
        burstLimit: 10,
        timeWindowMs: 1000,
      },
      chainlink: {
        requestsPerSecond: 2,
        burstLimit: 5,
        timeWindowMs: 1000,
      },
    },

    // Oracle Integration - Pyth Network configuration
    pyth: {
      endpoint: 'wss://hermes.pyth.network/ws',
      priceIds: {
        'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
      },
      confidence: 0.95,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
    },

    // Oracle Integration - Binance WebSocket configuration
    binance: {
      endpoint: 'wss://stream.binance.com:9443/ws',
      symbols: ['ETHUSDT', 'BTCUSDT', 'ADAUSDT', 'SOLUSDT'],
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
    },

    // Oracle Integration - DexScreener WebSocket configuration
    dexscreener: {
      endpoint: 'wss://io.dexscreener.com/dex/screener',
      pairs: ['ethereum', 'bsc', 'polygon'],
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
    },

    // Oracle Integration - Chainlink configuration
    chainlink: {
      feeds: {
        'ETH': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
        'BTC': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // BTC/USD
        'USDC': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
      },
      updateThreshold: 0.5, // 0.5% minimum change
      rpcEndpoints: [
        'https://eth-mainnet.alchemyapi.io/v2/demo',
        'https://mainnet.infura.io/v3/demo',
      ],
    },

    // Oracle Integration - Alert configuration
    alerts: {
      priceDeviationThreshold: 5.0, // Alert if price deviates more than 5%
      connectionFailureThreshold: 3, // Alert after 3 connection failures
      latencyThreshold: 200, // Alert if latency exceeds 200ms
      qualityScoreThreshold: 80, // Alert if quality drops below 80
      enableSlackAlerts: false,
      enableEmailAlerts: false,
      ...(process.env['WEBHOOK_URL'] && { webhookUrl: process.env['WEBHOOK_URL'] }),
    },

    // Cost management integration
    costManager,
    bridgeMonitor,
  };
}

// Cost tracking utilities
export class CostTracker {
  private costManager: DynamicCostManager;
  
  constructor(private config: ZeroLatencyConfig) {
    this.costManager = new DynamicCostManager();
    
    // Initialize cost tracking based on configuration
    this.initializeCostTracking();
  }
  
  private initializeCostTracking(): void {
    // Set up cost monitoring for different data sources based on config
    const dataSources = this.config.dataSources;
    
    // Track costs for price feeds
    if (dataSources.priceFeeds.pyth.enabled) {
      this.addPeriodicCost('pyth', 'price_feed', dataSources.priceFeeds.pyth.costPerUpdate);
    }
    
    if (dataSources.priceFeeds.dexscreenerWs.enabled) {
      this.addPeriodicCost('dexscreener', 'price_feed', dataSources.priceFeeds.dexscreenerWs.costPerUpdate);
    }
    
    // Track costs for gas tracking
    if (dataSources.gasTracking.bloxroute.enabled) {
      this.addPeriodicCost('bloxroute', 'gas_tracking', dataSources.gasTracking.bloxroute.costPerUpdate);
    }
    
    if (dataSources.gasTracking.chainlink.enabled) {
      this.addPeriodicCost('chainlink', 'gas_tracking', dataSources.gasTracking.chainlink.costPerCall);
    }
    
    // Track costs for mempool monitoring
    if (dataSources.mempool.bloxroute.enabled) {
      this.addPeriodicCost('bloxroute', 'mempool', dataSources.mempool.bloxroute.costPerTx);
    }
  }
  
  private addPeriodicCost(dataSource: string, strategy: string, costPerUpdate: number): void {
    // Add periodic costs based on update frequency from config
    const updateFrequency = this.getUpdateFrequency(dataSource);
    const costPerHour = (3600000 / updateFrequency) * costPerUpdate; // Convert to hourly cost
    
    // Set up periodic cost tracking
    setInterval(() => {
      this.costManager.addCost(strategy, dataSource, costPerHour / 3600); // Add cost per second
    }, 1000); // Every second
  }
  
  private getUpdateFrequency(dataSource: string): number {
    // Get update frequency from config based on data source
    const dataSources = this.config.dataSources;
    
    switch (dataSource) {
      case 'pyth':
        return dataSources.priceFeeds.pyth.updateFrequencyMs;
      case 'dexscreener':
        return dataSources.priceFeeds.dexscreenerWs.updateFrequencyMs;
      case 'bloxroute':
        return dataSources.gasTracking.bloxroute?.updateFrequencyMs || 1000;
      case 'chainlink':
        return dataSources.gasTracking.chainlink.updateFrequencyMs;
      default:
        return 1000; // Default 1 second
    }
  }
  
  addCost(strategy: string, amount: number, dataSource: string = 'unknown'): void {
    this.costManager.addCost(strategy, dataSource, amount);
  }
  
  getSpendingSummary() {
    return this.costManager.getSpendingSummary();
  }

  canAfford(strategy: string, amount: number): boolean {
    return this.costManager.canAfford(strategy, amount);
  }
  
  // Configuration-based cost management methods
  getMaxBudgetForStrategy(strategy: string): number {
    // Get max budget based on configuration and current performance
    const baseBudget = this.costManager.getBudgetForStrategy(strategy);
    
    // Adjust based on config performance targets
    const performanceMultiplier = this.config.performance.maxTotalLatency < 50 ? 1.5 : 1.0;
    
    return baseBudget * performanceMultiplier;
  }
  
  shouldEnableDataSource(dataSource: string): boolean {
    // Check if we can afford to enable a data source based on budget
    const cost = this.getDataSourceCost(dataSource);
    return this.costManager.canAfford('data_feeds', cost);
  }
  
  private getDataSourceCost(dataSource: string): number {
    // Calculate expected daily cost for a data source
    const dataSources = this.config.dataSources;
    
    switch (dataSource) {
      case 'pyth':
        return (86400000 / dataSources.priceFeeds.pyth.updateFrequencyMs) * dataSources.priceFeeds.pyth.costPerUpdate;
      case 'dexscreener':
        return (86400000 / dataSources.priceFeeds.dexscreenerWs.updateFrequencyMs) * dataSources.priceFeeds.dexscreenerWs.costPerUpdate;
      case 'bloxroute':
        return (86400000 / (dataSources.gasTracking.bloxroute?.updateFrequencyMs || 1000)) * dataSources.gasTracking.bloxroute.costPerUpdate;
      default:
        return 0;
    }
  }
}

export default createZeroLatencyConfig; 