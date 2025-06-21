'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';

interface ArbitrageConfig {
  id?: string;
  tokenA: string;
  tokenB: string;
  tradeSize: string;
  minProfit: string;
  maxSlippage: string;
  gasLimit: string;
  isActive: boolean;
}

export default function ArbitrageConfigPage() {
  const [config, setConfig] = useState<ArbitrageConfig>({
    tokenA: '',
    tokenB: '',
    tradeSize: '1.0',
    minProfit: '0.1',
    maxSlippage: '0.5',
    gasLimit: '500000',
    isActive: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/bots/arbitrage/config', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig(data.config);
        }
      } else if (response.status === 401) {
        router.push('/login');
      }
      // If no config exists, keep defaults
    } catch (error) {
      console.error('Error fetching config:', error);
      setError('Failed to load configuration. Using defaults.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!config.tokenA.trim()) {
      errors['tokenA'] = 'Token A is required';
    }
    if (!config.tokenB.trim()) {
      errors['tokenB'] = 'Token B is required';
    }
    if (config.tokenA.trim() === config.tokenB.trim()) {
      errors['tokenB'] = 'Token A and Token B must be different';
    }
    if (!config.tradeSize || parseFloat(config.tradeSize) <= 0) {
      errors['tradeSize'] = 'Trade size must be greater than 0';
    }
    if (!config.minProfit || parseFloat(config.minProfit) <= 0) {
      errors['minProfit'] = 'Minimum profit must be greater than 0';
    }
    if (!config.maxSlippage || parseFloat(config.maxSlippage) <= 0 || parseFloat(config.maxSlippage) > 50) {
      errors['maxSlippage'] = 'Max slippage must be between 0 and 50%';
    }
    if (!config.gasLimit || parseInt(config.gasLimit) < 21000) {
      errors['gasLimit'] = 'Gas limit must be at least 21,000';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!validateForm()) {
      setError('Please fix the validation errors below');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/bots/arbitrage/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Configuration saved successfully!');
        setConfig(data.config);
        setTimeout(() => setMessage(''), 5000);
      } else {
        setError(data.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBot = async () => {
    if (!config.id) {
      setError('Please save the configuration first');
      return;
    }

    try {
      const response = await fetch(`/api/bots/arbitrage/${config.isActive ? 'stop' : 'start'}`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ configId: config.id }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        setConfig(prev => ({ ...prev, isActive: !prev.isActive }));
        setMessage(`Bot ${config.isActive ? 'stopped' : 'started'} successfully!`);
        setTimeout(() => setMessage(''), 5000);
      } else {
        setError(data.message || `Failed to ${config.isActive ? 'stop' : 'start'} bot`);
      }
    } catch (error) {
      console.error('Error toggling bot:', error);
      setError('Network error. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-400">Loading configuration...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Arbitrage Bot Configuration</h1>
              <p className="text-gray-400">Configure parameters for cross-DEX arbitrage opportunities.</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-700 hover:bg-gray-600"
              >
                ← Back to Dashboard
              </Button>
              {config.id && (
                <Button
                  onClick={handleToggleBot}
                  className={config.isActive 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-green-600 hover:bg-green-700'
                  }
                >
                  {config.isActive ? 'Stop Bot' : 'Start Bot'}
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto">
          {/* Status Banner */}
          {config.isActive && (
            <div className="bg-green-900/20 border-l-4 border-green-500 text-green-200 p-4 rounded-md mb-8">
              <p className="font-bold">🤖 Bot is Running</p>
              <p>The arbitrage bot is actively monitoring for opportunities with your current configuration.</p>
            </div>
          )}

          {/* Messages */}
          {message && (
            <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-md">
              <p className="text-green-200">{message}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md">
              <p className="text-red-200" role="alert">{error}</p>
            </div>
          )}

          {/* Configuration Form */}
          <div className="bg-gray-800/50 p-8 rounded-lg shadow-lg">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Token A (Sell Token)
                  </label>
                  <input
                    type="text"
                    value={config.tokenA}
                    onChange={(e) => setConfig(prev => ({ ...prev, tokenA: e.target.value }))}
                    className={`w-full p-3 bg-gray-700 rounded-md border ${
                      validationErrors['tokenA'] ? 'border-red-500' : 'border-gray-600'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="ETH, WETH, USDC..."
                    disabled={isSaving}
                  />
                  {validationErrors['tokenA'] && (
                    <p className="mt-1 text-sm text-red-400">{validationErrors['tokenA']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Token B (Buy Token)
                  </label>
                  <input
                    type="text"
                    value={config.tokenB}
                    onChange={(e) => setConfig(prev => ({ ...prev, tokenB: e.target.value }))}
                    className={`w-full p-3 bg-gray-700 rounded-md border ${
                      validationErrors['tokenB'] ? 'border-red-500' : 'border-gray-600'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="DAI, USDC, WETH..."
                    disabled={isSaving}
                  />
                  {validationErrors['tokenB'] && (
                    <p className="mt-1 text-sm text-red-400">{validationErrors['tokenB']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trade Size (ETH)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.tradeSize}
                    onChange={(e) => setConfig(prev => ({ ...prev, tradeSize: e.target.value }))}
                    className={`w-full p-3 bg-gray-700 rounded-md border ${
                      validationErrors['tradeSize'] ? 'border-red-500' : 'border-gray-600'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    disabled={isSaving}
                  />
                  {validationErrors['tradeSize'] && (
                    <p className="mt-1 text-sm text-red-400">{validationErrors['tradeSize']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Min. Profit (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.minProfit}
                    onChange={(e) => setConfig(prev => ({ ...prev, minProfit: e.target.value }))}
                    className={`w-full p-3 bg-gray-700 rounded-md border ${
                      validationErrors['minProfit'] ? 'border-red-500' : 'border-gray-600'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    disabled={isSaving}
                  />
                  {validationErrors['minProfit'] && (
                    <p className="mt-1 text-sm text-red-400">{validationErrors['minProfit']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Slippage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.maxSlippage}
                    onChange={(e) => setConfig(prev => ({ ...prev, maxSlippage: e.target.value }))}
                    className={`w-full p-3 bg-gray-700 rounded-md border ${
                      validationErrors['maxSlippage'] ? 'border-red-500' : 'border-gray-600'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    disabled={isSaving}
                  />
                  {validationErrors['maxSlippage'] && (
                    <p className="mt-1 text-sm text-red-400">{validationErrors['maxSlippage']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Gas Limit
                  </label>
                  <input
                    type="number"
                    value={config.gasLimit}
                    onChange={(e) => setConfig(prev => ({ ...prev, gasLimit: e.target.value }))}
                    className={`w-full p-3 bg-gray-700 rounded-md border ${
                      validationErrors['gasLimit'] ? 'border-red-500' : 'border-gray-600'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    disabled={isSaving}
                  />
                  {validationErrors['gasLimit'] && (
                    <p className="mt-1 text-sm text-red-400">{validationErrors['gasLimit']}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="min-w-[120px]"
                >
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </form>
          </div>

          {/* Information */}
          <div className="mt-8 bg-blue-900/20 border-l-4 border-blue-500 text-blue-200 p-4 rounded-md">
            <p className="font-bold">💡 How Arbitrage Works</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Monitors price differences between DEXs for the specified token pair</li>
              <li>• Executes trades when profit exceeds minimum threshold</li>
              <li>• Accounts for gas costs and slippage in profit calculations</li>
              <li>• Requires sufficient balance in both tokens for optimal performance</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 