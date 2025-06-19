-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User authentication and profiles
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- User profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "discord": false}',
    risk_tolerance VARCHAR(20) DEFAULT 'medium' CHECK (risk_tolerance IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallet management
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    chain VARCHAR(50) NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    wallet_type VARCHAR(20) DEFAULT 'imported' CHECK (wallet_type IN ('imported', 'generated')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, address, chain)
);

-- Bot configurations
CREATE TABLE IF NOT EXISTS public.bot_configurations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
    bot_type VARCHAR(50) NOT NULL CHECK (bot_type IN ('arbitrage', 'copy_trader', 'sandwich', 'liquidation', 'jit_liquidity')),
    name VARCHAR(100) NOT NULL,
    configuration JSONB NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    is_paper_trading BOOLEAN DEFAULT TRUE,
    max_daily_trades INTEGER DEFAULT 100,
    max_position_size DECIMAL(18, 8),
    stop_loss_percentage DECIMAL(5, 2),
    take_profit_percentage DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trade history
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    bot_configuration_id UUID REFERENCES public.bot_configurations(id) ON DELETE SET NULL,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
    transaction_hash VARCHAR(255),
    chain VARCHAR(50) NOT NULL,
    trade_type VARCHAR(50) NOT NULL,
    token_in VARCHAR(255) NOT NULL,
    token_out VARCHAR(255) NOT NULL,
    amount_in DECIMAL(36, 18) NOT NULL,
    amount_out DECIMAL(36, 18) NOT NULL,
    gas_used BIGINT,
    gas_price DECIMAL(36, 18),
    profit_loss DECIMAL(36, 18),
    profit_loss_usd DECIMAL(18, 2),
    slippage DECIMAL(5, 4),
    is_paper_trade BOOLEAN DEFAULT FALSE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    bot_configuration_id UUID REFERENCES public.bot_configurations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_trades INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    total_volume DECIMAL(36, 18) DEFAULT 0,
    total_profit_loss DECIMAL(36, 18) DEFAULT 0,
    total_profit_loss_usd DECIMAL(18, 2) DEFAULT 0,
    max_drawdown DECIMAL(5, 4) DEFAULT 0,
    sharpe_ratio DECIMAL(10, 6),
    win_rate DECIMAL(5, 4),
    average_trade_size DECIMAL(36, 18),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, bot_configuration_id, date)
);

-- Alerts and notifications
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    bot_configuration_id UUID REFERENCES public.bot_configurations(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('trade_executed', 'profit_target', 'stop_loss', 'error', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    is_read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys for external services
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    encrypted_secret_key TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, service_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address_chain ON public.wallets(address, chain);
CREATE INDEX IF NOT EXISTS idx_bot_configurations_user_id ON public.bot_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_configurations_is_active ON public.bot_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_bot_configuration_id ON public.trades(bot_configuration_id);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON public.trades(executed_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id_date ON public.performance_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id_created_at ON public.alerts(user_id, created_at);

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own profile data" ON public.user_profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own wallets" ON public.wallets FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own bot configurations" ON public.bot_configurations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert trades" ON public.trades FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own performance metrics" ON public.performance_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage performance metrics" ON public.performance_metrics FOR ALL WITH CHECK (true);

CREATE POLICY "Users can manage own alerts" ON public.alerts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own API keys" ON public.api_keys FOR ALL USING (auth.uid() = user_id);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER handle_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_bot_configurations_updated_at BEFORE UPDATE ON public.bot_configurations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();