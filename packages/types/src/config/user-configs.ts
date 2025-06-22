/**
 * @file User Configuration Types.
 * 
 * User-specific configuration types for trading bot platform including
 * user preferences, risk parameters, notification settings, and
 * personalization options.
 * 
 * Features:
 * - User preferences and settings
 * - Risk management parameters
 * - Notification and alert configurations
 * - UI/UX customization
 * - Trading preferences
 * - Security settings.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { BotType } from './bot-configs';
import type { Address } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';


// ========================================
// CORE USER CONFIGURATION
// ========================================

/**
 * User identifier.
 */
type UserId = string;

/**
 * User tier levels.
 */
type UserTier = 
  | 'free'
  | 'basic'
  | 'premium'
  | 'enterprise';

/**
 * User experience levels.
 */
type ExperienceLevel = 
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

// ========================================
// USER PREFERENCES
// ========================================

/**
 * General user preferences.
 */
interface UserPreferences {
  /** Preferred language. */
  language: string;
  
  /** Preferred timezone. */
  timezone: string;
  
  /** Preferred currency for display. */
  currency: string;
  
  /** Default chain for operations. */
  defaultChain: SupportedChain;
  
  /** Preferred chains (ordered by preference). */
  preferredChains: SupportedChain[];
  
  /** Display preferences. */
  display: {
    /** Number format. */
    numberFormat: 'standard' | 'scientific' | 'compact';
    
    /** Decimal places for prices. */
    priceDecimals: number;
    
    /** Decimal places for amounts. */
    amountDecimals: number;
    
    /** Date format. */
    dateFormat: string;
    
    /** Time format. */
    timeFormat: '12h' | '24h';
    
    /** Show advanced features. */
    showAdvanced: boolean;
  };
  
  /** Auto-refresh settings. */
  autoRefresh: {
    /** Dashboard refresh interval. */
    dashboard: number;
    
    /** Portfolio refresh interval. */
    portfolio: number;
    
    /** Price refresh interval. */
    prices: number;
    
    /** Trading history refresh interval. */
    history: number;
  };
  
  /** Privacy settings. */
  privacy: {
    /** Hide balances from others. */
    hideBalances: boolean;
    
    /** Hide trading history. */
    hideHistory: boolean;
    
    /** Allow analytics tracking. */
    allowAnalytics: boolean;
    
    /** Share anonymous usage data. */
    shareUsageData: boolean;
  };
}

// ========================================
// RISK PARAMETERS
// ========================================

/**
 * Stress test configuration.
 */
interface StressTestConfig {
  /** Test name. */
  name: string;
  
  /** Test scenario. */
  scenario: 'market-crash' | 'flash-crash' | 'high-volatility' | 'custom';
  
  /** Test parameters. */
  parameters: {
    priceChange: number;
    timeframe: number;
    volatilityMultiplier: number;
  };
  
  /** Expected behavior. */
  expectedBehavior: {
    maxLoss: string;
    liquidationRisk: number;
    recoveryTime: number;
  };
}

/**
 * User risk parameters.
 */
interface RiskParameters {
  /** Overall risk tolerance. */
  riskTolerance: 'low' | 'medium' | 'high';
  
  /** Global limits. */
  globalLimits: {
    /** Maximum total portfolio value at risk. */
    maxPortfolioRisk: string;
    
    /** Maximum daily loss. */
    maxDailyLoss: string;
    
    /** Maximum weekly loss. */
    maxWeeklyLoss: string;
    
    /** Maximum monthly loss. */
    maxMonthlyLoss: string;
    
    /** Maximum position size (percentage of portfolio). */
    maxPositionSize: number;
  };
  
  /** Trade-level limits. */
  tradeLimits: {
    /** Maximum trade size. */
    maxTradeSize: string;
    
    /** Minimum trade size. */
    minTradeSize: string;
    
    /** Maximum slippage tolerance. */
    maxSlippage: number;
    
    /** Maximum gas price. */
    maxGasPrice: string;
    
    /** Stop loss threshold. */
    stopLossThreshold: number;
  };
  
  /** Chain-specific limits. */
  chainLimits: Record<SupportedChain, {
    maxAllocation: number;
    maxTradeSize: string;
    maxGasPrice: string;
  }>;
  
  /** Bot-specific risk settings. */
  botRiskSettings: Record<BotType, {
    enabled: boolean;
    maxAllocation: number;
    riskMultiplier: number;
  }>;
  
  /** Advanced risk settings. */
  advanced: {
    /** Use dynamic position sizing. */
    dynamicSizing: boolean;
    
    /** Risk-adjusted returns target. */
    targetSharpeRatio: number;
    
    /** Maximum correlation between positions. */
    maxCorrelation: number;
    
    /** Stress test scenarios. */
    stressTests: StressTestConfig[];
  };
}

// ========================================
// NOTIFICATION SETTINGS
// ========================================

/**
 * Custom alert configuration.
 */
interface UserAlertConfig {
  /** Alert identifier. */
  id: string;
  
  /** Alert name. */
  name: string;
  
  /** Alert condition. */
  condition: string;
  
  /** Alert parameters. */
  parameters: Record<string, string | number | boolean>;
  
  /** Alert channels. */
  channels: string[];
  
  /** Alert frequency. */
  frequency: 'once' | 'continuous' | 'limited';
  
  /** Max occurrences (for limited frequency). */
  maxOccurrences?: number;
  
  /** Alert enabled. */
  enabled: boolean;
}

/**
 * User notification settings.
 */
interface NotificationSettings {
  /** Global notification preferences. */
  global: {
    /** Enable notifications. */
    enabled: boolean;
    
    /** Quiet hours. */
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
      timezone: string;
    };
    
    /** Do not disturb mode. */
    doNotDisturb: boolean;
  };
  
  /** Channel preferences. */
  channels: {
    /** Email notifications. */
    email: {
      enabled: boolean;
      address: string;
      frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
      types: string[];
    };
    
    /** SMS notifications. */
    sms: {
      enabled: boolean;
      phoneNumber: string;
      criticalOnly: boolean;
      types: string[];
    };
    
    /** Push notifications. */
    push: {
      enabled: boolean;
      showPreview: boolean;
      sound: boolean;
      vibration: boolean;
      types: string[];
    };
    
    /** In-app notifications. */
    inApp: {
      enabled: boolean;
      showBadges: boolean;
      autoMarkRead: boolean;
      types: string[];
    };
    
    /** Webhook notifications. */
    webhook: {
      enabled: boolean;
      url: string;
      secret: string;
      types: string[];
    };
  };
  
  /** Event-specific settings. */
  events: {
    /** Trade notifications. */
    trades: {
      successful: boolean;
      failed: boolean;
      large: boolean;
      threshold: string;
    };
    
    /** Bot notifications. */
    bots: {
      started: boolean;
      stopped: boolean;
      errors: boolean;
      performance: boolean;
    };
    
    /** Security notifications. */
    security: {
      login: boolean;
      apiKeyUsage: boolean;
      withdrawals: boolean;
      settings: boolean;
    };
    
    /** Market notifications. */
    market: {
      priceAlerts: boolean;
      volatility: boolean;
      opportunities: boolean;
      newsEvents: boolean;
    };
    
    /** System notifications. */
    system: {
      maintenance: boolean;
      updates: boolean;
      announcements: boolean;
      downtime: boolean;
    };
  };
  
  /** Custom alerts. */
  customAlerts: UserAlertConfig[];
}

// ========================================
// TRADING PREFERENCES
// ========================================

/**
 * User trading preferences.
 */
interface TradingPreferences {
  /** Preferred trading strategies. */
  strategies: {
    arbitrage: boolean;
    copyTrading: boolean;
    mevBot: boolean;
    yieldFarming: boolean;
    gridTrading: boolean;
    dcaBot: boolean;
  };
  
  /** Default execution settings. */
  execution: {
    /** Default slippage tolerance. */
    defaultSlippage: number;
    
    /** Default deadline (seconds). */
    defaultDeadline: number;
    
    /** Gas strategy. */
    gasStrategy: 'slow' | 'standard' | 'fast' | 'aggressive';
    
    /** MEV protection. */
    mevProtection: boolean;
    
    /** Auto-approve small trades. */
    autoApprove: {
      enabled: boolean;
      threshold: string;
    };
  };
  
  /** Portfolio management. */
  portfolio: {
    /** Auto-rebalancing. */
    autoRebalance: {
      enabled: boolean;
      frequency: 'daily' | 'weekly' | 'monthly';
      threshold: number;
      strategy: 'equal-weight' | 'market-cap' | 'risk-parity';
    };
    
    /** Diversification settings. */
    diversification: {
      maxTokenAllocation: number;
      maxChainAllocation: number;
      minTokens: number;
      preferredSectors: string[];
    };
    
    /** Yield optimization. */
    yieldOptimization: {
      enabled: boolean;
      minYield: number;
      maxRisk: number;
      autoCompound: boolean;
    };
  };
  
  /** Advanced settings. */
  advanced: {
    /** Use advanced order types. */
    advancedOrders: boolean;
    
    /** Enable margin trading. */
    marginTrading: boolean;
    
    /** Enable derivatives. */
    derivatives: boolean;
    
    /** Custom routing. */
    customRouting: {
      enabled: boolean;
      preferredDEXes: string[];
      avoidDEXes: string[];
    };
  };
}

// ========================================
// SECURITY SETTINGS
// ========================================

/**
 * User security settings.
 */
interface UserSecuritySettings {
  /** Two-factor authentication. */
  twoFactor: {
    enabled: boolean;
    method: 'totp' | 'sms' | 'email';
    backupCodes: string[];
    required: boolean;
  };
  
  /** Login security. */
  login: {
    /** Session timeout. */
    sessionTimeout: number;
    
    /** Require 2FA for login. */
    require2FA: boolean;
    
    /** Remember device. */
    rememberDevice: boolean;
    
    /** IP whitelist. */
    ipWhitelist: {
      enabled: boolean;
      addresses: string[];
    };
    
    /** Login notifications. */
    notifications: boolean;
  };
  
  /** API security. */
  apiSecurity: {
    /** API key rotation. */
    keyRotation: {
      enabled: boolean;
      frequency: number;
    };
    
    /** IP restrictions. */
    ipRestrictions: {
      enabled: boolean;
      allowedIPs: string[];
    };
    
    /** Rate limiting. */
    rateLimiting: {
      enabled: boolean;
      requests: number;
      window: number;
    };
  };
  
  /** Transaction security. */
  transactions: {
    /** Require confirmation for large trades. */
    confirmLargeTrades: {
      enabled: boolean;
      threshold: string;
    };
    
    /** Withdrawal limits. */
    withdrawalLimits: {
      enabled: boolean;
      dailyLimit: string;
      weeklyLimit: string;
    };
    
    /** Withdrawal whitelist. */
    withdrawalWhitelist: {
      enabled: boolean;
      addresses: Address[];
    };
  };
  
  /** Privacy settings. */
  privacy: {
    /** Data retention. */
    dataRetention: number;
    
    /** Activity tracking. */
    activityTracking: boolean;
    
    /** Share data with partners. */
    shareData: boolean;
  };
}

// ========================================
// UI SETTINGS
// ========================================

/**
 * Dashboard widget configuration.
 */
interface UserDashboardWidget {
  /** Widget identifier. */
  id: string;
  
  /** Widget type. */
  type: string;
  
  /** Widget title. */
  title: string;
  
  /** Widget position. */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Widget configuration. */
  config: Record<string, string | number | boolean | Record<string, unknown>>;
  
  /** Widget visible. */
  visible: boolean;
}

/**
 * User interface settings.
 */
interface UISettings {
  /** Theme settings. */
  theme: {
    /** Color scheme. */
    mode: 'light' | 'dark' | 'auto';
    
    /** Color palette. */
    palette: 'default' | 'blue' | 'green' | 'purple' | 'custom';
    
    /** Custom colors. */
    customColors?: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
    };
  };
  
  /** Layout preferences. */
  layout: {
    /** Sidebar collapsed. */
    sidebarCollapsed: boolean;
    
    /** Compact mode. */
    compactMode: boolean;
    
    /** Grid density. */
    gridDensity: 'comfortable' | 'standard' | 'compact';
    
    /** Default page size. */
    pageSize: number;
  };
  
  /** Dashboard configuration. */
  dashboard: {
    /** Widget layout. */
    widgets: UserDashboardWidget[];
    
    /** Default time range. */
    defaultTimeRange: string;
    
    /** Auto-refresh enabled. */
    autoRefresh: boolean;
    
    /** Show help tooltips. */
    showTooltips: boolean;
  };
  
  /** Chart preferences. */
  charts: {
    /** Default chart type. */
    defaultType: 'line' | 'candlestick' | 'area';
    
    /** Time intervals. */
    intervals: string[];
    
    /** Technical indicators. */
    indicators: string[];
    
    /** Color scheme. */
    colorScheme: 'standard' | 'colorblind' | 'high-contrast';
  };
  
  /** Table preferences. */
  tables: {
    /** Default columns. */
    defaultColumns: Record<string, string[]>;
    
    /** Row density. */
    rowDensity: 'comfortable' | 'standard' | 'compact';
    
    /** Show pagination. */
    showPagination: boolean;
    
    /** Sticky headers. */
    stickyHeaders: boolean;
  };
}

// ========================================
// API SETTINGS
// ========================================

/**
 * API key configuration.
 */
interface APIKey {
  /** Key identifier. */
  id: string;
  
  /** Key name. */
  name: string;
  
  /** Key permissions. */
  permissions: string[];
  
  /** Key restrictions. */
  restrictions: {
    ipAddresses?: string[];
    referrers?: string[];
    chains?: SupportedChain[];
  };
  
  /** Key status. */
  status: 'active' | 'inactive' | 'revoked';
  
  /** Key metadata. */
  metadata: {
    created: number;
    lastUsed?: number;
    usage: {
      requests: number;
      errors: number;
    };
  };
}

/**
 * User API settings.
 */
interface UserAPISettings {
  /** API keys. */
  keys: APIKey[];
  
  /** Usage limits. */
  limits: {
    /** Requests per minute. */
    rpm: number;
    
    /** Requests per hour. */
    rph: number;
    
    /** Requests per day. */
    rpd: number;
  };
  
  /** Webhook settings. */
  webhooks: {
    /** Webhook URLs. */
    urls: string[];
    
    /** Webhook events. */
    events: string[];
    
    /** Retry configuration. */
    retry: {
      maxRetries: number;
      backoffMultiplier: number;
    };
  };
  
  /** SDK preferences. */
  sdk: {
    /** Preferred language. */
    language: 'javascript' | 'python' | 'go' | 'rust' | 'java';
    
    /** Code examples. */
    showExamples: boolean;
    
    /** Documentation level. */
    docLevel: 'basic' | 'detailed' | 'advanced';
  };
}

// ========================================
// USER METADATA
// ========================================

/**
 * User metadata.
 */
interface UserMetadata {
  /** User profile. */
  profile: {
    firstName?: string;
    lastName?: string;
    email: string;
    avatar?: string;
    bio?: string;
    location?: string;
    website?: string;
    socialLinks?: Record<string, string>;
  };
  
  /** Account information. */
  account: {
    status: 'active' | 'suspended' | 'pending' | 'closed';
    verified: boolean;
    kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
    subscription: {
      plan: string;
      status: 'active' | 'cancelled' | 'expired';
      renewsAt?: number;
    };
  };
  
  /** Usage statistics. */
  usage: {
    totalTrades: number;
    totalVolume: string;
    activeBots: number;
    favoriteFeatures: string[];
    lastActiveFeature: string;
  };
  
  /** Referral information. */
  referral: {
    code: string;
    referredBy?: string;
    totalReferrals: number;
    earnings: string;
  };
  
  /** Custom fields. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Main user configuration.
 */
interface UserConfig {
  /** User identifier. */
  userId: UserId;
  
  /** User tier. */
  tier: UserTier;
  
  /** Experience level. */
  experienceLevel: ExperienceLevel;
  
  /** General preferences. */
  preferences: UserPreferences;
  
  /** Risk parameters. */
  riskParams: RiskParameters;
  
  /** Notification settings. */
  notifications: NotificationSettings;
  
  /** Trading preferences. */
  trading: TradingPreferences;
  
  /** Security settings. */
  security: UserSecuritySettings;
  
  /** UI/UX settings. */
  ui: UISettings;
  
  /** API settings. */
  api: UserAPISettings;
  
  /** User metadata. */
  metadata: UserMetadata;
  
  /** Configuration timestamps. */
  timestamps: {
    created: number;
    updated: number;
    lastLogin: number;
    lastActivity: number;
  };
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default user settings.
 */
const DEFAULT_USER_SETTINGS = {
  language: 'en',
  timezone: 'UTC',
  currency: 'USD',
  riskTolerance: 'medium',
  maxSlippage: 1.0,
  gasStrategy: 'standard',
  theme: 'auto',
  autoRefresh: true,
  notifications: true
} as const;

/**
 * User tier limits.
 */
const USER_TIER_LIMITS: Record<UserTier, {
  maxBots: number;
  maxAPIKeys: number;
  maxWebhooks: number;
  maxPortfolioValue: string;
  rpmLimit: number;
}> = {
  free: {
    maxBots: 1,
    maxAPIKeys: 1,
    maxWebhooks: 1,
    maxPortfolioValue: '1000',
    rpmLimit: 10
  },
  basic: {
    maxBots: 5,
    maxAPIKeys: 3,
    maxWebhooks: 3,
    maxPortfolioValue: '10000',
    rpmLimit: 50
  },
  premium: {
    maxBots: 20,
    maxAPIKeys: 10,
    maxWebhooks: 10,
    maxPortfolioValue: '100000',
    rpmLimit: 200
  },
  enterprise: {
    maxBots: -1, // unlimited
    maxAPIKeys: -1,
    maxWebhooks: -1,
    maxPortfolioValue: '-1', // unlimited
    rpmLimit: 1000
  }
};

// ========================================
// EXPORTS
// ========================================

export type {
  UserId,
  UserTier,
  ExperienceLevel,
  UserConfig,
  UserPreferences,
  RiskParameters,
  StressTestConfig,
  NotificationSettings,
  UserAlertConfig,
  TradingPreferences,
  UserSecuritySettings,
  UISettings,
  UserDashboardWidget,
  UserAPISettings,
  APIKey,
  UserMetadata
};

export { DEFAULT_USER_SETTINGS, USER_TIER_LIMITS };
