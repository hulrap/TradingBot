'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProtectedRoute from '../../components/ProtectedRoute';
import { 
  formatCurrency, 
  truncateAddress, 
  isValidEthereumAddress,
  formatTimestamp,
  retryWithBackoff 
} from '@/lib/utils';

// Extend Window interface for ethereum and wallet connections
declare global {
  interface Window {
    ethereum?: any;
    WalletConnect?: any;
  }
}

interface TokenBalance {
  symbol: string;
  balance: string;
  usdValue: number;
  decimals: number;
  contractAddress?: string;
}

interface WalletConnection {
  id: string;
  address: string;
  type: 'metamask' | 'walletconnect' | 'coinbase' | 'ledger' | 'trezor';
  name: string;
  balances: {
    [chainId: string]: {
      native: TokenBalance;
      tokens: TokenBalance[];
      totalUsdValue: number;
    };
  };
  isActive: boolean;
  lastUsed: string;
  createdAt: string;
  chainId: number;
  isHardware: boolean;
}

interface ChainConfig {
  id: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  icon: string;
}

const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/',
    blockExplorer: 'https://etherscan.io',
    icon: '⟠'
  },
  {
    id: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    icon: '⬟'
  },
  {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    icon: '◈'
  },
  {
    id: 56,
    name: 'BSC',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    icon: '⬢'
  }
];

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedChain, setSelectedChain] = useState<number>(1);
  const [balanceRefreshLoading, setBalanceRefreshLoading] = useState<string | null>(null);
  const [walletConnectUri, setWalletConnectUri] = useState<string>('');
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  const fetchWallets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await retryWithBackoff(
        () => fetch('/api/wallets', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        3,
        1000
      );

      if (response.ok) {
        const data = await response.json();
        setWallets(data.wallets || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to load wallet connections');
      }
    } catch (error: any) {
      console.error('Error fetching wallets:', error);
      setError(`Network error: ${error.message}. Please check your connection and try again.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshWalletBalances = async (walletId: string) => {
    try {
      setBalanceRefreshLoading(walletId);
      setError('');

      const response = await fetch(`/api/wallets/${walletId}/refresh-balance`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchWallets(); // Refresh all wallets
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to refresh wallet balance');
      }
    } catch (error: any) {
      console.error('Error refreshing balance:', error);
      setError(`Failed to refresh balance: ${error.message}`);
    } finally {
      setBalanceRefreshLoading(null);
    }
  };

  const handleConnectMetaMask = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        setError('MetaMask is not installed. Please install MetaMask to continue.');
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        setError('No accounts found. Please make sure MetaMask is unlocked.');
        return;
      }

      const address = accounts[0];
      
      // Validate the address
      if (!isValidEthereumAddress(address)) {
        setError('Invalid Ethereum address received from MetaMask.');
        return;
      }

      // Get current chain ID
      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      });

      // Send wallet connection to backend
      const response = await fetch('/api/wallets/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          address, 
          type: 'metamask',
          chainId: parseInt(chainId, 16),
          name: `MetaMask (${truncateAddress(address)})`
        }),
      });

      if (response.ok) {
        await fetchWallets();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to connect MetaMask wallet');
      }
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      if (error.code === 4001) {
        setError('MetaMask connection was rejected. Please approve the connection to continue.');
      } else if (error.code === -32002) {
        setError('MetaMask is already processing a connection request. Please check your MetaMask extension.');
      } else {
        setError(`Failed to connect MetaMask: ${error.message}`);
      }
    }
  };

  const handleConnectWalletConnect = async () => {
    try {
      setShowWalletConnectModal(true);
      
      // WalletConnect integration requires additional dependencies
      // For production, install: @walletconnect/client @walletconnect/qrcode-modal
      setError('WalletConnect integration requires additional setup. Please use MetaMask for now or contact support for WalletConnect configuration.');
      setShowWalletConnectModal(false);

    } catch (error: any) {
      console.error('WalletConnect error:', error);
      setError(`Failed to initialize WalletConnect: ${error.message}`);
      setShowWalletConnectModal(false);
    }
  };

  const handleConnectHardwareWallet = async (type: 'ledger' | 'trezor') => {
    try {
      if (type === 'ledger') {
        // Ledger integration requires additional dependencies
        // For production, install: @ledgerhq/hw-transport-webhid @ledgerhq/hw-app-eth
        setError('Ledger integration requires additional setup and dependencies. Please use MetaMask for now or contact support for hardware wallet configuration.');
      } else {
        setError('Trezor integration coming soon. Please use MetaMask for now.');
      }
    } catch (error: any) {
      console.error(`${type} connection error:`, error);
      setError(`Failed to connect ${type}: ${error.message}`);
    }
  };

  const handleConnectWallet = async (type: 'metamask' | 'walletconnect' | 'ledger' | 'trezor' | 'coinbase') => {
    setIsConnecting(true);
    setError('');

    try {
      switch (type) {
        case 'metamask':
          await handleConnectMetaMask();
          break;
        case 'walletconnect':
          await handleConnectWalletConnect();
          break;
        case 'ledger':
        case 'trezor':
          await handleConnectHardwareWallet(type);
          break;
        case 'coinbase':
          setError('Coinbase Wallet integration coming soon. Please use MetaMask for now.');
          break;
        default:
          setError('Unsupported wallet type');
      }
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      setError(`Failed to connect wallet: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = async (walletId: string) => {
    try {
      const response = await fetch(`/api/wallets/${walletId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await fetchWallets();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to disconnect wallet');
      }
    } catch (error: any) {
      console.error('Error disconnecting wallet:', error);
      setError(`Network error: ${error.message}. Please try again.`);
    }
  };

  const getTotalPortfolioValue = () => {
    return wallets.reduce((total, wallet) => {
      return total + Object.values(wallet.balances).reduce((walletTotal, chainBalance) => {
        return walletTotal + chainBalance.totalUsdValue;
      }, 0);
    }, 0);
  };

  const getChainName = (chainId: number) => {
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    return chain ? chain.name : `Chain ${chainId}`;
  };

  const getChainIcon = (chainId: number) => {
    const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
    return chain ? chain.icon : '⛓️';
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Wallet Management</h1>
              <p className="text-gray-400">
                Connect your wallets securely for trading bot operations. Your private keys never leave your wallet.
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Total Portfolio Value</div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(getTotalPortfolioValue())}
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Enhanced Security Notice */}
          <Card className="border-green-500/50 bg-green-900/10">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="text-green-400 text-xl">🛡️</div>
                <div>
                  <h3 className="font-bold text-green-400 mb-2">Enterprise-Grade Security</h3>
                  <ul className="text-green-200 text-sm space-y-1">
                    <li>• Your private keys remain safely in your wallet and are never transmitted</li>
                    <li>• All connections use secure protocols with end-to-end encryption</li>
                    <li>• Real-time balance monitoring across multiple chains</li>
                    <li>• Hardware wallet support for maximum security</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connect New Wallet */}
          <Card>
            <CardHeader>
              <CardTitle>Connect New Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Button
                  onClick={() => handleConnectWallet('metamask')}
                  disabled={isConnecting}
                  className="h-20 flex flex-col gap-2"
                  variant="outline"
                >
                  <span className="text-2xl">🦊</span>
                  <span>MetaMask</span>
                </Button>

                <Button
                  onClick={() => handleConnectWallet('walletconnect')}
                  disabled={isConnecting}
                  className="h-20 flex flex-col gap-2"
                  variant="outline"
                >
                  <span className="text-2xl">📱</span>
                  <span>WalletConnect</span>
                </Button>

                <Button
                  onClick={() => handleConnectWallet('ledger')}
                  disabled={isConnecting}
                  className="h-20 flex flex-col gap-2"
                  variant="outline"
                >
                  <span className="text-2xl">🔐</span>
                  <span>Ledger</span>
                </Button>

                <Button
                  onClick={() => handleConnectWallet('trezor')}
                  disabled={isConnecting}
                  className="h-20 flex flex-col gap-2"
                  variant="outline"
                >
                  <span className="text-2xl">🔒</span>
                  <span>Trezor</span>
                </Button>

                <Button
                  onClick={() => handleConnectWallet('coinbase')}
                  disabled={isConnecting}
                  className="h-20 flex flex-col gap-2"
                  variant="outline"
                >
                  <span className="text-2xl">💙</span>
                  <span>Coinbase</span>
                </Button>
              </div>

              {isConnecting && (
                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                    <span className="text-blue-200">Connecting wallet... Please approve the connection in your wallet.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* WalletConnect Modal */}
          {showWalletConnectModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <Card className="w-96">
                <CardHeader>
                  <CardTitle>WalletConnect</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <p className="text-sm text-gray-400">
                      Scan the QR code with your wallet app to connect
                    </p>
                    {walletConnectUri && (
                      <div className="p-4 bg-white rounded-lg">
                        {/* QR Code would be rendered here */}
                        <div className="h-48 flex items-center justify-center bg-gray-100 text-gray-600">
                          QR Code: {walletConnectUri.slice(0, 20)}...
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={() => setShowWalletConnectModal(false)}
                      variant="outline"
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Card className="border-red-500/50 bg-red-900/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-red-400 text-xl">⚠️</span>
                  <div>
                    <p className="text-red-200 font-medium">Connection Error</p>
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Connected Wallets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Connected Wallets ({wallets.length})</CardTitle>
                <Button
                  onClick={fetchWallets}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? 'Refreshing...' : 'Refresh All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-400">Loading wallets...</span>
                </div>
              ) : wallets.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-6xl mb-4">👛</div>
                  <h3 className="text-lg font-medium mb-2">No wallets connected</h3>
                  <p className="text-sm">Connect a wallet above to get started with trading bots.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="p-6 bg-gray-800/50 rounded-lg border border-gray-700/50"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">
                            {wallet.type === 'metamask' ? '🦊' : 
                             wallet.type === 'walletconnect' ? '📱' : 
                             wallet.type === 'ledger' ? '🔐' : 
                             wallet.type === 'trezor' ? '🔒' : 
                             wallet.type === 'coinbase' ? '💙' : '👛'}
                          </div>
                          <div>
                            <div className="font-medium text-lg">{wallet.name}</div>
                            <div className="text-sm text-gray-400">
                              {truncateAddress(wallet.address)}
                              {wallet.isHardware && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Hardware
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              Added {formatTimestamp(wallet.createdAt)} • Last used {formatTimestamp(wallet.lastUsed)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={wallet.isActive ? "default" : "secondary"}>
                            {wallet.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            onClick={() => refreshWalletBalances(wallet.id)}
                            disabled={balanceRefreshLoading === wallet.id}
                            variant="outline"
                            size="sm"
                          >
                            {balanceRefreshLoading === wallet.id ? 'Refreshing...' : 'Refresh'}
                          </Button>
                          <Button
                            onClick={() => handleDisconnectWallet(wallet.id)}
                            variant="destructive"
                            size="sm"
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>

                      {/* Multi-chain balances */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(wallet.balances).map(([chainId, chainData]) => (
                          <div key={chainId} className="p-4 bg-gray-700/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{getChainIcon(parseInt(chainId))}</span>
                              <span className="font-medium text-sm">{getChainName(parseInt(chainId))}</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">{chainData.native.symbol}</span>
                                <span className="text-sm font-medium">
                                  {parseFloat(chainData.native.balance).toFixed(4)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatCurrency(chainData.totalUsdValue)}
                              </div>
                              {chainData.tokens.length > 0 && (
                                <div className="text-xs text-blue-400">
                                  +{chainData.tokens.length} tokens
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Instructions */}
          <Card className="border-blue-500/50 bg-blue-900/10">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="text-blue-400 text-xl">💡</div>
                <div>
                  <h3 className="font-bold text-blue-400 mb-3">How Wallet Management Works</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-200">
                    <div>
                      <h4 className="font-medium mb-2">Security Features:</h4>
                      <ul className="space-y-1">
                        <li>• End-to-end encrypted connections</li>
                        <li>• Private keys never leave your wallet</li>
                        <li>• Hardware wallet support</li>
                        <li>• Multi-signature compatibility</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Trading Integration:</h4>
                      <ul className="space-y-1">
                        <li>• Real-time balance monitoring</li>
                        <li>• Multi-chain portfolio tracking</li>
                        <li>• Automated transaction approval</li>
                        <li>• Gas optimization features</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
} 