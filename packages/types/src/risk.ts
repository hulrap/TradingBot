import { z } from 'zod';

// Risk parameters
export const RiskParametersSchema = z.object({
  maxPositionSize: z.string(),
  maxDailyLoss: z.string(),
  stopLossPercentage: z.number().min(0).max(100),
  takeProfitPercentage: z.number().min(0).max(1000),
  maxSlippage: z.number().min(0).max(50),
  maxGasPrice: z.string(),
  volatilityThreshold: z.number().min(0).max(100)
});

export type RiskParameters = z.infer<typeof RiskParametersSchema>;

// Risk event types
export const RiskEventTypeSchema = z.enum([
  'stop_loss', 'position_limit', 'daily_limit', 'volatility_halt', 
  'gas_spike', 'slippage_exceeded', 'correlation_breach'
]);

export const RiskEventSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const RiskEventSchema = z.object({
  id: z.string().uuid(),
  botId: z.string(),
  eventType: RiskEventTypeSchema,
  severity: RiskEventSeveritySchema,
  description: z.string(),
  actionTaken: z.string().optional(),
  positionSizeBefore: z.string().optional(),
  positionSizeAfter: z.string().optional(),
  triggerValue: z.number(),
  thresholdValue: z.number(),
  createdAt: z.date()
});

export type RiskEvent = z.infer<typeof RiskEventSchema>;