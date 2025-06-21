# Analysis: apps/bots/mev-sandwich/src/sandwich-detector.ts

## Overview
This file implements a universal multi-chain sandwich opportunity detector, containing nearly 1200 lines of complex transaction analysis, DEX identification, token quality assessment, and profitability calculations. It represents the most sophisticated opportunity detection system in the codebase.

## Architectural Misalignment Analysis

### 1. **Multi-Chain Detection Monolith**
- **Issue**: Single 1190-line file handling Ethereum, BSC, and Solana detection
- **Impact**: Violates single responsibility principle with massive complexity
- **Misalignment**: Should be decomposed into chain-specific detection services

### 2. **DEX Router Hardcoding**
- **Issue**: DEX router addresses hardcoded for each chain
- **Impact**: Inflexible DEX support and difficult maintenance
- **Misalignment**: Should use shared DEX registry from chain-client

### 3. **Custom Transaction Decoding**
- **Issue**: Manual ABI decoding for different DEX types
- **Impact**: Complex decoding logic without shared utilities
- **Misalignment**: Should use shared transaction decoding services

### 4. **Token Quality Assessment Complexity**
- **Issue**: Custom token quality scoring algorithm
- **Impact**: Token evaluation logic without shared token services
- **Misalignment**: Should use shared token validation and quality services

### 5. **Pool Data Management Duplication**
- **Issue**: Custom pool information caching and fetching
- **Impact**: Pool data management without shared infrastructure
- **Misalignment**: Should use shared pool data services from chain-client

### 6. **Profit Calculation Integration**
- **Issue**: Complex profit calculation logic embedded in detector
- **Impact**: Financial calculations without shared profit services
- **Misalignment**: Should use dedicated profit calculation service

### 7. **Mempool Monitoring Implementation**
- **Issue**: Custom mempool monitoring for each chain
- **Impact**: Chain-specific monitoring without shared infrastructure
- **Misalignment**: Should use shared mempool monitoring from chain-client

### 8. **Cache Management Strategy**
- **Issue**: Multiple Map-based caches without proper management
- **Impact**: Memory management issues without cache strategies
- **Misalignment**: Should use shared caching infrastructure

### 9. **Event-Driven Architecture Inconsistency**
- **Issue**: Uses EventEmitter but with mixed patterns
- **Impact**: Inconsistent event handling across chains
- **Misalignment**: Should standardize event patterns

### 10. **Configuration Management Complexity**
- **Issue**: Complex configuration interface with chain-specific settings
- **Impact**: Configuration management without proper validation
- **Misalignment**: Should use schema-validated configuration management

### 11. **Slippage Calculation Logic**
- **Issue**: Custom slippage and price impact calculations
- **Impact**: Financial risk calculations without shared utilities
- **Misalignment**: Should use shared slippage calculation services

### 12. **MEV Score Calculation**
- **Issue**: Custom MEV scoring algorithm
- **Impact**: Scoring logic without shared MEV analytics
- **Misalignment**: Should use shared MEV scoring infrastructure

### 13. **Provider Management Complexity**
- **Issue**: Different provider handling for each chain
- **Impact**: Provider management without abstraction
- **Misalignment**: Should use shared provider abstraction

### 14. **WebSocket Connection Management**
- **Issue**: Custom WebSocket management without resilience
- **Impact**: Connection handling without proper error recovery
- **Misalignment**: Should use shared real-time infrastructure

### 15. **Solana Transaction Analysis**
- **Issue**: Complex Solana instruction parsing logic
- **Impact**: Solana-specific complexity in generic detector
- **Misalignment**: Should delegate to Solana-specific services

### 16. **Token Blacklist Management**
- **Issue**: Simple array-based blacklist checking
- **Impact**: Basic blacklist management without dynamic updates
- **Misalignment**: Should use shared token security services

### 17. **Path Decoding Complexity**
- **Issue**: Custom Uniswap V3 path decoding implementation
- **Impact**: Complex decoding logic without proper validation
- **Misalignment**: Should use shared path decoding utilities

### 18. **Error Handling Fragmentation**
- **Issue**: Try-catch blocks throughout without centralized handling
- **Impact**: Inconsistent error handling and recovery
- **Misalignment**: Should use centralized error handling system

### 19. **Performance Monitoring Gaps**
- **Issue**: Basic statistics without comprehensive performance tracking
- **Impact**: Limited visibility into detection performance
- **Misalignment**: Should use shared metrics infrastructure

### 20. **Chain Identification Logic**
- **Issue**: Chain identification scattered throughout code
- **Impact**: Chain-specific logic without proper abstraction
- **Misalignment**: Should use chain abstraction layer

### 21. **Deadline Calculation Simplicity**
- **Issue**: Basic deadline calculation without sophisticated timing
- **Impact**: Suboptimal opportunity timing
- **Misalignment**: Should use advanced timing strategies

### 22. **Pool Reserve Calculation**
- **Issue**: Simplified constant product formula usage
- **Impact**: Basic AMM calculations without DEX-specific logic
- **Misalignment**: Should use specialized AMM calculation services

### 23. **Token Metadata Fetching**
- **Issue**: Custom token metadata fetching with placeholder data
- **Impact**: Incomplete token data affecting opportunity quality
- **Misalignment**: Should use shared token metadata services

### 24. **Network-Specific Optimizations**
- **Issue**: Generic patterns without chain-specific optimizations
- **Impact**: Suboptimal performance for each chain
- **Misalignment**: Should use chain-optimized detection strategies

### 25. **Testing and Mockability Issues**
- **Issue**: Monolithic structure makes unit testing extremely difficult
- **Impact**: Poor testability for critical detection logic
- **Misalignment**: Should be decomposed for better testability

## Recommendations

1. **Decompose Multi-Chain Architecture**: Create chain-specific detection services
2. **Use Shared DEX Registry**: Leverage shared DEX configuration and utilities
3. **Centralize Transaction Decoding**: Use shared transaction parsing services
4. **Implement Token Quality Services**: Use shared token validation and scoring
5. **Leverage Pool Data Infrastructure**: Use shared pool data management
6. **Separate Profit Calculations**: Extract profit logic to dedicated service
7. **Use Shared Mempool Monitoring**: Leverage chain-client mempool infrastructure
8. **Standardize Cache Management**: Use shared caching infrastructure
9. **Implement Centralized Error Handling**: Use consistent error patterns
10. **Add Comprehensive Monitoring**: Integrate with shared observability

## Summary
The sandwich detector represents highly sophisticated multi-chain opportunity detection capabilities but suffers from monolithic architecture, complex state management, and extensive duplication of functionality available in shared packages. While functionally comprehensive with advanced features like multi-DEX support, token quality assessment, and profitability analysis, it would benefit significantly from decomposition into chain-specific services and better integration with shared infrastructure components.