'use client';

import { useState, useEffect } from 'react';

interface Trade {
    id: number;
    timestamp: string;
    profit: number;
    trade_details: string;
}

export default function TradeHistory() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTrades = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/trades');
                const data = await response.json();
                setTrades(data);
            } catch (error) {
                console.error("Failed to fetch trades:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTrades();
        const interval = setInterval(fetchTrades, 15000); // Refresh every 15 seconds
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return <p className="text-gray-400">Loading trade history...</p>;
    }

    if (trades.length === 0) {
        return <p className="text-gray-400">No trades recorded yet. Run the arbitrage bot to see results.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="border-b border-gray-600 text-gray-300">
                    <tr>
                        <th scope="col" className="px-6 py-3">Timestamp</th>
                        <th scope="col" className="px-6 py-3">Profit (ETH)</th>
                        <th scope="col" className="px-6 py-3">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.map((trade) => (
                        <tr key={trade.id} className="border-b border-gray-700 hover:bg-gray-800/60">
                            <td className="px-6 py-4">{new Date(trade.timestamp).toLocaleString()}</td>
                            <td className="px-6 py-4 text-green-400">+{trade.profit.toFixed(6)}</td>
                            <td className="px-6 py-4 truncate max-w-xs">{trade.trade_details}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
} 