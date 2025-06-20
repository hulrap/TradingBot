'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Trade {
    id: string;
    timestamp: string;
    profit: string;
    trade_details: string;
    status: string;
    bot_type: string;
    tx_hash?: string;
    token_in: string;
    token_out: string;
    amount_in: string;
    amount_out: string;
}

interface TradeHistoryResponse {
    success: boolean;
    data: Trade[];
    message?: string;
}

export default function TradeHistory() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    useEffect(() => {
        // Don't fetch if not authenticated or still checking auth
        if (authLoading || !isAuthenticated) {
            setIsLoading(false);
            return;
        }

        const fetchTrades = async () => {
            try {
                setIsLoading(true);
                setError(null);
                
                const response = await fetch('/api/trades', {
                    method: 'GET',
                    credentials: 'include', // Include authentication cookies
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        setError('Authentication required. Please log in again.');
                        return;
                    }
                    if (response.status === 403) {
                        setError('Access denied. You do not have permission to view trades.');
                        return;
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result: TradeHistoryResponse = await response.json();
                
                if (result.success && result.data) {
                    setTrades(result.data);
                } else {
                    setError(result.message || 'Failed to fetch trade history');
                }
            } catch (error) {
                console.error("Failed to fetch trades:", error);
                setError('Network error. Please check your connection and try again.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrades();
        
        // Refresh every 30 seconds (increased from 15 for better performance)
        const interval = setInterval(fetchTrades, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, authLoading]);

    // Show loading state during authentication check
    if (authLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-400">Checking authentication...</span>
            </div>
        );
    }

    // Show authentication required message
    if (!isAuthenticated) {
        return (
            <div className="text-center p-8">
                <p className="text-red-400">Authentication required to view trade history.</p>
                <p className="text-gray-400 text-sm mt-2">Please log in to continue.</p>
            </div>
        );
    }

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-400">Loading trade history...</span>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="text-center p-8">
                <p className="text-red-400 mb-2">Error loading trade history</p>
                <p className="text-gray-400 text-sm">{error}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Show empty state
    if (trades.length === 0) {
        return (
            <div className="text-center p-8">
                <p className="text-gray-400">No trades recorded yet.</p>
                <p className="text-gray-500 text-sm mt-2">Configure and run a trading bot to see results.</p>
            </div>
        );
    }

    const formatProfit = (profit: string) => {
        const profitNum = parseFloat(profit);
        const isPositive = profitNum >= 0;
        return (
            <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                {isPositive ? '+' : ''}{profitNum.toFixed(6)}
            </span>
        );
    };

    const formatTimestamp = (timestamp: string) => {
        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return timestamp;
        }
    };

    const truncateText = (text: string, maxLength: number = 50) => {
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="border-b border-gray-600 text-gray-300">
                    <tr>
                        <th scope="col" className="px-6 py-3">Timestamp</th>
                        <th scope="col" className="px-6 py-3">Bot Type</th>
                        <th scope="col" className="px-6 py-3">Trade Pair</th>
                        <th scope="col" className="px-6 py-3">Amount</th>
                        <th scope="col" className="px-6 py-3">Profit</th>
                        <th scope="col" className="px-6 py-3">Status</th>
                        <th scope="col" className="px-6 py-3">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.map((trade) => (
                        <tr key={trade.id} className="border-b border-gray-700 hover:bg-gray-800/60">
                            <td className="px-6 py-4">{formatTimestamp(trade.timestamp)}</td>
                            <td className="px-6 py-4">
                                <span className="capitalize bg-blue-900/50 px-2 py-1 rounded text-xs">
                                    {trade.bot_type}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-blue-400">{trade.token_in}</span>
                                <span className="text-gray-500 mx-1">→</span>
                                <span className="text-green-400">{trade.token_out}</span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm">
                                    <div>{parseFloat(trade.amount_in).toFixed(4)} {trade.token_in}</div>
                                    <div className="text-gray-400">{parseFloat(trade.amount_out).toFixed(4)} {trade.token_out}</div>
                                </div>
                            </td>
                            <td className="px-6 py-4">{formatProfit(trade.profit)}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                    trade.status === 'completed' 
                                        ? 'bg-green-900/50 text-green-400' 
                                        : trade.status === 'failed'
                                        ? 'bg-red-900/50 text-red-400'
                                        : 'bg-yellow-900/50 text-yellow-400'
                                }`}>
                                    {trade.status}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="max-w-xs truncate" title={trade.trade_details}>
                                    {truncateText(trade.trade_details)}
                                </div>
                                {trade.tx_hash && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        Tx: {truncateText(trade.tx_hash, 12)}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
} 