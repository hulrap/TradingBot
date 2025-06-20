export interface MevSandwichConfig {
  // Global Settings
  enabledChains: ('ethereum' | 'solana' | 'bsc')[];
  paperTradingMode: boolean;
  globalKillSwitch: boolean;
  
  // Profit Thresholds
  minProfitThresholds: {
    ethereum: string;
    solana: string;
    bsc: string;
  };
  
  // Execution Limits
  maxConcurrentBundles: number;
  maxConcurrentExecutions: number;
  maxTradesPerHour: number;
  maxFailuresPerHour: number;
  
  // Risk Management
  risk: {
    maxPositionDuration: number;
    cooldownPeriod: number;
    maxPortfolioValue: string;
    maxDrawdownPercent: number;
    stopLossPercent: number;
    emergencyStopLoss: number;
    consecutiveFailureLimit: number;
    gasEfficiencyThreshold: number;
  };
  
  // Performance Optimization
  performance: {
    maxMempoolLatency: number;
    maxExecutionLatency: number;
    precomputeThreshold: number;
    poolDataCacheTime: number;
    tokenDataCacheTime: number;
    gasEstimateCacheTime: number;
    minSuccessRate: number;
    targetLatencyMs: number;
    maxMemoryUsageMb: number;
    gasEstimationBuffer: number;
    priorityFeeBoost: number;
    enableGasPrecompute: boolean;
  };
  
  // MEV Strategy Parameters
  strategy: {
    frontRunRatio: number;
    backRunRatio: number;
    maxSlippage: number;
    profitabilityThreshold: number;
    confidenceThreshold: number;
    timeToExpiryMs: number;
    mevScoreThreshold: number;
    priorityFeeMultiplier: number;
  };
  
  // Gas Configuration
  gas: {
    maxGasPrice: {
      ethereum: string;
      bsc: string;
    };
    gasPremiumPercent: number;
    maxBaseFee: string;
    maxPriorityFee: string;
    gasLimitBuffer: number;
  };
  
  // Slippage Protection
  slippage: {
    maxPriceImpact: number;
    priceTolerancePercent: number;
    liquidityThreshold: string;
    volumeThreshold: string;
    enableDynamicSlippage: boolean;
    maxSlippagePercent: number;
  };
  
  // Monitoring & Alerts
  monitoring: {
    bundleTimeoutSeconds: number;
    monitoringIntervalMs: number;
    maxMonitoringAttempts: number;
    enableRealTimeMonitoring: boolean;
    websocketReconnectMs: number;
    heartbeatIntervalMs: number;
  };
  
  // Mempool Configuration
  mempool: {
    enableRealtimeSubscription: boolean;
    subscriptionFilters: {
      minTradeValue: string;
      maxGasPrice: string;
      whitelistedDexes: string[];
      blacklistedTokens: string[];
    };
    batchSize: number;
    processingDelayMs: number;
  };
  
  // Provider Configuration
  providers: {
    ethereum: {
      flashbots: {
        relayUrl: string;
        authKey: string;
        reputationBonus: number;
      };
    };
    bsc: {
      bloxroute: {
        endpoint: string;
        authToken: string;
      };
      nodereal: {
        endpoint: string;
        apiKey: string;
      };
      preferredProvider: 'bloxroute' | 'nodereal';
      mempoolSubscription: boolean;
    };
    solana: {
      jito: {
        blockEngineUrl: string;
        relayerUrl: string;
        tipAccount: string;
        maxTipLamports: number;
        minProfitLamports: number;
        validatorPreferences: string[];
        profitMarginPercent: number;
        networkCongestionMultiplier: number;
        maxBundleAttempts: number;
        baseTps: number;
      };
    };
  };
}

export const DEFAULT_CONFIG: MevSandwichConfig = {
  enabledChains: ['ethereum', 'bsc', 'solana'],
  paperTradingMode: false,
  globalKillSwitch: false,
  
  minProfitThresholds: {
    ethereum: '0.01',
    solana: '0.1',
    bsc: '0.05'
  },
  
  maxConcurrentBundles: 5,
  maxConcurrentExecutions: 3,
  maxTradesPerHour: 20,
  maxFailuresPerHour: 10,
  
  risk: {
    maxPositionDuration: 300000, // 5 minutes
    cooldownPeriod: 5000, // 5 seconds
    maxPortfolioValue: '1000.0',
    maxDrawdownPercent: 20,
    stopLossPercent: 10,
    emergencyStopLoss: 500,
    consecutiveFailureLimit: 5,
    gasEfficiencyThreshold: 0.001
  },
  
  performance: {
    maxMempoolLatency: 200,
    maxExecutionLatency: 5000,
    precomputeThreshold: 70,
    poolDataCacheTime: 300000, // 5 minutes
    tokenDataCacheTime: 600000, // 10 minutes
    gasEstimateCacheTime: 30000, // 30 seconds
    minSuccessRate: 0.3,
    targetLatencyMs: 1000,
    maxMemoryUsageMb: 512,
    gasEstimationBuffer: 20,
    priorityFeeBoost: 50,
    enableGasPrecompute: true
  },
  
  strategy: {
    frontRunRatio: 0.35, // 35% of victim trade
    backRunRatio: 1.0, // Use all acquired tokens
    maxSlippage: 5, // 5%
    profitabilityThreshold: 2, // 2% minimum profit
    confidenceThreshold: 0.7, // 70% confidence
    timeToExpiryMs: 30000, // 30 seconds
    mevScoreThreshold: 0.6, // 60% MEV score
    priorityFeeMultiplier: 1.2 // 20% premium
  },
  
  gas: {
    maxGasPrice: {
      ethereum: '100', // gwei
      bsc: '20' // gwei
    },
    gasPremiumPercent: 20, // 20% premium
    maxBaseFee: '100', // gwei
    maxPriorityFee: '5', // gwei
    gasLimitBuffer: 20 // 20% buffer
  },
  
  slippage: {
    maxPriceImpact: 10, // 10%
    priceTolerancePercent: 1, // 1%
    liquidityThreshold: '100000', // $100k minimum liquidity
    volumeThreshold: '50000', // $50k minimum 24h volume
    enableDynamicSlippage: true,
    maxSlippagePercent: 5 // 5% maximum allowed slippage
  },
  
  monitoring: {
    bundleTimeoutSeconds: 60,
    monitoringIntervalMs: 3000, // 3 seconds
    maxMonitoringAttempts: 20,
    enableRealTimeMonitoring: true,
    websocketReconnectMs: 5000, // 5 seconds
    heartbeatIntervalMs: 30000 // 30 seconds
  },
  
  mempool: {
    enableRealtimeSubscription: true,
    subscriptionFilters: {
      minTradeValue: '1000', // $1k minimum
      maxGasPrice: '100', // 100 gwei
      whitelistedDexes: ['uniswap-v2', 'uniswap-v3', 'pancakeswap', 'raydium', 'orca'],
      blacklistedTokens: []
    },
    batchSize: 10,
    processingDelayMs: 100
  },
  
  providers: {
    ethereum: {
      flashbots: {
        relayUrl: process.env['FLASHBOTS_RELAY_URL'] || 'https://relay.flashbots.net',
        authKey: process.env['FLASHBOTS_AUTH_KEY'] || '',
        reputationBonus: 0
      }
    },
    bsc: {
      bloxroute: {
        endpoint: process.env['BLOXROUTE_ENDPOINT'] || '',
        authToken: process.env['BLOXROUTE_AUTH_TOKEN'] || ''
      },
      nodereal: {
        endpoint: process.env['NODEREAL_ENDPOINT'] || '',
        apiKey: process.env['NODEREAL_API_KEY'] || ''
      },
      preferredProvider: 'bloxroute',
      mempoolSubscription: true
    },
    solana: {
      jito: {
        blockEngineUrl: process.env['JITO_BLOCK_ENGINE_URL'] || 'https://mainnet.block-engine.jito.wtf',
        relayerUrl: process.env['JITO_RELAYER_URL'] || 'https://mainnet.relayer.jito.wtf',
        tipAccount: process.env['JITO_TIP_ACCOUNT'] || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        maxTipLamports: parseInt(process.env['MAX_TIP_LAMPORTS'] || '100000'),
        minProfitLamports: parseInt(process.env['MIN_PROFIT_LAMPORTS'] || '1000000'),
        validatorPreferences: process.env['PREFERRED_VALIDATORS']?.split(',') || [],
        profitMarginPercent: parseFloat(process.env['PROFIT_MARGIN_PERCENT'] || '10'),
        networkCongestionMultiplier: parseFloat(process.env['NETWORK_CONGESTION_MULTIPLIER'] || '2'),
        maxBundleAttempts: parseInt(process.env['MAX_BUNDLE_ATTEMPTS'] || '5'),
        baseTps: parseInt(process.env['BASE_TPS'] || '2000')
      }
    }
  }
};

export function loadConfig(): MevSandwichConfig {
  // Merge environment variables with default config
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  
  // Override with environment variables
  if (process.env['ENABLED_CHAINS']) {
    config.enabledChains = process.env['ENABLED_CHAINS'].split(',') as any[];
  }
  
  if (process.env['PAPER_TRADING_MODE']) {
    config.paperTradingMode = process.env['PAPER_TRADING_MODE'] === 'true';
  }
  
  if (process.env['MIN_PROFIT_ETH']) {
    config.minProfitThresholds.ethereum = process.env['MIN_PROFIT_ETH'];
  }
  
  if (process.env['MIN_PROFIT_SOL']) {
    config.minProfitThresholds.solana = process.env['MIN_PROFIT_SOL'];
  }
  
  if (process.env['MIN_PROFIT_BNB']) {
    config.minProfitThresholds.bsc = process.env['MIN_PROFIT_BNB'];
  }
  
  if (process.env['MAX_CONCURRENT_BUNDLES']) {
    config.maxConcurrentBundles = parseInt(process.env['MAX_CONCURRENT_BUNDLES']);
  }
  
  if (process.env['FRONT_RUN_RATIO']) {
    config.strategy.frontRunRatio = parseFloat(process.env['FRONT_RUN_RATIO']);
  }
  
  if (process.env['MAX_SLIPPAGE']) {
    config.strategy.maxSlippage = parseFloat(process.env['MAX_SLIPPAGE']);
  }
  
  if (process.env['GAS_PREMIUM_PERCENT']) {
    config.gas.gasPremiumPercent = parseFloat(process.env['GAS_PREMIUM_PERCENT']);
  }
  
  return config;
}

export function validateConfig(config: MevSandwichConfig): void {
  // Validate required fields
  if (!config.enabledChains || config.enabledChains.length === 0) {
    throw new Error('At least one chain must be enabled');
  }
  
  // Validate profit thresholds
  for (const chain of config.enabledChains) {
    if (!config.minProfitThresholds[chain] || parseFloat(config.minProfitThresholds[chain]) <= 0) {
      throw new Error(`Invalid profit threshold for ${chain}`);
    }
  }
  
  // Validate strategy parameters
  if (config.strategy.frontRunRatio <= 0 || config.strategy.frontRunRatio > 1) {
    throw new Error('Front run ratio must be between 0 and 1');
  }
  
  if (config.strategy.maxSlippage <= 0 || config.strategy.maxSlippage > 100) {
    throw new Error('Max slippage must be between 0 and 100');
  }
  
  // Validate gas configuration
  if (config.gas.gasPremiumPercent < 0) {
    throw new Error('Gas premium percent cannot be negative');
  }
  
  // Validate provider configuration
  for (const chain of config.enabledChains) {
    if (chain === 'ethereum' && !config.providers.ethereum.flashbots.relayUrl) {
      throw new Error('Flashbots relay URL is required for Ethereum');
    }
    
    if (chain === 'bsc' && !config.providers.bsc.bloxroute.endpoint && !config.providers.bsc.nodereal.endpoint) {
      throw new Error('At least one BSC provider endpoint is required');
    }
    
    if (chain === 'solana' && !config.providers.solana.jito.blockEngineUrl) {
      throw new Error('Jito block engine URL is required for Solana');
    }
  }
} 