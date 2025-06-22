/**
 * @file Orchestration and Coordination Types
 * 
 * Service registry, event coordination, lifecycle management, and
 * inter-service communication types for the orchestrator package.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { BotConfig } from '../config/bot-configs';

// ========================================
// CORE ORCHESTRATION TYPES
// ========================================

/**
 * Service identifier.
 */
type ServiceId = string;

/**
 * Service types in the trading bot ecosystem.
 */
type ServiceType = 
  | 'connections'
  | 'data-sources'
  | 'processing'
  | 'routing'
  | 'dex-integration'
  | 'execution'
  | 'monitoring'
  | 'orchestrator'
  | 'bot-instance'
  | 'custom';

/**
 * Service status enumeration.
 */
type ServiceStatus = 
  | 'starting'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'maintenance';

/**
 * Service health status.
 */
type ServiceHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Event types for inter-service communication.
 */
type SystemEventType = 
  | 'service.started'
  | 'service.stopped'
  | 'service.health.changed'
  | 'service.error'
  | 'data.received'
  | 'data.processed'
  | 'trade.executed'
  | 'opportunity.detected'
  | 'alert.triggered'
  | 'configuration.changed'
  | 'system.shutdown'
  | 'custom';

// ========================================
// SERVICE REGISTRY TYPES
// ========================================

/**
 * Service endpoint configuration.
 */
interface ServiceEndpoint {
  /** Endpoint type. */
  type: 'http' | 'websocket' | 'grpc' | 'tcp' | 'ipc';
  
  /** Endpoint address. */
  address: string;
  
  /** Port number. */
  port: number;
  
  /** Protocol version. */
  version: string;
  
  /** Security configuration. */
  security?: {
    tls: boolean;
    certificate?: string;
    authentication: boolean;
  };
  
  /** Health check endpoint. */
  healthCheck?: {
    path: string;
    method: 'GET' | 'POST';
    timeout: number;
    interval: number;
  };
}

/**
 * Service capabilities and features.
 */
interface ServiceCapabilities {
  /** Supported chains. */
  chains: SupportedChain[];
  
  /** Supported operations. */
  operations: string[];
  
  /** API methods available. */
  methods: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    returnType: string;
  }>;
  
  /** Event types the service can emit. */
  events: SystemEventType[];
  
  /** Event types the service can handle. */
  handlers: SystemEventType[];
  
  /** Service dependencies. */
  dependencies: ServiceId[];
  
  /** Optional services. */
  optionalDependencies?: ServiceId[];
}

/**
 * Service configuration and metadata.
 */
interface ServiceRegistration {
  /** Service identifier. */
  id: ServiceId;
  
  /** Service name. */
  name: string;
  
  /** Service type. */
  type: ServiceType;
  
  /** Service version. */
  version: string;
  
  /** Service description. */
  description?: string;
  
  /** Service endpoints. */
  endpoints: ServiceEndpoint[];
  
  /** Service capabilities. */
  capabilities: ServiceCapabilities;
  
  /** Resource requirements. */
  resources: {
    /** Memory requirement in MB. */
    memory: number;
    
    /** CPU requirement in cores. */
    cpu: number;
    
    /** Disk requirement in MB. */
    disk: number;
    
    /** Network bandwidth in Mbps. */
    bandwidth?: number;
  };
  
  /** Configuration parameters. */
  config: Record<string, unknown>;
  
  /** Service metadata. */
  metadata: {
    /** Registration timestamp. */
    registeredAt: number;
    
    /** Last heartbeat. */
    lastHeartbeat: number;
    
    /** Service tags. */
    tags: string[];
    
    /** Environment. */
    environment: 'development' | 'staging' | 'production';
  };
}

/**
 * Service discovery query.
 */
interface ServiceDiscoveryQuery {
  /** Service type filter. */
  type?: ServiceType;
  
  /** Service name filter. */
  name?: string;
  
  /** Required capabilities. */
  capabilities?: Partial<ServiceCapabilities>;
  
  /** Health status filter. */
  health?: ServiceHealth[];
  
  /** Tag filters. */
  tags?: string[];
  
  /** Chain support filter. */
  chains?: SupportedChain[];
  
  /** Maximum results. */
  limit?: number;
}

// ========================================
// EVENT COORDINATION TYPES
// ========================================

/**
 * System event structure.
 */
interface SystemEvent {
  /** Event identifier. */
  id: string;
  
  /** Event type. */
  type: SystemEventType;
  
  /** Event source service. */
  source: ServiceId;
  
  /** Event timestamp. */
  timestamp: number;
  
  /** Event data payload. */
  data: Record<string, unknown>;
  
  /** Event metadata. */
  metadata: {
    /** Event version. */
    version: string;
    
    /** Correlation ID for tracking. */
    correlationId?: string;
    
    /** Event priority. */
    priority: 'low' | 'normal' | 'high' | 'critical';
    
    /** Event TTL. */
    ttl?: number;
    
    /** Event tags. */
    tags: string[];
  };
  
  /** Delivery tracking. */
  delivery?: {
    /** Delivery attempts. */
    attempts: number;
    
    /** Last delivery attempt. */
    lastAttempt: number;
    
    /** Delivery status. */
    status: 'pending' | 'delivered' | 'failed' | 'expired';
  };
}

/**
 * Event subscription configuration.
 */
interface EventSubscription {
  /** Subscription identifier. */
  id: string;
  
  /** Subscriber service. */
  subscriber: ServiceId;
  
  /** Event types to subscribe to. */
  eventTypes: SystemEventType[];
  
  /** Event filters. */
  filters?: {
    /** Source service filter. */
    source?: ServiceId[];
    
    /** Data filters. */
    dataFilters?: Record<string, unknown>;
    
    /** Tag filters. */
    tags?: string[];
  };
  
  /** Delivery configuration. */
  delivery: {
    /** Delivery method. */
    method: 'push' | 'pull';
    
    /** Delivery endpoint. */
    endpoint?: string;
    
    /** Batch delivery. */
    batch?: {
      enabled: boolean;
      maxSize: number;
      timeoutMs: number;
    };
    
    /** Retry configuration. */
    retry: {
      maxAttempts: number;
      backoffMs: number;
    };
  };
  
  /** Subscription metadata. */
  metadata: {
    /** Creation timestamp. */
    createdAt: number;
    
    /** Subscription status. */
    status: 'active' | 'paused' | 'cancelled';
    
    /** Message count. */
    messageCount: number;
  };
}

/**
 * Event routing configuration.
 */
interface EventRouter {
  /** Router identifier. */
  id: string;
  
  /** Routing rules. */
  rules: Array<{
    /** Rule name. */
    name: string;
    
    /** Rule condition. */
    condition: string;
    
    /** Target services. */
    targets: ServiceId[];
    
    /** Rule priority. */
    priority: number;
    
    /** Rule enabled. */
    enabled: boolean;
  }>;
  
  /** Default routing. */
  default: {
    /** Default targets. */
    targets: ServiceId[];
    
    /** Broadcast to all. */
    broadcast: boolean;
  };
  
  /** Router configuration. */
  config: {
    /** Enable dead letter queue. */
    deadLetterQueue: boolean;
    
    /** Maximum routing attempts. */
    maxAttempts: number;
    
    /** Routing timeout. */
    timeout: number;
  };
}

// ========================================
// LIFECYCLE MANAGEMENT TYPES
// ========================================

/**
 * Service lifecycle state.
 */
interface ServiceLifecycle {
  /** Service identifier. */
  serviceId: ServiceId;
  
  /** Current status. */
  status: ServiceStatus;
  
  /** Current health. */
  health: ServiceHealth;
  
  /** Lifecycle timestamps. */
  timestamps: {
    /** Service started. */
    started?: number;
    
    /** Service ready. */
    ready?: number;
    
    /** Last health check. */
    lastHealthCheck?: number;
    
    /** Last status change. */
    lastStatusChange: number;
  };
  
  /** Restart count. */
  restartCount: number;
  
  /** Error information. */
  error?: {
    /** Error code. */
    code: string;
    
    /** Error message. */
    message: string;
    
    /** Error timestamp. */
    timestamp: number;
    
    /** Recovery attempts. */
    recoveryAttempts: number;
  };
  
  /** Performance metrics. */
  metrics: {
    /** Uptime in seconds. */
    uptime: number;
    
    /** CPU usage percentage. */
    cpuUsage: number;
    
    /** Memory usage in MB. */
    memoryUsage: number;
    
    /** Request count. */
    requestCount: number;
    
    /** Error count. */
    errorCount: number;
  };
}

/**
 * Service startup configuration.
 */
interface ServiceStartupConfig {
  /** Service to start. */
  serviceId: ServiceId;
  
  /** Startup parameters. */
  parameters: Record<string, unknown>;
  
  /** Dependency requirements. */
  dependencies: {
    /** Required services. */
    required: ServiceId[];
    
    /** Optional services. */
    optional: ServiceId[];
    
    /** Wait for dependencies. */
    waitForDependencies: boolean;
    
    /** Dependency timeout. */
    dependencyTimeout: number;
  };
  
  /** Health check configuration. */
  healthCheck: {
    /** Initial delay. */
    initialDelay: number;
    
    /** Check interval. */
    interval: number;
    
    /** Timeout per check. */
    timeout: number;
    
    /** Failure threshold. */
    failureThreshold: number;
  };
  
  /** Restart policy. */
  restart: {
    /** Restart on failure. */
    enabled: boolean;
    
    /** Maximum restart attempts. */
    maxAttempts: number;
    
    /** Restart delay. */
    delay: number;
    
    /** Exponential backoff. */
    backoffMultiplier: number;
  };
}

// ========================================
// COORDINATION WORKFLOW TYPES
// ========================================

/**
 * Workflow step configuration.
 */
interface WorkflowStep {
  /** Step identifier. */
  id: string;
  
  /** Step name. */
  name: string;
  
  /** Target service. */
  service: ServiceId;
  
  /** Operation to execute. */
  operation: string;
  
  /** Step parameters. */
  parameters: Record<string, unknown>;
  
  /** Step dependencies. */
  dependencies: string[];
  
  /** Execution configuration. */
  execution: {
    /** Timeout. */
    timeout: number;
    
    /** Retry policy. */
    retry: {
      maxAttempts: number;
      backoffMs: number;
    };
    
    /** Parallel execution. */
    parallel: boolean;
  };
  
  /** Error handling. */
  errorHandling: {
    /** Continue on error. */
    continueOnError: boolean;
    
    /** Rollback action. */
    rollbackAction?: string;
    
    /** Error callback. */
    onError?: string;
  };
}

/**
 * Coordination workflow configuration.
 */
interface CoordinationWorkflow {
  /** Workflow identifier. */
  id: string;
  
  /** Workflow name. */
  name: string;
  
  /** Workflow description. */
  description?: string;
  
  /** Workflow steps. */
  steps: WorkflowStep[];
  
  /** Workflow triggers. */
  triggers: Array<{
    /** Trigger type. */
    type: 'event' | 'schedule' | 'manual';
    
    /** Trigger configuration. */
    config: Record<string, unknown>;
  }>;
  
  /** Workflow configuration. */
  config: {
    /** Maximum execution time. */
    maxExecutionTime: number;
    
    /** Rollback on failure. */
    rollbackOnFailure: boolean;
    
    /** Enable monitoring. */
    enableMonitoring: boolean;
  };
  
  /** Workflow metadata. */
  metadata: {
    /** Creation timestamp. */
    createdAt: number;
    
    /** Last execution. */
    lastExecution?: number;
    
    /** Execution count. */
    executionCount: number;
    
    /** Success count. */
    successCount: number;
  };
}

/**
 * Workflow execution result.
 */
interface WorkflowExecutionResult {
  /** Execution identifier. */
  executionId: string;
  
  /** Workflow identifier. */
  workflowId: string;
  
  /** Execution status. */
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  
  /** Start time. */
  startTime: number;
  
  /** End time. */
  endTime?: number;
  
  /** Step results. */
  steps: Array<{
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: number;
    endTime?: number;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  
  /** Execution output. */
  output: Record<string, unknown>;
  
  /** Execution errors. */
  errors: Array<{
    stepId: string;
    error: string;
    timestamp: number;
  }>;
}

// ========================================
// MONITORING AND HEALTH TYPES
// ========================================

/**
 * System health overview.
 */
interface SystemHealth {
  /** Overall system status. */
  status: ServiceHealth;
  
  /** System timestamp. */
  timestamp: number;
  
  /** Service health details. */
  services: Array<{
    serviceId: ServiceId;
    status: ServiceStatus;
    health: ServiceHealth;
    uptime: number;
    lastCheck: number;
  }>;
  
  /** System metrics. */
  metrics: {
    /** Total services. */
    totalServices: number;
    
    /** Healthy services. */
    healthyServices: number;
    
    /** Average uptime. */
    averageUptime: number;
    
    /** Total requests. */
    totalRequests: number;
    
    /** Error rate. */
    errorRate: number;
  };
  
  /** System warnings. */
  warnings: Array<{
    code: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
  }>;
}

/**
 * Orchestrator configuration.
 */
interface OrchestratorConfig {
  /** System settings. */
  system: {
    /** Enable auto-recovery. */
    autoRecovery: boolean;
    
    /** Health check interval. */
    healthCheckInterval: number;
    
    /** Service timeout. */
    serviceTimeout: number;
    
    /** Maximum concurrent workflows. */
    maxConcurrentWorkflows: number;
  };
  
  /** Event system settings. */
  events: {
    /** Event buffer size. */
    bufferSize: number;
    
    /** Event TTL. */
    eventTtl: number;
    
    /** Enable event persistence. */
    persistence: boolean;
  };
  
  /** Service discovery settings. */
  discovery: {
    /** Discovery interval. */
    interval: number;
    
    /** Service TTL. */
    serviceTtl: number;
    
    /** Enable caching. */
    caching: boolean;
  };
  
  /** Security settings. */
  security: {
    /** Enable authentication. */
    authentication: boolean;
    
    /** Enable authorization. */
    authorization: boolean;
    
    /** API keys. */
    apiKeys: Record<string, string>;
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  ServiceId,
  ServiceType,
  ServiceStatus,
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
  SystemHealth,
  OrchestratorConfig
}; 