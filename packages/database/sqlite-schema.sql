-- SQLite schema for bot operational state
-- This database is used by individual bot instances for fast local storage

-- Bot state tracking
CREATE TABLE IF NOT EXISTS bot_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL UNIQUE,
    bot_type TEXT NOT NULL,
    state TEXT NOT NULL, -- 'idle', 'running', 'paused', 'error'
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    configuration TEXT, -- JSON configuration
    performance_metrics TEXT, -- JSON metrics
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transaction logs for fast querying
CREATE TABLE IF NOT EXISTS transaction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    transaction_hash TEXT,
    chain TEXT NOT NULL,
    transaction_type TEXT NOT NULL, -- 'buy', 'sell', 'swap', 'bundle'
    token_in TEXT NOT NULL,
    token_out TEXT NOT NULL,
    amount_in REAL NOT NULL,
    amount_out REAL NOT NULL,
    gas_used INTEGER,
    gas_price REAL,
    profit_loss REAL,
    slippage REAL,
    execution_time_ms INTEGER,
    is_successful BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    block_number INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES bot_state(bot_id)
);

-- Opportunity tracking for arbitrage bots
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    token_pair TEXT NOT NULL, -- e.g., 'ETH/USDC'
    dex_a TEXT NOT NULL,
    dex_b TEXT NOT NULL,
    price_a REAL NOT NULL,
    price_b REAL NOT NULL,
    profit_potential REAL NOT NULL,
    profit_after_gas REAL NOT NULL,
    gas_estimate INTEGER,
    is_executed BOOLEAN DEFAULT FALSE,
    execution_result TEXT, -- 'success', 'failed', 'skipped'
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME,
    FOREIGN KEY (bot_id) REFERENCES bot_state(bot_id)
);

-- Copy trading targets and activities
CREATE TABLE IF NOT EXISTS copy_trading_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    target_address TEXT NOT NULL,
    chain TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    copy_settings TEXT, -- JSON settings
    total_copied_trades INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0,
    total_profit_loss REAL DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME,
    FOREIGN KEY (bot_id) REFERENCES bot_state(bot_id)
);

-- MEV opportunities and bundles
CREATE TABLE IF NOT EXISTS mev_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    opportunity_type TEXT NOT NULL, -- 'sandwich', 'liquidation', 'arbitrage'
    target_transaction TEXT, -- victim transaction hash
    bundle_transactions TEXT, -- JSON array of our transactions
    estimated_profit REAL NOT NULL,
    gas_bid REAL NOT NULL,
    competition_level INTEGER DEFAULT 1, -- 1-10 scale
    is_submitted BOOLEAN DEFAULT FALSE,
    is_successful BOOLEAN DEFAULT FALSE,
    actual_profit REAL,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME,
    confirmed_at DATETIME,
    FOREIGN KEY (bot_id) REFERENCES bot_state(bot_id)
);

-- Performance metrics snapshots
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    snapshot_type TEXT NOT NULL, -- 'hourly', 'daily', 'weekly'
    total_trades INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    total_volume REAL DEFAULT 0,
    total_profit_loss REAL DEFAULT 0,
    max_drawdown REAL DEFAULT 0,
    win_rate REAL DEFAULT 0,
    average_trade_size REAL DEFAULT 0,
    gas_spent REAL DEFAULT 0,
    execution_time_avg_ms INTEGER DEFAULT 0,
    snapshot_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES bot_state(bot_id),
    UNIQUE(bot_id, snapshot_type, snapshot_date)
);

-- Risk management events
CREATE TABLE IF NOT EXISTS risk_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'stop_loss', 'position_limit', 'daily_limit', 'volatility_halt'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    description TEXT NOT NULL,
    action_taken TEXT, -- 'position_closed', 'bot_paused', 'alert_sent'
    position_size_before REAL,
    position_size_after REAL,
    trigger_value REAL,
    threshold_value REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES bot_state(bot_id)
);

-- WebSocket connection status
CREATE TABLE IF NOT EXISTS websocket_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id TEXT NOT NULL,
    connection_type TEXT NOT NULL, -- 'rpc', 'dex_data', 'mempool'
    endpoint TEXT NOT NULL,
    status TEXT NOT NULL, -- 'connected', 'disconnected', 'error'
    last_message_at DATETIME,
    reconnect_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES bot_state(bot_id)
);

-- Market data cache
CREATE TABLE IF NOT EXISTS market_data_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_type TEXT NOT NULL, -- 'price', 'liquidity', 'volume'
    symbol TEXT NOT NULL,
    chain TEXT NOT NULL,
    dex TEXT,
    data_value REAL NOT NULL,
    metadata TEXT, -- JSON additional data
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data_type, symbol, chain, dex)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_state_bot_id ON bot_state(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_state_state ON bot_state(state);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_bot_id ON transaction_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_timestamp ON transaction_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_chain ON transaction_logs(chain);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_bot_id ON arbitrage_opportunities(bot_id);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_discovered_at ON arbitrage_opportunities(discovered_at);
CREATE INDEX IF NOT EXISTS idx_copy_trading_targets_bot_id ON copy_trading_targets(bot_id);
CREATE INDEX IF NOT EXISTS idx_copy_trading_targets_address ON copy_trading_targets(target_address);
CREATE INDEX IF NOT EXISTS idx_mev_opportunities_bot_id ON mev_opportunities(bot_id);
CREATE INDEX IF NOT EXISTS idx_mev_opportunities_discovered_at ON mev_opportunities(discovered_at);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_bot_id_date ON performance_snapshots(bot_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_risk_events_bot_id ON risk_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_created_at ON risk_events(created_at);
CREATE INDEX IF NOT EXISTS idx_websocket_connections_bot_id ON websocket_connections(bot_id);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_symbol_chain ON market_data_cache(symbol, chain);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_expires_at ON market_data_cache(expires_at);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_bot_state_timestamp 
    AFTER UPDATE ON bot_state
    BEGIN
        UPDATE bot_state SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_websocket_connections_timestamp 
    AFTER UPDATE ON websocket_connections
    BEGIN
        UPDATE websocket_connections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS bot_performance_summary AS
SELECT 
    bot_id,
    COUNT(*) as total_trades,
    SUM(CASE WHEN is_successful = 1 THEN 1 ELSE 0 END) as successful_trades,
    SUM(profit_loss) as total_profit_loss,
    AVG(profit_loss) as avg_profit_loss,
    SUM(gas_used * gas_price) as total_gas_spent,
    AVG(execution_time_ms) as avg_execution_time,
    MIN(timestamp) as first_trade,
    MAX(timestamp) as last_trade
FROM transaction_logs
GROUP BY bot_id;

CREATE VIEW IF NOT EXISTS recent_arbitrage_opportunities AS
SELECT 
    bot_id,
    token_pair,
    dex_a,
    dex_b,
    profit_potential,
    profit_after_gas,
    is_executed,
    discovered_at
FROM arbitrage_opportunities
WHERE discovered_at > datetime('now', '-1 hour')
ORDER BY discovered_at DESC;

CREATE VIEW IF NOT EXISTS active_risk_events AS
SELECT 
    bot_id,
    event_type,
    severity,
    description,
    action_taken,
    created_at
FROM risk_events
WHERE created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC;