import { EventEmitter } from 'eventemitter3';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import axios, { AxiosInstance } from 'axios';
import { Chain } from '@trading-bot/types';
import { 
  ChainClient, 
  ConnectionConfig, 
  Transaction, 
  GasEstimate, 
  TransactionSimulation, 
  RPCCall, 
  RPCResponse 
} from './types';

export abstract class BaseChainClient extends EventEmitter implements ChainClient {
  public readonly chain: Chain;
  public isConnected = false;
  
  protected config: ConnectionConfig;
  protected httpClient: AxiosInstance;
  protected requestQueue: PQueue;
  protected connectionRetries = 0;
  
  constructor(chain: Chain, config: ConnectionConfig) {
    super();
    this.chain = chain;
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      rateLimitPerSecond: 10,
      ...config
    };
    
    this.httpClient = axios.create({
      baseURL: this.config.rpcUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    this.requestQueue = new PQueue({
      intervalCap: this.config.rateLimitPerSecond,
      interval: 1000,
      concurrency: 5
    });
    
    this.setupErrorHandling();
  }
  
  // Abstract methods that must be implemented by chain-specific clients
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendTransaction(tx: Transaction): Promise<string>;
  abstract simulateTransaction(tx: Transaction): Promise<TransactionSimulation>;
  abstract getTransaction(hash: string): Promise<Transaction | null>;
  abstract waitForTransaction(hash: string, confirmations?: number): Promise<Transaction>;
  abstract estimateGas(tx: Partial<Transaction>): Promise<GasEstimate>;
  abstract getBalance(address: string, tokenAddress?: string): Promise<string>;
  abstract getLatestBlockNumber(): Promise<number>;
  abstract getBlock(blockNumber: number): Promise<any>;
  abstract subscribeToBlocks(callback: (block: any) => void): Promise<() => void>;
  abstract subscribeToMempool(callback: (tx: Transaction) => void): Promise<() => void>;
  
  // Common RPC call method with retry logic
  protected async makeRPCCall<T = any>(call: RPCCall): Promise<T> {
    return this.requestQueue.add(async () => {
      return pRetry(
        async () => {
          try {
            const response = await this.httpClient.post('', {
              jsonrpc: '2.0',
              id: call.id || Date.now(),
              method: call.method,
              params: call.params
            });
            
            const rpcResponse: RPCResponse<T> = response.data;
            
            if (rpcResponse.error) {
              throw new Error(`RPC Error: ${rpcResponse.error.message}`);
            }
            
            return rpcResponse.result as T;
          } catch (error) {
            this.emit('error', error);
            throw error;
          }
        },
        {
          retries: this.config.maxRetries!,
          minTimeout: this.config.retryDelay,
          onFailedAttempt: (error) => {
            this.emit('retryAttempt', {
              attempt: error.attemptNumber,
              error: error.message
            });
          }
        }
      );
    });
  }
  
  // Connection health check
  protected async healthCheck(): Promise<boolean> {
    try {
      await this.getLatestBlockNumber();
      return true;
    } catch (error) {
      this.emit('healthCheckFailed', error);
      return false;
    }
  }
  
  // Setup error handling and monitoring
  private setupErrorHandling(): void {
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.emit('httpError', error);
        return Promise.reject(error);
      }
    );
    
    // Periodic health checks
    setInterval(async () => {
      if (this.isConnected) {
        const isHealthy = await this.healthCheck();
        if (!isHealthy) {
          this.emit('connectionUnhealthy');
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  // Utility method to format addresses for the specific chain
  protected formatAddress(address: string): string {
    return address; // Override in chain-specific implementations
  }
  
  // Utility method to format amounts
  protected formatAmount(amount: string | number): string {
    return amount.toString();
  }
  
  // Get connection stats
  public getConnectionStats() {
    return {
      chain: this.chain,
      isConnected: this.isConnected,
      queueSize: this.requestQueue.size,
      queuePending: this.requestQueue.pending,
      connectionRetries: this.connectionRetries
    };
  }
}