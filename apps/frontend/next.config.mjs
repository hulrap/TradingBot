import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@trading-bot/ui",
    "@trading-bot/types",
    "@trading-bot/crypto",
    "@trading-bot/chain-client",
    "@trading-bot/risk-management",
    "@trading-bot/paper-trading"
  ],
  webpack: (config, { isServer }) => {
    // Add custom webpack resolve aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve('./src'),
    };
    
    // Handle Solana and crypto packages for browser compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
        // Ignore Solana packages on client side
        '@solana/web3.js': false,
      };
    }
    
    // Mark Solana packages as external for server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@solana/web3.js': 'commonjs @solana/web3.js'
      });
    }
    
    return config;
  },
};

export default nextConfig; 