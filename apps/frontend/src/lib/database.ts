import Database, { Database as DatabaseType } from 'better-sqlite3';
import { User, Wallet, Trade, BotConfig } from '@trading-bot/types';

// Database connection
const db: DatabaseType = new Database(process.env['DATABASE_PATH'] || 'trading_bot.db');

// Initialize database schema
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
  `);

  // Wallets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      address TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      chain TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Bot configurations table
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
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (wallet_id) REFERENCES wallets (id)
    )
  `);

  // Trades table
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
      FOREIGN KEY (bot_config_id) REFERENCES bot_configs (id)
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
      FOREIGN KEY (bot_config_id) REFERENCES bot_configs (id)
    )
  `);

  console.log('Database initialized successfully');
}

// User operations with correct field mapping and security
export const userDb = {
  create: (user: { id: string; email: string; passwordHash: string }) => {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (?, ?, ?)
    `);
    return stmt.run(user.id, user.email, user.passwordHash);
  },

  findByEmail: (email: string): (User & { passwordHash: string }) | null => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email) as any;
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      // Map the correct field - this should NOT be encryptedPrivateKey
      passwordHash: user.password_hash,
      encryptedPrivateKey: '', // Not stored in users table
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  },

  findById: (id: string): (User & { passwordHash: string }) | null => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id) as any;
    if (!user) return null;
    
    return {
      id: user.id,
      email: user.email,
      // Map the correct field - this should NOT be encryptedPrivateKey  
      passwordHash: user.password_hash,
      encryptedPrivateKey: '', // Not stored in users table
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  },

  updateLastLogin: (id: string) => {
    const stmt = db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(id);
  },

  updatePassword: (id: string, passwordHash: string) => {
    const stmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(passwordHash, id);
  },
};

// Wallet operations with enhanced security
export const walletDb = {
  create: (wallet: Omit<Wallet, 'createdAt'>) => {
    const stmt = db.prepare(`
      INSERT INTO wallets (id, user_id, address, encrypted_private_key, chain, name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      wallet.id,
      wallet.userId,
      wallet.address,
      wallet.encryptedPrivateKey,
      wallet.chain,
      wallet.name || null
    );
  },

  findByUserId: (userId: string): Wallet[] => {
    const stmt = db.prepare('SELECT * FROM wallets WHERE user_id = ?');
    const wallets = stmt.all(userId) as any[];
    return wallets.map(w => ({
      id: w.id,
      userId: w.user_id,
      address: w.address,
      encryptedPrivateKey: w.encrypted_private_key,
      chain: w.chain,
      name: w.name,
      createdAt: w.created_at,
    }));
  },

  findById: (id: string): Wallet | null => {
    const stmt = db.prepare('SELECT * FROM wallets WHERE id = ?');
    const wallet = stmt.get(id) as any;
    if (!wallet) return null;
    return {
      id: wallet.id,
      userId: wallet.user_id,
      address: wallet.address,
      encryptedPrivateKey: wallet.encrypted_private_key,
      chain: wallet.chain,
      name: wallet.name,
      createdAt: wallet.created_at,
    };
  },

  findByUserIdAndId: (userId: string, walletId: string): Wallet | null => {
    const stmt = db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?');
    const wallet = stmt.get(walletId, userId) as any;
    if (!wallet) return null;
    return {
      id: wallet.id,
      userId: wallet.user_id,
      address: wallet.address,
      encryptedPrivateKey: wallet.encrypted_private_key,
      chain: wallet.chain,
      name: wallet.name,
      createdAt: wallet.created_at,
    };
  },

  updateName: (id: string, userId: string, name: string) => {
    const stmt = db.prepare('UPDATE wallets SET name = ? WHERE id = ? AND user_id = ?');
    return stmt.run(name, id, userId);
  },

  delete: (id: string, userId: string) => {
    const stmt = db.prepare('DELETE FROM wallets WHERE id = ? AND user_id = ?');
    return stmt.run(id, userId);
  },
};

// Bot config operations with enhanced validation
export const botConfigDb = {
  create: (config: Omit<BotConfig, 'createdAt' | 'updatedAt'>) => {
    const stmt = db.prepare(`
      INSERT INTO bot_configs (id, user_id, wallet_id, bot_type, config_data, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    // Determine bot type from config
    let botType = 'UNKNOWN';
    if ('tokenPair' in config && 'minProfitThreshold' in config) {
      botType = 'ARBITRAGE';
    } else if ('targetWalletAddress' in config) {
      botType = 'COPY_TRADER';
    } else if ('targetDex' in config && 'minVictimTradeSize' in config) {
      botType = 'MEV_SANDWICH';
    }
    
    return stmt.run(
      config.id,
      config.userId,
      config.walletId,
      botType,
      JSON.stringify(config),
      config.isActive || false
    );
  },

  findByUserId: (userId: string): BotConfig[] => {
    const stmt = db.prepare('SELECT * FROM bot_configs WHERE user_id = ? ORDER BY created_at DESC');
    const configs = stmt.all(userId) as any[];
    return configs.map(c => {
      try {
        return JSON.parse(c.config_data);
      } catch (error) {
        console.error('Failed to parse bot config:', error);
        return null;
      }
    }).filter(Boolean);
  },

  findById: (id: string): BotConfig | null => {
    const stmt = db.prepare('SELECT * FROM bot_configs WHERE id = ?');
    const config = stmt.get(id) as any;
    if (!config) return null;
    try {
      return JSON.parse(config.config_data);
    } catch (error) {
      console.error('Failed to parse bot config:', error);
      return null;
    }
  },

  findByUserIdAndId: (userId: string, configId: string): BotConfig | null => {
    const stmt = db.prepare('SELECT * FROM bot_configs WHERE id = ? AND user_id = ?');
    const config = stmt.get(configId, userId) as any;
    if (!config) return null;
    try {
      return JSON.parse(config.config_data);
    } catch (error) {
      console.error('Failed to parse bot config:', error);
      return null;
    }
  },

  updateStatus: (id: string, userId: string, isActive: boolean) => {
    const stmt = db.prepare('UPDATE bot_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
    return stmt.run(isActive, id, userId);
  },

  updateConfig: (id: string, userId: string, config: BotConfig) => {
    const stmt = db.prepare('UPDATE bot_configs SET config_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
    return stmt.run(JSON.stringify(config), id, userId);
  },

  delete: (id: string, userId: string) => {
    const stmt = db.prepare('DELETE FROM bot_configs WHERE id = ? AND user_id = ?');
    return stmt.run(id, userId);
  },
};

// Trade operations with enhanced filtering
export const tradeDb = {
  create: (trade: Omit<Trade, 'createdAt' | 'completedAt'>) => {
    const stmt = db.prepare(`
      INSERT INTO trades (id, bot_config_id, bot_type, tx_hash, chain, token_in, token_out, amount_in, amount_out, gas_used, gas_price, profit, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
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
      trade.profit || null,
      trade.status
    );
  },

  findByBotConfigId: (botConfigId: string, limit: number = 100): Trade[] => {
    const stmt = db.prepare('SELECT * FROM trades WHERE bot_config_id = ? ORDER BY created_at DESC LIMIT ?');
    const trades = stmt.all(botConfigId, limit) as any[];
    return trades.map(t => ({
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
  },

  findByUserId: (userId: string, limit: number = 100): Trade[] => {
    const stmt = db.prepare(`
      SELECT t.* FROM trades t
      JOIN bot_configs bc ON t.bot_config_id = bc.id
      WHERE bc.user_id = ?
      ORDER BY t.created_at DESC
      LIMIT ?
    `);
    const trades = stmt.all(userId, limit) as any[];
    return trades.map(t => ({
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
  },

  updateStatus: (id: string, status: Trade['status'], completedAt?: string) => {
    const stmt = db.prepare('UPDATE trades SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(status, completedAt || null, id);
  },

  getTradeStats: (userId: string): { totalTrades: number; totalProfit: string; successRate: number } => {
    const totalStmt = db.prepare(`
      SELECT COUNT(*) as count FROM trades t
      JOIN bot_configs bc ON t.bot_config_id = bc.id
      WHERE bc.user_id = ?
    `);
    const total = totalStmt.get(userId) as any;

    const successStmt = db.prepare(`
      SELECT COUNT(*) as count FROM trades t
      JOIN bot_configs bc ON t.bot_config_id = bc.id
      WHERE bc.user_id = ? AND t.status = 'completed'
    `);
    const success = successStmt.get(userId) as any;

    const profitStmt = db.prepare(`
      SELECT SUM(CAST(profit as REAL)) as total FROM trades t
      JOIN bot_configs bc ON t.bot_config_id = bc.id
      WHERE bc.user_id = ? AND t.profit IS NOT NULL
    `);
    const profit = profitStmt.get(userId) as any;

    return {
      totalTrades: total?.count || 0,
      totalProfit: (profit?.total || 0).toString(),
      successRate: total?.count > 0 ? (success?.count || 0) / total.count : 0
    };
  },
};

// Initialize database on import
initializeDatabase();

export default db; 