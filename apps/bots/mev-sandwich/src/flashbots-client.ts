import { ethers } from 'ethers';
import { FlashbotsBundleProvider, FlashbotsBundleRawTransaction, FlashbotsBundleTransaction } from '@flashbots/ethers-provider-bundle';
import { EventEmitter } from 'events';

export interface FlashbotsConfig {
  relayUrl: string;
  authKey: string; // Private key for signing auth headers
  maxBaseFeeInFutureBlock: string; // Max base fee willing to pay
  maxPriorityFeePerGas: string; // Max priority fee
  minProfitWei: string; // Minimum profit threshold
  reputationBonus: number; // Searcher reputation bonus (0-1)
}

export interface MevBundle {
  id: string;
  transactions: (FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)[];
  targetBlockNumber: number;
  estimatedProfit: string;
  gasUsed: string;
  gasFees: string;
  netProfit: string;
  status: 'pending' | 'included' | 'failed' | 'cancelled';
  submissionTime: number;
  inclusionTime?: number;
  revertReason?: string;
}

export interface SandwichOpportunity {
  victimTxHash: string;
  victimTransaction: ethers.TransactionRequest;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut: string;
  dexRouter: string;
  gasPrice: string;
  maxSlippage: number;
  estimatedProfit: string;
  profitability: number; // Profit as % of trade value
}

export interface BundleSimulation {
  success: boolean;
  profit: string;
  gasUsed: string;
  gasCost: string;
  netProfit: string;
  revertReason?: string;
  error?: string;
}

export class FlashbotsClient extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private flashbotsProvider!: FlashbotsBundleProvider; // Use definite assignment assertion
  private authSigner: ethers.Wallet;
  private executionWallet: ethers.Wallet;
  private config: FlashbotsConfig;
  private bundles: Map<string, MevBundle> = new Map();
  private isConnected = false;

  constructor(
    provider: ethers.JsonRpcProvider,
    executionPrivateKey: string,
    config: FlashbotsConfig
  ) {
    super();
    this.provider = provider;
    this.config = config;
    this.authSigner = new ethers.Wallet(config.authKey);
    this.executionWallet = new ethers.Wallet(executionPrivateKey, provider);
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Flashbots provider
      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        this.provider,
        this.authSigner,
        this.config.relayUrl
      );

      // Test connection
      const stats = await this.flashbotsProvider.getUserStats();
      console.log('Flashbots connection established:', stats);
      
      this.isConnected = true;
      this.emit('connected', stats);
    } catch (error) {
      console.error('Failed to initialize Flashbots client:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async createSandwichBundle(opportunity: SandwichOpportunity): Promise<MevBundle> {
    const bundleId = `sandwich_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentBlock = await this.provider.getBlockNumber();
    const targetBlock = currentBlock + 1;

    // Get current gas fees
    const feeData = await this.provider.getFeeData();
    const maxBaseFeeInFutureBlock = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');

    // Create front-run transaction
    const frontRunTx = await this.createFrontRunTransaction(
      opportunity,
      maxBaseFeeInFutureBlock,
      maxPriorityFeePerGas
    );

    // Create back-run transaction  
    const backRunTx = await this.createBackRunTransaction(
      opportunity,
      maxBaseFeeInFutureBlock,
      maxPriorityFeePerGas
    );

    // Bundle: [front-run, victim tx, back-run]
    const bundleTransactions: (FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)[] = [
      {
        transaction: frontRunTx,
        signer: this.executionWallet
      },
      {
        signedTransaction: opportunity.victimTxHash // Use the raw signed transaction
      },
      {
        transaction: backRunTx,
        signer: this.executionWallet
      }
    ];

    const bundle: MevBundle = {
      id: bundleId,
      transactions: bundleTransactions,
      targetBlockNumber: targetBlock,
      estimatedProfit: opportunity.estimatedProfit,
      gasUsed: '0',
      gasFees: '0',
      netProfit: '0',
      status: 'pending',
      submissionTime: Date.now()
    };

    this.bundles.set(bundleId, bundle);
    this.emit('bundleCreated', bundle);

    return bundle;
  }

  private async createFrontRunTransaction(
    opportunity: SandwichOpportunity,
    maxBaseFeeInFutureBlock: bigint,
    maxPriorityFeePerGas: bigint
  ): Promise<ethers.TransactionRequest> {
    // Calculate front-run amount (should be significant enough to move price)
    const frontRunAmount = await this.calculateOptimalFrontRunAmount(opportunity);
    
    // Create swap transaction to push price up before victim
    const frontRunTx: ethers.TransactionRequest = {
      to: opportunity.dexRouter,
      data: await this.encodeFrontRunSwap(opportunity, frontRunAmount),
      value: opportunity.tokenIn === 'ETH' ? frontRunAmount : '0',
      maxFeePerGas: maxBaseFeeInFutureBlock,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      gasLimit: 300000,
      type: 2
    };

    return frontRunTx;
  }

  private async createBackRunTransaction(
    opportunity: SandwichOpportunity,
    maxBaseFeeInFutureBlock: bigint,
    maxPriorityFeePerGas: bigint
  ): Promise<ethers.TransactionRequest> {
    // Back-run sells the tokens bought in front-run at higher price
    const backRunTx: ethers.TransactionRequest = {
      to: opportunity.dexRouter,
      data: await this.encodeBackRunSwap(opportunity),
      value: '0',
      maxFeePerGas: maxBaseFeeInFutureBlock,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      gasLimit: 300000,
      type: 2
    };

    return backRunTx;
  }

  async simulateBundle(bundle: MevBundle): Promise<BundleSimulation> {
    try {
      // For now, return a simplified simulation result
      // In production, this would use proper Flashbots simulation
      const simulationResult: BundleSimulation = {
        success: true,
        profit: bundle.estimatedProfit,
        gasUsed: '300000',
        gasCost: ethers.formatEther(BigInt(300000) * ethers.parseUnits('30', 'gwei')),
        netProfit: bundle.estimatedProfit,
      };

      this.emit('bundleSimulated', bundle.id, simulationResult);
      return simulationResult;

    } catch (error) {
      const errorResult: BundleSimulation = {
        success: false,
        profit: '0',
        gasUsed: '0',
        gasCost: '0',
        netProfit: '0',
        error: error instanceof Error ? error.message : 'Unknown simulation error'
      };

      this.emit('simulationError', bundle.id, errorResult);
      return errorResult;
    }
  }

  async submitBundle(bundleId: string): Promise<void> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    try {
      // Simulate first to ensure profitability
      const simulation = await this.simulateBundle(bundle);
      if (!simulation.success) {
        bundle.status = 'failed';
        bundle.revertReason = simulation.revertReason || simulation.error || 'Unknown simulation error';
        this.emit('bundleFailed', bundle);
        return;
      }

      // Update bundle with simulation results
      bundle.gasUsed = simulation.gasUsed;
      bundle.gasFees = simulation.gasCost;
      bundle.netProfit = simulation.netProfit;

      // Submit bundle to Flashbots (simplified for now)
      this.emit('bundleSubmitted', bundle);

      // Simulate bundle inclusion for now
      setTimeout(() => {
        bundle.status = 'included';
        bundle.inclusionTime = Date.now();
        this.emit('bundleIncluded', bundle);
      }, 12000); // Simulate 12 second block time

    } catch (error) {
      bundle.status = 'failed';
      bundle.revertReason = error instanceof Error ? error.message : 'Unknown error';
      this.emit('bundleFailed', bundle);
      console.error(`Failed to submit bundle ${bundleId}:`, error);
    }
  }

  private async calculateOptimalFrontRunAmount(opportunity: SandwichOpportunity): Promise<string> {
    // Simplified calculation - in production, this would use AMM math
    // to calculate optimal amount that maximizes profit
    const victimAmount = BigInt(opportunity.amountIn);
    const frontRunRatio = 0.3; // Front-run with 30% of victim's trade size
    const frontRunAmount = victimAmount * BigInt(Math.floor(frontRunRatio * 100)) / BigInt(100);
    
    return frontRunAmount.toString();
  }

  private async encodeFrontRunSwap(opportunity: SandwichOpportunity, amount: string): Promise<string> {
    // Encode Uniswap V2/V3 swap for front-running
    // This is simplified - production would handle different DEX types
    const routerABI = [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external'
    ];

    const router = new ethers.Interface(routerABI);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    if (opportunity.tokenIn === 'ETH') {
      const path = ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', opportunity.tokenOut]; // WETH -> Token
      return router.encodeFunctionData('swapExactETHForTokens', [
        0, // Accept any amount out (will calculate properly in production)
        path,
        this.executionWallet.address,
        deadline
      ]);
    } else {
      const path = [opportunity.tokenIn, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2']; // Token -> WETH
      return router.encodeFunctionData('swapExactTokensForETH', [
        amount,
        0,
        path,
        this.executionWallet.address,
        deadline
      ]);
    }
  }

  private async encodeBackRunSwap(opportunity: SandwichOpportunity): Promise<string> {
    // Encode the reverse swap to capture profit
    const routerABI = [
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable'
    ];

    const router = new ethers.Interface(routerABI);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    // Back-run is opposite of front-run
    if (opportunity.tokenIn === 'ETH') {
      // Front-run bought tokens, back-run sells them
      const path = [opportunity.tokenOut, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'];
      return router.encodeFunctionData('swapExactTokensForETH', [
        0, // Will use actual balance (calculated in production)
        0,
        path,
        this.executionWallet.address,
        deadline
      ]);
    } else {
      // Front-run sold tokens for ETH, back-run buys them back
      const path = ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', opportunity.tokenIn];
      return router.encodeFunctionData('swapExactETHForTokens', [
        0,
        path,
        this.executionWallet.address,
        deadline
      ]);
    }
  }

  // Gas bidding strategies
  async calculateOptimalGasBid(opportunity: SandwichOpportunity): Promise<{
    maxBaseFeeInFutureBlock: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    const feeData = await this.provider.getFeeData();
    const baseFee = feeData.maxFeePerGas || ethers.parseUnits('30', 'gwei');
    
    // Calculate optimal bid based on opportunity profit
    const estimatedProfit = BigInt(opportunity.estimatedProfit);
    const profitMargin = 0.3; // Keep 30% of profit, bid up to 70%
    const maxGasBudget = estimatedProfit * BigInt(Math.floor((1 - profitMargin) * 100)) / BigInt(100);
    
    // Gas bid should not exceed our budget
    const maxBaseFeeInFutureBlock = baseFee < maxGasBudget ? baseFee : maxGasBudget;
    const maxPriorityFeePerGas = ethers.parseUnits('5', 'gwei'); // Conservative priority fee
    
    return {
      maxBaseFeeInFutureBlock,
      maxPriorityFeePerGas
    };
  }

  // Bundle management
  getBundles(): MevBundle[] {
    return Array.from(this.bundles.values());
  }

  getBundle(bundleId: string): MevBundle | undefined {
    return this.bundles.get(bundleId);
  }

  cancelBundle(bundleId: string): void {
    const bundle = this.bundles.get(bundleId);
    if (bundle && bundle.status === 'pending') {
      bundle.status = 'cancelled';
      this.emit('bundleCancelled', bundle);
    }
  }

  // Statistics and monitoring
  async getSearcherStats(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Flashbots client not connected');
    }
    
    return await this.flashbotsProvider.getUserStats();
  }

  getPerformanceMetrics(): {
    totalBundles: number;
    includedBundles: number;
    failedBundles: number;
    inclusionRate: number;
    totalProfit: string;
    averageProfit: string;
  } {
    const bundles = Array.from(this.bundles.values());
    const includedBundles = bundles.filter(b => b.status === 'included');
    const failedBundles = bundles.filter(b => b.status === 'failed');
    
    const totalProfit = includedBundles.reduce((sum, bundle) => {
      return sum + BigInt(ethers.parseEther(bundle.netProfit || '0'));
    }, BigInt(0));
    
    const averageProfit = includedBundles.length > 0 
      ? totalProfit / BigInt(includedBundles.length)
      : BigInt(0);

    return {
      totalBundles: bundles.length,
      includedBundles: includedBundles.length,
      failedBundles: failedBundles.length,
      inclusionRate: bundles.length > 0 ? (includedBundles.length / bundles.length) * 100 : 0,
      totalProfit: ethers.formatEther(totalProfit),
      averageProfit: ethers.formatEther(averageProfit)
    };
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.emit('disconnected');
  }
}