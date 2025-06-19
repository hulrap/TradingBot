import Database, { Database as DatabaseType } from 'better-sqlite3';
import { User, Wallet, Trade, BotConfig } from '@trading-bot/types';
import { encrypt, decrypt, isLegacyFormat, migrateEncryption } from '@trading-bot/crypto';

// Database connection with security settings
const db: DatabaseType = new Database(process.env['DATABASE_PATH'] || 'trading_bot.db', {
  verbose: process.env['NODE_ENV'] === 'development' ? console.log : undefined,
});

// Enable WAL mode for better concurrency and durability
db.pragma('journal_mode = WAL');
db.pragma('synchronous = FULL');
db.pragma('foreign_keys = ON');

// Security audit log
interface AuditLog {
  action: string;
  table: string;
  recordId: string;
  userId?: string | undefined;
  timestamp: string;
  success: boolean;
  error?: string;
}

/**
 * Logs database operations for security auditing
 */
function logAuditEvent(event: Omit<AuditLog, 'timestamp'>): void {
  try {
    const auditStmt = db.prepare(`
      INSERT INTO audit_log (action, table_name, record_id, user_id, success, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    auditStmt.run(event.action, event.table, event.recordId, event.userId || null, event.success, event.error || null);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Validates input data to prevent injection attacks
 */
function validateInput(data: any, fieldName: string): void {
  if (data === null || data === undefined) {
    throw new Error(`${fieldName} cannot be null or undefined`);
  }
  
  if (typeof data === 'string' && data.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  
  if (typeof data === 'string' && data.length > 10000) {
    throw new Error(`${fieldName} is too long`);
  }
  
  // Check for potential SQL injection patterns
  const sqlInjectionPattern = /('|(--)|(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|JAVASCRIPT)\b))/i;
  if (typeof data === 'string' && sqlInjectionPattern.test(data)) {
    throw new Error(`${fieldName} contains invalid characters`);
  }
}

/**
 * Validates email format
 */
function validateEmail(email: string): void {
  validateInput(email, 'email');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
}

/**
 * Validates wallet address format
 */
function validateWalletAddress(address: string, chain: string): void {
  validateInput(address, 'address');
  validateInput(chain, 'chain');
  
  // Basic validation patterns for different chains
  const patterns: Record<string, RegExp> = {
    ethereum: /^0x[a-fA-F0-9]{40}$/,
    bsc: /^0x[a-fA-F0-9]{40}$/,
    polygon: /^0x[a-fA-F0-9]{40}$/,
    arbitrum: /^0x[a-fA-F0-9]{40}$/,
    optimism: /^0x[a-fA-F0-9]{40}$/,
    solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  };
  
  const pattern = patterns[chain.toLowerCase()];
  if (pattern && !pattern.test(address)) {
    throw new Error(`Invalid ${chain} address format`);
  }
}

/**
 * Encrypts private key with additional validation
 */
function encryptPrivateKey(privateKey: string): string {
  validateInput(privateKey, 'privateKey');
  
  // Validate private key format (basic validation)
  if (privateKey.length < 32 || privateKey.length > 256) {
    throw new Error('Invalid private key length');
  }
  
  // Encrypt the private key
  return encrypt(privateKey);
}

/**
 * Decrypts private key with migration support
 */
function decryptPrivateKey(encryptedPrivateKey: string): string {
  validateInput(encryptedPrivateKey, 'encryptedPrivateKey');
  
  try {
    // Check if it's legacy format and migrate if needed
    if (isLegacyFormat(encryptedPrivateKey)) {
      console.warn('Migrating legacy encrypted private key');
      const migratedKey = migrateEncryption(encryptedPrivateKey);
      // Note: In production, you should update the database with the migrated key
      return decrypt(migratedKey);
    } else {
      return decrypt(encryptedPrivateKey);
    }
  } catch (error) {
    throw new Error('Failed to decrypt private key');
  }
}

// Initialize database schema
export function initializeDatabase() {
  const transaction = db.transaction(() => {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (length(email) > 0 AND length(email) < 255),
        CHECK (length(password_hash) > 0)
      )
    `);

    // Wallets table with better constraints
    db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        address TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        chain TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CHECK (length(address) > 0 AND length(address) < 100),
        CHECK (length(encrypted_private_key) > 0),
        CHECK (chain IN ('ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana')),
        UNIQUE(user_id, address, chain)
      )
    `);

    // Bot configurations table with better validation
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        bot_type TEXT NOT NULL,
        config_data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE,
        CHECK (bot_type IN ('ARBITRAGE', 'COPY_TRADING', 'MEV_SANDWICH', 'PAPER_TRADING')),
        CHECK (length(config_data) > 0)
      )
    `);

    // Trades table with better constraints
    db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        bot_config_id TEXT NOT NULL,
        bot_type TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        chain TEXT NOT NULL,
        token_in TEXT NOT NULL,
        token_out TEXT NOT NULL,
        amount_in TEXT NOT NULL,
        amount_out TEXT NOT NULL,
        gas_used TEXT NOT NULL,
        gas_price TEXT NOT NULL,
        profit TEXT,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (bot_config_id) REFERENCES bot_configs (id) ON DELETE CASCADE,
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
        CHECK (length(tx_hash) > 0),
        CHECK (chain IN ('ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'solana'))
      )
    `);

    // Bot status table
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_status (
        bot_config_id TEXT PRIMARY KEY,
        is_running BOOLEAN DEFAULT FALSE,
        last_activity DATETIME,
        total_trades INTEGER DEFAULT 0,
        total_profit TEXT DEFAULT '0',
        errors TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_config_id) REFERENCES bot_configs (id) ON DELETE CASCADE
      )
    `);

    // Audit log table for security monitoring
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        user_id TEXT,
        success BOOLEAN NOT NULL,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (action IN ('CREATE', 'READ', 'UPDATE', 'DELETE'))
      )
    `);

    // Create indexes for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);
      CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs (user_id);
      CREATE INDEX IF NOT EXISTS idx_trades_bot_config_id ON trades (bot_config_id);
      CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
    `);
  });

  try {
    transaction();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// User operations with security enhancements
export const userDb = {
  create: (user: Omit<User, 'createdAt' | 'updatedAt'>) => {
    try {
      validateInput(user.id, 'user.id');
      validateEmail(user.email);
      validateInput(user.encryptedPrivateKey, 'user.passwordHash');

      const stmt = db.prepare(`
        INSERT INTO users (id, email, password_hash)
        VALUES (?, ?, ?)
      `);
      
      const result = stmt.run(user.id, user.email, user.encryptedPrivateKey);
      
      logAuditEvent({
        action: 'CREATE',
        table: 'users',
        recordId: user.id,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'CREATE',
        table: 'users',
        recordId: user.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findByEmail: (email: string): User | null => {
    try {
      validateEmail(email);
      
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email) as any;
      
      if (!user) return null;
      
      const result = {
        id: user.id,
        email: user.email,
        encryptedPrivateKey: user.password_hash,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
      
      logAuditEvent({
        action: 'READ',
        table: 'users',
        recordId: user.id,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'users',
        recordId: 'unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findById: (id: string): User | null => {
    try {
      validateInput(id, 'id');
      
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
      const user = stmt.get(id) as any;
      
      if (!user) return null;
      
      const result = {
        id: user.id,
        email: user.email,
        encryptedPrivateKey: user.password_hash,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
      
      logAuditEvent({
        action: 'READ',
        table: 'users',
        recordId: id,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'users',
        recordId: id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },
};

// Wallet operations with encryption and security
export const walletDb = {
  create: (wallet: Omit<Wallet, 'createdAt'>) => {
    try {
      validateInput(wallet.id, 'wallet.id');
      validateInput(wallet.userId, 'wallet.userId');
      validateWalletAddress(wallet.address, wallet.chain);
      validateInput(wallet.encryptedPrivateKey, 'wallet.privateKey');

      // Encrypt the private key before storing
      const encryptedPrivateKey = encryptPrivateKey(wallet.encryptedPrivateKey);

      const stmt = db.prepare(`
        INSERT INTO wallets (id, user_id, address, encrypted_private_key, chain, name)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        wallet.id,
        wallet.userId,
        wallet.address,
        encryptedPrivateKey,
        wallet.chain,
        wallet.name
      );
      
      logAuditEvent({
        action: 'CREATE',
        table: 'wallets',
        recordId: wallet.id,
        userId: wallet.userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'CREATE',
        table: 'wallets',
        recordId: wallet.id,
        userId: wallet.userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findByUserId: (userId: string): Wallet[] => {
    try {
      validateInput(userId, 'userId');
      
      const stmt = db.prepare('SELECT * FROM wallets WHERE user_id = ? ORDER BY created_at DESC');
      const wallets = stmt.all(userId) as any[];
      
      const result = wallets.map(w => ({
        id: w.id,
        userId: w.user_id,
        address: w.address,
        encryptedPrivateKey: w.encrypted_private_key, // Keep encrypted for security
        chain: w.chain,
        name: w.name,
        createdAt: w.created_at,
      }));
      
      logAuditEvent({
        action: 'READ',
        table: 'wallets',
        recordId: 'multiple',
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'wallets',
        recordId: 'multiple',
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findById: (id: string): Wallet | null => {
    try {
      validateInput(id, 'id');
      
      const stmt = db.prepare('SELECT * FROM wallets WHERE id = ?');
      const wallet = stmt.get(id) as any;
      
      if (!wallet) return null;
      
      const result = {
        id: wallet.id,
        userId: wallet.user_id,
        address: wallet.address,
        encryptedPrivateKey: wallet.encrypted_private_key, // Keep encrypted
        chain: wallet.chain,
        name: wallet.name,
        createdAt: wallet.created_at,
      };
      
      logAuditEvent({
        action: 'READ',
        table: 'wallets',
        recordId: id,
        userId: wallet.user_id,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'wallets',
        recordId: id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  // Helper method to decrypt private key when needed (use carefully)
  getDecryptedPrivateKey: (id: string, userId: string): string => {
    try {
      const wallet = walletDb.findById(id);
      if (!wallet || wallet.userId !== userId) {
        throw new Error('Wallet not found or access denied');
      }
      
      return decryptPrivateKey(wallet.encryptedPrivateKey);
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'wallets',
        recordId: id,
        userId: userId,
        success: false,
        error: 'Private key decryption failed'
      });
      throw error;
    }
  },

  delete: (id: string, userId: string) => {
    try {
      validateInput(id, 'id');
      validateInput(userId, 'userId');
      
      // Verify ownership before deletion
      const wallet = walletDb.findById(id);
      if (!wallet || wallet.userId !== userId) {
        throw new Error('Wallet not found or access denied');
      }
      
      const stmt = db.prepare('DELETE FROM wallets WHERE id = ? AND user_id = ?');
      const result = stmt.run(id, userId);
      
      logAuditEvent({
        action: 'DELETE',
        table: 'wallets',
        recordId: id,
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'DELETE',
        table: 'wallets',
        recordId: id,
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },
};

// Bot config operations with security and validation
export const botConfigDb = {
  create: (config: Omit<BotConfig, 'createdAt' | 'updatedAt'>) => {
    try {
      validateInput(config.id, 'config.id');
      validateInput(config.userId, 'config.userId');
      validateInput(config.walletId, 'config.walletId');
      validateInput(config.isActive, 'config.isActive');

      // Validate that the wallet belongs to the user
      const wallet = walletDb.findById(config.walletId);
      if (!wallet || wallet.userId !== config.userId) {
        throw new Error('Wallet not found or does not belong to user');
      }

      // Determine bot type from config
      const botType = determineBotType(config);
      
      const stmt = db.prepare(`
        INSERT INTO bot_configs (id, user_id, wallet_id, bot_type, config_data, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        config.id,
        config.userId,
        config.walletId,
        botType,
        JSON.stringify(config),
        config.isActive
      );
      
      logAuditEvent({
        action: 'CREATE',
        table: 'bot_configs',
        recordId: config.id,
        userId: config.userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'CREATE',
        table: 'bot_configs',
        recordId: config.id,
        userId: config.userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findByUserId: (userId: string): BotConfig[] => {
    try {
      validateInput(userId, 'userId');
      
      const stmt = db.prepare('SELECT * FROM bot_configs WHERE user_id = ? ORDER BY created_at DESC');
      const configs = stmt.all(userId) as any[];
      
      const result = configs.map(c => {
        try {
          return JSON.parse(c.config_data);
        } catch (error) {
          console.error('Failed to parse bot config:', error);
          return null;
        }
      }).filter(config => config !== null);
      
      logAuditEvent({
        action: 'READ',
        table: 'bot_configs',
        recordId: 'multiple',
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'bot_configs',
        recordId: 'multiple',
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findById: (id: string, userId?: string): BotConfig | null => {
    try {
      validateInput(id, 'id');
      
      let stmt;
      let config;
      
      if (userId) {
        // If userId provided, ensure ownership
        stmt = db.prepare('SELECT * FROM bot_configs WHERE id = ? AND user_id = ?');
        config = stmt.get(id, userId) as any;
      } else {
        stmt = db.prepare('SELECT * FROM bot_configs WHERE id = ?');
        config = stmt.get(id) as any;
      }
      
      if (!config) return null;
      
      const result = JSON.parse(config.config_data);
      
      logAuditEvent({
        action: 'READ',
        table: 'bot_configs',
        recordId: id,
        userId: userId || config.user_id || undefined,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'bot_configs',
        recordId: id,
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  updateStatus: (id: string, isActive: boolean, userId: string) => {
    try {
      validateInput(id, 'id');
      validateInput(userId, 'userId');
      validateInput(isActive, 'isActive');
      
      // Verify ownership
      const config = botConfigDb.findById(id, userId);
      if (!config) {
        throw new Error('Bot configuration not found or access denied');
      }
      
      const stmt = db.prepare('UPDATE bot_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive, id, userId);
      
      logAuditEvent({
        action: 'UPDATE',
        table: 'bot_configs',
        recordId: id,
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'UPDATE',
        table: 'bot_configs',
        recordId: id,
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  delete: (id: string, userId: string) => {
    try {
      validateInput(id, 'id');
      validateInput(userId, 'userId');
      
      // Verify ownership
      const config = botConfigDb.findById(id, userId);
      if (!config) {
        throw new Error('Bot configuration not found or access denied');
      }
      
      const stmt = db.prepare('DELETE FROM bot_configs WHERE id = ? AND user_id = ?');
      const result = stmt.run(id, userId);
      
      logAuditEvent({
        action: 'DELETE',
        table: 'bot_configs',
        recordId: id,
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'DELETE',
        table: 'bot_configs',
        recordId: id,
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },
};

// Trade operations with security and validation
export const tradeDb = {
  create: (trade: Omit<Trade, 'createdAt' | 'completedAt'>) => {
    try {
      validateInput(trade.id, 'trade.id');
      validateInput(trade.botConfigId, 'trade.botConfigId');
      validateInput(trade.botType, 'trade.botType');
      validateInput(trade.txHash, 'trade.txHash');
      validateInput(trade.chain, 'trade.chain');
      validateInput(trade.status, 'trade.status');

      // Validate that the bot config exists
      const config = botConfigDb.findById(trade.botConfigId);
      if (!config) {
        throw new Error('Bot configuration not found');
      }

      const stmt = db.prepare(`
        INSERT INTO trades (id, bot_config_id, bot_type, tx_hash, chain, token_in, token_out, amount_in, amount_out, gas_used, gas_price, profit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        trade.id,
        trade.botConfigId,
        trade.botType,
        trade.txHash,
        trade.chain,
        trade.tokenIn,
        trade.tokenOut,
        trade.amountIn,
        trade.amountOut,
        trade.gasUsed,
        trade.gasPrice,
        trade.profit,
        trade.status
      );
      
      logAuditEvent({
        action: 'CREATE',
        table: 'trades',
        recordId: trade.id,
        userId: config.userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'CREATE',
        table: 'trades',
        recordId: trade.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findByBotConfigId: (botConfigId: string, userId: string): Trade[] => {
    try {
      validateInput(botConfigId, 'botConfigId');
      validateInput(userId, 'userId');
      
      // Verify ownership of bot config
      const config = botConfigDb.findById(botConfigId, userId);
      if (!config) {
        throw new Error('Bot configuration not found or access denied');
      }
      
      const stmt = db.prepare('SELECT * FROM trades WHERE bot_config_id = ? ORDER BY created_at DESC');
      const trades = stmt.all(botConfigId) as any[];
      
      const result = trades.map(t => ({
        id: t.id,
        botConfigId: t.bot_config_id,
        botType: t.bot_type,
        txHash: t.tx_hash,
        chain: t.chain,
        tokenIn: t.token_in,
        tokenOut: t.token_out,
        amountIn: t.amount_in,
        amountOut: t.amount_out,
        gasUsed: t.gas_used,
        gasPrice: t.gas_price,
        profit: t.profit,
        status: t.status,
        createdAt: t.created_at,
        completedAt: t.completed_at,
      }));
      
      logAuditEvent({
        action: 'READ',
        table: 'trades',
        recordId: 'multiple',
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'trades',
        recordId: 'multiple',
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  findByUserId: (userId: string): Trade[] => {
    try {
      validateInput(userId, 'userId');
      
      const stmt = db.prepare(`
        SELECT t.* FROM trades t
        JOIN bot_configs bc ON t.bot_config_id = bc.id
        WHERE bc.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT 1000
      `);
      
      const trades = stmt.all(userId) as any[];
      
      const result = trades.map(t => ({
        id: t.id,
        botConfigId: t.bot_config_id,
        botType: t.bot_type,
        txHash: t.tx_hash,
        chain: t.chain,
        tokenIn: t.token_in,
        tokenOut: t.token_out,
        amountIn: t.amount_in,
        amountOut: t.amount_out,
        gasUsed: t.gas_used,
        gasPrice: t.gas_price,
        profit: t.profit,
        status: t.status,
        createdAt: t.created_at,
        completedAt: t.completed_at,
      }));
      
      logAuditEvent({
        action: 'READ',
        table: 'trades',
        recordId: 'multiple',
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'trades',
        recordId: 'multiple',
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },

  updateStatus: (id: string, status: Trade['status'], userId: string, completedAt?: string) => {
    try {
      validateInput(id, 'id');
      validateInput(status, 'status');
      validateInput(userId, 'userId');
      
      // Verify ownership through bot config
      const trade = tradeDb.findById(id, userId);
      if (!trade) {
        throw new Error('Trade not found or access denied');
      }
      
      const stmt = db.prepare('UPDATE trades SET status = ?, completed_at = ? WHERE id = ?');
      const result = stmt.run(status, completedAt || null, id);
      
      logAuditEvent({
        action: 'UPDATE',
        table: 'trades',
        recordId: id,
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'UPDATE',
        table: 'trades',
        recordId: id,
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },
  
  findById: (id: string, userId: string): Trade | null => {
    try {
      validateInput(id, 'id');
      validateInput(userId, 'userId');
      
      const stmt = db.prepare(`
        SELECT t.* FROM trades t
        JOIN bot_configs bc ON t.bot_config_id = bc.id
        WHERE t.id = ? AND bc.user_id = ?
      `);
      
      const trade = stmt.get(id, userId) as any;
      if (!trade) return null;
      
      const result = {
        id: trade.id,
        botConfigId: trade.bot_config_id,
        botType: trade.bot_type,
        txHash: trade.tx_hash,
        chain: trade.chain,
        tokenIn: trade.token_in,
        tokenOut: trade.token_out,
        amountIn: trade.amount_in,
        amountOut: trade.amount_out,
        gasUsed: trade.gas_used,
        gasPrice: trade.gas_price,
        profit: trade.profit,
        status: trade.status,
        createdAt: trade.created_at,
        completedAt: trade.completed_at,
      };
      
      logAuditEvent({
        action: 'READ',
        table: 'trades',
        recordId: id,
        userId: userId,
        success: true
      });
      
      return result;
    } catch (error) {
      logAuditEvent({
        action: 'READ',
        table: 'trades',
        recordId: id,
        userId: userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  },
};

/**
 * Determines bot type from configuration
 */
function determineBotType(config: any): string {
  // This is a simplified implementation - in production, you'd have more sophisticated logic
  if (config.type) {
    return config.type.toUpperCase();
  }
  
  // Fallback logic based on config properties
  if (config.arbitrageConfig) return 'ARBITRAGE';
  if (config.copyTradingConfig) return 'COPY_TRADING';
  if (config.mevConfig) return 'MEV_SANDWICH';
  if (config.paperTradingConfig) return 'PAPER_TRADING';
  
  return 'ARBITRAGE'; // Default fallback
}

/**
 * Gets database statistics for monitoring
 */
export function getDatabaseStats(): {
  users: number;
  wallets: number;
  botConfigs: number;
  trades: number;
  auditLogs: number;
} {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const walletCount = db.prepare('SELECT COUNT(*) as count FROM wallets').get() as any;
    const botConfigCount = db.prepare('SELECT COUNT(*) as count FROM bot_configs').get() as any;
    const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get() as any;
    const auditLogCount = db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as any;
    
    return {
      users: userCount.count,
      wallets: walletCount.count,
      botConfigs: botConfigCount.count,
      trades: tradeCount.count,
      auditLogs: auditLogCount.count,
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return {
      users: 0,
      wallets: 0,
      botConfigs: 0,
      trades: 0,
      auditLogs: 0,
    };
  }
}

/**
 * Gets recent audit logs for security monitoring
 */
export function getRecentAuditLogs(limit: number = 100): AuditLog[] {
  try {
    const stmt = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?');
    const logs = stmt.all(limit) as any[];
    
    return logs.map(log => ({
      action: log.action,
      table: log.table_name,
      recordId: log.record_id,
      userId: log.user_id,
      timestamp: log.created_at,
      success: log.success,
      error: log.error,
    }));
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

/**
 * Performs database cleanup and maintenance
 */
export function performDatabaseMaintenance(): void {
  try {
    // Clean up old audit logs (keep last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const cleanupStmt = db.prepare('DELETE FROM audit_log WHERE created_at < ?');
    const result = cleanupStmt.run(thirtyDaysAgo);
    
    // Optimize database
    db.exec('PRAGMA optimize');
    
    console.log(`Database maintenance completed. Cleaned up ${result.changes} old audit log entries.`);
  } catch (error) {
    console.error('Database maintenance failed:', error);
  }
}

// Initialize database on import
initializeDatabase();

export default db; 