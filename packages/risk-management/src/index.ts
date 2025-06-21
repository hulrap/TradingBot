// Main risk management exports
export {
  GlobalKillSwitch,
  type KillSwitchConfig,
  type KillSwitchEvent,
  type KillSwitchStatus
} from './global-kill-switch';

export {
  PositionSizingEngine,
  type PositionSizingConfig,
  type MarketData,
  type TradeSignal,
  type PositionResult,
  type PortfolioRisk
} from './position-sizing';

export {
  RiskManager,
  type RiskManagerConfig,
  type StressTestScenario,
  type Position,
  type RiskReport,
  type StressTestResult,
  type RiskRecommendation,
  type RiskAlert
} from './risk-manager';

// Import types for use in utility functions
import type { KillSwitchConfig } from './global-kill-switch';
import type { PositionSizingConfig } from './position-sizing';
import type { 
  StressTestScenario, 
  RiskManagerConfig,
  RiskAlert,
  Position 
} from './risk-manager';

// Utility functions and helpers
export const createDefaultKillSwitchConfig = (): KillSwitchConfig => ({
  enableAutoTrigger: true,
  maxDailyLoss: 1000, // $1000 daily loss limit
  maxDrawdown: 15, // 15% maximum drawdown
  maxConsecutiveFailures: 5,
  emergencyContacts: [],
  gracefulShutdownTimeout: 30000, // 30 seconds
  forceShutdownAfter: 120000, // 2 minutes
  enableEnhancedMonitoring: true, // Enable sophisticated monitoring
  volatilityThreshold: 0.5, // 50% volatility threshold
  liquidityThreshold: 0.3, // 30% minimum liquidity
  correlationThreshold: 0.8, // 80% correlation breakdown threshold
  recoveryTimeLimit: 24 * 60 * 60 * 1000, // 24 hours recovery limit
  enablePredictiveTriggers: false // Disable ML triggers by default
});

export const createDefaultPositionSizingConfig = (): PositionSizingConfig => ({
  baseRiskPerTrade: 2, // 2% of portfolio per trade
  maxPositionSize: 10, // 10% max position size
  minPositionSize: 100, // $100 minimum
  volatilityLookback: 30, // 30 days
  maxDailyRisk: 10, // 10% daily risk limit
  correlationThreshold: 0.7, // 70% correlation threshold
  riskScalingMethod: 'volatility',
  enableDynamicSizing: true,
  enableVolatilityCaching: true,
  volatilityCacheTTL: 300000, // 5 minutes
  enablePositionTracking: true,
  maxPositionHistory: 1000,
  kellyFractionCap: 0.25,
  adaptivePerformanceWindow: 50
});

export const createDefaultStressTestScenarios = (): StressTestScenario[] => [
  {
    name: 'Market Crash',
    description: '20% market decline with increased volatility',
    marketShock: -20,
    volatilityMultiplier: 2.0,
    liquidityReduction: 50,
    correlationIncrease: 0.3,
    duration: 7, // 1 week stress
    recoveryTime: 90 // 3 months recovery
  },
  {
    name: 'Flash Crash',
    description: '10% sudden decline with liquidity crisis',
    marketShock: -10,
    volatilityMultiplier: 3.0,
    liquidityReduction: 80,
    correlationIncrease: 0.5,
    duration: 1, // 1 day flash
    recoveryTime: 30 // 1 month recovery
  },
  {
    name: 'Black Swan',
    description: '30% market decline with extreme conditions',
    marketShock: -30,
    volatilityMultiplier: 4.0,
    liquidityReduction: 90,
    correlationIncrease: 0.8,
    duration: 30, // 1 month stress
    recoveryTime: 365 // 1 year recovery
  },
  {
    name: 'Sector Rotation',
    description: 'Moderate decline with correlation changes',
    marketShock: -5,
    volatilityMultiplier: 1.5,
    liquidityReduction: 20,
    correlationIncrease: 0.6,
    duration: 14, // 2 weeks
    recoveryTime: 60 // 2 months recovery
  }
];

export const createDefaultRiskManagerConfig = (): RiskManagerConfig => ({
  killSwitch: createDefaultKillSwitchConfig(),
  positionSizing: createDefaultPositionSizingConfig(),
  portfolioLimits: {
    maxPortfolioRisk: 20, // 20% maximum portfolio risk
    maxSectorConcentration: 25, // 25% maximum in single sector
    maxCorrelation: 0.8, // 80% maximum correlation
    rebalanceThreshold: 15, // Rebalance at 15% deviation
    maxLeverage: 3.0, // Maximum 3x leverage
    maxDrawdownLimit: 20, // 20% maximum drawdown
    concentrationDecayFactor: 0.95, // Concentration decay factor
    liquidityBufferPercent: 10 // 10% liquidity buffer
  },
  stressTest: {
    enabled: true,
    scenarios: createDefaultStressTestScenarios(),
    failureThreshold: 15, // 15% maximum acceptable loss in stress test
    monteCarloIterations: 10000, // 10k Monte Carlo iterations
    confidenceLevel: 0.95, // 95% confidence level
    timeHorizon: 21 // 21-day stress test horizon
  },
  riskModels: {
    enableValueAtRisk: true,
    enableExpectedShortfall: true,
    enableTailRisk: true,
    enableCorrelationAnalysis: true,
    enableRegimeDetection: true,
    varConfidenceLevel: 0.95,
    shortfallConfidenceLevel: 0.97,
    correlationWindow: 252,
    regimeChangeThreshold: 0.05
  },
  monitoring: {
    realTimeAlerts: true,
    alertCooldownPeriod: 300000, // 5 minutes cooldown
    riskReportFrequency: 30000, // 30 seconds
    performanceTrackingWindow: 30, // 30 days
    enablePredictiveAnalytics: false
  }
});

// Utility functions for risk calculations
export const calculateSharpeRatio = (returns: number[], riskFreeRate: number = 0.02): number => {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);
  
  return volatility > 0 ? (avgReturn - riskFreeRate) / volatility : 0;
};

export const calculateMaxDrawdown = (returns: number[]): number => {
  if (returns.length === 0) return 0;
  
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  
  for (const ret of returns) {
    cumulative += ret;
    peak = Math.max(peak, cumulative);
    const drawdown = (peak - cumulative) / Math.max(peak, 1);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  
  return maxDrawdown;
};

export const calculateVaR = (returns: number[], confidenceLevel: number = 0.95): number => {
  if (returns.length === 0) return 0;
  
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sortedReturns.length - 1, 
    Math.floor((1 - confidenceLevel) * sortedReturns.length)));
  
  return sortedReturns.at(index) ?? 0;
};

export const calculateCorrelation = (returns1: number[], returns2: number[]): number => {
  if (returns1.length !== returns2.length || returns1.length === 0) return 0;
  
  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;
  
  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;
  
  for (let i = 0; i < returns1.length; i++) {
    const val1 = returns1[i];
    const val2 = returns2[i];
    if (val1 !== undefined && val2 !== undefined) {
      const diff1 = val1 - mean1;
      const diff2 = val2 - mean2;
      
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }
  }
  
  const denominator = Math.sqrt(sumSq1 * sumSq2);
  return denominator > 0 ? numerator / denominator : 0;
};

// Risk level classification
export const classifyRiskLevel = (
  portfolioRisk: number,
  maxRisk: number
): 'low' | 'medium' | 'high' | 'critical' => {
  const riskRatio = portfolioRisk / maxRisk;
  
  if (riskRatio <= 0.5) return 'low';
  if (riskRatio <= 0.75) return 'medium';
  if (riskRatio <= 1.0) return 'high';
  return 'critical';
};

// Position sizing helpers
export const calculateKellyFraction = (
  winProbability: number,
  avgWin: number,
  avgLoss: number
): number => {
  if (avgLoss === 0) return 0;
  
  const b = Math.abs(avgWin / avgLoss);
  const kellyFraction = (b * winProbability - (1 - winProbability)) / b;
  
  // Apply safety margin (25% of optimal Kelly)
  return Math.max(0, Math.min(0.25, kellyFraction * 0.25));
};

// Risk alert helpers
export const createRiskAlert = (
  type: RiskAlert['type'],
  severity: RiskAlert['severity'],
  message: string,
  positions: string[] = [],
  metadata?: Partial<RiskAlert['metadata']>
): RiskAlert => ({
  id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type,
  severity,
  message,
  timestamp: new Date().toISOString(),
  acknowledged: false,
  positions,
  metadata: {
    currentValue: 0,
    threshold: 0,
    trend: 'stable',
    historicalContext: 'No historical context available',
    recommendedAction: 'Review and acknowledge alert',
    ...metadata
  }
});

// Portfolio analysis helpers
export const analyzePortfolioHealth = (
  positions: Position[],
  portfolioValue: number
): {
  diversificationScore: number;
  concentrationRisk: number;
  liquidityScore: number;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
} => {
  if (positions.length === 0) {
    return {
      diversificationScore: 0,
      concentrationRisk: 0,
      liquidityScore: 0,
      overallHealth: 'poor'
    };
  }
  
  // Calculate diversification score
  const sectors = new Set(positions.map(p => p.sector || 'unknown'));
  const diversificationScore = Math.min(100, (sectors.size / Math.max(positions.length / 3, 1)) * 100);
  
  // Calculate concentration risk
  const positionSizes = positions.map(p => Math.abs(p.size));
  const maxPosition = Math.max(...positionSizes);
  const concentrationRisk = (maxPosition / portfolioValue) * 100;
  
  // Calculate liquidity score (simplified)
  const avgPositionSize = positionSizes.reduce((sum, size) => sum + size, 0) / positions.length;
  const liquidityScore = Math.max(0, 100 - (avgPositionSize / portfolioValue) * 50);
  
  // Determine overall health
  const avgScore = (diversificationScore + (100 - concentrationRisk) + liquidityScore) / 3;
  let overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  
  if (avgScore >= 80) overallHealth = 'excellent';
  else if (avgScore >= 60) overallHealth = 'good';
  else if (avgScore >= 40) overallHealth = 'fair';
  else overallHealth = 'poor';
  
  return {
    diversificationScore: Math.round(diversificationScore),
    concentrationRisk: Math.round(concentrationRisk * 100) / 100,
    liquidityScore: Math.round(liquidityScore),
    overallHealth
  };
};

// Version export
export const VERSION = '1.0.0';