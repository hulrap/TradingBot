'use client';

import { useState } from 'react';
import { Button } from '@trading-bot/ui';

export default function ArbitrageConfigPage() {
    const [tokenA, setTokenA] = useState('ETH');
    const [tokenB, setTokenB] = useState('DAI');
    const [tradeSize, setTradeSize] = useState('1.0');
    const [minProfit, setMinProfit] = useState('0.1');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Here you would call an API to save the configuration
        console.log({ tokenA, tokenB, tradeSize, minProfit });
        setMessage('Configuration saved successfully!');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <header className="mb-10">
                <h1 className="text-3xl font-bold">Arbitrage Bot Configuration</h1>
                <p className="text-gray-400">Configure the parameters for the arbitrage strategy.</p>
            </header>

            <div className="max-w-2xl mx-auto bg-gray-800/50 p-8 rounded-lg shadow-lg">
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Sell Token</label>
                            <input type="text" value={tokenA} onChange={e => setTokenA(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Buy Token</label>
                            <input type="text" value={tokenB} onChange={e => setTokenB(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Trade Size</label>
                            <input type="number" step="0.01" value={tradeSize} onChange={e => setTradeSize(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Min. Profit (%)</label>
                            <input type="number" step="0.01" value={minProfit} onChange={e => setMinProfit(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" />
                        </div>
                    </div>

                    {message && <p className="text-green-400 text-sm text-center mb-4">{message}</p>}

                    <div className="flex justify-end">
                        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md">Save Configuration</button>
                    </div>
                </form>
            </div>
        </div>
    );
} 