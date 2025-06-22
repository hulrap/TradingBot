/**
 * @file Production-grade circuit breaker implementation
 * @package @trading-bot/utilities
 * 
 * Enterprise-grade circuit breaker pattern with state management,
 * failure tracking, recovery mechanisms, and comprehensive monitoring.
. */

import type { 
  CircuitBreakerConfig, 
  CircuitBreakerState, 
  CircuitBreakerMetrics,
  CircuitBreakerEvent,
  CircuitBreakerEventListener,
  CircuitBreakerEventData,
  CircuitBreakerRequest,
  CircuitBreakerWindowMetrics,
  CircuitBreakerStateTransition,
  CircuitBreakerDashboardData,
  CircuitState,
  RetryOperationContext,
  RetryErrorCode
} from '../../../types/src/utilities/retry';
import type { UtilityError } from '../../../types/src/utilities/validation';

/**
 * Production-grade circuit breaker implementation
. */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private readonly config: Required<CircuitBreakerConfig>;
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | undefined;
  private lastSuccessTime: number | undefined;
  private nextAttemptTime: number | undefined;
  private stateChangeTime = Date.now();
  private stateTransitions = 0;
  private readonly requestQueue: CircuitBreakerRequest[] = [];
  private readonly eventListeners = new Map<CircuitBreakerEvent, CircuitBreakerEventListener[]>();
  private readonly responseTimeWindow: number[] = [];
  private readonly stateHistory: CircuitBreakerStateTransition[] = [];
  private readonly maxResponseTimeWindow = 100;
  private readonly maxStateHistory = 50;
  private readonly maxRequestQueue = 1000;

  /**
   *
   * @param config
  . */
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      recoveryTimeout: config.recoveryTimeout ?? 60000,
      monitoringWindow: config.monitoringWindow ?? 60000,
      expectedFailureRate: config.expectedFailureRate ?? 0.5,
      minimumThroughput: config.minimumThroughput ?? 10
    };

    this.validateConfig();
  }

  /**
   * Execute operation through circuit breaker
   * @param operation
   * @param fallback
   * @param context
  . */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    context?: Partial<RetryOperationContext>
  ): Promise<T> {
    const startTime = Date.now();
    const requestContext = this.createRequestContext(context, startTime);

    // Check if circuit is open
    if (this.state === 'open') {
      if (this.shouldAttemptRecovery()) {
        this.transitionToHalfOpen('Recovery timeout elapsed');
      } else {
        if (fallback) {
          return await fallback();
        }
        throw this.createCircuitOpenError();
      }
    }

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.recordSuccess(duration, requestContext);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(error, duration, requestContext);
      throw error;
    }
  }

  /**
   * Record successful operation
   * @param responseTime
   * @param context
  . */
  private recordSuccess(
    responseTime: number, 
    context: RetryOperationContext
  ): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    
    this.addToResponseTimeWindow(responseTime);
    this.addToRequestQueue({
      timestamp: context.startTime,
      success: true,
      duration: responseTime,
      metadata: context.metadata || {}
    });
    
    this.emitEvent('request-success', {
      responseTime,
      state: this.state,
      context
    });

    if (this.state === 'half-open') {
      this.transitionToClosed('Recovery successful');
      this.emitEvent('recovery-succeeded', { 
        failures: this.failures,
        context 
      });
    }

    this.updateMetrics();
  }

  /**
   * Record failed operation
   * @param error
   * @param responseTime
   * @param context
  . */
  private recordFailure(
    error: any,
    responseTime: number, 
    context: RetryOperationContext
  ): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    this.addToResponseTimeWindow(responseTime);
    this.addToRequestQueue({
      timestamp: context.startTime,
      success: false,
      duration: responseTime,
      error: this.normalizeError(error),
      metadata: context.metadata || {}
    });
    
    this.emitEvent('request-failure', {
      responseTime,
      state: this.state,
      failures: this.failures,
      error: this.normalizeError(error),
      context
    });

    if (this.state === 'half-open') {
      this.transitionToOpen('Recovery failed');
      this.emitEvent('recovery-failed', { 
        failures: this.failures,
        context 
      });
    } else if (this.state === 'closed' && this.shouldOpenCircuit()) {
      this.transitionToOpen('Failure threshold exceeded');
      this.emitEvent('threshold-reached', { 
        failures: this.failures, 
        threshold: this.config.failureThreshold,
        context 
      });
    }

    this.updateMetrics();
  }

  /**
   * Check if circuit should be opened
  . */
  private shouldOpenCircuit(): boolean {
    // Check failure threshold
    if (this.failures >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate within monitoring window
    const windowMetrics = this.getWindowMetrics();
    if (windowMetrics.totalRequests >= this.config.minimumThroughput &&
        windowMetrics.failureRate >= this.config.expectedFailureRate) {
      return true;
    }

    return false;
  }

  /**
   * Check if should attempt recovery
  . */
  private shouldAttemptRecovery(): boolean {
    if (!this.nextAttemptTime) {
      this.nextAttemptTime = (this.lastFailureTime || Date.now()) + this.config.recoveryTimeout;
    }
    
    return Date.now() >= this.nextAttemptTime;
  }

  /**
   * Transition to CLOSED state
   * @param reason
  . */
  private transitionToClosed(reason: string): void {
    if (this.state !== 'closed') {
      const transition = this.createStateTransition('closed', reason);
      this.state = 'closed';
      this.failures = 0;
      this.nextAttemptTime = undefined;
      this.recordStateTransition(transition);
      this.emitEvent('state-change', { transition });
    }
  }

  /**
   * Transition to OPEN state
   * @param reason
  . */
  private transitionToOpen(reason: string): void {
    if (this.state !== 'open') {
      const transition = this.createStateTransition('open', reason);
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      this.recordStateTransition(transition);
      this.emitEvent('state-change', { transition });
    }
  }

  /**
   * Transition to HALF_OPEN state
   * @param reason
  . */
  private transitionToHalfOpen(reason: string): void {
    if (this.state !== 'half-open') {
      const transition = this.createStateTransition('half-open', reason);
      this.state = 'half-open';
      this.recordStateTransition(transition);
      this.emitEvent('state-change', { transition });
      this.emitEvent('recovery-started', { failures: this.failures });
    }
  }

  /**
   * Create state transition object
   * @param newState
   * @param reason
  . */
  private createStateTransition(
    newState: CircuitState, 
    reason: string
  ): CircuitBreakerStateTransition {
    return {
      from: this.state,
      to: newState,
      timestamp: Date.now(),
      reason,
      context: {
        failures: this.failures,
        successes: this.successes,
        timeInPreviousState: Date.now() - this.stateChangeTime
      }
    };
  }

  /**
   * Record state transition
   * @param transition
  . */
  private recordStateTransition(transition: CircuitBreakerStateTransition): void {
    this.stateChangeTime = transition.timestamp;
    this.stateTransitions++;
    
    this.stateHistory.push(transition);
    if (this.stateHistory.length > this.maxStateHistory) {
      this.stateHistory.shift();
    }
  }

  /**
   * Add request to monitoring queue
   * @param request
  . */
  private addToRequestQueue(request: CircuitBreakerRequest): void {
    this.requestQueue.push(request);
    
    // Clean up old requests
    const cutoff = Date.now() - this.config.monitoringWindow;
    while (this.requestQueue.length > 0) {
      const oldestRequest = this.requestQueue[0];
      if (oldestRequest && oldestRequest.timestamp < cutoff) {
        this.requestQueue.shift();
      } else {
        break;
      }
    }
    
    // Limit queue size
    if (this.requestQueue.length > this.maxRequestQueue) {
      this.requestQueue.shift();
    }
  }

  /**
   * Add response time to window
   * @param responseTime
  . */
  private addToResponseTimeWindow(responseTime: number): void {
    this.responseTimeWindow.push(responseTime);
    if (this.responseTimeWindow.length > this.maxResponseTimeWindow) {
      this.responseTimeWindow.shift();
    }
  }

  /**
   * Get metrics for current monitoring window
  . */
  private getWindowMetrics(): CircuitBreakerWindowMetrics {
    const now = Date.now();
    const cutoff = now - this.config.monitoringWindow;
    const windowRequests = this.requestQueue.filter(req => req.timestamp >= cutoff);
    
    const totalRequests = windowRequests.length;
    const totalFailures = windowRequests.filter(req => !req.success).length;
    const totalSuccesses = windowRequests.filter(req => req.success).length;
    const failureRate = totalRequests > 0 ? totalFailures / totalRequests : 0;
    const successRate = totalRequests > 0 ? totalSuccesses / totalRequests : 0;
    
    return {
      totalRequests,
      totalFailures,
      totalSuccesses,
      failureRate,
      successRate,
      windowStart: cutoff,
      windowEnd: now
    };
  }

  /**
   * Update metrics and emit events
  . */
  private updateMetrics(): void {
    this.emitEvent('metrics-updated', {
      metrics: this.getMetrics(),
      timestamp: Date.now()
    });
  }

  /**
   * Get current circuit breaker state
  . */
  getState(): CircuitBreakerState {
    const state: CircuitBreakerState = {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      history: [...this.stateHistory]
    };
    
    if (this.lastFailureTime !== undefined) {
      state.lastFailure = this.lastFailureTime;
    }
    
    if (this.nextAttemptTime !== undefined) {
      state.nextAttempt = this.nextAttemptTime;
    }
    
    return state;
  }

  /**
   * Get comprehensive metrics
  . */
  getMetrics(): CircuitBreakerMetrics {
    const windowMetrics = this.getWindowMetrics();
    const totalRequests = this.successes + this.failures;
    const averageResponseTime = this.responseTimeWindow.length > 0
      ? this.responseTimeWindow.reduce((sum, time) => sum + time, 0) / this.responseTimeWindow.length
      : 0;

    const metrics: CircuitBreakerMetrics = {
      totalRequests,
      totalFailures: this.failures,
      totalSuccesses: this.successes,
      successRate: totalRequests > 0 ? this.successes / totalRequests : 0,
      failureRate: windowMetrics.failureRate,
      averageResponseTime,
      stateTransitions: this.stateTransitions,
      timeInCurrentState: Date.now() - this.stateChangeTime,
      windowMetrics
    };

    if (this.lastFailureTime !== undefined) {
      metrics.lastFailureTime = this.lastFailureTime;
    }

    if (this.lastSuccessTime !== undefined) {
      metrics.lastSuccessTime = this.lastSuccessTime;
    }

    return metrics;
  }

  /**
   * Get dashboard data
  . */
  getDashboardData(): CircuitBreakerDashboardData {
    const state = this.getState();
    const metrics = this.getMetrics();
    
    return {
      status: {
        state: state.state,
        healthy: state.state === 'closed',
        failures: state.failures,
        successes: state.successes,
        timeSinceStateChange: Date.now() - this.stateChangeTime
      },
      performance: {
        successRate: metrics.successRate,
        failureRate: metrics.failureRate,
        averageResponseTime: metrics.averageResponseTime,
        totalRequests: metrics.totalRequests,
        requestsPerSecond: this.calculateRequestsPerSecond()
      },
      timing: (() => {
        const timing: any = {
          timeInCurrentState: metrics.timeInCurrentState,
          stateTransitions: metrics.stateTransitions
        };
        
        if (metrics.lastFailureTime !== undefined) {
          timing.lastFailureTime = metrics.lastFailureTime;
        }
        
        if (metrics.lastSuccessTime !== undefined) {
          timing.lastSuccessTime = metrics.lastSuccessTime;
        }
        
        if (this.nextAttemptTime !== undefined) {
          timing.nextRecoveryAttempt = this.nextAttemptTime;
        }
        
        return timing;
      })(),
      recentActivity: {
        requests: this.requestQueue.slice(-20),
        transitions: this.stateHistory.slice(-10),
        events: [] // Would need to track events if needed
      }
    };
  }

  /**
   * Calculate requests per second
  . */
  private calculateRequestsPerSecond(): number {
    const windowMs = Math.min(this.config.monitoringWindow, 60000); // Max 1 minute
    const cutoff = Date.now() - windowMs;
    const recentRequests = this.requestQueue.filter(req => req.timestamp >= cutoff);
    return (recentRequests.length / windowMs) * 1000;
  }

  /**
   * Add event listener
   * @param event
   * @param listener
  . */
  on(event: CircuitBreakerEvent, listener: CircuitBreakerEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   * @param event
   * @param listener
  . */
  off(event: CircuitBreakerEvent, listener: CircuitBreakerEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @param event
   * @param data
  . */
  private emitEvent(event: CircuitBreakerEvent, data: any): void {
    const eventData: CircuitBreakerEventData = {
      event,
      timestamp: Date.now(),
      currentState: this.state,
      data,
      metrics: this.getMetrics()
    };

    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event, eventData);
        } catch (error) {
          console.error('Circuit breaker event listener error:', error);
        }
      });
    }
  }

  /**
   * Create request context
   * @param context
   * @param startTime
  . */
  private createRequestContext(
    context?: Partial<RetryOperationContext>,
    startTime: number = Date.now()
  ): RetryOperationContext {
    const requestContext: RetryOperationContext = {
      operationName: context?.operationName || 'unknown',
      category: context?.category || 'other',
      metadata: context?.metadata || {},
      requestId: context?.requestId || this.generateRequestId(),
      startTime
    };

    if (context?.userId !== undefined) {
      requestContext.userId = context.userId;
    }

    if (context?.parentOperationId !== undefined) {
      requestContext.parentOperationId = context.parentOperationId;
    }

    return requestContext;
  }

  /**
   * Generate unique request ID
  . */
  private generateRequestId(): string {
    return `cb_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Create circuit open error
  . */
  private createCircuitOpenError(): UtilityError {
    return {
      code: 'CIRCUIT_OPEN' as RetryErrorCode,
      message: 'Circuit breaker is open - requests are being rejected',
      details: {
        state: this.state,
        failures: this.failures,
        nextAttemptTime: this.nextAttemptTime,
        recoveryTimeout: this.config.recoveryTimeout,
        metrics: this.getMetrics()
      },
      timestamp: Date.now()
    };
  }

  /**
   * Normalize error to consistent format
   * @param error
  . */
  private normalizeError(error: any): UtilityError {
    if (error?.code && error?.message && error?.timestamp) {
      return error;
    }

    return {
      code: error?.code || 'UNKNOWN_ERROR',
      message: error?.message || String(error),
      details: {
        originalError: error,
        stack: error?.stack
      },
      timestamp: Date.now()
    };
  }

  /**
   * Validate configuration
  . */
  private validateConfig(): void {
    if (this.config.failureThreshold <= 0) {
      throw new Error('failureThreshold must be greater than 0');
    }
    if (this.config.recoveryTimeout <= 0) {
      throw new Error('recoveryTimeout must be greater than 0');
    }
    if (this.config.monitoringWindow <= 0) {
      throw new Error('monitoringWindow must be greater than 0');
    }
    if (this.config.expectedFailureRate < 0 || this.config.expectedFailureRate > 1) {
      throw new Error('expectedFailureRate must be between 0 and 1');
    }
    if (this.config.minimumThroughput < 0) {
      throw new Error('minimumThroughput must be non-negative');
    }
  }

  /**
   * Reset circuit breaker to initial state
  . */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttemptTime = undefined;
    this.stateChangeTime = Date.now();
    this.stateTransitions = 0;
    this.requestQueue.length = 0;
    this.responseTimeWindow.length = 0;
    this.stateHistory.length = 0;
    
    this.emitEvent('window-reset', { reason: 'Manual reset' });
  }

  /**
   * Force state change (for testing/manual intervention)
   * @param state
   * @param reason
  . */
  forceState(state: CircuitState, reason: string = 'Manual state change'): void {
    switch (state) {
      case 'closed':
        this.transitionToClosed(reason);
        break;
      case 'open':
        this.transitionToOpen(reason);
        break;
      case 'half-open':
        this.transitionToHalfOpen(reason);
        break;
    }
  }

  /**
   * Get configuration
  . */
  getConfig(): Required<CircuitBreakerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration (creates new instance)
   * @param newConfig
  . */
  withConfig(newConfig: Partial<CircuitBreakerConfig>): CircuitBreaker {
    return new CircuitBreaker({ ...this.config, ...newConfig });
  }
}

/**
 * Create circuit breaker with default configuration
 * @param config
. */
export function createCircuitBreaker(
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker {
  return new CircuitBreaker(config);
}

/**
 * Pre-configured circuit breaker strategies
. */
export const circuitBreakerStrategies = {
  /**
   * Fast-fail for API calls
   * @param config
  . */
  api: (config?: Partial<CircuitBreakerConfig>) => new CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeout: 30000,
    monitoringWindow: 60000,
    expectedFailureRate: 0.3,
    minimumThroughput: 5,
    ...config
  }),

  /**
   * Database connection circuit breaker
   * @param config
  . */
  database: (config?: Partial<CircuitBreakerConfig>) => new CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 60000,
    monitoringWindow: 120000,
    expectedFailureRate: 0.1,
    minimumThroughput: 10,
    ...config
  }),

  /**
   * Trading operation circuit breaker
   * @param config
  . */
  trading: (config?: Partial<CircuitBreakerConfig>) => new CircuitBreaker({
    failureThreshold: 2,
    recoveryTimeout: 10000,
    monitoringWindow: 30000,
    expectedFailureRate: 0.2,
    minimumThroughput: 3,
    ...config
  }),

  /**
   * Network request circuit breaker
   * @param config
  . */
  network: (config?: Partial<CircuitBreakerConfig>) => new CircuitBreaker({
    failureThreshold: 4,
    recoveryTimeout: 45000,
    monitoringWindow: 90000,
    expectedFailureRate: 0.4,
    minimumThroughput: 8,
    ...config
  })
};

/**
 * Circuit breaker utilities
. */
export const circuitBreakerUtils = {
  CircuitBreaker,
  createCircuitBreaker,
  circuitBreakerStrategies,
  
  /**
   * Wrap function with circuit breaker
   * @param fn
   * @param circuitBreaker
   * @param fallback
  . */
  wrap: <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    circuitBreaker: CircuitBreaker,
    fallback?: () => Promise<ReturnType<T>>
  ): T => {
    return (async (...args: Parameters<T>) => {
      return circuitBreaker.execute(() => fn(...args), fallback);
    }) as T;
  },
  
  /**
   * Create monitoring dashboard data
   * @param breaker
  . */
  createDashboardData: (breaker: CircuitBreaker): CircuitBreakerDashboardData => {
    return breaker.getDashboardData();
  },

  /**
   * Batch monitor multiple circuit breakers
   * @param breakers
  . */
  monitorMultiple: (breakers: Map<string, CircuitBreaker>): Map<string, CircuitBreakerDashboardData> => {
    const results = new Map<string, CircuitBreakerDashboardData>();
    for (const [name, breaker] of breakers) {
      results.set(name, breaker.getDashboardData());
    }
    return results;
  }
};
