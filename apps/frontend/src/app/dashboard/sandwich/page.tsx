'use client';

import { useState } from 'react';
import { Button } from '@trading-bot/ui';

export default function SandwichConfigPage() {
    const [targetDex, setTargetDex] = useState('Uniswap V2');
    const [minVictimSize, setMinVictimSize] = useState('1.0');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log({ targetDex, minVictimSize });
        setMessage('Configuration saved successfully!');
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <header className="mb-10">
                <h1 className="text-3xl font-bold">Sandwich Bot Configuration</h1>
                <p className="text-gray-400">Set parameters for MEV extraction. Use with extreme caution.</p>
            </header>

            <div className="max-w-2xl mx-auto bg-gray-800/50 p-8 rounded-lg shadow-lg">
                <div className="bg-red-900/50 border-l-4 border-red-500 text-red-200 p-4 rounded-md mb-6" role="alert">
                  <p className="font-bold">Advanced Users Only</p>
                  <p>This strategy is highly competitive and risky. Incorrect configuration can lead to significant losses. Do not use this unless you fully understand MEV, gas bidding, and slippage.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Target DEX</label>
                            <input type="text" value={targetDex} onChange={e => setTargetDex(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Min. Victim Trade Size (ETH)</label>
                            <input type="number" step="0.1" value={minVictimSize} onChange={e => setMinVictimSize(e.target.value)} className="w-full p-3 bg-gray-700 rounded-md border border-gray-600" />
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