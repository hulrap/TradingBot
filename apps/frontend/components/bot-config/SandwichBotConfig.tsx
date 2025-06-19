'use client';

import React, { useState, useEffect } from 'react';

interface SandwichBotConfig {
  name: string;
  enabled: boolean;
  chains: string[];
  targetSettings: {
    minVictimTradeSize: string;
    maxVictimTradeSize: string;
    targetDexes: string[];
    minPoolLiquidity: string;
    blacklistedTokens: string[];
    whitelistedTokens: string[];
  };
  mevSettings: {
    enableFlashbots: boolean;
    enableJito: boolean;
    enableBscMev: boolean;
    maxMevTip: string;
    priorityFeeMultiplier: number;
    blockTargetDelay: number;
  };
  gasBidding: {
    baseFeeMultiplier: number;
    maxGasPrice: string;
    gasLimitBuffer: number;
    competitiveMode: boolean;
    emergencyGasPrice: string;
  };
  profitability: {
    minProfitPercentage: number;
    minProfitAbsolute: string;
    maxSlippage: number;
    frontRunRatio: number;
    maxPriceImpact: number;
  };
  riskManagement: {
    maxPositionSize: string;
    maxDailyTrades: number;
    maxConcurrentBundles: number;
    emergencyStopLoss: number;
    cooldownPeriod: number;
  };
}

interface SandwichBotConfigProps {
  initialConfig?: Partial<SandwichBotConfig>;
  onSave: (config: SandwichBotConfig) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function SandwichBotConfig({
  initialConfig,
  onSave,
  onCancel,
  isLoading = false
}: SandwichBotConfigProps) {
  const [config, setConfig] = useState<SandwichBotConfig>({
    name: '',
    enabled: false,
    chains: ['ethereum'],
    targetSettings: {
      minVictimTradeSize: '0.1',
      maxVictimTradeSize: '50.0',
      targetDexes: ['uniswap-v2', 'uniswap-v3'],
      minPoolLiquidity: '100000',
      blacklistedTokens: [],
      whitelistedTokens: []
    },
    mevSettings: {
      enableFlashbots: true,
      enableJito: false,
      enableBscMev: false,
      maxMevTip: '0.01',
      priorityFeeMultiplier: 1.5,
      blockTargetDelay: 0
    },
    gasBidding: {
      baseFeeMultiplier: 1.2,
      maxGasPrice: '200',
      gasLimitBuffer: 20,
      competitiveMode: true,
      emergencyGasPrice: '500'
    },
    profitability: {
      minProfitPercentage: 1.0,
      minProfitAbsolute: '0.005',
      maxSlippage: 5.0,
      frontRunRatio: 0.3,
      maxPriceImpact: 10.0
    },
    riskManagement: {
      maxPositionSize: '5.0',
      maxDailyTrades: 50,
      maxConcurrentBundles: 3,
      emergencyStopLoss: 20,
      cooldownPeriod: 2000
    },
    ...initialConfig
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [estimatedMetrics, setEstimatedMetrics] = useState({
    expectedDailyProfit: '0',
    riskScore: 0,
    gasEfficiency: 0,
    competitiveness: 0
  });
  const [warnings, setWarnings] = useState<string[]>([]);

  // Calculate estimated metrics and warnings when config changes
  useEffect(() => {
    calculateEstimatedMetrics();
    validateConfiguration();
  }, [config]);

  const calculateEstimatedMetrics = () => {
    try {
      // Mock calculations - in production, use real MEV analytics
      const positionSize = parseFloat(config.riskManagement.maxPositionSize);
      const profitPercentage = config.profitability.minProfitPercentage;
      const dailyTrades = config.riskManagement.maxDailyTrades;
      
      const expectedDailyProfit = (positionSize * (profitPercentage / 100) * dailyTrades * 0.3).toFixed(4);
      
      // Risk score calculation (0-100, higher = riskier)
      let riskScore = 0;
      riskScore += Math.min(config.profitability.maxSlippage * 2, 20);
      riskScore += Math.min(config.profitability.maxPriceImpact, 20);
      riskScore += Math.min((parseFloat(config.gasBidding.maxGasPrice) / 10), 20);
      riskScore += config.gasBidding.competitiveMode ? 15 : 5;
      riskScore += Math.min(((positionSize - 1) * 10), 25);
      
      // Gas efficiency (profit per gas unit)
      const gasEfficiency = (parseFloat(expectedDailyProfit) / parseFloat(config.gasBidding.maxGasPrice)) * 100;
      
      // Competitiveness score
      let competitiveness = 50;
      if (config.gasBidding.competitiveMode) competitiveness += 20;
      if (config.gasBidding.baseFeeMultiplier > 1.5) competitiveness += 15;
      if (config.mevSettings.priorityFeeMultiplier > 2) competitiveness += 15;
      
      setEstimatedMetrics({
        expectedDailyProfit,
        riskScore: Math.min(Math.round(riskScore), 100),
        gasEfficiency: Math.round(gasEfficiency),
        competitiveness: Math.min(Math.round(competitiveness), 100)
      });
    } catch (error) {
      console.error('Error calculating metrics:', error);
    }
  };

  const validateConfiguration = () => {
    const newWarnings: string[] = [];
    
    // Risk warnings
    if (parseFloat(config.riskManagement.maxPositionSize) > 10) {
      newWarnings.push('High position size increases capital risk');
    }
    
    if (parseFloat(config.gasBidding.maxGasPrice) > 300) {
      newWarnings.push('Very high gas price may reduce profitability');
    }
    
    if (config.profitability.maxSlippage > 10) {
      newWarnings.push('High slippage tolerance increases execution risk');
    }
    
    if (config.profitability.minProfitPercentage < 0.5) {
      newWarnings.push('Low profit threshold may result in unprofitable trades');
    }
    
    if (config.gasBidding.competitiveMode && !config.mevSettings.enableFlashbots) {
      newWarnings.push('Competitive mode without MEV protection may result in failed transactions');
    }
    
    setWarnings(newWarnings);
  };

  const updateConfig = (path: string, value: any) => {
    setConfig(prev => {
      const keys = path.split('.');
      const newConfig = { ...prev };
      let current: any = newConfig;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const addToList = (path: string, value: string) => {
    const currentList = getNestedValue(config, path) as string[];
    if (value && !currentList.includes(value)) {
      updateConfig(path, [...currentList, value]);
    }
  };

  const removeFromList = (path: string, value: string) => {
    const currentList = getNestedValue(config, path) as string[];
    updateConfig(path, currentList.filter(item => item !== value));
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (warnings.length > 0 && !confirm('There are configuration warnings. Do you want to proceed?')) {
      return;
    }

    try {
      await onSave(config);
    } catch (error) {
      console.error('Failed to save sandwich bot configuration:', error);
    }
  };

  const resetForm = () => {
    setConfig({
      name: '',
      enabled: false,
      chains: ['ethereum'],
      targetSettings: {
        minVictimTradeSize: '0.1',
        maxVictimTradeSize: '50.0',
        targetDexes: ['uniswap-v2', 'uniswap-v3'],
        minPoolLiquidity: '100000',
        blacklistedTokens: [],
        whitelistedTokens: []
      },
      mevSettings: {
        enableFlashbots: true,
        enableJito: false,
        enableBscMev: false,
        maxMevTip: '0.01',
        priorityFeeMultiplier: 1.5,
        blockTargetDelay: 0
      },
      gasBidding: {
        baseFeeMultiplier: 1.2,
        maxGasPrice: '200',
        gasLimitBuffer: 20,
        competitiveMode: true,
        emergencyGasPrice: '500'
      },
      profitability: {
        minProfitPercentage: 1.0,
        minProfitAbsolute: '0.005',
        maxSlippage: 5.0,
        frontRunRatio: 0.3,
        maxPriceImpact: 10.0
      },
      riskManagement: {
        maxPositionSize: '5.0',
        maxDailyTrades: 50,
        maxConcurrentBundles: 3,
        emergencyStopLoss: 20,
        cooldownPeriod: 2000
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Sandwich Bot Configuration
        </h2>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            {previewMode ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-r-lg">
          <h3 className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">Configuration Warnings</h3>
          <ul className="text-yellow-700 dark:text-yellow-300 text-sm space-y-1">
            {warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {previewMode ? (
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Configuration Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Bot Name:</strong> {config.name || 'Unnamed Bot'}</p>
                <p><strong>Status:</strong> {config.enabled ? 'Enabled' : 'Disabled'}</p>
                <p><strong>Chains:</strong> {config.chains.join(', ')}</p>
                <p><strong>Target DEXes:</strong> {config.targetSettings.targetDexes.join(', ')}</p>
              </div>
              <div>
                <p><strong>Min Victim Trade:</strong> {config.targetSettings.minVictimTradeSize} ETH</p>
                <p><strong>Max Gas Price:</strong> {config.gasBidding.maxGasPrice} Gwei</p>
                <p><strong>Min Profit:</strong> {config.profitability.minProfitPercentage}%</p>
                <p><strong>Max Position:</strong> {config.riskManagement.maxPositionSize} ETH</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h4 className="text-green-800 dark:text-green-200 font-semibold">Expected Daily Profit</h4>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{estimatedMetrics.expectedDailyProfit} ETH</p>
            </div>
            <div className={`p-4 rounded-lg ${
              estimatedMetrics.riskScore > 70 ? 'bg-red-50 dark:bg-red-900/20' :
              estimatedMetrics.riskScore > 40 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'
            }`}>
              <h4 className={`font-semibold ${
                estimatedMetrics.riskScore > 70 ? 'text-red-800 dark:text-red-200' :
                estimatedMetrics.riskScore > 40 ? 'text-yellow-800 dark:text-yellow-200' : 'text-green-800 dark:text-green-200'
              }`}>Risk Score</h4>
              <p className={`text-2xl font-bold ${
                estimatedMetrics.riskScore > 70 ? 'text-red-600 dark:text-red-400' :
                estimatedMetrics.riskScore > 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
              }`}>{estimatedMetrics.riskScore}/100</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="text-blue-800 dark:text-blue-200 font-semibold">Gas Efficiency</h4>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{estimatedMetrics.gasEfficiency}%</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <h4 className="text-purple-800 dark:text-purple-200 font-semibold">Competitiveness</h4>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{estimatedMetrics.competitiveness}%</p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bot Name
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig('name', e.target.value)}
                  placeholder="My Sandwich Bot"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enable Bot
                </label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => updateConfig('enabled', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {config.enabled ? 'Bot is enabled' : 'Bot is disabled'}
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supported Chains
              </label>
              <div className="flex flex-wrap gap-2">
                {['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism'].map((chain) => (
                  <label key={chain} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.chains.includes(chain)}
                      onChange={(e) => {
                        const newChains = e.target.checked
                          ? [...config.chains, chain]
                          : config.chains.filter(c => c !== chain);
                        updateConfig('chains', newChains);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {chain}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Target Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Target Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Victim Trade Size (ETH)
                </label>
                <input
                  type="number"
                  value={config.targetSettings.minVictimTradeSize}
                  onChange={(e) => updateConfig('targetSettings.minVictimTradeSize', e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Victim Trade Size (ETH)
                </label>
                <input
                  type="number"
                  value={config.targetSettings.maxVictimTradeSize}
                  onChange={(e) => updateConfig('targetSettings.maxVictimTradeSize', e.target.value)}
                  min="0.1"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Pool Liquidity (USD)
                </label>
                <input
                  type="number"
                  value={config.targetSettings.minPoolLiquidity}
                  onChange={(e) => updateConfig('targetSettings.minPoolLiquidity', e.target.value)}
                  min="1000"
                  step="1000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target DEXes
              </label>
              <div className="flex flex-wrap gap-2">
                {['uniswap-v2', 'uniswap-v3', 'sushiswap', 'pancakeswap', 'raydium', 'orca'].map((dex) => (
                  <label key={dex} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.targetSettings.targetDexes.includes(dex)}
                      onChange={(e) => {
                        const newDexes = e.target.checked
                          ? [...config.targetSettings.targetDexes, dex]
                          : config.targetSettings.targetDexes.filter(d => d !== dex);
                        updateConfig('targetSettings.targetDexes', newDexes);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {dex}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* MEV Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">MEV Infrastructure</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.mevSettings.enableFlashbots}
                  onChange={(e) => updateConfig('mevSettings.enableFlashbots', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Flashbots (Ethereum)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.mevSettings.enableJito}
                  onChange={(e) => updateConfig('mevSettings.enableJito', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Jito (Solana)
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.mevSettings.enableBscMev}
                  onChange={(e) => updateConfig('mevSettings.enableBscMev', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable BSC MEV
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max MEV Tip (ETH)
                </label>
                <input
                  type="number"
                  value={config.mevSettings.maxMevTip}
                  onChange={(e) => updateConfig('mevSettings.maxMevTip', e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority Fee Multiplier
                </label>
                <div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={config.mevSettings.priorityFeeMultiplier}
                    onChange={(e) => updateConfig('mevSettings.priorityFeeMultiplier', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>1x</span>
                    <span className="font-medium">{config.mevSettings.priorityFeeMultiplier}x</span>
                    <span>5x</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Block Target Delay
                </label>
                <input
                  type="number"
                  value={config.mevSettings.blockTargetDelay}
                  onChange={(e) => updateConfig('mevSettings.blockTargetDelay', parseInt(e.target.value))}
                  min="0"
                  max="5"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Gas Bidding Strategy */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gas Bidding Strategy</h3>
            
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={config.gasBidding.competitiveMode}
                onChange={(e) => updateConfig('gasBidding.competitiveMode', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Competitive Mode (Higher gas fees for better inclusion)
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Base Fee Multiplier
                </label>
                <div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={config.gasBidding.baseFeeMultiplier}
                    onChange={(e) => updateConfig('gasBidding.baseFeeMultiplier', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>1x</span>
                    <span className="font-medium">{config.gasBidding.baseFeeMultiplier}x</span>
                    <span>3x</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gas Limit Buffer (%)
                </label>
                <div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={config.gasBidding.gasLimitBuffer}
                    onChange={(e) => updateConfig('gasBidding.gasLimitBuffer', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>0%</span>
                    <span className="font-medium">{config.gasBidding.gasLimitBuffer}%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Gas Price (Gwei)
                </label>
                <input
                  type="number"
                  value={config.gasBidding.maxGasPrice}
                  onChange={(e) => updateConfig('gasBidding.maxGasPrice', e.target.value)}
                  min="10"
                  step="10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Emergency Gas Price (Gwei)
                </label>
                <input
                  type="number"
                  value={config.gasBidding.emergencyGasPrice}
                  onChange={(e) => updateConfig('gasBidding.emergencyGasPrice', e.target.value)}
                  min="100"
                  step="50"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Profitability Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profitability Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Profit Percentage
                </label>
                <div>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={config.profitability.minProfitPercentage}
                    onChange={(e) => updateConfig('profitability.minProfitPercentage', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>0.1%</span>
                    <span className="font-medium">{config.profitability.minProfitPercentage}%</span>
                    <span>10%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Front-run Ratio
                </label>
                <div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={config.profitability.frontRunRatio}
                    onChange={(e) => updateConfig('profitability.frontRunRatio', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>10%</span>
                    <span className="font-medium">{Math.round(config.profitability.frontRunRatio * 100)}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Profit Absolute (ETH)
                </label>
                <input
                  type="number"
                  value={config.profitability.minProfitAbsolute}
                  onChange={(e) => updateConfig('profitability.minProfitAbsolute', e.target.value)}
                  min="0.001"
                  step="0.001"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Slippage (%)
                </label>
                <div>
                  <input
                    type="range"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={config.profitability.maxSlippage}
                    onChange={(e) => updateConfig('profitability.maxSlippage', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>0.1%</span>
                    <span className="font-medium">{config.profitability.maxSlippage}%</span>
                    <span>20%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Price Impact (%)
                </label>
                <div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={config.profitability.maxPriceImpact}
                    onChange={(e) => updateConfig('profitability.maxPriceImpact', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>1%</span>
                    <span className="font-medium">{config.profitability.maxPriceImpact}%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Management</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Position Size (ETH)
                </label>
                <input
                  type="number"
                  value={config.riskManagement.maxPositionSize}
                  onChange={(e) => updateConfig('riskManagement.maxPositionSize', e.target.value)}
                  min="0.1"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Daily Trades
                </label>
                <input
                  type="number"
                  value={config.riskManagement.maxDailyTrades}
                  onChange={(e) => updateConfig('riskManagement.maxDailyTrades', parseInt(e.target.value))}
                  min="1"
                  max="1000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Concurrent Bundles
                </label>
                <input
                  type="number"
                  value={config.riskManagement.maxConcurrentBundles}
                  onChange={(e) => updateConfig('riskManagement.maxConcurrentBundles', parseInt(e.target.value))}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cooldown Period (ms)
                </label>
                <input
                  type="number"
                  value={config.riskManagement.cooldownPeriod}
                  onChange={(e) => updateConfig('riskManagement.cooldownPeriod', parseInt(e.target.value))}
                  min="100"
                  step="100"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Emergency Stop Loss (%)
                </label>
                <div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={config.riskManagement.emergencyStopLoss}
                    onChange={(e) => updateConfig('riskManagement.emergencyStopLoss', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>5%</span>
                    <span className="font-medium">{config.riskManagement.emergencyStopLoss}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}