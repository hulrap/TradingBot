'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';

export default function SandwichConfigPage() {
    const [targetDex, setTargetDex] = useState('Uniswap V2');
    const [minVictimSize, setMinVictimSize] = useState('1.0');
    const [acknowledged, setAcknowledged] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Functionality disabled pending legal review
        alert('MEV sandwich functionality is currently under legal review and is not available.');
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <header className="mb-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">MEV Sandwich Bot Configuration</h1>
                            <p className="text-gray-400">Educational interface - Functionality under legal review</p>
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
                    {/* CRITICAL LEGAL WARNING */}
                    <div className="bg-red-900/50 border-2 border-red-500 text-red-200 p-6 rounded-md mb-8">
                        <h2 className="text-xl font-bold mb-4">⚠️ LEGAL & ETHICAL WARNING</h2>
                        <div className="space-y-3 text-sm">
                            <p><strong>This functionality is currently under legal review and is NOT AVAILABLE.</strong></p>
                            <p>MEV sandwich attacks may involve:</p>
                            <ul className="list-disc list-inside ml-4 space-y-1">
                                <li>Front-running other users&apos; transactions</li>
                                <li>Extracting value from unsuspecting traders</li>
                                <li>Potential market manipulation in some jurisdictions</li>
                                <li>Regulatory uncertainty and compliance issues</li>
                                <li>Ethical concerns about fairness to other market participants</li>
                            </ul>
                            <p className="font-bold">Before implementing such functionality, thorough legal review is required to ensure compliance with applicable laws and regulations.</p>
                        </div>
                    </div>

                    {/* Acknowledgment Required */}
                    <div className="bg-gray-800/50 p-6 rounded-lg shadow-lg mb-8">
                        <div className="flex items-start space-x-3">
                            <input
                                type="checkbox"
                                id="acknowledge"
                                checked={acknowledged}
                                onChange={(e) => setAcknowledged(e.target.checked)}
                                className="mt-1 h-4 w-4"
                            />
                            <label htmlFor="acknowledge" className="text-sm">
                                I understand that MEV sandwich attacks involve extracting value from other traders and may have legal and ethical implications. I acknowledge that this functionality is for educational purposes only and is not available for actual use pending legal review.
                            </label>
                        </div>
                    </div>

                    {/* Educational Configuration Form (Disabled) */}
                    <div className="bg-gray-800/30 p-8 rounded-lg shadow-lg opacity-60">
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-gray-300 mb-2">Educational Configuration (Non-Functional)</h3>
                            <p className="text-sm text-gray-400">This interface shows what MEV sandwich configuration might look like, but functionality is disabled.</p>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Target DEX</label>
                                    <input
                                        type="text"
                                        value={targetDex}
                                        onChange={(e) => setTargetDex(e.target.value)}
                                        className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 opacity-50"
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Min. Target Trade Size (ETH)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={minVictimSize}
                                        onChange={(e) => setMinVictimSize(e.target.value)}
                                        className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 opacity-50"
                                        disabled
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={!acknowledged}
                                    className="min-w-[120px] opacity-50"
                                >
                                    Configuration Disabled
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Educational Information */}
                    <div className="mt-8 space-y-6">
                        <div className="bg-blue-900/20 border-l-4 border-blue-500 text-blue-200 p-4 rounded-md">
                            <p className="font-bold">📚 Educational: How MEV Sandwich Attacks Work</p>
                            <ul className="mt-2 space-y-1 text-sm">
                                <li>• Monitor mempool for pending trades with high slippage tolerance</li>
                                <li>• Place a buy order just before the target transaction (front-run)</li>
                                <li>• Target transaction executes at a worse price due to the front-run</li>
                                <li>• Place a sell order immediately after (back-run) to capture profit</li>
                                <li>• Profit comes from the price impact created by this sequence</li>
                            </ul>
                        </div>

                        <div className="bg-yellow-900/20 border-l-4 border-yellow-500 text-yellow-200 p-4 rounded-md">
                            <p className="font-bold">⚖️ Legal Considerations</p>
                            <ul className="mt-2 space-y-1 text-sm">
                                <li>• Market manipulation laws may apply in various jurisdictions</li>
                                <li>• Front-running regulations in traditional finance may extend to DeFi</li>
                                <li>• Consumer protection laws regarding fair trading practices</li>
                                <li>• Regulatory guidance is still evolving for MEV activities</li>
                                <li>• Some protocols are implementing MEV protection mechanisms</li>
                            </ul>
                        </div>

                        <div className="bg-purple-900/20 border-l-4 border-purple-500 text-purple-200 p-4 rounded-md">
                            <p className="font-bold">🔬 Alternative Approaches</p>
                            <ul className="mt-2 space-y-1 text-sm">
                                <li>• Focus on arbitrage strategies that don&apos;t harm other users</li>
                                <li>• Participate in MEV auctions through legitimate protocols</li>
                                <li>• Build MEV protection tools for traders instead</li>
                                <li>• Contribute to research on fair ordering mechanisms</li>
                                <li>• Explore positive-sum MEV opportunities</li>
                            </ul>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="mt-8 bg-gray-800/50 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold mb-3">Legal Review Required</h3>
                        <p className="text-gray-300 text-sm mb-4">
                            If you&apos;re interested in MEV-related functionality, please contact our legal team for guidance on compliant implementations that align with applicable regulations and ethical standards.
                        </p>
                        <p className="text-gray-400 text-xs">
                            This platform prioritizes user protection and regulatory compliance over maximum profit extraction.
                        </p>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
} 