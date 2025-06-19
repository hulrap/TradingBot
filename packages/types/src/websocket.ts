import { z } from 'zod';

// WebSocket message types
export const WSMessageTypeSchema = z.enum([
  'trade_executed', 'bot_status', 'price_update', 'alert', 
  'error', 'connection_status', 'heartbeat'
]);

export type WSMessageType = z.infer<typeof WSMessageTypeSchema>;

// WebSocket message
export const WSMessageSchema = z.object({
  type: WSMessageTypeSchema,
  data: z.any(),
  timestamp: z.date(),
  id: z.string().optional()
});

export type WSMessage = z.infer<typeof WSMessageSchema>;

// Connection status
export const ConnectionStatusSchema = z.enum(['connecting', 'connected', 'disconnected', 'error', 'reconnecting']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

// WebSocket connection info
export const WSConnectionSchema = z.object({
  id: z.string(),
  botId: z.string(),
  connectionType: z.enum(['rpc', 'dex_data', 'mempool', 'price_feed']),
  endpoint: z.string(),
  status: ConnectionStatusSchema,
  lastMessageAt: z.date().optional(),
  reconnectCount: z.number().default(0),
  errorCount: z.number().default(0),
  lastError: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type WSConnection = z.infer<typeof WSConnectionSchema>;