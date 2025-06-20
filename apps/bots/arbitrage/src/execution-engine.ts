import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { ArbitrageOpportunity } from './opportunity-detector';
import { RiskManager } from './risk-manager';

export interface ExecutionResult {
  success: boolean;
  opportunityId: string;
  actualProfit: string;
  gasCost: string;
  executionTime: number;
  transactions: {
    buy: string;
    sell: string;
  };
  error?: string;
}

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  totalProfit: string;
  totalGasCost: string;
  averageExecutionTime: number;
  successRate: number;
}

export interface ExecutionConfig {
  maxGasPrice: string;
  gasMultiplier: number;
  maxSlippage: number;
  executeInParallel: boolean;
  dryRun: boolean;
  confirmations: number;
  timeoutMs: number;
}

/**
 * Arbitrage Execution Engine
 * Handles the actual execution of arbitrage opportunities
 */
export class ArbitrageExecutionEngine extends EventEmitter {
  private config: ExecutionConfig;
  private providers = new Map<string, ethers.Provider>();
  private wallets = new Map<string, ethers.Wallet>();
  private riskManager: RiskManager;
  
  private isExecuting = false;
  private executionQueue: ArbitrageOpportunity[] = [];
  private stats: ExecutionStats;
  
  // Contract ABIs
  private routerABI = [
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
  ];

  private erc20ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function balanceOf(address owner) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)'
  ];

  constructor(config: ExecutionConfig, riskManager: RiskManager) {
    super();
    this.config = config;
    this.riskManager = riskManager;
    
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      totalProfit: '0',
      totalGasCost: '0',
      averageExecutionTime: 0,
      successRate: 0
    };
  }

  /**
   * Initialize execution engine with providers and wallets
   */
  async initialize(setup: {
    providers: { [chain: string]: ethers.Provider };
    wallets: { [chain: string]: ethers.Wallet };
  }): Promise<void> {
    try {
      // Store providers and wallets
      for (const [chain, provider] of Object.entries(setup.providers)) {
        this.providers.set(chain, provider);
      }
      
      for (const [chain, wallet] of Object.entries(setup.wallets)) {
        this.wallets.set(chain, wallet);
      }

      console.log('Arbitrage execution engine initialized');
      this.emit('initialized');

    } catch (error) {
      console.error('Failed to initialize execution engine:', error);
      throw error;
    }
  }

  /**
   * Execute an arbitrage opportunity
   */
  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.stats.totalExecutions++;
      
      console.log(`Executing arbitrage opportunity: ${opportunity.id}`);
      this.emit('executionStarted', opportunity);

      // Risk check - simplified for now
      const tradeAmount = parseFloat(opportunity.requiredCapital);
      if (tradeAmount > this.riskManager.getRiskParameters().maxPositionSize) {
        throw new Error(`Trade amount ${tradeAmount} exceeds max position size`);
      }

      // Pre-execution validation
      await this.validateOpportunity(opportunity);

      // Execute the arbitrage
      let result: ExecutionResult;
      
      if (this.config.executeInParallel) {
        result = await this.executeParallel(opportunity);
      } else {
        result = await this.executeSequential(opportunity);
      }

      // Update statistics
      if (result.success) {
        this.stats.successfulExecutions++;
        const profit = parseFloat(result.actualProfit);
        const currentProfit = parseFloat(this.stats.totalProfit);
        this.stats.totalProfit = (currentProfit + profit).toString();
      }

      const gasCost = parseFloat(result.gasCost);
      const currentGasCost = parseFloat(this.stats.totalGasCost);
      this.stats.totalGasCost = (currentGasCost + gasCost).toString();

      this.stats.successRate = (this.stats.successfulExecutions / this.stats.totalExecutions) * 100;
      
      // Update average execution time
      const executionTime = Date.now() - startTime;
      this.stats.averageExecutionTime = (
        (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime) /
        this.stats.totalExecutions
      );

      this.emit('executionCompleted', result);
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const failureResult: ExecutionResult = {
        success: false,
        opportunityId: opportunity.id,
        actualProfit: '0',
        gasCost: '0',
        executionTime,
        transactions: { buy: '', sell: '' },
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.emit('executionFailed', failureResult);
      return failureResult;
    }
  }

  /**
   * Validate opportunity before execution
   */
  private async validateOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    // Check if opportunity is still valid
    const chain = opportunity.chain;
    const provider = this.providers.get(chain);
    
    if (!provider) {
      throw new Error(`No provider available for chain: ${chain}`);
    }

    // Re-check prices (simplified validation)
    const buyRouter = new ethers.Contract(
      opportunity.buyExchange.router,
      this.routerABI,
      provider
    );

    const sellRouter = new ethers.Contract(
      opportunity.sellExchange.router,
      this.routerABI,
      provider
    );

    const wethAddress = chain === 'ethereum' 
      ? '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      : '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

    const amountIn = ethers.parseEther('1'); // 1 token for price check
    
    try {
      // Get current buy price
      const buyPath = [wethAddress, opportunity.tokenAddress];
      const buyAmountsMethod = buyRouter['getAmountsOut'];
      if (!buyAmountsMethod) throw new Error('Buy router does not support getAmountsOut');
      const buyAmounts = await buyAmountsMethod.call(buyRouter, amountIn, buyPath);
      const currentBuyPrice = Number(amountIn) / Number(buyAmounts[1]);

      // Get current sell price  
      const sellPath = [opportunity.tokenAddress, wethAddress];
      const sellAmountsMethod = sellRouter['getAmountsOut'];
      if (!sellAmountsMethod) throw new Error('Sell router does not support getAmountsOut');
      const sellAmounts = await sellAmountsMethod.call(sellRouter, buyAmounts[1], sellPath);
      const currentSellPrice = Number(sellAmounts[1]) / Number(buyAmounts[1]);

      // Check if opportunity still exists
      const currentProfitPercent = ((currentSellPrice - currentBuyPrice) / currentBuyPrice) * 100;
      
      if (currentProfitPercent < opportunity.profitPercent * 0.8) { // 20% tolerance
        throw new Error('Opportunity no longer profitable due to price movement');
      }

    } catch (error) {
      throw new Error(`Price validation failed: ${error}`);
    }
  }

  /**
   * Execute arbitrage sequentially (buy then sell)
   */
  private async executeSequential(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    const chain = opportunity.chain;
    const wallet = this.wallets.get(chain);
    const provider = this.providers.get(chain);

    if (!wallet || !provider) {
      throw new Error(`Wallet or provider not available for chain: ${chain}`);
    }

    const wethAddress = chain === 'ethereum' 
      ? '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      : '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

    const tradeAmount = ethers.parseEther(opportunity.requiredCapital);
    
    // Step 1: Buy tokens on cheaper exchange
    console.log(`Step 1: Buying on ${opportunity.buyExchange.name}`);
    
    const buyTx = await this.executeBuy(
      opportunity.tokenAddress,
      wethAddress,
      tradeAmount,
      opportunity.buyExchange.router,
      wallet
    );

    // Wait for buy transaction confirmation
    const buyReceipt = await buyTx.wait(this.config.confirmations);
    if (!buyReceipt || buyReceipt.status !== 1) {
      throw new Error('Buy transaction failed');
    }

    // Step 2: Sell tokens on more expensive exchange
    console.log(`Step 2: Selling on ${opportunity.sellExchange.name}`);
    
    // Get token balance
    const tokenContract = new ethers.Contract(opportunity.tokenAddress, this.erc20ABI, wallet);
    const balanceOfMethod = tokenContract['balanceOf'];
    if (!balanceOfMethod) throw new Error('Token does not support balanceOf');
    const tokenBalance = await balanceOfMethod.call(tokenContract, wallet.address);

    const sellTx = await this.executeSell(
      opportunity.tokenAddress,
      wethAddress,
      tokenBalance,
      opportunity.sellExchange.router,
      wallet
    );

    // Wait for sell transaction confirmation
    const sellReceipt = await sellTx.wait(this.config.confirmations);
    if (!sellReceipt || sellReceipt.status !== 1) {
      throw new Error('Sell transaction failed');
    }

    // Calculate actual profit and gas costs
    const buyGasCost = buyReceipt.gasUsed * buyReceipt.gasPrice!;
    const sellGasCost = sellReceipt.gasUsed * sellReceipt.gasPrice!;
    const totalGasCost = buyGasCost + sellGasCost;

    // Calculate profit (simplified)
    const actualProfit = '0'; // Would calculate based on actual token amounts

    return {
      success: true,
      opportunityId: opportunity.id,
      actualProfit,
      gasCost: ethers.formatEther(totalGasCost),
      executionTime: Date.now() - Date.now(), // Would track properly
      transactions: {
        buy: buyTx.hash,
        sell: sellTx.hash
      }
    };
  }

  /**
   * Execute arbitrage in parallel (requires flash loan or sufficient capital)
   */
  private async executeParallel(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    // This would implement flash loan logic for parallel execution
    // For now, fallback to sequential execution
    console.log('Parallel execution not implemented, falling back to sequential');
    return this.executeSequential(opportunity);
  }

  /**
   * Execute buy transaction
   */
  private async executeBuy(
    tokenAddress: string,
    wethAddress: string,
    amountIn: bigint,
    routerAddress: string,
    wallet: ethers.Wallet
  ): Promise<ethers.TransactionResponse> {
    const router = new ethers.Contract(routerAddress, this.routerABI, wallet);
    
    const path = [wethAddress, tokenAddress];
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    
    // Calculate minimum amount out with slippage protection
    const getAmountsOutMethod = router['getAmountsOut'];
    if (!getAmountsOutMethod) throw new Error('Router does not support getAmountsOut');
    const amountsOut = await getAmountsOutMethod.call(router, amountIn, path);
    const amountOutMin = (amountsOut[1] * BigInt(Math.floor((100 - this.config.maxSlippage) * 100))) / BigInt(10000);

    // Check WETH allowance and approve if needed
    const wethContract = new ethers.Contract(wethAddress, this.erc20ABI, wallet);
    const allowanceMethod = wethContract['allowance'];
    if (!allowanceMethod) throw new Error('WETH does not support allowance');
    const allowance = await allowanceMethod.call(wethContract, wallet.address, routerAddress);
    
    if (allowance < amountIn) {
      const approveMethod = wethContract['approve'];
      if (!approveMethod) throw new Error('WETH does not support approve');
      const approveTx = await approveMethod.call(wethContract, routerAddress, ethers.MaxUint256);
      await approveTx.wait(1);
    }

    // Execute buy
    const gasPrice = await this.getOptimalGasPrice(wallet.provider!);
    
    const swapMethod = router['swapExactTokensForTokens'];
    if (!swapMethod) throw new Error('Router does not support swapExactTokensForTokens');
    return swapMethod.call(router, amountIn, amountOutMin, path, wallet.address, deadline, {
      gasPrice,
      gasLimit: 200000 // Would estimate properly
    });
  }

  /**
   * Execute sell transaction
   */
  private async executeSell(
    tokenAddress: string,
    wethAddress: string,
    amountIn: bigint,
    routerAddress: string,
    wallet: ethers.Wallet
  ): Promise<ethers.TransactionResponse> {
    const router = new ethers.Contract(routerAddress, this.routerABI, wallet);
    
    const path = [tokenAddress, wethAddress];
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    
    // Calculate minimum amount out with slippage protection
    const getAmountsOutMethod = router['getAmountsOut'];
    if (!getAmountsOutMethod) throw new Error('Router does not support getAmountsOut');
    const amountsOut = await getAmountsOutMethod.call(router, amountIn, path);
    const amountOutMin = (amountsOut[1] * BigInt(Math.floor((100 - this.config.maxSlippage) * 100))) / BigInt(10000);

    // Check token allowance and approve if needed
    const tokenContract = new ethers.Contract(tokenAddress, this.erc20ABI, wallet);
    const allowanceMethod = tokenContract['allowance'];
    if (!allowanceMethod) throw new Error('Token does not support allowance');
    const allowance = await allowanceMethod.call(tokenContract, wallet.address, routerAddress);
    
    if (allowance < amountIn) {
      const approveMethod = tokenContract['approve'];
      if (!approveMethod) throw new Error('Token does not support approve');
      const approveTx = await approveMethod.call(tokenContract, routerAddress, ethers.MaxUint256);
      await approveTx.wait(1);
    }

    // Execute sell
    const gasPrice = await this.getOptimalGasPrice(wallet.provider!);
    
    const swapMethod = router['swapExactTokensForTokens'];
    if (!swapMethod) throw new Error('Router does not support swapExactTokensForTokens');
    return swapMethod.call(router, amountIn, amountOutMin, path, wallet.address, deadline, {
      gasPrice,
      gasLimit: 200000 // Would estimate properly
    });
  }

  /**
   * Get optimal gas price for execution
   */
  private async getOptimalGasPrice(provider: ethers.Provider): Promise<bigint> {
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    
    // Apply gas multiplier for faster execution
    const multipliedGasPrice = (gasPrice * BigInt(Math.floor(this.config.gasMultiplier * 100))) / BigInt(100);
    
    // Check against max gas price
    const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
    
    return multipliedGasPrice > maxGasPrice ? maxGasPrice : multipliedGasPrice;
  }

  /**
   * Add opportunity to execution queue
   */
  addToQueue(opportunity: ArbitrageOpportunity): void {
    this.executionQueue.push(opportunity);
    this.emit('opportunityQueued', opportunity);
  }

  /**
   * Process execution queue
   */
  async processQueue(): Promise<void> {
    if (this.isExecuting || this.executionQueue.length === 0) {
      return;
    }

    this.isExecuting = true;

    try {
      while (this.executionQueue.length > 0) {
        const opportunity = this.executionQueue.shift();
        if (opportunity) {
          await this.executeArbitrage(opportunity);
        }
      }
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): ExecutionStats {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Emergency stop all executions
   */
  emergencyStop(): void {
    this.executionQueue.length = 0;
    this.isExecuting = false;
    this.emit('emergencyStop');
    console.log('Emergency stop activated - all executions halted');
  }
} 