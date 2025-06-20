import { ethers } from 'ethers';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { PriceOracle, TokenPrice } from './price-oracle';
import winston from 'winston';

export interface MempoolConfig {
  enableRealtimeSubscription: boolean;
  subscriptionFilters: {
    minTradeValue: string;
    maxGasPrice: string;
    whitelistedDexes: string[];
    blacklistedTokens: string[];
  };
  batchSize: number;
  processingDelayMs: number;
  heartbeatIntervalMs: number;
  reconnectDelayMs: number;
  maxReconnectAttempts: number;
}

export interface PendingTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gasLimit: string;
  data: string;
  nonce: number;
  chain: string;
  timestamp: number;
  estimatedValue: number;
  blockNumber?: number;
}

export interface SolanaTransaction {
  signature: string;
  transaction: VersionedTransaction;
  accounts: string[];
  programId: string;
  timestamp: number;
  priorityFee: number;
  estimatedValue: number;
}

export interface MempoolStats {
  totalTransactions: number;
  filteredTransactions: number;
  processedTransactions: number;
  averageLatency: number;
  connectionStatus: Record<string, boolean>;
  lastActivity: Record<string, number>;
}

/**
 * Shared Mempool Monitor for all trading bots
 * Supports Ethereum, BSC, and Solana chains
 */
export class MempoolMonitor extends EventEmitter {
  private config: MempoolConfig;
  private providers = new Map<string, ethers.Provider>();
  private solanaConnection?: Connection;
  private websockets = new Map<string, WebSocket>();
  private priceOracle: PriceOracle;
  private logger: winston.Logger;
  
  private isMonitoring = false;
  private stats: MempoolStats;
  private processingQueue = new Map<string, PendingTransaction[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private reconnectAttempts = new Map<string, number>();

  constructor(config: MempoolConfig, priceOracle: PriceOracle, logger: winston.Logger) {
    super();
    this.config = config;
    this.priceOracle = priceOracle;
    this.logger = logger;
    
    this.stats = {
      totalTransactions: 0,
      filteredTransactions: 0,
      processedTransactions: 0,
      averageLatency: 0,
      connectionStatus: {},
      lastActivity: {}
    };
  }

  /**
   * Initialize providers for mempool monitoring
   */
  async initialize(providers: {
    [chain: string]: ethers.Provider | Connection;
  }): Promise<void> {
    try {
      for (const [chain, provider] of Object.entries(providers)) {
        if (provider instanceof Connection) {
          this.solanaConnection = provider;
          this.stats.connectionStatus['solana'] = false;
          this.stats.lastActivity['solana'] = 0;
        } else {
          this.providers.set(chain, provider);
          this.stats.connectionStatus[chain] = false;
          this.stats.lastActivity[chain] = 0;
        }
      }

      console.log('Mempool monitor initialized for chains:', Object.keys(providers));
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize mempool monitor:', error);
      throw error;
    }
  }

  /**
   * Start monitoring mempool for all configured chains
   */
  async startMonitoring(): Promise<void> {
    if (!this.config.enableRealtimeSubscription) {
      console.log('Real-time mempool monitoring is disabled');
      return;
    }

    try {
      this.isMonitoring = true;
      
      // Start monitoring for each chain
      const monitoringPromises: Promise<void>[] = [];
      
      for (const [chain, provider] of this.providers) {
        monitoringPromises.push(this.startChainMonitoring(chain, provider));
      }
      
      if (this.solanaConnection) {
        monitoringPromises.push(this.startSolanaMonitoring());
      }

      await Promise.all(monitoringPromises);
      
      // Initialize batch processing
      this.initializeBatchProcessing();
      
      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();
      
      console.log('Mempool monitoring started for all chains');
      this.emit('monitoringStarted');
      
    } catch (error) {
      console.error('Failed to start mempool monitoring:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Start monitoring for a specific EVM chain (Ethereum/BSC)
   */
  private async startChainMonitoring(chain: string, provider: ethers.Provider): Promise<void> {
    try {
      // Subscribe to pending transactions
      provider.on('pending', (txHash: string) => {
        this.handlePendingTransaction(txHash, chain);
      });

      // Set up WebSocket for real-time data
      await this.setupWebSocket(chain);
      
      this.stats.connectionStatus[chain] = true;
      console.log(`${chain} mempool monitoring started`);
      
    } catch (error) {
      console.error(`Failed to start ${chain} monitoring:`, error);
      this.scheduleReconnect(chain);
      throw error;
    }
  }

  /**
   * Start Solana mempool monitoring
   */
  private async startSolanaMonitoring(): Promise<void> {
    if (!this.solanaConnection) return;

    try {
      // Monitor DEX program account changes
      const dexPrograms = [
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
        'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'  // Jupiter
      ];

      for (const programId of dexPrograms) {
        this.solanaConnection.onProgramAccountChange(
          new PublicKey(programId),
          (accountInfo, context) => {
            this.handleSolanaProgramChange(accountInfo, context, programId);
          },
          'processed'
        );
      }

      this.stats.connectionStatus['solana'] = true;
      console.log('Solana mempool monitoring started');
      
    } catch (error) {
      console.error('Failed to start Solana monitoring:', error);
      this.scheduleReconnect('solana');
      throw error;
    }
  }

  /**
   * Set up WebSocket connection for a chain
   */
  private async setupWebSocket(chain: string): Promise<void> {
    const wsUrlEnvVar = `${chain.toUpperCase()}_WS_URL`;
    const wsUrl = process.env[wsUrlEnvVar];
    
    if (!wsUrl) {
      console.warn(`No WebSocket URL configured for ${chain} (${wsUrlEnvVar})`);
      return;
    }

    const ws = new WebSocket(wsUrl);
    this.websockets.set(chain, ws);

    ws.on('open', () => {
      console.log(`${chain} WebSocket connected`);
      
      // Subscribe to pending transactions
      const subscription = {
        jsonrpc: '2.0',
        method: 'eth_subscribe',
        params: ['newPendingTransactions', true],
        id: 1
      };
      
      ws.send(JSON.stringify(subscription));
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.params && message.params.result) {
          this.processPendingTransaction(message.params.result, chain);
        }
      } catch (error) {
        console.warn(`Failed to parse ${chain} WebSocket message:`, error);
      }
    });

    ws.on('close', () => {
      console.log(`${chain} WebSocket disconnected`);
      this.stats.connectionStatus[chain] = false;
      this.scheduleReconnect(chain);
    });

    ws.on('error', (error) => {
      console.error(`${chain} WebSocket error:`, error);
      this.stats.connectionStatus[chain] = false;
    });
  }

  /**
   * Handle pending transaction from provider
   */
  private async handlePendingTransaction(txHash: string, chain: string): Promise<void> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) return;

      const tx = await provider.getTransaction(txHash);
      if (!tx) return;

      await this.processPendingTransaction(tx, chain);
      
    } catch (error) {
      console.warn(`Failed to process pending transaction ${txHash}:`, error);
    }
  }

  /**
   * Process pending transaction and apply filters
   */
  private async processPendingTransaction(tx: any, chain: string): Promise<void> {
    try {
      this.stats.totalTransactions++;
      this.stats.lastActivity[chain] = Date.now();

      const pendingTx: PendingTransaction = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value?.toString() || '0',
        gasPrice: tx.gasPrice?.toString() || '0',
        gasLimit: tx.gasLimit?.toString() || '0',
        data: tx.data || '0x',
        nonce: tx.nonce || 0,
        chain,
        timestamp: Date.now(),
        estimatedValue: await this.estimateTransactionValue(tx, chain),
        blockNumber: tx.blockNumber
      };

      // Apply filters
      if (!this.shouldProcessTransaction(pendingTx)) {
        return;
      }

      this.stats.filteredTransactions++;
      this.addToProcessingQueue(pendingTx);

    } catch (error) {
      console.warn('Failed to process pending transaction:', error);
    }
  }

  /**
   * Handle Solana program account changes
   */
  private handleSolanaProgramChange(accountInfo: any, context: any, programId: string): void {
    try {
      this.stats.totalTransactions++;
      this.stats.lastActivity['solana'] = Date.now();

      this.emit('solanaProgramChange', {
        accountInfo,
        context,
        programId,
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn('Failed to handle Solana program change:', error);
    }
  }

  /**
   * Check if transaction should be processed based on filters
   */
  private shouldProcessTransaction(tx: PendingTransaction): boolean {
    const filters = this.config.subscriptionFilters;
    
    // Check minimum trade value
    const minValue = parseFloat(filters.minTradeValue);
    if (tx.estimatedValue < minValue) {
      return false;
    }

    // Check maximum gas price
    const gasPrice = parseFloat(tx.gasPrice) / 1e9; // Convert to Gwei
    const maxGasPrice = parseFloat(filters.maxGasPrice);
    if (gasPrice > maxGasPrice) {
      return false;
    }

    // Check blacklisted tokens
    if (filters.blacklistedTokens.includes(tx.to?.toLowerCase() || '')) {
      return false;
    }

    // Check if transaction is to whitelisted DEX
    if (filters.whitelistedDexes.length > 0) {
      if (!this.isDexTransaction(tx, filters.whitelistedDexes)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if transaction is a DEX transaction with comprehensive router detection
   */
  private isDexTransaction(tx: PendingTransaction, whitelistedDexes: string[]): boolean {
    if (!tx.to) return false;

    // Comprehensive DEX router addresses by chain
    const dexRoutersByChain: Record<string, Record<string, string[]>> = {
      ethereum: {
        'uniswap-v2': ['0x7a250d5630b4cf539739df2c5dacb4c659f2488d'],
        'uniswap-v3': ['0xe592427a0aece92de3edee1f18e0157c05861564', '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45'],
        'sushiswap': ['0x1b02da8cb0d097eb8d57a175b88c7d8b47997506'],
        '1inch': ['0x1111111254eeb25477b68fb85ed929f73a960582'],
        'curve': ['0x99a58482bd75cbab83b27ec03ca68ff489b5788f'],
        'balancer': ['0xba12222222228d8ba445958a75a0704d566bf2c8']
      },
      bsc: {
        'pancakeswap-v2': ['0x10ed43c718714eb63d5aa57b78b54704e256024e'],
        'pancakeswap-v3': ['0x13f4ea83d0bd40e75c8222255bc855a974568dd4'],
        'biswap': ['0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8'],
        '1inch': ['0x1111111254eeb25477b68fb85ed929f73a960582']
      },
      polygon: {
        'uniswap-v3': ['0xe592427a0aece92de3edee1f18e0157c05861564'],
        'quickswap': ['0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff'],
        'sushiswap': ['0x1b02da8cb0d097eb8d57a175b88c7d8b47997506'],
        '1inch': ['0x1111111254eeb25477b68fb85ed929f73a960582']
      },
      arbitrum: {
        'uniswap-v3': ['0xe592427a0aece92de3edee1f18e0157c05861564'],
        'camelot': ['0xc873fecbd354f5a56e00e710b90ef4201db2448d'],
        'sushiswap': ['0x1b02da8cb0d097eb8d57a175b88c7d8b47997506']
      },
      optimism: {
        'uniswap-v3': ['0xe592427a0aece92de3edee1f18e0157c05861564']
      }
    };

    // Get routers for the current chain
    const chainRouters = dexRoutersByChain[tx.chain] || {};
    const txToLower = tx.to.toLowerCase();
    
    // Check if any whitelisted DEX matches
    for (const dexName of whitelistedDexes) {
      const routerAddresses = chainRouters[dexName] || [];
      for (const routerAddress of routerAddresses) {
        if (routerAddress.toLowerCase() === txToLower) {
          return true;
        }
      }
    }

    // Additional check: detect common DEX function signatures
    if (tx.data && tx.data.length >= 10) {
      const functionSelector = tx.data.slice(0, 10).toLowerCase();
      const dexFunctionSelectors = [
        '0x38ed1739', // swapExactTokensForTokens
        '0x7ff36ab5', // swapExactETHForTokens  
        '0x18cbafe5', // swapExactTokensForETH
        '0x8803dbee', // swapTokensForExactTokens
        '0x414bf389', // swapExactETHForTokensSupportingFeeOnTransferTokens
        '0xb6f9de95', // swapExactTokensForETHSupportingFeeOnTransferTokens
        '0x472b43f3', // swapExactInputSingle (Uniswap V3)
        '0x09b81346', // exactInputSingle (Uniswap V3)
        '0x5ae401dc', // multicall (Uniswap V3)
        '0xac9650d8'  // multicall (alternative)
      ];
      
      if (dexFunctionSelectors.includes(functionSelector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Estimate transaction value in USD using PriceOracle
   */
  private async estimateTransactionValue(tx: any, chain: string): Promise<number> {
    try {
      const value = parseFloat(tx.value || '0');
      if (value === 0) return 0;

      // Get native token address for the chain
      const nativeTokenAddresses: Record<string, string> = {
        ethereum: 'native',
        bsc: 'native', 
        polygon: 'native',
        arbitrum: 'native',
        optimism: 'native',
        solana: 'So11111111111111111111111111111111111111112' // Wrapped SOL
      };

      const tokenAddress = nativeTokenAddresses[chain];
      if (!tokenAddress) {
        this.logger.warn('Unknown chain for price estimation', { chain });
        return 0;
      }

      // Get price from oracle
      const tokenPrice = await this.priceOracle.getTokenPrice(tokenAddress, chain);
      if (!tokenPrice) {
        // Fallback to hardcoded rates if oracle fails
        const fallbackRates: Record<string, number> = {
          ethereum: 1800,
          bsc: 300,
          polygon: 0.8,
          arbitrum: 1800,
          optimism: 1800,
          solana: 20
        };
        const rate = fallbackRates[chain] || 0;
        const decimals = chain === 'solana' ? 9 : 18;
        return (value / Math.pow(10, decimals)) * rate;
      }

      // Calculate USD value using oracle price
      const decimals = chain === 'solana' ? 9 : 18;
      return (value / Math.pow(10, decimals)) * tokenPrice.priceUsd;

    } catch (error) {
      this.logger.warn('Failed to estimate transaction value', { chain, error });
      return 0;
    }
  }

  /**
   * Add transaction to processing queue
   */
  private addToProcessingQueue(tx: PendingTransaction): void {
    const chain = tx.chain;
    
    if (!this.processingQueue.has(chain)) {
      this.processingQueue.set(chain, []);
    }

    this.processingQueue.get(chain)!.push(tx);

    // Check if we should process the batch
    const queue = this.processingQueue.get(chain)!;
    if (queue.length >= this.config.batchSize) {
      this.processBatch(chain);
    }
  }

  /**
   * Initialize batch processing timers
   */
  private initializeBatchProcessing(): void {
    for (const chain of [...this.providers.keys(), 'solana']) {
      const timer = setInterval(() => {
        this.processBatch(chain);
      }, this.config.processingDelayMs) as NodeJS.Timeout;
      
      this.batchTimers.set(chain, timer);
    }
  }

  /**
   * Process a batch of transactions
   */
  private processBatch(chain: string): void {
    const queue = this.processingQueue.get(chain);
    if (!queue || queue.length === 0) return;

    const batch = queue.splice(0, this.config.batchSize);
    this.stats.processedTransactions += batch.length;

    // Calculate average latency
    const latencies = batch.map(tx => Date.now() - tx.timestamp);
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    
    // Update rolling average
    this.stats.averageLatency = (this.stats.averageLatency * 0.9) + (avgLatency * 0.1);

    // Emit batch for processing by individual bots
    this.emit('transactionBatch', {
      chain,
      transactions: batch,
      averageLatency: avgLatency
    });
  }

  /**
   * Schedule reconnection for a chain
   */
  private scheduleReconnect(chain: string): void {
    const attempts = this.reconnectAttempts.get(chain) || 0;
    
    if (attempts >= this.config.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${chain}`);
      this.emit('maxReconnectAttemptsReached', chain);
      return;
    }

    this.reconnectAttempts.set(chain, attempts + 1);

    setTimeout(() => {
      console.log(`Attempting to reconnect ${chain} (attempt ${attempts + 1})`);
      this.reconnectChain(chain);
    }, this.config.reconnectDelayMs * Math.pow(2, attempts));
  }

  /**
   * Reconnect to a specific chain
   */
  private async reconnectChain(chain: string): Promise<void> {
    try {
      if (chain === 'solana') {
        await this.startSolanaMonitoring();
      } else {
        const provider = this.providers.get(chain);
        if (provider) {
          await this.startChainMonitoring(chain, provider);
        }
      }
      
      this.reconnectAttempts.set(chain, 0);
      
    } catch (error) {
      console.error(`Failed to reconnect ${chain}:`, error);
      this.scheduleReconnect(chain);
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      const heartbeatThreshold = this.config.heartbeatIntervalMs;

      for (const chain of Object.keys(this.stats.connectionStatus)) {
        const lastActivity = this.stats.lastActivity[chain] || 0;
        
        if (now - lastActivity > heartbeatThreshold) {
          console.warn(`No activity detected for ${chain} in the last ${heartbeatThreshold}ms`);
          this.emit('heartbeatMissed', chain);
          this.scheduleReconnect(chain);
        }
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Stop mempool monitoring
   */
  async stopMonitoring(): Promise<void> {
    try {
      this.isMonitoring = false;

      // Close WebSocket connections
      for (const [chain, ws] of this.websockets) {
        ws.close();
        console.log(`${chain} WebSocket closed`);
      }
      this.websockets.clear();

      // Remove provider listeners
      for (const [chain, provider] of this.providers) {
        provider.removeAllListeners('pending');
        console.log(`${chain} provider listeners removed`);
      }

      // Clear timers
      for (const [chain, timer] of this.batchTimers) {
        clearInterval(timer);
      }
      this.batchTimers.clear();

      // Process remaining transactions
      for (const chain of this.processingQueue.keys()) {
        this.processBatch(chain);
      }

      this.emit('monitoringStopped');
      console.log('Mempool monitoring stopped');

    } catch (error) {
      console.error('Error stopping mempool monitoring:', error);
      throw error;
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats(): MempoolStats {
    return { ...this.stats };
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MempoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }
} 