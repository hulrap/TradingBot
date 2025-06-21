'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import ProtectedRoute from '../../components/ProtectedRoute';

// Extend Window interface for ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface WalletConnection {
  id: string;
  address: string;
  type: 'metamask' | 'walletconnect' | 'hardware';
  balance: string;
  isActive: boolean;
  createdAt: string;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/wallets', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setWallets(data.wallets || []);
      } else {
        setError('Failed to load wallet connections');
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWallet = async (type: 'metamask' | 'walletconnect') => {
    setIsConnecting(true);
    setError('');

    try {
      if (type === 'metamask') {
        // Check if MetaMask is installed
        if (typeof (window as any).ethereum === 'undefined') {
          setError('MetaMask is not installed. Please install MetaMask to continue.');
          return;
        }

        // Request account access
        const accounts = await (window as any).ethereum.request({
          method: 'eth_request_accounts',
        });

        if (accounts.length > 0) {
          const address = accounts[0];
          
          // Send wallet connection to backend
          const response = await fetch('/api/wallets/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              address, 
              type: 'metamask' 
            }),
          });

          if (response.ok) {
            await fetchWallets(); // Refresh wallet list
          } else {
            const data = await response.json();
            setError(data.message || 'Failed to connect wallet');
          }
        }
      } else if (type === 'walletconnect') {
        // Placeholder for WalletConnect integration
        setError('WalletConnect integration coming soon. Please use MetaMask for now.');
      }
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      if (error.code === 4001) {
        setError('Wallet connection was rejected. Please try again.');
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = async (walletId: string) => {
    try {
      const response = await fetch(`/api/wallets/${walletId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchWallets(); // Refresh wallet list
      } else {
        setError('Failed to disconnect wallet');
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setError('Network error. Please try again.');
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold">Wallet Management</h1>
          <p className="text-gray-400">
            Connect your wallets securely for trading bot operations. Your private keys never leave your wallet.
          </p>
        </header>

        <div className="max-w-4xl mx-auto">
          {/* Security Notice */}
          <div className="bg-green-900/20 border-l-4 border-green-500 text-green-200 p-4 rounded-md mb-8" role="alert">
            <p className="font-bold">🔒 Secure Connection</p>
            <p>
              We use secure wallet connection protocols. Your private keys remain safely in your wallet and are never transmitted or stored on our servers.
            </p>
          </div>

          {/* Connect New Wallet */}
          <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Connect New Wallet</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => handleConnectWallet('metamask')}
                disabled={isConnecting}
                className="h-16"
              >
                🦊 MetaMask
              </Button>

              <Button
                onClick={() => handleConnectWallet('walletconnect')}
                disabled={isConnecting}
                className="h-16"
              >
                📱 WalletConnect
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md">
              <p className="text-red-200" role="alert">{error}</p>
            </div>
          )}

          {/* Connected Wallets */}
          <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Connected Wallets</h2>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-400">Loading wallets...</span>
              </div>
            ) : wallets.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No wallets connected yet.</p>
                <p className="text-sm">Connect a wallet above to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">
                        {wallet.type === 'metamask' ? '🦊' : 
                         wallet.type === 'walletconnect' ? '📱' : '🔐'}
                      </div>
                      <div>
                        <div className="font-medium">
                          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        </div>
                        <div className="text-sm text-gray-400 capitalize">
                          {wallet.type} • Balance: {wallet.balance} ETH
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        wallet.isActive 
                          ? 'bg-green-900/50 text-green-300' 
                          : 'bg-gray-600 text-gray-300'
                      }`}>
                        {wallet.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Button
                        onClick={() => handleDisconnectWallet(wallet.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-blue-900/20 border-l-4 border-blue-500 text-blue-200 p-4 rounded-md">
            <p className="font-bold">💡 How it works</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• Connect your wallet using secure protocols (MetaMask, WalletConnect)</li>
              <li>• Your private keys never leave your wallet</li>
              <li>• Trading bots will request transaction approval from your wallet</li>
              <li>• You maintain full control and can disconnect at any time</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 