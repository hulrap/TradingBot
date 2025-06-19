'use client';

import { Button } from "@trading-bot/ui";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import TradeHistory from "../../components/TradeHistory";

const BotCard = ({ name, description, href }: { name: string, description: string, href: string }) => {
  const router = useRouter();
  return (
    <div className="bg-gray-800/50 rounded-lg p-6 shadow-lg hover:bg-gray-700/50 transition-colors">
      <h3 className="text-xl font-semibold mb-2">{name}</h3>
      <p className="text-gray-400 mb-4">{description}</p>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-green-400">● Active</span>
        <Button onClick={() => router.push(href)}>Configure</Button>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold">Trading Bot Dashboard</h1>
        <Button onClick={handleLogout}>Logout</Button>
      </header>

      <main>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <BotCard 
            name="Arbitrage Bot" 
            description="Exploits price differences across DEXs. Currently monitoring ETH/DAI." 
            href="/dashboard/arbitrage"
          />
          <BotCard 
            name="Copy-Trading Bot" 
            description="Mirrors the trades of a specified wallet address."
            href="/dashboard/copy-trader"
          />
          <BotCard 
            name="Sandwich Bot (Advanced)" 
            description="Executes MEV attacks on pending DEX transactions." 
            href="/dashboard/sandwich"
          />
        </div>

        <div className="mt-12 bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Performance Analytics</h2>
            <TradeHistory />
        </div>
      </main>
    </div>
  );
} 