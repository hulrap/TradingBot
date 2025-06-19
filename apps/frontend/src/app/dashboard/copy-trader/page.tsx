'use client';

import { useState } from 'react';
import { Button } from '@trading-bot/ui';

export default function CopyTraderConfigPage() {
    const [targetAddress, setTargetAddress] = useState('');
    const [tradeSizeType, setTradeSizeType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
    const [tradeSizeValue, setTradeSizeValue] = useState('0.1');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log({ targetAddress, tradeSizeType, tradeSizeValue });
        setMessage('Configuration saved successfully!');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <header className="mb-10">
                <h1 className="text-3xl font-bold">Copy-Trading Bot Configuration</h1>
                <p className="text-gray-400">Configure the wallet to mirror and your trade size.</p>
            </header>

            <div className="max-w-2xl mx-auto bg-gray-800/50 p-8 rounded-lg shadow-lg">
                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Target Wallet Address</label>
                        <input type="text" value={targetAddress} onChange={e => setTargetAddress(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" placeholder="0x..." />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Trade Size Type</label>
                            <select value={tradeSizeType} onChange={e => setTradeSizeType(e.target.value as any)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600">
                                <option value="FIXED">Fixed Amount</option>
                                <option value="PERCENTAGE">Percentage of Target's Trade</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {tradeSizeType === 'FIXED' ? 'Amount (e.g., in ETH)' : 'Percentage (%)'}
                            </label>
                            <input type="number" step="0.01" value={tradeSizeValue} onChange={e => setTradeSizeValue(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" />
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