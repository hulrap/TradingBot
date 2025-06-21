# Analysis: apps/bots/mev-sandwich/src/profit-calculator.ts

## Overview
This file implements a sophisticated profit calculation system for MEV sandwich attacks, containing 801 lines of complex financial calculations, price oracle integration, and gas cost estimation. It represents the most advanced financial calculation system in the codebase.

## Architectural Misalignment Analysis

### 1. **Financial Calculation Complexity Explosion**
- **Issue**: Single 801-line file handling all profit calculation logic
- **Impact**: Violates single responsibility principle with massive financial complexity
- **Misalignment**: Should be decomposed into specialized calculation services

### 2. **Price Oracle Integration Duplication**
- **Issue**: Custom price oracle implementation instead of using shared services
- **Impact**: Price data management without shared infrastructure
- **Misalignment**: Should use shared price oracle from chain-client package

### 3. **Multi-Chain Gas Calculation Complexity**
- **Issue**: Different gas calculation methods for each chain in single class
- **Impact**: Chain-specific gas logic without proper abstraction
- **Misalignment**: Should use chain-specific gas calculation services

### 4. **Cache Management Strategy Issues**
- **Issue**: Multiple Map-based caches without proper cache management
- **Impact**: Memory management issues without cache strategies
- **Misalignment**: Should use shared caching infrastructure

### 5. **Floating-Point Financial Arithmetic**
- **Issue**: Uses parseFloat and JavaScript numbers for financial calculations
- **Impact**: Potential precision loss in critical financial operations
- **Misalignment**: Should use precise decimal arithmetic libraries

### 6. **API Integration Hardcoding**
- **Issue**: Hardcoded API endpoints for CoinGecko, Etherscan, BSCScan
- **Impact**: Inflexible API integration without configuration management
- **Misalignment**: Should use configurable API integration services

### 7. **Sandwich Attack Simulation Logic**
- **Issue**: Custom AMM math implementation for swap simulation
- **Impact**: Complex AMM calculations without shared utilities
- **Misalignment**: Should use shared AMM calculation services

### 8. **Risk Calculation Integration**
- **Issue**: Risk scoring logic mixed with profit calculations
- **Impact**: Risk assessment without dedicated risk management
- **Misalignment**: Should use shared risk calculation services

### 9. **Real-Time Data Fetching Complexity**
- **Issue**: Multiple concurrent API calls for price and gas data
- **Impact**: Complex data fetching without rate limiting or error handling
- **Misalignment**: Should use shared data fetching infrastructure

### 10. **Configuration Management Issues**
- **Issue**: Configuration interfaces defined within calculator
- **Impact**: Configuration logic mixed with calculation logic
- **Misalignment**: Should use centralized configuration management

### 11. **MEV Optimization Algorithms**
- **Issue**: Basic optimization using simple ratio testing
- **Impact**: Suboptimal MEV extraction without sophisticated algorithms
- **Misalignment**: Should use advanced optimization algorithms

### 12. **Gas Price Estimation Complexity**
- **Issue**: Different gas estimation methods for each network
- **Impact**: Network-specific gas logic without standardization
- **Misalignment**: Should use unified gas estimation services

### 13. **Token Price Validation Gaps**
- **Issue**: Limited price validation and staleness checking
- **Impact**: Potential use of stale or invalid price data
- **Misalignment**: Should use robust price validation services

### 14. **Slippage Calculation Logic**
- **Issue**: Custom slippage calculation implementation
- **Impact**: Slippage calculations without shared utilities
- **Misalignment**: Should use shared slippage calculation services

### 15. **Error Handling Inconsistency**
- **Issue**: Try-catch blocks with different error handling patterns
- **Impact**: Inconsistent error handling for financial operations
- **Misalignment**: Should use standardized error handling

### 16. **USD Value Calculation Complexity**
- **Issue**: Manual USD conversion throughout calculations
- **Impact**: Currency conversion without shared utilities
- **Misalignment**: Should use shared currency conversion services

### 17. **Confidence Scoring Implementation**
- **Issue**: Custom confidence scoring algorithm
- **Impact**: Confidence calculations without shared analytics
- **Misalignment**: Should use shared scoring infrastructure

### 18. **Pool Reserve Calculation Logic**
- **Issue**: Simplified constant product formula implementation
- **Impact**: Basic AMM math without DEX-specific considerations
- **Misalignment**: Should use specialized AMM calculation libraries

### 19. **Optimization Result Aggregation**
- **Issue**: Complex result aggregation and comparison logic
- **Impact**: Result processing without standardized patterns
- **Misalignment**: Should use standardized result processing

### 20. **Network Fee Structure Assumptions**
- **Issue**: Hardcoded gas estimates and fee structures
- **Impact**: Static fee assumptions without dynamic network data
- **Misalignment**: Should use dynamic fee estimation services

### 21. **Price Feed Backup Strategy**
- **Issue**: Basic fallback logic for price oracle failures
- **Impact**: Limited resilience for price data failures
- **Misalignment**: Should use robust price feed redundancy

### 22. **Profitability Threshold Management**
- **Issue**: Hardcoded profitability calculations and thresholds
- **Impact**: Inflexible profitability assessment
- **Misalignment**: Should use configurable profitability strategies

### 23. **Market Impact Calculation**
- **Issue**: Simplified market impact calculations
- **Impact**: Basic market impact without sophisticated modeling
- **Misalignment**: Should use advanced market impact models

### 24. **Historical Data Integration**
- **Issue**: No historical price or performance data integration
- **Impact**: Limited context for profit calculations
- **Misalignment**: Should use historical data for better estimates

### 25. **Testing and Validation Complexity**
- **Issue**: Complex financial logic difficult to test comprehensively
- **Impact**: Financial calculations without proper validation
- **Misalignment**: Should be decomposed for better testability

## Recommendations

1. **Decompose Financial Architecture**: Split into specialized calculation services
2. **Use Precise Arithmetic**: Replace floating-point with decimal libraries
3. **Integrate Shared Price Oracles**: Use chain-client price services
4. **Standardize Gas Calculations**: Use unified gas estimation services
5. **Implement Robust Caching**: Use shared caching infrastructure
6. **Add Comprehensive Validation**: Use financial data validation services
7. **Use Advanced Optimization**: Implement sophisticated MEV algorithms
8. **Standardize Error Handling**: Use consistent financial error patterns
9. **Add Historical Analysis**: Integrate historical performance data
10. **Improve API Integration**: Use configurable API management

## Summary
The profit calculator represents highly sophisticated financial calculation capabilities but suffers from monolithic architecture, potential precision issues with floating-point arithmetic, and extensive duplication of functionality available in shared packages. While functionally comprehensive with advanced features like multi-oracle price feeds, gas optimization, and risk scoring, it would benefit significantly from decomposition into focused financial services and better integration with shared infrastructure components.