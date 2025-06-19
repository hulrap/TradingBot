import { CopyTraderBotConfig, Chain } from "@trading-bot/types";
import { createChainClient } from "@trading-bot/chain-client";
import { Wallet, WebSocketProvider, Interface, parseUnits } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import dotenv from 'dotenv';
import winston from 'winston';
import { ethers } from 'ethers';
import { MempoolMonitor, type MonitorConfig } from './mempool-monitor';
import { CopyExecutionEngine, type CopyConfig } from './copy-execution-engine';

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
    new winston.transports.File({ filename: 'copy-trader.log' })
  ]
});

// --- Configuration ---
const COPY_TRADE_CONFIG: CopyTraderBotConfig = {
  id: "1",
  userId: "user-123",
  walletId: "wallet-1",
  chain: "ETH" as Chain,
  targetWalletAddress: process.env['TARGET_WALLET_ADDRESS'] || "0x...", // IMPORTANT: Target wallet to copy
  tradeSize: {
    type: "FIXED",
    value: 0.1, // e.g., 0.1 ETH per trade
  },
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const CHAIN: Chain = (process.env['CHAIN'] as Chain) || "ETH";
const WEBSOCKET_RPC_URL = process.env['ETH_WEBSOCKET_RPC_URL']!; // IMPORTANT: Use a WSS RPC URL
const PRIVATE_KEY = process.env['PRIVATE_KEY']!;

const SOLANA_WEBSOCKET_RPC_URL = process.env['SOLANA_WEBSOCKET_RPC_URL']!;
const SOLANA_PRIVATE_KEY = process.env['SOLANA_PRIVATE_KEY']!;

// A common ABI for Uniswap V2-like routers
const UNISWAP_V2_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
];
const uniswapInterface = new Interface(UNISWAP_V2_ROUTER_ABI);

class CopyTradingBot {
  private mempoolMonitor: MempoolMonitor;
  private copyEngine: CopyExecutionEngine;
  private provider: ethers.JsonRpcProvider;
  private isRunning = false;

  constructor() {
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(
      process.env['ETH_RPC_URL'] || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key'
    );

    // Initialize mempool monitor
    const monitorConfig: MonitorConfig = {
      rpcUrl: process.env['ETH_RPC_URL'] || 'https://eth-mainnet.alchemyapi.io/v2/your-api-key',
      wsUrl: process.env['ETH_WS_URL'] || 'wss://eth-mainnet.alchemyapi.io/v2/your-api-key',
      targetWallets: process.env['TARGET_WALLETS']?.split(',') || [],
      dexRouters: [
        '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
        '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
        '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'  // SushiSwap
      ],
      minTransactionValue: process.env['MIN_TRANSACTION_VALUE'] || '0.1',
      maxGasPrice: process.env['MAX_GAS_PRICE'] || '100',
      enableDecoding: true,
      enableFiltering: true
    };

    this.mempoolMonitor = new MempoolMonitor(monitorConfig);

    // Initialize copy execution engine
    const copyConfig: CopyConfig = {
      targetWallet: process.env['TARGET_WALLET'] || '',
      copyPercentage: parseFloat(process.env['COPY_PERCENTAGE'] || '10'),
      maxTradeSize: process.env['MAX_TRADE_SIZE'] || '1.0',
      minTradeSize: process.env['MIN_TRADE_SIZE'] || '0.01',
      maxSlippage: parseFloat(process.env['MAX_SLIPPAGE'] || '2'),
      maxGasPrice: process.env['MAX_GAS_PRICE'] || '100',
      followTokens: process.env['FOLLOW_TOKENS']?.split(',') || [],
      excludeTokens: process.env['EXCLUDE_TOKENS']?.split(',') || [],
      copyDelay: parseInt(process.env['COPY_DELAY'] || '1000'),
      stopLoss: parseFloat(process.env['STOP_LOSS'] || '5'),
      takeProfit: parseFloat(process.env['TAKE_PROFIT'] || '10'),
      enableFiltering: process.env['ENABLE_FILTERING'] === 'true',
      enableRiskManagement: process.env['ENABLE_RISK_MANAGEMENT'] === 'true'
    };

    const privateKey = process.env['PRIVATE_KEY'];
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    this.copyEngine = new CopyExecutionEngine(copyConfig, this.provider, privateKey);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Mempool monitor events
    this.mempoolMonitor.on('connected', () => {
      logger.info('Mempool monitor connected');
    });

    this.mempoolMonitor.on('disconnected', (error) => {
      logger.warn('Mempool monitor disconnected', { error: error?.message });
    });

    this.mempoolMonitor.on('reconnected', () => {
      logger.info('Mempool monitor reconnected');
    });

    this.mempoolMonitor.on('targetWalletTransaction', async (tx) => {
      logger.info('Target wallet transaction detected', {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        isSwap: tx.decodedData?.isSwap
      });

      // Process the transaction with copy engine
      await this.copyEngine.processMempoolTransaction(tx);
    });

    this.mempoolMonitor.on('error', (error) => {
      logger.error('Mempool monitor error', { error: error.message });
    });

    // Copy engine events
    this.copyEngine.on('started', () => {
      logger.info('Copy execution engine started');
    });

    this.copyEngine.on('stopped', () => {
      logger.info('Copy execution engine stopped');
    });

    this.copyEngine.on('copyTradeCreated', (trade) => {
      logger.info('Copy trade created', {
        id: trade.id,
        originalTxHash: trade.originalTxHash,
        tokenIn: trade.tokenIn,
        tokenOut: trade.tokenOut,
        originalAmountIn: trade.originalAmountIn
      });
    });

    this.copyEngine.on('copyTradeExecuted', (trade) => {
      logger.info('Copy trade executed', {
        id: trade.id,
        copyTxHash: trade.copyTxHash,
        copyAmountIn: trade.copyAmountIn,
        gasPrice: trade.gasPrice
      });
    });

    this.copyEngine.on('copyTradeFailed', (trade) => {
      logger.warn('Copy trade failed', {
        id: trade.id,
        reason: trade.reason,
        originalTxHash: trade.originalTxHash
      });
    });

    this.copyEngine.on('copyTradeCancelled', (trade) => {
      logger.info('Copy trade cancelled', {
        id: trade.id,
        reason: trade.reason
      });
    });

    this.copyEngine.on('riskLimitExceeded', (reason) => {
      logger.warn('Risk limit exceeded', { reason });
      this.handleRiskLimit(reason);
    });

    this.copyEngine.on('emergencyStop', () => {
      logger.error('Emergency stop activated');
      this.stop();
    });

    this.copyEngine.on('metricsUpdated', (metrics) => {
      logger.info('Risk metrics updated', {
        totalCopied: metrics.totalCopied,
        successRate: metrics.successRate,
        netProfit: metrics.netProfit
      });
    });
  }

  private async handleRiskLimit(reason: string): Promise<void> {
    logger.warn('Handling risk limit violation', { reason });
    
    // Implement risk management actions
    switch (reason) {
      case 'Maximum drawdown exceeded':
        // Pause trading for 1 hour
        await this.pauseTrading(60 * 60 * 1000);
        break;
      
      case 'Success rate too low':
        // Reduce copy percentage
        const currentConfig = this.copyEngine.getConfig();
        const newPercentage = Math.max(currentConfig.copyPercentage * 0.5, 1);
        this.copyEngine.updateConfig({ copyPercentage: newPercentage });
        logger.info('Reduced copy percentage', { 
          old: currentConfig.copyPercentage, 
          new: newPercentage 
        });
        break;
      
      default:
        logger.warn('Unknown risk limit reason', { reason });
    }
  }

  private async pauseTrading(duration: number): Promise<void> {
    logger.info('Pausing trading', { durationMs: duration });
    
    await this.copyEngine.stop();
    
    setTimeout(async () => {
      logger.info('Resuming trading after pause');
      await this.copyEngine.start();
    }, duration);
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting copy trading bot...');
      
      // Validate configuration
      this.validateConfiguration();
      
      // Start components
      await this.mempoolMonitor.start();
      await this.copyEngine.start();
      
      this.isRunning = true;
      logger.info('Copy trading bot started successfully');
      
      // Log current configuration
      const config = this.copyEngine.getConfig();
      logger.info('Bot configuration', {
        targetWallet: config.targetWallet,
        copyPercentage: config.copyPercentage,
        maxTradeSize: config.maxTradeSize,
        minTradeSize: config.minTradeSize,
        maxSlippage: config.maxSlippage,
        followTokens: config.followTokens.length,
        excludeTokens: config.excludeTokens.length
      });
      
    } catch (error) {
      logger.error('Failed to start copy trading bot', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping copy trading bot...');
      
      this.isRunning = false;
      
      await this.copyEngine.stop();
      await this.mempoolMonitor.stop();
      
      logger.info('Copy trading bot stopped successfully');
      
    } catch (error) {
      logger.error('Error stopping copy trading bot', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  private validateConfiguration(): void {
    const config = this.copyEngine.getConfig();
    
    if (!config.targetWallet) {
      throw new Error('Target wallet address is required');
    }
    
    if (!ethers.isAddress(config.targetWallet)) {
      throw new Error('Invalid target wallet address');
    }
    
    if (config.copyPercentage <= 0 || config.copyPercentage > 100) {
      throw new Error('Copy percentage must be between 0 and 100');
    }
    
    if (parseFloat(config.maxTradeSize) <= parseFloat(config.minTradeSize)) {
      throw new Error('Max trade size must be greater than min trade size');
    }
    
    logger.info('Configuration validation passed');
  }

  getStatus(): {
    isRunning: boolean;
    mempoolConnected: boolean;
    copyEngineActive: boolean;
    riskMetrics: any;
    configuration: any;
  } {
    return {
      isRunning: this.isRunning,
      mempoolConnected: this.mempoolMonitor.getConnectionStatus(),
      copyEngineActive: this.copyEngine.isRunning(),
      riskMetrics: this.copyEngine.getRiskMetrics(),
      configuration: this.copyEngine.getConfig()
    };
  }

  // Public methods for external control
  async addTargetWallet(address: string): Promise<void> {
    this.mempoolMonitor.addTargetWallet(address);
    logger.info('Added target wallet', { address });
  }

  async removeTargetWallet(address: string): Promise<void> {
    this.mempoolMonitor.removeTargetWallet(address);
    logger.info('Removed target wallet', { address });
  }

  updateCopyConfig(config: Partial<CopyConfig>): void {
    this.copyEngine.updateConfig(config);
    logger.info('Updated copy configuration', config);
  }

  getCopyTrades(): any[] {
    return this.copyEngine.getCopyTrades();
  }

  clearHistory(): void {
    this.copyEngine.clearHistory();
    logger.info('Cleared copy trade history');
  }
}

// --- EVM Logic ---
async function startEvmCopyTrader() {
  if (!WEBSOCKET_RPC_URL || !PRIVATE_KEY) {
    throw new Error("Missing environment variables: ETH_WEBSOCKET_RPC_URL or PRIVATE_KEY");
  }

  console.log("🤖 Copy-trader bot starting...");
  console.log("Configuration:", COPY_TRADE_CONFIG);

  const provider = new WebSocketProvider(WEBSOCKET_RPC_URL);
  const chainClient = createChainClient(CHAIN, PRIVATE_KEY, WEBSOCKET_RPC_URL);
  const userWallet = new Wallet(PRIVATE_KEY, provider);

  // Initialize chain client for enhanced functionality
  const chainConfig = chainClient.getChainConfig(CHAIN.toLowerCase() as any);
  if (chainConfig) {
    console.log(`Chain client initialized for ${chainConfig.name} network`);
  } else {
    console.log(`Chain client initialized for ${CHAIN} network`);
  }
  console.log(`Monitoring target wallet: ${COPY_TRADE_CONFIG.targetWalletAddress}`);
  
  provider.on("pending", async (txHash: string) => {
    try {
      if (!txHash) return;
      const tx = await provider.getTransaction(txHash);
      if (tx && tx.from && tx.from.toLowerCase() === COPY_TRADE_CONFIG.targetWalletAddress.toLowerCase()) {
        
        console.log(`[${new Date().toISOString()}] Detected transaction from target: ${txHash}`);
        
        const decodedTx = uniswapInterface.parseTransaction({ data: tx.data, value: tx.value });

        if (decodedTx) {
            console.log(`   Action: ${decodedTx.name}`);
            console.log("   Replicating trade...");
            
            let tradeValue: bigint;
            if (COPY_TRADE_CONFIG.tradeSize.type === 'PERCENTAGE') {
                const percentage = BigInt(COPY_TRADE_CONFIG.tradeSize.value);
                tradeValue = (tx.value * percentage) / 100n;
            } else { // FIXED
                tradeValue = parseUnits(COPY_TRADE_CONFIG.tradeSize.value.toString(), "ether");
            }
            
            const newTx = {
                to: tx.to,
                gasLimit: tx.gasLimit,
                gasPrice: tx.gasPrice,
                data: tx.data,
                value: tradeValue,
            };

            const txResponse = await userWallet.sendTransaction(newTx);
            console.log(`🚀 Trade replicated! Transaction hash: ${txResponse.hash}`);
            await txResponse.wait();
            console.log("Replicated trade confirmed.");
        }
      }
    } catch (error) {
      // Errors are expected
    }
  });

  // Handle provider errors and disconnections
  provider.on("error", (error: any) => {
      console.error("Provider Error:", error);
  });

  provider.on("network", (newNetwork: any, oldNetwork: any) => {
      if (oldNetwork) {
          console.log(`Network changed from ${oldNetwork.chainId} to ${newNetwork.chainId}, attempting to reconnect...`);
          startEvmCopyTrader(); // Reconnect on network change
      }
  });
}

// --- Solana Logic ---
async function startSolanaCopyTrader() {
    if (!SOLANA_WEBSOCKET_RPC_URL || !SOLANA_PRIVATE_KEY) {
        throw new Error("Missing Solana environment variables");
    }
    console.log("🤖 Solana Copy-trader bot starting...");
    const connection = new Connection(SOLANA_WEBSOCKET_RPC_URL, 'confirmed');
    const targetWallet = new PublicKey(COPY_TRADE_CONFIG.targetWalletAddress);

    console.log(`Monitoring target wallet on Solana: ${targetWallet.toBase58()}`);

    connection.onLogs(
        targetWallet,
        (logs: any, context: any) => {
            const logMessages = logs.logs.join('\n');
            if (logMessages.includes("Instruction: Swap")) {
                console.log(`[${new Date().toISOString()}] Detected SWAP transaction from target: ${logs.signature}`);
                console.log(`   Slot: ${context.slot}, Confirmation: ${context.confirmation}`);
                console.log("   --> Solana trade replication logic would be implemented here <--");
            }
        },
        'confirmed'
    );
}

// --- Main Execution ---
async function main() {
    const chain: Chain = (process.env['CHAIN'] as Chain) || "ETH";

    if (chain === "ETH" || chain === "BSC") {
        await startEvmCopyTrader();
    } else if (chain === "SOL") {
        await startSolanaCopyTrader();
    } else {
        console.error(`Unsupported chain: ${chain}`);
        process.exit(1);
    }
}

main().catch(error => {
    console.error("Failed to start copy-trader:", error);
    process.exit(1);
});

// Run the bot
if (require.main === module) {
  (async () => {
    const bot = new CopyTradingBot();
    
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
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });

    try {
      await bot.start();
      
      // Keep the process running
      setInterval(() => {
        const status = bot.getStatus();
        logger.debug('Bot status check', status);
      }, 60000); // Log status every minute
      
    } catch (error) {
      logger.error('Failed to start bot', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  })();
}

export { CopyTradingBot }; 