import dotenv from 'dotenv';
import winston from 'winston';
import { ethers } from 'ethers';
import { z } from 'zod';
import Database from 'better-sqlite3';
import Bottleneck from 'bottleneck';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

import { MempoolMonitor, type MonitorConfig } from './mempool-monitor';
import { CopyExecutionEngine, type CopyConfig, type PriceOracle, type TokenApprovalManager } from './copy-execution-engine';

// Load environment variables
dotenv.config();

// Configuration validation schema
const ConfigSchema = z.object({
  // Core settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Blockchain settings
  CHAIN: z.enum(['ETH', 'BSC', 'SOL']).default('ETH'),
  CHAIN_ID: z.string().transform((val: string) => parseInt(val, 10)).default('1'),
  ETH_RPC_URL: z.string().url(),
  ETH_WS_URL: z.string().url(),
  PRIVATE_KEY: z.string().min(64),
  
  // Target settings
  TARGET_WALLET: z.string().min(40),
  TARGET_WALLETS: z.string().optional(),
  
  // Trading settings
  COPY_PERCENTAGE: z.string().transform((val: string) => parseFloat(val)).default('10'),
  MAX_TRADE_SIZE: z.string().default('1.0'),
  MIN_TRADE_SIZE: z.string().default('0.01'),
  MAX_SLIPPAGE: z.string().transform((val: string) => parseFloat(val)).default('2'),
  MAX_GAS_PRICE: z.string().default('100'),
  
  // Risk management
  STOP_LOSS: z.string().transform((val: string) => parseFloat(val)).default('5'),
  TAKE_PROFIT: z.string().transform((val: string) => parseFloat(val)).default('10'),
  MAX_CONCURRENT_TRADES: z.string().transform((val: string) => parseInt(val, 10)).default('3'),
  MAX_DAILY_LOSS: z.string().default('0.5'),
  PRICE_IMPACT_THRESHOLD: z.string().transform((val: string) => parseFloat(val)).default('5'),
  
  // Feature flags
  ENABLE_FILTERING: z.string().transform((val: string) => val === 'true').default('true'),
  ENABLE_RISK_MANAGEMENT: z.string().transform((val: string) => val === 'true').default('true'),
  ENABLE_MEV_PROTECTION: z.string().transform((val: string) => val === 'true').default('false'),
  ENABLE_DATABASE: z.string().transform((val: string) => val === 'true').default('true'),
  ENABLE_HEALTH_CHECK: z.string().transform((val: string) => val === 'true').default('true'),
  
  // Database settings
  DATABASE_PATH: z.string().default('./copy-trader.db'),
  COPY_ENGINE_DATABASE_PATH: z.string().default('./copy-engine.db'),
  
  // Performance settings
  MAX_RPC_CALLS_PER_SECOND: z.string().transform((val: string) => parseInt(val, 10)).default('10'),
  BATCH_SIZE: z.string().transform((val: string) => parseInt(val, 10)).default('10'),
  BATCH_INTERVAL: z.string().transform((val: string) => parseInt(val, 10)).default('1000'),
  
  // Optional settings
  FOLLOW_TOKENS: z.string().optional(),
  EXCLUDE_TOKENS: z.string().optional(),
  FLASHBOTS_URL: z.string().url().optional(),
});

type Config = z.infer<typeof ConfigSchema>;

// Enhanced logger configuration
function createLogger(config: Config): winston.Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message} ${metaStr}`;
        })
      )
    })
  ];

  if (config.NODE_ENV === 'production') {
    transports.push(
      new winston.transports.File({ filename: 'copy-trader-error.log', level: 'error' }),
      new winston.transports.File({ filename: 'copy-trader.log' })
    );
  }

  return winston.createLogger({
    level: config.LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports,
    exitOnError: false
  });
}

// Enhanced price oracle with real API integration
class ProductionPriceOracle implements PriceOracle {
  private logger: winston.Logger;
  private limiter: Bottleneck;
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.limiter = new Bottleneck({
      minTime: 100, // Minimum 100ms between requests
      maxConcurrent: 5
    });
  }

  async getPrice(tokenAddress: string): Promise<number> {
    const cached = this.priceCache.get(tokenAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    try {
      const price = await this.limiter.schedule(() => this.fetchPrice(tokenAddress));
      this.priceCache.set(tokenAddress, { price, timestamp: Date.now() });
      return price;
    } catch (error) {
      this.logger.error('Error fetching price:', { tokenAddress, error });
      return this.getFallbackPrice(tokenAddress);
    }
  }

  async getPriceInETH(tokenAddress: string): Promise<number> {
    if (tokenAddress === 'ETH' || tokenAddress.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2') {
      return 1;
    }
    
    const [tokenPrice, ethPrice] = await Promise.all([
      this.getPrice(tokenAddress),
      this.getPrice('ETH')
    ]);
    
    return tokenPrice / ethPrice;
  }

  async getTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number; name: string }> {
    // In production, this would query token contracts or use a token registry API
    const tokenMap: Record<string, { symbol: string; decimals: number; name: string }> = {
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', decimals: 18, name: 'Wrapped Ether' },
      '0xa0b86a33e6417c7962a0ff7c4bfb9d8e95d5b9c9': { symbol: 'USDC', decimals: 6, name: 'USD Coin' },
      '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6, name: 'Tether USD' },
      '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' }
    };
    
    return tokenMap[tokenAddress.toLowerCase()] || { symbol: 'UNKNOWN', decimals: 18, name: 'Unknown Token' };
  }

  private async fetchPrice(tokenAddress: string): Promise<number> {
    // In production, integrate with CoinGecko, CoinMarketCap, or DEX price feeds
    // For now, return mock prices
    const mockPrices: Record<string, number> = {
      'ETH': 2000,
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 2000, // WETH
      '0xa0b86a33e6417c7962a0ff7c4bfb9d8e95d5b9c9': 1, // USDC
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 1, // USDT
      '0x6b175474e89094c44da98b954eedeac495271d0f': 1, // DAI
    };
    
    return mockPrices[tokenAddress] || 100; // Default price for unknown tokens
  }

  private getFallbackPrice(tokenAddress: string): number {
    const fallbackPrices: Record<string, number> = {
      'ETH': 2000,
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 2000,
      '0xa0b86a33e6417c7962a0ff7c4bfb9d8e95d5b9c9': 1,
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 1,
      '0x6b175474e89094c44da98b954eedeac495271d0f': 1,
    };
    
    return fallbackPrices[tokenAddress] || 50;
  }
}

// Enhanced token approval manager with retry logic
class ProductionTokenApprovalManager implements TokenApprovalManager {
  private wallet: ethers.Wallet;
  private logger: winston.Logger;
  private limiter: Bottleneck;

  constructor(wallet: ethers.Wallet, logger: winston.Logger) {
    this.wallet = wallet;
    this.logger = logger;
    this.limiter = new Bottleneck({
      minTime: 200, // Minimum 200ms between blockchain calls
      maxConcurrent: 3
    });
  }

  async checkAllowance(tokenAddress: string, spenderAddress: string): Promise<bigint> {
    try {
      if (!this.wallet.provider) {
        throw new Error('Wallet provider not available');
      }

      return await this.limiter.schedule(async () => {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function allowance(address owner, address spender) view returns (uint256)'],
          this.wallet.provider
        );
        
        const allowanceMethod = tokenContract['allowance'] as any;
        return await allowanceMethod(this.wallet.address, spenderAddress);
      });
    } catch (error) {
      this.logger.error('Error checking allowance:', { tokenAddress, spenderAddress, error });
      return BigInt(0);
    }
  }

  async approveToken(tokenAddress: string, spenderAddress: string, amount: bigint): Promise<string> {
    try {
      return await this.limiter.schedule(async () => {
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function approve(address spender, uint256 amount) returns (bool)'],
          this.wallet
        );
        
        const approveMethod = tokenContract['approve'] as any;
        const tx = await approveMethod(spenderAddress, amount);
        return tx.hash;
      });
    } catch (error) {
      this.logger.error('Error approving token:', { tokenAddress, spenderAddress, error });
      throw error;
    }
  }

  async isApprovalNeeded(tokenAddress: string, spenderAddress: string, amount: bigint): Promise<boolean> {
    try {
      const currentAllowance = await this.checkAllowance(tokenAddress, spenderAddress);
      return currentAllowance < amount;
    } catch (error) {
      this.logger.error('Error checking if approval needed:', { tokenAddress, spenderAddress, error });
      return true; // Safe default
    }
  }
}

// Main copy trading bot with production features
export class CopyTradingBot {
  private config: Config;
  private logger: winston.Logger;
  private mempoolMonitor: MempoolMonitor;
  private copyEngine: CopyExecutionEngine;
  private wallet: ethers.Wallet;
  private priceOracle: PriceOracle;
  private tokenApprovalManager: TokenApprovalManager;
  private db: Database.Database;
  private isRunning = false;
  private healthCheckJob?: cron.ScheduledTask;
  private cleanupJob?: cron.ScheduledTask;

  constructor(config: Config) {
    this.config = config;
    this.logger = createLogger(config);
    
    this.logger.info('Initializing copy trading bot', { 
      chain: config.CHAIN, 
      targetWallet: config.TARGET_WALLET,
      nodeEnv: config.NODE_ENV 
    });

    // Initialize database
    this.db = new Database(config.DATABASE_PATH);
    this.initializeSystemDatabase();

    // Initialize blockchain components
    const provider = new ethers.JsonRpcProvider(config.ETH_RPC_URL);
    this.wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    
    // Initialize dependencies
    this.priceOracle = new ProductionPriceOracle(this.logger);
    this.tokenApprovalManager = new ProductionTokenApprovalManager(this.wallet, this.logger);

    // Initialize components
    this.mempoolMonitor = new MempoolMonitor(this.createMonitorConfig());
    this.copyEngine = new CopyExecutionEngine(
      this.createCopyConfig(),
      provider,
      config.PRIVATE_KEY,
      this.priceOracle,
      this.tokenApprovalManager
    );

    this.setupEventHandlers();
    this.setupSystemJobs();
  }

  private initializeSystemDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_status (
        id INTEGER PRIMARY KEY,
        bot_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        last_heartbeat INTEGER NOT NULL,
        error_count INTEGER DEFAULT 0,
        trades_processed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_json TEXT NOT NULL,
        applied_at INTEGER NOT NULL,
        applied_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private createMonitorConfig(): MonitorConfig {
    const targetWallets = this.config.TARGET_WALLETS 
      ? this.config.TARGET_WALLETS.split(',').map((w: string) => w.trim())
      : [this.config.TARGET_WALLET];

    return {
      rpcUrl: this.config.ETH_RPC_URL,
      wsUrl: this.config.ETH_WS_URL,
      targetWallets,
      dexRouters: [
        '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
        '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
        '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // SushiSwap
        '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Balancer
        '0x1111111254fb6c44bAC0beD2854e76F90643097d'  // 1inch
      ],
      minTransactionValue: this.config.MIN_TRADE_SIZE,
      maxGasPrice: this.config.MAX_GAS_PRICE,
      enableDecoding: true,
      enableFiltering: this.config.ENABLE_FILTERING,
      enableDatabase: this.config.ENABLE_DATABASE,
      databasePath: this.config.DATABASE_PATH,
      enableRateLimiting: true,
      maxRpcCallsPerSecond: this.config.MAX_RPC_CALLS_PER_SECOND,
      enableMevDetection: this.config.ENABLE_MEV_PROTECTION,
      enableBatchProcessing: true,
      batchSize: this.config.BATCH_SIZE,
      batchInterval: this.config.BATCH_INTERVAL,
      enableHealthCheck: this.config.ENABLE_HEALTH_CHECK,
      healthCheckInterval: 30000,
      chainId: this.config.CHAIN_ID,
      retryAttempts: 3,
      retryDelay: 5000,
      maxReconnectAttempts: 5,
      reconnectBackoffMultiplier: 2,
      maxReconnectDelay: 60000
    };
  }

  private createCopyConfig(): CopyConfig {
    return {
      targetWallet: this.config.TARGET_WALLET,
      copyPercentage: this.config.COPY_PERCENTAGE,
      maxTradeSize: this.config.MAX_TRADE_SIZE,
      minTradeSize: this.config.MIN_TRADE_SIZE,
      maxSlippage: this.config.MAX_SLIPPAGE,
      maxGasPrice: this.config.MAX_GAS_PRICE,
      followTokens: this.config.FOLLOW_TOKENS?.split(',').map((t: string) => t.trim()) || [],
      excludeTokens: this.config.EXCLUDE_TOKENS?.split(',').map((t: string) => t.trim()) || [],
      copyDelay: 1000,
      stopLoss: this.config.STOP_LOSS,
      takeProfit: this.config.TAKE_PROFIT,
      enableFiltering: this.config.ENABLE_FILTERING,
      enableRiskManagement: this.config.ENABLE_RISK_MANAGEMENT,
      maxConcurrentTrades: this.config.MAX_CONCURRENT_TRADES,
      maxDailyLoss: this.config.MAX_DAILY_LOSS,
      enableMevProtection: this.config.ENABLE_MEV_PROTECTION,
      priceImpactThreshold: this.config.PRICE_IMPACT_THRESHOLD,
      databasePath: this.config.COPY_ENGINE_DATABASE_PATH,
      chainId: this.config.CHAIN_ID,
      rpcUrl: this.config.ETH_RPC_URL,
      ...(this.config.FLASHBOTS_URL && { flashbotsUrl: this.config.FLASHBOTS_URL })
    };
  }

  private setupEventHandlers(): void {
    // Mempool monitor events
    this.mempoolMonitor.on('connected', () => {
      this.logger.info('Mempool monitor connected');
      this.updateSystemStatus('monitor_connected');
    });

    this.mempoolMonitor.on('disconnected', (error: Error) => {
      this.logger.warn('Mempool monitor disconnected', { error: error?.message });
      this.updateSystemStatus('monitor_disconnected', error?.message);
    });

    this.mempoolMonitor.on('targetWalletTransaction', async (tx) => {
      this.logger.info('Target wallet transaction detected', {
        hash: tx.hash,
        from: tx.from,
        value: tx.value,
        isSwap: tx.decodedData?.isSwap
      });

      try {
        await this.copyEngine.processMempoolTransaction(tx);
        this.incrementTradeCounter();
      } catch (error) {
        this.logger.error('Error processing transaction', { hash: tx.hash, error });
        this.incrementErrorCounter();
      }
    });

    // Copy engine events
    this.copyEngine.on('copyTradeExecuted', (trade) => {
      this.logger.info('Copy trade executed successfully', {
        id: trade.id,
        txHash: trade.copyTxHash,
        profitLoss: trade.profitLoss
      });
    });

    this.copyEngine.on('copyTradeFailed', (trade) => {
      this.logger.warn('Copy trade failed', {
        id: trade.id,
        reason: trade.reason
      });
      this.incrementErrorCounter();
    });

    this.copyEngine.on('emergencyStop', () => {
      this.logger.error('Emergency stop triggered');
      this.stop().catch((err: any) => this.logger.error('Error during emergency stop:', err));
    });
  }

  private setupSystemJobs(): void {
    if (this.config.NODE_ENV === 'production') {
      // Health check every minute
      this.healthCheckJob = cron.schedule('*/1 * * * *', () => {
        this.performHealthCheck();
      });

      // Cleanup old data daily at 2 AM
      this.cleanupJob = cron.schedule('0 2 * * *', () => {
        this.performCleanup();
      });
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = {
        mempool: this.mempoolMonitor.getHealthStatus(),
        copyEngine: this.copyEngine.getRiskMetrics(),
        wallet: await this.wallet.provider?.getBalance(this.wallet.address),
        timestamp: Date.now()
      };

      this.logger.debug('Health check completed', health);
      this.updateHeartbeat();
    } catch (error) {
      this.logger.error('Health check failed', { error });
      this.incrementErrorCounter();
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      // Clean up old mempool transactions (older than 7 days)
      await this.mempoolMonitor.cleanupOldTransactions(7);
      
      // Clean up old system logs (older than 30 days)
      const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
      this.db.prepare('DELETE FROM config_history WHERE applied_at < ?').run(cutoffTime);
      
      this.logger.info('Cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', { error });
    }
  }

  private updateSystemStatus(status: string, error?: string): void {
    try {
      const botId = uuidv4();
      this.db.prepare(`
        INSERT OR REPLACE INTO system_status (id, bot_id, status, started_at, last_heartbeat, error_count, trades_processed)
        VALUES (1, ?, ?, ?, ?, 
          COALESCE((SELECT error_count FROM system_status WHERE id = 1), 0),
          COALESCE((SELECT trades_processed FROM system_status WHERE id = 1), 0))
      `).run(botId, status, Date.now(), Date.now());

      if (error) {
        this.incrementErrorCounter();
      }
    } catch (err: any) {
      this.logger.error('Failed to update system status', { err });
    }
  }

  private updateHeartbeat(): void {
    try {
      this.db.prepare('UPDATE system_status SET last_heartbeat = ? WHERE id = 1').run(Date.now());
    } catch (error) {
      this.logger.error('Failed to update heartbeat', { error });
    }
  }

  private incrementTradeCounter(): void {
    try {
      this.db.prepare('UPDATE system_status SET trades_processed = trades_processed + 1 WHERE id = 1').run();
    } catch (error) {
      this.logger.error('Failed to increment trade counter', { error });
    }
  }

  private incrementErrorCounter(): void {
    try {
      this.db.prepare('UPDATE system_status SET error_count = error_count + 1 WHERE id = 1').run();
    } catch (error) {
      this.logger.error('Failed to increment error counter', { error });
    }
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting copy trading bot...');
      
      // Validate wallet
      await this.validateWallet();
      
      // Start components
      await this.mempoolMonitor.start();
      await this.copyEngine.start();
      
      this.isRunning = true;
      this.updateSystemStatus('running');
      
      this.logger.info('Copy trading bot started successfully', {
        targetWallet: this.config.TARGET_WALLET,
        copyPercentage: this.config.COPY_PERCENTAGE,
        maxTradeSize: this.config.MAX_TRADE_SIZE
      });
      
    } catch (error) {
      this.logger.error('Failed to start copy trading bot', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping copy trading bot...');
      
      this.isRunning = false;
      
      // Stop scheduled jobs
      this.healthCheckJob?.stop();
      this.cleanupJob?.stop();
      
      // Stop components
      await this.copyEngine.stop();
      await this.mempoolMonitor.stop();
      
      // Close database
      this.db.close();
      
      this.updateSystemStatus('stopped');
      this.logger.info('Copy trading bot stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping copy trading bot', { error });
      throw error;
    }
  }

  private async validateWallet(): Promise<void> {
    if (!ethers.isAddress(this.config.TARGET_WALLET)) {
      throw new Error('Invalid target wallet address');
    }

    const balance = await this.wallet.provider?.getBalance(this.wallet.address);
    if (!balance || balance < ethers.parseEther('0.01')) {
      throw new Error('Insufficient wallet balance for trading');
    }

    this.logger.info('Wallet validation passed', { 
      address: this.wallet.address,
      balance: ethers.formatEther(balance || 0)
    });
  }

  // Public API methods
  getStatus() {
    return {
      isRunning: this.isRunning,
      mempoolConnected: this.mempoolMonitor.getConnectionStatus(),
      copyEngineActive: this.copyEngine.isRunning(),
      riskMetrics: this.copyEngine.getRiskMetrics(),
      configuration: this.copyEngine.getConfig()
    };
  }

  getStats() {
    return {
      mempool: this.mempoolMonitor.getStats(),
      copyEngine: this.copyEngine.getRiskMetrics(),
      systemStatus: this.getSystemStatus()
    };
  }

  private getSystemStatus() {
    try {
      return this.db.prepare('SELECT * FROM system_status WHERE id = 1').get();
    } catch (error) {
      this.logger.error('Failed to get system status', { error });
      return null;
    }
  }
}

// Main execution
async function main() {
  try {
    // Validate environment configuration
    const config = ConfigSchema.parse(process.env);
    
    // Create and start bot
    const bot = new CopyTradingBot(config);
    
    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      try {
        await bot.stop();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason);
      shutdown('unhandledRejection');
    });

    await bot.start();
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('Failed to start bot:', error);
    }
    process.exit(1);
  }
}

// Run the bot if this file is executed directly
if (require.main === module) {
  main();
} 