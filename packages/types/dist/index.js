'use strict';

var zod = require('zod');

// src/bot.ts
var SUPPORTED_CHAINS = ["ethereum", "bsc", "polygon", "solana"];
var BOT_TYPES = ["arbitrage", "copy-trader", "mev-sandwich"];
var SUPPORTED_DEXES = ["uniswap-v2", "uniswap-v3", "sushiswap", "pancakeswap"];
var TRADE_SIZE_TYPES = ["FIXED", "PERCENTAGE", "RATIO"];
var METRIC_TIMEFRAMES = ["1h", "24h", "7d", "30d"];
var WEBSOCKET_EVENT_TYPES = [
  "bot_status",
  "trade_update",
  "price_update",
  "risk_alert",
  "system_alert"
];
var TRADE_EVENT_TYPES = [
  "opportunity_detected",
  "trade_executed",
  "trade_failed",
  "profit_realized"
];
var ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/;
var solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
var EthereumAddressSchema = zod.z.string().regex(ethereumAddressRegex, {
  message: "Invalid Ethereum address format"
});
var SolanaAddressSchema = zod.z.string().regex(solanaAddressRegex, {
  message: "Invalid Solana address format"
});
var PercentageSchema = zod.z.number().min(0, "Percentage cannot be negative").max(100, "Percentage cannot exceed 100%");
var FinancialAmountSchema = zod.z.string().regex(/^\d+(\.\d{1,18})?$/, "Invalid financial amount format").refine((val) => parseFloat(val) > 0, "Amount must be positive");
var GasPriceSchema = zod.z.string().regex(/^\d+(\.\d{1,9})?$/, "Invalid gas price format").refine((val) => {
  const parsed = parseFloat(val);
  return parsed >= 0.1 && parsed <= 1e3;
}, "Gas price must be between 0.1 and 1000 GWEI");
function createAddressSchema(chain) {
  return zod.z.string().refine((address) => isValidAddressForChain(address, chain), {
    message: `Invalid ${chain} address format`
  });
}
var BaseBotConfigSchema = zod.z.object({
  /** Unique bot identifier (auto-generated for new bots, required for updates) */
  id: zod.z.string().uuid("Invalid bot ID format").optional(),
  /** User identifier who owns this bot */
  userId: zod.z.string().min(1, "User ID is required").max(50, "User ID too long"),
  /** Wallet identifier for trading operations */
  walletId: zod.z.string().min(1, "Wallet ID is required").max(50, "Wallet ID too long"),
  /** Human-readable bot name for identification */
  name: zod.z.string().min(1, "Bot name is required").max(100, "Bot name too long").regex(/^[\w\s\-_]+$/, "Bot name contains invalid characters"),
  /** Whether the bot is currently enabled for trading */
  enabled: zod.z.boolean(),
  /** Target blockchain network for trading operations */
  chain: zod.z.enum(SUPPORTED_CHAINS, {
    errorMap: () => ({ message: `Invalid chain. Supported: ${SUPPORTED_CHAINS.join(", ")}` })
  }),
  /** Bot creation timestamp (ISO 8601 format) */
  createdAt: zod.z.string().datetime().optional(),
  /** Last update timestamp (ISO 8601 format) */
  updatedAt: zod.z.string().datetime().optional(),
  /** Optional bot description for documentation */
  description: zod.z.string().max(500, "Description too long").optional(),
  /** Bot version for configuration compatibility */
  version: zod.z.string().regex(/^\d+\.\d+\.\d+$/, "Invalid version format").default("1.0.0")
});
var ArbitrageBotConfigSchema = BaseBotConfigSchema.extend({
  /** Bot type identifier */
  type: zod.z.literal("arbitrage"),
  /** Token pairs to monitor for arbitrage opportunities */
  tokenPairs: zod.z.array(zod.z.object({
    /** Address of first token in the pair */
    tokenA: EthereumAddressSchema,
    /** Symbol of first token (e.g., 'USDC') */
    tokenASymbol: zod.z.string().min(1, "Token A symbol is required").max(20, "Token A symbol too long").toUpperCase(),
    /** Address of second token in the pair */
    tokenB: EthereumAddressSchema,
    /** Symbol of second token (e.g., 'WETH') */
    tokenBSymbol: zod.z.string().min(1, "Token B symbol is required").max(20, "Token B symbol too long").toUpperCase(),
    /** Minimum liquidity required for trading (in USD) */
    minLiquidity: FinancialAmountSchema,
    /** Whether this pair is actively monitored */
    enabled: zod.z.boolean(),
    /** Custom priority for this pair (higher = more priority) */
    priority: zod.z.number().min(1).max(10).default(5),
    /** Maximum position size for this specific pair */
    maxPositionUsd: FinancialAmountSchema.optional()
  })).min(1, "At least one token pair is required"),
  /** Minimum profit percentage to execute arbitrage (0.1% to 100%) */
  minProfitPercentage: zod.z.number().min(0.01, "Minimum profit must be at least 0.01%").max(100, "Maximum profit percentage is 100%"),
  /** Maximum slippage tolerance (0.1% to 50%) */
  maxSlippage: zod.z.number().min(0.01, "Minimum slippage must be at least 0.01%").max(50, "Maximum slippage cannot exceed 50%"),
  /** Gas optimization settings for transaction execution */
  gasSettings: zod.z.object({
    /** Maximum gas price willing to pay (in GWEI) */
    maxGasPrice: GasPriceSchema,
    /** Priority fee for EIP-1559 transactions (in GWEI) */
    priorityFee: GasPriceSchema,
    /** Gas limit for arbitrage transactions */
    gasLimit: zod.z.string().regex(/^\d+$/, "Gas limit must be a positive integer").refine((val) => {
      const num = parseInt(val);
      return num >= 21e3 && num <= 1e6;
    }, "Gas limit must be between 21,000 and 1,000,000"),
    /** Gas price increase strategy for stuck transactions */
    gasPriceIncrease: zod.z.object({
      enabled: zod.z.boolean().default(true),
      increasePercentage: zod.z.number().min(10).max(100).default(20),
      maxAttempts: zod.z.number().min(1).max(5).default(3)
    }).optional()
  }),
  /** Risk management parameters for safe trading */
  riskParams: zod.z.object({
    /** Maximum position size per trade (in USD) */
    maxPositionSize: FinancialAmountSchema,
    /** Maximum daily loss limit (in USD) */
    maxDailyLoss: FinancialAmountSchema,
    /** Stop loss percentage (0% to 100%) */
    stopLossPercentage: PercentageSchema,
    /** Take profit percentage (0% to 1000%) */
    takeProfitPercentage: zod.z.number().min(0, "Take profit cannot be negative").max(1e3, "Take profit cannot exceed 1000%"),
    /** Maximum number of concurrent trades */
    maxConcurrentTrades: zod.z.number().min(1, "Must allow at least 1 concurrent trade").max(50, "Too many concurrent trades increase risk"),
    /** Cooldown period between trades (in milliseconds) */
    cooldownPeriod: zod.z.number().min(0, "Cooldown period must be positive").max(3e5, "Cooldown period too long (max 5 minutes)"),
    /** Dynamic risk adjustment based on market conditions */
    dynamicRiskAdjustment: zod.z.object({
      enabled: zod.z.boolean().default(false),
      volatilityThreshold: zod.z.number().min(0.1).max(10).default(2),
      riskReductionFactor: zod.z.number().min(0.1).max(0.9).default(0.5)
    }).optional()
  }),
  /** Advanced Livshits route optimization for multi-hop arbitrage */
  livshitsOptimization: zod.z.object({
    /** Enable advanced route optimization algorithm */
    enabled: zod.z.boolean(),
    /** Maximum number of hops in arbitrage route (1-5) */
    maxHops: zod.z.number().min(1, "At least 1 hop required").max(5, "Too many hops increase risk and gas costs"),
    /** Pre-compute optimal routes to reduce execution time */
    precomputeRoutes: zod.z.boolean(),
    /** Route refresh interval in milliseconds (1-60 seconds) */
    routeRefreshMs: zod.z.number().min(1e3, "Minimum refresh interval is 1 second").max(6e4, "Maximum refresh interval is 60 seconds"),
    /** Minimum route efficiency threshold */
    minRouteEfficiency: zod.z.number().min(0.1, "Route efficiency too low").max(10, "Route efficiency too high").default(1)
  }).optional(),
  /** Cross-chain arbitrage configuration (advanced feature) */
  crossChainArbitrage: zod.z.object({
    /** Enable cross-chain arbitrage opportunities */
    enabled: zod.z.boolean(),
    /** Maximum time to wait for bridge completion (1 min to 1 hour) */
    maxBridgeWaitTime: zod.z.number().min(6e4, "Minimum bridge wait time is 1 minute").max(36e5, "Maximum bridge wait time is 1 hour"),
    /** Minimum profit percentage after bridge fees (0.1% to 100%) */
    minProfitAfterBridgeFees: zod.z.number().min(0.1, "Minimum profit after fees must be at least 0.1%").max(100, "Maximum profit after fees is 100%"),
    /** Bridge cost threshold in USD */
    bridgeCostThreshold: FinancialAmountSchema,
    /** Supported bridge protocols */
    supportedBridges: zod.z.array(zod.z.enum([
      "stargate",
      "hop",
      "across",
      "synapse",
      "multichain"
    ])).optional(),
    /** Bridge slippage tolerance */
    bridgeSlippage: zod.z.number().min(0.1, "Bridge slippage too low").max(5, "Bridge slippage too high").default(1)
  }).optional(),
  /** MEV protection and optimization settings */
  mevProtection: zod.z.object({
    /** Enable MEV protection mechanisms */
    enabled: zod.z.boolean().default(true),
    /** Use private mempool services */
    usePrivateMempool: zod.z.boolean().default(false),
    /** Maximum MEV threshold before aborting trade */
    maxMevThreshold: zod.z.number().min(0.1, "MEV threshold too low").max(10, "MEV threshold too high").default(2),
    /** Flashbots bundle configuration */
    flashbotsConfig: zod.z.object({
      enabled: zod.z.boolean().default(false),
      maxBundleSize: zod.z.number().min(1).max(10).default(3),
      bundleTimeout: zod.z.number().min(1e3).max(3e4).default(15e3)
    }).optional()
  }).optional()
});
var CopyTradingBotConfigSchema = BaseBotConfigSchema.extend({
  type: zod.z.literal("copy-trader"),
  targetWallet: zod.z.object({
    address: zod.z.string().min(1, "Target wallet address is required"),
    label: zod.z.string().optional(),
    verified: zod.z.boolean().default(false)
  }),
  copySettings: zod.z.object({
    tradeSize: zod.z.object({
      type: zod.z.enum(["FIXED", "PERCENTAGE", "RATIO"], {
        errorMap: () => ({ message: "Invalid trade size type" })
      }),
      value: zod.z.number().min(0.01, "Trade size value must be positive"),
      maxValue: zod.z.number().optional()
      // Maximum USD value for percentage/ratio modes
    }),
    copyDelay: zod.z.number().min(0).max(3e4),
    // Max 30 second delay
    slippageTolerance: zod.z.number().min(0.1).max(50),
    minTradeValue: zod.z.number().min(1),
    // Minimum USD value to copy
    maxTradeValue: zod.z.number().min(1)
    // Maximum USD value to copy
  }),
  filters: zod.z.object({
    tokenWhitelist: zod.z.array(zod.z.string()).optional(),
    tokenBlacklist: zod.z.array(zod.z.string()).optional(),
    dexWhitelist: zod.z.array(zod.z.string()).optional(),
    dexBlacklist: zod.z.array(zod.z.string()).optional(),
    minLiquidity: zod.z.number().min(1e3),
    // Minimum liquidity in USD
    maxGasPrice: zod.z.number().min(1)
    // Maximum gas price in gwei
  }),
  riskManagement: zod.z.object({
    stopLoss: zod.z.object({
      enabled: zod.z.boolean(),
      percentage: zod.z.number().min(1).max(50)
    }),
    takeProfit: zod.z.object({
      enabled: zod.z.boolean(),
      percentage: zod.z.number().min(1).max(1e3)
    }),
    maxDailyLoss: zod.z.number().min(10).max(1e4),
    // USD
    maxConcurrentTrades: zod.z.number().min(1).max(20)
  })
});
var SandwichBotConfigSchema = BaseBotConfigSchema.extend({
  type: zod.z.literal("mev-sandwich"),
  targetDexes: zod.z.array(zod.z.enum(["uniswap-v2", "uniswap-v3", "sushiswap", "pancakeswap"], {
    errorMap: () => ({ message: "Invalid DEX selection" })
  })).min(1, "At least one target DEX is required"),
  sandwichSettings: zod.z.object({
    minVictimTradeValue: zod.z.number().min(1e3),
    // Minimum victim trade value in USD
    maxVictimTradeValue: zod.z.number().min(1e3),
    // Maximum victim trade value in USD
    frontrunMultiplier: zod.z.number().min(1.1).max(5),
    // Gas price multiplier for frontrun
    backrunMultiplier: zod.z.number().min(1.05).max(3),
    // Gas price multiplier for backrun
    profitThreshold: zod.z.number().min(0.1).max(10),
    // Minimum profit percentage
    maxSlippage: zod.z.number().min(0.1).max(5)
  }),
  mevProtection: zod.z.object({
    flashbotsEnabled: zod.z.boolean(),
    bloxrouteEnabled: zod.z.boolean(),
    miningPoolsEnabled: zod.z.boolean(),
    bundleOptimization: zod.z.boolean(),
    maxWaitTime: zod.z.number().min(1e3).max(3e4)
    // Max wait for bundle inclusion
  }),
  riskControls: zod.z.object({
    maxPositionSize: zod.z.number().min(100).max(1e5),
    // USD
    maxDailyVolume: zod.z.number().min(1e3).max(1e6),
    // USD
    cooldownPeriod: zod.z.number().min(0).max(3e5),
    // Milliseconds between attacks
    emergencyStop: zod.z.object({
      enabled: zod.z.boolean(),
      maxLossPercentage: zod.z.number().min(1).max(50),
      consecutiveFailures: zod.z.number().min(2).max(10)
    })
  }),
  // Advanced MEV-specific settings
  liquidityAnalysis: zod.z.object({
    enabled: zod.z.boolean(),
    minPoolLiquidity: zod.z.number().min(1e4),
    // USD
    liquidityRatioThreshold: zod.z.number().min(0.01).max(1)
    // Max % of pool liquidity to trade
  }).optional(),
  competitorDetection: zod.z.object({
    enabled: zod.z.boolean(),
    maxCompetitors: zod.z.number().min(1).max(10),
    competitorGasMultiplier: zod.z.number().min(1.1).max(2)
  }).optional()
});
var BotConfigSchema = zod.z.discriminatedUnion("type", [
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  SandwichBotConfigSchema
]);
var BotEntitySchema = zod.z.object({
  id: zod.z.string(),
  userId: zod.z.string(),
  walletId: zod.z.string(),
  type: zod.z.enum(["arbitrage", "copy-trader", "mev-sandwich"]),
  name: zod.z.string(),
  enabled: zod.z.boolean(),
  config: zod.z.record(zod.z.any()),
  // JSON storage for type-specific config
  createdAt: zod.z.date(),
  updatedAt: zod.z.date(),
  lastActivity: zod.z.date().optional()
});
var CreateBotRequestSchema = zod.z.object({
  type: zod.z.enum(["arbitrage", "copy-trader", "mev-sandwich"]),
  config: zod.z.record(zod.z.any())
  // Will be validated against specific bot schema
});
var UpdateBotRequestSchema = zod.z.object({
  name: zod.z.string().optional(),
  enabled: zod.z.boolean().optional(),
  config: zod.z.record(zod.z.any()).optional()
});
var BotStatusSchema = zod.z.object({
  id: zod.z.string(),
  isRunning: zod.z.boolean(),
  lastActivity: zod.z.string(),
  totalTrades: zod.z.number(),
  totalProfit: zod.z.string(),
  totalLoss: zod.z.string(),
  winRate: zod.z.number().min(0).max(100),
  errors: zod.z.array(zod.z.string()),
  uptime: zod.z.number(),
  // seconds
  avgExecutionTime: zod.z.number()
  // milliseconds
});
var TradeEventSchema = zod.z.object({
  id: zod.z.string(),
  botId: zod.z.string(),
  type: zod.z.enum(["opportunity_detected", "trade_executed", "trade_failed", "profit_realized"]),
  timestamp: zod.z.number(),
  data: zod.z.record(zod.z.any())
});
var PerformanceMetricsSchema = zod.z.object({
  botId: zod.z.string(),
  timeframe: zod.z.enum(["1h", "24h", "7d", "30d"]),
  totalTrades: zod.z.number(),
  successfulTrades: zod.z.number(),
  failedTrades: zod.z.number(),
  totalProfit: zod.z.number(),
  totalLoss: zod.z.number(),
  avgExecutionTime: zod.z.number(),
  maxDrawdown: zod.z.number(),
  sharpeRatio: zod.z.number().optional(),
  profitFactor: zod.z.number().optional()
});
var ErrorResponseSchema = zod.z.object({
  error: zod.z.string(),
  code: zod.z.string().optional(),
  details: zod.z.record(zod.z.any()).optional(),
  timestamp: zod.z.string()
});
var PaginationSchema = zod.z.object({
  page: zod.z.number().min(1).default(1),
  limit: zod.z.number().min(1).max(100).default(20),
  total: zod.z.number().optional(),
  totalPages: zod.z.number().optional()
});
var WebSocketEventSchema = zod.z.object({
  type: zod.z.enum(["bot_status", "trade_update", "price_update", "risk_alert", "system_alert"]),
  data: zod.z.record(zod.z.any()),
  timestamp: zod.z.number(),
  botId: zod.z.string().optional()
});
function isArbitrageBotConfig(config) {
  return config.type === "arbitrage";
}
function isCopyTradingBotConfig(config) {
  return config.type === "copy-trader";
}
function isSandwichBotConfig(config) {
  return config.type === "mev-sandwich";
}
function validateBotConfig(data) {
  return BotConfigSchema.parse(data);
}
function safeValidateBotConfig(data) {
  const result = BotConfigSchema.safeParse(data);
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
}
function isValidFinancialAmount(amount) {
  const result = FinancialAmountSchema.safeParse(amount);
  return result.success;
}
function isValidEthereumAddress(address) {
  const result = EthereumAddressSchema.safeParse(address);
  return result.success;
}
function isValidSolanaAddress(address) {
  const result = SolanaAddressSchema.safeParse(address);
  return result.success;
}
function isValidAddressForChain(address, chain) {
  switch (chain) {
    case "solana":
      return isValidSolanaAddress(address);
    case "ethereum":
    case "bsc":
    case "polygon":
      return isValidEthereumAddress(address);
    default:
      return false;
  }
}
function createDefaultArbitrageConfig(userId, walletId, name, chain) {
  return {
    userId,
    walletId,
    name,
    chain,
    enabled: false,
    type: "arbitrage",
    description: "Default arbitrage bot configuration",
    version: "1.0.0",
    tokenPairs: [],
    minProfitPercentage: 0.5,
    maxSlippage: 2,
    gasSettings: {
      maxGasPrice: "50",
      priorityFee: "2",
      gasLimit: "300000"
    },
    riskParams: {
      maxPositionSize: "1000",
      maxDailyLoss: "100",
      stopLossPercentage: 5,
      takeProfitPercentage: 10,
      maxConcurrentTrades: 3,
      cooldownPeriod: 5e3
    }
  };
}
function calculateProfitPercentage(buyPrice, sellPrice) {
  if (buyPrice <= 0) throw new Error("Buy price must be positive");
  return (sellPrice - buyPrice) / buyPrice * 100;
}
function meetsProfitThreshold(buyPrice, sellPrice, minProfitPercentage) {
  const profit = calculateProfitPercentage(buyPrice, sellPrice);
  return profit >= minProfitPercentage;
}
function formatFinancialAmount(amount, decimals = 2) {
  const num = parseFloat(amount);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
function isValidGasPrice(gasPrice) {
  const result = GasPriceSchema.safeParse(gasPrice);
  return result.success;
}
var MAX_SAFE_GAS_PRICE = 1e3;
var MIN_SAFE_GAS_PRICE = 0.1;
var MAX_SAFE_SLIPPAGE = 50;
var MIN_SAFE_SLIPPAGE = 0.01;
var MAX_CONCURRENT_TRADES = 50;
var DEFAULT_COOLDOWN_PERIOD = 5e3;

// index.ts
function isValidChain(value) {
  return typeof value === "string" && ["ETH", "BSC", "SOL", "POLYGON", "ARBITRUM", "OPTIMISM"].includes(value);
}
function isValidUserRole(value) {
  return typeof value === "string" && ["admin", "trader", "viewer", "developer", "auditor"].includes(value);
}
function isValidTradeStatus(value) {
  return typeof value === "string" && ["pending", "submitted", "confirmed", "success", "failed", "cancelled", "expired"].includes(value);
}
function hasPermission(user, requiredPermission) {
  return user.permissions?.some((p) => p.id === requiredPermission) ?? false;
}
function sanitizeUser(user) {
  return user;
}
function sanitizeWallet(wallet) {
  return wallet;
}
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
function isValidAddress(address, chain) {
  switch (chain) {
    case "ETH":
    case "BSC":
    case "POLYGON":
    case "ARBITRUM":
    case "OPTIMISM":
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case "SOL":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    default:
      return false;
  }
}
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
/**
 * @fileoverview Trading Bot Platform Type Definitions
 * 
 * Enterprise-grade TypeScript type system for institutional trading bot platform
 * with comprehensive type safety, validation schemas, and security-focused architecture.
 * 
 * This module provides:
 * - Secure type definitions with separated sensitive data
 * - Comprehensive validation utilities and type guards
 * - Multi-chain blockchain support with type safety
 * - Advanced trading bot configuration types
 * - API and authentication type definitions
 * - Real-time data and WebSocket event types
 * - Permission and access control systems
 * 
 * @version 2.0.0
 * @author Trading Bot Development Team
 * @license MIT
 * @security High - Contains financial trading type definitions
 */

exports.ArbitrageBotConfigSchema = ArbitrageBotConfigSchema;
exports.BOT_TYPES = BOT_TYPES;
exports.BotConfigSchema = BotConfigSchema;
exports.BotEntitySchema = BotEntitySchema;
exports.BotStatusSchema = BotStatusSchema;
exports.CopyTradingBotConfigSchema = CopyTradingBotConfigSchema;
exports.CreateBotRequestSchema = CreateBotRequestSchema;
exports.DEFAULT_COOLDOWN_PERIOD = DEFAULT_COOLDOWN_PERIOD;
exports.ErrorResponseSchema = ErrorResponseSchema;
exports.EthereumAddressSchema = EthereumAddressSchema;
exports.FinancialAmountSchema = FinancialAmountSchema;
exports.GasPriceSchema = GasPriceSchema;
exports.MAX_CONCURRENT_TRADES = MAX_CONCURRENT_TRADES;
exports.MAX_SAFE_GAS_PRICE = MAX_SAFE_GAS_PRICE;
exports.MAX_SAFE_SLIPPAGE = MAX_SAFE_SLIPPAGE;
exports.METRIC_TIMEFRAMES = METRIC_TIMEFRAMES;
exports.MIN_SAFE_GAS_PRICE = MIN_SAFE_GAS_PRICE;
exports.MIN_SAFE_SLIPPAGE = MIN_SAFE_SLIPPAGE;
exports.PaginationSchema = PaginationSchema;
exports.PercentageSchema = PercentageSchema;
exports.PerformanceMetricsSchema = PerformanceMetricsSchema;
exports.SUPPORTED_CHAINS = SUPPORTED_CHAINS;
exports.SUPPORTED_DEXES = SUPPORTED_DEXES;
exports.SandwichBotConfigSchema = SandwichBotConfigSchema;
exports.SolanaAddressSchema = SolanaAddressSchema;
exports.TRADE_EVENT_TYPES = TRADE_EVENT_TYPES;
exports.TRADE_SIZE_TYPES = TRADE_SIZE_TYPES;
exports.TradeEventSchema = TradeEventSchema;
exports.UpdateBotRequestSchema = UpdateBotRequestSchema;
exports.WEBSOCKET_EVENT_TYPES = WEBSOCKET_EVENT_TYPES;
exports.WebSocketEventSchema = WebSocketEventSchema;
exports.calculateProfitPercentage = calculateProfitPercentage;
exports.createAddressSchema = createAddressSchema;
exports.createDefaultArbitrageConfig = createDefaultArbitrageConfig;
exports.formatFinancialAmount = formatFinancialAmount;
exports.hasPermission = hasPermission;
exports.isArbitrageBotConfig = isArbitrageBotConfig;
exports.isCopyTradingBotConfig = isCopyTradingBotConfig;
exports.isSandwichBotConfig = isSandwichBotConfig;
exports.isValidAddress = isValidAddress;
exports.isValidAddressForChain = isValidAddressForChain;
exports.isValidChain = isValidChain;
exports.isValidEmail = isValidEmail;
exports.isValidEthereumAddress = isValidEthereumAddress;
exports.isValidFinancialAmount = isValidFinancialAmount;
exports.isValidGasPrice = isValidGasPrice;
exports.isValidSolanaAddress = isValidSolanaAddress;
exports.isValidTradeStatus = isValidTradeStatus;
exports.isValidUserRole = isValidUserRole;
exports.meetsProfitThreshold = meetsProfitThreshold;
exports.safeValidateBotConfig = safeValidateBotConfig;
exports.sanitizeUser = sanitizeUser;
exports.sanitizeWallet = sanitizeWallet;
exports.validateBotConfig = validateBotConfig;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map