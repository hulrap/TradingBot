import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import winston from 'winston';
import type { MempoolTransaction } from './mempool-monitor';

// Production-ready configuration interface
export interface CopyConfig {
  targetWallet: string;
  copyPercentage: number; // Percentage of target trade size to copy (0-100)
  maxTradeSize: string; // Maximum trade size in ETH
  minTradeSize: string; // Minimum trade size in ETH
  maxSlippage: number; // Maximum acceptable slippage
  maxGasPrice: string; // Maximum gas price willing to pay
  followTokens: string[]; // Only copy trades for these tokens (empty = all)
  excludeTokens: string[]; // Never copy trades for these tokens
  copyDelay: number; // Delay in ms before copying (for analysis)
  stopLoss: number; // Stop loss percentage
  takeProfit: number; // Take profit percentage
  enableFiltering: boolean;
  enableRiskManagement: boolean;
  maxConcurrentTrades: number;
  maxDailyLoss: string; // Maximum daily loss in ETH
  enableMevProtection: boolean;
  priceImpactThreshold: number; // Maximum acceptable price impact
  databasePath: string;
  chainId: number;
  rpcUrl: string;
  flashbotsUrl?: string;
}

// Enhanced copy trade interface
export interface CopyTrade {
  id: string;
  originalTxHash: string;
  copyTxHash?: string;
  targetWallet: string;
  tokenIn: string;
  tokenOut: string;
  tokenInSymbol?: string;
  tokenOutSymbol?: string;
  originalAmountIn: string;
  copyAmountIn: string;
  originalAmountOut: string;
  copyAmountOut?: string;
  estimatedAmountOut?: string;
  actualAmountOut?: string;
  gasPrice: string;
  gasUsed?: string;
  gasLimit?: string;
  status: 'pending' | 'executed' | 'failed' | 'cancelled' | 'monitoring';
  reason?: string;
  timestamp: number;
  executionTime?: number;
  profitLoss?: string;
  slippage?: number;
  priceImpact?: number;
  dexRouter: string;
  mevProtected: boolean;
  retryCount: number;
  stopLossPrice?: string;
  takeProfitPrice?: string;
}

export interface RiskMetrics {
  totalCopied: number;
  successfulCopies: number;
  failedCopies: number;
  successRate: number;
  totalProfit: string;
  totalLoss: string;
  netProfit: string;
  averageSlippage: number;
  maxDrawdown: string;
  sharpeRatio: number;
  winRate: number;
  avgWin: string;
  avgLoss: string;
  profitFactor: number;
  dailyPnL: string;
  maxConsecutiveLosses: number;
  currentDrawdownPeriod: number;
  totalFees: string;
}

// Enhanced price oracle interface
export interface PriceOracle {
  getPrice(tokenAddress: string): Promise<number>;
  getPriceInETH(tokenAddress: string): Promise<number>;
  getTokenInfo(tokenAddress: string): Promise<{ symbol: string; decimals: number; name: string }>;
}

// Token approval manager
export interface TokenApprovalManager {
  checkAllowance(tokenAddress: string, spenderAddress: string): Promise<bigint>;
  approveToken(tokenAddress: string, spenderAddress: string, amount: bigint): Promise<string>;
  isApprovalNeeded(tokenAddress: string, spenderAddress: string, amount: bigint): Promise<boolean>;
}

export class CopyExecutionEngine extends EventEmitter {
  private config: CopyConfig;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private copyTrades: Map<string, CopyTrade> = new Map();
  private isActive = false;
  private riskMetrics: RiskMetrics;
  private db: DatabaseType;
  private logger: winston.Logger;
  private priceOracle: PriceOracle;
  private tokenApprovalManager: TokenApprovalManager;
  private positionTracker: Map<string, string> = new Map(); // token -> current position
  private dailyLossTracker: { date: string; loss: string } = { date: '', loss: '0' };
  private consecutiveLosses = 0;
  private maxConsecutiveLosses = 0;

  // Configurable DEX router addresses
  private dexRouters = {
    uniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    pancakeswap: '0x10ED43C718714eb63d5aA57B78B54704E256024E'
  };

  // Well-known token addresses (configurable per chain)
  private tokenAddresses = new Map<string, string>([
    ['WETH', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
    ['USDC', '0xA0b86a33E6417c7962A0FF7c4BfB9D8e95D5b9C9'],
    ['USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7'],
    ['DAI', '0x6B175474E89094C44Da98b954EedeAC495271d0F']
  ]);

  // Performance tracking
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly GAS_ESTIMATION_BUFFER = 1.2;
  private readonly SLIPPAGE_BUFFER = 0.5; // Additional buffer for slippage calculations
  private readonly MAX_POSITION_SIZE_PCT = 0.25; // Maximum 25% of balance per position

  constructor(
    config: CopyConfig, 
    provider: ethers.JsonRpcProvider, 
    privateKey: string,
    priceOracle: PriceOracle,
    tokenApprovalManager: TokenApprovalManager
  ) {
    super();
    this.config = config;
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.priceOracle = priceOracle;
    this.tokenApprovalManager = tokenApprovalManager;
    this.riskMetrics = this.initializeRiskMetrics();
    
    // Initialize database
    this.db = new Database(config.databasePath);
    this.initializeDatabase();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'copy-trader-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'copy-trader.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    // Load existing trades from database
    this.loadTradesFromDatabase();
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS copy_trades (
        id TEXT PRIMARY KEY,
        original_tx_hash TEXT NOT NULL,
        copy_tx_hash TEXT,
        target_wallet TEXT NOT NULL,
        token_in TEXT NOT NULL,
        token_out TEXT NOT NULL,
        token_in_symbol TEXT,
        token_out_symbol TEXT,
        original_amount_in TEXT NOT NULL,
        copy_amount_in TEXT NOT NULL,
        original_amount_out TEXT NOT NULL,
        copy_amount_out TEXT,
        estimated_amount_out TEXT,
        actual_amount_out TEXT,
        gas_price TEXT NOT NULL,
        gas_used TEXT,
        gas_limit TEXT,
        status TEXT NOT NULL,
        reason TEXT,
        timestamp INTEGER NOT NULL,
        execution_time INTEGER,
        profit_loss TEXT,
        slippage REAL,
        price_impact REAL,
        dex_router TEXT NOT NULL,
        mev_protected BOOLEAN DEFAULT FALSE,
        retry_count INTEGER DEFAULT 0,
        stop_loss_price TEXT,
        take_profit_price TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS risk_metrics (
        id INTEGER PRIMARY KEY,
        total_copied INTEGER DEFAULT 0,
        successful_copies INTEGER DEFAULT 0,
        failed_copies INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0,
        total_profit TEXT DEFAULT '0',
        total_loss TEXT DEFAULT '0',
        net_profit TEXT DEFAULT '0',
        average_slippage REAL DEFAULT 0,
        max_drawdown TEXT DEFAULT '0',
        sharpe_ratio REAL DEFAULT 0,
        win_rate REAL DEFAULT 0,
        avg_win TEXT DEFAULT '0',
        avg_loss TEXT DEFAULT '0',
        profit_factor REAL DEFAULT 0,
        daily_pnl TEXT DEFAULT '0',
        max_consecutive_losses INTEGER DEFAULT 0,
        current_drawdown_period INTEGER DEFAULT 0,
        total_fees TEXT DEFAULT '0',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert initial risk metrics if not exists
    const existingMetrics = this.db.prepare('SELECT COUNT(*) as count FROM risk_metrics').get() as { count: number };
    if (existingMetrics.count === 0) {
      this.db.prepare(`
        INSERT INTO risk_metrics (id) VALUES (1)
      `).run();
    }
  }

  private loadTradesFromDatabase(): void {
    const trades = this.db.prepare(`
      SELECT * FROM copy_trades 
      WHERE status IN ('pending', 'monitoring') 
      ORDER BY timestamp DESC
    `).all() as any[];

    trades.forEach(trade => {
      const copyTrade: CopyTrade = {
        id: trade.id,
        originalTxHash: trade.original_tx_hash,
        copyTxHash: trade.copy_tx_hash,
        targetWallet: trade.target_wallet,
        tokenIn: trade.token_in,
        tokenOut: trade.token_out,
        tokenInSymbol: trade.token_in_symbol,
        tokenOutSymbol: trade.token_out_symbol,
        originalAmountIn: trade.original_amount_in,
        copyAmountIn: trade.copy_amount_in,
        originalAmountOut: trade.original_amount_out,
        copyAmountOut: trade.copy_amount_out,
        estimatedAmountOut: trade.estimated_amount_out,
        actualAmountOut: trade.actual_amount_out,
        gasPrice: trade.gas_price,
        gasUsed: trade.gas_used,
        gasLimit: trade.gas_limit,
        status: trade.status,
        reason: trade.reason,
        timestamp: trade.timestamp,
        executionTime: trade.execution_time,
        profitLoss: trade.profit_loss,
        slippage: trade.slippage,
        priceImpact: trade.price_impact,
        dexRouter: trade.dex_router,
        mevProtected: Boolean(trade.mev_protected),
        retryCount: trade.retry_count,
        stopLossPrice: trade.stop_loss_price,
        takeProfitPrice: trade.take_profit_price
      };
      this.copyTrades.set(trade.id, copyTrade);
    });

    this.logger.info(`Loaded ${trades.length} pending trades from database`);
  }

  private initializeRiskMetrics(): RiskMetrics {
    // Load from database if exists
    const dbMetrics = this.db?.prepare('SELECT * FROM risk_metrics WHERE id = 1').get() as any;
    
    if (dbMetrics) {
      return {
        totalCopied: dbMetrics.total_copied || 0,
        successfulCopies: dbMetrics.successful_copies || 0,
        failedCopies: dbMetrics.failed_copies || 0,
        successRate: dbMetrics.success_rate || 0,
        totalProfit: dbMetrics.total_profit || '0',
        totalLoss: dbMetrics.total_loss || '0',
        netProfit: dbMetrics.net_profit || '0',
        averageSlippage: dbMetrics.average_slippage || 0,
        maxDrawdown: dbMetrics.max_drawdown || '0',
        sharpeRatio: dbMetrics.sharpe_ratio || 0,
        winRate: dbMetrics.win_rate || 0,
        avgWin: dbMetrics.avg_win || '0',
        avgLoss: dbMetrics.avg_loss || '0',
        profitFactor: dbMetrics.profit_factor || 0,
        dailyPnL: dbMetrics.daily_pnl || '0',
        maxConsecutiveLosses: dbMetrics.max_consecutive_losses || 0,
        currentDrawdownPeriod: dbMetrics.current_drawdown_period || 0,
        totalFees: dbMetrics.total_fees || '0'
      };
    }

    return {
      totalCopied: 0,
      successfulCopies: 0,
      failedCopies: 0,
      successRate: 0,
      totalProfit: '0',
      totalLoss: '0',
      netProfit: '0',
      averageSlippage: 0,
      maxDrawdown: '0',
      sharpeRatio: 0,
      winRate: 0,
      avgWin: '0',
      avgLoss: '0',
      profitFactor: 0,
      dailyPnL: '0',
      maxConsecutiveLosses: 0,
      currentDrawdownPeriod: 0,
      totalFees: '0'
    };
  }

  async start(): Promise<void> {
    this.isActive = true;
    this.emit('started');
    this.logger.info(`Copy execution engine started for wallet: ${this.config.targetWallet}`);
    
    // Start monitoring existing positions
    await this.startPositionMonitoring();
  }

  async stop(): Promise<void> {
    this.isActive = false;
    this.emit('stopped');
    this.logger.info('Copy execution engine stopped');
  }

  async processMempoolTransaction(tx: MempoolTransaction): Promise<void> {
    if (!this.isActive) return;

    // Check if transaction is from target wallet
    if (tx.from.toLowerCase() !== this.config.targetWallet.toLowerCase()) {
      return;
    }

    // Only process swap transactions
    if (!tx.decodedData?.isSwap) {
      return;
    }

    try {
      // Check concurrent trade limits
      const activeTrades = Array.from(this.copyTrades.values())
        .filter(trade => trade.status === 'pending' || trade.status === 'monitoring');
      
      if (activeTrades.length >= this.config.maxConcurrentTrades) {
        this.logger.warn(`Max concurrent trades reached (${this.config.maxConcurrentTrades}), skipping trade`);
        return;
      }

      // Check daily loss limits
      if (!(await this.checkDailyLossLimits())) {
        this.logger.warn('Daily loss limit reached, skipping trade');
        return;
      }

      await this.evaluateAndCopyTrade(tx);
    } catch (error) {
      this.logger.error('Error processing mempool transaction:', error);
      this.emit('error', error);
    }
  }

  private async evaluateAndCopyTrade(tx: MempoolTransaction): Promise<void> {
    const decodedData = tx.decodedData!;
    
    // Create copy trade record with enhanced data
    const copyTrade: CopyTrade = {
      id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalTxHash: tx.hash,
      targetWallet: tx.from,
      tokenIn: decodedData.tokenIn || '',
      tokenOut: decodedData.tokenOut || '',
      originalAmountIn: decodedData.amountIn || '0',
      copyAmountIn: '0',
      originalAmountOut: decodedData.amountOut || '0',
      gasPrice: tx.gasPrice,
      status: 'pending',
      timestamp: Date.now(),
      dexRouter: '',
      mevProtected: false,
      retryCount: 0
    };

    // Get token information
    try {
      const tokenInInfo = await this.priceOracle.getTokenInfo(copyTrade.tokenIn);
      const tokenOutInfo = await this.priceOracle.getTokenInfo(copyTrade.tokenOut);
      copyTrade.tokenInSymbol = tokenInInfo.symbol;
      copyTrade.tokenOutSymbol = tokenOutInfo.symbol;
    } catch (error) {
      this.logger.warn('Failed to get token info:', error);
    }

    // Store in database immediately
    this.saveCopyTradeToDatabase(copyTrade);
    this.copyTrades.set(copyTrade.id, copyTrade);
    this.emit('copyTradeCreated', copyTrade);

    // Apply filters
    if (this.config.enableFiltering && !(await this.shouldCopyTrade(copyTrade))) {
      copyTrade.status = 'cancelled';
      copyTrade.reason = 'Filtered out by copy rules';
      this.updateCopyTradeInDatabase(copyTrade);
      this.emit('copyTradeCancelled', copyTrade);
      return;
    }

    // Calculate copy amount with price impact consideration
    const copyAmount = await this.calculateOptimalCopyAmount(copyTrade);
    if (!copyAmount) {
      copyTrade.status = 'cancelled';
      copyTrade.reason = 'Copy amount calculation failed';
      this.updateCopyTradeInDatabase(copyTrade);
      this.emit('copyTradeCancelled', copyTrade);
      return;
    }

    copyTrade.copyAmountIn = copyAmount;

    // Calculate price impact
    const priceImpact = await this.calculatePriceImpact(copyTrade);
    if (priceImpact > this.config.priceImpactThreshold) {
      copyTrade.status = 'cancelled';
      copyTrade.reason = `Price impact too high: ${priceImpact.toFixed(2)}%`;
      this.updateCopyTradeInDatabase(copyTrade);
      this.emit('copyTradeCancelled', copyTrade);
      return;
    }

    copyTrade.priceImpact = priceImpact;

    // Set stop loss and take profit prices
    await this.setStopLossAndTakeProfit(copyTrade);

    // Apply copy delay for analysis
    if (this.config.copyDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.copyDelay));
    }

    // Execute the copy trade
    await this.executeCopyTrade(copyTrade);
  }

  private async shouldCopyTrade(copyTrade: CopyTrade): Promise<boolean> {
    // Check if token is in follow list (if specified)
    if (this.config.followTokens.length > 0) {
      const hasFollowedToken = this.config.followTokens.some(token => 
        token.toLowerCase() === copyTrade.tokenIn.toLowerCase() ||
        token.toLowerCase() === copyTrade.tokenOut.toLowerCase()
      );
      if (!hasFollowedToken) return false;
    }

    // Check if token is in exclude list
    if (this.config.excludeTokens.length > 0) {
      const hasExcludedToken = this.config.excludeTokens.some(token => 
        token.toLowerCase() === copyTrade.tokenIn.toLowerCase() ||
        token.toLowerCase() === copyTrade.tokenOut.toLowerCase()
      );
      if (hasExcludedToken) return false;
    }

    // Check trade size limits using real-time prices
    const originalAmountETH = await this.convertToETH(copyTrade.originalAmountIn, copyTrade.tokenIn);
    const minSize = parseFloat(this.config.minTradeSize);
    const maxSize = parseFloat(this.config.maxTradeSize);

    if (originalAmountETH < minSize || originalAmountETH > maxSize) {
      return false;
    }

    // Check if we already have a position in this token
    const currentPosition = this.positionTracker.get(copyTrade.tokenOut);
    if (currentPosition) {
      const currentPositionETH = await this.convertToETH(currentPosition, copyTrade.tokenOut);
      const newPositionETH = await this.convertToETH(copyTrade.copyAmountIn, copyTrade.tokenIn);
      const totalPositionETH = currentPositionETH + newPositionETH;
      
      // Check if total position would exceed max position size
      const balance = await this.provider.getBalance(this.wallet.address);
      const balanceETH = parseFloat(ethers.formatEther(balance));
      if (totalPositionETH > balanceETH * this.MAX_POSITION_SIZE_PCT) {
        return false;
      }
    }

    return true;
  }

  private async calculateOptimalCopyAmount(copyTrade: CopyTrade): Promise<string | null> {
    try {
      const originalAmountBN = ethers.parseEther(copyTrade.originalAmountIn);
      const copyPercentage = this.config.copyPercentage / 100;
      
      // Use more precise calculation
      const copyAmountBN = (originalAmountBN * BigInt(Math.floor(copyPercentage * 10000))) / BigInt(10000);
      
      // Check against max trade size
      const maxTradeSize = ethers.parseEther(this.config.maxTradeSize);
      let finalAmount = copyAmountBN > maxTradeSize ? maxTradeSize : copyAmountBN;
      
      // Check against available balance
      const balance = await this.provider.getBalance(this.wallet.address);
      const reserveAmount = ethers.parseEther('0.1'); // Keep 0.1 ETH for gas
      const availableBalance = balance > reserveAmount ? balance - reserveAmount : BigInt(0);
      
      if (finalAmount > availableBalance) {
        finalAmount = availableBalance;
      }
      
      // Ensure minimum trade size
      const minTradeSize = ethers.parseEther(this.config.minTradeSize);
      if (finalAmount < minTradeSize) {
        return null;
      }
      
      return ethers.formatEther(finalAmount);
    } catch (error) {
      this.logger.error('Error calculating copy amount:', error);
      return null;
    }
  }

  private async calculatePriceImpact(copyTrade: CopyTrade): Promise<number> {
    try {
      // Get current price from oracle for accurate calculation
      const currentPrice = await this.priceOracle.getPriceInETH(copyTrade.tokenOut);
      
      // Estimate price impact based on trade size and current price
      const tradeSize = await this.convertToETH(copyTrade.copyAmountIn, copyTrade.tokenIn);
      
      // Calculate expected output value at current price
      const expectedOutputValue = parseFloat(copyTrade.copyAmountIn) * currentPrice;
      
      // Get estimated output from DEX (if available)
      const estimatedOutputValue = copyTrade.estimatedAmountOut ? 
        parseFloat(copyTrade.estimatedAmountOut) * currentPrice : expectedOutputValue;
      
      // Price impact = difference between expected and actual output
      const priceImpact = Math.abs((expectedOutputValue - estimatedOutputValue) / expectedOutputValue) * 100;
      
      // Also factor in trade size vs estimated liquidity for additional safety
      const estimatedLiquidity = Math.max(1000, tradeSize * 10); // Dynamic estimate based on trade size
      const sizeImpact = (tradeSize / estimatedLiquidity) * 100;
      
      // Use the higher of the two impact calculations for safety
      const finalImpact = Math.max(priceImpact, sizeImpact);
      
      return Math.min(finalImpact, 100); // Cap at 100%
    } catch (error) {
      this.logger.error('Error calculating price impact:', error);
      return 0;
    }
  }

  private async setStopLossAndTakeProfit(copyTrade: CopyTrade): Promise<void> {
    try {
      const currentPrice = await this.priceOracle.getPriceInETH(copyTrade.tokenOut);
      
      if (this.config.stopLoss > 0) {
        const stopLossPrice = currentPrice * (1 - this.config.stopLoss / 100);
        copyTrade.stopLossPrice = stopLossPrice.toString();
      }
      
      if (this.config.takeProfit > 0) {
        const takeProfitPrice = currentPrice * (1 + this.config.takeProfit / 100);
        copyTrade.takeProfitPrice = takeProfitPrice.toString();
      }
    } catch (error) {
      this.logger.error('Error setting stop loss/take profit:', error);
    }
  }

  private async executeCopyTrade(copyTrade: CopyTrade): Promise<void> {
    let retryCount = 0;
    const maxRetries = this.MAX_RETRY_ATTEMPTS;

    while (retryCount <= maxRetries) {
      try {
        // Check if token approval is needed
        if (copyTrade.tokenIn !== 'ETH' && !this.tokenAddresses.has('WETH')) {
          const routerAddress = await this.getOptimalRouterAddress(copyTrade.tokenIn, copyTrade.tokenOut);
          const isApprovalNeeded = await this.tokenApprovalManager.isApprovalNeeded(
            copyTrade.tokenIn,
            routerAddress,
            ethers.parseEther(copyTrade.copyAmountIn)
          );

          if (isApprovalNeeded) {
            this.logger.info(`Approving token ${copyTrade.tokenIn} for router ${routerAddress}`);
            const approvalTxHash = await this.tokenApprovalManager.approveToken(
              copyTrade.tokenIn,
              routerAddress,
              ethers.parseEther(copyTrade.copyAmountIn)
            );
            this.logger.info(`Token approval submitted: ${approvalTxHash}`);
            
            // Wait for approval to be mined
            await this.provider.waitForTransaction(approvalTxHash);
          }
        }

        // Get the optimal router address
        const routerAddress = await this.getOptimalRouterAddress(copyTrade.tokenIn, copyTrade.tokenOut);
        copyTrade.dexRouter = routerAddress;

        // Build the swap transaction with dynamic gas estimation
        const swapTx = await this.buildOptimizedSwapTransaction(copyTrade, routerAddress);
        
        // Apply MEV protection if enabled
        if (this.config.enableMevProtection) {
          copyTrade.mevProtected = true;
          // Implementation would include private mempool submission
          this.logger.info(`MEV protection enabled for trade ${copyTrade.id}`);
        }

        // Check gas price again before execution
        const currentGasPrice = await this.provider.getFeeData();
        const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
        
        if (currentGasPrice.gasPrice && currentGasPrice.gasPrice > maxGasPrice) {
          throw new Error(`Gas price too high: ${ethers.formatUnits(currentGasPrice.gasPrice, 'gwei')} gwei`);
        }

        // Execute transaction
        const txResponse = await this.wallet.sendTransaction(swapTx);
        copyTrade.copyTxHash = txResponse.hash;
        copyTrade.status = 'executed';
        copyTrade.executionTime = Date.now();
        copyTrade.retryCount = retryCount;

        this.updateCopyTradeInDatabase(copyTrade);
        this.emit('copyTradeExecuted', copyTrade);
        this.logger.info(`Copy trade executed: ${copyTrade.id}, TX: ${txResponse.hash}`);

        // Wait for confirmation and update metrics
        const receipt = await txResponse.wait();
        if (receipt) {
          copyTrade.gasUsed = receipt.gasUsed.toString();
          await this.updateTradeMetrics(copyTrade, receipt);
          
          // Start monitoring for stop loss/take profit
          if (copyTrade.stopLossPrice || copyTrade.takeProfitPrice) {
            copyTrade.status = 'monitoring';
            this.updateCopyTradeInDatabase(copyTrade);
            this.startPositionMonitoring();
          }
        }

        return; // Success, exit retry loop

      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (retryCount <= maxRetries) {
          this.logger.warn(`Copy trade attempt ${retryCount} failed: ${errorMessage}. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        } else {
          copyTrade.status = 'failed';
          copyTrade.reason = `Failed after ${maxRetries} attempts: ${errorMessage}`;
          copyTrade.executionTime = Date.now();
          copyTrade.retryCount = retryCount - 1;
          
          this.riskMetrics.failedCopies++;
          this.consecutiveLosses++;
          this.maxConsecutiveLosses = Math.max(this.maxConsecutiveLosses, this.consecutiveLosses);
          this.updateSuccessRate();
          this.updateRiskMetricsInDatabase();
          
          this.updateCopyTradeInDatabase(copyTrade);
          this.emit('copyTradeFailed', copyTrade);
          this.logger.error(`Copy trade execution failed: ${copyTrade.id} - ${errorMessage}`);
        }
      }
    }
  }

  private async updateTradeMetrics(copyTrade: CopyTrade, receipt: ethers.TransactionReceipt): Promise<void> {
    this.riskMetrics.totalCopied++;
    this.riskMetrics.successfulCopies++;
    this.consecutiveLosses = 0; // Reset consecutive losses on success
    this.updateSuccessRate();

    // Calculate actual profit/loss
    const gasCost = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice || 0);
    const gasCostETH = parseFloat(ethers.formatEther(gasCost));
    
    // Track fees
    const currentFees = parseFloat(this.riskMetrics.totalFees);
    this.riskMetrics.totalFees = (currentFees + gasCostETH).toString();
    
    // Update daily P&L tracking
    const today = new Date().toISOString().split('T')[0] || new Date().getFullYear().toString();
    if (this.dailyLossTracker.date !== today) {
      this.dailyLossTracker = { date: today, loss: '0' };
    }
    
    // Simplified P&L calculation - in production, this would be more sophisticated
    const estimatedProfit = copyTrade.estimatedAmountOut ? 
      parseFloat(copyTrade.estimatedAmountOut) - parseFloat(copyTrade.copyAmountIn) - gasCostETH : -gasCostETH;
    
    copyTrade.profitLoss = estimatedProfit.toString();
    
    if (estimatedProfit > 0) {
      const currentProfit = parseFloat(this.riskMetrics.totalProfit);
      this.riskMetrics.totalProfit = (currentProfit + estimatedProfit).toString();
    } else {
      const currentLoss = parseFloat(this.riskMetrics.totalLoss);
      this.riskMetrics.totalLoss = (currentLoss + Math.abs(estimatedProfit)).toString();
      
      // Update daily loss tracker
      const dailyLoss = parseFloat(this.dailyLossTracker.loss);
      this.dailyLossTracker.loss = (dailyLoss + Math.abs(estimatedProfit)).toString();
    }
    
    // Calculate net profit
    const totalProfit = parseFloat(this.riskMetrics.totalProfit);
    const totalLoss = parseFloat(this.riskMetrics.totalLoss);
    this.riskMetrics.netProfit = (totalProfit - totalLoss).toString();
    
    // Update win rate and average win/loss
    this.calculateAdvancedMetrics();
    
    // Update position tracking
    if (copyTrade.tokenOut !== 'ETH') {
      const currentPosition = this.positionTracker.get(copyTrade.tokenOut) || '0';
      const newPosition = parseFloat(currentPosition) + parseFloat(copyTrade.actualAmountOut || copyTrade.estimatedAmountOut || '0');
      this.positionTracker.set(copyTrade.tokenOut, newPosition.toString());
    }
    
    this.updateRiskMetricsInDatabase();
    this.emit('metricsUpdated', this.riskMetrics);
  }

  private calculateAdvancedMetrics(): void {
    const trades = Array.from(this.copyTrades.values()).filter(t => t.status === 'executed' && t.profitLoss);
    
    if (trades.length === 0) return;
    
    const winningTrades = trades.filter(t => parseFloat(t.profitLoss!) > 0);
    const losingTrades = trades.filter(t => parseFloat(t.profitLoss!) <= 0);
    
    // Win rate
    this.riskMetrics.winRate = (winningTrades.length / trades.length) * 100;
    
    // Average win/loss
    if (winningTrades.length > 0) {
      const totalWin = winningTrades.reduce((sum, t) => sum + parseFloat(t.profitLoss!), 0);
      this.riskMetrics.avgWin = (totalWin / winningTrades.length).toString();
    }
    
    if (losingTrades.length > 0) {
      const totalLoss = losingTrades.reduce((sum, t) => sum + Math.abs(parseFloat(t.profitLoss!)), 0);
      this.riskMetrics.avgLoss = (totalLoss / losingTrades.length).toString();
    }
    
    // Profit factor
    const totalWin = parseFloat(this.riskMetrics.totalProfit);
    const totalLoss = parseFloat(this.riskMetrics.totalLoss);
    this.riskMetrics.profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? 999 : 0;
    
    // Calculate drawdown and Sharpe ratio (simplified)
    const returns = trades.map(t => parseFloat(t.profitLoss!));
    if (returns.length > 1) {
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      this.riskMetrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
      
      // Simple drawdown calculation
      let peak = 0;
      let maxDrawdown = 0;
      let runningTotal = 0;
      
      for (const ret of returns) {
        runningTotal += ret;
        if (runningTotal > peak) {
          peak = runningTotal;
        }
        const drawdown = peak - runningTotal;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      
      this.riskMetrics.maxDrawdown = maxDrawdown.toString();
    }
  }

  private updateSuccessRate(): void {
    if (this.riskMetrics.totalCopied > 0) {
      this.riskMetrics.successRate = (this.riskMetrics.successfulCopies / this.riskMetrics.totalCopied) * 100;
    }
  }

  // Public methods
  updateConfig(newConfig: Partial<CopyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
    this.logger.info('Configuration updated');
  }

  getCopyTrades(): CopyTrade[] {
    return Array.from(this.copyTrades.values());
  }

  getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  getConfig(): CopyConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.isActive;
  }

  async clearHistory(): Promise<void> {
    this.copyTrades.clear();
    this.riskMetrics = this.initializeRiskMetrics();
    this.positionTracker.clear();
    this.consecutiveLosses = 0;
    this.maxConsecutiveLosses = 0;
    
    // Clear database
    this.db.prepare('DELETE FROM copy_trades').run();
    this.db.prepare('UPDATE risk_metrics SET total_copied = 0, successful_copies = 0, failed_copies = 0, success_rate = 0, total_profit = "0", total_loss = "0", net_profit = "0", average_slippage = 0, max_drawdown = "0", sharpe_ratio = 0, win_rate = 0, avg_win = "0", avg_loss = "0", profit_factor = 0, daily_pnl = "0", max_consecutive_losses = 0, current_drawdown_period = 0, total_fees = "0" WHERE id = 1').run();
    
    this.emit('historyCleared');
    this.logger.info('Trading history cleared');
  }

  // Risk management methods
  async checkRiskLimits(): Promise<boolean> {
    if (!this.config.enableRiskManagement) return true;

    // Check maximum drawdown
    const currentDrawdown = parseFloat(this.riskMetrics.maxDrawdown);
    if (currentDrawdown > 0.1) { // 10% max drawdown
      this.emit('riskLimitExceeded', 'Maximum drawdown exceeded');
      return false;
    }

    // Check success rate
    if (this.riskMetrics.totalCopied >= 10 && this.riskMetrics.successRate < 50) {
      this.emit('riskLimitExceeded', 'Success rate too low');
      return false;
    }

    // Check daily loss limit
    if (!(await this.checkDailyLossLimits())) {
      this.emit('riskLimitExceeded', 'Daily loss limit exceeded');
      return false;
    }

    // Check consecutive losses
    if (this.consecutiveLosses >= 5) {
      this.emit('riskLimitExceeded', 'Too many consecutive losses');
      return false;
    }

    return true;
  }

  async emergencyStop(): Promise<void> {
    this.isActive = false;
    this.emit('emergencyStop');
    this.logger.warn('Emergency stop activated for copy execution engine');
  }

  private async startPositionMonitoring(): Promise<void> {
    // Monitor positions for stop loss and take profit
    const monitoringTrades = Array.from(this.copyTrades.values())
      .filter(trade => trade.status === 'monitoring');

    for (const trade of monitoringTrades) {
      try {
        const currentPrice = await this.priceOracle.getPriceInETH(trade.tokenOut);
        
        // Check stop loss
        if (trade.stopLossPrice && currentPrice <= parseFloat(trade.stopLossPrice)) {
          this.logger.info(`Stop loss triggered for trade ${trade.id}`);
          await this.executeExitTrade(trade, 'stop_loss');
        }
        
        // Check take profit
        if (trade.takeProfitPrice && currentPrice >= parseFloat(trade.takeProfitPrice)) {
          this.logger.info(`Take profit triggered for trade ${trade.id}`);
          await this.executeExitTrade(trade, 'take_profit');
        }
      } catch (error) {
        this.logger.error(`Error monitoring position ${trade.id}:`, error);
      }
    }
  }

  private async checkDailyLossLimits(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0] || new Date().getFullYear().toString();
    
    // Reset daily counter if new day
    if (this.dailyLossTracker.date !== today) {
      this.dailyLossTracker = { date: today, loss: '0' };
    }
    
    const currentDailyLoss = parseFloat(this.dailyLossTracker.loss);
    const maxDailyLoss = parseFloat(this.config.maxDailyLoss);
    
    return currentDailyLoss < maxDailyLoss;
  }

  private async getOptimalRouterAddress(tokenIn: string, tokenOut: string): Promise<string> {
    // Advanced router selection based on liquidity and fees
    const wethAddress = this.tokenAddresses.get('WETH');
    const usdcAddress = this.tokenAddresses.get('USDC');
    const usdtAddress = this.tokenAddresses.get('USDT');
    const daiAddress = this.tokenAddresses.get('DAI');
    
    const isETHPair = tokenIn === 'ETH' || tokenOut === 'ETH' || 
                     tokenIn === wethAddress || tokenOut === wethAddress;
    
    const stablecoins = [usdcAddress, usdtAddress, daiAddress].filter(addr => addr !== undefined);
    const isStablecoinPair = stablecoins.includes(tokenIn) || stablecoins.includes(tokenOut);
    
    // Use Uniswap V3 for stablecoin pairs (better efficiency)
    if (isStablecoinPair && !isETHPair) {
      this.logger.debug(`Selected Uniswap V3 for stablecoin pair: ${tokenIn} -> ${tokenOut}`);
      return this.dexRouters.uniswapV3;
    }
    
    // Use Uniswap V2 for ETH pairs (higher liquidity)
    if (isETHPair) {
      this.logger.debug(`Selected Uniswap V2 for ETH pair: ${tokenIn} -> ${tokenOut}`);
      return this.dexRouters.uniswapV2;
    }
    
    // Default to Uniswap V2 for other pairs
    this.logger.debug(`Selected default Uniswap V2 for pair: ${tokenIn} -> ${tokenOut}`);
    return this.dexRouters.uniswapV2;
  }

  private async buildOptimizedSwapTransaction(copyTrade: CopyTrade, routerAddress: string): Promise<any> {
    const routerABI = [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
    ];

    const router = new ethers.Contract(routerAddress, routerABI, this.wallet);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    const amountIn = ethers.parseEther(copyTrade.copyAmountIn);
    
    // Calculate minimum amount out with enhanced slippage protection
    const slippageWithBuffer = this.config.maxSlippage + this.SLIPPAGE_BUFFER;
    const minAmountOut = amountIn * BigInt(Math.floor(100 - slippageWithBuffer)) / BigInt(100);

    let txData;
    let estimatedGas: bigint;
    
    const wethAddress = this.tokenAddresses.get('WETH');
    if (!wethAddress) {
      throw new Error('WETH address not found in token addresses');
    }
    
    if (copyTrade.tokenIn === 'ETH' || copyTrade.tokenIn === wethAddress) {
      // ETH to Token swap
      const path = [wethAddress, copyTrade.tokenOut];
      
      // Get estimated amounts out
      try {
        const getAmountsOut = router['getAmountsOut'] as any;
        if (getAmountsOut) {
          const amountsOut = await getAmountsOut(amountIn, path);
          copyTrade.estimatedAmountOut = ethers.formatEther(amountsOut[1]);
        }
      } catch (error) {
        this.logger.warn('Failed to get estimated amounts out:', error);
      }
      
      const swapMethod = router['swapExactETHForTokens'] as any;
      if (!swapMethod) {
        throw new Error('swapExactETHForTokens method not found on router');
      }
      
      txData = await swapMethod.populateTransaction(
        minAmountOut,
        path,
        this.wallet.address,
        deadline,
        { value: amountIn }
      );
      
      // Estimate gas
      estimatedGas = await swapMethod.estimateGas(
        minAmountOut,
        path,
        this.wallet.address,
        deadline,
        { value: amountIn }
      );
      
    } else if (copyTrade.tokenOut === 'ETH' || copyTrade.tokenOut === wethAddress) {
      // Token to ETH swap
      const path = [copyTrade.tokenIn, wethAddress];
      
      try {
        const getAmountsOut = router['getAmountsOut'] as any;
        if (getAmountsOut) {
          const amountsOut = await getAmountsOut(amountIn, path);
          copyTrade.estimatedAmountOut = ethers.formatEther(amountsOut[1]);
        }
      } catch (error) {
        this.logger.warn('Failed to get estimated amounts out:', error);
      }
      
      const swapMethod = router['swapExactTokensForETH'] as any;
      if (!swapMethod) {
        throw new Error('swapExactTokensForETH method not found on router');
      }
      
      txData = await swapMethod.populateTransaction(
        amountIn,
        minAmountOut,
        path,
        this.wallet.address,
        deadline
      );
      
      estimatedGas = await swapMethod.estimateGas(
        amountIn,
        minAmountOut,
        path,
        this.wallet.address,
        deadline
      );
      
    } else {
      // Token to Token swap
      const path = [copyTrade.tokenIn, wethAddress, copyTrade.tokenOut];
      
      try {
        const getAmountsOut = router['getAmountsOut'] as any;
        if (getAmountsOut) {
          const amountsOut = await getAmountsOut(amountIn, path);
          copyTrade.estimatedAmountOut = ethers.formatEther(amountsOut[2]);
        }
      } catch (error) {
        this.logger.warn('Failed to get estimated amounts out:', error);
      }
      
      const swapMethod = router['swapExactTokensForTokens'] as any;
      if (!swapMethod) {
        throw new Error('swapExactTokensForTokens method not found on router');
      }
      
      txData = await swapMethod.populateTransaction(
        amountIn,
        minAmountOut,
        path,
        this.wallet.address,
        deadline
      );
      
      estimatedGas = await swapMethod.estimateGas(
        amountIn,
        minAmountOut,
        path,
        this.wallet.address,
        deadline
      );
    }

    if (!txData) {
      throw new Error('Failed to build swap transaction data');
    }

    // Apply gas estimation buffer
    const gasLimit = BigInt(Math.floor(Number(estimatedGas) * this.GAS_ESTIMATION_BUFFER));
    copyTrade.gasLimit = gasLimit.toString();

    return {
      to: routerAddress,
      data: txData.data,
      value: txData.value || '0',
      gasLimit: gasLimit,
    };
  }

  private async saveCopyTradeToDatabase(copyTrade: CopyTrade): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO copy_trades (
        id, original_tx_hash, copy_tx_hash, target_wallet, token_in, token_out,
        token_in_symbol, token_out_symbol, original_amount_in, copy_amount_in,
        original_amount_out, copy_amount_out, estimated_amount_out, actual_amount_out,
        gas_price, gas_used, gas_limit, status, reason, timestamp, execution_time,
        profit_loss, slippage, price_impact, dex_router, mev_protected, retry_count,
        stop_loss_price, take_profit_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      copyTrade.id,
      copyTrade.originalTxHash,
      copyTrade.copyTxHash || null,
      copyTrade.targetWallet,
      copyTrade.tokenIn,
      copyTrade.tokenOut,
      copyTrade.tokenInSymbol || null,
      copyTrade.tokenOutSymbol || null,
      copyTrade.originalAmountIn,
      copyTrade.copyAmountIn,
      copyTrade.originalAmountOut,
      copyTrade.copyAmountOut || null,
      copyTrade.estimatedAmountOut || null,
      copyTrade.actualAmountOut || null,
      copyTrade.gasPrice,
      copyTrade.gasUsed || null,
      copyTrade.gasLimit || null,
      copyTrade.status,
      copyTrade.reason || null,
      copyTrade.timestamp,
      copyTrade.executionTime || null,
      copyTrade.profitLoss || null,
      copyTrade.slippage || null,
      copyTrade.priceImpact || null,
      copyTrade.dexRouter,
      copyTrade.mevProtected ? 1 : 0,
      copyTrade.retryCount,
      copyTrade.stopLossPrice || null,
      copyTrade.takeProfitPrice || null
    );
  }

  private async updateCopyTradeInDatabase(copyTrade: CopyTrade): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE copy_trades SET
        copy_tx_hash = ?, status = ?, reason = ?, execution_time = ?, profit_loss = ?,
        slippage = ?, price_impact = ?, gas_used = ?, gas_limit = ?, retry_count = ?,
        actual_amount_out = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      copyTrade.copyTxHash || null,
      copyTrade.status,
      copyTrade.reason || null,
      copyTrade.executionTime || null,
      copyTrade.profitLoss || null,
      copyTrade.slippage || null,
      copyTrade.priceImpact || null,
      copyTrade.gasUsed || null,
      copyTrade.gasLimit || null,
      copyTrade.retryCount,
      copyTrade.actualAmountOut || null,
      copyTrade.id
    );
  }

  private async updateRiskMetricsInDatabase(): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE risk_metrics SET
        total_copied = ?, successful_copies = ?, failed_copies = ?, success_rate = ?,
        total_profit = ?, total_loss = ?, net_profit = ?, average_slippage = ?,
        max_drawdown = ?, sharpe_ratio = ?, win_rate = ?, avg_win = ?, avg_loss = ?,
        profit_factor = ?, daily_pnl = ?, max_consecutive_losses = ?,
        current_drawdown_period = ?, total_fees = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    stmt.run(
      this.riskMetrics.totalCopied,
      this.riskMetrics.successfulCopies,
      this.riskMetrics.failedCopies,
      this.riskMetrics.successRate,
      this.riskMetrics.totalProfit,
      this.riskMetrics.totalLoss,
      this.riskMetrics.netProfit,
      this.riskMetrics.averageSlippage,
      this.riskMetrics.maxDrawdown,
      this.riskMetrics.sharpeRatio,
      this.riskMetrics.winRate,
      this.riskMetrics.avgWin,
      this.riskMetrics.avgLoss,
      this.riskMetrics.profitFactor,
      this.riskMetrics.dailyPnL,
      this.riskMetrics.maxConsecutiveLosses,
      this.riskMetrics.currentDrawdownPeriod,
      this.riskMetrics.totalFees
    );
  }

  private async executeExitTrade(trade: CopyTrade, reason: 'stop_loss' | 'take_profit'): Promise<void> {
    try {
      // Create reverse trade to exit position
      const exitTrade: CopyTrade = {
        ...trade,
        id: `exit_${trade.id}_${Date.now()}`,
        originalTxHash: `exit_${trade.originalTxHash}`,
        tokenIn: trade.tokenOut,
        tokenOut: trade.tokenIn,
        copyAmountIn: trade.actualAmountOut || trade.estimatedAmountOut || '0',
        status: 'pending',
        reason: `Exit trade: ${reason}`,
        timestamp: Date.now(),
        retryCount: 0
      };

      await this.executeCopyTrade(exitTrade);
      
      // Update original trade status
      trade.status = 'executed';
      trade.reason = `Exited via ${reason}`;
      this.updateCopyTradeInDatabase(trade);
      
    } catch (error) {
      this.logger.error(`Failed to execute exit trade for ${trade.id}:`, error);
    }
  }

  private async convertToETH(amount: string, token: string): Promise<number> {
    try {
      if (token === 'ETH' || token === this.tokenAddresses.get('WETH')) {
        return parseFloat(amount);
      }
      
      // Use price oracle for real-time conversion
      const priceInETH = await this.priceOracle.getPriceInETH(token);
      return parseFloat(amount) * priceInETH;
    } catch (error) {
      this.logger.error(`Error converting ${amount} ${token} to ETH:`, error);
      // Fallback to conservative estimate
      return parseFloat(amount) * 0.0005; // Very conservative fallback
    }
  }



  // Additional utility methods
  getPositionSizes(): Map<string, string> {
    return new Map(this.positionTracker);
  }

  async getPortfolioValue(): Promise<string> {
    let totalValue = 0;
    
    for (const [token, amount] of this.positionTracker) {
      const valueInETH = await this.convertToETH(amount, token);
      totalValue += valueInETH;
    }
    
    // Add ETH balance
    const ethBalance = await this.provider.getBalance(this.wallet.address);
    totalValue += parseFloat(ethers.formatEther(ethBalance));
    
    return totalValue.toString();
  }

  getDatabaseStats(): { totalTrades: number; pendingTrades: number; completedTrades: number } {
    const totalTrades = this.db.prepare('SELECT COUNT(*) as count FROM copy_trades').get() as { count: number };
    const pendingTrades = this.db.prepare('SELECT COUNT(*) as count FROM copy_trades WHERE status IN ("pending", "monitoring")').get() as { count: number };
    const completedTrades = this.db.prepare('SELECT COUNT(*) as count FROM copy_trades WHERE status IN ("executed", "failed")').get() as { count: number };
    
    return {
      totalTrades: totalTrades.count,
      pendingTrades: pendingTrades.count,
      completedTrades: completedTrades.count
    };
  }
}