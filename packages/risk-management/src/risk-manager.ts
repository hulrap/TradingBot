import EventEmitter from 'eventemitter3';
import { GlobalKillSwitch, KillSwitchConfig, KillSwitchStatus } from './global-kill-switch';
import { PositionSizingEngine, PositionSizingConfig, PositionResult, PortfolioRisk, TradeSignal, MarketData } from './position-sizing';

// Enhanced configuration with production-ready parameters
export interface RiskManagerConfig {
  killSwitch: KillSwitchConfig;
  positionSizing: PositionSizingConfig;
  portfolioLimits: {
    maxPortfolioRisk: number; // Maximum portfolio risk percentage
    maxSectorConcentration: number; // Maximum concentration in single sector
    maxCorrelation: number; // Maximum correlation between positions
    rebalanceThreshold: number; // Trigger rebalancing when exceeded
    maxDrawdown: number; // Maximum acceptable drawdown percentage
    maxLeverage: number; // Maximum portfolio leverage
  };
  stressTest: {
    enabled: boolean;
    scenarios: StressTestScenario[];
    failureThreshold: number; // Max acceptable loss in stress test
    frequency: number; // Hours between stress tests
    historicalDataDays: number; // Days of historical data for correlation calculation
  };
  monitoring: {
    riskCheckInterval: number; // Milliseconds between risk checks
    reportRetentionDays: number; // Days to keep risk reports
    alertRetentionDays: number; // Days to keep alerts
    enableDetailedLogging: boolean;
    notificationThresholds: {
      critical: number; // Risk level that triggers critical alerts
      warning: number; // Risk level that triggers warnings
    };
  };
  database?: {
    enabled: boolean;
    persistReports: boolean;
    persistAlerts: boolean;
    persistPositions: boolean;
  };
}

export interface StressTestScenario {
  id: string;
  name: string;
  description: string;
  category: 'market' | 'liquidity' | 'credit' | 'operational';
  marketShock: number; // Market down percentage
  volatilityMultiplier: number; // Volatility increase factor
  liquidityReduction: number; // Liquidity reduction percentage
  correlationIncrease: number; // Correlation increase in crisis
  duration: number; // Expected duration in days
  probability: number; // Estimated probability of occurrence
  enabled: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  size: number; // Position size in USD
  entryPrice: number;
  currentPrice: number;
  direction: 'long' | 'short';
  pnl: number; // Current P&L
  unrealizedPnl: number; // Unrealized P&L
  realizedPnl: number; // Realized P&L
  riskAmount: number; // Amount at risk
  sector?: string;
  asset_class?: string; // stocks, crypto, forex, commodities
  country?: string;
  currency: string;
  leverage: number;
  entryTimestamp: string;
  lastUpdateTimestamp: string;
  stopLoss?: number;
  takeProfit?: number;
  // Risk metrics
  var95: number; // 95% Value at Risk
  var99: number; // 99% Value at Risk
  maxDrawdown: number; // Maximum drawdown since entry
  sharpeRatio?: number;
  beta?: number; // Beta to market
}

export interface RiskReport {
  id: string;
  timestamp: string;
  portfolioRisk: PortfolioRisk;
  killSwitchStatus: KillSwitchStatus;
  stressTestResults?: StressTestResult[];
  recommendations: RiskRecommendation[];
  alerts: RiskAlert[];
  marketConditions: MarketConditions;
  performanceMetrics: PerformanceMetrics;
  riskAttribution: RiskAttribution;
}

export interface StressTestResult {
  scenarioId: string;
  scenario: string;
  category: string;
  expectedLoss: number;
  expectedLossUSD: number;
  worstCaseVaR: number;
  timeToRecovery: number; // Estimated days to recover
  maxDrawdown: number;
  liquidityImpact: number;
  passed: boolean;
  confidence: number; // Confidence in the result (0-1)
  affectedPositions: string[];
  recommendations: string[];
}

export interface RiskRecommendation {
  id: string;
  type: 'reduce_position' | 'hedge' | 'rebalance' | 'diversify' | 'increase_cash' | 'adjust_stops' | 'close_position';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'portfolio' | 'position' | 'risk' | 'performance';
  description: string;
  rationale: string;
  expectedImpact: string;
  estimatedCost: number;
  timeframe: string; // e.g., "immediate", "within 1 day", "within 1 week"
  positions?: string[]; // Affected position IDs
  actionRequired: boolean;
  implementationSteps: string[];
}

export interface RiskAlert {
  id: string;
  type: 'risk_limit' | 'correlation' | 'concentration' | 'drawdown' | 'stress_test' | 'emergency_stop' | 'performance' | 'position_size' | 'leverage';
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'portfolio' | 'position' | 'market' | 'system';
  message: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  escalated: boolean;
  escalatedAt?: string;
  positions?: string[];
  threshold?: number;
  currentValue?: number;
  recommendedActions: string[];
  autoResolvable: boolean;
}

export interface MarketConditions {
  volatilityRegime: 'low' | 'medium' | 'high' | 'extreme';
  liquidityConditions: 'normal' | 'stressed' | 'crisis';
  marketSentiment: 'bullish' | 'neutral' | 'bearish';
  correlationRegime: 'normal' | 'elevated';
  riskOnOff: number; // -1 to 1, risk-off to risk-on
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  calmarRatio: number;
}

export interface RiskAttribution {
  byPosition: { [positionId: string]: number };
  bySector: { [sector: string]: number };
  byAssetClass: { [assetClass: string]: number };
  byCountry: { [country: string]: number };
  byCurrency: { [currency: string]: number };
  systematic: number; // Market beta risk
  idiosyncratic: number; // Position-specific risk
}

export interface RiskManagerStats {
  totalPositions: number;
  totalValue: number;
  totalRisk: number;
  alertsGenerated: number;
  alertsAcknowledged: number;
  stressTestsRun: number;
  stressTestFailures: number;
  emergencyStopsTriggered: number;
  reportsGenerated: number;
  uptime: number; // Seconds since start
}

export class RiskManager extends EventEmitter {
  private killSwitch: GlobalKillSwitch;
  private positionSizing: PositionSizingEngine;
  private config: RiskManagerConfig;
  private positions: Map<string, Position> = new Map();
  private portfolioValue: number;
  private alerts: Map<string, RiskAlert> = new Map();
  private lastStressTest: Date = new Date();
  private riskReports: RiskReport[] = [];
  private startTime: Date = new Date();
  private monitoringInterval?: NodeJS.Timeout;
  private stressTestInterval?: NodeJS.Timeout;
  private stats: RiskManagerStats;
  private isShuttingDown: boolean = false;
  
  // Historical data for correlation calculations
  private priceHistory: Map<string, number[]> = new Map();
  private returnHistory: Map<string, number[]> = new Map();

  constructor(config: RiskManagerConfig, portfolioValue: number) {
    super();
    this.config = this.validateConfig(config);
    this.portfolioValue = portfolioValue;
    
    // Initialize stats
    this.stats = {
      totalPositions: 0,
      totalValue: 0,
      totalRisk: 0,
      alertsGenerated: 0,
      alertsAcknowledged: 0,
      stressTestsRun: 0,
      stressTestFailures: 0,
      emergencyStopsTriggered: 0,
      reportsGenerated: 0,
      uptime: 0
    };
    
    // Initialize components
    this.killSwitch = new GlobalKillSwitch(config.killSwitch);
    this.positionSizing = new PositionSizingEngine(config.positionSizing, portfolioValue);
    
    this.setupEventListeners();
    this.startRiskMonitoring();
    
    if (this.config.monitoring.enableDetailedLogging) {
      console.log(`Risk Manager initialized with portfolio value: $${portfolioValue.toLocaleString()}`);
    }
  }

  /**
   * Validate configuration and set defaults
   */
  private validateConfig(config: RiskManagerConfig): RiskManagerConfig {
    // Set default monitoring values if not provided
    if (!config.monitoring) {
      config.monitoring = {
        riskCheckInterval: 30000, // 30 seconds
        reportRetentionDays: 30,
        alertRetentionDays: 7,
        enableDetailedLogging: false,
        notificationThresholds: {
          critical: 15, // 15% risk level
          warning: 10   // 10% risk level
        }
      };
    }

    // Validate portfolio limits
    if (config.portfolioLimits.maxPortfolioRisk <= 0 || config.portfolioLimits.maxPortfolioRisk > 100) {
      throw new Error('maxPortfolioRisk must be between 0 and 100');
    }

    // Validate stress test scenarios
    if (config.stressTest.enabled && config.stressTest.scenarios.length === 0) {
      console.warn('Stress testing enabled but no scenarios configured');
    }

    return config;
  }

  /**
   * Calculate position size for a new trade with enhanced validation
   */
  public calculatePositionSize(
    symbol: string,
    signal: TradeSignal,
    marketData: MarketData
  ): PositionResult {
    try {
      // Check if operations are allowed
      if (!this.killSwitch.isOperationAllowed('trade')) {
        throw new Error('Trading operations are blocked by kill switch');
      }

      // Calculate current portfolio risk
      const portfolioRisk = this.calculatePortfolioRisk();
      
      // Enhanced portfolio risk checks
      if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk) {
        throw new Error(`Portfolio risk (${portfolioRisk.totalRisk.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxPortfolioRisk}%)`);
      }

      // Check leverage limits
      if (portfolioRisk.leverage > this.config.portfolioLimits.maxLeverage) {
        throw new Error(`Portfolio leverage (${portfolioRisk.leverage.toFixed(2)}x) exceeds limit (${this.config.portfolioLimits.maxLeverage}x)`);
      }

      // Calculate position size
      const positionResult = this.positionSizing.calculatePositionSize(
        symbol,
        signal,
        marketData,
        portfolioRisk
      );

      // Enhanced position validation
      this.validateNewPosition(symbol, positionResult, portfolioRisk);

      if (this.config.monitoring.enableDetailedLogging) {
        console.log(`Position size calculated for ${symbol}: $${positionResult.positionSize.toLocaleString()}`);
      }

      return positionResult;
    } catch (error) {
      this.emit('position-calculation-error', { symbol, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Add a new position to the portfolio with enhanced tracking
   */
  public addPosition(position: Position): void {
    try {
      // Validate position data
      this.validatePosition(position);
      
      // Calculate initial risk metrics
      const enhancedPosition = this.enhancePositionWithRiskMetrics(position);
      
      this.positions.set(enhancedPosition.id, enhancedPosition);
      this.killSwitch.registerBot(enhancedPosition.id);
      
      // Update stats
      this.stats.totalPositions = this.positions.size;
      this.stats.totalValue = Array.from(this.positions.values())
        .reduce((sum, pos) => sum + Math.abs(pos.size), 0);
      
      this.emit('position-added', enhancedPosition);
      
      // Update price and return history
      this.updatePriceHistory(enhancedPosition.symbol, enhancedPosition.currentPrice);
      
      // Run risk checks
      this.checkRiskLimits();
      this.generateRiskReport();
      
      if (this.config.monitoring.enableDetailedLogging) {
        console.log(`Position added: ${enhancedPosition.symbol} - $${enhancedPosition.size.toLocaleString()}`);
      }
    } catch (error) {
      this.emit('position-add-error', { position, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Enhanced position validation
   */
  private validatePosition(position: Position): void {
    if (!position.id || position.id.trim() === '') {
      throw new Error('Position ID is required');
    }
    
    if (!position.symbol || position.symbol.trim() === '') {
      throw new Error('Position symbol is required');
    }
    
    if (position.size <= 0) {
      throw new Error('Position size must be positive');
    }
    
    if (position.entryPrice <= 0) {
      throw new Error('Entry price must be positive');
    }
    
    if (position.currentPrice <= 0) {
      throw new Error('Current price must be positive');
    }
    
    if (!['long', 'short'].includes(position.direction)) {
      throw new Error('Position direction must be "long" or "short"');
    }
    
    if (!position.currency || position.currency.trim() === '') {
      throw new Error('Position currency is required');
    }
    
    // Check for duplicate position ID
    if (this.positions.has(position.id)) {
      throw new Error(`Position with ID ${position.id} already exists`);
    }
  }

  /**
   * Enhance position with calculated risk metrics
   */
  private enhancePositionWithRiskMetrics(position: Position): Position {
    const priceChange = (position.currentPrice - position.entryPrice) / position.entryPrice;
    const unrealizedPnl = position.direction === 'long' ? 
      position.size * priceChange : 
      -position.size * priceChange;

    // Calculate VaR estimates (simplified)
    const volatility = this.estimateVolatility(position.symbol);
    const var95 = position.size * 1.645 * volatility; // 95% VaR
    const var99 = position.size * 2.326 * volatility; // 99% VaR

    // Calculate max drawdown since entry
    const maxDrawdown = Math.min(0, unrealizedPnl / position.size * 100);

    return {
      ...position,
      unrealizedPnl,
      realizedPnl: position.realizedPnl || 0,
      var95,
      var99,
      maxDrawdown,
      leverage: position.leverage || 1,
      entryTimestamp: position.entryTimestamp || new Date().toISOString(),
      lastUpdateTimestamp: new Date().toISOString(),
      asset_class: position.asset_class || 'unknown',
      currency: position.currency || 'USD'
    };
  }

  /**
   * Update position with enhanced tracking
   */
  public updatePosition(positionId: string, updates: Partial<Position>): void {
    try {
      const position = this.positions.get(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      // Calculate new metrics if price updated
      let enhancedUpdates = { ...updates };
      if (updates.currentPrice) {
        const priceChange = (updates.currentPrice - position.entryPrice) / position.entryPrice;
        const unrealizedPnl = position.direction === 'long' ? 
          position.size * priceChange : 
          -position.size * priceChange;
        
        enhancedUpdates = {
          ...enhancedUpdates,
          unrealizedPnl,
          pnl: unrealizedPnl + position.realizedPnl,
          lastUpdateTimestamp: new Date().toISOString()
        };

        // Update price history
        this.updatePriceHistory(position.symbol, updates.currentPrice);
      }

      const updatedPosition = { ...position, ...enhancedUpdates };
      this.positions.set(positionId, updatedPosition);
      
      this.emit('position-updated', updatedPosition);
      
      // Check if position needs attention
      this.checkPositionRisk(updatedPosition);

      if (this.config.monitoring.enableDetailedLogging && updates.currentPrice) {
        console.log(`Position updated: ${position.symbol} - Price: $${updates.currentPrice}, P&L: $${updatedPosition.pnl.toFixed(2)}`);
      }
    } catch (error) {
      this.emit('position-update-error', { positionId, updates, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Update price history for correlation calculations
   */
  private updatePriceHistory(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
      this.returnHistory.set(symbol, []);
    }

    const prices = this.priceHistory.get(symbol)!;
    const returns = this.returnHistory.get(symbol)!;

    // Calculate return if we have previous price
    if (prices.length > 0) {
      const previousPrice = prices[prices.length - 1];
      if (previousPrice !== undefined) {
        const returnPct = (price - previousPrice) / previousPrice;
        returns.push(returnPct);
        
        // Keep only recent returns for correlation calculation
        const maxReturns = this.config.stressTest.historicalDataDays || 252; // ~1 year
        if (returns.length > maxReturns) {
          returns.splice(0, returns.length - maxReturns);
        }
      }
    }

    prices.push(price);
    
    // Keep only recent prices
    const maxPrices = (this.config.stressTest.historicalDataDays || 252) + 1;
    if (prices.length > maxPrices) {
      prices.splice(0, prices.length - maxPrices);
    }
  }

  /**
   * Estimate volatility for a symbol
   */
  private estimateVolatility(symbol: string): number {
    const returns = this.returnHistory.get(symbol);
    if (!returns || returns.length < 2) {
      return 0.02; // Default 2% daily volatility
    }

    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Remove a position from the portfolio with cleanup
   */
  public removePosition(positionId: string): void {
    try {
      const position = this.positions.get(positionId);
      if (position) {
        this.positions.delete(positionId);
        this.killSwitch.unregisterBot(positionId);
        
        // Update stats
        this.stats.totalPositions = this.positions.size;
        this.stats.totalValue = Array.from(this.positions.values())
          .reduce((sum, pos) => sum + Math.abs(pos.size), 0);
        
        this.emit('position-removed', position);
        
        // Update portfolio metrics
        this.generateRiskReport();

        if (this.config.monitoring.enableDetailedLogging) {
          console.log(`Position removed: ${position.symbol}`);
        }
      }
    } catch (error) {
      this.emit('position-remove-error', { positionId, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Report a trade result for risk tracking with enhanced metrics
   */
  public reportTradeResult(positionId: string, pnl: number, success: boolean, metadata?: any): void {
    try {
      const position = this.positions.get(positionId);
      if (!position) {
        console.warn(`Cannot report trade result for unknown position: ${positionId}`);
        return;
      }

      const returnPct = pnl / position.size;
      
      // Update position sizing engine
      this.positionSizing.addTradeResult(returnPct);
      
      // Report to kill switch (using correct method signatures)
      if (success) {
        this.killSwitch.reportSuccess(positionId);
      } else {
        this.killSwitch.reportFailure(positionId, `Trade loss: ${pnl.toFixed(2)}`);
      }
      
      // Track losses for kill switch
      if (pnl < 0) {
        this.killSwitch.reportLoss(Math.abs(pnl));
      }
      
      // Update position with realized P&L
      if (position) {
        const updatedPosition = {
          ...position,
          realizedPnl: position.realizedPnl + pnl,
          pnl: position.unrealizedPnl + position.realizedPnl + pnl
        };
        this.positions.set(positionId, updatedPosition);
      }
      
      // Enhanced reporting with metadata
      const reportContext = {
        symbol: position.symbol,
        size: position.size,
        pnl,
        returnPct,
        ...metadata
      };
      
      this.emit('trade-result', { positionId, pnl, success, returnPct, metadata: reportContext });

      if (this.config.monitoring.enableDetailedLogging) {
        console.log(`Trade result reported: ${position.symbol} - P&L: $${pnl.toFixed(2)} (${(returnPct * 100).toFixed(2)}%)`);
      }
    } catch (error) {
      this.emit('trade-result-error', { positionId, pnl, success, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get current portfolio risk assessment with enhanced metrics
   */
  public getPortfolioRisk(): PortfolioRisk {
    return this.calculatePortfolioRisk();
  }

  /**
   * Get comprehensive portfolio statistics
   */
  public getPortfolioStatistics(): {
    positions: number;
    totalValue: number;
    totalPnL: number;
    unrealizedPnL: number;
    realizedPnL: number;
    topPositions: Position[];
    riskMetrics: PortfolioRisk;
    performanceMetrics: PerformanceMetrics;
  } {
    const positions = Array.from(this.positions.values());
    const totalValue = positions.reduce((sum, pos) => sum + Math.abs(pos.size), 0);
    const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    const unrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    const realizedPnL = positions.reduce((sum, pos) => sum + pos.realizedPnl, 0);
    
    // Get top 5 positions by size
    const topPositions = positions
      .sort((a, b) => Math.abs(b.size) - Math.abs(a.size))
      .slice(0, 5);

    const riskMetrics = this.calculatePortfolioRisk();
    const performanceMetrics = this.calculatePerformanceMetrics();

    return {
      positions: positions.length,
      totalValue,
      totalPnL,
      unrealizedPnL,
      realizedPnL,
      topPositions,
      riskMetrics,
      performanceMetrics
    };
  }

  /**
   * Calculate comprehensive performance metrics
   */
  private calculatePerformanceMetrics(): PerformanceMetrics {
    const positions = Array.from(this.positions.values());
    
    if (positions.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        winRate: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        calmarRatio: 0
      };
    }

    const totalReturn = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    const totalReturnPct = totalReturn / this.portfolioValue;
    
    // Calculate other metrics (simplified implementations)
    const winners = positions.filter(pos => pos.pnl > 0);
    const losers = positions.filter(pos => pos.pnl < 0);
    
    const winRate = winners.length / positions.length;
    const averageWin = winners.length > 0 ? winners.reduce((sum, pos) => sum + pos.pnl, 0) / winners.length : 0;
    const averageLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, pos) => sum + pos.pnl, 0)) / losers.length : 0;
    const profitFactor = averageLoss > 0 ? Math.abs(averageWin / averageLoss) : 0;
    
    const maxDrawdown = Math.min(...positions.map(pos => pos.maxDrawdown));
    
    // Simplified calculations - in production, these would use time series data
    return {
      totalReturn: totalReturnPct,
      annualizedReturn: totalReturnPct * Math.sqrt(252), // Rough annualization
      sharpeRatio: totalReturnPct > 0 ? totalReturnPct / 0.15 : 0, // Simplified
      sortinoRatio: totalReturnPct > 0 ? totalReturnPct / 0.10 : 0, // Simplified
      maxDrawdown,
      volatility: 0.15, // Simplified - would calculate from returns
      winRate,
      profitFactor,
      averageWin,
      averageLoss,
      calmarRatio: maxDrawdown < 0 ? totalReturnPct / Math.abs(maxDrawdown) : 0
    };
  }

  /**
   * Generate comprehensive risk report
   */
  public generateRiskReport(): RiskReport {
    const timestamp = new Date().toISOString();
    const portfolioRisk = this.calculatePortfolioRisk();
    const killSwitchStatus = this.killSwitch.getStatus();
    
    // Run stress tests if needed
    let stressTestResults: StressTestResult[] | undefined;
    if (this.shouldRunStressTest()) {
      stressTestResults = this.runStressTests();
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(portfolioRisk, stressTestResults);
    
    // Get current alerts
    const alerts = Array.from(this.alerts.values());
    
    const report: RiskReport = {
      id: `${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      portfolioRisk,
      killSwitchStatus,
      recommendations,
      alerts,
      marketConditions: this.assessMarketConditions(),
      performanceMetrics: this.calculatePerformanceMetrics(),
      riskAttribution: {
        byPosition: {},
        bySector: {},
        byAssetClass: {},
        byCountry: {},
        byCurrency: {},
        systematic: 0,
        idiosyncratic: 0
      }
    };

    // Only add stressTestResults if they exist
    if (stressTestResults) {
      report.stressTestResults = stressTestResults;
    }
    
    this.riskReports.push(report);
    
    // Keep only recent reports based on configuration
    const maxReports = Math.max(100, this.config.monitoring.reportRetentionDays * 24); // Rough estimate
    if (this.riskReports.length > maxReports) {
      this.riskReports = this.riskReports.slice(-maxReports);
    }
    
    // Update stats
    this.stats.reportsGenerated++;
    
    this.emit('risk-report-generated', report);
    
    return report;
  }

  /**
   * Trigger emergency risk controls with enhanced logging
   */
  public async triggerEmergencyStop(reason: string, triggeredBy: 'system' | 'user' = 'system'): Promise<void> {
    try {
      await this.killSwitch.triggerKillSwitch(reason, 'critical', triggeredBy);
      
      // Update stats
      this.stats.emergencyStopsTriggered++;
      
      // Close all positions if possible
      const positionsToClose = Array.from(this.positions.values());
      for (const position of positionsToClose) {
        this.emit('emergency-close-position', position);
      }
      
      this.createAlert('emergency_stop', 'critical', `Emergency stop triggered: ${reason}`, [], {
        triggeredBy,
        positionCount: positionsToClose.length,
        portfolioValue: this.portfolioValue
      });

      if (this.config.monitoring.enableDetailedLogging) {
        console.log(`Emergency stop triggered by ${triggeredBy}: ${reason}`);
      }
    } catch (error) {
      this.emit('emergency-stop-error', { reason, triggeredBy, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Get historical risk reports with filtering
   */
  public getRiskHistory(days: number = 30, filters?: {
    minRiskLevel?: number;
    alertTypes?: string[];
    includeStressTests?: boolean;
  }): RiskReport[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let filteredReports = this.riskReports.filter(report => 
      new Date(report.timestamp) >= cutoffDate
    );

    if (filters) {
      if (filters.minRiskLevel !== undefined) {
        filteredReports = filteredReports.filter(report => 
          report.portfolioRisk.totalRisk >= filters.minRiskLevel!
        );
      }

      if (filters.alertTypes && filters.alertTypes.length > 0) {
        filteredReports = filteredReports.filter(report => 
          report.alerts.some(alert => filters.alertTypes!.includes(alert.type))
        );
      }

      if (filters.includeStressTests === false) {
        // Create new reports without stress test results
        filteredReports = filteredReports.map(report => ({
          ...report,
          stressTestResults: undefined
        }));
      }
    }

    return filteredReports;
  }

  /**
   * Update portfolio value with validation and tracking
   */
  public updatePortfolioValue(newValue: number): void {
    if (newValue <= 0) {
      throw new Error('Portfolio value must be positive');
    }

    const previousValue = this.portfolioValue;
    this.portfolioValue = newValue;
    this.positionSizing.updatePortfolioValue(newValue);
    
    // Calculate value change
    const valueChange = newValue - previousValue;
    const percentChange = (valueChange / previousValue) * 100;
    
    this.emit('portfolio-value-updated', { 
      newValue, 
      previousValue, 
      change: valueChange, 
      percentChange 
    });

    if (this.config.monitoring.enableDetailedLogging) {
      console.log(`Portfolio value updated: $${newValue.toLocaleString()} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`);
    }
  }

  /**
   * Acknowledge a risk alert with enhanced tracking
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string = 'unknown'): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
      
      // Update stats
      this.stats.alertsAcknowledged++;
      
      this.emit('alert-acknowledged', alert);

      if (this.config.monitoring.enableDetailedLogging) {
        console.log(`Alert acknowledged: ${alert.type} by ${alert.acknowledgedBy}`);
      }
    }
  }

  /**
   * Resolve a risk alert
   */
  public resolveAlert(alertId: string, resolvedBy: string = 'system'): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      
      this.emit('alert-resolved', alert);

      if (this.config.monitoring.enableDetailedLogging) {
        console.log(`Alert resolved: ${alert.type} by ${resolvedBy}`);
      }
    }
  }

  /**
   * Get comprehensive risk manager statistics
   */
  public getStats(): RiskManagerStats {
    this.stats.uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    this.stats.totalRisk = this.calculatePortfolioRisk().totalRisk;
    return { ...this.stats };
  }

  /**
   * Get active alerts with filtering
   */
  public getActiveAlerts(filters?: {
    severity?: string[];
    types?: string[];
    unacknowledgedOnly?: boolean;
  }): RiskAlert[] {
    let alerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);

    if (filters) {
      if (filters.severity && filters.severity.length > 0) {
        alerts = alerts.filter(alert => filters.severity!.includes(alert.severity));
      }

      if (filters.types && filters.types.length > 0) {
        alerts = alerts.filter(alert => filters.types!.includes(alert.type));
      }

      if (filters.unacknowledgedOnly) {
        alerts = alerts.filter(alert => !alert.acknowledged);
      }
    }

    return alerts.sort((a, b) => {
      // Sort by severity first, then by timestamp
      const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
      const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] || 0;
      const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] || 0;
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }
      
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  /**
   * Enhanced market condition assessment
   */
  private assessMarketConditions(): MarketConditions {
    const positions = Array.from(this.positions.values());
    
    if (positions.length === 0) {
      return {
        volatilityRegime: 'low',
        liquidityConditions: 'normal',
        marketSentiment: 'neutral',
        correlationRegime: 'normal',
        riskOnOff: 0
      };
    }

    // Calculate average volatility across positions
    const avgVolatility = positions.reduce((sum, pos) => 
      sum + this.estimateVolatility(pos.symbol), 0) / positions.length;

    // Determine volatility regime
    let volatilityRegime: MarketConditions['volatilityRegime'] = 'low';
    if (avgVolatility > 0.05) volatilityRegime = 'extreme';
    else if (avgVolatility > 0.03) volatilityRegime = 'high';
    else if (avgVolatility > 0.015) volatilityRegime = 'medium';

    // Calculate average P&L to determine sentiment
    const avgPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0) / positions.length;
    const avgPnLPercentage = (avgPnL / this.portfolioValue) * 100;

    let marketSentiment: MarketConditions['marketSentiment'] = 'neutral';
    if (avgPnLPercentage > 2) marketSentiment = 'bullish';
    else if (avgPnLPercentage < -2) marketSentiment = 'bearish';

    // Simplified correlation assessment
    const portfolioRisk = this.calculatePortfolioRisk();
    const correlationRegime = portfolioRisk.correlation > 0.7 ? 'elevated' : 'normal';

    // Risk-on/off indicator based on portfolio performance and volatility
    const riskOnOff = Math.max(-1, Math.min(1, (avgPnLPercentage / 5) - (avgVolatility * 10)));

    return {
      volatilityRegime,
      liquidityConditions: avgVolatility > 0.04 ? 'crisis' : avgVolatility > 0.025 ? 'stressed' : 'normal',
      marketSentiment,
      correlationRegime,
      riskOnOff
    };
  }

  /**
   * Enhanced correlation calculation using historical returns
   */
  private calculateAverageCorrelation(positions: Position[]): number {
    if (positions.length <= 1) return 0;

    const symbols = positions.map(pos => pos.symbol);
    const correlations: number[] = [];

    // Calculate pairwise correlations using historical returns
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const correlation = this.calculatePairwiseCorrelation(symbols[i], symbols[j]);
        if (!isNaN(correlation)) {
          correlations.push(Math.abs(correlation)); // Use absolute correlation
        }
      }
    }

    if (correlations.length === 0) {
      // Fallback to sector-based correlation
      const sectors = new Set(positions.map(pos => pos.sector || 'unknown'));
      const maxSectorCount = Math.max(...Array.from(sectors).map(sector => 
        positions.filter(pos => (pos.sector || 'unknown') === sector).length
      ));
      
      return Math.min(1, maxSectorCount / positions.length);
    }

    return correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length;
  }

  /**
   * Calculate pairwise correlation between two symbols
   */
  private calculatePairwiseCorrelation(symbol1: string, symbol2: string): number {
    const returns1 = this.returnHistory.get(symbol1);
    const returns2 = this.returnHistory.get(symbol2);

    if (!returns1 || !returns2 || returns1.length < 10 || returns2.length < 10) {
      return 0.5; // Default moderate correlation
    }

    // Align the arrays to same length
    const minLength = Math.min(returns1.length, returns2.length);
    const alignedReturns1 = returns1.slice(-minLength);
    const alignedReturns2 = returns2.slice(-minLength);

    // Calculate means
    const mean1 = alignedReturns1.reduce((sum, ret) => sum + ret, 0) / minLength;
    const mean2 = alignedReturns2.reduce((sum, ret) => sum + ret, 0) / minLength;

    // Calculate covariance and standard deviations
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < minLength; i++) {
      const diff1 = alignedReturns1[i] - mean1;
      const diff2 = alignedReturns2[i] - mean2;
      
      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    const stdDev1 = Math.sqrt(variance1 / minLength);
    const stdDev2 = Math.sqrt(variance2 / minLength);

    if (stdDev1 === 0 || stdDev2 === 0) return 0;

    return (covariance / minLength) / (stdDev1 * stdDev2);
  }

  /**
   * Enhanced stress testing with realistic scenarios
   */
  private runSingleStressTest(scenario: StressTestScenario, positions: Position[]): StressTestResult {
    if (!scenario.enabled) {
      return {
        scenarioId: scenario.id,
        scenario: scenario.name,
        category: scenario.category,
        expectedLoss: 0,
        expectedLossUSD: 0,
        worstCaseVaR: 0,
        timeToRecovery: 0,
        maxDrawdown: 0,
        liquidityImpact: 0,
        passed: true,
        confidence: 0,
        affectedPositions: [],
        recommendations: ['Scenario disabled']
      };
    }

    let totalLoss = 0;
    let maxPositionLoss = 0;
    let liquidityImpact = 0;
    const affectedPositions: string[] = [];

    for (const position of positions) {
      // Calculate position-specific impact based on scenario
      let positionShock = scenario.marketShock;
      
      // Adjust shock based on position characteristics
      if (position.leverage > 1) {
        positionShock *= position.leverage; // Leveraged positions more affected
      }
      
      if (position.sector === 'crypto' && scenario.category === 'market') {
        positionShock *= 1.5; // Crypto more volatile in market shocks
      }
      
      // Apply volatility multiplier
      const volatility = this.estimateVolatility(position.symbol);
      const adjustedShock = positionShock * (1 + volatility * scenario.volatilityMultiplier);
      
      // Calculate position loss
      const shockPrice = position.direction === 'long' ? 
        position.currentPrice * (1 + adjustedShock / 100) : 
        position.currentPrice * (1 - adjustedShock / 100);
      
      const pnl = position.direction === 'long' ?
        (shockPrice - position.entryPrice) * (position.size / position.entryPrice) :
        (position.entryPrice - shockPrice) * (position.size / position.entryPrice);
      
      if (pnl < 0) {
        totalLoss += Math.abs(pnl);
        maxPositionLoss = Math.max(maxPositionLoss, Math.abs(pnl));
        affectedPositions.push(position.id);
        
        // Calculate liquidity impact
        const positionLiquidityImpact = Math.min(100, 
          (Math.abs(pnl) / position.size * 100) * scenario.liquidityReduction / 100
        );
        liquidityImpact = Math.max(liquidityImpact, positionLiquidityImpact);
      }
    }

    const lossPercentage = (totalLoss / this.portfolioValue) * 100;
    const varPercentage = (maxPositionLoss / this.portfolioValue) * 100;
    const passed = lossPercentage <= this.config.stressTest.failureThreshold;
    
    // Calculate confidence based on data quality
    const avgDataPoints = positions.reduce((sum, pos) => {
      const returns = this.returnHistory.get(pos.symbol);
      return sum + (returns ? returns.length : 0);
    }, 0) / positions.length;
    
    const confidence = Math.min(1, avgDataPoints / 100); // Higher confidence with more data

    // Generate recommendations
    const recommendations: string[] = [];
    if (!passed) {
      recommendations.push('Consider reducing position sizes to lower portfolio risk');
      if (liquidityImpact > 50) {
        recommendations.push('Improve liquidity management and diversification');
      }
      if (affectedPositions.length / positions.length > 0.8) {
        recommendations.push('Portfolio is highly correlated - consider hedging strategies');
      }
    }

    // Update stats
    this.stats.stressTestsRun++;
    if (!passed) {
      this.stats.stressTestFailures++;
    }

    return {
      scenarioId: scenario.id,
      scenario: scenario.name,
      category: scenario.category,
      expectedLoss: lossPercentage,
      expectedLossUSD: totalLoss,
      worstCaseVaR: varPercentage,
      timeToRecovery: Math.ceil(lossPercentage / 2), // Simplified: assume 2% recovery per day
      maxDrawdown: Math.min(0, -lossPercentage),
      liquidityImpact,
      passed,
      confidence,
      affectedPositions,
      recommendations
    };
  }

  /**
   * Create enhanced alert with additional context
   */
  private createAlert(
    type: RiskAlert['type'],
    severity: RiskAlert['severity'],
    message: string,
    positions: string[],
    additionalContext?: any
  ): void {
    const alert: RiskAlert = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      severity,
      category: this.getCategoryForAlertType(type),
      message,
      description: this.getDetailedDescription(type, message, additionalContext),
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
      escalated: false,
      positions,
      autoResolvable: this.isAutoResolvable(type),
      recommendedActions: this.getRecommendedActions(type, severity)
    };
    
    this.alerts.set(alert.id, alert);
    this.stats.alertsGenerated++;
    
    this.emit('alert-created', alert);

    // Auto-escalate critical alerts
    if (severity === 'critical') {
      setTimeout(() => {
        if (!alert.acknowledged && !alert.resolved) {
          alert.escalated = true;
          alert.escalatedAt = new Date().toISOString();
          this.emit('alert-escalated', alert);
        }
      }, 5 * 60 * 1000); // Escalate after 5 minutes
    }

    if (this.config.monitoring.enableDetailedLogging) {
      console.log(`Alert created: ${type} - ${severity} - ${message}`);
    }
  }

  /**
   * Get category for alert type
   */
  private getCategoryForAlertType(type: RiskAlert['type']): RiskAlert['category'] {
    const categoryMap: Record<RiskAlert['type'], RiskAlert['category']> = {
      risk_limit: 'portfolio',
      correlation: 'portfolio',
      concentration: 'portfolio',
      drawdown: 'position',
      stress_test: 'portfolio',
      emergency_stop: 'system',
      performance: 'portfolio',
      position_size: 'position',
      leverage: 'portfolio'
    };
    return categoryMap[type] || 'portfolio';
  }

  /**
   * Get detailed description for alert
   */
  private getDetailedDescription(type: string, message: string, context?: any): string {
    let description = message;
    
    if (context) {
      if (context.triggeredBy) {
        description += ` (Triggered by: ${context.triggeredBy})`;
      }
      if (context.positionCount) {
        description += ` (Affecting ${context.positionCount} positions)`;
      }
      if (context.portfolioValue) {
        description += ` (Portfolio value: $${context.portfolioValue.toLocaleString()})`;
      }
    }
    
    return description;
  }

  /**
   * Check if alert type is auto-resolvable
   */
  private isAutoResolvable(type: RiskAlert['type']): boolean {
    const autoResolvableTypes: RiskAlert['type'][] = ['risk_limit', 'correlation', 'concentration', 'leverage'];
    return autoResolvableTypes.includes(type);
  }

  /**
   * Get recommended actions for alert
   */
  private getRecommendedActions(type: RiskAlert['type'], severity: RiskAlert['severity']): string[] {
    const actionMap: Record<string, string[]> = {
      risk_limit: ['Reduce position sizes', 'Review risk parameters', 'Consider hedging'],
      correlation: ['Diversify across sectors', 'Add uncorrelated assets', 'Implement hedging'],
      concentration: ['Reduce large positions', 'Diversify holdings', 'Set position limits'],
      drawdown: ['Review stop losses', 'Consider position exit', 'Reassess trade thesis'],
      stress_test: ['Reduce portfolio risk', 'Improve diversification', 'Add defensive positions'],
      emergency_stop: ['Review system status', 'Assess market conditions', 'Contact administrator'],
      performance: ['Review strategy performance', 'Adjust parameters', 'Consider strategy changes'],
      position_size: ['Adjust position sizing', 'Review risk parameters', 'Check market conditions'],
      leverage: ['Reduce leverage', 'Add margin buffer', 'Review leverage policy']
    };

    const baseActions = actionMap[type] || ['Review and assess situation'];
    
    if (severity === 'critical') {
      return ['IMMEDIATE ACTION REQUIRED', ...baseActions, 'Consider emergency procedures'];
    }
    
    return baseActions;
  }

  /**
   * Clean up old alerts and reports
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const alertCutoff = now - (this.config.monitoring.alertRetentionDays * 24 * 60 * 60 * 1000);
    const reportCutoff = now - (this.config.monitoring.reportRetentionDays * 24 * 60 * 60 * 1000);

    // Clean up old resolved alerts
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && new Date(alert.timestamp).getTime() < alertCutoff) {
        this.alerts.delete(id);
      }
    }

    // Clean up old reports
    this.riskReports = this.riskReports.filter(report => 
      new Date(report.timestamp).getTime() >= reportCutoff
    );

    if (this.config.monitoring.enableDetailedLogging) {
      console.log(`Cleaned up old data. Alerts: ${this.alerts.size}, Reports: ${this.riskReports.length}`);
    }
  }

  /**
   * Destroy the risk manager and clean up resources
   */
  public destroy(): void {
    this.isShuttingDown = true;
    
    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.stressTestInterval) {
      clearInterval(this.stressTestInterval);
    }
    
    // Cleanup data
    this.cleanupOldData();
    
    // Destroy components
    if (this.killSwitch) {
      this.killSwitch.destroy();
    }
    
    this.removeAllListeners();
    
    if (this.config.monitoring.enableDetailedLogging) {
      console.log('Risk Manager destroyed successfully');
    }
  }

  // Private methods implementation

  private setupEventListeners(): void {
    // Listen to kill switch events
    this.killSwitch.on('kill-switch-triggered', (event) => {
      this.emit('kill-switch-triggered', event);
      this.createAlert('risk_limit', 'critical', `Kill switch triggered: ${event.reason}`, []);
    });

    this.killSwitch.on('emergency-notification', (data) => {
      this.emit('emergency-notification', data);
    });
  }

  private startRiskMonitoring(): void {
    // Risk monitoring based on configuration
    this.monitoringInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.checkRiskLimits();
        this.generateRiskReport();
        this.cleanupOldData(); // Periodic cleanup
      }
    }, this.config.monitoring.riskCheckInterval);

    // Stress tests based on configuration frequency
    const stressTestInterval = (this.config.stressTest.frequency || 24) * 60 * 60 * 1000; // Convert hours to ms
    this.stressTestInterval = setInterval(() => {
      if (!this.isShuttingDown && this.shouldRunStressTest()) {
        this.runStressTests();
      }
    }, stressTestInterval);
  }

  private calculatePortfolioRisk(): PortfolioRisk {
    const positions = Array.from(this.positions.values());
    
    if (positions.length === 0) {
      return {
        totalRisk: 0,
        dailyRisk: 0,
        concentration: 0,
        correlation: 0,
        leverage: 0,
        liquidityRisk: 0
      };
    }

    const totalValue = positions.reduce((sum, pos) => sum + Math.abs(pos.size), 0);
    const totalRisk = positions.reduce((sum, pos) => sum + pos.riskAmount, 0);
    const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);

    // Calculate concentration risk (largest position)
    const maxPosition = Math.max(...positions.map(pos => Math.abs(pos.size)));
    const concentration = (maxPosition / this.portfolioValue) * 100;

    // Enhanced correlation calculation using historical returns
    const correlation = this.calculateAverageCorrelation(positions);

    // Calculate leverage
    const leverage = totalValue / this.portfolioValue;

    // Daily risk as percentage of portfolio
    const dailyRisk = (Math.abs(totalPnL) / this.portfolioValue) * 100;

    // Enhanced liquidity risk calculation
    const avgVolatility = positions.reduce((sum, pos) => 
      sum + this.estimateVolatility(pos.symbol), 0) / positions.length;
    const liquidityRisk = Math.min(100, positions.length * 5 + avgVolatility * 100);

    return {
      totalRisk: (totalRisk / this.portfolioValue) * 100,
      dailyRisk,
      concentration,
      correlation,
      leverage,
      liquidityRisk
    };
  }

  private validateNewPosition(_symbol: string, positionResult: PositionResult, portfolioRisk: PortfolioRisk): void {
    // Check if new position would exceed concentration limits
    const newConcentration = (positionResult.positionSize / this.portfolioValue) * 100;
    if (newConcentration > this.config.portfolioLimits.maxSectorConcentration) {
      throw new Error(`Position size would exceed concentration limit: ${newConcentration.toFixed(2)}% > ${this.config.portfolioLimits.maxSectorConcentration}%`);
    }
    
    // Check total portfolio risk after new position
    const newTotalRisk = portfolioRisk.totalRisk + positionResult.riskMetrics.portfolioRisk;
    if (newTotalRisk > this.config.portfolioLimits.maxPortfolioRisk) {
      throw new Error(`New position would exceed portfolio risk limit: ${newTotalRisk.toFixed(2)}% > ${this.config.portfolioLimits.maxPortfolioRisk}%`);
    }
    
    // Check leverage limits
    const newLeverage = (portfolioRisk.leverage * this.portfolioValue + positionResult.positionSize) / this.portfolioValue;
    if (newLeverage > this.config.portfolioLimits.maxLeverage) {
      throw new Error(`New position would exceed leverage limit: ${newLeverage.toFixed(2)}x > ${this.config.portfolioLimits.maxLeverage}x`);
    }
  }

  private checkRiskLimits(): void {
    const portfolioRisk = this.calculatePortfolioRisk();
    
    // Check portfolio risk limit
    if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk) {
      this.createAlert(
        'risk_limit',
        'error',
        `Portfolio risk (${portfolioRisk.totalRisk.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxPortfolioRisk}%)`,
        []
      );
    }
    
    // Check concentration limit
    if (portfolioRisk.concentration > this.config.portfolioLimits.maxSectorConcentration) {
      this.createAlert(
        'concentration',
        'warning',
        `Position concentration (${portfolioRisk.concentration.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxSectorConcentration}%)`,
        []
      );
    }
    
    // Check correlation limit
    if (portfolioRisk.correlation > this.config.portfolioLimits.maxCorrelation) {
      this.createAlert(
        'correlation',
        'warning',
        `Portfolio correlation (${portfolioRisk.correlation.toFixed(2)}) exceeds limit (${this.config.portfolioLimits.maxCorrelation})`,
        []
      );
    }
    
    // Check leverage limit
    if (portfolioRisk.leverage > this.config.portfolioLimits.maxLeverage) {
      this.createAlert(
        'leverage',
        'error',
        `Portfolio leverage (${portfolioRisk.leverage.toFixed(2)}x) exceeds limit (${this.config.portfolioLimits.maxLeverage}x)`,
        []
      );
    }
    
    // Check drawdown limit
    if (this.config.portfolioLimits.maxDrawdown && portfolioRisk.dailyRisk > this.config.portfolioLimits.maxDrawdown) {
      this.createAlert(
        'drawdown',
        'error',
        `Portfolio drawdown (${portfolioRisk.dailyRisk.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxDrawdown}%)`,
        []
      );
    }
  }

  private checkPositionRisk(position: Position): void {
    // Check individual position drawdown
    const drawdown = ((position.entryPrice - position.currentPrice) / position.entryPrice) * 100;
    const absDrawdown = Math.abs(drawdown);
    
    if (absDrawdown > 20) { // 20% drawdown threshold
      this.createAlert(
        'drawdown',
        'error',
        `Position ${position.symbol} has ${absDrawdown.toFixed(2)}% drawdown`,
        [position.id]
      );
    }
    
    // Check position size relative to portfolio
    const positionSizePercent = (Math.abs(position.size) / this.portfolioValue) * 100;
    if (positionSizePercent > this.config.portfolioLimits.maxSectorConcentration) {
      this.createAlert(
        'position_size',
        'warning',
        `Position ${position.symbol} size (${positionSizePercent.toFixed(2)}%) exceeds concentration limit`,
        [position.id]
      );
    }
    
    // Check position leverage
    if (position.leverage > this.config.portfolioLimits.maxLeverage) {
      this.createAlert(
        'leverage',
        'warning',
        `Position ${position.symbol} leverage (${position.leverage.toFixed(2)}x) exceeds limit`,
        [position.id]
      );
    }
  }

  private shouldRunStressTest(): boolean {
    if (!this.config.stressTest.enabled) return false;
    
    const hoursSinceLastTest = (Date.now() - this.lastStressTest.getTime()) / (1000 * 60 * 60);
    const frequency = this.config.stressTest.frequency || 24; // Default 24 hours
    return hoursSinceLastTest >= frequency;
  }

  private runStressTests(): StressTestResult[] {
    this.lastStressTest = new Date();
    
    const results: StressTestResult[] = [];
    const positions = Array.from(this.positions.values());
    
    for (const scenario of this.config.stressTest.scenarios) {
      const result = this.runSingleStressTest(scenario, positions);
      results.push(result);
      
      if (!result.passed) {
        this.createAlert(
          'stress_test',
          'error',
          `Stress test failed: ${scenario.name} - Expected loss: ${result.expectedLoss.toFixed(2)}%`,
          result.affectedPositions
        );
      }
    }
    
    this.emit('stress-test-completed', results);
    return results;
  }

  private generateRecommendations(portfolioRisk: PortfolioRisk, stressTestResults?: StressTestResult[]): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];
    
    // Portfolio risk recommendations
    if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk * 0.8) {
      recommendations.push({
        id: `${Date.now()}_reduce_position`,
        type: 'reduce_position',
        priority: 'high',
        category: 'portfolio',
        description: 'Consider reducing position sizes to lower portfolio risk',
        rationale: `Portfolio risk at ${portfolioRisk.totalRisk.toFixed(2)}% is approaching limit of ${this.config.portfolioLimits.maxPortfolioRisk}%`,
        expectedImpact: `Reduce portfolio risk from ${portfolioRisk.totalRisk.toFixed(2)}% to below ${this.config.portfolioLimits.maxPortfolioRisk}%`,
        estimatedCost: 0,
        timeframe: 'immediate',
        actionRequired: portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk,
        implementationSteps: [
          'Identify largest positions',
          'Calculate target reduction amounts',
          'Execute position reductions',
          'Monitor risk levels'
        ]
      });
    }
    
    // Concentration recommendations
    if (portfolioRisk.concentration > this.config.portfolioLimits.maxSectorConcentration * 0.8) {
      recommendations.push({
        id: `${Date.now()}_diversify`,
        type: 'diversify',
        priority: 'medium',
        category: 'portfolio',
        description: 'Portfolio is becoming concentrated, consider diversifying',
        rationale: `Concentration at ${portfolioRisk.concentration.toFixed(2)}% approaching limit of ${this.config.portfolioLimits.maxSectorConcentration}%`,
        expectedImpact: `Reduce concentration risk and improve portfolio stability`,
        estimatedCost: 0,
        timeframe: 'within 1 day',
        actionRequired: portfolioRisk.concentration > this.config.portfolioLimits.maxSectorConcentration,
        implementationSteps: [
          'Identify over-concentrated positions',
          'Research diversification opportunities',
          'Execute diversification trades',
          'Monitor concentration metrics'
        ]
      });
    }
    
    // Correlation recommendations
    if (portfolioRisk.correlation > this.config.portfolioLimits.maxCorrelation * 0.8) {
      recommendations.push({
        id: `${Date.now()}_hedge`,
        type: 'hedge',
        priority: 'medium',
        category: 'portfolio',
        description: 'High correlation detected, consider hedging strategies',
        rationale: `Portfolio correlation at ${portfolioRisk.correlation.toFixed(2)} approaching limit of ${this.config.portfolioLimits.maxCorrelation}`,
        expectedImpact: `Reduce correlation and improve portfolio resilience to market shocks`,
        estimatedCost: 50, // Estimated hedging cost
        timeframe: 'within 1 day',
        actionRequired: portfolioRisk.correlation > this.config.portfolioLimits.maxCorrelation,
        implementationSteps: [
          'Analyze correlation sources',
          'Identify suitable hedging instruments',
          'Calculate hedge ratios',
          'Execute hedge positions'
        ]
      });
    }
    
    // Leverage recommendations
    if (portfolioRisk.leverage > this.config.portfolioLimits.maxLeverage * 0.8) {
      recommendations.push({
        id: `${Date.now()}_reduce_leverage`,
        type: 'reduce_position',
        priority: 'high',
        category: 'portfolio',
        description: 'Portfolio leverage is high, consider reducing exposure',
        rationale: `Leverage at ${portfolioRisk.leverage.toFixed(2)}x approaching limit of ${this.config.portfolioLimits.maxLeverage}x`,
        expectedImpact: `Reduce leverage-related risks and margin requirements`,
        estimatedCost: 0,
        timeframe: 'immediate',
        actionRequired: portfolioRisk.leverage > this.config.portfolioLimits.maxLeverage,
        implementationSteps: [
          'Identify leveraged positions',
          'Calculate deleveraging requirements',
          'Execute position reductions',
          'Monitor leverage ratios'
        ]
      });
    }
    
    // Stress test recommendations
    if (stressTestResults?.some(result => !result.passed)) {
      const failedTests = stressTestResults.filter(result => !result.passed);
      recommendations.push({
        id: `${Date.now()}_stress_test`,
        type: 'reduce_position',
        priority: 'critical',
        category: 'portfolio',
        description: 'Stress tests indicate vulnerability to market shocks',
        rationale: `${failedTests.length} stress test scenarios failed, indicating portfolio vulnerability`,
        expectedImpact: 'Improve stress test resilience and reduce tail risk',
        estimatedCost: 0,
        timeframe: 'immediate',
        actionRequired: true,
        implementationSteps: [
          'Review failed stress test scenarios',
          'Identify vulnerable positions',
          'Implement risk reduction measures',
          'Re-run stress tests to validate improvements'
        ]
      });
    }
    
    return recommendations;
  }
}