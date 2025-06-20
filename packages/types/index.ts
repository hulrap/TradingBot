export type Chain = "ETH" | "BSC" | "SOL";

export interface User {
  id: string;
  email: string;
  encryptedPrivateKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  encryptedPrivateKey: string;
  chain: Chain;
  name?: string;
  createdAt: string;
}

// Legacy types - moved to bot.ts with comprehensive schemas
// These are kept for backward compatibility but should use the new schemas

export interface Trade {
  id: string;
  botConfigId: string;
  botType: "ARBITRAGE" | "COPY_TRADER" | "SANDWICH";
  txHash: string;
  chain: Chain;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  gasUsed: string;
  gasPrice: string;
  profit?: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
  completedAt?: string;
}

// BotStatus moved to bot.ts with enhanced schema

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

// Login/Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// RPC Configuration
export interface RpcConfig {
  chain: Chain;
  url: string;
  websocketUrl?: string;
  apiKey?: string;
}

// Export schemas from bot.ts
export { 
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  SandwichBotConfigSchema,
  BotConfigSchema,
  BotEntitySchema,
  CreateBotRequestSchema,
  UpdateBotRequestSchema,
  BotStatusSchema,
  TradeEventSchema,
  PerformanceMetricsSchema,
  ErrorResponseSchema,
  PaginationSchema,
  WebSocketEventSchema
} from './src/bot';

export type {
  ArbitrageBotConfig,
  CopyTradingBotConfig,
  SandwichBotConfig,
  BotConfig,
  BotEntity,
  CreateBotRequest,
  UpdateBotRequest,
  BotStatus,
  TradeEvent,
  PerformanceMetrics,
  ErrorResponse,
  Pagination,
  WebSocketEvent
} from './src/bot'; 