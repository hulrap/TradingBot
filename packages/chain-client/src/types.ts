import { Chain } from '@trading-bot/types';

// Transaction type for chain client
export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce: number;
  data?: string;
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  confirmations?: number;
  status?: 'pending' | 'confirmed' | 'failed';
}

// Gas estimate type
export interface GasEstimate {
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  estimatedCostUSD?: number;
}

// Connection configuration
export interface ConnectionConfig {
  rpcUrl: string;
  wsUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  rateLimitPerSecond?: number;
}

// Chain client interface
export interface ChainClient {
  chain: Chain;
  isConnected: boolean;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Transaction operations
  sendTransaction(tx: Transaction): Promise<string>;
  simulateTransaction(tx: Transaction): Promise<TransactionSimulation>;
  getTransaction(hash: string): Promise<Transaction | null>;
  waitForTransaction(hash: string, confirmations?: number): Promise<Transaction>;
  
  // Gas estimation
  estimateGas(tx: Partial<Transaction>): Promise<GasEstimate>;
  
  // Balance operations
  getBalance(address: string, tokenAddress?: string): Promise<string>;
  
  // Block operations
  getLatestBlockNumber(): Promise<number>;
  getBlock(blockNumber: number): Promise<any>;
  
  // WebSocket subscriptions
  subscribeToBlocks(callback: (block: any) => void): Promise<() => void>;
  subscribeToMempool(callback: (tx: Transaction) => void): Promise<() => void>;
}

// Transaction simulation result
export interface TransactionSimulation {
  success: boolean;
  gasUsed: string;
  gasPrice: string;
  error?: string;
  logs?: any[];
  returnData?: string;
}

// Connection pool configuration
export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}

// RPC method call
export interface RPCCall {
  method: string;
  params: any[];
  id?: string | number;
}

// RPC response
export interface RPCResponse<T = any> {
  id?: string | number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}