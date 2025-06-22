/**
 * @file Alert and Notification Types.
 * 
 * Alert system types for trading bot monitoring, notification management,
 * and alert configuration for various system events and conditions.
 * 
 * Features:
 * - Multi-channel alert delivery (email, slack, telegram, webhook)
 * - Alert severity levels and escalation
 * - Alert grouping and deduplication
 * - Alert suppression and acknowledgment
 * - Alert metrics and analytics.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { Address } from '../blockchain/addresses';
import type { SupportedChain } from '../blockchain/chain';

// ========================================
// CORE ALERT TYPES
// ========================================

/**
 * Alert unique identifier.
 */
type AlertId = string;

/**
 * Alert severity levels.
 */
type AlertSeverity = 
  | 'info'          // Informational alerts
  | 'warning'       // Warning conditions
  | 'error'         // Error conditions
  | 'critical';     // Critical system failures

/**
 * Alert categories.
 */
type AlertCategory = 
  | 'system'        // System health alerts
  | 'trading'       // Trading operation alerts
  | 'security'      // Security-related alerts
  | 'performance'   // Performance degradation
  | 'network'       // Network connectivity
  | 'gas'           // Gas price alerts
  | 'balance'       // Balance threshold alerts
  | 'arbitrage'     // Arbitrage opportunity alerts
  | 'mev'           // MEV-related alerts
  | 'liquidation'   // Liquidation alerts
  | 'slippage'      // High slippage alerts
  | 'volume'        // Volume threshold alerts
  | 'price'         // Price movement alerts
  | 'custom';       // Custom user-defined alerts

/**
 * Alert status.
 */
type AlertStatus = 
  | 'active'        // Alert is active
  | 'acknowledged'  // Alert has been acknowledged
  | 'resolved'      // Alert condition resolved
  | 'suppressed'    // Alert is suppressed
  | 'expired';      // Alert has expired

/**
 * Notification channels.
 */
type NotificationChannel = 
  | 'email'
  | 'sms'
  | 'slack'
  | 'discord'
  | 'telegram'
  | 'teams'
  | 'pagerduty'
  | 'webhook'
  | 'push'
  | 'in-app';

/**
 * Notification status.
 */
type NotificationStatus = 
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'retrying';

// ========================================
// NOTIFICATION CHANNEL CONFIGURATIONS
// ========================================

/**
 * Email notification configuration.
 */
interface EmailConfig {
  type: 'email';
  recipients: string[];
  subject?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
}

/**
 * Slack notification configuration.
 */
interface SlackConfig {
  type: 'slack';
  webhook: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
  threadTs?: string;
}

/**
 * Telegram notification configuration.
 */
interface TelegramConfig {
  type: 'telegram';
  botToken: string;
  chatId: string;
  parseMode?: 'Markdown' | 'HTML';
  disableWebPagePreview?: boolean;
}

/**
 * Webhook notification configuration.
 */
interface WebhookConfig {
  type: 'webhook';
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  timeout: number;
  retries: number;
}

/**
 * SMS notification configuration.
 */
interface SMSConfig {
  type: 'sms';
  phoneNumbers: string[];
  message?: string;
}

/**
 * PagerDuty notification configuration.
 */
interface PagerDutyConfig {
  type: 'pagerduty';
  integrationKey: string;
  eventAction: 'trigger' | 'acknowledge' | 'resolve';
  severity?: 'critical' | 'error' | 'warning' | 'info';
}

/**
 * Channel-specific configuration.
 */
type NotificationChannelConfig = 
  | EmailConfig
  | SlackConfig
  | TelegramConfig
  | WebhookConfig
  | SMSConfig
  | PagerDutyConfig;

/**
 * Notification template.
 */
interface NotificationTemplate {
  /** Template ID. */
  id: string;
  
  /** Template name. */
  name: string;
  
  /** Template content. */
  content: {
    title: string;
    body: string;
    footer?: string;
  };
  
  /** Template variables. */
  variables: string[];
  
  /** Template formatting. */
  format: 'text' | 'html' | 'markdown';
}

/**
 * Notification filters.
 */
interface NotificationFilter {
  /** Filter type. */
  type: 'severity' | 'category' | 'tag' | 'time' | 'frequency';
  
  /** Filter condition. */
  condition: string;
  
  /** Filter parameters. */
  parameters: Record<string, string | number | boolean | string[]>;
  
  /** Filter action. */
  action: 'include' | 'exclude' | 'modify';
}

/**
 * Notification configuration.
 */
interface NotificationConfig {
  /** Configuration ID. */
  id: string;
  
  /** Notification channel. */
  channel: NotificationChannel;
  
  /** Channel-specific configuration. */
  config: NotificationChannelConfig;
  
  /** Notification template. */
  template?: NotificationTemplate;
  
  /** Notification filters. */
  filters: NotificationFilter[];
  
  /** Retry configuration. */
  retry: {
    maxAttempts: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  
  /** Rate limiting. */
  rateLimit?: {
    maxPerHour: number;
    maxPerDay: number;
  };
}

// ========================================
// ALERT CORE TYPES
// ========================================

/**
 * Alert metadata.
 */
interface AlertMetadata {
  /** Alert priority for UI display. */
  priority: number;
  
  /** Alert grouping key. */
  groupKey?: string;
  
  /** Related entities. */
  entities: {
    botId?: string;
    userId?: string;
    walletAddress?: Address;
    transactionHash?: string;
    tokenAddress?: Address;
    poolAddress?: Address;
  };
  
  /** Alert metrics. */
  metrics: {
    responseTime?: number;
    affectedUsers?: number;
    estimatedImpact?: string;
    recoveryTime?: number;
  };
  
  /** Custom metadata. */
  custom: Record<string, string | number | boolean>;
}

/**
 * Alert conditions that triggered the alert.
 */
interface AlertConditions {
  /** Threshold values. */
  thresholds: Array<{
    value: number;
    threshold: number;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    unit: string;
  }>;
  
  /** Time window for evaluation. */
  timeWindow?: number;
  
  /** Required consecutive violations. */
  consecutiveViolations?: number;
  
  /** Custom condition expression. */
  expression?: string;
  
  /** Condition evaluation result. */
  result: {
    passed: boolean;
    evaluatedAt: number;
    values: Record<string, string | number | boolean>;
  };
}

/**
 * Base alert interface.
 */
interface Alert {
  /** Alert identifier. */
  id: AlertId;
  
  /** Alert title. */
  title: string;
  
  /** Alert description. */
  description: string;
  
  /** Alert category. */
  category: AlertCategory;
  
  /** Alert severity. */
  severity: AlertSeverity;
  
  /** Alert status. */
  status: AlertStatus;
  
  /** Alert source. */
  source: string;
  
  /** Related chain (if applicable). */
  chain?: SupportedChain;
  
  /** Alert tags. */
  tags: string[];
  
  /** Alert metadata. */
  metadata: AlertMetadata;
  
  /** Alert conditions. */
  conditions: AlertConditions;
  
  /** Alert timestamps. */
  timestamps: {
    created: number;
    updated: number;
    acknowledged?: number;
    resolved?: number;
    lastTriggered: number;
  };
  
  /** Alert count (for deduplicated alerts). */
  count: number;
  
  /** Alert fingerprint for deduplication. */
  fingerprint: string;
}

/**
 * Alert rule definition.
 */
interface AlertRule {
  /** Rule name. */
  name: string;
  
  /** Rule condition. */
  condition: string;
  
  /** Rule parameters. */
  parameters: Record<string, string | number | boolean | string[]>;
  
  /** Evaluation frequency. */
  frequency: number;
  
  /** Rule severity. */
  severity: AlertSeverity;
  
  /** Rule category. */
  category: AlertCategory;
  
  /** Rule tags. */
  tags: string[];
  
  /** Rule scope. */
  scope: {
    chains?: SupportedChain[];
    bots?: string[];
    users?: string[];
    addresses?: Address[];
  };
}

/**
 * Alert escalation configuration.
 */
interface AlertEscalation {
  /** Escalation level. */
  level: number;
  
  /** Time delay before escalation. */
  delay: number;
  
  /** Additional notifications. */
  notifications: NotificationConfig[];
  
  /** Escalation conditions. */
  conditions?: {
    unacknowledged?: boolean;
    stillActive?: boolean;
    severityIncrease?: boolean;
  };
}

/**
 * Alert suppression rules.
 */
interface AlertSuppression {
  /** Suppression rule ID. */
  id: string;
  
  /** Suppression condition. */
  condition: string;
  
  /** Suppression duration. */
  duration?: number;
  
  /** Suppression schedule. */
  schedule?: {
    timezone: string;
    rules: Array<{
      days: number[];
      startTime: string;
      endTime: string;
    }>;
  };
}

/**
 * Alert settings.
 */
interface AlertSettings {
  /** Deduplication window in seconds. */
  deduplicationWindow: number;
  
  /** Maximum alert frequency. */
  maxFrequency: {
    count: number;
    window: number;
  };
  
  /** Auto-resolve timeout. */
  autoResolveTimeout?: number;
  
  /** Escalation rules. */
  escalation?: AlertEscalation[];
  
  /** Suppression rules. */
  suppression?: AlertSuppression[];
  
  /** Recovery notification. */
  notifyOnRecovery: boolean;
}

// ========================================
// ALERT CONFIGURATION TYPES
// ========================================

/**
 * Alert configuration.
 */
interface AlertConfig {
  /** Configuration identifier. */
  id: string;
  
  /** Configuration name. */
  name: string;
  
  /** Configuration description. */
  description?: string;
  
  /** Alert rule. */
  rule: AlertRule;
  
  /** Notification settings. */
  notifications: NotificationConfig[];
  
  /** Alert settings. */
  settings: AlertSettings;
  
  /** Configuration metadata. */
  metadata: {
    createdBy: string;
    createdAt: number;
    updatedBy: string;
    updatedAt: number;
    version: number;
    enabled: boolean;
  };
}

/**
 * Notification record.
 */
interface Notification {
  /** Notification ID. */
  id: string;
  
  /** Related alert ID. */
  alertId: AlertId;
  
  /** Notification channel. */
  channel: NotificationChannel;
  
  /** Notification status. */
  status: NotificationStatus;
  
  /** Notification content. */
  content: {
    title: string;
    body: string;
    metadata: Record<string, string | number | boolean>;
  };
  
  /** Delivery attempts. */
  attempts: Array<{
    timestamp: number;
    status: NotificationStatus;
    error?: string;
    responseTime?: number;
  }>;
  
  /** Notification timestamps. */
  timestamps: {
    created: number;
    sent?: number;
    delivered?: number;
    failed?: number;
  };
}

// ========================================
// ALERT MANAGEMENT TYPES
// ========================================

/**
 * Alert query filter.
 */
interface AlertFilter {
  /** Alert IDs. */
  ids?: AlertId[];
  
  /** Alert status. */
  status?: AlertStatus[];
  
  /** Alert severity. */
  severity?: AlertSeverity[];
  
  /** Alert category. */
  category?: AlertCategory[];
  
  /** Alert tags. */
  tags?: string[];
  
  /** Time range. */
  timeRange?: {
    start: number;
    end: number;
  };
  
  /** Related chain. */
  chain?: SupportedChain[];
  
  /** Search query. */
  search?: string;
  
  /** Acknowledgment status. */
  acknowledged?: boolean;
  
  /** Resolution status. */
  resolved?: boolean;
}

/**
 * Alert acknowledgment.
 */
interface AlertAcknowledgment {
  /** Alert ID. */
  alertId: AlertId;
  
  /** Acknowledged by user. */
  acknowledgedBy: string;
  
  /** Acknowledgment timestamp. */
  acknowledgedAt: number;
  
  /** Acknowledgment note. */
  note?: string;
  
  /** Acknowledgment metadata. */
  metadata: Record<string, string | number | boolean>;
}

/**
 * Alert resolution.
 */
interface AlertResolution {
  /** Alert ID. */
  alertId: AlertId;
  
  /** Resolved by user. */
  resolvedBy: string;
  
  /** Resolution timestamp. */
  resolvedAt: number;
  
  /** Resolution type. */
  type: 'manual' | 'automatic' | 'timeout';
  
  /** Resolution note. */
  note?: string;
  
  /** Resolution actions taken. */
  actions?: string[];
  
  /** Resolution metadata. */
  metadata: Record<string, string | number | boolean>;
}

/**
 * Alert statistics.
 */
interface AlertStats {
  /** Statistics period. */
  period: {
    start: number;
    end: number;
  };
  
  /** Total alerts. */
  total: number;
  
  /** Alerts by status. */
  byStatus: Record<AlertStatus, number>;
  
  /** Alerts by severity. */
  bySeverity: Record<AlertSeverity, number>;
  
  /** Alerts by category. */
  byCategory: Record<AlertCategory, number>;
  
  /** Resolution metrics. */
  resolution: {
    averageTime: number;
    medianTime: number;
    autoResolved: number;
    manualResolved: number;
  };
  
  /** Top alert sources. */
  topSources: Array<{
    source: string;
    count: number;
  }>;
  
  /** Alert trends. */
  trends: Array<{
    timestamp: number;
    count: number;
    severity: Record<AlertSeverity, number>;
  }>;
}

// ========================================
// CONSTANTS
// ========================================

/**
 * Default alert settings.
 */
const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  deduplicationWindow: 300, // 5 minutes
  maxFrequency: {
    count: 10,
    window: 3600 // 1 hour
  },
  autoResolveTimeout: 86400, // 24 hours
  notifyOnRecovery: true
};

/**
 * Alert severity colors.
 */
const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: '#2196F3',
  warning: '#FF9800',
  error: '#F44336',
  critical: '#9C27B0'
};

/**
 * Alert severity priorities.
 */
const ALERT_SEVERITY_PRIORITIES: Record<AlertSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
  critical: 4
};

/**
 * Default notification retry configuration.
 */
const DEFAULT_NOTIFICATION_RETRY = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  maxDelay: 300000 // 5 minutes
};

/**
 * Notification priorities for different severity levels.
 */
const NOTIFICATION_PRIORITIES: Record<AlertSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
  critical: 4
};

// Consolidated export declaration
export type {
  AlertId,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  NotificationChannel,
  NotificationStatus,
  EmailConfig,
  SlackConfig,
  TelegramConfig,
  WebhookConfig,
  SMSConfig,
  PagerDutyConfig,
  NotificationChannelConfig,
  NotificationTemplate,
  NotificationFilter,
  NotificationConfig,
  AlertMetadata,
  AlertConditions,
  Alert,
  AlertRule,
  AlertEscalation,
  AlertSuppression,
  AlertSettings,
  AlertConfig,
  Notification,
  AlertFilter,
  AlertAcknowledgment,
  AlertResolution,
  AlertStats
};

export {
  DEFAULT_ALERT_SETTINGS,
  ALERT_SEVERITY_COLORS,
  ALERT_SEVERITY_PRIORITIES,
  DEFAULT_NOTIFICATION_RETRY,
  NOTIFICATION_PRIORITIES
};
