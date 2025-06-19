import { z } from 'zod';

// Performance metrics
export const PerformanceMetricsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  botConfigId: z.string().uuid(),
  date: z.date(),
  totalTrades: z.number().default(0),
  successfulTrades: z.number().default(0),
  totalVolume: z.string().default('0'),
  totalProfitLoss: z.string().default('0'),
  totalProfitLossUSD: z.number().default(0),
  maxDrawdown: z.number().default(0),
  sharpeRatio: z.number().optional(),
  winRate: z.number().default(0),
  averageTradeSize: z.string().default('0'),
  createdAt: z.date()
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// Alert types
export const AlertTypeSchema = z.enum(['trade_executed', 'profit_target', 'stop_loss', 'error', 'system']);
export const AlertSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export const AlertSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  botConfigId: z.string().uuid().optional(),
  alertType: AlertTypeSchema,
  title: z.string(),
  message: z.string(),
  severity: AlertSeveritySchema.default('info'),
  isRead: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date()
});

export type Alert = z.infer<typeof AlertSchema>;

// API key management
export const APIKeySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  serviceName: z.string(),
  encryptedApiKey: z.string(),
  encryptedSecretKey: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type APIKey = z.infer<typeof APIKeySchema>;

// Database connection types
export const DatabaseConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  database: z.string(),
  username: z.string(),
  password: z.string(),
  ssl: z.boolean().default(true),
  maxConnections: z.number().default(10)
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;