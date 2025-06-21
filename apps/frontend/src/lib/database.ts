import Database from 'better-sqlite3';
import * as path from 'path';

// Local type definitions (aligned with packages/types structure)
export type Chain = "ETH" | "BSC" | "SOL" | "POLYGON" | "ARBITRUM" | "OPTIMISM";
export type UserRole = "admin" | "trader" | "viewer" | "developer" | "auditor";
export type UserStatus = "active" | "inactive" | "suspended" | "pending" | "locked";

export interface UserPreferences {
  locale: string;
  timezone: string;
  theme: "light" | "dark" | "auto";
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    types: {
      trades: boolean;
      profits: boolean;
      losses: boolean;
      errors: boolean;
      system: boolean;
    };
  };
  trading: {
    defaultSlippage: number;
    gasStrategy: "slow" | "standard" | "fast" | "custom";
    riskTolerance: "low" | "medium" | "high";
    displayCurrency: "USD" | "EUR" | "BTC" | "ETH";
  };
}

export interface WalletBalance {
  native: {
    amount: string;
    usdValue: number;
  };
  tokens: Array<{
    address: string;
    symbol: string;
    amount: string;
    decimals: number;
    usdValue: number;
  }>;
  totalUsdValue: number;
  lastUpdated: string;
}

export interface WalletMetadata {
  tags: string[];
  description?: string;
  riskLevel: "low" | "medium" | "high";
  purpose: "arbitrage" | "copy-trading" | "mev" | "general" | "testing";
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  status: UserStatus;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  twoFactorEnabled: boolean;
}

export interface Wallet {
  id: string;
  userId: string;
  address: string;
  chain: Chain;
  name?: string;
  type: "hot" | "cold" | "hardware" | "multisig" | "contract";
  balance: WalletBalance;
  status: "active" | "inactive" | "frozen" | "compromised" | "archived";
  createdAt: string;
  lastActivityAt?: string;
  isMonitored: boolean;
  metadata: WalletMetadata;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  verified: boolean;
}

export interface TradeMetadata {
  exchange: string;
  route: Array<{
    protocol: string;
    pair: string;
    poolAddress: string;
    fee: number;
  }>;
  actualSlippage: number;
  mevProtection: boolean;
  strategy: string;
  marketConditions: {
    gasPrice: number;
    congestion: "low" | "medium" | "high";
    volatility: number;
    liquidity: number;
  };
}

export interface Trade {
  id: string;
  botConfigId: string;
  botType: "ARBITRAGE" | "COPY_TRADER" | "SANDWICH" | "GRID" | "DCA";
  txHash: string;
  chain: Chain;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: string;
  amountOut: string;
  gasUsed: string;
  gasPrice: string;
  profit?: string;
  status: "pending" | "submitted" | "confirmed" | "success" | "failed" | "cancelled" | "expired";
  metadata: TradeMetadata;
  createdAt: string;
  completedAt?: string;
  error?: any;
}

export interface BotConfig {
  id?: string;
  userId: string;
  walletId: string;
  name: string;
  type: "arbitrage" | "copy-trader" | "mev-sandwich";
  enabled: boolean;
  chain: Chain;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  version?: string;
}

const dbPath = path.join(process.cwd(), 'trading_bot.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance and concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA cache_size = 1000;');
db.exec('PRAGMA temp_store = memory;');

// Transaction management utilities
export class DatabaseTransaction {
  private transaction: any;
  private isActive = false;

  constructor() {
    this.transaction = db.transaction((fn: () => void) => {
      this.isActive = true;
      try {
        fn();
        this.isActive = false;
      } catch (error) {
        this.isActive = false;
        throw error;
      }
    });
  }

  execute<T>(fn: () => T): T {
    if (this.isActive) {
      throw new Error('Transaction already active');
    }
    return this.transaction(fn);
  }
}

// Create a new transaction
export function createTransaction(): DatabaseTransaction {
  return new DatabaseTransaction();
}

// Database health check and monitoring
export const databaseHealth = {
  checkConnection(): boolean {
    try {
      db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  },

  getStats(): {
    isConnected: boolean;
    databaseSize: number;
    tableCount: number;
    lastBackup?: string;
  } {
    try {
      const isConnected = this.checkConnection();
      
      if (!isConnected) {
        return {
          isConnected: false,
          databaseSize: 0,
          tableCount: 0
        };
      }

      // Get database size in bytes
      const sizeResult = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as { size: number };
      
      // Get table count
      const tableResult = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number };

      return {
        isConnected: true,
        databaseSize: sizeResult.size,
        tableCount: tableResult.count
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return {
        isConnected: false,
        databaseSize: 0,
        tableCount: 0
      };
    }
  },

  performMaintenance(): void {
    try {
      console.log('Starting database maintenance...');
      
      // Analyze query performance
      db.exec('ANALYZE;');
      
      // Vacuum if needed (reclaim space)
      const vacuumCheck = db.prepare('PRAGMA auto_vacuum').get() as { auto_vacuum: number };
      if (vacuumCheck.auto_vacuum === 0) {
        console.log('Running VACUUM to reclaim space...');
        db.exec('VACUUM;');
      }
      
      // Update table statistics
      db.exec('PRAGMA optimize;');
      
      console.log('Database maintenance completed');
    } catch (error) {
      console.error('Database maintenance failed:', error);
    }
  }
};

// Performance monitoring
export const performanceMonitor = {
  startQueryTimer(): () => number {
    const startTime = process.hrtime.bigint();
    return () => {
      const endTime = process.hrtime.bigint();
      return Number(endTime - startTime) / 1000000; // Convert to milliseconds
    };
  },

  logSlowQuery(query: string, duration: number, threshold: number = 100): void {
    if (duration > threshold) {
      console.warn(`Slow query detected (${duration}ms):`, query);
    }
  }
};

// Backup and restore utilities
export const backupManager = {
  createBackup(backupPath?: string): boolean {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultPath = `trading_bot_backup_${timestamp}.db`;
      const finalPath: string = backupPath || defaultPath;
      
      db.backup(finalPath);
      
      auditLog('BACKUP', 'database', null, null, { backupPath: finalPath }, null);
      console.log(`Database backup created: ${finalPath}`);
      return true;
    } catch (error) {
      console.error('Failed to create database backup:', error);
      return false;
    }
  },

  scheduleAutoBackup(intervalHours: number = 24): NodeJS.Timeout {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    return setInterval(() => {
      this.createBackup();
    }, intervalMs);
  }
};

// Migration system for schema updates
export const migrationManager = {
  getCurrentVersion(): number {
    try {
      const result = db.prepare('PRAGMA user_version').get() as { user_version: number };
      return result.user_version;
    } catch (error) {
      console.error('Failed to get database version:', error);
      return 0;
    }
  },

  setVersion(version: number): void {
    try {
      db.exec(`PRAGMA user_version = ${version}`);
      auditLog('MIGRATION', 'database', null, null, { version }, null);
    } catch (error) {
      console.error('Failed to set database version:', error);
      throw error;
    }
  },

  runMigrations(): void {
    const currentVersion = this.getCurrentVersion();
    const targetVersion = 1; // Current schema version

    if (currentVersion < targetVersion) {
      console.log(`Running database migrations from version ${currentVersion} to ${targetVersion}`);
      
      // Add any future migrations here
      if (currentVersion < 1) {
        // Migration to version 1 - already handled in initializeDatabase
        this.setVersion(1);
        console.log('Migrated to version 1');
      }
    }
  }
};

// Database interfaces for type safety
interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  name?: string;
  role: string;
  status: string;
  preferences: string;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

interface DbWallet {
  id: string;
  user_id: string;
  address: string;
  encrypted_private_key: string;
  chain: string;
  name?: string;
  type: string;
  balance: string;
  status: string;
  is_monitored: boolean;
  metadata: string;
  last_activity_at?: string;
  created_at: string;
}

interface DbBotConfig {
  id: string;
  user_id: string;
  wallet_id: string;
  bot_type: string;
  config_data: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DbTrade {
  id: string;
  bot_config_id: string;
  bot_type: string;
  tx_hash: string;
  chain: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  gas_used: string;
  gas_price: string;
  profit?: string;
  status: string;
  metadata: string;
  error_data?: string;
  created_at: string;
  completed_at?: string;
}

// Validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function validateChain(chain: string): chain is Chain {
  const validChains: Chain[] = ['ETH', 'BSC', 'SOL', 'POLYGON', 'ARBITRUM', 'OPTIMISM'];
  return validChains.includes(chain as Chain);
}

function validateUserRole(role: string): role is UserRole {
  const validRoles: UserRole[] = ['admin', 'trader', 'viewer', 'developer', 'auditor'];
  return validRoles.includes(role as UserRole);
}

function validateUserStatus(status: string): status is UserStatus {
  const validStatuses: UserStatus[] = ['active', 'inactive', 'suspended', 'pending', 'locked'];
  return validStatuses.includes(status as UserStatus);
}

function validateWalletType(type: string): type is 'hot' | 'cold' | 'hardware' | 'multisig' | 'contract' {
  const validTypes = ['hot', 'cold', 'hardware', 'multisig', 'contract'] as const;
  return (validTypes as readonly string[]).includes(type);
}

function validateWalletStatus(status: string): status is 'active' | 'inactive' | 'frozen' | 'compromised' | 'archived' {
  const validStatuses = ['active', 'inactive', 'frozen', 'compromised', 'archived'] as const;
  return (validStatuses as readonly string[]).includes(status);
}

function validateBotType(type: string): type is 'ARBITRAGE' | 'COPY_TRADER' | 'SANDWICH' | 'GRID' | 'DCA' {
  const validTypes = ['ARBITRAGE', 'COPY_TRADER', 'SANDWICH', 'GRID', 'DCA'] as const;
  return (validTypes as readonly string[]).includes(type);
}

function validateTradeStatus(status: string): status is 'pending' | 'submitted' | 'confirmed' | 'success' | 'failed' | 'cancelled' | 'expired' {
  const validStatuses = ['pending', 'submitted', 'confirmed', 'success', 'failed', 'cancelled', 'expired'] as const;
  return (validStatuses as readonly string[]).includes(status);
}

// Safe JSON parsing with validation
function safeJsonParse<T>(jsonString: string | null, defaultValue: T, validator?: (value: unknown) => value is T): T {
  if (!jsonString) {
    return defaultValue;
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    if (validator && !validator(parsed)) {
      console.warn('JSON validation failed, using default value:', jsonString);
      return defaultValue;
    }
    return parsed as T;
  } catch (error) {
    console.error('JSON parsing failed:', error, 'Input:', jsonString);
    return defaultValue;
  }
}

// Validators for complex types with proper type safety
function isValidUserPreferences(value: unknown): value is UserPreferences {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['locale'] === 'string' &&
    typeof obj['timezone'] === 'string' &&
    typeof obj['theme'] === 'string';
}

function isValidWalletBalance(value: unknown): value is WalletBalance {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['totalUsdValue'] === 'number' &&
    typeof obj['lastUpdated'] === 'string';
}

function isValidWalletMetadata(value: unknown): value is WalletMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj['tags']) &&
    typeof obj['riskLevel'] === 'string' &&
    typeof obj['purpose'] === 'string';
}

function isValidTradeMetadata(value: unknown): value is TradeMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['exchange'] === 'string' &&
    typeof obj['actualSlippage'] === 'number' &&
    typeof obj['mevProtection'] === 'boolean';
}

function isValidTokenInfo(value: unknown): value is TokenInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['address'] === 'string' &&
    typeof obj['symbol'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['decimals'] === 'number' &&
    typeof obj['verified'] === 'boolean';
}

// Initialize database schema
export function initializeDatabase() {
  // Users table - aligned with new User interface
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'trader',
      status TEXT DEFAULT 'active',
      preferences TEXT DEFAULT '{}',
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
  `);

  // Add indexes for users table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
  `);

  // Wallets table - aligned with new Wallet interface
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      address TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      chain TEXT NOT NULL,
      name TEXT,
      type TEXT DEFAULT 'hot',
      balance TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      is_monitored BOOLEAN DEFAULT TRUE,
      metadata TEXT DEFAULT '{}',
      last_activity_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Add indexes for wallets table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);
    CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets (address);
    CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets (chain);
    CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets (status);
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

  // Add indexes for bot_configs table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs (user_id);
    CREATE INDEX IF NOT EXISTS idx_bot_configs_wallet_id ON bot_configs (wallet_id);
    CREATE INDEX IF NOT EXISTS idx_bot_configs_bot_type ON bot_configs (bot_type);
    CREATE INDEX IF NOT EXISTS idx_bot_configs_is_active ON bot_configs (is_active);
  `);

  // Trades table - aligned with new Trade interface
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
      metadata TEXT DEFAULT '{}',
      error_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (bot_config_id) REFERENCES bot_configs (id)
    )
  `);

  // Add indexes for trades table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trades_bot_config_id ON trades (bot_config_id);
    CREATE INDEX IF NOT EXISTS idx_trades_tx_hash ON trades (tx_hash);
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);
    CREATE INDEX IF NOT EXISTS idx_trades_chain ON trades (chain);
    CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades (created_at);
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

  // Add indexes for bot_status table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bot_status_is_running ON bot_status (is_running);
    CREATE INDEX IF NOT EXISTS idx_bot_status_last_activity ON bot_status (last_activity);
  `);

  // Add audit log table for security and compliance
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add indexes for audit_logs table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs (table_name);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
  `);

  console.log('Database initialized successfully with indexes and audit logging');
}

// User operations with enhanced type safety and validation
export const userDb = {
  create: (user: { id: string; email: string; passwordHash: string; name?: string }): boolean => {
    // Input validation
    if (!validateUUID(user.id)) {
      throw new Error('Invalid user ID format');
    }
    if (!validateEmail(user.email)) {
      throw new Error('Invalid email format');
    }
    if (!user.passwordHash || user.passwordHash.length < 8) {
      throw new Error('Invalid password hash');
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO users (id, email, password_hash, name)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(user.id, user.email, user.passwordHash, user.name || null);
      
      // Log audit event
      auditLog('CREATE', 'users', user.id, null, { email: user.email, name: user.name }, null);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw new Error('Database error: Failed to create user');
    }
  },

  findByEmail: (email: string): (User & { passwordHash: string }) | null => {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email) as DbUser | undefined;
      if (!user) return null;
      
      return mapDbUserToUser(user);
    } catch (error) {
      console.error('Failed to find user by email:', error);
      throw new Error('Database error: Failed to find user');
    }
  },

  findById: (id: string): (User & { passwordHash: string }) | null => {
    if (!validateUUID(id)) {
      throw new Error('Invalid user ID format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
      const user = stmt.get(id) as DbUser | undefined;
      if (!user) return null;
      
      return mapDbUserToUser(user);
    } catch (error) {
      console.error('Failed to find user by ID:', error);
      throw new Error('Database error: Failed to find user');
    }
  },

  updateLastLogin: (id: string): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid user ID format');
    }

    try {
      const stmt = db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?');
      const result = stmt.run(id);
      
      if (result.changes > 0) {
        auditLog('UPDATE', 'users', id, null, { last_login_at: new Date().toISOString() }, null);
      }
      
      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update last login:', error);
      throw new Error('Database error: Failed to update last login');
    }
  },

  updatePassword: (id: string, passwordHash: string): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid user ID format');
    }
    if (!passwordHash || passwordHash.length < 8) {
      throw new Error('Invalid password hash');
    }

    try {
      const stmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const result = stmt.run(passwordHash, id);
      
      if (result.changes > 0) {
        auditLog('UPDATE', 'users', id, null, { password_changed: true }, null);
      }
      
      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update password:', error);
      throw new Error('Database error: Failed to update password');
    }
  },
};

// Helper function to map database user to typed user
function mapDbUserToUser(user: DbUser): User & { passwordHash: string } {
  // Create default preferences if not set
  const defaultPreferences: UserPreferences = {
    locale: 'en',
    timezone: 'UTC',
    theme: 'dark',
    notifications: {
      email: true,
      push: true,
      sms: false,
      types: {
        trades: true,
        profits: true,
        losses: true,
        errors: true,
        system: true,
      }
    },
    trading: {
      defaultSlippage: 0.5,
      gasStrategy: 'standard',
      riskTolerance: 'medium',
      displayCurrency: 'USD'
    }
  };

  const preferences = safeJsonParse(user.preferences, defaultPreferences, isValidUserPreferences);
  const role = validateUserRole(user.role) ? user.role : 'trader';
  const status = validateUserStatus(user.status) ? user.status : 'active';
  
  const result: User & { passwordHash: string } = {
    id: user.id,
    email: user.email,
    role,
    status,
    preferences,
    twoFactorEnabled: Boolean(user.two_factor_enabled),
    passwordHash: user.password_hash,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };

  // Handle optional properties explicitly
  if (user.name) {
    result.name = user.name;
  }
  if (user.last_login_at) {
    result.lastLoginAt = user.last_login_at;
  }

  return result;
}

// Audit logging function
function auditLog(
  action: string, 
  tableName: string, 
  recordId: string | null = null, 
  oldValues: Record<string, any> | null = null, 
  newValues: Record<string, any> | null = null,
  userId: string | null = null
): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, table_name, record_id, old_values, new_values)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    stmt.run(
      auditId,
      userId,
      action,
      tableName,
      recordId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw here as audit logging should not break main operations
  }
}

// Wallet operations with enhanced security, type safety and validation
export const walletDb = {
  create: (wallet: { 
    id: string; 
    userId: string; 
    address: string; 
    encryptedPrivateKey: string; 
    chain: Chain; 
    name?: string;
    type?: string;
  }): boolean => {
    // Input validation
    if (!validateUUID(wallet.id)) {
      throw new Error('Invalid wallet ID format');
    }
    if (!validateUUID(wallet.userId)) {
      throw new Error('Invalid user ID format');
    }
    if (!wallet.address || wallet.address.length < 10) {
      throw new Error('Invalid wallet address');
    }
    if (!validateChain(wallet.chain)) {
      throw new Error('Invalid blockchain chain');
    }
    if (!wallet.encryptedPrivateKey || wallet.encryptedPrivateKey.length < 32) {
      throw new Error('Invalid encrypted private key');
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO wallets (id, user_id, address, encrypted_private_key, chain, name, type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        wallet.id,
        wallet.userId,
        wallet.address,
        wallet.encryptedPrivateKey,
        wallet.chain,
        wallet.name || null,
        wallet.type || 'hot'
      );

      // Log audit event (excluding sensitive data)
      auditLog('CREATE', 'wallets', wallet.id, null, {
        address: wallet.address,
        chain: wallet.chain,
        name: wallet.name,
        type: wallet.type
      }, wallet.userId);

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw new Error('Database error: Failed to create wallet');
    }
  },

  findByUserId: (userId: string): Wallet[] => {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM wallets WHERE user_id = ?');
      const wallets = stmt.all(userId) as DbWallet[];
      return wallets.map(w => mapDbWalletToWallet(w));
    } catch (error) {
      console.error('Failed to find wallets by user ID:', error);
      throw new Error('Database error: Failed to find wallets');
    }
  },

  findById: (id: string): Wallet | null => {
    if (!validateUUID(id)) {
      throw new Error('Invalid wallet ID format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM wallets WHERE id = ?');
      const wallet = stmt.get(id) as DbWallet | undefined;
      if (!wallet) return null;
      return mapDbWalletToWallet(wallet);
    } catch (error) {
      console.error('Failed to find wallet by ID:', error);
      throw new Error('Database error: Failed to find wallet');
    }
  },

  findByUserIdAndId: (userId: string, walletId: string): Wallet | null => {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }
    if (!validateUUID(walletId)) {
      throw new Error('Invalid wallet ID format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM wallets WHERE id = ? AND user_id = ?');
      const wallet = stmt.get(walletId, userId) as DbWallet | undefined;
      if (!wallet) return null;
      return mapDbWalletToWallet(wallet);
    } catch (error) {
      console.error('Failed to find wallet by user and wallet ID:', error);
      throw new Error('Database error: Failed to find wallet');
    }
  },

  updateName: (id: string, userId: string, name: string): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid wallet ID format');
    }
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }
    if (!name || name.trim().length === 0) {
      throw new Error('Invalid wallet name');
    }

    try {
      const stmt = db.prepare('UPDATE wallets SET name = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(name.trim(), id, userId);

      if (result.changes > 0) {
        auditLog('UPDATE', 'wallets', id, null, { name: name.trim() }, userId);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update wallet name:', error);
      throw new Error('Database error: Failed to update wallet name');
    }
  },

  updateBalance: (id: string, userId: string, balance: WalletBalance): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid wallet ID format');
    }
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }
    if (!isValidWalletBalance(balance)) {
      throw new Error('Invalid balance data');
    }

    try {
      const stmt = db.prepare('UPDATE wallets SET balance = ?, last_activity_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
      const result = stmt.run(JSON.stringify(balance), id, userId);

      if (result.changes > 0) {
        auditLog('UPDATE', 'wallets', id, null, { balance_updated: true, totalUsdValue: balance.totalUsdValue }, userId);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update wallet balance:', error);
      throw new Error('Database error: Failed to update wallet balance');
    }
  },

  delete: (id: string, userId: string): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid wallet ID format');
    }
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      // Get wallet data for audit log before deletion
      const selectStmt = db.prepare('SELECT address, chain, name FROM wallets WHERE id = ? AND user_id = ?');
      const walletData = selectStmt.get(id, userId) as { address: string; chain: string; name?: string } | undefined;

      const deleteStmt = db.prepare('DELETE FROM wallets WHERE id = ? AND user_id = ?');
      const result = deleteStmt.run(id, userId);

      if (result.changes > 0) {
        auditLog('DELETE', 'wallets', id, walletData, null, userId);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to delete wallet:', error);
      throw new Error('Database error: Failed to delete wallet');
    }
  },

  getEncryptedPrivateKey: (walletId: string, userId: string): string | null => {
    if (!validateUUID(walletId)) {
      throw new Error('Invalid wallet ID format');
    }
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      const stmt = db.prepare('SELECT encrypted_private_key FROM wallets WHERE id = ? AND user_id = ?');
      const result = stmt.get(walletId, userId) as { encrypted_private_key: string } | undefined;
      
      if (!result) {
        return null;
      }

      // Log access attempt for audit (without exposing the key)
      auditLog('ACCESS', 'wallets', walletId, null, { operation: 'getEncryptedPrivateKey' }, userId);

      return result.encrypted_private_key;
    } catch (error) {
      console.error('Failed to get encrypted private key:', error);
      throw new Error('Database error: Failed to get encrypted private key');
    }
  },
};

// Helper function to map database wallet to typed wallet
function mapDbWalletToWallet(w: DbWallet): Wallet {
  // Create default balance if not set
  const defaultBalance: WalletBalance = {
    native: {
      amount: '0',
      usdValue: 0
    },
    tokens: [],
    totalUsdValue: 0,
    lastUpdated: new Date().toISOString()
  };

  // Create default metadata if not set
  const defaultMetadata: WalletMetadata = {
    tags: [],
    riskLevel: 'medium',
    purpose: 'general'
  };

  const balance = safeJsonParse(w.balance, defaultBalance, isValidWalletBalance);
  const metadata = safeJsonParse(w.metadata, defaultMetadata, isValidWalletMetadata);
  
  // Validate chain
  if (!validateChain(w.chain)) {
    throw new Error(`Invalid chain in database: ${w.chain}`);
  }

  const result: Wallet = {
    id: w.id,
    userId: w.user_id,
    address: w.address,
    chain: w.chain,
    type: validateWalletType(w.type) ? w.type : 'hot',
    balance,
    status: validateWalletStatus(w.status) ? w.status : 'active',
    isMonitored: Boolean(w.is_monitored),
    metadata,
    createdAt: w.created_at,
  };

  // Handle optional properties explicitly
  if (w.name) {
    result.name = w.name;
  }
  if (w.last_activity_at) {
    result.lastActivityAt = w.last_activity_at;
  }

  return result;
}

// Bot config operations with enhanced type safety and validation
export const botConfigDb = {
  create: (config: BotConfig): boolean => {
    // Ensure ID is always present for database operations
    const configWithId = {
      ...config,
      id: config.id || crypto.randomUUID()
    };

    // Input validation
    if (!validateUUID(configWithId.id)) {
      throw new Error('Invalid bot config ID format');
    }
    if (!validateUUID(configWithId.userId)) {
      throw new Error('Invalid user ID format');
    }
    if (!validateUUID(configWithId.walletId)) {
      throw new Error('Invalid wallet ID format');
    }
    if (!configWithId.name || configWithId.name.trim().length === 0) {
      throw new Error('Bot name is required');
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO bot_configs (id, user_id, wallet_id, bot_type, config_data, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        configWithId.id,
        configWithId.userId,
        configWithId.walletId,
        configWithId.type.toUpperCase(),
        JSON.stringify(configWithId),
        configWithId.enabled || false
      );

      // Log audit event
      auditLog('CREATE', 'bot_configs', configWithId.id, null, {
        name: configWithId.name,
        type: configWithId.type,
        enabled: configWithId.enabled
      }, configWithId.userId);

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to create bot config:', error);
      throw new Error('Database error: Failed to create bot config');
    }
  },

  findByUserId: (userId: string): BotConfig[] => {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM bot_configs WHERE user_id = ? ORDER BY created_at DESC');
      const configs = stmt.all(userId) as DbBotConfig[];
      return configs.map(c => {
        try {
          return JSON.parse(c.config_data) as BotConfig;
        } catch (error) {
          console.error('Failed to parse bot config:', error, 'Config ID:', c.id);
          return null;
        }
      }).filter((config): config is BotConfig => config !== null);
    } catch (error) {
      console.error('Failed to find bot configs by user ID:', error);
      throw new Error('Database error: Failed to find bot configs');
    }
  },

  findById: (id: string): BotConfig | null => {
    if (!validateUUID(id)) {
      throw new Error('Invalid bot config ID format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM bot_configs WHERE id = ?');
      const config = stmt.get(id) as DbBotConfig | undefined;
      if (!config) return null;
      
      try {
        return JSON.parse(config.config_data) as BotConfig;
      } catch (error) {
        console.error('Failed to parse bot config:', error, 'Config ID:', id);
        return null;
      }
    } catch (error) {
      console.error('Failed to find bot config by ID:', error);
      throw new Error('Database error: Failed to find bot config');
    }
  },

  findByUserIdAndId: (userId: string, configId: string): BotConfig | null => {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }
    if (!validateUUID(configId)) {
      throw new Error('Invalid bot config ID format');
    }

    try {
      const stmt = db.prepare('SELECT * FROM bot_configs WHERE id = ? AND user_id = ?');
      const config = stmt.get(configId, userId) as DbBotConfig | undefined;
      if (!config) return null;
      
      try {
        return JSON.parse(config.config_data) as BotConfig;
      } catch (error) {
        console.error('Failed to parse bot config:', error, 'Config ID:', configId);
        return null;
      }
    } catch (error) {
      console.error('Failed to find bot config by user and config ID:', error);
      throw new Error('Database error: Failed to find bot config');
    }
  },

  updateStatus: (id: string, userId: string, enabled: boolean): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid bot config ID format');
    }
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      const stmt = db.prepare('UPDATE bot_configs SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
      const result = stmt.run(enabled, id, userId);

      if (result.changes > 0) {
        auditLog('UPDATE', 'bot_configs', id, null, { enabled }, userId);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update bot config status:', error);
      throw new Error('Database error: Failed to update bot config status');
    }
  },

  updateConfig: (id: string, userId: string, config: BotConfig): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid bot config ID format');
    }
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Bot name is required');
    }

    try {
      const stmt = db.prepare('UPDATE bot_configs SET config_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
      const result = stmt.run(JSON.stringify(config), id, userId);

      if (result.changes > 0) {
        auditLog('UPDATE', 'bot_configs', id, null, { name: config.name, type: config.type }, userId);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update bot config:', error);
      throw new Error('Database error: Failed to update bot config');
    }
  },

  delete: (id: string, userId: string): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid bot config ID format');
    }
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      // Get config data for audit log before deletion
      const selectStmt = db.prepare('SELECT config_data FROM bot_configs WHERE id = ? AND user_id = ?');
      const configData = selectStmt.get(id, userId) as { config_data: string } | undefined;

      const deleteStmt = db.prepare('DELETE FROM bot_configs WHERE id = ? AND user_id = ?');
      const result = deleteStmt.run(id, userId);

      if (result.changes > 0 && configData) {
        try {
          const config = JSON.parse(configData.config_data) as BotConfig;
          auditLog('DELETE', 'bot_configs', id, { name: config.name, type: config.type }, null, userId);
        } catch (error) {
          auditLog('DELETE', 'bot_configs', id, { deleted: true }, null, userId);
        }
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to delete bot config:', error);
      throw new Error('Database error: Failed to delete bot config');
    }
  },
};

// Trade operations with enhanced type safety, validation and metadata support
export const tradeDb = {
  create: (trade: Omit<Trade, 'createdAt' | 'completedAt'>): boolean => {
    // Input validation
    if (!validateUUID(trade.id)) {
      throw new Error('Invalid trade ID format');
    }
    if (!validateUUID(trade.botConfigId)) {
      throw new Error('Invalid bot config ID format');
    }
    if (!trade.txHash || trade.txHash.length < 10) {
      throw new Error('Invalid transaction hash');
    }
    if (!validateChain(trade.chain)) {
      throw new Error('Invalid blockchain chain');
    }
    if (!isValidTokenInfo(trade.tokenIn)) {
      throw new Error('Invalid input token information');
    }
    if (!isValidTokenInfo(trade.tokenOut)) {
      throw new Error('Invalid output token information');
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO trades (id, bot_config_id, bot_type, tx_hash, chain, token_in, token_out, amount_in, amount_out, gas_used, gas_price, profit, status, metadata, error_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Create default metadata if not provided
      const defaultMetadata: TradeMetadata = {
        exchange: 'unknown',
        route: [],
        actualSlippage: 0,
        mevProtection: false,
        strategy: 'default',
        marketConditions: {
          gasPrice: parseFloat(trade.gasPrice),
          congestion: 'medium',
          volatility: 0,
          liquidity: 0
        }
      };

      const result = stmt.run(
        trade.id,
        trade.botConfigId,
        trade.botType,
        trade.txHash,
        trade.chain,
        JSON.stringify(trade.tokenIn),
        JSON.stringify(trade.tokenOut),
        trade.amountIn,
        trade.amountOut,
        trade.gasUsed,
        trade.gasPrice,
        trade.profit || null,
        trade.status,
        JSON.stringify(trade.metadata || defaultMetadata),
        trade.error ? JSON.stringify(trade.error) : null
      );

      // Log audit event (excluding sensitive data)
      auditLog('CREATE', 'trades', trade.id, null, {
        botType: trade.botType,
        chain: trade.chain,
        status: trade.status,
        tokenIn: trade.tokenIn.symbol,
        tokenOut: trade.tokenOut.symbol,
        profit: trade.profit
      }, null);

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to create trade:', error);
      throw new Error('Database error: Failed to create trade');
    }
  },

  findByBotConfigId: (botConfigId: string, limit: number = 100): Trade[] => {
    if (!validateUUID(botConfigId)) {
      throw new Error('Invalid bot config ID format');
    }
    if (limit <= 0 || limit > 1000) {
      throw new Error('Invalid limit: must be between 1 and 1000');
    }

    try {
      const stmt = db.prepare('SELECT * FROM trades WHERE bot_config_id = ? ORDER BY created_at DESC LIMIT ?');
      const trades = stmt.all(botConfigId, limit) as DbTrade[];
      return trades.map(t => mapDbTradeToTrade(t));
    } catch (error) {
      console.error('Failed to find trades by bot config ID:', error);
      throw new Error('Database error: Failed to find trades');
    }
  },

  findByUserId: (userId: string, limit: number = 100): Trade[] => {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }
    if (limit <= 0 || limit > 1000) {
      throw new Error('Invalid limit: must be between 1 and 1000');
    }

    try {
      const stmt = db.prepare(`
        SELECT t.* FROM trades t
        JOIN bot_configs bc ON t.bot_config_id = bc.id
        WHERE bc.user_id = ?
        ORDER BY t.created_at DESC
        LIMIT ?
      `);
      const trades = stmt.all(userId, limit) as DbTrade[];
      return trades.map(t => mapDbTradeToTrade(t));
    } catch (error) {
      console.error('Failed to find trades by user ID:', error);
      throw new Error('Database error: Failed to find trades');
    }
  },

  updateStatus: (id: string, status: Trade['status'], completedAt?: string): boolean => {
    if (!validateUUID(id)) {
      throw new Error('Invalid trade ID format');
    }
    if (!status || typeof status !== 'string') {
      throw new Error('Invalid trade status');
    }

    try {
      const stmt = db.prepare('UPDATE trades SET status = ?, completed_at = ? WHERE id = ?');
      const result = stmt.run(status, completedAt || null, id);

      if (result.changes > 0) {
        auditLog('UPDATE', 'trades', id, null, { status, completedAt: completedAt || null }, null);
      }

      return result.changes > 0;
    } catch (error) {
      console.error('Failed to update trade status:', error);
      throw new Error('Database error: Failed to update trade status');
    }
  },

  getTradeStats: (userId: string): { totalTrades: number; totalProfit: string; successRate: number } => {
    if (!validateUUID(userId)) {
      throw new Error('Invalid user ID format');
    }

    try {
      const totalStmt = db.prepare(`
        SELECT COUNT(*) as count FROM trades t
        JOIN bot_configs bc ON t.bot_config_id = bc.id
        WHERE bc.user_id = ?
      `);
      const total = totalStmt.get(userId) as { count: number } | undefined;

      const successStmt = db.prepare(`
        SELECT COUNT(*) as count FROM trades t
        JOIN bot_configs bc ON t.bot_config_id = bc.id
        WHERE bc.user_id = ? AND t.status = 'success'
      `);
      const success = successStmt.get(userId) as { count: number } | undefined;

      const profitStmt = db.prepare(`
        SELECT SUM(CAST(profit as REAL)) as total FROM trades t
        JOIN bot_configs bc ON t.bot_config_id = bc.id
        WHERE bc.user_id = ? AND t.profit IS NOT NULL
      `);
      const profit = profitStmt.get(userId) as { total: number } | undefined;

      return {
        totalTrades: total?.count || 0,
        totalProfit: (profit?.total || 0).toString(),
        successRate: total?.count && total.count > 0 ? (success?.count || 0) / total.count : 0
      };
    } catch (error) {
      console.error('Failed to get trade stats:', error);
      throw new Error('Database error: Failed to get trade stats');
    }
  },
};

// Helper function to map database trade to typed trade
function mapDbTradeToTrade(t: DbTrade): Trade {
  // Create default metadata if not set
  const defaultMetadata: TradeMetadata = {
    exchange: 'unknown',
    route: [],
    actualSlippage: 0,
    mevProtection: false,
    strategy: 'default',
    marketConditions: {
      gasPrice: t.gas_price ? parseFloat(t.gas_price) : 0,
      congestion: 'medium',
      volatility: 0,
      liquidity: 0
    }
  };

  const tokenIn = safeJsonParse(t.token_in, {
    address: '',
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    decimals: 18,
    verified: false
  }, isValidTokenInfo);

  const tokenOut = safeJsonParse(t.token_out, {
    address: '',
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    decimals: 18,
    verified: false
  }, isValidTokenInfo);

  const metadata = safeJsonParse(t.metadata, defaultMetadata, isValidTradeMetadata);

  // Validate chain
  if (!validateChain(t.chain)) {
    throw new Error(`Invalid chain in database: ${t.chain}`);
  }

  const result: Trade = {
    id: t.id,
    botConfigId: t.bot_config_id,
    botType: validateBotType(t.bot_type) ? t.bot_type : 'ARBITRAGE',
    txHash: t.tx_hash,
    chain: t.chain,
    tokenIn,
    tokenOut,
    amountIn: t.amount_in,
    amountOut: t.amount_out,
    gasUsed: t.gas_used,
    gasPrice: t.gas_price,
    status: validateTradeStatus(t.status) ? t.status : 'pending',
    metadata,
    createdAt: t.created_at,
  };

  // Handle optional properties explicitly
  if (t.profit) {
    result.profit = t.profit;
  }
  if (t.completed_at) {
    result.completedAt = t.completed_at;
  }
  if (t.error_data) {
    const errorData = safeJsonParse(t.error_data, null);
    if (errorData) {
      result.error = errorData;
    }
  }

  return result;
}

// Initialize database on import
initializeDatabase(); 