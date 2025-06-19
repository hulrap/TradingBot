import { z } from 'zod';

// MEV opportunity types
export const MEVOpportunityTypeSchema = z.enum(['sandwich', 'arbitrage', 'liquidation', 'jit_liquidity']);
export type MEVOpportunityType = z.infer<typeof MEVOpportunityTypeSchema>;

// Bundle transaction
export const BundleTransactionSchema = z.object({
  to: z.string(),
  data: z.string(),
  value: z.string().default('0'),
  gasLimit: z.string(),
  gasPrice: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional()
});

export type BundleTransaction = z.infer<typeof BundleTransactionSchema>;

// MEV bundle
export const MEVBundleSchema = z.object({
  id: z.string(),
  transactions: z.array(BundleTransactionSchema),
  blockNumber: z.number(),
  minTimestamp: z.number().optional(),
  maxTimestamp: z.number().optional(),
  revertingTxHashes: z.array(z.string()).optional()
});

export type MEVBundle = z.infer<typeof MEVBundleSchema>;

// Flashbots bundle
export const FlashbotsBundleSchema = z.object({
  txs: z.array(z.string()),
  blockNumber: z.string(),
  minTimestamp: z.number().optional(),
  maxTimestamp: z.number().optional(),
  revertingTxHashes: z.array(z.string()).optional()
});

export type FlashbotsBundle = z.infer<typeof FlashbotsBundleSchema>;

// MEV opportunity
export const MEVOpportunitySchema = z.object({
  id: z.string(),
  botId: z.string(),
  opportunityType: MEVOpportunityTypeSchema,
  targetTransaction: z.string().optional(),
  bundleTransactions: z.array(BundleTransactionSchema),
  estimatedProfit: z.string(),
  gasBid: z.string(),
  competitionLevel: z.number().min(1).max(10).default(1),
  isSubmitted: z.boolean().default(false),
  isSuccessful: z.boolean().default(false),
  actualProfit: z.string().optional(),
  discoveredAt: z.date(),
  submittedAt: z.date().optional(),
  confirmedAt: z.date().optional()
});

export type MEVOpportunity = z.infer<typeof MEVOpportunitySchema>;