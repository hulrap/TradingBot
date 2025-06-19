import { EventEmitter } from 'events';
import winston from 'winston';
import { DatabaseManager } from './database-manager';

export interface RiskParameters {
  maxPositionSize: number;
  maxDailyLoss: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxConcurrentTrades: number;
  cooldownPeriod: number;
  volatilityThreshold: number;
  correlationLimit: number;
  maxDrawdown: number;
  emergencyStopLoss: number;
}

export interface TradeRisk {
  tradeId: string;
  pair: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  volatility: number;
  correlation: number;
  riskScore: number;
  timestamp: number;
}

export interface PortfolioRisk {
  totalExposure: number;
  dailyPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  var95: number; // Value at Risk 95%
  correlation: number;
  activeTrades: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RiskEvent {
  type: 'STOP_LOSS' | 'TAKE_PROFIT' | 'POSITION_LIMIT' | 'DAILY_LOSS' | 'EMERGENCY_STOP' | 'CORRELATION_BREACH';
  tradeId?: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  timestamp: number;
  action: 'CLOSE_TRADE' | 'PAUSE_TRADING' | 'EMERGENCY_SHUTDOWN';
}

export class RiskManager extends EventEmitter {
  private logger: winston.Logger;
  private db: DatabaseManager;
  private riskParams: RiskParameters;
  private activeTrades: Map<string, TradeRisk> = new Map();
  private portfolioHistory: PortfolioRisk[] = [];
  private priceHistory: Map<string, number[]> = new Map();
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  private dailyStartBalance: number = 0;
  private emergencyMode: boolean = false;

  constructor(
    databaseManager: DatabaseManager,
    riskParameters: RiskParameters,
    logger: winston.Logger
  ) {
    super();
    this.db = databaseManager;
    this.riskParams = riskParameters;
    this.logger = logger;
    
    this.setupDailyReset();
    this.startPerformanceTracking();
  }

  // Position Sizing Algorithm
  calculateOptimalPositionSize(
    pair: string,
    confidence: number,
    volatility: number,
    correlation: number
  ): number {
    try {
      // Kelly Criterion with modifications
      const winRate = this.getHistoricalWinRate(pair);
      const avgWin = this.getAverageWin(pair);
      const avgLoss = this.getAverageLoss(pair);
      
      // Kelly fraction: (bp - q) / b
      // b = odds (avgWin/avgLoss), p = win rate, q = loss rate
      const odds = Math.abs(avgWin / avgLoss);
      const lossRate = 1 - winRate;
      const kellyFraction = (odds * winRate - lossRate) / odds;
      
      // Apply risk adjustments
      let adjustedFraction = Math.max(0, Math.min(kellyFraction, 0.25)); // Cap at 25%
      
      // Volatility adjustment
      adjustedFraction *= (1 - Math.min(volatility, 0.5));
      
      // Confidence adjustment
      adjustedFraction *= confidence;
      
      // Correlation penalty
      adjustedFraction *= (1 - Math.min(correlation, 0.3));
      
      // Apply maximum position size limit
      const maxAllowed = this.riskParams.maxPositionSize;
      const portfolioValue = this.getCurrentPortfolioValue();
      const baseSize = portfolioValue * adjustedFraction;
      
      const optimalSize = Math.min(baseSize, maxAllowed);
      
      this.logger.info('Position size calculated', {
        pair,
        confidence,
        volatility,
        correlation,
        kellyFraction,
        adjustedFraction,
        optimalSize,
        maxAllowed
      });

      return optimalSize;
    } catch (error) {
      this.logger.error('Error calculating position size:', error);
      return this.riskParams.maxPositionSize * 0.1; // Conservative fallback
    }
  }

  // Volatility Analysis
  calculateVolatility(pair: string, period: number = 20): number {
    try {
      const prices = this.priceHistory.get(pair) || [];
      
      if (prices.length < period) {
        return 0.5; // Default high volatility for insufficient data
      }
      
      const recentPrices = prices.slice(-period);
      const returns = [];
      
      for (let i = 1; i < recentPrices.length; i++) {
        const returnValue = (recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1];
        returns.push(returnValue);
      }
      
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized
      
      return volatility;
    } catch (error) {
      this.logger.error('Error calculating volatility:', error);
      return 0.5;
    }
  }

  // Correlation Analysis
  calculateCorrelation(pair1: string, pair2: string, period: number = 50): number {
    try {
      const prices1 = this.priceHistory.get(pair1) || [];
      const prices2 = this.priceHistory.get(pair2) || [];
      
      if (prices1.length < period || prices2.length < period) {
        return 0; // No correlation for insufficient data
      }
      
      const returns1 = this.calculateReturns(prices1.slice(-period));
      const returns2 = this.calculateReturns(prices2.slice(-period));
      
      if (returns1.length !== returns2.length) {
        return 0;
      }
      
      const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
      const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;
      
      let numerator = 0;
      let sumSq1 = 0;
      let sumSq2 = 0;
      
      for (let i = 0; i < returns1.length; i++) {
        const diff1 = returns1[i] - mean1;
        const diff2 = returns2[i] - mean2;
        numerator += diff1 * diff2;
        sumSq1 += diff1 * diff1;
        sumSq2 += diff2 * diff2;
      }
      
      const denominator = Math.sqrt(sumSq1 * sumSq2);
      const correlation = denominator === 0 ? 0 : numerator / denominator;
      
      return correlation;
    } catch (error) {
      this.logger.error('Error calculating correlation:', error);
      return 0;
    }
  }

  // Trade Risk Assessment
  async assessTradeRisk(
    tradeId: string,
    pair: string,
    amount: number,
    entryPrice: number,
    currentPrice: number
  ): Promise<TradeRisk> {
    try {
      const unrealizedPnL = (currentPrice - entryPrice) * amount;
      const realizedPnL = this.getRealizedPnL(tradeId);
      const volatility = this.calculateVolatility(pair);
      
      // Calculate correlation with existing positions
      let maxCorrelation = 0;
      for (const [existingPair] of this.activeTrades) {
        if (existingPair !== pair) {
          const correlation = Math.abs(this.calculateCorrelation(pair, existingPair));
          maxCorrelation = Math.max(maxCorrelation, correlation);
        }
      }
      
      // Risk score calculation (0-100, higher = riskier)
      let riskScore = 0;
      riskScore += Math.min(volatility * 50, 30); // Volatility component
      riskScore += Math.min(maxCorrelation * 40, 25); // Correlation component
      riskScore += Math.min(Math.abs(unrealizedPnL / amount) * 30, 25); // P&L component
      riskScore += Math.min((amount / this.riskParams.maxPositionSize) * 20, 20); // Size component
      
      const tradeRisk: TradeRisk = {
        tradeId,
        pair,
        amount,
        entryPrice,
        currentPrice,
        unrealizedPnL,
        realizedPnL,
        volatility,
        correlation: maxCorrelation,
        riskScore: Math.min(riskScore, 100),
        timestamp: Date.now()
      };
      
      // Store trade risk
      this.activeTrades.set(tradeId, tradeRisk);
      
      // Check risk thresholds
      await this.checkRiskThresholds(tradeRisk);
      
      return tradeRisk;
    } catch (error) {
      this.logger.error('Error assessing trade risk:', error);
      throw error;
    }
  }

  // Stop-Loss and Take-Profit Logic
  private async checkRiskThresholds(tradeRisk: TradeRisk): Promise<void> {
    try {
      const { tradeId, pair, entryPrice, currentPrice, unrealizedPnL, amount } = tradeRisk;
      const priceChange = (currentPrice - entryPrice) / entryPrice * 100;
      
      // Stop Loss Check
      if (Math.abs(priceChange) >= this.riskParams.stopLossPercentage) {
        const event: RiskEvent = {
          type: 'STOP_LOSS',
          tradeId,
          message: `Stop loss triggered for ${pair}: ${priceChange.toFixed(2)}%`,
          severity: 'WARNING',
          timestamp: Date.now(),
          action: 'CLOSE_TRADE'
        };
        
        await this.triggerRiskEvent(event);
      }
      
      // Take Profit Check
      if (priceChange >= this.riskParams.takeProfitPercentage) {
        const event: RiskEvent = {
          type: 'TAKE_PROFIT',
          tradeId,
          message: `Take profit triggered for ${pair}: ${priceChange.toFixed(2)}%`,
          severity: 'INFO',
          timestamp: Date.now(),
          action: 'CLOSE_TRADE'
        };
        
        await this.triggerRiskEvent(event);
      }
      
      // Position Size Limit Check
      if (amount > this.riskParams.maxPositionSize) {
        const event: RiskEvent = {
          type: 'POSITION_LIMIT',
          tradeId,
          message: `Position size limit exceeded: ${amount} > ${this.riskParams.maxPositionSize}`,
          severity: 'CRITICAL',
          timestamp: Date.now(),
          action: 'CLOSE_TRADE'
        };
        
        await this.triggerRiskEvent(event);
      }
      
      // Emergency Stop Loss
      const portfolioLoss = this.getDailyPnL();
      if (Math.abs(portfolioLoss) >= this.riskParams.emergencyStopLoss) {
        const event: RiskEvent = {
          type: 'EMERGENCY_STOP',
          message: `Emergency stop loss triggered: ${portfolioLoss.toFixed(2)}%`,
          severity: 'CRITICAL',
          timestamp: Date.now(),
          action: 'EMERGENCY_SHUTDOWN'
        };
        
        await this.triggerRiskEvent(event);
      }
    } catch (error) {
      this.logger.error('Error checking risk thresholds:', error);
    }
  }

  // Portfolio Risk Assessment
  async assessPortfolioRisk(): Promise<PortfolioRisk> {
    try {
      const totalExposure = Array.from(this.activeTrades.values())
        .reduce((sum, trade) => sum + trade.amount, 0);
      
      const dailyPnL = this.getDailyPnL();
      const maxDrawdown = this.calculateMaxDrawdown();
      const sharpeRatio = this.calculateSharpeRatio();
      const var95 = this.calculateVaR();
      
      // Average correlation across all pairs
      const correlations: number[] = [];
      const pairs = Array.from(this.activeTrades.keys());
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const corr = Math.abs(this.calculateCorrelation(pairs[i], pairs[j]));
          correlations.push(corr);
        }
      }
      const avgCorrelation = correlations.length > 0 
        ? correlations.reduce((sum, c) => sum + c, 0) / correlations.length 
        : 0;
      
      // Risk level determination
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      
      if (Math.abs(dailyPnL) > this.riskParams.maxDailyLoss * 0.8 || 
          maxDrawdown > this.riskParams.maxDrawdown * 0.8 ||
          avgCorrelation > this.riskParams.correlationLimit) {
        riskLevel = 'CRITICAL';
      } else if (Math.abs(dailyPnL) > this.riskParams.maxDailyLoss * 0.6 ||
                 maxDrawdown > this.riskParams.maxDrawdown * 0.6) {
        riskLevel = 'HIGH';
      } else if (Math.abs(dailyPnL) > this.riskParams.maxDailyLoss * 0.4 ||
                 totalExposure > this.riskParams.maxPositionSize * 2) {
        riskLevel = 'MEDIUM';
      }
      
      const portfolioRisk: PortfolioRisk = {
        totalExposure,
        dailyPnL,
        maxDrawdown,
        sharpeRatio,
        var95,
        correlation: avgCorrelation,
        activeTrades: this.activeTrades.size,
        riskLevel
      };
      
      this.portfolioHistory.push(portfolioRisk);
      if (this.portfolioHistory.length > 1000) {
        this.portfolioHistory = this.portfolioHistory.slice(-1000);
      }
      
      // Check portfolio-level limits
      await this.checkPortfolioLimits(portfolioRisk);
      
      return portfolioRisk;
    } catch (error) {
      this.logger.error('Error assessing portfolio risk:', error);
      throw error;
    }
  }

  // Risk Event Handler
  private async triggerRiskEvent(event: RiskEvent): Promise<void> {
    try {
      this.logger.warn('Risk event triggered', event);
      
      // Store event in database
      await this.db.logRiskEvent(event);
      
      // Emit event for external handling
      this.emit('riskEvent', event);
      
      // Execute automatic actions
      switch (event.action) {
        case 'CLOSE_TRADE':
          if (event.tradeId) {
            this.emit('closeTrade', event.tradeId);
          }
          break;
        
        case 'PAUSE_TRADING':
          this.emit('pauseTrading', { duration: this.riskParams.cooldownPeriod });
          break;
        
        case 'EMERGENCY_SHUTDOWN':
          this.emergencyMode = true;
          this.emit('emergencyShutdown', event);
          break;
      }
    } catch (error) {
      this.logger.error('Error handling risk event:', error);
    }
  }

  // Helper Methods
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private getHistoricalWinRate(pair: string): number {
    // Mock implementation - in production, query from database
    return 0.65; // 65% win rate
  }

  private getAverageWin(pair: string): number {
    // Mock implementation
    return 0.015; // 1.5% average win
  }

  private getAverageLoss(pair: string): number {
    // Mock implementation
    return -0.008; // 0.8% average loss
  }

  private getCurrentPortfolioValue(): number {
    // Mock implementation - calculate from active positions
    return 100000; // $100k portfolio
  }

  private getRealizedPnL(tradeId: string): number {
    // Mock implementation - query from database
    return 0;
  }

  private getDailyPnL(): number {
    const currentValue = this.getCurrentPortfolioValue();
    return ((currentValue - this.dailyStartBalance) / this.dailyStartBalance) * 100;
  }

  private calculateMaxDrawdown(): number {
    if (this.portfolioHistory.length < 2) return 0;
    
    let maxDrawdown = 0;
    let peak = this.portfolioHistory[0].totalExposure;
    
    for (const portfolio of this.portfolioHistory) {
      if (portfolio.totalExposure > peak) {
        peak = portfolio.totalExposure;
      }
      
      const drawdown = (peak - portfolio.totalExposure) / peak * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateSharpeRatio(): number {
    if (this.portfolioHistory.length < 30) return 0;
    
    const returns = this.portfolioHistory.slice(-30).map(p => p.dailyPnL);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    return volatility === 0 ? 0 : avgReturn / volatility;
  }

  private calculateVaR(confidence: number = 0.95): number {
    if (this.portfolioHistory.length < 30) return 0;
    
    const returns = this.portfolioHistory.slice(-30).map(p => p.dailyPnL);
    returns.sort((a, b) => a - b);
    
    const index = Math.floor((1 - confidence) * returns.length);
    return returns[index] || 0;
  }

  private async checkPortfolioLimits(portfolioRisk: PortfolioRisk): Promise<void> {
    // Daily loss limit
    if (Math.abs(portfolioRisk.dailyPnL) >= this.riskParams.maxDailyLoss) {
      const event: RiskEvent = {
        type: 'DAILY_LOSS',
        message: `Daily loss limit reached: ${portfolioRisk.dailyPnL.toFixed(2)}%`,
        severity: 'CRITICAL',
        timestamp: Date.now(),
        action: 'PAUSE_TRADING'
      };
      
      await this.triggerRiskEvent(event);
    }
    
    // Correlation breach
    if (portfolioRisk.correlation > this.riskParams.correlationLimit) {
      const event: RiskEvent = {
        type: 'CORRELATION_BREACH',
        message: `Correlation limit breached: ${portfolioRisk.correlation.toFixed(2)}`,
        severity: 'WARNING',
        timestamp: Date.now(),
        action: 'PAUSE_TRADING'
      };
      
      await this.triggerRiskEvent(event);
    }
  }

  private setupDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.dailyStartBalance = this.getCurrentPortfolioValue();
      this.logger.info('Daily risk metrics reset', { startBalance: this.dailyStartBalance });
      
      // Set up recurring daily reset
      setInterval(() => {
        this.dailyStartBalance = this.getCurrentPortfolioValue();
        this.logger.info('Daily risk metrics reset', { startBalance: this.dailyStartBalance });
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  private startPerformanceTracking(): void {
    setInterval(async () => {
      try {
        await this.assessPortfolioRisk();
      } catch (error) {
        this.logger.error('Error in performance tracking:', error);
      }
    }, 60000); // Every minute
  }

  // Public API
  updatePrice(pair: string, price: number): void {
    if (!this.priceHistory.has(pair)) {
      this.priceHistory.set(pair, []);
    }
    
    const prices = this.priceHistory.get(pair)!;
    prices.push(price);
    
    // Keep only last 1000 prices
    if (prices.length > 1000) {
      prices.splice(0, prices.length - 1000);
    }
  }

  removeTrade(tradeId: string): void {
    this.activeTrades.delete(tradeId);
  }

  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }

  resetEmergencyMode(): void {
    this.emergencyMode = false;
    this.logger.info('Emergency mode reset');
  }

  getRiskParameters(): RiskParameters {
    return { ...this.riskParams };
  }

  updateRiskParameters(newParams: Partial<RiskParameters>): void {
    this.riskParams = { ...this.riskParams, ...newParams };
    this.logger.info('Risk parameters updated', newParams);
  }

  getActiveTrades(): TradeRisk[] {
    return Array.from(this.activeTrades.values());
  }

  getPortfolioHistory(): PortfolioRisk[] {
    return [...this.portfolioHistory];
  }
}