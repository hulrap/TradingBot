'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArbitrageBotConfigSchema } from '@trading-bot/types';

// Enhanced validation schema
const ArbitrageBotFormSchema = ArbitrageBotConfigSchema.extend({
  tokenPairs: z.array(z.object({
    tokenA: z.string().min(1, 'Token A is required'),
    tokenASymbol: z.string().min(1, 'Token A symbol is required'),
    tokenB: z.string().min(1, 'Token B is required'),
    tokenBSymbol: z.string().min(1, 'Token B symbol is required'),
    minLiquidity: z.string().min(1, 'Minimum liquidity is required'),
    enabled: z.boolean()
  })).min(1, 'At least one token pair is required'),
  riskParams: z.object({
    maxPositionSize: z.string().min(1, 'Max position size is required'),
    maxDailyLoss: z.string().min(1, 'Max daily loss is required'),
    stopLossPercentage: z.number().min(0).max(100),
    takeProfitPercentage: z.number().min(0).max(100),
    maxConcurrentTrades: z.number().min(1).max(10),
    cooldownPeriod: z.number().min(0, 'Cooldown period must be positive')
  })
});

type ArbitrageBotFormData = z.infer<typeof ArbitrageBotFormSchema>;

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  logo?: string;
  liquidity: string;
  volume24h: string;
}

interface ArbitrageBotConfigProps {
  initialConfig?: Partial<ArbitrageBotFormData>;
  onSave: (config: ArbitrageBotFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ArbitrageBotConfig({
  initialConfig,
  onSave,
  onCancel,
  isLoading = false
}: ArbitrageBotConfigProps) {
  const [tokenSearch, setTokenSearch] = useState('');
  const [availableTokens, setAvailableTokens] = useState<TokenInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [estimatedProfit, setEstimatedProfit] = useState<string>('0');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset
  } = useForm<ArbitrageBotFormData>({
    resolver: zodResolver(ArbitrageBotFormSchema),
    defaultValues: {
      name: '',
      enabled: false,
      chains: ['ethereum'],
      tokenPairs: [{
        tokenA: '',
        tokenASymbol: '',
        tokenB: '',
        tokenBSymbol: '',
        minLiquidity: '10000',
        enabled: true
      }],
      minProfitPercentage: 0.5,
      maxSlippage: 3,
      gasSettings: {
        maxGasPrice: '100',
        priorityFee: '2',
        gasLimit: '300000'
      },
      riskParams: {
        maxPositionSize: '1.0',
        maxDailyLoss: '5.0',
        stopLossPercentage: 5,
        takeProfitPercentage: 10,
        maxConcurrentTrades: 3,
        cooldownPeriod: 5000
      },
      ...initialConfig
    },
    mode: 'onChange'
  });

  const watchedValues = watch();

  // Load popular tokens on component mount
  useEffect(() => {
    loadPopularTokens();
  }, []);

  // Search for tokens
  useEffect(() => {
    if (tokenSearch.length > 2) {
      searchTokens(tokenSearch);
    }
  }, [tokenSearch]);

  // Calculate estimated profit when values change
  useEffect(() => {
    calculateEstimatedProfit();
  }, [watchedValues.tokenPairs, watchedValues.minProfitPercentage, watchedValues.riskParams.maxPositionSize]);

  const loadPopularTokens = async () => {
    try {
      // Mock popular tokens - in production, fetch from API
      const popularTokens: TokenInfo[] = [
        {
          address: '0xA0b86a33E6417c7962A0FF7c4BfB9D8e95D5b9C9',
          symbol: 'WETH',
          name: 'Wrapped Ethereum',
          decimals: 18,
          price: 3000,
          liquidity: '50000000',
          volume24h: '1000000'
        },
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          price: 1,
          liquidity: '100000000',
          volume24h: '2000000'
        },
        {
          address: '0xA0b86a33E6417c7962A0FF7c4BfB9D8e95D5b9C9',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          price: 1,
          liquidity: '80000000',
          volume24h: '1500000'
        },
        {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          decimals: 18,
          price: 1,
          liquidity: '30000000',
          volume24h: '500000'
        }
      ];
      setAvailableTokens(popularTokens);
    } catch (error) {
      console.error('Failed to load popular tokens:', error);
    }
  };

  const searchTokens = async (query: string) => {
    setIsSearching(true);
    try {
      // Mock token search - in production, use token search API
      const searchResults = availableTokens.filter(token =>
        token.symbol.toLowerCase().includes(query.toLowerCase()) ||
        token.name.toLowerCase().includes(query.toLowerCase())
      );
      setAvailableTokens(searchResults);
    } catch (error) {
      console.error('Token search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateEstimatedProfit = async () => {
    try {
      const { tokenPairs, minProfitPercentage, riskParams } = watchedValues;
      
      if (tokenPairs.length === 0 || !tokenPairs[0].tokenA || !tokenPairs[0].tokenB) {
        setEstimatedProfit('0');
        return;
      }

      // Mock profit calculation - in production, use real arbitrage calculation
      const positionSize = parseFloat(riskParams.maxPositionSize);
      const profitPercentage = minProfitPercentage;
      const estimatedDaily = positionSize * (profitPercentage / 100) * riskParams.maxConcurrentTrades;
      
      setEstimatedProfit(estimatedDaily.toFixed(4));
    } catch (error) {
      console.error('Profit calculation failed:', error);
      setEstimatedProfit('0');
    }
  };

  const addTokenPair = () => {
    const currentPairs = watchedValues.tokenPairs;
    setValue('tokenPairs', [
      ...currentPairs,
      {
        tokenA: '',
        tokenASymbol: '',
        tokenB: '',
        tokenBSymbol: '',
        minLiquidity: '10000',
        enabled: true
      }
    ]);
  };

  const removeTokenPair = (index: number) => {
    const currentPairs = watchedValues.tokenPairs;
    if (currentPairs.length > 1) {
      setValue('tokenPairs', currentPairs.filter((_: any, i: number) => i !== index));
    }
  };

  const selectToken = (tokenInfo: TokenInfo, pairIndex: number, tokenPosition: 'A' | 'B') => {
    const currentPairs = watchedValues.tokenPairs;
    const updatedPairs = [...currentPairs];
    
    if (tokenPosition === 'A') {
      updatedPairs[pairIndex].tokenA = tokenInfo.address;
      updatedPairs[pairIndex].tokenASymbol = tokenInfo.symbol;
    } else {
      updatedPairs[pairIndex].tokenB = tokenInfo.address;
      updatedPairs[pairIndex].tokenBSymbol = tokenInfo.symbol;
    }
    
    setValue('tokenPairs', updatedPairs);
  };

  const onSubmit = async (data: ArbitrageBotFormData) => {
    try {
      await onSave(data);
    } catch (error) {
      console.error('Failed to save arbitrage bot configuration:', error);
    }
  };

  const resetForm = () => {
    reset();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Arbitrage Bot Configuration
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
                <p><strong>Bot Name:</strong> {watchedValues.name || 'Unnamed Bot'}</p>
                <p><strong>Status:</strong> {watchedValues.enabled ? 'Enabled' : 'Disabled'}</p>
                <p><strong>Chains:</strong> {watchedValues.chains.join(', ')}</p>
                <p><strong>Min Profit:</strong> {watchedValues.minProfitPercentage}%</p>
              </div>
              <div>
                <p><strong>Max Slippage:</strong> {watchedValues.maxSlippage}%</p>
                <p><strong>Max Position Size:</strong> {watchedValues.riskParams.maxPositionSize} ETH</p>
                <p><strong>Max Daily Loss:</strong> {watchedValues.riskParams.maxDailyLoss} ETH</p>
                <p><strong>Estimated Daily Profit:</strong> {estimatedProfit} ETH</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h4 className="text-green-800 dark:text-green-200 font-semibold mb-2">Token Pairs</h4>
            {watchedValues.tokenPairs.map((pair: any, index: number) => (
              <div key={index} className="mb-2">
                <span className="text-green-700 dark:text-green-300">
                  {pair.tokenASymbol || 'Token A'} ↔ {pair.tokenBSymbol || 'Token B'}
                  {pair.enabled ? ' (Active)' : ' (Inactive)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bot Name
                </label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="My Arbitrage Bot"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Enable Bot
                </label>
                <Controller
                  name="enabled"
                  control={control}
                  render={({ field }: { field: any }) => (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        {field.value ? 'Bot is enabled' : 'Bot is disabled'}
                      </label>
                    </div>
                  )}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supported Chains
              </label>
              <Controller
                name="chains"
                control={control}
                render={({ field }: { field: any }) => (
                  <div className="flex flex-wrap gap-2">
                    {['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism'].map((chain) => (
                      <label key={chain} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.value.includes(chain)}
                          onChange={(e) => {
                            const newValue = e.target.checked
                              ? [...field.value, chain]
                              : field.value.filter((c: string) => c !== chain);
                            field.onChange(newValue);
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {chain}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              />
            </div>
          </div>

          {/* Token Pairs Configuration */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Token Pairs</h3>
              <button
                type="button"
                onClick={addTokenPair}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                Add Pair
              </button>
            </div>

            {watchedValues.tokenPairs.map((pair: any, index: number) => (
              <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Token Pair {index + 1}
                  </h4>
                  {watchedValues.tokenPairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTokenPair(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Token A Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Token A
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search token..."
                        value={tokenSearch}
                        onChange={(e) => setTokenSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      {tokenSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {availableTokens.map((token) => (
                            <button
                              key={token.address}
                              type="button"
                              onClick={() => {
                                selectToken(token, index, 'A');
                                setTokenSearch('');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                            >
                              <div>
                                <div className="font-medium">{token.symbol}</div>
                                <div className="text-sm text-gray-500">{token.name}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {pair.tokenASymbol && (
                      <div className="mt-1 text-sm text-green-600 dark:text-green-400">
                        Selected: {pair.tokenASymbol}
                      </div>
                    )}
                  </div>

                  {/* Token B Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Token B
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search token..."
                        value={tokenSearch}
                        onChange={(e) => setTokenSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                      {tokenSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {availableTokens.map((token) => (
                            <button
                              key={token.address}
                              type="button"
                              onClick={() => {
                                selectToken(token, index, 'B');
                                setTokenSearch('');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center"
                            >
                              <div>
                                <div className="font-medium">{token.symbol}</div>
                                <div className="text-sm text-gray-500">{token.name}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {pair.tokenBSymbol && (
                      <div className="mt-1 text-sm text-green-600 dark:text-green-400">
                        Selected: {pair.tokenBSymbol}
                      </div>
                    )}
                  </div>

                  {/* Minimum Liquidity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Liquidity (USD)
                    </label>
                    <Controller
                      name={`tokenPairs.${index}.minLiquidity`}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          min="0"
                          step="1000"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Controller
                    name={`tokenPairs.${index}.enabled`}
                    control={control}
                    render={({ field }: { field: any }) => (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Enable this token pair
                        </span>
                      </label>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Profit & Trade Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Profit & Trade Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Profit Percentage
                </label>
                <Controller
                  name="minProfitPercentage"
                  control={control}
                  render={({ field }: { field: any }) => (
                    <div>
                      <input
                        type="range"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>0.1%</span>
                        <span className="font-medium">{field.value}%</span>
                        <span>10%</span>
                      </div>
                    </div>
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Slippage
                </label>
                <Controller
                  name="maxSlippage"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <input
                        type="range"
                        min="0.1"
                        max="20"
                        step="0.1"
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>0.1%</span>
                        <span className="font-medium">{field.value}%</span>
                        <span>20%</span>
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Risk Parameters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Management</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Position Size (ETH)
                </label>
                <Controller
                  name="riskParams.maxPositionSize"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Daily Loss (ETH)
                </label>
                <Controller
                  name="riskParams.maxDailyLoss"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stop Loss Percentage
                </label>
                <Controller
                  name="riskParams.stopLossPercentage"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        step="1"
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>1%</span>
                        <span className="font-medium">{field.value}%</span>
                        <span>50%</span>
                      </div>
                    </div>
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Take Profit Percentage
                </label>
                <Controller
                  name="riskParams.takeProfitPercentage"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>1%</span>
                        <span className="font-medium">{field.value}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Concurrent Trades
                </label>
                <Controller
                  name="riskParams.maxConcurrentTrades"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="1"
                      max="10"
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cooldown Period (seconds)
                </label>
                <Controller
                  name="riskParams.cooldownPeriod"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0"
                      step="1"
                      onChange={(e) => field.onChange(parseInt(e.target.value) * 1000)} // Convert to milliseconds
                      value={Math.floor(field.value / 1000)} // Display in seconds
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Gas Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gas Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Gas Price (Gwei)
                </label>
                <Controller
                  name="gasSettings.maxGasPrice"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority Fee (Gwei)
                </label>
                <Controller
                  name="gasSettings.priorityFee"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="0"
                      step="0.1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gas Limit
                </label>
                <Controller
                  name="gasSettings.gasLimit"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      min="21000"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Estimated Profit Display */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="text-blue-800 dark:text-blue-200 font-semibold mb-2">Estimated Performance</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700 dark:text-blue-300">Daily Profit Estimate:</span>
                <div className="font-bold text-lg">{estimatedProfit} ETH</div>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Risk Level:</span>
                <div className={`font-bold ${
                  parseFloat(watchedValues.riskParams.maxPositionSize) > 2 ? 'text-red-500' :
                  parseFloat(watchedValues.riskParams.maxPositionSize) > 1 ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {parseFloat(watchedValues.riskParams.maxPositionSize) > 2 ? 'High' :
                   parseFloat(watchedValues.riskParams.maxPositionSize) > 1 ? 'Medium' : 'Low'}
                </div>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300">Active Pairs:</span>
                <div className="font-bold">
                  {watchedValues.tokenPairs.filter(p => p.enabled).length}
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
              disabled={!isValid || isLoading}
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