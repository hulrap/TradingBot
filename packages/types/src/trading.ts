import { z } from 'zod';
import { ChainSchema, DEXSchema } from './blockchain';

// Trade types
export const TradeTypeSchema = z.enum(['buy', 'sell', 'swap', 'arbitrage', 'sandwich', 'liquidation']);
export type TradeType = z.infer<typeof TradeTypeSchema>;

// Trade status
export const TradeStatusSchema = z.enum(['pending', 'confirmed', 'failed', 'cancelled']);
export type TradeStatus = z.infer<typeof TradeStatusSchema>;

// Trade execution
export const TradeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  botConfigId: z.string().uuid().optional(),
  walletId: z.string().uuid(),
  transactionHash: z.string().optional(),
  chain: ChainSchema,
  tradeType: TradeTypeSchema,
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.string(),
  amountOut: z.string(),
  gasUsed: z.string().optional(),
  gasPrice: z.string().optional(),
  profitLoss: z.string().optional(),
  profitLossUSD: z.number().optional(),
  slippage: z.number().optional(),
  dex: DEXSchema.optional(),
  isPaperTrade: z.boolean().default(false),
  executedAt: z.date(),
  createdAt: z.date()
});

export type Trade = z.infer<typeof TradeSchema>;

// Quote/Price data
export const QuoteSchema = z.object({
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.string(),
  amountOut: z.string(),
  price: z.number(),
  priceImpact: z.number(),
  gasEstimate: z.string(),
  route: z.array(z.object({
    dex: DEXSchema,
    percentage: z.number()
  })),
  validUntil: z.date()
});

export type Quote = z.infer<typeof QuoteSchema>;

// Arbitrage opportunity
export const ArbitrageOpportunitySchema = z.object({
  id: z.string(),
  tokenPair: z.string(),
  dexA: DEXSchema,
  dexB: DEXSchema,
  priceA: z.number(),
  priceB: z.number(),
  profitPotential: z.number(),
  profitAfterGas: z.number(),
  gasEstimate: z.string(),
  discoveredAt: z.date(),
  expiresAt: z.date()
});

export type ArbitrageOpportunity = z.infer<typeof ArbitrageOpportunitySchema>;

// Trading pair
export const TradingPairSchema = z.object({
  tokenA: z.string(),
  tokenB: z.string(),
  chain: ChainSchema,
  dex: DEXSchema,
  liquidity: z.string(),
  volume24h: z.string(),
  fee: z.number(),
  isActive: z.boolean().default(true)
});

export type TradingPair = z.infer<typeof TradingPairSchema>;

// Market data
export const MarketDataSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  priceChange24h: z.number(),
  volume24h: z.string(),
  marketCap: z.string().optional(),
  liquidity: z.string().optional(),
  timestamp: z.date()
});

export type MarketData = z.infer<typeof MarketDataSchema>;

// Order book
export const OrderBookEntrySchema = z.object({
  price: z.number(),
  amount: z.string(),
  total: z.string()
});

export const OrderBookSchema = z.object({
  symbol: z.string(),
  bids: z.array(OrderBookEntrySchema),
  asks: z.array(OrderBookEntrySchema),
  timestamp: z.date()
});

export type OrderBookEntry = z.infer<typeof OrderBookEntrySchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;