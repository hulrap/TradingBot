/**
 * @file Bot Configuration Types.
 * 
 * Configuration types for trading bots including arbitrage bots, copy trading bots,
 * MEV bots, yield farming bots, and other trading strategies.
 * 
 * Features:
 * - Multi-strategy bot configurations
 * - Risk management settings
 * - Performance thresholds and limits
 * - Strategy-specific parameters
 * - Bot lifecycle management.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';


// ========================================
// BASE BOT CONFIGURATION
// ========================================

/**
 * Bot identifier.
 */
type BotId = string;

/**
 * Bot types.
 */
type BotType = 
  | 'arbitrage'
  | 'copy-trading'
  | 'mev-bot'
  | 'yield-farming'
  | 'grid-trading'
  | 'dca-bot'
  | 'market-making'
  | 'liquidation'
  | 'sandwich'
  | 'frontrun'
  | 'custom';

/**
 * Bot status.
 */
type BotStatus = 
  | 'active'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'maintenance';

/**
 * Bot priority levels.
 */
type BotPriority = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

/**
 * Risk management configuration.
 */
interface RiskManagementConfig {
  /** Maximum position size per trade. */
  maxPositionSize: string;
  
  /** Maximum daily loss limit. */
  maxDailyLoss: string;
  
  /** Maximum weekly loss limit. */
  maxWeeklyLoss: string;
  
  /** Maximum monthly loss limit. */
  maxMonthlyLoss: string;
  
  /** Stop loss percentage. */
  stopLossPercent: number;
  
  /** Take profit percentage. */
  takeProfitPercent: number;
  
  /** Maximum slippage tolerance. */
  maxSlippage: number;
  
  /** Maximum gas price. */
  maxGasPrice: string;
  
  /** Portfolio allocation limits. */
  allocationLimits: {
    perToken: number;
    perChain: number;
    perStrategy: number;
  };
  
  /** Emergency stop conditions. */
  emergencyStop: {
    enabled: boolean;
    conditions: string[];
    actions: string[];
  };
}

/**
 * Performance configuration.
 */
interface PerformanceConfig {
  /** Execution timeout. */
  executionTimeout: number;
  
  /** Maximum parallel operations. */
  maxParallelOps: number;
  
  /** Retry configuration. */
  retry: {
    maxRetries: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  
  /** Performance thresholds. */
  thresholds: {
    minProfitThreshold: string;
    maxExecutionTime: number;
    minSuccessRate: number;
  };
  
  /** Resource limits. */
  resources: {
    maxMemoryUsage: number;
    maxCpuUsage: number;
    maxNetworkBandwidth: number;
  };
}

/**
 * Monitoring configuration.
 */
interface MonitoringConfig {
  /** Enable monitoring. */
  enabled: boolean;
  
  /** Metrics collection interval. */
  metricsInterval: number;
  
  /** Health check interval. */
  healthCheckInterval: number;
  
  /** Alert thresholds. */
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    profitLoss: string;
    gasUsage: string;
  };
  
  /** Notification settings. */
  notifications: {
    email: boolean;
    slack: boolean;
    telegram: boolean;
    webhook?: string;
  };
  
  /** Logging configuration. */
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    retention: number;
    structured: boolean;
  };
}

/**
 * Bot metadata.
 */
interface BotMetadata {
  /** Bot version. */
  version: string;
  
  /** Bot tags. */
  tags: string[];
  
  /** Bot category. */
  category: string;
  
  /** Bot environment. */
  environment: 'development' | 'staging' | 'production';
  
  /** Bot configuration template. */
  template?: string;
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Base bot configuration interface.
 */
interface BaseBotConfig {
  /** Bot identifier. */
  id: BotId;
  
  /** Bot name. */
  name: string;
  
  /** Bot description. */
  description?: string;
  
  /** Bot type. */
  type: BotType;
  
  /** Bot status. */
  status: BotStatus;
  
  /** Bot priority. */
  priority: BotPriority;
  
  /** Target chains. */
  chains: SupportedChain[];
  
  /** Owner user ID. */
  ownerId: string;
  
  /** Wallet addresses to use. */
  walletAddresses: Address[];
  
  /** Risk management settings. */
  riskManagement: RiskManagementConfig;
  
  /** Performance settings. */
  performance: PerformanceConfig;
  
  /** Monitoring settings. */
  monitoring: MonitoringConfig;
  
  /** Bot metadata. */
  metadata: BotMetadata;
  
  /** Creation and update timestamps. */
  timestamps: {
    created: number;
    updated: number;
    lastRun?: number;
    nextRun?: number;
  };
}

// ========================================
// ARBITRAGE BOT CONFIGURATION
// ========================================

/**
 * Arbitrage bot configuration.
 */
interface ArbitrageBotConfig extends BaseBotConfig {
  type: 'arbitrage';
  
  /** Arbitrage-specific settings. */
  arbitrage: {
    /** Minimum profit threshold. */
    minProfitThreshold: string;
    
    /** Maximum price impact. */
    maxPriceImpact: number;
    
    /** Supported DEXes. */
    supportedDEXes: string[];
    
    /** Token whitelist. */
    tokenWhitelist: Address[];
    
    /** Token blacklist. */
    tokenBlacklist: Address[];
    
    /** Cross-chain arbitrage. */
    crossChain: {
      enabled: boolean;
      bridgeProviders: string[];
      maxBridgeTime: number;
      minBridgeProfit: string;
    };
    
    /** Flash loan configuration. */
    flashLoan: {
      enabled: boolean;
      providers: string[];
      maxAmount: string;
      feeThreshold: number;
    };
    
    /** Route optimization. */
    routing: {
      maxHops: number;
      preferredRoutes: string[];
      gasOptimization: boolean;
    };
  };
}

// ========================================
// COPY TRADING BOT CONFIGURATION
// ========================================

/**
 * Copy trader configuration.
 */
interface CopyTraderConfig {
  /** Trader address. */
  address: Address;
  
  /** Trader name/label. */
  name?: string;
  
  /** Allocation weight. */
  weight: number;
  
  /** Copy ratio for this trader. */
  copyRatio: number;
  
  /** Whether copying is enabled. */
  enabled: boolean;
  
  /** Trader-specific filters. */
  filters?: {
    minTradeSize?: string;
    maxTradeSize?: string;
    allowedTokens?: Address[];
    blockedTokens?: Address[];
  };
  
  /** Performance tracking. */
  performance: {
    totalTrades: number;
    successRate: number;
    totalProfit: string;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

/**
 * Copy trading bot configuration.
 */
interface CopyTradingBotConfig extends BaseBotConfig {
  type: 'copy-trading';
  
  /** Copy trading specific settings. */
  copyTrading: {
    /** Traders to copy. */
    traders: CopyTraderConfig[];
    
    /** Copy ratio (how much to copy relative to original). */
    copyRatio: number;
    
    /** Minimum trade size to copy. */
    minTradeSize: string;
    
    /** Maximum trade size to copy. */
    maxTradeSize: string;
    
    /** Copy delay (in milliseconds). */
    copyDelay: number;
    
    /** Filter configuration. */
    filters: {
      /** Only copy profitable traders. */
      onlyProfitable: boolean;
      
      /** Minimum trader success rate. */
      minSuccessRate: number;
      
      /** Minimum trader track record (days). */
      minTrackRecord: number;
      
      /** Token filters. */
      allowedTokens?: Address[];
      blockedTokens?: Address[];
      
      /** Chain filters. */
      allowedChains?: SupportedChain[];
      blockedChains?: SupportedChain[];
    };
    
    /** Risk management for copy trading. */
    riskManagement: {
      /** Maximum allocation per trader. */
      maxAllocationPerTrader: number;
      
      /** Stop copying conditions. */
      stopConditions: {
        maxConsecutiveLosses: number;
        maxDrawdown: number;
        minPerformancePeriod: number;
      };
    };
  };
}

// ========================================
// MEV BOT CONFIGURATION
// ========================================

/**
 * MEV strategy configuration.
 */
interface MEVStrategy {
  /** Strategy type. */
  type: 'sandwich' | 'frontrun' | 'backrun' | 'arbitrage' | 'liquidation';
  
  /** Strategy enabled. */
  enabled: boolean;
  
  /** Strategy parameters. */
  parameters: Record<string, string | number | boolean>;
  
  /** Minimum profit threshold. */
  minProfit: string;
  
  /** Maximum risk. */
  maxRisk: string;
  
  /** Target contracts. */
  targetContracts?: Address[];
  
  /** Target tokens. */
  targetTokens?: Address[];
}

/**
 * MEV bot configuration.
 */
interface MEVBotConfig extends BaseBotConfig {
  type: 'mev-bot';
  
  /** MEV-specific settings. */
  mev: {
    /** MEV strategies to use. */
    strategies: MEVStrategy[];
    
    /** Mempool monitoring. */
    mempool: {
      /** Sources to monitor. */
      sources: string[];
      
      /** Monitoring interval. */
      interval: number;
      
      /** Transaction filters. */
      filters: {
        minValue: string;
        maxGasPrice: string;
        targetFunctions: string[];
        targetTokens?: Address[];
      };
    };
    
    /** Bundle configuration. */
    bundles: {
      /** Use bundle submission. */
      enabled: boolean;
      
      /** Bundle providers. */
      providers: string[];
      
      /** Max bundle size. */
      maxBundleSize: number;
      
      /** Bundle timeout. */
      timeout: number;
    };
    
    /** Gas management. */
    gas: {
      /** Gas strategy. */
      strategy: 'aggressive' | 'normal' | 'conservative';
      
      /** Base fee multiplier. */
      baseFeeMultiplier: number;
      
      /** Priority fee. */
      priorityFee: string;
      
      /** Max gas price. */
      maxGasPrice: string;
    };
  };
}

// ========================================
// YIELD FARMING BOT CONFIGURATION
// ========================================

/**
 * Yield pool configuration.
 */
interface YieldPoolConfig {
  /** Pool identifier. */
  poolId: string;
  
  /** Pool address. */
  address: Address;
  
  /** Pool tokens. */
  tokens: Address[];
  
  /** Target allocation. */
  allocation: number;
  
  /** Minimum APY. */
  minAPY: number;
  
  /** Maximum impermanent loss. */
  maxIL: number;
  
  /** Pool enabled. */
  enabled: boolean;
}

/**
 * Yield protocol configuration.
 */
interface YieldProtocolConfig {
  /** Protocol name. */
  name: string;
  
  /** Protocol address. */
  address: Address;
  
  /** Allocation weight. */
  allocation: number;
  
  /** Minimum APY. */
  minAPY: number;
  
  /** Risk score (1-10). */
  riskScore: number;
  
  /** Protocol-specific parameters. */
  parameters: Record<string, string | number | boolean>;
  
  /** Pool/farm specific settings. */
  pools: YieldPoolConfig[];
}

/**
 * Yield farming bot configuration.
 */
interface YieldFarmingBotConfig extends BaseBotConfig {
  type: 'yield-farming';
  
  /** Yield farming specific settings. */
  yieldFarming: {
    /** Target protocols. */
    protocols: YieldProtocolConfig[];
    
    /** Auto-compound settings. */
    autoCompound: {
      enabled: boolean;
      frequency: number;
      minRewards: string;
      compoundRatio: number;
    };
    
    /** Rebalancing. */
    rebalancing: {
      enabled: boolean;
      frequency: number;
      threshold: number;
      strategy: 'equal-weight' | 'risk-parity' | 'momentum' | 'custom';
    };
    
    /** Harvest automation. */
    harvesting: {
      enabled: boolean;
      frequency: number;
      minGasEfficiency: number;
      batchHarvest: boolean;
    };
    
    /** Risk management. */
    riskManagement: {
      maxAllocationPerProtocol: number;
      maxImpermanentLoss: number;
      minAPY: number;
      maxDrawdown: number;
    };
  };
}

// ========================================
// GRID TRADING BOT CONFIGURATION
// ========================================

/**
 * Grid trading bot configuration.
 */
interface GridTradingBotConfig extends BaseBotConfig {
  type: 'grid-trading';
  
  /** Grid trading specific settings. */
  gridTrading: {
    /** Trading pair. */
    pair: {
      baseToken: Address;
      quoteToken: Address;
    };
    
    /** Grid parameters. */
    grid: {
      /** Number of grid levels. */
      levels: number;
      
      /** Grid spacing (percentage). */
      spacing: number;
      
      /** Upper price limit. */
      upperLimit: string;
      
      /** Lower price limit. */
      lowerLimit: string;
      
      /** Order size per grid. */
      orderSize: string;
    };
    
    /** Rebalancing. */
    rebalancing: {
      enabled: boolean;
      frequency: number;
      threshold: number;
    };
    
    /** Take profit settings. */
    takeProfit: {
      enabled: boolean;
      threshold: number;
      percentage: number;
    };
  };
}

// ========================================
// DCA BOT CONFIGURATION
// ========================================

/**
 * Dollar Cost Averaging bot configuration.
 */
interface DCABotConfig extends BaseBotConfig {
  type: 'dca-bot';
  
  /** DCA specific settings. */
  dca: {
    /** Target token to buy. */
    targetToken: Address;
    
    /** Base token to spend. */
    baseToken: Address;
    
    /** Purchase amount per interval. */
    purchaseAmount: string;
    
    /** Purchase frequency (seconds). */
    frequency: number;
    
    /** Total budget. */
    totalBudget: string;
    
    /** Price conditions. */
    priceConditions: {
      /** Only buy below certain price. */
      maxPrice?: string;
      
      /** Only buy above certain price. */
      minPrice?: string;
      
      /** Use moving average. */
      useMovingAverage?: {
        period: number;
        type: 'sma' | 'ema';
        threshold: number;
      };
    };
    
    /** Take profit conditions. */
    takeProfit: {
      enabled: boolean;
      targetPrice?: string;
      profitPercentage?: number;
      sellRatio: number;
    };
  };
}

// ========================================
// BOT CONFIGURATION UNION
// ========================================

/**
 * Union type for all bot configurations.
 */
type BotConfig = 
  | ArbitrageBotConfig
  | CopyTradingBotConfig
  | MEVBotConfig
  | YieldFarmingBotConfig
  | GridTradingBotConfig
  | DCABotConfig
  | BaseBotConfig;

// ========================================
// BOT MANAGEMENT TYPES
// ========================================

/**
 * Bot deployment configuration.
 */
interface BotDeploymentConfig {
  /** Bot configuration. */
  config: BotConfig;
  
  /** Deployment environment. */
  environment: 'development' | 'staging' | 'production';
  
  /** Resource allocation. */
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  
  /** Scaling configuration. */
  scaling: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    targetCPU: number;
    targetMemory: number;
  };
  
  /** Health checks. */
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
  };
}

/**
 * Bot template.
 */
interface BotTemplate {
  /** Template identifier. */
  id: string;
  
  /** Template name. */
  name: string;
  
  /** Template description. */
  description: string;
  
  /** Template category. */
  category: string;
  
  /** Bot type. */
  botType: BotType;
  
  /** Template configuration. */
  template: Partial<BotConfig>;
  
  /** Required parameters. */
  requiredParams: string[];
  
  /** Optional parameters. */
  optionalParams: string[];
  
  /** Template metadata. */
  metadata: {
    version: string;
    author: string;
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedReturns: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default bot settings.
 */
const DEFAULT_BOT_SETTINGS = {
  executionTimeout: 30000,
  maxParallelOps: 5,
  maxRetries: 3,
  metricsInterval: 60000,
  healthCheckInterval: 30000,
  minProfitThreshold: '10', // USD
  maxSlippage: 2.0, // 2%
  maxGasPrice: '100000000000' // 100 gwei
} as const;

/**
 * Bot type descriptions.
 */
const BOT_TYPE_DESCRIPTIONS: Record<BotType, string> = {
  arbitrage: 'Automated arbitrage trading across multiple DEXes',
  ['copy-trading']: 'Copy trades from successful traders',
  ['mev-bot']: 'Maximum Extractable Value opportunities',
  ['yield-farming']: 'Automated yield farming and liquidity provision',
  ['grid-trading']: 'Grid trading strategy with automated rebalancing',
  ['dca-bot']: 'Dollar Cost Averaging automated purchases',
  ['market-making']: 'Automated market making with spread capture',
  liquidation: 'Automated liquidation of undercollateralized positions',
  sandwich: 'Sandwich attack MEV strategy',
  frontrun: 'Frontrunning MEV strategy',
  custom: 'Custom trading strategy'
} as const;

// ========================================
// EXPORTS
// ========================================

export type {
  BotId,
  BotType,
  BotStatus,
  BotPriority,
  BaseBotConfig,
  RiskManagementConfig,
  PerformanceConfig,
  MonitoringConfig,
  BotMetadata,
  ArbitrageBotConfig,
  CopyTradingBotConfig,
  CopyTraderConfig,
  MEVBotConfig,
  MEVStrategy,
  YieldFarmingBotConfig,
  YieldProtocolConfig,
  YieldPoolConfig,
  GridTradingBotConfig,
  DCABotConfig,
  BotConfig,
  BotDeploymentConfig,
  BotTemplate
};

export {
  DEFAULT_BOT_SETTINGS,
  BOT_TYPE_DESCRIPTIONS
};
