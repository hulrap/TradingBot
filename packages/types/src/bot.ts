import { z } from 'zod';

// Base Bot Configuration Schema (shared across all bot types)
export const BaseBotConfigSchema = z.object({
  id: z.string().optional(), // Optional for creation, required for updates
  userId: z.string().min(1, 'User ID is required'),
  walletId: z.string().min(1, 'Wallet ID is required'),
  name: z.string().min(1, 'Bot name is required'),
  enabled: z.boolean(),
  chain: z.enum(['ethereum', 'bsc', 'polygon', 'solana'], {
    errorMap: () => ({ message: 'Invalid chain selection' })
  }),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Enhanced Arbitrage Bot Configuration Schema
export const ArbitrageBotConfigSchema = BaseBotConfigSchema.extend({
  type: z.literal('arbitrage'),
  tokenPairs: z.array(z.object({
    tokenA: z.string().min(1, 'Token A is required'),
    tokenASymbol: z.string().min(1, 'Token A symbol is required'),
    tokenB: z.string().min(1, 'Token B is required'),
    tokenBSymbol: z.string().min(1, 'Token B symbol is required'),
    minLiquidity: z.string().min(1, 'Minimum liquidity is required'),
    enabled: z.boolean()
  })).min(1, 'At least one token pair is required'),
  minProfitPercentage: z.number().min(0.1).max(100),
  maxSlippage: z.number().min(0.1).max(100),
  gasSettings: z.object({
    maxGasPrice: z.string().min(1, 'Max gas price is required'),
    priorityFee: z.string().min(1, 'Priority fee must be a valid number'),
    gasLimit: z.string().min(1, 'Gas limit is required')
  }),
  riskParams: z.object({
    maxPositionSize: z.string().min(1, 'Max position size is required'),
    maxDailyLoss: z.string().min(1, 'Max daily loss is required'),
    stopLossPercentage: z.number().min(0).max(100),
    takeProfitPercentage: z.number().min(0).max(100),
    maxConcurrentTrades: z.number().min(1).max(10),
    cooldownPeriod: z.number().min(0, 'Cooldown period must be positive')
  }),
  // Advanced arbitrage-specific settings
  livshitsOptimization: z.object({
    enabled: z.boolean(),
    maxHops: z.number().min(1).max(5),
    precomputeRoutes: z.boolean(),
    routeRefreshMs: z.number().min(1000).max(60000),
  }).optional(),
  crossChainArbitrage: z.object({
    enabled: z.boolean(),
    maxBridgeWaitTime: z.number().min(60000).max(3600000), // 1 min to 1 hour
    minProfitAfterBridgeFees: z.number().min(0.1).max(100),
    bridgeCostThreshold: z.number().min(1).max(1000),
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