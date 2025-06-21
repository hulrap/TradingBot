import EventEmitter from 'eventemitter3';
import { z } from 'zod';

export interface KillSwitchConfig {
  enableAutoTrigger: boolean;
  maxDailyLoss: number; // USD
  maxDrawdown: number; // Percentage
  maxConsecutiveFailures: number;
  emergencyContacts: string[]; // Email addresses
  gracefulShutdownTimeout: number; // milliseconds
  forceShutdownAfter: number; // milliseconds
  enableEnhancedMonitoring: boolean; // Enable sophisticated monitoring
  volatilityThreshold: number; // Volatility-based triggers
  liquidityThreshold: number; // Liquidity-based triggers
  correlationThreshold: number; // Correlation breakdown triggers
  recoveryTimeLimit: number; // Maximum time to recover from drawdown
  enablePredictiveTriggers: boolean; // Enable ML-based predictive triggers
}

export interface KillSwitchEvent {
  type: 'triggered' | 'manual_stop' | 'force_stop' | 'recovery_mode';
  timestamp: string;
  reason: string;
  triggeredBy: 'user' | 'system' | 'auto';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface KillSwitchStatus {
  isActive: boolean;
  isTriggered: boolean;
  lastTriggered?: string;
  totalTriggers: number;
  currentMode: 'normal' | 'recovery' | 'emergency';
  systemHealth: 'healthy' | 'degraded' | 'critical';
  activeBots: number;
  emergencyContact: boolean;
}

const KillSwitchConfigSchema = z.object({
  enableAutoTrigger: z.boolean(),
  maxDailyLoss: z.number().positive(),
  maxDrawdown: z.number().min(0).max(100),
  maxConsecutiveFailures: z.number().positive(),
  emergencyContacts: z.array(z.string().email()),
  gracefulShutdownTimeout: z.number().positive(),
  forceShutdownAfter: z.number().positive(),
  enableEnhancedMonitoring: z.boolean(),
  volatilityThreshold: z.number().min(0),
  liquidityThreshold: z.number().min(0).max(1),
  correlationThreshold: z.number().min(0).max(1),
  recoveryTimeLimit: z.number().positive(),
  enablePredictiveTriggers: z.boolean()
});

export class GlobalKillSwitch extends EventEmitter {
  private config: KillSwitchConfig;
  private isTriggered: boolean = false;
  private isActive: boolean = true;
  private triggerHistory: KillSwitchEvent[] = [];
  private currentMode: 'normal' | 'recovery' | 'emergency' = 'normal';
  private activeBots: Set<string> = new Set();
  private consecutiveFailures: number = 0;
  private dailyLoss: number = 0;
  private currentDrawdown: number = 0;
  private lastReset: Date = new Date();
  private shutdownTimers: Map<string, NodeJS.Timeout> = new Map();
  private portfolioValue: number = 100000; // Default portfolio value
  private enhancedMetrics: {
    volatility: number;
    liquidity: number;
    correlation: number;
    recoveryStartTime?: Date;
  } = {
    volatility: 0,
    liquidity: 1,
    correlation: 0
  };

  constructor(config: KillSwitchConfig) {
    super();
    this.validateConfig(config);
    this.config = config;
    this.setupDailyReset();
    this.startHealthMonitoring();
  }

  /**
   * Manually trigger the kill switch with reason
   */
  public async triggerKillSwitch(
    reason: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'high',
    triggeredBy: 'user' | 'system' = 'user'
  ): Promise<void> {
    if (this.isTriggered) {
      const warningMessage = 'Kill switch already triggered';
      console.warn(warningMessage);
      this.emit('warning', { message: warningMessage, reason: 'duplicate-trigger' });
      return;
    }

    try {

    const event: KillSwitchEvent = {
      type: 'triggered',
      timestamp: new Date().toISOString(),
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
    this.currentMode = severity === 'critical' ? 'emergency' : 'recovery';
    this.triggerHistory.push(event);

    console.error(`🚨 KILL SWITCH TRIGGERED: ${reason}`);
    console.error(`Severity: ${severity}, Mode: ${this.currentMode}`);

    // Emit kill switch event
    this.emit('kill-switch-triggered', event);

    // Stop all bots based on severity
    if (severity === 'critical') {
      await this.forceStopAllBots();
    } else {
      await this.gracefulStopAllBots();
    }

    // Send emergency notifications
    await this.sendEmergencyNotifications(event);

    // Log the event
    await this.logKillSwitchEvent(event);
    
    } catch (error) {
      const errorMessage = `Failed to trigger kill switch: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      this.emit('error', { error, reason, severity, triggeredBy });
      
      // Even if there's an error, we should still mark as triggered for safety
      this.isTriggered = true;
      this.currentMode = 'emergency';
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Check if automatic trigger conditions are met
   */
  public checkAutoTriggerConditions(): void {
    if (!this.config.enableAutoTrigger || this.isTriggered) {
      return;
    }

    // Check daily loss limit
    if (this.dailyLoss >= this.config.maxDailyLoss) {
      this.triggerKillSwitch(
        `Daily loss limit exceeded: $${this.dailyLoss.toFixed(2)}`,
        'high',
        'system'
      );
      return;
    }

    // Check maximum drawdown
    if (this.currentDrawdown >= this.config.maxDrawdown) {
      this.triggerKillSwitch(
        `Maximum drawdown exceeded: ${this.currentDrawdown.toFixed(2)}%`,
        'high',
        'system'
      );
      return;
    }

    // Check consecutive failures
    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.triggerKillSwitch(
        `Too many consecutive failures: ${this.consecutiveFailures}`,
        'medium',
        'system'
      );
      return;
    }
  }

  /**
   * Check enhanced trigger conditions based on sophisticated metrics
   */
  private checkEnhancedTriggerConditions(): void {
    if (!this.config.enableEnhancedMonitoring || this.isTriggered) {
      return;
    }

    // Check volatility threshold
    if (this.enhancedMetrics.volatility > this.config.volatilityThreshold) {
      this.triggerKillSwitch(
        `Volatility threshold exceeded: ${(this.enhancedMetrics.volatility * 100).toFixed(2)}%`,
        'medium',
        'system'
      );
      return;
    }

    // Check liquidity threshold
    if (this.enhancedMetrics.liquidity < this.config.liquidityThreshold) {
      this.triggerKillSwitch(
        `Liquidity below threshold: ${(this.enhancedMetrics.liquidity * 100).toFixed(2)}%`,
        'high',
        'system'
      );
      return;
    }

    // Check correlation breakdown
    if (this.enhancedMetrics.correlation > this.config.correlationThreshold) {
      this.triggerKillSwitch(
        `Correlation breakdown detected: ${(this.enhancedMetrics.correlation * 100).toFixed(2)}%`,
        'high',
        'system'
      );
      return;
    }

    // Check recovery time limit
    if (this.currentDrawdown > 0 && this.enhancedMetrics.recoveryStartTime) {
      const recoveryTime = Date.now() - this.enhancedMetrics.recoveryStartTime.getTime();
      if (recoveryTime > this.config.recoveryTimeLimit) {
        this.triggerKillSwitch(
          `Recovery time limit exceeded: ${Math.round(recoveryTime / (1000 * 60 * 60))} hours`,
          'high',
          'system'
        );
        return;
      }
    }
  }

  /**
   * Register a bot with the kill switch
   */
  public registerBot(botId: string): void {
    this.activeBots.add(botId);
    this.emit('bot-registered', { botId, totalBots: this.activeBots.size });
    
    console.log(`Bot registered: ${botId} (Total: ${this.activeBots.size})`);
  }

  /**
   * Unregister a bot from the kill switch
   */
  public unregisterBot(botId: string): void {
    this.activeBots.delete(botId);
    this.clearShutdownTimer(botId);
    this.emit('bot-unregistered', { botId, totalBots: this.activeBots.size });
    
    console.log(`Bot unregistered: ${botId} (Total: ${this.activeBots.size})`);
  }

  /**
   * Report a trade loss to track daily limits
   */
  public reportLoss(amount: number): void {
    this.dailyLoss += amount;
    this.emit('loss-reported', { amount, totalDailyLoss: this.dailyLoss });
    
    // Update drawdown calculation
    this.updateDrawdown();
    
    // Check auto-trigger conditions
    this.checkAutoTriggerConditions();
  }

  /**
   * Report a consecutive failure
   */
  public reportFailure(botId: string, reason: string): void {
    this.consecutiveFailures++;
    this.emit('failure-reported', { 
      botId, 
      reason, 
      consecutiveFailures: this.consecutiveFailures 
    });
    
    console.warn(`Failure reported for ${botId}: ${reason} (${this.consecutiveFailures} consecutive)`);
    
    // Check auto-trigger conditions
    this.checkAutoTriggerConditions();
  }

  /**
   * Report a successful trade (resets consecutive failures)
   */
  public reportSuccess(botId: string): void {
    this.consecutiveFailures = 0;
    this.emit('success-reported', { botId });
  }

  /**
   * Get current kill switch status
   */
  public getStatus(): KillSwitchStatus {
    const status: KillSwitchStatus = {
      isActive: this.isActive,
      isTriggered: this.isTriggered,
      totalTriggers: this.triggerHistory.length,
      currentMode: this.currentMode,
      systemHealth: this.determineSystemHealth(),
      activeBots: this.activeBots.size,
      emergencyContact: this.config.emergencyContacts.length > 0
    };

    // Only add lastTriggered if we have trigger history
    if (this.triggerHistory.length > 0) {
      status.lastTriggered = this.triggerHistory[this.triggerHistory.length - 1]!.timestamp;
    }

    return status;
  }

  /**
   * Reset the kill switch (must be done manually after investigation)
   */
  public async resetKillSwitch(reason: string, resetBy: string): Promise<void> {
    if (!this.isTriggered) {
      console.warn('Kill switch is not triggered, no reset needed');
      return;
    }

    const event: KillSwitchEvent = {
      type: 'recovery_mode',
      timestamp: new Date().toISOString(),
      reason: `Reset: ${reason}`,
      triggeredBy: 'user',
      severity: 'low',
      metadata: { resetBy }
    };

    this.isTriggered = false;
    this.currentMode = 'recovery';
    this.triggerHistory.push(event);

    console.log(`✅ Kill switch reset: ${reason} (by ${resetBy})`);
    
    this.emit('kill-switch-reset', event);
    await this.logKillSwitchEvent(event);

    // Wait for manual confirmation before returning to normal mode
    setTimeout(() => {
      this.currentMode = 'normal';
      this.emit('mode-changed', { mode: 'normal' });
    }, 30000); // 30 second recovery period
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<KillSwitchConfig>): void {
    const updatedConfig = { ...this.config, ...newConfig };
    this.validateConfig(updatedConfig);
    this.config = updatedConfig;
    
    this.emit('config-updated', updatedConfig);
    console.log('Kill switch configuration updated');
  }

  /**
   * Get kill switch history
   */
  public getHistory(limit: number = 50): KillSwitchEvent[] {
    return this.triggerHistory.slice(-limit);
  }

  /**
   * Check if kill switch is blocking bot operations
   */
  public isOperationAllowed(operation: 'start' | 'trade' | 'stop'): boolean {
    if (!this.isActive) return false;
    if (this.isTriggered && operation !== 'stop') return false;
    if (this.currentMode === 'emergency' && operation !== 'stop') return false;
    
    return true;
  }

  // Private methods

  private validateConfig(config: KillSwitchConfig): void {
    const result = KillSwitchConfigSchema.safeParse(config);
    if (result.success === false) {
      throw new Error(`Invalid kill switch configuration: ${result.error.message}`);
    }
  }

  private async gracefulStopAllBots(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    
    for (const botId of this.activeBots) {
      const promise = this.gracefulStopBot(botId);
      stopPromises.push(promise);
    }

    try {
      await Promise.allSettled(stopPromises);
      console.log('All bots gracefully stopped');
    } catch (error) {
      console.error('Error during graceful stop:', error);
      // Force stop if graceful fails
      await this.forceStopAllBots();
    }
  }

  private async forceStopAllBots(): Promise<void> {
    for (const botId of this.activeBots) {
      this.emit('force-stop-bot', { botId });
      this.unregisterBot(botId);
    }
    
    console.log('All bots force stopped');
  }

  private async gracefulStopBot(botId: string): Promise<void> {
    return new Promise((resolve) => {
      // Set graceful shutdown timer
      const gracefulTimer = setTimeout(() => {
        console.warn(`Graceful shutdown timeout for bot ${botId}, forcing stop`);
        this.emit('force-stop-bot', { botId });
        resolve();
      }, this.config.gracefulShutdownTimeout);

      this.shutdownTimers.set(botId, gracefulTimer);

      // Emit graceful stop signal
      this.emit('graceful-stop-bot', { 
        botId,
        timeout: this.config.gracefulShutdownTimeout
      });

      // Set force shutdown timer
      const forceTimer = setTimeout(() => {
        this.clearShutdownTimer(botId);
        this.emit('force-stop-bot', { botId });
        resolve();
      }, this.config.forceShutdownAfter);

      // Listen for bot confirmation
      const handleBotStopped = (event: { botId: string }) => {
        if (event.botId === botId) {
          this.clearShutdownTimer(botId);
          clearTimeout(forceTimer);
          this.off('bot-stopped', handleBotStopped);
          resolve();
        }
      };

      this.on('bot-stopped', handleBotStopped);
    });
  }

  private clearShutdownTimer(botId: string): void {
    const timer = this.shutdownTimers.get(botId);
    if (timer) {
      clearTimeout(timer);
      this.shutdownTimers.delete(botId);
    }
  }

  private updateDrawdown(): void {
    // Enhanced drawdown calculation with portfolio value tracking
    const portfolioValue = this.getPortfolioValue();
    if (portfolioValue > 0) {
      const dailyLossPercentage = (this.dailyLoss / portfolioValue) * 100;
      this.currentDrawdown = Math.max(this.currentDrawdown, dailyLossPercentage);
      
      // Emit drawdown update for monitoring
      this.emit('drawdown-updated', { 
        currentDrawdown: this.currentDrawdown,
        dailyLoss: this.dailyLoss,
        portfolioValue: portfolioValue
      });
    }
  }

  /**
   * Set portfolio value for accurate drawdown calculations
   */
  public setPortfolioValue(value: number): void {
    if (value <= 0) {
      throw new Error('Portfolio value must be positive');
    }
    this.portfolioValue = value;
    this.emit('portfolio-value-updated', { portfolioValue: value });
  }

  /**
   * Get current portfolio value
   */
  private getPortfolioValue(): number {
    return this.portfolioValue;
  }

  /**
   * Update enhanced metrics for sophisticated monitoring
   */
  public updateEnhancedMetrics(metrics: {
    volatility?: number;
    liquidity?: number;
    correlation?: number;
  }): void {
    if (metrics.volatility !== undefined) {
      this.enhancedMetrics.volatility = metrics.volatility;
    }
    if (metrics.liquidity !== undefined) {
      this.enhancedMetrics.liquidity = metrics.liquidity;
    }
    if (metrics.correlation !== undefined) {
      this.enhancedMetrics.correlation = metrics.correlation;
    }

    // Check enhanced trigger conditions if enabled
    if (this.config.enableEnhancedMonitoring) {
      this.checkEnhancedTriggerConditions();
    }

    this.emit('enhanced-metrics-updated', this.enhancedMetrics);
  }

  private determineSystemHealth(): 'healthy' | 'degraded' | 'critical' {
    if (this.isTriggered || this.currentMode === 'emergency') {
      return 'critical';
    }
    
    if (this.currentMode === 'recovery' || this.consecutiveFailures > 3) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private setupDailyReset(): void {
    // Reset daily counters at midnight UTC
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyCounters();
      
      // Set up recurring daily reset
      setInterval(() => {
        this.resetDailyCounters();
      }, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
  }

  private resetDailyCounters(): void {
    this.dailyLoss = 0;
    this.currentDrawdown = 0;
    this.lastReset = new Date();
    
    this.emit('daily-reset', { 
      timestamp: this.lastReset.toISOString() 
    });
    
    console.log('Daily risk counters reset');
  }

  private startHealthMonitoring(): void {
    // Health check every 30 seconds
    setInterval(() => {
      this.emit('health-check', this.getStatus());
    }, 30000);
  }

  private async sendEmergencyNotifications(event: KillSwitchEvent): Promise<void> {
    // In production, this would send emails/SMS/Slack notifications
    console.log('🚨 EMERGENCY NOTIFICATION:', {
      contacts: this.config.emergencyContacts,
      event
    });
    
    // Emit notification event for external handlers
    this.emit('emergency-notification', {
      event,
      contacts: this.config.emergencyContacts
    });
  }

  private async logKillSwitchEvent(event: KillSwitchEvent): Promise<void> {
    // In production, this would log to database/monitoring system
    console.log('Kill switch event logged:', event);
    
    // Emit for external logging systems
    this.emit('event-logged', event);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    // Clear all timers
    for (const timer of this.shutdownTimers.values()) {
      clearTimeout(timer);
    }
    this.shutdownTimers.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    console.log('Kill switch destroyed');
  }
}