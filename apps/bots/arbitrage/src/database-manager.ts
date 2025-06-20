import Database from 'better-sqlite3';
import winston from 'winston';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Configuration interface for database settings
export interface DatabaseConfig {
  dbPath: string;
  backupPath?: string;
  encryptionKey?: string | undefined;
  maxBackups?: number;
  performanceMonitoring?: boolean;
  queryTimeout?: number;
  enableWAL?: boolean;
  enableForeignKeys?: boolean;
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
  id?: number;
  type: string;
  tradeId?: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  action: string;
}

export interface QueryPerformanceMetric {
  query: string;
  executionTime: number;
  timestamp: number;
}

// Migration interface
export interface Migration {
  version: number;
  description: string;
  up: string;
  down: string;
}

export class DatabaseManager {
  private db!: Database.Database;
  private logger: winston.Logger;
  private config: DatabaseConfig;
  private encryptionKey?: Buffer;
  private queryPerformanceCache: Map<string, QueryPerformanceMetric[]> = new Map();
  private currentSchema: number = 1;
  private accessMutex: Map<string, Promise<any>> = new Map();

  constructor(config: DatabaseConfig, logger: winston.Logger) {
    this.config = this.validateConfig(config);
    this.logger = logger;
    
    try {
      this.initializeDatabase();
      this.validateConnection();
      this.initializeTables();
      this.createIndexes();
      this.runMigrations();
      this.setupPerformanceMonitoring();
      this.logger.info('Database manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private validateConfig(config: DatabaseConfig): DatabaseConfig {
    if (!config.dbPath) {
      throw new Error('Database path is required');
    }

    const validatedConfig: DatabaseConfig = {
      dbPath: config.dbPath,
      backupPath: config.backupPath || path.join(path.dirname(config.dbPath), 'backups'),
      maxBackups: config.maxBackups || 10,
      performanceMonitoring: config.performanceMonitoring !== false,
      queryTimeout: config.queryTimeout || 30000,
      enableWAL: config.enableWAL !== false,
      enableForeignKeys: config.enableForeignKeys !== false,
      encryptionKey: config.encryptionKey
    };

    if (validatedConfig.encryptionKey) {
      this.encryptionKey = Buffer.from(validatedConfig.encryptionKey, 'hex');
    }

    return validatedConfig;
  }

  private initializeDatabase(): void {
    this.db = new Database(this.config.dbPath, {
      timeout: this.config.queryTimeout
      // Note: verbose logging removed due to TypeScript compatibility issues
      // Performance monitoring is handled differently via our custom query wrapper
    });

    // Enable WAL mode for better performance
    if (this.config.enableWAL) {
      this.db.pragma('journal_mode = WAL');
    }

    // Enable foreign key constraints
    if (this.config.enableForeignKeys) {
      this.db.pragma('foreign_keys = ON');
    }

    // Set other pragmas for performance and safety
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
    this.db.pragma('mmap_size = 268435456'); // 256MB
  }

  private validateConnection(): void {
    try {
      const result = this.db.prepare('SELECT 1 as test').get();
      if (!result || (result as any).test !== 1) {
        throw new Error('Database connection validation failed');
      }
      this.logger.debug('Database connection validated successfully');
    } catch (error) {
      this.logger.error('Database connection validation failed:', error);
      throw error;
    }
  }

  private initializeTables(): void {
    const transaction = this.db.transaction(() => {
      // Schema version tracking
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );
      `);

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

      // Arbitrage opportunities table with constraints
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_a TEXT NOT NULL CHECK(length(token_a) > 0),
          token_b TEXT NOT NULL CHECK(length(token_b) > 0),
          exchange_a TEXT NOT NULL CHECK(length(exchange_a) > 0),
          exchange_b TEXT NOT NULL CHECK(length(exchange_b) > 0),
          price_a REAL NOT NULL CHECK(price_a > 0),
          price_b REAL NOT NULL CHECK(price_b > 0),
          profit_percentage REAL NOT NULL CHECK(profit_percentage >= 0),
          profit_usd REAL NOT NULL CHECK(profit_usd >= 0),
          gas_estimate INTEGER NOT NULL CHECK(gas_estimate > 0),
          timestamp INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'executed', 'failed', 'expired')),
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Trades table with foreign key constraints
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS trades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          opportunity_id INTEGER,
          execution_price REAL NOT NULL CHECK(execution_price > 0),
          amount REAL NOT NULL CHECK(amount > 0),
          profit REAL NOT NULL,
          gas_used INTEGER NOT NULL CHECK(gas_used > 0),
          tx_hash TEXT NOT NULL UNIQUE CHECK(length(tx_hash) = 66),
          timestamp INTEGER NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (opportunity_id) REFERENCES arbitrage_opportunities (id) ON DELETE CASCADE
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

      // Risk events table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS risk_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(length(type) > 0),
          trade_id TEXT,
          message TEXT NOT NULL CHECK(length(message) > 0),
          severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
          timestamp INTEGER NOT NULL,
          action TEXT NOT NULL CHECK(length(action) > 0),
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Query performance tracking table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS query_performance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query_hash TEXT NOT NULL,
          query_text TEXT NOT NULL,
          execution_time REAL NOT NULL,
          timestamp INTEGER NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);

      // Backup log table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS backup_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          backup_path TEXT NOT NULL,
          backup_size INTEGER NOT NULL,
          backup_hash TEXT NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
      `);
    });

    transaction();
    this.logger.info('Database tables initialized with constraints');
  }

  private createIndexes(): void {
    const transaction = this.db.transaction(() => {
      // Indexes for arbitrage_opportunities
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_timestamp ON arbitrage_opportunities(timestamp DESC)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_status ON arbitrage_opportunities(status)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_tokens ON arbitrage_opportunities(token_a, token_b)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_exchanges ON arbitrage_opportunities(exchange_a, exchange_b)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_opportunities_profit ON arbitrage_opportunities(profit_percentage DESC)');

      // Indexes for trades
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_opportunity ON trades(opportunity_id)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_profit ON trades(profit DESC)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades(tx_hash)');

      // Indexes for performance_metrics
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_performance_timestamp ON performance_metrics(timestamp DESC)');

      // Indexes for risk_events
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_risk_events_timestamp ON risk_events(timestamp DESC)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(type)');

      // Indexes for query_performance
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_query_performance_timestamp ON query_performance(timestamp DESC)');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_query_performance_hash ON query_performance(query_hash)');
    });

    transaction();
    this.logger.info('Database indexes created');
  }

  private runMigrations(): void {
    const migrations: Migration[] = [
      {
        version: 1,
        description: 'Initial schema',
        up: 'SELECT 1', // Already handled in initializeTables
        down: 'SELECT 1'
      }
    ];

    const transaction = this.db.transaction(() => {
      for (const migration of migrations) {
        const existing = this.db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version);
        if (!existing) {
          this.db.exec(migration.up);
          this.db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(migration.version, migration.description);
          this.currentSchema = migration.version; // Update current schema version
          this.logger.info(`Applied migration ${migration.version}: ${migration.description}`);
        }
      }
      
      // Set current schema to the highest applied version
      const latestMigration = this.db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as any;
      this.currentSchema = latestMigration?.version || 1;
    });

    transaction();
    this.logger.info(`Database schema version: ${this.currentSchema}`);
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring) return;

    // Set up periodic cleanup of old performance data
    setInterval(() => {
      this.cleanupOldPerformanceData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private logQuery(query: string, executionTime?: number): void {
    if (!this.config.performanceMonitoring) return;
    
    const timestamp = Date.now();
    const actualExecutionTime = executionTime || 0;
    const queryHash = crypto.createHash('sha256').update(query).digest('hex').substring(0, 16);
    
    // Store performance data with actual execution time
    const performanceData: QueryPerformanceMetric = {
      query: queryHash,
      executionTime: actualExecutionTime,
      timestamp
    };

    if (!this.queryPerformanceCache.has(queryHash)) {
      this.queryPerformanceCache.set(queryHash, []);
    }
    
    const cache = this.queryPerformanceCache.get(queryHash)!;
    cache.push(performanceData);
    
    // Keep only last 100 entries per query
    if (cache.length > 100) {
      cache.shift();
    }
    
    // Log slow queries
    if (actualExecutionTime > 100) {
      this.logger.warn('Slow query detected', { 
        queryHash, 
        executionTime: actualExecutionTime, 
        query: query.substring(0, 100) 
      });
    }
    
    // Also store in database for persistent monitoring
    try {
      const stmt = this.db.prepare(`
        INSERT INTO query_performance (query_hash, query_text, execution_time, timestamp)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(queryHash, query.substring(0, 500), actualExecutionTime, timestamp);
    } catch (error) {
      // Don't throw error for performance logging failures
      this.logger.debug('Failed to log query performance to database:', error);
    }
  }

  private async withMutex<T>(key: string, operation: () => Promise<T>): Promise<T> {
    while (this.accessMutex.has(key)) {
      await this.accessMutex.get(key);
    }

    const promise = operation();
    this.accessMutex.set(key, promise);
    
    try {
      const result = await promise;
      this.accessMutex.delete(key);
      return result;
    } catch (error) {
      this.accessMutex.delete(key);
      throw error;
    }
  }

  // Data validation methods
  private validateOpportunity(opportunity: ArbitrageOpportunity): void {
    if (!opportunity.tokenA || !opportunity.tokenB) {
      throw new Error('Token addresses are required');
    }
    if (!opportunity.exchangeA || !opportunity.exchangeB) {
      throw new Error('Exchange names are required');
    }
    if (opportunity.priceA <= 0 || opportunity.priceB <= 0) {
      throw new Error('Prices must be positive');
    }
    if (opportunity.profitPercentage < 0 || opportunity.profitUsd < 0) {
      throw new Error('Profit values cannot be negative');
    }
    if (opportunity.gasEstimate <= 0) {
      throw new Error('Gas estimate must be positive');
    }
    if (!opportunity.timestamp || opportunity.timestamp <= 0) {
      throw new Error('Valid timestamp is required');
    }
  }

  private validateTrade(trade: Trade): void {
    if (trade.executionPrice <= 0 || trade.amount <= 0) {
      throw new Error('Execution price and amount must be positive');
    }
    if (trade.gasUsed <= 0) {
      throw new Error('Gas used must be positive');
    }
    if (!trade.txHash || !/^0x[a-fA-F0-9]{64}$/.test(trade.txHash)) {
      throw new Error('Valid transaction hash is required');
    }
    if (!trade.timestamp || trade.timestamp <= 0) {
      throw new Error('Valid timestamp is required');
    }
  }

  private validateRiskEvent(event: RiskEvent): void {
    if (!event.type || !event.message || !event.action) {
      throw new Error('Risk event type, message, and action are required');
    }
    if (!['low', 'medium', 'high', 'critical'].includes(event.severity)) {
      throw new Error('Invalid risk event severity');
    }
    if (!event.timestamp || event.timestamp <= 0) {
      throw new Error('Valid timestamp is required');
    }
  }

  // Encryption/Decryption methods (with type assertions for Buffer compatibility)
  private encrypt(data: string): string {
    if (!this.encryptionKey) return data;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey as any, iv as any);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedData: string): string {
    if (!this.encryptionKey) return encryptedData;
    
    const [ivHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !encrypted) return encryptedData;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey as any, iv as any);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Transaction management
  private transaction<T>(operation: () => T): T {
    const transaction = this.db.transaction(operation);
    return transaction();
  }

  // Enhanced database operations with validation and transactions
  async updateBotState(status: string, config: any): Promise<void> {
    const queryText = 'INSERT OR REPLACE INTO bot_state (id, status, last_heartbeat, config, updated_at) VALUES (1, ?, ?, ?, ?)';
    
    return this.withMutex('bot_state', async () => {
      if (!['running', 'stopped', 'error', 'maintenance'].includes(status)) {
        throw new Error('Invalid bot status');
      }

      const start = Date.now();
      const stmt = this.db.prepare(queryText);

      try {
        const configJson = this.encrypt(JSON.stringify(config));
        stmt.run(status, Date.now(), configJson, Date.now());
        
        // Log query performance
        this.logQuery(queryText, Date.now() - start);
        
        this.logger.debug('Bot state updated', { status });
      } catch (error) {
        this.logger.error('Error updating bot state:', error);
        throw error;
      }
    });
  }

  async logOpportunity(opportunity: ArbitrageOpportunity): Promise<number> {
    this.validateOpportunity(opportunity);

    const stmt = this.db.prepare(`
      INSERT INTO arbitrage_opportunities (
        token_a, token_b, exchange_a, exchange_b, price_a, price_b,
        profit_percentage, profit_usd, gas_estimate, timestamp, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(
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

      const id = result.lastInsertRowid as number;
      this.logger.info('Opportunity logged', { id, profitPercentage: opportunity.profitPercentage });
      return id;
    } catch (error) {
      this.logger.error('Error logging opportunity:', error);
      throw error;
    }
  }

  async logTrade(trade: Trade): Promise<number> {
    this.validateTrade(trade);

    return this.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO trades (
          opportunity_id, execution_price, amount, profit, gas_used, tx_hash, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      try {
        const result = stmt.run(
          trade.opportunityId,
          trade.executionPrice,
          trade.amount,
          trade.profit,
          trade.gasUsed,
          trade.txHash,
          trade.timestamp
        );

        // Update opportunity status
        if (trade.opportunityId) {
          const updateStmt = this.db.prepare(`
            UPDATE arbitrage_opportunities 
            SET status = 'executed' 
            WHERE id = ?
          `);
          updateStmt.run(trade.opportunityId);
        }

        const id = result.lastInsertRowid as number;
        this.logger.info('Trade logged', { id, profit: trade.profit, txHash: trade.txHash });
        return id;
      } catch (error) {
        this.logger.error('Error logging trade:', error);
        throw error;
      }
    });
  }

  async logPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    if (metric.successRate < 0 || metric.successRate > 1) {
      throw new Error('Success rate must be between 0 and 1');
    }
    if (metric.totalTrades < 0 || metric.successfulTrades < 0) {
      throw new Error('Trade counts cannot be negative');
    }
    if (metric.successfulTrades > metric.totalTrades) {
      throw new Error('Successful trades cannot exceed total trades');
    }

    const stmt = this.db.prepare(`
      INSERT INTO performance_metrics (
        total_trades, successful_trades, total_profit, total_gas_cost,
        avg_profit_per_trade, success_rate, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        metric.totalTrades,
        metric.successfulTrades,
        metric.totalProfit,
        metric.totalGasCost,
        metric.avgProfitPerTrade,
        metric.successRate,
        metric.timestamp
      );

      this.logger.debug('Performance metric logged', { 
        totalTrades: metric.totalTrades,
        successRate: metric.successRate,
        totalProfit: metric.totalProfit
      });
    } catch (error) {
      this.logger.error('Error logging performance metric:', error);
      throw error;
    }
  }

  async logRiskEvent(event: RiskEvent): Promise<void> {
    this.validateRiskEvent(event);

    const stmt = this.db.prepare(`
      INSERT INTO risk_events (
        type, trade_id, message, severity, timestamp, action
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        event.type,
        event.tradeId || null,
        event.message,
        event.severity,
        event.timestamp,
        event.action
      );
      this.logger.info('Risk event logged', { type: event.type, severity: event.severity });
    } catch (error) {
      this.logger.error('Error logging risk event:', error);
      throw error;
    }
  }

  async getRecentOpportunities(limit: number = 100): Promise<ArbitrageOpportunity[]> {
    if (limit <= 0 || limit > 10000) {
      throw new Error('Limit must be between 1 and 10000');
    }

    const stmt = this.db.prepare(`
      SELECT * FROM arbitrage_opportunities
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    try {
      const rows = stmt.all(limit) as any[];
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
    } catch (error) {
      this.logger.error('Error getting recent opportunities:', error);
      throw error;
    }
  }

  async getPerformanceMetrics(hours: number = 24): Promise<PerformanceMetric[]> {
    if (hours <= 0 || hours > 8760) { // Max 1 year
      throw new Error('Hours must be between 1 and 8760');
    }

    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const stmt = this.db.prepare(`
      SELECT * FROM performance_metrics
      WHERE timestamp > ?
      ORDER BY timestamp DESC
    `);

    try {
      const rows = stmt.all(cutoff) as any[];
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
    } catch (error) {
      this.logger.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  // Backup and recovery methods
  async createBackup(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `arbitrage_db_backup_${timestamp}.db`;
        const backupPath = path.join(this.config.backupPath!, backupFileName);

        // Ensure backup directory exists
        if (!fs.existsSync(this.config.backupPath!)) {
          fs.mkdirSync(this.config.backupPath!, { recursive: true });
        }

        // Create backup
        this.db.backup(backupPath)
          .then(() => {
            // Calculate backup hash and size
            const backupBuffer = fs.readFileSync(backupPath);
            const backupHash = crypto.createHash('sha256').update(backupBuffer as any).digest('hex');
            const backupSize = backupBuffer.length;

            // Log backup
            const stmt = this.db.prepare(`
              INSERT INTO backup_log (backup_path, backup_size, backup_hash)
              VALUES (?, ?, ?)
            `);
            stmt.run(backupPath, backupSize, backupHash);

            // Cleanup old backups
            this.cleanupOldBackups();

            this.logger.info('Database backup created', { backupPath, backupSize, backupHash });
            resolve(backupPath);
          })
          .catch(reject);
      } catch (error) {
        this.logger.error('Error creating backup:', error);
        reject(error);
      }
    });
  }

  private cleanupOldBackups(): void {
    try {
      const stmt = this.db.prepare(`
        SELECT backup_path FROM backup_log 
        ORDER BY created_at DESC 
        LIMIT -1 OFFSET ?
      `);
      
      const oldBackups = stmt.all(this.config.maxBackups!) as any[];
      
      for (const backup of oldBackups) {
        if (fs.existsSync(backup.backup_path)) {
          fs.unlinkSync(backup.backup_path);
        }
      }

      // Remove old backup log entries
      const deleteStmt = this.db.prepare(`
        DELETE FROM backup_log 
        WHERE id NOT IN (
          SELECT id FROM backup_log 
          ORDER BY created_at DESC 
          LIMIT ?
        )
      `);
      deleteStmt.run(this.config.maxBackups!);

      this.logger.debug('Old backups cleaned up');
    } catch (error) {
      this.logger.error('Error cleaning up old backups:', error);
    }
  }

  // Data archiving and cleanup
  async archiveOldData(daysToKeep: number = 90): Promise<void> {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    return this.transaction(() => {
      // Archive old opportunities
      const archiveOpportunities = this.db.prepare(`
        DELETE FROM arbitrage_opportunities 
        WHERE timestamp < ? AND status IN ('executed', 'failed', 'expired')
      `);
      const opportunitiesDeleted = archiveOpportunities.run(cutoff).changes;

      // Archive old query performance data
      const archiveQueryPerf = this.db.prepare(`
        DELETE FROM query_performance 
        WHERE timestamp < ?
      `);
      const queryPerfDeleted = archiveQueryPerf.run(cutoff).changes;

      this.logger.info('Data archived', { 
        opportunitiesDeleted, 
        queryPerfDeleted,
        cutoffDate: new Date(cutoff).toISOString()
      });
    });
  }

  private cleanupOldPerformanceData(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // Keep 7 days
    
    try {
      const stmt = this.db.prepare(`
        DELETE FROM query_performance 
        WHERE timestamp < ?
      `);
      const deleted = stmt.run(cutoff).changes;
      
      if (deleted > 0) {
        this.logger.debug('Cleaned up old performance data', { recordsDeleted: deleted });
      }
    } catch (error) {
      this.logger.error('Error cleaning up performance data:', error);
    }
  }

  // Query performance analytics
  async getQueryPerformanceAnalytics(): Promise<any> {
    const stmt = this.db.prepare(`
      SELECT 
        query_hash,
        COUNT(*) as execution_count,
        AVG(execution_time) as avg_execution_time,
        MAX(execution_time) as max_execution_time,
        MIN(execution_time) as min_execution_time
      FROM query_performance 
      WHERE timestamp > ?
      GROUP BY query_hash
      ORDER BY avg_execution_time DESC
      LIMIT 20
    `);

    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    return stmt.all(last24Hours);
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: any;
  }> {
    try {
      const start = Date.now();
      
      // Basic connectivity test
      this.db.prepare('SELECT 1').get();
      
      // Get table counts
      const opportunityCount = this.db.prepare('SELECT COUNT(*) as count FROM arbitrage_opportunities').get() as any;
      const tradeCount = this.db.prepare('SELECT COUNT(*) as count FROM trades').get() as any;
      const riskEventCount = this.db.prepare('SELECT COUNT(*) as count FROM risk_events').get() as any;
      
      // Check recent activity
      const recentOpportunities = this.db.prepare(`
        SELECT COUNT(*) as count FROM arbitrage_opportunities 
        WHERE timestamp > ?
      `).get(Date.now() - (60 * 60 * 1000)) as any; // Last hour
      
      const responseTime = Date.now() - start;
      
      const metrics = {
        responseTime,
        tableStats: {
          opportunities: opportunityCount.count,
          trades: tradeCount.count,
          riskEvents: riskEventCount.count,
          recentOpportunities: recentOpportunities.count
        },
        databaseSize: fs.statSync(this.config.dbPath).size
      };

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (responseTime > 1000) {
        status = 'degraded';
      }
      if (responseTime > 5000) {
        status = 'unhealthy';
      }

      return { status, metrics };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        metrics: { error: (error as Error).message }
      };
    }
  }

  // Additional utility methods for comprehensive database operations
  async getBotState(): Promise<any> {
    const stmt = this.db.prepare(`
      SELECT status, last_heartbeat, config, created_at, updated_at 
      FROM bot_state 
      WHERE id = 1
    `);

    try {
      const result = stmt.get() as any;
      if (!result) {
        return null;
      }

      return {
        status: result.status,
        lastHeartbeat: result.last_heartbeat,
        config: JSON.parse(this.decrypt(result.config)),
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    } catch (error) {
      this.logger.error('Error getting bot state:', error);
      throw error;
    }
  }

  async getTradeHistory(options: {
    limit?: number;
    offset?: number;
    startDate?: number;
    endDate?: number;
    minProfit?: number;
    opportunityId?: number;
  } = {}): Promise<Trade[]> {
    const {
      limit = 100,
      offset = 0,
      startDate,
      endDate,
      minProfit,
      opportunityId
    } = options;

    if (limit <= 0 || limit > 10000) {
      throw new Error('Limit must be between 1 and 10000');
    }

    let query = 'SELECT * FROM trades WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    if (minProfit !== undefined) {
      query += ' AND profit >= ?';
      params.push(minProfit);
    }

    if (opportunityId) {
      query += ' AND opportunity_id = ?';
      params.push(opportunityId);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    try {
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];
      
      return rows.map(row => ({
        id: row.id,
        opportunityId: row.opportunity_id,
        executionPrice: row.execution_price,
        amount: row.amount,
        profit: row.profit,
        gasUsed: row.gas_used,
        txHash: row.tx_hash,
        timestamp: row.timestamp
      }));
    } catch (error) {
      this.logger.error('Error getting trade history:', error);
      throw error;
    }
  }

  async getRiskEvents(options: {
    limit?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    type?: string;
    hours?: number;
  } = {}): Promise<RiskEvent[]> {
    const { limit = 100, severity, type, hours = 24 } = options;

    if (limit <= 0 || limit > 10000) {
      throw new Error('Limit must be between 1 and 10000');
    }

    let query = 'SELECT * FROM risk_events WHERE timestamp > ?';
    const params: any[] = [Date.now() - (hours * 60 * 60 * 1000)];

    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    try {
      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];
      
      return rows.map(row => ({
        id: row.id,
        type: row.type,
        tradeId: row.trade_id,
        message: row.message,
        severity: row.severity as 'low' | 'medium' | 'high' | 'critical',
        timestamp: row.timestamp,
        action: row.action
      }));
    } catch (error) {
      this.logger.error('Error getting risk events:', error);
      throw error;
    }
  }

  // Advanced analytics methods
  async getTradeAnalytics(hours: number = 24): Promise<{
    totalTrades: number;
    successfulTrades: number;
    totalProfit: number;
    totalGasCost: number;
    avgProfitPerTrade: number;
    successRate: number;
    profitableTradesCount: number;
    avgGasUsed: number;
    bestTrade: any;
    worstTrade: any;
  }> {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    try {
      // Get basic statistics
      const statsResult = this.db.prepare(`
        SELECT 
          COUNT(*) as total_trades,
          COUNT(CASE WHEN profit > 0 THEN 1 END) as profitable_trades,
          SUM(profit) as total_profit,
          SUM(gas_used) as total_gas_cost,
          AVG(profit) as avg_profit,
          AVG(gas_used) as avg_gas_used
        FROM trades 
        WHERE timestamp > ?
      `).get(cutoff) as any;

      // Get best and worst trades
      const bestTrade = this.db.prepare(`
        SELECT * FROM trades 
        WHERE timestamp > ? 
        ORDER BY profit DESC 
        LIMIT 1
      `).get(cutoff) as any;

      const worstTrade = this.db.prepare(`
        SELECT * FROM trades 
        WHERE timestamp > ? 
        ORDER BY profit ASC 
        LIMIT 1
      `).get(cutoff) as any;

      const totalTrades = statsResult.total_trades || 0;
      const profitableTradesCount = statsResult.profitable_trades || 0;

      return {
        totalTrades,
        successfulTrades: profitableTradesCount,
        totalProfit: statsResult.total_profit || 0,
        totalGasCost: statsResult.total_gas_cost || 0,
        avgProfitPerTrade: statsResult.avg_profit || 0,
        successRate: totalTrades > 0 ? profitableTradesCount / totalTrades : 0,
        profitableTradesCount,
        avgGasUsed: statsResult.avg_gas_used || 0,
        bestTrade: bestTrade ? {
          id: bestTrade.id,
          profit: bestTrade.profit,
          txHash: bestTrade.tx_hash,
          timestamp: bestTrade.timestamp
        } : null,
        worstTrade: worstTrade ? {
          id: worstTrade.id,
          profit: worstTrade.profit,
          txHash: worstTrade.tx_hash,
          timestamp: worstTrade.timestamp
        } : null
      };
    } catch (error) {
      this.logger.error('Error getting trade analytics:', error);
      throw error;
    }
  }

  async getOpportunityAnalytics(hours: number = 24): Promise<{
    totalOpportunities: number;
    executedOpportunities: number;
    failedOpportunities: number;
    expiredOpportunities: number;
    avgProfitPercentage: number;
    topExchangePairs: any[];
    topTokenPairs: any[];
  }> {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    try {
      // Get basic opportunity statistics
      const statsResult = this.db.prepare(`
        SELECT 
          COUNT(*) as total_opportunities,
          COUNT(CASE WHEN status = 'executed' THEN 1 END) as executed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
          AVG(profit_percentage) as avg_profit_percentage
        FROM arbitrage_opportunities 
        WHERE timestamp > ?
      `).get(cutoff) as any;

      // Get top exchange pairs
      const topExchangePairs = this.db.prepare(`
        SELECT 
          exchange_a || ' -> ' || exchange_b as exchange_pair,
          COUNT(*) as opportunity_count,
          AVG(profit_percentage) as avg_profit_percentage
        FROM arbitrage_opportunities 
        WHERE timestamp > ?
        GROUP BY exchange_a, exchange_b
        ORDER BY opportunity_count DESC
        LIMIT 10
      `).all(cutoff) as any[];

      // Get top token pairs
      const topTokenPairs = this.db.prepare(`
        SELECT 
          token_a || '/' || token_b as token_pair,
          COUNT(*) as opportunity_count,
          AVG(profit_percentage) as avg_profit_percentage
        FROM arbitrage_opportunities 
        WHERE timestamp > ?
        GROUP BY token_a, token_b
        ORDER BY opportunity_count DESC
        LIMIT 10
      `).all(cutoff) as any[];

      return {
        totalOpportunities: statsResult.total_opportunities || 0,
        executedOpportunities: statsResult.executed || 0,
        failedOpportunities: statsResult.failed || 0,
        expiredOpportunities: statsResult.expired || 0,
        avgProfitPercentage: statsResult.avg_profit_percentage || 0,
        topExchangePairs: topExchangePairs.map(pair => ({
          exchangePair: pair.exchange_pair,
          count: pair.opportunity_count,
          avgProfitPercentage: pair.avg_profit_percentage
        })),
        topTokenPairs: topTokenPairs.map(pair => ({
          tokenPair: pair.token_pair,
          count: pair.opportunity_count,
          avgProfitPercentage: pair.avg_profit_percentage
        }))
      };
    } catch (error) {
      this.logger.error('Error getting opportunity analytics:', error);
      throw error;
    }
  }

  // Database maintenance methods
  async optimizeDatabase(): Promise<void> {
    try {
      this.logger.info('Starting database optimization...');
      
      // Analyze tables for better query planning
      this.db.exec('ANALYZE');
      
      // Rebuild indexes if needed
      this.db.exec('REINDEX');
      
      // Vacuum the database to reclaim space
      this.db.exec('VACUUM');
      
      this.logger.info('Database optimization completed');
    } catch (error) {
      this.logger.error('Error optimizing database:', error);
      throw error;
    }
  }

  async getDatabaseStats(): Promise<{
    size: number;
    pageCount: number;
    pageSize: number;
    freePages: number;
    tableStats: any[];
  }> {
    try {
      const pragmaInfo = this.db.prepare('PRAGMA page_count').get() as any;
      const pageSize = this.db.prepare('PRAGMA page_size').get() as any;
      const freePages = this.db.prepare('PRAGMA freelist_count').get() as any;
      
      const tableStats = this.db.prepare(`
        SELECT 
          name,
          (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as index_count
        FROM sqlite_master m 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as any[];

      // Get row counts for each table
      const enrichedTableStats = tableStats.map(table => {
        try {
          const rowCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as any;
          return {
            name: table.name,
            rowCount: rowCount.count,
            indexCount: table.index_count
          };
        } catch (error) {
          return {
            name: table.name,
            rowCount: 0,
            indexCount: table.index_count
          };
        }
      });

      return {
        size: fs.statSync(this.config.dbPath).size,
        pageCount: pragmaInfo.page_count || 0,
        pageSize: pageSize.page_size || 0,
        freePages: freePages.freelist_count || 0,
        tableStats: enrichedTableStats
      };
    } catch (error) {
      this.logger.error('Error getting database stats:', error);
      throw error;
    }
  }

  // Connection test method
  async testConnection(): Promise<boolean> {
    try {
      const result = this.db.prepare('SELECT 1 as test').get();
      return Boolean(result && (result as any).test === 1);
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      return false;
    }
  }

  close(): void {
    try {
      // Clear performance cache
      this.queryPerformanceCache.clear();
      
      // Clear access mutex
      this.accessMutex.clear();
      
      // Close database connection
      this.db.close();
      
      this.logger.info('Database connection closed');
    } catch (error) {
      this.logger.error('Error closing database:', error);
    }
  }
}