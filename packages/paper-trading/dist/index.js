"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  PaperTradingEngine: () => PaperTradingEngine
});
module.exports = __toCommonJS(src_exports);

// src/paper-trading-engine.ts
var import_events = require("events");
var PaperTradingEngine = class extends import_events.EventEmitter {
  config;
  portfolio;
  marketPrices = {};
  isRunning = false;
  constructor(config) {
    super();
    this.config = config;
    this.portfolio = this.initializePortfolio();
    this.startPriceSimulation();
  }
  initializePortfolio() {
    return {
      balances: { ...this.config.initialBalance },
      totalValueUSD: "0",
      pnl: {
        realized: "0",
        unrealized: "0",
        total: "0"
      },
      trades: [],
      performance: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        successRate: 0,
        totalProfit: "0",
        totalLoss: "0",
        netProfit: "0",
        averageTradeSize: "0",
        largestWin: "0",
        largestLoss: "0",
        winRate: 0,
        profitFactor: 0
      }
    };
  }
  startPriceSimulation() {
    if (!this.config.marketDataSimulation.enabled)
      return;
    this.marketPrices = {
      "ETH": 2e3,
      "USDC": 1,
      "USDT": 1,
      "WBTC": 35e3,
      "SOL": 100,
      "BNB": 300
    };
    setInterval(() => {
      this.updateMarketPrices();
    }, 5e3);
  }
  updateMarketPrices() {
    const volatility = this.config.marketDataSimulation.priceVolatility;
    Object.keys(this.marketPrices).forEach((token) => {
      if (token === "USDC" || token === "USDT")
        return;
      const currentPrice = this.marketPrices[token];
      const change = (Math.random() - 0.5) * 2 * volatility;
      const newPrice = currentPrice * (1 + change / 100);
      this.marketPrices[token] = Math.max(newPrice, 0.01);
    });
    this.updatePortfolioValue();
    this.emit("priceUpdate", this.marketPrices);
  }
  updatePortfolioValue() {
    let totalValueUSD = 0;
    Object.entries(this.portfolio.balances).forEach(([token, balance]) => {
      const price = this.marketPrices[token] || 0;
      const value = parseFloat(balance) * price;
      totalValueUSD += value;
    });
    this.portfolio.totalValueUSD = totalValueUSD.toFixed(6);
  }
  async executeTrade(tokenIn, tokenOut, amountIn, minAmountOut, maxSlippage = 0.5) {
    const tradeId = `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trade = {
      id: tradeId,
      type: "swap",
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: "0",
      expectedAmountOut: minAmountOut,
      slippage: 0,
      gasEstimate: this.estimateGas(),
      gasUsed: "0",
      status: "pending",
      timestamp: Date.now(),
      txHash: this.generateTxHash()
    };
    this.portfolio.trades.push(trade);
    this.emit("tradeCreated", trade);
    if (this.config.latencySimulation.enabled) {
      const delay = this.simulateLatency();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (this.shouldTradeFail()) {
      return this.failTrade(trade);
    }
    const balanceIn = parseFloat(this.portfolio.balances[tokenIn] || "0");
    const requiredAmount = parseFloat(amountIn);
    if (balanceIn < requiredAmount) {
      return this.failTrade(trade, "Insufficient balance");
    }
    const { amountOut, actualSlippage } = this.calculateAmountOut(
      tokenIn,
      tokenOut,
      amountIn,
      maxSlippage
    );
    if (parseFloat(amountOut) < parseFloat(minAmountOut)) {
      return this.failTrade(trade, "Slippage too high");
    }
    trade.amountOut = amountOut;
    trade.slippage = actualSlippage;
    trade.gasUsed = this.simulateGasUsage(trade.gasEstimate);
    trade.status = "completed";
    trade.executionTime = Date.now();
    this.updateBalance(tokenIn, `-${amountIn}`);
    this.updateBalance(tokenOut, `+${amountOut}`);
    this.updatePerformanceMetrics(trade);
    this.emit("tradeCompleted", trade);
    return trade;
  }
  shouldTradeFail() {
    if (!this.config.failureSimulation.enabled)
      return false;
    return Math.random() * 100 < this.config.failureSimulation.failureRate;
  }
  failTrade(trade, reason) {
    trade.status = "failed";
    trade.failureReason = reason || this.getRandomFailureReason();
    trade.executionTime = Date.now();
    this.portfolio.performance.failedTrades++;
    this.portfolio.performance.totalTrades++;
    this.updateSuccessRate();
    this.emit("tradeFailed", trade);
    return trade;
  }
  getRandomFailureReason() {
    const reasons = this.config.failureSimulation.failureTypes.length > 0 ? this.config.failureSimulation.failureTypes : [
      "Network congestion",
      "Gas price too low",
      "Slippage exceeded",
      "Pool liquidity insufficient",
      "Transaction reverted",
      "MEV frontrun"
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }
  simulateLatency() {
    const { minLatency, maxLatency } = this.config.latencySimulation;
    return minLatency + Math.random() * (maxLatency - minLatency);
  }
  calculateAmountOut(tokenIn, tokenOut, amountIn, maxSlippage) {
    const priceIn = this.marketPrices[tokenIn] || 1;
    const priceOut = this.marketPrices[tokenOut] || 1;
    const baseAmountOut = parseFloat(amountIn) * priceIn / priceOut;
    let actualSlippage = 0;
    if (this.config.slippageSimulation.enabled) {
      const { minSlippage, maxSlippage: maxSlippageConfig, volatilityFactor } = this.config.slippageSimulation;
      const marketVolatility = this.calculateMarketVolatility(tokenOut);
      const volatilityAdjustment = marketVolatility * volatilityFactor;
      actualSlippage = minSlippage + Math.random() * (Math.min(maxSlippageConfig, maxSlippage) - minSlippage) + volatilityAdjustment;
    }
    const amountOut = baseAmountOut * (1 - actualSlippage / 100);
    return {
      amountOut: amountOut.toFixed(6),
      actualSlippage: parseFloat(actualSlippage.toFixed(4))
    };
  }
  calculateMarketVolatility(token) {
    const baseVolatility = {
      "ETH": 0.02,
      "WBTC": 0.015,
      "SOL": 0.03,
      "BNB": 0.025,
      "USDC": 1e-3,
      "USDT": 1e-3
    };
    return baseVolatility[token] || 0.02;
  }
  estimateGas() {
    const baseGas = 15e4;
    const variation = baseGas * 0.2;
    const gas = baseGas + (Math.random() - 0.5) * variation;
    return Math.round(gas).toString();
  }
  simulateGasUsage(estimate) {
    const estimated = parseFloat(estimate);
    const variation = estimated * 0.1;
    const actual = estimated + (Math.random() - 0.5) * variation;
    return Math.round(actual).toString();
  }
  generateTxHash() {
    return "0x" + Array.from(
      { length: 64 },
      () => Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }
  updateBalance(token, change) {
    const currentBalance = parseFloat(this.portfolio.balances[token] || "0");
    const changeAmount = parseFloat(change.replace("+", ""));
    const newBalance = currentBalance + changeAmount;
    this.portfolio.balances[token] = Math.max(0, newBalance).toFixed(6);
  }
  updatePerformanceMetrics(trade) {
    const perf = this.portfolio.performance;
    perf.totalTrades++;
    if (trade.status === "completed") {
      perf.successfulTrades++;
    }
    this.updateSuccessRate();
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
    const completedTrades = this.portfolio.trades.filter((t) => t.status === "completed");
    const totalVolume = completedTrades.reduce((sum, t) => sum + parseFloat(t.amountIn), 0);
    perf.averageTradeSize = completedTrades.length > 0 ? (totalVolume / completedTrades.length).toFixed(6) : "0";
    const wins = completedTrades.filter((t) => this.calculateTradeProfit(t) > 0).length;
    perf.winRate = completedTrades.length > 0 ? wins / completedTrades.length * 100 : 0;
    const totalWins = parseFloat(perf.totalProfit);
    const totalLosses = parseFloat(perf.totalLoss);
    perf.profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  }
  updateSuccessRate() {
    const perf = this.portfolio.performance;
    perf.successRate = perf.totalTrades > 0 ? perf.successfulTrades / perf.totalTrades * 100 : 0;
  }
  calculateTradeProfit(trade) {
    if (trade.status !== "completed")
      return 0;
    const priceIn = this.marketPrices[trade.tokenIn] || 1;
    const priceOut = this.marketPrices[trade.tokenOut] || 1;
    const valueIn = parseFloat(trade.amountIn) * priceIn;
    const valueOut = parseFloat(trade.amountOut) * priceOut;
    const gasCost = parseFloat(trade.gasUsed) * 2e-8 * 2e3;
    return valueOut - valueIn - gasCost;
  }
  // Public methods
  getPortfolio() {
    this.updatePortfolioValue();
    return { ...this.portfolio };
  }
  getBalance(token) {
    return this.portfolio.balances[token] || "0";
  }
  getMarketPrice(token) {
    return this.marketPrices[token] || 0;
  }
  getAllPrices() {
    return { ...this.marketPrices };
  }
  setMarketPrice(token, price) {
    this.marketPrices[token] = price;
    this.updatePortfolioValue();
    this.emit("priceUpdate", this.marketPrices);
  }
  addBalance(token, amount) {
    this.updateBalance(token, `+${amount}`);
  }
  reset() {
    this.portfolio = this.initializePortfolio();
    this.emit("portfolioReset");
  }
  start() {
    this.isRunning = true;
    this.emit("started");
  }
  stop() {
    this.isRunning = false;
    this.emit("stopped");
  }
  isActive() {
    return this.isRunning;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PaperTradingEngine
});
