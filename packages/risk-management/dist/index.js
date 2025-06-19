'use strict';

var EventEmitter = require('eventemitter3');
var zod = require('zod');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var EventEmitter__default = /*#__PURE__*/_interopDefault(EventEmitter);

// src/global-kill-switch.ts
var KillSwitchConfigSchema = zod.z.object({
  enableAutoTrigger: zod.z.boolean(),
  maxDailyLoss: zod.z.number().positive(),
  maxDrawdown: zod.z.number().min(0).max(100),
  maxConsecutiveFailures: zod.z.number().positive(),
  emergencyContacts: zod.z.array(zod.z.string().email()),
  gracefulShutdownTimeout: zod.z.number().positive(),
  forceShutdownAfter: zod.z.number().positive()
});
var GlobalKillSwitch = class extends EventEmitter__default.default {
  config;
  isTriggered = false;
  isActive = true;
  triggerHistory = [];
  currentMode = "normal";
  activeBots = /* @__PURE__ */ new Set();
  consecutiveFailures = 0;
  dailyLoss = 0;
  currentDrawdown = 0;
  lastReset = /* @__PURE__ */ new Date();
  shutdownTimers = /* @__PURE__ */ new Map();
  constructor(config) {
    super();
    this.validateConfig(config);
    this.config = config;
    this.setupDailyReset();
    this.startHealthMonitoring();
  }
  /**
   * Manually trigger the kill switch with reason
   */
  async triggerKillSwitch(reason, severity = "high", triggeredBy = "user") {
    if (this.isTriggered) {
      console.warn("Kill switch already triggered");
      return;
    }
    const event = {
      type: "triggered",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      reason,
      triggeredBy,
      severity,
      metadata: {
        activeBots: this.activeBots.size,
        dailyLoss: this.dailyLoss,
        currentDrawdown: this.currentDrawdown,
        consecutiveFailures: this.consecutiveFailures
      }
    };
    this.isTriggered = true;
    this.currentMode = severity === "critical" ? "emergency" : "recovery";
    this.triggerHistory.push(event);
    console.error(`\u{1F6A8} KILL SWITCH TRIGGERED: ${reason}`);
    console.error(`Severity: ${severity}, Mode: ${this.currentMode}`);
    this.emit("kill-switch-triggered", event);
    if (severity === "critical") {
      await this.forceStopAllBots();
    } else {
      await this.gracefulStopAllBots();
    }
    await this.sendEmergencyNotifications(event);
    await this.logKillSwitchEvent(event);
  }
  /**
   * Check if automatic trigger conditions are met
   */
  checkAutoTriggerConditions() {
    if (!this.config.enableAutoTrigger || this.isTriggered) {
      return;
    }
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      this.triggerKillSwitch(
        `Daily loss limit exceeded: $${this.dailyLoss.toFixed(2)}`,
        "high",
        "system"
      );
      return;
    }
    if (this.currentDrawdown >= this.config.maxDrawdown) {
      this.triggerKillSwitch(
        `Maximum drawdown exceeded: ${this.currentDrawdown.toFixed(2)}%`,
        "high",
        "system"
      );
      return;
    }
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.triggerKillSwitch(
        `Too many consecutive failures: ${this.consecutiveFailures}`,
        "medium",
        "system"
      );
      return;
    }
  }
  /**
   * Register a bot with the kill switch
   */
  registerBot(botId) {
    this.activeBots.add(botId);
    this.emit("bot-registered", { botId, totalBots: this.activeBots.size });
    console.log(`Bot registered: ${botId} (Total: ${this.activeBots.size})`);
  }
  /**
   * Unregister a bot from the kill switch
   */
  unregisterBot(botId) {
    this.activeBots.delete(botId);
    this.clearShutdownTimer(botId);
    this.emit("bot-unregistered", { botId, totalBots: this.activeBots.size });
    console.log(`Bot unregistered: ${botId} (Total: ${this.activeBots.size})`);
  }
  /**
   * Report a trade loss to track daily limits
   */
  reportLoss(amount) {
    this.dailyLoss += amount;
    this.emit("loss-reported", { amount, totalDailyLoss: this.dailyLoss });
    this.updateDrawdown();
    this.checkAutoTriggerConditions();
  }
  /**
   * Report a consecutive failure
   */
  reportFailure(botId, reason) {
    this.consecutiveFailures++;
    this.emit("failure-reported", {
      botId,
      reason,
      consecutiveFailures: this.consecutiveFailures
    });
    console.warn(`Failure reported for ${botId}: ${reason} (${this.consecutiveFailures} consecutive)`);
    this.checkAutoTriggerConditions();
  }
  /**
   * Report a successful trade (resets consecutive failures)
   */
  reportSuccess(botId) {
    this.consecutiveFailures = 0;
    this.emit("success-reported", { botId });
  }
  /**
   * Get current kill switch status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isTriggered: this.isTriggered,
      lastTriggered: this.triggerHistory.length > 0 ? this.triggerHistory[this.triggerHistory.length - 1].timestamp : void 0,
      totalTriggers: this.triggerHistory.length,
      currentMode: this.currentMode,
      systemHealth: this.determineSystemHealth(),
      activeBots: this.activeBots.size,
      emergencyContact: this.config.emergencyContacts.length > 0
    };
  }
  /**
   * Reset the kill switch (must be done manually after investigation)
   */
  async resetKillSwitch(reason, resetBy) {
    if (!this.isTriggered) {
      console.warn("Kill switch is not triggered, no reset needed");
      return;
    }
    const event = {
      type: "recovery_mode",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      reason: `Reset: ${reason}`,
      triggeredBy: "user",
      severity: "low",
      metadata: { resetBy }
    };
    this.isTriggered = false;
    this.currentMode = "recovery";
    this.triggerHistory.push(event);
    console.log(`\u2705 Kill switch reset: ${reason} (by ${resetBy})`);
    this.emit("kill-switch-reset", event);
    await this.logKillSwitchEvent(event);
    setTimeout(() => {
      this.currentMode = "normal";
      this.emit("mode-changed", { mode: "normal" });
    }, 3e4);
  }
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    const updatedConfig = { ...this.config, ...newConfig };
    this.validateConfig(updatedConfig);
    this.config = updatedConfig;
    this.emit("config-updated", updatedConfig);
    console.log("Kill switch configuration updated");
  }
  /**
   * Get kill switch history
   */
  getHistory(limit = 50) {
    return this.triggerHistory.slice(-limit);
  }
  /**
   * Check if kill switch is blocking bot operations
   */
  isOperationAllowed(operation) {
    if (!this.isActive)
      return false;
    if (this.isTriggered && operation !== "stop")
      return false;
    if (this.currentMode === "emergency" && operation !== "stop")
      return false;
    return true;
  }
  // Private methods
  validateConfig(config) {
    const result = KillSwitchConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid kill switch configuration: ${result.error.message}`);
    }
  }
  async gracefulStopAllBots() {
    const stopPromises = [];
    for (const botId of this.activeBots) {
      const promise = this.gracefulStopBot(botId);
      stopPromises.push(promise);
    }
    try {
      await Promise.allSettled(stopPromises);
      console.log("All bots gracefully stopped");
    } catch (error) {
      console.error("Error during graceful stop:", error);
      await this.forceStopAllBots();
    }
  }
  async forceStopAllBots() {
    for (const botId of this.activeBots) {
      this.emit("force-stop-bot", { botId });
      this.unregisterBot(botId);
    }
    console.log("All bots force stopped");
  }
  async gracefulStopBot(botId) {
    return new Promise((resolve, reject) => {
      const gracefulTimer = setTimeout(() => {
        console.warn(`Graceful shutdown timeout for bot ${botId}, forcing stop`);
        this.emit("force-stop-bot", { botId });
        resolve();
      }, this.config.gracefulShutdownTimeout);
      this.shutdownTimers.set(botId, gracefulTimer);
      this.emit("graceful-stop-bot", {
        botId,
        timeout: this.config.gracefulShutdownTimeout
      });
      const forceTimer = setTimeout(() => {
        this.clearShutdownTimer(botId);
        this.emit("force-stop-bot", { botId });
        resolve();
      }, this.config.forceShutdownAfter);
      const handleBotStopped = (event) => {
        if (event.botId === botId) {
          this.clearShutdownTimer(botId);
          clearTimeout(forceTimer);
          this.off("bot-stopped", handleBotStopped);
          resolve();
        }
      };
      this.on("bot-stopped", handleBotStopped);
    });
  }
  clearShutdownTimer(botId) {
    const timer = this.shutdownTimers.get(botId);
    if (timer) {
      clearTimeout(timer);
      this.shutdownTimers.delete(botId);
    }
  }
  updateDrawdown() {
    const dailyLossPercentage = this.dailyLoss / 1e4 * 100;
    this.currentDrawdown = Math.max(this.currentDrawdown, dailyLossPercentage);
  }
  determineSystemHealth() {
    if (this.isTriggered || this.currentMode === "emergency") {
      return "critical";
    }
    if (this.currentMode === "recovery" || this.consecutiveFailures > 3) {
      return "degraded";
    }
    return "healthy";
  }
  setupDailyReset() {
    const now = /* @__PURE__ */ new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
      this.resetDailyCounters();
      setInterval(() => {
        this.resetDailyCounters();
      }, 24 * 60 * 60 * 1e3);
    }, timeUntilMidnight);
  }
  resetDailyCounters() {
    this.dailyLoss = 0;
    this.currentDrawdown = 0;
    this.lastReset = /* @__PURE__ */ new Date();
    this.emit("daily-reset", {
      timestamp: this.lastReset.toISOString()
    });
    console.log("Daily risk counters reset");
  }
  startHealthMonitoring() {
    setInterval(() => {
      this.emit("health-check", this.getStatus());
    }, 3e4);
  }
  async sendEmergencyNotifications(event) {
    console.log("\u{1F6A8} EMERGENCY NOTIFICATION:", {
      contacts: this.config.emergencyContacts,
      event
    });
    this.emit("emergency-notification", {
      event,
      contacts: this.config.emergencyContacts
    });
  }
  async logKillSwitchEvent(event) {
    console.log("Kill switch event logged:", event);
    this.emit("event-logged", event);
  }
  /**
   * Cleanup resources
   */
  destroy() {
    for (const timer of this.shutdownTimers.values()) {
      clearTimeout(timer);
    }
    this.shutdownTimers.clear();
    this.removeAllListeners();
    console.log("Kill switch destroyed");
  }
};
var PositionSizingConfigSchema = zod.z.object({
  baseRiskPerTrade: zod.z.number().min(0.1).max(10),
  maxPositionSize: zod.z.number().min(1).max(50),
  minPositionSize: zod.z.number().positive(),
  volatilityLookback: zod.z.number().min(1).max(90),
  maxDailyRisk: zod.z.number().min(1).max(20),
  correlationThreshold: zod.z.number().min(0).max(1),
  riskScalingMethod: zod.z.enum(["fixed", "volatility", "kelly", "adaptive"]),
  enableDynamicSizing: zod.z.boolean()
});
var PositionSizingEngine = class {
  config;
  portfolioValue;
  currentPositions = /* @__PURE__ */ new Map();
  historicalReturns = [];
  volatilityCache = /* @__PURE__ */ new Map();
  constructor(config, portfolioValue) {
    this.validateConfig(config);
    this.config = config;
    this.portfolioValue = portfolioValue;
  }
  /**
   * Calculate optimal position size for a trade signal
   */
  calculatePositionSize(symbol, signal, marketData, portfolioRisk) {
    let baseSize = this.calculateBaseSize(signal, marketData);
    const volatilityAdjustment = this.calculateVolatilityAdjustment(marketData);
    const liquidityAdjustment = this.calculateLiquidityAdjustment(marketData);
    const correlationAdjustment = this.calculateCorrelationAdjustment(symbol, portfolioRisk);
    const portfolioRiskAdjustment = this.calculatePortfolioRiskAdjustment(portfolioRisk);
    const adjustedSize = baseSize * volatilityAdjustment * liquidityAdjustment * correlationAdjustment * portfolioRiskAdjustment;
    const finalSize = this.applyPositionLimits(adjustedSize, portfolioRisk);
    const riskAmount = this.calculateRiskAmount(finalSize, signal, marketData);
    const stopLoss = this.calculateStopLoss(marketData.price, signal, riskAmount, finalSize);
    const takeProfit = this.calculateTakeProfit(marketData.price, signal);
    const leverage = finalSize / (this.portfolioValue * (this.config.baseRiskPerTrade / 100));
    const riskMetrics = this.calculateRiskMetrics(finalSize, riskAmount, signal, marketData);
    const reasoning = this.generateReasoning(
      baseSize,
      adjustedSize,
      finalSize,
      {
        volatilityAdjustment,
        liquidityAdjustment,
        correlationAdjustment,
        portfolioRiskAdjustment
      }
    );
    return {
      positionSize: Math.round(finalSize * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      leverage: Math.round(leverage * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      reasoning,
      riskMetrics
    };
  }
  /**
   * Calculate base position size using configured method
   */
  calculateBaseSize(signal, marketData) {
    const baseRiskAmount = this.portfolioValue * (this.config.baseRiskPerTrade / 100);
    switch (this.config.riskScalingMethod) {
      case "fixed":
        return baseRiskAmount;
      case "volatility":
        const normalizedVol = Math.max(0.1, Math.min(2, marketData.volatility / 0.3));
        return baseRiskAmount / normalizedVol;
      case "kelly":
        return this.calculateKellySize(signal, marketData, baseRiskAmount);
      case "adaptive":
        return this.calculateAdaptiveSize(signal, marketData, baseRiskAmount);
      default:
        return baseRiskAmount;
    }
  }
  /**
   * Kelly criterion position sizing
   */
  calculateKellySize(signal, marketData, baseAmount) {
    const winProbability = signal.confidence;
    const avgWin = signal.expectedReturn;
    const avgLoss = -signal.expectedReturn / signal.riskReward;
    const b = Math.abs(avgWin / avgLoss);
    const kellyFraction = (b * winProbability - (1 - winProbability)) / b;
    const safeKellyFraction = Math.max(0, Math.min(0.25, kellyFraction * 0.25));
    return this.portfolioValue * safeKellyFraction;
  }
  /**
   * Adaptive position sizing based on recent performance
   */
  calculateAdaptiveSize(signal, marketData, baseAmount) {
    const recentPerformance = this.calculateRecentPerformance();
    const performanceMultiplier = Math.max(0.5, Math.min(2, recentPerformance));
    const confidenceMultiplier = 0.5 + signal.confidence * 0.5;
    return baseAmount * performanceMultiplier * confidenceMultiplier;
  }
  /**
   * Calculate volatility adjustment factor
   */
  calculateVolatilityAdjustment(marketData) {
    const normalizedVol = marketData.volatility / 0.3;
    return Math.max(0.2, Math.min(2, 1 / Math.sqrt(normalizedVol)));
  }
  /**
   * Calculate liquidity adjustment factor
   */
  calculateLiquidityAdjustment(marketData) {
    const spreadPenalty = Math.max(0.5, 1 - marketData.spread * 10);
    const volumeBonus = Math.min(1.2, Math.sqrt(marketData.volume24h / 1e6));
    return spreadPenalty * volumeBonus;
  }
  /**
   * Calculate correlation adjustment factor
   */
  calculateCorrelationAdjustment(symbol, portfolioRisk) {
    if (portfolioRisk.correlation > this.config.correlationThreshold) {
      const correlationPenalty = 1 - (portfolioRisk.correlation - this.config.correlationThreshold);
      return Math.max(0.3, correlationPenalty);
    }
    return 1;
  }
  /**
   * Calculate portfolio risk adjustment factor
   */
  calculatePortfolioRiskAdjustment(portfolioRisk) {
    const riskUtilization = portfolioRisk.dailyRisk / this.config.maxDailyRisk;
    if (riskUtilization > 0.8) {
      return Math.max(0.1, 1 - riskUtilization);
    }
    return 1;
  }
  /**
   * Apply position size limits
   */
  applyPositionLimits(size, portfolioRisk) {
    const minSize = Math.max(this.config.minPositionSize, size);
    const maxSize = this.portfolioValue * (this.config.maxPositionSize / 100);
    const limitedSize = Math.min(minSize, maxSize);
    const remainingDailyRisk = this.config.maxDailyRisk - portfolioRisk.dailyRisk;
    const maxDailyRiskSize = this.portfolioValue * (remainingDailyRisk / 100);
    return Math.min(limitedSize, maxDailyRiskSize);
  }
  /**
   * Calculate risk amount for position
   */
  calculateRiskAmount(positionSize, signal, marketData) {
    const stopLossDistance = this.calculateStopLossDistance(signal, marketData);
    return positionSize * stopLossDistance;
  }
  /**
   * Calculate optimal stop loss price
   */
  calculateStopLoss(price, signal, riskAmount, positionSize) {
    const stopLossDistance = riskAmount / positionSize;
    if (signal.direction === "long") {
      return price * (1 - stopLossDistance);
    } else {
      return price * (1 + stopLossDistance);
    }
  }
  /**
   * Calculate take profit price
   */
  calculateTakeProfit(price, signal) {
    const targetReturn = signal.expectedReturn;
    if (signal.direction === "long") {
      return price * (1 + targetReturn);
    } else {
      return price * (1 - targetReturn);
    }
  }
  /**
   * Calculate stop loss distance based on volatility and signal
   */
  calculateStopLossDistance(signal, marketData) {
    const volatilityStop = marketData.volatility * Math.sqrt(1 / 252);
    const confidenceAdjustment = 1 + (1 - signal.confidence);
    return Math.min(0.1, volatilityStop * confidenceAdjustment * 2);
  }
  /**
   * Calculate comprehensive risk metrics
   */
  calculateRiskMetrics(positionSize, riskAmount, signal, marketData) {
    const portfolioRisk = riskAmount / this.portfolioValue * 100;
    const dailyVaR = this.calculateDailyVaR(positionSize, marketData);
    const sharpeContribution = this.calculateSharpeContribution(signal, positionSize);
    const maxDrawdownContribution = this.calculateMaxDrawdownContribution(riskAmount);
    return {
      portfolioRisk: Math.round(portfolioRisk * 100) / 100,
      dailyVaR: Math.round(dailyVaR * 100) / 100,
      sharpeContribution: Math.round(sharpeContribution * 1e3) / 1e3,
      maxDrawdownContribution: Math.round(maxDrawdownContribution * 100) / 100
    };
  }
  /**
   * Calculate daily Value at Risk
   */
  calculateDailyVaR(positionSize, marketData) {
    const dailyVol = marketData.volatility * Math.sqrt(1 / 252);
    return positionSize * dailyVol * 1.645;
  }
  /**
   * Calculate expected Sharpe ratio contribution
   */
  calculateSharpeContribution(signal, positionSize) {
    const weight = positionSize / this.portfolioValue;
    const expectedReturn = signal.expectedReturn * signal.confidence;
    const riskFreeRate = 0.02;
    return weight * (expectedReturn - riskFreeRate);
  }
  /**
   * Calculate maximum drawdown contribution
   */
  calculateMaxDrawdownContribution(riskAmount) {
    return riskAmount / this.portfolioValue * 100;
  }
  /**
   * Calculate recent performance for adaptive sizing
   */
  calculateRecentPerformance() {
    if (this.historicalReturns.length < 10) {
      return 1;
    }
    const recentReturns = this.historicalReturns.slice(-20);
    const winRate = recentReturns.filter((r) => r > 0).length / recentReturns.length;
    const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
    return winRate * 0.6 + Math.max(-0.5, Math.min(0.5, avgReturn * 10)) * 0.4 + 0.5;
  }
  /**
   * Generate human-readable reasoning for position sizing decision
   */
  generateReasoning(baseSize, adjustedSize, finalSize, adjustments) {
    const reasons = [];
    reasons.push(`Base size: $${baseSize.toFixed(0)} (${this.config.riskScalingMethod} method)`);
    if (Math.abs(adjustments.volatilityAdjustment - 1) > 0.1) {
      const change = adjustments.volatilityAdjustment > 1 ? "increased" : "reduced";
      reasons.push(`${change} by ${Math.abs(adjustments.volatilityAdjustment - 1).toFixed(1)}x for volatility`);
    }
    if (Math.abs(adjustments.liquidityAdjustment - 1) > 0.1) {
      const change = adjustments.liquidityAdjustment > 1 ? "increased" : "reduced";
      reasons.push(`${change} by ${Math.abs(adjustments.liquidityAdjustment - 1).toFixed(1)}x for liquidity`);
    }
    if (Math.abs(adjustments.correlationAdjustment - 1) > 0.1) {
      reasons.push(`reduced by ${(1 - adjustments.correlationAdjustment).toFixed(1)}x for correlation risk`);
    }
    if (Math.abs(adjustments.portfolioRiskAdjustment - 1) > 0.1) {
      reasons.push(`reduced by ${(1 - adjustments.portfolioRiskAdjustment).toFixed(1)}x for portfolio risk`);
    }
    if (finalSize !== adjustedSize) {
      reasons.push(`limited to $${finalSize.toFixed(0)} by position/risk limits`);
    }
    return reasons.join(", ");
  }
  /**
   * Add trade result for adaptive sizing
   */
  addTradeResult(returnPct) {
    this.historicalReturns.push(returnPct);
    if (this.historicalReturns.length > 100) {
      this.historicalReturns = this.historicalReturns.slice(-100);
    }
  }
  /**
   * Update portfolio value
   */
  updatePortfolioValue(newValue) {
    this.portfolioValue = newValue;
  }
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    const updatedConfig = { ...this.config, ...newConfig };
    this.validateConfig(updatedConfig);
    this.config = updatedConfig;
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  validateConfig(config) {
    const result = PositionSizingConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid position sizing configuration: ${result.error.message}`);
    }
  }
};
var RiskManager = class extends EventEmitter__default.default {
  killSwitch;
  positionSizing;
  config;
  positions = /* @__PURE__ */ new Map();
  portfolioValue;
  alerts = /* @__PURE__ */ new Map();
  lastStressTest = /* @__PURE__ */ new Date();
  riskReports = [];
  constructor(config, portfolioValue) {
    super();
    this.config = config;
    this.portfolioValue = portfolioValue;
    this.killSwitch = new GlobalKillSwitch(config.killSwitch);
    this.positionSizing = new PositionSizingEngine(config.positionSizing, portfolioValue);
    this.setupEventListeners();
    this.startRiskMonitoring();
  }
  /**
   * Calculate position size for a new trade
   */
  calculatePositionSize(symbol, signal, marketData) {
    if (!this.killSwitch.isOperationAllowed("trade")) {
      throw new Error("Trading operations are blocked by kill switch");
    }
    const portfolioRisk = this.calculatePortfolioRisk();
    if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk) {
      throw new Error(`Portfolio risk (${portfolioRisk.totalRisk.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxPortfolioRisk}%)`);
    }
    const positionResult = this.positionSizing.calculatePositionSize(
      symbol,
      signal,
      marketData,
      portfolioRisk
    );
    this.validateNewPosition(symbol, positionResult, portfolioRisk);
    return positionResult;
  }
  /**
   * Add a new position to the portfolio
   */
  addPosition(position) {
    this.positions.set(position.id, position);
    this.killSwitch.registerBot(position.id);
    this.emit("position-added", position);
    this.checkRiskLimits();
    this.generateRiskReport();
  }
  /**
   * Update an existing position
   */
  updatePosition(positionId, updates) {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }
    const updatedPosition = { ...position, ...updates };
    this.positions.set(positionId, updatedPosition);
    this.emit("position-updated", updatedPosition);
    this.checkPositionRisk(updatedPosition);
  }
  /**
   * Remove a position from the portfolio
   */
  removePosition(positionId) {
    const position = this.positions.get(positionId);
    if (position) {
      this.positions.delete(positionId);
      this.killSwitch.unregisterBot(positionId);
      this.emit("position-removed", position);
      this.generateRiskReport();
    }
  }
  /**
   * Report a trade result for risk tracking
   */
  reportTradeResult(positionId, pnl, success) {
    const position = this.positions.get(positionId);
    if (!position)
      return;
    const returnPct = pnl / position.size;
    this.positionSizing.addTradeResult(returnPct);
    if (success) {
      this.killSwitch.reportSuccess(positionId);
    } else {
      this.killSwitch.reportFailure(positionId, `Trade loss: ${pnl.toFixed(2)}`);
    }
    if (pnl < 0) {
      this.killSwitch.reportLoss(Math.abs(pnl));
    }
    this.emit("trade-result", { positionId, pnl, success, returnPct });
  }
  /**
   * Get current portfolio risk assessment
   */
  getPortfolioRisk() {
    return this.calculatePortfolioRisk();
  }
  /**
   * Generate comprehensive risk report
   */
  generateRiskReport() {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const portfolioRisk = this.calculatePortfolioRisk();
    const killSwitchStatus = this.killSwitch.getStatus();
    let stressTestResults;
    if (this.shouldRunStressTest()) {
      stressTestResults = this.runStressTests();
    }
    const recommendations = this.generateRecommendations(portfolioRisk, stressTestResults);
    const alerts = Array.from(this.alerts.values());
    const report = {
      timestamp,
      portfolioRisk,
      killSwitchStatus,
      stressTestResults,
      recommendations,
      alerts
    };
    this.riskReports.push(report);
    if (this.riskReports.length > 100) {
      this.riskReports = this.riskReports.slice(-100);
    }
    this.emit("risk-report-generated", report);
    return report;
  }
  /**
   * Trigger emergency risk controls
   */
  async triggerEmergencyStop(reason) {
    await this.killSwitch.triggerKillSwitch(reason, "critical", "user");
    for (const position of this.positions.values()) {
      this.emit("emergency-close-position", position);
    }
    this.createAlert("emergency_stop", "critical", `Emergency stop triggered: ${reason}`, []);
  }
  /**
   * Get historical risk reports
   */
  getRiskHistory(days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1e3);
    return this.riskReports.filter(
      (report) => new Date(report.timestamp) >= cutoffDate
    );
  }
  /**
   * Update portfolio value
   */
  updatePortfolioValue(newValue) {
    this.portfolioValue = newValue;
    this.positionSizing.updatePortfolioValue(newValue);
    this.emit("portfolio-value-updated", newValue);
  }
  /**
   * Acknowledge a risk alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit("alert-acknowledged", alert);
    }
  }
  // Private methods
  setupEventListeners() {
    this.killSwitch.on("kill-switch-triggered", (event) => {
      this.emit("kill-switch-triggered", event);
      this.createAlert("risk_limit", "critical", `Kill switch triggered: ${event.reason}`, []);
    });
    this.killSwitch.on("emergency-notification", (data) => {
      this.emit("emergency-notification", data);
    });
  }
  startRiskMonitoring() {
    setInterval(() => {
      this.checkRiskLimits();
      this.generateRiskReport();
    }, 3e4);
    setInterval(() => {
      if (this.shouldRunStressTest()) {
        this.runStressTests();
      }
    }, 60 * 60 * 1e3);
  }
  calculatePortfolioRisk() {
    const positions = Array.from(this.positions.values());
    if (positions.length === 0) {
      return {
        totalRisk: 0,
        dailyRisk: 0,
        concentration: 0,
        correlation: 0,
        leverage: 0,
        liquidityRisk: 0
      };
    }
    const totalValue = positions.reduce((sum, pos) => sum + Math.abs(pos.size), 0);
    const totalRisk = positions.reduce((sum, pos) => sum + pos.riskAmount, 0);
    const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    const maxPosition = Math.max(...positions.map((pos) => Math.abs(pos.size)));
    const concentration = maxPosition / this.portfolioValue * 100;
    const correlation = this.calculateAverageCorrelation(positions);
    const leverage = totalValue / this.portfolioValue;
    const dailyRisk = Math.abs(totalPnL) / this.portfolioValue * 100;
    const liquidityRisk = Math.min(100, positions.length * 5);
    return {
      totalRisk: totalRisk / this.portfolioValue * 100,
      dailyRisk,
      concentration,
      correlation,
      leverage,
      liquidityRisk
    };
  }
  calculateAverageCorrelation(positions) {
    const sectors = new Set(positions.map((pos) => pos.sector || "unknown"));
    const maxSectorCount = Math.max(...Array.from(sectors).map(
      (sector) => positions.filter((pos) => (pos.sector || "unknown") === sector).length
    ));
    return Math.min(1, maxSectorCount / positions.length);
  }
  checkRiskLimits() {
    const portfolioRisk = this.calculatePortfolioRisk();
    if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk) {
      this.createAlert(
        "risk_limit",
        "error",
        `Portfolio risk (${portfolioRisk.totalRisk.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxPortfolioRisk}%)`,
        []
      );
    }
    if (portfolioRisk.concentration > this.config.portfolioLimits.maxSectorConcentration) {
      this.createAlert(
        "concentration",
        "warning",
        `Position concentration (${portfolioRisk.concentration.toFixed(2)}%) exceeds limit (${this.config.portfolioLimits.maxSectorConcentration}%)`,
        []
      );
    }
    if (portfolioRisk.correlation > this.config.portfolioLimits.maxCorrelation) {
      this.createAlert(
        "correlation",
        "warning",
        `Portfolio correlation (${portfolioRisk.correlation.toFixed(2)}) exceeds limit (${this.config.portfolioLimits.maxCorrelation})`,
        []
      );
    }
  }
  checkPositionRisk(position) {
    const drawdown = (position.entryPrice - position.currentPrice) / position.entryPrice * 100;
    const absDrawdown = Math.abs(drawdown);
    if (absDrawdown > 20) {
      this.createAlert(
        "drawdown",
        "error",
        `Position ${position.symbol} has ${absDrawdown.toFixed(2)}% drawdown`,
        [position.id]
      );
    }
  }
  validateNewPosition(symbol, positionResult, portfolioRisk) {
    const newConcentration = positionResult.positionSize / this.portfolioValue * 100;
    if (newConcentration > this.config.portfolioLimits.maxSectorConcentration) {
      throw new Error(`Position size would exceed concentration limit: ${newConcentration.toFixed(2)}% > ${this.config.portfolioLimits.maxSectorConcentration}%`);
    }
    const newTotalRisk = portfolioRisk.totalRisk + positionResult.riskMetrics.portfolioRisk;
    if (newTotalRisk > this.config.portfolioLimits.maxPortfolioRisk) {
      throw new Error(`New position would exceed portfolio risk limit: ${newTotalRisk.toFixed(2)}% > ${this.config.portfolioLimits.maxPortfolioRisk}%`);
    }
  }
  shouldRunStressTest() {
    if (!this.config.stressTest.enabled)
      return false;
    const daysSinceLastTest = (Date.now() - this.lastStressTest.getTime()) / (1e3 * 60 * 60 * 24);
    return daysSinceLastTest >= 1;
  }
  runStressTests() {
    this.lastStressTest = /* @__PURE__ */ new Date();
    const results = [];
    const positions = Array.from(this.positions.values());
    for (const scenario of this.config.stressTest.scenarios) {
      const result = this.runSingleStressTest(scenario, positions);
      results.push(result);
      if (!result.passed) {
        this.createAlert(
          "stress_test",
          "error",
          `Stress test failed: ${scenario.name} - Expected loss: ${result.expectedLoss.toFixed(2)}%`,
          []
        );
      }
    }
    this.emit("stress-test-completed", results);
    return results;
  }
  runSingleStressTest(scenario, positions) {
    let totalLoss = 0;
    let worstCaseVaR = 0;
    for (const position of positions) {
      const priceShock = scenario.marketShock / 100;
      const shockPrice = position.direction === "long" ? position.currentPrice * (1 + priceShock) : position.currentPrice * (1 - priceShock);
      const pnl = position.direction === "long" ? (shockPrice - position.entryPrice) * (position.size / position.entryPrice) : (position.entryPrice - shockPrice) * (position.size / position.entryPrice);
      totalLoss += Math.abs(pnl);
      worstCaseVaR += Math.abs(pnl) * scenario.volatilityMultiplier;
    }
    const lossPercentage = totalLoss / this.portfolioValue * 100;
    const varPercentage = worstCaseVaR / this.portfolioValue * 100;
    const passed = lossPercentage <= this.config.stressTest.failureThreshold;
    return {
      scenario: scenario.name,
      expectedLoss: lossPercentage,
      worstCaseVaR: varPercentage,
      timeToRecovery: Math.ceil(lossPercentage / 2),
      // Simplified: 2% recovery per day
      passed
    };
  }
  generateRecommendations(portfolioRisk, stressTestResults) {
    const recommendations = [];
    if (portfolioRisk.totalRisk > this.config.portfolioLimits.maxPortfolioRisk * 0.8) {
      recommendations.push({
        type: "reduce_position",
        priority: "high",
        description: "Consider reducing position sizes to lower portfolio risk",
        expectedImpact: `Reduce portfolio risk from ${portfolioRisk.totalRisk.toFixed(2)}% to below ${this.config.portfolioLimits.maxPortfolioRisk}%`
      });
    }
    if (portfolioRisk.concentration > this.config.portfolioLimits.maxSectorConcentration * 0.8) {
      recommendations.push({
        type: "diversify",
        priority: "medium",
        description: "Portfolio is becoming concentrated, consider diversifying",
        expectedImpact: `Reduce concentration risk from ${portfolioRisk.concentration.toFixed(2)}%`
      });
    }
    if (portfolioRisk.correlation > this.config.portfolioLimits.maxCorrelation * 0.8) {
      recommendations.push({
        type: "hedge",
        priority: "medium",
        description: "High correlation detected, consider hedging strategies",
        expectedImpact: `Reduce correlation from ${portfolioRisk.correlation.toFixed(2)} to below ${this.config.portfolioLimits.maxCorrelation}`
      });
    }
    if (stressTestResults?.some((result) => !result.passed)) {
      recommendations.push({
        type: "reduce_position",
        priority: "critical",
        description: "Stress tests indicate vulnerability to market shocks",
        expectedImpact: "Improve stress test resilience and reduce tail risk"
      });
    }
    return recommendations;
  }
  createAlert(type, severity, message, positions) {
    const alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      acknowledged: false,
      positions
    };
    this.alerts.set(alert.id, alert);
    this.emit("risk-alert", alert);
    const alertArray = Array.from(this.alerts.values());
    if (alertArray.length > 50) {
      const oldestAlerts = alertArray.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(0, alertArray.length - 50);
      for (const oldAlert of oldestAlerts) {
        this.alerts.delete(oldAlert.id);
      }
    }
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.killSwitch.destroy();
    this.removeAllListeners();
    this.positions.clear();
    this.alerts.clear();
  }
};

// src/index.ts
var createDefaultKillSwitchConfig = () => ({
  enableAutoTrigger: true,
  maxDailyLoss: 1e3,
  // $1000 daily loss limit
  maxDrawdown: 15,
  // 15% maximum drawdown
  maxConsecutiveFailures: 5,
  emergencyContacts: [],
  gracefulShutdownTimeout: 3e4,
  // 30 seconds
  forceShutdownAfter: 12e4
  // 2 minutes
});
var createDefaultPositionSizingConfig = () => ({
  baseRiskPerTrade: 2,
  // 2% of portfolio per trade
  maxPositionSize: 10,
  // 10% max position size
  minPositionSize: 100,
  // $100 minimum
  volatilityLookback: 30,
  // 30 days
  maxDailyRisk: 10,
  // 10% daily risk limit
  correlationThreshold: 0.7,
  // 70% correlation threshold
  riskScalingMethod: "volatility",
  enableDynamicSizing: true
});
var createDefaultStressTestScenarios = () => [
  {
    name: "Market Crash",
    description: "20% market decline with increased volatility",
    marketShock: -20,
    volatilityMultiplier: 2,
    liquidityReduction: 50,
    correlationIncrease: 0.3
  },
  {
    name: "Flash Crash",
    description: "10% sudden decline with liquidity crisis",
    marketShock: -10,
    volatilityMultiplier: 3,
    liquidityReduction: 80,
    correlationIncrease: 0.5
  },
  {
    name: "Black Swan",
    description: "30% market decline with extreme conditions",
    marketShock: -30,
    volatilityMultiplier: 4,
    liquidityReduction: 90,
    correlationIncrease: 0.8
  },
  {
    name: "Sector Rotation",
    description: "Moderate decline with correlation changes",
    marketShock: -5,
    volatilityMultiplier: 1.5,
    liquidityReduction: 20,
    correlationIncrease: 0.6
  }
];
var createDefaultRiskManagerConfig = () => ({
  killSwitch: createDefaultKillSwitchConfig(),
  positionSizing: createDefaultPositionSizingConfig(),
  portfolioLimits: {
    maxPortfolioRisk: 20,
    // 20% maximum portfolio risk
    maxSectorConcentration: 25,
    // 25% maximum in single sector
    maxCorrelation: 0.8,
    // 80% maximum correlation
    rebalanceThreshold: 15
    // Rebalance at 15% deviation
  },
  stressTest: {
    enabled: true,
    scenarios: createDefaultStressTestScenarios(),
    failureThreshold: 15
    // 15% maximum acceptable loss in stress test
  }
});
var calculateSharpeRatio = (returns, riskFreeRate = 0.02) => {
  if (returns.length === 0)
    return 0;
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);
  return volatility > 0 ? (avgReturn - riskFreeRate) / volatility : 0;
};
var calculateMaxDrawdown = (returns) => {
  if (returns.length === 0)
    return 0;
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  for (const ret of returns) {
    cumulative += ret;
    peak = Math.max(peak, cumulative);
    const drawdown = (peak - cumulative) / Math.max(peak, 1);
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  return maxDrawdown;
};
var calculateVaR = (returns, confidenceLevel = 0.95) => {
  if (returns.length === 0)
    return 0;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
  return sortedReturns[index] || 0;
};
var calculateCorrelation = (returns1, returns2) => {
  if (returns1.length !== returns2.length || returns1.length === 0)
    return 0;
  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;
  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;
  for (let i = 0; i < returns1.length; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }
  const denominator = Math.sqrt(sumSq1 * sumSq2);
  return denominator > 0 ? numerator / denominator : 0;
};
var classifyRiskLevel = (portfolioRisk, maxRisk) => {
  const riskRatio = portfolioRisk / maxRisk;
  if (riskRatio <= 0.5)
    return "low";
  if (riskRatio <= 0.75)
    return "medium";
  if (riskRatio <= 1)
    return "high";
  return "critical";
};
var calculateKellyFraction = (winProbability, avgWin, avgLoss) => {
  if (avgLoss === 0)
    return 0;
  const b = Math.abs(avgWin / avgLoss);
  const kellyFraction = (b * winProbability - (1 - winProbability)) / b;
  return Math.max(0, Math.min(0.25, kellyFraction * 0.25));
};
var createRiskAlert = (type, severity, message, positions = []) => ({
  id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type,
  severity,
  message,
  timestamp: (/* @__PURE__ */ new Date()).toISOString(),
  acknowledged: false,
  positions
});
var analyzePortfolioHealth = (positions, portfolioValue) => {
  if (positions.length === 0) {
    return {
      diversificationScore: 0,
      concentrationRisk: 0,
      liquidityScore: 0,
      overallHealth: "poor"
    };
  }
  const sectors = new Set(positions.map((p) => p.sector || "unknown"));
  const diversificationScore = Math.min(100, sectors.size / Math.max(positions.length / 3, 1) * 100);
  const positionSizes = positions.map((p) => Math.abs(p.size));
  const maxPosition = Math.max(...positionSizes);
  const concentrationRisk = maxPosition / portfolioValue * 100;
  const avgPositionSize = positionSizes.reduce((sum, size) => sum + size, 0) / positions.length;
  const liquidityScore = Math.max(0, 100 - avgPositionSize / portfolioValue * 50);
  const avgScore = (diversificationScore + (100 - concentrationRisk) + liquidityScore) / 3;
  let overallHealth;
  if (avgScore >= 80)
    overallHealth = "excellent";
  else if (avgScore >= 60)
    overallHealth = "good";
  else if (avgScore >= 40)
    overallHealth = "fair";
  else
    overallHealth = "poor";
  return {
    diversificationScore: Math.round(diversificationScore),
    concentrationRisk: Math.round(concentrationRisk * 100) / 100,
    liquidityScore: Math.round(liquidityScore),
    overallHealth
  };
};
var VERSION = "1.0.0";

exports.GlobalKillSwitch = GlobalKillSwitch;
exports.PositionSizingEngine = PositionSizingEngine;
exports.RiskManager = RiskManager;
exports.VERSION = VERSION;
exports.analyzePortfolioHealth = analyzePortfolioHealth;
exports.calculateCorrelation = calculateCorrelation;
exports.calculateKellyFraction = calculateKellyFraction;
exports.calculateMaxDrawdown = calculateMaxDrawdown;
exports.calculateSharpeRatio = calculateSharpeRatio;
exports.calculateVaR = calculateVaR;
exports.classifyRiskLevel = classifyRiskLevel;
exports.createDefaultKillSwitchConfig = createDefaultKillSwitchConfig;
exports.createDefaultPositionSizingConfig = createDefaultPositionSizingConfig;
exports.createDefaultRiskManagerConfig = createDefaultRiskManagerConfig;
exports.createDefaultStressTestScenarios = createDefaultStressTestScenarios;
exports.createRiskAlert = createRiskAlert;
//# sourceMappingURL=out.js.map
//# sourceMappingURL=index.js.map