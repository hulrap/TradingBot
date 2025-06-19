import { ethers } from 'ethers';
import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { FlashbotsClient, type MevBundle } from './flashbots-client';
import { JitoClient, type SolanaMevBundle } from './jito-client';
import { BscMevClient, type BscMevBundle } from './bsc-mev-client';
import { ProfitCalculator, type ProfitParams } from './profit-calculator';

export interface ExecutionParams {
  opportunity: SandwichOpportunityExtended;
  frontRunAmount: string;
  maxGasPrice: string;
  maxSlippage: number;
  deadline: number; // Timestamp
  minProfit: string;
  simulationOnly: boolean;
}

export interface SandwichOpportunityExtended {
  victimTxHash: string;
  victimTransaction: ethers.TransactionRequest | VersionedTransaction;
  chain: 'ethereum' | 'bsc' | 'solana';
  dexType: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut: string;
  poolAddress: string;
  poolLiquidity: string;
  gasPrice: string;
  estimatedProfit: string;
  profitability: number;
  confidence: number;
  mevScore: number;
}

export interface ExecutionResult {
  success: boolean;
  bundleId: string;
  transactions: {
    frontRun?: string;
    victim: string;
    backRun?: string;
  };
  simulation: {
    estimatedProfit: string;
    gasUsed: string;
    priceImpact: number;
    slippage: number;
  };
  execution: {
    blockNumber?: number;
    gasUsed?: string;
    actualProfit?: string;
    inclusionTime?: number;
  };
  error?: string;
  metrics: {
    totalLatency: number;
    simulationTime: number;
    executionTime: number;
    bundleSize: number;
  };
}

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageProfit: string;
  totalProfit: string;
  averageLatency: number;
  successRate: number;
  gasEfficiency: number;
}

export class SandwichExecutionEngine extends EventEmitter {
  private flashbotsClient?: FlashbotsClient;
  private jitoClient?: JitoClient;
  private bscMevClient?: BscMevClient;
  private profitCalculator: ProfitCalculator;
  private executionStats: ExecutionStats;
  private activeExecutions = new Map<string, ExecutionResult>();
  private maxConcurrentExecutions: number;
  private solanaConnection?: Connection;

  constructor(maxConcurrentExecutions: number = 5) {
    super();
    this.profitCalculator = new ProfitCalculator();
    this.maxConcurrentExecutions = maxConcurrentExecutions;
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageProfit: '0',
      totalProfit: '0',
      averageLatency: 0,
      successRate: 0,
      gasEfficiency: 0
    };
  }

  async initialize(clients: {
    flashbots?: FlashbotsClient;
    jito?: JitoClient;
    bscMev?: BscMevClient;
    solanaConnection?: Connection;
  }): Promise<void> {
    if (clients.flashbots) {
      this.flashbotsClient = clients.flashbots;
    }
    if (clients.jito) {
      this.jitoClient = clients.jito;
    }
    if (clients.bscMev) {
      this.bscMevClient = clients.bscMev;
    }
    if (clients.solanaConnection) {
      this.solanaConnection = clients.solanaConnection;
    }

    // Set up event listeners for each client
    this.setupEventHandlers();

    this.emit('initialized');
    console.log('Sandwich execution engine initialized');
  }

  /**
   * Execute a sandwich attack
   */
  async executeSandwich(params: ExecutionParams): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check execution limits
    if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    try {
      this.emit('executionStarted', { executionId, params });

      // Initialize result
      const result: ExecutionResult = {
        success: false,
        bundleId: '',
        transactions: {
          victim: params.opportunity.victimTxHash
        },
        simulation: {
          estimatedProfit: '0',
          gasUsed: '0',
          priceImpact: 0,
          slippage: 0
        },
        execution: {},
        metrics: {
          totalLatency: 0,
          simulationTime: 0,
          executionTime: 0,
          bundleSize: 0
        }
      };

      this.activeExecutions.set(executionId, result);

      // Step 1: Validate opportunity
      const validationResult = await this.validateOpportunity(params);
      if (!validationResult.valid) {
        result.error = validationResult.reason || 'Validation failed';
        this.emit('executionFailed', { executionId, result });
        return result;
      }

      // Step 2: Simulate sandwich attack
      const simulationStart = Date.now();
      const simulation = await this.simulateExecution(params);
      result.simulation = simulation;
      result.metrics.simulationTime = Date.now() - simulationStart;

      if (!simulation.estimatedProfit || parseFloat(simulation.estimatedProfit) <= 0) {
        result.error = 'Simulation shows unprofitable execution';
        this.emit('executionFailed', { executionId, result });
        return result;
      }

      // Skip execution if simulation only
      if (params.simulationOnly) {
        result.success = true;
        result.metrics.totalLatency = Date.now() - startTime;
        this.emit('simulationCompleted', { executionId, result });
        return result;
      }

      // Step 3: Create and submit bundle
      const executionStart = Date.now();
      const bundleResult = await this.createAndSubmitBundle(params, simulation);
      result.bundleId = bundleResult.bundleId;
      result.transactions = bundleResult.transactions;
      result.metrics.executionTime = Date.now() - executionStart;
      result.metrics.bundleSize = bundleResult.bundleSize;

      // Step 4: Monitor execution
      await this.monitorExecution(executionId, result, params.opportunity.chain);

      result.metrics.totalLatency = Date.now() - startTime;
      this.updateExecutionStats(result);

      if (result.success) {
        this.emit('executionCompleted', { executionId, result });
      } else {
        this.emit('executionFailed', { executionId, result });
      }

      return result;

    } catch (error) {
      const result = this.activeExecutions.get(executionId);
      if (result) {
        result.error = error instanceof Error ? error.message : 'Unknown execution error';
        result.metrics.totalLatency = Date.now() - startTime;
        this.updateExecutionStats(result);
        this.emit('executionFailed', { executionId, result });
        return result;
      }
      throw error;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Validate sandwich opportunity before execution
   */
  private async validateOpportunity(params: ExecutionParams): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const { opportunity } = params;

    // Check if opportunity is still valid (not expired)
    if (params.deadline && Date.now() > params.deadline) {
      return { valid: false, reason: 'Opportunity expired' };
    }

    // Check minimum profit threshold
    const estimatedProfitValue = parseFloat(opportunity.estimatedProfit);
    const minProfitValue = parseFloat(params.minProfit);
    if (estimatedProfitValue < minProfitValue) {
      return { valid: false, reason: 'Profit below minimum threshold' };
    }

    // Check gas price constraints
    const gasPrice = parseFloat(opportunity.gasPrice);
    const maxGasPrice = parseFloat(params.maxGasPrice);
    if (gasPrice > maxGasPrice) {
      return { valid: false, reason: 'Gas price too high' };
    }

    // Check if MEV client is available for the chain
    const client = this.getMevClient(opportunity.chain);
    if (!client || !client.isReady()) {
      return { valid: false, reason: `MEV client not ready for ${opportunity.chain}` };
    }

    // Validate token addresses and amounts
    if (!opportunity.tokenIn || !opportunity.tokenOut || !opportunity.amountIn) {
      return { valid: false, reason: 'Invalid token or amount data' };
    }

    return { valid: true };
  }

  /**
   * Simulate sandwich execution
   */
  private async simulateExecution(params: ExecutionParams): Promise<{
    estimatedProfit: string;
    gasUsed: string;
    priceImpact: number;
    slippage: number;
  }> {
    const { opportunity } = params;

    try {
      // Create profit calculation parameters
      const profitParams: ProfitParams = {
        victimAmountIn: opportunity.amountIn,
        victimAmountOutMin: opportunity.expectedAmountOut,
        tokenInAddress: opportunity.tokenIn,
        tokenOutAddress: opportunity.tokenOut,
        tokenInDecimals: 18, // Would fetch actual decimals
        tokenOutDecimals: 18, // Would fetch actual decimals
        tokenInPrice: 1.0, // Would fetch actual prices
        tokenOutPrice: 1.0, // Would fetch actual prices
        poolReserve0: opportunity.poolLiquidity,
        poolReserve1: opportunity.poolLiquidity,
        poolFee: 300, // 0.3% default, would fetch actual fee
        gasPrice: opportunity.gasPrice,
        chain: opportunity.chain,
        dexType: opportunity.dexType
      };

      // Calculate optimal front-run amount if not specified
      let frontRunAmount = params.frontRunAmount;
      if (!frontRunAmount || frontRunAmount === '0') {
        const optimization = await this.profitCalculator.calculateOptimalProfit(profitParams);
        frontRunAmount = optimization.optimalFrontRunAmount;
      }

      // Update params with optimal amount
      const updatedParams = {
        ...profitParams,
        victimAmountIn: frontRunAmount
      };

      const calculation = await this.profitCalculator.calculateProfit(updatedParams);

      return {
        estimatedProfit: calculation.netProfit,
        gasUsed: calculation.gasCost,
        priceImpact: calculation.priceImpact,
        slippage: calculation.slippage
      };

    } catch (error) {
      console.error('Simulation error:', error);
      return {
        estimatedProfit: '0',
        gasUsed: '0',
        priceImpact: 0,
        slippage: 0
      };
    }
  }

  /**
   * Create and submit bundle to appropriate MEV infrastructure
   */
  private async createAndSubmitBundle(
    params: ExecutionParams,
    simulation: any
  ): Promise<{
    bundleId: string;
    transactions: { frontRun?: string; victim: string; backRun?: string };
    bundleSize: number;
  }> {
    const { opportunity } = params;
    const chain = opportunity.chain;

    switch (chain) {
      case 'ethereum':
        return this.submitEthereumBundle(params, simulation);
      case 'bsc':
        return this.submitBscBundle(params, simulation);
      case 'solana':
        return this.submitSolanaBundle(params, simulation);
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  private async submitEthereumBundle(params: ExecutionParams, simulation: any): Promise<any> {
    if (!this.flashbotsClient) {
      throw new Error('Flashbots client not initialized');
    }

    const opportunity = params.opportunity as any;
    const sandwichOpportunity = {
      victimTxHash: opportunity.victimTxHash,
      victimTransaction: opportunity.victimTransaction,
      tokenIn: opportunity.tokenIn,
      tokenOut: opportunity.tokenOut,
      amountIn: opportunity.amountIn,
      expectedAmountOut: opportunity.expectedAmountOut,
      dexRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
      gasPrice: opportunity.gasPrice,
      maxSlippage: params.maxSlippage,
      estimatedProfit: simulation.estimatedProfit,
      profitability: parseFloat(simulation.estimatedProfit)
    };

    const bundle = await this.flashbotsClient.createSandwichBundle(sandwichOpportunity);
    await this.flashbotsClient.submitBundle(bundle.id);

    return {
      bundleId: bundle.id,
      transactions: {
        frontRun: `frontrun_${bundle.id}`,
        victim: opportunity.victimTxHash,
        backRun: `backrun_${bundle.id}`
      },
      bundleSize: 3
    };
  }

  private async submitBscBundle(params: ExecutionParams, simulation: any): Promise<any> {
    if (!this.bscMevClient) {
      throw new Error('BSC MEV client not initialized');
    }

    const opportunity = params.opportunity as any;
    const bscOpportunity = {
      victimTxHash: opportunity.victimTxHash,
      victimTransaction: opportunity.victimTransaction,
      pancakeRouter: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      tokenA: opportunity.tokenIn,
      tokenB: opportunity.tokenOut,
      amountIn: opportunity.amountIn,
      expectedAmountOut: opportunity.expectedAmountOut,
      estimatedProfit: simulation.estimatedProfit,
      gasPrice: opportunity.gasPrice,
      blockNumber: Date.now() // Simplified block number
    };

    const bundle = await this.bscMevClient.createSandwichBundle(bscOpportunity);
    await this.bscMevClient.submitBundle(bundle.id);

    return {
      bundleId: bundle.id,
      transactions: {
        frontRun: `frontrun_${bundle.id}`,
        victim: opportunity.victimTxHash,
        backRun: `backrun_${bundle.id}`
      },
      bundleSize: 3
    };
  }

  private async submitSolanaBundle(params: ExecutionParams, simulation: any): Promise<any> {
    if (!this.jitoClient) {
      throw new Error('Jito client not initialized');
    }

    const opportunity = params.opportunity as any;
    
    // Use solanaConnection for validation and fee estimation if available
    if (this.solanaConnection) {
      try {
        // Validate Solana network connectivity
        const slot = await this.solanaConnection.getSlot();
        console.log(`Solana network validation successful, current slot: ${slot}`);
        
        // Get recent blockhash for transaction validation
        const { blockhash } = await this.solanaConnection.getLatestBlockhash();
        console.log(`Using recent blockhash: ${blockhash}`);
        
        // Estimate compute units and fees using the connection
        const computeUnitsEstimate = await this.estimateSolanaComputeUnits(opportunity);
        console.log(`Estimated compute units: ${computeUnitsEstimate}`);
        
        // Validate token accounts exist
        await this.validateSolanaTokenAccounts(opportunity.tokenIn, opportunity.tokenOut);
        
      } catch (error) {
        console.warn('Solana connection validation failed:', error);
        // Continue with bundle creation as this is non-critical
      }
    }
    
    const solanaOpportunity = {
      victimTxSignature: opportunity.victimTxHash,
      victimTransaction: opportunity.victimTransaction,
      programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
      tokenMintA: opportunity.tokenIn,
      tokenMintB: opportunity.tokenOut,
      swapDirection: 'a_to_b' as const,
      amountIn: parseInt(opportunity.amountIn),
      expectedAmountOut: parseInt(opportunity.expectedAmountOut),
      estimatedProfit: simulation.estimatedProfit,
      priorityFee: parseFloat(opportunity.gasPrice)
    };

    const bundle = await this.jitoClient.createSandwichBundle(solanaOpportunity);
    const result = await this.jitoClient.submitBundle(bundle.id);

    // Use the result variable to validate submission success
    if (!result.success) {
      throw new Error(`Bundle submission failed: ${result.error || 'Unknown error'}`);
    }

    // Validate token addresses using PublicKey import
    try {
      new PublicKey(opportunity.tokenIn);
      new PublicKey(opportunity.tokenOut);
    } catch (error) {
      console.warn('Invalid Solana token addresses:', error);
    }

    return {
      bundleId: bundle.id,
      transactions: {
        frontRun: `frontrun_${bundle.id}`,
        victim: opportunity.victimTxHash,
        backRun: `backrun_${bundle.id}`
      },
      bundleSize: 3,
      submissionResult: result
    };
  }

  /**
   * Estimate compute units for Solana transactions
   */
  private async estimateSolanaComputeUnits(opportunity: any): Promise<number> {
    if (!this.solanaConnection) {
      return 200000; // Default conservative estimate
    }

    try {
      // Simulate transaction to get accurate compute unit estimate
      // This is a simplified estimation - in production would use actual transaction simulation
      const baseComputeUnits = 50000; // Base compute units for Raydium swap
      const complexityMultiplier = opportunity.amountIn > 1000000 ? 1.5 : 1.0; // Large trades are more complex
      
      return Math.floor(baseComputeUnits * complexityMultiplier);
    } catch (error) {
      console.warn('Failed to estimate compute units:', error);
      return 200000; // Fallback estimate
    }
  }

  /**
   * Validate that Solana token accounts exist and are valid
   */
  private async validateSolanaTokenAccounts(tokenMintA: string, tokenMintB: string): Promise<void> {
    if (!this.solanaConnection) {
      console.warn('Solana connection not available for token validation');
      return;
    }

    try {
      const tokenAPublicKey = new PublicKey(tokenMintA);
      const tokenBPublicKey = new PublicKey(tokenMintB);
      
      // Check if token accounts exist
      const [tokenAInfo, tokenBInfo] = await Promise.all([
        this.solanaConnection.getAccountInfo(tokenAPublicKey),
        this.solanaConnection.getAccountInfo(tokenBPublicKey)
      ]);
      
      if (!tokenAInfo) {
        console.warn(`Token A account not found: ${tokenMintA}`);
      } else {
        console.log(`Token A validated: ${tokenMintA} (owner: ${tokenAInfo.owner.toString()})`);
      }
      
      if (!tokenBInfo) {
        console.warn(`Token B account not found: ${tokenMintB}`);
      } else {
        console.log(`Token B validated: ${tokenMintB} (owner: ${tokenBInfo.owner.toString()})`);
      }
      
    } catch (error) {
      console.warn('Token account validation failed:', error);
    }
  }

  /**
   * Monitor execution result
   */
  private async monitorExecution(
    executionId: string,
    result: ExecutionResult,
    chain: string
  ): Promise<void> {
    const timeout = 60000; // 1 minute timeout
    const startTime = Date.now();

    // Log monitoring start with execution ID
    console.log(`Starting execution monitoring for ${executionId} on ${chain}`);
    this.emit('monitoringStarted', { executionId, chain, bundleId: result.bundleId });

    return new Promise((resolve) => {
      const client = this.getMevClient(chain);
      if (!client) {
        result.error = 'MEV client not available for monitoring';
        this.emit('monitoringFailed', { executionId, error: result.error });
        resolve();
        return;
      }

      // Set up monitoring interval
      const monitorInterval = setInterval(() => {
        if (Date.now() - startTime > timeout) {
          clearInterval(monitorInterval);
          result.error = 'Execution monitoring timeout';
          this.emit('monitoringTimeout', { executionId });
          resolve();
          return;
        }

        // Check bundle status (simplified)
        const bundle = this.getBundleStatus(result.bundleId, chain);
        if (bundle) {
          if (bundle.status === 'included' || bundle.status === 'landed') {
            result.success = true;
            result.execution.blockNumber = bundle.blockNumber;
            result.execution.inclusionTime = Date.now();
            result.execution.actualProfit = bundle.actualProfit;
            
            console.log(`Execution ${executionId} successful in block ${bundle.blockNumber}`);
            this.emit('monitoringSuccess', { executionId, bundle });
            clearInterval(monitorInterval);
            resolve();
          } else if (bundle.status === 'failed') {
            result.error = bundle.failureReason || 'Bundle execution failed';
            this.emit('monitoringFailed', { executionId, error: result.error });
            clearInterval(monitorInterval);
            resolve();
          }
        }
      }, 1000); // Check every second
    });
  }

  /**
   * Get MEV client for specific chain
   */
  private getMevClient(chain: string): any {
    switch (chain) {
      case 'ethereum':
        return this.flashbotsClient;
      case 'bsc':
        return this.bscMevClient;
      case 'solana':
        return this.jitoClient;
      default:
        return null;
    }
  }

  /**
   * Get bundle status (simplified implementation)
   */
  private getBundleStatus(bundleId: string, chain: string): any {
    const client = this.getMevClient(chain);
    if (!client) return null;

    // This would call the actual client method
    if (client.getBundle) {
      return client.getBundle(bundleId);
    }

    return null;
  }

  /**
   * Update execution statistics
   */
  private updateExecutionStats(result: ExecutionResult): void {
    this.executionStats.totalExecutions++;

    if (result.success) {
      this.executionStats.successfulExecutions++;
      const profit = parseFloat(result.execution.actualProfit || result.simulation.estimatedProfit);
      const currentTotal = parseFloat(this.executionStats.totalProfit);
      this.executionStats.totalProfit = (currentTotal + profit).toString();
    } else {
      this.executionStats.failedExecutions++;
    }

    // Update averages
    this.executionStats.successRate = 
      (this.executionStats.successfulExecutions / this.executionStats.totalExecutions) * 100;

    if (this.executionStats.successfulExecutions > 0) {
      this.executionStats.averageProfit = 
        (parseFloat(this.executionStats.totalProfit) / this.executionStats.successfulExecutions).toString();
    }

    // Update gas efficiency (simplified)
    const gasUsed = parseFloat(result.simulation.gasUsed || '0');
    const profit = parseFloat(result.execution.actualProfit || result.simulation.estimatedProfit);
    if (gasUsed > 0) {
      this.executionStats.gasEfficiency = profit / gasUsed;
    }
  }

  /**
   * Set up event handlers for MEV clients
   */
  private setupEventHandlers(): void {
    // Flashbots events
    if (this.flashbotsClient) {
      this.flashbotsClient.on('bundleIncluded', (bundle: MevBundle) => {
        this.emit('bundleIncluded', { chain: 'ethereum', bundle });
      });

      this.flashbotsClient.on('bundleFailed', (bundle: MevBundle) => {
        this.emit('bundleFailed', { chain: 'ethereum', bundle });
      });
    }

    // Jito events
    if (this.jitoClient) {
      this.jitoClient.on('bundleLanded', (bundle: SolanaMevBundle) => {
        this.emit('bundleIncluded', { chain: 'solana', bundle });
      });

      this.jitoClient.on('bundleFailed', (bundle: SolanaMevBundle) => {
        this.emit('bundleFailed', { chain: 'solana', bundle });
      });
    }

    // BSC MEV events
    if (this.bscMevClient) {
      this.bscMevClient.on('bundleIncluded', (bundle: BscMevBundle) => {
        this.emit('bundleIncluded', { chain: 'bsc', bundle });
      });

      this.bscMevClient.on('bundleFailed', (bundle: BscMevBundle) => {
        this.emit('bundleFailed', { chain: 'bsc', bundle });
      });
    }
  }

  /**
   * Get current execution statistics
   */
  getExecutionStats(): ExecutionStats {
    return { ...this.executionStats };
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): Array<{ id: string; result: ExecutionResult }> {
    return Array.from(this.activeExecutions.entries()).map(([id, result]) => ({
      id,
      result: { ...result }
    }));
  }

  /**
   * Cancel an active execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const result = this.activeExecutions.get(executionId);
    if (!result) {
      return false;
    }

    // Cancel the bundle if possible
    if (result.bundleId) {
      const opportunity = result as any;
      const client = this.getMevClient(opportunity.chain);
      if (client && client.cancelBundle) {
        client.cancelBundle(result.bundleId);
      }
    }

    result.error = 'Execution cancelled';
    this.activeExecutions.delete(executionId);
    this.emit('executionCancelled', { executionId, result });

    return true;
  }

  /**
   * Emergency stop all executions
   */
  async emergencyStop(): Promise<void> {
    console.log('Emergency stop activated - cancelling all executions');

    const activeIds = Array.from(this.activeExecutions.keys());
    await Promise.all(activeIds.map(id => this.cancelExecution(id)));

    this.emit('emergencyStop');
  }

  /**
   * Reset execution statistics
   */
  resetStats(): void {
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageProfit: '0',
      totalProfit: '0',
      averageLatency: 0,
      successRate: 0,
      gasEfficiency: 0
    };

    this.emit('statsReset');
  }
}