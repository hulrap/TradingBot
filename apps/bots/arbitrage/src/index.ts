import { ArbitrageBotConfig, Chain } from "@trading-bot/types";
import { createChainClient } from "@trading-bot/chain-client";
import axios from "axios";
import { ethers } from "ethers";
import { DatabaseManager, DatabaseConfig } from "./database-manager";
import { RiskManager, RiskParameters } from "./risk-manager";
import winston from "winston";
import crypto from "crypto";

// --- Enhanced Configuration Management ---
interface BotConfiguration {
  arbitrage: ArbitrageBotConfig;
  risk: RiskParameters;
  trading: {
    minPollingInterval: number;
    maxPollingInterval: number;
    adaptivePolling: boolean;
    slippageProtection: {
      enabled: boolean;
      maxSlippage: number; // percentage
      minLiquidity: number; // minimum liquidity required
    };
    mevProtection: {
      enabled: boolean;
      maxGasPrice: string; // in gwei
      priorityFee: string; // in gwei
      maxWaitTime: number; // milliseconds
    };
    gasOptimization: {
      enabled: boolean;
      gasPriceMultiplier: number;
      maxGasPrice: string; // in gwei
      minGasPrice: string; // in gwei
    };
  };
  database: DatabaseConfig;
  performance: {
    cacheEnabled: boolean;
    cacheTTL: number; // milliseconds
    maxConcurrentRequests: number;
    requestTimeout: number; // milliseconds
  };
}

// --- Default Configuration ---
const DEFAULT_CONFIG: BotConfiguration = {
  arbitrage: {
    id: "arbitrage-bot-1",
    userId: process.env['USER_ID'] || "user-arbitrage-1",
    walletId: process.env['WALLET_ID'] || "wallet-arbitrage-1",
    chain: (process.env['CHAIN'] as Chain) || "ETH",
    tokenPair: {
      tokenA: process.env['TOKEN_A'] || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Native token
      tokenB: process.env['TOKEN_B'] || "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
    },
    minProfitThreshold: parseFloat(process.env['MIN_PROFIT_THRESHOLD'] || "0.15"), // 0.15% profit
    tradeSize: parseFloat(process.env['TRADE_SIZE'] || "0.1"), // 0.1 ETH for safety
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  risk: {
    maxPositionSize: parseFloat(process.env['MAX_POSITION_SIZE'] || "1"), // 1 ETH max
    maxDailyLoss: parseFloat(process.env['MAX_DAILY_LOSS'] || "1.0"), // 1% daily loss
    stopLossPercentage: parseFloat(process.env['STOP_LOSS_PERCENTAGE'] || "0.5"), // 0.5% stop loss
    takeProfitPercentage: parseFloat(process.env['TAKE_PROFIT_PERCENTAGE'] || "0.3"), // 0.3% take profit
    maxConcurrentTrades: parseInt(process.env['MAX_CONCURRENT_TRADES'] || "2"), // 2 concurrent trades
    cooldownPeriod: parseInt(process.env['COOLDOWN_PERIOD'] || "300000"), // 5 minutes
    volatilityThreshold: parseFloat(process.env['VOLATILITY_THRESHOLD'] || "0.2"), // 20% volatility
    correlationLimit: parseFloat(process.env['CORRELATION_LIMIT'] || "0.6"), // 60% correlation
    maxDrawdown: parseFloat(process.env['MAX_DRAWDOWN'] || "3.0"), // 3% max drawdown
    emergencyStopLoss: parseFloat(process.env['EMERGENCY_STOP_LOSS'] || "2.0") // 2% emergency stop
  },
  trading: {
    minPollingInterval: parseInt(process.env['MIN_POLLING_INTERVAL'] || "5000"), // 5 seconds
    maxPollingInterval: parseInt(process.env['MAX_POLLING_INTERVAL'] || "60000"), // 60 seconds
    adaptivePolling: process.env['ADAPTIVE_POLLING'] === 'true',
    slippageProtection: {
      enabled: process.env['SLIPPAGE_PROTECTION'] !== 'false', // enabled by default
      maxSlippage: parseFloat(process.env['MAX_SLIPPAGE'] || "0.5"), // 0.5% max slippage
      minLiquidity: parseFloat(process.env['MIN_LIQUIDITY'] || "10000"), // $10k min liquidity
    },
    mevProtection: {
      enabled: process.env['MEV_PROTECTION'] !== 'false', // enabled by default
      maxGasPrice: process.env['MAX_GAS_PRICE'] || "50", // 50 gwei
      priorityFee: process.env['PRIORITY_FEE'] || "2", // 2 gwei
      maxWaitTime: parseInt(process.env['MAX_WAIT_TIME'] || "30000"), // 30 seconds
    },
    gasOptimization: {
      enabled: process.env['GAS_OPTIMIZATION'] !== 'false', // enabled by default
      gasPriceMultiplier: parseFloat(process.env['GAS_PRICE_MULTIPLIER'] || "1.1"), // 10% buffer
      maxGasPrice: process.env['MAX_GAS_PRICE'] || "100", // 100 gwei
      minGasPrice: process.env['MIN_GAS_PRICE'] || "1", // 1 gwei
    },
  },
  database: {
    dbPath: process.env['DB_PATH'] || "arbitrage_bot.db",
    backupPath: process.env['BACKUP_PATH'] || "./backups",
    maxBackups: parseInt(process.env['MAX_BACKUPS'] || "10"),
    performanceMonitoring: process.env['PERFORMANCE_MONITORING'] !== 'false',
    queryTimeout: parseInt(process.env['QUERY_TIMEOUT'] || "30000"),
    enableWAL: process.env['ENABLE_WAL'] !== 'false',
    enableForeignKeys: process.env['ENABLE_FOREIGN_KEYS'] !== 'false'
  },
  performance: {
    cacheEnabled: process.env['CACHE_ENABLED'] !== 'false',
    cacheTTL: parseInt(process.env['CACHE_TTL'] || "5000"), // 5 seconds
    maxConcurrentRequests: parseInt(process.env['MAX_CONCURRENT_REQUESTS'] || "3"),
    requestTimeout: parseInt(process.env['REQUEST_TIMEOUT'] || "10000"), // 10 seconds
  },
};

// --- Environment Validation ---
function validateEnvironment(): void {
  const required = ['ETH_RPC_URL', 'PRIVATE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Security warnings
  if (process.env['PRIVATE_KEY'] && process.env['PRIVATE_KEY'].length < 64) {
    logger.warn('⚠️  SECURITY WARNING: Private key appears to be invalid length');
  }

  if (process.env['NODE_ENV'] === 'production' && DEFAULT_CONFIG.arbitrage.tradeSize > 0.1) {
    logger.warn('⚠️  PRODUCTION WARNING: Trade size is high for production environment');
  }

  logger.info('✅ Environment validation passed');
}

// --- Enhanced Logger Configuration ---
const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'arbitrage-bot.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'arbitrage-bot-error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'arbitrage-bot-exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'arbitrage-bot-rejections.log' })
  ]
});

// --- Initialize Components ---
const CONFIG = DEFAULT_CONFIG;
const dbManager = new DatabaseManager(CONFIG.database, logger);
const riskManager = new RiskManager(
  dbManager, 
  CONFIG.risk, 
  logger, 
  parseFloat(process.env['BASE_PORTFOLIO_VALUE'] || "50000") // $50k base portfolio
);

// --- Enhanced State Management ---
interface ActiveTrade {
  id: string;
  pair: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  slippage: number;
  gasUsed: number;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

interface BotState {
  activeTrades: Map<string, ActiveTrade>;
  tradingPaused: boolean;
  emergencyShutdown: boolean;
  lastOpportunityCheck: number;
  currentPollingInterval: number;
  performanceMetrics: {
    totalOpportunities: number;
    executedTrades: number;
    failedTrades: number;
    avgExecutionTime: number;
    totalProfit: number;
    totalGasCost: number;
  };
  priceCache: Map<string, { price: number; timestamp: number }>;
  gasCache: { price: number; timestamp: number } | null;
}

const botState: BotState = {
  activeTrades: new Map(),
  tradingPaused: false,
  emergencyShutdown: false,
  lastOpportunityCheck: 0,
  currentPollingInterval: CONFIG.trading.minPollingInterval,
  performanceMetrics: {
    totalOpportunities: 0,
    executedTrades: 0,
    failedTrades: 0,
    avgExecutionTime: 0,
    totalProfit: 0,
    totalGasCost: 0,
  },
  priceCache: new Map(),
  gasCache: null,
};

// --- Risk Manager Event Handlers ---
riskManager.on('riskEvent', (event) => {
  logger.warn('Risk event received:', event);
});

riskManager.on('closeTrade', (tradeId: string) => {
  logger.info(`Risk manager requested to close trade: ${tradeId}`);
  if (botState.activeTrades.has(tradeId)) {
    const trade = botState.activeTrades.get(tradeId)!;
    trade.status = 'failed';
    botState.activeTrades.delete(tradeId);
    botState.performanceMetrics.failedTrades++;
  }
});

riskManager.on('pauseTrading', (data: { duration: number }) => {
  logger.warn(`Trading paused for ${data.duration}ms due to risk management`);
  botState.tradingPaused = true;
  setTimeout(() => {
    botState.tradingPaused = false;
    logger.info('Trading resumed after risk management cooldown');
  }, data.duration);
});

riskManager.on('emergencyShutdown', (event) => {
  logger.error('Emergency shutdown triggered:', event);
  botState.emergencyShutdown = true;
  // Close all active trades
  botState.activeTrades.clear();
});

// --- Enhanced 0x API Client with Caching and Error Handling ---
const ZERO_X_API_URL = "https://api.0x.org";
let activeRequests = 0;

interface QuoteRequest {
  buyToken: string;
  sellToken: string;
  sellAmount: string;
  slippagePercentage?: number | undefined;
  skipValidation?: boolean;
}

interface QuoteResponse {
  buyAmount: string;
  sellAmount: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
  minimumProtocolFee: string;
  protocolFee: string;
  sources: Array<{ name: string; proportion: string }>;
  estimatedGas: string;
  allowanceTarget: string;
}

async function getQuoteWithRetry(
  buyToken: string, 
  sellToken: string, 
  sellAmount: string,
  retries: number = 3
): Promise<QuoteResponse | null> {
  const cacheKey = `${buyToken}-${sellToken}-${sellAmount}`;
  
  // Check cache first
  if (CONFIG.performance.cacheEnabled) {
    const cached = botState.priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CONFIG.performance.cacheTTL) {
      logger.debug('Using cached quote', { cacheKey });
      return cached.price as any; // Type assertion for cached quote
    }
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait for available request slot
      while (activeRequests >= CONFIG.performance.maxConcurrentRequests) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      activeRequests++;
      
      const quoteRequest: QuoteRequest = {
        buyToken,
        sellToken,
        sellAmount,
        slippagePercentage: CONFIG.trading.slippageProtection.enabled ? 
          CONFIG.trading.slippageProtection.maxSlippage : undefined,
        skipValidation: false
      };

      const response = await axios.get(`${ZERO_X_API_URL}/swap/v1/quote`, {
        params: quoteRequest,
        timeout: CONFIG.performance.requestTimeout,
        headers: {
          'User-Agent': 'TradingBot/1.0',
          'Accept': 'application/json',
        }
      });

      const quote = response.data as QuoteResponse;
      
      // Validate quote response
      if (!quote.buyAmount || !quote.sellAmount || !quote.to || !quote.data) {
        throw new Error('Invalid quote response structure');
      }

      // Cache the result
      if (CONFIG.performance.cacheEnabled) {
        botState.priceCache.set(cacheKey, {
          price: quote as any,
          timestamp: Date.now()
        });
      }

      activeRequests--;
      return quote;

    } catch (error: any) {
      activeRequests--;
      
      if (attempt === retries - 1) {
        logger.error("Failed to get quote after retries:", {
          error: error.message,
          buyToken,
          sellToken,
          sellAmount,
          attempts: retries,
          responseData: error.response?.data
        });
        return null;
      }
      
      // Wait before retry with exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, attempt), 10000);
      logger.warn(`Quote request failed (attempt ${attempt + 1}/${retries}), retrying in ${waitTime}ms:`, {
        error: error.message,
        buyToken,
        sellToken
      });
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  return null;
}

// --- Enhanced Gas Price Management ---
async function getCurrentGasPrice(): Promise<bigint> {
  try {
    // Check cache first
    if (botState.gasCache && Date.now() - botState.gasCache.timestamp < 30000) { // 30 second cache
      return BigInt(botState.gasCache.price);
    }

    const chainClient = createChainClient(
      CONFIG.arbitrage.chain, 
      process.env['PRIVATE_KEY']!, 
      process.env['ETH_RPC_URL']!
    );

    const ethProvider = await chainClient.getProvider(CONFIG.arbitrage.chain as any);
    const feeData = await ethProvider.getFeeData();
    let gasPrice = feeData.gasPrice || BigInt(0);

    // Apply gas optimization if enabled
    if (CONFIG.trading.gasOptimization.enabled) {
      const multiplier = BigInt(Math.floor(CONFIG.trading.gasOptimization.gasPriceMultiplier * 100));
      gasPrice = (gasPrice * multiplier) / BigInt(100);
      
      // Apply min/max constraints
      const minGasPrice = BigInt(CONFIG.trading.gasOptimization.minGasPrice) * BigInt(1e9); // gwei to wei
      const maxGasPrice = BigInt(CONFIG.trading.gasOptimization.maxGasPrice) * BigInt(1e9); // gwei to wei
      
      gasPrice = gasPrice < minGasPrice ? minGasPrice : gasPrice;
      gasPrice = gasPrice > maxGasPrice ? maxGasPrice : gasPrice;
    }

    // Cache the result
    botState.gasCache = {
      price: Number(gasPrice),
      timestamp: Date.now()
    };

    return gasPrice;

  } catch (error) {
    logger.error('Failed to get current gas price:', error);
    // Return a fallback gas price
    return BigInt(20e9); // 20 gwei
  }
}

// --- Slippage Protection ---
function validateSlippage(
  expectedAmount: bigint, 
  actualAmount: bigint, 
  maxSlippagePercent: number
): boolean {
  if (!CONFIG.trading.slippageProtection.enabled) {
    return true;
  }

  const slippagePercent = Number(expectedAmount - actualAmount) / Number(expectedAmount) * 100;
  
  if (slippagePercent > maxSlippagePercent) {
    logger.warn(`Slippage too high: ${slippagePercent.toFixed(4)}% > ${maxSlippagePercent}%`);
    return false;
  }
  
  return true;
}

// --- Enhanced Main Arbitrage Logic ---
async function runArbitrage(): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.debug(`[${new Date().toISOString()}] Checking for arbitrage opportunities...`);

    // Pre-flight checks
    if (botState.tradingPaused) {
      logger.debug('Trading is paused due to risk management');
      return;
    }

    if (botState.emergencyShutdown) {
      logger.error('Bot is in emergency shutdown mode');
      return;
    }

    if (riskManager.isEmergencyMode()) {
      logger.error('Risk manager is in emergency mode');
      return;
    }

    // Check active trades limit
    if (botState.activeTrades.size >= CONFIG.risk.maxConcurrentTrades) {
      logger.debug(`Maximum concurrent trades reached: ${botState.activeTrades.size}`);
      return;
    }

    // Validate environment
    if (!process.env['ETH_RPC_URL'] || !process.env['PRIVATE_KEY']) {
      throw new Error("Missing environment variables: ETH_RPC_URL or PRIVATE_KEY");
    }

    const chainClient = createChainClient(
      CONFIG.arbitrage.chain, 
      process.env['PRIVATE_KEY']!, 
      process.env['ETH_RPC_URL']!
    );

    const sellAmountWei = (CONFIG.arbitrage.tradeSize * 10 ** 18).toString();

    // Get first quote
    const quoteAtoB = await getQuoteWithRetry(
      CONFIG.arbitrage.tokenPair.tokenB,
      CONFIG.arbitrage.tokenPair.tokenA,
      sellAmountWei
    );

    if (!quoteAtoB) {
      logger.debug("Could not get quote for A -> B. Skipping cycle.");
      return;
    }

    const buyAmountFromAtoB = BigInt(quoteAtoB.buyAmount);

    // Get second quote
    const quoteBtoA = await getQuoteWithRetry(
      CONFIG.arbitrage.tokenPair.tokenA,
      CONFIG.arbitrage.tokenPair.tokenB,
      buyAmountFromAtoB.toString()
    );

    if (!quoteBtoA) {
      logger.debug("Could not get quote for B -> A. Skipping cycle.");
      return;
    }

    const finalAmount = BigInt(quoteBtoA.buyAmount);
    const initialAmount = BigInt(sellAmountWei);
    
    // Enhanced profitability calculation with dynamic gas pricing
    const grossProfit = finalAmount - initialAmount;
    const currentGasPrice = await getCurrentGasPrice();
    const estimatedGasCost = (BigInt(quoteAtoB.gas) + BigInt(quoteBtoA.gas)) * currentGasPrice;
    const netProfit = grossProfit - estimatedGasCost;
    
    botState.performanceMetrics.totalOpportunities++;
    
    if (netProfit > 0) {
      const profitPercentage = (Number(netProfit) / Number(initialAmount)) * 100;
      
      logger.info(`💰 Arbitrage Opportunity Found!`, {
        initialAmount: ethers.formatEther(initialAmount),
        finalAmount: ethers.formatEther(finalAmount),
        grossProfit: ethers.formatEther(grossProfit),
        estimatedGasCost: ethers.formatEther(estimatedGasCost),
        netProfit: ethers.formatEther(netProfit),
        profitPercentage: profitPercentage.toFixed(6),
        currentGasPrice: ethers.formatUnits(currentGasPrice, 'gwei')
      });

      if (profitPercentage > CONFIG.arbitrage.minProfitThreshold) {
        await executeArbitrageTrade(
          quoteAtoB,
          quoteBtoA,
          initialAmount,
          finalAmount,
          netProfit,
          profitPercentage,
          chainClient
        );
      } else {
        logger.debug(`Profit ${profitPercentage.toFixed(4)}% below threshold ${CONFIG.arbitrage.minProfitThreshold}%`);
      }
    } else {
      logger.debug("No profitable opportunity found in this cycle.");
    }

    // Update performance metrics
    const executionTime = Date.now() - startTime;
    botState.performanceMetrics.avgExecutionTime = 
      (botState.performanceMetrics.avgExecutionTime + executionTime) / 2;

  } catch (error) {
    logger.error('Error in arbitrage cycle:', error);
    botState.performanceMetrics.failedTrades++;
  } finally {
    botState.lastOpportunityCheck = Date.now();
    
    // Adaptive polling: adjust interval based on market activity
    if (CONFIG.trading.adaptivePolling) {
      adjustPollingInterval();
    }
  }
}

// --- Enhanced Trade Execution ---
async function executeArbitrageTrade(
  quoteAtoB: QuoteResponse,
  quoteBtoA: QuoteResponse,
  initialAmount: bigint,
  finalAmount: bigint,
  netProfit: bigint,
  profitPercentage: number,
  chainClient: any
): Promise<void> {
  const tradeId = crypto.randomUUID();
  const tradePair = `${CONFIG.arbitrage.tokenPair.tokenA}/${CONFIG.arbitrage.tokenPair.tokenB}`;
  const tradeAmount = parseFloat(ethers.formatEther(initialAmount));
  const entryPrice = 1; // Initial price reference
  const currentPrice = parseFloat(ethers.formatEther(finalAmount)) / parseFloat(ethers.formatEther(initialAmount));
  
  logger.info(`🚀 Executing arbitrage trade`, { tradeId, profitPercentage });
  
  try {
    // Enhanced risk assessment
    riskManager.updatePrice(tradePair, currentPrice);
    
    const volatility = riskManager.calculateVolatility(tradePair);
    const confidence = Math.min(profitPercentage / CONFIG.arbitrage.minProfitThreshold, 1);
    const optimalSize = await riskManager.calculateOptimalPositionSize(
      tradePair,
      confidence,
      volatility,
      0 // No correlation for single pair arbitrage
    );
    
    // Check if trade size is within risk limits
    if (tradeAmount > optimalSize) {
      logger.warn(`Trade size ${tradeAmount} exceeds optimal size ${optimalSize}. Adjusting.`);
      return;
    }
    
    // Assess trade and portfolio risk
    const [tradeRisk, portfolioRisk] = await Promise.all([
      riskManager.assessTradeRisk(tradeId, tradePair, tradeAmount, entryPrice, currentPrice),
      riskManager.assessPortfolioRisk()
    ]);
    
    if (portfolioRisk.riskLevel === 'CRITICAL') {
      logger.error('Portfolio risk is CRITICAL. Skipping trade.');
      return;
    }
    
    if (tradeRisk.riskScore > 80) {
      logger.warn(`Trade risk score is high: ${tradeRisk.riskScore}. Skipping trade.`);
      return;
    }
    
    // Create active trade record
    const activeTrade: ActiveTrade = {
      id: tradeId,
      pair: tradePair,
      amount: tradeAmount,
      entryPrice,
      currentPrice,
      slippage: 0,
      gasUsed: 0,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };
    
    botState.activeTrades.set(tradeId, activeTrade);
    
    // Slippage validation
    const slippageValid = validateSlippage(
      finalAmount,
      BigInt(quoteBtoA.buyAmount),
      CONFIG.trading.slippageProtection.maxSlippage
    );
    
    if (!slippageValid) {
      logger.warn('Trade rejected due to slippage protection');
      botState.activeTrades.delete(tradeId);
      return;
    }
    
    activeTrade.status = 'executing';
    
    // Execute trades with enhanced error handling
    const txReceipts = await executeTradesWithRetry(quoteAtoB, quoteBtoA, chainClient, tradeId);
    
    if (!txReceipts) {
      throw new Error('Trade execution failed');
    }
    
    const [receiptAtoB, receiptBtoA] = txReceipts;
    activeTrade.gasUsed = receiptAtoB.gasUsed + receiptBtoA.gasUsed;
    activeTrade.status = 'completed';
    
    // Generate transaction hash for logging
    const txHash = receiptBtoA.transactionHash;
    
    // Record the successful trade
    await recordSuccessfulTrade(
      tradeId,
      tradePair,
      tradeAmount,
      currentPrice,
      parseFloat(ethers.formatEther(netProfit)),
      Number(activeTrade.gasUsed),
      txHash,
      profitPercentage
    );
    
    // Update performance metrics
    botState.performanceMetrics.executedTrades++;
    botState.performanceMetrics.totalProfit += parseFloat(ethers.formatEther(netProfit));
    botState.performanceMetrics.totalGasCost += parseFloat(ethers.formatEther(BigInt(activeTrade.gasUsed) * await getCurrentGasPrice()));
    
    logger.info("✅ Trade executed successfully", {
      tradeId,
      profit: ethers.formatEther(netProfit),
      gasUsed: activeTrade.gasUsed,
      txHash,
      riskScore: tradeRisk.riskScore
    });
    
    // Clean up
    botState.activeTrades.delete(tradeId);
    riskManager.removeTrade(tradeId);
    
  } catch (error) {
    logger.error("Trade execution failed:", { tradeId, error });
    
    // Update trade status and metrics
    if (botState.activeTrades.has(tradeId)) {
      botState.activeTrades.get(tradeId)!.status = 'failed';
      botState.activeTrades.delete(tradeId);
    }
    
    botState.performanceMetrics.failedTrades++;
    riskManager.removeTrade(tradeId);
  }
}

// --- Enhanced Trade Execution with Retry Logic ---
async function executeTradesWithRetry(
  quoteAtoB: QuoteResponse,
  quoteBtoA: QuoteResponse,
  chainClient: any,
  tradeId: string,
  maxRetries: number = 2
): Promise<[any, any] | null> {
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.info(`Executing trade ${tradeId} (attempt ${attempt + 1}/${maxRetries})`);
      
      // MEV Protection: Use optimal gas pricing
      const currentGasPrice = await getCurrentGasPrice();
      const mevProtectedGasPrice = CONFIG.trading.mevProtection.enabled ? 
        currentGasPrice + BigInt(CONFIG.trading.mevProtection.priorityFee) * BigInt(1e9) : 
        currentGasPrice;
      
      // Execute first swap with timeout
      const txAtoB = await chainClient.sendTransaction({
        to: quoteAtoB.to,
        data: quoteAtoB.data,
        value: quoteAtoB.value,
        gasPrice: mevProtectedGasPrice.toString(),
        gasLimit: Math.floor(Number(quoteAtoB.gas) * 1.2), // 20% buffer
      });
      
      logger.info(`Trade 1 submitted: ${txAtoB.hash}`);
      
      // Wait for first transaction with timeout
      const receiptAtoB = await Promise.race([
        chainClient.provider.waitForTransaction(txAtoB.hash),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), CONFIG.trading.mevProtection.maxWaitTime)
        )
      ]);
      
      if (receiptAtoB.status !== 1) {
        throw new Error('First transaction failed');
      }
      
      logger.info(`Trade 1 confirmed: ${receiptAtoB.transactionHash}`);
      
      // Execute second swap
      const txBtoA = await chainClient.sendTransaction({
        to: quoteBtoA.to,
        data: quoteBtoA.data,
        value: quoteBtoA.value,
        gasPrice: mevProtectedGasPrice.toString(),
        gasLimit: Math.floor(Number(quoteBtoA.gas) * 1.2), // 20% buffer
      });
      
      logger.info(`Trade 2 submitted: ${txBtoA.hash}`);
      
      // Wait for second transaction with timeout  
      const receiptBtoA = await Promise.race([
        chainClient.provider.waitForTransaction(txBtoA.hash),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), CONFIG.trading.mevProtection.maxWaitTime)
        )
      ]);
      
      if (receiptBtoA.status !== 1) {
        throw new Error('Second transaction failed');
      }
      
      logger.info(`Trade 2 confirmed: ${receiptBtoA.transactionHash}`);
      
      return [receiptAtoB, receiptBtoA];
      
    } catch (error) {
      logger.error(`Trade execution attempt ${attempt + 1} failed:`, { tradeId, error });
      
      if (attempt === maxRetries - 1) {
        return null;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  
  return null;
}

// --- Enhanced Trade Recording ---
async function recordSuccessfulTrade(
  tradeId: string,
  tradePair: string,
  amount: number,
  executionPrice: number,
  profit: number,
  gasUsed: number,
  txHash: string,
  profitPercentage: number
): Promise<void> {
  try {
    const opportunityId = await dbManager.logOpportunity({
      tokenA: CONFIG.arbitrage.tokenPair.tokenA,
      tokenB: CONFIG.arbitrage.tokenPair.tokenB,
      exchangeA: "0x API",
      exchangeB: "0x API",
      priceA: executionPrice,
      priceB: 1 / executionPrice,
      profitPercentage,
      profitUsd: profit,
      gasEstimate: gasUsed,
      timestamp: Date.now(),
      status: 'executed'
    });
    
    await dbManager.logTrade({
      opportunityId,
      executionPrice,
      amount,
      profit,
      gasUsed,
      txHash,
      timestamp: Date.now()
    });
    
    logger.info("Trade recorded in database", { tradeId, tradePair, opportunityId, txHash });
    
  } catch (error) {
    logger.error("Failed to record trade in database:", { tradeId, error });
    // Don't throw here - trade was successful even if logging failed
  }
}

// --- Adaptive Polling Logic ---
function adjustPollingInterval(): void {
  const recentOpportunities = botState.performanceMetrics.totalOpportunities;
  const recentExecutions = botState.performanceMetrics.executedTrades;
  const successRate = recentExecutions / Math.max(recentOpportunities, 1);
  
  if (successRate > 0.1) {
    // High activity - poll more frequently
    botState.currentPollingInterval = Math.max(
      botState.currentPollingInterval * 0.8,
      CONFIG.trading.minPollingInterval
    );
  } else if (successRate < 0.05) {
    // Low activity - poll less frequently
    botState.currentPollingInterval = Math.min(
      botState.currentPollingInterval * 1.2,
      CONFIG.trading.maxPollingInterval
    );
  }
  
  logger.debug(`Adjusted polling interval to ${botState.currentPollingInterval}ms (success rate: ${(successRate * 100).toFixed(2)}%)`);
}

// --- Enhanced Performance Monitoring ---
async function logPerformanceMetrics(): Promise<void> {
  try {
    const analytics = await dbManager.getTradeAnalytics(24); // Last 24 hours
    const riskSummary = await riskManager.getRiskSummary();
    
    await dbManager.logPerformanceMetric({
      totalTrades: analytics.totalTrades,
      successfulTrades: analytics.successfulTrades,
      totalProfit: analytics.totalProfit,
      totalGasCost: analytics.totalGasCost,
      avgProfitPerTrade: analytics.avgProfitPerTrade,
      successRate: analytics.successRate,
      timestamp: Date.now()
    });
    
    // Clear old cache entries
    if (CONFIG.performance.cacheEnabled) {
      const now = Date.now();
      for (const [key, value] of botState.priceCache.entries()) {
        if (now - value.timestamp > CONFIG.performance.cacheTTL * 2) {
          botState.priceCache.delete(key);
        }
      }
    }
    
    logger.info('📊 Performance metrics updated', {
      analytics,
      riskSummary,
      activeTrades: botState.activeTrades.size,
      currentInterval: botState.currentPollingInterval,
      cacheSize: botState.priceCache.size,
      botMetrics: botState.performanceMetrics
    });
    
  } catch (error) {
    logger.error('Failed to log performance metrics:', error);
  }
}

// --- Graceful Shutdown Handler ---
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`🛑 Received ${signal}, initiating graceful shutdown...`);
    
    botState.emergencyShutdown = true;
    
    // Wait for active trades to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (botState.activeTrades.size > 0 && Date.now() - startTime < shutdownTimeout) {
      logger.info(`Waiting for ${botState.activeTrades.size} active trades to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (botState.activeTrades.size > 0) {
      logger.warn(`Forcing shutdown with ${botState.activeTrades.size} active trades`);
    }
    
    // Final performance log
    await logPerformanceMetrics();
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));
}

// --- Main Bot Execution ---
async function startArbitrageBot(): Promise<void> {
  try {
    logger.info("🤖 Starting Enhanced Arbitrage Bot...");
    
    // Environment validation
    validateEnvironment();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Database and risk manager are initialized in their constructors
    // No additional initialization needed
    
    logger.info("Configuration loaded:", {
      chain: CONFIG.arbitrage.chain,
      tokenPair: CONFIG.arbitrage.tokenPair,
      minProfitThreshold: CONFIG.arbitrage.minProfitThreshold,
      tradeSize: CONFIG.arbitrage.tradeSize,
      riskParameters: CONFIG.risk,
      tradingSettings: CONFIG.trading
    });
    
    // Initial risk summary
    const riskSummary = await riskManager.getRiskSummary();
    logger.info('Initial risk summary:', riskSummary);
    
    // Start performance monitoring
    const metricsInterval = setInterval(logPerformanceMetrics, 5 * 60 * 1000); // 5 minutes
    
    // Main execution loop
    logger.info(`🎯 Bot initialized successfully. Starting arbitrage monitoring...`);
    
    // Run initial arbitrage check
    await runArbitrage();
    
    // Start adaptive polling
    const startPolling = () => {
      if (botState.emergencyShutdown) {
        clearInterval(metricsInterval);
        return;
      }
      
      runArbitrage().catch(error => {
        logger.error('Error in arbitrage execution:', error);
      });
      
      setTimeout(startPolling, botState.currentPollingInterval);
    };
    
    startPolling();
    
  } catch (error) {
    logger.error('Failed to start arbitrage bot:', error);
    process.exit(1);
  }
}

// --- Start the bot ---
startArbitrageBot(); 