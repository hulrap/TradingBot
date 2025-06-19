import EventEmitter from 'eventemitter3';
import { GlobalKillSwitch, KillSwitchConfig, KillSwitchStatus } from './global-kill-switch';
import { PositionSizingEngine, PositionSizingConfig, PositionResult, PortfolioRisk, TradeSignal, MarketData } from './position-sizing';

export interface RiskManagerConfig {
  killSwitch: KillSwitchConfig;
  positionSizing: PositionSizingConfig;
  portfolioLimits: {
    maxPortfolioRisk: number; // Maximum portfolio risk percentage
    maxSectorConcentration: number; // Maximum concentration in single sector
    maxCorrelation: number; // Maximum correlation between positions
    rebalanceThreshold: number; // Trigger rebalancing when exceeded
  };
  stressTest: {
    enabled: boolean;
    scenarios: StressTestScenario[];
    failureThreshold: number; // Max acceptable loss in stress test
  };
}

export interface StressTestScenario {
  name: string;
  description: string;
  marketShock: number; // Market down percentage
  volatilityMultiplier: number; // Volatility increase factor
  liquidityReduction: number; // Liquidity reduction percentage
  correlationIncrease: number; // Correlation increase in crisis
}

export interface Position {
  id: string;
  symbol: string;
  size: number; // Position size in USD
  entryPrice: number;
  currentPrice: number;
  direction: 'long' | 'short';
  pnl: number; // Current P&L
  riskAmount: number; // Amount at risk
  sector?: string;
  timestamp: string;
}

export interface RiskReport {
  timestamp: string;
  portfolioRisk: PortfolioRisk;
  killSwitchStatus: KillSwitchStatus;
  stressTestResults?: StressTestResult[];
  recommendations: RiskRecommendation[];
  alerts: RiskAlert[];
}

export interface StressTestResult {
  scenario: string;
  expectedLoss: number;
  worstCaseVaR: number;
  timeToRecovery: number; // Estimated days to recover
  passed: boolean;
}

export interface RiskRecommendation {
  type: 'reduce_position' | 'hedge' | 'rebalance' | 'diversify' | 'increase_cash';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImpact: string;
  positions?: string[]; // Affected position IDs
}

export interface RiskAlert {
  id: string;
  type: 'risk_limit' | 'correlation' | 'concentration' | 'drawdown' | 'stress_test' | 'emergency_stop';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  positions?: string[];
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

  constructor(config: RiskManagerConfig, portfolioValue: number) {
    super();
    this.config = config;
    this.portfolioValue = portfolioValue;
    
    // Initialize components
    this.killSwitch = new GlobalKillSwitch(config.killSwitch);
    this.positionSizing = new PositionSizingEngine(config.positionSizing, portfolioValue);
    
    this.setupEventListeners();
    this.startRiskMonitoring();
  }

  /**
   * Calculate position size for a new trade
   */
  public calculatePositionSize(
    symbol: string,
    signal: TradeSignal,
    marketData: MarketData
  ): PositionResult {
    // Check if operations are allowed
    if (!this.killSwitch.isOperationAllowed('trade')) {
      throw new Error('Trading operations are blocked by kill switch');
    }

    // Calculate current portfolio risk
    const portfolioRisk = this.calculatePortfolioRisk();
    
    // Check portfolio risk limits
    if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk) {
      throw new Error(`Portfolio risk (${portfolioRisk.totalRisk.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxPortfolioRisk}%)`);
    }

    // Calculate position size
    const positionResult = this.positionSizing.calculatePositionSize(
      symbol,
      signal,
      marketData,
      portfolioRisk
    );

    // Validate position against portfolio limits
    this.validateNewPosition(symbol, positionResult, portfolioRisk);

    return positionResult;
  }

  /**
   * Add a new position to the portfolio
   */
  public addPosition(position: Position): void {
    this.positions.set(position.id, position);
    this.killSwitch.registerBot(position.id);
    
    this.emit('position-added', position);
    
    // Run risk checks
    this.checkRiskLimits();
    this.generateRiskReport();
  }

  /**
   * Update an existing position
   */
  public updatePosition(positionId: string, updates: Partial<Position>): void {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const updatedPosition = { ...position, ...updates };
    this.positions.set(positionId, updatedPosition);
    
    this.emit('position-updated', updatedPosition);
    
    // Check if position needs attention
    this.checkPositionRisk(updatedPosition);
  }

  /**
   * Remove a position from the portfolio
   */
  public removePosition(positionId: string): void {
    const position = this.positions.get(positionId);
    if (position) {
      this.positions.delete(positionId);
      this.killSwitch.unregisterBot(positionId);
      
      this.emit('position-removed', position);
      
      // Update portfolio metrics
      this.generateRiskReport();
    }
  }

  /**
   * Report a trade result for risk tracking
   */
  public reportTradeResult(positionId: string, pnl: number, success: boolean): void {
    const position = this.positions.get(positionId);
    if (!position) return;

    const returnPct = pnl / position.size;
    
    // Update position sizing engine
    this.positionSizing.addTradeResult(returnPct);
    
    // Report to kill switch
    if (success) {
      this.killSwitch.reportSuccess(positionId);
    } else {
      this.killSwitch.reportFailure(positionId, `Trade loss: ${pnl.toFixed(2)}`);
    }
    
    // Track losses for kill switch
    if (pnl < 0) {
      this.killSwitch.reportLoss(Math.abs(pnl));
    }
    
    this.emit('trade-result', { positionId, pnl, success, returnPct });
  }

  /**
   * Get current portfolio risk assessment
   */
  public getPortfolioRisk(): PortfolioRisk {
    return this.calculatePortfolioRisk();
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
      timestamp,
      portfolioRisk,
      killSwitchStatus,
      stressTestResults,
      recommendations,
      alerts
    };
    
    this.riskReports.push(report);
    
    // Keep only last 100 reports
    if (this.riskReports.length > 100) {
      this.riskReports = this.riskReports.slice(-100);
    }
    
    this.emit('risk-report-generated', report);
    
    return report;
  }

  /**
   * Trigger emergency risk controls
   */
  public async triggerEmergencyStop(reason: string): Promise<void> {
    await this.killSwitch.triggerKillSwitch(reason, 'critical', 'user');
    
    // Close all positions if possible
    for (const position of this.positions.values()) {
      this.emit('emergency-close-position', position);
    }
    
    this.createAlert('emergency_stop', 'critical', `Emergency stop triggered: ${reason}`, []);
  }

  /**
   * Get historical risk reports
   */
  public getRiskHistory(days: number = 30): RiskReport[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.riskReports.filter(report => 
      new Date(report.timestamp) >= cutoffDate
    );
  }

  /**
   * Update portfolio value
   */
  public updatePortfolioValue(newValue: number): void {
    this.portfolioValue = newValue;
    this.positionSizing.updatePortfolioValue(newValue);
    
    this.emit('portfolio-value-updated', newValue);
  }

  /**
   * Acknowledge a risk alert
   */
  public acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
    }
  }

  // Private methods

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
    // Risk monitoring every 30 seconds
    setInterval(() => {
      this.checkRiskLimits();
      this.generateRiskReport();
    }, 30000);

    // Daily stress tests
    setInterval(() => {
      if (this.shouldRunStressTest()) {
        this.runStressTests();
      }
    }, 60 * 60 * 1000); // Check every hour
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

    // Simplified correlation calculation
    const correlation = this.calculateAverageCorrelation(positions);

    // Calculate leverage
    const leverage = totalValue / this.portfolioValue;

    // Daily risk as percentage of portfolio
    const dailyRisk = (Math.abs(totalPnL) / this.portfolioValue) * 100;

    // Simplified liquidity risk
    const liquidityRisk = Math.min(100, positions.length * 5); // More positions = higher liquidity risk

    return {
      totalRisk: (totalRisk / this.portfolioValue) * 100,
      dailyRisk,
      concentration,
      correlation,
      leverage,
      liquidityRisk
    };
  }

  private calculateAverageCorrelation(positions: Position[]): number {
    // Simplified correlation calculation
    // In production, this would use actual price correlation data
    const sectors = new Set(positions.map(pos => pos.sector || 'unknown'));
    const maxSectorCount = Math.max(...Array.from(sectors).map(sector => 
      positions.filter(pos => (pos.sector || 'unknown') === sector).length
    ));
    
    return Math.min(1, maxSectorCount / positions.length);
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
  }

  private validateNewPosition(symbol: string, positionResult: PositionResult, portfolioRisk: PortfolioRisk): void {
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
  }

  private shouldRunStressTest(): boolean {
    if (!this.config.stressTest.enabled) return false;
    
    const daysSinceLastTest = (Date.now() - this.lastStressTest.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastTest >= 1; // Run daily
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
          []
        );
      }
    }
    
    this.emit('stress-test-completed', results);
    return results;
  }

  private runSingleStressTest(scenario: StressTestScenario, positions: Position[]): StressTestResult {
    let totalLoss = 0;
    let worstCaseVaR = 0;
    
    for (const position of positions) {
      // Simulate price shock
      const priceShock = scenario.marketShock / 100;
      const shockPrice = position.direction === 'long' ? 
        position.currentPrice * (1 + priceShock) : 
        position.currentPrice * (1 - priceShock);
      
      const pnl = position.direction === 'long' ?
        (shockPrice - position.entryPrice) * (position.size / position.entryPrice) :
        (position.entryPrice - shockPrice) * (position.size / position.entryPrice);
      
      totalLoss += Math.abs(pnl);
      worstCaseVaR += Math.abs(pnl) * scenario.volatilityMultiplier;
    }
    
    const lossPercentage = (totalLoss / this.portfolioValue) * 100;
    const varPercentage = (worstCaseVaR / this.portfolioValue) * 100;
    const passed = lossPercentage <= this.config.stressTest.failureThreshold;
    
    return {
      scenario: scenario.name,
      expectedLoss: lossPercentage,
      worstCaseVaR: varPercentage,
      timeToRecovery: Math.ceil(lossPercentage / 2), // Simplified: 2% recovery per day
      passed
    };
  }

  private generateRecommendations(portfolioRisk: PortfolioRisk, stressTestResults?: StressTestResult[]): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];
    
    // Portfolio risk recommendations
    if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk * 0.8) {
      recommendations.push({
        type: 'reduce_position',
        priority: 'high',
        description: 'Consider reducing position sizes to lower portfolio risk',
        expectedImpact: `Reduce portfolio risk from ${portfolioRisk.totalRisk.toFixed(2)}% to below ${this.config.portfolioLimits.maxPortfolioRisk}%`
      });
    }
    
    // Concentration recommendations
    if (portfolioRisk.concentration > this.config.portfolioLimits.maxSectorConcentration * 0.8) {
      recommendations.push({
        type: 'diversify',
        priority: 'medium',
        description: 'Portfolio is becoming concentrated, consider diversifying',
        expectedImpact: `Reduce concentration risk from ${portfolioRisk.concentration.toFixed(2)}%`
      });
    }
    
    // Correlation recommendations
    if (portfolioRisk.correlation > this.config.portfolioLimits.maxCorrelation * 0.8) {
      recommendations.push({
        type: 'hedge',
        priority: 'medium',
        description: 'High correlation detected, consider hedging strategies',
        expectedImpact: `Reduce correlation from ${portfolioRisk.correlation.toFixed(2)} to below ${this.config.portfolioLimits.maxCorrelation}`
      });
    }
    
    // Stress test recommendations
    if (stressTestResults?.some(result => !result.passed)) {
      recommendations.push({
        type: 'reduce_position',
        priority: 'critical',
        description: 'Stress tests indicate vulnerability to market shocks',
        expectedImpact: 'Improve stress test resilience and reduce tail risk'
      });
    }
    
    return recommendations;
  }

  private createAlert(
    type: RiskAlert['type'],
    severity: RiskAlert['severity'],
    message: string,
    positions: string[]
  ): void {
    const alert: RiskAlert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      positions
    };
    
    this.alerts.set(alert.id, alert);
    this.emit('risk-alert', alert);
    
    // Auto-remove old alerts (keep last 50)
    const alertArray = Array.from(this.alerts.values());
    if (alertArray.length > 50) {
      const oldestAlerts = alertArray
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(0, alertArray.length - 50);
      
      for (const oldAlert of oldestAlerts) {
        this.alerts.delete(oldAlert.id);
      }
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.killSwitch.destroy();
    this.removeAllListeners();
    this.positions.clear();
    this.alerts.clear();
  }
}