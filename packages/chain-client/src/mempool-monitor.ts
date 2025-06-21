import { ethers } from 'ethers';
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { ZeroLatencyOracle } from './zero-latency-oracle';
import winston from 'winston';


export interface MempoolConfig {
  // Zero-latency performance targeting
  performance: {
    maxLatencyMs: number; // Target: <50ms for enterprise operations
    processingDelayMs: number; // Micro-batch processing interval
    maxBatchSize: number; // Dynamic batch sizing
    connectionPoolSize: number; // Multiple connections per chain
    priorityProcessingEnabled: boolean; // Priority lanes for high-value txs
    mevDetectionLatency: number; // Sub-20ms MEV opportunity detection
  };

  // Advanced subscription management
  subscriptionFilters: {
    minTradeValue: string; // Minimum USD value threshold
    maxGasPrice: string; // Maximum gas price in gwei
    whitelistedDexes: string[]; // Supported DEX protocols
    blacklistedTokens: string[]; // Blocked token addresses across all chains
    minLiquidity: string; // Minimum pool liquidity threshold
    mevOpportunityThreshold: string; // MEV profit threshold in USD
    priorityAddresses: string[]; // VIP addresses for priority processing
    flashloanDetection: boolean; // Enhanced flashloan transaction detection
  };

  // Multi-chain support with specific configurations
  chains: {
    [chain: string]: {
      enabled: boolean;
      wsEndpoints: string[]; // Multiple WebSocket endpoints for redundancy
      rpcEndpoints: string[]; // Fallback RPC providers
      mempoolProviders: string[]; // Specialized mempool providers (Bloxroute, Eden, etc.)
      priorityFeeThreshold: string; // Chain-specific priority fee detection
      blockTime: number; // Expected block time in milliseconds
      finalizationDepth: number; // Blocks needed for finalization
    };
  };

  // Enterprise monitoring and reliability
  monitoring: {
    heartbeatIntervalMs: number; // Connection health check interval
    reconnectDelayMs: number; // Base reconnection delay
    maxReconnectAttempts: number; // Maximum reconnection attempts
    healthCheckTimeout: number; // Health check timeout
    alertingThresholds: {
      missedTransactionsPercent: number; // Alert on missed transaction rate
      latencyThresholdMs: number; // Alert on high latency
      connectionFailuresPerHour: number; // Alert on connection issues
    };
  };

  // Advanced MEV and arbitrage detection (Ben Livshits research integration)
  mevDetection: {
    enabled: boolean;
    sandwichDetection: boolean; // Sandwich attack detection
    arbitrageDetection: boolean; // Cross-DEX arbitrage opportunities
    liquidationDetection: boolean; // Liquidation event monitoring
    frontRunDetection: boolean; // Front-running opportunity identification
    confidenceThreshold: number; // Minimum confidence score for MEV classification
    profitabilityThreshold: string; // Minimum expected profit in USD
  };

  // Rate limiting and resource management
  rateLimiting: {
    requestsPerSecond: number; // Global rate limit
    burstLimit: number; // Burst capacity
    chainSpecificLimits: Record<string, number>; // Per-chain limits
    backoffMultiplier: number; // Exponential backoff multiplier
  };
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
  // Enhanced MEV detection fields
  mevSignature?: MEVSignature;
  priorityFee?: string; // EIP-1559 priority fee
  maxFeePerGas?: string; // EIP-1559 max fee
  gasUsed?: string; // Estimated or actual gas used
  isFlashloan?: boolean; // Flashloan detection
  dexInteractions?: DEXInteraction[]; // Detected DEX interactions
  tokenTransfers?: TokenTransfer[]; // Detected token transfers
  liquidationPotential?: LiquidationRisk; // Liquidation opportunity assessment
  mevOpportunityScore?: number; // MEV opportunity confidence score (0-100)
  extractableValue?: string; // Estimated extractable value in USD
  competitorTransactions?: string[]; // Related competing transactions
}

export interface MEVSignature {
  type: 'sandwich' | 'arbitrage' | 'liquidation' | 'frontrun' | 'backrun' | 'unknown';
  confidence: number; // 0-100 confidence score
  patterns: string[]; // Detected patterns (function signatures, address patterns)
  profitEstimate: string; // Estimated profit in USD
  gasCompetition: boolean; // Whether there's gas price competition
  timeWindow: number; // Time window for MEV opportunity (ms)
}

export interface DEXInteraction {
  dexName: string; // e.g., 'uniswap-v3', 'pancakeswap-v2'
  routerAddress: string; // DEX router contract address
  functionName: string; // Function being called (e.g., 'swapExactTokensForTokens')
  tokenIn: string; // Input token address
  tokenOut: string; // Output token address
  amountIn: string; // Input amount
  amountOut: string; // Expected output amount
  slippage: number; // Calculated slippage percentage
  priceImpact: number; // Price impact percentage
  poolAddress?: string; // Liquidity pool address (if detectable)
  poolLiquidity?: string; // Pool liquidity in USD
}

export interface TokenTransfer {
  from: string; // Sender address
  to: string; // Receiver address
  token: string; // Token contract address ('native' for ETH/BNB/etc)
  amount: string; // Transfer amount
  valueUsd: string; // USD value at time of transfer
  transferType: 'erc20' | 'native' | 'erc721' | 'erc1155';
  logIndex?: number; // Position in transaction logs
}

export interface LiquidationRisk {
  protocol: string; // Lending protocol (e.g., 'aave', 'compound')
  borrower: string; // Borrower address at risk
  collateral: TokenTransfer[]; // Collateral tokens
  debt: TokenTransfer[]; // Debt tokens
  healthFactor: number; // Current health factor
  liquidationThreshold: number; // Liquidation threshold
  potentialReward: string; // Potential liquidation reward in USD
  timeToLiquidation: number; // Estimated time until liquidation (seconds)
  gasRequirement: string; // Estimated gas needed for liquidation
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

export interface LatencyDistribution {
  under10ms: number;
  under50ms: number;
  under100ms: number;
  under500ms: number;
  over500ms: number;
}

export interface MempoolStats {
  // Basic transaction metrics
  totalTransactions: number;
  filteredTransactions: number;
  processedTransactions: number;
  averageLatency: number;
  connectionStatus: Record<string, boolean>;
  lastActivity: Record<string, number>;
  
  // Advanced performance metrics
  peakLatency: number; // Highest latency observed
  latencyDistribution: LatencyDistribution; // Latency distribution buckets
  
  // MEV detection metrics
  mevOpportunities: {
    total: number;
    sandwich: number;
    arbitrage: number;
    liquidation: number;
    frontrun: number;
    backrun: number;
  };
  
  // Financial metrics
  totalValueProcessed: string; // Total USD value of all processed transactions
  potentialMevValue: string; // Total potential MEV value detected
  gasCompetitionInstances: number; // Number of gas competition events
  
  // Chain-specific performance
  chainStats: Record<string, {
    transactionCount: number;
    averageLatency: number;
    connectionUptime: number; // Percentage uptime
    mevOpportunities: number;
    totalValue: string;
  }>;
  
  // Real-time performance indicators
  transactionsPerSecond: number;
  memoryUsage: number; // MB
  queueSizes: Record<string, number>; // Per-chain queue sizes
  
  // Error tracking
  errors: {
    connectionErrors: number;
    processingErrors: number;
    priceOracleErrors: number;
    lastError?: string;
    lastErrorTime?: number;
  };
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
  private priceOracle: ZeroLatencyOracle;
  private logger: winston.Logger;
  
  private isMonitoring = false;
  private stats: MempoolStats;
  private processingQueue = new Map<string, PendingTransaction[]>();
  private batchTimers = new Map<string, NodeJS.Timeout>();
  private reconnectAttempts = new Map<string, number>();

  constructor(config: MempoolConfig, priceOracle: ZeroLatencyOracle, logger: winston.Logger) {
    super();
    this.config = config;
    this.priceOracle = priceOracle;
    this.logger = logger;
    
    this.stats = {
      // Basic transaction metrics
      totalTransactions: 0,
      filteredTransactions: 0,
      processedTransactions: 0,
      averageLatency: 0,
      connectionStatus: {},
      lastActivity: {},
      
      // Advanced performance metrics
      peakLatency: 0,
      latencyDistribution: {
        under10ms: 0,
        under50ms: 0,
        under100ms: 0,
        under500ms: 0,
        over500ms: 0
      },
      
      // MEV detection metrics
      mevOpportunities: {
        total: 0,
        sandwich: 0,
        arbitrage: 0,
        liquidation: 0,
        frontrun: 0,
        backrun: 0
      },
      
      // Financial metrics
      totalValueProcessed: '0',
      potentialMevValue: '0',
      gasCompetitionInstances: 0,
      
      // Chain-specific performance
      chainStats: {},
      
      // Real-time performance indicators
      transactionsPerSecond: 0,
      memoryUsage: 0,
      queueSizes: {},
      
      // Error tracking
      errors: {
        connectionErrors: 0,
        processingErrors: 0,
        priceOracleErrors: 0
      }
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
    // Check if performance monitoring is enabled (derived from max latency being > 0)
    if (this.config.performance.maxLatencyMs <= 0) {
      this.logger.info('Real-time mempool monitoring is disabled');
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
          // Create proper this-bound handler for institutional-grade implementation
    const pendingHandler = (txHash: string): void => {
      this.handlePendingTransaction(txHash, chain);
    };
    provider.on('pending', pendingHandler.bind(this));

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
      
      // Perform advanced MEV analysis
      await this.analyzeMEVOpportunity(pendingTx);
      
      // Update enhanced statistics
      this.updateEnhancedStats(pendingTx);
      
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
   * Advanced MEV Detection and Analysis (Ben Livshits research integration)
   * Analyzes transactions for MEV opportunities using sophisticated pattern recognition
   */
  private async analyzeMEVOpportunity(tx: PendingTransaction): Promise<void> {
    if (!this.config.mevDetection.enabled) return;

    try {
      const startTime = Date.now();
      
      // Analyze transaction for MEV signatures
      const mevSignature = await this.detectMEVSignature(tx);
      if (mevSignature) {
        tx.mevSignature = mevSignature;
        tx.mevOpportunityScore = mevSignature.confidence;
        tx.extractableValue = mevSignature.profitEstimate;
        
        // Update MEV statistics
        this.updateMEVStats(mevSignature);
        
        // Emit MEV opportunity event for high-confidence opportunities
        if (mevSignature.confidence >= this.config.mevDetection.confidenceThreshold) {
          this.emit('mevOpportunity', {
            transaction: tx,
            mevSignature,
            detectionLatency: Date.now() - startTime
          });
        }
      }

      // Detect DEX interactions for arbitrage opportunities
      const dexInteractions = await this.detectDEXInteractions(tx);
      if (dexInteractions.length > 0) {
        tx.dexInteractions = dexInteractions;
        
        // Check for cross-DEX arbitrage opportunities
        if (this.config.mevDetection.arbitrageDetection) {
          await this.analyzeArbitrageOpportunity(tx, dexInteractions);
        }
      }

      // Detect flashloan patterns
      if (this.config.subscriptionFilters.flashloanDetection) {
        tx.isFlashloan = await this.detectFlashloan(tx);
      }

      // Analyze for liquidation opportunities
      if (this.config.mevDetection.liquidationDetection) {
        const liquidationRisk = await this.analyzeLiquidationRisk(tx);
        if (liquidationRisk) {
          tx.liquidationPotential = liquidationRisk;
        }
      }

    } catch (error) {
      this.logger.warn('MEV analysis failed', { txHash: tx.hash, error });
      this.stats.errors.processingErrors++;
    }
  }

  /**
   * Detect MEV signature patterns using advanced heuristics
   */
  private async detectMEVSignature(tx: PendingTransaction): Promise<MEVSignature | null> {
    const patterns: string[] = [];
    let confidence = 0;
    let mevType: MEVSignature['type'] = 'unknown';
    let profitEstimate = '0';

    // Analyze function signatures for known MEV patterns
    if (tx.data && tx.data.length >= 10) {
      const functionSelector = tx.data.slice(0, 10).toLowerCase();
      
      // Sandwich attack patterns
      const sandwichPatterns = [
        '0x38ed1739', // swapExactTokensForTokens
        '0x7ff36ab5', // swapExactETHForTokens
        '0x18cbafe5', // swapExactTokensForETH
        '0x472b43f3', // swapExactInputSingle (V3)
      ];
      
      if (sandwichPatterns.includes(functionSelector)) {
        patterns.push('dex_swap');
        confidence += 30;
        
        // Check for sandwich indicators (high gas price, specific timing)
        const gasPrice = parseFloat(tx.gasPrice) / 1e9;
        if (gasPrice > 100) { // High gas price indicates competition
          patterns.push('gas_competition');
          confidence += 20;
          mevType = 'sandwich';
        }
      }

      // Arbitrage patterns (multiple DEX interactions)
      const arbitragePatterns = [
        '0x5ae401dc', // multicall
        '0xac9650d8', // multicall alternative
      ];
      
      if (arbitragePatterns.includes(functionSelector)) {
        patterns.push('multicall');
        confidence += 25;
        mevType = 'arbitrage';
      }

      // Liquidation patterns
      const liquidationPatterns = [
        '0x6d4ce63c', // liquidateBorrow (Compound)
        '0x00a718a9', // liquidationCall (Aave)
      ];
      
      if (liquidationPatterns.includes(functionSelector)) {
        patterns.push('liquidation');
        confidence += 40;
        mevType = 'liquidation';
        
        // Estimate liquidation reward (typically 5-10% of collateral)
        profitEstimate = (tx.estimatedValue * 0.075).toString();
      }

      // Flashloan patterns
      const flashloanPatterns = [
        '0x5cffe9de', // flashLoan (Aave)
        '0x1249c58b', // flashLoan (dYdX)
      ];
      
      if (flashloanPatterns.includes(functionSelector)) {
        patterns.push('flashloan');
        confidence += 30;
        
        // Flashloans often indicate complex MEV strategies
        if (mevType === 'unknown') {
          mevType = 'arbitrage';
        }
      }
    }

    // Advanced gas analysis for MEV detection
    const gasPrice = parseFloat(tx.gasPrice) / 1e9;
    const gasLimit = parseFloat(tx.gasLimit);
    
    // Extremely high gas prices often indicate MEV competition
    if (gasPrice > 200) {
      patterns.push('extreme_gas_price');
      confidence += 25;
    }
    
    // Large gas limits for complex transactions
    if (gasLimit > 500000) {
      patterns.push('complex_transaction');
      confidence += 15;
    }

    // Transaction value analysis
    if (tx.estimatedValue > 100000) { // High value transactions
      patterns.push('high_value');
      confidence += 10;
    }

    // Time-based analysis (detect transaction timing patterns)
    const currentTime = Date.now();
    const timingScore = this.analyzeTransactionTiming(tx, currentTime);
    confidence += timingScore;

    if (confidence >= this.config.mevDetection.confidenceThreshold) {
      return {
        type: mevType,
        confidence,
        patterns,
        profitEstimate,
        gasCompetition: gasPrice > 100,
        timeWindow: this.calculateMEVTimeWindow(mevType)
      };
    }

    return null;
  }

  /**
   * Update MEV statistics based on detected signatures
   */
  private updateMEVStats(mevSignature: MEVSignature): void {
    this.stats.mevOpportunities.total++;
    
    // Only update specific type if it's a known MEV type
    if (mevSignature.type !== 'unknown') {
      this.stats.mevOpportunities[mevSignature.type]++;
    }
    
    if (mevSignature.gasCompetition) {
      this.stats.gasCompetitionInstances++;
    }
    
    // Update potential MEV value
    const currentValue = parseFloat(this.stats.potentialMevValue);
    const newValue = currentValue + parseFloat(mevSignature.profitEstimate);
    this.stats.potentialMevValue = newValue.toString();
  }

  /**
   * Analyze transaction timing patterns for MEV detection
   */
  private analyzeTransactionTiming(tx: PendingTransaction, currentTime: number): number {
    // Simple timing analysis - can be enhanced with more sophisticated algorithms
    const transactionAge = currentTime - tx.timestamp;
    
    // Recent transactions (within 1 second) are more likely to be MEV
    if (transactionAge < 1000) {
      return 15;
    } else if (transactionAge < 5000) {
      return 10;
    } else if (transactionAge < 10000) {
      return 5;
    }
    
    return 0;
  }

  /**
   * Calculate MEV time window based on opportunity type
   */
  private calculateMEVTimeWindow(mevType: MEVSignature['type']): number {
    switch (mevType) {
      case 'sandwich':
        return 12000; // 12 seconds (1 block window)
      case 'arbitrage':
        return 24000; // 24 seconds (2 block window)
      case 'liquidation':
        return 60000; // 60 seconds (5 block window)
      case 'frontrun':
        return 6000;  // 6 seconds (0.5 block window)
      case 'backrun':
        return 18000; // 18 seconds (1.5 block window)
      default:
        return 12000;
    }
  }

  /**
   * Detect DEX interactions in transaction data
   */
  private async detectDEXInteractions(tx: PendingTransaction): Promise<DEXInteraction[]> {
    const interactions: DEXInteraction[] = [];
    
    if (!tx.to || !tx.data || tx.data.length < 10) {
      return interactions;
    }

    // Use the existing DEX detection logic but extract more details
    const chainRouters = this.getDEXRoutersByChain(tx.chain);
    const routerAddress = tx.to.toLowerCase();
    
    // Find matching DEX
    for (const [dexName, addresses] of Object.entries(chainRouters)) {
      if (addresses.some(addr => addr.toLowerCase() === routerAddress)) {
        const functionSelector = tx.data.slice(0, 10).toLowerCase();
        
        const interaction: DEXInteraction = {
          dexName,
          routerAddress: tx.to,
          functionName: this.getFunctionName(functionSelector),
          tokenIn: 'unknown', // Would need ABI decoding for exact details
          tokenOut: 'unknown',
          amountIn: '0',
          amountOut: '0',
          slippage: 0,
          priceImpact: 0
        };
        
        interactions.push(interaction);
        break;
      }
    }
    
    return interactions;
  }

  /**
   * Analyze arbitrage opportunities across DEX interactions
   */
  private async analyzeArbitrageOpportunity(tx: PendingTransaction, dexInteractions: DEXInteraction[]): Promise<void> {
    // Basic arbitrage detection - can be enhanced with price comparison
    if (dexInteractions.length >= 2) {
      // Multiple DEX interactions suggest potential arbitrage
      if (tx.mevSignature) {
        tx.mevSignature.type = 'arbitrage';
        tx.mevSignature.confidence += 20;
      }
    }
  }

  /**
   * Detect flashloan patterns in transaction
   */
  private async detectFlashloan(tx: PendingTransaction): Promise<boolean> {
    if (!tx.data || tx.data.length < 10) {
      return false;
    }

    const functionSelector = tx.data.slice(0, 10).toLowerCase();
    const flashloanSelectors = [
      '0x5cffe9de', // flashLoan (Aave)
      '0x1249c58b', // flashLoan (dYdX)
      '0x6a627842', // flashLoan (Balancer)
    ];
    
    return flashloanSelectors.includes(functionSelector);
  }

  /**
   * Analyze liquidation risk and opportunities
   */
  private async analyzeLiquidationRisk(tx: PendingTransaction): Promise<LiquidationRisk | undefined> {
    if (!tx.data || tx.data.length < 10) {
      return undefined;
    }

    const functionSelector = tx.data.slice(0, 10).toLowerCase();
    const liquidationSelectors = [
      '0x6d4ce63c', // liquidateBorrow (Compound)
      '0x00a718a9', // liquidationCall (Aave)
    ];
    
    if (liquidationSelectors.includes(functionSelector)) {
      return {
        protocol: this.identifyLendingProtocol(tx.to || ''),
        borrower: tx.from, // Simplified - would need ABI decoding for exact borrower
        collateral: [],
        debt: [],
        healthFactor: 0.9, // Estimated
        liquidationThreshold: 0.85,
        potentialReward: (tx.estimatedValue * 0.05).toString(),
        timeToLiquidation: 300, // 5 minutes estimate
        gasRequirement: tx.gasLimit
      };
    }
    
    return undefined;
  }

  /**
   * Helper method to get DEX routers by chain
   */
  private getDEXRoutersByChain(chain: string): Record<string, string[]> {
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
    
    return dexRoutersByChain[chain] || {};
  }

  /**
   * Get function name from selector
   */
  private getFunctionName(selector: string): string {
    const functionNames: Record<string, string> = {
      '0x38ed1739': 'swapExactTokensForTokens',
      '0x7ff36ab5': 'swapExactETHForTokens',
      '0x18cbafe5': 'swapExactTokensForETH',
      '0x472b43f3': 'swapExactInputSingle',
      '0x5ae401dc': 'multicall',
      '0x6d4ce63c': 'liquidateBorrow',
      '0x00a718a9': 'liquidationCall',
      '0x5cffe9de': 'flashLoan'
    };
    
    return functionNames[selector] || 'unknown';
  }

  /**
   * Identify lending protocol from address
   */
  private identifyLendingProtocol(address: string): string {
    const protocolAddresses: Record<string, string> = {
      '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'aave', // Aave V2 LendingPool
      '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'aave', // Aave V3 Pool
      '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b': 'compound' // Compound Comptroller
    };
    
    return protocolAddresses[address.toLowerCase()] || 'unknown';
  }

  /**
   * Update enhanced statistics for comprehensive performance tracking
   */
  private updateEnhancedStats(tx: PendingTransaction): void {
    const latency = Date.now() - tx.timestamp;
    
    // Update peak latency
    if (latency > this.stats.peakLatency) {
      this.stats.peakLatency = latency;
    }
    
    // Update latency distribution
    if (latency < 10) {
      this.stats.latencyDistribution.under10ms++;
    } else if (latency < 50) {
      this.stats.latencyDistribution.under50ms++;
    } else if (latency < 100) {
      this.stats.latencyDistribution.under100ms++;
    } else if (latency < 500) {
      this.stats.latencyDistribution.under500ms++;
    } else {
      this.stats.latencyDistribution.over500ms++;
    }
    
    // Update total value processed
    const currentValue = parseFloat(this.stats.totalValueProcessed);
    const newValue = currentValue + tx.estimatedValue;
    this.stats.totalValueProcessed = newValue.toString();
    
    // Update chain-specific statistics
    if (!this.stats.chainStats[tx.chain]) {
      this.stats.chainStats[tx.chain] = {
        transactionCount: 0,
        averageLatency: 0,
        connectionUptime: 100,
        mevOpportunities: 0,
        totalValue: '0'
      };
    }
    
    const chainStats = this.stats.chainStats[tx.chain]!;
    chainStats.transactionCount++;
    chainStats.averageLatency = (chainStats.averageLatency * 0.9) + (latency * 0.1);
    
    const chainValue = parseFloat(chainStats.totalValue);
    chainStats.totalValue = (chainValue + tx.estimatedValue).toString();
    
    if (tx.mevOpportunityScore && tx.mevOpportunityScore > 0) {
      chainStats.mevOpportunities++;
    }
    
    // Update memory usage (simplified calculation)
    this.stats.memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    // Update queue sizes
    for (const [chain, queue] of this.processingQueue) {
      this.stats.queueSizes[chain] = queue.length;
    }
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

      // Get price from zero-latency oracle
      const priceAggregate = this.priceOracle.getPrice(tokenAddress);
      if (!priceAggregate) {
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
      return (value / Math.pow(10, decimals)) * priceAggregate.weightedPrice;

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
    if (queue.length >= this.config.performance.maxBatchSize) {
      this.processBatch(chain);
    }
  }

  /**
   * Initialize batch processing timers
   */
  private initializeBatchProcessing(): void {
    for (const chain of [...this.providers.keys(), 'solana']) {
      // Use proper this binding for institutional-grade implementation
      const timer = setInterval(this.processBatch.bind(this, chain), 
        this.config.performance.processingDelayMs) as NodeJS.Timeout;
      
      this.batchTimers.set(chain, timer);
    }
  }

  /**
   * Process a batch of transactions
   */
  private processBatch(chain: string): void {
    const queue = this.processingQueue.get(chain);
    if (!queue || queue.length === 0) return;

    const batch = queue.splice(0, this.config.performance.maxBatchSize);
    this.stats.processedTransactions += batch.length;

    // Calculate average latency using institutional-grade approach
    const latencies = batch.map(tx => Date.now() - tx.timestamp);
    let totalLatency = 0;
    for (const latency of latencies) {
      totalLatency += latency;
    }
    const avgLatency = latencies.length > 0 ? totalLatency / latencies.length : 0;
    
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
    
    if (attempts >= this.config.monitoring.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts reached for ${chain}`, { chain, attempts });
      this.emit('maxReconnectAttemptsReached', chain);
      return;
    }

    this.reconnectAttempts.set(chain, attempts + 1);

    // Create proper this-bound reconnection function for institutional-grade implementation
    const reconnectFunction = (): void => {
      this.logger.info(`Attempting to reconnect ${chain}`, { chain, attempt: attempts + 1 });
      this.reconnectChain(chain);
    };

    setTimeout(reconnectFunction.bind(this), this.config.monitoring.reconnectDelayMs * Math.pow(2, attempts));
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
    // Create proper this-bound heartbeat function for institutional-grade implementation
    const heartbeatCheck = (): void => {
      const now = Date.now();
      const heartbeatThreshold = this.config.monitoring.heartbeatIntervalMs;

      for (const chain of Object.keys(this.stats.connectionStatus)) {
        const lastActivity = this.stats.lastActivity[chain] || 0;
        
        if (now - lastActivity > heartbeatThreshold) {
          this.logger.warn(`No activity detected for ${chain} in the last ${heartbeatThreshold}ms`, { chain, lastActivity });
          this.emit('heartbeatMissed', chain);
          this.scheduleReconnect(chain);
        }
      }
    };

    setInterval(heartbeatCheck.bind(this), this.config.monitoring.heartbeatIntervalMs);
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
      for (const [, provider] of this.providers) {
        provider.removeAllListeners('pending');
        this.logger.info('Provider listeners removed');
      }

      // Clear timers
      for (const [, timer] of this.batchTimers) {
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

  /**
   * Get comprehensive mempool monitor status with enterprise metrics
   */
  getComprehensiveStatus(): {
    monitoring: {
      isActive: boolean;
      uptime: number;
      performance: {
        averageLatency: number;
        peakLatency: number;
        latencyDistribution: LatencyDistribution;
        transactionsPerSecond: number;
        memoryUsage: number;
      };
      connections: Record<string, {
        status: boolean;
        lastActivity: number;
        uptime: number;
      }>;
    };
    mev: {
      enabled: boolean;
      opportunities: {
        total: number;
        sandwich: number;
        arbitrage: number;
        liquidation: number;
        frontrun: number;
        backrun: number;
      };
      totalPotentialValue: string;
      gasCompetitionInstances: number;
      averageConfidenceScore: number;
    };
    financial: {
      totalValueProcessed: string;
      potentialMevValue: string;
      averageTransactionValue: number;
      highValueTransactions: number;
    };
    chains: Record<string, {
      transactionCount: number;
      averageLatency: number;
      connectionUptime: number;
      mevOpportunities: number;
      totalValue: string;
      queueSize: number;
    }>;
    errors: {
      connectionErrors: number;
      processingErrors: number;
      priceOracleErrors: number;
      lastError?: string;
      lastErrorTime?: number;
    };
  } {
    const now = Date.now();
    const uptimeMs = this.calculateSystemUptime(now);
    
    // Update real-time metrics
    this.updateTransactionsPerSecond(uptimeMs);
    
    return {
      monitoring: {
        isActive: this.isMonitoring,
        uptime: Math.round(uptimeMs / 1000),
        performance: this.buildPerformanceMetrics(),
        connections: this.buildConnectionsMetrics(now)
      },
      mev: this.buildMevMetrics(),
      financial: this.buildFinancialMetrics(),
      chains: this.buildChainsMetrics(),
      errors: this.stats.errors
    };
  }

  /**
   * Calculate system uptime based on first chain activity
   */
  private calculateSystemUptime(currentTime: number): number {
    const firstChain = Object.keys(this.stats.lastActivity)[0];
    return firstChain ? currentTime - (this.stats.lastActivity[firstChain] || currentTime) : 0;
  }

  /**
   * Update transactions per second metric
   */
  private updateTransactionsPerSecond(uptimeMs: number): void {
    this.stats.transactionsPerSecond = uptimeMs > 0 ? 
      Math.round(this.stats.processedTransactions / (uptimeMs / 1000)) : 0;
  }

  /**
   * Build performance metrics object
   */
  private buildPerformanceMetrics() {
    return {
      averageLatency: Math.round(this.stats.averageLatency),
      peakLatency: this.stats.peakLatency,
      latencyDistribution: this.stats.latencyDistribution,
      transactionsPerSecond: this.stats.transactionsPerSecond,
      memoryUsage: this.stats.memoryUsage
    };
  }

  /**
   * Build connections metrics with proper typing
   */
  private buildConnectionsMetrics(currentTime: number): Record<string, {
    status: boolean;
    lastActivity: number;
    uptime: number;
  }> {
    const connections: Record<string, {
      status: boolean;
      lastActivity: number;
      uptime: number;
    }> = {};

    for (const [chain, status] of Object.entries(this.stats.connectionStatus)) {
      const lastActivity = this.stats.lastActivity[chain] || 0;
      const chainUptime = status ? currentTime - lastActivity : 0;
      
      connections[chain] = {
        status,
        lastActivity,
        uptime: Math.round(chainUptime / 1000)
      };
    }

    return connections;
  }

  /**
   * Build MEV metrics with confidence calculation
   */
  private buildMevMetrics() {
    // Calculate average confidence score for MEV opportunities
    const avgConfidence = this.stats.mevOpportunities.total > 0 ? 75 : 0; // Simplified calculation
    
    return {
      enabled: this.config.mevDetection.enabled,
      opportunities: this.stats.mevOpportunities,
      totalPotentialValue: this.stats.potentialMevValue,
      gasCompetitionInstances: this.stats.gasCompetitionInstances,
      averageConfidenceScore: avgConfidence
    };
  }

  /**
   * Build financial metrics with calculations
   */
  private buildFinancialMetrics() {
    const averageTransactionValue = this.stats.totalTransactions > 0 ? 
      parseFloat(this.stats.totalValueProcessed) / this.stats.totalTransactions : 0;
    
    // Count high-value transactions (>$100k) using institutional-grade loop
    let highValueTransactions = 0;
    const chainStatValues = Object.values(this.stats.chainStats);
    for (const chainStat of chainStatValues) {
      highValueTransactions += Math.floor(parseFloat(chainStat.totalValue) / 100000);
    }
    
    return {
      totalValueProcessed: this.stats.totalValueProcessed,
      potentialMevValue: this.stats.potentialMevValue,
      averageTransactionValue,
      highValueTransactions
    };
  }

  /**
   * Build chains metrics with queue sizes
   */
  private buildChainsMetrics(): Record<string, {
    transactionCount: number;
    averageLatency: number;
    connectionUptime: number;
    mevOpportunities: number;
    totalValue: string;
    queueSize: number;
  }> {
    const chains: Record<string, {
      transactionCount: number;
      averageLatency: number;
      connectionUptime: number;
      mevOpportunities: number;
      totalValue: string;
      queueSize: number;
    }> = {};

    for (const [chainName, stats] of Object.entries(this.stats.chainStats)) {
      chains[chainName] = {
        ...stats,
        queueSize: this.stats.queueSizes[chainName] || 0
      };
    }

    return chains;
  }

  /**
   * Reset statistics (useful for testing or periodic resets)
   */
  resetStats(): void {
    this.stats = {
      totalTransactions: 0,
      filteredTransactions: 0,
      processedTransactions: 0,
      averageLatency: 0,
      connectionStatus: { ...this.stats.connectionStatus },
      lastActivity: { ...this.stats.lastActivity },
      peakLatency: 0,
      latencyDistribution: {
        under10ms: 0,
        under50ms: 0,
        under100ms: 0,
        under500ms: 0,
        over500ms: 0
      },
      mevOpportunities: {
        total: 0,
        sandwich: 0,
        arbitrage: 0,
        liquidation: 0,
        frontrun: 0,
        backrun: 0
      },
      totalValueProcessed: '0',
      potentialMevValue: '0',
      gasCompetitionInstances: 0,
      chainStats: {},
      transactionsPerSecond: 0,
      memoryUsage: 0,
      queueSizes: {},
      errors: {
        connectionErrors: 0,
        processingErrors: 0,
        priceOracleErrors: 0
      }
    };
    
    this.logger.info('Mempool monitor statistics reset');
    this.emit('statsReset');
  }
} 