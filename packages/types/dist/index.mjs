// src/auth.ts
import { z } from "zod";
var UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLogin: z.date().optional()
});
var UserProfileSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().default("UTC"),
  notificationPreferences: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    discord: z.boolean().default(false)
  }),
  riskTolerance: z.enum(["low", "medium", "high"]).default("medium")
});
var JWTPayloadSchema = z.object({
  sub: z.string().uuid(),
  // user ID
  email: z.string().email(),
  iat: z.number(),
  exp: z.number(),
  jti: z.string().optional()
});
var LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  twoFactorCode: z.string().optional()
});
var RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});
var AuthResponseSchema = z.object({
  success: z.boolean(),
  user: z.any().optional(),
  // Using any for Supabase User type compatibility
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.date().default(() => /* @__PURE__ */ new Date())
});
var SessionSchema = z.object({
  id: z.string(),
  userId: z.string().uuid(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

// src/blockchain.ts
import { z as z2 } from "zod";
var ChainSchema = z2.enum(["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]);
var ChainConfigSchema = z2.object({
  id: z2.number(),
  name: ChainSchema,
  displayName: z2.string(),
  rpcUrl: z2.string().url(),
  wsUrl: z2.string().url().optional(),
  blockExplorer: z2.string().url(),
  nativeCurrency: z2.object({
    name: z2.string(),
    symbol: z2.string(),
    decimals: z2.number()
  }),
  isTestnet: z2.boolean().default(false)
});
var WalletSchema = z2.object({
  id: z2.string().uuid(),
  userId: z2.string().uuid(),
  name: z2.string(),
  address: z2.string(),
  chain: ChainSchema,
  encryptedPrivateKey: z2.string(),
  walletType: z2.enum(["imported", "generated"]).default("imported"),
  isActive: z2.boolean().default(true),
  createdAt: z2.date(),
  updatedAt: z2.date()
});
var TokenSchema = z2.object({
  address: z2.string(),
  symbol: z2.string(),
  name: z2.string(),
  decimals: z2.number(),
  chain: ChainSchema,
  logoUri: z2.string().url().optional(),
  coingeckoId: z2.string().optional(),
  isVerified: z2.boolean().default(false)
});
var TransactionSchema = z2.object({
  hash: z2.string(),
  from: z2.string(),
  to: z2.string(),
  value: z2.string(),
  gasLimit: z2.string(),
  gasPrice: z2.string().optional(),
  maxFeePerGas: z2.string().optional(),
  maxPriorityFeePerGas: z2.string().optional(),
  nonce: z2.number(),
  data: z2.string().optional(),
  blockNumber: z2.number().optional(),
  blockHash: z2.string().optional(),
  transactionIndex: z2.number().optional(),
  confirmations: z2.number().optional(),
  status: z2.enum(["pending", "confirmed", "failed"]).optional()
});
var GasEstimateSchema = z2.object({
  gasLimit: z2.string(),
  gasPrice: z2.string().optional(),
  maxFeePerGas: z2.string().optional(),
  maxPriorityFeePerGas: z2.string().optional(),
  estimatedCost: z2.string(),
  estimatedCostUSD: z2.number().optional()
});
var BlockSchema = z2.object({
  number: z2.number(),
  hash: z2.string(),
  parentHash: z2.string(),
  timestamp: z2.number(),
  gasLimit: z2.string(),
  gasUsed: z2.string(),
  baseFeePerGas: z2.string().optional(),
  transactions: z2.array(z2.string()),
  miner: z2.string().optional(),
  difficulty: z2.string().optional()
});
var DEXSchema = z2.enum([
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
var DEXConfigSchema = z2.object({
  name: DEXSchema,
  chain: ChainSchema,
  factoryAddress: z2.string().optional(),
  routerAddress: z2.string().optional(),
  quoterAddress: z2.string().optional(),
  fee: z2.number(),
  // in basis points
  isActive: z2.boolean().default(true)
});

// src/bot.ts
import { z as z3 } from "zod";
var BotTypeSchema = z3.enum(["arbitrage", "copy_trader", "sandwich", "liquidation", "jit_liquidity", "market_maker"]);
var BotStatusSchema = z3.enum(["idle", "running", "paused", "error", "stopped"]);
var BaseBotConfigSchema = z3.object({
  id: z3.string().uuid(),
  userId: z3.string().uuid(),
  walletId: z3.string().uuid(),
  botType: BotTypeSchema,
  name: z3.string(),
  isActive: z3.boolean().default(false),
  isPaperTrading: z3.boolean().default(true),
  maxDailyTrades: z3.number().default(100),
  maxPositionSize: z3.string().optional(),
  stopLossPercentage: z3.number().optional(),
  takeProfitPercentage: z3.number().optional(),
  createdAt: z3.date(),
  updatedAt: z3.date()
});
var ArbitrageBotConfigSchema = BaseBotConfigSchema.extend({
  botType: z3.literal("arbitrage"),
  configuration: z3.object({
    tokenPairs: z3.array(z3.object({
      tokenA: z3.string(),
      tokenB: z3.string(),
      chains: z3.array(ChainSchema)
    })),
    minProfitThreshold: z3.number().min(0).max(100),
    // percentage
    maxSlippage: z3.number().min(0).max(10),
    // percentage
    dexes: z3.array(z3.string()),
    gasMultiplier: z3.number().min(1).max(3).default(1.2),
    enableMEVProtection: z3.boolean().default(true)
  })
});
var CopyTradingBotConfigSchema = BaseBotConfigSchema.extend({
  botType: z3.literal("copy_trader"),
  configuration: z3.object({
    targetAddresses: z3.array(z3.object({
      address: z3.string(),
      chain: ChainSchema,
      copyPercentage: z3.number().min(1).max(100).default(100),
      maxCopyAmount: z3.string().optional()
    })),
    copySettings: z3.object({
      copyType: z3.enum(["fixed_amount", "percentage"]).default("percentage"),
      fixedAmount: z3.string().optional(),
      percentage: z3.number().min(1).max(100).default(10)
    }),
    filters: z3.object({
      minTradeSize: z3.string().optional(),
      maxTradeSize: z3.string().optional(),
      excludeTokens: z3.array(z3.string()).default([]),
      onlyVerifiedTokens: z3.boolean().default(true)
    }),
    latencyOptimization: z3.boolean().default(true)
  })
});
var SandwichBotConfigSchema = BaseBotConfigSchema.extend({
  botType: z3.literal("sandwich"),
  configuration: z3.object({
    targetDEXes: z3.array(z3.string()),
    minVictimTradeSize: z3.string(),
    maxGasBid: z3.string(),
    profitThreshold: z3.number().min(0).max(100),
    mevRelays: z3.array(z3.string()),
    competitionAnalysis: z3.boolean().default(true),
    bundleSettings: z3.object({
      maxBundleSize: z3.number().default(3),
      gasMultiplier: z3.number().min(1).max(5).default(2)
    })
  })
});
var BotConfigSchema = z3.discriminatedUnion("botType", [
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  SandwichBotConfigSchema
]);
var BotStateSchema = z3.object({
  botId: z3.string(),
  status: BotStatusSchema,
  lastActivity: z3.date(),
  errorCount: z3.number().default(0),
  lastError: z3.string().optional(),
  performanceMetrics: z3.object({
    totalTrades: z3.number().default(0),
    successfulTrades: z3.number().default(0),
    totalProfit: z3.string().default("0"),
    totalLoss: z3.string().default("0"),
    winRate: z3.number().default(0),
    avgExecutionTime: z3.number().default(0)
  }),
  createdAt: z3.date(),
  updatedAt: z3.date()
});

// src/database.ts
import { z as z4 } from "zod";
var PerformanceMetricsSchema = z4.object({
  id: z4.string().uuid(),
  userId: z4.string().uuid(),
  botConfigId: z4.string().uuid(),
  date: z4.date(),
  totalTrades: z4.number().default(0),
  successfulTrades: z4.number().default(0),
  totalVolume: z4.string().default("0"),
  totalProfitLoss: z4.string().default("0"),
  totalProfitLossUSD: z4.number().default(0),
  maxDrawdown: z4.number().default(0),
  sharpeRatio: z4.number().optional(),
  winRate: z4.number().default(0),
  averageTradeSize: z4.string().default("0"),
  createdAt: z4.date()
});
var AlertTypeSchema = z4.enum(["trade_executed", "profit_target", "stop_loss", "error", "system"]);
var AlertSeveritySchema = z4.enum(["info", "warning", "error", "critical"]);
var AlertSchema = z4.object({
  id: z4.string().uuid(),
  userId: z4.string().uuid(),
  botConfigId: z4.string().uuid().optional(),
  alertType: AlertTypeSchema,
  title: z4.string(),
  message: z4.string(),
  severity: AlertSeveritySchema.default("info"),
  isRead: z4.boolean().default(false),
  metadata: z4.record(z4.any()).optional(),
  createdAt: z4.date()
});
var APIKeySchema = z4.object({
  id: z4.string().uuid(),
  userId: z4.string().uuid(),
  serviceName: z4.string(),
  encryptedApiKey: z4.string(),
  encryptedSecretKey: z4.string().optional(),
  isActive: z4.boolean().default(true),
  createdAt: z4.date(),
  updatedAt: z4.date()
});
var DatabaseConfigSchema = z4.object({
  host: z4.string(),
  port: z4.number(),
  database: z4.string(),
  username: z4.string(),
  password: z4.string(),
  ssl: z4.boolean().default(true),
  maxConnections: z4.number().default(10)
});

// src/api.ts
import { z as z5 } from "zod";
var APIResponseSchema = z5.object({
  success: z5.boolean(),
  data: z5.any().optional(),
  error: z5.string().optional(),
  message: z5.string().optional(),
  timestamp: z5.date().default(() => /* @__PURE__ */ new Date())
});
var PaginationSchema = z5.object({
  page: z5.number().min(1).default(1),
  limit: z5.number().min(1).max(100).default(20),
  total: z5.number().optional(),
  totalPages: z5.number().optional()
});
var PaginatedResponseSchema = (dataSchema) => z5.object({
  success: z5.boolean(),
  data: z5.array(dataSchema),
  pagination: PaginationSchema,
  error: z5.string().optional()
});
var HTTPMethodSchema = z5.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]);
var RequestHeadersSchema = z5.object({
  "Authorization": z5.string().optional(),
  "Content-Type": z5.string().optional(),
  "X-API-Key": z5.string().optional(),
  "User-Agent": z5.string().optional()
});
var RateLimitSchema = z5.object({
  limit: z5.number(),
  remaining: z5.number(),
  reset: z5.number(),
  retryAfter: z5.number().optional()
});

// src/trading.ts
import { z as z6 } from "zod";
var TradeTypeSchema = z6.enum(["buy", "sell", "swap", "arbitrage", "sandwich", "liquidation"]);
var TradeStatusSchema = z6.enum(["pending", "confirmed", "failed", "cancelled"]);
var TradeSchema = z6.object({
  id: z6.string().uuid(),
  userId: z6.string().uuid(),
  botConfigId: z6.string().uuid().optional(),
  walletId: z6.string().uuid(),
  transactionHash: z6.string().optional(),
  chain: ChainSchema,
  tradeType: TradeTypeSchema,
  tokenIn: z6.string(),
  tokenOut: z6.string(),
  amountIn: z6.string(),
  amountOut: z6.string(),
  gasUsed: z6.string().optional(),
  gasPrice: z6.string().optional(),
  profitLoss: z6.string().optional(),
  profitLossUSD: z6.number().optional(),
  slippage: z6.number().optional(),
  dex: DEXSchema.optional(),
  isPaperTrade: z6.boolean().default(false),
  executedAt: z6.date(),
  createdAt: z6.date()
});
var QuoteSchema = z6.object({
  tokenIn: z6.string(),
  tokenOut: z6.string(),
  amountIn: z6.string(),
  amountOut: z6.string(),
  price: z6.number(),
  priceImpact: z6.number(),
  gasEstimate: z6.string(),
  route: z6.array(z6.object({
    dex: DEXSchema,
    percentage: z6.number()
  })),
  validUntil: z6.date()
});
var ArbitrageOpportunitySchema = z6.object({
  id: z6.string(),
  tokenPair: z6.string(),
  dexA: DEXSchema,
  dexB: DEXSchema,
  priceA: z6.number(),
  priceB: z6.number(),
  profitPotential: z6.number(),
  profitAfterGas: z6.number(),
  gasEstimate: z6.string(),
  discoveredAt: z6.date(),
  expiresAt: z6.date()
});
var TradingPairSchema = z6.object({
  tokenA: z6.string(),
  tokenB: z6.string(),
  chain: ChainSchema,
  dex: DEXSchema,
  liquidity: z6.string(),
  volume24h: z6.string(),
  fee: z6.number(),
  isActive: z6.boolean().default(true)
});
var MarketDataSchema = z6.object({
  symbol: z6.string(),
  price: z6.number(),
  priceChange24h: z6.number(),
  volume24h: z6.string(),
  marketCap: z6.string().optional(),
  liquidity: z6.string().optional(),
  timestamp: z6.date()
});
var OrderBookEntrySchema = z6.object({
  price: z6.number(),
  amount: z6.string(),
  total: z6.string()
});
var OrderBookSchema = z6.object({
  symbol: z6.string(),
  bids: z6.array(OrderBookEntrySchema),
  asks: z6.array(OrderBookEntrySchema),
  timestamp: z6.date()
});

// src/risk.ts
import { z as z7 } from "zod";
var RiskParametersSchema = z7.object({
  maxPositionSize: z7.string(),
  maxDailyLoss: z7.string(),
  stopLossPercentage: z7.number().min(0).max(100),
  takeProfitPercentage: z7.number().min(0).max(1e3),
  maxSlippage: z7.number().min(0).max(50),
  maxGasPrice: z7.string(),
  volatilityThreshold: z7.number().min(0).max(100)
});
var RiskEventTypeSchema = z7.enum([
  "stop_loss",
  "position_limit",
  "daily_limit",
  "volatility_halt",
  "gas_spike",
  "slippage_exceeded",
  "correlation_breach"
]);
var RiskEventSeveritySchema = z7.enum(["low", "medium", "high", "critical"]);
var RiskEventSchema = z7.object({
  id: z7.string().uuid(),
  botId: z7.string(),
  eventType: RiskEventTypeSchema,
  severity: RiskEventSeveritySchema,
  description: z7.string(),
  actionTaken: z7.string().optional(),
  positionSizeBefore: z7.string().optional(),
  positionSizeAfter: z7.string().optional(),
  triggerValue: z7.number(),
  thresholdValue: z7.number(),
  createdAt: z7.date()
});

// src/mev.ts
import { z as z8 } from "zod";
var MEVOpportunityTypeSchema = z8.enum(["sandwich", "arbitrage", "liquidation", "jit_liquidity"]);
var BundleTransactionSchema = z8.object({
  to: z8.string(),
  data: z8.string(),
  value: z8.string().default("0"),
  gasLimit: z8.string(),
  gasPrice: z8.string().optional(),
  maxFeePerGas: z8.string().optional(),
  maxPriorityFeePerGas: z8.string().optional()
});
var MEVBundleSchema = z8.object({
  id: z8.string(),
  transactions: z8.array(BundleTransactionSchema),
  blockNumber: z8.number(),
  minTimestamp: z8.number().optional(),
  maxTimestamp: z8.number().optional(),
  revertingTxHashes: z8.array(z8.string()).optional()
});
var FlashbotsBundleSchema = z8.object({
  txs: z8.array(z8.string()),
  blockNumber: z8.string(),
  minTimestamp: z8.number().optional(),
  maxTimestamp: z8.number().optional(),
  revertingTxHashes: z8.array(z8.string()).optional()
});
var MEVOpportunitySchema = z8.object({
  id: z8.string(),
  botId: z8.string(),
  opportunityType: MEVOpportunityTypeSchema,
  targetTransaction: z8.string().optional(),
  bundleTransactions: z8.array(BundleTransactionSchema),
  estimatedProfit: z8.string(),
  gasBid: z8.string(),
  competitionLevel: z8.number().min(1).max(10).default(1),
  isSubmitted: z8.boolean().default(false),
  isSuccessful: z8.boolean().default(false),
  actualProfit: z8.string().optional(),
  discoveredAt: z8.date(),
  submittedAt: z8.date().optional(),
  confirmedAt: z8.date().optional()
});

// src/ai.ts
import { z as z9 } from "zod";
var AIStrategyTypeSchema = z9.enum([
  "reinforcement_learning",
  "ensemble",
  "neural_network",
  "genetic_algorithm",
  "sentiment_analysis",
  "pattern_recognition"
]);
var MLModelConfigSchema = z9.object({
  modelType: AIStrategyTypeSchema,
  parameters: z9.record(z9.any()),
  trainingData: z9.object({
    features: z9.array(z9.string()),
    targetVariable: z9.string(),
    timeframe: z9.string()
  }),
  performance: z9.object({
    accuracy: z9.number().optional(),
    precision: z9.number().optional(),
    recall: z9.number().optional(),
    f1Score: z9.number().optional(),
    sharpeRatio: z9.number().optional()
  }).optional()
});
var FeatureSchema = z9.object({
  name: z9.string(),
  type: z9.enum(["technical", "fundamental", "sentiment", "on_chain"]),
  timeframe: z9.string(),
  value: z9.number(),
  timestamp: z9.date()
});
var PredictionSchema = z9.object({
  symbol: z9.string(),
  prediction: z9.number(),
  confidence: z9.number().min(0).max(1),
  timeframe: z9.string(),
  features: z9.array(FeatureSchema),
  modelId: z9.string(),
  createdAt: z9.date(),
  expiresAt: z9.date()
});

// src/websocket.ts
import { z as z10 } from "zod";
var WSMessageTypeSchema = z10.enum([
  "trade_executed",
  "bot_status",
  "price_update",
  "alert",
  "error",
  "connection_status",
  "heartbeat"
]);
var WSMessageSchema = z10.object({
  type: WSMessageTypeSchema,
  data: z10.any(),
  timestamp: z10.date(),
  id: z10.string().optional()
});
var ConnectionStatusSchema = z10.enum(["connecting", "connected", "disconnected", "error", "reconnecting"]);
var WSConnectionSchema = z10.object({
  id: z10.string(),
  botId: z10.string(),
  connectionType: z10.enum(["rpc", "dex_data", "mempool", "price_feed"]),
  endpoint: z10.string(),
  status: ConnectionStatusSchema,
  lastMessageAt: z10.date().optional(),
  reconnectCount: z10.number().default(0),
  errorCount: z10.number().default(0),
  lastError: z10.string().optional(),
  createdAt: z10.date(),
  updatedAt: z10.date()
});
export {
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
};
