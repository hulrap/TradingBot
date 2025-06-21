// Re-export all types from the main types package
export * from '@trading-bot/types';

// Re-export bot-specific types and schemas
export * from '@trading-bot/types/src/bot';

// Frontend-specific type extensions and display types
// These are specific to the frontend UI and don't conflict with database types

/**
 * Frontend-specific performance metrics for dashboard display
 * Extended with UI-specific formatting and display properties
 */
export interface FrontendPerformanceMetrics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  winRate: number;
  totalProfitLoss: number;
  totalGasFees: number;
  netProfit: number;
  totalReturn: number;
  avgProfitPerTrade: number;
  avgTradeSize: number;
  // Frontend-specific display properties
  displayCurrency: 'USD' | 'EUR' | 'BTC' | 'ETH';
  lastUpdated: string;
  dataQuality: 'real-time' | 'cached' | 'stale';
}

/**
 * Frontend-specific risk metrics for risk dashboard
 * Extended with UI-specific calculations and alerts
 */
export interface FrontendRiskMetrics {
  volatility: number;
  var95: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  avgReturn: number;
  totalReturn: number;
  bestTrade: number;
  worstTrade: number;
  winRate: number;
  // Frontend-specific risk display properties
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  alertsActive: boolean;
  riskScore: number; // 0-100
  recommendations: string[];
  lastRiskAssessment: string;
}

/**
 * Frontend-specific trade display interface for UI components
 * Optimized for table and list displays with formatted values
 */
export interface FrontendTradeDisplay {
  id: string;
  txHash: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  botName: string;
  botType: string;
  chain: string;
  tokenPair: string; // Formatted as "TOKEN1/TOKEN2"
  amountIn: string; // Formatted for display
  amountOut: string; // Formatted for display
  profitLoss: {
    value: number;
    formatted: string;
    color: 'green' | 'red' | 'gray';
  };
  gasFee: {
    value: number;
    formatted: string;
  };
  executedAt: string; // Formatted timestamp
  duration?: string; // Human-readable duration
  // UI-specific properties
  isExpandable: boolean;
  hasDetails: boolean;
  errorMessage?: string;
}

/**
 * Frontend-specific bot status for dashboard cards
 */
export interface FrontendBotStatus {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error' | 'paused';
  uptime: string;
  lastActivity: string;
  performance: {
    trades24h: number;
    profit24h: number;
    successRate: number;
  };
  health: {
    score: number; // 0-100
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  };
  // UI-specific properties
  chartData: Array<{ timestamp: number; value: number }>;
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  canStart: boolean;
  canStop: boolean;
  canEdit: boolean;
}

/**
 * Frontend notification system types
 */
export interface FrontendNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  isImportant: boolean;
  actionUrl?: string;
  actionLabel?: string;
  // Auto-dismiss configuration
  autoDismiss: boolean;
  dismissAfter?: number; // milliseconds
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  type: 'performance' | 'trades' | 'bots' | 'portfolio' | 'chart';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  config: Record<string, any>;
  isVisible: boolean;
  canResize: boolean;
  canMove: boolean;
}

/**
 * Form validation states for bot configuration
 */
export interface FormFieldState {
  value: any;
  error?: string;
  warning?: string;
  touched: boolean;
  isValid: boolean;
}

export interface FormState {
  fields: Record<string, FormFieldState>;
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  errors: string[];
}

/**
 * Theme and UI preferences
 */
export interface UITheme {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable' | 'spacious';
  animations: boolean;
  reducedMotion: boolean;
}

/**
 * Chart data types for various UI components
 */
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  volume?: number;
  label?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color: string;
  type: 'line' | 'area' | 'bar' | 'candlestick';
}

export interface ChartConfig {
  series: ChartSeries[];
  timeframe: '1h' | '24h' | '7d' | '30d' | '1y';
  yAxisType: 'linear' | 'logarithmic';
  showVolume: boolean;
  showGrid: boolean;
  showLegend: boolean;
} 