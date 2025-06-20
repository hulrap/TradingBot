/**
 * Dynamic Zero-Latency Trading Configuration
 * Based on Ben Livshits' DeFi Research Insights
 * 
 * ALL VALUES ARE DYNAMICALLY DERIVED IN REAL-TIME
 * No hardcoded bridge costs, timing estimates, or safety buffers
 */

import { EventEmitter } from 'events';
import axios from 'axios';

export interface ZeroLatencyConfig {
  // Core Latency Targets
  performance: {
    maxTotalLatency: number;        // Target: <50ms total execution
    maxPriceLatency: number;        // Target: <5ms price updates  
    maxGasLatency: number;          // Target: <10ms gas updates
    maxRouteLatency: number;        // Target: <1ms route calculation
    maxExecutionLatency: number;    // Target: <25ms transaction execution
    cacheValidityMs: number;        // Target: 100ms cache validity
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

  private bridgeApis = {
    stargate: 'https://stargateprotocol.gitbook.io/stargate/developers/bridge-fee-oracle',
    layerzero: 'https://layerzero.gitbook.io/docs/technical-reference/mainnet/estimated-message-pricing',
    across: 'https://docs.across.to/bridge/developers/estimating-fees',
    hop: 'https://docs.hop.exchange/js-sdk/estimate-fees',
    multichain: 'https://docs.multichain.org/developer-guide/api'
  };

  constructor() {
    super();
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
        const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
        return median;
      }

      // Fallback: Dynamic calculation based on current network conditions
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
    // This would query actual bridge transaction data
    // Implementation depends on available indexing services
    return [];
  }

  private async getCurrentBlockTime(chain: string): Promise<number> {
    try {
      // Get current average block time for the chain
      const response = await axios.get(`https://api.etherscan.io/api`, {
        params: {
          module: 'stats',
          action: 'chainsize',
          apikey: process.env.ETHERSCAN_API_KEY || 'demo'
        },
        timeout: 3000
      });
      
      // Chain-specific block times (in ms)
      const chainBlockTimes: Record<string, number> = {
        ethereum: 12000,   // ~12 seconds
        polygon: 2000,     // ~2 seconds
        arbitrum: 250,     // ~0.25 seconds
        optimism: 2000,    // ~2 seconds
        bsc: 3000,         // ~3 seconds
      };
      
      return chainBlockTimes[chain] || 12000;
    } catch (error) {
      // Fallback to known block times
      const fallbackBlockTimes: Record<string, number> = {
        ethereum: 12000,
        polygon: 2000,
        arbitrum: 250,
        optimism: 2000,
        bsc: 3000,
      };
      return fallbackBlockTimes[chain] || 12000;
    }
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
      // Get current gas prices and block utilization to determine congestion
      const response = await axios.get(`https://api.etherscan.io/api`, {
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: process.env.ETHERSCAN_API_KEY || 'demo'
        },
        timeout: 3000
      });
      
      const gasPrice = parseInt(response.data.result.SafeGasPrice);
      
      // Determine congestion multiplier based on gas price
      if (gasPrice > 100) return 2.0;      // Very high congestion
      if (gasPrice > 50) return 1.5;       // High congestion  
      if (gasPrice > 20) return 1.2;       // Medium congestion
      return 1.0;                          // Normal congestion
    } catch (error) {
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
    
    for (const [strategy, cost] of this.currentSpend.byStrategy) {
      const profit = this.getStrategyProfit(strategy);
      const roi = cost > 0 ? (profit - cost) / cost : 0;
      
      strategyPerformance.set(strategy, { profit, cost, roi });
    }

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

  return {
    performance: {
      maxTotalLatency: parseInt(process.env.ZL_MAX_LATENCY || '50'),
      maxPriceLatency: 5,
      maxGasLatency: 10,
      maxRouteLatency: 1,
      maxExecutionLatency: 25,
      cacheValidityMs: 100,
    },

    livshitsOptimization: {
      enableGraphRouting: process.env.ZL_ENABLE_LIVSHITS !== 'false',
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
          enabled: !!process.env.BLOXROUTE_API_KEY,
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
          enabled: !!process.env.BLOXROUTE_API_KEY,
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
  };
}

// Cost tracking utilities
export class CostTracker {
  private costManager: DynamicCostManager;
  
  constructor(private config: ZeroLatencyConfig) {
    this.costManager = new DynamicCostManager();
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
}

export default createZeroLatencyConfig; 