import { ArbitrageBotConfig } from '@trading-bot/types';

export class ConfigManager {
  private config: ArbitrageBotConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): ArbitrageBotConfig {
    return {
      id: process.env.BOT_ID || 'arbitrage-bot-1',
      userId: process.env.USER_ID || 'default-user',
      walletId: process.env.WALLET_ID || 'default-wallet',
      botType: 'arbitrage',
      name: process.env.BOT_NAME || 'Arbitrage Bot',
      isActive: true,
      isPaperTrading: process.env.PAPER_TRADING === 'true',
      maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES || '100'),
      maxPositionSize: process.env.MAX_POSITION_SIZE || '1.0',
      stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '5.0'),
      takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '2.0'),
      createdAt: new Date(),
      updatedAt: new Date(),
      configuration: {
        tokenPairs: [
          {
            tokenA: process.env.TOKEN_A || '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            tokenB: process.env.TOKEN_B || '0x6b175474e89094c44da98b954eedeac495271d0f',
            chains: ['ethereum']
          }
        ],
        minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.1'),
        maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '1.0'),
        dexes: (process.env.DEXES || 'uniswap_v2,uniswap_v3,sushiswap').split(','),
        gasMultiplier: parseFloat(process.env.GAS_MULTIPLIER || '1.2'),
        enableMEVProtection: process.env.ENABLE_MEV_PROTECTION === 'true'
      }
    };
  }

  private validateConfig(): void {
    if (!this.config.configuration.tokenPairs.length) {
      throw new Error('At least one token pair must be configured');
    }

    if (this.config.configuration.minProfitThreshold <= 0) {
      throw new Error('Minimum profit threshold must be greater than 0');
    }

    if (this.config.configuration.maxSlippage <= 0 || this.config.configuration.maxSlippage > 50) {
      throw new Error('Max slippage must be between 0 and 50 percent');
    }

    if (!this.config.configuration.dexes.length) {
      throw new Error('At least one DEX must be configured');
    }
  }

  getConfig(): ArbitrageBotConfig {
    return this.config;
  }

  updateConfig(updates: Partial<ArbitrageBotConfig>): void {
    this.config = { ...this.config, ...updates, updatedAt: new Date() };
    this.validateConfig();
  }

  getTokenPairs() {
    return this.config.configuration.tokenPairs;
  }

  getMinProfitThreshold(): number {
    return this.config.configuration.minProfitThreshold;
  }

  getMaxSlippage(): number {
    return this.config.configuration.maxSlippage;
  }

  getDexes(): string[] {
    return this.config.configuration.dexes;
  }

  getGasMultiplier(): number {
    return this.config.configuration.gasMultiplier;
  }

  isMEVProtectionEnabled(): boolean {
    return this.config.configuration.enableMEVProtection;
  }

  isPaperTradingMode(): boolean {
    return this.config.isPaperTrading;
  }

  getMaxDailyTrades(): number {
    return this.config.maxDailyTrades;
  }

  getMaxPositionSize(): string {
    return this.config.maxPositionSize || '1.0';
  }
}