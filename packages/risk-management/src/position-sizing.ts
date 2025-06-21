import { z } from 'zod';
import { EventEmitter } from 'eventemitter3';

export interface PositionSizingConfig {
  baseRiskPerTrade: number; // Percentage of portfolio to risk per trade (0-5%)
  maxPositionSize: number; // Maximum position size as % of portfolio
  minPositionSize: number; // Minimum position size in USD
  volatilityLookback: number; // Days to look back for volatility calculation
  maxDailyRisk: number; // Maximum daily risk exposure as % of portfolio
  correlationThreshold: number; // Maximum correlation between positions (0-1)
  riskScalingMethod: 'fixed' | 'volatility' | 'kelly' | 'adaptive' | 'black_litterman';
  enableDynamicSizing: boolean;
  enableVolatilityCaching: boolean;
  volatilityCacheTTL: number; // TTL for volatility cache in milliseconds
  enablePositionTracking: boolean;
  maxPositionHistory: number; // Maximum number of historical positions to track
  kellyFractionCap: number; // Maximum Kelly fraction allowed (safety cap)
  adaptivePerformanceWindow: number; // Window for adaptive performance calculation
}

export interface MarketData {
  price: number;
  volume24h: number;
  volatility: number; // Annualized volatility
  liquidity: number; // Depth of order book
  spread: number; // Bid-ask spread as percentage
  timestamp: string;
  beta?: number; // Beta relative to market
  skewness?: number; // Price skewness
  kurtosis?: number; // Price kurtosis
}

export interface TradeSignal {
  direction: 'long' | 'short';
  confidence: number; // 0-1 confidence score
  expectedReturn: number; // Expected return percentage
  timeHorizon: number; // Expected holding time in hours
  riskReward: number; // Risk-reward ratio
  signalStrength: number; // Additional signal quality metric
  marketRegime?: 'bull' | 'bear' | 'sideways' | 'volatile';
}

export interface PositionResult {
  positionSize: number; // Position size in USD
  riskAmount: number; // Amount at risk in USD
  leverage: number; // Effective leverage used
  stopLoss: number; // Recommended stop loss price
  takeProfit: number; // Recommended take profit price
  reasoning: string; // Explanation of sizing decision
  confidence: number; // Confidence in the sizing decision
  riskMetrics: {
    portfolioRisk: number; // Percentage of portfolio at risk
    dailyVaR: number; // Daily Value at Risk
    expectedReturn: number; // Expected return from position
    sharpeContribution: number; // Expected Sharpe ratio contribution
    maxDrawdownContribution: number; // Expected max drawdown contribution
    conditionalVaR: number; // Conditional Value at Risk (Expected Shortfall)
    informationRatio: number; // Information ratio for the position
  };
  adjustments: {
    volatilityAdjustment: number;
    liquidityAdjustment: number;
    correlationAdjustment: number;
    portfolioRiskAdjustment: number;
    marketRegimeAdjustment: number;
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

export interface PositionTrackingData {
  symbol: string;
  entryTime: string;
  exitTime?: string;
  entryPrice: number;
  exitPrice?: number;
  size: number;
  pnl?: number;
  holdingPeriod?: number; // in hours
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;
  volatilityAtEntry: number;
}

export interface VolatilityData {
  symbol: string;
  volatility: number;
  timestamp: string;
  confidence: number; // Confidence in volatility estimate
  method: 'historical' | 'ewma' | 'garch' | 'implied';
}

const PositionSizingConfigSchema = z.object({
  baseRiskPerTrade: z.number().min(0.1).max(10),
  maxPositionSize: z.number().min(1).max(50),
  minPositionSize: z.number().positive(),
  volatilityLookback: z.number().min(1).max(252),
  maxDailyRisk: z.number().min(1).max(50),
  correlationThreshold: z.number().min(0).max(1),
  riskScalingMethod: z.enum(['fixed', 'volatility', 'kelly', 'adaptive', 'black_litterman']),
  enableDynamicSizing: z.boolean(),
  enableVolatilityCaching: z.boolean(),
  volatilityCacheTTL: z.number().positive(),
  enablePositionTracking: z.boolean(),
  maxPositionHistory: z.number().min(10).max(10000),
  kellyFractionCap: z.number().min(0.01).max(0.5),
  adaptivePerformanceWindow: z.number().min(5).max(100)
});

export class PositionSizingEngine extends EventEmitter {
  private config: PositionSizingConfig;
  private portfolioValue: number;
  private historicalReturns: number[] = [];
  
  // Position tracking implementation
  private currentPositions: Map<string, PositionTrackingData> = new Map();
  private positionHistory: PositionTrackingData[] = [];
  
  // Volatility caching implementation
  private volatilityCache: Map<string, VolatilityData> = new Map();
  private volatilityCacheCleanupTimer?: NodeJS.Timeout;
  
  // Advanced analytics
  private performanceMetrics: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    calmar: number;
  } = {
    winRate: 0.5,
    avgWin: 0.02,
    avgLoss: -0.015,
    profitFactor: 1.33,
    sharpeRatio: 0.8,
    maxDrawdown: 0.1,
    calmar: 0.8
  };

  constructor(config: PositionSizingConfig, portfolioValue: number) {
    super();
    this.validateConfig(config);
    this.config = config;
    this.portfolioValue = portfolioValue;
    
    if (this.config.enableVolatilityCaching) {
      this.startVolatilityCacheCleanup();
    }
    
    this.startPerformanceTracking();
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
    try {
      // Step 1: Get or calculate volatility
      const enhancedMarketData = this.enhanceMarketData(symbol, marketData);
      
      // Step 2: Calculate base position size using selected method
      const baseSize = this.calculateBaseSize(signal, enhancedMarketData);
      
      // Step 3: Apply sophisticated risk adjustments
      const adjustments = this.calculateAllAdjustments(symbol, signal, enhancedMarketData, portfolioRisk);
      
      // Step 4: Combine all adjustments
      const adjustedSize = baseSize * 
        adjustments.volatilityAdjustment * 
        adjustments.liquidityAdjustment * 
        adjustments.correlationAdjustment * 
        adjustments.portfolioRiskAdjustment *
        adjustments.marketRegimeAdjustment;

      // Step 5: Apply position limits
      const finalSize = this.applyPositionLimits(adjustedSize, portfolioRisk);

      // Step 6: Calculate comprehensive risk metrics and levels
      const riskAmount = this.calculateRiskAmount(finalSize, signal, enhancedMarketData);
      const stopLoss = this.calculateStopLoss(enhancedMarketData.price, signal, riskAmount, finalSize);
      const takeProfit = this.calculateTakeProfit(enhancedMarketData.price, signal);
      const leverage = finalSize / (this.portfolioValue * (this.config.baseRiskPerTrade / 100));

      // Step 7: Calculate comprehensive risk metrics
      const riskMetrics = this.calculateComprehensiveRiskMetrics(
        finalSize, 
        riskAmount, 
        signal, 
        enhancedMarketData,
        portfolioRisk
      );

      // Step 8: Calculate confidence in sizing decision
      const confidence = this.calculateSizingConfidence(signal, enhancedMarketData, adjustments);

      // Step 9: Generate detailed reasoning
      const reasoning = this.generateDetailedReasoning(
        baseSize, 
        adjustedSize, 
        finalSize, 
        adjustments,
        signal,
        enhancedMarketData
      );

      const result: PositionResult = {
        positionSize: Math.round(finalSize * 100) / 100,
        riskAmount: Math.round(riskAmount * 100) / 100,
        leverage: Math.round(leverage * 100) / 100,
        stopLoss: Math.round(stopLoss * 1000) / 1000,
        takeProfit: Math.round(takeProfit * 1000) / 1000,
        reasoning,
        confidence,
        riskMetrics,
        adjustments
      };

      // Track position if enabled
      if (this.config.enablePositionTracking) {
        this.trackPositionEntry(symbol, result, enhancedMarketData);
      }

      this.emit('position-sized', { symbol, result, signal, marketData: enhancedMarketData });
      
      return result;
      
    } catch (error) {
      this.emit('sizing-error', { symbol, signal, error });
      throw new Error(`Position sizing failed for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Enhanced market data with cached volatility and additional metrics
   */
  private enhanceMarketData(symbol: string, marketData: MarketData): MarketData {
    const enhanced = { ...marketData };
    
    // Use cached volatility if available and fresh
    if (this.config.enableVolatilityCaching) {
      const cachedVol = this.getCachedVolatility(symbol);
      if (cachedVol && cachedVol.confidence > 0.8) {
        enhanced.volatility = cachedVol.volatility;
      } else {
        // Calculate and cache new volatility
        const calculatedVol = this.calculateEnhancedVolatility(symbol, marketData);
        this.cacheVolatility(symbol, calculatedVol);
        enhanced.volatility = calculatedVol.volatility;
      }
    }
    
    return enhanced;
  }

  /**
   * Calculate all adjustment factors in one comprehensive method
   */
  private calculateAllAdjustments(
    symbol: string,
    signal: TradeSignal,
    marketData: MarketData,
    portfolioRisk: PortfolioRisk
  ): PositionResult['adjustments'] {
    return {
      volatilityAdjustment: this.calculateAdvancedVolatilityAdjustment(marketData, signal),
      liquidityAdjustment: this.calculateEnhancedLiquidityAdjustment(marketData),
      correlationAdjustment: this.calculatePreciseCorrelationAdjustment(symbol, portfolioRisk),
      portfolioRiskAdjustment: this.calculateDynamicPortfolioRiskAdjustment(portfolioRisk),
      marketRegimeAdjustment: this.calculateMarketRegimeAdjustment(signal, marketData)
    };
  }

  /**
   * Calculate base position size using selected method with enhancements
   */
  private calculateBaseSize(signal: TradeSignal, marketData: MarketData): number {
    const baseRiskAmount = this.portfolioValue * (this.config.baseRiskPerTrade / 100);

    switch (this.config.riskScalingMethod) {
      case 'fixed':
        return baseRiskAmount;

      case 'volatility':
        return this.calculateVolatilityScaledSize(baseRiskAmount, marketData);

      case 'kelly':
        return this.calculateEnhancedKellySize(signal, marketData, baseRiskAmount);

      case 'adaptive':
        return this.calculateAdvancedAdaptiveSize(signal, marketData, baseRiskAmount);
        
      case 'black_litterman':
        return this.calculateBlackLittermanSize(signal, marketData, baseRiskAmount);

      default:
        return baseRiskAmount;
    }
  }

  /**
   * Enhanced Kelly criterion with advanced statistics
   */
  private calculateEnhancedKellySize(signal: TradeSignal, marketData: MarketData, baseAmount: number): number {
    const winProbability = signal.confidence * (1 + signal.signalStrength * 0.1);
    const expectedReturn = signal.expectedReturn * signal.confidence;
    const expectedLoss = -expectedReturn / signal.riskReward;

    // Enhanced Kelly with volatility adjustment
    const volatilityPenalty = Math.min(1.5, marketData.volatility / 0.3);
    const adjustedWinProb = winProbability / volatilityPenalty;
    
    // Kelly fraction calculation with risk-free rate
    const riskFreeRate = 0.02 / 252; // Daily risk-free rate
    const excessReturn = expectedReturn - riskFreeRate;
    const b = Math.abs(excessReturn / expectedLoss);
    
    const kellyFraction = (b * adjustedWinProb - (1 - adjustedWinProb)) / b;
    
    // Apply safety cap and confidence scaling
    const safeKellyFraction = Math.max(0, Math.min(
      this.config.kellyFractionCap, 
      kellyFraction * 0.25 * signal.confidence
    ));
    
    // Scale based on baseAmount for position sizing consistency
    const kellySize = this.portfolioValue * safeKellyFraction;
    const scalingFactor = Math.min(2.0, Math.max(0.5, kellySize / Math.max(baseAmount, 1000)));
    
    return kellySize * scalingFactor;
  }

  /**
   * Black-Litterman position sizing
   */
  private calculateBlackLittermanSize(signal: TradeSignal, marketData: MarketData, baseAmount: number): number {
    // Simplified Black-Litterman approach
    const marketWeight = 0.1; // Assume 10% market weight for the asset
    const expectedReturn = signal.expectedReturn * signal.confidence;
    const riskAversion = 3; // Risk aversion parameter
    const variance = Math.pow(marketData.volatility / Math.sqrt(252), 2);
    
    // Black-Litterman optimal weight
    const optimalWeight = (expectedReturn - 0.02/252) / (riskAversion * variance);
    const adjustedWeight = (marketWeight + optimalWeight) / 2; // Blend with market weight
    
    return Math.max(0, Math.min(baseAmount * 3, this.portfolioValue * adjustedWeight));
  }

  /**
   * Advanced volatility adjustment with regime detection
   */
  private calculateAdvancedVolatilityAdjustment(marketData: MarketData, signal: TradeSignal): number {
    // Base volatility adjustment
    const normalizedVol = marketData.volatility / 0.3;
    let adjustment = Math.max(0.2, Math.min(2.0, 1 / Math.sqrt(normalizedVol)));
    
    // Regime-based adjustment
    if (signal.marketRegime === 'volatile') {
      adjustment *= 0.7; // Reduce size in volatile markets
    } else if (signal.marketRegime === 'sideways') {
      adjustment *= 1.2; // Increase size in range-bound markets
    }
    
    // Skewness and kurtosis adjustments
    if (marketData.skewness && Math.abs(marketData.skewness) > 1) {
      adjustment *= 0.9; // Reduce for high skewness
    }
    
    if (marketData.kurtosis && marketData.kurtosis > 4) {
      adjustment *= 0.85; // Reduce for high kurtosis (fat tails)
    }
    
    return adjustment;
  }

  /**
   * Market regime adjustment based on signal and market conditions
   */
  private calculateMarketRegimeAdjustment(signal: TradeSignal, marketData: MarketData): number {
    let adjustment = 1.0;
    
    // Time horizon adjustment
    if (signal.timeHorizon < 4) { // Short-term trades
      adjustment *= 0.9;
    } else if (signal.timeHorizon > 24) { // Long-term trades
      adjustment *= 1.1;
    }
    
    // Signal strength adjustment
    adjustment *= (0.8 + signal.signalStrength * 0.4);
    
    // Beta adjustment if available
    if (marketData.beta) {
      const betaAdjustment = 1 / (1 + Math.abs(marketData.beta - 1) * 0.3);
      adjustment *= betaAdjustment;
    }
    
    return Math.max(0.5, Math.min(1.5, adjustment));
  }

  /**
   * Calculate comprehensive risk metrics including advanced measures
   */
  private calculateComprehensiveRiskMetrics(
    positionSize: number, 
    riskAmount: number, 
    signal: TradeSignal, 
    marketData: MarketData,
    portfolioRisk: PortfolioRisk
  ): PositionResult['riskMetrics'] {
    const portfolioRiskPct = (riskAmount / this.portfolioValue) * 100;
    const dailyVaR = this.calculateDailyVaR(positionSize, marketData);
    const expectedReturn = this.calculateExpectedReturn(signal, positionSize);
    const sharpeContribution = this.calculateSharpeContribution(signal, positionSize);
    const maxDrawdownContribution = this.calculateMaxDrawdownContribution(riskAmount);
    
    // Advanced risk measures with portfolio risk adjustments
    const conditionalVaR = this.calculateConditionalVaR(positionSize, marketData);
    const informationRatio = this.calculateInformationRatio(signal, positionSize, marketData);
    
    // Portfolio risk-adjusted metrics
    const correlationAdjustment = 1 + (portfolioRisk.correlation * 0.2); // Increase risk if highly correlated
    const concentrationAdjustment = 1 + (portfolioRisk.concentration * 0.1); // Increase risk for concentration
    const leverageAdjustment = 1 + (Math.max(0, portfolioRisk.leverage - 1) * 0.15); // Penalize excessive leverage
    
    const adjustedVaR = dailyVaR * correlationAdjustment * concentrationAdjustment;
    const adjustedConditionalVaR = conditionalVaR * leverageAdjustment;
    const portfolioRiskAdjustedReturn = expectedReturn * (1 - portfolioRisk.totalRisk * 0.01); // Reduce expected return for high portfolio risk

    return {
      portfolioRisk: Math.round(portfolioRiskPct * 100) / 100,
      dailyVaR: Math.round(adjustedVaR * 100) / 100,
      expectedReturn: Math.round(portfolioRiskAdjustedReturn * 10000) / 10000,
      sharpeContribution: Math.round(sharpeContribution * 1000) / 1000,
      maxDrawdownContribution: Math.round(maxDrawdownContribution * 100) / 100,
      conditionalVaR: Math.round(adjustedConditionalVaR * 100) / 100,
      informationRatio: Math.round(informationRatio * 1000) / 1000
    };
  }

  /**
   * Calculate Conditional Value at Risk (Expected Shortfall)
   */
  private calculateConditionalVaR(positionSize: number, marketData: MarketData): number {
    const dailyVol = marketData.volatility * Math.sqrt(1/252);
    
    // Enhanced CVaR calculation using market data characteristics
    let cvarMultiplier = 2.063; // Base theoretical CVaR for normal distribution at 95% confidence
    
    // Adjust CVaR based on market conditions
    if (marketData.skewness && marketData.skewness < -0.5) {
      // Negative skew increases tail risk
      cvarMultiplier *= (1 + Math.abs(marketData.skewness) * 0.2);
    }
    
    if (marketData.kurtosis && marketData.kurtosis > 3) {
      // High kurtosis (fat tails) increases extreme loss probability
      cvarMultiplier *= (1 + (marketData.kurtosis - 3) * 0.1);
    }
    
    // Adjust for liquidity risk - less liquid markets have higher tail risk
    if (marketData.liquidity < 0.5) {
      cvarMultiplier *= (1 + (0.5 - marketData.liquidity) * 0.3);
    }
    
    // CVaR at 95% confidence level (expected loss beyond VaR)
    return positionSize * dailyVol * cvarMultiplier;
  }

  /**
   * Calculate Information Ratio for the position
   */
  private calculateInformationRatio(signal: TradeSignal, positionSize: number, marketData: MarketData): number {
    const weight = positionSize / this.portfolioValue;
    const excessReturn = signal.expectedReturn * signal.confidence - 0.02/252;
    const trackingError = marketData.volatility / Math.sqrt(252) * 0.5; // Simplified tracking error
    
    return weight * (excessReturn / Math.max(trackingError, 0.001));
  }

  /**
   * Position tracking implementation
   */
  private trackPositionEntry(symbol: string, result: PositionResult, marketData: MarketData): void {
    const positionData: PositionTrackingData = {
      symbol,
      entryTime: new Date().toISOString(),
      entryPrice: marketData.price,
      size: result.positionSize,
      volatilityAtEntry: marketData.volatility
    };
    
    this.currentPositions.set(symbol, positionData);
    this.emit('position-tracked', positionData);
  }

  /**
   * Track position exit and calculate performance metrics
   */
  public trackPositionExit(symbol: string, exitPrice: number): PositionTrackingData | null {
    const position = this.currentPositions.get(symbol);
    if (!position) return null;
    
    const exitTime = new Date();
    const entryTime = new Date(position.entryTime);
    const holdingPeriod = (exitTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60); // hours
    
    const pnl = (exitPrice - position.entryPrice) * (position.size / position.entryPrice);
    const returnPct = pnl / position.size;
    
    const completedPosition: PositionTrackingData = {
      ...position,
      exitTime: exitTime.toISOString(),
      exitPrice,
      pnl,
      holdingPeriod
    };
    
    // Add to history and remove from current
    this.positionHistory.push(completedPosition);
    this.currentPositions.delete(symbol);
    
    // Maintain history limit
    if (this.positionHistory.length > this.config.maxPositionHistory) {
      this.positionHistory.shift();
    }
    
    // Update performance metrics
    this.updatePerformanceMetrics(returnPct);
    
    this.emit('position-exited', completedPosition);
    
    return completedPosition;
  }

  /**
   * Volatility caching implementation
   */
  private getCachedVolatility(symbol: string): VolatilityData | null {
    const cached = this.volatilityCache.get(symbol);
    if (!cached) return null;
    
    const age = Date.now() - new Date(cached.timestamp).getTime();
    if (age > this.config.volatilityCacheTTL) {
      this.volatilityCache.delete(symbol);
      return null;
    }
    
    return cached;
  }

  /**
   * Cache volatility data
   */
  private cacheVolatility(symbol: string, volatilityData: VolatilityData): void {
    this.volatilityCache.set(symbol, volatilityData);
  }

  /**
   * Calculate enhanced volatility with multiple methods
   */
  private calculateEnhancedVolatility(symbol: string, marketData: MarketData): VolatilityData {
    // For now, use the provided volatility but enhance with confidence
    let confidence = 0.8;
    
    // Increase confidence based on volume
    if (marketData.volume24h > 1000000) confidence += 0.1;
    if (marketData.liquidity > 0.8) confidence += 0.1;
    
    return {
      symbol,
      volatility: marketData.volatility,
      timestamp: new Date().toISOString(),
      confidence: Math.min(1.0, confidence),
      method: 'historical' // In production, this would be more sophisticated
    };
  }

  /**
   * Start volatility cache cleanup
   */
  private startVolatilityCacheCleanup(): void {
    const cache = this.volatilityCache;
    const config = this.config;
    
    const cleanupFunction = () => {
      const now = Date.now();
      const cacheToDelete: string[] = [];
      
      // Collect symbols to delete (avoid mutating during iteration)
      for (const [symbol, data] of cache.entries()) {
        const age = now - new Date(data.timestamp).getTime();
        if (age > config.volatilityCacheTTL) {
          cacheToDelete.push(symbol);
        }
      }
      
      // Delete expired entries
      for (const symbol of cacheToDelete) {
        cache.delete(symbol);
      }
    };
    
    this.volatilityCacheCleanupTimer = setInterval(cleanupFunction, this.config.volatilityCacheTTL / 2); // Cleanup every half TTL
  }

  /**
   * Update performance metrics from completed trades
   */
  private updatePerformanceMetrics(returnPct: number): void {
    this.historicalReturns.push(returnPct);
    
    if (this.historicalReturns.length > this.config.adaptivePerformanceWindow) {
      this.historicalReturns.shift();
    }
    
    if (this.historicalReturns.length >= 10) {
      const wins = this.historicalReturns.filter(r => r > 0);
      const losses = this.historicalReturns.filter(r => r < 0);
      
      this.performanceMetrics.winRate = wins.length / this.historicalReturns.length;
      this.performanceMetrics.avgWin = wins.length > 0 ? wins.reduce((sum, r) => sum + r, 0) / wins.length : 0;
      this.performanceMetrics.avgLoss = losses.length > 0 ? losses.reduce((sum, r) => sum + r, 0) / losses.length : 0;
      
      if (Math.abs(this.performanceMetrics.avgLoss) > 0) {
        this.performanceMetrics.profitFactor = Math.abs(this.performanceMetrics.avgWin / this.performanceMetrics.avgLoss);
      }
      
      // Calculate Sharpe ratio
      const avgReturn = this.historicalReturns.reduce((sum, r) => sum + r, 0) / this.historicalReturns.length;
      const variance = this.historicalReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / this.historicalReturns.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        this.performanceMetrics.sharpeRatio = (avgReturn - 0.02/252) / stdDev;
      }
    }
  }

  /**
   * Start performance tracking
   */
  private startPerformanceTracking(): void {
    setInterval(() => {
      this.emit('performance-update', {
        metrics: this.performanceMetrics,
        totalPositions: this.positionHistory.length,
        activePositions: this.currentPositions.size,
        volatilityCacheSize: this.volatilityCache.size
      });
    }, 60000); // Every minute
  }

  /**
   * Calculate sizing confidence based on multiple factors
   */
  private calculateSizingConfidence(
    signal: TradeSignal, 
    marketData: MarketData, 
    adjustments: PositionResult['adjustments']
  ): number {
    let confidence = signal.confidence;
    
    // Adjust based on market data quality
    if (marketData.volume24h > 1000000) confidence += 0.05;
    if (marketData.liquidity > 0.8) confidence += 0.05;
    if (marketData.spread < 0.01) confidence += 0.05;
    
    // Adjust based on adjustment factors (less extreme adjustments = higher confidence)
    const avgAdjustment = Object.values(adjustments).reduce((sum, adj) => sum + Math.abs(adj - 1), 0) / Object.keys(adjustments).length;
    confidence *= (1 - avgAdjustment * 0.2);
    
    // Performance-based adjustment
    if (this.performanceMetrics.winRate > 0.6) confidence += 0.05;
    if (this.performanceMetrics.sharpeRatio > 1.0) confidence += 0.05;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Generate detailed reasoning with enhanced explanations
   */
  private generateDetailedReasoning(
    baseSize: number, 
    adjustedSize: number, 
    finalSize: number,
    adjustments: PositionResult['adjustments'],
    signal: TradeSignal,
    marketData: MarketData
  ): string {
    const reasons: string[] = [];

    reasons.push(`Base size: $${baseSize.toFixed(0)} (${this.config.riskScalingMethod} method)`);

    // Detailed adjustment explanations
    for (const [key, value] of Object.entries(adjustments)) {
      if (Math.abs(value - 1) > 0.05) {
        const change = value > 1 ? 'increased' : 'reduced';
        const factor = Math.abs(value - 1).toFixed(2);
        const adjustmentName = key.replace('Adjustment', '').replace(/([A-Z])/g, ' $1').toLowerCase();
        reasons.push(`${change} by ${factor}x for ${adjustmentName}`);
      }
    }

    if (finalSize !== adjustedSize) {
      reasons.push(`limited to $${finalSize.toFixed(0)} by position/risk limits`);
    }

    // Add market data context to reasoning
    if (marketData.volatility > 0.5) {
      reasons.push(`high volatility (${(marketData.volatility * 100).toFixed(1)}%) factored`);
    }
    if (marketData.liquidity < 0.3) {
      reasons.push(`low liquidity (${(marketData.liquidity * 100).toFixed(1)}%) considered`);
    }
    if (marketData.spread > 0.02) {
      reasons.push(`wide spread (${(marketData.spread * 100).toFixed(2)}%) adjusted`);
    }

    // Add confidence and signal quality info
    reasons.push(`signal confidence: ${(signal.confidence * 100).toFixed(1)}%`);
    reasons.push(`expected R:R: ${signal.riskReward.toFixed(2)}`);

    return reasons.join(', ');
  }

  // Enhanced existing methods...
  private calculateVolatilityScaledSize(baseAmount: number, marketData: MarketData): number {
    const normalizedVol = Math.max(0.1, Math.min(2.0, marketData.volatility / 0.3));
    return baseAmount / normalizedVol;
  }

  private calculateAdvancedAdaptiveSize(signal: TradeSignal, marketData: MarketData, baseAmount: number): number {
    const recentPerformance = this.calculateRecentPerformance();
    const performanceMultiplier = Math.max(0.3, Math.min(2.5, recentPerformance));
    const confidenceMultiplier = 0.5 + (signal.confidence * 0.5);
    const signalStrengthMultiplier = 0.8 + (signal.signalStrength * 0.4);
    
    // Enhanced market data integration for adaptive sizing
    // Volatility adjustment - reduce size in high volatility environments
    const volatilityAdjustment = Math.max(0.5, Math.min(1.5, 1 / Math.sqrt(marketData.volatility / 0.2)));
    
    // Volume confidence adjustment - increase confidence with higher volume
    const volumeAdjustment = marketData.volume24h > 1000000 ? 1.1 : 
                            marketData.volume24h > 100000 ? 1.0 : 0.9;
    
    // Liquidity adjustment - reduce size in illiquid markets
    const liquidityAdjustment = Math.max(0.6, Math.min(1.2, marketData.liquidity + 0.2));
    
    // Spread adjustment - tighten size on wide spreads
    const spreadAdjustment = Math.max(0.7, 1 - (marketData.spread * 10));
    
    // Market regime adjustment based on beta if available
    const betaAdjustment = marketData.beta ? 
      Math.max(0.8, Math.min(1.2, 1 / Math.abs(marketData.beta))) : 1.0;
    
    // Combine all market-driven adjustments
    const marketDataMultiplier = volatilityAdjustment * volumeAdjustment * 
                                liquidityAdjustment * spreadAdjustment * betaAdjustment;
    
    return baseAmount * performanceMultiplier * confidenceMultiplier * 
           signalStrengthMultiplier * marketDataMultiplier;
  }

  private calculateEnhancedLiquidityAdjustment(marketData: MarketData): number {
    const spreadPenalty = Math.max(0.3, 1 - (marketData.spread * 15));
    const volumeBonus = Math.min(1.3, Math.sqrt(marketData.volume24h / 1000000));
    const liquidityBonus = Math.min(1.2, marketData.liquidity + 0.2);
    
    return spreadPenalty * volumeBonus * liquidityBonus;
  }

  private calculatePreciseCorrelationAdjustment(symbol: string, portfolioRisk: PortfolioRisk): number {
    // Check for symbol-specific correlation penalties
    let symbolSpecificCorrelation = portfolioRisk.correlation;
    
    // Enhanced correlation calculation based on symbol characteristics
    if (symbol.includes('BTC') || symbol.includes('ETH')) {
      // Major crypto pairs tend to have higher correlation during stress
      symbolSpecificCorrelation *= 1.2;
    } else if (symbol.includes('USD') || symbol.includes('STABLE')) {
      // Stablecoin pairs have lower correlation risk
      symbolSpecificCorrelation *= 0.8;
    }
    
    if (symbolSpecificCorrelation > this.config.correlationThreshold) {
      const penalty = Math.pow(symbolSpecificCorrelation - this.config.correlationThreshold, 1.5);
      return Math.max(0.2, 1 - penalty);
    }
    return 1.0;
  }

  private calculateDynamicPortfolioRiskAdjustment(portfolioRisk: PortfolioRisk): number {
    const riskUtilization = portfolioRisk.dailyRisk / this.config.maxDailyRisk;
    
    if (riskUtilization > 0.7) {
      const reduction = Math.pow(riskUtilization - 0.7, 2) * 3;
      return Math.max(0.1, 1 - reduction);
    }
    
    return 1.0;
  }

  private calculateExpectedReturn(signal: TradeSignal, positionSize: number): number {
    const weight = positionSize / this.portfolioValue;
    return weight * signal.expectedReturn * signal.confidence;
  }

  /**
   * Get comprehensive analytics
   */
  public getAnalytics(): {
    performanceMetrics: {
      winRate: number;
      avgWin: number;
      avgLoss: number;
      profitFactor: number;
      sharpeRatio: number;
      maxDrawdown: number;
      calmar: number;
    };
    positionStats: {
      totalPositions: number;
      activePositions: number;
      avgHoldingTime: number;
      volatilityCacheHitRate: number;
    };
    riskProfile: {
      avgPositionSize: number;
      avgRiskPerTrade: number;
      maxDrawdownObserved: number;
    };
  } {
    const avgHoldingTime = this.positionHistory.length > 0 
      ? this.positionHistory.reduce((sum, pos) => sum + (pos.holdingPeriod || 0), 0) / this.positionHistory.length
      : 0;

    const totalRequests = this.positionHistory.length + this.currentPositions.size;
    const cacheHits = this.volatilityCache.size;
    const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    const avgPositionSize = this.positionHistory.length > 0
      ? this.positionHistory.reduce((sum, pos) => sum + pos.size, 0) / this.positionHistory.length
      : 0;

    return {
      performanceMetrics: this.performanceMetrics,
      positionStats: {
        totalPositions: this.positionHistory.length,
        activePositions: this.currentPositions.size,
        avgHoldingTime,
        volatilityCacheHitRate: hitRate
      },
      riskProfile: {
        avgPositionSize,
        avgRiskPerTrade: this.config.baseRiskPerTrade,
        maxDrawdownObserved: this.performanceMetrics.maxDrawdown
      }
    };
  }

  /**
   * Clear caches and reset tracking
   */
  public clearCaches(): void {
    this.volatilityCache.clear();
    this.currentPositions.clear();
    this.positionHistory.length = 0;
    this.historicalReturns.length = 0;
    
    this.emit('caches-cleared');
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.volatilityCacheCleanupTimer) {
      clearInterval(this.volatilityCacheCleanupTimer);
    }
    
    this.clearCaches();
    this.removeAllListeners();
  }

  public calculateRecentPerformance(): number {
    if (this.historicalReturns.length < 5) {
      return 1.0;
    }

    const recentReturns = this.historicalReturns.slice(-this.config.adaptivePerformanceWindow);
    const winRate = recentReturns.filter(r => r > 0).length / recentReturns.length;
    const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
    const sharpeRatio = this.performanceMetrics.sharpeRatio;

    return (winRate * 0.4) + 
           (Math.max(-0.5, Math.min(0.5, avgReturn * 10)) * 0.3) + 
           (Math.max(-0.5, Math.min(0.5, sharpeRatio)) * 0.3) + 0.5;
  }

  // Keep all existing public methods with same signatures
  public addTradeResult(returnPct: number): void {
    this.updatePerformanceMetrics(returnPct);
  }

  public updatePortfolioValue(newValue: number): void {
    this.portfolioValue = newValue;
    this.emit('portfolio-value-updated', newValue);
  }

  public updateConfig(newConfig: Partial<PositionSizingConfig>): void {
    const updatedConfig = { ...this.config, ...newConfig };
    this.validateConfig(updatedConfig);
    this.config = updatedConfig;
    this.emit('config-updated', updatedConfig);
  }

  public getConfig(): PositionSizingConfig {
    return { ...this.config };
  }

  private validateConfig(config: PositionSizingConfig): void {
    const result = PositionSizingConfigSchema.safeParse(config);
    if (result.success === false) {
      throw new Error(`Invalid position sizing configuration: ${result.error.message}`);
    }
  }

  // All existing private methods with enhancements...
  private applyPositionLimits(size: number, portfolioRisk: PortfolioRisk): number {
    const minSize = Math.max(this.config.minPositionSize, size);
    const maxSize = this.portfolioValue * (this.config.maxPositionSize / 100);
    const limitedSize = Math.min(minSize, maxSize);
    
    const remainingDailyRisk = Math.max(0, this.config.maxDailyRisk - portfolioRisk.dailyRisk);
    const maxDailyRiskSize = this.portfolioValue * (remainingDailyRisk / 100);
    
    return Math.min(limitedSize, maxDailyRiskSize);
  }

  private calculateRiskAmount(positionSize: number, signal: TradeSignal, marketData: MarketData): number {
    const stopLossDistance = this.calculateStopLossDistance(signal, marketData);
    return positionSize * stopLossDistance;
  }

  private calculateStopLoss(price: number, signal: TradeSignal, riskAmount: number, positionSize: number): number {
    const stopLossDistance = riskAmount / positionSize;
    
    if (signal.direction === 'long') {
      return price * (1 - stopLossDistance);
    } else {
      return price * (1 + stopLossDistance);
    }
  }

  private calculateTakeProfit(price: number, signal: TradeSignal): number {
    const targetReturn = signal.expectedReturn;
    
    if (signal.direction === 'long') {
      return price * (1 + targetReturn);
    } else {
      return price * (1 - targetReturn);
    }
  }

  private calculateStopLossDistance(signal: TradeSignal, marketData: MarketData): number {
    const volatilityStop = marketData.volatility * Math.sqrt(1/252);
    const confidenceAdjustment = 1 + (1 - signal.confidence) * 0.5;
    const signalStrengthAdjustment = 1.5 - signal.signalStrength * 0.5;
    
    return Math.min(0.15, volatilityStop * confidenceAdjustment * signalStrengthAdjustment * 2);
  }

  private calculateDailyVaR(positionSize: number, marketData: MarketData): number {
    const dailyVol = marketData.volatility * Math.sqrt(1/252);
    return positionSize * dailyVol * 1.645;
  }

  private calculateSharpeContribution(signal: TradeSignal, positionSize: number): number {
    const weight = positionSize / this.portfolioValue;
    const expectedReturn = signal.expectedReturn * signal.confidence;
    const riskFreeRate = 0.02 / 252;
    
    return weight * (expectedReturn - riskFreeRate);
  }

  private calculateMaxDrawdownContribution(riskAmount: number): number {
    return (riskAmount / this.portfolioValue) * 100;
  }
}