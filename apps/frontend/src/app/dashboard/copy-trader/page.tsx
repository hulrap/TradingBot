'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';

interface CopyTraderConfig {
  id?: string;
  targetAddress: string;
  tradeSizeType: 'FIXED' | 'PERCENTAGE';
  tradeSizeValue: string;
  maxSlippage: string;
  isActive: boolean;
}

export default function CopyTraderConfigPage() {
  const [config, setConfig] = useState<CopyTraderConfig>({
    targetAddress: '',
    tradeSizeType: 'FIXED',
    tradeSizeValue: '0.1',
    maxSlippage: '0.5',
    isActive: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/bots/copy-trader/config', {
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
    } catch (error) {
      console.error('Error fetching config:', error);
      setError('Failed to load configuration. Using defaults.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    if (!config.targetAddress.trim()) {
      setError('Target wallet address is required');
      return false;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(config.targetAddress.trim())) {
      setError('Invalid wallet address format');
      return false;
    }
    if (!config.tradeSizeValue || parseFloat(config.tradeSizeValue) <= 0) {
      setError('Trade size must be greater than 0');
      return false;
    }
    if (config.tradeSizeType === 'PERCENTAGE' && parseFloat(config.tradeSizeValue) > 100) {
      setError('Percentage cannot exceed 100%');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/bots/copy-trader/config', {
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
              <h1 className="text-3xl font-bold">Copy-Trading Bot Configuration</h1>
              <p className="text-gray-400">Configure the wallet to mirror and your trade parameters.</p>
            </div>
            <Button
              onClick={() => router.push('/dashboard')}
              className="bg-gray-700 hover:bg-gray-600"
            >
              ← Back to Dashboard
            </Button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto">
          {/* Security Warning */}
          <div className="bg-yellow-900/20 border-l-4 border-yellow-500 text-yellow-200 p-4 rounded-md mb-8">
            <p className="font-bold">⚠️ Important Notice</p>
            <p>Copy trading involves risks including MEV front-running and slippage. Only follow trusted wallets with proven track records.</p>
          </div>

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
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Target Wallet Address
                </label>
                <input
                  type="text"
                  value={config.targetAddress}
                  onChange={(e) => setConfig(prev => ({ ...prev, targetAddress: e.target.value }))}
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0x..."
                  disabled={isSaving}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Trade Size Type
                  </label>
                  <select
                    value={config.tradeSizeType}
                    onChange={(e) => setConfig(prev => ({ ...prev, tradeSizeType: e.target.value as 'FIXED' | 'PERCENTAGE' }))}
                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSaving}
                  >
                    <option value="FIXED">Fixed Amount</option>
                    <option value="PERCENTAGE">Percentage of Target&apos;s Trade</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {config.tradeSizeType === 'FIXED' ? 'Amount (ETH)' : 'Percentage (%)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.tradeSizeValue}
                    onChange={(e) => setConfig(prev => ({ ...prev, tradeSizeValue: e.target.value }))}
                    className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Slippage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={config.maxSlippage}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxSlippage: e.target.value }))}
                  className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSaving}
                />
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
            <p className="font-bold">💡 How Copy Trading Works</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Monitors the target wallet for new transactions</li>
              <li>• Replicates trades with your specified size parameters</li>
              <li>• Includes MEV protection and slippage controls</li>
              <li>• Requires sufficient balance for trading operations</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 