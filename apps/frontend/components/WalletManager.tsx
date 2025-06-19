'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { encryptPrivateKey, decryptPrivateKey } from '@trading-bot/crypto';
import toast from 'react-hot-toast';

interface Wallet {
  id: string;
  name: string;
  address: string;
  chain: string;
  encrypted_private_key: string;
  wallet_type: string;
  is_active: boolean;
  created_at: string;
}

const walletSchema = z.object({
  name: z.string().min(1, 'Wallet name is required'),
  address: z.string().min(1, 'Wallet address is required'),
  chain: z.enum(['ethereum', 'bsc', 'solana', 'polygon', 'arbitrum', 'optimism']),
  privateKey: z.string().min(1, 'Private key is required'),
  walletType: z.enum(['imported', 'generated']).default('imported')
});

type WalletFormData = z.infer<typeof walletSchema>;

export default function WalletManager() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<{ [key: string]: string }>({});
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError
  } = useForm<WalletFormData>({
    resolver: zodResolver(walletSchema)
  });

  useEffect(() => {
    if (user) {
      fetchWallets();
    }
  }, [user]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWallets(data || []);
      
      // Fetch balances for each wallet
      if (data) {
        fetchBalances(data);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
      toast.error('Failed to fetch wallets');
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = async (walletList: Wallet[]) => {
    const newBalances: { [key: string]: string } = {};
    
    for (const wallet of walletList) {
      try {
        // This would normally call the chain client to get balance
        // For now, we'll simulate it
        newBalances[wallet.id] = '0.0'; // Placeholder
      } catch (error) {
        console.error(`Error fetching balance for wallet ${wallet.id}:`, error);
        newBalances[wallet.id] = 'Error';
      }
    }
    
    setBalances(newBalances);
  };

  const onSubmit = async (data: WalletFormData) => {
    try {
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // Encrypt the private key
      const masterKey = process.env.NEXT_PUBLIC_MASTER_ENCRYPTION_KEY;
      if (!masterKey) {
        toast.error('Encryption key not configured');
        return;
      }

      const encryptedPrivateKey = encryptPrivateKey(data.privateKey, masterKey);

      const { error } = await supabase
        .from('wallets')
        .insert({
          user_id: user.id,
          name: data.name,
          address: data.address,
          chain: data.chain,
          encrypted_private_key: encryptedPrivateKey.content,
          wallet_type: data.walletType,
          is_active: true
        });

      if (error) throw error;

      toast.success('Wallet added successfully');
      reset();
      setShowAddForm(false);
      fetchWallets();
    } catch (error) {
      console.error('Error adding wallet:', error);
      toast.error('Failed to add wallet');
    }
  };

  const deleteWallet = async (walletId: string) => {
    if (!confirm('Are you sure you want to delete this wallet?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('wallets')
        .update({ is_active: false })
        .eq('id', walletId);

      if (error) throw error;

      toast.success('Wallet deleted successfully');
      fetchWallets();
    } catch (error) {
      console.error('Error deleting wallet:', error);
      toast.error('Failed to delete wallet');
    }
  };

  const togglePrivateKeyVisibility = (walletId: string) => {
    setShowPrivateKey(prev => ({
      ...prev,
      [walletId]: !prev[walletId]
    }));
  };

  const getChainIcon = (chain: string) => {
    const icons: { [key: string]: string } = {
      ethereum: '⟠',
      bsc: '🟡',
      solana: '◎',
      polygon: '🔷',
      arbitrum: '🔵',
      optimism: '🔴'
    };
    return icons[chain] || '⚪';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Wallet Management</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Wallet
        </button>
      </div>

      {/* Add Wallet Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Wallet</h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Wallet Name</label>
                  <input
                    {...register('name')}
                    type="text"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="My Trading Wallet"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Chain</label>
                  <select
                    {...register('chain')}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="ethereum">Ethereum</option>
                    <option value="bsc">Binance Smart Chain</option>
                    <option value="solana">Solana</option>
                    <option value="polygon">Polygon</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="optimism">Optimism</option>
                  </select>
                  {errors.chain && (
                    <p className="mt-1 text-sm text-red-600">{errors.chain.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Wallet Address</label>
                  <input
                    {...register('address')}
                    type="text"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0x..."
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Private Key</label>
                  <input
                    {...register('privateKey')}
                    type="password"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Private key (will be encrypted)"
                  />
                  {errors.privateKey && (
                    <p className="mt-1 text-sm text-red-600">{errors.privateKey.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    ⚠️ Your private key will be encrypted and stored securely
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      reset();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add Wallet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wallets.map((wallet) => (
          <div key={wallet.id} className="bg-white overflow-hidden shadow rounded-lg border">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{getChainIcon(wallet.chain)}</span>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{wallet.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{wallet.chain}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteWallet(wallet.id)}
                  className="text-red-400 hover:text-red-600"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4">
                <div className="text-sm text-gray-500">Address</div>
                <div className="text-sm font-mono bg-gray-100 p-2 rounded break-all">
                  {wallet.address}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm text-gray-500">Balance</div>
                <div className="text-lg font-semibold text-gray-900">
                  {balances[wallet.id] || 'Loading...'} {wallet.chain === 'solana' ? 'SOL' : 'ETH'}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Private Key</span>
                  <button
                    onClick={() => togglePrivateKeyVisibility(wallet.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPrivateKey[wallet.id] ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="text-xs font-mono bg-gray-100 p-2 rounded break-all mt-1">
                  {showPrivateKey[wallet.id] ? (
                    // In a real app, you'd decrypt this here
                    '••••••••••••••••••••••••••••••••'
                  ) : (
                    '••••••••••••••••••••••••••••••••'
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-between text-xs text-gray-500">
                <span>Type: {wallet.wallet_type}</span>
                <span>Added: {new Date(wallet.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {wallets.length === 0 && (
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900">No wallets</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding your first wallet.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}