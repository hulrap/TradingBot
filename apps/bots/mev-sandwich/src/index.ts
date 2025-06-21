import dotenv from 'dotenv';
import winston from 'winston';
import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';
import { FlashbotsClient, type FlashbotsConfig } from './flashbots-client';
import { JitoClient, type JitoConfig } from './jito-client';
import { BscMevClient, type BscMevConfig } from './bsc-mev-client';
import { MempoolMonitor, type MempoolConfig } from '@trading-bot/chain-client';

interface PendingTransaction {
  hash: string;
  to?: string;
  from: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  data?: string;
  timestamp: number;
}
import { SandwichDetector, type SandwichOpportunity } from './sandwich-detector';
import { ProfitCalculator } from './profit-calculator';
import { SandwichExecutionEngine, type ExecutionParams } from './execution-engine';
import { RiskManager, type RiskConfig } from './risk-manager';
import { PerformanceOptimizer, type PerformanceConfig } from './performance-optimizer';
import { TokenMetadataService } from './services/token-metadata';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
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
    ethereum: string;
    solana: string;
    bsc: string;
  };
  maxConcurrentBundles: number;
  globalKillSwitch: boolean;
  paperTradingMode: boolean;
  enableRiskManagement: boolean;
  enablePerformanceOptimization: boolean;
}

interface TokenMetadata {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  priceUsd: number;
  verified: boolean;
}

class AdvancedMevSandwichBot {
  // Core MEV clients
  private flashbotsClient?: FlashbotsClient;
  private jitoClient?: JitoClient;
  private bscMevClient?: BscMevClient;
  
  // Advanced sandwich components
  private mempoolMonitor?: any; // MempoolMonitor instance
  private sandwichDetector?: SandwichDetector;
  private profitCalculator!: ProfitCalculator;
  private executionEngine?: SandwichExecutionEngine;
  private riskManager?: RiskManager;
  private performanceOptimizer?: PerformanceOptimizer;
  private tokenMetadataService?: TokenMetadataService;
  
  private config: MevBotConfig;
  private isRunning = false;
  private activeBundles = new Set<string>();

  // Network providers
  private ethProvider?: ethers.JsonRpcProvider;
  private solConnection?: Connection;
  private bscProvider?: ethers.JsonRpcProvider;



  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    this.initializeProviders();
  }

  private loadConfiguration(): MevBotConfig {
    return {
      enabledChains: (process.env['ENABLED_CHAINS']?.split(',') as any[]) || ['ethereum'],
      minProfitThresholds: {
        ethereum: process.env['MIN_PROFIT_ETH'] || '0.01',
        solana: process.env['MIN_PROFIT_SOL'] || '0.1',
        bsc: process.env['MIN_PROFIT_BNB'] || '0.05'
      },
      maxConcurrentBundles: parseInt(process.env['MAX_CONCURRENT_BUNDLES'] || '5'),
      globalKillSwitch: process.env['GLOBAL_KILL_SWITCH'] === 'true',
      paperTradingMode: process.env['PAPER_TRADING_MODE'] === 'true',
      enableRiskManagement: process.env['ENABLE_RISK_MANAGEMENT'] !== 'false',
      enablePerformanceOptimization: process.env['ENABLE_PERFORMANCE_OPTIMIZATION'] !== 'false'
    };
  }

  private validateConfiguration(): void {
    const required = ['MEV_PRIVATE_KEY'];
    
    // Add chain-specific required variables
    if (this.config.enabledChains.includes('ethereum')) {
      required.push('ETH_RPC_URL', 'FLASHBOTS_RELAY_URL');
    }
    if (this.config.enabledChains.includes('solana')) {
      required.push('SOL_RPC_URL', 'JITO_BLOCK_ENGINE_URL');
    }
    if (this.config.enabledChains.includes('bsc')) {
      required.push('BSC_RPC_URL', 'BSC_MEV_API_KEY');
    }

    for (const env of required) {
      if (!process.env[env]) {
        throw new Error(`Missing required environment variable: ${env}`);
      }
    }

    // Validate RPC URLs
    if (this.config.enabledChains.includes('ethereum')) {
      const ethRpc = process.env['ETH_RPC_URL']!;
      if (ethRpc.includes('your-api-key')) {
        throw new Error('ETH_RPC_URL contains placeholder API key. Please configure a real RPC URL.');
      }
    }

    // Validate API keys
    if (this.config.enabledChains.includes('bsc')) {
      const bscApiKey = process.env['BSC_MEV_API_KEY']!;
      if (bscApiKey.length < 10) {
        throw new Error('BSC_MEV_API_KEY appears to be invalid or placeholder');
      }
    }
  }

  private initializeProviders(): void {
    // Initialize Ethereum provider
    if (this.config.enabledChains.includes('ethereum')) {
      const ethRpcUrl = process.env['ETH_RPC_URL']!;
      this.ethProvider = new ethers.JsonRpcProvider(ethRpcUrl);
    }

    // Initialize Solana connection
    if (this.config.enabledChains.includes('solana')) {
      const solRpcUrl = process.env['SOL_RPC_URL'] || 'https://api.mainnet-beta.solana.com';
      this.solConnection = new Connection(solRpcUrl, 'confirmed');
    }

    // Initialize BSC provider
    if (this.config.enabledChains.includes('bsc')) {
      const bscRpcUrl = process.env['BSC_RPC_URL'] || 'https://bsc-dataseed1.binance.org';
      this.bscProvider = new ethers.JsonRpcProvider(bscRpcUrl);
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
    const privateKey = process.env['MEV_PRIVATE_KEY']!;

    // Initialize MEV clients
    await this.initializeMevClients(privateKey);
    
    // Initialize profit calculator
    this.initializeProfitCalculator();
    
    // Initialize token metadata service
    this.initializeTokenMetadataService();
    
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

  private initializeProfitCalculator(): void {
    this.profitCalculator = new ProfitCalculator();
    logger.info('Profit calculator initialized');
  }

  private initializeTokenMetadataService(): void {
    // Initialize TokenMetadataService with the existing services
    const config = {
      cacheTimeout: 600, // 10 minutes
      enablePriceUpdates: true,
      enableVerification: true,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10
    };

    // We'll initialize with minimal services for now
    // In production, this would integrate with PriceOracle, DEXAggregator, etc.
    const mockPriceOracle = {} as any;
    const mockDexAggregator = {} as any; 
    const mockChainAbstraction = {} as any;

    this.tokenMetadataService = new TokenMetadataService(
      config,
      mockPriceOracle,
      mockDexAggregator,
      mockChainAbstraction,
      logger
    );
    
    logger.info('Token metadata service initialized');
  }

  private async initializeMevClients(privateKey: string): Promise<void> {
    // Initialize Flashbots client for Ethereum
    if (this.config.enabledChains.includes('ethereum') && this.ethProvider) {
      const flashbotsConfig: FlashbotsConfig = {
        relayUrl: process.env['FLASHBOTS_RELAY_URL']!,
        authKey: process.env['FLASHBOTS_AUTH_KEY'] || privateKey,
        maxBaseFeeInFutureBlock: process.env['MAX_BASE_FEE'] || '100',
        maxPriorityFeePerGas: process.env['MAX_PRIORITY_FEE'] || '5',
        minProfitWei: ethers.parseEther(this.config.minProfitThresholds.ethereum).toString(),
        reputationBonus: parseFloat(process.env['REPUTATION_BONUS'] || '0'),
        maxGasLimit: parseInt(process.env['MAX_GAS_LIMIT'] || '500000'),
        deadlineMinutes: parseInt(process.env['DEADLINE_MINUTES'] || '20'),
        profitMargin: parseFloat(process.env['PROFIT_MARGIN'] || '0.3'),
        maxRetryAttempts: parseInt(process.env['MAX_RETRY_ATTEMPTS'] || '3'),
        retryDelayMs: parseInt(process.env['RETRY_DELAY_MS'] || '1000'),
        bundleTimeoutMs: parseInt(process.env['BUNDLE_TIMEOUT_MS'] || '60000'),
        simulationTimeoutMs: parseInt(process.env['SIMULATION_TIMEOUT_MS'] || '10000'),
        enableBundleCompetition: process.env['ENABLE_BUNDLE_COMPETITION'] === 'true',
        enableAdvancedGasBidding: process.env['ENABLE_ADVANCED_GAS_BIDDING'] === 'true',
        wethAddress: process.env['WETH_ADDRESS'] || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        supportedDexes: process.env['SUPPORTED_DEXES']?.split(',') || ['uniswap-v2', 'uniswap-v3']
      };

      this.flashbotsClient = new FlashbotsClient(this.ethProvider, privateKey, flashbotsConfig);
      await this.flashbotsClient.initialize();
    }

    // Initialize Jito client for Solana
    if (this.config.enabledChains.includes('solana') && this.solConnection) {
      const jitoConfig: JitoConfig = {
        blockEngineUrl: process.env['JITO_BLOCK_ENGINE_URL']!,
        relayerUrl: process.env['JITO_RELAYER_URL'] || 'https://mainnet.relayer.jito.wtf',
        tipAccount: process.env['JITO_TIP_ACCOUNT'] || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        maxTipLamports: parseInt(process.env['MAX_TIP_LAMPORTS'] || '100000'),
        minProfitLamports: parseInt(process.env['MIN_PROFIT_LAMPORTS'] || '1000000'),
        validatorPreferences: process.env['PREFERRED_VALIDATORS']?.split(',') || [],
        profitMarginPercent: parseFloat(process.env['JITO_PROFIT_MARGIN_PERCENT'] || '20'),
        frontRunRatio: parseFloat(process.env['JITO_FRONT_RUN_RATIO'] || '0.4'),
        networkCongestionMultiplier: parseFloat(process.env['JITO_NETWORK_CONGESTION_MULTIPLIER'] || '1.5'),
        maxBundleAttempts: parseInt(process.env['JITO_MAX_BUNDLE_ATTEMPTS'] || '30'),
        baseTps: parseInt(process.env['JITO_BASE_TPS'] || '2000')
      };

      this.jitoClient = new JitoClient(this.solConnection, jitoConfig);
      await this.jitoClient.initialize();
    }

    // Initialize BSC MEV client
    if (this.config.enabledChains.includes('bsc') && this.bscProvider) {
      const bscMevConfig: BscMevConfig = {
        provider: (process.env['BSC_MEV_PROVIDER'] as any) || 'bloxroute',
        apiKey: process.env['BSC_MEV_API_KEY']!,
        endpoint: process.env['BSC_MEV_ENDPOINT'] || '',
        maxGasPrice: process.env['BSC_MAX_GAS_PRICE'] || '20',
        minProfitBnb: this.config.minProfitThresholds.bsc,
        preferredValidators: process.env['BSC_PREFERRED_VALIDATORS']?.split(',') || [],
        mempoolSubscription: process.env['BSC_MEMPOOL_SUBSCRIPTION'] === 'true',
        maxSlippagePercent: parseFloat(process.env['BSC_MAX_SLIPPAGE_PERCENT'] || '5'),
        frontRunRatio: parseFloat(process.env['BSC_FRONT_RUN_RATIO'] || '0.35'),
        gasPremiumPercent: parseFloat(process.env['BSC_GAS_PREMIUM_PERCENT'] || '20'),
        bundleTimeoutAttempts: parseInt(process.env['BSC_BUNDLE_TIMEOUT_ATTEMPTS'] || '20')
      };

      this.bscMevClient = new BscMevClient(this.bscProvider, privateKey, bscMevConfig);
      await this.bscMevClient.initialize();
    }
  }

  private async initializeSandwichDetector(): Promise<void> {
    // Initialize shared mempool monitor
    const mempoolConfig: MempoolConfig = {
      performance: {
        maxLatencyMs: 30,
        processingDelayMs: 100,
        maxBatchSize: 10,
        connectionPoolSize: 5,
        priorityProcessingEnabled: true,
        mevDetectionLatency: 15
      },
      subscriptionFilters: {
        minTradeValue: process.env['MIN_TRADE_VALUE'] || '1000',
        maxGasPrice: process.env['MAX_GAS_PRICE'] || '100',
        whitelistedDexes: process.env['WHITELISTED_DEXES']?.split(',') || [],
        blacklistedTokens: process.env['BLACKLISTED_TOKENS']?.split(',') || [],
        minLiquidity: '50000',
        mevOpportunityThreshold: '100',
        priorityAddresses: [],
        flashloanDetection: true
      },
      chains: {
        ethereum: {
          enabled: true,
          wsEndpoints: [process.env['ETH_WS_URL'] || 'wss://mainnet.infura.io/ws/v3/your-key'],
          rpcEndpoints: [process.env['ETH_RPC_URL'] || 'https://mainnet.infura.io/v3/your-key'],
          mempoolProviders: ['infura', 'flashbots'],
          priorityFeeThreshold: '2000000000',
          blockTime: 12000,
          finalizationDepth: 12
        }
      },
      monitoring: {
        heartbeatIntervalMs: 30000,
        reconnectDelayMs: 5000,
        maxReconnectAttempts: 5,
        healthCheckTimeout: 10000,
        alertingThresholds: {
          missedTransactionsPercent: 2,
          latencyThresholdMs: 50,
          connectionFailuresPerHour: 20
        }
      },
      mevDetection: {
        enabled: true,
        sandwichDetection: true,
        arbitrageDetection: false,
        liquidationDetection: true,
        frontRunDetection: true,
        confidenceThreshold: 80,
        profitabilityThreshold: '100'
      },
      rateLimiting: {
        requestsPerSecond: 200,
        burstLimit: 500,
        chainSpecificLimits: { ethereum: 200 },
        backoffMultiplier: 1.2
      }
    };

    // Initialize price oracle for mempool monitor
    const priceOracle = new (require('@trading-bot/chain-client').PriceOracle)({
      sources: [
        {
          id: 'coingecko',
          name: 'CoinGecko',
          priority: 1,
          isActive: true,
          rateLimit: 50,
          timeout: 10000,
          supportedChains: this.config.enabledChains,
          baseUrl: 'https://api.coingecko.com/api/v3',
        }
      ],
      cacheTimeout: 30,
      maxRetries: 3,
      retryDelay: 1000,
      enableBackupSources: true,
      priceDeviationThreshold: 5,
    }, logger);

    this.mempoolMonitor = new MempoolMonitor(mempoolConfig, priceOracle, logger);
    
    // Initialize sandwich detector with local config
    const sandwichConfig = {
      chains: this.config.enabledChains,
      minTradeValue: process.env['MIN_TRADE_VALUE'] || '1000',
      maxGasPrice: process.env['MAX_GAS_PRICE'] || '100',
      minLiquidity: process.env['MIN_LIQUIDITY'] || '100000',
      blacklistedTokens: process.env['BLACKLISTED_TOKENS']?.split(',') || [],
      whitelistedDexes: process.env['WHITELISTED_DEXES']?.split(',') || [],
      maxSlippage: parseFloat(process.env['MAX_SLIPPAGE'] || '5'),
      profitabilityThreshold: parseFloat(process.env['PROFITABILITY_THRESHOLD'] || '1')
    };

    this.sandwichDetector = new SandwichDetector(sandwichConfig);
    
    const providers: any = {};
    if (this.ethProvider) providers.ethereum = this.ethProvider;
    if (this.bscProvider) providers.bsc = this.bscProvider;
    if (this.solConnection) providers.solana = this.solConnection;
    
    // Initialize both components
    await this.mempoolMonitor.initialize(providers);
    await this.sandwichDetector.initialize(providers);
    
    this.setupMempoolMonitorEvents();
    this.setupSandwichDetectorEvents();
  }

  private async initializeExecutionEngine(): Promise<void> {
    this.executionEngine = new SandwichExecutionEngine(this.config.maxConcurrentBundles);
    
    const clients: { 
      flashbots?: FlashbotsClient; 
      jito?: JitoClient; 
      bscMev?: BscMevClient;
      solanaConnection?: Connection;
      tokenMetadataService?: TokenMetadataService;
    } = {};
    
    if (this.flashbotsClient) clients.flashbots = this.flashbotsClient;
    if (this.jitoClient) clients.jito = this.jitoClient;
    if (this.bscMevClient) clients.bscMev = this.bscMevClient;
    if (this.solConnection) clients.solanaConnection = this.solConnection;
    if (this.tokenMetadataService) clients.tokenMetadataService = this.tokenMetadataService;
    
    await this.executionEngine.initialize(clients);
    
    this.setupExecutionEngineEvents();
  }

  private async initializeRiskManager(): Promise<void> {
    const riskConfig: RiskConfig = {
      maxPositionSizeEth: process.env['MAX_POSITION_SIZE_ETH'] || '1.0',
      maxPositionSizeBnb: process.env['MAX_POSITION_SIZE_BNB'] || '5.0',
      maxPositionSizeSol: process.env['MAX_POSITION_SIZE_SOL'] || '10.0',
      maxDailyVolume: process.env['MAX_DAILY_VOLUME'] || '100.0',
      maxConcurrentPositions: parseInt(process.env['MAX_CONCURRENT_POSITIONS'] || '3'),
      maxSlippageTolerance: parseFloat(process.env['MAX_SLIPPAGE_TOLERANCE'] || '5'),
      maxPriceImpact: parseFloat(process.env['MAX_PRICE_IMPACT'] || '10'),
      minLiquidityUsd: parseFloat(process.env['MIN_LIQUIDITY_USD'] || '50000'),
      maxGasPriceGwei: parseFloat(process.env['MAX_GAS_PRICE_GWEI'] || '100'),
      minProfitUsd: parseFloat(process.env['MIN_PROFIT_USD'] || '10'),
      maxPositionDuration: parseInt(process.env['MAX_POSITION_DURATION'] || '300000'),
      cooldownPeriod: parseInt(process.env['COOLDOWN_PERIOD'] || '5000'),
      maxTradesPerHour: parseInt(process.env['MAX_TRADES_PER_HOUR'] || '20'),
      maxFailuresPerHour: parseInt(process.env['MAX_FAILURES_PER_HOUR'] || '10'),
      maxPortfolioValue: process.env['MAX_PORTFOLIO_VALUE'] || '1000.0',
      maxDrawdownPercent: parseFloat(process.env['MAX_DRAWDOWN_PERCENT'] || '20'),
      stopLossPercent: parseFloat(process.env['STOP_LOSS_PERCENT'] || '10'),
      emergencyStopLoss: parseFloat(process.env['EMERGENCY_STOP_LOSS'] || '500'),
      consecutiveFailureLimit: parseInt(process.env['CONSECUTIVE_FAILURE_LIMIT'] || '5'),
      gasEfficiencyThreshold: parseFloat(process.env['GAS_EFFICIENCY_THRESHOLD'] || '0.001')
    };

    this.riskManager = new RiskManager(riskConfig);
    this.setupRiskManagerEvents();
  }

  private async initializePerformanceOptimizer(): Promise<void> {
    const performanceConfig: PerformanceConfig = {
      maxMempoolLatency: parseInt(process.env['MAX_MEMPOOL_LATENCY'] || '200'),
      maxExecutionLatency: parseInt(process.env['MAX_EXECUTION_LATENCY'] || '5000'),
      precomputeThreshold: parseFloat(process.env['PRECOMPUTE_THRESHOLD'] || '70'),
      maxConcurrentOpportunities: parseInt(process.env['MAX_CONCURRENT_OPPORTUNITIES'] || '10'),
      maxConcurrentSimulations: parseInt(process.env['MAX_CONCURRENT_SIMULATIONS'] || '5'),
      maxConcurrentExecutions: parseInt(process.env['MAX_CONCURRENT_EXECUTIONS'] || '3'),
      poolDataCacheTime: parseInt(process.env['POOL_DATA_CACHE_TIME'] || '300000'),
      tokenDataCacheTime: parseInt(process.env['TOKEN_DATA_CACHE_TIME'] || '600000'),
      gasEstimateCacheTime: parseInt(process.env['GAS_ESTIMATE_CACHE_TIME'] || '30000'),
      minSuccessRate: parseFloat(process.env['MIN_SUCCESS_RATE'] || '0.3'),
      targetLatencyMs: parseInt(process.env['TARGET_LATENCY_MS'] || '1000'),
      maxMemoryUsageMb: parseInt(process.env['MAX_MEMORY_USAGE_MB'] || '512'),
      gasEstimationBuffer: parseFloat(process.env['GAS_ESTIMATION_BUFFER'] || '20'),
      priorityFeeBoost: parseFloat(process.env['PRIORITY_FEE_BOOST'] || '50'),
      enableGasPrecompute: process.env['ENABLE_GAS_PRECOMPUTE'] !== 'false'
    };

    this.performanceOptimizer = new PerformanceOptimizer(performanceConfig);
    await this.performanceOptimizer.initialize();
    this.setupPerformanceOptimizerEvents();
  }

  private setupMempoolMonitorEvents(): void {
    if (!this.mempoolMonitor) return;

    // Process transaction batches from the shared mempool monitor
    this.mempoolMonitor.on('transactionBatch', ({ chain, transactions }: { chain: string; transactions: PendingTransaction[] }) => {
      // For now, log that we received transactions
      // TODO: Integrate with sandwich detector
      logger.debug(`Received ${transactions.length} transactions for ${chain}`);
    });

    this.mempoolMonitor.on('error', (error: any) => {
      logger.error('Mempool monitor error', { error: error.message });
    });
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

    this.sandwichDetector.on('error', (error: Error) => {
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
          chain: result.execution.chain || 'ethereum'
        });
      }

      // Record trade for risk management
      if (this.riskManager) {
        this.riskManager.recordTrade({
          id: executionId,
          chain: result.execution.chain || 'ethereum',
          tokenIn: result.execution.tokenIn || 'unknown',
          tokenOut: result.execution.tokenOut || 'unknown',
          amount: result.execution.amountIn || '0',
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

  /**
   * Fetch token metadata using the token metadata service
   */
  private async getTokenMetadata(address: string, chain: string): Promise<TokenMetadata | null> {
    if (!this.tokenMetadataService) {
      logger.warn('Token metadata service not available');
      return null;
    }
    return await this.tokenMetadataService.getTokenMetadata(address, chain);
  }



  private async processSandwichOpportunity(opportunity: SandwichOpportunity): Promise<void> {
    try {
      // Fetch real token metadata
      const tokenInMetadata = await this.getTokenMetadata(opportunity.tokenIn, opportunity.chain);
      const tokenOutMetadata = await this.getTokenMetadata(opportunity.tokenOut, opportunity.chain);

      if (!tokenInMetadata || !tokenOutMetadata) {
        logger.debug('Failed to fetch token metadata, skipping opportunity');
        return;
      }

      // Detailed profit calculation with real data
      const profitParams = {
        victimAmountIn: opportunity.amountIn,
        victimAmountOutMin: opportunity.expectedAmountOut,
        tokenInAddress: opportunity.tokenIn,
        tokenOutAddress: opportunity.tokenOut,
        tokenInDecimals: tokenInMetadata.decimals,
        tokenOutDecimals: tokenOutMetadata.decimals,
        tokenInPrice: tokenInMetadata.priceUsd,
        tokenOutPrice: tokenOutMetadata.priceUsd,
        poolReserve0: opportunity.poolLiquidity,
        poolReserve1: opportunity.poolLiquidity,
        poolFee: 300, // Would extract from pool data
        gasPrice: opportunity.gasPrice,
        chain: opportunity.chain as 'ethereum' | 'bsc' | 'solana',
        dexType: opportunity.dexType
      };

      const profitOptimization = await this.profitCalculator.calculateOptimalProfit(profitParams);
      
      if (profitOptimization.maxProfit <= '0' || profitOptimization.optimalProfitability < 1) {
        logger.debug('Opportunity rejected - insufficient profit after detailed calculation', {
          maxProfit: profitOptimization.maxProfit,
          profitability: profitOptimization.optimalProfitability,
          riskAdjustedReturn: profitOptimization.riskAdjustedReturn
        });
        return;
      }

      logger.info('Detailed profit calculation completed', {
        maxProfit: profitOptimization.maxProfit,
        optimalProfitability: profitOptimization.optimalProfitability,
        gasEfficiency: profitOptimization.gasEfficiency,
        riskAdjustedReturn: profitOptimization.riskAdjustedReturn,
        optimalFrontRunAmount: profitOptimization.optimalFrontRunAmount
      });

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
          recommendedPositionSize: riskAssessment.limits.positionSize,
          warnings: riskAssessment.warnings
        });

        // Use risk-adjusted position size
        opportunity.amountIn = riskAssessment.limits.positionSize;
      }

      // Execute the sandwich attack
      if (this.executionEngine && this.activeBundles.size < this.config.maxConcurrentBundles) {
        const executionId = `execution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.activeBundles.add(executionId);

        const executionParams: ExecutionParams = {
          opportunity,
          profitOptimization,
          riskAssessment: this.riskManager?.getRiskMetrics(),
          optimizationResult,
          paperTradingMode: this.config.paperTradingMode
        };

        await this.executionEngine.executeSandwich(executionParams);

        logger.info('Sandwich execution initiated', {
          executionId,
          chain: opportunity.chain,
          estimatedProfit: profitOptimization.maxProfit,
          paperTradingMode: this.config.paperTradingMode
        });
      } else {
        logger.warn('Cannot execute sandwich - concurrent bundle limit reached or execution engine unavailable');
      }

    } catch (error) {
      logger.error('Failed to process sandwich opportunity', {
        error: error instanceof Error ? error.message : error,
        opportunity: {
          chain: opportunity.chain,
          tokenIn: opportunity.tokenIn,
          tokenOut: opportunity.tokenOut
        }
      });
    }
  }

  private startAdvancedSandwichDetection(): void {
    // Start shared mempool monitor
    if (this.mempoolMonitor && !this.mempoolMonitor.isActive()) {
      this.mempoolMonitor.startMonitoring().catch((error: Error) => {
        logger.error('Failed to start mempool monitoring', { error: error.message });
      });
    }

    // Start sandwich detector
    if (this.sandwichDetector && !this.sandwichDetector.getStats().isMonitoring) {
      this.sandwichDetector.startMonitoring().catch((error: Error) => {
        logger.error('Failed to start sandwich detection', { error: error.message });
      });
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping Advanced MEV Sandwich Bot...');
      this.isRunning = false;

      // Stop mempool monitoring
      if (this.mempoolMonitor) {
        await this.mempoolMonitor.stopMonitoring();
      }

      // Stop sandwich detection
      if (this.sandwichDetector) {
        await this.sandwichDetector.stopMonitoring();
      }

      // Stop execution engine
      if (this.executionEngine) {
        await this.executionEngine.stop();
      }

      // Wait for active bundles to complete (with timeout)
      const timeout = 30000; // 30 seconds
      const startTime = Date.now();
      while (this.activeBundles.size > 0 && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (this.activeBundles.size > 0) {
        logger.warn(`Bot stopped with ${this.activeBundles.size} active bundles still pending`);
      }

      // Disconnect clients
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
      logger.error('Error while stopping bot', { 
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
      mempoolMonitor: boolean;
      sandwichDetector: boolean;
      executionEngine: boolean;
      riskManager: boolean;
      performanceOptimizer: boolean;
    };
    metrics: {
      mempoolMonitor?: any;
      sandwichDetector?: any;
      riskManager?: any;
      performanceOptimizer?: any;
    };
  } {
    return {
      isRunning: this.isRunning,
      enabledChains: this.config.enabledChains,
      activeBundles: this.activeBundles.size,
      paperTradingMode: this.config.paperTradingMode,
      components: {
        mempoolMonitor: !!this.mempoolMonitor,
        sandwichDetector: !!this.sandwichDetector,
        executionEngine: !!this.executionEngine,
        riskManager: !!this.riskManager,
        performanceOptimizer: !!this.performanceOptimizer
      },
      metrics: {
        mempoolMonitor: this.mempoolMonitor?.getStats(),
        sandwichDetector: this.sandwichDetector?.getStats(),
        riskManager: this.riskManager?.getRiskMetrics(),
        performanceOptimizer: this.performanceOptimizer?.getStats()
      }
    };
  }

  async emergencyStop(): Promise<void> {
    logger.error('EMERGENCY STOP INITIATED');
    this.config.globalKillSwitch = true;
    
    // Cancel all active bundles
    for (const bundleId of this.activeBundles) {
      try {
        if (this.executionEngine) {
          await this.executionEngine.cancelExecution(bundleId);
        }
      } catch (error) {
        logger.error('Failed to cancel bundle during emergency stop', { bundleId, error });
      }
    }
    
    await this.stop();
  }
}

async function main() {
  const bot = new AdvancedMevSandwichBot();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await bot.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await bot.start();
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { AdvancedMevSandwichBot };