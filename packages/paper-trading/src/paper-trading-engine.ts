import { EventEmitter } from 'events';

export interface PaperTradingConfig {
  initialBalance: { [token: string]: string }; // Token balances
  slippageSimulation: {
    enabled: boolean;
    minSlippage: number; // Minimum slippage percentage
    maxSlippage: number; // Maximum slippage percentage
    volatilityFactor: number; // How much market volatility affects slippage
  };
  latencySimulation: {
    enabled: boolean;
    minLatency: number; // Minimum execution delay in ms
    maxLatency: number; // Maximum execution delay in ms
  };
  failureSimulation: {
    enabled: boolean;
    failureRate: number; // Percentage of trades that fail
    failureTypes: string[]; // Types of failures to simulate
  };
  marketDataSimulation: {
    enabled: boolean;
    priceVolatility: number; // How much prices fluctuate
    spreadSimulation: boolean; // Simulate bid-ask spreads
  };
}

export interface PaperTrade {
  id: string;
  type: 'buy' | 'sell' | 'swap';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  expectedAmountOut: string;
  slippage: number;
  gasEstimate: string;
  gasUsed: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  failureReason?: string;
  timestamp: number;
  executionTime?: number;
  txHash: string; // Simulated transaction hash
}

export interface PaperPortfolio {
  balances: Record<string, string>;
  totalValueUSD: string;
  pnl: {
    realized: string;
    unrealized: string;
    total: string;
  };
  trades: PaperTrade[];
  performance: {
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    totalProfit: string;
    totalLoss: string;
    netProfit: string;
    averageTradeSize: string;
    largestWin: string;
    largestLoss: string;
    winRate: number;
    profitFactor: number;
  };
}

export class PaperTradingEngine extends EventEmitter {
  private config: PaperTradingConfig;
  private portfolio: PaperPortfolio;
  private marketPrices: { [token: string]: number } = {};
  private isRunning = false;

  constructor(config: PaperTradingConfig) {
    super();
    this.config = config;
    this.portfolio = this.initializePortfolio();
    this.startPriceSimulation();
  }

  private initializePortfolio(): PaperPortfolio {
    return {
      balances: { ...this.config.initialBalance },
      totalValueUSD: '0',
      pnl: {
        realized: '0',
        unrealized: '0',
        total: '0'
      },
      trades: [],
      performance: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        successRate: 0,
        totalProfit: '0',
        totalLoss: '0',
        netProfit: '0',
        averageTradeSize: '0',
        largestWin: '0',
        largestLoss: '0',
        winRate: 0,
        profitFactor: 0
      }
    };
  }

  private startPriceSimulation(): void {
    if (!this.config.marketDataSimulation.enabled) return;

    // Initialize some basic token prices
    this.marketPrices = {
      'ETH': 2000,
      'USDC': 1,
      'USDT': 1,
      'WBTC': 35000,
      'SOL': 100,
      'BNB': 300
    };

    // Simulate price movements
    setInterval(() => {
      this.updateMarketPrices();
    }, 5000); // Update every 5 seconds
  }

  private updateMarketPrices(): void {
    const volatility = this.config.marketDataSimulation.priceVolatility;
    
    Object.keys(this.marketPrices).forEach(token => {
      if (token === 'USDC' || token === 'USDT') return; // Stablecoins don't move much
      
      const currentPrice = this.marketPrices[token];
      if (currentPrice !== undefined) {
        const change = (Math.random() - 0.5) * 2 * volatility; // -volatility to +volatility
        const newPrice = currentPrice * (1 + change / 100);
        this.marketPrices[token] = Math.max(newPrice, 0.01); // Prevent negative prices
      }
    });

    this.updatePortfolioValue();
    this.emit('priceUpdate', this.marketPrices);
  }

  private updatePortfolioValue(): void {
    let totalValueUSD = 0;

    Object.entries(this.portfolio.balances).forEach(([token, balance]) => {
      const price = this.marketPrices[token] || 0;
      const value = parseFloat(balance) * price;
      totalValueUSD += value;
    });

    this.portfolio.totalValueUSD = totalValueUSD.toFixed(6);
  }

  async executeTrade(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string,
    maxSlippage: number = 0.5
  ): Promise<PaperTrade> {
    const tradeId = `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create initial trade record
    const trade: PaperTrade = {
      id: tradeId,
      type: 'swap',
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: '0',
      expectedAmountOut: minAmountOut,
      slippage: 0,
      gasEstimate: this.estimateGas(),
      gasUsed: '0',
      status: 'pending',
      timestamp: Date.now(),
      txHash: this.generateTxHash()
    };

    this.portfolio.trades.push(trade);
    this.emit('tradeCreated', trade);

    // Simulate execution delay
    if (this.config.latencySimulation.enabled) {
      const delay = this.simulateLatency();
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check if trade should fail
    if (this.shouldTradeFail()) {
      return this.failTrade(trade);
    }

    // Check if we have sufficient balance
    const balanceIn = parseFloat(this.portfolio.balances[tokenIn] || '0');
    const requiredAmount = parseFloat(amountIn);
    
    if (balanceIn < requiredAmount) {
      return this.failTrade(trade, 'Insufficient balance');
    }

    // Calculate actual amount out with slippage
    const { amountOut, actualSlippage } = this.calculateAmountOut(
      tokenIn,
      tokenOut,
      amountIn,
      maxSlippage
    );

    // Check if slippage is acceptable
    if (parseFloat(amountOut) < parseFloat(minAmountOut)) {
      return this.failTrade(trade, 'Slippage too high');
    }

    // Execute the trade
    trade.amountOut = amountOut;
    trade.slippage = actualSlippage;
    trade.gasUsed = this.simulateGasUsage(trade.gasEstimate);
    trade.status = 'completed';
    trade.executionTime = Date.now();

    // Update balances
    this.updateBalance(tokenIn, `-${amountIn}`);
    this.updateBalance(tokenOut, `+${amountOut}`);

    // Update performance metrics
    this.updatePerformanceMetrics(trade);

    this.emit('tradeCompleted', trade);
    return trade;
  }

  private shouldTradeFail(): boolean {
    if (!this.config.failureSimulation.enabled) return false;
    return Math.random() * 100 < this.config.failureSimulation.failureRate;
  }

  private failTrade(trade: PaperTrade, reason?: string): PaperTrade {
    trade.status = 'failed';
    trade.failureReason = reason || this.getRandomFailureReason();
    trade.executionTime = Date.now();
    
    this.portfolio.performance.failedTrades++;
    this.portfolio.performance.totalTrades++;
    this.updateSuccessRate();

    this.emit('tradeFailed', trade);
    return trade;
  }

  private getRandomFailureReason(): string {
    const reasons = this.config.failureSimulation.failureTypes.length > 0 
      ? this.config.failureSimulation.failureTypes 
      : [
          'Network congestion',
          'Gas price too low',
          'Slippage exceeded',
          'Pool liquidity insufficient',
          'Transaction reverted',
          'MEV frontrun'
        ];
    
    return reasons[Math.floor(Math.random() * reasons.length)]!;
  }

  private simulateLatency(): number {
    const { minLatency, maxLatency } = this.config.latencySimulation;
    return minLatency + Math.random() * (maxLatency - minLatency);
  }

  private calculateAmountOut(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    maxSlippage: number
  ): { amountOut: string; actualSlippage: number } {
    const priceIn = this.marketPrices[tokenIn] || 1;
    const priceOut = this.marketPrices[tokenOut] || 1;
    
    // Basic exchange rate
    const baseAmountOut = (parseFloat(amountIn) * priceIn) / priceOut;
    
    // Simulate slippage
    let actualSlippage = 0;
    if (this.config.slippageSimulation.enabled) {
      const { minSlippage, maxSlippage: maxSlippageConfig, volatilityFactor } = this.config.slippageSimulation;
      const marketVolatility = this.calculateMarketVolatility(tokenOut);
      const volatilityAdjustment = marketVolatility * volatilityFactor;
      
      actualSlippage = minSlippage + 
        Math.random() * (Math.min(maxSlippageConfig, maxSlippage) - minSlippage) +
        volatilityAdjustment;
    }
    
    const amountOut = baseAmountOut * (1 - actualSlippage / 100);
    
    return {
      amountOut: amountOut.toFixed(6),
      actualSlippage: parseFloat(actualSlippage.toFixed(4))
    };
  }

  private calculateMarketVolatility(token: string): number {
    // Simple volatility calculation based on recent price movements
    // In a real implementation, this would use historical data
    const baseVolatility: { [key: string]: number } = {
      'ETH': 0.02,
      'WBTC': 0.015,
      'SOL': 0.03,
      'BNB': 0.025,
      'USDC': 0.001,
      'USDT': 0.001
    };
    
    return baseVolatility[token] || 0.02;
  }

  private estimateGas(): string {
    // Simulate gas estimation
    const baseGas = 150000;
    const variation = baseGas * 0.2; // ±20% variation
    const gas = baseGas + (Math.random() - 0.5) * variation;
    return Math.round(gas).toString();
  }

  private simulateGasUsage(estimate: string): string {
    // Actual gas usage is usually slightly different from estimate
    const estimated = parseFloat(estimate);
    const variation = estimated * 0.1; // ±10% variation
    const actual = estimated + (Math.random() - 0.5) * variation;
    return Math.round(actual).toString();
  }

  private generateTxHash(): string {
    return '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private updateBalance(token: string, change: string): void {
    const currentBalanceStr = this.portfolio.balances[token];
    const currentBalance = parseFloat(currentBalanceStr ?? '0');
    const changeAmount = parseFloat(change.replace('+', ''));
    const newBalance = currentBalance + changeAmount;
    
    this.portfolio.balances[token] = Math.max(0, newBalance).toFixed(6);
  }

  private updatePerformanceMetrics(trade: PaperTrade): void {
    const perf = this.portfolio.performance;
    
    perf.totalTrades++;
    if (trade.status === 'completed') {
      perf.successfulTrades++;
    }
    
    this.updateSuccessRate();
    
    // Calculate profit/loss for this trade
    const profit = this.calculateTradeProfit(trade);
    if (profit > 0) {
      perf.totalProfit = (parseFloat(perf.totalProfit) + profit).toFixed(6);
      if (profit > parseFloat(perf.largestWin)) {
        perf.largestWin = profit.toFixed(6);
      }
    } else {
      perf.totalLoss = (parseFloat(perf.totalLoss) + Math.abs(profit)).toFixed(6);
      if (Math.abs(profit) > parseFloat(perf.largestLoss)) {
        perf.largestLoss = Math.abs(profit).toFixed(6);
      }
    }
    
    perf.netProfit = (parseFloat(perf.totalProfit) - parseFloat(perf.totalLoss)).toFixed(6);
    
    // Update other metrics
    const completedTrades = this.portfolio.trades.filter(t => t.status === 'completed');
    const totalVolume = completedTrades.reduce((sum, t) => sum + parseFloat(t.amountIn), 0);
    perf.averageTradeSize = completedTrades.length > 0 ? (totalVolume / completedTrades.length).toFixed(6) : '0';
    
    const wins = completedTrades.filter(t => this.calculateTradeProfit(t) > 0).length;
    perf.winRate = completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
    
    const totalWins = parseFloat(perf.totalProfit);
    const totalLosses = parseFloat(perf.totalLoss);
    perf.profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  }

  private updateSuccessRate(): void {
    const perf = this.portfolio.performance;
    perf.successRate = perf.totalTrades > 0 ? (perf.successfulTrades / perf.totalTrades) * 100 : 0;
  }

  private calculateTradeProfit(trade: PaperTrade): number {
    if (trade.status !== 'completed') return 0;
    
    const priceIn = this.marketPrices[trade.tokenIn] || 1;
    const priceOut = this.marketPrices[trade.tokenOut] || 1;
    
    const valueIn = parseFloat(trade.amountIn) * priceIn;
    const valueOut = parseFloat(trade.amountOut) * priceOut;
    const gasCost = parseFloat(trade.gasUsed) * 20e-9 * 2000; // Assume 20 gwei gas price, ETH at $2000
    
    return valueOut - valueIn - gasCost;
  }

  // Public methods
  getPortfolio(): PaperPortfolio {
    this.updatePortfolioValue();
    return { ...this.portfolio };
  }

  getBalance(token: string): string {
    const balance = this.portfolio.balances[token];
    return (balance ?? '0') as string;
  }

  getMarketPrice(token: string): number {
    return this.marketPrices[token] || 0;
  }

  getAllPrices(): { [token: string]: number } {
    return { ...this.marketPrices };
  }

  setMarketPrice(token: string, price: number): void {
    this.marketPrices[token] = price;
    this.updatePortfolioValue();
    this.emit('priceUpdate', this.marketPrices);
  }

  addBalance(token: string, amount: string): void {
    this.updateBalance(token, `+${amount}`);
  }

  reset(): void {
    this.portfolio = this.initializePortfolio();
    this.emit('portfolioReset');
  }

  start(): void {
    this.isRunning = true;
    this.emit('started');
  }

  stop(): void {
    this.isRunning = false;
    this.emit('stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }
}