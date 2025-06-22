/**
 * @file Trading Bot Health Monitoring Types.
 * @package @trading-bot/types
 */

// ========================================
// HEALTH STATUS TYPES
// ========================================

/**
 * Health status levels.
 */
type HealthStatus = 
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

/**
 * Health check types.
 */
type HealthCheckType = 
  | 'database'
  | 'redis'
  | 'api'
  | 'network'
  | 'memory'
  | 'disk'
  | 'custom';

/**
 * Service status.
 */
type ServiceStatus = 
  | 'online'
  | 'offline'
  | 'starting'
  | 'stopping'
  | 'error';

// ========================================
// HEALTH CHECK TYPES
// ========================================

/**
 * Health check configuration.
 */
interface HealthCheck {
  /** Check identifier. */
  id: string;
  
  /** Check name. */
  name: string;
  
  /** Check type. */
  type: HealthCheckType;
  
  /** Check interval in seconds. */
  interval: number;
  
  /** Check timeout in milliseconds. */
  timeout: number;
  
  /** Retry configuration. */
  retries: {
    maxAttempts: number;
    delay: number;
  };
  
  /** Check parameters. */
  parameters: Record<string, unknown>;
  
  /** Check enabled status. */
  enabled: boolean;
}

/**
 * Health check result.
 */
interface HealthCheckResult {
  /** Check identifier. */
  checkId: string;
  
  /** Check name. */
  name: string;
  
  /** Health status. */
  status: HealthStatus;
  
  /** Check timestamp. */
  timestamp: number;
  
  /** Response time in milliseconds. */
  responseTime: number;
  
  /** Check message. */
  message: string;
  
  /** Error details if any. */
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  
  /** Additional metadata. */
  metadata: Record<string, unknown>;
}

/**
 * Component health status.
 */
interface ComponentHealth {
  /** Component name. */
  name: string;
  
  /** Component status. */
  status: HealthStatus;
  
  /** Component checks. */
  checks: HealthCheckResult[];
  
  /** Overall response time. */
  responseTime: number;
  
  /** Last updated timestamp. */
  lastUpdated: number;
  
  /** Component dependencies. */
  dependencies: string[];
}

/**
 * System health overview.
 */
interface SystemHealth {
  /** Overall system status. */
  status: HealthStatus;
  
  /** System timestamp. */
  timestamp: number;
  
  /** System uptime in seconds. */
  uptime: number;
  
  /** Component health statuses. */
  components: ComponentHealth[];
  
  /** System metrics. */
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    activeConnections: number;
  };
  
  /** Health summary. */
  summary: {
    totalChecks: number;
    healthyChecks: number;
    degradedChecks: number;
    unhealthyChecks: number;
  };
}

/**
 * Health monitoring configuration.
 */
interface HealthMonitorConfig {
  /** Monitoring enabled. */
  enabled: boolean;
  
  /** Global check interval. */
  globalInterval: number;
  
  /** Health checks to perform. */
  checks: HealthCheck[];
  
  /** Alert configuration. */
  alerts: {
    enabled: boolean;
    webhookUrl?: string;
    emailRecipients?: string[];
    slackChannel?: string;
  };
  
  /** History retention. */
  retention: {
    maxResults: number;
    maxAge: number;
  };
}

/**
 * Health alert configuration.
 */
interface HealthAlert {
  /** Alert identifier. */
  id: string;
  
  /** Alert name. */
  name: string;
  
  /** Trigger conditions. */
  conditions: {
    status: HealthStatus[];
    component?: string;
    checkType?: HealthCheckType;
    consecutive: number;
  };
  
  /** Alert channels. */
  channels: Array<{
    type: 'email' | 'slack' | 'webhook';
    config: Record<string, unknown>;
  }>;
  
  /** Alert enabled status. */
  enabled: boolean;
}

/**
 * Dependency health information.
 */
interface DependencyHealth {
  /** Dependency name. */
  name: string;
  
  /** Dependency type. */
  type: 'database' | 'api' | 'service' | 'cache' | 'queue';
  
  /** Dependency status. */
  status: ServiceStatus;
  
  /** Connection details. */
  connection: {
    url?: string;
    host?: string;
    port?: number;
    connected: boolean;
    lastConnected?: number;
  };
  
  /** Performance metrics. */
  metrics: {
    latency: number;
    errorRate: number;
    throughput: number;
  };
  
  /** Health check results. */
  healthCheck: HealthCheckResult;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default health check intervals.
 */
const HEALTH_CHECK_INTERVALS = {
  FAST: 10,      // 10 seconds
  NORMAL: 30,    // 30 seconds
  SLOW: 60,      // 1 minute
  EXTENDED: 300  // 5 minutes
} as const;

/**
 * Health status thresholds.
 */
const HEALTH_THRESHOLDS = {
  RESPONSE_TIME: {
    HEALTHY: 100,      // ms
    DEGRADED: 500,     // ms
    UNHEALTHY: 2000    // ms
  },
  ERROR_RATE: {
    HEALTHY: 0.01,     // 1%
    DEGRADED: 0.05,    // 5%
    UNHEALTHY: 0.10    // 10%
  },
  CPU_USAGE: {
    HEALTHY: 0.70,     // 70%
    DEGRADED: 0.85,    // 85%
    UNHEALTHY: 0.95    // 95%
  },
  MEMORY_USAGE: {
    HEALTHY: 0.70,     // 70%
    DEGRADED: 0.85,    // 85%
    UNHEALTHY: 0.95    // 95%
  }
} as const;

// Consolidated export declaration
export type {
  HealthStatus,
  HealthCheckType,
  ServiceStatus,
  HealthCheck,
  HealthCheckResult,
  ComponentHealth,
  SystemHealth,
  HealthMonitorConfig,
  HealthAlert,
  DependencyHealth
};

export {
  HEALTH_CHECK_INTERVALS,
  HEALTH_THRESHOLDS
}; 