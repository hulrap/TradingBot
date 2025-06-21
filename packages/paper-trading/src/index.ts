// Main paper trading exports
export {
  PaperTradingEngine,
  type PaperTradingConfig,
  type PaperTrade,
  type PaperPortfolio,
} from "./paper-trading-engine";

// Import types for utility functions
import type {
  PaperTradingConfig,
  PaperTrade,
  PaperPortfolio,
} from "./paper-trading-engine";

// Utility functions and helpers
export const createDefaultPaperTradingConfig = (): PaperTradingConfig => ({
  initialBalance: {
    USDC: "10000",
    ETH: "5",
    WBTC: "0.1",
    SOL: "100",
  },
  slippageSimulation: {
    enabled: true,
    minSlippage: 0.01, // 0.01% minimum slippage
    maxSlippage: 0.5, // 0.5% maximum slippage
    volatilityFactor: 0.1, // Low volatility impact
    marketImpactFactor: 0.05, // Low market impact
    liquidityThreshold: 0.8, // High liquidity threshold
  },
  latencySimulation: {
    enabled: true,
    minLatency: 100, // 100ms minimum
    maxLatency: 2000, // 2 second maximum
    networkVariability: 0.3, // Low network variability
  },
  failureSimulation: {
    enabled: true,
    failureRate: 2, // 2% failure rate
    failureTypes: [
      "Network congestion",
      "Gas price too low",
      "Slippage exceeded",
      "Pool liquidity insufficient",
    ],
    timeBasedFailures: false,
    liquidityBasedFailures: false,
  },
  marketDataSimulation: {
    enabled: true,
    priceVolatility: 0.02, // 2% price volatility
    spreadSimulation: true,
    spreadRange: { min: 0.01, max: 0.1 }, // 0.01% to 0.1% spread
    correlationEnabled: false,
    marketRegimeDetection: false,
    orderBookDepthSimulation: false,
    realTimeDataFeed: false,
  },
  riskManagement: {
    enabled: false, // Disabled for default config
    maxPositionSize: 10,
    maxDailyLoss: 1000,
    maxDrawdown: 20,
    concentrationLimit: 30,
    correlationLimit: 0.8,
  },
  advancedAnalytics: {
    enabled: false, // Disabled for default config
    calculateSharpeRatio: false,
    calculateMaxDrawdown: false,
    calculateVaR: false,
    calculateBeta: false,
    riskAttributionAnalysis: false,
    performanceAttribution: false,
  },
});

export const createRealisticPaperTradingConfig = (): PaperTradingConfig => ({
  initialBalance: {
    USDC: "50000",
    ETH: "20",
    WBTC: "0.5",
    SOL: "500",
    BNB: "100",
  },
  slippageSimulation: {
    enabled: true,
    minSlippage: 0.05, // Higher realistic slippage
    maxSlippage: 2.0, // Up to 2% slippage
    volatilityFactor: 0.3, // Higher volatility impact
    marketImpactFactor: 0.15, // Moderate market impact
    liquidityThreshold: 0.6, // Moderate liquidity threshold
  },
  latencySimulation: {
    enabled: true,
    minLatency: 200, // 200ms minimum
    maxLatency: 5000, // 5 second maximum
    networkVariability: 0.5, // Moderate network variability
  },
  failureSimulation: {
    enabled: true,
    failureRate: 5, // 5% failure rate
    failureTypes: [
      "Network congestion",
      "Gas price too low",
      "Slippage exceeded",
      "Pool liquidity insufficient",
      "Transaction reverted",
      "MEV frontrun",
      "RPC timeout",
      "Node synchronization issue",
    ],
    timeBasedFailures: true,
    liquidityBasedFailures: true,
  },
  marketDataSimulation: {
    enabled: true,
    priceVolatility: 0.05, // 5% price volatility
    spreadSimulation: true,
    spreadRange: { min: 0.05, max: 0.3 }, // 0.05% to 0.3% spread
    correlationEnabled: true,
    marketRegimeDetection: true,
    orderBookDepthSimulation: true,
    realTimeDataFeed: false,
  },
  riskManagement: {
    enabled: true, // Enabled for realistic config
    maxPositionSize: 15,
    maxDailyLoss: 2500,
    maxDrawdown: 15,
    concentrationLimit: 25,
    correlationLimit: 0.7,
  },
  advancedAnalytics: {
    enabled: true, // Enabled for realistic config
    calculateSharpeRatio: true,
    calculateMaxDrawdown: true,
    calculateVaR: true,
    calculateBeta: true,
    riskAttributionAnalysis: true,
    performanceAttribution: true,
  },
});

export const createStressTestPaperTradingConfig = (): PaperTradingConfig => ({
  initialBalance: {
    USDC: "100000",
    ETH: "50",
    WBTC: "1",
    SOL: "1000",
    BNB: "200",
  },
  slippageSimulation: {
    enabled: true,
    minSlippage: 0.1, // High stress slippage
    maxSlippage: 5.0, // Up to 5% slippage
    volatilityFactor: 0.5, // High volatility impact
    marketImpactFactor: 0.3, // High market impact
    liquidityThreshold: 0.3, // Low liquidity threshold (stress)
  },
  latencySimulation: {
    enabled: true,
    minLatency: 500, // 500ms minimum
    maxLatency: 10000, // 10 second maximum
    networkVariability: 1.0, // High network variability (stress)
  },
  failureSimulation: {
    enabled: true,
    failureRate: 15, // 15% failure rate (stress test)
    failureTypes: [
      "Network congestion",
      "Gas price too low",
      "Slippage exceeded",
      "Pool liquidity insufficient",
      "Transaction reverted",
      "MEV frontrun",
      "RPC timeout",
      "Node synchronization issue",
      "Chain congestion",
      "Mempool full",
      "Validator offline",
      "Bridge failure",
    ],
    timeBasedFailures: true,
    liquidityBasedFailures: true,
  },
  marketDataSimulation: {
    enabled: true,
    priceVolatility: 0.1, // 10% price volatility (high stress)
    spreadSimulation: true,
    spreadRange: { min: 0.1, max: 1.0 }, // 0.1% to 1% spread (stress)
    correlationEnabled: true,
    marketRegimeDetection: true,
    orderBookDepthSimulation: true,
    realTimeDataFeed: true,
  },
  riskManagement: {
    enabled: true, // Enabled for stress test
    maxPositionSize: 20,
    maxDailyLoss: 5000,
    maxDrawdown: 30,
    concentrationLimit: 40,
    correlationLimit: 0.9,
  },
  advancedAnalytics: {
    enabled: true, // Enabled for stress test
    calculateSharpeRatio: true,
    calculateMaxDrawdown: true,
    calculateVaR: true,
    calculateBeta: true,
    riskAttributionAnalysis: true,
    performanceAttribution: true,
  },
});

// Portfolio analysis helpers
export const calculatePortfolioMetrics = (
  portfolio: PaperPortfolio,
): {
  totalValueUSD: number;
  profitLossRatio: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgTradeSize: number;
} => {
  const totalValue = parseFloat(portfolio.totalValueUSD);
  const profitLossRatio = portfolio.performance.profitFactor;
  const winRate = portfolio.performance.winRate;
  const avgTradeSize = parseFloat(portfolio.performance.averageTradeSize);

  // Simplified Sharpe ratio calculation
  const returns = calculateTradeReturns(portfolio.trades);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const returnVariance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
    returns.length;
  const sharpeRatio =
    returnVariance > 0 ? avgReturn / Math.sqrt(returnVariance) : 0;

  // Calculate maximum drawdown
  const maxDrawdown = calculateMaxDrawdown(portfolio.trades);

  return {
    totalValueUSD: totalValue,
    profitLossRatio,
    sharpeRatio: Number(sharpeRatio.toFixed(4)),
    maxDrawdown: Number(maxDrawdown.toFixed(4)),
    winRate,
    avgTradeSize,
  };
};

export const calculateTradeReturns = (trades: PaperTrade[]): number[] => {
  return trades
    .filter((trade) => trade.status === "completed")
    .map((trade) => {
      const amountIn = parseFloat(trade.amountIn);
      const amountOut = parseFloat(trade.amountOut);
      return amountIn > 0 ? (amountOut - amountIn) / amountIn : 0;
    });
};

export const calculateMaxDrawdown = (trades: PaperTrade[]): number => {
  const completedTrades = trades.filter(
    (trade) => trade.status === "completed",
  );
  if (completedTrades.length === 0) return 0;

  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;

  for (const trade of completedTrades) {
    const profit = parseFloat(trade.amountOut) - parseFloat(trade.amountIn);
    cumulative += profit;
    peak = Math.max(peak, cumulative);
    const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return maxDrawdown;
};

// Trading simulation helpers
export const simulateMarketImpact = (
  amountUSD: number,
  volatility: number = 0.02,
): { priceImpact: number; adjustedPrice: number } => {
  // Simplified market impact model
  const baseImpact = Math.sqrt(amountUSD / 100000) * 0.001; // Square root impact
  const volatilityAdjustment = volatility * 0.5;
  const priceImpact = baseImpact + volatilityAdjustment;

  return {
    priceImpact: Number(priceImpact.toFixed(6)),
    adjustedPrice: 1 - priceImpact,
  };
};

export const calculateOptimalOrderSize = (
  portfolioValue: number,
  riskTolerance: number = 0.02,
): number => {
  // Kelly Criterion simplified for paper trading
  const optimalSize = portfolioValue * riskTolerance;
  return Math.max(100, Math.min(optimalSize, portfolioValue * 0.1)); // Between $100 and 10% of portfolio
};

// Performance analysis utilities
export const generateTradingReport = (
  portfolio: PaperPortfolio,
): {
  summary: string;
  recommendations: string[];
  riskAssessment: "low" | "medium" | "high";
} => {
  const metrics = calculatePortfolioMetrics(portfolio);
  const performance = portfolio.performance;

  let riskAssessment: "low" | "medium" | "high" = "medium";
  if (metrics.maxDrawdown > 0.2) riskAssessment = "high";
  else if (metrics.maxDrawdown < 0.1 && metrics.sharpeRatio > 1)
    riskAssessment = "low";

  const recommendations: string[] = [];
  if (performance.winRate < 50) {
    recommendations.push("Consider improving trade selection criteria");
  }
  if (metrics.sharpeRatio < 0.5) {
    recommendations.push("Focus on risk-adjusted returns");
  }
  if (metrics.maxDrawdown > 0.15) {
    recommendations.push("Implement better risk management");
  }
  if (performance.totalTrades < 10) {
    recommendations.push("Increase sample size for better statistics");
  }

  const summary = `
Portfolio Performance Summary:
- Total Value: $${metrics.totalValueUSD.toFixed(2)}
- Win Rate: ${metrics.winRate.toFixed(1)}%
- Profit Factor: ${metrics.profitLossRatio.toFixed(2)}
- Sharpe Ratio: ${metrics.sharpeRatio}
- Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(1)}%
- Total Trades: ${performance.totalTrades}
- Success Rate: ${performance.successRate.toFixed(1)}%
  `.trim();

  return {
    summary,
    recommendations,
    riskAssessment,
  };
};

// Risk level classification
export const classifyTradingRisk = (
  winRate: number,
  maxDrawdown: number,
  profitFactor: number,
): "conservative" | "moderate" | "aggressive" | "speculative" => {
  if (winRate >= 60 && maxDrawdown <= 0.1 && profitFactor >= 1.5)
    return "conservative";
  if (winRate >= 50 && maxDrawdown <= 0.2 && profitFactor >= 1.2)
    return "moderate";
  if (winRate >= 40 && maxDrawdown <= 0.3 && profitFactor >= 1.0)
    return "aggressive";
  return "speculative";
};

// Validation helpers
export const validatePaperTradingConfig = (
  config: PaperTradingConfig,
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Validate initial balance
  if (
    !config.initialBalance ||
    Object.keys(config.initialBalance).length === 0
  ) {
    errors.push("Initial balance must contain at least one token");
  }

  // Validate slippage simulation
  if (config.slippageSimulation.enabled) {
    if (
      config.slippageSimulation.minSlippage < 0 ||
      config.slippageSimulation.minSlippage > 10
    ) {
      errors.push("Min slippage must be between 0% and 10%");
    }
    if (
      config.slippageSimulation.maxSlippage <
      config.slippageSimulation.minSlippage
    ) {
      errors.push("Max slippage must be greater than min slippage");
    }
  }

  // Validate latency simulation
  if (config.latencySimulation.enabled) {
    if (
      config.latencySimulation.minLatency < 0 ||
      config.latencySimulation.minLatency > 60000
    ) {
      errors.push("Min latency must be between 0ms and 60000ms");
    }
    if (
      config.latencySimulation.maxLatency < config.latencySimulation.minLatency
    ) {
      errors.push("Max latency must be greater than min latency");
    }
  }

  // Validate failure simulation
  if (config.failureSimulation.enabled) {
    if (
      config.failureSimulation.failureRate < 0 ||
      config.failureSimulation.failureRate > 100
    ) {
      errors.push("Failure rate must be between 0% and 100%");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Version export
export const VERSION = "2.0.0";
