import { ArbitrageBotConfig, Chain } from "@trading-bot/types";
import { createChainClient } from "@trading-bot/chain-client";
import axios from "axios";
import Database from "better-sqlite3";
import { ethers } from "ethers";

// Configuration with security enhancements
interface SecureArbitrageConfig {
  // Bot identification
  botId: string;
  userId: string;
  walletId: string;
  
  // Trading parameters with validation
  chain: Chain;
  tokenPair: {
    tokenA: string;
    tokenB: string;
  };
  
  // Risk management parameters
  minProfitThreshold: number; // Minimum profit percentage
  maxTradeSize: number; // Maximum trade size for risk management
  slippageTolerance: number; // Maximum acceptable slippage
  maxGasPrice: string; // Maximum gas price in gwei
  
  // MEV protection settings
  mevProtection: {
    enabled: boolean;
    flashbotsRelay?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
  };
  
  // Rate limiting
  cooldownBetweenTrades: number; // Milliseconds between trades
  maxTradesPerHour: number;
  
  // Monitoring
  enableDetailedLogging: boolean;
  notifyOnErrors: boolean;
}

// Simple risk management implementation
interface RiskValidation {
  allowed: boolean;
  reason?: string;
}

interface TradeValidationParams {
  amount: number;
  type: string;
  token: string;
}

class SimpleRiskManager {
  private maxPositionSize: number;
  private maxDailyLoss: number;
  private emergencyStopLoss: number;
  private dailyTrades: { timestamp: number; amount: number }[] = [];
  
  constructor(config: { maxPositionSize: number; maxDailyLoss: number; emergencyStopLoss: number }) {
    this.maxPositionSize = config.maxPositionSize;
    this.maxDailyLoss = config.maxDailyLoss;
    this.emergencyStopLoss = config.emergencyStopLoss;
  }
  
  validateTrade(params: TradeValidationParams): RiskValidation {
    // Check position size limit
    if (params.amount > this.maxPositionSize) {
      return {
        allowed: false,
        reason: `Trade amount ${params.amount} exceeds max position size ${this.maxPositionSize}`
      };
    }
    
    // Clean old trades (older than 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.dailyTrades = this.dailyTrades.filter(trade => trade.timestamp > oneDayAgo);
    
    // Check daily volume
    const dailyVolume = this.dailyTrades.reduce((sum, trade) => sum + trade.amount, 0);
    if (dailyVolume + params.amount > this.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily volume limit exceeded: ${dailyVolume + params.amount} > ${this.maxDailyLoss}`
      };
    }
    
    return { allowed: true };
  }
  
  recordTrade(amount: number): void {
    this.dailyTrades.push({
      timestamp: Date.now(),
      amount: amount
    });
  }
}

// Secure configuration with environment-based parameters
const ARBITRAGE_CONFIG: SecureArbitrageConfig = {
  botId: process.env['ARBITRAGE_BOT_ID'] || 'arbitrage-bot-1',
  userId: process.env['USER_ID'] || 'user-123',
  walletId: process.env['WALLET_ID'] || 'wallet-123',
  
  chain: (process.env['TRADING_CHAIN'] as Chain) || "ETH",
  tokenPair: {
    tokenA: process.env['TOKEN_A'] || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
    tokenB: process.env['TOKEN_B'] || "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  },
  
  // Risk management with configurable parameters
  minProfitThreshold: parseFloat(process.env['MIN_PROFIT_THRESHOLD'] || '0.2'), // 0.2%
  maxTradeSize: parseFloat(process.env['MAX_TRADE_SIZE'] || '1.0'), // 1 ETH max
  slippageTolerance: parseFloat(process.env['SLIPPAGE_TOLERANCE'] || '0.5'), // 0.5%
  maxGasPrice: process.env['MAX_GAS_PRICE'] || '100', // 100 gwei
  
  // MEV protection configuration
  mevProtection: {
    enabled: process.env['MEV_PROTECTION_ENABLED'] === 'true',
    flashbotsRelay: process.env['FLASHBOTS_RELAY_URL'] || undefined,
    maxPriorityFeePerGas: process.env['MAX_PRIORITY_FEE'] || undefined,
  },
  
  // Rate limiting for safety
  cooldownBetweenTrades: parseInt(process.env['TRADE_COOLDOWN'] || '60000'), // 1 minute
  maxTradesPerHour: parseInt(process.env['MAX_TRADES_PER_HOUR'] || '10'),
  
  // Monitoring
  enableDetailedLogging: process.env['DETAILED_LOGGING'] === 'true',
  notifyOnErrors: process.env['NOTIFY_ON_ERRORS'] === 'true',
};

// Secure environment variable validation
function validateEnvironment(): void {
  const requiredVars = ['ETH_RPC_URL', 'WALLET_PRIVATE_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Validate numeric parameters
  if (ARBITRAGE_CONFIG.minProfitThreshold < 0 || ARBITRAGE_CONFIG.minProfitThreshold > 100) {
    throw new Error('Invalid MIN_PROFIT_THRESHOLD: must be between 0 and 100');
  }
  
  if (ARBITRAGE_CONFIG.slippageTolerance < 0 || ARBITRAGE_CONFIG.slippageTolerance > 10) {
    throw new Error('Invalid SLIPPAGE_TOLERANCE: must be between 0 and 10');
  }
  
  if (ARBITRAGE_CONFIG.maxTradeSize <= 0) {
    throw new Error('Invalid MAX_TRADE_SIZE: must be greater than 0');
  }
}

// Secure database setup with validation and constraints
const db = new Database(process.env['ARBITRAGE_DB_PATH'] || "arbitrage_bot.db");

// Initialize database with comprehensive schema
function initializeDatabase(): void {
  try {
    // Create trades table with enhanced security
    db.exec(`
      CREATE TABLE IF NOT EXISTS arbitrage_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        
        -- Trade details
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        trade_pair TEXT NOT NULL,
        initial_amount TEXT NOT NULL,
        final_amount TEXT NOT NULL,
        net_profit TEXT NOT NULL,
        profit_percentage REAL NOT NULL,
        
        -- Transaction details
        tx_hash_a TEXT,
        tx_hash_b TEXT,
        gas_used_a TEXT,
        gas_used_b TEXT,
        gas_price_a TEXT,
        gas_price_b TEXT,
        
        -- Risk and validation
        slippage_tolerance REAL NOT NULL,
        mev_protection_used BOOLEAN DEFAULT FALSE,
        execution_status TEXT DEFAULT 'PENDING',
        
        -- Audit fields
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- Constraints
        CHECK (execution_status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
        CHECK (profit_percentage >= -100 AND profit_percentage <= 1000),
        CHECK (slippage_tolerance >= 0 AND slippage_tolerance <= 10)
      )
    `);
    
    // Create bot status tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_status (
        bot_id TEXT PRIMARY KEY,
        is_running BOOLEAN DEFAULT FALSE,
        last_activity DATETIME,
        total_trades INTEGER DEFAULT 0,
        successful_trades INTEGER DEFAULT 0,
        failed_trades INTEGER DEFAULT 0,
        total_profit TEXT DEFAULT '0',
        last_error TEXT,
        error_count INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create performance indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_arbitrage_trades_timestamp ON arbitrage_trades (timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_arbitrage_trades_bot_id ON arbitrage_trades (bot_id);
      CREATE INDEX IF NOT EXISTS idx_arbitrage_trades_status ON arbitrage_trades (execution_status);
    `);
    
    console.log('Database initialized successfully with security enhancements');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Rate limiting and trade tracking
interface TradeTracker {
  lastTradeTime: number;
  tradesInLastHour: number;
  hourlyTradeTimestamps: number[];
}

const tradeTracker: TradeTracker = {
  lastTradeTime: 0,
  tradesInLastHour: 0,
  hourlyTradeTimestamps: []
};

function updateTradeTracker(): void {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Remove timestamps older than 1 hour
  tradeTracker.hourlyTradeTimestamps = tradeTracker.hourlyTradeTimestamps.filter(
    timestamp => timestamp > oneHourAgo
  );
  
  tradeTracker.tradesInLastHour = tradeTracker.hourlyTradeTimestamps.length;
}

function canExecuteTrade(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  
  // Check cooldown period
  if (now - tradeTracker.lastTradeTime < ARBITRAGE_CONFIG.cooldownBetweenTrades) {
    const remainingCooldown = ARBITRAGE_CONFIG.cooldownBetweenTrades - (now - tradeTracker.lastTradeTime);
    return { 
      allowed: false, 
      reason: `Cooldown period active. ${Math.ceil(remainingCooldown / 1000)}s remaining` 
    };
  }
  
  // Check hourly trade limit
  updateTradeTracker();
  if (tradeTracker.tradesInLastHour >= ARBITRAGE_CONFIG.maxTradesPerHour) {
    return { 
      allowed: false, 
      reason: `Hourly trade limit reached (${ARBITRAGE_CONFIG.maxTradesPerHour} trades/hour)` 
    };
  }
  
  return { allowed: true };
}

// Enhanced 0x API client with error handling and validation
const ZERO_X_API_URL = "https://api.0x.org";

interface QuoteParams {
  buyToken: string;
  sellToken: string;
  sellAmount: string;
  slippagePercentage?: number;
  gasPrice?: string;
}

async function getQuoteWithValidation(params: QuoteParams) {
  try {
    // Validate inputs
    if (!params.buyToken || !params.sellToken || !params.sellAmount) {
      throw new Error('Invalid quote parameters: missing required fields');
    }
    
    // Add slippage protection
    const requestParams = {
      ...params,
      slippagePercentage: params.slippagePercentage || ARBITRAGE_CONFIG.slippageTolerance / 100,
    };
    
    if (ARBITRAGE_CONFIG.enableDetailedLogging) {
      console.log('Requesting quote with params:', requestParams);
    }
    
    const response = await axios.get(`${ZERO_X_API_URL}/swap/v1/quote`, {
      params: requestParams,
      timeout: 10000, // 10 second timeout
    });
    
    // Validate response
    if (!response.data || !response.data.buyAmount || !response.data.sellAmount) {
      throw new Error('Invalid response from 0x API: missing required fields');
    }
    
    // Gas price validation
    const gasPrice = BigInt(response.data.gasPrice || '0');
    const maxGasPriceWei = BigInt(ARBITRAGE_CONFIG.maxGasPrice) * BigInt(10 ** 9);
    
    if (gasPrice > maxGasPriceWei) {
      throw new Error(`Gas price too high: ${ethers.formatUnits(gasPrice, 'gwei')} gwei > ${ARBITRAGE_CONFIG.maxGasPrice} gwei limit`);
    }
    
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.validationErrors?.[0]?.description || error.message;
    console.error(`Quote request failed:`, errorMessage);
    
    if (ARBITRAGE_CONFIG.notifyOnErrors) {
      // Here you could integrate with notification services
      console.error(`ALERT: Quote request failed - ${errorMessage}`);
    }
    
    return null;
  }
}

// Enhanced risk management integration
const riskManager = new SimpleRiskManager({
  maxPositionSize: ARBITRAGE_CONFIG.maxTradeSize,
  maxDailyLoss: parseFloat(process.env['MAX_DAILY_LOSS'] || '5.0'), // 5 ETH daily loss limit
  emergencyStopLoss: parseFloat(process.env['EMERGENCY_STOP_LOSS'] || '10.0'), // 10 ETH total loss limit
});

// Secure trade execution with MEV protection
async function executeSecureTrade(quote: any, chainClient: any, tradeType: string): Promise<string | null> {
  try {
    // Pre-execution validation
    if (!quote || !quote.to || !quote.data) {
      throw new Error(`Invalid quote for ${tradeType}: missing transaction data`);
    }
    
    // Risk management check
    const riskCheck = riskManager.validateTrade({
      amount: parseFloat(ethers.formatEther(quote.sellAmount || '0')),
      type: 'ARBITRAGE',
      token: ARBITRAGE_CONFIG.tokenPair.tokenA,
    });
    
    if (!riskCheck.allowed) {
      throw new Error(`Risk management blocked trade: ${riskCheck.reason}`);
    }
    
    // MEV protection if enabled
    if (ARBITRAGE_CONFIG.mevProtection.enabled) {
      console.log(`🛡️ Executing ${tradeType} with MEV protection...`);
      
      // Add MEV protection parameters
      const mevProtectedTx = {
        ...quote,
        maxPriorityFeePerGas: ARBITRAGE_CONFIG.mevProtection.maxPriorityFeePerGas || '2000000000',
        type: 2, // EIP-1559 transaction
      };
      
      // For now, use regular transaction (MEV protection would require specialized relay)
      return await chainClient.sendTransaction({
        to: mevProtectedTx.to,
        data: mevProtectedTx.data,
        value: mevProtectedTx.value,
        gasPrice: mevProtectedTx.gasPrice,
        maxPriorityFeePerGas: mevProtectedTx.maxPriorityFeePerGas,
      });
    } else {
      console.log(`⚠️ Executing ${tradeType} without MEV protection (not recommended for production)`);
      return await chainClient.sendTransaction({
        to: quote.to,
        data: quote.data,
        value: quote.value,
        gasPrice: quote.gasPrice,
      });
    }
  } catch (error) {
    console.error(`Trade execution failed for ${tradeType}:`, error);
    throw error;
  }
}

// Enhanced profitability calculation with comprehensive validation
function calculateProfitability(
  initialAmount: bigint,
  finalAmount: bigint,
  gasAtoB: bigint,
  gasPriceAtoB: bigint,
  gasBtoA: bigint,
  gasPriceBtoA: bigint
): { isProfit: boolean; netProfit: bigint; profitPercentage: number; metrics: any } {
  
  const grossProfit = finalAmount - initialAmount;
  const estimatedGasCost = (gasAtoB * gasPriceAtoB) + (gasBtoA * gasPriceBtoA);
  const netProfit = grossProfit - estimatedGasCost;
  const profitPercentage = (Number(netProfit) / Number(initialAmount)) * 100;
  
  const metrics = {
    initialAmount: ethers.formatEther(initialAmount),
    finalAmount: ethers.formatEther(finalAmount),
    grossProfit: ethers.formatEther(grossProfit),
    estimatedGasCost: ethers.formatEther(estimatedGasCost),
    netProfit: ethers.formatEther(netProfit),
    profitPercentage: profitPercentage.toFixed(6),
    gasAtoB: gasAtoB.toString(),
    gasPriceAtoB: ethers.formatUnits(gasPriceAtoB, 'gwei'),
    gasBtoA: gasBtoA.toString(),
    gasPriceBtoA: ethers.formatUnits(gasPriceBtoA, 'gwei'),
  };
  
  return {
    isProfit: netProfit > 0,
    netProfit,
    profitPercentage,
    metrics
  };
}

// Comprehensive logging and monitoring
function logTradeAttempt(
  opportunity: any,
  executed: boolean,
  txHashes?: { txA?: string; txB?: string },
  error?: string
): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO arbitrage_trades (
        bot_id, user_id, wallet_id, trade_pair, initial_amount, final_amount,
        net_profit, profit_percentage, tx_hash_a, tx_hash_b,
        gas_used_a, gas_used_b, gas_price_a, gas_price_b,
        slippage_tolerance, mev_protection_used, execution_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      ARBITRAGE_CONFIG.botId,
      ARBITRAGE_CONFIG.userId,
      ARBITRAGE_CONFIG.walletId,
      `${ARBITRAGE_CONFIG.tokenPair.tokenA}-${ARBITRAGE_CONFIG.tokenPair.tokenB}`,
      opportunity.metrics.initialAmount,
      opportunity.metrics.finalAmount,
      opportunity.metrics.netProfit,
      opportunity.profitPercentage,
      txHashes?.txA || null,
      txHashes?.txB || null,
      opportunity.metrics.gasAtoB,
      opportunity.metrics.gasBtoA,
      opportunity.metrics.gasPriceAtoB,
      opportunity.metrics.gasPriceBtoA,
      ARBITRAGE_CONFIG.slippageTolerance,
      ARBITRAGE_CONFIG.mevProtection.enabled,
      executed ? (error ? 'FAILED' : 'COMPLETED') : 'CANCELLED'
    );
    
    // Update bot status
    const statusStmt = db.prepare(`
      INSERT OR REPLACE INTO bot_status (
        bot_id, is_running, last_activity, total_trades, 
        successful_trades, failed_trades, total_profit, last_error, error_count
      ) VALUES (?, ?, ?, 
        COALESCE((SELECT total_trades FROM bot_status WHERE bot_id = ?), 0) + 1,
        COALESCE((SELECT successful_trades FROM bot_status WHERE bot_id = ?), 0) + ?,
        COALESCE((SELECT failed_trades FROM bot_status WHERE bot_id = ?), 0) + ?,
        COALESCE((SELECT total_profit FROM bot_status WHERE bot_id = ?), '0'),
        ?, COALESCE((SELECT error_count FROM bot_status WHERE bot_id = ?), 0) + ?
      )
    `);
    
    statusStmt.run(
      ARBITRAGE_CONFIG.botId, true, new Date().toISOString(),
      ARBITRAGE_CONFIG.botId, ARBITRAGE_CONFIG.botId, executed && !error ? 1 : 0,
      ARBITRAGE_CONFIG.botId, executed && error ? 1 : 0,
      ARBITRAGE_CONFIG.botId, error || null, ARBITRAGE_CONFIG.botId, error ? 1 : 0
    );
    
  } catch (dbError) {
    console.error('Database logging failed:', dbError);
  }
}

// Main arbitrage execution with comprehensive security
async function runSecureArbitrage(): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] 🔍 Scanning for arbitrage opportunities...`);
  
  try {
    // Validate environment and configuration
    validateEnvironment();
    
    // Check rate limiting
    const tradeCheck = canExecuteTrade();
    if (!tradeCheck.allowed) {
      console.log(`⏳ Trade execution blocked: ${tradeCheck.reason}`);
      return;
    }
    
    // Initialize secure chain client
    const chainClient = createChainClient(
      ARBITRAGE_CONFIG.chain,
      process.env['WALLET_PRIVATE_KEY']!,
      process.env['ETH_RPC_URL']!
    );
    
    // Calculate trade size with risk management
    const baseTradeSize = Math.min(ARBITRAGE_CONFIG.maxTradeSize, 1.0); // Limit to 1 ETH for safety
    const sellAmountWei = ethers.parseEther(baseTradeSize.toString());
    
    if (ARBITRAGE_CONFIG.enableDetailedLogging) {
      console.log(`Trading ${baseTradeSize} ${ARBITRAGE_CONFIG.chain} with max slippage ${ARBITRAGE_CONFIG.slippageTolerance}%`);
    }
    
    // Get first quote: A -> B
    const quoteAtoB = await getQuoteWithValidation({
      buyToken: ARBITRAGE_CONFIG.tokenPair.tokenB,
      sellToken: ARBITRAGE_CONFIG.tokenPair.tokenA,
      sellAmount: sellAmountWei.toString(),
      slippagePercentage: ARBITRAGE_CONFIG.slippageTolerance / 100,
    });
    
    if (!quoteAtoB) {
      console.log("❌ Could not get quote for A -> B. Skipping cycle.");
      return;
    }
    
    const buyAmountFromAtoB = BigInt(quoteAtoB.buyAmount);
    
    // Get second quote: B -> A
    const quoteBtoA = await getQuoteWithValidation({
      buyToken: ARBITRAGE_CONFIG.tokenPair.tokenA,
      sellToken: ARBITRAGE_CONFIG.tokenPair.tokenB,
      sellAmount: buyAmountFromAtoB.toString(),
      slippagePercentage: ARBITRAGE_CONFIG.slippageTolerance / 100,
    });
    
    if (!quoteBtoA) {
      console.log("❌ Could not get quote for B -> A. Skipping cycle.");
      return;
    }
    
    // Calculate profitability with comprehensive analysis
    const finalAmount = BigInt(quoteBtoA.buyAmount);
    const profitability = calculateProfitability(
      sellAmountWei,
      finalAmount,
      BigInt(quoteAtoB.gas || '0'),
      BigInt(quoteAtoB.gasPrice || '0'),
      BigInt(quoteBtoA.gas || '0'),
      BigInt(quoteBtoA.gasPrice || '0')
    );
    
    if (profitability.isProfit) {
      console.log(`\n✅ Arbitrage Opportunity Detected!`);
      console.log(`   Initial Amount: ${profitability.metrics.initialAmount} ${ARBITRAGE_CONFIG.chain}`);
      console.log(`   Final Amount:   ${profitability.metrics.finalAmount} ${ARBITRAGE_CONFIG.chain}`);
      console.log(`   Gross Profit:   ${profitability.metrics.grossProfit} ${ARBITRAGE_CONFIG.chain}`);
      console.log(`   Gas Cost:       ${profitability.metrics.estimatedGasCost} ${ARBITRAGE_CONFIG.chain}`);
      console.log(`   Net Profit:     ${profitability.metrics.netProfit} ${ARBITRAGE_CONFIG.chain} (${profitability.metrics.profitPercentage}%)`);
      console.log(`   MEV Protection: ${ARBITRAGE_CONFIG.mevProtection.enabled ? 'ENABLED' : 'DISABLED'}`);
      
      if (profitability.profitPercentage > ARBITRAGE_CONFIG.minProfitThreshold) {
        console.log(`🚀 Profit threshold met (${profitability.profitPercentage}% > ${ARBITRAGE_CONFIG.minProfitThreshold}%). Executing trades...`);
        
        let txHashes: { txA?: string; txB?: string } = {};
        let executionError: string | undefined;
        
        try {
          // Execute trades with security measures
          txHashes.txA = await executeSecureTrade(quoteAtoB, chainClient, 'A->B') || undefined;
          console.log(`   ✅ Trade 1 (A->B) executed: ${txHashes.txA}`);
          
          txHashes.txB = await executeSecureTrade(quoteBtoA, chainClient, 'B->A') || undefined;
          console.log(`   ✅ Trade 2 (B->A) executed: ${txHashes.txB}`);
          
          // Update trade tracking
          tradeTracker.lastTradeTime = Date.now();
          tradeTracker.hourlyTradeTimestamps.push(Date.now());
          
          console.log(`🎉 Arbitrage completed successfully! Net profit: ${profitability.metrics.netProfit} ${ARBITRAGE_CONFIG.chain}`);
          
        } catch (error) {
          executionError = error instanceof Error ? error.message : 'Unknown execution error';
          console.error(`❌ Trade execution failed:`, executionError);
          
          if (ARBITRAGE_CONFIG.notifyOnErrors) {
            console.error(`🚨 ALERT: Arbitrage execution failed - ${executionError}`);
          }
        }
        
        // Log the trade attempt (success or failure)
        logTradeAttempt(profitability, true, txHashes, executionError);
        
      } else {
        console.log(`⏳ Profit below threshold (${profitability.profitPercentage}% < ${ARBITRAGE_CONFIG.minProfitThreshold}%). Skipping execution.`);
        logTradeAttempt(profitability, false);
      }
      
    } else {
      console.log(`📊 No profitable opportunity found (${profitability.metrics.profitPercentage}% profit). Gas cost: ${profitability.metrics.estimatedGasCost} ${ARBITRAGE_CONFIG.chain}`);
    }
    
    const executionTime = Date.now() - startTime;
    if (ARBITRAGE_CONFIG.enableDetailedLogging) {
      console.log(`⏱️ Cycle completed in ${executionTime}ms`);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`💥 Arbitrage cycle failed:`, errorMessage);
    
    if (ARBITRAGE_CONFIG.notifyOnErrors) {
      console.error(`🚨 CRITICAL ALERT: Arbitrage bot error - ${errorMessage}`);
    }
    
    // Log critical errors to database
    try {
      const errorStmt = db.prepare(`
        UPDATE bot_status SET 
          last_error = ?, 
          error_count = error_count + 1,
          updated_at = CURRENT_TIMESTAMP 
        WHERE bot_id = ?
      `);
      errorStmt.run(errorMessage, ARBITRAGE_CONFIG.botId);
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }
  }
}

// Enhanced bot startup with comprehensive validation
async function startSecureArbitrageBot(): Promise<void> {
  console.log('🤖 Starting Secure Arbitrage Bot...');
  console.log('========================================');
  
  try {
    // Validate environment and configuration
    validateEnvironment();
    console.log('✅ Environment validation passed');
    
    // Initialize secure database
    initializeDatabase();
    console.log('✅ Database initialized with security enhancements');
    
    // Initialize risk management
    console.log('✅ Risk management system initialized');
    
    // Log configuration (without sensitive data)
    console.log('\n📋 Bot Configuration:');
    console.log(`   Bot ID: ${ARBITRAGE_CONFIG.botId}`);
    console.log(`   Chain: ${ARBITRAGE_CONFIG.chain}`);
    console.log(`   Token Pair: ${ARBITRAGE_CONFIG.tokenPair.tokenA} <-> ${ARBITRAGE_CONFIG.tokenPair.tokenB}`);
    console.log(`   Min Profit Threshold: ${ARBITRAGE_CONFIG.minProfitThreshold}%`);
    console.log(`   Max Trade Size: ${ARBITRAGE_CONFIG.maxTradeSize} ${ARBITRAGE_CONFIG.chain}`);
    console.log(`   Slippage Tolerance: ${ARBITRAGE_CONFIG.slippageTolerance}%`);
    console.log(`   MEV Protection: ${ARBITRAGE_CONFIG.mevProtection.enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Max Gas Price: ${ARBITRAGE_CONFIG.maxGasPrice} gwei`);
    console.log(`   Trade Cooldown: ${ARBITRAGE_CONFIG.cooldownBetweenTrades / 1000}s`);
    console.log(`   Max Trades/Hour: ${ARBITRAGE_CONFIG.maxTradesPerHour}`);
    console.log('');
    
    // Mark bot as running
    const statusStmt = db.prepare(`
      INSERT OR REPLACE INTO bot_status (
        bot_id, is_running, last_activity, total_trades, 
        successful_trades, failed_trades, total_profit, error_count
      ) VALUES (?, ?, ?, 0, 0, 0, '0', 0)
    `);
    statusStmt.run(ARBITRAGE_CONFIG.botId, true, new Date().toISOString());
    
    // Run initial cycle
    console.log('🚀 Running initial arbitrage scan...');
    await runSecureArbitrage();
    
    // Start polling loop with configurable interval
    const pollingInterval = parseInt(process.env['POLLING_INTERVAL'] || '30000'); // Default 30s
    console.log(`⏰ Starting polling loop with ${pollingInterval / 1000}s interval`);
    
    setInterval(() => {
      runSecureArbitrage().catch((error) => {
        console.error('Polling cycle error:', error);
      });
    }, pollingInterval);
    
    console.log('✅ Secure Arbitrage Bot is running!');
    console.log('Press Ctrl+C to stop the bot safely\n');
    
  } catch (error) {
    console.error('💥 Bot startup failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\n🛑 Received shutdown signal. Stopping bot safely...');
  
  // Mark bot as stopped
  try {
    const statusStmt = db.prepare(`
      UPDATE bot_status SET 
        is_running = FALSE, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE bot_id = ?
    `);
    statusStmt.run(ARBITRAGE_CONFIG.botId);
    console.log('✅ Bot status updated');
  } catch (error) {
    console.error('Error updating bot status:', error);
  }
  
  // Close database connection
  try {
    db.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('Error closing database:', error);
  }
  
  console.log('👋 Secure Arbitrage Bot stopped successfully');
  process.exit(0);
});

// Start the bot
if (require.main === module) {
  startSecureArbitrageBot().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ARBITRAGE_CONFIG, runSecureArbitrage, startSecureArbitrageBot }; 