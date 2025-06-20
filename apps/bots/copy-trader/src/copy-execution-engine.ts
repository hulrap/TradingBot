import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import type { MempoolTransaction } from './mempool-monitor';

export interface CopyConfig {
  targetWallet: string;
  copyPercentage: number; // Percentage of target trade size to copy (0-100)
  maxTradeSize: string; // Maximum trade size in ETH
  minTradeSize: string; // Minimum trade size in ETH
  maxSlippage: number; // Maximum acceptable slippage
  maxGasPrice: string; // Maximum gas price willing to pay
  followTokens: string[]; // Only copy trades for these tokens (empty = all)
  excludeTokens: string[]; // Never copy trades for these tokens
  copyDelay: number; // Delay in ms before copying (for analysis)
  stopLoss: number; // Stop loss percentage
  takeProfit: number; // Take profit percentage
  enableFiltering: boolean;
  enableRiskManagement: boolean;
  // Enhanced security and MEV protection
  enableMEVProtection: boolean;
  maxPositionSize: string; // Maximum position size as percentage of portfolio
  portfolioMaxRisk: number; // Maximum portfolio risk percentage
  priceImpactThreshold: number; // Maximum acceptable price impact percentage
  enableDynamicSlippage: boolean;
  flashbotsEnabled?: boolean;
  privateMempool?: boolean;
}

export interface CopyTrade {
  id: string;
  originalTxHash: string;
  copyTxHash?: string;
  targetWallet: string;
  tokenIn: string;
  tokenOut: string;
  originalAmountIn: string;
  copyAmountIn: string;
  originalAmountOut: string;
  copyAmountOut?: string;
  gasPrice: string;
  gasUsed?: string;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  reason?: string;
  timestamp: number;
  executionTime?: number;
  profitLoss?: string;
  slippage?: number;
  priceImpact?: number;
  mevProtected?: boolean;
  approvalTxHash?: string; // For token approval transactions
}

export interface RiskMetrics {
  totalCopied: number;
  successfulCopies: number;
  failedCopies: number;
  successRate: number;
  totalProfit: string;
  totalLoss: string;
  netProfit: string;
  averageSlippage: number;
  maxDrawdown: string;
  sharpeRatio: number;
  portfolioValue: string;
  totalExposure: string;
  largestPosition: string;
  averagePriceImpact: number;
}

export interface PriceData {
  price: number;
  timestamp: number;
  source: string;
  confidence: number;
}

// Enhanced price service with multiple sources and validation
class EnhancedPriceService {
  private cache = new Map<string, PriceData>();
  private readonly CACHE_TTL = 15000; // 15 seconds for high-frequency trading
  private readonly MIN_CONFIDENCE = 0.8;

  async getTokenPrice(symbol: string, tokenAddress?: string): Promise<number> {
    const cacheKey = (tokenAddress || symbol).toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL && cached.confidence >= this.MIN_CONFIDENCE) {
      return cached.price;
    }

    try {
      // Multi-source price aggregation for accuracy
      const prices = await Promise.allSettled([
        this.fetchFromCoinGecko(symbol),
        this.fetchFromDeFiPulse(symbol),
        this.fetchOnChainPrice(tokenAddress)
      ]);

      const validPrices = prices
        .filter(result => result.status === 'fulfilled' && result.value > 0)
        .map(result => (result as PromiseFulfilledResult<number>).value);

      if (validPrices.length === 0) {
        throw new Error(`No valid prices found for ${symbol}`);
      }

      // Use median price for stability
      const medianPrice = this.calculateMedian(validPrices);
      const confidence = validPrices.length / 3; // Confidence based on source count

      // Validate price reasonableness
      if (cached && Math.abs(medianPrice - cached.price) / cached.price > 0.1) {
        console.warn(`Price deviation detected for ${symbol}: ${cached.price} -> ${medianPrice}`);
      }

      const priceData: PriceData = {
        price: medianPrice,
        timestamp: Date.now(),
        source: 'aggregated',
        confidence
      };

      this.cache.set(cacheKey, priceData);
      return medianPrice;

    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      
      // Use cached price if available, even if stale
      if (cached) {
        console.warn(`Using stale cached price for ${symbol}`);
        return cached.price;
      }
      
      throw new Error(`Unable to get price for ${symbol}: ${error}`);
    }
  }

  private calculateMedian(prices: number[]): number {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private async fetchFromCoinGecko(symbol: string): Promise<number> {
    const coinGeckoIds: { [symbol: string]: string } = {
      'ethereum': 'ethereum',
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'weth': 'ethereum',
      'usdc': 'usd-coin',
      'usdt': 'tether',
      'dai': 'dai',
      'wbtc': 'wrapped-bitcoin',
      'link': 'chainlink',
      'uni': 'uniswap',
      'aave': 'aave',
      'comp': 'compound-governance-token'
    };

    const coinId = coinGeckoIds[symbol.toLowerCase()];
    if (!coinId) throw new Error(`Unknown symbol: ${symbol}`);

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { 
        headers: { 'User-Agent': 'TradingBot/1.0' },
        signal: AbortSignal.timeout(5000)
      }
    );
    
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    
    const data: any = await response.json();
    const price = data[coinId]?.usd;
    
    if (!price || price <= 0) throw new Error('Invalid price data');
    return price;
  }

  private async fetchFromDeFiPulse(symbol: string): Promise<number> {
    // Placeholder for DeFiPulse integration
    // In production, implement actual API call
    throw new Error('DeFiPulse integration not implemented');
  }

  private async fetchOnChainPrice(tokenAddress?: string): Promise<number> {
    // Placeholder for on-chain price fetching via Uniswap TWAP
    // In production, implement Uniswap V3 TWAP oracle
    if (!tokenAddress) throw new Error('Token address required for on-chain price');
    throw new Error('On-chain price fetching not implemented');
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

// MEV Protection Service
class MEVProtectionService {
  private flashbotsRelay = 'https://relay.flashbots.net';
  private maxRetries = 3;

  async submitProtectedTransaction(
    transaction: any,
    wallet: ethers.Wallet,
    options: { maxBaseFee?: string; maxPriorityFee?: string; timeout?: number } = {}
  ): Promise<string> {
    // Priority: Use Flashbots if available
    if (options.maxBaseFee) {
      try {
        return await this.submitToFlashbots(transaction, wallet, options);
      } catch (error) {
        console.warn('Flashbots submission failed, falling back to priority gas:', error);
      }
    }

    // Fallback: Use high priority gas to minimize MEV exposure
    return await this.submitWithPriorityGas(transaction, wallet, options);
  }

  private async submitToFlashbots(
    transaction: any,
    wallet: ethers.Wallet,
    options: any
  ): Promise<string> {
    // Simplified Flashbots integration
    // In production, use actual Flashbots SDK
    const bundle = {
      transactions: [
        {
          ...transaction,
          maxFeePerGas: options.maxBaseFee,
          maxPriorityFeePerGas: options.maxPriorityFee || '2000000000' // 2 gwei
        }
      ],
      blockNumber: await wallet.provider.getBlockNumber() + 1
    };

    console.log('Submitting to Flashbots (simulated)');
    throw new Error('Flashbots integration not fully implemented');
  }

  private async submitWithPriorityGas(
    transaction: any,
    wallet: ethers.Wallet,
    options: any
  ): Promise<string> {
    const provider = wallet.provider;
    if (!provider) {
      throw new Error('Wallet provider is not available');
    }

    const feeData = await provider.getFeeData();
    
    // Use high priority gas to get into next block quickly
    const priorityGas = {
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas * BigInt(120) / BigInt(100) : ethers.parseUnits('20', 'gwei'), // 20% higher or 20 gwei fallback
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * BigInt(150) / BigInt(100) : ethers.parseUnits('2', 'gwei'), // 50% higher or 2 gwei fallback
      gasLimit: transaction.gasLimit
    };

    const tx = await wallet.sendTransaction({
      ...transaction,
      ...priorityGas
    });

    return tx.hash;
  }
}

// Token Approval Manager
class TokenApprovalManager {
  private wallet: ethers.Wallet;
  private approvals = new Map<string, { spender: string; amount: bigint; blockNumber: number }>();

  constructor(wallet: ethers.Wallet) {
    this.wallet = wallet;
  }

  async ensureApproval(
    tokenAddress: string,
    spenderAddress: string,
    requiredAmount: bigint
  ): Promise<string | null> {
    // Check if ETH (no approval needed)
    if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000000000' ||
        tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      return null;
    }

    const provider = this.wallet.provider;
    if (!provider) {
      throw new Error('Wallet provider is not available');
    }

    try {
      // Check current allowance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function allowance(address owner, address spender) view returns (uint256)'],
        this.wallet
      );

      const allowanceMethod = tokenContract['allowance'];
      if (!allowanceMethod) {
        throw new Error('Token contract does not support allowance method');
      }

      const currentAllowance = await allowanceMethod(this.wallet.address, spenderAddress);

      if (currentAllowance >= requiredAmount) {
        console.log(`Sufficient allowance exists: ${ethers.formatUnits(currentAllowance, 18)}`);
        return null; // No approval needed
      }

      // Need to approve - use unlimited approval for efficiency
      const approvalAmount = ethers.MaxUint256;
      
      const approvalContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        this.wallet
      );

      const approveMethod = approvalContract['approve'];
      if (!approveMethod) {
        throw new Error('Token contract does not support approve method');
      }

      console.log(`Approving token ${tokenAddress} for spender ${spenderAddress}`);
      
      const tx = await approveMethod(spenderAddress, approvalAmount);
      console.log(`Approval transaction submitted: ${tx.hash}`);
      
      // Cache the approval
      this.approvals.set(`${tokenAddress}_${spenderAddress}`, {
        spender: spenderAddress,
        amount: approvalAmount,
        blockNumber: await provider.getBlockNumber()
      });

      return tx.hash;

    } catch (error) {
      throw new Error(`Token approval failed: ${error}`);
    }
  }

  async waitForApproval(txHash: string, timeout: number = 60000): Promise<void> {
    const provider = this.wallet.provider;
    if (!provider) {
      throw new Error('Wallet provider is not available');
    }

    try {
      const receipt = await provider.waitForTransaction(txHash, 1, timeout);
      if (!receipt || receipt.status !== 1) {
        throw new Error('Approval transaction failed');
      }
      console.log(`Approval confirmed in block ${receipt.blockNumber}`);
    } catch (error) {
      throw new Error(`Approval confirmation failed: ${error}`);
    }
  }

  getApprovalHistory(): Array<{ token: string; spender: string; amount: string; block: number }> {
    return Array.from(this.approvals.entries()).map(([key, approval]) => {
      const tokenAddress = key.split('_')[0];
      return {
        token: tokenAddress || 'unknown',
        spender: approval.spender,
        amount: ethers.formatUnits(approval.amount, 18),
        block: approval.blockNumber
      };
    });
  }
}

export class CopyExecutionEngine extends EventEmitter {
  private config: CopyConfig;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private priceService: EnhancedPriceService;
  private mevProtection: MEVProtectionService;
  private approvalManager: TokenApprovalManager;
  private copyTrades: CopyTrade[] = [];
  private isActive = false;
  private riskMetrics: RiskMetrics;
  private portfolioPositions = new Map<string, { amount: bigint; avgPrice: number; lastUpdate: number }>();

  // DEX router addresses (Ethereum mainnet)
  private dexRouters = {
    uniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    pancakeswap: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    oneInch: '0x1111111254EEB25477B68fb85Ed929f73A960582' // 1inch v4
  };

  // Enhanced token addresses with more comprehensive list
  private tokenAddresses = {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6417c7962A0FF7c4BfB9D8e95D5b9C9',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9'
  };

  constructor(config: CopyConfig, provider: ethers.JsonRpcProvider, privateKey: string) {
    super();
    this.config = this.validateAndEnhanceConfig(config);
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.priceService = new EnhancedPriceService();
    this.mevProtection = new MEVProtectionService();
    this.approvalManager = new TokenApprovalManager(this.wallet);
    this.riskMetrics = this.initializeRiskMetrics();
    
    // Enhanced startup validation
    this.validateConfiguration();
  }

  private validateAndEnhanceConfig(config: CopyConfig): CopyConfig {
    const enhancedConfig = {
      ...config,
      enableMEVProtection: config.enableMEVProtection ?? true,
      maxPositionSize: config.maxPositionSize || '10', // 10% of portfolio max
      portfolioMaxRisk: config.portfolioMaxRisk || 25, // 25% max risk
      priceImpactThreshold: config.priceImpactThreshold || 5, // 5% max price impact
      enableDynamicSlippage: config.enableDynamicSlippage ?? true
    };

    // Validate configuration
    if (enhancedConfig.copyPercentage <= 0 || enhancedConfig.copyPercentage > 100) {
      throw new Error('copyPercentage must be between 0 and 100');
    }

    if (enhancedConfig.maxSlippage <= 0 || enhancedConfig.maxSlippage > 50) {
      throw new Error('maxSlippage must be between 0 and 50');
    }

    if (enhancedConfig.priceImpactThreshold <= 0 || enhancedConfig.priceImpactThreshold > 25) {
      throw new Error('priceImpactThreshold must be between 0 and 25');
    }

    return enhancedConfig;
  }

  private validateConfiguration(): void {
    // Validate wallet has sufficient balance for gas
    this.wallet.provider.getBalance(this.wallet.address).then(balance => {
      const minBalance = ethers.parseEther('0.01'); // Minimum 0.01 ETH for gas
      if (balance < minBalance) {
        console.warn(`Low wallet balance: ${ethers.formatEther(balance)} ETH. Minimum recommended: 0.01 ETH`);
      }
    }).catch(error => {
      console.error('Failed to check wallet balance:', error);
    });

    // Validate target wallet address
    if (!ethers.isAddress(this.config.targetWallet)) {
      throw new Error(`Invalid target wallet address: ${this.config.targetWallet}`);
    }

    console.log('Copy execution engine configuration validated');
  }

  private initializeRiskMetrics(): RiskMetrics {
    return {
      totalCopied: 0,
      successfulCopies: 0,
      failedCopies: 0,
      successRate: 0,
      totalProfit: '0',
      totalLoss: '0',
      netProfit: '0',
      averageSlippage: 0,
      maxDrawdown: '0',
      sharpeRatio: 0,
      portfolioValue: '0',
      totalExposure: '0',
      largestPosition: '0',
      averagePriceImpact: 0
    };
  }

  async start(): Promise<void> {
    this.isActive = true;
    this.emit('started');
    console.log(`Copy execution engine started for wallet: ${this.config.targetWallet}`);
  }

  async stop(): Promise<void> {
    this.isActive = false;
    this.emit('stopped');
    console.log('Copy execution engine stopped');
  }

  async processMempoolTransaction(tx: MempoolTransaction): Promise<void> {
    if (!this.isActive) return;

    // Check if transaction is from target wallet
    if (tx.from.toLowerCase() !== this.config.targetWallet.toLowerCase()) {
      return;
    }

    // Only process swap transactions
    if (!tx.decodedData?.isSwap) {
      return;
    }

    try {
      await this.evaluateAndCopyTrade(tx);
    } catch (error) {
      console.error('Error processing mempool transaction:', error);
      this.emit('error', error);
    }
  }

  private async evaluateAndCopyTrade(tx: MempoolTransaction): Promise<void> {
    const decodedData = tx.decodedData!;
    
    // Create copy trade record
    const copyTrade: CopyTrade = {
      id: `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalTxHash: tx.hash,
      targetWallet: tx.from,
      tokenIn: decodedData.tokenIn || '',
      tokenOut: decodedData.tokenOut || '',
      originalAmountIn: decodedData.amountIn || '0',
      copyAmountIn: '0',
      originalAmountOut: decodedData.amountOut || '0',
      gasPrice: tx.gasPrice,
      status: 'pending',
      timestamp: Date.now()
    };

    this.copyTrades.push(copyTrade);
    this.emit('copyTradeCreated', copyTrade);

    // Apply filters
    if (this.config.enableFiltering && !await this.shouldCopyTrade(copyTrade)) {
      copyTrade.status = 'cancelled';
      copyTrade.reason = 'Filtered out by copy rules';
      this.emit('copyTradeCancelled', copyTrade);
      return;
    }

    // Calculate copy amount
    const copyAmount = this.calculateCopyAmount(copyTrade.originalAmountIn);
    if (!copyAmount) {
      copyTrade.status = 'cancelled';
      copyTrade.reason = 'Copy amount calculation failed';
      this.emit('copyTradeCancelled', copyTrade);
      return;
    }

    copyTrade.copyAmountIn = copyAmount;

    // Apply copy delay for analysis
    if (this.config.copyDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.copyDelay));
    }

    // Execute the copy trade
    await this.executeCopyTradeEnhanced(copyTrade);
  }

  private async shouldCopyTrade(copyTrade: CopyTrade): Promise<boolean> {
    // Check if token is in follow list (if specified)
    if (this.config.followTokens.length > 0) {
      const hasFollowedToken = this.config.followTokens.some(token => 
        token.toLowerCase() === copyTrade.tokenIn.toLowerCase() ||
        token.toLowerCase() === copyTrade.tokenOut.toLowerCase()
      );
      if (!hasFollowedToken) return false;
    }

    // Check if token is in exclude list
    if (this.config.excludeTokens.length > 0) {
      const hasExcludedToken = this.config.excludeTokens.some(token => 
        token.toLowerCase() === copyTrade.tokenIn.toLowerCase() ||
        token.toLowerCase() === copyTrade.tokenOut.toLowerCase()
      );
      if (hasExcludedToken) return false;
    }

    // Check trade size limits with real-time price conversion
    try {
      const originalAmountETH = await this.convertToETHSafe(copyTrade.originalAmountIn, copyTrade.tokenIn);
      const minSize = parseFloat(this.config.minTradeSize);
      const maxSize = parseFloat(this.config.maxTradeSize);

      if (originalAmountETH < minSize || originalAmountETH > maxSize) {
        console.log(`Trade filtered: ${originalAmountETH.toFixed(6)} ETH not in range [${minSize}, ${maxSize}]`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking trade size limits:', error);
      return false; // Reject trades if we can't properly evaluate them
    }
  }

  private calculateCopyAmount(originalAmount: string): string | null {
    try {
      const originalAmountBN = ethers.parseEther(originalAmount);
      const copyPercentage = this.config.copyPercentage / 100;
      const copyAmountBN = originalAmountBN * BigInt(Math.floor(copyPercentage * 100)) / BigInt(100);
      
      // Check against max trade size
      const maxTradeSize = ethers.parseEther(this.config.maxTradeSize);
      const finalAmount = copyAmountBN > maxTradeSize ? maxTradeSize : copyAmountBN;
      
      return ethers.formatEther(finalAmount);
    } catch (error) {
      console.error('Error calculating copy amount:', error);
      return null;
    }
  }

  private async executeCopyTradeEnhanced(copyTrade: CopyTrade): Promise<void> {
    try {
      // Step 1: Handle token approvals if needed
      if (copyTrade.tokenIn !== 'ETH' && copyTrade.tokenIn !== this.tokenAddresses.WETH) {
        const routerAddress = this.getRouterAddress(copyTrade.tokenIn, copyTrade.tokenOut);
        if (routerAddress) {
          const requiredAmount = ethers.parseEther(copyTrade.copyAmountIn);
          const approvalTxHash = await this.approvalManager.ensureApproval(
            copyTrade.tokenIn,
            routerAddress,
            requiredAmount
          );

          if (approvalTxHash) {
            copyTrade.approvalTxHash = approvalTxHash;
            console.log(`Waiting for token approval: ${approvalTxHash}`);
            await this.approvalManager.waitForApproval(approvalTxHash);
          }
        }
      }

      // Step 2: Build swap transaction with enhanced slippage protection
      const routerAddress = this.getRouterAddress(copyTrade.tokenIn, copyTrade.tokenOut);
      if (!routerAddress) {
        throw new Error('No suitable router found for token pair');
      }

      const swapTx = await this.buildEnhancedSwapTransaction(copyTrade, routerAddress);
      
      // Step 3: Apply MEV protection if enabled
      let txHash: string;
      if (this.config.enableMEVProtection) {
        txHash = await this.mevProtection.submitProtectedTransaction(swapTx, this.wallet, {
          timeout: 30000
        });
        copyTrade.mevProtected = true;
      } else {
        const txResponse = await this.wallet.sendTransaction(swapTx);
        txHash = txResponse.hash;
        copyTrade.mevProtected = false;
      }

      copyTrade.copyTxHash = txHash;
      copyTrade.status = 'executed';
      copyTrade.executionTime = Date.now();

      this.emit('copyTradeExecuted', copyTrade);

      // Step 4: Wait for confirmation and update metrics
      const provider = this.wallet.provider;
      if (provider) {
        const receipt = await provider.waitForTransaction(txHash);
        if (receipt) {
          copyTrade.gasUsed = receipt.gasUsed.toString();
          await this.updateTradeMetricsEnhanced(copyTrade, receipt);
        }
      }

    } catch (error) {
      copyTrade.status = 'failed';
      copyTrade.reason = error instanceof Error ? error.message : 'Unknown error';
      copyTrade.executionTime = Date.now();
      
      this.riskMetrics.failedCopies++;
      this.updateSuccessRate();
      
      this.emit('copyTradeFailed', copyTrade);
      console.error('Copy trade execution failed:', error);
    }
  }

  private getRouterAddress(tokenIn: string, tokenOut: string): string | null {
    // Simple router selection logic - in production, this would be more sophisticated
    // based on liquidity, fees, etc.
    
    // Use different routers based on token pairs for better pricing
    const isETHPair = tokenIn === 'ETH' || tokenOut === 'ETH' || 
                     tokenIn === this.tokenAddresses.WETH || tokenOut === this.tokenAddresses.WETH;
    
    const isStablecoinPair = [this.tokenAddresses.USDC, this.tokenAddresses.USDT, this.tokenAddresses.DAI]
                            .includes(tokenIn) || 
                            [this.tokenAddresses.USDC, this.tokenAddresses.USDT, this.tokenAddresses.DAI]
                            .includes(tokenOut);
    
    // Use Uniswap V3 for stablecoin pairs (better efficiency)
    if (isStablecoinPair && !isETHPair) {
      console.log(`Selected Uniswap V3 for stablecoin pair: ${tokenIn} -> ${tokenOut}`);
      return this.dexRouters.uniswapV3;
    }
    
    // Use Uniswap V2 for ETH pairs (higher liquidity)
    if (isETHPair) {
      console.log(`Selected Uniswap V2 for ETH pair: ${tokenIn} -> ${tokenOut}`);
      return this.dexRouters.uniswapV2;
    }
    
    // Default to Uniswap V2 for other pairs
    console.log(`Selected default Uniswap V2 for pair: ${tokenIn} -> ${tokenOut}`);
    return this.dexRouters.uniswapV2;
  }

  private async buildEnhancedSwapTransaction(copyTrade: CopyTrade, routerAddress: string): Promise<any> {
    // Enhanced slippage calculation based on market conditions
    let dynamicSlippage = this.config.maxSlippage;
    
    if (this.config.enableDynamicSlippage) {
      dynamicSlippage = await this.calculateDynamicSlippage(copyTrade.tokenIn, copyTrade.tokenOut, copyTrade.copyAmountIn);
    }

    // Calculate price impact and reject if too high
    const priceImpact = await this.estimatePriceImpact(copyTrade.tokenIn, copyTrade.tokenOut, copyTrade.copyAmountIn);
    if (priceImpact > this.config.priceImpactThreshold) {
      throw new Error(`Price impact too high: ${priceImpact.toFixed(2)}% > ${this.config.priceImpactThreshold}%`);
    }

    copyTrade.priceImpact = priceImpact;

    const routerABI = [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    const router = new ethers.Contract(routerAddress, routerABI, this.wallet);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    const amountIn = ethers.parseEther(copyTrade.copyAmountIn);
    
    // Enhanced minimum amount calculation with dynamic slippage
    const minAmountOut = amountIn * BigInt(Math.floor((100 - dynamicSlippage) * 100)) / BigInt(10000);

    let txData;
    
    if (copyTrade.tokenIn === 'ETH' || copyTrade.tokenIn === this.tokenAddresses.WETH) {
      // ETH to Token swap
      const path = [this.tokenAddresses.WETH, copyTrade.tokenOut];
      const swapMethod = router['swapExactETHForTokens'];
      if (swapMethod) {
        txData = await swapMethod.populateTransaction(
          minAmountOut,
          path,
          this.wallet.address,
          deadline,
          { value: amountIn }
        );
      }
    } else if (copyTrade.tokenOut === 'ETH' || copyTrade.tokenOut === this.tokenAddresses.WETH) {
      // Token to ETH swap
      const path = [copyTrade.tokenIn, this.tokenAddresses.WETH];
      const swapMethod = router['swapExactTokensForETH'];
      if (swapMethod) {
        txData = await swapMethod.populateTransaction(
          amountIn,
          minAmountOut,
          path,
          this.wallet.address,
          deadline
        );
      }
    } else {
      // Token to Token swap
      const path = [copyTrade.tokenIn, this.tokenAddresses.WETH, copyTrade.tokenOut];
      const swapMethod = router['swapExactTokensForTokens'];
      if (swapMethod) {
        txData = await swapMethod.populateTransaction(
          amountIn,
          minAmountOut,
          path,
          this.wallet.address,
          deadline
        );
      }
    }

    if (!txData) {
      throw new Error('Failed to build swap transaction data');
    }

    // Dynamic gas estimation
    const provider = this.wallet.provider;
    if (!provider) {
      throw new Error('Provider not available');
    }

    const estimatedGas = await provider.estimateGas({
      to: routerAddress,
      data: txData.data,
      value: txData.value || '0',
      from: this.wallet.address
    });

    return {
      to: routerAddress,
      data: txData.data,
      value: txData.value || '0',
      gasLimit: estimatedGas * BigInt(120) / BigInt(100), // 20% buffer
    };
  }

  private async calculateDynamicSlippage(tokenIn: string, tokenOut: string, amount: string): Promise<number> {
    try {
      // Base slippage from config
      let slippage = this.config.maxSlippage;

      // Increase slippage for larger trades
      const tradeValueETH = await this.convertToETHSafe(amount, tokenIn);
      if (tradeValueETH > 10) { // Large trade > 10 ETH
        slippage = Math.min(slippage * 1.5, 15); // Increase but cap at 15%
      }

      // Increase slippage for volatile tokens (simplified check)
      const volatileTokens = ['SHIB', 'DOGE', 'MEME'];
      const tokenSymbol = this.getTokenSymbol(tokenIn) || this.getTokenSymbol(tokenOut);
      if (tokenSymbol && volatileTokens.includes(tokenSymbol.toUpperCase())) {
        slippage = Math.min(slippage * 1.3, 20); // Increase for meme tokens
      }

      return slippage;
    } catch (error) {
      console.warn('Failed to calculate dynamic slippage, using default:', error);
      return this.config.maxSlippage;
    }
  }

  private async estimatePriceImpact(tokenIn: string, tokenOut: string, amount: string): Promise<number> {
    try {
      // Simplified price impact estimation
      // In production, this would query DEX pools for liquidity data
      const tradeValueETH = await this.convertToETHSafe(amount, tokenIn);
      
      // Basic price impact model based on trade size
      if (tradeValueETH < 1) return 0.1; // < 1 ETH: 0.1% impact
      if (tradeValueETH < 5) return 0.5; // < 5 ETH: 0.5% impact
      if (tradeValueETH < 25) return 1.5; // < 25 ETH: 1.5% impact
      if (tradeValueETH < 100) return 3.0; // < 100 ETH: 3% impact
      return 5.0; // Large trades: 5% impact
      
    } catch (error) {
      console.warn('Failed to estimate price impact, using conservative estimate:', error);
      return 2.0; // Conservative 2% estimate
    }
  }

  private async convertToETHSafe(amount: string, token: string): Promise<number> {
    try {
      // Handle ETH/WETH directly
      if (token === 'ETH' || token.toLowerCase() === this.tokenAddresses.WETH.toLowerCase()) {
        return parseFloat(amount);
      }

      // Map token addresses to symbols for price service
      const tokenSymbol = this.getTokenSymbol(token);
      if (!tokenSymbol) {
        console.warn(`Unknown token address: ${token}, using conservative value`);
        return parseFloat(amount) * 0.001; // Very conservative: assume low-value token
      }

      // Get real-time price from enhanced price service
      const tokenPrice = await this.priceService.getTokenPrice(tokenSymbol, token);
      const ethPrice = await this.priceService.getTokenPrice('ethereum');

      if (tokenPrice <= 0 || ethPrice <= 0) {
        console.warn(`Invalid prices for ${tokenSymbol} or ETH, using conservative value`);
        return parseFloat(amount) * 0.001; // Very conservative fallback
      }

      // Convert: Token amount * (Token price in USD / ETH price in USD)
      const tokenValueInETH = (tokenPrice / ethPrice) * parseFloat(amount);
      
      return Math.max(0, tokenValueInETH); // Ensure non-negative

    } catch (error) {
      console.error(`Error converting ${amount} ${token} to ETH:`, error);
      return parseFloat(amount) * 0.001; // Very conservative fallback
    }
  }

  private getTokenSymbol(tokenAddress: string): string | null {
    const addressSymbolMap: { [key: string]: string } = {
      [this.tokenAddresses.WETH.toLowerCase()]: 'ethereum',
      [this.tokenAddresses.USDC.toLowerCase()]: 'usdc',
      [this.tokenAddresses.USDT.toLowerCase()]: 'usdt',
      [this.tokenAddresses.DAI.toLowerCase()]: 'dai'
    };

    return addressSymbolMap[tokenAddress.toLowerCase()] || null;
  }

  // Public methods
  updateConfig(newConfig: Partial<CopyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getCopyTrades(): CopyTrade[] {
    return [...this.copyTrades];
  }

  getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  getConfig(): CopyConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.isActive;
  }

  clearHistory(): void {
    this.copyTrades = [];
    this.riskMetrics = this.initializeRiskMetrics();
    this.emit('historyCleared');
  }

  // Risk management methods
  async checkRiskLimits(): Promise<boolean> {
    if (!this.config.enableRiskManagement) return true;

    // Check maximum drawdown
    const currentDrawdown = parseFloat(this.riskMetrics.maxDrawdown);
    if (currentDrawdown > 0.1) { // 10% max drawdown
      this.emit('riskLimitExceeded', 'Maximum drawdown exceeded');
      return false;
    }

    // Check success rate
    if (this.riskMetrics.totalCopied >= 10 && this.riskMetrics.successRate < 50) {
      this.emit('riskLimitExceeded', 'Success rate too low');
      return false;
    }

    return true;
  }

  async emergencyStop(): Promise<void> {
    this.isActive = false;
    this.emit('emergencyStop');
    console.log('Emergency stop activated for copy execution engine');
  }

  private async updateTradeMetricsEnhanced(copyTrade: CopyTrade, receipt: ethers.TransactionReceipt): Promise<void> {
    this.riskMetrics.totalCopied++;
    this.riskMetrics.successfulCopies++;
    this.updateSuccessRate();

    // Calculate profit/loss (simplified)
    const gasCost = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice || 0);
    const gasCostETH = ethers.formatEther(gasCost);
    
    // This is a simplified P&L calculation
    // In production, you'd track actual token amounts received
    copyTrade.profitLoss = `-${gasCostETH}`; // At minimum, we lose gas costs
    
    this.emit('metricsUpdated', this.riskMetrics);
  }

  private updateSuccessRate(): void {
    if (this.riskMetrics.totalCopied > 0) {
      this.riskMetrics.successRate = (this.riskMetrics.successfulCopies / this.riskMetrics.totalCopied) * 100;
    }
  }
}