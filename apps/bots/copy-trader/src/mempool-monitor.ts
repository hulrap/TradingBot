import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import winston from 'winston';

export interface MempoolTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  data: string;
  nonce: number;
  timestamp: number;
  blockNumber?: number;
  transactionIndex?: number;
  chainId?: number;
  type?: number;
  accessList?: any[];
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  decodedData?: DecodedTransactionData;
}

export interface DecodedTransactionData {
  functionName: string;
  functionSignature: string;
  parameters: any[];
  tokenIn?: string;
  tokenOut?: string;
  tokenInSymbol?: string;
  tokenOutSymbol?: string;
  amountIn?: string;
  amountOut?: string;
  amountInMin?: string;
  amountOutMin?: string;
  recipient?: string;
  deadline?: number;
  dexRouter?: string;
  dexProtocol?: string;
  swapPath?: string[];
  fee?: number;
  isSwap: boolean;
  isLiquidityOperation: boolean;
  isMevProtected?: boolean;
  priceImpact?: number;
  slippageTolerance?: number;
}

export interface MonitorConfig {
  rpcUrl: string;
  wsUrl: string;
  targetWallets: string[];
  dexRouters: string[];
  minTransactionValue: string; // Minimum value in ETH to monitor
  maxGasPrice: string; // Maximum gas price to consider
  enableDecoding: boolean;
  enableFiltering: boolean;
  enableDatabase: boolean;
  databasePath: string;
  enableRateLimiting: boolean;
  maxRpcCallsPerSecond: number;
  enableMevDetection: boolean;
  enableBatchProcessing: boolean;
  batchSize: number;
  batchInterval: number; // milliseconds
  enableHealthCheck: boolean;
  healthCheckInterval: number; // milliseconds
  chainId: number;
  retryAttempts: number;
  retryDelay: number;
  maxReconnectAttempts: number;
  reconnectBackoffMultiplier: number;
  maxReconnectDelay: number;
}

export interface HealthStatus {
  isConnected: boolean;
  reconnectAttempts: number;
  lastTransactionTime: number;
  transactionsProcessed: number;
  errorsCount: number;
  rpcCallsCount: number;
  rpcCallsPerSecond: number;
  averageProcessingTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

export interface RateLimiter {
  checkLimit(): boolean;
  recordCall(): void;
  reset(): void;
  getCurrentCount(): number;
  getTimeUntilReset(): number;
}

export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  checkLimit(): boolean {
    this.refill();
    return this.tokens > 0;
  }

  recordCall(): void {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
    }
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  getCurrentCount(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  getTimeUntilReset(): number {
    this.refill();
    if (this.tokens >= this.maxTokens) return 0;
    return Math.ceil((this.maxTokens - this.tokens) / this.refillRate * 1000);
  }
}

export class MempoolMonitor extends EventEmitter {
  private config: MonitorConfig;
  private provider: ethers.JsonRpcProvider;
  private wsProvider: ethers.WebSocketProvider | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private currentReconnectDelay: number;
  private db: DatabaseType | null = null;
  private logger: winston.Logger;
  private rateLimiter: RateLimiter;
  private pendingTransactions: string[] = [];
  private processingBatch = false;
  private healthStatus: HealthStatus;
  private startTime: number;
  private processingTimes: number[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private batchProcessingInterval: NodeJS.Timeout | null = null;

  // Enhanced DEX router ABIs for comprehensive decoding
  private routerABIs = {
    uniswapV2: [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)',
      'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline)',
      'function removeLiquidity(address tokenA, address tokenB, uint liquidity, uint amountAMin, uint amountBMin, address to, uint deadline)'
    ],
    uniswapV3: [
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96))',
      'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96))',
      'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum))',
      'function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum))',
      'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline))',
      'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max))'
    ],
    sushiswap: [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)'
    ],
    balancer: [
      'function batchSwap(uint8 kind, (bytes32 poolId, uint256 assetInIndex, uint256 assetOutIndex, uint256 amount, bytes userData)[] swaps, address[] assets, (address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds, int256[] limits, uint256 deadline)',
      'function swap((bytes32 poolId, uint8 kind, address assetIn, address assetOut, uint256 amount, bytes userData) singleSwap, (address sender, bool fromInternalBalance, address recipient, bool toInternalBalance) funds, uint256 limit, uint256 deadline)'
    ],
    curve: [
      'function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy)',
      'function exchange_underlying(int128 i, int128 j, uint256 dx, uint256 min_dy)',
      'function add_liquidity(uint256[2] amounts, uint256 min_mint_amount)',
      'function remove_liquidity(uint256 _amount, uint256[2] min_amounts)',
      'function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 min_amount)'
    ],
    oneinch: [
      'function swap(address caller, (address srcToken, address dstToken, address srcReceiver, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags, bytes permit) desc, bytes data)',
      'function unoswap(address srcToken, uint256 amount, uint256 minReturn, bytes32[] pools)',
      'function uniswapV3Swap(uint256 amount, uint256 minReturn, uint256[] pools)'
    ],
    cowswap: [
      'function setPreSignature(bytes calldata orderUid, bool signed)',
      'function settle(address[] tokens, uint256[] clearingPrices, (uint256 sellTokenIndex, uint256 buyTokenIndex, address receiver, uint256 sellAmount, uint256 buyAmount, uint32 validTo, bytes32 appData, uint256 feeAmount, uint256 flags, uint256 executedAmount, bytes signature)[] trades, (address target, uint256 value, bytes callData)[] interactions)'
    ]
  };

  private interfaces: { [key: string]: ethers.Interface } = {};

  // MEV detection patterns
  private mevPatterns = {
    sandwich: {
      minGasPricePremium: 1.5, // 50% higher than average
      maxBlocksApart: 1,
      sameTokenPair: true
    },
    frontrunning: {
      minGasPricePremium: 1.2, // 20% higher than average
      maxTimeGap: 12000, // 12 seconds
      sameFunction: true
    },
    backrunning: {
      maxTimeGap: 6000, // 6 seconds after target tx
      profitThreshold: 0.01 // Minimum 1% profit
    }
  };

  constructor(config: MonitorConfig) {
    super();
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.currentReconnectDelay = config.retryDelay;
    this.startTime = Date.now();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'mempool-monitor-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'mempool-monitor.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    // Initialize rate limiter
    this.rateLimiter = new TokenBucketRateLimiter(
      config.maxRpcCallsPerSecond,
      config.maxRpcCallsPerSecond
    );

    // Initialize health status
    this.healthStatus = this.initializeHealthStatus();
    
    // Initialize database if enabled
    if (config.enableDatabase) {
      this.initializeDatabase();
    }
    
    // Initialize ABI interfaces
    this.initializeInterfaces();
  }

  private initializeHealthStatus(): HealthStatus {
    return {
      isConnected: false,
      reconnectAttempts: 0,
      lastTransactionTime: 0,
      transactionsProcessed: 0,
      errorsCount: 0,
      rpcCallsCount: 0,
      rpcCallsPerSecond: 0,
      averageProcessingTime: 0,
      memoryUsage: process.memoryUsage(),
      uptime: 0
    };
  }

  private initializeDatabase(): void {
    if (!this.config.enableDatabase) return;

    try {
      this.db = new Database(this.config.databasePath);
      
      // Create tables for mempool monitoring
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mempool_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash TEXT UNIQUE NOT NULL,
          from_address TEXT NOT NULL,
          to_address TEXT,
          value TEXT NOT NULL,
          gas_price TEXT NOT NULL,
          gas_limit TEXT NOT NULL,
          data TEXT,
          nonce INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          block_number INTEGER,
          transaction_index INTEGER,
          chain_id INTEGER,
          type INTEGER,
          max_fee_per_gas TEXT,
          max_priority_fee_per_gas TEXT,
          is_target_wallet BOOLEAN DEFAULT FALSE,
          is_dex_transaction BOOLEAN DEFAULT FALSE,
          is_swap BOOLEAN DEFAULT FALSE,
          is_liquidity_operation BOOLEAN DEFAULT FALSE,
          is_mev_protected BOOLEAN DEFAULT FALSE,
          decoded_function_name TEXT,
          decoded_dex_protocol TEXT,
          token_in TEXT,
          token_out TEXT,
          amount_in TEXT,
          amount_out TEXT,
          processing_time_ms REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX(hash),
          INDEX(from_address),
          INDEX(to_address),
          INDEX(timestamp),
          INDEX(is_target_wallet),
          INDEX(is_swap)
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS monitor_health (
          id INTEGER PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          is_connected BOOLEAN NOT NULL,
          reconnect_attempts INTEGER DEFAULT 0,
          transactions_processed INTEGER DEFAULT 0,
          errors_count INTEGER DEFAULT 0,
          rpc_calls_count INTEGER DEFAULT 0,
          rpc_calls_per_second REAL DEFAULT 0,
          average_processing_time REAL DEFAULT 0,
          memory_usage_mb REAL DEFAULT 0,
          uptime_seconds INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      this.config.enableDatabase = false;
    }
  }

  private initializeInterfaces(): void {
    try {
      for (const [protocol, abi] of Object.entries(this.routerABIs)) {
        this.interfaces[protocol] = new ethers.Interface(abi);
      }
      this.logger.info('ABI interfaces initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing ABI interfaces:', error);
    }
  }

  async start(): Promise<void> {
    try {
      await this.connectWebSocket();
      this.isConnected = true;
      this.healthStatus.isConnected = true;
      this.emit('connected');
      
      // Start health monitoring if enabled
      if (this.config.enableHealthCheck) {
        this.startHealthMonitoring();
      }

      // Start batch processing if enabled
      if (this.config.enableBatchProcessing) {
        this.startBatchProcessing();
      }

      this.logger.info('Mempool monitor started successfully');
    } catch (error) {
      this.logger.error('Failed to start mempool monitor:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsProvider = new ethers.WebSocketProvider(this.config.wsUrl);
        
        this.wsProvider.on('pending', async (txHash: string) => {
          try {
            if (this.config.enableBatchProcessing) {
              this.addToBatchQueue(txHash);
            } else {
              await this.handlePendingTransaction(txHash);
            }
          } catch (error) {
            this.healthStatus.errorsCount++;
            this.logger.error('Error handling pending transaction:', error);
          }
        });

        this.wsProvider.on('error', (error: Error) => {
          this.logger.error('WebSocket error:', error);
          this.healthStatus.errorsCount++;
          this.handleConnectionError(error);
        });

        this.wsProvider.on('close', () => {
          this.logger.info('WebSocket connection closed');
          this.handleConnectionClose();
        });

        // Test connection
        this.wsProvider.getNetwork().then(() => {
          this.logger.info('WebSocket connected to network');
          resolve();
        }).catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  private addToBatchQueue(txHash: string): void {
    this.pendingTransactions.push(txHash);
    
    // Process immediately if batch is full
    if (this.pendingTransactions.length >= this.config.batchSize && !this.processingBatch) {
      this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processingBatch || this.pendingTransactions.length === 0) return;
    
    this.processingBatch = true;
    const batchToProcess = this.pendingTransactions.splice(0, this.config.batchSize);
    
    try {
      await Promise.allSettled(
        batchToProcess.map(txHash => this.handlePendingTransaction(txHash))
      );
    } catch (error) {
      this.logger.error('Error processing transaction batch:', error);
      this.healthStatus.errorsCount++;
    } finally {
      this.processingBatch = false;
    }
  }

  private startBatchProcessing(): void {
    this.batchProcessingInterval = setInterval(() => {
      if (this.pendingTransactions.length > 0 && !this.processingBatch) {
        this.processBatch();
      }
    }, this.config.batchInterval);
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.updateHealthStatus();
      this.emit('healthUpdate', this.healthStatus);
      
      // Store health data in database if enabled
      if (this.config.enableDatabase && this.db) {
        this.saveHealthToDatabase();
      }
    }, this.config.healthCheckInterval);
  }

  private updateHealthStatus(): void {
    const now = Date.now();
    this.healthStatus.uptime = Math.floor((now - this.startTime) / 1000);
    this.healthStatus.memoryUsage = process.memoryUsage();
    this.healthStatus.reconnectAttempts = this.reconnectAttempts;
    
    // Calculate average processing time
    if (this.processingTimes.length > 0) {
      this.healthStatus.averageProcessingTime = 
        this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
      
      // Keep only recent processing times (last 100)
      if (this.processingTimes.length > 100) {
        this.processingTimes = this.processingTimes.slice(-100);
      }
    }
    
    // Calculate RPC calls per second
    const uptimeSeconds = this.healthStatus.uptime;
    if (uptimeSeconds > 0) {
      this.healthStatus.rpcCallsPerSecond = this.healthStatus.rpcCallsCount / uptimeSeconds;
    }
  }

  private saveHealthToDatabase(): void {
    if (!this.db) return;
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO monitor_health (
          id, timestamp, is_connected, reconnect_attempts, transactions_processed,
          errors_count, rpc_calls_count, rpc_calls_per_second, average_processing_time,
          memory_usage_mb, uptime_seconds
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          timestamp = excluded.timestamp,
          is_connected = excluded.is_connected,
          reconnect_attempts = excluded.reconnect_attempts,
          transactions_processed = excluded.transactions_processed,
          errors_count = excluded.errors_count,
          rpc_calls_count = excluded.rpc_calls_count,
          rpc_calls_per_second = excluded.rpc_calls_per_second,
          average_processing_time = excluded.average_processing_time,
          memory_usage_mb = excluded.memory_usage_mb,
          uptime_seconds = excluded.uptime_seconds
      `);

      stmt.run(
        Date.now(),
        this.healthStatus.isConnected,
        this.healthStatus.reconnectAttempts,
        this.healthStatus.transactionsProcessed,
        this.healthStatus.errorsCount,
        this.healthStatus.rpcCallsCount,
        this.healthStatus.rpcCallsPerSecond,
        this.healthStatus.averageProcessingTime,
        this.healthStatus.memoryUsage.heapUsed / 1024 / 1024,
        this.healthStatus.uptime
      );
    } catch (error) {
      this.logger.error('Error saving health data to database:', error);
    }
  }

  private async handlePendingTransaction(txHash: string): Promise<void> {
    if (!this.rateLimiter.checkLimit()) {
      this.logger.warn('Rate limit exceeded, skipping transaction', { txHash });
      return;
    }

    const startTime = Date.now();
    
    try {
      this.rateLimiter.recordCall();
      this.healthStatus.rpcCallsCount++;
      
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return;

      const mempoolTx: MempoolTransaction = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value.toString(),
        gasPrice: tx.gasPrice?.toString() || '0',
        gasLimit: tx.gasLimit.toString(),
        data: tx.data,
        nonce: tx.nonce,
        timestamp: Date.now(),
        ...(tx.blockNumber !== null && { blockNumber: tx.blockNumber }),
        ...(tx.index !== null && { transactionIndex: tx.index }),
        chainId: this.config.chainId,
        ...(tx.type !== null && { type: tx.type }),
        ...(tx.maxFeePerGas && { maxFeePerGas: tx.maxFeePerGas.toString() }),
        ...(tx.maxPriorityFeePerGas && { maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString() })
      };

      // Apply filters
      if (!this.shouldProcessTransaction(mempoolTx)) {
        return;
      }

      // MEV detection if enabled
      if (this.config.enableMevDetection) {
        const isMevProtected = await this.detectMevActivity(mempoolTx);
        if (mempoolTx.decodedData) {
          mempoolTx.decodedData.isMevProtected = isMevProtected;
        }
      }

      // Decode transaction data if enabled
      if (this.config.enableDecoding && tx.data && tx.data !== '0x') {
        const decodedData = await this.decodeTransactionData(tx.to || '', tx.data);
        if (decodedData) {
          mempoolTx.decodedData = { ...mempoolTx.decodedData, ...decodedData };
        }
      }

      // Store in database if enabled
      if (this.config.enableDatabase) {
        await this.saveTransactionToDatabase(mempoolTx, Date.now() - startTime);
      }

      // Update health metrics
      this.healthStatus.transactionsProcessed++;
      this.healthStatus.lastTransactionTime = Date.now();
      this.processingTimes.push(Date.now() - startTime);

      // Emit transaction event
      this.emit('transaction', mempoolTx);

      // Emit specific events for target wallets
      if (this.config.targetWallets.includes(tx.from.toLowerCase())) {
        this.emit('targetWalletTransaction', mempoolTx);
      }

      // Emit DEX transaction events
      if (mempoolTx.decodedData?.isSwap) {
        this.emit('swapTransaction', mempoolTx);
      }

      // Emit MEV events
      if (mempoolTx.decodedData?.isMevProtected) {
        this.emit('mevTransaction', mempoolTx);
      }

    } catch (error) {
      this.healthStatus.errorsCount++;
      this.logger.error('Error processing pending transaction:', error);
    }
  }

  private async detectMevActivity(tx: MempoolTransaction): Promise<boolean> {
    try {
      // Simple MEV detection based on gas price patterns
      const gasPrice = BigInt(tx.gasPrice);
      const averageGasPrice = await this.getAverageGasPrice();
      const gasPricePremium = Number(gasPrice) / averageGasPrice;

      // Check for suspicious gas price patterns
      if (gasPricePremium > this.mevPatterns.frontrunning.minGasPricePremium) {
        this.logger.info('Potential MEV activity detected', {
          hash: tx.hash,
          gasPricePremium: gasPricePremium.toFixed(2)
        });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error detecting MEV activity:', error);
      return false;
    }
  }

  private async getAverageGasPrice(): Promise<number> {
    try {
      const feeData = await this.provider.getFeeData();
      return Number(feeData.gasPrice || 0);
    } catch (error) {
      this.logger.error('Error getting average gas price:', error);
      return 20_000_000_000; // Fallback: 20 gwei
    }
  }

  private async saveTransactionToDatabase(tx: MempoolTransaction, processingTime: number): Promise<void> {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO mempool_transactions (
          hash, from_address, to_address, value, gas_price, gas_limit, data, nonce,
          timestamp, block_number, transaction_index, chain_id, type,
          max_fee_per_gas, max_priority_fee_per_gas, is_target_wallet,
          is_dex_transaction, is_swap, is_liquidity_operation, is_mev_protected,
          decoded_function_name, decoded_dex_protocol, token_in, token_out,
          amount_in, amount_out, processing_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const isTargetWallet = this.config.targetWallets.includes(tx.from.toLowerCase());
      const isDexTransaction = this.config.dexRouters.includes(tx.to.toLowerCase());

      stmt.run(
        tx.hash,
        tx.from,
        tx.to,
        tx.value,
        tx.gasPrice,
        tx.gasLimit,
        tx.data,
        tx.nonce,
        tx.timestamp,
        tx.blockNumber || null,
        tx.transactionIndex || null,
        tx.chainId || null,
        tx.type || null,
        tx.maxFeePerGas || null,
        tx.maxPriorityFeePerGas || null,
        isTargetWallet,
        isDexTransaction,
        tx.decodedData?.isSwap || false,
        tx.decodedData?.isLiquidityOperation || false,
        tx.decodedData?.isMevProtected || false,
        tx.decodedData?.functionName || null,
        tx.decodedData?.dexProtocol || null,
        tx.decodedData?.tokenIn || null,
        tx.decodedData?.tokenOut || null,
        tx.decodedData?.amountIn || null,
        tx.decodedData?.amountOut || null,
        processingTime
      );
    } catch (error) {
      this.logger.error('Error saving transaction to database:', error);
    }
  }

  private shouldProcessTransaction(tx: MempoolTransaction): boolean {
    if (!this.config.enableFiltering) return true;

    try {
      // Filter by minimum transaction value
      const minValue = ethers.parseEther(this.config.minTransactionValue);
      if (BigInt(tx.value) < minValue) return false;

      // Filter by maximum gas price
      const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
      if (BigInt(tx.gasPrice) > maxGasPrice) return false;

      // Filter by target wallets or DEX routers
      const isTargetWallet = this.config.targetWallets.some(wallet => 
        wallet.toLowerCase() === tx.from.toLowerCase()
      );
      const isDexRouter = this.config.dexRouters.some(router => 
        router.toLowerCase() === tx.to.toLowerCase()
      );
      
      if (!isTargetWallet && !isDexRouter) return false;

      return true;
    } catch (error) {
      this.logger.error('Error in transaction filtering:', error);
      return false;
    }
  }

  private async decodeTransactionData(to: string, data: string): Promise<DecodedTransactionData | undefined> {
    try {
      const decodedData: DecodedTransactionData = {
        functionName: '',
        functionSignature: '',
        parameters: [],
        isSwap: false,
        isLiquidityOperation: false
      };

      // Try to decode with different router interfaces
      for (const [routerType, iface] of Object.entries(this.interfaces)) {
        try {
          const decoded = iface.parseTransaction({ data });
          if (decoded) {
            decodedData.functionName = decoded.name;
            decodedData.functionSignature = decoded.signature;
            decodedData.parameters = decoded.args;
            decodedData.dexRouter = to;
            decodedData.dexProtocol = routerType;

            // Extract swap-specific information
            this.extractSwapInfo(decoded, decodedData, routerType);
            
            return decodedData;
          }
        } catch (error) {
          // Continue to next interface
          continue;
        }
      }

      // If no specific router ABI worked, try generic function signature
      const functionSelector = data.slice(0, 10);
      decodedData.functionSignature = functionSelector;
      
      return decodedData;

    } catch (error) {
      this.logger.error('Error decoding transaction data:', error);
      return undefined;
    }
  }

  private extractSwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData,
    routerType: string
  ): void {
    const functionName = decoded.name.toLowerCase();
    
    // Check if it's a swap function
    if (functionName.includes('swap')) {
      decodedData.isSwap = true;

      switch (routerType) {
        case 'uniswapV2':
        case 'sushiswap':
          this.extractUniswapV2SwapInfo(decoded, decodedData);
          break;
        case 'uniswapV3':
          this.extractUniswapV3SwapInfo(decoded, decodedData);
          break;
        case 'balancer':
          this.extractBalancerSwapInfo(decoded, decodedData);
          break;
        case 'curve':
          this.extractCurveSwapInfo(decoded, decodedData);
          break;
        case 'oneinch':
          this.extractOneInchSwapInfo(decoded, decodedData);
          break;
      }
    }

    // Check if it's a liquidity operation
    if (functionName.includes('liquidity') || functionName.includes('mint') || 
        functionName.includes('burn') || functionName.includes('add') || 
        functionName.includes('remove')) {
      decodedData.isLiquidityOperation = true;
    }
  }

  private extractUniswapV2SwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData
  ): void {
    const args = decoded.args;
    
    switch (decoded.name) {
      case 'swapExactTokensForTokens':
        decodedData.amountIn = args[0]?.toString();
        decodedData.amountOutMin = args[1]?.toString();
        decodedData.tokenIn = args[2]?.[0];
        decodedData.tokenOut = args[2]?.[args[2].length - 1];
        decodedData.swapPath = args[2];
        decodedData.recipient = args[3];
        decodedData.deadline = args[4]?.toString();
        break;
      
      case 'swapTokensForExactTokens':
        decodedData.amountOut = args[0]?.toString();
        decodedData.amountInMin = args[1]?.toString();
        decodedData.tokenIn = args[2]?.[0];
        decodedData.tokenOut = args[2]?.[args[2].length - 1];
        decodedData.swapPath = args[2];
        decodedData.recipient = args[3];
        decodedData.deadline = args[4]?.toString();
        break;
      
      case 'swapExactETHForTokens':
        decodedData.tokenIn = 'ETH';
        decodedData.amountOutMin = args[0]?.toString();
        decodedData.tokenOut = args[1]?.[args[1].length - 1];
        decodedData.swapPath = args[1];
        decodedData.recipient = args[2];
        decodedData.deadline = args[3]?.toString();
        break;
      
      case 'swapETHForExactTokens':
        decodedData.tokenIn = 'ETH';
        decodedData.amountOut = args[0]?.toString();
        decodedData.tokenOut = args[1]?.[args[1].length - 1];
        decodedData.swapPath = args[1];
        decodedData.recipient = args[2];
        decodedData.deadline = args[3]?.toString();
        break;
      
      case 'swapExactTokensForETH':
        decodedData.tokenIn = args[2]?.[0];
        decodedData.tokenOut = 'ETH';
        decodedData.amountIn = args[0]?.toString();
        decodedData.amountOutMin = args[1]?.toString();
        decodedData.swapPath = args[2];
        decodedData.recipient = args[3];
        decodedData.deadline = args[4]?.toString();
        break;
      
      case 'swapTokensForExactETH':
        decodedData.tokenIn = args[2]?.[0];
        decodedData.tokenOut = 'ETH';
        decodedData.amountOut = args[0]?.toString();
        decodedData.amountInMin = args[1]?.toString();
        decodedData.swapPath = args[2];
        decodedData.recipient = args[3];
        decodedData.deadline = args[4]?.toString();
        break;
    }
  }

  private extractUniswapV3SwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData
  ): void {
    const args = decoded.args;
    
    switch (decoded.name) {
      case 'exactInputSingle':
        const inputParams = args[0];
        decodedData.tokenIn = inputParams.tokenIn;
        decodedData.tokenOut = inputParams.tokenOut;
        decodedData.fee = inputParams.fee;
        decodedData.amountIn = inputParams.amountIn?.toString();
        decodedData.amountOutMin = inputParams.amountOutMinimum?.toString();
        decodedData.recipient = inputParams.recipient;
        decodedData.deadline = inputParams.deadline?.toString();
        break;
      
      case 'exactOutputSingle':
        const outputParams = args[0];
        decodedData.tokenIn = outputParams.tokenIn;
        decodedData.tokenOut = outputParams.tokenOut;
        decodedData.fee = outputParams.fee;
        decodedData.amountOut = outputParams.amountOut?.toString();
        decodedData.amountInMin = outputParams.amountInMaximum?.toString();
        decodedData.recipient = outputParams.recipient;
        decodedData.deadline = outputParams.deadline?.toString();
        break;
      
      case 'exactInput':
        const multiInputParams = args[0];
        decodedData.amountIn = multiInputParams.amountIn?.toString();
        decodedData.amountOutMin = multiInputParams.amountOutMinimum?.toString();
        decodedData.recipient = multiInputParams.recipient;
        decodedData.deadline = multiInputParams.deadline?.toString();
        // Path decoding for multi-hop swaps would require additional logic
        break;
      
      case 'exactOutput':
        const multiOutputParams = args[0];
        decodedData.amountOut = multiOutputParams.amountOut?.toString();
        decodedData.amountInMin = multiOutputParams.amountInMaximum?.toString();
        decodedData.recipient = multiOutputParams.recipient;
        decodedData.deadline = multiOutputParams.deadline?.toString();
        break;
    }
  }

  private extractBalancerSwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData
  ): void {
    const args = decoded.args;
    
    switch (decoded.name) {
      case 'swap':
        const singleSwap = args[0];
        decodedData.tokenIn = singleSwap.assetIn;
        decodedData.tokenOut = singleSwap.assetOut;
        decodedData.amountIn = singleSwap.amount?.toString();
        decodedData.recipient = args[1].recipient;
        decodedData.deadline = args[3]?.toString();
        break;
      
      case 'batchSwap':
        // Complex multi-hop swap - would need additional parsing
        decodedData.recipient = args[2].recipient;
        decodedData.deadline = args[4]?.toString();
        break;
    }
  }

  private extractCurveSwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData
  ): void {
    const args = decoded.args;
    
    switch (decoded.name) {
      case 'exchange':
      case 'exchange_underlying':
        decodedData.amountIn = args[2]?.toString();
        decodedData.amountOutMin = args[3]?.toString();
        // Token addresses would need to be resolved from pool contract
        break;
    }
  }

  private extractOneInchSwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData
  ): void {
    const args = decoded.args;
    
    switch (decoded.name) {
      case 'swap':
        const desc = args[1];
        decodedData.tokenIn = desc.srcToken;
        decodedData.tokenOut = desc.dstToken;
        decodedData.amountIn = desc.amount?.toString();
        decodedData.amountOutMin = desc.minReturnAmount?.toString();
        decodedData.recipient = desc.dstReceiver;
        break;
      
      case 'unoswap':
        decodedData.tokenIn = args[0];
        decodedData.amountIn = args[1]?.toString();
        decodedData.amountOutMin = args[2]?.toString();
        break;
    }
  }

  private handleConnectionError(error: Error): void {
    this.logger.error('WebSocket connection error:', error);
    this.isConnected = false;
    this.healthStatus.isConnected = false;
    this.healthStatus.errorsCount++;
    this.emit('disconnected', error);
    this.attemptReconnect();
  }

  private handleConnectionClose(): void {
    this.logger.info('WebSocket connection closed');
    this.isConnected = false;
    this.healthStatus.isConnected = false;
    this.emit('disconnected');
    this.attemptReconnect();
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    this.healthStatus.reconnectAttempts = this.reconnectAttempts;
    this.logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);

    // Calculate exponential backoff with max delay
    this.currentReconnectDelay = Math.min(
      this.config.retryDelay * Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    setTimeout(async () => {
      try {
        await this.connectWebSocket();
        this.isConnected = true;
        this.healthStatus.isConnected = true;
        this.reconnectAttempts = 0;
        this.currentReconnectDelay = this.config.retryDelay;
        this.emit('reconnected');
        this.logger.info('Successfully reconnected to WebSocket');
      } catch (error) {
        this.logger.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, this.currentReconnectDelay);
  }

  // Enhanced public methods
  addTargetWallet(address: string): void {
    const lowercaseAddress = address.toLowerCase();
    if (!this.config.targetWallets.includes(lowercaseAddress)) {
      this.config.targetWallets.push(lowercaseAddress);
      this.emit('targetWalletAdded', address);
      this.logger.info('Target wallet added', { address });
    }
  }

  removeTargetWallet(address: string): void {
    const lowercaseAddress = address.toLowerCase();
    const index = this.config.targetWallets.indexOf(lowercaseAddress);
    if (index > -1) {
      this.config.targetWallets.splice(index, 1);
      this.emit('targetWalletRemoved', address);
      this.logger.info('Target wallet removed', { address });
    }
  }

  getTargetWallets(): string[] {
    return [...this.config.targetWallets];
  }

  addDexRouter(address: string): void {
    const lowercaseAddress = address.toLowerCase();
    if (!this.config.dexRouters.includes(lowercaseAddress)) {
      this.config.dexRouters.push(lowercaseAddress);
      this.emit('dexRouterAdded', address);
      this.logger.info('DEX router added', { address });
    }
  }

  removeDexRouter(address: string): void {
    const lowercaseAddress = address.toLowerCase();
    const index = this.config.dexRouters.indexOf(lowercaseAddress);
    if (index > -1) {
      this.config.dexRouters.splice(index, 1);
      this.emit('dexRouterRemoved', address);
      this.logger.info('DEX router removed', { address });
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getHealthStatus(): HealthStatus {
    this.updateHealthStatus();
    return { ...this.healthStatus };
  }

  getRateLimitStatus(): {
    remainingTokens: number;
    timeUntilReset: number;
    callsPerSecond: number;
  } {
    return {
      remainingTokens: this.rateLimiter.getCurrentCount(),
      timeUntilReset: this.rateLimiter.getTimeUntilReset(),
      callsPerSecond: this.config.maxRpcCallsPerSecond
    };
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping mempool monitor...');
      
      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      if (this.batchProcessingInterval) {
        clearInterval(this.batchProcessingInterval);
        this.batchProcessingInterval = null;
      }

      // Process any remaining batched transactions
      if (this.pendingTransactions.length > 0) {
        await this.processBatch();
      }

      // Close WebSocket connection
      if (this.wsProvider) {
        await this.wsProvider.destroy();
        this.wsProvider = null;
      }

      // Close database connection
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.isConnected = false;
      this.healthStatus.isConnected = false;
      this.emit('stopped');
      this.logger.info('Mempool monitor stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping mempool monitor:', error);
      throw error;
    }
  }

  updateConfig(newConfig: Partial<MonitorConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Update rate limiter if maxRpcCallsPerSecond changed
    if (newConfig.maxRpcCallsPerSecond && newConfig.maxRpcCallsPerSecond !== oldConfig.maxRpcCallsPerSecond) {
      this.rateLimiter = new TokenBucketRateLimiter(
        newConfig.maxRpcCallsPerSecond,
        newConfig.maxRpcCallsPerSecond
      );
    }
    
    this.emit('configUpdated', this.config);
    this.logger.info('Configuration updated', { changes: newConfig });
  }

  getStats(): {
    isConnected: boolean;
    reconnectAttempts: number;
    targetWallets: number;
    dexRouters: number;
    transactionsProcessed: number;
    errorsCount: number;
    averageProcessingTime: number;
    rpcCallsPerSecond: number;
    uptime: number;
    memoryUsageMB: number;
  } {
    this.updateHealthStatus();
    
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      targetWallets: this.config.targetWallets.length,
      dexRouters: this.config.dexRouters.length,
      transactionsProcessed: this.healthStatus.transactionsProcessed,
      errorsCount: this.healthStatus.errorsCount,
      averageProcessingTime: this.healthStatus.averageProcessingTime,
      rpcCallsPerSecond: this.healthStatus.rpcCallsPerSecond,
      uptime: this.healthStatus.uptime,
      memoryUsageMB: this.healthStatus.memoryUsage.heapUsed / 1024 / 1024
    };
  }

  // Database query methods
  async getTransactionHistory(limit: number = 100, offset: number = 0): Promise<any[]> {
    if (!this.db) return [];
    
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM mempool_transactions 
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `);
      return stmt.all(limit, offset);
    } catch (error) {
      this.logger.error('Error querying transaction history:', error);
      return [];
    }
  }

  async getTargetWalletTransactions(walletAddress: string, limit: number = 100): Promise<any[]> {
    if (!this.db) return [];
    
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM mempool_transactions 
        WHERE from_address = ? AND is_target_wallet = 1
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      return stmt.all(walletAddress.toLowerCase(), limit);
    } catch (error) {
      this.logger.error('Error querying target wallet transactions:', error);
      return [];
    }
  }

  async getSwapTransactions(limit: number = 100): Promise<any[]> {
    if (!this.db) return [];
    
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM mempool_transactions 
        WHERE is_swap = 1
        ORDER BY timestamp DESC 
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      this.logger.error('Error querying swap transactions:', error);
      return [];
    }
  }

  async cleanupOldTransactions(olderThanDays: number = 30): Promise<void> {
    if (!this.db) return;
    
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const stmt = this.db.prepare('DELETE FROM mempool_transactions WHERE timestamp < ?');
      const result = stmt.run(cutoffTime);
      
      this.logger.info(`Cleaned up ${result.changes} old transactions`);
    } catch (error) {
      this.logger.error('Error cleaning up old transactions:', error);
    }
  }
}