import Database from 'better-sqlite3';
import winston from 'winston';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Enhanced error types for better error handling
export class DatabaseError extends Error {
  constructor(message: string, public code: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, 'VALIDATION_ERROR', originalError);
    this.name = 'ValidationError';
  }
}

export class TransactionError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', originalError);
    this.name = 'TransactionError';
  }
}

// Enhanced interfaces with validation
export interface ArbitrageOpportunity {
  id?: number;
  tokenA: string;
  tokenB: string;
  exchangeA: string;
  exchangeB: string;
  priceA: number;
  priceB: number;
  profitPercentage: number;
  profitUsd: number;
  gasEstimate: number;
  timestamp: number;
  status: 'pending' | 'executed' | 'failed' | 'expired';
}

export interface Trade {
  id?: number;
  opportunityId: number;
  executionPrice: number;
  amount: number;
  profit: number;
  gasUsed: number;
  txHash: string;
  timestamp: number;
}

export interface PerformanceMetric {
  id?: number;
  totalTrades: number;
  successfulTrades: number;
  totalProfit: number;
  totalGasCost: number;
  avgProfitPerTrade: number;
  successRate: number;
  timestamp: number;
}

export interface RiskEvent {
  type: string;
  tradeId?: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  action: string;
}

export interface DatabaseConfig {
  dbPath: string;
  backupEnabled: boolean;
  backupInterval: number; // ms
  backupRetention: number; // days
  enableArchiving: boolean;
  archiveAfterDays: number;
  performanceMonitoring: boolean;
  connectionTimeout: number; // ms
  queryTimeout: number; // ms
  maxConnections: number;
}

// Enhanced Database Manager with enterprise features
export class DatabaseManager {
  private db: Database.Database;
  private logger: winston.Logger;
  private config: DatabaseConfig;
  private backupTimer?: NodeJS.Timeout;
  private archiveTimer?: NodeJS.Timeout;
  private performanceMetrics = {
    totalQueries: 0,
    totalQueryTime: 0,
    slowQueries: 0,
    errors: 0,
    lastBackup: 0,
    lastArchive: 0
  };

  // Prepared statements for better performance
  private statements = {
    updateBotState: null as Database.Statement | null,
    logOpportunity: null as Database.Statement | null,
    logTrade: null as Database.Statement | null,
    logPerformanceMetric: null as Database.Statement | null,
    logRiskEvent: null as Database.Statement | null,
    getRecentOpportunities: null as Database.Statement | null,
    getPerformanceMetrics: null as Database.Statement | null
  };

  constructor(config: DatabaseConfig, logger: winston.Logger) {
    this.config = this.validateConfig(config);
    this.logger = logger;
    
    try {
      this.db = new Database(config.dbPath, {
        timeout: config.connectionTimeout,
        verbose: logger.debug.bind(logger)
      });
      
      // Configure database for performance and reliability
      this.configureDatabaseSettings();
      this.initializeTables();
      this.createIndexes();
      this.prepareStatements();
      
      if (config.backupEnabled) {
        this.startBackupSchedule();
      }
      
      if (config.enableArchiving) {
        this.startArchiveSchedule();
      }
      
      logger.info('Enhanced Database Manager initialized', {
        dbPath: config.dbPath,
        backupEnabled: config.backupEnabled,
        archivingEnabled: config.enableArchiving
      });
      
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', 'INIT_ERROR', error as Error);
    }
  }

  private validateConfig(config: DatabaseConfig): DatabaseConfig {
    if (!config.dbPath) {
      throw new ValidationError('Database path is required');
    }
    
    if (config.backupInterval < 60000) { // Min 1 minute
      throw new ValidationError('Backup interval must be at least 60 seconds');
    }
    
    if (config.connectionTimeout < 1000) { // Min 1 second
      throw new ValidationError('Connection timeout must be at least 1 second');
    }
    
    return config;
  }

  private configureDatabaseSettings(): void {
    // Configure SQLite for optimal performance and reliability
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    this.db.pragma('synchronous = NORMAL'); // Balance between safety and performance
    this.db.pragma('cache_size = 10000'); // 10MB cache
    this.db.pragma('temp_store = memory'); // Store temp tables in memory
    this.db.pragma('mmap_size = 268435456'); // 256MB memory mapped I/O
    this.db.pragma('foreign_keys = ON'); // Enable foreign key constraints
    
    this.logger.debug('Database configured for optimal performance');
  }

  private initializeTables(): void {
    const transaction = this.db.transaction(() => {
      // Bot state table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS bot_state (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          status TEXT NOT NULL CHECK(status IN ('running', 'stopped', 'error', 'maintenance')),
          last_heartbeat INTEGER NOT NULL,
          config TEXT NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Arbitrage opportunities table with enhanced constraints
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_a TEXT NOT NULL CHECK(length(token_a) = 42), -- Ethereum address validation
          token_b TEXT NOT NULL CHECK(length(token_b) = 42),
          exchange_a TEXT NOT NULL CHECK(length(exchange_a) > 0),
          exchange_b TEXT NOT NULL CHECK(length(exchange_b) > 0),
          price_a REAL NOT NULL CHECK(price_a > 0),
          price_b REAL NOT NULL CHECK(price_b > 0),
          profit_percentage REAL NOT NULL CHECK(profit_percentage >= 0),
          profit_usd REAL NOT NULL CHECK(profit_usd >= 0),
          gas_estimate INTEGER NOT NULL CHECK(gas_estimate > 0),
          timestamp INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'executed', 'failed', 'expired')),
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Trades table with enhanced validation
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          opportunity_id INTEGER,
          execution_price REAL NOT NULL CHECK(execution_price > 0),
          amount REAL NOT NULL CHECK(amount > 0),
          profit REAL NOT NULL,
          gas_used INTEGER NOT NULL CHECK(gas_used > 0),
          tx_hash TEXT NOT NULL CHECK(length(tx_hash) = 66), -- Transaction hash validation
          timestamp INTEGER NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (opportunity_id) REFERENCES arbitrage_opportunities (id),
          UNIQUE(tx_hash) -- Prevent duplicate transactions
        );
      `);

      // Performance metrics table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          total_trades INTEGER NOT NULL CHECK(total_trades >= 0),
          successful_trades INTEGER NOT NULL CHECK(successful_trades >= 0),
          total_profit REAL NOT NULL,
          total_gas_cost REAL NOT NULL CHECK(total_gas_cost >= 0),
          avg_profit_per_trade REAL NOT NULL,
          success_rate REAL NOT NULL CHECK(success_rate >= 0 AND success_rate <= 1),
          timestamp INTEGER NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Risk events table with enhanced structure
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS risk_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(length(type) > 0),
          trade_id TEXT,
          message TEXT NOT NULL CHECK(length(message) > 0),
          severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
          timestamp INTEGER NOT NULL,
          action TEXT NOT NULL CHECK(length(action) > 0),
          resolved BOOLEAN DEFAULT FALSE,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Database metadata table for migrations and versioning
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS db_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Insert initial metadata
      this.db.exec(`
        INSERT OR IGNORE INTO db_metadata (key, value) VALUES 
        ('schema_version', '2.0'),
        ('created_at', strftime('%s', 'now')),
        ('last_backup', '0'),
        ('last_archive', '0');
      `);
    });

    transaction();
    this.logger.info('Enhanced database tables initialized with constraints and validation');
  }

  private createIndexes(): void {
    const transaction = this.db.transaction(() => {
      // Indexes for arbitrage_opportunities table
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_timestamp ON arbitrage_opportunities(timestamp DESC);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_status ON arbitrage_opportunities(status);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_tokens ON arbitrage_opportunities(token_a, token_b);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_exchanges ON arbitrage_opportunities(exchange_a, exchange_b);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_profit ON arbitrage_opportunities(profit_percentage DESC);');

      // Indexes for trades table
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_opportunity ON trades(opportunity_id);');
      this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades(tx_hash);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_profit ON trades(profit DESC);');

      // Indexes for performance_metrics table
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_performance_timestamp ON performance_metrics(timestamp DESC);');

      // Indexes for risk_events table
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_risk_events_timestamp ON risk_events(timestamp DESC);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(type);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_risk_events_resolved ON risk_events(resolved);');
    });

    transaction();
    this.logger.info('Database indexes created for optimal performance');
  }

  private prepareStatements(): void {
    try {
      this.statements.updateBotState = this.db.prepare(`
        INSERT OR REPLACE INTO bot_state (id, status, last_heartbeat, config, updated_at)
        VALUES (1, ?, ?, ?, strftime('%s', 'now'))
      `);

      this.statements.logOpportunity = this.db.prepare(`
        INSERT INTO arbitrage_opportunities (
          token_a, token_b, exchange_a, exchange_b, price_a, price_b,
          profit_percentage, profit_usd, gas_estimate, timestamp, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      this.statements.logTrade = this.db.prepare(`
        INSERT INTO trades (
          opportunity_id, execution_price, amount, profit, gas_used, tx_hash, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      this.statements.logPerformanceMetric = this.db.prepare(`
        INSERT INTO performance_metrics (
          total_trades, successful_trades, total_profit, total_gas_cost,
          avg_profit_per_trade, success_rate, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      this.statements.logRiskEvent = this.db.prepare(`
        INSERT INTO risk_events (
          type, trade_id, message, severity, timestamp, action
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      this.statements.getRecentOpportunities = this.db.prepare(`
        SELECT * FROM arbitrage_opportunities
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      this.statements.getPerformanceMetrics = this.db.prepare(`
        SELECT * FROM performance_metrics
        WHERE timestamp > ?
        ORDER BY timestamp DESC
      `);

      this.logger.debug('Prepared statements created for optimal performance');
    } catch (error) {
      throw new DatabaseError('Failed to prepare statements', 'PREPARE_ERROR', error as Error);
    }
  }

  // Enhanced validation methods
  private validateOpportunity(opportunity: ArbitrageOpportunity): void {
    if (!opportunity.tokenA || !opportunity.tokenB) {
      throw new ValidationError('Token addresses are required');
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(opportunity.tokenA) || !/^0x[a-fA-F0-9]{40}$/.test(opportunity.tokenB)) {
      throw new ValidationError('Invalid token address format');
    }
    
    if (opportunity.priceA <= 0 || opportunity.priceB <= 0) {
      throw new ValidationError('Prices must be positive');
    }
    
    if (opportunity.profitPercentage < 0 || opportunity.profitUsd < 0) {
      throw new ValidationError('Profit values cannot be negative');
    }
    
    if (opportunity.gasEstimate <= 0) {
      throw new ValidationError('Gas estimate must be positive');
    }
  }

  private validateTrade(trade: Trade): void {
    if (trade.executionPrice <= 0 || trade.amount <= 0) {
      throw new ValidationError('Execution price and amount must be positive');
    }
    
    if (trade.gasUsed <= 0) {
      throw new ValidationError('Gas used must be positive');
    }
    
    if (!/^0x[a-fA-F0-9]{64}$/.test(trade.txHash)) {
      throw new ValidationError('Invalid transaction hash format');
    }
  }

  private validateRiskEvent(event: RiskEvent): void {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(event.severity)) {
      throw new ValidationError(`Invalid severity level: ${event.severity}`);
    }
    
    if (!event.type || !event.message || !event.action) {
      throw new ValidationError('Risk event type, message, and action are required');
    }
  }

  // Enhanced database operations with transactions and monitoring
  private async executeWithMonitoring<T>(operation: () => T, operationName: string): Promise<T> {
    const startTime = Date.now();
    this.performanceMetrics.totalQueries++;
    
    try {
      const result = operation();
      const executionTime = Date.now() - startTime;
      this.performanceMetrics.totalQueryTime += executionTime;
      
      if (executionTime > 1000) { // Slow query threshold: 1 second
        this.performanceMetrics.slowQueries++;
        this.logger.warn('Slow database query detected', {
          operation: operationName,
          executionTime,
          threshold: 1000
        });
      }
      
      return result;
    } catch (error) {
      this.performanceMetrics.errors++;
      this.logger.error('Database operation failed', {
        operation: operationName,
        error: error instanceof Error ? error.message : error,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }

  async updateBotState(status: string, config: any): Promise<void> {
    return this.executeWithMonitoring(() => {
      if (!this.statements.updateBotState) {
        throw new DatabaseError('Update bot state statement not prepared', 'STATEMENT_ERROR');
      }

      const transaction = this.db.transaction(() => {
        this.statements.updateBotState!.run(status, Date.now(), JSON.stringify(config));
      });

      transaction();
      this.logger.debug('Bot state updated', { status });
    }, 'updateBotState');
  }

  async logOpportunity(opportunity: ArbitrageOpportunity): Promise<number> {
    return this.executeWithMonitoring(() => {
      this.validateOpportunity(opportunity);
      
      if (!this.statements.logOpportunity) {
        throw new DatabaseError('Log opportunity statement not prepared', 'STATEMENT_ERROR');
      }

      const transaction = this.db.transaction(() => {
        const result = this.statements.logOpportunity!.run(
          opportunity.tokenA,
          opportunity.tokenB,
          opportunity.exchangeA,
          opportunity.exchangeB,
          opportunity.priceA,
          opportunity.priceB,
          opportunity.profitPercentage,
          opportunity.profitUsd,
          opportunity.gasEstimate,
          opportunity.timestamp,
          opportunity.status
        );
        return result.lastInsertRowid as number;
      });

      const id = transaction();
      this.logger.info('Opportunity logged', { id });
      return id;
    }, 'logOpportunity');
  }

  async logTrade(trade: Trade): Promise<number> {
    return this.executeWithMonitoring(() => {
      this.validateTrade(trade);
      
      if (!this.statements.logTrade) {
        throw new DatabaseError('Log trade statement not prepared', 'STATEMENT_ERROR');
      }

      const transaction = this.db.transaction(() => {
        // Update opportunity status to executed
        const updateOpportunity = this.db.prepare(`
          UPDATE arbitrage_opportunities 
          SET status = 'executed', updated_at = strftime('%s', 'now')
          WHERE id = ?
        `);
        updateOpportunity.run(trade.opportunityId);

        // Insert trade record
        const result = this.statements.logTrade!.run(
          trade.opportunityId,
          trade.executionPrice,
          trade.amount,
          trade.profit,
          trade.gasUsed,
          trade.txHash,
          trade.timestamp
        );
        return result.lastInsertRowid as number;
      });

      const id = transaction();
      this.logger.info('Trade logged with opportunity update', { id, opportunityId: trade.opportunityId });
      return id;
    }, 'logTrade');
  }

  async logRiskEvent(event: RiskEvent): Promise<void> {
    return this.executeWithMonitoring(() => {
      this.validateRiskEvent(event);
      
      if (!this.statements.logRiskEvent) {
        throw new DatabaseError('Log risk event statement not prepared', 'STATEMENT_ERROR');
      }

      this.statements.logRiskEvent.run(
        event.type,
        event.tradeId || null,
        event.message,
        event.severity,
        event.timestamp,
        event.action
      );

      this.logger.info('Risk event logged', event);
    }, 'logRiskEvent');
  }

  // Enhanced backup system
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(this.config.dbPath), 'backups');
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    try {
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Create backup using better-sqlite3 backup method with destination filename
      this.db.backup(backupPath);
      this.logger.info('Database backup completed', { backupPath });

      // Update backup metadata
      const updateBackupTime = this.db.prepare(`
        INSERT OR REPLACE INTO db_metadata (key, value, updated_at)
        VALUES ('last_backup', ?, strftime('%s', 'now'))
      `);
      updateBackupTime.run(Date.now().toString());

      this.performanceMetrics.lastBackup = Date.now();
      return backupPath;

    } catch (error) {
      throw new DatabaseError('Backup creation failed', 'BACKUP_ERROR', error as Error);
    }
  }

  private startBackupSchedule(): void {
    this.backupTimer = setInterval(async () => {
      try {
        await this.createBackup();
        await this.cleanupOldBackups();
      } catch (error) {
        this.logger.error('Scheduled backup failed', { error: error instanceof Error ? error.message : error });
      }
    }, this.config.backupInterval);

    this.logger.info('Backup schedule started', { interval: this.config.backupInterval });
  }

  private async cleanupOldBackups(): Promise<void> {
    const backupDir = path.join(path.dirname(this.config.dbPath), 'backups');
    const cutoffTime = Date.now() - (this.config.backupRetention * 24 * 60 * 60 * 1000);

    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(file => file.startsWith('backup-') && file.endsWith('.db'));

      for (const file of backupFiles) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          this.logger.debug('Old backup deleted', { file });
        }
      }
    } catch (error) {
      this.logger.warn('Backup cleanup failed', { error: error instanceof Error ? error.message : error });
    }
  }

  // Data archiving system
  private startArchiveSchedule(): void {
    this.archiveTimer = setInterval(async () => {
      try {
        await this.archiveOldData();
      } catch (error) {
        this.logger.error('Scheduled archiving failed', { error: error instanceof Error ? error.message : error });
      }
    }, 24 * 60 * 60 * 1000); // Daily archiving

    this.logger.info('Archive schedule started');
  }

  private async archiveOldData(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.archiveAfterDays * 24 * 60 * 60 * 1000);

    const transaction = this.db.transaction(() => {
      // Archive old opportunities
      const archiveOpportunities = this.db.prepare(`
        DELETE FROM arbitrage_opportunities
        WHERE timestamp < ? AND status IN ('executed', 'failed', 'expired')
      `);
      const opportunitiesArchived = archiveOpportunities.run(cutoffTime);

      // Archive old risk events that are resolved
      const archiveRiskEvents = this.db.prepare(`
        DELETE FROM risk_events
        WHERE timestamp < ? AND resolved = TRUE
      `);
      const riskEventsArchived = archiveRiskEvents.run(cutoffTime);

      this.logger.info('Data archiving completed', {
        opportunitiesArchived: opportunitiesArchived.changes,
        riskEventsArchived: riskEventsArchived.changes
      });
    });

    transaction();
    this.performanceMetrics.lastArchive = Date.now();
  }

  // Performance monitoring
  getPerformanceStats(): any {
    const avgQueryTime = this.performanceMetrics.totalQueries > 0 
      ? this.performanceMetrics.totalQueryTime / this.performanceMetrics.totalQueries 
      : 0;

    return {
      ...this.performanceMetrics,
      avgQueryTime,
      errorRate: this.performanceMetrics.totalQueries > 0 
        ? this.performanceMetrics.errors / this.performanceMetrics.totalQueries 
        : 0,
      slowQueryRate: this.performanceMetrics.totalQueries > 0 
        ? this.performanceMetrics.slowQueries / this.performanceMetrics.totalQueries 
        : 0
    };
  }

  // Enhanced data retrieval methods remain the same but with monitoring
  async getRecentOpportunities(limit: number = 100): Promise<ArbitrageOpportunity[]> {
    return this.executeWithMonitoring(() => {
      if (!this.statements.getRecentOpportunities) {
        throw new DatabaseError('Get recent opportunities statement not prepared', 'STATEMENT_ERROR');
      }

      const rows = this.statements.getRecentOpportunities.all(limit) as any[];
      return rows.map(row => ({
        id: row.id,
        tokenA: row.token_a,
        tokenB: row.token_b,
        exchangeA: row.exchange_a,
        exchangeB: row.exchange_b,
        priceA: row.price_a,
        priceB: row.price_b,
        profitPercentage: row.profit_percentage,
        profitUsd: row.profit_usd,
        gasEstimate: row.gas_estimate,
        timestamp: row.timestamp,
        status: row.status
      }));
    }, 'getRecentOpportunities');
  }

  async getPerformanceMetrics(hours: number = 24): Promise<PerformanceMetric[]> {
    return this.executeWithMonitoring(() => {
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      
      if (!this.statements.getPerformanceMetrics) {
        throw new DatabaseError('Get performance metrics statement not prepared', 'STATEMENT_ERROR');
      }

      const rows = this.statements.getPerformanceMetrics.all(cutoff) as any[];
      return rows.map(row => ({
        id: row.id,
        totalTrades: row.total_trades,
        successfulTrades: row.successful_trades,
        totalProfit: row.total_profit,
        totalGasCost: row.total_gas_cost,
        avgProfitPerTrade: row.avg_profit_per_trade,
        successRate: row.success_rate,
        timestamp: row.timestamp
      }));
    }, 'getPerformanceMetrics');
  }

  // Graceful shutdown with cleanup
  async close(): Promise<void> {
    try {
      // Clear timers
      if (this.backupTimer) {
        clearInterval(this.backupTimer);
      }
      if (this.archiveTimer) {
        clearInterval(this.archiveTimer);
      }

      // Create final backup if enabled
      if (this.config.backupEnabled) {
        await this.createBackup();
      }

      // Close database connection
      this.db.close();
      
      this.logger.info('Database connection closed gracefully', {
        performanceStats: this.getPerformanceStats()
      });
    } catch (error) {
      this.logger.error('Error during database shutdown', { 
        error: error instanceof Error ? error.message : error 
      });
      throw new DatabaseError('Database shutdown failed', 'SHUTDOWN_ERROR', error as Error);
    }
  }
}