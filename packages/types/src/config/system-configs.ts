/**
 * @file System Configuration Types.
 * 
 * System-wide configuration types for trading bot platform including
 * network configurations, security settings, feature flags, and
 * operational parameters.
 * 
 * Features:
 * - Multi-environment support
 * - Network and RPC configurations
 * - Security and authentication settings
 * - Feature flags and toggles
 * - Resource management
 * - Monitoring and observability.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';

// ========================================
// CORE SYSTEM CONFIGURATION
// ========================================

/**
 * System environment types.
 */
type SystemEnvironment = 
  | 'development'
  | 'testing'
  | 'staging'
  | 'production';

/**
 * Log levels.
 */
type LogLevel = 
  | 'error'
  | 'warn'
  | 'info'
  | 'debug'
  | 'trace';

// ========================================
// NETWORK CONFIGURATION
// ========================================

/**
 * RPC endpoint configuration.
 */
interface RPCEndpoint {
  /** Endpoint URL. */
  url: string;
  
  /** Endpoint priority. */
  priority: number;
  
  /** Rate limit. */
  rateLimit: number;
  
  /** Authentication. */
  auth?: {
    type: 'api-key' | 'bearer' | 'basic';
    credentials: Record<string, string>;
  };
  
  /** Health check settings. */
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  
  /** Endpoint metadata. */
  metadata: {
    provider: string;
    region?: string;
    tier: 'free' | 'paid' | 'premium';
  };
}

/**
 * Global network configuration.
 */
interface GlobalNetworkConfig {
  /** Connection timeout. */
  connectionTimeout: number;
  
  /** Request timeout. */
  requestTimeout: number;
  
  /** Maximum retries. */
  maxRetries: number;
  
  /** Retry backoff multiplier. */
  retryBackoff: number;
  
  /** Connection pooling. */
  connectionPool: {
    maxConnections: number;
    idleTimeout: number;
    keepAlive: boolean;
  };
  
  /** Circuit breaker settings. */
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
  };
}

/**
 * Gas network configuration.
 */
interface GasNetworkConfig {
  /** Default gas limits. */
  defaultLimits: Record<string, number>;
  
  /** Gas price strategy. */
  priceStrategy: 'slow' | 'standard' | 'fast' | 'aggressive';
  
  /** Gas price multipliers. */
  priceMultipliers: {
    slow: number;
    standard: number;
    fast: number;
    aggressive: number;
  };
  
  /** Maximum gas price. */
  maxGasPrice: string;
  
  /** EIP-1559 settings. */
  eip1559: {
    enabled: boolean;
    baseFeeMultiplier: number;
    priorityFeeMultiplier: number;
  };
}

/**
 * Transaction network configuration.
 */
interface TransactionNetworkConfig {
  /** Default transaction timeout. */
  defaultTimeout: number;
  
  /** Maximum pending transactions. */
  maxPendingTxs: number;
  
  /** Nonce management. */
  nonceManagement: {
    strategy: 'sequential' | 'parallel' | 'hybrid';
    maxGap: number;
    timeout: number;
  };
  
  /** Transaction replacement. */
  replacement: {
    enabled: boolean;
    gasPriceIncrease: number;
    maxReplacements: number;
  };
}

/**
 * Mempool network configuration.
 */
interface MempoolNetworkConfig {
  /** Mempool monitoring. */
  monitoring: {
    enabled: boolean;
    interval: number;
    sources: string[];
  };
  
  /** Transaction filtering. */
  filtering: {
    minValue: string;
    maxGasPrice: string;
    targetAddresses: Address[];
  };
}

/**
 * Chain-specific network configuration.
 */
interface ChainNetworkConfig {
  /** Chain identifier. */
  chainId: number;
  
  /** Chain name. */
  name: string;
  
  /** Native currency. */
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  
  /** RPC endpoints. */
  rpcUrls: RPCEndpoint[];
  
  /** WebSocket endpoints. */
  wsUrls: string[];
  
  /** Block explorer URLs. */
  blockExplorerUrls: string[];
  
  /** Network status. */
  status: 'active' | 'inactive' | 'maintenance';
  
  /** Gas configuration. */
  gas: GasNetworkConfig;
  
  /** Transaction settings. */
  transactions: TransactionNetworkConfig;
  
  /** Mempool settings. */
  mempool: MempoolNetworkConfig;
}

/**
 * Network configurations for all supported chains.
 */
interface NetworkConfigs {
  /** Default network. */
  default: SupportedChain;
  
  /** Chain-specific configurations. */
  chains: Record<SupportedChain, ChainNetworkConfig>;
  
  /** Global network settings. */
  global: GlobalNetworkConfig;
}

// ========================================
// DATABASE CONFIGURATION
// ========================================

/**
 * Database connection configuration.
 */
interface DatabaseConnectionConfig {
  /** Database type. */
  type: 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';
  
  /** Connection URL. */
  url: string;
  
  /** Connection pool settings. */
  pool: {
    min: number;
    max: number;
    idleTimeout: number;
    acquireTimeout: number;
  };
  
  /** SSL configuration. */
  ssl: {
    enabled: boolean;
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  
  /** Connection metadata. */
  metadata: {
    name: string;
    region?: string;
    provider?: string;
  };
}

/**
 * Cache configuration.
 */
interface CacheConfig {
  /** Cache type. */
  type: 'redis' | 'memory' | 'memcached';
  
  /** Cache connection. */
  connection: DatabaseConnectionConfig;
  
  /** Default TTL. */
  defaultTTL: number;
  
  /** Cache strategies. */
  strategies: {
    prices: number;
    routes: number;
    tokens: number;
    users: number;
  };
}

/**
 * Backup configuration.
 */
interface BackupConfig {
  /** Backup enabled. */
  enabled: boolean;
  
  /** Backup frequency. */
  frequency: 'hourly' | 'daily' | 'weekly';
  
  /** Backup retention. */
  retention: number;
  
  /** Backup storage. */
  storage: {
    type: 's3' | 'gcs' | 'azure' | 'local';
    config: Record<string, string | number | boolean>;
  };
}

/**
 * Migration configuration.
 */
interface MigrationConfig {
  /** Migrations directory. */
  directory: string;
  
  /** Auto-run migrations. */
  autoRun: boolean;
  
  /** Migration table name. */
  tableName: string;
}

/**
 * Database configuration.
 */
interface DatabaseConfig {
  /** Primary database. */
  primary: DatabaseConnectionConfig;
  
  /** Read replicas. */
  replicas: DatabaseConnectionConfig[];
  
  /** Cache configuration. */
  cache: CacheConfig;
  
  /** Backup configuration. */
  backup: BackupConfig;
  
  /** Migration settings. */
  migrations: MigrationConfig;
}

// ========================================
// SECURITY CONFIGURATION
// ========================================

/**
 * OAuth provider configuration.
 */
interface OAuthProviderConfig {
  /** Client ID. */
  clientId: string;
  
  /** Client secret. */
  clientSecret: string;
  
  /** Authorization URL. */
  authUrl: string;
  
  /** Token URL. */
  tokenUrl: string;
  
  /** User info URL. */
  userInfoUrl: string;
  
  /** Scopes. */
  scopes: string[];
}

/**
 * Authentication configuration.
 */
interface AuthenticationConfig {
  /** JWT settings. */
  jwt: {
    secret: string;
    algorithm: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  
  /** OAuth settings. */
  oauth: {
    enabled: boolean;
    providers: Record<string, OAuthProviderConfig>;
  };
  
  /** Multi-factor authentication. */
  mfa: {
    enabled: boolean;
    methods: Array<'totp' | 'sms' | 'email'>;
    required: boolean;
  };
  
  /** Session settings. */
  sessions: {
    enabled: boolean;
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
  };
}

/**
 * Authorization configuration.
 */
interface AuthorizationConfig {
  /** RBAC settings. */
  rbac: {
    enabled: boolean;
    defaultRole: string;
    roleHierarchy: Record<string, string[]>;
  };
  
  /** Permissions. */
  permissions: {
    granular: boolean;
    caching: boolean;
    cacheTTL: number;
  };
  
  /** Admin settings. */
  admin: {
    superAdminEmails: string[];
    adminRoles: string[];
  };
}

/**
 * Encryption configuration.
 */
interface EncryptionConfig {
  /** Data encryption. */
  data: {
    algorithm: string;
    keySize: number;
    key: string;
  };
  
  /** Wallet encryption. */
  wallets: {
    enabled: boolean;
    algorithm: string;
    keyDerivation: string;
  };
  
  /** Communication encryption. */
  communication: {
    tls: {
      enabled: boolean;
      minVersion: string;
      ciphers: string[];
    };
  };
}

/**
 * Rate limiting configuration.
 */
interface RateLimitingConfig {
  /** Global rate limits. */
  global: {
    requests: number;
    window: number;
  };
  
  /** Per-user rate limits. */
  perUser: {
    requests: number;
    window: number;
  };
  
  /** Per-IP rate limits. */
  perIP: {
    requests: number;
    window: number;
  };
  
  /** API-specific limits. */
  apis: Record<string, {
    requests: number;
    window: number;
  }>;
}

/**
 * CORS configuration.
 */
interface CORSConfig {
  /** Allowed origins. */
  origins: string[];
  
  /** Allowed methods. */
  methods: string[];
  
  /** Allowed headers. */
  headers: string[];
  
  /** Credentials allowed. */
  credentials: boolean;
  
  /** Max age. */
  maxAge: number;
}

/**
 * Security headers configuration.
 */
interface SecurityHeadersConfig {
  /** Content Security Policy. */
  csp: string;
  
  /** X-Frame-Options. */
  frameOptions: string;
  
  /** X-Content-Type-Options. */
  contentTypeOptions: string;
  
  /** Strict-Transport-Security. */
  hsts: string;
  
  /** Referrer-Policy. */
  referrerPolicy: string;
}

/**
 * API key configuration.
 */
interface APIKeyConfig {
  /** Key generation. */
  generation: {
    length: number;
    algorithm: string;
    prefix: string;
  };
  
  /** Key validation. */
  validation: {
    enabled: boolean;
    caching: boolean;
    cacheTTL: number;
  };
  
  /** Key permissions. */
  permissions: {
    default: string[];
    scopes: Record<string, string[]>;
  };
}

/**
 * Security configuration.
 */
interface SecurityConfig {
  /** Authentication settings. */
  authentication: AuthenticationConfig;
  
  /** Authorization settings. */
  authorization: AuthorizationConfig;
  
  /** Encryption settings. */
  encryption: EncryptionConfig;
  
  /** Rate limiting. */
  rateLimiting: RateLimitingConfig;
  
  /** CORS settings. */
  cors: CORSConfig;
  
  /** Security headers. */
  headers: SecurityHeadersConfig;
  
  /** API key management. */
  apiKeys: APIKeyConfig;
}

// ========================================
// API CONFIGURATION
// ========================================

/**
 * Server configuration.
 */
interface ServerConfig {
  /** Server port. */
  port: number;
  
  /** Server host. */
  host: string;
  
  /** Request size limits. */
  limits: {
    json: string;
    raw: string;
    text: string;
    urlencoded: string;
  };
  
  /** Timeout settings. */
  timeouts: {
    server: number;
    keepAlive: number;
    headers: number;
  };
  
  /** Compression. */
  compression: {
    enabled: boolean;
    threshold: number;
    level: number;
  };
}

/**
 * API versioning configuration.
 */
interface VersioningConfig {
  /** Versioning strategy. */
  strategy: 'header' | 'url' | 'query';
  
  /** Default version. */
  default: string;
  
  /** Supported versions. */
  supported: string[];
  
  /** Deprecated versions. */
  deprecated: string[];
}

/**
 * Documentation configuration.
 */
interface DocumentationConfig {
  /** Swagger/OpenAPI. */
  swagger: {
    enabled: boolean;
    path: string;
    title: string;
    description: string;
    version: string;
  };
  
  /** API documentation. */
  docs: {
    enabled: boolean;
    path: string;
    authentication: boolean;
  };
}

/**
 * Middleware configuration.
 */
interface MiddlewareConfig {
  /** Request logging. */
  logging: {
    enabled: boolean;
    format: string;
    excludePaths: string[];
  };
  
  /** Request validation. */
  validation: {
    enabled: boolean;
    strict: boolean;
    stripUnknown: boolean;
  };
  
  /** Response compression. */
  compression: {
    enabled: boolean;
    threshold: number;
  };
}

/**
 * WebSocket configuration.
 */
interface WebSocketConfig {
  /** WebSocket enabled. */
  enabled: boolean;
  
  /** WebSocket port. */
  port: number;
  
  /** Connection limits. */
  limits: {
    maxConnections: number;
    maxPayload: number;
    pingInterval: number;
    pongTimeout: number;
  };
  
  /** Authentication. */
  authentication: {
    required: boolean;
    tokenValidation: boolean;
  };
}

/**
 * API configuration.
 */
interface APIConfig {
  /** Server settings. */
  server: ServerConfig;
  
  /** API versioning. */
  versioning: VersioningConfig;
  
  /** Documentation. */
  documentation: DocumentationConfig;
  
  /** Middleware settings. */
  middleware: MiddlewareConfig;
  
  /** WebSocket settings. */
  websocket: WebSocketConfig;
}

// ========================================
// FEATURE FLAGS
// ========================================

/**
 * Feature flags configuration.
 */
interface FeatureFlags {
  /** Trading features. */
  trading: {
    arbitrage: boolean;
    copyTrading: boolean;
    mevBot: boolean;
    yieldFarming: boolean;
    gridTrading: boolean;
    dcaBot: boolean;
  };
  
  /** Advanced features. */
  advanced: {
    crossChainArbitrage: boolean;
    flashLoans: boolean;
    mevProtection: boolean;
    gasOptimization: boolean;
    batchTransactions: boolean;
  };
  
  /** Analytics features. */
  analytics: {
    advancedMetrics: boolean;
    realTimeAnalytics: boolean;
    customDashboards: boolean;
    exportData: boolean;
  };
  
  /** Integration features. */
  integrations: {
    socialTrading: boolean;
    externalAPIs: boolean;
    webhooks: boolean;
    notifications: boolean;
  };
  
  /** Experimental features. */
  experimental: {
    aiTrading: boolean;
    predictiveAnalytics: boolean;
    advancedRouting: boolean;
    crossChainMessaging: boolean;
  };
}

// ========================================
// RESOURCE CONFIGURATION
// ========================================

/**
 * Resource configuration.
 */
interface ResourceConfig {
  /** CPU limits. */
  cpu: {
    limit: number;
    request: number;
    throttling: boolean;
  };
  
  /** Memory limits. */
  memory: {
    limit: string;
    request: string;
    swapLimit: string;
  };
  
  /** Storage limits. */
  storage: {
    limit: string;
    type: 'ssd' | 'hdd' | 'nvme';
    iops: number;
  };
  
  /** Network limits. */
  network: {
    bandwidth: string;
    connections: number;
    timeout: number;
  };
  
  /** Scaling configuration. */
  scaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPU: number;
    targetMemory: number;
  };
}

// ========================================
// MONITORING CONFIGURATION
// ========================================

/**
 * Alert rule configuration.
 */
interface SystemAlertRule {
  /** Rule name. */
  name: string;
  
  /** Rule condition. */
  condition: string;
  
  /** Rule severity. */
  severity: 'info' | 'warning' | 'error' | 'critical';
  
  /** Rule enabled. */
  enabled: boolean;
  
  /** Notification channels. */
  channels: string[];
}

/**
 * System monitoring configuration.
 */
interface SystemMonitoringConfig {
  /** Metrics collection. */
  metrics: {
    enabled: boolean;
    interval: number;
    retention: number;
    exporters: string[];
  };
  
  /** Logging configuration. */
  logging: {
    level: LogLevel;
    format: 'json' | 'text';
    output: 'console' | 'file' | 'both';
    rotation: {
      enabled: boolean;
      maxSize: string;
      maxFiles: number;
      maxAge: number;
    };
  };
  
  /** Tracing configuration. */
  tracing: {
    enabled: boolean;
    sampler: 'always' | 'never' | 'ratio';
    ratio: number;
    exporters: string[];
  };
  
  /** Health checks. */
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    endpoints: string[];
  };
  
  /** Alerting. */
  alerting: {
    enabled: boolean;
    channels: string[];
    rules: SystemAlertRule[];
  };
}

// ========================================
// INTEGRATION CONFIGURATIONS
// ========================================

/**
 * Price feed integration.
 */
interface PriceFeedIntegration {
  /** Integration enabled. */
  enabled: boolean;
  
  /** API configuration. */
  api: {
    baseUrl: string;
    apiKey?: string;
    rateLimit: number;
  };
  
  /** Supported chains. */
  chains: SupportedChain[];
  
  /** Update frequency. */
  updateFrequency: number;
}

/**
 * DEX integration.
 */
interface DEXIntegration {
  /** Integration enabled. */
  enabled: boolean;
  
  /** Supported chains. */
  chains: SupportedChain[];
  
  /** API configuration. */
  api?: {
    baseUrl: string;
    apiKey?: string;
    rateLimit: number;
  };
  
  /** Contract addresses. */
  contracts: Record<SupportedChain, Record<string, Address>>;
}

/**
 * Bridge integration.
 */
interface BridgeIntegration {
  /** Integration enabled. */
  enabled: boolean;
  
  /** Supported routes. */
  routes: Array<{
    from: SupportedChain;
    to: SupportedChain;
    tokens: Address[];
  }>;
  
  /** API configuration. */
  api: {
    baseUrl: string;
    apiKey?: string;
    rateLimit: number;
  };
}

/**
 * Notification integration.
 */
interface NotificationIntegration {
  /** Integration enabled. */
  enabled: boolean;
  
  /** Integration type. */
  type: 'email' | 'slack' | 'telegram' | 'discord' | 'webhook';
  
  /** Configuration. */
  config: Record<string, string | number | boolean>;
  
  /** Rate limiting. */
  rateLimit: number;
}

/**
 * Analytics integration.
 */
interface AnalyticsIntegration {
  /** Integration enabled. */
  enabled: boolean;
  
  /** Integration type. */
  type: 'google-analytics' | 'mixpanel' | 'amplitude' | 'custom';
  
  /** Configuration. */
  config: Record<string, string | number | boolean>;
  
  /** Data retention. */
  retention: number;
}

/**
 * External integrations configuration.
 */
interface IntegrationConfigs {
  /** Price feed integrations. */
  priceFeeds: Record<string, PriceFeedIntegration>;
  
  /** DEX integrations. */
  dexes: Record<string, DEXIntegration>;
  
  /** Bridge integrations. */
  bridges: Record<string, BridgeIntegration>;
  
  /** Notification integrations. */
  notifications: Record<string, NotificationIntegration>;
  
  /** Analytics integrations. */
  analytics: Record<string, AnalyticsIntegration>;
}

// ========================================
// SYSTEM METADATA
// ========================================

/**
 * System metadata.
 */
interface SystemMetadata {
  /** Deployment information. */
  deployment: {
    timestamp: number;
    version: string;
    gitCommit: string;
    environment: SystemEnvironment;
  };
  
  /** Build information. */
  build: {
    timestamp: number;
    version: string;
    nodeVersion: string;
    platform: string;
  };
  
  /** System information. */
  system: {
    hostname: string;
    region: string;
    zone: string;
    instanceType: string;
  };
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Main system configuration.
 */
interface SystemConfig {
  /** Configuration identifier. */
  id: string;
  
  /** System environment. */
  environment: SystemEnvironment;
  
  /** System version. */
  version: string;
  
  /** Application name. */
  appName: string;
  
  /** Network configurations. */
  networks: NetworkConfigs;
  
  /** Database configurations. */
  database: DatabaseConfig;
  
  /** Security configurations. */
  security: SecurityConfig;
  
  /** API configurations. */
  api: APIConfig;
  
  /** Feature flags. */
  features: FeatureFlags;
  
  /** Resource limits. */
  resources: ResourceConfig;
  
  /** Monitoring configuration. */
  monitoring: SystemMonitoringConfig;
  
  /** External integrations. */
  integrations: IntegrationConfigs;
  
  /** System metadata. */
  metadata: SystemMetadata;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default system settings.
 */
const DEFAULT_SYSTEM_SETTINGS = {
  connectionTimeout: 30000,
  requestTimeout: 15000,
  maxRetries: 3,
  retryBackoff: 1000,
  defaultTTL: 3600,
  rateLimit: 100,
  maxConnections: 100,
  serverPort: 3000
} as const;

// ========================================
// EXPORTS
// ========================================

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
  CacheConfig,
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
};

export { DEFAULT_SYSTEM_SETTINGS };
