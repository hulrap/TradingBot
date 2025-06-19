import dotenv from 'dotenv';
import winston from 'winston';
import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';
import { FlashbotsClient, type FlashbotsConfig, type SandwichOpportunity } from './flashbots-client';
import { JitoClient, type JitoConfig, type SolanaSandwichOpportunity } from './jito-client';
import { BscMevClient, type BscMevConfig, type BscSandwichOpportunity } from './bsc-mev-client';

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
}

class MevSandwichBot {
  private flashbotsClient?: FlashbotsClient;
  private jitoClient?: JitoClient;
  private bscMevClient?: BscMevClient;
  private config: MevBotConfig;
  private isRunning = false;
  private activeBundles = new Set<string>();

  // Network providers
  private ethProvider?: ethers.JsonRpcProvider;
  private solConnection?: Connection;
  private bscProvider?: ethers.JsonRpcProvider;

  constructor() {
    this.config = this.loadConfiguration();
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
      paperTradingMode: process.env.PAPER_TRADING_MODE === 'true'
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
      logger.info('Starting MEV Sandwich Bot...');

      // Check global kill switch
      if (this.config.globalKillSwitch) {
        logger.warn('Global kill switch is enabled - bot will not start');
        return;
      }

      // Initialize MEV clients
      await this.initializeMevClients();

      this.isRunning = true;
      logger.info('MEV Sandwich Bot started successfully', {
        enabledChains: this.config.enabledChains,
        paperTradingMode: this.config.paperTradingMode,
        maxConcurrentBundles: this.config.maxConcurrentBundles
      });

      // Start monitoring for opportunities
      this.startOpportunityMonitoring();

    } catch (error) {
      logger.error('Failed to start MEV Sandwich Bot', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  private async initializeMevClients(): Promise<void> {
    const privateKey = process.env.MEV_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('MEV_PRIVATE_KEY environment variable is required');
    }

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
      this.setupFlashbotsEventHandlers();
    }

    // Initialize Jito client for Solana
    if (this.config.enabledChains.includes('solana') && this.solConnection) {
      const jitoConfig: JitoConfig = {
        blockEngineUrl: process.env.JITO_BLOCK_ENGINE_URL || 'https://mainnet.block-engine.jito.wtf',
        relayerUrl: process.env.JITO_RELAYER_URL || 'https://mainnet.relayer.jito.wtf',
        tipAccount: process.env.JITO_TIP_ACCOUNT || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        maxTipLamports: parseInt(process.env.MAX_TIP_LAMPORTS || '100000'), // 0.0001 SOL
        minProfitLamports: parseInt(process.env.MIN_PROFIT_LAMPORTS || '1000000'), // 0.001 SOL
        validatorPreferences: process.env.PREFERRED_VALIDATORS?.split(',') || []
      };

      this.jitoClient = new JitoClient(this.solConnection, jitoConfig);
      await this.jitoClient.initialize();
      this.setupJitoEventHandlers();
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
      this.setupBscMevEventHandlers();
    }
  }

  private setupFlashbotsEventHandlers(): void {
    if (!this.flashbotsClient) return;

    this.flashbotsClient.on('connected', (stats) => {
      logger.info('Flashbots client connected', stats);
    });

    this.flashbotsClient.on('bundleCreated', (bundle) => {
      logger.info('Flashbots bundle created', {
        bundleId: bundle.id,
        estimatedProfit: bundle.estimatedProfit,
        targetBlock: bundle.targetBlockNumber
      });
      this.activeBundles.add(bundle.id);
    });

    this.flashbotsClient.on('bundleIncluded', (bundle) => {
      logger.info('Flashbots bundle included!', {
        bundleId: bundle.id,
        netProfit: bundle.netProfit,
        inclusionTime: bundle.inclusionTime
      });
      this.activeBundles.delete(bundle.id);
    });

    this.flashbotsClient.on('bundleFailed', (bundle) => {
      logger.warn('Flashbots bundle failed', {
        bundleId: bundle.id,
        reason: bundle.revertReason
      });
      this.activeBundles.delete(bundle.id);
    });

    this.flashbotsClient.on('error', (error) => {
      logger.error('Flashbots client error', { error: error.message });
    });
  }

  private setupJitoEventHandlers(): void {
    if (!this.jitoClient) return;

    this.jitoClient.on('connected', (data) => {
      logger.info('Jito client connected', data);
    });

    this.jitoClient.on('bundleCreated', (bundle) => {
      logger.info('Jito bundle created', {
        bundleId: bundle.id,
        estimatedProfit: bundle.estimatedProfit,
        tipAmount: bundle.tipAmount
      });
      this.activeBundles.add(bundle.id);
    });

    this.jitoClient.on('bundleLanded', (bundle) => {
      logger.info('Jito bundle landed!', {
        bundleId: bundle.id,
        estimatedProfit: bundle.estimatedProfit,
        landingTime: bundle.landingTime
      });
      this.activeBundles.delete(bundle.id);
    });

    this.jitoClient.on('bundleFailed', (bundle) => {
      logger.warn('Jito bundle failed', {
        bundleId: bundle.id,
        reason: bundle.failureReason
      });
      this.activeBundles.delete(bundle.id);
    });

    this.jitoClient.on('error', (error) => {
      logger.error('Jito client error', { error: error.message });
    });
  }

  private setupBscMevEventHandlers(): void {
    if (!this.bscMevClient) return;

    this.bscMevClient.on('connected', () => {
      logger.info('BSC MEV client connected');
    });

    this.bscMevClient.on('bundleCreated', (bundle) => {
      logger.info('BSC MEV bundle created', {
        bundleId: bundle.id,
        estimatedProfit: bundle.estimatedProfit,
        blockNumber: bundle.blockNumber
      });
      this.activeBundles.add(bundle.id);
    });

    this.bscMevClient.on('bundleIncluded', (bundle) => {
      logger.info('BSC MEV bundle included!', {
        bundleId: bundle.id,
        estimatedProfit: bundle.estimatedProfit,
        txHashes: bundle.txHashes
      });
      this.activeBundles.delete(bundle.id);
    });

    this.bscMevClient.on('bundleFailed', (bundle) => {
      logger.warn('BSC MEV bundle failed', {
        bundleId: bundle.id,
        reason: bundle.failureReason
      });
      this.activeBundles.delete(bundle.id);
    });

    this.bscMevClient.on('error', (error) => {
      logger.error('BSC MEV client error', { error: error.message });
    });
  }

  private startOpportunityMonitoring(): void {
    logger.info('Starting opportunity monitoring...');
    
    // In a real implementation, this would:
    // 1. Monitor mempool for victim transactions
    // 2. Analyze transactions for sandwich opportunities
    // 3. Calculate profitability
    // 4. Submit bundles if profitable
    
    // For demonstration, we'll simulate opportunities
    if (!this.config.paperTradingMode) {
      logger.warn('Paper trading mode is disabled - real opportunities would be processed');
    }

    // Simulate finding opportunities every 5 seconds (for demo)
    setInterval(() => {
      this.simulateOpportunityDetection();
    }, 5000);
  }

  private async simulateOpportunityDetection(): Promise<void> {
    if (!this.isRunning || this.activeBundles.size >= this.config.maxConcurrentBundles) {
      return;
    }

    try {
      // Simulate finding an Ethereum opportunity
      if (this.flashbotsClient && Math.random() > 0.8) {
        const opportunity: SandwichOpportunity = {
          victimTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          victimTransaction: {
            to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            data: '0x',
            value: '0',
            gasLimit: 200000,
            gasPrice: ethers.parseUnits('30', 'gwei')
          },
          tokenIn: 'ETH',
          tokenOut: '0xA0b86a33E6417c7962A0FF7c4BfB9D8e95D5b9C9',
          amountIn: ethers.parseEther('1').toString(),
          expectedAmountOut: ethers.parseEther('2000').toString(),
          dexRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          gasPrice: '30',
          maxSlippage: 2,
          estimatedProfit: ethers.parseEther('0.02').toString(),
          profitability: 2.0
        };

        if (this.isProfitable(opportunity.estimatedProfit, 'ethereum')) {
          const bundle = await this.flashbotsClient.createSandwichBundle(opportunity);
          if (!this.config.paperTradingMode) {
            await this.flashbotsClient.submitBundle(bundle.id);
          } else {
            logger.info('Paper trading: Would submit Ethereum bundle', { bundleId: bundle.id });
          }
        }
      }

      // Simulate finding a BSC opportunity
      if (this.bscMevClient && Math.random() > 0.85) {
        const opportunity: BscSandwichOpportunity = {
          victimTxHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          victimTransaction: {
            to: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
            data: '0x',
            value: '0',
            gasLimit: 200000,
            gasPrice: ethers.parseUnits('5', 'gwei')
          },
          pancakeRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
          tokenA: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          tokenB: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
          amountIn: ethers.parseEther('0.5').toString(),
          expectedAmountOut: ethers.parseEther('1000').toString(),
          estimatedProfit: ethers.parseEther('0.05').toString(),
          gasPrice: '5',
          blockNumber: await this.bscProvider!.getBlockNumber()
        };

        if (this.isProfitable(opportunity.estimatedProfit, 'bsc')) {
          const bundle = await this.bscMevClient.createSandwichBundle(opportunity);
          if (!this.config.paperTradingMode) {
            await this.bscMevClient.submitBundle(bundle.id);
          } else {
            logger.info('Paper trading: Would submit BSC bundle', { bundleId: bundle.id });
          }
        }
      }

    } catch (error) {
      logger.error('Error in opportunity detection', { error: error instanceof Error ? error.message : error });
    }
  }

  private isProfitable(estimatedProfit: string, chain: keyof typeof this.config.minProfitThresholds): boolean {
    const profit = parseFloat(ethers.formatEther(estimatedProfit));
    const threshold = parseFloat(this.config.minProfitThresholds[chain]);
    return profit >= threshold;
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping MEV Sandwich Bot...');
      
      this.isRunning = false;

      // Wait for active bundles to complete or timeout
      const maxWaitTime = 60000; // 1 minute
      const startTime = Date.now();
      
      while (this.activeBundles.size > 0 && (Date.now() - startTime) < maxWaitTime) {
        logger.info(`Waiting for ${this.activeBundles.size} active bundles to complete...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Disconnect all clients
      if (this.flashbotsClient) {
        await this.flashbotsClient.disconnect();
      }
      if (this.jitoClient) {
        await this.jitoClient.disconnect();
      }
      if (this.bscMevClient) {
        await this.bscMevClient.disconnect();
      }

      logger.info('MEV Sandwich Bot stopped successfully');

    } catch (error) {
      logger.error('Error stopping MEV Sandwich Bot', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  getStatus(): {
    isRunning: boolean;
    enabledChains: string[];
    activeBundles: number;
    paperTradingMode: boolean;
    clientStatuses: {
      flashbots?: boolean;
      jito?: boolean;
      bscMev?: boolean;
    };
    performanceMetrics: any;
  } {
    const clientStatuses: any = {};
    const performanceMetrics: any = {};

    if (this.flashbotsClient) {
      clientStatuses.flashbots = this.flashbotsClient.isReady();
      performanceMetrics.flashbots = this.flashbotsClient.getPerformanceMetrics();
    }

    if (this.jitoClient) {
      clientStatuses.jito = this.jitoClient.isReady();
      performanceMetrics.jito = this.jitoClient.getPerformanceMetrics();
    }

    if (this.bscMevClient) {
      clientStatuses.bscMev = this.bscMevClient.isReady();
      performanceMetrics.bscMev = this.bscMevClient.getPerformanceMetrics();
    }

    return {
      isRunning: this.isRunning,
      enabledChains: this.config.enabledChains,
      activeBundles: this.activeBundles.size,
      paperTradingMode: this.config.paperTradingMode,
      clientStatuses,
      performanceMetrics
    };
  }

  async emergencyStop(): Promise<void> {
    logger.error('EMERGENCY STOP ACTIVATED');
    this.config.globalKillSwitch = true;
    await this.stop();
  }
}

// Main execution
async function main() {
  const bot = new MevSandwichBot();
  
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
    
    // Log status every minute
    setInterval(() => {
      const status = bot.getStatus();
      logger.info('Bot status', status);
    }, 60000);
    
  } catch (error) {
    logger.error('Failed to start MEV Sandwich Bot', { error: error instanceof Error ? error.message : error });
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

export { MevSandwichBot };