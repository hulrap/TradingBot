"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  AIStrategyTypeSchema: () => AIStrategyTypeSchema,
  APIKeySchema: () => APIKeySchema,
  APIResponseSchema: () => APIResponseSchema,
  AlertSchema: () => AlertSchema,
  AlertSeveritySchema: () => AlertSeveritySchema,
  AlertTypeSchema: () => AlertTypeSchema,
  ArbitrageBotConfigSchema: () => ArbitrageBotConfigSchema,
  ArbitrageOpportunitySchema: () => ArbitrageOpportunitySchema,
  AuthResponseSchema: () => AuthResponseSchema,
  BaseBotConfigSchema: () => BaseBotConfigSchema,
  BlockSchema: () => BlockSchema,
  BotConfigSchema: () => BotConfigSchema,
  BotStateSchema: () => BotStateSchema,
  BotStatusSchema: () => BotStatusSchema,
  BotTypeSchema: () => BotTypeSchema,
  BundleTransactionSchema: () => BundleTransactionSchema,
  ChainConfigSchema: () => ChainConfigSchema,
  ChainSchema: () => ChainSchema,
  ConnectionStatusSchema: () => ConnectionStatusSchema,
  CopyTradingBotConfigSchema: () => CopyTradingBotConfigSchema,
  DEXConfigSchema: () => DEXConfigSchema,
  DEXSchema: () => DEXSchema,
  DatabaseConfigSchema: () => DatabaseConfigSchema,
  FeatureSchema: () => FeatureSchema,
  FlashbotsBundleSchema: () => FlashbotsBundleSchema,
  GasEstimateSchema: () => GasEstimateSchema,
  HTTPMethodSchema: () => HTTPMethodSchema,
  JWTPayloadSchema: () => JWTPayloadSchema,
  LoginRequestSchema: () => LoginRequestSchema,
  MEVBundleSchema: () => MEVBundleSchema,
  MEVOpportunitySchema: () => MEVOpportunitySchema,
  MEVOpportunityTypeSchema: () => MEVOpportunityTypeSchema,
  MLModelConfigSchema: () => MLModelConfigSchema,
  MarketDataSchema: () => MarketDataSchema,
  OrderBookEntrySchema: () => OrderBookEntrySchema,
  OrderBookSchema: () => OrderBookSchema,
  PaginatedResponseSchema: () => PaginatedResponseSchema,
  PaginationSchema: () => PaginationSchema,
  PerformanceMetricsSchema: () => PerformanceMetricsSchema,
  PredictionSchema: () => PredictionSchema,
  QuoteSchema: () => QuoteSchema,
  RateLimitSchema: () => RateLimitSchema,
  RegisterRequestSchema: () => RegisterRequestSchema,
  RequestHeadersSchema: () => RequestHeadersSchema,
  RiskEventSchema: () => RiskEventSchema,
  RiskEventSeveritySchema: () => RiskEventSeveritySchema,
  RiskEventTypeSchema: () => RiskEventTypeSchema,
  RiskParametersSchema: () => RiskParametersSchema,
  SandwichBotConfigSchema: () => SandwichBotConfigSchema,
  SessionSchema: () => SessionSchema,
  TokenSchema: () => TokenSchema,
  TradeSchema: () => TradeSchema,
  TradeStatusSchema: () => TradeStatusSchema,
  TradeTypeSchema: () => TradeTypeSchema,
  TradingPairSchema: () => TradingPairSchema,
  TransactionSchema: () => TransactionSchema,
  UserProfileSchema: () => UserProfileSchema,
  UserSchema: () => UserSchema,
  WSConnectionSchema: () => WSConnectionSchema,
  WSMessageSchema: () => WSMessageSchema,
  WSMessageTypeSchema: () => WSMessageTypeSchema,
  WalletSchema: () => WalletSchema
});
module.exports = __toCommonJS(src_exports);

// src/auth.ts
var import_zod = require("zod");
var UserSchema = import_zod.z.object({
  id: import_zod.z.string().uuid(),
  email: import_zod.z.string().email(),
  emailVerified: import_zod.z.boolean(),
  twoFactorEnabled: import_zod.z.boolean(),
  isActive: import_zod.z.boolean(),
  createdAt: import_zod.z.date(),
  updatedAt: import_zod.z.date(),
  lastLogin: import_zod.z.date().optional()
});
var UserProfileSchema = import_zod.z.object({
  id: import_zod.z.string().uuid(),
  userId: import_zod.z.string().uuid(),
  firstName: import_zod.z.string().optional(),
  lastName: import_zod.z.string().optional(),
  phone: import_zod.z.string().optional(),
  timezone: import_zod.z.string().default("UTC"),
  notificationPreferences: import_zod.z.object({
    email: import_zod.z.boolean().default(true),
    sms: import_zod.z.boolean().default(false),
    discord: import_zod.z.boolean().default(false)
  }),
  riskTolerance: import_zod.z.enum(["low", "medium", "high"]).default("medium")
});
var JWTPayloadSchema = import_zod.z.object({
  sub: import_zod.z.string().uuid(),
  // user ID
  email: import_zod.z.string().email(),
  iat: import_zod.z.number(),
  exp: import_zod.z.number(),
  jti: import_zod.z.string().optional()
});
var LoginRequestSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(8),
  twoFactorCode: import_zod.z.string().optional()
});
var RegisterRequestSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  firstName: import_zod.z.string().optional(),
  lastName: import_zod.z.string().optional()
});
var AuthResponseSchema = import_zod.z.object({
  success: import_zod.z.boolean(),
  user: import_zod.z.any().optional(),
  // Using any for Supabase User type compatibility
  accessToken: import_zod.z.string().optional(),
  refreshToken: import_zod.z.string().optional(),
  expiresIn: import_zod.z.number().optional(),
  error: import_zod.z.string().optional(),
  message: import_zod.z.string().optional(),
  timestamp: import_zod.z.date().default(() => /* @__PURE__ */ new Date())
});
var SessionSchema = import_zod.z.object({
  id: import_zod.z.string(),
  userId: import_zod.z.string().uuid(),
  accessToken: import_zod.z.string(),
  refreshToken: import_zod.z.string(),
  expiresAt: import_zod.z.date(),
  createdAt: import_zod.z.date(),
  ipAddress: import_zod.z.string().optional(),
  userAgent: import_zod.z.string().optional()
});

// src/blockchain.ts
var import_zod2 = require("zod");
var ChainSchema = import_zod2.z.enum(["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]);
var ChainConfigSchema = import_zod2.z.object({
  id: import_zod2.z.number(),
  name: ChainSchema,
  displayName: import_zod2.z.string(),
  rpcUrl: import_zod2.z.string().url(),
  wsUrl: import_zod2.z.string().url().optional(),
  blockExplorer: import_zod2.z.string().url(),
  nativeCurrency: import_zod2.z.object({
    name: import_zod2.z.string(),
    symbol: import_zod2.z.string(),
    decimals: import_zod2.z.number()
  }),
  isTestnet: import_zod2.z.boolean().default(false)
});
var WalletSchema = import_zod2.z.object({
  id: import_zod2.z.string().uuid(),
  userId: import_zod2.z.string().uuid(),
  name: import_zod2.z.string(),
  address: import_zod2.z.string(),
  chain: ChainSchema,
  encryptedPrivateKey: import_zod2.z.string(),
  walletType: import_zod2.z.enum(["imported", "generated"]).default("imported"),
  isActive: import_zod2.z.boolean().default(true),
  createdAt: import_zod2.z.date(),
  updatedAt: import_zod2.z.date()
});
var TokenSchema = import_zod2.z.object({
  address: import_zod2.z.string(),
  symbol: import_zod2.z.string(),
  name: import_zod2.z.string(),
  decimals: import_zod2.z.number(),
  chain: ChainSchema,
  logoUri: import_zod2.z.string().url().optional(),
  coingeckoId: import_zod2.z.string().optional(),
  isVerified: import_zod2.z.boolean().default(false)
});
var TransactionSchema = import_zod2.z.object({
  hash: import_zod2.z.string(),
  from: import_zod2.z.string(),
  to: import_zod2.z.string(),
  value: import_zod2.z.string(),
  gasLimit: import_zod2.z.string(),
  gasPrice: import_zod2.z.string().optional(),
  maxFeePerGas: import_zod2.z.string().optional(),
  maxPriorityFeePerGas: import_zod2.z.string().optional(),
  nonce: import_zod2.z.number(),
  data: import_zod2.z.string().optional(),
  blockNumber: import_zod2.z.number().optional(),
  blockHash: import_zod2.z.string().optional(),
  transactionIndex: import_zod2.z.number().optional(),
  confirmations: import_zod2.z.number().optional(),
  status: import_zod2.z.enum(["pending", "confirmed", "failed"]).optional()
});
var GasEstimateSchema = import_zod2.z.object({
  gasLimit: import_zod2.z.string(),
  gasPrice: import_zod2.z.string().optional(),
  maxFeePerGas: import_zod2.z.string().optional(),
  maxPriorityFeePerGas: import_zod2.z.string().optional(),
  estimatedCost: import_zod2.z.string(),
  estimatedCostUSD: import_zod2.z.number().optional()
});
var BlockSchema = import_zod2.z.object({
  number: import_zod2.z.number(),
  hash: import_zod2.z.string(),
  parentHash: import_zod2.z.string(),
  timestamp: import_zod2.z.number(),
  gasLimit: import_zod2.z.string(),
  gasUsed: import_zod2.z.string(),
  baseFeePerGas: import_zod2.z.string().optional(),
  transactions: import_zod2.z.array(import_zod2.z.string()),
  miner: import_zod2.z.string().optional(),
  difficulty: import_zod2.z.string().optional()
});
var DEXSchema = import_zod2.z.enum([
  "uniswap_v2",
  "uniswap_v3",
  "sushiswap",
  "pancakeswap",
  "jupiter",
  "raydium",
  "orca",
  "serum",
  "1inch",
  "paraswap",
  "kyber",
  "balancer"
]);
var DEXConfigSchema = import_zod2.z.object({
  name: DEXSchema,
  chain: ChainSchema,
  factoryAddress: import_zod2.z.string().optional(),
  routerAddress: import_zod2.z.string().optional(),
  quoterAddress: import_zod2.z.string().optional(),
  fee: import_zod2.z.number(),
  // in basis points
  isActive: import_zod2.z.boolean().default(true)
});

// src/bot.ts
var import_zod3 = require("zod");
var BotTypeSchema = import_zod3.z.enum(["arbitrage", "copy_trader", "sandwich", "liquidation", "jit_liquidity", "market_maker"]);
var BotStatusSchema = import_zod3.z.enum(["idle", "running", "paused", "error", "stopped"]);
var BaseBotConfigSchema = import_zod3.z.object({
  id: import_zod3.z.string().uuid(),
  userId: import_zod3.z.string().uuid(),
  walletId: import_zod3.z.string().uuid(),
  botType: BotTypeSchema,
  name: import_zod3.z.string(),
  isActive: import_zod3.z.boolean().default(false),
  isPaperTrading: import_zod3.z.boolean().default(true),
  maxDailyTrades: import_zod3.z.number().default(100),
  maxPositionSize: import_zod3.z.string().optional(),
  stopLossPercentage: import_zod3.z.number().optional(),
  takeProfitPercentage: import_zod3.z.number().optional(),
  createdAt: import_zod3.z.date(),
  updatedAt: import_zod3.z.date()
});
var ArbitrageBotConfigSchema = BaseBotConfigSchema.extend({
  botType: import_zod3.z.literal("arbitrage"),
  configuration: import_zod3.z.object({
    tokenPairs: import_zod3.z.array(import_zod3.z.object({
      tokenA: import_zod3.z.string(),
      tokenB: import_zod3.z.string(),
      chains: import_zod3.z.array(ChainSchema)
    })),
    minProfitThreshold: import_zod3.z.number().min(0).max(100),
    // percentage
    maxSlippage: import_zod3.z.number().min(0).max(10),
    // percentage
    dexes: import_zod3.z.array(import_zod3.z.string()),
    gasMultiplier: import_zod3.z.number().min(1).max(3).default(1.2),
    enableMEVProtection: import_zod3.z.boolean().default(true)
  })
});
var CopyTradingBotConfigSchema = BaseBotConfigSchema.extend({
  botType: import_zod3.z.literal("copy_trader"),
  configuration: import_zod3.z.object({
    targetAddresses: import_zod3.z.array(import_zod3.z.object({
      address: import_zod3.z.string(),
      chain: ChainSchema,
      copyPercentage: import_zod3.z.number().min(1).max(100).default(100),
      maxCopyAmount: import_zod3.z.string().optional()
    })),
    copySettings: import_zod3.z.object({
      copyType: import_zod3.z.enum(["fixed_amount", "percentage"]).default("percentage"),
      fixedAmount: import_zod3.z.string().optional(),
      percentage: import_zod3.z.number().min(1).max(100).default(10)
    }),
    filters: import_zod3.z.object({
      minTradeSize: import_zod3.z.string().optional(),
      maxTradeSize: import_zod3.z.string().optional(),
      excludeTokens: import_zod3.z.array(import_zod3.z.string()).default([]),
      onlyVerifiedTokens: import_zod3.z.boolean().default(true)
    }),
    latencyOptimization: import_zod3.z.boolean().default(true)
  })
});
var SandwichBotConfigSchema = BaseBotConfigSchema.extend({
  botType: import_zod3.z.literal("sandwich"),
  configuration: import_zod3.z.object({
    targetDEXes: import_zod3.z.array(import_zod3.z.string()),
    minVictimTradeSize: import_zod3.z.string(),
    maxGasBid: import_zod3.z.string(),
    profitThreshold: import_zod3.z.number().min(0).max(100),
    mevRelays: import_zod3.z.array(import_zod3.z.string()),
    competitionAnalysis: import_zod3.z.boolean().default(true),
    bundleSettings: import_zod3.z.object({
      maxBundleSize: import_zod3.z.number().default(3),
      gasMultiplier: import_zod3.z.number().min(1).max(5).default(2)
    })
  })
});
var BotConfigSchema = import_zod3.z.discriminatedUnion("botType", [
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  SandwichBotConfigSchema
]);
var BotStateSchema = import_zod3.z.object({
  botId: import_zod3.z.string(),
  status: BotStatusSchema,
  lastActivity: import_zod3.z.date(),
  errorCount: import_zod3.z.number().default(0),
  lastError: import_zod3.z.string().optional(),
  performanceMetrics: import_zod3.z.object({
    totalTrades: import_zod3.z.number().default(0),
    successfulTrades: import_zod3.z.number().default(0),
    totalProfit: import_zod3.z.string().default("0"),
    totalLoss: import_zod3.z.string().default("0"),
    winRate: import_zod3.z.number().default(0),
    avgExecutionTime: import_zod3.z.number().default(0)
  }),
  createdAt: import_zod3.z.date(),
  updatedAt: import_zod3.z.date()
});

// src/database.ts
var import_zod4 = require("zod");
var PerformanceMetricsSchema = import_zod4.z.object({
  id: import_zod4.z.string().uuid(),
  userId: import_zod4.z.string().uuid(),
  botConfigId: import_zod4.z.string().uuid(),
  date: import_zod4.z.date(),
  totalTrades: import_zod4.z.number().default(0),
  successfulTrades: import_zod4.z.number().default(0),
  totalVolume: import_zod4.z.string().default("0"),
  totalProfitLoss: import_zod4.z.string().default("0"),
  totalProfitLossUSD: import_zod4.z.number().default(0),
  maxDrawdown: import_zod4.z.number().default(0),
  sharpeRatio: import_zod4.z.number().optional(),
  winRate: import_zod4.z.number().default(0),
  averageTradeSize: import_zod4.z.string().default("0"),
  createdAt: import_zod4.z.date()
});
var AlertTypeSchema = import_zod4.z.enum(["trade_executed", "profit_target", "stop_loss", "error", "system"]);
var AlertSeveritySchema = import_zod4.z.enum(["info", "warning", "error", "critical"]);
var AlertSchema = import_zod4.z.object({
  id: import_zod4.z.string().uuid(),
  userId: import_zod4.z.string().uuid(),
  botConfigId: import_zod4.z.string().uuid().optional(),
  alertType: AlertTypeSchema,
  title: import_zod4.z.string(),
  message: import_zod4.z.string(),
  severity: AlertSeveritySchema.default("info"),
  isRead: import_zod4.z.boolean().default(false),
  metadata: import_zod4.z.record(import_zod4.z.any()).optional(),
  createdAt: import_zod4.z.date()
});
var APIKeySchema = import_zod4.z.object({
  id: import_zod4.z.string().uuid(),
  userId: import_zod4.z.string().uuid(),
  serviceName: import_zod4.z.string(),
  encryptedApiKey: import_zod4.z.string(),
  encryptedSecretKey: import_zod4.z.string().optional(),
  isActive: import_zod4.z.boolean().default(true),
  createdAt: import_zod4.z.date(),
  updatedAt: import_zod4.z.date()
});
var DatabaseConfigSchema = import_zod4.z.object({
  host: import_zod4.z.string(),
  port: import_zod4.z.number(),
  database: import_zod4.z.string(),
  username: import_zod4.z.string(),
  password: import_zod4.z.string(),
  ssl: import_zod4.z.boolean().default(true),
  maxConnections: import_zod4.z.number().default(10)
});

// src/api.ts
var import_zod5 = require("zod");
var APIResponseSchema = import_zod5.z.object({
  success: import_zod5.z.boolean(),
  data: import_zod5.z.any().optional(),
  error: import_zod5.z.string().optional(),
  message: import_zod5.z.string().optional(),
  timestamp: import_zod5.z.date().default(() => /* @__PURE__ */ new Date())
});
var PaginationSchema = import_zod5.z.object({
  page: import_zod5.z.number().min(1).default(1),
  limit: import_zod5.z.number().min(1).max(100).default(20),
  total: import_zod5.z.number().optional(),
  totalPages: import_zod5.z.number().optional()
});
var PaginatedResponseSchema = (dataSchema) => import_zod5.z.object({
  success: import_zod5.z.boolean(),
  data: import_zod5.z.array(dataSchema),
  pagination: PaginationSchema,
  error: import_zod5.z.string().optional()
});
var HTTPMethodSchema = import_zod5.z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]);
var RequestHeadersSchema = import_zod5.z.object({
  "Authorization": import_zod5.z.string().optional(),
  "Content-Type": import_zod5.z.string().optional(),
  "X-API-Key": import_zod5.z.string().optional(),
  "User-Agent": import_zod5.z.string().optional()
});
var RateLimitSchema = import_zod5.z.object({
  limit: import_zod5.z.number(),
  remaining: import_zod5.z.number(),
  reset: import_zod5.z.number(),
  retryAfter: import_zod5.z.number().optional()
});

// src/trading.ts
var import_zod6 = require("zod");
var TradeTypeSchema = import_zod6.z.enum(["buy", "sell", "swap", "arbitrage", "sandwich", "liquidation"]);
var TradeStatusSchema = import_zod6.z.enum(["pending", "confirmed", "failed", "cancelled"]);
var TradeSchema = import_zod6.z.object({
  id: import_zod6.z.string().uuid(),
  userId: import_zod6.z.string().uuid(),
  botConfigId: import_zod6.z.string().uuid().optional(),
  walletId: import_zod6.z.string().uuid(),
  transactionHash: import_zod6.z.string().optional(),
  chain: ChainSchema,
  tradeType: TradeTypeSchema,
  tokenIn: import_zod6.z.string(),
  tokenOut: import_zod6.z.string(),
  amountIn: import_zod6.z.string(),
  amountOut: import_zod6.z.string(),
  gasUsed: import_zod6.z.string().optional(),
  gasPrice: import_zod6.z.string().optional(),
  profitLoss: import_zod6.z.string().optional(),
  profitLossUSD: import_zod6.z.number().optional(),
  slippage: import_zod6.z.number().optional(),
  dex: DEXSchema.optional(),
  isPaperTrade: import_zod6.z.boolean().default(false),
  executedAt: import_zod6.z.date(),
  createdAt: import_zod6.z.date()
});
var QuoteSchema = import_zod6.z.object({
  tokenIn: import_zod6.z.string(),
  tokenOut: import_zod6.z.string(),
  amountIn: import_zod6.z.string(),
  amountOut: import_zod6.z.string(),
  price: import_zod6.z.number(),
  priceImpact: import_zod6.z.number(),
  gasEstimate: import_zod6.z.string(),
  route: import_zod6.z.array(import_zod6.z.object({
    dex: DEXSchema,
    percentage: import_zod6.z.number()
  })),
  validUntil: import_zod6.z.date()
});
var ArbitrageOpportunitySchema = import_zod6.z.object({
  id: import_zod6.z.string(),
  tokenPair: import_zod6.z.string(),
  dexA: DEXSchema,
  dexB: DEXSchema,
  priceA: import_zod6.z.number(),
  priceB: import_zod6.z.number(),
  profitPotential: import_zod6.z.number(),
  profitAfterGas: import_zod6.z.number(),
  gasEstimate: import_zod6.z.string(),
  discoveredAt: import_zod6.z.date(),
  expiresAt: import_zod6.z.date()
});
var TradingPairSchema = import_zod6.z.object({
  tokenA: import_zod6.z.string(),
  tokenB: import_zod6.z.string(),
  chain: ChainSchema,
  dex: DEXSchema,
  liquidity: import_zod6.z.string(),
  volume24h: import_zod6.z.string(),
  fee: import_zod6.z.number(),
  isActive: import_zod6.z.boolean().default(true)
});
var MarketDataSchema = import_zod6.z.object({
  symbol: import_zod6.z.string(),
  price: import_zod6.z.number(),
  priceChange24h: import_zod6.z.number(),
  volume24h: import_zod6.z.string(),
  marketCap: import_zod6.z.string().optional(),
  liquidity: import_zod6.z.string().optional(),
  timestamp: import_zod6.z.date()
});
var OrderBookEntrySchema = import_zod6.z.object({
  price: import_zod6.z.number(),
  amount: import_zod6.z.string(),
  total: import_zod6.z.string()
});
var OrderBookSchema = import_zod6.z.object({
  symbol: import_zod6.z.string(),
  bids: import_zod6.z.array(OrderBookEntrySchema),
  asks: import_zod6.z.array(OrderBookEntrySchema),
  timestamp: import_zod6.z.date()
});

// src/risk.ts
var import_zod7 = require("zod");
var RiskParametersSchema = import_zod7.z.object({
  maxPositionSize: import_zod7.z.string(),
  maxDailyLoss: import_zod7.z.string(),
  stopLossPercentage: import_zod7.z.number().min(0).max(100),
  takeProfitPercentage: import_zod7.z.number().min(0).max(1e3),
  maxSlippage: import_zod7.z.number().min(0).max(50),
  maxGasPrice: import_zod7.z.string(),
  volatilityThreshold: import_zod7.z.number().min(0).max(100)
});
var RiskEventTypeSchema = import_zod7.z.enum([
  "stop_loss",
  "position_limit",
  "daily_limit",
  "volatility_halt",
  "gas_spike",
  "slippage_exceeded",
  "correlation_breach"
]);
var RiskEventSeveritySchema = import_zod7.z.enum(["low", "medium", "high", "critical"]);
var RiskEventSchema = import_zod7.z.object({
  id: import_zod7.z.string().uuid(),
  botId: import_zod7.z.string(),
  eventType: RiskEventTypeSchema,
  severity: RiskEventSeveritySchema,
  description: import_zod7.z.string(),
  actionTaken: import_zod7.z.string().optional(),
  positionSizeBefore: import_zod7.z.string().optional(),
  positionSizeAfter: import_zod7.z.string().optional(),
  triggerValue: import_zod7.z.number(),
  thresholdValue: import_zod7.z.number(),
  createdAt: import_zod7.z.date()
});

// src/mev.ts
var import_zod8 = require("zod");
var MEVOpportunityTypeSchema = import_zod8.z.enum(["sandwich", "arbitrage", "liquidation", "jit_liquidity"]);
var BundleTransactionSchema = import_zod8.z.object({
  to: import_zod8.z.string(),
  data: import_zod8.z.string(),
  value: import_zod8.z.string().default("0"),
  gasLimit: import_zod8.z.string(),
  gasPrice: import_zod8.z.string().optional(),
  maxFeePerGas: import_zod8.z.string().optional(),
  maxPriorityFeePerGas: import_zod8.z.string().optional()
});
var MEVBundleSchema = import_zod8.z.object({
  id: import_zod8.z.string(),
  transactions: import_zod8.z.array(BundleTransactionSchema),
  blockNumber: import_zod8.z.number(),
  minTimestamp: import_zod8.z.number().optional(),
  maxTimestamp: import_zod8.z.number().optional(),
  revertingTxHashes: import_zod8.z.array(import_zod8.z.string()).optional()
});
var FlashbotsBundleSchema = import_zod8.z.object({
  txs: import_zod8.z.array(import_zod8.z.string()),
  blockNumber: import_zod8.z.string(),
  minTimestamp: import_zod8.z.number().optional(),
  maxTimestamp: import_zod8.z.number().optional(),
  revertingTxHashes: import_zod8.z.array(import_zod8.z.string()).optional()
});
var MEVOpportunitySchema = import_zod8.z.object({
  id: import_zod8.z.string(),
  botId: import_zod8.z.string(),
  opportunityType: MEVOpportunityTypeSchema,
  targetTransaction: import_zod8.z.string().optional(),
  bundleTransactions: import_zod8.z.array(BundleTransactionSchema),
  estimatedProfit: import_zod8.z.string(),
  gasBid: import_zod8.z.string(),
  competitionLevel: import_zod8.z.number().min(1).max(10).default(1),
  isSubmitted: import_zod8.z.boolean().default(false),
  isSuccessful: import_zod8.z.boolean().default(false),
  actualProfit: import_zod8.z.string().optional(),
  discoveredAt: import_zod8.z.date(),
  submittedAt: import_zod8.z.date().optional(),
  confirmedAt: import_zod8.z.date().optional()
});

// src/ai.ts
var import_zod9 = require("zod");
var AIStrategyTypeSchema = import_zod9.z.enum([
  "reinforcement_learning",
  "ensemble",
  "neural_network",
  "genetic_algorithm",
  "sentiment_analysis",
  "pattern_recognition"
]);
var MLModelConfigSchema = import_zod9.z.object({
  modelType: AIStrategyTypeSchema,
  parameters: import_zod9.z.record(import_zod9.z.any()),
  trainingData: import_zod9.z.object({
    features: import_zod9.z.array(import_zod9.z.string()),
    targetVariable: import_zod9.z.string(),
    timeframe: import_zod9.z.string()
  }),
  performance: import_zod9.z.object({
    accuracy: import_zod9.z.number().optional(),
    precision: import_zod9.z.number().optional(),
    recall: import_zod9.z.number().optional(),
    f1Score: import_zod9.z.number().optional(),
    sharpeRatio: import_zod9.z.number().optional()
  }).optional()
});
var FeatureSchema = import_zod9.z.object({
  name: import_zod9.z.string(),
  type: import_zod9.z.enum(["technical", "fundamental", "sentiment", "on_chain"]),
  timeframe: import_zod9.z.string(),
  value: import_zod9.z.number(),
  timestamp: import_zod9.z.date()
});
var PredictionSchema = import_zod9.z.object({
  symbol: import_zod9.z.string(),
  prediction: import_zod9.z.number(),
  confidence: import_zod9.z.number().min(0).max(1),
  timeframe: import_zod9.z.string(),
  features: import_zod9.z.array(FeatureSchema),
  modelId: import_zod9.z.string(),
  createdAt: import_zod9.z.date(),
  expiresAt: import_zod9.z.date()
});

// src/websocket.ts
var import_zod10 = require("zod");
var WSMessageTypeSchema = import_zod10.z.enum([
  "trade_executed",
  "bot_status",
  "price_update",
  "alert",
  "error",
  "connection_status",
  "heartbeat"
]);
var WSMessageSchema = import_zod10.z.object({
  type: WSMessageTypeSchema,
  data: import_zod10.z.any(),
  timestamp: import_zod10.z.date(),
  id: import_zod10.z.string().optional()
});
var ConnectionStatusSchema = import_zod10.z.enum(["connecting", "connected", "disconnected", "error", "reconnecting"]);
var WSConnectionSchema = import_zod10.z.object({
  id: import_zod10.z.string(),
  botId: import_zod10.z.string(),
  connectionType: import_zod10.z.enum(["rpc", "dex_data", "mempool", "price_feed"]),
  endpoint: import_zod10.z.string(),
  status: ConnectionStatusSchema,
  lastMessageAt: import_zod10.z.date().optional(),
  reconnectCount: import_zod10.z.number().default(0),
  errorCount: import_zod10.z.number().default(0),
  lastError: import_zod10.z.string().optional(),
  createdAt: import_zod10.z.date(),
  updatedAt: import_zod10.z.date()
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AIStrategyTypeSchema,
  APIKeySchema,
  APIResponseSchema,
  AlertSchema,
  AlertSeveritySchema,
  AlertTypeSchema,
  ArbitrageBotConfigSchema,
  ArbitrageOpportunitySchema,
  AuthResponseSchema,
  BaseBotConfigSchema,
  BlockSchema,
  BotConfigSchema,
  BotStateSchema,
  BotStatusSchema,
  BotTypeSchema,
  BundleTransactionSchema,
  ChainConfigSchema,
  ChainSchema,
  ConnectionStatusSchema,
  CopyTradingBotConfigSchema,
  DEXConfigSchema,
  DEXSchema,
  DatabaseConfigSchema,
  FeatureSchema,
  FlashbotsBundleSchema,
  GasEstimateSchema,
  HTTPMethodSchema,
  JWTPayloadSchema,
  LoginRequestSchema,
  MEVBundleSchema,
  MEVOpportunitySchema,
  MEVOpportunityTypeSchema,
  MLModelConfigSchema,
  MarketDataSchema,
  OrderBookEntrySchema,
  OrderBookSchema,
  PaginatedResponseSchema,
  PaginationSchema,
  PerformanceMetricsSchema,
  PredictionSchema,
  QuoteSchema,
  RateLimitSchema,
  RegisterRequestSchema,
  RequestHeadersSchema,
  RiskEventSchema,
  RiskEventSeveritySchema,
  RiskEventTypeSchema,
  RiskParametersSchema,
  SandwichBotConfigSchema,
  SessionSchema,
  TokenSchema,
  TradeSchema,
  TradeStatusSchema,
  TradeTypeSchema,
  TradingPairSchema,
  TransactionSchema,
  UserProfileSchema,
  UserSchema,
  WSConnectionSchema,
  WSMessageSchema,
  WSMessageTypeSchema,
  WalletSchema
});
