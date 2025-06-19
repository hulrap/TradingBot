import { EventEmitter } from 'events';

interface PaperTradingConfig {
    initialBalance: {
        [token: string]: string;
    };
    slippageSimulation: {
        enabled: boolean;
        minSlippage: number;
        maxSlippage: number;
        volatilityFactor: number;
    };
    latencySimulation: {
        enabled: boolean;
        minLatency: number;
        maxLatency: number;
    };
    failureSimulation: {
        enabled: boolean;
        failureRate: number;
        failureTypes: string[];
    };
    marketDataSimulation: {
        enabled: boolean;
        priceVolatility: number;
        spreadSimulation: boolean;
    };
}
interface PaperTrade {
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
    txHash: string;
}
interface PaperPortfolio {
    balances: {
        [token: string]: string;
    };
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
declare class PaperTradingEngine extends EventEmitter {
    private config;
    private portfolio;
    private marketPrices;
    private isRunning;
    constructor(config: PaperTradingConfig);
    private initializePortfolio;
    private startPriceSimulation;
    private updateMarketPrices;
    private updatePortfolioValue;
    executeTrade(tokenIn: string, tokenOut: string, amountIn: string, minAmountOut: string, maxSlippage?: number): Promise<PaperTrade>;
    private shouldTradeFail;
    private failTrade;
    private getRandomFailureReason;
    private simulateLatency;
    private calculateAmountOut;
    private calculateMarketVolatility;
    private estimateGas;
    private simulateGasUsage;
    private generateTxHash;
    private updateBalance;
    private updatePerformanceMetrics;
    private updateSuccessRate;
    private calculateTradeProfit;
    getPortfolio(): PaperPortfolio;
    getBalance(token: string): string;
    getMarketPrice(token: string): number;
    getAllPrices(): {
        [token: string]: number;
    };
    setMarketPrice(token: string, price: number): void;
    addBalance(token: string, amount: string): void;
    reset(): void;
    start(): void;
    stop(): void;
    isActive(): boolean;
}

export { type PaperPortfolio, type PaperTrade, type PaperTradingConfig, PaperTradingEngine };
