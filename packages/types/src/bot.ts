/**
 * @fileoverview Trading Bot Type Definitions and Validation Schemas
 * 
 * Comprehensive TypeScript type system for financial trading bot configurations
 * using Zod for runtime validation. This module provides enterprise-grade type
 * safety, validation rules, and schema definitions for all trading bot operations.
 * 
 * Features:
 * - Runtime type validation with detailed error messages
 * - Comprehensive bot configuration schemas (Arbitrage, Copy Trading, MEV)
 * - Financial parameter validation with safety constraints
 * - API request/response schemas with proper error handling
 * - Database entity schemas for persistence layer
 * - Performance metrics and analytics type definitions
 * - WebSocket event schemas for real-time communication
 * 
 * @version 2.0.0
 * @author Trading Bot Development Team
 * @license MIT
 * @security High - Contains sensitive financial trading configurations
 */

import { z } from 'zod';

// ========================================
// CONSTANTS AND ENUMS
// ========================================

/**
 * Supported blockchain networks for trading operations
 */
export const SUPPORTED_CHAINS = ['ethereum', 'bsc', 'polygon', 'solana'] as const;

/**
 * Supported trading bot types
 */
export const BOT_TYPES = ['arbitrage', 'copy-trader', 'mev-sandwich'] as const;

/**
 * Supported DEX protocols for trading
 */
export const SUPPORTED_DEXES = ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'pancakeswap'] as const;

/**
 * Trade size calculation methods for copy trading
 */
export const TRADE_SIZE_TYPES = ['FIXED', 'PERCENTAGE', 'RATIO'] as const;

/**
 * Performance metric timeframes
 */
export const METRIC_TIMEFRAMES = ['1h', '24h', '7d', '30d'] as const;

/**
 * WebSocket event types for real-time communication
 */
export const WEBSOCKET_EVENT_TYPES = [
  'bot_status', 'trade_update', 'price_update', 'risk_alert', 'system_alert'
] as const;

/**
 * Trade event types for audit trail
 */
export const TRADE_EVENT_TYPES = [
  'opportunity_detected', 'trade_executed', 'trade_failed', 'profit_realized'
] as const;

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Enhanced string validation for financial addresses
 */
const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validates Ethereum-style addresses
 */
export const EthereumAddressSchema = z.string().regex(ethereumAddressRegex, {
  message: "Invalid Ethereum address format"
});

/**
 * Validates Solana-style addresses
 */
export const SolanaAddressSchema = z.string().regex(solanaAddressRegex, {
  message: "Invalid Solana address format"
});

/**
 * Validates percentage values with proper bounds
 */
export const PercentageSchema = z.number()
  .min(0, "Percentage cannot be negative")
  .max(100, "Percentage cannot exceed 100%");

/**
 * Validates financial amounts as strings to prevent precision loss
 */
export const FinancialAmountSchema = z.string()
  .regex(/^\d+(\.\d{1,18})?$/, "Invalid financial amount format")
  .refine((val) => parseFloat(val) > 0, "Amount must be positive");

/**
 * Validates gas price values
 */
export const GasPriceSchema = z.string()
  .regex(/^\d+(\.\d{1,9})?$/, "Invalid gas price format")
  .refine((val) => {
    const parsed = parseFloat(val);
    return parsed >= 0.1 && parsed <= 1000;
  }, "Gas price must be between 0.1 and 1000 GWEI");

/**
 * Creates a chain-aware address validation schema
 * 
 * @param chain - Target blockchain for address validation
 * @returns Zod schema that validates addresses for the specified chain
 */
export function createAddressSchema(chain: typeof SUPPORTED_CHAINS[number]) {
  return z.string().refine((address) => isValidAddressForChain(address, chain), {
    message: `Invalid ${chain} address format`
  });
}

// ========================================
// BASE SCHEMAS
// ========================================

/**
 * Base Bot Configuration Schema
 * 
 * Shared configuration properties for all trading bot types.
 * Provides common validation rules and type safety for essential bot parameters.
 * 
 * @example
 * ```typescript
 * const config: BaseBotConfig = {
 *   userId: "user123",
 *   walletId: "wallet456", 
 *   name: "My Trading Bot",
 *   enabled: true,
 *   chain: "ethereum"
 * };
 * ```
 */
export const BaseBotConfigSchema = z.object({
  /** Unique bot identifier (auto-generated for new bots, required for updates) */
  id: z.string().uuid("Invalid bot ID format").optional(),
  
  /** User identifier who owns this bot */
  userId: z.string()
    .min(1, 'User ID is required')
    .max(50, 'User ID too long'),
  
  /** Wallet identifier for trading operations */
  walletId: z.string()
    .min(1, 'Wallet ID is required')
    .max(50, 'Wallet ID too long'),
  
  /** Human-readable bot name for identification */
  name: z.string()
    .min(1, 'Bot name is required')
    .max(100, 'Bot name too long')
    .regex(/^[\w\s\-_]+$/, 'Bot name contains invalid characters'),
  
  /** Whether the bot is currently enabled for trading */
  enabled: z.boolean(),
  
  /** Target blockchain network for trading operations */
  chain: z.enum(SUPPORTED_CHAINS, {
    errorMap: () => ({ message: `Invalid chain. Supported: ${SUPPORTED_CHAINS.join(', ')}` })
  }),
  
  /** Bot creation timestamp (ISO 8601 format) */
  createdAt: z.string().datetime().optional(),
  
  /** Last update timestamp (ISO 8601 format) */
  updatedAt: z.string().datetime().optional(),
  
  /** Optional bot description for documentation */
  description: z.string()
    .max(500, 'Description too long')
    .optional(),
  
  /** Bot version for configuration compatibility */
  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, 'Invalid version format')
    .default('1.0.0'),
});

/**
 * Arbitrage Bot Configuration Schema
 * 
 * Specialized configuration for arbitrage trading bots that exploit price
 * differences across different exchanges or trading pairs.
 * 
 * Features:
 * - Multi-pair arbitrage monitoring
 * - Cross-chain arbitrage support (optional)
 * - Advanced route optimization (Livshits algorithm)
 * - Comprehensive risk management
 * - Gas optimization strategies
 * 
 * @example
 * ```typescript
 * const config: ArbitrageBotConfig = {
 *   type: 'arbitrage',
 *   tokenPairs: [{
 *     tokenA: '0x...',
 *     tokenASymbol: 'USDC',
 *     tokenB: '0x...',
 *     tokenBSymbol: 'WETH',
 *     minLiquidity: '100000',
 *     enabled: true
 *   }],
 *   minProfitPercentage: 0.5,
 *   maxSlippage: 2.0
 * };
 * ```
 */
export const ArbitrageBotConfigSchema = BaseBotConfigSchema.extend({
  /** Bot type identifier */
  type: z.literal('arbitrage'),
  
  /** Token pairs to monitor for arbitrage opportunities */
  tokenPairs: z.array(z.object({
    /** Address of first token in the pair */
    tokenA: EthereumAddressSchema,
    
    /** Symbol of first token (e.g., 'USDC') */
    tokenASymbol: z.string()
      .min(1, 'Token A symbol is required')
      .max(20, 'Token A symbol too long')
      .toUpperCase(),
    
    /** Address of second token in the pair */
    tokenB: EthereumAddressSchema,
    
    /** Symbol of second token (e.g., 'WETH') */
    tokenBSymbol: z.string()
      .min(1, 'Token B symbol is required')
      .max(20, 'Token B symbol too long')
      .toUpperCase(),
    
    /** Minimum liquidity required for trading (in USD) */
    minLiquidity: FinancialAmountSchema,
    
    /** Whether this pair is actively monitored */
    enabled: z.boolean(),
    
    /** Custom priority for this pair (higher = more priority) */
    priority: z.number().min(1).max(10).default(5),
    
    /** Maximum position size for this specific pair */
    maxPositionUsd: FinancialAmountSchema.optional(),
  })).min(1, 'At least one token pair is required'),
  
  /** Minimum profit percentage to execute arbitrage (0.1% to 100%) */
  minProfitPercentage: z.number()
    .min(0.01, 'Minimum profit must be at least 0.01%')
    .max(100, 'Maximum profit percentage is 100%'),
  
  /** Maximum slippage tolerance (0.1% to 50%) */
  maxSlippage: z.number()
    .min(0.01, 'Minimum slippage must be at least 0.01%')
    .max(50, 'Maximum slippage cannot exceed 50%'),
  /** Gas optimization settings for transaction execution */
  gasSettings: z.object({
    /** Maximum gas price willing to pay (in GWEI) */
    maxGasPrice: GasPriceSchema,
    
    /** Priority fee for EIP-1559 transactions (in GWEI) */
    priorityFee: GasPriceSchema,
    
    /** Gas limit for arbitrage transactions */
    gasLimit: z.string()
      .regex(/^\d+$/, 'Gas limit must be a positive integer')
      .refine((val) => {
        const num = parseInt(val);
        return num >= 21000 && num <= 1000000;
      }, 'Gas limit must be between 21,000 and 1,000,000'),
    
    /** Gas price increase strategy for stuck transactions */
    gasPriceIncrease: z.object({
      enabled: z.boolean().default(true),
      increasePercentage: z.number().min(10).max(100).default(20),
      maxAttempts: z.number().min(1).max(5).default(3),
    }).optional(),
  }),
  
  /** Risk management parameters for safe trading */
  riskParams: z.object({
    /** Maximum position size per trade (in USD) */
    maxPositionSize: FinancialAmountSchema,
    
    /** Maximum daily loss limit (in USD) */
    maxDailyLoss: FinancialAmountSchema,
    
    /** Stop loss percentage (0% to 100%) */
    stopLossPercentage: PercentageSchema,
    
    /** Take profit percentage (0% to 1000%) */
    takeProfitPercentage: z.number()
      .min(0, 'Take profit cannot be negative')
      .max(1000, 'Take profit cannot exceed 1000%'),
    
    /** Maximum number of concurrent trades */
    maxConcurrentTrades: z.number()
      .min(1, 'Must allow at least 1 concurrent trade')
      .max(50, 'Too many concurrent trades increase risk'),
    
    /** Cooldown period between trades (in milliseconds) */
    cooldownPeriod: z.number()
      .min(0, 'Cooldown period must be positive')
      .max(300000, 'Cooldown period too long (max 5 minutes)'),
    
    /** Dynamic risk adjustment based on market conditions */
    dynamicRiskAdjustment: z.object({
      enabled: z.boolean().default(false),
      volatilityThreshold: z.number().min(0.1).max(10).default(2.0),
      riskReductionFactor: z.number().min(0.1).max(0.9).default(0.5),
    }).optional(),
  }),
  /** Advanced Livshits route optimization for multi-hop arbitrage */
  livshitsOptimization: z.object({
    /** Enable advanced route optimization algorithm */
    enabled: z.boolean(),
    
    /** Maximum number of hops in arbitrage route (1-5) */
    maxHops: z.number()
      .min(1, 'At least 1 hop required')
      .max(5, 'Too many hops increase risk and gas costs'),
    
    /** Pre-compute optimal routes to reduce execution time */
    precomputeRoutes: z.boolean(),
    
    /** Route refresh interval in milliseconds (1-60 seconds) */
    routeRefreshMs: z.number()
      .min(1000, 'Minimum refresh interval is 1 second')
      .max(60000, 'Maximum refresh interval is 60 seconds'),
    
    /** Minimum route efficiency threshold */
    minRouteEfficiency: z.number()
      .min(0.1, 'Route efficiency too low')
      .max(10, 'Route efficiency too high')
      .default(1.0),
  }).optional(),
  
  /** Cross-chain arbitrage configuration (advanced feature) */
  crossChainArbitrage: z.object({
    /** Enable cross-chain arbitrage opportunities */
    enabled: z.boolean(),
    
    /** Maximum time to wait for bridge completion (1 min to 1 hour) */
    maxBridgeWaitTime: z.number()
      .min(60000, 'Minimum bridge wait time is 1 minute')
      .max(3600000, 'Maximum bridge wait time is 1 hour'),
    
    /** Minimum profit percentage after bridge fees (0.1% to 100%) */
    minProfitAfterBridgeFees: z.number()
      .min(0.1, 'Minimum profit after fees must be at least 0.1%')
      .max(100, 'Maximum profit after fees is 100%'),
    
    /** Bridge cost threshold in USD */
    bridgeCostThreshold: FinancialAmountSchema,
    
    /** Supported bridge protocols */
    supportedBridges: z.array(z.enum([
      'stargate', 'hop', 'across', 'synapse', 'multichain'
    ])).optional(),
    
    /** Bridge slippage tolerance */
    bridgeSlippage: z.number()
      .min(0.1, 'Bridge slippage too low')
      .max(5, 'Bridge slippage too high')
      .default(1.0),
  }).optional(),
  
  /** MEV protection and optimization settings */
  mevProtection: z.object({
    /** Enable MEV protection mechanisms */
    enabled: z.boolean().default(true),
    
    /** Use private mempool services */
    usePrivateMempool: z.boolean().default(false),
    
    /** Maximum MEV threshold before aborting trade */
    maxMevThreshold: z.number()
      .min(0.1, 'MEV threshold too low')
      .max(10, 'MEV threshold too high')
      .default(2.0),
    
    /** Flashbots bundle configuration */
    flashbotsConfig: z.object({
      enabled: z.boolean().default(false),
      maxBundleSize: z.number().min(1).max(10).default(3),
      bundleTimeout: z.number().min(1000).max(30000).default(15000),
    }).optional(),
  }).optional(),
});

// Copy Trading Bot Configuration Schema
export const CopyTradingBotConfigSchema = BaseBotConfigSchema.extend({
  type: z.literal('copy-trader'),
  targetWallet: z.object({
    address: z.string().min(1, 'Target wallet address is required'),
    label: z.string().optional(),
    verified: z.boolean().default(false),
  }),
  copySettings: z.object({
    tradeSize: z.object({
      type: z.enum(['FIXED', 'PERCENTAGE', 'RATIO'], {
        errorMap: () => ({ message: 'Invalid trade size type' })
      }),
      value: z.number().min(0.01, 'Trade size value must be positive'),
      maxValue: z.number().optional(), // Maximum USD value for percentage/ratio modes
    }),
    copyDelay: z.number().min(0).max(30000), // Max 30 second delay
    slippageTolerance: z.number().min(0.1).max(50),
    minTradeValue: z.number().min(1), // Minimum USD value to copy
    maxTradeValue: z.number().min(1), // Maximum USD value to copy
  }),
  filters: z.object({
    tokenWhitelist: z.array(z.string()).optional(),
    tokenBlacklist: z.array(z.string()).optional(),
    dexWhitelist: z.array(z.string()).optional(),
    dexBlacklist: z.array(z.string()).optional(),
    minLiquidity: z.number().min(1000), // Minimum liquidity in USD
    maxGasPrice: z.number().min(1), // Maximum gas price in gwei
  }),
  riskManagement: z.object({
    stopLoss: z.object({
      enabled: z.boolean(),
      percentage: z.number().min(1).max(50),
    }),
    takeProfit: z.object({
      enabled: z.boolean(),
      percentage: z.number().min(1).max(1000),
    }),
    maxDailyLoss: z.number().min(10).max(10000), // USD
    maxConcurrentTrades: z.number().min(1).max(20),
  }),
});

// MEV Sandwich Bot Configuration Schema
export const SandwichBotConfigSchema = BaseBotConfigSchema.extend({
  type: z.literal('mev-sandwich'),
  targetDexes: z.array(z.enum(['uniswap-v2', 'uniswap-v3', 'sushiswap', 'pancakeswap'], {
    errorMap: () => ({ message: 'Invalid DEX selection' })
  })).min(1, 'At least one target DEX is required'),
  sandwichSettings: z.object({
    minVictimTradeValue: z.number().min(1000), // Minimum victim trade value in USD
    maxVictimTradeValue: z.number().min(1000), // Maximum victim trade value in USD
    frontrunMultiplier: z.number().min(1.1).max(5.0), // Gas price multiplier for frontrun
    backrunMultiplier: z.number().min(1.05).max(3.0), // Gas price multiplier for backrun
    profitThreshold: z.number().min(0.1).max(10), // Minimum profit percentage
    maxSlippage: z.number().min(0.1).max(5.0),
  }),
  mevProtection: z.object({
    flashbotsEnabled: z.boolean(),
    bloxrouteEnabled: z.boolean(),
    miningPoolsEnabled: z.boolean(),
    bundleOptimization: z.boolean(),
    maxWaitTime: z.number().min(1000).max(30000), // Max wait for bundle inclusion
  }),
  riskControls: z.object({
    maxPositionSize: z.number().min(100).max(100000), // USD
    maxDailyVolume: z.number().min(1000).max(1000000), // USD
    cooldownPeriod: z.number().min(0).max(300000), // Milliseconds between attacks
    emergencyStop: z.object({
      enabled: z.boolean(),
      maxLossPercentage: z.number().min(1).max(50),
      consecutiveFailures: z.number().min(2).max(10),
    }),
  }),
  // Advanced MEV-specific settings
  liquidityAnalysis: z.object({
    enabled: z.boolean(),
    minPoolLiquidity: z.number().min(10000), // USD
    liquidityRatioThreshold: z.number().min(0.01).max(1.0), // Max % of pool liquidity to trade
  }).optional(),
  competitorDetection: z.object({
    enabled: z.boolean(),
    maxCompetitors: z.number().min(1).max(10),
    competitorGasMultiplier: z.number().min(1.1).max(2.0),
  }).optional(),
});

// Union type for all bot configurations
export const BotConfigSchema = z.discriminatedUnion('type', [
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  SandwichBotConfigSchema,
]);

// Type inference from schemas
export type ArbitrageBotConfig = z.infer<typeof ArbitrageBotConfigSchema>;
export type CopyTradingBotConfig = z.infer<typeof CopyTradingBotConfigSchema>;
export type SandwichBotConfig = z.infer<typeof SandwichBotConfigSchema>;
export type BotConfig = z.infer<typeof BotConfigSchema>;

// Database entity schemas (for persistence layer)
export const BotEntitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  walletId: z.string(),
  type: z.enum(['arbitrage', 'copy-trader', 'mev-sandwich']),
  name: z.string(),
  enabled: z.boolean(),
  config: z.record(z.any()), // JSON storage for type-specific config
  createdAt: z.date(),
  updatedAt: z.date(),
  lastActivity: z.date().optional(),
});

// API request/response schemas
export const CreateBotRequestSchema = z.object({
  type: z.enum(['arbitrage', 'copy-trader', 'mev-sandwich']),
  config: z.record(z.any()), // Will be validated against specific bot schema
});

export const UpdateBotRequestSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
});

export const BotStatusSchema = z.object({
  id: z.string(),
  isRunning: z.boolean(),
  lastActivity: z.string(),
  totalTrades: z.number(),
  totalProfit: z.string(),
  totalLoss: z.string(),
  winRate: z.number().min(0).max(100),
  errors: z.array(z.string()),
  uptime: z.number(), // seconds
  avgExecutionTime: z.number(), // milliseconds
});

// Runtime state schemas
export const TradeEventSchema = z.object({
  id: z.string(),
  botId: z.string(),
  type: z.enum(['opportunity_detected', 'trade_executed', 'trade_failed', 'profit_realized']),
  timestamp: z.number(),
  data: z.record(z.any()),
});

// Performance metrics schema
export const PerformanceMetricsSchema = z.object({
  botId: z.string(),
  timeframe: z.enum(['1h', '24h', '7d', '30d']),
  totalTrades: z.number(),
  successfulTrades: z.number(),
  failedTrades: z.number(),
  totalProfit: z.number(),
  totalLoss: z.number(),
  avgExecutionTime: z.number(),
  maxDrawdown: z.number(),
  sharpeRatio: z.number().optional(),
  profitFactor: z.number().optional(),
});

// Error and validation schemas
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.string(),
});

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  total: z.number().optional(),
  totalPages: z.number().optional(),
});

// WebSocket event schemas
export const WebSocketEventSchema = z.object({
  type: z.enum(['bot_status', 'trade_update', 'price_update', 'risk_alert', 'system_alert']),
  data: z.record(z.any()),
  timestamp: z.number(),
  botId: z.string().optional(),
});

export type BotEntity = z.infer<typeof BotEntitySchema>;
export type CreateBotRequest = z.infer<typeof CreateBotRequestSchema>;
export type UpdateBotRequest = z.infer<typeof UpdateBotRequestSchema>;
export type BotStatus = z.infer<typeof BotStatusSchema>;
export type TradeEvent = z.infer<typeof TradeEventSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;

// ========================================
// TYPE GUARDS AND UTILITIES
// ========================================

/**
 * Type guard to check if a config is an arbitrage bot configuration
 * 
 * @param config - Bot configuration to check
 * @returns true if config is ArbitrageBotConfig
 */
export function isArbitrageBotConfig(config: BotConfig): config is ArbitrageBotConfig {
  return config.type === 'arbitrage';
}

/**
 * Type guard to check if a config is a copy trading bot configuration
 * 
 * @param config - Bot configuration to check
 * @returns true if config is CopyTradingBotConfig
 */
export function isCopyTradingBotConfig(config: BotConfig): config is CopyTradingBotConfig {
  return config.type === 'copy-trader';
}

/**
 * Type guard to check if a config is a MEV sandwich bot configuration
 * 
 * @param config - Bot configuration to check
 * @returns true if config is SandwichBotConfig
 */
export function isSandwichBotConfig(config: BotConfig): config is SandwichBotConfig {
  return config.type === 'mev-sandwich';
}

/**
 * Validates and parses a bot configuration based on its type
 * 
 * @param data - Raw configuration data
 * @returns Parsed and validated bot configuration
 * @throws ZodError if validation fails
 */
export function validateBotConfig(data: unknown): BotConfig {
  return BotConfigSchema.parse(data);
}

/**
 * Safely validates a bot configuration without throwing
 * 
 * @param data - Raw configuration data
 * @returns Success result with parsed config or error result
 */
export function safeValidateBotConfig(data: unknown): 
  { success: true; data: BotConfig } | { success: false; error: z.ZodError } {
  const result = BotConfigSchema.safeParse(data);
  return result.success 
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}

/**
 * Validates financial amount strings for precision safety
 * 
 * @param amount - Amount string to validate
 * @returns true if valid financial amount
 */
export function isValidFinancialAmount(amount: string): boolean {
  const result = FinancialAmountSchema.safeParse(amount);
  return result.success;
}

/**
 * Validates Ethereum address format
 * 
 * @param address - Address string to validate
 * @returns true if valid Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
  const result = EthereumAddressSchema.safeParse(address);
  return result.success;
}

/**
 * Validates Solana address format
 * 
 * @param address - Address string to validate
 * @returns true if valid Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  const result = SolanaAddressSchema.safeParse(address);
  return result.success;
}

/**
 * Validates address format based on blockchain
 * 
 * @param address - Address string to validate
 * @param chain - Target blockchain
 * @returns true if valid address for the specified chain
 */
export function isValidAddressForChain(
  address: string, 
  chain: typeof SUPPORTED_CHAINS[number]
): boolean {
  switch (chain) {
    case 'solana':
      return isValidSolanaAddress(address);
    case 'ethereum':
    case 'bsc':
    case 'polygon':
      return isValidEthereumAddress(address);
    default:
      return false;
  }
}

/**
 * Creates a default arbitrage bot configuration
 * 
 * @param userId - User ID for the bot
 * @param walletId - Wallet ID for the bot
 * @param name - Bot name
 * @param chain - Target blockchain
 * @returns Default arbitrage bot configuration
 */
export function createDefaultArbitrageConfig(
  userId: string,
  walletId: string,
  name: string,
  chain: typeof SUPPORTED_CHAINS[number]
): ArbitrageBotConfig {
  return {
    userId,
    walletId,
    name,
    chain,
    enabled: false,
    type: 'arbitrage',
    description: 'Default arbitrage bot configuration',
    version: '1.0.0',
    tokenPairs: [],
    minProfitPercentage: 0.5,
    maxSlippage: 2.0,
    gasSettings: {
      maxGasPrice: '50',
      priorityFee: '2',
      gasLimit: '300000',
    },
    riskParams: {
      maxPositionSize: '1000',
      maxDailyLoss: '100',
      stopLossPercentage: 5,
      takeProfitPercentage: 10,
      maxConcurrentTrades: 3,
      cooldownPeriod: 5000,
    },
  };
}

/**
 * Calculates profit percentage from price difference
 * 
 * @param buyPrice - Purchase price
 * @param sellPrice - Sale price
 * @returns Profit percentage
 */
export function calculateProfitPercentage(buyPrice: number, sellPrice: number): number {
  if (buyPrice <= 0) throw new Error('Buy price must be positive');
  return ((sellPrice - buyPrice) / buyPrice) * 100;
}

/**
 * Validates if profit meets minimum threshold
 * 
 * @param buyPrice - Purchase price
 * @param sellPrice - Sale price
 * @param minProfitPercentage - Minimum required profit percentage
 * @returns true if profit meets threshold
 */
export function meetsProfitThreshold(
  buyPrice: number,
  sellPrice: number,
  minProfitPercentage: number
): boolean {
  const profit = calculateProfitPercentage(buyPrice, sellPrice);
  return profit >= minProfitPercentage;
}

/**
 * Formats financial amount for display
 * 
 * @param amount - Amount string
 * @param decimals - Number of decimal places
 * @returns Formatted amount string
 */
export function formatFinancialAmount(amount: string, decimals: number = 2): string {
  const num = parseFloat(amount);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Validates gas price range for safety
 * 
 * @param gasPrice - Gas price in GWEI
 * @returns true if gas price is in safe range
 */
export function isValidGasPrice(gasPrice: string): boolean {
  const result = GasPriceSchema.safeParse(gasPrice);
  return result.success;
}

// ========================================
// CONSTANTS FOR VALIDATION
// ========================================

/** Maximum reasonable gas price in GWEI */
export const MAX_SAFE_GAS_PRICE = 1000;

/** Minimum reasonable gas price in GWEI */
export const MIN_SAFE_GAS_PRICE = 0.1;

/** Maximum reasonable slippage percentage */
export const MAX_SAFE_SLIPPAGE = 50;

/** Minimum reasonable slippage percentage */
export const MIN_SAFE_SLIPPAGE = 0.01;

/** Maximum concurrent trades for risk management */
export const MAX_CONCURRENT_TRADES = 50;

/** Default cooldown period in milliseconds */
export const DEFAULT_COOLDOWN_PERIOD = 5000;