import { z } from 'zod';
import { ChainSchema } from './blockchain';

// Bot types
export const BotTypeSchema = z.enum(['arbitrage', 'copy_trader', 'sandwich', 'liquidation', 'jit_liquidity', 'market_maker']);
export type BotType = z.infer<typeof BotTypeSchema>;

// Bot status
export const BotStatusSchema = z.enum(['idle', 'running', 'paused', 'error', 'stopped']);
export type BotStatus = z.infer<typeof BotStatusSchema>;

// Base bot configuration
export const BaseBotConfigSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  walletId: z.string().uuid(),
  botType: BotTypeSchema,
  name: z.string(),
  isActive: z.boolean().default(false),
  isPaperTrading: z.boolean().default(true),
  maxDailyTrades: z.number().default(100),
  maxPositionSize: z.string().optional(),
  stopLossPercentage: z.number().optional(),
  takeProfitPercentage: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type BaseBotConfig = z.infer<typeof BaseBotConfigSchema>;

// Arbitrage bot configuration
export const ArbitrageBotConfigSchema = BaseBotConfigSchema.extend({
  botType: z.literal('arbitrage'),
  configuration: z.object({
    tokenPairs: z.array(z.object({
      tokenA: z.string(),
      tokenB: z.string(),
      chains: z.array(ChainSchema)
    })),
    minProfitThreshold: z.number().min(0).max(100), // percentage
    maxSlippage: z.number().min(0).max(10), // percentage
    dexes: z.array(z.string()),
    gasMultiplier: z.number().min(1).max(3).default(1.2),
    enableMEVProtection: z.boolean().default(true)
  })
});

export type ArbitrageBotConfig = z.infer<typeof ArbitrageBotConfigSchema>;

// Copy trading bot configuration
export const CopyTradingBotConfigSchema = BaseBotConfigSchema.extend({
  botType: z.literal('copy_trader'),
  configuration: z.object({
    targetAddresses: z.array(z.object({
      address: z.string(),
      chain: ChainSchema,
      copyPercentage: z.number().min(1).max(100).default(100),
      maxCopyAmount: z.string().optional()
    })),
    copySettings: z.object({
      copyType: z.enum(['fixed_amount', 'percentage']).default('percentage'),
      fixedAmount: z.string().optional(),
      percentage: z.number().min(1).max(100).default(10)
    }),
    filters: z.object({
      minTradeSize: z.string().optional(),
      maxTradeSize: z.string().optional(),
      excludeTokens: z.array(z.string()).default([]),
      onlyVerifiedTokens: z.boolean().default(true)
    }),
    latencyOptimization: z.boolean().default(true)
  })
});

export type CopyTradingBotConfig = z.infer<typeof CopyTradingBotConfigSchema>;

// Sandwich bot configuration
export const SandwichBotConfigSchema = BaseBotConfigSchema.extend({
  botType: z.literal('sandwich'),
  configuration: z.object({
    targetDEXes: z.array(z.string()),
    minVictimTradeSize: z.string(),
    maxGasBid: z.string(),
    profitThreshold: z.number().min(0).max(100),
    mevRelays: z.array(z.string()),
    competitionAnalysis: z.boolean().default(true),
    bundleSettings: z.object({
      maxBundleSize: z.number().default(3),
      gasMultiplier: z.number().min(1).max(5).default(2)
    })
  })
});

export type SandwichBotConfig = z.infer<typeof SandwichBotConfigSchema>;

// Bot configuration union
export const BotConfigSchema = z.discriminatedUnion('botType', [
  ArbitrageBotConfigSchema,
  CopyTradingBotConfigSchema,
  SandwichBotConfigSchema
]);

export type BotConfig = z.infer<typeof BotConfigSchema>;

// Bot state
export const BotStateSchema = z.object({
  botId: z.string(),
  status: BotStatusSchema,
  lastActivity: z.date(),
  errorCount: z.number().default(0),
  lastError: z.string().optional(),
  performanceMetrics: z.object({
    totalTrades: z.number().default(0),
    successfulTrades: z.number().default(0),
    totalProfit: z.string().default('0'),
    totalLoss: z.string().default('0'),
    winRate: z.number().default(0),
    avgExecutionTime: z.number().default(0)
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type BotState = z.infer<typeof BotStateSchema>;