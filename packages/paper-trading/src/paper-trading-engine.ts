import { EventEmitter } from "events";
import { z } from "zod";

export interface PaperTradingConfig {
  initialBalance: { [token: string]: string }; // Token balances
  slippageSimulation: {
    enabled: boolean;
    minSlippage: number; // Minimum slippage percentage
    maxSlippage: number; // Maximum slippage percentage
    volatilityFactor: number; // How much market volatility affects slippage
    marketImpactFactor: number; // How trade size affects slippage
    liquidityThreshold: number; // Liquidity threshold for impact calculation
  };
  latencySimulation: {
    enabled: boolean;
    minLatency: number; // Minimum execution delay in ms
    maxLatency: number; // Maximum execution delay in ms
    networkVariability: number; // Network condition variability factor
  };
  failureSimulation: {
    enabled: boolean;
    failureRate: number; // Percentage of trades that fail
    failureTypes: string[]; // Types of failures to simulate
    timeBasedFailures: boolean; // Enable time-based failure patterns
    liquidityBasedFailures: boolean; // Enable liquidity-based failures
  };
  marketDataSimulation: {
    enabled: boolean;
    priceVolatility: number; // How much prices fluctuate
    spreadSimulation: boolean; // Simulate bid-ask spreads
    spreadRange: { min: number; max: number }; // Bid-ask spread range
    correlationEnabled: boolean; // Enable asset correlation
    marketRegimeDetection: boolean; // Enable market regime changes
    orderBookDepthSimulation: boolean; // Simulate order book depth
    realTimeDataFeed: boolean; // Use real-time price feeds if available
  };
  riskManagement: {
    enabled: boolean;
    maxPositionSize: number; // Maximum position size as % of portfolio
    maxDailyLoss: number; // Maximum daily loss limit
    maxDrawdown: number; // Maximum drawdown limit
    concentrationLimit: number; // Maximum concentration in single asset
    correlationLimit: number; // Maximum correlation between positions
  };
  advancedAnalytics: {
    enabled: boolean;
    calculateSharpeRatio: boolean;
    calculateMaxDrawdown: boolean;
    calculateVaR: boolean; // Value at Risk calculation
    calculateBeta: boolean; // Beta calculation against market
    riskAttributionAnalysis: boolean; // Risk attribution by position
    performanceAttribution: boolean; // Performance attribution analysis
  };
}

export interface MarketRegime {
  current: "bull" | "bear" | "sideways" | "volatile";
  confidence: number; // 0-1 confidence in regime classification
  duration: number; // Days in current regime
  volatilityLevel: "low" | "medium" | "high" | "extreme";
}

export interface OrderBookData {
  symbol: string;
  depth: number; // Available liquidity depth
  spread: number; // Current bid-ask spread
  midPrice: number; // Mid-market price
  liquidityScore: number; // 0-1 liquidity assessment
}

export interface RiskMetrics {
  portfolioValue: number;
  dailyPnL: number;
  unrealizedPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  valueAtRisk: number; // 95% VaR
  beta: number; // Portfolio beta
  correlationRisk: number;
  concentrationRisk: number;
}

export interface PaperTrade {
  id: string;
  type: "buy" | "sell" | "swap";
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  expectedAmountOut: string;
  slippage: number;
  marketImpact: number; // Market impact from trade size
  gasEstimate: string;
  gasUsed: string;
  gasPriceGwei: number; // Gas price in Gwei
  status: "pending" | "completed" | "failed" | "cancelled";
  failureReason?: string;
  timestamp: number;
  executionTime?: number;
  txHash: string; // Simulated transaction hash
  marketRegime: string; // Market regime at time of trade
  spread: number; // Bid-ask spread at execution
  liquidityScore: number; // Liquidity available at execution
  priceImpact: number; // Price impact from the trade
  riskScore: number; // Risk assessment score
  confidence: number; // Execution confidence score
  metadata?: Record<string, any>; // Additional trade metadata
}

export interface PaperPortfolio {
  balances: Record<string, string>;
  totalValueUSD: string;
  pnl: {
    realized: string;
    unrealized: string;
    total: string;
    dailyPnL: string;
    weeklyPnL: string;
    monthlyPnL: string;
  };
  trades: PaperTrade[];
  riskMetrics: RiskMetrics;
  performance: {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    cancelledTrades: number;
    successRate: number;
    totalProfit: string;
    totalLoss: string;
    netProfit: string;
    averageTradeSize: string;
    medianTradeSize: string;
    largestWin: string;
    largestLoss: string;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    maxDrawdownPeriod: number; // Days in max drawdown
    averageWin: number;
    averageLoss: number;
    averageHoldingTime: number; // Average holding time in minutes
    consecutiveWins: number;
    consecutiveLosses: number;
    recoveryTime: number; // Time to recover from drawdown
    volatility: number; // Portfolio volatility
    beta: number; // Portfolio beta
    alpha: number; // Portfolio alpha
    informationRatio: number;
    trackingError: number;
  };
  attribution: {
    byAsset: Record<
      string,
      { pnl: number; contribution: number; weight: number }
    >;
    bySector: Record<
      string,
      { pnl: number; contribution: number; exposure: number }
    >;
    byTimeframe: Record<
      string,
      { pnl: number; trades: number; winRate: number }
    >;
  };
  exposure: {
    totalExposure: number;
    netExposure: number;
    grossExposure: number;
    leverage: number;
    concentrationRisk: number;
    correlationRisk: number;
  };
}

// Configuration validation schema
const PaperTradingConfigSchema = z.object({
  initialBalance: z.record(z.string().min(1)),
  slippageSimulation: z.object({
    enabled: z.boolean(),
    minSlippage: z.number().min(0).max(50),
    maxSlippage: z.number().min(0).max(50),
    volatilityFactor: z.number().min(0).max(5),
    marketImpactFactor: z.number().min(0).max(2),
    liquidityThreshold: z.number().min(0).max(1),
  }),
  latencySimulation: z.object({
    enabled: z.boolean(),
    minLatency: z.number().min(0).max(60000),
    maxLatency: z.number().min(0).max(60000),
    networkVariability: z.number().min(0).max(5),
  }),
  failureSimulation: z.object({
    enabled: z.boolean(),
    failureRate: z.number().min(0).max(100),
    failureTypes: z.array(z.string()),
    timeBasedFailures: z.boolean(),
    liquidityBasedFailures: z.boolean(),
  }),
  marketDataSimulation: z.object({
    enabled: z.boolean(),
    priceVolatility: z.number().min(0).max(1),
    spreadSimulation: z.boolean(),
    spreadRange: z.object({
      min: z.number().min(0),
      max: z.number().min(0),
    }),
    correlationEnabled: z.boolean(),
    marketRegimeDetection: z.boolean(),
    orderBookDepthSimulation: z.boolean(),
    realTimeDataFeed: z.boolean(),
  }),
  riskManagement: z.object({
    enabled: z.boolean(),
    maxPositionSize: z.number().min(0).max(100),
    maxDailyLoss: z.number().min(0),
    maxDrawdown: z.number().min(0).max(100),
    concentrationLimit: z.number().min(0).max(100),
    correlationLimit: z.number().min(0).max(1),
  }),
  advancedAnalytics: z.object({
    enabled: z.boolean(),
    calculateSharpeRatio: z.boolean(),
    calculateMaxDrawdown: z.boolean(),
    calculateVaR: z.boolean(),
    calculateBeta: z.boolean(),
    riskAttributionAnalysis: z.boolean(),
    performanceAttribution: z.boolean(),
  }),
});

export class PaperTradingEngine extends EventEmitter {
  private config: PaperTradingConfig;
  private portfolio: PaperPortfolio;
  private marketPrices: { [token: string]: number } = {};
  private marketRegime: MarketRegime;
  private isRunning = false;
  private dailyResetTimer?: NodeJS.Timeout;
  private performanceUpdateTimer?: NodeJS.Timeout;

  constructor(config: PaperTradingConfig) {
    super();
    this.validateConfig(config);
    this.config = config;
    this.portfolio = this.initializePortfolio();
    this.marketRegime = this.initializeMarketRegime();
    this.startPriceSimulation();
    this.startRiskMonitoring();
  }

  /**
   * Validate configuration using Zod schema
   */
  private validateConfig(config: PaperTradingConfig): void {
    try {
      PaperTradingConfigSchema.parse(config);
    } catch (error) {
      throw new Error(
        `Invalid configuration: ${error instanceof Error ? error.message : "Unknown validation error"}`,
      );
    }
  }

  /**
   * Initialize portfolio with comprehensive structure
   */
  private initializePortfolio(): PaperPortfolio {
    const initialRiskMetrics: RiskMetrics = {
      portfolioValue: 0,
      dailyPnL: 0,
      unrealizedPnL: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      volatility: 0,
      valueAtRisk: 0,
      beta: 0,
      correlationRisk: 0,
      concentrationRisk: 0,
    };

    return {
      balances: { ...this.config.initialBalance },
      totalValueUSD: "0",
      pnl: {
        realized: "0",
        unrealized: "0",
        total: "0",
        dailyPnL: "0",
        weeklyPnL: "0",
        monthlyPnL: "0",
      },
      trades: [],
      riskMetrics: initialRiskMetrics,
      performance: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        cancelledTrades: 0,
        successRate: 0,
        totalProfit: "0",
        totalLoss: "0",
        netProfit: "0",
        averageTradeSize: "0",
        medianTradeSize: "0",
        largestWin: "0",
        largestLoss: "0",
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        calmarRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPeriod: 0,
        averageWin: 0,
        averageLoss: 0,
        averageHoldingTime: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        recoveryTime: 0,
        volatility: 0,
        beta: 0,
        alpha: 0,
        informationRatio: 0,
        trackingError: 0,
      },
      attribution: {
        byAsset: {},
        bySector: {},
        byTimeframe: {},
      },
      exposure: {
        totalExposure: 0,
        netExposure: 0,
        grossExposure: 0,
        leverage: 0,
        concentrationRisk: 0,
        correlationRisk: 0,
      },
    };
  }

  /**
   * Initialize market regime detection
   */
  private initializeMarketRegime(): MarketRegime {
    return {
      current: "sideways",
      confidence: 0.5,
      duration: 0,
      volatilityLevel: "medium",
    };
  }

  private startPriceSimulation(): void {
    if (!this.config.marketDataSimulation.enabled) return;

    // Initialize some basic token prices
    this.marketPrices = {
      ETH: 2000,
      USDC: 1,
      USDT: 1,
      WBTC: 35000,
      SOL: 100,
      BNB: 300,
    };

    // Simulate price movements
    setInterval(() => {
      this.updateMarketPrices();
    }, 5000); // Update every 5 seconds
  }

  private updateMarketPrices(): void {
    const volatility = this.config.marketDataSimulation.priceVolatility;

    Object.keys(this.marketPrices).forEach((token) => {
      if (token === "USDC" || token === "USDT") return; // Stablecoins don't move much

      const currentPrice = this.marketPrices[token];
      if (currentPrice !== undefined) {
        const change = (Math.random() - 0.5) * 2 * volatility; // -volatility to +volatility
        const newPrice = currentPrice * (1 + change / 100);
        this.marketPrices[token] = Math.max(newPrice, 0.01); // Prevent negative prices
      }
    });

    this.updatePortfolioValue();
    this.emit("priceUpdate", this.marketPrices);
  }

  private updatePortfolioValue(): void {
    let totalValueUSD = 0;

    Object.entries(this.portfolio.balances).forEach(([token, balance]) => {
      const price = this.marketPrices[token] || 0;
      const value = parseFloat(balance) * price;
      totalValueUSD += value;
    });

    this.portfolio.totalValueUSD = totalValueUSD.toFixed(6);
  }

  async executeTrade(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string,
    maxSlippage: number = 0.5,
  ): Promise<PaperTrade> {
    const tradeId = `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create initial trade record with comprehensive data
    const currentSpread = this.calculateCurrentSpread(tokenIn, tokenOut);
    const liquidityScore = this.calculateLiquidityScore(tokenIn, tokenOut);
    const riskScore = this.calculateRiskScore(tokenIn, tokenOut, amountIn);

    const trade: PaperTrade = {
      id: tradeId,
      type: "swap",
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: "0",
      expectedAmountOut: minAmountOut,
      slippage: 0,
      marketImpact: 0,
      gasEstimate: this.estimateGas(),
      gasUsed: "0",
      gasPriceGwei: this.getCurrentGasPrice(),
      status: "pending",
      timestamp: Date.now(),
      txHash: this.generateTxHash(),
      marketRegime: this.marketRegime.current,
      spread: currentSpread,
      liquidityScore: liquidityScore,
      priceImpact: 0,
      riskScore: riskScore,
      confidence: this.calculateTradeConfidence(liquidityScore, riskScore),
      metadata: {
        portfolioValue: this.portfolio.totalValueUSD,
        volatilityLevel: this.marketRegime.volatilityLevel,
        regimeConfidence: this.marketRegime.confidence,
      },
    };

    this.portfolio.trades.push(trade);
    this.emit("tradeCreated", trade);

    // Simulate execution delay
    if (this.config.latencySimulation.enabled) {
      const delay = this.simulateLatency();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Check if trade should fail
    if (this.shouldTradeFail()) {
      return this.failTrade(trade);
    }

    // Check if we have sufficient balance
    const balanceIn = parseFloat(this.portfolio.balances[tokenIn] || "0");
    const requiredAmount = parseFloat(amountIn);

    if (balanceIn < requiredAmount) {
      return this.failTrade(trade, "Insufficient balance");
    }

    // Calculate actual amount out with slippage
    const { amountOut, actualSlippage } = this.calculateAmountOut(
      tokenIn,
      tokenOut,
      amountIn,
      maxSlippage,
    );

    // Check if slippage is acceptable
    if (parseFloat(amountOut) < parseFloat(minAmountOut)) {
      return this.failTrade(trade, "Slippage too high");
    }

    // Execute the trade
    trade.amountOut = amountOut;
    trade.slippage = actualSlippage;
    trade.gasUsed = this.simulateGasUsage(trade.gasEstimate);
    trade.status = "completed";
    trade.executionTime = Date.now();

    // Update balances
    this.updateBalance(tokenIn, `-${amountIn}`);
    this.updateBalance(tokenOut, `+${amountOut}`);

    // Update performance metrics
    this.updatePerformanceMetrics(trade);

    this.emit("tradeCompleted", trade);
    return trade;
  }

  private shouldTradeFail(): boolean {
    if (!this.config.failureSimulation.enabled) return false;
    return Math.random() * 100 < this.config.failureSimulation.failureRate;
  }

  private failTrade(trade: PaperTrade, reason?: string): PaperTrade {
    trade.status = "failed";
    trade.failureReason = reason || this.getRandomFailureReason();
    trade.executionTime = Date.now();

    this.portfolio.performance.failedTrades++;
    this.portfolio.performance.totalTrades++;
    this.updateSuccessRate();

    this.emit("tradeFailed", trade);
    return trade;
  }

  private getRandomFailureReason(): string {
    const reasons =
      this.config.failureSimulation.failureTypes.length > 0
        ? this.config.failureSimulation.failureTypes
        : [
            "Network congestion",
            "Gas price too low",
            "Slippage exceeded",
            "Pool liquidity insufficient",
            "Transaction reverted",
            "MEV frontrun",
          ];

    return reasons[Math.floor(Math.random() * reasons.length)]!;
  }

  private simulateLatency(): number {
    const { minLatency, maxLatency } = this.config.latencySimulation;
    return minLatency + Math.random() * (maxLatency - minLatency);
  }

  private calculateAmountOut(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    maxSlippage: number,
  ): { amountOut: string; actualSlippage: number } {
    const priceIn = this.marketPrices[tokenIn] || 1;
    const priceOut = this.marketPrices[tokenOut] || 1;

    // Basic exchange rate
    const baseAmountOut = (parseFloat(amountIn) * priceIn) / priceOut;

    // Simulate slippage
    let actualSlippage = 0;
    if (this.config.slippageSimulation.enabled) {
      const {
        minSlippage,
        maxSlippage: maxSlippageConfig,
        volatilityFactor,
      } = this.config.slippageSimulation;
      const marketVolatility = this.calculateMarketVolatility(tokenOut);
      const volatilityAdjustment = marketVolatility * volatilityFactor;

      actualSlippage =
        minSlippage +
        Math.random() *
          (Math.min(maxSlippageConfig, maxSlippage) - minSlippage) +
        volatilityAdjustment;
    }

    const amountOut = baseAmountOut * (1 - actualSlippage / 100);

    return {
      amountOut: amountOut.toFixed(6),
      actualSlippage: parseFloat(actualSlippage.toFixed(4)),
    };
  }

  private calculateMarketVolatility(token: string): number {
    // Simple volatility calculation based on recent price movements
    // In a real implementation, this would use historical data
    const baseVolatility: { [key: string]: number } = {
      ETH: 0.02,
      WBTC: 0.015,
      SOL: 0.03,
      BNB: 0.025,
      USDC: 0.001,
      USDT: 0.001,
    };

    return baseVolatility[token] || 0.02;
  }

  private estimateGas(): string {
    // Simulate gas estimation
    const baseGas = 150000;
    const variation = baseGas * 0.2; // ±20% variation
    const gas = baseGas + (Math.random() - 0.5) * variation;
    return Math.round(gas).toString();
  }

  private simulateGasUsage(estimate: string): string {
    // Actual gas usage is usually slightly different from estimate
    const estimated = parseFloat(estimate);
    const variation = estimated * 0.1; // ±10% variation
    const actual = estimated + (Math.random() - 0.5) * variation;
    return Math.round(actual).toString();
  }

  private generateTxHash(): string {
    return (
      "0x" +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join("")
    );
  }

  private updateBalance(token: string, change: string): void {
    const currentBalanceStr = this.portfolio.balances[token];
    const currentBalance = parseFloat(currentBalanceStr ?? "0");
    const changeAmount = parseFloat(change.replace("+", ""));
    const newBalance = currentBalance + changeAmount;

    this.portfolio.balances[token] = Math.max(0, newBalance).toFixed(6);
  }

  private updatePerformanceMetrics(trade: PaperTrade): void {
    const perf = this.portfolio.performance;

    perf.totalTrades++;
    if (trade.status === "completed") {
      perf.successfulTrades++;
    }

    this.updateSuccessRate();

    // Calculate profit/loss for this trade
    const profit = this.calculateTradeProfit(trade);
    if (profit > 0) {
      perf.totalProfit = (parseFloat(perf.totalProfit) + profit).toFixed(6);
      if (profit > parseFloat(perf.largestWin)) {
        perf.largestWin = profit.toFixed(6);
      }
    } else {
      perf.totalLoss = (parseFloat(perf.totalLoss) + Math.abs(profit)).toFixed(
        6,
      );
      if (Math.abs(profit) > parseFloat(perf.largestLoss)) {
        perf.largestLoss = Math.abs(profit).toFixed(6);
      }
    }

    perf.netProfit = (
      parseFloat(perf.totalProfit) - parseFloat(perf.totalLoss)
    ).toFixed(6);

    // Update other metrics
    const completedTrades = this.portfolio.trades.filter(
      (t) => t.status === "completed",
    );
    const totalVolume = completedTrades.reduce(
      (sum, t) => sum + parseFloat(t.amountIn),
      0,
    );
    perf.averageTradeSize =
      completedTrades.length > 0
        ? (totalVolume / completedTrades.length).toFixed(6)
        : "0";

    const wins = completedTrades.filter(
      (t) => this.calculateTradeProfit(t) > 0,
    ).length;
    perf.winRate =
      completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;

    const totalWins = parseFloat(perf.totalProfit);
    const totalLosses = parseFloat(perf.totalLoss);
    perf.profitFactor =
      totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  }

  private updateSuccessRate(): void {
    const perf = this.portfolio.performance;
    perf.successRate =
      perf.totalTrades > 0
        ? (perf.successfulTrades / perf.totalTrades) * 100
        : 0;
  }

  private calculateTradeProfit(trade: PaperTrade): number {
    if (trade.status !== "completed") return 0;

    const priceIn = this.marketPrices[trade.tokenIn] || 1;
    const priceOut = this.marketPrices[trade.tokenOut] || 1;

    const valueIn = parseFloat(trade.amountIn) * priceIn;
    const valueOut = parseFloat(trade.amountOut) * priceOut;
    const gasCost = parseFloat(trade.gasUsed) * 20e-9 * 2000; // Assume 20 gwei gas price, ETH at $2000

    return valueOut - valueIn - gasCost;
  }

  // Public methods
  getPortfolio(): PaperPortfolio {
    this.updatePortfolioValue();
    return { ...this.portfolio };
  }

  getBalance(token: string): string {
    const balance = this.portfolio.balances[token];
    return (balance ?? "0") as string;
  }

  getMarketPrice(token: string): number {
    return this.marketPrices[token] || 0;
  }

  getAllPrices(): { [token: string]: number } {
    return { ...this.marketPrices };
  }

  setMarketPrice(token: string, price: number): void {
    this.marketPrices[token] = price;
    this.updatePortfolioValue();
    this.emit("priceUpdate", this.marketPrices);
  }

  addBalance(token: string, amount: string): void {
    this.updateBalance(token, `+${amount}`);
  }

  reset(): void {
    this.portfolio = this.initializePortfolio();
    this.emit("portfolioReset");
  }

  start(): void {
    this.isRunning = true;
    this.emit("started");
  }

  stop(): void {
    this.isRunning = false;
    this.emit("stopped");
  }

  isActive(): boolean {
    return this.isRunning;
  }

  // Enhanced methods for 100% perfection

  /**
   * Start comprehensive risk monitoring
   */
  private startRiskMonitoring(): void {
    if (!this.config.riskManagement.enabled) return;

    // Monitor portfolio risk every minute
    this.performanceUpdateTimer = setInterval(() => {
      this.updateRiskMetrics();
      this.checkRiskLimits();
    }, 60000);

    // Daily reset for daily metrics
    this.dailyResetTimer = setInterval(
      () => {
        this.resetDailyMetrics();
      },
      24 * 60 * 60 * 1000,
    );
  }

  /**
   * Calculate current bid-ask spread
   */
  private calculateCurrentSpread(tokenIn: string, tokenOut: string): number {
    if (!this.config.marketDataSimulation.spreadSimulation) return 0;

    const { min, max } = this.config.marketDataSimulation.spreadRange;
    const baseSpread = min + Math.random() * (max - min);

    // Adjust spread based on volatility and liquidity
    const volatility = this.calculateMarketVolatility(tokenIn);
    const liquidityAdjustment =
      1 + (1 - this.calculateLiquidityScore(tokenIn, tokenOut)) * 0.5;

    return baseSpread * (1 + volatility * 10) * liquidityAdjustment;
  }

  /**
   * Calculate liquidity score for token pair
   */
  private calculateLiquidityScore(tokenIn: string, tokenOut: string): number {
    const majorTokens = ["ETH", "USDC", "USDT", "WBTC"];
    const isMajorPair =
      majorTokens.includes(tokenIn) && majorTokens.includes(tokenOut);

    let score = isMajorPair ? 0.9 : 0.6;

    // Adjust based on market regime
    if (this.marketRegime.current === "volatile") score *= 0.7;
    if (this.marketRegime.current === "bear") score *= 0.8;

    return Math.max(0.1, Math.min(1.0, score + (Math.random() - 0.5) * 0.2));
  }

  /**
   * Calculate risk score for trade
   */
  private calculateRiskScore(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
  ): number {
    const portfolioValue = parseFloat(this.portfolio.totalValueUSD) || 100000;
    const tradeSize = parseFloat(amountIn);
    const sizeRatio = tradeSize / portfolioValue;

    let risk = sizeRatio * 100; // Base risk from size

    // Add volatility risk
    const volatility = this.calculateMarketVolatility(tokenOut);
    risk += volatility * 50;

    // Add liquidity risk
    const liquidityScore = this.calculateLiquidityScore(tokenIn, tokenOut);
    risk += (1 - liquidityScore) * 30;

    // Add regime risk
    const regimeRisk =
      this.marketRegime.current === "volatile"
        ? 20
        : this.marketRegime.current === "bear"
          ? 15
          : 5;
    risk += regimeRisk;

    return Math.max(0, Math.min(100, risk));
  }

  /**
   * Get current gas price in Gwei
   */
  private getCurrentGasPrice(): number {
    const baseGasPrice = 20; // 20 Gwei base
    const variation = baseGasPrice * 0.5; // ±50% variation

    // Adjust based on network congestion simulation
    const congestionMultiplier =
      this.marketRegime.current === "volatile" ? 2.0 : 1.0;

    return Math.max(
      1,
      Math.round(
        (baseGasPrice + (Math.random() - 0.5) * variation) *
          congestionMultiplier,
      ),
    );
  }

  /**
   * Calculate trade confidence score
   */
  private calculateTradeConfidence(
    liquidityScore: number,
    riskScore: number,
  ): number {
    let confidence = liquidityScore * 0.4; // 40% from liquidity
    confidence += ((100 - riskScore) / 100) * 0.3; // 30% from low risk
    confidence += this.marketRegime.confidence * 0.3; // 30% from regime confidence

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Update comprehensive risk metrics
   */
  private updateRiskMetrics(): void {
    if (!this.config.advancedAnalytics.enabled) return;

    const portfolioValue = parseFloat(this.portfolio.totalValueUSD);
    const trades = this.portfolio.trades.filter(
      (t) => t.status === "completed",
    );

    if (trades.length < 2) return;

    // Calculate returns
    const returns = trades
      .map((trade, index) => {
        if (index === 0) return 0;
        const prevValue = parseFloat(trades[index - 1]?.amountOut || "0");
        const currentValue = parseFloat(trade.amountOut);
        return prevValue > 0 ? (currentValue - prevValue) / prevValue : 0;
      })
      .filter((r) => !isNaN(r));

    if (returns.length < 2) return;

    // Calculate metrics
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      returns.length;
    const volatility = Math.sqrt(variance);

    // Update risk metrics
    this.portfolio.riskMetrics = {
      portfolioValue,
      dailyPnL: this.calculateDailyPnL(),
      unrealizedPnL: this.calculateUnrealizedPnL(),
      maxDrawdown: this.calculateMaxDrawdown(),
      sharpeRatio: volatility > 0 ? avgReturn / volatility : 0,
      volatility,
      valueAtRisk: this.calculateVaR(returns),
      beta: this.calculateBeta(returns),
      correlationRisk: this.calculateCorrelationRisk(),
      concentrationRisk: this.calculateConcentrationRisk(),
    };
  }

  /**
   * Check risk limits and trigger alerts
   */
  private checkRiskLimits(): void {
    if (!this.config.riskManagement.enabled) return;

    const metrics = this.portfolio.riskMetrics;
    const config = this.config.riskManagement;

    // Check daily loss limit
    if (Math.abs(metrics.dailyPnL) > config.maxDailyLoss) {
      this.emit("riskAlert", {
        type: "dailyLoss",
        severity: "high",
        value: metrics.dailyPnL,
        limit: config.maxDailyLoss,
      });
    }

    // Check drawdown limit
    if (metrics.maxDrawdown > config.maxDrawdown) {
      this.emit("riskAlert", {
        type: "maxDrawdown",
        severity: "critical",
        value: metrics.maxDrawdown,
        limit: config.maxDrawdown,
      });
    }

    // Check concentration risk
    if (metrics.concentrationRisk > config.concentrationLimit) {
      this.emit("riskAlert", {
        type: "concentration",
        severity: "medium",
        value: metrics.concentrationRisk,
        limit: config.concentrationLimit,
      });
    }
  }

  /**
   * Reset daily performance metrics
   */
  private resetDailyMetrics(): void {
    this.portfolio.pnl.dailyPnL = "0";
    this.emit("dailyReset", { timestamp: new Date().toISOString() });
  }

  // Helper calculation methods
  private calculateDailyPnL(): number {
    const today = new Date().toDateString();
    const todayTrades = this.portfolio.trades.filter(
      (trade) =>
        new Date(trade.timestamp).toDateString() === today &&
        trade.status === "completed",
    );

    return todayTrades.reduce(
      (sum, trade) => sum + this.calculateTradeProfit(trade),
      0,
    );
  }

  private calculateUnrealizedPnL(): number {
    // Simplified unrealized P&L calculation
    const portfolioValue = parseFloat(this.portfolio.totalValueUSD);
    const initialValue = Object.values(this.config.initialBalance).reduce(
      (sum, bal) => sum + parseFloat(bal),
      0,
    );

    return portfolioValue - initialValue;
  }

  private calculateMaxDrawdown(): number {
    const trades = this.portfolio.trades.filter(
      (t) => t.status === "completed",
    );
    if (trades.length < 2) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of trades) {
      const profit = this.calculateTradeProfit(trade);
      cumulative += profit;
      peak = Math.max(peak, cumulative);
      const drawdown = peak > 0 ? (peak - cumulative) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown * 100; // Return as percentage
  }

  private calculateVaR(returns: number[]): number {
    if (returns.length < 10) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor(0.05 * sortedReturns.length); // 5% VaR
    return Math.abs(sortedReturns[index] || 0) * 100;
  }

  private calculateBeta(returns: number[]): number {
    // Simplified beta calculation (assuming market returns of 0.001 daily)
    if (returns.length < 10) return 1;

    const marketReturn = 0.001;
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const covariance =
      returns.reduce((sum, r) => sum + (r - avgReturn) * marketReturn, 0) /
      returns.length;
    const marketVariance = 0.0001; // Simplified market variance

    return marketVariance > 0 ? covariance / marketVariance : 1;
  }

  private calculateCorrelationRisk(): number {
    // Simplified correlation risk calculation
    const tokens = Object.keys(this.portfolio.balances);
    if (tokens.length < 2) return 0;

    // Calculate average correlation (simplified)
    let totalCorrelation = 0;
    let pairs = 0;

    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        // Simplified correlation calculation
        const correlation = Math.random() * 0.8; // Mock correlation
        totalCorrelation += correlation;
        pairs++;
      }
    }

    return pairs > 0 ? (totalCorrelation / pairs) * 100 : 0;
  }

  private calculateConcentrationRisk(): number {
    const totalValue = parseFloat(this.portfolio.totalValueUSD);
    if (totalValue === 0) return 0;

    const positions = Object.entries(this.portfolio.balances).map(
      ([token, balance]) => {
        const price = this.marketPrices[token] || 0;
        return parseFloat(balance) * price;
      },
    );

    const weights = positions.map((pos) => pos / totalValue);

    // Herfindahl-Hirschman Index
    return weights.reduce((sum, weight) => sum + weight * weight, 0) * 100;
  }

  /**
   * Clean up resources on destruction
   */
  public destroy(): void {
    if (this.dailyResetTimer) {
      clearInterval(this.dailyResetTimer);
    }
    if (this.performanceUpdateTimer) {
      clearInterval(this.performanceUpdateTimer);
    }
    this.removeAllListeners();
  }
}
