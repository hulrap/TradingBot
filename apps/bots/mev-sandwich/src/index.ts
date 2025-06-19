import dotenv from 'dotenv';
import winston from 'winston';
import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';
import { FlashbotsClient, type FlashbotsConfig } from './flashbots-client';
import { JitoClient, type JitoConfig } from './jito-client';
import { BscMevClient, type BscMevConfig } from './bsc-mev-client';
import { SandwichDetector, type MempoolConfig, type SandwichOpportunity } from './sandwich-detector';
import { ProfitCalculator } from './profit-calculator';
import { SandwichExecutionEngine, type ExecutionParams } from './execution-engine';
import { RiskManager, type RiskConfig } from './risk-manager';
import { PerformanceOptimizer, type PerformanceConfig } from './performance-optimizer';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'mev-sandwich.log' })
  ]
});

interface MevBotConfig {
  enabledChains: ('ethereum' | 'solana' | 'bsc')[];
  minProfitThresholds: {
    ethereum: string; // ETH
    solana: string;   // SOL
    bsc: string;      // BNB
  };
  maxConcurrentBundles: number;
  globalKillSwitch: boolean;
  paperTradingMode: boolean;
  enableRiskManagement: boolean;
  enablePerformanceOptimization: boolean;
}

class AdvancedMevSandwichBot {
  // Core MEV clients
  private flashbotsClient?: FlashbotsClient;
  private jitoClient?: JitoClient;
  private bscMevClient?: BscMevClient;
  
  // Advanced sandwich components
  private sandwichDetector?: SandwichDetector;
  private profitCalculator: ProfitCalculator;
  private executionEngine?: SandwichExecutionEngine;
  private riskManager?: RiskManager;
  private performanceOptimizer?: PerformanceOptimizer;
  
  private config: MevBotConfig;
  private isRunning = false;
  private activeBundles = new Set<string>();

  // Network providers
  private ethProvider?: ethers.JsonRpcProvider;
  private solConnection?: Connection;
  private bscProvider?: ethers.JsonRpcProvider;

  constructor() {
    this.config = this.loadConfiguration();
    this.profitCalculator = new ProfitCalculator();
    this.initializeProviders();
  }

  private loadConfiguration(): MevBotConfig {
    return {
      enabledChains: (process.env.ENABLED_CHAINS?.split(',') as any[]) || ['ethereum'],
      minProfitThresholds: {
        ethereum: process.env.MIN_PROFIT_ETH || '0.01',
        solana: process.env.MIN_PROFIT_SOL || '0.1',
        bsc: process.env.MIN_PROFIT_BNB || '0.05'
      },
      maxConcurrentBundles: parseInt(process.env.MAX_CONCURRENT_BUNDLES || '5'),
      globalKillSwitch: process.env.GLOBAL_KILL_SWITCH === 'true',
      paperTradingMode: process.env.PAPER_TRADING_MODE === 'true',
      enableRiskManagement: process.env.ENABLE_RISK_MANAGEMENT !== 'false',
      enablePerformanceOptimization: process.env.ENABLE_PERFORMANCE_OPTIMIZATION !== 'false'
    };
  }

  private initializeProviders(): void {
    // Initialize Ethereum provider
    if (this.config.enabledChains.includes('ethereum')) {
      this.ethProvider = new ethers.JsonRpcProvider(
        process.env.ETH_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key'
      );
    }

    // Initialize Solana connection
    if (this.config.enabledChains.includes('solana')) {
      this.solConnection = new Connection(
        process.env.SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );
    }

    // Initialize BSC provider
    if (this.config.enabledChains.includes('bsc')) {
      this.bscProvider = new ethers.JsonRpcProvider(
        process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org'
      );
    }
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Advanced MEV Sandwich Bot...');

      // Check global kill switch
      if (this.config.globalKillSwitch) {
        logger.warn('Global kill switch is enabled - bot will not start');
        return;
      }

      // Initialize all components
      await this.initializeComponents();

      this.isRunning = true;
      logger.info('Advanced MEV Sandwich Bot started successfully', {
        enabledChains: this.config.enabledChains,
        paperTradingMode: this.config.paperTradingMode,
        riskManagementEnabled: this.config.enableRiskManagement,
        performanceOptimizationEnabled: this.config.enablePerformanceOptimization
      });

      // Start advanced sandwich detection and execution
      this.startAdvancedSandwichDetection();

    } catch (error) {
      logger.error('Failed to start Advanced MEV Sandwich Bot', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    const privateKey = process.env.MEV_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('MEV_PRIVATE_KEY environment variable is required');
    }

    // Initialize MEV clients
    await this.initializeMevClients(privateKey);
    
    // Initialize sandwich detector
    await this.initializeSandwichDetector();
    
    // Initialize execution engine
    await this.initializeExecutionEngine();
    
    // Initialize risk manager
    if (this.config.enableRiskManagement) {
      await this.initializeRiskManager();
    }
    
    // Initialize performance optimizer
    if (this.config.enablePerformanceOptimization) {
      await this.initializePerformanceOptimizer();
    }
  }

  private async initializeMevClients(privateKey: string): Promise<void> {
    // Initialize Flashbots client for Ethereum
    if (this.config.enabledChains.includes('ethereum') && this.ethProvider) {
      const flashbotsConfig: FlashbotsConfig = {
        relayUrl: process.env.FLASHBOTS_RELAY_URL || 'https://relay.flashbots.net',
        authKey: process.env.FLASHBOTS_AUTH_KEY || privateKey,
        maxBaseFeeInFutureBlock: process.env.MAX_BASE_FEE || '100',
        maxPriorityFeePerGas: process.env.MAX_PRIORITY_FEE || '5',
        minProfitWei: ethers.parseEther(this.config.minProfitThresholds.ethereum).toString(),
        reputationBonus: parseFloat(process.env.REPUTATION_BONUS || '0')
      };

      this.flashbotsClient = new FlashbotsClient(this.ethProvider, privateKey, flashbotsConfig);
      await this.flashbotsClient.initialize();
    }

    // Initialize Jito client for Solana
    if (this.config.enabledChains.includes('solana') && this.solConnection) {
      const jitoConfig: JitoConfig = {
        blockEngineUrl: process.env.JITO_BLOCK_ENGINE_URL || 'https://mainnet.block-engine.jito.wtf',
        relayerUrl: process.env.JITO_RELAYER_URL || 'https://mainnet.relayer.jito.wtf',
        tipAccount: process.env.JITO_TIP_ACCOUNT || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        maxTipLamports: parseInt(process.env.MAX_TIP_LAMPORTS || '100000'),
        minProfitLamports: parseInt(process.env.MIN_PROFIT_LAMPORTS || '1000000'),
        validatorPreferences: process.env.PREFERRED_VALIDATORS?.split(',') || []
      };

      this.jitoClient = new JitoClient(this.solConnection, jitoConfig);
      await this.jitoClient.initialize();
    }

    // Initialize BSC MEV client
    if (this.config.enabledChains.includes('bsc') && this.bscProvider) {
      const bscMevConfig: BscMevConfig = {
        provider: (process.env.BSC_MEV_PROVIDER as any) || 'bloxroute',
        apiKey: process.env.BSC_MEV_API_KEY || '',
        endpoint: process.env.BSC_MEV_ENDPOINT || '',
        maxGasPrice: process.env.BSC_MAX_GAS_PRICE || '20',
        minProfitBnb: this.config.minProfitThresholds.bsc,
        preferredValidators: process.env.BSC_PREFERRED_VALIDATORS?.split(',') || [],
        mempoolSubscription: process.env.BSC_MEMPOOL_SUBSCRIPTION === 'true'
      };

      this.bscMevClient = new BscMevClient(this.bscProvider, privateKey, bscMevConfig);
      await this.bscMevClient.initialize();
    }
  }

  private async initializeSandwichDetector(): Promise<void> {
    const mempoolConfig: MempoolConfig = {
      chains: this.config.enabledChains,
      minTradeValue: process.env.MIN_TRADE_VALUE || '1000',
      maxGasPrice: process.env.MAX_GAS_PRICE || '100',
      minLiquidity: process.env.MIN_LIQUIDITY || '100000',
      blacklistedTokens: process.env.BLACKLISTED_TOKENS?.split(',') || [],
      whitelistedDexes: process.env.WHITELISTED_DEXES?.split(',') || [],
      maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '5'),
      profitabilityThreshold: parseFloat(process.env.PROFITABILITY_THRESHOLD || '1')
    };

    this.sandwichDetector = new SandwichDetector(mempoolConfig);
    
    const providers: any = {};
    if (this.ethProvider) providers.ethereum = this.ethProvider;
    if (this.bscProvider) providers.bsc = this.bscProvider;
    if (this.solConnection) providers.solana = this.solConnection;
    
    await this.sandwichDetector.initialize(providers);
    this.setupSandwichDetectorEvents();
  }

  private async initializeExecutionEngine(): Promise<void> {
    this.executionEngine = new SandwichExecutionEngine(this.config.maxConcurrentBundles);
    
    await this.executionEngine.initialize({
      flashbots: this.flashbotsClient,
      jito: this.jitoClient,
      bscMev: this.bscMevClient
    });
    
    this.setupExecutionEngineEvents();
  }

  private async initializeRiskManager(): Promise<void> {
    const riskConfig: RiskConfig = {
      maxPositionSizeEth: process.env.MAX_POSITION_SIZE_ETH || '1.0',
      maxPositionSizeBnb: process.env.MAX_POSITION_SIZE_BNB || '5.0',
      maxPositionSizeSol: process.env.MAX_POSITION_SIZE_SOL || '10.0',
      maxDailyVolume: process.env.MAX_DAILY_VOLUME || '100.0',
      maxConcurrentPositions: parseInt(process.env.MAX_CONCURRENT_POSITIONS || '3'),
      maxSlippageTolerance: parseFloat(process.env.MAX_SLIPPAGE_TOLERANCE || '5'),
      maxPriceImpact: parseFloat(process.env.MAX_PRICE_IMPACT || '10'),
      minLiquidityUsd: parseFloat(process.env.MIN_LIQUIDITY_USD || '50000'),
      maxGasPriceGwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI || '100'),
      minProfitUsd: parseFloat(process.env.MIN_PROFIT_USD || '10'),
      maxPositionDuration: parseInt(process.env.MAX_POSITION_DURATION || '300000'),
      cooldownPeriod: parseInt(process.env.COOLDOWN_PERIOD || '5000'),
      maxTradesPerHour: parseInt(process.env.MAX_TRADES_PER_HOUR || '20'),
      maxFailuresPerHour: parseInt(process.env.MAX_FAILURES_PER_HOUR || '10'),
      maxPortfolioValue: process.env.MAX_PORTFOLIO_VALUE || '1000.0',
      maxDrawdownPercent: parseFloat(process.env.MAX_DRAWDOWN_PERCENT || '20'),
      stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT || '10'),
      emergencyStopLoss: parseFloat(process.env.EMERGENCY_STOP_LOSS || '500'),
      consecutiveFailureLimit: parseInt(process.env.CONSECUTIVE_FAILURE_LIMIT || '5'),
      gasEfficiencyThreshold: parseFloat(process.env.GAS_EFFICIENCY_THRESHOLD || '0.001')
    };

    this.riskManager = new RiskManager(riskConfig);
    this.setupRiskManagerEvents();
  }

  private async initializePerformanceOptimizer(): Promise<void> {
    const performanceConfig: PerformanceConfig = {
      maxMempoolLatency: parseInt(process.env.MAX_MEMPOOL_LATENCY || '200'),
      maxExecutionLatency: parseInt(process.env.MAX_EXECUTION_LATENCY || '5000'),
      precomputeThreshold: parseFloat(process.env.PRECOMPUTE_THRESHOLD || '70'),
      maxConcurrentOpportunities: parseInt(process.env.MAX_CONCURRENT_OPPORTUNITIES || '10'),
      maxConcurrentSimulations: parseInt(process.env.MAX_CONCURRENT_SIMULATIONS || '5'),
      maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '3'),
      poolDataCacheTime: parseInt(process.env.POOL_DATA_CACHE_TIME || '300000'),
      tokenDataCacheTime: parseInt(process.env.TOKEN_DATA_CACHE_TIME || '600000'),
      gasEstimateCacheTime: parseInt(process.env.GAS_ESTIMATE_CACHE_TIME || '30000'),
      minSuccessRate: parseFloat(process.env.MIN_SUCCESS_RATE || '0.3'),
      targetLatencyMs: parseInt(process.env.TARGET_LATENCY_MS || '1000'),
      maxMemoryUsageMb: parseInt(process.env.MAX_MEMORY_USAGE_MB || '512'),
      gasEstimationBuffer: parseFloat(process.env.GAS_ESTIMATION_BUFFER || '20'),
      priorityFeeBoost: parseFloat(process.env.PRIORITY_FEE_BOOST || '50'),
      enableGasPrecompute: process.env.ENABLE_GAS_PRECOMPUTE !== 'false'
    };

    this.performanceOptimizer = new PerformanceOptimizer(performanceConfig);
    await this.performanceOptimizer.initialize();
    this.setupPerformanceOptimizerEvents();
  }

  private setupSandwichDetectorEvents(): void {
    if (!this.sandwichDetector) return;

    this.sandwichDetector.on('opportunityFound', async (opportunity: SandwichOpportunity) => {
      logger.info('Sandwich opportunity detected', {
        chain: opportunity.chain,
        tokenIn: opportunity.tokenIn,
        tokenOut: opportunity.tokenOut,
        estimatedProfit: opportunity.estimatedProfit,
        mevScore: opportunity.mevScore
      });

      await this.processSandwichOpportunity(opportunity);
    });

    this.sandwichDetector.on('error', (error) => {
      logger.error('Sandwich detector error', { error: error.message });
    });
  }

  private setupExecutionEngineEvents(): void {
    if (!this.executionEngine) return;

    this.executionEngine.on('executionCompleted', ({ executionId, result }) => {
      logger.info('Sandwich execution completed', {
        executionId,
        success: result.success,
        profit: result.execution.actualProfit,
        latency: result.metrics.totalLatency
      });

      // Record metrics for performance optimization
      if (this.performanceOptimizer) {
        this.performanceOptimizer.recordMetrics({
          id: executionId,
          detectionTime: Date.now() - result.metrics.totalLatency,
          simulationTime: result.metrics.simulationTime,
          executionTime: result.metrics.executionTime,
          totalLatency: result.metrics.totalLatency,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          gasUsed: result.simulation.gasUsed,
          success: result.success,
          profit: result.execution.actualProfit || result.simulation.estimatedProfit,
          chain: 'ethereum' // Would extract from opportunity
        });
      }

      // Record trade for risk management
      if (this.riskManager) {
        this.riskManager.recordTrade({
          id: executionId,
          chain: 'ethereum', // Would extract from opportunity
          tokenIn: 'token_in',
          tokenOut: 'token_out',
          amount: '0',
          success: result.success,
          profit: parseFloat(result.execution.actualProfit || '0'),
          gasUsed: result.simulation.gasUsed
        });
      }

      this.activeBundles.delete(executionId);
    });

    this.executionEngine.on('executionFailed', ({ executionId, result }) => {
      logger.warn('Sandwich execution failed', {
        executionId,
        error: result.error,
        latency: result.metrics.totalLatency
      });

      this.activeBundles.delete(executionId);
    });
  }

  private setupRiskManagerEvents(): void {
    if (!this.riskManager) return;

    this.riskManager.on('emergencyStop', ({ reason, timestamp }) => {
      logger.error('RISK MANAGER EMERGENCY STOP', { reason, timestamp });
      this.emergencyStop();
    });

    this.riskManager.on('warning', (message) => {
      logger.warn('Risk manager warning', { message });
    });
  }

  private setupPerformanceOptimizerEvents(): void {
    if (!this.performanceOptimizer) return;

    this.performanceOptimizer.on('performanceAlert', ({ alerts, stats }) => {
      logger.warn('Performance degradation detected', { alerts, stats });
    });

    this.performanceOptimizer.on('performanceReport', (stats) => {
      logger.info('Performance report', stats);
    });
  }

  private async processSandwichOpportunity(opportunity: SandwichOpportunity): Promise<void> {
    try {
      // Performance optimization
      let optimizationResult;
      if (this.performanceOptimizer) {
        const txHash = opportunity.victimTxHash;
        const transaction = opportunity.victimTransaction;
        const chain = opportunity.chain;
        
        optimizationResult = await this.performanceOptimizer.optimizeDetection(
          txHash, transaction, chain
        );
        
        if (!optimizationResult.shouldProcess) {
          logger.debug('Opportunity skipped by performance optimizer', {
            priority: optimizationResult.priority,
            estimatedLatency: optimizationResult.estimatedLatency
          });
          return;
        }
      }

      // Risk assessment
      if (this.riskManager) {
        const riskAssessment = await this.riskManager.assessRisk({
          chain: opportunity.chain,
          tokenIn: opportunity.tokenIn,
          tokenOut: opportunity.tokenOut,
          amountIn: opportunity.amountIn,
          poolLiquidity: opportunity.poolLiquidity,
          gasPrice: opportunity.gasPrice,
          estimatedProfit: opportunity.estimatedProfit,
          priceImpact: opportunity.slippage,
          slippage: opportunity.slippage,
          confidence: opportunity.confidence
        });

        if (!riskAssessment.allowed) {
          logger.info('Opportunity rejected by risk manager', {
            reasons: riskAssessment.reasons,
            riskScore: riskAssessment.riskScore
          });
          return;
        }

        logger.info('Risk assessment passed', {
          riskScore: riskAssessment.riskScore,
          adjustedPositionSize: riskAssessment.limits.positionSize,
          recommendations: riskAssessment.recommendations
        });
      }

      // Execute sandwich attack
      if (this.executionEngine) {
        const executionParams: ExecutionParams = {
          opportunity: {
            victimTxHash: opportunity.victimTxHash,
            victimTransaction: opportunity.victimTransaction,
            chain: opportunity.chain,
            dexType: opportunity.dexType,
            tokenIn: opportunity.tokenIn,
            tokenOut: opportunity.tokenOut,
            amountIn: opportunity.amountIn,
            expectedAmountOut: opportunity.expectedAmountOut,
            poolAddress: opportunity.poolAddress,
            poolLiquidity: opportunity.poolLiquidity,
            gasPrice: opportunity.gasPrice,
            estimatedProfit: opportunity.estimatedProfit,
            profitability: opportunity.profitability,
            confidence: opportunity.confidence,
            mevScore: opportunity.mevScore
          },
          frontRunAmount: opportunity.amountIn, // Could be adjusted by risk manager
          maxGasPrice: process.env.MAX_GAS_PRICE || '100',
          maxSlippage: 5,
          deadline: Date.now() + 60000, // 1 minute deadline
          minProfit: this.config.minProfitThresholds[opportunity.chain],
          simulationOnly: this.config.paperTradingMode
        };

        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.activeBundles.add(executionId);

        const result = await this.executionEngine.executeSandwich(executionParams);
        
        if (this.config.paperTradingMode) {
          logger.info('Paper trading execution completed', {
            estimatedProfit: result.simulation.estimatedProfit,
            gasUsed: result.simulation.gasUsed,
            simulationTime: result.metrics.simulationTime
          });
        }
      }

    } catch (error) {
      logger.error('Error processing sandwich opportunity', {
        error: error instanceof Error ? error.message : error,
        opportunity: {
          chain: opportunity.chain,
          estimatedProfit: opportunity.estimatedProfit
        }
      });
    }
  }

  private startAdvancedSandwichDetection(): void {
    if (!this.sandwichDetector) {
      logger.error('Sandwich detector not initialized');
      return;
    }

    logger.info('Starting advanced sandwich detection...');
    this.sandwichDetector.startMonitoring();
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping Advanced MEV Sandwich Bot...');
      
      this.isRunning = false;

      // Stop sandwich detection
      if (this.sandwichDetector) {
        await this.sandwichDetector.stopMonitoring();
      }

      // Wait for active executions to complete
      const maxWaitTime = 60000;
      const startTime = Date.now();
      
      while (this.activeBundles.size > 0 && (Date.now() - startTime) < maxWaitTime) {
        logger.info(`Waiting for ${this.activeBundles.size} active executions to complete...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Cleanup components
      if (this.performanceOptimizer) {
        this.performanceOptimizer.cleanup();
      }

      // Disconnect MEV clients
      if (this.flashbotsClient) {
        await this.flashbotsClient.disconnect();
      }
      if (this.jitoClient) {
        await this.jitoClient.disconnect();
      }
      if (this.bscMevClient) {
        await this.bscMevClient.disconnect();
      }

      logger.info('Advanced MEV Sandwich Bot stopped successfully');

    } catch (error) {
      logger.error('Error stopping Advanced MEV Sandwich Bot', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  getAdvancedStatus(): {
    isRunning: boolean;
    enabledChains: string[];
    activeBundles: number;
    paperTradingMode: boolean;
    components: {
      sandwichDetector: boolean;
      executionEngine: boolean;
      riskManager: boolean;
      performanceOptimizer: boolean;
    };
    metrics: {
      sandwichDetector?: any;
      riskManager?: any;
      performanceOptimizer?: any;
    };
  } {
    const metrics: any = {};

    if (this.sandwichDetector) {
      metrics.sandwichDetector = this.sandwichDetector.getStats();
    }

    if (this.riskManager) {
      metrics.riskManager = this.riskManager.getRiskMetrics();
    }

    if (this.performanceOptimizer) {
      metrics.performanceOptimizer = {
        stats: this.performanceOptimizer.getPerformanceStats(),
        cache: this.performanceOptimizer.getCacheStats()
      };
    }

    return {
      isRunning: this.isRunning,
      enabledChains: this.config.enabledChains,
      activeBundles: this.activeBundles.size,
      paperTradingMode: this.config.paperTradingMode,
      components: {
        sandwichDetector: !!this.sandwichDetector,
        executionEngine: !!this.executionEngine,
        riskManager: !!this.riskManager,
        performanceOptimizer: !!this.performanceOptimizer
      },
      metrics
    };
  }

  async emergencyStop(): Promise<void> {
    logger.error('EMERGENCY STOP ACTIVATED - ADVANCED MEV BOT');
    this.config.globalKillSwitch = true;
    
    if (this.executionEngine) {
      await this.executionEngine.emergencyStop();
    }
    
    await this.stop();
  }
}

// Main execution
async function main() {
  const bot = new AdvancedMevSandwichBot();
  
  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await bot.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    bot.emergencyStop();
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    bot.emergencyStop();
  });

  try {
    await bot.start();
    
    // Log advanced status every 2 minutes
    setInterval(() => {
      const status = bot.getAdvancedStatus();
      logger.info('Advanced bot status', status);
    }, 120000);
    
  } catch (error) {
    logger.error('Failed to start Advanced MEV Sandwich Bot', { 
      error: error instanceof Error ? error.message : error 
    });
    process.exit(1);
  }
}

// Run the bot
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { AdvancedMevSandwichBot };