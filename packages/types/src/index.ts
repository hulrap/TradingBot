/**
 * @file Trading Bot Types Package - Main Export.
 * 
 * Comprehensive type system for trading bot platform with multi-chain support,
 * advanced trading strategies, and enterprise-grade functionality.
 * 
 * This package provides:
 * - Blockchain and chain abstraction types
 * - Trading order, route, and position management
 * - Opportunity detection and MEV analysis
 * - Price feeds and market data aggregation
 * - Gas optimization and mempool monitoring
 * - Performance analytics and risk management
 * - Bot configuration and system settings.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 * @author Trading Bot Development Team
 * @license Proprietary
 */

// Import base types needed for utilities and type guards
import { SUPPORTED_CHAINS } from './blockchain/chain';
import type { SupportedChain, ChainConfig } from './blockchain/chain';

// ========================================
// RE-EXPORT ALL TYPES AND CONSTANTS
// ========================================

// Chain types and configurations
export type {
  SupportedChain,
  ChainFamily,
  NetworkType,
  ChainStatus,
  ChainConfig,
  ChainRpcConfig,
  ChainCapabilities,
  NetworkState,
  ChainStats,
  ChainRegistry,
  ChainConnectionPool,
  ChainSelector,
  CrossChainParams
} from './blockchain/chain';

export {
  SUPPORTED_CHAINS,
  EVM_CHAINS,
  LAYER2_CHAINS,
  TESTNET_MAPPINGS,
  DEFAULT_CHAIN_PRIORITIES
} from './blockchain/chain';

// Address types and validation
export type {
  Address,
  ChainAddress,
  AddressFormat,
  TokenInfo,
  TokenMetadata,
  TokenType,
  TokenMarketData,
  TokenSecurity,
  SecurityIssue,
  SecurityIssueType,
  AddressBookEntry,
  AddressCategory,
  AddressValidationResult,
  BatchAddressValidation,
  BatchAddressValidationResult,
  AddressComparison,
  AddressTransformOptions,
  AddressSearchFilter
} from './blockchain/addresses';

// No constants exported from addresses module

// Transaction types
export type {
  TransactionHash,
  TransactionStatus,
  TransactionType,
  BaseTransaction,
  GasConfig,
  GasEstimation,
  GasStrategy,
  TransactionMetadata,
  BundleConfig,
  MEVProtection,
  TransactionResult,
  TransactionError,
  TransactionLog,
  StateChange,
  RetryConfig,
  RetryCondition,
  ReplacementConfig,
  BatchTransactionRequest,
  BatchTransactionResult,
  SimulationRequest,
  StateOverride,
  SimulationResult,
  ExecutionTrace,
  GasBreakdown
} from './blockchain/transactions';

export {
  STANDARD_GAS_LIMITS,
  GAS_STRATEGY_MULTIPLIERS
} from './blockchain/transactions';

// Order types and execution
export type {
  OrderId,
  OrderType,
  OrderStatus,
  OrderSide,
  TimeInForce,
  BaseOrder,
  MarketOrder,
  LimitOrder,
  StopOrder,
  StopLimitOrder,
  TakeProfitOrder,
  OCOOrder,
  TrailingStopOrder,
  Order,
  OrderExecution,
  ExecutionRoute,
  ExecutionQuality,
  OrderMetadata,
  OrderValidationResult,
  OrderValidationError,
  OrderEstimation,
  OrderRiskAssessment,
  BatchOrderRequest,
  BatchOrderResult,
  OrderBookEntry,
  OrderBook
} from './trading/orders';

export {
  DEFAULT_SLIPPAGE_TOLERANCE,
  ORDER_PRIORITIES,
  MAX_ORDER_SIZES
} from './trading/orders';

// Route types and optimization
export type {
  RouteId,
  OptimizationObjective,
  RouteStatus,
  RouteStep,
  RouteStepMetadata,
  SwapRoute,
  RouteQuality,
  RouteOptimization,
  RouteMetadata,
  CrossChainRoute,
  RouteDiscoveryRequest,
  RouteDiscoveryOptions,
  RouteDiscoveryResult,
  CachedRoute,
  RouteCacheConfig,
  RouteAnalytics,
  RouteComparison
} from './trading/routes';

export {
  MAX_HOPS_BY_OBJECTIVE,
  DISCOVERY_TIMEOUTS,
  QUALITY_THRESHOLDS,
  COMMON_INTERMEDIATE_TOKENS
} from './trading/routes';

// Opportunity types
export type {
  OpportunityId,
  OpportunityType,
  OpportunityStatus,
  OpportunityPriority,
  BaseOpportunity,
  ArbitrageOpportunity,
  SandwichOpportunity,
  FrontrunOpportunity,
  LiquidationOpportunity,
  YieldFarmOpportunity,
  OpportunityRisk,
  OpportunityComplexity,
  OpportunityMetadata,
  OpportunityFilter,
  OpportunityRanking,
  OpportunityRankingResult
} from './trading/opportunities';

export {
  MIN_PROFIT_THRESHOLDS,
  OPPORTUNITY_EXPIRY_TIMES
} from './trading/opportunities';

// Position and portfolio types
export type {
  PositionId,
  PositionStatus,
  PositionSide,
  PositionType,
  Position,
  PositionPnL,
  PositionCosts,
  PositionRisk,
  PositionMetadata,
  Portfolio,
  PortfolioSummary,
  PortfolioPerformance,
  PerformancePeriod,
  PortfolioAllocation,
  PortfolioRisk,
  PortfolioMetadata,
  PositionSizing,
  PositionScaling
} from './trading/positions';

// Price data types
export type {
  PriceSource,
  PriceUpdateType,
  PriceConfidence,
  PricePoint,
  PriceMetadata,
  AggregatedPrice,
  AggregationMethod,
  PriceStatistics,
  PriceQuality,
  PriceChanges,
  PriceChange,
  Candlestick,
  TimeInterval,
  HistoricalPriceQuery,
  HistoricalPriceResult,
  PriceFeedConfig,
  PriceAlertConfig,
  AlertAction,
  PriceFeedSubscription,
  PriceTrend
} from './data/prices';

export {
  SOURCE_RELIABILITY,
  DEFAULT_UPDATE_INTERVALS
} from './data/prices';

// Gas data types
export type {
  GasSource,
  GasTier,
  GasUnit,
  GasPrice,
  GasPriceTier,
  GasPriceMetadata,
  GasOptimizationStrategy,
  GasStrategyParameters,
  GasDynamicRules,
  GasStrategyPerformance,
  GasPricePrediction,
  GasPriceForecast,
  GasPricePredictionPoint,
  GasAnalytics,
  GasAlert,
  GasAlertParameters,
  GasCostEstimation,
  GasCostBreakdown
} from './data/gas';

export {
  DEFAULT_GAS_LIMITS,
  GAS_SAFETY_THRESHOLDS
} from './data/gas';

// Mempool data types
export type {
  MempoolSource,
  TransactionClass,
  MEVSignature,
  PendingTransaction,
  TransactionClassification,
  MEVAnalysis,
  DecodedTransaction,
  TokenTransfer,
  DEXInteraction,
  MempoolTransactionMetadata,
  MempoolState,
  MempoolMonitorConfig,
  MempoolFilters,
  MempoolAnalytics,
  MempoolAlertConfig,
  MempoolAlertConditions
} from './data/mempool';

export {
  CLASSIFICATION_THRESHOLDS,
  MEV_PATTERNS,
  MEMPOOL_SIZE_THRESHOLDS
} from './data/mempool';

// DEX types
export type {
  DEXId,
  DEXProtocol,
  DEXCategory,
  DEXStatus,
  DEXConfig,
  DEXChainConfig,
  DEXFeatures,
  DEXMetadata,
  DEXAPIConfig,
  DEXTradingConfig,
  LiquidityPool,
  PoolToken,
  PoolReserves,
  PoolFees,
  PoolStats,
  PoolMetadata,
  DEXQuoteRequest,
  DEXQuote,
  DEXRoute,
  RouteHop,
  DEXTransaction,
  QuoteMetadata,
  DEXAggregatorConfig,
  AggregatedQuote
} from './data/dex';

export {
  POPULAR_DEXES,
  DEFAULT_DEX_SETTINGS
} from './data/dex';

// Bot configuration types
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
} from './config/bot-configs';

export {
  DEFAULT_BOT_SETTINGS,
  BOT_TYPE_DESCRIPTIONS
} from './config/bot-configs';

// System configuration types
export type {
  SystemEnvironment,
  LogLevel,
  SystemConfig,
  NetworkConfigs,
  ChainNetworkConfig,
  RPCEndpoint,
  GlobalNetworkConfig,
  GasNetworkConfig,
  TransactionNetworkConfig,
  MempoolNetworkConfig,
  DatabaseConfig,
  DatabaseConnectionConfig,
  CacheConfig as SystemCacheConfig,
  BackupConfig,
  MigrationConfig,
  SecurityConfig,
  AuthenticationConfig,
  OAuthProviderConfig,
  AuthorizationConfig,
  EncryptionConfig,
  RateLimitingConfig,
  CORSConfig,
  SecurityHeadersConfig,
  APIKeyConfig,
  APIConfig,
  ServerConfig,
  VersioningConfig,
  DocumentationConfig,
  MiddlewareConfig,
  WebSocketConfig,
  FeatureFlags,
  ResourceConfig,
  SystemMonitoringConfig,
  SystemAlertRule,
  IntegrationConfigs,
  PriceFeedIntegration,
  DEXIntegration,
  BridgeIntegration,
  NotificationIntegration,
  AnalyticsIntegration,
  SystemMetadata
} from './config/system-configs';

export {
  DEFAULT_SYSTEM_SETTINGS
} from './config/system-configs';

// User configuration types
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
} from './config/user-configs';

export {
  DEFAULT_USER_SETTINGS,
  USER_TIER_LIMITS
} from './config/user-configs';

// Alert types
export type {
  AlertId,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  Alert,
  AlertMetadata,
  AlertConditions,
  AlertConfig as MonitoringAlertConfig,
  AlertRule as MonitoringAlertRule,
  AlertSettings,
  AlertEscalation,
  AlertSuppression,
  NotificationChannel,
  NotificationStatus,
  NotificationConfig,
  NotificationChannelConfig,
  EmailConfig,
  SlackConfig,
  TelegramConfig,
  WebhookConfig,
  SMSConfig,
  PagerDutyConfig,
  NotificationTemplate,
  NotificationFilter,
  Notification,
  AlertFilter,
  AlertAcknowledgment,
  AlertResolution,
  AlertStats
} from './monitoring/alerts';

export {
  DEFAULT_ALERT_SETTINGS,
  ALERT_SEVERITY_COLORS,
  NOTIFICATION_PRIORITIES
} from './monitoring/alerts';

// Analytics types  
export type {
  MetricId,
  MetricType,
  MetricValue,
  MetricTags,
  Metric,
  MetricAggregation,
  MetricQuery,
  MetricFilter,
  MetricGroupBy,
  MetricResult,
  DashboardWidget,
  DashboardLayout,
  Dashboard,
  ReportType,
  ReportFormat,
  ReportConfig,
  Report,
  PerformanceAnalytics,
  StrategyAnalytics,
  RiskAnalytics,
  AnalyticsQuery,
  AnalyticsFilter,
  AnalyticsResult
} from './monitoring/analytics';

export {
  DEFAULT_METRIC_AGGREGATIONS,
  SUPPORTED_TIME_RANGES
} from './monitoring/analytics';

// Health types
export type {
  HealthStatus,
  HealthCheckType,
  HealthCheck,
  HealthCheckResult,
  ComponentHealth,
  SystemHealth,
  HealthMonitorConfig,
  HealthAlert,
  ServiceStatus,
  DependencyHealth
} from './monitoring/health';

export {
  HEALTH_CHECK_INTERVALS,
  HEALTH_THRESHOLDS
} from './monitoring/health';

// Metrics types
export type {
  MetricsCollectorConfig,
  SystemMetrics,
  ApplicationMetrics,
  BusinessMetrics,
  MetricsSnapshot,
  MetricsHistory,
  MetricsAlert,
  MetricsExport,
  CustomMetric,
  MetricsAggregator
} from './monitoring/metrics';

export {
  DEFAULT_METRICS_CONFIG,
  METRICS_RETENTION_PERIODS
} from './monitoring/metrics';

// Validation and validation types
export type {
  ValidationError,
  ValidationResult,
  Validator,
  ValidationSchema,
  ValidationRule,
  ValidationConstraint,
  FieldValidation,
  SchemaValidation,
  ConditionalValidation,
  CustomValidation,
  ValidationContext
} from './utilities/validation';

export {
  VALIDATION_MESSAGES,
  COMMON_VALIDATORS
} from './utilities/validation';

// Retry types
export type {
  RetryPolicy,
  RetryStrategy,
  ExponentialBackoffConfig,
  LinearBackoff,
  FixedDelay,
  CustomBackoff,
  RetryOptions,
  RetryResult,
  RetryContext,
  RetryMetrics,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreaker,
  BulkheadConfig,
  Bulkhead,
  TimeoutConfig,
  RateLimiter,
  RateLimitConfig,
  RateLimitResult,
  ResiliencePattern,
  ResilienceConfig
} from './utilities/retry';

export {
  DEFAULT_RETRY_CONFIGS,
  CIRCUIT_BREAKER_DEFAULTS
} from './utilities/retry';

// Rate limiting types
export type {
  RateLimitStrategy,
  TokenBucketConfig,
  LeakyBucketConfig,
  SlidingWindowConfig,
  FixedWindowConfig,
  AdaptiveRateLimit,
  RateLimitContext,
  RateLimitState,
  RateLimitQuota,
  QuotaType
} from './utilities/rate-limiting';

export {
  DEFAULT_RATE_LIMITS,
  BURST_ALLOWANCES
} from './utilities/rate-limiting';

// Formatting types
export type {
  NumberFormat,
  CurrencyFormat,
  PercentageFormat,
  DateFormat,
  TimeFormat,
  AddressDisplayFormat,
  TokenAmountFormat,
  PriceFormat,
  FormattingOptions,
  LocaleConfig,
  FormattingContext,
  FormattingRule,
  ConditionalFormat,
  CustomFormatter,
  FormattingProvider,
  FormattingCache,
  FormattingPreset,
  ResponsiveFormat,
  AccessibilityFormat,
  ValidationFormat,
  ExportFormat,
  PrintFormat,
  DisplayConfig,
  FormatMetadata,
  FormattingError
} from './utilities/formatting';

export {
  DEFAULT_FORMATS,
  LOCALE_CONFIGS,
  FORMAT_PRESETS
} from './utilities/formatting';

// Cache types
export type {
  CacheStrategy,
  CachePolicy,
  CacheEntry,
  CacheKey,
  CacheValue,
  CacheStats,
  CacheConfig,
  CacheProvider,
  TTLCache,
  LRUCache,
  LFUCache,
  FIFOCache,
  MultiTierCache,
  DistributedCache,
  CacheInvalidation,
  CacheEviction,
  CacheCompression,
  CacheEncryption,
  CacheMetrics,
  CacheHealth,
  CacheWarming,
  CachePrefetch,
  CachePartition,
  CacheReplication,
  CacheConsistency,
  CacheSynchronization,
  CacheBackup
} from './utilities/cache';

export {
  DEFAULT_CACHE_CONFIGS,
  CACHE_SIZE_LIMITS
} from './utilities/cache';

// Crypto types
export type {
  HashAlgorithm,
  EncryptionAlgorithm,
  SignatureAlgorithm,
  KeyDerivationFunction,
  CryptoKey,
  KeyPair,
  DigitalSignature,
  EncryptedData,
  HashResult,
  CryptoConfig,
  KeyManagement,
  SecureRandom,
  CryptoProvider,
  CryptoOperation
} from './utilities/crypto';

export {
  SUPPORTED_ALGORITHMS,
  CRYPTO_STANDARDS
} from './utilities/crypto';

// ========================================
// CONNECTION MANAGEMENT TYPES
// ========================================

// Connection management types
export type {
  ConnectionState,
  ConnectionType,
  ConnectionHealth,
  LoadBalancingStrategy,
  ConnectionEvent,
  ConnectionStats,
  ConnectionConfig,
  ConnectionEventData,
  WebSocketSubscription,
  WebSocketPoolConfig,
  RPCRequest,
  RPCResponse,
  RPCBatchRequest,
  RPCClientConfig,
  ConnectionPoolStats,
  ConnectionPoolConfig,
  ChainProviderConfig,
  MultiChainProviderConfig,
  ConnectionHealthCheck,
  HealthMonitorConfig as ConnectionHealthMonitorConfig
} from './connectivity/connections';

// ========================================
// DATA SOURCE INTEGRATION TYPES
// ========================================

// Data source integration types
export type {
  DataSourceId,
  DataSourceType,
  DataSourceStatus,
  AuthMethod,
  DataSourceErrorType,
  APIEndpoint,
  AuthConfig,
  DataSourceAPIConfig,
  FeedSubscription,
  FeedAggregationConfig,
  DataQualityMetrics,
  DataSourceMetrics,
  DataSourceError,
  OracleConfig,
  SocialSentimentConfig,
  NewsDataConfig,
  WebhookConfig as DataSourceWebhookConfig,
  WebhookEvent
} from './data-sources/integrations';

// ========================================
// PROCESSING PIPELINE TYPES
// ========================================

// Processing pipeline types
export type {
  PipelineId,
  PipelineStageType,
  PipelineStatus,
  ProcessingMode,
  PipelineStage,
  PipelineConfig,
  StreamDataItem,
  StreamWindow,
  StreamAggregation,
  AnalysisTask,
  AnalysisResult,
  PipelineExecutionContext,
  PipelineExecutionResult,
  PipelineMonitoringConfig,
  PipelineMetrics
} from './processing/pipelines';

// ========================================
// ORCHESTRATION TYPES
// ========================================

// Orchestration and coordination types
export type {
  ServiceId,
  ServiceType,
  ServiceStatus as OrchestratorServiceStatus,
  ServiceHealth,
  SystemEventType,
  ServiceEndpoint,
  ServiceCapabilities,
  ServiceRegistration,
  ServiceDiscoveryQuery,
  SystemEvent,
  EventSubscription,
  EventRouter,
  ServiceLifecycle,
  ServiceStartupConfig,
  WorkflowStep,
  CoordinationWorkflow,
  WorkflowExecutionResult,
  SystemHealth as OrchestratorSystemHealth,
  OrchestratorConfig
} from './orchestration/coordination';

// ========================================
// ADVANCED MEV & LIVSHITS ALGORITHM TYPES
// ========================================

// MEV and Livshits algorithm types
export type {
  OptimizationObjective as LivshitsOptimizationObjective,
  LivshitsHeuristic,
  MEVAttackType,
  ProtocolGraphNode,
  LivshitsOpportunityMatrix,
  PrecomputedRoute,
  RouteHop as LivshitsRouteHop,
  MEVSignature as AdvancedMEVSignature,
  CrossChainArbitrageOpportunity,
  LivshitsPerformanceMetrics
} from './mev/mev-livshits';

// ========================================
// ADVANCED RPC INFRASTRUCTURE TYPES
// ========================================

// Advanced RPC infrastructure types
export type {
  RPCProviderType,
  RPCProviderTier,
  RPCRequestPriority,
  LoadBalancingStrategy as RPCLoadBalancingStrategy,
  RPCProviderConfig,
  RPCFallbackConfig,
  RPCConnectionPoolConfig,
  RPCProviderMetrics,
  RPCHealthStatus,
  RPCOptimizationRecommendations
} from './infrastructure/rpc-advanced';

// ========================================
// AI/ML AGENT SYSTEMS TYPES
// ========================================

// AI/ML agent and machine learning types
export type {
  ModelType,
  AgentType,
  LearningParadigm,
  RLAgentConfig,
  RLAgentState,
  MultiAgentSystemConfig,
  AgentMessage,
  LLMConfig,
  LLMQuery,
  LLMResponse,
  ModelLifecycle
} from './ai-ml/agent-systems';

// ========================================
// TECHNICAL ANALYSIS TYPES
// ========================================

// Technical indicators and analysis types
export type {
  TechnicalIndicatorType,
  IndicatorTimeframe,
  SignalStrength,
  SignalDirection,
  BaseIndicatorConfig,
  MovingAverageConfig,
  RSIConfig,
  MACDConfig,
  BollingerBandsConfig,
  IchimokuConfig,
  CustomIndicatorConfig,
  IndicatorConfig,
  IndicatorResult,
  CalculationEngineConfig,
  SignalFilterConfig,
  CompositeSignal,
  CandlestickPatternType,
  ChartPatternType,
  PatternRecognitionResult
} from './analysis/technical-indicators';

// ========================================
// API ECOSYSTEM INTEGRATION TYPES
// ========================================

// API ecosystem and external integrations
export type {
  APIProviderType,
  APICategory,
  APIAuthMethod,
  APIProviderConfig,
  APIRequest,
  APIResponse,
  APIAggregationConfig,
  WebSocketSubscription as APIWebSocketSubscription,
  DataStream
} from './integrations/api-ecosystem';

// ========================================
// SMART CONTRACT INTERACTION TYPES
// ========================================

// Dynamic smart contract interaction types
export type {
  ContractType,
  ABIFunctionType,
  StateMutability,
  VerificationStatus,
  ABIParameter,
  ABIFunction,
  ABIEvent,
  ABIError,
  DynamicABI,
  ContractIntrospection,
  DynamicFunctionCall,
  DynamicFunctionResult,
  ContractRegistryEntry
} from './smart-contracts/dynamic-interaction';

// ========================================
// SHARED UTILITY TYPES
// ========================================

/**
 * Generic API response wrapper.
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string | Record<string, unknown>;
  };
  timestamp: number;
}

/**
 * Pagination information.
 */
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Time range filter.
 */
interface TimeRange {
  start: number;
  end: number;
}

/**
 * Base filter interface.
 */
interface BaseFilter {
  chains?: SupportedChain[];
  timeRange?: TimeRange;
  limit?: number;
  offset?: number;
}

// ========================================
// UTILITY CONSTANTS
// ========================================

const SMALL_NUMBER = 0.000001;
const DECIMAL_PLACES = 6;
const PERCENTAGE_PRECISION = 4;
const SCALING_FACTOR = 1000000;
const NANOSECONDS_PER_SECOND = 1000000000;
const MICROSECONDS_PER_SECOND = 1000000;
const SCALED_PERCENTAGE = 1000000000;

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Type guard to check if a value is a supported chain.
 */
function isSupportedChain(value: unknown): value is SupportedChain {
  return typeof value === 'string' && SUPPORTED_CHAINS.includes(value as SupportedChain);
}

/**
 * Validates if an address is valid for a specific chain.
 */
function isValidAddressForChain(address: string, chain: SupportedChain): boolean {
  if (!address || !chain) return false;
  
  // Basic validation patterns for supported chains (can be extended)
  const patterns: Partial<Record<SupportedChain, RegExp>> = {
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    bsc: /^0x[a-fA-F0-9]{40}$/,
    polygon: /^0x[a-fA-F0-9]{40}$/,
    arbitrum: /^0x[a-fA-F0-9]{40}$/,
    optimism: /^0x[a-fA-F0-9]{40}$/,
    avalanche: /^0x[a-fA-F0-9]{40}$/,
    fantom: /^0x[a-fA-F0-9]{40}$/,
    base: /^0x[a-fA-F0-9]{40}$/,
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  };
  
  const pattern = patterns[chain];
  return Boolean(pattern?.test(address));
}

/**
 * Gets basic chain information.
 */
function getChainInfo(chain: SupportedChain): Partial<ChainConfig> {
  // This would typically fetch from a configuration store
  return {
    id: chain,
    name: chain.charAt(0).toUpperCase() + chain.slice(1),
    family: chain === 'solana' ? 'solana' : 'evm'
  };
}

/**
 * Formats a numeric amount with appropriate decimal places.
 */
function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  if (num < SMALL_NUMBER) return '0';
  if (num < 1) return num.toFixed(DECIMAL_PLACES);
  if (num < 1000) return num.toFixed(PERCENTAGE_PRECISION);
  if (num < SCALING_FACTOR) return `${(num / 1000).toFixed(1)}K`;
  if (num < NANOSECONDS_PER_SECOND) return `${(num / SCALING_FACTOR).toFixed(1)}M`;
  return `${(num / NANOSECONDS_PER_SECOND).toFixed(1)}B`;
}

/**
 * Calculates percentage change between two values.
 */
function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Validates that a configuration object has all required fields.
 */
function validateConfig<T>(config: T, requiredFields: Array<keyof T>): boolean {
  return requiredFields.every(field => config[field] !== undefined && config[field] !== null);
}

// ========================================
// DEFAULT EXPORT
// ========================================

/**
 * Complete trading bot types package with all exports.
 */
const TradingBotTypes = {
  // Utility functions
  isSupportedChain,
  isValidAddressForChain,
  getChainInfo,
  formatAmount,
  calculatePercentageChange,
  validateConfig
};

export type {
  ApiResponse,
  Pagination,
  TimeRange,
  BaseFilter
};

export {
  TradingBotTypes as default,
  isSupportedChain,
  isValidAddressForChain,
  getChainInfo,
  formatAmount,
  calculatePercentageChange,
  validateConfig
};
