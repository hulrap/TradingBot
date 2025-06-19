'use client';

import React, { useState, useEffect } from 'react';

interface CopyTradingBotConfig {
  name: string;
  enabled: boolean;
  targetWallet: string;
  chains: string[];
  copySettings: {
    copyType: 'fixed' | 'percentage' | 'proportional';
    fixedAmount: string;
    percentageOfBalance: number;
    maxCopyAmount: string;
  };
  filters: {
    minTradeValue: string;
    maxTradeValue: string;
    allowedTokens: string[];
    blockedTokens: string[];
    maxSlippage: number;
    enableStopLoss: boolean;
    stopLossPercentage: number;
    enableTakeProfit: boolean;
    takeProfitPercentage: number;
  };
  riskManagement: {
    maxDailyLoss: string;
    maxConcurrentTrades: number;
    cooldownPeriod: number;
    emergencyStopLoss: number;
  };
}

interface CopyTradingBotConfigProps {
  initialConfig?: Partial<CopyTradingBotConfig>;
  onSave: (config: CopyTradingBotConfig) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CopyTradingBotConfig({
  initialConfig,
  onSave,
  onCancel,
  isLoading = false
}: CopyTradingBotConfigProps) {
  const [config, setConfig] = useState<CopyTradingBotConfig>({
    name: '',
    enabled: false,
    targetWallet: '',
    chains: ['ethereum'],
    copySettings: {
      copyType: 'fixed',
      fixedAmount: '0.1',
      percentageOfBalance: 10,
      maxCopyAmount: '1.0'
    },
    filters: {
      minTradeValue: '0.01',
      maxTradeValue: '10.0',
      allowedTokens: [],
      blockedTokens: [],
      maxSlippage: 5,
      enableStopLoss: true,
      stopLossPercentage: 10,
      enableTakeProfit: true,
      takeProfitPercentage: 20
    },
    riskManagement: {
      maxDailyLoss: '5.0',
      maxConcurrentTrades: 3,
      cooldownPeriod: 5000,
      emergencyStopLoss: 50
    },
    ...initialConfig
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [walletValidation, setWalletValidation] = useState<{
    isValid: boolean;
    message: string;
    recentTrades: number;
  }>({ isValid: false, message: '', recentTrades: 0 });

  // Validate target wallet address
  useEffect(() => {
    if (config.targetWallet) {
      validateWallet(config.targetWallet);
    }
  }, [config.targetWallet]);

  const validateWallet = async (address: string) => {
    try {
      // Basic validation
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        setWalletValidation({
          isValid: false,
          message: 'Invalid wallet address format',
          recentTrades: 0
        });
        return;
      }

      // Mock wallet validation - in production, check on-chain activity
      const mockRecentTrades = Math.floor(Math.random() * 50) + 1;
      setWalletValidation({
        isValid: true,
        message: `Wallet validated - ${mockRecentTrades} trades in last 30 days`,
        recentTrades: mockRecentTrades
      });
    } catch (error) {
      setWalletValidation({
        isValid: false,
        message: 'Error validating wallet',
        recentTrades: 0
      });
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!walletValidation.isValid) {
      alert('Please enter a valid target wallet address');
      return;
    }

    try {
      await onSave(config);
    } catch (error) {
      console.error('Failed to save copy trading bot configuration:', error);
    }
  };

  const resetForm = () => {
    setConfig({
      name: '',
      enabled: false,
      targetWallet: '',
      chains: ['ethereum'],
      copySettings: {
        copyType: 'fixed',
        fixedAmount: '0.1',
        percentageOfBalance: 10,
        maxCopyAmount: '1.0'
      },
      filters: {
        minTradeValue: '0.01',
        maxTradeValue: '10.0',
        allowedTokens: [],
        blockedTokens: [],
        maxSlippage: 5,
        enableStopLoss: true,
        stopLossPercentage: 10,
        enableTakeProfit: true,
        takeProfitPercentage: 20
      },
      riskManagement: {
        maxDailyLoss: '5.0',
        maxConcurrentTrades: 3,
        cooldownPeriod: 5000,
        emergencyStopLoss: 50
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Copy Trading Bot Configuration
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

      {previewMode ? (
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Configuration Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Bot Name:</strong> {config.name || 'Unnamed Bot'}</p>
                <p><strong>Status:</strong> {config.enabled ? 'Enabled' : 'Disabled'}</p>
                <p><strong>Target Wallet:</strong> {config.targetWallet.slice(0, 10)}...{config.targetWallet.slice(-8)}</p>
                <p><strong>Copy Type:</strong> {config.copySettings.copyType}</p>
              </div>
              <div>
                <p><strong>Chains:</strong> {config.chains.join(', ')}</p>
                <p><strong>Max Slippage:</strong> {config.filters.maxSlippage}%</p>
                <p><strong>Stop Loss:</strong> {config.filters.enableStopLoss ? `${config.filters.stopLossPercentage}%` : 'Disabled'}</p>
                <p><strong>Take Profit:</strong> {config.filters.enableTakeProfit ? `${config.filters.takeProfitPercentage}%` : 'Disabled'}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <h4 className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2">Copy Settings</h4>
            <p className="text-yellow-700 dark:text-yellow-300">
              <strong>Type:</strong> {config.copySettings.copyType} | 
              <strong> Amount:</strong> {
                config.copySettings.copyType === 'fixed' 
                  ? `${config.copySettings.fixedAmount} ETH` 
                  : `${config.copySettings.percentageOfBalance}% of balance`
              } | 
              <strong> Max:</strong> {config.copySettings.maxCopyAmount} ETH
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="My Copy Trading Bot"
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
                Target Wallet Address
              </label>
              <input
                type="text"
                value={config.targetWallet}
                onChange={(e) => updateConfig('targetWallet', e.target.value)}
                placeholder="0x1234567890123456789012345678901234567890"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              {config.targetWallet && (
                <div className={`mt-1 text-sm ${walletValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {walletValidation.message}
                </div>
              )}
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

          {/* Copy Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Copy Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Copy Type
              </label>
              <select
                value={config.copySettings.copyType}
                onChange={(e) => updateConfig('copySettings.copyType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage of Balance</option>
                <option value="proportional">Proportional to Target Trade</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {config.copySettings.copyType === 'fixed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Fixed Amount (ETH)
                  </label>
                  <input
                    type="number"
                    value={config.copySettings.fixedAmount}
                    onChange={(e) => updateConfig('copySettings.fixedAmount', e.target.value)}
                    min="0.001"
                    step="0.001"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {config.copySettings.copyType === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Percentage of Balance
                  </label>
                  <div>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={config.copySettings.percentageOfBalance}
                      onChange={(e) => updateConfig('copySettings.percentageOfBalance', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>1%</span>
                      <span className="font-medium">{config.copySettings.percentageOfBalance}%</span>
                      <span>50%</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Copy Amount (ETH)
                </label>
                <input
                  type="number"
                  value={config.copySettings.maxCopyAmount}
                  onChange={(e) => updateConfig('copySettings.maxCopyAmount', e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Trade Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trade Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Trade Value (ETH)
                </label>
                <input
                  type="number"
                  value={config.filters.minTradeValue}
                  onChange={(e) => updateConfig('filters.minTradeValue', e.target.value)}
                  min="0"
                  step="0.001"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Trade Value (ETH)
                </label>
                <input
                  type="number"
                  value={config.filters.maxTradeValue}
                  onChange={(e) => updateConfig('filters.maxTradeValue', e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Slippage
                </label>
                <div>
                  <input
                    type="range"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={config.filters.maxSlippage}
                    onChange={(e) => updateConfig('filters.maxSlippage', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>0.1%</span>
                    <span className="font-medium">{config.filters.maxSlippage}%</span>
                    <span>20%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={config.filters.enableStopLoss}
                    onChange={(e) => updateConfig('filters.enableStopLoss', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable Stop Loss
                  </label>
                </div>
                {config.filters.enableStopLoss && (
                  <div>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={config.filters.stopLossPercentage}
                      onChange={(e) => updateConfig('filters.stopLossPercentage', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>1%</span>
                      <span className="font-medium">{config.filters.stopLossPercentage}%</span>
                      <span>50%</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={config.filters.enableTakeProfit}
                    onChange={(e) => updateConfig('filters.enableTakeProfit', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enable Take Profit
                  </label>
                </div>
                {config.filters.enableTakeProfit && (
                  <div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="1"
                      value={config.filters.takeProfitPercentage}
                      onChange={(e) => updateConfig('filters.takeProfitPercentage', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>1%</span>
                      <span className="font-medium">{config.filters.takeProfitPercentage}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Risk Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Management</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Daily Loss (ETH)
                </label>
                <input
                  type="number"
                  value={config.riskManagement.maxDailyLoss}
                  onChange={(e) => updateConfig('riskManagement.maxDailyLoss', e.target.value)}
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Concurrent Trades
                </label>
                <input
                  type="number"
                  value={config.riskManagement.maxConcurrentTrades}
                  onChange={(e) => updateConfig('riskManagement.maxConcurrentTrades', parseInt(e.target.value))}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cooldown Period (seconds)
                </label>
                <input
                  type="number"
                  value={Math.floor(config.riskManagement.cooldownPeriod / 1000)}
                  onChange={(e) => updateConfig('riskManagement.cooldownPeriod', parseInt(e.target.value) * 1000)}
                  min="0"
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
                    min="10"
                    max="100"
                    step="5"
                    value={config.riskManagement.emergencyStopLoss}
                    onChange={(e) => updateConfig('riskManagement.emergencyStopLoss', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>10%</span>
                    <span className="font-medium">{config.riskManagement.emergencyStopLoss}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Level Indicator */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="text-blue-800 dark:text-blue-200 font-semibold mb-2">Configuration Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700 dark:text-blue-300">Copy Strategy:</span>
                <div className="font-bold">
                  {config.copySettings.copyType === 'fixed' ? `${config.copySettings.fixedAmount} ETH` :
                   config.copySettings.copyType === 'percentage' ? `${config.copySettings.percentageOfBalance}% balance` :
                   'Proportional'}
                </div>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Risk Level:</span>
                <div className={`font-bold ${
                  parseFloat(config.riskManagement.maxDailyLoss) > 10 ? 'text-red-500' :
                  parseFloat(config.riskManagement.maxDailyLoss) > 5 ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {parseFloat(config.riskManagement.maxDailyLoss) > 10 ? 'High' :
                   parseFloat(config.riskManagement.maxDailyLoss) > 5 ? 'Medium' : 'Low'}
                </div>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Target Activity:</span>
                <div className="font-bold">
                  {walletValidation.recentTrades} trades/month
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
              disabled={!walletValidation.isValid || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}