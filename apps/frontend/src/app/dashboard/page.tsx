'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import TradeHistory from "../../components/TradeHistory";
import ProtectedRoute from "../../components/ProtectedRoute";

interface BotStatus {
  id: string;
  type: 'arbitrage' | 'copy-trader' | 'sandwich';
  name: string;
  description: string;
  isActive: boolean;
  isConfigured: boolean;
  profitLoss: number;
  lastActivity?: string;
  href: string;
}

const BotCard = ({ bot, onConfigure }: { 
  bot: BotStatus; 
  onConfigure: (href: string) => void; 
}) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-6 shadow-lg hover:bg-gray-700/50 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold">{bot.name}</h3>
        <span className={`px-2 py-1 text-xs rounded-full ${
          bot.isActive 
            ? 'bg-green-900/50 text-green-300' 
            : bot.isConfigured
            ? 'bg-yellow-900/50 text-yellow-300'
            : 'bg-gray-600 text-gray-300'
        }`}>
          {bot.isActive ? '● Active' : bot.isConfigured ? '● Configured' : '● Not Configured'}
        </span>
      </div>
      
      <p className="text-gray-400 mb-4 text-sm">{bot.description}</p>
      
      <div className="flex justify-between items-center">
        <div className="text-sm">
          <div className={`font-medium ${
            bot.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {bot.profitLoss >= 0 ? '+' : ''}${bot.profitLoss.toFixed(2)}
          </div>
          {bot.lastActivity && (
            <div className="text-gray-500 text-xs">
              Last: {new Date(bot.lastActivity).toLocaleDateString()}
            </div>
          )}
        </div>
        <Button onClick={() => onConfigure(bot.href)}>
          {bot.isConfigured ? 'Manage' : 'Configure'}
        </Button>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [bots, setBots] = useState<BotStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchBotStatus();
  }, []);

  const fetchBotStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/bots', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBots(data.bots || []);
      } else if (response.status === 401) {
        // Unauthorized - redirect to login
        await logout();
        router.push('/login');
        return;
      } else {
        setError('Failed to load bot status');
      }
    } catch (error) {
      console.error('Error fetching bot status:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      router.push('/login');
    }
  };

  const handleConfigure = (href: string) => {
    router.push(href);
  };

  // Default bot configurations if API fails
  const defaultBots: BotStatus[] = [
    {
      id: 'arbitrage',
      type: 'arbitrage',
      name: 'Arbitrage Bot',
      description: 'Exploits price differences across DEXs for profit opportunities.',
      isActive: false,
      isConfigured: false,
      profitLoss: 0,
      href: '/dashboard/arbitrage',
    },
    {
      id: 'copy-trader',
      type: 'copy-trader',
      name: 'Copy-Trading Bot',
      description: 'Mirrors trades from successful wallet addresses.',
      isActive: false,
      isConfigured: false,
      profitLoss: 0,
      href: '/dashboard/copy-trader',
    },
    {
      id: 'sandwich',
      type: 'sandwich',
      name: 'MEV Bot (Advanced)',
      description: 'Advanced MEV extraction strategies for experienced users.',
      isActive: false,
      isConfigured: false,
      profitLoss: 0,
      href: '/dashboard/sandwich',
    },
  ];

  const displayBots = bots.length > 0 ? bots : defaultBots;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold">Trading Bot Dashboard</h1>
            {user && (
              <p className="text-gray-400 mt-1">Welcome back, {user.email}</p>
            )}
          </div>
          <Button onClick={handleLogout}>Logout</Button>
        </header>

        <main>
          {error && (
            <div className="mb-8 p-4 bg-red-900/50 border border-red-500 rounded-md">
              <p className="text-red-200" role="alert">{error}</p>
              <Button 
                onClick={fetchBotStatus} 
                className="mt-2 text-sm"
              >
                Retry
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg p-6 shadow-lg animate-pulse">
                  <div className="h-6 bg-gray-700 rounded mb-4"></div>
                  <div className="h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded mb-4"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-gray-700 rounded w-16"></div>
                    <div className="h-8 bg-gray-700 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {displayBots.map((bot) => (
                <BotCard 
                  key={bot.id}
                  bot={bot}
                  onConfigure={handleConfigure}
                />
              ))}
            </div>
          )}

          <div className="bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Performance Analytics</h2>
            <TradeHistory />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 