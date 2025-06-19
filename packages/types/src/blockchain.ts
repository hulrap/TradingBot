import { z } from 'zod';

// Supported chains
export const ChainSchema = z.enum(['ethereum', 'bsc', 'solana', 'polygon', 'arbitrum', 'optimism']);
export type Chain = z.infer<typeof ChainSchema>;

// Chain configuration
export const ChainConfigSchema = z.object({
  id: z.number(),
  name: ChainSchema,
  displayName: z.string(),
  rpcUrl: z.string().url(),
  wsUrl: z.string().url().optional(),
  blockExplorer: z.string().url(),
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number()
  }),
  isTestnet: z.boolean().default(false)
});

export type ChainConfig = z.infer<typeof ChainConfigSchema>;

// Wallet types
export const WalletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  address: z.string(),
  chain: ChainSchema,
  encryptedPrivateKey: z.string(),
  walletType: z.enum(['imported', 'generated']).default('imported'),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type Wallet = z.infer<typeof WalletSchema>;

// Token types
export const TokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number(),
  chain: ChainSchema,
  logoUri: z.string().url().optional(),
  coingeckoId: z.string().optional(),
  isVerified: z.boolean().default(false)
});

export type Token = z.infer<typeof TokenSchema>;

// Transaction types
export const TransactionSchema = z.object({
  hash: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  gasLimit: z.string(),
  gasPrice: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
  nonce: z.number(),
  data: z.string().optional(),
  blockNumber: z.number().optional(),
  blockHash: z.string().optional(),
  transactionIndex: z.number().optional(),
  confirmations: z.number().optional(),
  status: z.enum(['pending', 'confirmed', 'failed']).optional()
});

export type Transaction = z.infer<typeof TransactionSchema>;

// Gas estimation
export const GasEstimateSchema = z.object({
  gasLimit: z.string(),
  gasPrice: z.string().optional(),
  maxFeePerGas: z.string().optional(),
  maxPriorityFeePerGas: z.string().optional(),
  estimatedCost: z.string(),
  estimatedCostUSD: z.number().optional()
});

export type GasEstimate = z.infer<typeof GasEstimateSchema>;

// Block information
export const BlockSchema = z.object({
  number: z.number(),
  hash: z.string(),
  parentHash: z.string(),
  timestamp: z.number(),
  gasLimit: z.string(),
  gasUsed: z.string(),
  baseFeePerGas: z.string().optional(),
  transactions: z.array(z.string()),
  miner: z.string().optional(),
  difficulty: z.string().optional()
});

export type Block = z.infer<typeof BlockSchema>;

// DEX types
export const DEXSchema = z.enum([
  'uniswap_v2', 'uniswap_v3', 'sushiswap', 'pancakeswap',
  'jupiter', 'raydium', 'orca', 'serum',
  '1inch', 'paraswap', 'kyber', 'balancer'
]);

export type DEX = z.infer<typeof DEXSchema>;

export const DEXConfigSchema = z.object({
  name: DEXSchema,
  chain: ChainSchema,
  factoryAddress: z.string().optional(),
  routerAddress: z.string().optional(),
  quoterAddress: z.string().optional(),
  fee: z.number(), // in basis points
  isActive: z.boolean().default(true)
});

export type DEXConfig = z.infer<typeof DEXConfigSchema>;