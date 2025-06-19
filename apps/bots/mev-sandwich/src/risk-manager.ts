import { EventEmitter } from 'events';
import { ethers } from 'ethers';

export interface RiskConfig {
  // Position limits
  maxPositionSizeEth: string;
  maxPositionSizeBnb: string;
  maxPositionSizeSol: string;
  maxDailyVolume: string;
  maxConcurrentPositions: number;

  // Risk thresholds
  maxSlippageTolerance: number; // Percentage
  maxPriceImpact: number; // Percentage
  minLiquidityUsd: number;
  maxGasPriceGwei: number;
  minProfitUsd: number;

  // Time-based limits
  maxPositionDuration: number; // Milliseconds
  cooldownPeriod: number; // Milliseconds between trades
  maxTradesPerHour: number;
  maxFailuresPerHour: number;

  // Portfolio limits
  maxPortfolioValue: string;
  maxDrawdownPercent: number;
  stopLossPercent: number;
  
  // Circuit breakers
  emergencyStopLoss: number; // Total loss to trigger emergency stop
  consecutiveFailureLimit: number;
  gasEfficiencyThreshold: number; // Minimum profit per gas ratio
}

export interface RiskAssessment {
  allowed: boolean;
  riskScore: number; // 0-100 (higher = riskier)
  warnings: string[];
  reasons: string[];
  recommendations: string[];
  limits: {
    positionSize: string;
    maxSlippage: number;
    timeout: number;
  };
}

export interface PositionTracker {
  id: string;
  chain: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  startTime: number;
  status: 'active' | 'completed' | 'failed';
  unrealizedPnl: string;
  gasUsed: string;
}

export interface RiskMetrics {
  dailyVolume: string;
  totalPositions: number;
  activePositions: number;
  portfolioValue: string;
  dailyPnl: string;
  maxDrawdown: string;
  winRate: number;
  consecutiveFailures: number;
  gasEfficiency: number;
  lastTradeTime: number;
}

export class RiskManager extends EventEmitter {
  private config: RiskConfig;
  private positions = new Map<string, PositionTracker>();
  private tradeHistory: Array<{ timestamp: number; profit: number; success: boolean }> = [];
  private dailyMetrics: RiskMetrics;
  private emergencyStopActive = false;
  private consecutiveFailures = 0;
  private lastTradeTime = 0;

  constructor(config: RiskConfig) {
    super();
    this.config = config;
    this.dailyMetrics = this.initializeDailyMetrics();
    
    // Reset daily metrics at midnight
    this.setupDailyReset();
  }

  /**
   * Assess risk for a potential sandwich opportunity
   */
  async assessRisk(opportunity: {
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    poolLiquidity: string;
    gasPrice: string;
    estimatedProfit: string;
    priceImpact: number;
    slippage: number;
    confidence: number;
  }): Promise<RiskAssessment> {
    const assessment: RiskAssessment = {
      allowed: false,
      riskScore: 0,
      warnings: [],
      reasons: [],
      recommendations: [],
      limits: {
        positionSize: opportunity.amountIn,
        maxSlippage: this.config.maxSlippageTolerance,
        timeout: this.config.maxPositionDuration
      }
    };

    // Check emergency stop
    if (this.emergencyStopActive) {
      assessment.reasons.push('Emergency stop is active');
      return assessment;
    }

    // Check consecutive failures
    if (this.consecutiveFailures >= this.config.consecutiveFailureLimit) {
      assessment.reasons.push(`Too many consecutive failures: ${this.consecutiveFailures}`);
      return assessment;
    }

    // Check cooldown period
    const timeSinceLastTrade = Date.now() - this.lastTradeTime;
    if (timeSinceLastTrade < this.config.cooldownPeriod) {
      assessment.reasons.push(`Cooldown period active: ${timeSinceLastTrade}ms remaining`);
      return assessment;
    }

    // Check position limits
    const positionCheck = this.checkPositionLimits(opportunity);
    if (!positionCheck.allowed) {
      assessment.reasons.push(...positionCheck.reasons);
      assessment.warnings.push(...positionCheck.warnings);
    }

    // Check liquidity requirements
    const liquidityCheck = this.checkLiquidityRequirements(opportunity);
    if (!liquidityCheck.allowed) {
      assessment.reasons.push(...liquidityCheck.reasons);
    }

    // Check gas price limits
    const gasCheck = this.checkGasLimits(opportunity);
    if (!gasCheck.allowed) {
      assessment.reasons.push(...gasCheck.reasons);
    }

    // Check profit requirements
    const profitCheck = this.checkProfitRequirements(opportunity);
    if (!profitCheck.allowed) {
      assessment.reasons.push(...profitCheck.reasons);
    }

    // Check trade frequency limits
    const frequencyCheck = this.checkTradeFrequency();
    if (!frequencyCheck.allowed) {
      assessment.reasons.push(...frequencyCheck.reasons);
    }

    // Calculate risk score
    assessment.riskScore = this.calculateRiskScore(opportunity);

    // Generate recommendations
    assessment.recommendations = this.generateRecommendations(opportunity, assessment);

    // Final decision
    assessment.allowed = assessment.reasons.length === 0 && assessment.riskScore <= 80;

    if (assessment.allowed) {
      // Adjust position size based on risk
      assessment.limits.positionSize = this.calculateOptimalPositionSize(opportunity, assessment.riskScore);
    }

    this.emit('riskAssessment', { opportunity, assessment });
    return assessment;
  }

  /**
   * Check position size and portfolio limits
   */
  private checkPositionLimits(opportunity: any): { allowed: boolean; reasons: string[]; warnings: string[] } {
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Check concurrent positions
    if (this.dailyMetrics.activePositions >= this.config.maxConcurrentPositions) {
      reasons.push(`Maximum concurrent positions reached: ${this.dailyMetrics.activePositions}`);
    }

    // Check position size limits by chain
    const amountValue = parseFloat(ethers.formatEther(opportunity.amountIn));
    let maxPositionSize = 0;

    switch (opportunity.chain) {
      case 'ethereum':
        maxPositionSize = parseFloat(this.config.maxPositionSizeEth);
        break;
      case 'bsc':
        maxPositionSize = parseFloat(this.config.maxPositionSizeBnb);
        break;
      case 'solana':
        maxPositionSize = parseFloat(this.config.maxPositionSizeSol);
        break;
    }

    if (amountValue > maxPositionSize) {
      reasons.push(`Position size ${amountValue} exceeds limit ${maxPositionSize} for ${opportunity.chain}`);
    }

    // Check daily volume
    const dailyVolumeValue = parseFloat(this.dailyMetrics.dailyVolume);
    const maxDailyVolume = parseFloat(this.config.maxDailyVolume);
    if (dailyVolumeValue + amountValue > maxDailyVolume) {
      reasons.push(`Daily volume limit would be exceeded: ${dailyVolumeValue + amountValue} > ${maxDailyVolume}`);
    }

    // Check portfolio value
    const portfolioValue = parseFloat(this.dailyMetrics.portfolioValue);
    const maxPortfolioValue = parseFloat(this.config.maxPortfolioValue);
    if (portfolioValue + amountValue > maxPortfolioValue) {
      warnings.push(`Position would increase portfolio exposure significantly`);
    }

    return { allowed: reasons.length === 0, reasons, warnings };
  }

  /**
   * Check liquidity requirements
   */
  private checkLiquidityRequirements(opportunity: any): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check pool liquidity
    const liquidityValue = parseFloat(ethers.formatEther(opportunity.poolLiquidity));
    if (liquidityValue < this.config.minLiquidityUsd) {
      reasons.push(`Insufficient liquidity: ${liquidityValue} < ${this.config.minLiquidityUsd}`);
    }

    // Check price impact
    if (opportunity.priceImpact > this.config.maxPriceImpact) {
      reasons.push(`Price impact too high: ${opportunity.priceImpact}% > ${this.config.maxPriceImpact}%`);
    }

    // Check slippage
    if (opportunity.slippage > this.config.maxSlippageTolerance) {
      reasons.push(`Slippage too high: ${opportunity.slippage}% > ${this.config.maxSlippageTolerance}%`);
    }

    return { allowed: reasons.length === 0, reasons };
  }

  /**
   * Check gas price limits
   */
  private checkGasLimits(opportunity: any): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Only check gas limits for EVM chains
    if (opportunity.chain === 'ethereum' || opportunity.chain === 'bsc') {
      const gasPrice = parseFloat(opportunity.gasPrice);
      if (gasPrice > this.config.maxGasPriceGwei) {
        reasons.push(`Gas price too high: ${gasPrice} > ${this.config.maxGasPriceGwei} gwei`);
      }
    }

    return { allowed: reasons.length === 0, reasons };
  }

  /**
   * Check profit requirements
   */
  private checkProfitRequirements(opportunity: any): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];

    const estimatedProfit = parseFloat(opportunity.estimatedProfit);
    if (estimatedProfit < this.config.minProfitUsd) {
      reasons.push(`Estimated profit too low: $${estimatedProfit} < $${this.config.minProfitUsd}`);
    }

    return { allowed: reasons.length === 0, reasons };
  }

  /**
   * Check trade frequency limits
   */
  private checkTradeFrequency(): { allowed: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Count trades in the last hour
    const recentTrades = this.tradeHistory.filter(trade => trade.timestamp > oneHourAgo);
    
    if (recentTrades.length >= this.config.maxTradesPerHour) {
      reasons.push(`Trade frequency limit reached: ${recentTrades.length} trades in last hour`);
    }

    // Count failures in the last hour
    const recentFailures = recentTrades.filter(trade => !trade.success);
    if (recentFailures.length >= this.config.maxFailuresPerHour) {
      reasons.push(`Failure frequency limit reached: ${recentFailures.length} failures in last hour`);
    }

    return { allowed: reasons.length === 0, reasons };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(opportunity: any): number {
    let riskScore = 0;

    // Price impact risk (0-30 points)
    riskScore += Math.min(opportunity.priceImpact * 3, 30);

    // Slippage risk (0-20 points)
    riskScore += Math.min(opportunity.slippage * 2, 20);

    // Gas price risk (0-15 points)
    const gasPrice = parseFloat(opportunity.gasPrice);
    const gasRisk = Math.min((gasPrice / this.config.maxGasPriceGwei) * 15, 15);
    riskScore += gasRisk;

    // Confidence penalty (0-20 points)
    const confidencePenalty = (1 - opportunity.confidence) * 20;
    riskScore += confidencePenalty;

    // Portfolio concentration risk (0-15 points)
    const positionSize = parseFloat(ethers.formatEther(opportunity.amountIn));
    const portfolioValue = parseFloat(this.dailyMetrics.portfolioValue);
    const concentrationRisk = (positionSize / portfolioValue) * 15;
    riskScore += Math.min(concentrationRisk, 15);

    return Math.min(Math.round(riskScore), 100);
  }

  /**
   * Calculate optimal position size based on risk
   */
  private calculateOptimalPositionSize(opportunity: any, riskScore: number): string {
    const originalAmount = parseFloat(ethers.formatEther(opportunity.amountIn));
    
    // Reduce position size based on risk score
    let sizeMultiplier = 1.0;
    if (riskScore > 60) sizeMultiplier = 0.5;
    else if (riskScore > 40) sizeMultiplier = 0.7;
    else if (riskScore > 20) sizeMultiplier = 0.9;

    const adjustedAmount = originalAmount * sizeMultiplier;
    return ethers.parseEther(adjustedAmount.toString()).toString();
  }

  /**
   * Generate risk management recommendations
   */
  private generateRecommendations(opportunity: any, assessment: RiskAssessment): string[] {
    const recommendations: string[] = [];

    if (assessment.riskScore > 60) {
      recommendations.push('Consider reducing position size due to high risk score');
    }

    if (opportunity.priceImpact > 5) {
      recommendations.push('High price impact detected - consider waiting for better liquidity');
    }

    if (opportunity.slippage > 3) {
      recommendations.push('High slippage detected - increase slippage tolerance or reduce size');
    }

    if (parseFloat(opportunity.gasPrice) > this.config.maxGasPriceGwei * 0.8) {
      recommendations.push('Gas price is near limit - monitor network congestion');
    }

    if (this.dailyMetrics.winRate < 0.5 && this.tradeHistory.length > 10) {
      recommendations.push('Low win rate detected - consider reviewing strategy');
    }

    return recommendations;
  }

  /**
   * Record trade execution
   */
  recordTrade(trade: {
    id: string;
    chain: string;
    tokenIn: string;
    tokenOut: string;
    amount: string;
    success: boolean;
    profit: number;
    gasUsed: string;
  }): void {
    const now = Date.now();
    
    // Add to trade history
    this.tradeHistory.push({
      timestamp: now,
      profit: trade.profit,
      success: trade.success
    });

    // Update position tracker
    if (trade.success) {
      this.positions.set(trade.id, {
        id: trade.id,
        chain: trade.chain,
        tokenIn: trade.tokenIn,
        tokenOut: trade.tokenOut,
        amount: trade.amount,
        startTime: now,
        status: 'completed',
        unrealizedPnl: trade.profit.toString(),
        gasUsed: trade.gasUsed
      });
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    this.lastTradeTime = now;
    this.updateDailyMetrics();

    // Check circuit breakers
    this.checkCircuitBreakers();

    this.emit('tradeRecorded', trade);
  }

  /**
   * Check circuit breakers and emergency stops
   */
  private checkCircuitBreakers(): void {
    // Check total loss threshold
    const dailyPnl = parseFloat(this.dailyMetrics.dailyPnl);
    if (dailyPnl < -this.config.emergencyStopLoss) {
      this.triggerEmergencyStop(`Daily loss threshold exceeded: $${dailyPnl}`);
      return;
    }

    // Check drawdown
    const maxDrawdown = parseFloat(this.dailyMetrics.maxDrawdown);
    if (maxDrawdown > this.config.maxDrawdownPercent) {
      this.triggerEmergencyStop(`Maximum drawdown exceeded: ${maxDrawdown}%`);
      return;
    }

    // Check gas efficiency
    if (this.dailyMetrics.gasEfficiency < this.config.gasEfficiencyThreshold) {
      this.emit('warning', `Low gas efficiency: ${this.dailyMetrics.gasEfficiency}`);
    }

    // Check consecutive failures
    if (this.consecutiveFailures >= this.config.consecutiveFailureLimit) {
      this.triggerEmergencyStop(`Too many consecutive failures: ${this.consecutiveFailures}`);
    }
  }

  /**
   * Trigger emergency stop
   */
  private triggerEmergencyStop(reason: string): void {
    this.emergencyStopActive = true;
    this.emit('emergencyStop', { reason, timestamp: Date.now() });
    console.error(`EMERGENCY STOP TRIGGERED: ${reason}`);
  }

  /**
   * Reset emergency stop (manual intervention required)
   */
  resetEmergencyStop(): void {
    this.emergencyStopActive = false;
    this.consecutiveFailures = 0;
    this.emit('emergencyStopReset', { timestamp: Date.now() });
    console.log('Emergency stop reset');
  }

  /**
   * Update daily metrics
   */
  private updateDailyMetrics(): void {
    const now = Date.now();
    const oneDayAgo = now - 86400000;

    // Filter trades from last 24 hours
    const recentTrades = this.tradeHistory.filter(trade => trade.timestamp > oneDayAgo);
    
    // Calculate daily P&L
    const dailyPnl = recentTrades.reduce((sum, trade) => sum + trade.profit, 0);
    
    // Calculate win rate
    const successfulTrades = recentTrades.filter(trade => trade.success);
    const winRate = recentTrades.length > 0 ? successfulTrades.length / recentTrades.length : 0;

    // Calculate daily volume
    const activePositions = Array.from(this.positions.values()).filter(p => p.status === 'active');
    const dailyVolume = activePositions.reduce((sum, pos) => {
      return sum + parseFloat(ethers.formatEther(pos.amount));
    }, 0);

    // Update metrics
    this.dailyMetrics = {
      ...this.dailyMetrics,
      dailyVolume: dailyVolume.toString(),
      totalPositions: this.positions.size,
      activePositions: activePositions.length,
      dailyPnl: dailyPnl.toString(),
      winRate,
      consecutiveFailures: this.consecutiveFailures,
      lastTradeTime: this.lastTradeTime
    };

    this.emit('metricsUpdated', this.dailyMetrics);
  }

  /**
   * Initialize daily metrics
   */
  private initializeDailyMetrics(): RiskMetrics {
    return {
      dailyVolume: '0',
      totalPositions: 0,
      activePositions: 0,
      portfolioValue: '0',
      dailyPnl: '0',
      maxDrawdown: '0',
      winRate: 0,
      consecutiveFailures: 0,
      gasEfficiency: 0,
      lastTradeTime: 0
    };
  }

  /**
   * Setup daily metrics reset
   */
  private setupDailyReset(): void {
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.resetDailyMetrics();
      }
    }, 60000); // Check every minute
  }

  /**
   * Reset daily metrics at midnight
   */
  private resetDailyMetrics(): void {
    this.dailyMetrics = this.initializeDailyMetrics();
    this.tradeHistory = [];
    this.emit('dailyReset', { timestamp: Date.now() });
  }

  /**
   * Get current risk metrics
   */
  getRiskMetrics(): RiskMetrics {
    return { ...this.dailyMetrics };
  }

  /**
   * Get active positions
   */
  getActivePositions(): PositionTracker[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'active');
  }

  /**
   * Update risk configuration
   */
  updateConfig(newConfig: Partial<RiskConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Check if trading is currently allowed
   */
  isTradingAllowed(): boolean {
    return !this.emergencyStopActive && 
           this.consecutiveFailures < this.config.consecutiveFailureLimit &&
           (Date.now() - this.lastTradeTime) >= this.config.cooldownPeriod;
  }
}