import Database from 'better-sqlite3';
import winston from 'winston';

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

export class DatabaseManager {
  private db: Database.Database;
  private logger: winston.Logger;

  constructor(dbPath: string, logger: winston.Logger) {
    this.logger = logger;
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Bot state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bot_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        last_heartbeat INTEGER NOT NULL,
        config TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Arbitrage opportunities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_a TEXT NOT NULL,
        token_b TEXT NOT NULL,
        exchange_a TEXT NOT NULL,
        exchange_b TEXT NOT NULL,
        price_a REAL NOT NULL,
        price_b REAL NOT NULL,
        profit_percentage REAL NOT NULL,
        profit_usd REAL NOT NULL,
        gas_estimate INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      );
    `);

    // Trades table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opportunity_id INTEGER,
        execution_price REAL NOT NULL,
        amount REAL NOT NULL,
        profit REAL NOT NULL,
        gas_used INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (opportunity_id) REFERENCES arbitrage_opportunities (id)
      );
    `);

    // Performance metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_trades INTEGER NOT NULL,
        successful_trades INTEGER NOT NULL,
        total_profit REAL NOT NULL,
        total_gas_cost REAL NOT NULL,
        avg_profit_per_trade REAL NOT NULL,
        success_rate REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    // Risk events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS risk_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        trade_id TEXT,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        action TEXT NOT NULL
      );
    `);

    this.logger.info('Database tables initialized');
  }

  async updateBotState(status: string, config: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bot_state (id, status, last_heartbeat, config)
      VALUES (1, ?, ?, ?)
    `);

    try {
      stmt.run(status, Date.now(), JSON.stringify(config));
      this.logger.debug('Bot state updated', { status });
    } catch (error) {
      this.logger.error('Error updating bot state:', error);
      throw error;
    }
  }

  async logOpportunity(opportunity: ArbitrageOpportunity): Promise<number> {
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

      this.logger.info('Opportunity logged', { id: result.lastInsertRowid });
      return result.lastInsertRowid as number;
    } catch (error) {
      this.logger.error('Error logging opportunity:', error);
      throw error;
    }
  }

  async logTrade(trade: Trade): Promise<number> {
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

      this.logger.info('Trade logged', { id: result.lastInsertRowid });
      return result.lastInsertRowid as number;
    } catch (error) {
      this.logger.error('Error logging trade:', error);
      throw error;
    }
  }

  async logPerformanceMetric(metric: PerformanceMetric): Promise<void> {
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

      this.logger.debug('Performance metric logged');
    } catch (error) {
      this.logger.error('Error logging performance metric:', error);
      throw error;
    }
  }

  async logRiskEvent(event: any): Promise<void> {
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
      this.logger.info('Risk event logged', event);
    } catch (error) {
      this.logger.error('Error logging risk event:', error);
      throw error;
    }
  }

  async getRecentOpportunities(limit: number = 100): Promise<ArbitrageOpportunity[]> {
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

  close(): void {
    this.db.close();
    this.logger.info('Database connection closed');
  }
}