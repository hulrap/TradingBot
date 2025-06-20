import { ArbitrageBotConfig, Chain } from "@trading-bot/types";
import { 
  createEnhancedChainClient
} from "@trading-bot/chain-client";
import { ethers } from "ethers";
import { DatabaseManager, DatabaseConfig } from "./database-manager";
import { RiskManager, RiskParameters } from "./risk-manager";
import winston from "winston";
import crypto from "crypto";

// --- Enhanced Configuration Management with Zero-Latency Integration ---

// Add missing type definitions
interface ActiveTrade {
  id: string;
  tokenA: string;
  tokenB: string;
  amount: string;
  expectedProfit: number;
  gasLimit: string;
  gasPrice: string;
  gasUsed?: string;
  timestamp: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  transactionHash?: string;
}

interface CacheEntry {
  price: number;
  timestamp: number;
  confidence: number;
  source: string;
}

interface RouteOpportunity {
  routes: any[];
  profitEstimate: number;
  gasEstimate: number;
  confidence: number;
  timestamp: number;
  bridgeRequired?: boolean;
  bridgeRoute?: string;
  bridgeCost?: number;
  bridgeTime?: number;
}

// --- Enhanced Logger Configuration (moved to top) ---
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

interface BotConfiguration {
  arbitrage: ArbitrageBotConfig;
  risk: RiskParameters;
  trading: {
    livshitsOptimization: {
      enabled: boolean;
      maxHops: number;
      precomputeRoutes: boolean;
      routeRefreshMs: number;
      graphBasedRouting: boolean;
    };
    crossChainArbitrage: {
      enabled: boolean;
      bridgeTimingOptimization: boolean;
      maxBridgeWaitTime: number; // milliseconds
      minProfitAfterBridgeFees: number; // percentage
      bridgeCostThreshold: number; // USD
    };
    dynamicGasOptimization: {
      enabled: boolean;
      realTimeTracking: boolean;
      predictiveGasPricing: boolean;
      mevProtection: boolean;
      maxGasPremium: number; // percentage above current
    };
    slippageProtection: {
      enabled: boolean;
      maxSlippage: number; // percentage
      minLiquidity: number; // minimum liquidity required
      dynamicSlippage: boolean; // Adjust based on market conditions
    };
    mevProtection: {
      enabled: boolean;
      flashbotsEnabled: boolean;
      priorityFeeMultiplier: number;
      maxWaitTime: number; // milliseconds
      bundleOptimization: boolean;
    };
  };
  database: DatabaseConfig;
  performance: {
    cacheEnabled: boolean;
    cacheTTL: number; // milliseconds
    maxConcurrentRequests: number;
    requestTimeout: number; // milliseconds
    latencyTargets: {
      priceUpdate: number; // Target <5ms
      gasUpdate: number;   // Target <10ms
      routeCalculation: number; // Target <1ms
      totalExecution: number;   // Target <50ms
    };
  };
}

// --- Enhanced Default Configuration with Zero-Latency Focus ---
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
    minProfitThreshold: parseFloat(process.env['MIN_PROFIT_THRESHOLD'] || "0.5"), // 0.5% minimum for zero-latency
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
    maxConcurrentTrades: parseInt(process.env['MAX_CONCURRENT_TRADES'] || "3"), // 3 concurrent trades for zero-latency
    cooldownPeriod: parseInt(process.env['COOLDOWN_PERIOD'] || "30000"), // 30 seconds reduced cooldown
    volatilityThreshold: parseFloat(process.env['VOLATILITY_THRESHOLD'] || "0.2"), // 20% volatility
    correlationLimit: parseFloat(process.env['CORRELATION_LIMIT'] || "0.6"), // 60% correlation
    maxDrawdown: parseFloat(process.env['MAX_DRAWDOWN'] || "3.0"), // 3% max drawdown
    emergencyStopLoss: parseFloat(process.env['EMERGENCY_STOP_LOSS'] || "2.0") // 2% emergency stop
  },
  trading: {
    livshitsOptimization: {
      enabled: process.env['LIVSHITS_OPTIMIZATION'] !== 'false', // Enable by default
      maxHops: parseInt(process.env['LIVSHITS_MAX_HOPS'] || "3"), // 2-3 hops optimal per research
      precomputeRoutes: process.env['PRECOMPUTE_ROUTES'] !== 'false',
      routeRefreshMs: parseInt(process.env['ROUTE_REFRESH_MS'] || "30000"), // 30 seconds
      graphBasedRouting: process.env['GRAPH_ROUTING'] !== 'false',
    },
    crossChainArbitrage: {
      enabled: process.env['CROSS_CHAIN_ARB'] === 'true',
      bridgeTimingOptimization: process.env['BRIDGE_TIMING_OPT'] !== 'false',
      maxBridgeWaitTime: parseInt(process.env['MAX_BRIDGE_WAIT'] || "900000"), // 15 minutes max
      minProfitAfterBridgeFees: parseFloat(process.env['MIN_BRIDGE_PROFIT'] || "2.0"), // 2% minimum after bridge costs
      bridgeCostThreshold: parseFloat(process.env['BRIDGE_COST_THRESHOLD'] || "20"), // $20 max bridge cost
    },
    dynamicGasOptimization: {
      enabled: process.env['DYNAMIC_GAS'] !== 'false',
      realTimeTracking: process.env['REALTIME_GAS'] !== 'false',
      predictiveGasPricing: process.env['PREDICTIVE_GAS'] !== 'false',
      mevProtection: process.env['MEV_PROTECTION'] !== 'false',
      maxGasPremium: parseFloat(process.env['MAX_GAS_PREMIUM'] || "50"), // 50% above current max
    },
    slippageProtection: {
      enabled: process.env['SLIPPAGE_PROTECTION'] !== 'false',
      maxSlippage: parseFloat(process.env['MAX_SLIPPAGE'] || "0.5"), // 0.5% max slippage for zero-latency
      minLiquidity: parseFloat(process.env['MIN_LIQUIDITY'] || "10000"), // $10k min liquidity
      dynamicSlippage: process.env['DYNAMIC_SLIPPAGE'] !== 'false',
    },
    mevProtection: {
      enabled: process.env['MEV_PROTECTION'] !== 'false',
      flashbotsEnabled: process.env['FLASHBOTS_ENABLED'] !== 'false',
      priorityFeeMultiplier: parseFloat(process.env['PRIORITY_FEE_MULTIPLIER'] || "1.5"), // 50% premium
      maxWaitTime: parseInt(process.env['MEV_MAX_WAIT_TIME'] || "12000"), // 12 seconds max
      bundleOptimization: process.env['BUNDLE_OPTIMIZATION'] !== 'false',
    },
  },
  database: {
    dbPath: process.env['DB_PATH'] || "arbitrage_bot.db",
    backupPath: process.env['BACKUP_PATH'] || "./backups",
    maxBackups: parseInt(process.env['MAX_BACKUPS'] || "10"),
    performanceMonitoring: process.env['PERFORMANCE_MONITORING'] !== 'false',
    queryTimeout: parseInt(process.env['QUERY_TIMEOUT'] || "5000"), // Reduced for zero-latency
    enableWAL: process.env['ENABLE_WAL'] !== 'false',
    enableForeignKeys: process.env['ENABLE_FOREIGN_KEYS'] !== 'false'
  },
  performance: {
    cacheEnabled: process.env['CACHE_ENABLED'] !== 'false',
    cacheTTL: parseInt(process.env['CACHE_TTL'] || "100"), // 100ms cache for zero-latency
    maxConcurrentRequests: parseInt(process.env['MAX_CONCURRENT_REQUESTS'] || "10"), // Increased for parallel processing
    requestTimeout: parseInt(process.env['REQUEST_TIMEOUT'] || "2000"), // 2 seconds timeout for zero-latency
    latencyTargets: {
      priceUpdate: parseInt(process.env['TARGET_PRICE_LATENCY'] || "5"), // 5ms target
      gasUpdate: parseInt(process.env['TARGET_GAS_LATENCY'] || "10"), // 10ms target
      routeCalculation: parseInt(process.env['TARGET_ROUTE_LATENCY'] || "1"), // 1ms target
      totalExecution: parseInt(process.env['TARGET_TOTAL_LATENCY'] || "50"), // 50ms total target
    },
  },
};

// --- Enhanced Chain Client Integration ---
let enhancedChainClient: any; // Will be set during initialization

// Environment validation
const CONFIG = DEFAULT_CONFIG;
const dbManager = new DatabaseManager(CONFIG.database, logger);
const riskManager = new RiskManager(
  dbManager, 
  CONFIG.risk, 
  logger, 
  parseFloat(process.env['BASE_PORTFOLIO_VALUE'] || "50000") // $50k base portfolio
);

// Enhanced bot state with zero-latency metrics
interface BotState {
  activeTrades: Map<string, ActiveTrade>;
  tradingPaused: boolean;
  emergencyShutdown: boolean;
  lastOpportunityCheck: number;
  currentPollingInterval: number;
  performanceMetrics: PerformanceMetrics;
  priceCache: Map<string, CacheEntry>;
  gasCache: {
    price: number;
    timestamp: number;
  } | null;
  routeCache: Map<string, RouteOpportunity>;
  latencyMetrics: {
    avgPriceLatency: number;
    avgGasLatency: number;
    avgRouteLatency: number;
    avgTotalLatency: number;
    successRate: number;
  };
}

interface PerformanceMetrics {
  totalOpportunities: number;
  executedTrades: number;
  failedTrades: number;
  totalProfit: number;
  totalGasCost: number;
  avgExecutionTime: number;
  avgLatency: number;
  livshitsRouteHits: number;
  crossChainOpportunities: number;
  bridgeArbitrages: number;
}

const botState: BotState = {
  activeTrades: new Map(),
  tradingPaused: false,
  emergencyShutdown: false,
  lastOpportunityCheck: 0,
  currentPollingInterval: 1000, // Start with 1 second for zero-latency
  performanceMetrics: {
    totalOpportunities: 0,
    executedTrades: 0,
    failedTrades: 0,
    totalProfit: 0,
    totalGasCost: 0,
    avgExecutionTime: 0,
    avgLatency: 0,
    livshitsRouteHits: 0,
    crossChainOpportunities: 0,
    bridgeArbitrages: 0,
  },
  priceCache: new Map(),
  gasCache: null,
  routeCache: new Map(),
  latencyMetrics: {
    avgPriceLatency: 0,
    avgGasLatency: 0,
    avgRouteLatency: 0,
    avgTotalLatency: 0,
    successRate: 0,
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

// --- Zero-Latency Infrastructure Initialization ---
async function initializeZeroLatencyInfrastructure(): Promise<void> {
  logger.info('🚀 Initializing zero-latency infrastructure...');
  
  try {
    // Create enhanced chain client configuration
    const clientConfig = {
      defaultChain: 'ethereum',
      enabledChains: ['ethereum', 'bsc', 'polygon'],
      riskManagement: {
        enabled: true,
        maxDrawdown: CONFIG.risk.maxDrawdown,
        emergencyStopEnabled: true,
        dailyLossLimit: CONFIG.risk.maxDailyLoss,
        maxSlippage: CONFIG.trading.slippageProtection.maxSlippage,
      },
      paperTrading: {
        enabled: process.env['PAPER_TRADING'] === 'true',
        initialBalance: 10000,
        slippageSimulation: 0.5,
      },
      apiKeys: {
        ...(process.env['PYTH_API_KEY'] && { pythNetwork: process.env['PYTH_API_KEY'] }),
        ...(process.env['BLOXROUTE_API_KEY'] && { bloxroute: process.env['BLOXROUTE_API_KEY'] }),
        ...(process.env['FLASHBOTS_API_KEY'] && { flashbots: process.env['FLASHBOTS_API_KEY'] }),
        ...(process.env['COINGECKO_API_KEY'] && { coinGecko: process.env['COINGECKO_API_KEY'] }),
        ...(process.env['DEXSCREENER_API_KEY'] && { dexScreener: process.env['DEXSCREENER_API_KEY'] }),
        ...(process.env['ONEINCH_API_KEY'] && { oneInch: process.env['ONEINCH_API_KEY'] }),
        ...(process.env['MORALIS_API_KEY'] && { moralis: process.env['MORALIS_API_KEY'] }),
      },
    };

    // Initialize enhanced chain client
    enhancedChainClient = await createEnhancedChainClient(clientConfig, logger);

    logger.info('✅ Zero-latency infrastructure initialized successfully');
    
  } catch (error) {
    logger.error('❌ Failed to initialize zero-latency infrastructure:', error);
    throw error;
  }
}

// --- Enhanced Dynamic Gas Price Management with Real-Time Tracking ---
async function getDynamicGasPrice(): Promise<{
  gasPrice: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  confidence: number;
  latency: number;
}> {
  const startTime = Date.now();
  
  try {
    // Use enhanced chain client for gas price
    const gasData = await enhancedChainClient.getOptimalGasPrice('ethereum', 'fast');
    
    const latency = Date.now() - startTime;
    botState.latencyMetrics.avgGasLatency = (botState.latencyMetrics.avgGasLatency + latency) / 2;
    
    // Apply MEV protection premium if enabled
    let gasPrice = BigInt(gasData.gasPrice);
    let maxFeePerGas = BigInt(gasData.maxFeePerGas || gasData.gasPrice);
    let maxPriorityFeePerGas = BigInt(gasData.maxPriorityFeePerGas || '2000000000'); // 2 gwei default
    
    if (CONFIG.trading.mevProtection.enabled) {
      const premium = CONFIG.trading.mevProtection.priorityFeeMultiplier;
      maxPriorityFeePerGas = (maxPriorityFeePerGas * BigInt(Math.floor(premium * 100))) / BigInt(100);
      maxFeePerGas = (maxFeePerGas * BigInt(Math.floor(premium * 100))) / BigInt(100);
      gasPrice = maxFeePerGas;
    }
    
    // Apply dynamic gas optimization
    if (CONFIG.trading.dynamicGasOptimization.enabled) {
      const maxPremium = CONFIG.trading.dynamicGasOptimization.maxGasPremium / 100;
      const currentMultiplier = 1 + maxPremium;
      
      gasPrice = (gasPrice * BigInt(Math.floor(currentMultiplier * 100))) / BigInt(100);
      maxFeePerGas = (maxFeePerGas * BigInt(Math.floor(currentMultiplier * 100))) / BigInt(100);
    }
    
    return {
      gasPrice,
      maxFeePerGas,
      maxPriorityFeePerGas,
      confidence: gasData.confidence,
      latency,
    };

  } catch (error) {
    logger.error('Failed to get dynamic gas price:', error);
    const latency = Date.now() - startTime;
    
    // Emergency fallback
    return {
      gasPrice: BigInt('20000000000'), // 20 gwei
      maxFeePerGas: BigInt('25000000000'), // 25 gwei
      maxPriorityFeePerGas: BigInt('2000000000'), // 2 gwei
      confidence: 50, // Low confidence
      latency,
    };
  }
}

// --- Livshits Route Optimization with Precomputed Opportunities ---
async function findOptimalArbitrageRoute(
  tokenA: string, 
  tokenB: string, 
  amount: string
): Promise<RouteOpportunity | null> {
  const startTime = Date.now();
  
  try {
    if (!enhancedChainClient || !CONFIG.trading.livshitsOptimization.enabled) {
      return null;
    }

    // Check precomputed route cache first (Livshits optimization)
    const cacheKey = `${tokenA}-${tokenB}-${amount}`;
    const cached = botState.routeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CONFIG.performance.cacheTTL) {
      const latency = Date.now() - startTime;
      botState.latencyMetrics.avgRouteLatency = (botState.latencyMetrics.avgRouteLatency + latency) / 2;
      return cached;
    }

    // Find arbitrage opportunities using enhanced chain client
    const opportunities = await enhancedChainClient.findArbitrageOpportunities(
      tokenA,
      tokenB,
      amount,
      ['ethereum']
    );

    if (opportunities.length === 0) {
      return null;
    }

    // Select best opportunity
    const bestOpportunity = opportunities[0];
    if (!bestOpportunity) {
      return null;
    }
    
    const routeOpportunity: RouteOpportunity = {
      routes: [bestOpportunity],
      profitEstimate: bestOpportunity.profitEstimate,
      gasEstimate: parseFloat(bestOpportunity.gasEstimate),
      confidence: bestOpportunity.confidence,
      timestamp: Date.now(),
      bridgeRequired: bestOpportunity.bridgeRequired || false,
      ...(bestOpportunity.bridgeRequired && { bridgeRoute: 'ethereum->polygon' }),
      ...(bestOpportunity.bridgeRequired && { bridgeCost: 10 }),
      ...(bestOpportunity.bridgeRequired && { bridgeTime: 420000 }), // 7 minutes
    };

    // Cache the result
    botState.routeCache.set(cacheKey, routeOpportunity);

    // Update metrics
    const latency = Date.now() - startTime;
    botState.latencyMetrics.avgRouteLatency = (botState.latencyMetrics.avgRouteLatency + latency) / 2;
    botState.performanceMetrics.livshitsRouteHits++;

    if (bestOpportunity.crossChain) {
      botState.performanceMetrics.crossChainOpportunities++;
    }

    return routeOpportunity;

  } catch (error) {
    logger.error('Failed to find optimal arbitrage route:', error);
    return null;
  }
}

// --- Enhanced Zero-Latency Price Fetching ---
async function getZeroLatencyPrice(tokenA: string, tokenB: string): Promise<{
  price: number;
  confidence: number;
  latency: number;
  source: string;
} | null> {
  const startTime = Date.now();
  
  try {
    if (!enhancedChainClient) {
      return null;
    }

    // Get real-time price from enhanced chain client
    const priceData = await enhancedChainClient.getZeroLatencyPrice(tokenA, tokenB);

    if (!priceData) {
      return null;
    }

    const latency = Date.now() - startTime;
    botState.latencyMetrics.avgPriceLatency = (botState.latencyMetrics.avgPriceLatency + latency) / 2;

    return {
      price: priceData.price,
      confidence: priceData.confidence,
      latency,
      source: priceData.source,
    };

  } catch (error) {
    logger.error('Failed to get zero-latency price:', error);
    return null;
  }
}

// --- Enhanced Main Arbitrage Logic with Zero-Latency and Livshits Optimization ---
async function runEnhancedArbitrage(): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.debug(`[${new Date().toISOString()}] Starting enhanced arbitrage scan...`);

    // Pre-flight checks
    if (botState.tradingPaused || botState.emergencyShutdown || riskManager.isEmergencyMode()) {
      return;
    }

    if (botState.activeTrades.size >= CONFIG.risk.maxConcurrentTrades) {
      logger.debug(`Maximum concurrent trades reached: ${botState.activeTrades.size}`);
      return;
    }

    const tokenA = CONFIG.arbitrage.tokenPair.tokenA;
    const tokenB = CONFIG.arbitrage.tokenPair.tokenB;
    const amount = (CONFIG.arbitrage.tradeSize * 10 ** 18).toString();

    // Step 1: Get zero-latency price data
    const priceData = await getZeroLatencyPrice(tokenA, tokenB);
    
    // Step 2: Find optimal route using Livshits optimization
    const routeOpportunity = await findOptimalArbitrageRoute(tokenA, tokenB, amount);
    
    if (!routeOpportunity) {
      logger.debug("No profitable routes found via Livshits optimization");
      return;
    }

    // Step 3: Get dynamic gas pricing
    const gasData = await getDynamicGasPrice();
    
    // Step 4: Calculate final profitability with real-time data
    const totalGasCost = routeOpportunity.gasEstimate * Number(gasData.gasPrice) / 1e18;
    const bridgeCost = routeOpportunity.bridgeCost || 0;
    const totalCosts = totalGasCost + bridgeCost;
    const netProfit = routeOpportunity.profitEstimate - totalCosts;
    const profitPercent = (netProfit / parseFloat(amount)) * 100;

    botState.performanceMetrics.totalOpportunities++;

    // Check final profitability
    const minProfitThreshold = routeOpportunity.bridgeRequired ? 
      CONFIG.trading.crossChainArbitrage.minProfitAfterBridgeFees : 
      CONFIG.arbitrage.minProfitThreshold;

    if (profitPercent < minProfitThreshold) {
      logger.debug(`Profit ${profitPercent.toFixed(4)}% below threshold ${minProfitThreshold}%`);
      return;
    }

    // Check bridge timing constraints for cross-chain arbitrage
    if (routeOpportunity.bridgeRequired && routeOpportunity.bridgeTime) {
      const maxWaitTime = CONFIG.trading.crossChainArbitrage.maxBridgeWaitTime;
      if (routeOpportunity.bridgeTime > maxWaitTime) {
        logger.debug(`Bridge time ${routeOpportunity.bridgeTime}ms exceeds maximum ${maxWaitTime}ms`);
        return;
      }
    }

    logger.info(`💰 Enhanced Arbitrage Opportunity Found!`, {
      tokenPair: `${tokenA}-${tokenB}`,
      amount: ethers.formatEther(amount),
      profitPercent: profitPercent.toFixed(6),
      netProfit: netProfit.toFixed(6),
      gasEstimate: routeOpportunity.gasEstimate,
      gasPrice: ethers.formatUnits(gasData.gasPrice, 'gwei'),
      confidence: routeOpportunity.confidence,
      routeHops: routeOpportunity.routes.length,
      crossChain: routeOpportunity.bridgeRequired,
      bridgeRoute: routeOpportunity.bridgeRoute,
      totalLatency: Date.now() - startTime,
    });

    // Execute the arbitrage
    await executeEnhancedArbitrage(routeOpportunity, gasData, priceData);

    // Update performance metrics
    const totalLatency = Date.now() - startTime;
    botState.latencyMetrics.avgTotalLatency = (botState.latencyMetrics.avgTotalLatency + totalLatency) / 2;

    if (routeOpportunity.bridgeRequired) {
      botState.performanceMetrics.bridgeArbitrages++;
    }

  } catch (error) {
    logger.error('Error in enhanced arbitrage cycle:', error);
    botState.performanceMetrics.failedTrades++;
  }
}

// --- Enhanced Arbitrage Execution with MEV Protection ---
async function executeEnhancedArbitrage(
  opportunity: RouteOpportunity,
  gasData: any,
  priceData: any
): Promise<void> {
  const tradeId = crypto.randomUUID();
  
  try {
    logger.info(`🚀 Executing enhanced arbitrage trade: ${tradeId}`, {
      gasPrice: ethers.formatUnits(gasData.gasPrice, 'gwei'),
      maxFeePerGas: ethers.formatUnits(gasData.maxFeePerGas, 'gwei'),
      confidence: gasData.confidence,
      latency: gasData.latency,
    });

    // Create trade record with gas data
    const activeTrade = {
      id: tradeId,
      pair: `${CONFIG.arbitrage.tokenPair.tokenA}-${CONFIG.arbitrage.tokenPair.tokenB}`,
      amount: CONFIG.arbitrage.tradeSize,
      entryPrice: priceData?.price || 0,
      currentPrice: priceData?.price || 0,
      slippage: 0,
      gasUsed: 0,
      gasPrice: gasData.gasPrice.toString(),
      gasLimit: (opportunity.gasEstimate * 1.2).toString(), // 20% buffer
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
      crossChain: opportunity.bridgeRequired,
      bridgeRoute: opportunity.bridgeRoute,
      livshitsOptimized: true,
    };

    botState.activeTrades.set(tradeId, activeTrade as any);

    // Execute with MEV protection if enabled
    if (CONFIG.trading.mevProtection.enabled && CONFIG.trading.mevProtection.flashbotsEnabled) {
      await executeWithMevProtection(opportunity, tradeId, gasData);
    } else {
      await executeStandardArbitrage(opportunity, tradeId, gasData);
    }

    // Record successful execution with gas costs
    botState.performanceMetrics.executedTrades++;
    const estimatedGasCost = Number(gasData.gasPrice) * opportunity.gasEstimate / 1e18;
    const estimatedProfit = opportunity.profitEstimate - estimatedGasCost;
    botState.performanceMetrics.totalProfit += estimatedProfit;
    botState.performanceMetrics.totalGasCost += estimatedGasCost;

    logger.info(`✅ Enhanced arbitrage trade completed: ${tradeId}`, {
      estimatedProfit,
      estimatedGasCost,
      gasUsed: activeTrade.gasUsed,
    });

  } catch (error) {
    logger.error(`❌ Enhanced arbitrage trade failed: ${tradeId}`, error);
    botState.performanceMetrics.failedTrades++;
    botState.activeTrades.delete(tradeId);
  }
}

// --- MEV-Protected Execution ---
async function executeWithMevProtection(
  opportunity: RouteOpportunity,
  tradeId: string,
  gasData: any
): Promise<void> {
  try {
    if (!enhancedChainClient) {
      throw new Error('Enhanced chain client not initialized');
    }

    logger.info('🛡️ Executing MEV-protected trade with gas settings:', {
      gasPrice: ethers.formatUnits(gasData.gasPrice, 'gwei'),
      maxFeePerGas: ethers.formatUnits(gasData.maxFeePerGas, 'gwei'),
      confidence: gasData.confidence,
    });

    // Execute trade with zero-latency infrastructure
    const tradeResult = await enhancedChainClient.executeTradeWithZeroLatency(
      opportunity.routes[0], // Use first route as OpportunityMetrics
      { address: process.env['WALLET_ADDRESS'] || '' },
      {
        paperTrade: false,
        maxSlippage: CONFIG.trading.slippageProtection.maxSlippage,
        mevProtection: CONFIG.trading.mevProtection.enabled,
        riskChecks: true,
      }
    );

    if (!tradeResult.success) {
      throw new Error(tradeResult.error || 'Trade execution failed');
    }

    // Update trade status
    const trade = botState.activeTrades.get(tradeId);
    if (trade) {
      trade.status = 'completed';
      trade.gasUsed = tradeResult.gasUsed || '0';
    }

  } catch (error) {
    logger.error('MEV-protected execution failed:', error);
    throw error;
  }
}

// --- Standard Arbitrage Execution ---
async function executeStandardArbitrage(
  opportunity: RouteOpportunity,
  tradeId: string,
  gasData: any
): Promise<void> {
  try {
    if (!enhancedChainClient) {
      throw new Error('Enhanced chain client not initialized');
    }

    logger.info('⚡ Executing standard trade with gas settings:', {
      gasPrice: ethers.formatUnits(gasData.gasPrice, 'gwei'),
      maxFeePerGas: ethers.formatUnits(gasData.maxFeePerGas, 'gwei'),
      confidence: gasData.confidence,
    });

    // Execute trade with zero-latency infrastructure (standard mode)
    const tradeResult = await enhancedChainClient.executeTradeWithZeroLatency(
      opportunity.routes[0], // Use first route as OpportunityMetrics
      { address: process.env['WALLET_ADDRESS'] || '' },
      {
        paperTrade: false,
        maxSlippage: CONFIG.trading.slippageProtection.maxSlippage,
        mevProtection: false, // Standard execution without MEV protection
        riskChecks: true,
      }
    );

    if (!tradeResult.success) {
      throw new Error(tradeResult.error || 'Trade execution failed');
    }

    logger.info(`Transaction executed successfully`);

    // Update trade status
    const trade = botState.activeTrades.get(tradeId);
    if (trade) {
      trade.status = 'completed';
      trade.gasUsed = tradeResult.gasUsed || '0';
    }

  } catch (error) {
    logger.error('Standard arbitrage execution failed:', error);
    throw error;
  }
}

// --- Performance Monitoring ---
function logPerformanceMetrics(): void {
  logger.info('📊 Enhanced Performance Metrics:', {
    ...botState.performanceMetrics,
    latencyMetrics: botState.latencyMetrics,
    activeTrades: botState.activeTrades.size,
    cacheHitRatio: {
      priceCache: botState.priceCache.size,
      routeCache: botState.routeCache.size,
    },
  });
}

// --- Graceful Shutdown ---
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    
    try {
      // Stop zero-latency components
      await enhancedChainClient?.destroy();
      
      // Close database connections
      await dbManager.close();
      
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// --- Main Bot Execution ---
async function startEnhancedArbitrageBot(): Promise<void> {
  try {
    logger.info("🤖 Starting Enhanced Zero-Latency Arbitrage Bot with Livshits Optimization...");
    
    // Environment validation
    validateEnvironment();
    
    // Initialize zero-latency infrastructure
    await initializeZeroLatencyInfrastructure();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    logger.info("Configuration loaded:", {
      chain: CONFIG.arbitrage.chain,
      tokenPair: CONFIG.arbitrage.tokenPair,
      minProfitThreshold: CONFIG.arbitrage.minProfitThreshold,
      tradeSize: CONFIG.arbitrage.tradeSize,
      zeroLatencyEnabled: true,
      livshitsOptimization: CONFIG.trading.livshitsOptimization.enabled,
      crossChainArbitrage: CONFIG.trading.crossChainArbitrage.enabled,
      latencyTargets: CONFIG.performance.latencyTargets,
    });
    
    // Start performance monitoring
    const metricsInterval = setInterval(logPerformanceMetrics, 5 * 60 * 1000); // 5 minutes
    
    // Main execution loop with adaptive timing
    logger.info(`🎯 Enhanced arbitrage bot initialized. Target latency: <${CONFIG.performance.latencyTargets.totalExecution}ms`);
    
    const runBot = async () => {
      if (botState.emergencyShutdown) {
        clearInterval(metricsInterval);
        return;
      }
      
      await runEnhancedArbitrage();
      
      // Adaptive polling based on market conditions and latency targets
      const nextInterval = Math.max(
        CONFIG.performance.latencyTargets.totalExecution * 2, // At least 2x target latency
        1000 // Minimum 1 second
      );
      
      setTimeout(runBot, nextInterval);
    };
    
    // Start the enhanced arbitrage engine
    runBot();
    
  } catch (error) {
    logger.error('Failed to start enhanced arbitrage bot:', error);
    process.exit(1);
  }
}

// Start the bot
if (require.main === module) {
  startEnhancedArbitrageBot();
}

export {
  startEnhancedArbitrageBot,
  CONFIG,
  botState,
  logger
}; 