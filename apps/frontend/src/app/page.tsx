'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Bot, 
  TrendingUp, 
  Shield, 
  Zap, 
  Globe, 
  BarChart3, 
  Users,
  CheckCircle,
  Star
} from 'lucide-react';

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

interface Statistic {
  value: string;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
}

const FEATURES: FeatureCard[] = [
  {
    icon: <Bot className="h-8 w-8 text-blue-400" />,
    title: "Automated Trading Bots",
    description: "Advanced arbitrage, copy trading, and MEV strategies with real-time execution",
    badge: "Popular"
  },
  {
    icon: <Shield className="h-8 w-8 text-green-400" />,
    title: "Enterprise Security",
    description: "Bank-grade encryption, hardware wallet support, and secure key management",
    badge: "Secure"
  },
  {
    icon: <TrendingUp className="h-8 w-8 text-purple-400" />,
    title: "Multi-Chain Support",
    description: "Trade across Ethereum, Polygon, Arbitrum, BSC, and more with unified interface"
  },
  {
    icon: <Zap className="h-8 w-8 text-yellow-400" />,
    title: "Lightning Fast",
    description: "Sub-second execution times with premium RPC connections and MEV protection"
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-indigo-400" />,
    title: "Real-time Analytics",
    description: "Advanced performance tracking, risk metrics, and portfolio optimization tools"
  },
  {
    icon: <Globe className="h-8 w-8 text-cyan-400" />,
    title: "Global DEX Access",
    description: "Connect to 50+ decentralized exchanges with intelligent routing algorithms"
  }
];

const STATISTICS: Statistic[] = [
  { value: "$2.4M+", label: "Total Volume Traded", trend: 'up' },
  { value: "15,000+", label: "Active Strategies", trend: 'up' },
  { value: "99.9%", label: "Uptime", trend: 'neutral' },
  { value: "24/7", label: "Support Available", trend: 'neutral' }
];

export default function Page() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setRedirecting(true);
        // Add small delay for smooth UX
        setTimeout(() => {
          router.replace('/dashboard');
        }, 800);
      } else {
        // Show landing page for unauthenticated users
        setTimeout(() => {
          setShowLanding(true);
        }, 500);
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 absolute top-0"></div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Trading Bot Platform</h2>
            <p className="text-gray-400">Initializing secure connection...</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirecting to dashboard for authenticated users
  if (isAuthenticated && redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <CheckCircle className="h-16 w-16 text-green-400" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!</h2>
            <p className="text-gray-400">Redirecting to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Landing page for unauthenticated users
  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white transition-opacity duration-500 ${showLanding ? 'opacity-100' : 'opacity-0'}`}>
      {/* Navigation Header */}
      <nav className="border-b border-gray-800/50 backdrop-blur-sm bg-gray-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-blue-400" />
              <span className="text-xl font-bold">TradingBot Pro</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push('/login')}
                variant="ghost"
                className="text-gray-300 hover:text-white"
              >
                Login
              </Button>
              <Button
                onClick={() => router.push('/login')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 bg-blue-900/50 border-blue-500/50 text-blue-300">
            <Star className="h-3 w-3 mr-1" />
            Enterprise-Grade Trading Platform
          </Badge>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-transparent">
            Automated Trading
            <br />
            <span className="text-blue-400">Made Simple</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Professional-grade trading bots with advanced strategies, multi-chain support, 
            and institutional security. Start trading smarter today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button
              size="lg"
              onClick={() => router.push('/login')}
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-4"
            >
              Start Trading Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/login')}
              className="border-gray-600 hover:bg-gray-800 text-lg px-8 py-4"
            >
              View Demo
            </Button>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
            {STATISTICS.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose <span className="text-blue-400">TradingBot Pro</span>?
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Built for traders who demand the best. Our platform combines cutting-edge technology 
              with institutional-grade security and performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, index) => (
              <Card key={index} className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    {feature.icon}
                    {feature.badge && (
                      <Badge variant="outline" className="text-xs bg-blue-900/50 border-blue-500/50 text-blue-300">
                        {feature.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start Trading?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of traders who trust our platform for their automated trading needs.
          </p>
          
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 md:p-12">
            <h3 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              Get Started in Minutes
            </h3>
            <p className="text-blue-100 mb-6 text-lg">
              Create your account, connect your wallet, and start trading with professional-grade bots.
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/login')}
              className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4 font-semibold"
            >
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Bot className="h-6 w-6 text-blue-400" />
            <span className="text-lg font-semibold">TradingBot Pro</span>
          </div>
          <p className="text-gray-400 text-sm">
            © 2024 TradingBot Pro. Professional automated trading platform.
          </p>
          <div className="flex justify-center gap-6 mt-4 text-sm text-gray-500">
            <span>Enterprise Security</span>
            <span>•</span>
            <span>24/7 Support</span>
            <span>•</span>
            <span>Multi-Chain</span>
          </div>
        </div>
      </footer>
    </div>
  );
} 