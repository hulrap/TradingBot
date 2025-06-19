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
  forceShutdownAfter: z.number().positive()
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
      console.warn('Kill switch already triggered');
      return;
    }

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
    return {
      isActive: this.isActive,
      isTriggered: this.isTriggered,
      lastTriggered: this.triggerHistory.length > 0 ? 
        this.triggerHistory[this.triggerHistory.length - 1].timestamp : undefined,
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
    if (!result.success) {
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
    return new Promise((resolve, reject) => {
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
    // Simplified drawdown calculation - in production, this would use portfolio peak values
    const dailyLossPercentage = (this.dailyLoss / 10000) * 100; // Assuming $10k base
    this.currentDrawdown = Math.max(this.currentDrawdown, dailyLossPercentage);
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