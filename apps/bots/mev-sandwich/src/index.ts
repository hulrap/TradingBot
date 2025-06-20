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

// Enhanced error types for better error handling
export class MevBotError extends Error {
  constructor(
    message: string,
    public code: string,
    public chain?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'MevBotError';
  }
}

export class ConfigurationError extends MevBotError {
  constructor(message: string, originalError?: Error) {
    super(message, 'CONFIGURATION_ERROR', undefined, originalError);
    this.name = 'ConfigurationError';
  }
}

export class ExecutionError extends MevBotError {
  constructor(message: string, chain?: string, originalError?: Error) {
    super(message, 'EXECUTION_ERROR', chain, originalError);
    this.name = 'ExecutionError';
  }
}

export class PriceOracleError extends MevBotError {
  constructor(message: string, originalError?: Error) {
    super(message, 'PRICE_ORACLE_ERROR', undefined, originalError);
    this.name = 'PriceOracleError';
  }
}

// Enhanced price oracle service for real-time price data
interface TokenMetadata {
  address: string;
  symbol: string;
  decimals: number;
  price: number;
  timestamp: number;
  confidence: number;
}

interface PriceOracleConfig {
  coinGeckoApiKey?: string;
  chainlinkRpcUrl?: string;
  pythPriceServiceUrl?: string;
  cacheTimeMs: number;
  maxPriceAge: number;
  minConfidence: number;
}

class EnhancedPriceOracle {
  private cache = new Map<string, TokenMetadata>();
  private config: PriceOracleConfig;

  constructor(config: PriceOracleConfig) {
    this.config = config;
  }

  async getTokenMetadata(address: string, chain: string): Promise<TokenMetadata> {
    const cacheKey = `${chain}_${address}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeMs) {
      return cached;
    }

    try {
      // Multi-source price aggregation
      const prices = await Promise.allSettled([
        this.fetchFromCoinGecko(address, chain),
        this.fetchFromChainlink(address, chain),
        this.fetchFromPyth(address, chain)
      ]);

      const validPrices = prices
        .filter(result => result.status === 'fulfilled' && result.value.price > 0)
        .map(result => (result as PromiseFulfilledResult<TokenMetadata>).value);

      if (validPrices.length === 0) {
        throw new PriceOracleError(`No valid prices found for ${address} on ${chain}`);
      }

      // Use median price for stability
      const medianPrice = this.calculateMedianPrice(validPrices);
      const confidence = validPrices.length / 3;

      if (confidence < this.config.minConfidence) {
        throw new PriceOracleError(`Price confidence too low: ${confidence} < ${this.config.minConfidence}`);
      }

      const metadata: TokenMetadata = {
        address,
        symbol: validPrices[0].symbol,
        decimals: validPrices[0].decimals,
        price: medianPrice,
        timestamp: Date.now(),
        confidence
      };

      this.cache.set(cacheKey, metadata);
      return metadata;

    } catch (error) {
      throw new PriceOracleError(`Failed to fetch token metadata for ${address}`, error as Error);
    }
  }

  private calculateMedianPrice(prices: TokenMetadata[]): number {
    const sortedPrices = prices.map(p => p.price).sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    return sortedPrices.length % 2 !== 0 ? sortedPrices[mid] : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
  }

  private async fetchFromCoinGecko(address: string, chain: string): Promise<TokenMetadata> {
    const platformMap: { [chain: string]: string } = {
      ethereum: 'ethereum',
      bsc: 'binance-smart-chain',
      polygon: 'polygon-pos'
    };

    const platform = platformMap[chain];
    if (!platform) throw new Error(`Unsupported chain: ${chain}`);

    const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${address}&vs_currencies=usd&include_24hr_change=true`;
    
    const headers: any = { 'User-Agent': 'MEVBot/1.0' };
    if (this.config.coinGeckoApiKey) {
      headers['X-CG-Pro-API-Key'] = this.config.coinGeckoApiKey;
    }

    const response = await fetch(url, { 
      headers,
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json() as Record<string, any>;
    const tokenData = data[address.toLowerCase()];
    
    if (!tokenData || typeof tokenData !== 'object' || typeof tokenData.usd !== 'number') {
      throw new Error('Invalid price data from CoinGecko');
    }

    return {
      address,
      symbol: 'UNKNOWN', // CoinGecko doesn't provide symbol in this endpoint
      decimals: 18, // Default, would need separate call for exact decimals
      price: tokenData.usd,
      timestamp: Date.now(),
      confidence: 1
    };
  }

  private async fetchFromChainlink(address: string, chain: string): Promise<TokenMetadata> {
    // Placeholder for Chainlink price feed integration
    // In production, implement actual Chainlink oracle calls
    throw new Error('Chainlink integration not implemented');
  }

  private async fetchFromPyth(address: string, chain: string): Promise<TokenMetadata> {
    // Placeholder for Pyth Network integration
    // In production, implement Pyth price service calls
    throw new Error('Pyth integration not implemented');
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; oldestEntry: number } {
    const timestamps = Array.from(this.cache.values()).map(data => data.timestamp);
    return {
      size: this.cache.size,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0
    };
  }
}

// Enhanced configuration with validation
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
  priceOracle: PriceOracleConfig;
  healthCheck: {
    enabled: boolean;
    port: number;
    interval: number;
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
}

// Circuit breaker for external service failures
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number,
    private resetTimeout: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Configure enhanced logger with structured logging
const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
  ),
  defaultMeta: { service: 'mev-sandwich-bot' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, metadata }) => {
          const meta = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
          return `${timestamp} [${level}] ${message} ${meta}`;
        })
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

class AdvancedMevSandwichBot {
  // Core MEV clients
  private flashbotsClient?: FlashbotsClient;
  private jitoClient?: JitoClient;
  private bscMevClient?: BscMevClient;
  
  // Advanced sandwich components
  private sandwichDetector?: SandwichDetector;
  private profitCalculator!: ProfitCalculator;
  private executionEngine?: SandwichExecutionEngine;
  private riskManager?: RiskManager;
  private performanceOptimizer?: PerformanceOptimizer;
  
  // Enhanced services
  private priceOracle!: EnhancedPriceOracle;
  private circuitBreaker?: CircuitBreaker;
  
  private config: MevBotConfig;
  private isRunning = false;
  private activeBundles = new Set<string>();
  private isShuttingDown = false;

  // Network providers
  private ethProvider?: ethers.JsonRpcProvider;
  private solConnection?: Connection;
  private bscProvider?: ethers.JsonRpcProvider;

  // Health monitoring
  private healthMetrics = {
    startTime: Date.now(),
    totalOpportunities: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfit: 0,
    lastActivity: Date.now()
  };

  constructor() {
    this.config = this.loadAndValidateConfiguration();
    this.initializeServices();
    this.initializeProviders();
  }

  private loadAndValidateConfiguration(): MevBotConfig {
    const config = {
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
      enablePerformanceOptimization: process.env['ENABLE_PERFORMANCE_OPTIMIZATION'] !== 'false',
      priceOracle: {
        coinGeckoApiKey: process.env['COINGECKO_API_KEY'],
        chainlinkRpcUrl: process.env['CHAINLINK_RPC_URL'],
        pythPriceServiceUrl: process.env['PYTH_PRICE_SERVICE_URL'] || 'https://hermes.pyth.network',
        cacheTimeMs: parseInt(process.env['PRICE_CACHE_TIME_MS'] || '30000'),
        maxPriceAge: parseInt(process.env['MAX_PRICE_AGE_MS'] || '60000'),
        minConfidence: parseFloat(process.env['MIN_PRICE_CONFIDENCE'] || '0.8')
      },
      healthCheck: {
        enabled: process.env['HEALTH_CHECK_ENABLED'] !== 'false',
        port: parseInt(process.env['HEALTH_CHECK_PORT'] || '3000'),
        interval: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '30000')
      },
      circuitBreaker: {
        enabled: process.env['CIRCUIT_BREAKER_ENABLED'] !== 'false',
        failureThreshold: parseInt(process.env['CIRCUIT_BREAKER_THRESHOLD'] || '5'),
        resetTimeout: parseInt(process.env['CIRCUIT_BREAKER_RESET_TIMEOUT'] || '60000')
      }
    };

    this.validateConfiguration(config);
    return config;
  }

  private validateConfiguration(config: MevBotConfig): void {
    // Validate required environment variables
    const requiredEnvVars = [
      'MEV_PRIVATE_KEY',
    ];

    // Chain-specific required variables
    if (config.enabledChains.includes('ethereum')) {
      requiredEnvVars.push('ETH_RPC_URL');
    }
    if (config.enabledChains.includes('solana')) {
      requiredEnvVars.push('SOL_RPC_URL');
    }
    if (config.enabledChains.includes('bsc')) {
      requiredEnvVars.push('BSC_RPC_URL');
    }

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new ConfigurationError(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate configuration values
    if (config.maxConcurrentBundles <= 0 || config.maxConcurrentBundles > 50) {
      throw new ConfigurationError('maxConcurrentBundles must be between 1 and 50');
    }

    if (config.enabledChains.length === 0) {
      throw new ConfigurationError('At least one chain must be enabled');
    }

    // Validate profit thresholds
    Object.entries(config.minProfitThresholds).forEach(([chain, threshold]) => {
      if (parseFloat(threshold) <= 0) {
        throw new ConfigurationError(`Invalid profit threshold for ${chain}: ${threshold}`);
      }
    });

    logger.info('Configuration validated successfully', {
      enabledChains: config.enabledChains,
      paperTradingMode: config.paperTradingMode,
      maxConcurrentBundles: config.maxConcurrentBundles
    });
  }

  private initializeServices(): void {
    // Initialize price oracle
    this.priceOracle = new EnhancedPriceOracle(this.config.priceOracle);

    // Initialize circuit breaker
    if (this.config.circuitBreaker.enabled) {
      this.circuitBreaker = new CircuitBreaker(
        this.config.circuitBreaker.failureThreshold,
        this.config.circuitBreaker.resetTimeout
      );
    }

    logger.info('Enhanced services initialized', {
      priceOracle: true,
      circuitBreaker: this.config.circuitBreaker.enabled
    });
  }

  private initializeProviders(): void {
    try {
      // Initialize Ethereum provider with enhanced error handling
      if (this.config.enabledChains.includes('ethereum')) {
        const ethRpcUrl = process.env['ETH_RPC_URL'];
        if (!ethRpcUrl || ethRpcUrl.includes('your-api-key')) {
          throw new ConfigurationError('ETH_RPC_URL must be set to a valid RPC endpoint');
        }
        this.ethProvider = new ethers.JsonRpcProvider(ethRpcUrl);
      }

      // Initialize Solana connection with validation
      if (this.config.enabledChains.includes('solana')) {
        const solRpcUrl = process.env['SOL_RPC_URL'];
        if (!solRpcUrl) {
          throw new ConfigurationError('SOL_RPC_URL must be set for Solana operations');
        }
        this.solConnection = new Connection(solRpcUrl, 'confirmed');
      }

      // Initialize BSC provider with validation
      if (this.config.enabledChains.includes('bsc')) {
        const bscRpcUrl = process.env['BSC_RPC_URL'];
        if (!bscRpcUrl) {
          throw new ConfigurationError('BSC_RPC_URL must be set for BSC operations');
        }
        this.bscProvider = new ethers.JsonRpcProvider(bscRpcUrl);
      }

      logger.info('Network providers initialized successfully');
    } catch (error) {
      throw new ConfigurationError('Failed to initialize network providers', error as Error);
    }
  }

  // Enhanced retry mechanism with exponential backoff
  private async withRetry<T>(
    operation: () => Promise<T>, 
    maxRetries = 3, 
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (this.circuitBreaker) {
          return await this.circuitBreaker.execute(operation);
        } else {
          return await operation();
        }
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Operation failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries,
          error: lastError.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Enhanced token data fetching with real price oracle integration
  private async getEnhancedTokenData(address: string, chain: string): Promise<TokenMetadata> {
    return await this.withRetry(async () => {
      return await this.priceOracle.getTokenMetadata(address, chain);
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Advanced MEV Sandwich Bot...');

      // Check global kill switch
      if (this.config.globalKillSwitch) {
        logger.warn('Global kill switch is enabled - bot will not start');
        return;
      }

      // Initialize all components with enhanced error handling
      await this.initializeComponents();

      // Start health monitoring if enabled
      if (this.config.healthCheck.enabled) {
        this.startHealthMonitoring();
      }

      this.isRunning = true;
      this.healthMetrics.startTime = Date.now();

      logger.info('Advanced MEV Sandwich Bot started successfully', {
        enabledChains: this.config.enabledChains,
        paperTradingMode: this.config.paperTradingMode,
        riskManagementEnabled: this.config.enableRiskManagement,
        performanceOptimizationEnabled: this.config.enablePerformanceOptimization,
        healthCheckEnabled: this.config.healthCheck.enabled,
        circuitBreakerEnabled: this.config.circuitBreaker.enabled
      });

      // Start advanced sandwich detection and execution
      this.startAdvancedSandwichDetection();

    } catch (error) {
      logger.error('Failed to start Advanced MEV Sandwich Bot', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    const privateKey = process.env['MEV_PRIVATE_KEY'];
    if (!privateKey) {
      throw new Error('MEV_PRIVATE_KEY environment variable is required');
    }

    // Initialize MEV clients
    await this.initializeMevClients(privateKey);
    
    // Initialize profit calculator
    this.initializeProfitCalculator();
    
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

  private async initializeMevClients(privateKey: string): Promise<void> {
    // Initialize Flashbots client for Ethereum
    if (this.config.enabledChains.includes('ethereum') && this.ethProvider) {
      const flashbotsConfig: FlashbotsConfig = {
        relayUrl: process.env['FLASHBOTS_RELAY_URL'] || 'https://relay.flashbots.net',
        authKey: process.env['FLASHBOTS_AUTH_KEY'] || privateKey,
        maxBaseFeeInFutureBlock: process.env['MAX_BASE_FEE'] || '100',
        maxPriorityFeePerGas: process.env['MAX_PRIORITY_FEE'] || '5',
        minProfitWei: ethers.parseEther(this.config.minProfitThresholds.ethereum).toString(),
        reputationBonus: parseFloat(process.env['REPUTATION_BONUS'] || '0')
      };

      this.flashbotsClient = new FlashbotsClient(this.ethProvider, privateKey, flashbotsConfig);
      await this.flashbotsClient.initialize();
    }

    // Initialize Jito client for Solana
    if (this.config.enabledChains.includes('solana') && this.solConnection) {
      const jitoConfig: JitoConfig = {
        blockEngineUrl: process.env['JITO_BLOCK_ENGINE_URL'] || 'https://mainnet.block-engine.jito.wtf',
        relayerUrl: process.env['JITO_RELAYER_URL'] || 'https://mainnet.relayer.jito.wtf',
        tipAccount: process.env['JITO_TIP_ACCOUNT'] || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        maxTipLamports: parseInt(process.env['MAX_TIP_LAMPORTS'] || '100000'),
        minProfitLamports: parseInt(process.env['MIN_PROFIT_LAMPORTS'] || '1000000'),
        validatorPreferences: process.env['PREFERRED_VALIDATORS']?.split(',') || []
      };

      this.jitoClient = new JitoClient(this.solConnection, jitoConfig);
      await this.jitoClient.initialize();
    }

    // Initialize BSC MEV client
    if (this.config.enabledChains.includes('bsc') && this.bscProvider) {
      const bscMevConfig: BscMevConfig = {
        provider: (process.env['BSC_MEV_PROVIDER'] as any) || 'bloxroute',
        apiKey: process.env['BSC_MEV_API_KEY'] || '',
        endpoint: process.env['BSC_MEV_ENDPOINT'] || '',
        maxGasPrice: process.env['BSC_MAX_GAS_PRICE'] || '20',
        minProfitBnb: this.config.minProfitThresholds.bsc,
        preferredValidators: process.env['BSC_PREFERRED_VALIDATORS']?.split(',') || [],
        mempoolSubscription: process.env['BSC_MEMPOOL_SUBSCRIPTION'] === 'true'
      };

      this.bscMevClient = new BscMevClient(this.bscProvider, privateKey, bscMevConfig);
      await this.bscMevClient.initialize();
    }
  }

  private async initializeSandwichDetector(): Promise<void> {
    const mempoolConfig: MempoolConfig = {
      chains: this.config.enabledChains,
      minTradeValue: process.env['MIN_TRADE_VALUE'] || '1000',
      maxGasPrice: process.env['MAX_GAS_PRICE'] || '100',
      minLiquidity: process.env['MIN_LIQUIDITY'] || '100000',
      blacklistedTokens: process.env['BLACKLISTED_TOKENS']?.split(',') || [],
      whitelistedDexes: process.env['WHITELISTED_DEXES']?.split(',') || [],
      maxSlippage: parseFloat(process.env['MAX_SLIPPAGE'] || '5'),
      profitabilityThreshold: parseFloat(process.env['PROFITABILITY_THRESHOLD'] || '1')
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
    
    const clients: { flashbots?: FlashbotsClient; jito?: JitoClient; bscMev?: BscMevClient; } = {};
    if (this.flashbotsClient) clients.flashbots = this.flashbotsClient;
    if (this.jitoClient) clients.jito = this.jitoClient;
    if (this.bscMevClient) clients.bscMev = this.bscMevClient;
    
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
      this.healthMetrics.totalOpportunities++;
      this.healthMetrics.lastActivity = Date.now();

      // Enhanced token data fetching with real price oracle integration
      const [tokenInData, tokenOutData] = await Promise.all([
        this.getEnhancedTokenData(opportunity.tokenIn, opportunity.chain),
        this.getEnhancedTokenData(opportunity.tokenOut, opportunity.chain)
      ]);

      logger.info('Token metadata fetched', {
        tokenIn: {
          address: tokenInData.address,
          symbol: tokenInData.symbol,
          price: tokenInData.price,
          confidence: tokenInData.confidence
        },
        tokenOut: {
          address: tokenOutData.address,
          symbol: tokenOutData.symbol,
          price: tokenOutData.price,
          confidence: tokenOutData.confidence
        }
      });

      // Enhanced profit calculation with real market data
      const profitParams = {
        victimAmountIn: opportunity.amountIn,
        victimAmountOutMin: opportunity.expectedAmountOut,
        tokenInAddress: opportunity.tokenIn,
        tokenOutAddress: opportunity.tokenOut,
        tokenInDecimals: tokenInData.decimals,
        tokenOutDecimals: tokenOutData.decimals,
        tokenInPrice: tokenInData.price,
        tokenOutPrice: tokenOutData.price,
        poolReserve0: opportunity.poolLiquidity,
        poolReserve1: opportunity.poolLiquidity,
        poolFee: 300, // 0.3% - would extract from pool data
        gasPrice: opportunity.gasPrice,
        chain: opportunity.chain as 'ethereum' | 'bsc' | 'solana',
        dexType: opportunity.dexType
      };

      const profitOptimization = await this.withRetry(async () => {
        return await this.profitCalculator.calculateOptimalProfit(profitParams);
      });
      
      // Enhanced profit validation with confidence scoring
      const minConfidence = Math.min(tokenInData.confidence, tokenOutData.confidence);
      const confidenceAdjustedProfit = parseFloat(profitOptimization.maxProfit) * minConfidence;
      
      if (confidenceAdjustedProfit <= 0 || profitOptimization.optimalProfitability < 1) {
        logger.debug('Opportunity rejected - insufficient profit after detailed calculation', {
          maxProfit: profitOptimization.maxProfit,
          confidenceAdjustedProfit,
          profitability: profitOptimization.optimalProfitability,
          riskAdjustedReturn: profitOptimization.riskAdjustedReturn,
          priceConfidence: minConfidence
        });
        return;
      }

      logger.info('Enhanced profit calculation completed', {
        maxProfit: profitOptimization.maxProfit,
        confidenceAdjustedProfit,
        optimalProfitability: profitOptimization.optimalProfitability,
        gasEfficiency: profitOptimization.gasEfficiency,
        riskAdjustedReturn: profitOptimization.riskAdjustedReturn,
        optimalFrontRunAmount: profitOptimization.optimalFrontRunAmount,
        priceConfidence: minConfidence
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

      // Enhanced risk assessment with real market data
      if (this.riskManager) {
        const riskAssessment = await this.riskManager.assessRisk({
          chain: opportunity.chain,
          tokenIn: opportunity.tokenIn,
          tokenOut: opportunity.tokenOut,
          amountIn: opportunity.amountIn,
          poolLiquidity: opportunity.poolLiquidity,
          gasPrice: opportunity.gasPrice,
          estimatedProfit: confidenceAdjustedProfit.toString(),
          priceImpact: opportunity.slippage,
          slippage: opportunity.slippage,
          confidence: minConfidence
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

      // Execute sandwich attack with enhanced parameters
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
            estimatedProfit: confidenceAdjustedProfit.toString(),
            profitability: profitOptimization.optimalProfitability,
            confidence: minConfidence,
            mevScore: opportunity.mevScore
          },
          frontRunAmount: profitOptimization.optimalFrontRunAmount,
          maxGasPrice: process.env['MAX_GAS_PRICE'] || '100',
          maxSlippage: Math.min(5, opportunity.slippage * 1.2), // Dynamic slippage based on market conditions
          deadline: Date.now() + 60000, // 1 minute deadline
          minProfit: confidenceAdjustedProfit.toString(),
          simulationOnly: this.config.paperTradingMode
        };

        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.activeBundles.add(executionId);

        try {
          const result = await this.executionEngine.executeSandwich(executionParams);
          
          if (result.success) {
            this.healthMetrics.successfulExecutions++;
            this.healthMetrics.totalProfit += parseFloat(result.execution.actualProfit || '0');
          } else {
            this.healthMetrics.failedExecutions++;
          }
          
          if (this.config.paperTradingMode) {
            logger.info('Paper trading execution completed', {
              estimatedProfit: result.simulation.estimatedProfit,
              gasUsed: result.simulation.gasUsed,
              simulationTime: result.metrics.simulationTime,
              confidenceAdjustedProfit
            });
          }
        } catch (executionError) {
          this.healthMetrics.failedExecutions++;
          this.activeBundles.delete(executionId);
          throw new ExecutionError(
            `Sandwich execution failed: ${executionError instanceof Error ? executionError.message : executionError}`,
            opportunity.chain,
            executionError as Error
          );
        }
      }

    } catch (error) {
      this.healthMetrics.failedExecutions++;
      
      if (error instanceof PriceOracleError) {
        logger.warn('Price oracle error - skipping opportunity', {
          error: error.message,
          chain: opportunity.chain,
          tokenIn: opportunity.tokenIn,
          tokenOut: opportunity.tokenOut
        });
      } else if (error instanceof ExecutionError) {
        logger.error('Execution error processing sandwich opportunity', {
          error: error.message,
          chain: error.chain,
          originalError: error.originalError?.message
        });
      } else {
        logger.error('Unexpected error processing sandwich opportunity', {
          error: error instanceof Error ? error.message : error,
          opportunity: {
            chain: opportunity.chain,
            estimatedProfit: opportunity.estimatedProfit
          }
        });
      }
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

  // Health monitoring methods
  private startHealthMonitoring(): void {
    // Create a simple HTTP server for health checks
    const http = require('http');
    
    const server = http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        const healthStatus = {
          status: this.isRunning ? 'running' : 'stopped',
          uptime: Date.now() - this.healthMetrics.startTime,
          activeBundles: this.activeBundles.size,
          metrics: this.healthMetrics,
          circuitBreaker: this.circuitBreaker?.getState(),
          priceOracle: this.priceOracle.getCacheStats()
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthStatus));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(this.config.healthCheck.port, () => {
      logger.info(`Health check server started on port ${this.config.healthCheck.port}`);
    });

    // Periodic health metrics logging
    setInterval(() => {
      logger.info('Health metrics', this.healthMetrics);
    }, this.config.healthCheck.interval);
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