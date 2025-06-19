import { z } from 'zod';

// ... existing schemas ...

// Enhanced Arbitrage Bot Configuration Schema
export const ArbitrageBotConfigSchema = z.object({
  name: z.string().min(1, 'Bot name is required'),
  enabled: z.boolean(),
  chains: z.array(z.string()).min(1, 'At least one chain is required'),
  tokenPairs: z.array(z.object({
    tokenA: z.string().min(1, 'Token A is required'),
    tokenASymbol: z.string().min(1, 'Token A symbol is required'),
    tokenB: z.string().min(1, 'Token B is required'),
    tokenBSymbol: z.string().min(1, 'Token B symbol is required'),
    minLiquidity: z.string().min(1, 'Minimum liquidity is required'),
    enabled: z.boolean()
  })).min(1, 'At least one token pair is required'),
  minProfitPercentage: z.number().min(0.1).max(100),
  maxSlippage: z.number().min(0.1).max(100),
  gasSettings: z.object({
    maxGasPrice: z.string().min(1, 'Max gas price is required'),
    priorityFee: z.string().min(0, 'Priority fee must be positive'),
    gasLimit: z.string().min(1, 'Gas limit is required')
  }),
  riskParams: z.object({
    maxPositionSize: z.string().min(1, 'Max position size is required'),
    maxDailyLoss: z.string().min(1, 'Max daily loss is required'),
    stopLossPercentage: z.number().min(0).max(100),
    takeProfitPercentage: z.number().min(0).max(100),
    maxConcurrentTrades: z.number().min(1).max(10),
    cooldownPeriod: z.number().min(0, 'Cooldown period must be positive')
  })
});

// ... existing code ...