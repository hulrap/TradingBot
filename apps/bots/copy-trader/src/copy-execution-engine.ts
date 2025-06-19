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
}

// Simple price service for copy execution
class SimplePriceService {
  private cache = new Map<string, { price: number; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  async getTokenPrice(symbol: string): Promise<number> {
    const cacheKey = symbol.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    try {
      // Try CoinGecko first
      const price = await this.fetchFromCoinGecko(symbol);
      if (price > 0) {
        this.cache.set(cacheKey, { price, timestamp: Date.now() });
        return price;
      }
    } catch (error) {
      console.warn(`Failed to fetch price for ${symbol}:`, error);
    }

    // Fallback to conservative estimate
    return this.getFallbackPrice(symbol);
  }

  private async fetchFromCoinGecko(symbol: string): Promise<number> {
    const coinGeckoIds: { [symbol: string]: string } = {
      'ethereum': 'ethereum',
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'weth': 'ethereum',
      'usdc': 'usd-coin',
      'usdt': 'tether',
      'dai': 'dai'
    };

    const coinId = coinGeckoIds[symbol.toLowerCase()];
    if (!coinId) throw new Error(`Unknown symbol: ${symbol}`);

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    
    if (!response.ok) throw new Error('CoinGecko API error');
    
    const data: any = await response.json();
    return data[coinId]?.usd || 0;
  }

  private getFallbackPrice(symbol: string): number {
    const fallbackPrices: { [symbol: string]: number } = {
      'ethereum': 2500,
      'eth': 2500,
      'weth': 2500,
      'btc': 45000,
      'usdc': 1,
      'usdt': 1,
      'dai': 1
    };

    return fallbackPrices[symbol.toLowerCase()] || 1;
  }
}

export class CopyExecutionEngine extends EventEmitter {
  private config: CopyConfig;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private priceService: SimplePriceService;
  private copyTrades: CopyTrade[] = [];
  private isActive = false;
  private riskMetrics: RiskMetrics;

  // DEX router addresses (Ethereum mainnet)
  private dexRouters = {
    uniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    pancakeswap: '0x10ED43C718714eb63d5aA57B78B54704E256024E'
  };

  // Token addresses for common tokens
  private tokenAddresses = {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6417c7962A0FF7c4BfB9D8e95D5b9C9',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  };

  constructor(config: CopyConfig, provider: ethers.JsonRpcProvider, privateKey: string) {
    super();
    this.config = config;
    this.provider = provider;
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.priceService = new SimplePriceService();
    this.riskMetrics = this.initializeRiskMetrics();
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
      sharpeRatio: 0
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
    await this.executeCopyTrade(copyTrade);
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
      const originalAmountETH = await this.convertToETH(copyTrade.originalAmountIn, copyTrade.tokenIn);
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

  private async executeCopyTrade(copyTrade: CopyTrade): Promise<void> {
    try {
      // Get the appropriate router contract
      const routerAddress = this.getRouterAddress(copyTrade.tokenIn, copyTrade.tokenOut);
      if (!routerAddress) {
        throw new Error('No suitable router found for token pair');
      }

      // Build the swap transaction
      const swapTx = await this.buildSwapTransaction(copyTrade, routerAddress);
      
      // Check gas price
      const currentGasPrice = await this.provider.getFeeData();
      const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
      
      if (currentGasPrice.gasPrice && currentGasPrice.gasPrice > maxGasPrice) {
        throw new Error('Gas price too high');
      }

      // Execute transaction
      const txResponse = await this.wallet.sendTransaction(swapTx);
      copyTrade.copyTxHash = txResponse.hash;
      copyTrade.status = 'executed';
      copyTrade.executionTime = Date.now();

      this.emit('copyTradeExecuted', copyTrade);

      // Wait for confirmation and update metrics
      const receipt = await txResponse.wait();
      if (receipt) {
        copyTrade.gasUsed = receipt.gasUsed.toString();
        await this.updateTradeMetrics(copyTrade, receipt);
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

  private async buildSwapTransaction(copyTrade: CopyTrade, routerAddress: string): Promise<any> {
    // This is a simplified swap transaction builder
    // In production, you'd use proper DEX SDKs and routing algorithms
    
    const routerABI = [
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    const router = new ethers.Contract(routerAddress, routerABI, this.wallet);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    const amountIn = ethers.parseEther(copyTrade.copyAmountIn);
    const minAmountOut = amountIn * BigInt(100 - this.config.maxSlippage) / BigInt(100); // Simple slippage calculation

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

    return {
      to: routerAddress,
      data: txData.data,
      value: txData.value || '0',
      gasLimit: 300000, // Conservative gas limit
    };
  }

  private async updateTradeMetrics(copyTrade: CopyTrade, receipt: ethers.TransactionReceipt): Promise<void> {
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

  private async convertToETH(amount: string, token: string): Promise<number> {
    try {
      // Handle ETH/WETH directly
      if (token === 'ETH' || token.toLowerCase() === this.tokenAddresses.WETH.toLowerCase()) {
        return parseFloat(amount);
      }

      // Map token addresses to symbols for price service
      const tokenSymbol = this.getTokenSymbol(token);
      if (!tokenSymbol) {
        console.warn(`Unknown token address: ${token}, using fallback price`);
        return parseFloat(amount) * 0.0005; // Conservative fallback: 1 token = $1
      }

      // Get real-time price from service
      const tokenPrice = await this.priceService.getTokenPrice(tokenSymbol);
      const ethPrice = await this.priceService.getTokenPrice('ethereum');

      if (tokenPrice <= 0 || ethPrice <= 0) {
        console.warn(`Invalid prices for ${tokenSymbol} or ETH, using fallback`);
        return parseFloat(amount) * 0.0005; // Conservative fallback
      }

      // Convert: Token amount * (Token price in USD / ETH price in USD)
      const tokenValueInETH = (tokenPrice / ethPrice) * parseFloat(amount);
      
      // Log the conversion for audit trail
      console.log(`Price conversion: ${amount} ${tokenSymbol} = ${tokenValueInETH.toFixed(6)} ETH`);
      console.log(`  ${tokenSymbol} price: $${tokenPrice.toFixed(2)}`);
      console.log(`  ETH price: $${ethPrice.toFixed(2)}`);
      
      return tokenValueInETH;

    } catch (error) {
      console.error('Error converting token amount to ETH:', error);
      // Return conservative fallback to prevent trades with wrong amounts
      return parseFloat(amount) * 0.0005;
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
}