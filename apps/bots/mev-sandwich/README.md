# MEV Sandwich Bot

A sophisticated multi-chain MEV (Maximum Extractable Value) sandwich bot that supports Ethereum (Flashbots), Solana (Jito), and BSC (BloxRoute/NodeReal) networks.

## Overview

This bot identifies profitable sandwich trading opportunities across multiple blockchain networks and executes them using the respective MEV infrastructure:

- **Ethereum**: Flashbots for private mempool access and bundle submission
- **Solana**: Jito for transaction bundling and validator tips
- **BSC**: BloxRoute/NodeReal for MEV bundle execution

## Features

### 🚀 Multi-Chain Support
- **Ethereum**: Full Flashbots integration with bundle simulation
- **Solana**: Jito block engine integration with tip optimization
- **BSC**: BloxRoute and NodeReal MEV relay support

### 💰 Sandwich Trading
- Real-time mempool monitoring
- Opportunity detection and profitability analysis
- Front-run and back-run transaction creation
- Optimal gas/tip bidding strategies

### 🛡️ Risk Management
- Configurable profit thresholds per chain
- Maximum concurrent bundle limits
- Global kill switch for emergency stops
- Paper trading mode for safe testing

### 📊 Performance Monitoring
- Real-time bundle tracking
- Success/failure rate monitoring
- Profit/loss calculation
- Comprehensive logging and metrics

## Quick Start

### 1. Environment Setup

Copy the environment template:
```bash
cp .env.example .env
```

Configure your settings in `.env`:
```bash
# Enable paper trading for testing
PAPER_TRADING_MODE=true

# Set your private key (keep secure!)
MEV_PRIVATE_KEY=your_private_key_here

# Configure enabled chains
ENABLED_CHAINS=ethereum,bsc,solana

# Set RPC endpoints
ETH_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
BSC_RPC_URL=https://bsc-dataseed1.binance.org
SOL_RPC_URL=https://api.mainnet-beta.solana.com

# Configure MEV providers
FLASHBOTS_AUTH_KEY=your_flashbots_key
BSC_MEV_API_KEY=your_bloxroute_or_nodereal_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Bot

```bash
npm run build
```

### 4. Run the Bot

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

## Configuration

### Profit Thresholds

Set minimum profit requirements per chain:
```bash
MIN_PROFIT_ETH=0.01    # 0.01 ETH minimum
MIN_PROFIT_SOL=0.1     # 0.1 SOL minimum  
MIN_PROFIT_BNB=0.05    # 0.05 BNB minimum
```

### Risk Parameters

```bash
MAX_CONCURRENT_BUNDLES=5    # Maximum simultaneous bundles
MAX_BASE_FEE=100           # Maximum base fee (gwei)
MAX_TIP_LAMPORTS=100000    # Maximum Solana tip
```

### Chain Selection

Enable/disable specific chains:
```bash
ENABLED_CHAINS=ethereum,bsc    # Only Ethereum and BSC
ENABLED_CHAINS=solana          # Only Solana
ENABLED_CHAINS=ethereum,bsc,solana  # All chains
```

## MEV Provider Configuration

### Flashbots (Ethereum)

```bash
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
FLASHBOTS_AUTH_KEY=your_flashbots_private_key
MAX_BASE_FEE=100
MAX_PRIORITY_FEE=5
```

**Setup Requirements:**
1. Generate a Flashbots auth key (private key)
2. Build searcher reputation through successful bundles
3. Consider using Flashbots Protect for failed transactions

### Jito (Solana)

```bash
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
JITO_TIP_ACCOUNT=Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY
MAX_TIP_LAMPORTS=100000
```

**Setup Requirements:**
1. Ensure sufficient SOL balance for tips
2. Configure preferred validators if needed
3. Monitor tip market for optimal bidding

### BloxRoute (BSC)

```bash
BSC_MEV_PROVIDER=bloxroute
BSC_MEV_API_KEY=your_bloxroute_api_key
BSC_MEV_ENDPOINT=https://api.bloxroute.com/v1
```

### NodeReal (BSC Alternative)

```bash
BSC_MEV_PROVIDER=nodereal
BSC_MEV_API_KEY=your_nodereal_api_key
BSC_MEV_ENDPOINT=https://open-platform.nodereal.io/your-api-key
```

## Bot Architecture

### Core Components

1. **MevSandwichBot**: Main orchestrator class
2. **FlashbotsClient**: Ethereum MEV integration
3. **JitoClient**: Solana MEV integration
4. **BscMevClient**: BSC MEV integration

### Opportunity Detection Flow

```
1. Monitor mempool for victim transactions
2. Analyze transaction for sandwich potential
3. Calculate profitability including gas costs
4. Create front-run and back-run transactions
5. Bundle transactions for atomic execution
6. Submit bundle to appropriate MEV infrastructure
7. Monitor for inclusion and calculate actual profit
```

### Bundle Structure

**Ethereum (Flashbots)**:
```
[Front-run TX] → [Victim TX] → [Back-run TX]
```

**Solana (Jito)**:
```
[Front-run TX + Tip] → [Victim TX] → [Back-run TX]
```

**BSC (BloxRoute/NodeReal)**:
```
[Front-run TX] → [Victim TX] → [Back-run TX]
```

## Safety Features

### Paper Trading Mode

Enable safe testing without real execution:
```bash
PAPER_TRADING_MODE=true
```

In paper trading mode:
- Opportunities are detected and analyzed
- Bundles are created but not submitted
- All calculations and logging work normally
- No real funds are risked

### Global Kill Switch

Emergency stop functionality:
```bash
GLOBAL_KILL_SWITCH=true
```

When activated:
- Bot refuses to start
- All opportunity detection stops
- Existing bundles complete normally
- Useful for market emergencies

### Risk Limits

- **Concurrent Bundle Limit**: Prevents over-exposure
- **Profit Thresholds**: Ensures minimum profitability
- **Gas Price Caps**: Prevents excessive fee bidding
- **Position Size Limits**: Controls maximum trade sizes

## Monitoring and Logging

### Real-time Status

The bot provides comprehensive status monitoring:
```typescript
const status = bot.getStatus();
console.log(status);
// Output:
{
  isRunning: true,
  enabledChains: ['ethereum', 'bsc', 'solana'],
  activeBundles: 2,
  paperTradingMode: false,
  clientStatuses: {
    flashbots: true,
    jito: true,
    bscMev: true
  },
  performanceMetrics: {
    flashbots: {
      totalBundles: 150,
      includedBundles: 45,
      inclusionRate: 30,
      totalProfit: "2.5",
      averageProfit: "0.055"
    }
  }
}
```

### Logging

Structured logging with multiple levels:
```bash
LOG_LEVEL=info  # error, warn, info, debug
```

Log files include:
- Bundle creation and submission
- Success/failure tracking
- Profit/loss calculation
- Error diagnostics
- Performance metrics

## Performance Optimization

### Gas Bidding Strategies

**Ethereum**: Dynamic base fee + priority fee calculation
```typescript
const optimalBid = await flashbotsClient.calculateOptimalGasBid(opportunity);
```

**Solana**: Network congestion-based tip optimization
```typescript
const optimalTip = await jitoClient.calculateOptimalTip(opportunity);
```

**BSC**: Competitive gas price with MEV premium
```typescript
const optimalGasPrice = await bscMevClient.getOptimalGasPrice();
```

### Bundle Timing

- **Ethereum**: Target next block (12-second window)
- **Solana**: Target next slot (400ms window)
- **BSC**: Target next block (3-second window)

### Success Rate Optimization

1. **Reputation Building**: Consistent bundle submission improves inclusion rates
2. **Gas Bidding**: Competitive but profitable gas/tip amounts
3. **Bundle Size**: Optimal transaction count per bundle
4. **Timing**: Submit bundles at optimal block/slot timing

## Troubleshooting

### Common Issues

**Bundle Not Included**:
- Increase gas price/tip amount
- Check network congestion
- Verify bundle validity
- Review timing windows

**Low Profitability**:
- Adjust profit thresholds
- Review gas bidding strategy
- Analyze market conditions
- Consider different opportunity types

**Connection Errors**:
- Verify RPC endpoints
- Check API keys and permissions
- Review network connectivity
- Monitor MEV provider status

### Debug Mode

Enable detailed debugging:
```bash
DEBUG_MODE=true
LOG_LEVEL=debug
```

This provides:
- Detailed transaction analysis
- Bundle simulation results
- Timing information
- Network condition data

## Security Considerations

### Private Key Management

- Use hardware wallets for production
- Never commit private keys to version control
- Consider using encrypted keystores
- Implement key rotation policies

### Network Security

- Use secure RPC endpoints
- Implement rate limiting
- Monitor for unusual activity
- Use VPN for additional privacy

### Operational Security

- Run in isolated environments
- Monitor system resources
- Implement alerting systems
- Regular security audits

## API Reference

### FlashbotsClient

```typescript
// Create and submit Ethereum bundle
const opportunity: SandwichOpportunity = { /* ... */ };
const bundle = await flashbotsClient.createSandwichBundle(opportunity);
await flashbotsClient.submitBundle(bundle.id);

// Monitor performance
const metrics = flashbotsClient.getPerformanceMetrics();
```

### JitoClient

```typescript
// Create and submit Solana bundle
const opportunity: SolanaSandwichOpportunity = { /* ... */ };
const bundle = await jitoClient.createSandwichBundle(opportunity);
const result = await jitoClient.submitBundle(bundle.id);
```

### BscMevClient

```typescript
// Create and submit BSC bundle
const opportunity: BscSandwichOpportunity = { /* ... */ };
const bundle = await bscMevClient.createSandwichBundle(opportunity);
await bscMevClient.submitBundle(bundle.id);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add comprehensive tests
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Implement comprehensive error handling
- Add detailed logging
- Include unit and integration tests
- Document all public APIs

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

**Important**: This software is for educational and research purposes. MEV trading involves significant financial risks:

- **Market Risk**: Cryptocurrency markets are highly volatile
- **Technical Risk**: Smart contract and execution risks
- **Regulatory Risk**: MEV activities may face future regulation
- **Competition Risk**: MEV is highly competitive with thin margins

**Use at your own risk. The authors are not responsible for any financial losses.**

## Resources

### Documentation
- [Flashbots Documentation](https://docs.flashbots.net/)
- [Jito Documentation](https://jito-foundation.gitbook.io/jito/)
- [BloxRoute Documentation](https://bloxroute.com/documentation/)
- [NodeReal Documentation](https://docs.nodereal.io/)

### Community
- [Flashbots Discord](https://discord.gg/flashbots)
- [Jito Discord](https://discord.gg/jito)
- [MEV Research Forum](https://collective.flashbots.net/)

### Additional Tools
- [Flashbots Protect](https://protect.flashbots.net/) - Failed transaction protection
- [MEV-Boost](https://boost.flashbots.net/) - Proposer-builder separation
- [Jito Tip Calculator](https://www.jito.wtf/) - Optimal tip calculation