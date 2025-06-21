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

// ========================================
// BLOCKCHAIN AND NETWORK TYPES
// ========================================

/**
 * Supported blockchain networks for trading operations
 * 
 * @example
 * ```typescript
 * const chain: Chain = "ETH";
 * const supportedChains: Chain[] = ["ETH", "BSC", "SOL"];
 * ```
 */
export type Chain = "ETH" | "BSC" | "SOL" | "POLYGON" | "ARBITRUM" | "OPTIMISM";

/**
 * Extended chain information with network details
 */
export interface ChainInfo {
  /** Chain identifier */
  id: Chain;
  /** Human-readable chain name */
  name: string;
  /** Native token symbol */
  nativeToken: string;
  /** Chain ID for RPC connections */
  chainId: number;
  /** Block confirmation requirements */
  confirmations: number;
  /** Average block time in milliseconds */
  blockTime: number;
  /** Whether chain supports smart contracts */
  supportsContracts: boolean;
}

// ========================================
// SECURE USER MANAGEMENT TYPES
// ========================================

/**
 * Core user information without sensitive data
 * 
 * @security Sensitive data (private keys) moved to separate SecureUserData type
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email: string;
  /** User display name */
  name?: string;
  /** User role for permission management */
  role: UserRole;
  /** Account status */
  status: UserStatus;
  /** User preferences and settings */
  preferences: UserPreferences;
  /** Account creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Last login timestamp */
  lastLoginAt?: string;
  /** Whether user has enabled 2FA */
  twoFactorEnabled: boolean;
}

/**
 * Secure user data with encrypted sensitive information
 * 
 * @security Separated from main User type for security isolation
 */
export interface SecureUserData {
  /** User ID reference */
  userId: string;
  /** Encrypted master key for wallet management */
  encryptedMasterKey: string;
  /** Key derivation parameters */
  keyDerivationParams: KeyDerivationParams;
  /** Backup phrase encrypted with user password */
  encryptedBackupPhrase?: string;
  /** Security settings */
  securitySettings: SecuritySettings;
}

/**
 * User role definitions for access control
 */
export type UserRole = "admin" | "trader" | "viewer" | "developer" | "auditor";

/**
 * User account status types
 */
export type UserStatus = "active" | "inactive" | "suspended" | "pending" | "locked";

/**
 * User preferences and customization settings
 */
export interface UserPreferences {
  /** Preferred language/locale */
  locale: string;
  /** Timezone preference */
  timezone: string;
  /** UI theme preference */
  theme: "light" | "dark" | "auto";
  /** Notification preferences */
  notifications: NotificationPreferences;
  /** Trading preferences */
  trading: TradingPreferences;
}

/**
 * Notification preferences for different event types
 */
export interface NotificationPreferences {
  /** Email notifications enabled */
  email: boolean;
  /** Push notifications enabled */
  push: boolean;
  /** SMS notifications enabled */
  sms: boolean;
  /** Notification types to receive */
  types: {
    trades: boolean;
    profits: boolean;
    losses: boolean;
    errors: boolean;
    system: boolean;
  };
}

/**
 * User trading preferences and default settings
 */
export interface TradingPreferences {
  /** Default slippage tolerance */
  defaultSlippage: number;
  /** Default gas price strategy */
  gasStrategy: "slow" | "standard" | "fast" | "custom";
  /** Risk tolerance level */
  riskTolerance: "low" | "medium" | "high";
  /** Preferred display currency */
  displayCurrency: "USD" | "EUR" | "BTC" | "ETH";
}

// ========================================
// SECURE WALLET MANAGEMENT TYPES
// ========================================

/**
 * Core wallet information without sensitive data
 * 
 * @security Private keys moved to separate SecureWalletData type
 */
export interface Wallet {
  /** Unique wallet identifier */
  id: string;
  /** Owner user ID */
  userId: string;
  /** Wallet address (public) */
  address: string;
  /** Target blockchain */
  chain: Chain;
  /** Human-readable wallet name */
  name?: string;
  /** Wallet type and origin */
  type: WalletType;
  /** Current balance information */
  balance: WalletBalance;
  /** Wallet status */
  status: WalletStatus;
  /** Wallet creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastActivityAt?: string;
  /** Whether wallet is actively monitored */
  isMonitored: boolean;
  /** Wallet metadata and tags */
  metadata: WalletMetadata;
}

/**
 * Secure wallet data with encrypted private information
 * 
 * @security Separated from main Wallet type for security isolation
 */
export interface SecureWalletData {
  /** Wallet ID reference */
  walletId: string;
  /** Encrypted private key */
  encryptedPrivateKey: string;
  /** Encryption parameters */
  encryptionParams: EncryptionParams;
  /** Wallet derivation path (for HD wallets) */
  derivationPath?: string;
  /** Additional security metadata */
  securityMetadata: WalletSecurityMetadata;
}

/**
 * Wallet type classifications
 */
export type WalletType = "hot" | "cold" | "hardware" | "multisig" | "contract";

/**
 * Wallet operational status
 */
export type WalletStatus = "active" | "inactive" | "frozen" | "compromised" | "archived";

/**
 * Comprehensive wallet balance information
 */
export interface WalletBalance {
  /** Native token balance */
  native: {
    amount: string;
    usdValue: number;
  };
  /** Token balances */
  tokens: Array<{
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
    usdValue: number;
  }>;
  /** Total USD value */
  totalUsdValue: number;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Wallet metadata and tagging system
 */
export interface WalletMetadata {
  /** User-defined tags */
  tags: string[];
  /** Wallet description */
  description?: string;
  /** Risk level assessment */
  riskLevel: "low" | "medium" | "high";
  /** Trading purpose */
  purpose: "arbitrage" | "copy-trading" | "mev" | "general" | "testing";
}

// ========================================
// SECURITY AND ENCRYPTION TYPES
// ========================================

/**
 * Key derivation parameters for secure encryption
 */
export interface KeyDerivationParams {
  /** Algorithm used (e.g., 'pbkdf2', 'scrypt', 'argon2') */
  algorithm: string;
  /** Salt for key derivation */
  salt: string;
  /** Iteration count */
  iterations: number;
  /** Additional algorithm-specific parameters */
  params: Record<string, any>;
}

/**
 * Encryption parameters for secure data storage
 */
export interface EncryptionParams {
  /** Encryption algorithm */
  algorithm: string;
  /** Initialization vector */
  iv: string;
  /** Additional encryption metadata */
  metadata: Record<string, any>;
}

/**
 * Security settings for user accounts
 */
export interface SecuritySettings {
  /** Password requirements met */
  strongPassword: boolean;
  /** Two-factor authentication enabled */
  twoFactorAuth: boolean;
  /** Biometric authentication enabled */
  biometricAuth: boolean;
  /** Session timeout in minutes */
  sessionTimeout: number;
  /** IP whitelist enabled */
  ipWhitelist: boolean;
  /** Allowed IP addresses */
  allowedIPs: string[];
}

/**
 * Wallet-specific security metadata
 */
export interface WalletSecurityMetadata {
  /** Last security audit timestamp */
  lastAudit: string;
  /** Security risk score (0-100) */
  riskScore: number;
  /** Known security issues */
  issues: SecurityIssue[];
  /** Security recommendations */
  recommendations: string[];
}

/**
 * Security issue tracking
 */
export interface SecurityIssue {
  /** Issue identifier */
  id: string;
  /** Issue severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Issue description */
  description: string;
  /** Detection timestamp */
  detectedAt: string;
  /** Resolution status */
  status: "open" | "investigating" | "resolved" | "ignored";
}

// ========================================
// TRADING AND TRANSACTION TYPES
// ========================================

/**
 * Comprehensive trading transaction record
 * 
 * @enhanced Extended from basic Trade type with additional metadata
 */
export interface Trade {
  /** Unique trade identifier */
  id: string;
  /** Associated bot configuration ID */
  botConfigId: string;
  /** Bot strategy type */
  botType: "ARBITRAGE" | "COPY_TRADER" | "SANDWICH" | "GRID" | "DCA";
  /** Transaction hash on blockchain */
  txHash: string;
  /** Target blockchain */
  chain: Chain;
  /** Input token information */
  tokenIn: TokenInfo;
  /** Output token information */
  tokenOut: TokenInfo;
  /** Input amount (with precision) */
  amountIn: string;
  /** Output amount (with precision) */
  amountOut: string;
  /** Gas used for transaction */
  gasUsed: string;
  /** Gas price at execution */
  gasPrice: string;
  /** Calculated profit/loss */
  profit?: string;
  /** Trade execution status */
  status: TradeStatus;
  /** Additional trade metadata */
  metadata: TradeMetadata;
  /** Trade creation timestamp */
  createdAt: string;
  /** Trade completion timestamp */
  completedAt?: string;
  /** Error information if failed */
  error?: TradeError;
}

/**
 * Trade execution status with detailed states
 */
export type TradeStatus = 
  | "pending" 
  | "submitted" 
  | "confirmed" 
  | "success" 
  | "failed" 
  | "cancelled" 
  | "expired";

/**
 * Enhanced token information
 */
export interface TokenInfo {
  /** Token contract address */
  address: string;
  /** Token symbol */
  symbol: string;
  /** Token full name */
  name: string;
  /** Token decimals */
  decimals: number;
  /** Token logo URL */
  logoUrl?: string;
  /** Token verification status */
  verified: boolean;
}

/**
 * Comprehensive trade metadata
 */
export interface TradeMetadata {
  /** DEX or exchange used */
  exchange: string;
  /** Route taken for trade */
  route: TradeRoute[];
  /** Slippage experienced */
  actualSlippage: number;
  /** MEV protection used */
  mevProtection: boolean;
  /** Execution strategy */
  strategy: string;
  /** Market conditions at execution */
  marketConditions: MarketConditions;
}

/**
 * Trade route information for multi-hop trades
 */
export interface TradeRoute {
  /** DEX protocol */
  protocol: string;
  /** Token pair */
  pair: string;
  /** Pool address */
  poolAddress: string;
  /** Fee tier */
  fee: number;
}

/**
 * Market conditions at trade execution
 */
export interface MarketConditions {
  /** Gas price at execution */
  gasPrice: number;
  /** Network congestion level */
  congestion: "low" | "medium" | "high";
  /** Token volatility */
  volatility: number;
  /** Available liquidity */
  liquidity: number;
}

/**
 * Trade error information for failed transactions
 */
export interface TradeError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Detailed error information */
  details?: Record<string, any>;
  /** Recovery suggestions */
  suggestions?: string[];
}

// ========================================
// API AND AUTHENTICATION TYPES
// ========================================

/**
 * Generic API response wrapper with comprehensive error handling
 * 
 * @template T The type of the response data
 */
export interface ApiResponse<T = any> {
  /** Response data (present on success) */
  data?: T;
  /** Error information (present on failure) */
  error?: ApiError;
  /** Operation success status */
  success: boolean;
  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * Comprehensive API error information
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error information */
  details?: Record<string, any>;
  /** Request ID for debugging */
  requestId: string;
  /** Error timestamp */
  timestamp: string;
  /** Suggested actions for resolution */
  suggestions?: string[];
}

/**
 * Response metadata for API calls
 */
export interface ResponseMetadata {
  /** Response timestamp */
  timestamp: string;
  /** API version used */
  version: string;
  /** Request processing time in milliseconds */
  processingTime: number;
  /** Rate limit information */
  rateLimit?: RateLimitInfo;
  /** Pagination information (if applicable) */
  pagination?: PaginationInfo;
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  /** Requests remaining in current window */
  remaining: number;
  /** Total requests allowed per window */
  limit: number;
  /** Window reset timestamp */
  resetAt: string;
  /** Current window duration in seconds */
  windowDuration: number;
}

/**
 * Enhanced pagination information
 */
export interface PaginationInfo {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Next page cursor (for cursor-based pagination) */
  nextCursor?: string;
  /** Previous page cursor */
  previousCursor?: string;
}

/**
 * User login request with enhanced security
 */
export interface LoginRequest {
  /** User email address */
  email: string;
  /** User password */
  password: string;
  /** Two-factor authentication code (if enabled) */
  twoFactorCode?: string;
  /** Remember me flag */
  rememberMe?: boolean;
  /** Client information for security logging */
  clientInfo: ClientInfo;
}

/**
 * Client information for security tracking
 */
export interface ClientInfo {
  /** User agent string */
  userAgent: string;
  /** Client IP address */
  ipAddress: string;
  /** Client timezone */
  timezone: string;
  /** Client platform */
  platform: string;
}

/**
 * Enhanced authentication response
 */
export interface AuthResponse {
  /** Authenticated user information */
  user: User;
  /** Access token for API calls */
  accessToken: string;
  /** Refresh token for token renewal */
  refreshToken: string;
  /** Token expiration timestamp */
  expiresAt: string;
  /** User permissions */
  permissions: Permission[];
  /** Session information */
  session: SessionInfo;
}

/**
 * User permission system
 */
export interface Permission {
  /** Permission identifier */
  id: string;
  /** Permission name */
  name: string;
  /** Permission description */
  description: string;
  /** Resource this permission applies to */
  resource: string;
  /** Actions allowed */
  actions: string[];
}

/**
 * Session information for tracking
 */
export interface SessionInfo {
  /** Session identifier */
  id: string;
  /** Session creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
  /** Session expiration */
  expiresAt: string;
  /** Client information */
  client: ClientInfo;
}

// ========================================
// RPC AND BLOCKCHAIN CONFIGURATION
// ========================================

/**
 * Enhanced RPC configuration with failover support
 */
export interface RpcConfig {
  /** Target blockchain */
  chain: Chain;
  /** Primary RPC endpoint URL */
  url: string;
  /** WebSocket endpoint URL */
  websocketUrl?: string;
  /** API key for authenticated endpoints */
  apiKey?: string;
  /** Failover RPC endpoints */
  fallbackUrls: string[];
  /** Connection timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Health check configuration */
  healthCheck: HealthCheckConfig;
  /** Rate limiting configuration */
  rateLimit: RpcRateLimit;
}

/**
 * RPC health check configuration
 */
export interface HealthCheckConfig {
  /** Health check interval in milliseconds */
  interval: number;
  /** Timeout for health check requests */
  timeout: number;
  /** Endpoint to use for health checks */
  endpoint: string;
  /** Expected response for healthy status */
  expectedResponse?: any;
}

/**
 * RPC rate limiting configuration
 */
export interface RpcRateLimit {
  /** Requests per second limit */
  requestsPerSecond: number;
  /** Burst allowance */
  burstSize: number;
  /** Backoff strategy on rate limit */
  backoffStrategy: "linear" | "exponential" | "fixed";
}

// ========================================
// REAL-TIME DATA AND EVENTS
// ========================================

/**
 * Real-time price update event
 */
export interface PriceUpdateEvent {
  /** Event identifier */
  id: string;
  /** Token address */
  tokenAddress: string;
  /** Token symbol */
  symbol: string;
  /** Current price in USD */
  priceUsd: number;
  /** Price change percentage (24h) */
  change24h: number;
  /** Trading volume (24h) */
  volume24h: number;
  /** Market capitalization */
  marketCap?: number;
  /** Event timestamp */
  timestamp: number;
  /** Data source */
  source: string;
}

/**
 * Portfolio update event for real-time portfolio tracking
 */
export interface PortfolioUpdateEvent {
  /** User ID */
  userId: string;
  /** Updated portfolio value */
  totalValue: number;
  /** Value change since last update */
  valueChange: number;
  /** Percentage change */
  percentageChange: number;
  /** Top performing assets */
  topGainers: AssetPerformance[];
  /** Worst performing assets */
  topLosers: AssetPerformance[];
  /** Update timestamp */
  timestamp: number;
}

/**
 * Asset performance information
 */
export interface AssetPerformance {
  /** Asset symbol */
  symbol: string;
  /** Current value */
  value: number;
  /** Change percentage */
  change: number;
  /** Holding amount */
  amount: string;
}

// ========================================
// VALIDATION AND UTILITY TYPES
// ========================================

/**
 * Type guard to check if a value is a valid Chain
 * 
 * @param value - Value to check
 * @returns true if value is a valid Chain
 */
export function isValidChain(value: any): value is Chain {
  return typeof value === 'string' && 
    ['ETH', 'BSC', 'SOL', 'POLYGON', 'ARBITRUM', 'OPTIMISM'].includes(value);
}

/**
 * Type guard to check if a value is a valid UserRole
 * 
 * @param value - Value to check
 * @returns true if value is a valid UserRole
 */
export function isValidUserRole(value: any): value is UserRole {
  return typeof value === 'string' && 
    ['admin', 'trader', 'viewer', 'developer', 'auditor'].includes(value);
}

/**
 * Type guard to check if a value is a valid TradeStatus
 * 
 * @param value - Value to check
 * @returns true if value is a valid TradeStatus
 */
export function isValidTradeStatus(value: any): value is TradeStatus {
  return typeof value === 'string' && 
    ['pending', 'submitted', 'confirmed', 'success', 'failed', 'cancelled', 'expired'].includes(value);
}

/**
 * Validates if a user has required permissions
 * 
 * @param user - User object with permissions
 * @param requiredPermission - Permission identifier to check
 * @returns true if user has the required permission
 */
export function hasPermission(user: { permissions?: Permission[] }, requiredPermission: string): boolean {
  return user.permissions?.some(p => p.id === requiredPermission) ?? false;
}

/**
 * Creates a secure user object without sensitive data
 * 
 * @param user - Complete user object
 * @returns User object safe for client-side use
 */
export function sanitizeUser(user: User): Omit<User, never> {
  // User type is already secure, no sensitive data to remove
  return user;
}

/**
 * Creates a secure wallet object without sensitive data
 * 
 * @param wallet - Complete wallet object
 * @returns Wallet object safe for client-side use
 */
export function sanitizeWallet(wallet: Wallet): Omit<Wallet, never> {
  // Wallet type is already secure, no sensitive data to remove
  return wallet;
}

/**
 * Validates email format
 * 
 * @param email - Email string to validate
 * @returns true if email format is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates wallet address format for given chain
 * 
 * @param address - Wallet address to validate
 * @param chain - Target blockchain
 * @returns true if address format is valid for the chain
 */
export function isValidAddress(address: string, chain: Chain): boolean {
  switch (chain) {
    case 'ETH':
    case 'BSC':
    case 'POLYGON':
    case 'ARBITRUM':
    case 'OPTIMISM':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'SOL':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    default:
      return false;
  }
}

// ========================================
// LEGACY COMPATIBILITY EXPORTS
// ========================================

/**
 * @deprecated Use the new schema-based types from './src/bot'
 * Legacy type maintained for backward compatibility
 */
export type LegacyBotType = "ARBITRAGE" | "COPY_TRADER" | "SANDWICH";

// ========================================
// SCHEMA EXPORTS FROM BOT.TS
// ========================================

// Export all schemas from bot.ts for comprehensive validation
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
  WebSocketEventSchema,
  // Validation utilities
  EthereumAddressSchema,
  SolanaAddressSchema,
  PercentageSchema,
  FinancialAmountSchema,
  GasPriceSchema,
  createAddressSchema,
  // Type guards and utilities
  isArbitrageBotConfig,
  isCopyTradingBotConfig,
  isSandwichBotConfig,
  validateBotConfig,
  safeValidateBotConfig,
  isValidFinancialAmount,
  isValidEthereumAddress,
  isValidSolanaAddress,
  isValidAddressForChain,
  createDefaultArbitrageConfig,
  calculateProfitPercentage,
  meetsProfitThreshold,
  formatFinancialAmount,
  isValidGasPrice,
  // Constants
  SUPPORTED_CHAINS,
  BOT_TYPES,
  SUPPORTED_DEXES,
  TRADE_SIZE_TYPES,
  METRIC_TIMEFRAMES,
  WEBSOCKET_EVENT_TYPES,
  TRADE_EVENT_TYPES,
  MAX_SAFE_GAS_PRICE,
  MIN_SAFE_GAS_PRICE,
  MAX_SAFE_SLIPPAGE,
  MIN_SAFE_SLIPPAGE,
  MAX_CONCURRENT_TRADES,
  DEFAULT_COOLDOWN_PERIOD
} from './src/bot';

// Export all inferred types from bot.ts
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