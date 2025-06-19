import EventEmitter from 'eventemitter3';

interface KillSwitchConfig {
    enableAutoTrigger: boolean;
    maxDailyLoss: number;
    maxDrawdown: number;
    maxConsecutiveFailures: number;
    emergencyContacts: string[];
    gracefulShutdownTimeout: number;
    forceShutdownAfter: number;
}
interface KillSwitchEvent {
    type: 'triggered' | 'manual_stop' | 'force_stop' | 'recovery_mode';
    timestamp: string;
    reason: string;
    triggeredBy: 'user' | 'system' | 'auto';
    severity: 'low' | 'medium' | 'high' | 'critical';
    metadata?: Record<string, any>;
}
interface KillSwitchStatus {
    isActive: boolean;
    isTriggered: boolean;
    lastTriggered?: string;
    totalTriggers: number;
    currentMode: 'normal' | 'recovery' | 'emergency';
    systemHealth: 'healthy' | 'degraded' | 'critical';
    activeBots: number;
    emergencyContact: boolean;
}
declare class GlobalKillSwitch extends EventEmitter {
    private config;
    private isTriggered;
    private isActive;
    private triggerHistory;
    private currentMode;
    private activeBots;
    private consecutiveFailures;
    private dailyLoss;
    private currentDrawdown;
    private lastReset;
    private shutdownTimers;
    constructor(config: KillSwitchConfig);
    /**
     * Manually trigger the kill switch with reason
     */
    triggerKillSwitch(reason: string, severity?: 'low' | 'medium' | 'high' | 'critical', triggeredBy?: 'user' | 'system'): Promise<void>;
    /**
     * Check if automatic trigger conditions are met
     */
    checkAutoTriggerConditions(): void;
    /**
     * Register a bot with the kill switch
     */
    registerBot(botId: string): void;
    /**
     * Unregister a bot from the kill switch
     */
    unregisterBot(botId: string): void;
    /**
     * Report a trade loss to track daily limits
     */
    reportLoss(amount: number): void;
    /**
     * Report a consecutive failure
     */
    reportFailure(botId: string, reason: string): void;
    /**
     * Report a successful trade (resets consecutive failures)
     */
    reportSuccess(botId: string): void;
    /**
     * Get current kill switch status
     */
    getStatus(): KillSwitchStatus;
    /**
     * Reset the kill switch (must be done manually after investigation)
     */
    resetKillSwitch(reason: string, resetBy: string): Promise<void>;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<KillSwitchConfig>): void;
    /**
     * Get kill switch history
     */
    getHistory(limit?: number): KillSwitchEvent[];
    /**
     * Check if kill switch is blocking bot operations
     */
    isOperationAllowed(operation: 'start' | 'trade' | 'stop'): boolean;
    private validateConfig;
    private gracefulStopAllBots;
    private forceStopAllBots;
    private gracefulStopBot;
    private clearShutdownTimer;
    private updateDrawdown;
    private determineSystemHealth;
    private setupDailyReset;
    private resetDailyCounters;
    private startHealthMonitoring;
    private sendEmergencyNotifications;
    private logKillSwitchEvent;
    /**
     * Cleanup resources
     */
    destroy(): void;
}

interface PositionSizingConfig {
    baseRiskPerTrade: number;
    maxPositionSize: number;
    minPositionSize: number;
    volatilityLookback: number;
    maxDailyRisk: number;
    correlationThreshold: number;
    riskScalingMethod: 'fixed' | 'volatility' | 'kelly' | 'adaptive';
    enableDynamicSizing: boolean;
}
interface MarketData {
    price: number;
    volume24h: number;
    volatility: number;
    liquidity: number;
    spread: number;
    timestamp: string;
}
interface TradeSignal {
    direction: 'long' | 'short';
    confidence: number;
    expectedReturn: number;
    timeHorizon: number;
    riskReward: number;
}
interface PositionResult {
    positionSize: number;
    riskAmount: number;
    leverage: number;
    stopLoss: number;
    takeProfit: number;
    reasoning: string;
    riskMetrics: {
        portfolioRisk: number;
        dailyVaR: number;
        sharpeContribution: number;
        maxDrawdownContribution: number;
    };
}
interface PortfolioRisk {
    totalRisk: number;
    dailyRisk: number;
    concentration: number;
    correlation: number;
    leverage: number;
    liquidityRisk: number;
}
declare class PositionSizingEngine {
    private config;
    private portfolioValue;
    private currentPositions;
    private historicalReturns;
    private volatilityCache;
    constructor(config: PositionSizingConfig, portfolioValue: number);
    /**
     * Calculate optimal position size for a trade signal
     */
    calculatePositionSize(symbol: string, signal: TradeSignal, marketData: MarketData, portfolioRisk: PortfolioRisk): PositionResult;
    /**
     * Calculate base position size using configured method
     */
    private calculateBaseSize;
    /**
     * Kelly criterion position sizing
     */
    private calculateKellySize;
    /**
     * Adaptive position sizing based on recent performance
     */
    private calculateAdaptiveSize;
    /**
     * Calculate volatility adjustment factor
     */
    private calculateVolatilityAdjustment;
    /**
     * Calculate liquidity adjustment factor
     */
    private calculateLiquidityAdjustment;
    /**
     * Calculate correlation adjustment factor
     */
    private calculateCorrelationAdjustment;
    /**
     * Calculate portfolio risk adjustment factor
     */
    private calculatePortfolioRiskAdjustment;
    /**
     * Apply position size limits
     */
    private applyPositionLimits;
    /**
     * Calculate risk amount for position
     */
    private calculateRiskAmount;
    /**
     * Calculate optimal stop loss price
     */
    private calculateStopLoss;
    /**
     * Calculate take profit price
     */
    private calculateTakeProfit;
    /**
     * Calculate stop loss distance based on volatility and signal
     */
    private calculateStopLossDistance;
    /**
     * Calculate comprehensive risk metrics
     */
    private calculateRiskMetrics;
    /**
     * Calculate daily Value at Risk
     */
    private calculateDailyVaR;
    /**
     * Calculate expected Sharpe ratio contribution
     */
    private calculateSharpeContribution;
    /**
     * Calculate maximum drawdown contribution
     */
    private calculateMaxDrawdownContribution;
    /**
     * Calculate recent performance for adaptive sizing
     */
    private calculateRecentPerformance;
    /**
     * Generate human-readable reasoning for position sizing decision
     */
    private generateReasoning;
    /**
     * Add trade result for adaptive sizing
     */
    addTradeResult(returnPct: number): void;
    /**
     * Update portfolio value
     */
    updatePortfolioValue(newValue: number): void;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<PositionSizingConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): PositionSizingConfig;
    private validateConfig;
}

interface RiskManagerConfig {
    killSwitch: KillSwitchConfig;
    positionSizing: PositionSizingConfig;
    portfolioLimits: {
        maxPortfolioRisk: number;
        maxSectorConcentration: number;
        maxCorrelation: number;
        rebalanceThreshold: number;
    };
    stressTest: {
        enabled: boolean;
        scenarios: StressTestScenario[];
        failureThreshold: number;
    };
}
interface StressTestScenario {
    name: string;
    description: string;
    marketShock: number;
    volatilityMultiplier: number;
    liquidityReduction: number;
    correlationIncrease: number;
}
interface Position {
    id: string;
    symbol: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    direction: 'long' | 'short';
    pnl: number;
    riskAmount: number;
    sector?: string;
    timestamp: string;
}
interface RiskReport {
    timestamp: string;
    portfolioRisk: PortfolioRisk;
    killSwitchStatus: KillSwitchStatus;
    stressTestResults?: StressTestResult[];
    recommendations: RiskRecommendation[];
    alerts: RiskAlert[];
}
interface StressTestResult {
    scenario: string;
    expectedLoss: number;
    worstCaseVaR: number;
    timeToRecovery: number;
    passed: boolean;
}
interface RiskRecommendation {
    type: 'reduce_position' | 'hedge' | 'rebalance' | 'diversify' | 'increase_cash';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    expectedImpact: string;
    positions?: string[];
}
interface RiskAlert {
    id: string;
    type: 'risk_limit' | 'correlation' | 'concentration' | 'drawdown' | 'stress_test' | 'emergency_stop';
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: string;
    acknowledged: boolean;
    positions?: string[];
}
declare class RiskManager extends EventEmitter {
    private killSwitch;
    private positionSizing;
    private config;
    private positions;
    private portfolioValue;
    private alerts;
    private lastStressTest;
    private riskReports;
    constructor(config: RiskManagerConfig, portfolioValue: number);
    /**
     * Calculate position size for a new trade
     */
    calculatePositionSize(symbol: string, signal: TradeSignal, marketData: MarketData): PositionResult;
    /**
     * Add a new position to the portfolio
     */
    addPosition(position: Position): void;
    /**
     * Update an existing position
     */
    updatePosition(positionId: string, updates: Partial<Position>): void;
    /**
     * Remove a position from the portfolio
     */
    removePosition(positionId: string): void;
    /**
     * Report a trade result for risk tracking
     */
    reportTradeResult(positionId: string, pnl: number, success: boolean): void;
    /**
     * Get current portfolio risk assessment
     */
    getPortfolioRisk(): PortfolioRisk;
    /**
     * Generate comprehensive risk report
     */
    generateRiskReport(): RiskReport;
    /**
     * Trigger emergency risk controls
     */
    triggerEmergencyStop(reason: string): Promise<void>;
    /**
     * Get historical risk reports
     */
    getRiskHistory(days?: number): RiskReport[];
    /**
     * Update portfolio value
     */
    updatePortfolioValue(newValue: number): void;
    /**
     * Acknowledge a risk alert
     */
    acknowledgeAlert(alertId: string): void;
    private setupEventListeners;
    private startRiskMonitoring;
    private calculatePortfolioRisk;
    private calculateAverageCorrelation;
    private checkRiskLimits;
    private checkPositionRisk;
    private validateNewPosition;
    private shouldRunStressTest;
    private runStressTests;
    private runSingleStressTest;
    private generateRecommendations;
    private createAlert;
    /**
     * Cleanup resources
     */
    destroy(): void;
}

declare const createDefaultKillSwitchConfig: () => KillSwitchConfig;
declare const createDefaultPositionSizingConfig: () => PositionSizingConfig;
declare const createDefaultStressTestScenarios: () => StressTestScenario[];
declare const createDefaultRiskManagerConfig: () => RiskManagerConfig;
declare const calculateSharpeRatio: (returns: number[], riskFreeRate?: number) => number;
declare const calculateMaxDrawdown: (returns: number[]) => number;
declare const calculateVaR: (returns: number[], confidenceLevel?: number) => number;
declare const calculateCorrelation: (returns1: number[], returns2: number[]) => number;
declare const classifyRiskLevel: (portfolioRisk: number, maxRisk: number) => "low" | "medium" | "high" | "critical";
declare const calculateKellyFraction: (winProbability: number, avgWin: number, avgLoss: number) => number;
declare const createRiskAlert: (type: RiskAlert["type"], severity: RiskAlert["severity"], message: string, positions?: string[]) => RiskAlert;
declare const analyzePortfolioHealth: (positions: Position[], portfolioValue: number) => {
    diversificationScore: number;
    concentrationRisk: number;
    liquidityScore: number;
    overallHealth: "excellent" | "good" | "fair" | "poor";
};
declare const VERSION = "1.0.0";

export { GlobalKillSwitch, type KillSwitchConfig, type KillSwitchEvent, type KillSwitchStatus, type MarketData, type PortfolioRisk, type Position, type PositionResult, type PositionSizingConfig, PositionSizingEngine, type RiskAlert, RiskManager, type RiskManagerConfig, type RiskRecommendation, type RiskReport, type StressTestResult, type StressTestScenario, type TradeSignal, VERSION, analyzePortfolioHealth, calculateCorrelation, calculateKellyFraction, calculateMaxDrawdown, calculateSharpeRatio, calculateVaR, classifyRiskLevel, createDefaultKillSwitchConfig, createDefaultPositionSizingConfig, createDefaultRiskManagerConfig, createDefaultStressTestScenarios, createRiskAlert };
