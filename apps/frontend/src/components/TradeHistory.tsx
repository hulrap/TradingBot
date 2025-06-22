'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Enhanced trade interface with metrics
interface TradeData {
    id: string;
    timestamp: string;
    botType: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    txHash?: string;
    dex?: string;
    status: 'completed' | 'failed' | 'pending';
}

// Utility functions for formatting
const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    }).format(value);
};

const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
};

const formatTimestamp = (timestamp: string): string => {
    try {
        return new Date(timestamp).toLocaleString();
    } catch {
        return timestamp;
    }
};

interface TradeWithMetrics extends TradeData {
    profitLoss: number;
    profitLossPercentage: number;
    gasFees: number;
    netProfit: number;
    executionTime?: number;
    slippage?: number;
}

interface TradeHistoryResponse {
    success: boolean;
    data: TradeWithMetrics[];
    meta?: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        totalProfit: number;
        totalTrades: number;
        winRate: number;
    };
    message?: string;
}

interface TradeFilters {
    botType: string | 'all';
    status: 'completed' | 'failed' | 'pending' | 'all';
    dateRange: 'all' | '1d' | '7d' | '30d' | '90d';
    minProfit?: number;
    maxProfit?: number;
    searchQuery?: string;
}

type SortField = 'timestamp' | 'profitLoss' | 'profitLossPercentage' | 'gasFees' | 'netProfit';
type SortDirection = 'asc' | 'desc';

export default function TradeHistory() {
    const [trades, setTrades] = useState<TradeWithMetrics[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<TradeFilters>({
        botType: 'all',
        status: 'all',
        dateRange: '30d'
    });
    const [sortField, setSortField] = useState<SortField>('timestamp');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(50);
    
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    // Memoized filtered and sorted trades
    const filteredAndSortedTrades = useMemo(() => {
        let filtered = [...trades];

        // Apply filters
        if (filters.botType !== 'all') {
            filtered = filtered.filter(trade => trade.botType === filters.botType);
        }

        if (filters.status !== 'all') {
            filtered = filtered.filter(trade => trade.status === filters.status);
        }

        if (filters.dateRange !== 'all') {
            const now = new Date();
            const daysMap = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
            const days = daysMap[filters.dateRange];
            const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(trade => new Date(trade.timestamp) >= cutoff);
        }

        if (filters.minProfit !== undefined) {
            filtered = filtered.filter(trade => trade.profitLoss >= filters.minProfit!);
        }

        if (filters.maxProfit !== undefined) {
            filtered = filtered.filter(trade => trade.profitLoss <= filters.maxProfit!);
        }

        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            filtered = filtered.filter(trade => 
                trade.tokenIn.toLowerCase().includes(query) ||
                trade.tokenOut.toLowerCase().includes(query) ||
                trade.txHash?.toLowerCase().includes(query) ||
                trade.dex?.toLowerCase().includes(query)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue: any = a[sortField];
            let bValue: any = b[sortField];

            if (sortField === 'timestamp') {
                aValue = new Date(aValue).getTime();
                bValue = new Date(bValue).getTime();
            }

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [trades, filters, sortField, sortDirection]);

    // Memoized trade metrics
    const tradeMetrics = useMemo(() => {
        const visibleTrades = filteredAndSortedTrades;
        
        if (visibleTrades.length === 0) {
            return {
                totalTrades: 0,
                totalProfit: 0,
                totalGasFees: 0,
                netProfit: 0,
                winRate: 0,
                avgProfit: 0,
                bestTrade: null,
                worstTrade: null
            };
        }

        const totalProfit = visibleTrades.reduce((sum, trade) => sum + trade.profitLoss, 0);
        const totalGasFees = visibleTrades.reduce((sum, trade) => sum + trade.gasFees, 0);
        const winningTrades = visibleTrades.filter(trade => trade.profitLoss > 0);
        const winRate = (winningTrades.length / visibleTrades.length) * 100;
        const avgProfit = totalProfit / visibleTrades.length;
        
        const sortedByProfit = [...visibleTrades].sort((a, b) => b.profitLoss - a.profitLoss);
        const bestTrade = sortedByProfit[0];
        const worstTrade = sortedByProfit[sortedByProfit.length - 1];

        return {
            totalTrades: visibleTrades.length,
            totalProfit,
            totalGasFees,
            netProfit: totalProfit - totalGasFees,
            winRate,
            avgProfit,
            bestTrade,
            worstTrade
        };
    }, [filteredAndSortedTrades]);

    const fetchTrades = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const queryParams = new URLSearchParams();
            queryParams.append('page', currentPage.toString());
            queryParams.append('pageSize', pageSize.toString());
            queryParams.append('sortField', sortField);
            queryParams.append('sortDirection', sortDirection);
            
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== 'all') {
                    queryParams.append(key, value.toString());
                }
            });

            const response = await fetch(`/api/trades?${queryParams}`, {
                method: 'GET',
                credentials: 'include',
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
    }, [currentPage, pageSize, sortField, sortDirection, filters]);

    useEffect(() => {
        if (authLoading || !isAuthenticated) {
            setIsLoading(false);
            return;
        }

        fetchTrades();
        
        // Refresh every 30 seconds for real-time updates
        const interval = setInterval(fetchTrades, 30000);
        return () => clearInterval(interval);
    }, [fetchTrades, isAuthenticated, authLoading]);

    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    }, [sortField]);

    const handleFilterChange = useCallback((newFilters: Partial<TradeFilters>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
        setCurrentPage(1); // Reset to first page when filters change
    }, []);

    const exportTrades = useCallback(() => {
        const csvContent = [
            // Header
            ['Timestamp', 'Bot Type', 'Token In', 'Token Out', 'Amount In', 'Amount Out', 'Profit/Loss', 'Profit %', 'Gas Fees', 'Net Profit', 'Status', 'DEX', 'Tx Hash'].join(','),
            // Data
            ...filteredAndSortedTrades.map(trade => [
                formatTimestamp(trade.timestamp),
                trade.botType,
                trade.tokenIn,
                trade.tokenOut,
                trade.amountIn,
                trade.amountOut,
                trade.profitLoss.toFixed(6),
                trade.profitLossPercentage.toFixed(2),
                trade.gasFees.toFixed(6),
                trade.netProfit.toFixed(6),
                trade.status,
                trade.dex || '',
                trade.txHash || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [filteredAndSortedTrades]);

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

    return (
        <div className="space-y-6">
            {/* Trade Metrics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Total Trades</div>
                    <div className="text-2xl font-bold text-white">{tradeMetrics.totalTrades}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Net Profit</div>
                    <div className={`text-2xl font-bold ${tradeMetrics.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(tradeMetrics.netProfit)}
                    </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Win Rate</div>
                    <div className="text-2xl font-bold text-blue-400">{formatPercentage(tradeMetrics.winRate)}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400">Avg Profit</div>
                    <div className={`text-2xl font-bold ${tradeMetrics.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(tradeMetrics.avgProfit)}
                    </div>
                </div>
            </div>

            {/* Filters and Controls */}
            <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex flex-wrap gap-4">
                        {/* Bot Type Filter */}
                        <select
                            value={filters.botType}
                            onChange={(e) => handleFilterChange({ botType: e.target.value })}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        >
                            <option value="all">All Bot Types</option>
                            <option value="arbitrage">Arbitrage</option>
                            <option value="copy-trader">Copy Trader</option>
                            <option value="mev-sandwich">MEV Sandwich</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange({ status: e.target.value as 'completed' | 'failed' | 'pending' | 'all' })}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                            <option value="pending">Pending</option>
                        </select>

                        {/* Date Range Filter */}
                        <select
                            value={filters.dateRange}
                            onChange={(e) => handleFilterChange({ dateRange: e.target.value as any })}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                        >
                            <option value="all">All Time</option>
                            <option value="1d">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                        </select>

                        {/* Search */}
                        <input
                            type="text"
                            placeholder="Search tokens, DEX, or tx hash..."
                            value={filters.searchQuery || ''}
                            onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm min-w-64"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={exportTrades}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                        >
                            Export CSV
                        </button>
                        <button
                            onClick={fetchTrades}
                            disabled={isLoading}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                        >
                            {isLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Show loading state */}
            {isLoading ? (
                <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-400">Loading trade history...</span>
                </div>
            ) : error ? (
                <div className="text-center p-8">
                    <p className="text-red-400 mb-2">Error loading trade history</p>
                    <p className="text-gray-400 text-sm">{error}</p>
                    <button 
                        onClick={fetchTrades} 
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : filteredAndSortedTrades.length === 0 ? (
                <div className="text-center p-8">
                    <p className="text-gray-400">No trades found matching your criteria.</p>
                    <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or configure a trading bot.</p>
                </div>
            ) : (
                <div className="bg-gray-800/50 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-gray-600 text-gray-300">
                                <tr>
                                    <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-700/50" onClick={() => handleSort('timestamp')}>
                                        Timestamp {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th scope="col" className="px-6 py-3">Bot Type</th>
                                    <th scope="col" className="px-6 py-3">Trade Pair</th>
                                    <th scope="col" className="px-6 py-3">Amount</th>
                                    <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-700/50" onClick={() => handleSort('profitLoss')}>
                                        Profit/Loss {sortField === 'profitLoss' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-700/50" onClick={() => handleSort('gasFees')}>
                                        Gas Fees {sortField === 'gasFees' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th scope="col" className="px-6 py-3 cursor-pointer hover:bg-gray-700/50" onClick={() => handleSort('netProfit')}>
                                        Net Profit {sortField === 'netProfit' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th scope="col" className="px-6 py-3">Status</th>
                                    <th scope="col" className="px-6 py-3">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedTrades.map((trade) => (
                                    <tr key={trade.id} className="border-b border-gray-700 hover:bg-gray-800/60">
                                        <td className="px-6 py-4 text-gray-300">
                                            {formatTimestamp(trade.timestamp)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="capitalize bg-blue-900/50 px-2 py-1 rounded text-xs">
                                                {trade.botType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-blue-400">{trade.tokenIn}</span>
                                                <span className="text-gray-500">→</span>
                                                <span className="text-green-400">{trade.tokenOut}</span>
                                            </div>
                                            {trade.dex && (
                                                <div className="text-xs text-gray-500 mt-1">{trade.dex}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">
                                                <div>{parseFloat(trade.amountIn).toFixed(4)} {trade.tokenIn}</div>
                                                <div className="text-gray-400">{parseFloat(trade.amountOut).toFixed(4)} {trade.tokenOut}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={trade.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                {formatCurrency(trade.profitLoss)}
                                            </div>
                                            <div className={`text-xs ${trade.profitLossPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatPercentage(trade.profitLossPercentage)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">
                                            {formatCurrency(trade.gasFees)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={trade.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                {formatCurrency(trade.netProfit)}
                                            </span>
                                        </td>
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
                                            {trade.txHash && (
                                                <a
                                                    href={`https://etherscan.io/tx/${trade.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 text-xs"
                                                >
                                                    {trade.txHash.slice(0, 8)}...{trade.txHash.slice(-6)}
                                                </a>
                                            )}
                                            {trade.executionTime && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {trade.executionTime}ms
                                                </div>
                                            )}
                                            {trade.slippage && (
                                                <div className="text-xs text-gray-500">
                                                    Slippage: {formatPercentage(trade.slippage)}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
} 