# @trading-bot/types

> Comprehensive type definitions for trading bot platform with multi-chain support

## Overview

The `@trading-bot/types` package serves as the single source of truth for all type definitions across the trading bot platform. It provides strongly-typed interfaces for blockchain operations, trading strategies, data management, monitoring, and system configuration.

## Features

- **Multi-chain Support**: Type definitions for 9 supported blockchains (Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Fantom, Solana, Base)
- **Advanced Trading Strategies**: Types for arbitrage, MEV, copy trading, yield farming, grid trading, and DCA bots
- **Comprehensive Data Types**: Price feeds, gas optimization, mempool monitoring, and DEX integration
- **Enterprise-grade Monitoring**: Metrics, alerts, analytics, and system health monitoring
- **Extensive Configuration**: Bot configs, system configs, user preferences, and security settings
- **Type Safety**: Fully typed with TypeScript for enhanced developer experience
- **Modular Architecture**: Organized into logical modules for easy consumption

## Installation

```bash
npm install @trading-bot/types
# or
yarn add @trading-bot/types
# or
pnpm add @trading-bot/types
```

## Package Structure

```
src/
├── blockchain/           # Blockchain and chain abstraction types
│   ├── chain.ts         # Supported chains, configurations, capabilities
│   ├── addresses.ts     # Address validation, token info, security
│   └── transactions.ts  # Transaction types, gas, MEV protection
├── trading/             # Trading operations and strategies
│   ├── orders.ts        # Order types, execution, validation
│   ├── routes.ts        # Route discovery, optimization algorithms
│   ├── opportunities.ts # Arbitrage, MEV, liquidation opportunities
│   └── positions.ts     # Position tracking, portfolio management
├── data/                # Data sources and aggregation
│   ├── prices.ts        # Multi-source price aggregation, OHLCV
│   ├── gas.ts           # Gas tracking, optimization, prediction
│   ├── mempool.ts       # Mempool monitoring, MEV detection
│   └── dex.ts           # DEX configurations, pools, quotes
├── config/              # Configuration types
│   ├── bot-configs.ts   # Bot-specific configurations
│   ├── system-configs.ts # System-wide settings
│   └── user-configs.ts  # User preferences and settings
├── monitoring/          # Monitoring and analytics
│   ├── alerts.ts        # Alert system, notifications
│   ├── metrics.ts       # Performance metrics, system health
│   └── analytics.ts     # Trading analytics, reporting
└── index.ts             # Main export file
```

## Usage Examples

### Basic Types

```typescript
import { 
  SupportedChain, 
  Address, 
  BotConfig,
  ArbitrageBotConfig 
} from '@trading-bot/types';

// Chain operations
const chain: SupportedChain = 'ethereum';
const tokenAddress: Address = '0xA0b86a33E6417c8d53F74a3aF1fb7C8f77e1B83B';

// Bot configuration
const arbitrageBot: ArbitrageBotConfig = {
  id: 'arb-001',
  name: 'ETH-BSC Arbitrage',
  type: 'arbitrage',
  status: 'active',
  // ... other required fields
};
```

### Trading Operations

```typescript
import { 
  Order, 
  OrderType, 
  SwapRoute,
  OpportunityType 
} from '@trading-bot/types';

// Create a market order
const order: Order = {
  id: 'order-123',
  type: 'market',
  side: 'buy',
  tokenIn: '0x...',
  tokenOut: '0x...',
  amountIn: '1000000000000000000', // 1 ETH
  // ... other fields
};

// Route optimization
const route: SwapRoute = {
  id: 'route-456',
  steps: [/* route steps. */],
  quality: {
    score: 95,
    priceImpact: 0.02,
    gasEstimate: '150000'
  },
  // ... other fields
};
```

### Price Data

```typescript
import { 
  AggregatedPrice, 
  PriceSource,
  Candlestick 
} from '@trading-bot/types';

// Aggregated price from multiple sources
const price: AggregatedPrice = {
  token: {/* token info. */},
  priceUsd: '2500.50',
  confidence: 'high',
  timestamp: Date.now(),
  sources: [/* contributing price points. */],
  // ... other fields
};

// Historical candlestick data
const candle: Candlestick = {
  timestamp: Date.now(),
  interval: '1h',
  open: '2490.00',
  high: '2510.00',
  low: '2485.00',
  close: '2505.00',
  volume: '1500000',
  // ... other fields
};
```

### Monitoring and Alerts

```typescript
import { 
  Alert, 
  SystemMetrics,
  TradingMetrics 
} from '@trading-bot/types';

// System alert
const alert: Alert = {
  id: 'alert-789',
  title: 'High Gas Prices Detected',
  severity: 'warning',
  category: 'gas',
  status: 'active',
  // ... other fields
};

// System performance metrics
const systemMetrics: SystemMetrics = {
  timestamp: Date.now(),
  cpu: { usage: 45.2, cores: 8, /* .... */ },
  memory: { used: 8589934592, total: 17179869184, /* .... */ },
  // ... other metrics
};
```

## Type Categories

### Blockchain Types
- **Chain Management**: Multi-chain configuration and capabilities
- **Address Handling**: Validation, formatting, and security assessment
- **Transaction Processing**: Gas optimization, MEV protection, simulation

### Trading Types
- **Order Management**: Market, limit, stop orders with advanced execution
- **Route Optimization**: Multi-DEX routing with Livshits algorithm support
- **Opportunity Detection**: Arbitrage, MEV, liquidation opportunities
- **Portfolio Management**: Position tracking and risk management

### Data Types
- **Price Aggregation**: Multi-source price feeds with quality assessment
- **Gas Tracking**: Real-time gas price monitoring and optimization
- **Mempool Analysis**: Transaction classification and MEV detection
- **DEX Integration**: Pool information, quotes, and aggregation

### Configuration Types
- **Bot Configurations**: Strategy-specific settings and parameters
- **System Configuration**: Network, security, and infrastructure settings
- **User Preferences**: Personalization, risk parameters, notifications

### Monitoring Types
- **Alert System**: Multi-channel notifications and escalation
- **Metrics Collection**: Performance monitoring and system health
- **Analytics**: Trading statistics and business intelligence

## Advanced Features

### Multi-Chain Support
```typescript
import { SUPPORTED_CHAINS, ChainConfig } from '@trading-bot/types';

// All supported chains
console.log(SUPPORTED_CHAINS); // ['ethereum', 'bsc', 'polygon', ...]

// Chain-specific configuration
const chainConfig: ChainConfig = {
  id: 'ethereum',
  name: 'Ethereum',
  family: 'evm',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  // ... comprehensive chain settings
};
```

### Type Safety Utilities
```typescript
import { 
  isSupportedChain, 
  isValidAddressForChain,
  formatAmount 
} from '@trading-bot/types';

// Type guards
if (isSupportedChain('ethereum')) {
  // TypeScript knows this is a valid chain
}

// Address validation
const isValid = isValidAddressForChain(address, 'ethereum');

// Amount formatting
const formatted = formatAmount('1500000000000000000'); // "1.5000"
```

## Contributing

This package is part of the trading bot platform monorepo. When adding new types:

1. Follow the existing naming conventions
2. Add comprehensive JSDoc comments
3. Include examples in complex interfaces
4. Update this README if adding new modules
5. Ensure all types are exported in `index.ts`

## Versioning

This package follows semantic versioning. Breaking changes to types will result in major version bumps.

## License

MIT - See LICENSE file for details
