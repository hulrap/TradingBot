import { z } from 'zod';

export interface PositionSizingConfig {
  baseRiskPerTrade: number; // Percentage of portfolio to risk per trade (0-5%)
  maxPositionSize: number; // Maximum position size as % of portfolio
  minPositionSize: number; // Minimum position size in USD
  volatilityLookback: number; // Days to look back for volatility calculation
  maxDailyRisk: number; // Maximum daily risk exposure as % of portfolio
  correlationThreshold: number; // Maximum correlation between positions (0-1)
  riskScalingMethod: 'fixed' | 'volatility' | 'kelly' | 'adaptive';
  enableDynamicSizing: boolean;
}

export interface MarketData {
  price: number;
  volume24h: number;
  volatility: number; // Annualized volatility
  liquidity: number; // Depth of order book
  spread: number; // Bid-ask spread as percentage
  timestamp: string;
}

export interface TradeSignal {
  direction: 'long' | 'short';
  confidence: number; // 0-1 confidence score
  expectedReturn: number; // Expected return percentage
  timeHorizon: number; // Expected holding time in hours
  riskReward: number; // Risk-reward ratio
}

export interface PositionResult {
  positionSize: number; // Position size in USD
  riskAmount: number; // Amount at risk in USD
  leverage: number; // Effective leverage used
  stopLoss: number; // Recommended stop loss price
  takeProfit: number; // Recommended take profit price
  reasoning: string; // Explanation of sizing decision
  riskMetrics: {
    portfolioRisk: number; // Percentage of portfolio at risk
    dailyVaR: number; // Daily Value at Risk
    sharpeContribution: number; // Expected Sharpe ratio contribution
    maxDrawdownContribution: number; // Expected max drawdown contribution
  };
}

export interface PortfolioRisk {
  totalRisk: number; // Total portfolio risk exposure
  dailyRisk: number; // Current daily risk exposure
  concentration: number; // Concentration risk score
  correlation: number; // Average correlation between positions
  leverage: number; // Portfolio leverage
  liquidityRisk: number; // Liquidity risk score
}

const PositionSizingConfigSchema = z.object({
  baseRiskPerTrade: z.number().min(0.1).max(10),
  maxPositionSize: z.number().min(1).max(50),
  minPositionSize: z.number().positive(),
  volatilityLookback: z.number().min(1).max(90),
  maxDailyRisk: z.number().min(1).max(20),
  correlationThreshold: z.number().min(0).max(1),
  riskScalingMethod: z.enum(['fixed', 'volatility', 'kelly', 'adaptive']),
  enableDynamicSizing: z.boolean()
});

export class PositionSizingEngine {
  private config: PositionSizingConfig;
  private portfolioValue: number;
  private historicalReturns: number[] = [];
  // TODO: Implement position tracking and volatility caching
  // private currentPositions: Map<string, any> = new Map();
  // private volatilityCache: Map<string, number> = new Map();

  constructor(config: PositionSizingConfig, portfolioValue: number) {
    this.validateConfig(config);
    this.config = config;
    this.portfolioValue = portfolioValue;
  }

  /**
   * Calculate optimal position size for a trade signal
   */
  public calculatePositionSize(
    symbol: string,
    signal: TradeSignal,
    marketData: MarketData,
    portfolioRisk: PortfolioRisk
  ): PositionResult {
    // Step 1: Calculate base position size using selected method
    let baseSize = this.calculateBaseSize(signal, marketData);

    // Step 2: Apply risk adjustments
    const volatilityAdjustment = this.calculateVolatilityAdjustment(marketData);
    const liquidityAdjustment = this.calculateLiquidityAdjustment(marketData);
    const correlationAdjustment = this.calculateCorrelationAdjustment(symbol, portfolioRisk);
    const portfolioRiskAdjustment = this.calculatePortfolioRiskAdjustment(portfolioRisk);

    // Step 3: Combine all adjustments
    const adjustedSize = baseSize * 
      volatilityAdjustment * 
      liquidityAdjustment * 
      correlationAdjustment * 
      portfolioRiskAdjustment;

    // Step 4: Apply position limits
    const finalSize = this.applyPositionLimits(adjustedSize, portfolioRisk);

    // Step 5: Calculate risk metrics and levels
    const riskAmount = this.calculateRiskAmount(finalSize, signal, marketData);
    const stopLoss = this.calculateStopLoss(marketData.price, signal, riskAmount, finalSize);
    const takeProfit = this.calculateTakeProfit(marketData.price, signal);
    const leverage = finalSize / (this.portfolioValue * (this.config.baseRiskPerTrade / 100));

    // Step 6: Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(finalSize, riskAmount, signal, marketData);

    // Step 7: Generate reasoning
    const reasoning = this.generateReasoning(
      baseSize, 
      adjustedSize, 
      finalSize, 
      {
        volatilityAdjustment,
        liquidityAdjustment,
        correlationAdjustment,
        portfolioRiskAdjustment
      }
    );

    return {
      positionSize: Math.round(finalSize * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      leverage: Math.round(leverage * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      reasoning,
      riskMetrics
    };
  }

  /**
   * Calculate base position size using configured method
   */
  private calculateBaseSize(signal: TradeSignal, marketData: MarketData): number {
    const baseRiskAmount = this.portfolioValue * (this.config.baseRiskPerTrade / 100);

    switch (this.config.riskScalingMethod) {
      case 'fixed':
        return baseRiskAmount;

      case 'volatility':
        // Inverse volatility scaling
        const normalizedVol = Math.max(0.1, Math.min(2.0, marketData.volatility / 0.3));
        return baseRiskAmount / normalizedVol;

      case 'kelly':
        return this.calculateKellySize(signal, marketData, baseRiskAmount);

      case 'adaptive':
        return this.calculateAdaptiveSize(signal, marketData, baseRiskAmount);

      default:
        return baseRiskAmount;
    }
  }

  /**
   * Kelly criterion position sizing
   */
  private calculateKellySize(signal: TradeSignal, _marketData: MarketData, _baseAmount: number): number {
    const winProbability = signal.confidence;
    const avgWin = signal.expectedReturn;
    const avgLoss = -signal.expectedReturn / signal.riskReward; // Assuming risk-reward ratio

    // Kelly fraction: (bp - q) / b
    // where b = odds received (avgWin/avgLoss), p = probability of win, q = probability of loss
    const b = Math.abs(avgWin / avgLoss);
    const kellyFraction = (b * winProbability - (1 - winProbability)) / b;

    // Apply Kelly fraction with safety margin (25% of optimal)
    const safeKellyFraction = Math.max(0, Math.min(0.25, kellyFraction * 0.25));
    
    return this.portfolioValue * safeKellyFraction;
  }

  /**
   * Adaptive position sizing based on recent performance
   */
  private calculateAdaptiveSize(signal: TradeSignal, _marketData: MarketData, baseAmount: number): number {
    // Adjust based on recent win rate and Sharpe ratio
    const recentPerformance = this.calculateRecentPerformance();
    const performanceMultiplier = Math.max(0.5, Math.min(2.0, recentPerformance));
    
    // Adjust based on signal confidence
    const confidenceMultiplier = 0.5 + (signal.confidence * 0.5);
    
    return baseAmount * performanceMultiplier * confidenceMultiplier;
  }

  /**
   * Calculate volatility adjustment factor
   */
  private calculateVolatilityAdjustment(marketData: MarketData): number {
    // Reduce position size in high volatility environments
    const normalizedVol = marketData.volatility / 0.3; // Normalize to 30% baseline
    return Math.max(0.2, Math.min(2.0, 1 / Math.sqrt(normalizedVol)));
  }

  /**
   * Calculate liquidity adjustment factor
   */
  private calculateLiquidityAdjustment(marketData: MarketData): number {
    // Reduce position size for illiquid markets
    const spreadPenalty = Math.max(0.5, 1 - (marketData.spread * 10));
    const volumeBonus = Math.min(1.2, Math.sqrt(marketData.volume24h / 1000000)); // Normalize to $1M baseline
    
    return spreadPenalty * volumeBonus;
  }

  /**
   * Calculate correlation adjustment factor
   */
  private calculateCorrelationAdjustment(_symbol: string, portfolioRisk: PortfolioRisk): number {
    // Reduce position size if portfolio is highly correlated
    // TODO: Use symbol to calculate specific correlation with existing positions
    if (portfolioRisk.correlation > this.config.correlationThreshold) {
      const correlationPenalty = 1 - (portfolioRisk.correlation - this.config.correlationThreshold);
      return Math.max(0.3, correlationPenalty);
    }
    
    return 1.0;
  }

  /**
   * Calculate portfolio risk adjustment factor
   */
  private calculatePortfolioRiskAdjustment(portfolioRisk: PortfolioRisk): number {
    // Reduce position size if portfolio risk is already high
    const riskUtilization = portfolioRisk.dailyRisk / this.config.maxDailyRisk;
    
    if (riskUtilization > 0.8) {
      return Math.max(0.1, 1 - riskUtilization);
    }
    
    return 1.0;
  }

  /**
   * Apply position size limits
   */
  private applyPositionLimits(size: number, portfolioRisk: PortfolioRisk): number {
    // Apply minimum position size
    const minSize = Math.max(this.config.minPositionSize, size);
    
    // Apply maximum position size
    const maxSize = this.portfolioValue * (this.config.maxPositionSize / 100);
    const limitedSize = Math.min(minSize, maxSize);
    
    // Ensure we don't exceed daily risk limits
    const remainingDailyRisk = this.config.maxDailyRisk - portfolioRisk.dailyRisk;
    const maxDailyRiskSize = this.portfolioValue * (remainingDailyRisk / 100);
    
    return Math.min(limitedSize, maxDailyRiskSize);
  }

  /**
   * Calculate risk amount for position
   */
  private calculateRiskAmount(positionSize: number, signal: TradeSignal, marketData: MarketData): number {
    // Risk amount based on expected volatility and stop loss distance
    const stopLossDistance = this.calculateStopLossDistance(signal, marketData);
    return positionSize * stopLossDistance;
  }

  /**
   * Calculate optimal stop loss price
   */
  private calculateStopLoss(price: number, signal: TradeSignal, riskAmount: number, positionSize: number): number {
    const stopLossDistance = riskAmount / positionSize;
    
    if (signal.direction === 'long') {
      return price * (1 - stopLossDistance);
    } else {
      return price * (1 + stopLossDistance);
    }
  }

  /**
   * Calculate take profit price
   */
  private calculateTakeProfit(price: number, signal: TradeSignal): number {
    const targetReturn = signal.expectedReturn;
    
    if (signal.direction === 'long') {
      return price * (1 + targetReturn);
    } else {
      return price * (1 - targetReturn);
    }
  }

  /**
   * Calculate stop loss distance based on volatility and signal
   */
  private calculateStopLossDistance(signal: TradeSignal, marketData: MarketData): number {
    // Base stop loss on volatility and confidence
    const volatilityStop = marketData.volatility * Math.sqrt(1/252); // Daily volatility
    const confidenceAdjustment = 1 + (1 - signal.confidence); // Wider stops for low confidence
    
    return Math.min(0.1, volatilityStop * confidenceAdjustment * 2); // Max 10% stop loss
  }

  /**
   * Calculate comprehensive risk metrics
   */
  private calculateRiskMetrics(
    positionSize: number, 
    riskAmount: number, 
    signal: TradeSignal, 
    marketData: MarketData
  ): PositionResult['riskMetrics'] {
    const portfolioRisk = (riskAmount / this.portfolioValue) * 100;
    const dailyVaR = this.calculateDailyVaR(positionSize, marketData);
    const sharpeContribution = this.calculateSharpeContribution(signal, positionSize);
    const maxDrawdownContribution = this.calculateMaxDrawdownContribution(riskAmount);

    return {
      portfolioRisk: Math.round(portfolioRisk * 100) / 100,
      dailyVaR: Math.round(dailyVaR * 100) / 100,
      sharpeContribution: Math.round(sharpeContribution * 1000) / 1000,
      maxDrawdownContribution: Math.round(maxDrawdownContribution * 100) / 100
    };
  }

  /**
   * Calculate daily Value at Risk
   */
  private calculateDailyVaR(positionSize: number, marketData: MarketData): number {
    // 95% VaR using normal distribution assumption
    const dailyVol = marketData.volatility * Math.sqrt(1/252);
    return positionSize * dailyVol * 1.645; // 95% confidence level
  }

  /**
   * Calculate expected Sharpe ratio contribution
   */
  private calculateSharpeContribution(signal: TradeSignal, positionSize: number): number {
    const weight = positionSize / this.portfolioValue;
    const expectedReturn = signal.expectedReturn * signal.confidence;
    const riskFreeRate = 0.02; // Assume 2% risk-free rate
    
    return weight * (expectedReturn - riskFreeRate);
  }

  /**
   * Calculate maximum drawdown contribution
   */
  private calculateMaxDrawdownContribution(riskAmount: number): number {
    // Simplified: assume worst case scenario
    return (riskAmount / this.portfolioValue) * 100;
  }

  /**
   * Calculate recent performance for adaptive sizing
   */
  private calculateRecentPerformance(): number {
    if (this.historicalReturns.length < 10) {
      return 1.0; // Default multiplier
    }

    const recentReturns = this.historicalReturns.slice(-20); // Last 20 trades
    const winRate = recentReturns.filter(r => r > 0).length / recentReturns.length;
    const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;

    // Combine win rate and average return
    return (winRate * 0.6) + (Math.max(-0.5, Math.min(0.5, avgReturn * 10)) * 0.4) + 0.5;
  }

  /**
   * Generate human-readable reasoning for position sizing decision
   */
  private generateReasoning(
    baseSize: number, 
    adjustedSize: number, 
    finalSize: number,
    adjustments: {
      volatilityAdjustment: number;
      liquidityAdjustment: number;
      correlationAdjustment: number;
      portfolioRiskAdjustment: number;
    }
  ): string {
    const reasons: string[] = [];

    reasons.push(`Base size: $${baseSize.toFixed(0)} (${this.config.riskScalingMethod} method)`);

    if (Math.abs(adjustments.volatilityAdjustment - 1) > 0.1) {
      const change = adjustments.volatilityAdjustment > 1 ? 'increased' : 'reduced';
      reasons.push(`${change} by ${Math.abs(adjustments.volatilityAdjustment - 1).toFixed(1)}x for volatility`);
    }

    if (Math.abs(adjustments.liquidityAdjustment - 1) > 0.1) {
      const change = adjustments.liquidityAdjustment > 1 ? 'increased' : 'reduced';
      reasons.push(`${change} by ${Math.abs(adjustments.liquidityAdjustment - 1).toFixed(1)}x for liquidity`);
    }

    if (Math.abs(adjustments.correlationAdjustment - 1) > 0.1) {
      reasons.push(`reduced by ${(1 - adjustments.correlationAdjustment).toFixed(1)}x for correlation risk`);
    }

    if (Math.abs(adjustments.portfolioRiskAdjustment - 1) > 0.1) {
      reasons.push(`reduced by ${(1 - adjustments.portfolioRiskAdjustment).toFixed(1)}x for portfolio risk`);
    }

    if (finalSize !== adjustedSize) {
      reasons.push(`limited to $${finalSize.toFixed(0)} by position/risk limits`);
    }

    return reasons.join(', ');
  }

  /**
   * Add trade result for adaptive sizing
   */
  public addTradeResult(returnPct: number): void {
    this.historicalReturns.push(returnPct);
    
    // Keep only last 100 trades
    if (this.historicalReturns.length > 100) {
      this.historicalReturns = this.historicalReturns.slice(-100);
    }
  }

  /**
   * Update portfolio value
   */
  public updatePortfolioValue(newValue: number): void {
    this.portfolioValue = newValue;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PositionSizingConfig>): void {
    const updatedConfig = { ...this.config, ...newConfig };
    this.validateConfig(updatedConfig);
    this.config = updatedConfig;
  }

  /**
   * Get current configuration
   */
  public getConfig(): PositionSizingConfig {
    return { ...this.config };
  }

  private validateConfig(config: PositionSizingConfig): void {
    const result = PositionSizingConfigSchema.safeParse(config);
    if (result.success === false) {
      throw new Error(`Invalid position sizing configuration: ${result.error.message}`);
    }
  }
}