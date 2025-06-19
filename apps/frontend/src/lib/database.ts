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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// User operations
export const userDb = {
  create: (user: Omit<User, 'createdAt' | 'updatedAt'>) => {
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (?, ?, ?)
    `);
    return stmt.run(user.id, user.email, user.encryptedPrivateKey);
  },

  findByEmail: (email: string): User | null => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email) as any;
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      encryptedPrivateKey: user.password_hash,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  },

  findById: (id: string): User | null => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id) as any;
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      encryptedPrivateKey: user.password_hash,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  },
};

// Wallet operations
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
      wallet.name
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

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM wallets WHERE id = ?');
    return stmt.run(id);
  },
};

// Bot config operations
export const botConfigDb = {
  create: (config: Omit<BotConfig, 'createdAt' | 'updatedAt'>) => {
    const stmt = db.prepare(`
      INSERT INTO bot_configs (id, user_id, wallet_id, bot_type, config_data, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      config.id,
      config.userId,
      config.walletId,
      'ARBITRAGE', // We'll determine this from the config type
      JSON.stringify(config),
      config.isActive
    );
  },

  findByUserId: (userId: string): BotConfig[] => {
    const stmt = db.prepare('SELECT * FROM bot_configs WHERE user_id = ?');
    const configs = stmt.all(userId) as any[];
    return configs.map(c => JSON.parse(c.config_data));
  },

  findById: (id: string): BotConfig | null => {
    const stmt = db.prepare('SELECT * FROM bot_configs WHERE id = ?');
    const config = stmt.get(id) as any;
    if (!config) return null;
    return JSON.parse(config.config_data);
  },

  updateStatus: (id: string, isActive: boolean) => {
    const stmt = db.prepare('UPDATE bot_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(isActive, id);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM bot_configs WHERE id = ?');
    return stmt.run(id);
  },
};

// Trade operations
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
      trade.profit,
      trade.status
    );
  },

  findByBotConfigId: (botConfigId: string): Trade[] => {
    const stmt = db.prepare('SELECT * FROM trades WHERE bot_config_id = ? ORDER BY created_at DESC');
    const trades = stmt.all(botConfigId) as any[];
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

  findByUserId: (userId: string): Trade[] => {
    const stmt = db.prepare(`
      SELECT t.* FROM trades t
      JOIN bot_configs bc ON t.bot_config_id = bc.id
      WHERE bc.user_id = ?
      ORDER BY t.created_at DESC
    `);
    const trades = stmt.all(userId) as any[];
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
    const stmt = db.prepare('UPDATE trades SET status = ?, completed_at = ? WHERE id = ?');
    return stmt.run(status, completedAt, id);
  },
};

// Initialize database on import
initializeDatabase();

export default db; 