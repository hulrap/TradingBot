import dotenv from 'dotenv';
import winston from 'winston';
import cron from 'node-cron';
import { ArbitrageEngine } from './arbitrage-engine';
import { DatabaseManager } from './database-manager';
import { ConfigManager } from './config-manager';

// Load environment variables
dotenv.config();

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'arbitrage-bot' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class ArbitrageBot {
  private engine: ArbitrageEngine;
  private database: DatabaseManager;
  private config: ConfigManager;
  private isRunning = false;

  constructor() {
    this.config = new ConfigManager();
    this.database = new DatabaseManager();
    this.engine = new ArbitrageEngine(this.config, this.database, logger);
  }

  async start() {
    try {
      logger.info('Starting Arbitrage Bot...');
      
      // Initialize components
      await this.database.initialize();
      await this.engine.initialize();
      
      this.isRunning = true;
      
      // Start the main arbitrage scanning loop
      this.startArbitrageLoop();
      
      // Schedule periodic tasks
      this.schedulePeriodicTasks();
      
      logger.info('Arbitrage Bot started successfully');
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      logger.error('Failed to start Arbitrage Bot:', error);
      process.exit(1);
    }
  }

  private startArbitrageLoop() {
    // Main arbitrage detection loop - runs every 5 seconds
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.engine.scanForOpportunities();
      } catch (error) {
        logger.error('Error in arbitrage loop:', error);
      }
    }, 5000);
  }

  private schedulePeriodicTasks() {
    // Update performance metrics every minute
    cron.schedule('* * * * *', async () => {
      if (!this.isRunning) return;
      
      try {
        await this.engine.updatePerformanceMetrics();
      } catch (error) {
        logger.error('Error updating performance metrics:', error);
      }
    });

    // Clean up old data every hour
    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) return;
      
      try {
        await this.database.cleanupOldData();
      } catch (error) {
        logger.error('Error cleaning up old data:', error);
      }
    });

    // Health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      if (!this.isRunning) return;
      
      try {
        await this.engine.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    });
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      this.isRunning = false;
      
      try {
        await this.engine.shutdown();
        await this.database.close();
        logger.info('Arbitrage Bot shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2'));
  }
}

// Start the bot
const bot = new ArbitrageBot();
bot.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
}); 