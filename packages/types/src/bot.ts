import { z } from 'zod';

// =============================================================================
// SHARED BASE TYPES AND ENUMS
// =============================================================================

// Supported blockchain networks
export const ChainSchema = z.enum(['ETH', 'BSC', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'SOL']);
export type Chain = z.infer<typeof ChainSchema>;

// Bot execution status
export const BotStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ERROR', 'INITIALIZING']);
export type BotStatus = z.infer<typeof BotStatusSchema>;

// Trade execution status
export const TradeStatusSchema = z.enum(['PENDING', 'EXECUTED', 'FAILED', 'CANCELLED', 'EXPIRED']);
export type TradeStatus = z.infer<typeof TradeStatusSchema>;

// Bot types
export const BotTypeSchema = z.enum(['ARBITRAGE', 'COPY_TRADING', 'MEV_SANDWICH', 'PAPER_TRADING']);
export type BotType = z.infer<typeof BotTypeSchema>;

// Risk management alert levels
export const AlertLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type AlertLevel = z.infer<typeof AlertLevelSchema>;

// =============================================================================
// BASE BOT INTERFACE
// =============================================================================

// Common configuration shared across all bot types
export const BaseBotConfigSchema = z.object({
  id: z.string().min(1, 'Bot ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  walletId: z.string().min(1, 'Wallet ID is required'),
  name: z.string().min(1, 'Bot name is required').max(100, 'Bot name too long'),
  type: BotTypeSchema,
  status: BotStatusSchema.default('STOPPED'),
  enabled: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastExecutedAt: z.string().datetime().optional(),
  
  // Security and access control
  isPublic: z.boolean().default(false),
  maxConcurrentTrades: z.number().min(1).max(50).default(3),
  
  // Basic risk management
  emergencyStopEnabled: z.boolean().default(true),
  maxDailyLoss: z.string().min(1, 'Max daily loss is required'),
  maxDrawdownPercentage: z.number().min(0).max(100).default(10),
});

export type BaseBotConfig = z.infer<typeof BaseBotConfigSchema>;

// =============================================================================
// ARBITRAGE BOT TYPES
// =============================================================================

// Token pair configuration for arbitrage
export const TokenPairSchema = z.object({
  tokenA: z.string().min(1, 'Token A address is required'),
  tokenASymbol: z.string().min(1, 'Token A symbol is required'),
  tokenADecimals: z.number().min(1).max(18).default(18),
  tokenB: z.string().min(1, 'Token B address is required'),
  tokenBSymbol: z.string().min(1, 'Token B symbol is required'),
  tokenBDecimals: z.number().min(1).max(18).default(18),
  minLiquidity: z.string().min(1, 'Minimum liquidity is required'),
  maxSpread: z.number().min(0).max(100).default(5), // Maximum spread to consider profitable
  enabled: z.boolean().default(true),
  priority: z.number().min(1).max(10).default(5), // Priority for this pair
});

export type TokenPair = z.infer<typeof TokenPairSchema>;

// Gas configuration
export const GasConfigSchema = z.object({
  maxGasPrice: z.string().min(1, 'Max gas price is required'),
  priorityFee: z.string().min(0, 'Priority fee must be positive'),
  gasLimit: z.string().min(1, 'Gas limit is required'),
  gasMultiplier: z.number().min(1).max(3).default(1.2), // Gas price multiplier for speed
  mevProtection: z.boolean().default(false),
  flashbotsEnabled: z.boolean().default(false),
});

export type GasConfig = z.infer<typeof GasConfigSchema>;

// Risk management parameters
export const RiskParametersSchema = z.object({
  maxPositionSize: z.string().min(1, 'Max position size is required'),
  maxDailyLoss: z.string().min(1, 'Max daily loss is required'),
  stopLossPercentage: z.number().min(0).max(100).default(5),
  takeProfitPercentage: z.number().min(0).max(100).default(10),
  maxConcurrentTrades: z.number().min(1).max(10).default(3),
  cooldownPeriod: z.number().min(0, 'Cooldown period must be positive').default(30000), // ms
  positionSizePercentage: z.number().min(0.1).max(100).default(25), // % of available balance
  riskToleranceLevel: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']).default('MODERATE'),
});

export type RiskParameters = z.infer<typeof RiskParametersSchema>;

// Complete Arbitrage Bot Configuration
export const ArbitrageBotConfigSchema = BaseBotConfigSchema.extend({
  type: z.literal('ARBITRAGE'),
  chains: z.array(ChainSchema).min(1, 'At least one chain is required'),
  tokenPairs: z.array(TokenPairSchema).min(1, 'At least one token pair is required'),
  minProfitPercentage: z.number().min(0.01).max(100).default(0.1),
  maxSlippage: z.number().min(0.01).max(10).default(1),
  gasSettings: GasConfigSchema,
  riskParams: RiskParametersSchema,
  
  // Advanced arbitrage settings
  dexes: z.array(z.string()).min(1, 'At least one DEX is required'),
  flashLoanEnabled: z.boolean().default(false),
  crossChainEnabled: z.boolean().default(false),
  sandwichProtection: z.boolean().default(true),
  
  // Monitoring and alerts
  profitNotificationThreshold: z.number().min(0).default(1), // Notify on profits above this %
  errorNotificationEnabled: z.boolean().default(true),
});

export type ArbitrageBotConfig = z.infer<typeof ArbitrageBotConfigSchema>;

// =============================================================================
// COPY TRADING BOT TYPES
// =============================================================================

// Trade size configuration
export const TradeSizeConfigSchema = z.object({
  type: z.enum(['FIXED', 'PERCENTAGE', 'PROPORTIONAL']),
  value: z.number().positive('Trade size value must be positive'),
  minAmount: z.number().positive('Minimum amount must be positive').optional(),
  maxAmount: z.number().positive('Maximum amount must be positive').optional(),
});

export type TradeSizeConfig = z.infer<typeof TradeSizeConfigSchema>;

// Copy trading filters
export const CopyFiltersSchema = z.object({
  minTradeValue: z.string().min(1, 'Minimum trade value is required'),
  maxTradeValue: z.string().min(1, 'Maximum trade value is required'),
  allowedTokens: z.array(z.string()).default([]), // Empty array means all tokens allowed
  blockedTokens: z.array(z.string()).default([]),
  allowedDexes: z.array(z.string()).default([]),
  blockedDexes: z.array(z.string()).default([]),
  maxSlippage: z.number().min(0).max(50).default(3),
  copyDelay: z.number().min(0).max(60000).default(1000), // ms delay before copying
  onlyProfitableTrades: z.boolean().default(false),
  minimumSuccessRate: z.number().min(0).max(100).default(50), // % success rate required
});

export type CopyFilters = z.infer<typeof CopyFiltersSchema>;

// Copy Trading Bot Configuration
export const CopyTradingBotConfigSchema = BaseBotConfigSchema.extend({
  type: z.literal('COPY_TRADING'),
  chain: ChainSchema,
  targetWalletAddress: z.string().min(1, 'Target wallet address is required'),
  tradeSize: TradeSizeConfigSchema,
  filters: CopyFiltersSchema,
  gasSettings: GasConfigSchema,
  riskParams: RiskParametersSchema,
  
  // Copy trading specific settings
  followStopLoss: z.boolean().default(true),
  followTakeProfit: z.boolean().default(true),
  mirrorExactly: z.boolean().default(false), // Mirror exact amounts vs scaled amounts
  autoStopOnLoss: z.boolean().default(true),
  socialTradingEnabled: z.boolean().default(false),
  
  // Performance tracking
  trackPerformance: z.boolean().default(true),
  benchmarkWallet: z.string().optional(), // Compare performance against this wallet
});

export type CopyTradingBotConfig = z.infer<typeof CopyTradingBotConfigSchema>;

// =============================================================================
// MEV SANDWICH BOT TYPES
// =============================================================================

// MEV opportunity detection settings
export const MEVDetectionSchema = z.object({
  minTransactionValue: z.string().min(1, 'Minimum transaction value is required'),
  maxTransactionValue: z.string().min(1, 'Maximum transaction value is required'),
  targetDexes: z.array(z.string()).min(1, 'At least one target DEX is required'),
  profitThreshold: z.number().min(0.01).max(100).default(0.5), // Minimum profit %
  gasCompetitionMultiplier: z.number().min(1).max(5).default(1.5),
  mempoolScanDepth: z.number().min(1).max(50).default(10), // Number of pending txs to scan
  
  // Sandwich attack parameters
  frontrunGasBoost: z.number().min(1).max(10).default(2),
  backrunGasBoost: z.number().min(1).max(10).default(1.5),
  maxSandwichSize: z.string().min(1, 'Maximum sandwich size is required'),
  slippageProtection: z.number().min(0).max(100).default(2),
});

export type MEVDetection = z.infer<typeof MEVDetectionSchema>;

// MEV Sandwich Bot Configuration
export const MEVSandwichBotConfigSchema = BaseBotConfigSchema.extend({
  type: z.literal('MEV_SANDWICH'),
  chain: ChainSchema,
  detection: MEVDetectionSchema,
  gasSettings: GasConfigSchema.extend({
    mevProtection: z.literal(true), // Always true for MEV bots
    flashbotsEnabled: z.literal(true), // Always true for MEV bots
  }),
  riskParams: RiskParametersSchema,
  
  // MEV specific settings
  bundleSubmission: z.boolean().default(true),
  privateMempool: z.boolean().default(true),
  competitiveMode: z.boolean().default(false), // Compete aggressively with other MEV bots
  ethicalMode: z.boolean().default(true), // Avoid sandwich attacks on small traders
  
  // Profit sharing
  profitSharePercentage: z.number().min(0).max(50).default(0), // % shared with original trader
  minProfitBeforeShare: z.string().default('0'), // Minimum profit before sharing kicks in
});

export type MEVSandwichBotConfig = z.infer<typeof MEVSandwichBotConfigSchema>;

// =============================================================================
// PAPER TRADING BOT TYPES
// =============================================================================

// Paper Trading Bot Configuration
export const PaperTradingBotConfigSchema = BaseBotConfigSchema.extend({
  type: z.literal('PAPER_TRADING'),
  baseStrategy: BotTypeSchema, // The strategy this paper trading bot simulates
  virtualBalance: z.string().min(1, 'Virtual balance is required'),
  feeSimulation: z.boolean().default(true),
  latencySimulation: z.boolean().default(true),
  slippageSimulation: z.boolean().default(true),
  
  // Simulation parameters
  averageLatency: z.number().min(0).max(10000).default(500), // ms
  averageSlippage: z.number().min(0).max(10).default(0.1), // %
  tradingFeePercentage: z.number().min(0).max(5).default(0.3), // %
  
  // Performance tracking
  benchmarkStrategy: z.string().optional(),
  performanceReportingEnabled: z.boolean().default(true),
});

export type PaperTradingBotConfig = z.infer<typeof PaperTradingBotConfigSchema>;

// =============================================================================
// TRADE EXECUTION TYPES
// =============================================================================

// Trade execution details
export const TradeExecutionSchema = z.object({
  id: z.string().min(1, 'Trade ID is required'),
  botId: z.string().min(1, 'Bot ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  type: BotTypeSchema,
  status: TradeStatusSchema,
  
  // Transaction details
  txHash: z.string().optional(),
  blockNumber: z.number().optional(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
  
  // Trade details
  tokenIn: z.string().min(1, 'Input token is required'),
  tokenOut: z.string().min(1, 'Output token is required'),
  amountIn: z.string().min(1, 'Input amount is required'),
  amountOut: z.string().optional(),
  expectedAmountOut: z.string().optional(),
  
  // Financial metrics
  profit: z.string().optional(),
  profitPercentage: z.number().optional(),
  fees: z.string().optional(),
  slippage: z.number().optional(),
  
  // Timing
  executedAt: z.string().datetime().optional(),
  confirmedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  
  // Metadata
  dex: z.string().optional(),
  strategy: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type TradeExecution = z.infer<typeof TradeExecutionSchema>;

// =============================================================================
// RISK MANAGEMENT TYPES
// =============================================================================

// Risk alert
export const RiskAlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
  botId: z.string().min(1, 'Bot ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  level: AlertLevelSchema,
  type: z.enum(['LOSS_LIMIT', 'POSITION_SIZE', 'GAS_PRICE', 'SLIPPAGE', 'ERROR_RATE', 'PERFORMANCE']),
  message: z.string().min(1, 'Alert message is required'),
  threshold: z.string().optional(),
  currentValue: z.string().optional(),
  resolved: z.boolean().default(false),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});

export type RiskAlert = z.infer<typeof RiskAlertSchema>;

// Risk metrics
export const RiskMetricsSchema = z.object({
  botId: z.string().min(1, 'Bot ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  
  // Performance metrics
  totalTrades: z.number().min(0).default(0),
  successfulTrades: z.number().min(0).default(0),
  failedTrades: z.number().min(0).default(0),
  successRate: z.number().min(0).max(100).default(0),
  
  // Financial metrics
  totalProfit: z.string().default('0'),
  totalLoss: z.string().default('0'),
  netProfit: z.string().default('0'),
  maxDrawdown: z.string().default('0'),
  currentDrawdown: z.string().default('0'),
  
  // Risk metrics
  sharpeRatio: z.number().optional(),
  volatility: z.number().optional(),
  maxPositionSize: z.string().default('0'),
  averageTradeSize: z.string().default('0'),
  
  // Time-based metrics
  updatedAt: z.string().datetime(),
  resetAt: z.string().datetime().optional(), // When metrics were last reset
});

export type RiskMetrics = z.infer<typeof RiskMetricsSchema>;

// =============================================================================
// API TYPES
// =============================================================================

// API Response wrapper
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().optional(),
});

export type ApiResponse<T = any> = Omit<z.infer<typeof ApiResponseSchema>, 'data'> & { data?: T };

// Pagination
export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Paginated response
export const PaginatedResponseSchema = z.object({
  items: z.array(z.any()),
  total: z.number().min(0),
  page: z.number().min(1),
  limit: z.number().min(1),
  totalPages: z.number().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export type PaginatedResponse<T = any> = Omit<z.infer<typeof PaginatedResponseSchema>, 'items'> & { items: T[] };

// =============================================================================
// WEBSOCKET EVENT TYPES
// =============================================================================

// WebSocket event base
export const WebSocketEventSchema = z.object({
  type: z.string().min(1, 'Event type is required'),
  timestamp: z.string().datetime(),
  userId: z.string().optional(),
  botId: z.string().optional(),
  data: z.any(),
});

export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;

// Bot status update event
export const BotStatusUpdateEventSchema = WebSocketEventSchema.extend({
  type: z.literal('BOT_STATUS_UPDATE'),
  data: z.object({
    botId: z.string(),
    status: BotStatusSchema,
    message: z.string().optional(),
  }),
});

export type BotStatusUpdateEvent = z.infer<typeof BotStatusUpdateEventSchema>;

// Trade execution event
export const TradeExecutionEventSchema = WebSocketEventSchema.extend({
  type: z.literal('TRADE_EXECUTION'),
  data: TradeExecutionSchema,
});

export type TradeExecutionEvent = z.infer<typeof TradeExecutionEventSchema>;

// Risk alert event
export const RiskAlertEventSchema = WebSocketEventSchema.extend({
  type: z.literal('RISK_ALERT'),
  data: RiskAlertSchema,
});

export type RiskAlertEvent = z.infer<typeof RiskAlertEventSchema>;

// =============================================================================
// DATABASE ENTITY TYPES
// =============================================================================

// User entity
export const UserSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  email: z.string().email('Valid email is required'),
  encryptedPrivateKey: z.string().min(1, 'Encrypted private key is required'), // Password hash or encrypted private key
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().optional(),
  
  // Security
  failedLoginAttempts: z.number().min(0).default(0),
  lockedUntil: z.string().datetime().optional(),
  twoFactorEnabled: z.boolean().default(false),
});

export type User = z.infer<typeof UserSchema>;

// Wallet entity
export const WalletSchema = z.object({
  id: z.string().min(1, 'Wallet ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  address: z.string().min(1, 'Wallet address is required'),
  encryptedPrivateKey: z.string().min(1, 'Encrypted private key is required'),
  chain: ChainSchema,
  name: z.string().optional(),
  isActive: z.boolean().default(true),
  balance: z.string().default('0'), // Cached balance
  lastBalanceUpdate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  
  // Security
  encryptionVersion: z.number().default(1), // For key migration
  derivationPath: z.string().optional(), // For HD wallets
});

export type Wallet = z.infer<typeof WalletSchema>;

// Generic bot configuration entity (union of all bot types)
export const BotConfigSchema = z.discriminatedUnion('type', [
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  MEVSandwichBotConfigSchema,
  PaperTradingBotConfigSchema,
]);

export type BotConfig = z.infer<typeof BotConfigSchema>;

// =============================================================================
// EXPORT ALL SCHEMAS FOR RUNTIME VALIDATION
// =============================================================================

export {
  // Base schemas
  ChainSchema,
  BotStatusSchema,
  TradeStatusSchema,
  BotTypeSchema,
  AlertLevelSchema,
  
  // Bot configuration schemas
  BaseBotConfigSchema,
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  MEVSandwichBotConfigSchema,
  PaperTradingBotConfigSchema,
  BotConfigSchema,
  
  // Component schemas
  TokenPairSchema,
  GasConfigSchema,
  RiskParametersSchema,
  TradeSizeConfigSchema,
  CopyFiltersSchema,
  MEVDetectionSchema,
  
  // Execution schemas
  TradeExecutionSchema,
  RiskAlertSchema,
  RiskMetricsSchema,
  
  // API schemas
  ApiResponseSchema,
  PaginationSchema,
  PaginatedResponseSchema,
  
  // WebSocket schemas
  WebSocketEventSchema,
  BotStatusUpdateEventSchema,
  TradeExecutionEventSchema,
  RiskAlertEventSchema,
  
  // Database schemas
  UserSchema,
  WalletSchema,
};

// Legacy compatibility export (maintain backward compatibility)
export { ArbitrageBotConfigSchema as ArbitrageBotConfig };