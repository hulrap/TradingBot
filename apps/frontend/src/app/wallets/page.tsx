'use client';

import { useState } from 'react';
import { Button } from '@trading-bot/ui';

export default function WalletsPage() {
  const [privateKey, setPrivateKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!privateKey) {
        setError('Private key cannot be empty.');
        return;
    }

    const response = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey }),
    });

    const result = await response.json();

    if (response.ok) {
        setMessage(result.message);
        setPrivateKey(''); // Clear the key from state after submission
    } else {
        setError(result.message || 'An unexpected error occurred.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold">Wallet Management</h1>
        <p className="text-gray-400">Add or update the private key for your trading wallet.</p>
      </header>

      <div className="max-w-2xl mx-auto bg-gray-800/50 p-8 rounded-lg shadow-lg">
        <div className="bg-yellow-900/50 border-l-4 border-yellow-400 text-yellow-200 p-4 rounded-md mb-6" role="alert">
          <p className="font-bold">Security Warning</p>
          <p>Your private key grants full control over your funds. This key will be encrypted on our server and is never stored in your browser. However, always be cautious. Ensure you are on the correct website and that your connection is secure (HTTPS).</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="privateKey" className="block text-sm font-medium text-gray-300 mb-2">
              Wallet Private Key
            </label>
            <input
              type="password" // Use password type to obscure input
              id="privateKey"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0x..."
              required
            />
          </div>

          {message && <p className="text-green-400 text-sm text-center mb-4">{message}</p>}
          {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit">Save Securely</Button>
          </div>
        </form>
      </div>
    </div>
  );
} 