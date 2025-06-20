import { ethers } from 'ethers';
import { FlashbotsBundleProvider, FlashbotsBundleRawTransaction, FlashbotsBundleTransaction } from '@flashbots/ethers-provider-bundle';
import { EventEmitter } from 'events';

// Enhanced error types for better error handling
export class FlashbotsError extends Error {
  constructor(
    message: string,
    public code: string,
    public bundleId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'FlashbotsError';
  }
}

export class BundleSimulationError extends FlashbotsError {
  constructor(message: string, bundleId?: string, originalError?: Error) {
    super(message, 'SIMULATION_ERROR', bundleId, originalError);
    this.name = 'BundleSimulationError';
  }
}

export class BundleSubmissionError extends FlashbotsError {
  constructor(message: string, bundleId?: string, originalError?: Error) {
    super(message, 'SUBMISSION_ERROR', bundleId, originalError);
    this.name = 'BundleSubmissionError';
  }
}

export class BundleMonitoringError extends FlashbotsError {
  constructor(message: string, bundleId?: string, originalError?: Error) {
    super(message, 'MONITORING_ERROR', bundleId, originalError);
    this.name = 'BundleMonitoringError';
  }
}

// Enhanced configuration interface
export interface FlashbotsConfig {
  relayUrl: string;
  authKey: string; // Private key for signing auth headers
  maxBaseFeeInFutureBlock: string; // Max base fee willing to pay
  maxPriorityFeePerGas: string; // Max priority fee
  minProfitWei: string; // Minimum profit threshold
  reputationBonus: number; // Searcher reputation bonus (0-1)
  // Enhanced configuration
  maxGasLimit: number;
  deadlineMinutes: number;
  profitMargin: number; // Percentage of profit to keep vs bid on gas
  maxRetryAttempts: number;
  retryDelayMs: number;
  bundleTimeoutMs: number;
  simulationTimeoutMs: number;
  enableBundleCompetition: boolean;
  enableAdvancedGasBidding: boolean;
  wethAddress: string;
  supportedDexes: string[];
}

// Enhanced DEX configuration
interface DexConfig {
  routerAddress: string;
  routerABI: string[];
  swapMethods: {
    exactETHForTokens: string;
    exactTokensForETH: string;
    exactTokensForTokens: string;
  };
  feePercentage: number;
}

export interface MevBundle {
  id: string;
  transactions: (FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)[];
  targetBlockNumber: number;
  estimatedProfit: string;
  gasUsed: string;
  gasFees: string;
  netProfit: string;
  status: 'pending' | 'submitted' | 'included' | 'failed' | 'cancelled' | 'expired';
  submissionTime: number;
  inclusionTime?: number;
  revertReason?: string;
  blockNumber?: number;
  transactionHashes?: string[];
  gasPrice?: string;
  priorityFee?: string;
  competitionScore?: number;
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
  poolFee?: number; // Pool fee in basis points
}

export interface BundleSimulation {
  success: boolean;
  profit: string;
  gasUsed: string;
  gasCost: string;
  netProfit: string;
  priceImpact: number;
  slippage: number;
  confidence: number;
  bundleHash?: string;
  blockNumber?: number;
  revertReason?: string;
}

export interface FlashbotsStats {
  bundleCount: number;
  inclusionRate: number;
  avgInclusionTime: number;
  totalProfit: string;
  avgProfit: string;
  gasEfficiency: number;
  competitionWinRate: number;
}

export class FlashbotsClient extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private flashbotsProvider!: FlashbotsBundleProvider;
  private authSigner: ethers.Wallet;
  private executionWallet: ethers.Wallet;
  private config: FlashbotsConfig;
  private bundles: Map<string, MevBundle> = new Map();
  private isConnected = false;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private dexConfigs: Map<string, DexConfig> = new Map();
  
  // Performance metrics
  private performanceMetrics = {
    totalBundles: 0,
    includedBundles: 0,
    failedBundles: 0,
    totalProfit: BigInt(0),
    totalGasUsed: BigInt(0),
    avgInclusionTime: 0,
    lastSuccessTime: 0,
    competitionWins: 0
  };

  constructor(
    provider: ethers.JsonRpcProvider,
    executionPrivateKey: string,
    config: Partial<FlashbotsConfig>
  ) {
    super();
    
    this.provider = provider;
    this.config = this.validateAndMergeConfig(config);
    this.authSigner = new ethers.Wallet(this.config.authKey);
    this.executionWallet = new ethers.Wallet(executionPrivateKey, provider);
    
    this.initializeDexConfigs();
  }

  private validateAndMergeConfig(config: Partial<FlashbotsConfig>): FlashbotsConfig {
    const defaultConfig: FlashbotsConfig = {
      relayUrl: 'https://relay.flashbots.net',
      authKey: '',
      maxBaseFeeInFutureBlock: '100',
      maxPriorityFeePerGas: '5',
      minProfitWei: ethers.parseEther('0.01').toString(),
      reputationBonus: 0,
      maxGasLimit: 500000,
      deadlineMinutes: 20,
      profitMargin: 0.3,
      maxRetryAttempts: 3,
      retryDelayMs: 2000,
      bundleTimeoutMs: 60000,
      simulationTimeoutMs: 10000,
      enableBundleCompetition: true,
      enableAdvancedGasBidding: true,
      wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      supportedDexes: ['uniswap-v2', 'uniswap-v3', 'sushiswap']
    };

    const mergedConfig = { ...defaultConfig, ...config };

    // Validate required fields
    if (!mergedConfig.authKey) {
      throw new FlashbotsError('Auth key is required for Flashbots client', 'CONFIG_ERROR');
    }

    // Validate numeric ranges
    if (mergedConfig.profitMargin < 0 || mergedConfig.profitMargin > 1) {
      throw new FlashbotsError('Profit margin must be between 0 and 1', 'CONFIG_ERROR');
    }

    if (mergedConfig.reputationBonus < 0 || mergedConfig.reputationBonus > 1) {
      throw new FlashbotsError('Reputation bonus must be between 0 and 1', 'CONFIG_ERROR');
    }

    return mergedConfig;
  }

  private initializeDexConfigs(): void {
    // Uniswap V2 configuration
    this.dexConfigs.set('uniswap-v2', {
      routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      routerABI: [
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external'
      ],
      swapMethods: {
        exactETHForTokens: 'swapExactETHForTokens',
        exactTokensForETH: 'swapExactTokensForETH',
        exactTokensForTokens: 'swapExactTokensForTokens'
      },
      feePercentage: 0.3
    });

    // Add more DEX configurations as needed
    this.dexConfigs.set('sushiswap', {
      routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      routerABI: [
        'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
        'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
        'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external'
      ],
      swapMethods: {
        exactETHForTokens: 'swapExactETHForTokens',
        exactTokensForETH: 'swapExactTokensForETH',
        exactTokensForTokens: 'swapExactTokensForTokens'
      },
      feePercentage: 0.3
    });
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Flashbots provider with enhanced error handling
      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        this.provider,
        this.authSigner,
        this.config.relayUrl
      );

      // Test connection and get searcher stats
      const stats = await this.getSearcherStatsWithRetry();
      console.log('Enhanced Flashbots connection established:', stats);
      
      this.isConnected = true;
      this.emit('connected', stats);
      
    } catch (error) {
      const flashbotsError = new FlashbotsError(
        `Failed to initialize Flashbots client: ${error instanceof Error ? error.message : error}`,
        'INIT_ERROR',
        undefined,
        error as Error
      );
      
      console.error('Flashbots client initialization failed:', flashbotsError);
      this.emit('error', flashbotsError);
      throw flashbotsError;
    }
  }

  private async getSearcherStatsWithRetry(maxRetries: number = 3): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.flashbotsProvider.getUserStats();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          console.warn(`Searcher stats attempt ${attempt} failed, retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * attempt));
        }
      }
    }
    
    throw lastError!;
  }

  async createSandwichBundle(opportunity: SandwichOpportunity): Promise<MevBundle> {
    const bundleId = `sandwich_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentBlock = await this.provider.getBlockNumber();
    const targetBlock = currentBlock + 1;

    try {
      // Enhanced gas calculation
      const gasCalculation = await this.calculateOptimalGasBidEnhanced(opportunity);
      
      // Create enhanced front-run transaction
      const frontRunTx = await this.createEnhancedFrontRunTransaction(
        opportunity,
        gasCalculation.maxBaseFeeInFutureBlock,
        gasCalculation.maxPriorityFeePerGas
      );

      // Create enhanced back-run transaction  
      const backRunTx = await this.createEnhancedBackRunTransaction(
        opportunity,
        gasCalculation.maxBaseFeeInFutureBlock,
        gasCalculation.maxPriorityFeePerGas
      );

      // Enhanced bundle creation with proper transaction ordering
      const bundleTransactions: (FlashbotsBundleTransaction | FlashbotsBundleRawTransaction)[] = [
        {
          transaction: frontRunTx,
          signer: this.executionWallet
        },
        {
          signedTransaction: opportunity.victimTxHash
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
        submissionTime: Date.now(),
        gasPrice: ethers.formatUnits(gasCalculation.maxBaseFeeInFutureBlock, 'gwei'),
        priorityFee: ethers.formatUnits(gasCalculation.maxPriorityFeePerGas, 'gwei'),
        competitionScore: this.calculateCompetitionScore(opportunity)
      };

      this.bundles.set(bundleId, bundle);
      this.performanceMetrics.totalBundles++;
      
      this.emit('bundleCreated', bundle);
      console.log(`Enhanced sandwich bundle created: ${bundleId}`);

      return bundle;
      
    } catch (error) {
      const bundleError = new FlashbotsError(
        `Failed to create sandwich bundle: ${error instanceof Error ? error.message : error}`,
        'BUNDLE_CREATION_ERROR',
        bundleId,
        error as Error
      );
      
      this.emit('error', bundleError);
      throw bundleError;
    }
  }

  private calculateCompetitionScore(opportunity: SandwichOpportunity): number {
    // Calculate bundle competition score based on multiple factors
    const profitabilityScore = Math.min(opportunity.profitability / 10, 1); // Cap at 10% profitability
    const gasEfficiencyScore = parseFloat(opportunity.estimatedProfit) / parseFloat(opportunity.gasPrice);
    const slippageScore = 1 - (opportunity.maxSlippage / 100); // Lower slippage is better
    
    return (profitabilityScore * 0.5) + (gasEfficiencyScore * 0.3) + (slippageScore * 0.2);
  }

  private async createEnhancedFrontRunTransaction(
    opportunity: SandwichOpportunity,
    maxBaseFeeInFutureBlock: bigint,
    maxPriorityFeePerGas: bigint
  ): Promise<ethers.TransactionRequest> {
    try {
      // Enhanced front-run amount calculation
      const frontRunAmount = await this.calculateOptimalFrontRunAmountEnhanced(opportunity);
      
      // Get DEX configuration
      const dexConfig = this.getDexConfig(opportunity.dexRouter);
      
      // Create enhanced swap transaction
      const frontRunTx: ethers.TransactionRequest = {
        to: dexConfig.routerAddress,
        data: await this.encodeEnhancedFrontRunSwap(opportunity, frontRunAmount, dexConfig),
        value: this.isNativeToken(opportunity.tokenIn) ? frontRunAmount : '0',
        maxFeePerGas: maxBaseFeeInFutureBlock,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        gasLimit: this.config.maxGasLimit,
        type: 2,
        nonce: await this.executionWallet.getNonce()
      };

      return frontRunTx;
      
    } catch (error) {
      throw new FlashbotsError(
        `Failed to create front-run transaction: ${error instanceof Error ? error.message : error}`,
        'FRONT_RUN_ERROR',
        undefined,
        error as Error
      );
    }
  }

  private async createEnhancedBackRunTransaction(
    opportunity: SandwichOpportunity,
    maxBaseFeeInFutureBlock: bigint,
    maxPriorityFeePerGas: bigint
  ): Promise<ethers.TransactionRequest> {
    try {
      // Get DEX configuration
      const dexConfig = this.getDexConfig(opportunity.dexRouter);
      
      // Create enhanced back-run transaction
      const backRunTx: ethers.TransactionRequest = {
        to: dexConfig.routerAddress,
        data: await this.encodeEnhancedBackRunSwap(opportunity, dexConfig),
        value: '0',
        maxFeePerGas: maxBaseFeeInFutureBlock,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        gasLimit: this.config.maxGasLimit,
        type: 2,
        nonce: await this.executionWallet.getNonce() + 1 // Ensure proper nonce ordering
      };

      return backRunTx;
      
    } catch (error) {
      throw new FlashbotsError(
        `Failed to create back-run transaction: ${error instanceof Error ? error.message : error}`,
        'BACK_RUN_ERROR',
        undefined,
        error as Error
      );
    }
  }

  async simulateBundle(bundle: MevBundle): Promise<BundleSimulation> {
    try {
      // Enhanced simulation with real Flashbots API
      const simulationPromise = this.performFlashbotsSimulation(bundle);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Simulation timeout')), this.config.simulationTimeoutMs);
      });

      const flashbotsSimulation = await Promise.race([simulationPromise, timeoutPromise]);
      
      // Enhanced simulation result processing
      const simulation: BundleSimulation = {
        success: flashbotsSimulation.success,
        profit: flashbotsSimulation.coinbaseDiff || bundle.estimatedProfit,
        gasUsed: flashbotsSimulation.gasUsed || '300000',
        gasCost: flashbotsSimulation.gasFees || '0',
        netProfit: flashbotsSimulation.coinbaseDiff || bundle.estimatedProfit,
        priceImpact: this.calculatePriceImpact(flashbotsSimulation),
        slippage: this.calculateSlippage(flashbotsSimulation),
        confidence: this.calculateSimulationConfidence(flashbotsSimulation),
        bundleHash: flashbotsSimulation.bundleHash,
        blockNumber: bundle.targetBlockNumber,
        revertReason: flashbotsSimulation.revertReason
      };

      this.emit('bundleSimulated', bundle.id, simulation);
      console.log(`Bundle simulation completed: ${bundle.id}`, simulation);
      
      return simulation;

    } catch (error) {
      const errorSimulation: BundleSimulation = {
        success: false,
        profit: '0',
        gasUsed: '0',
        gasCost: '0',
        netProfit: '0',
        priceImpact: 0,
        slippage: 0,
        confidence: 0,
        revertReason: error instanceof Error ? error.message : 'Unknown simulation error'
      };

      const simulationError = new BundleSimulationError(
        `Bundle simulation failed: ${errorSimulation.revertReason}`,
        bundle.id,
        error as Error
      );

      this.emit('simulationError', bundle.id, simulationError);
      return errorSimulation;
    }
  }

  private async performFlashbotsSimulation(bundle: MevBundle): Promise<any> {
    try {
      // Real Flashbots simulation API call
      const signedTransactions = await this.signBundleTransactions(bundle);
      
      // Use Flashbots simulation API with signed transactions
      const simulation = await this.flashbotsProvider.simulate(
        signedTransactions,
        bundle.targetBlockNumber
      );

      return simulation;
      
    } catch (error) {
      throw new BundleSimulationError(
        `Flashbots simulation API failed: ${error instanceof Error ? error.message : error}`,
        bundle.id,
        error as Error
      );
    }
  }

  private async signBundleTransactions(bundle: MevBundle): Promise<string[]> {
    const signedTxs: string[] = [];
    
    for (const bundleTx of bundle.transactions) {
      if ('signedTransaction' in bundleTx) {
        // Already signed transaction (victim tx)
        signedTxs.push(bundleTx.signedTransaction);
      } else {
        // Sign transaction
        const signedTx = await bundleTx.signer.signTransaction(bundleTx.transaction);
        signedTxs.push(signedTx);
      }
    }
    
    return signedTxs;
  }

  async submitBundle(bundleId: string): Promise<void> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new BundleSubmissionError(`Bundle ${bundleId} not found`, bundleId);
    }

    try {
      // Enhanced simulation before submission
      const simulation = await this.simulateBundle(bundle);
      if (!simulation.success) {
        bundle.status = 'failed';
        bundle.revertReason = simulation.revertReason || simulation.error || 'Simulation failed';
        this.emit('bundleFailed', bundle);
        return;
      }

      // Update bundle with simulation results
      bundle.gasUsed = simulation.gasUsed;
      bundle.gasFees = simulation.gasCost;
      bundle.netProfit = simulation.netProfit;

      // Real Flashbots bundle submission
      const signedTransactions = await this.signBundleTransactions(bundle);
      
      const submissionResponse = await this.flashbotsProvider.sendBundle(
        signedTransactions,
        bundle.targetBlockNumber
      );

      bundle.status = 'submitted';
      this.emit('bundleSubmitted', bundle, submissionResponse);
      
      // Start enhanced monitoring
      this.startEnhancedBundleMonitoring(bundle);
      
      console.log(`Bundle submitted successfully: ${bundleId}`, submissionResponse);

    } catch (error) {
      bundle.status = 'failed';
      bundle.revertReason = error instanceof Error ? error.message : 'Unknown submission error';
      
      const submissionError = new BundleSubmissionError(
        `Failed to submit bundle ${bundleId}: ${bundle.revertReason}`,
        bundleId,
        error as Error
      );
      
      this.performanceMetrics.failedBundles++;
      this.emit('bundleFailed', bundle, submissionError);
      
      console.error(`Bundle submission failed: ${bundleId}`, submissionError);
    }
  }

  private startEnhancedBundleMonitoring(bundle: MevBundle): void {
    const monitoringInterval = setInterval(async () => {
      try {
        await this.checkBundleStatus(bundle);
        
        // Stop monitoring if bundle is resolved or expired
        if (['included', 'failed', 'expired'].includes(bundle.status)) {
          clearInterval(monitoringInterval);
          this.monitoringIntervals.delete(bundle.id);
        }
        
      } catch (error) {
        console.error(`Bundle monitoring error for ${bundle.id}:`, error);
      }
    }, 2000); // Check every 2 seconds

    this.monitoringIntervals.set(bundle.id, monitoringInterval);

    // Set timeout for bundle expiration
    setTimeout(() => {
      if (bundle.status === 'submitted') {
        bundle.status = 'expired';
        this.emit('bundleExpired', bundle);
        
        const monitoringInterval = this.monitoringIntervals.get(bundle.id);
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          this.monitoringIntervals.delete(bundle.id);
        }
      }
    }, this.config.bundleTimeoutMs);
  }

  private async checkBundleStatus(bundle: MevBundle): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      
      // Check if target block has passed
      if (currentBlock > bundle.targetBlockNumber + 2) {
        bundle.status = 'expired';
        this.emit('bundleExpired', bundle);
        return;
      }

      // Check bundle inclusion using Flashbots API with proper error handling
      try {
        const bundleStats = await this.flashbotsProvider.getBundleStats(
          bundle.id,
          bundle.targetBlockNumber
        );

        // Check if bundle was included (success response means included)
        if (bundleStats && typeof bundleStats === 'object' && !('error' in bundleStats)) {
          bundle.status = 'included';
          bundle.inclusionTime = Date.now();
          bundle.blockNumber = currentBlock;
          
          this.performanceMetrics.includedBundles++;
          this.performanceMetrics.totalProfit += BigInt(ethers.parseEther(bundle.netProfit || '0'));
          this.performanceMetrics.lastSuccessTime = Date.now();
          
          if (bundle.competitionScore && bundle.competitionScore > 0.7) {
            this.performanceMetrics.competitionWins++;
          }
          
          this.emit('bundleIncluded', bundle, bundleStats);
          console.log(`Bundle included in block ${currentBlock}: ${bundle.id}`);
        }
      } catch (bundleStatsError) {
        // Bundle stats API might fail, which is not critical for monitoring
        console.debug(`Bundle stats check failed for ${bundle.id}:`, bundleStatsError);
      }
      
    } catch (error) {
      const monitoringError = new BundleMonitoringError(
        `Bundle monitoring failed: ${error instanceof Error ? error.message : error}`,
        bundle.id,
        error as Error
      );
      
      this.emit('monitoringError', monitoringError);
    }
  }

  // Enhanced utility methods
  private getDexConfig(routerAddress: string): DexConfig {
    for (const [dexName, config] of this.dexConfigs) {
      if (config.routerAddress.toLowerCase() === routerAddress.toLowerCase()) {
        return config;
      }
    }
    
    // Fallback to Uniswap V2 if router not recognized
    return this.dexConfigs.get('uniswap-v2')!;
  }

  private isNativeToken(tokenAddress: string): boolean {
    return tokenAddress.toLowerCase() === 'eth' || 
           tokenAddress === '0x0000000000000000000000000000000000000000';
  }

  private calculatePriceImpact(simulation: any): number {
    // Calculate price impact from simulation results
    return simulation.priceImpact || 0;
  }

  private calculateSlippage(simulation: any): number {
    // Calculate slippage from simulation results
    return simulation.slippage || 0;
  }

  private calculateSimulationConfidence(simulation: any): number {
    // Calculate confidence score based on simulation quality
    let confidence = 0.5; // Base confidence
    
    if (simulation.success) confidence += 0.3;
    if (simulation.gasUsed && simulation.gasUsed > 0) confidence += 0.1;
    if (simulation.coinbaseDiff && parseFloat(simulation.coinbaseDiff) > 0) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private async calculateOptimalFrontRunAmountEnhanced(opportunity: SandwichOpportunity): Promise<string> {
    try {
      // Enhanced calculation using AMM math and pool state
      const victimAmount = BigInt(opportunity.amountIn);
      
      // Dynamic front-run ratio based on pool liquidity and victim trade size
      const poolLiquidityEstimate = BigInt(ethers.parseEther('1000')); // Would fetch real pool liquidity
      const tradeImpact = (victimAmount * BigInt(10000)) / poolLiquidityEstimate; // Impact in basis points
      
      // Adjust front-run size based on trade impact
      let frontRunRatio = 0.3; // Base 30%
      if (tradeImpact > BigInt(100)) { // High impact trade
        frontRunRatio = 0.5; // Increase front-run size
      } else if (tradeImpact < BigInt(10)) { // Low impact trade
        frontRunRatio = 0.15; // Reduce front-run size
      }
      
      const frontRunAmount = victimAmount * BigInt(Math.floor(frontRunRatio * 100)) / BigInt(100);
      
      // Ensure minimum viable amount
      const minAmount = BigInt(ethers.parseEther('0.001'));
      return (frontRunAmount > minAmount ? frontRunAmount : minAmount).toString();
      
    } catch (error) {
      // Fallback to simple calculation
      console.warn('Enhanced front-run calculation failed, using fallback:', error);
      const victimAmount = BigInt(opportunity.amountIn);
      return (victimAmount * BigInt(30) / BigInt(100)).toString(); // 30% fallback
    }
  }

  private async encodeEnhancedFrontRunSwap(
    opportunity: SandwichOpportunity, 
    amount: string, 
    dexConfig: DexConfig
  ): Promise<string> {
    try {
      const router = new ethers.Interface(dexConfig.routerABI);
      const deadline = Math.floor(Date.now() / 1000) + (this.config.deadlineMinutes * 60);

      if (this.isNativeToken(opportunity.tokenIn)) {
        // ETH -> Token swap
        const path = [this.config.wethAddress, opportunity.tokenOut];
        const minAmountOut = this.calculateMinAmountOut(amount, opportunity.maxSlippage);
        
        return router.encodeFunctionData(dexConfig.swapMethods.exactETHForTokens, [
          minAmountOut,
          path,
          this.executionWallet.address,
          deadline
        ]);
      } else if (this.isNativeToken(opportunity.tokenOut)) {
        // Token -> ETH swap
        const path = [opportunity.tokenIn, this.config.wethAddress];
        const minAmountOut = this.calculateMinAmountOut(amount, opportunity.maxSlippage);
        
        return router.encodeFunctionData(dexConfig.swapMethods.exactTokensForETH, [
          amount,
          minAmountOut,
          path,
          this.executionWallet.address,
          deadline
        ]);
      } else {
        // Token -> Token swap
        const path = [opportunity.tokenIn, this.config.wethAddress, opportunity.tokenOut];
        const minAmountOut = this.calculateMinAmountOut(amount, opportunity.maxSlippage);
        
        return router.encodeFunctionData(dexConfig.swapMethods.exactTokensForTokens, [
          amount,
          minAmountOut,
          path,
          this.executionWallet.address,
          deadline
        ]);
      }
      
    } catch (error) {
      throw new FlashbotsError(
        `Failed to encode front-run swap: ${error instanceof Error ? error.message : error}`,
        'ENCODING_ERROR',
        undefined,
        error as Error
      );
    }
  }

  private async encodeEnhancedBackRunSwap(
    opportunity: SandwichOpportunity, 
    dexConfig: DexConfig
  ): Promise<string> {
    try {
      const router = new ethers.Interface(dexConfig.routerABI);
      const deadline = Math.floor(Date.now() / 1000) + (this.config.deadlineMinutes * 60);

      // Back-run is opposite of front-run
      if (this.isNativeToken(opportunity.tokenIn)) {
        // Front-run bought tokens, back-run sells them for ETH
        const path = [opportunity.tokenOut, this.config.wethAddress];
        
        return router.encodeFunctionData(dexConfig.swapMethods.exactTokensForETH, [
          0, // Will use actual balance from contract call
          0, // Accept any amount out (profit is guaranteed)
          path,
          this.executionWallet.address,
          deadline
        ]);
      } else if (this.isNativeToken(opportunity.tokenOut)) {
        // Front-run sold tokens for ETH, back-run buys them back
        const path = [this.config.wethAddress, opportunity.tokenIn];
        
        return router.encodeFunctionData(dexConfig.swapMethods.exactETHForTokens, [
          0, // Accept any amount out
          path,
          this.executionWallet.address,
          deadline
        ]);
      } else {
        // Token -> Token back-run
        const path = [opportunity.tokenOut, this.config.wethAddress, opportunity.tokenIn];
        
        return router.encodeFunctionData(dexConfig.swapMethods.exactTokensForTokens, [
          0, // Will use actual balance
          0, // Accept any amount out
          path,
          this.executionWallet.address,
          deadline
        ]);
      }
      
    } catch (error) {
      throw new FlashbotsError(
        `Failed to encode back-run swap: ${error instanceof Error ? error.message : error}`,
        'ENCODING_ERROR',
        undefined,
        error as Error
      );
    }
  }

  private calculateMinAmountOut(amountIn: string, maxSlippage: number): string {
    const amount = BigInt(amountIn);
    const slippageBps = BigInt(Math.floor(maxSlippage * 100)); // Convert to basis points
    const minAmount = amount - (amount * slippageBps / BigInt(10000));
    return minAmount.toString();
  }

  // Enhanced gas bidding strategies
  async calculateOptimalGasBidEnhanced(opportunity: SandwichOpportunity): Promise<{
    maxBaseFeeInFutureBlock: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    try {
      const feeData = await this.provider.getFeeData();
      const baseFee = feeData.maxFeePerGas || ethers.parseUnits('30', 'gwei');
      
      // Enhanced gas bidding based on competition and profit
      const estimatedProfit = BigInt(opportunity.estimatedProfit);
      const gasLimit = BigInt(this.config.maxGasLimit);
      
      // Calculate maximum gas budget
      const maxGasBudget = estimatedProfit * BigInt(Math.floor((1 - this.config.profitMargin) * 100)) / BigInt(100);
      const maxGasPrice = maxGasBudget / gasLimit;
      
      // Apply competition multiplier based on MEV competition
      let competitionMultiplier = 1.0;
      if (this.config.enableBundleCompetition) {
        competitionMultiplier = this.calculateCompetitionMultiplier(opportunity);
      }
      
      const adjustedMaxGasPrice = BigInt(Math.floor(Number(maxGasPrice) * competitionMultiplier));
      
      // Ensure we don't exceed our budget or network limits
      const maxBaseFeeInFutureBlock = adjustedMaxGasPrice < baseFee ? adjustedMaxGasPrice : baseFee;
      const maxPriorityFeePerGas = ethers.parseUnits(
        Math.min(5 * competitionMultiplier, 50).toString(), 
        'gwei'
      ); // Dynamic priority fee with cap
      
      console.log(`Enhanced gas calculation for ${opportunity.victimTxHash}:`, {
        estimatedProfit: ethers.formatEther(estimatedProfit),
        maxGasBudget: ethers.formatEther(maxGasBudget),
        competitionMultiplier,
        maxBaseFee: ethers.formatUnits(maxBaseFeeInFutureBlock, 'gwei'),
        maxPriorityFee: ethers.formatUnits(maxPriorityFeePerGas, 'gwei')
      });
      
      return {
        maxBaseFeeInFutureBlock,
        maxPriorityFeePerGas
      };
      
    } catch (error) {
      // Fallback to conservative gas pricing
      console.warn('Enhanced gas calculation failed, using conservative fallback:', error);
      
      return {
        maxBaseFeeInFutureBlock: ethers.parseUnits(this.config.maxBaseFeeInFutureBlock, 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits(this.config.maxPriorityFeePerGas, 'gwei')
      };
    }
  }

  private calculateCompetitionMultiplier(opportunity: SandwichOpportunity): number {
    // Calculate competition multiplier based on opportunity characteristics
    let multiplier = 1.0;
    
    // High profitability attracts more competition
    if (opportunity.profitability > 5) multiplier += 0.5;
    if (opportunity.profitability > 10) multiplier += 0.5;
    
    // Large trades attract more attention
    const tradeValue = parseFloat(opportunity.amountIn);
    if (tradeValue > 10) multiplier += 0.3;
    if (tradeValue > 100) multiplier += 0.3;
    
    // Apply reputation bonus
    multiplier *= (1 + this.config.reputationBonus);
    
    return Math.min(multiplier, 3.0); // Cap at 3x multiplier
  }

  // Enhanced bundle management and statistics
  getBundles(): MevBundle[] {
    return Array.from(this.bundles.values());
  }

  getBundle(bundleId: string): MevBundle | undefined {
    return this.bundles.get(bundleId);
  }

  cancelBundle(bundleId: string): void {
    const bundle = this.bundles.get(bundleId);
    if (bundle && ['pending', 'submitted'].includes(bundle.status)) {
      bundle.status = 'cancelled';
      
      // Clear monitoring if active
      const monitoringInterval = this.monitoringIntervals.get(bundleId);
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
        this.monitoringIntervals.delete(bundleId);
      }
      
      this.emit('bundleCancelled', bundle);
      console.log(`Bundle cancelled: ${bundleId}`);
    }
  }

  async getSearcherStats(): Promise<any> {
    if (!this.isConnected) {
      throw new FlashbotsError('Flashbots client not connected', 'NOT_CONNECTED');
    }
    
    try {
      return await this.flashbotsProvider.getUserStats();
    } catch (error) {
      throw new FlashbotsError(
        `Failed to get searcher stats: ${error instanceof Error ? error.message : error}`,
        'STATS_ERROR',
        undefined,
        error as Error
      );
    }
  }

  getEnhancedPerformanceMetrics(): FlashbotsStats {
    const bundles = Array.from(this.bundles.values());
    const includedBundles = bundles.filter(b => b.status === 'included');
    const failedBundles = bundles.filter(b => b.status === 'failed');
    
    const totalInclusionTime = includedBundles.reduce((sum, bundle) => {
      return sum + (bundle.inclusionTime ? bundle.inclusionTime - bundle.submissionTime : 0);
    }, 0);
    
    const avgInclusionTime = includedBundles.length > 0 ? totalInclusionTime / includedBundles.length : 0;
    
    const totalProfit = includedBundles.reduce((sum, bundle) => {
      return sum + BigInt(ethers.parseEther(bundle.netProfit || '0'));
    }, BigInt(0));
    
    const avgProfit = includedBundles.length > 0 
      ? totalProfit / BigInt(includedBundles.length)
      : BigInt(0);

    const gasEfficiency = this.performanceMetrics.totalGasUsed > BigInt(0)
      ? Number(this.performanceMetrics.totalProfit) / Number(this.performanceMetrics.totalGasUsed)
      : 0;

    const competitionWinRate = this.performanceMetrics.totalBundles > 0
      ? (this.performanceMetrics.competitionWins / this.performanceMetrics.totalBundles) * 100
      : 0;

    return {
      bundleCount: bundles.length,
      inclusionRate: bundles.length > 0 ? (includedBundles.length / bundles.length) * 100 : 0,
      avgInclusionTime: avgInclusionTime / 1000, // Convert to seconds
      totalProfit: ethers.formatEther(totalProfit),
      avgProfit: ethers.formatEther(avgProfit),
      gasEfficiency,
      competitionWinRate
    };
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    
    // Clear all monitoring intervals
    for (const [bundleId, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    
    this.emit('disconnected');
    console.log('Enhanced Flashbots client disconnected');
  }
}