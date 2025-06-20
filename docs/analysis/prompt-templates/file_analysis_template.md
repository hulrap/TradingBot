# File Analysis Template for Development Codebase - Background Agent Instructions

## Objective
Systematically analyze each file in the development codebase to identify what needs to be implemented, fixed, or improved before production release. Treat this as a normal development assessment, not a security emergency.

## Process
1. Read one file completely
2. Create individual analysis file named: `[folder_path_with_underscores]_[filename].md`
3. Analyze across 12 categories
4. **Use web search when needed** for current documentation
5. Update running summary
6. Move to next file

## When to Use Web Search for Current Documentation

**CRITICAL**: Your knowledge cutoff is 2024. For rapidly evolving platforms, ALWAYS web search for current documentation:

### **DEX/DeFi Protocols** (Search for latest docs)
- **Uniswap V3/V4**: Concentrated liquidity formulas, fee structures
- **PancakeSwap**: V2 vs V3 implementations, current router addresses
- **SushiSwap**: Current routing, fee structures
- **1inch**: Latest API endpoints, supported chains
- **Jupiter (Solana)**: Current aggregation API, supported DEXes
- **Raydium**: Latest pool types, AMM formulas

### **MEV/Block Building** (Search for latest implementations)
- **Jito**: Current bundle submission format, fee structure, supported validators
- **Flashbots**: Protect API changes, bundle format updates
- **MEV-Boost**: Latest relay endpoints, builder requirements

### **Blockchain Infrastructure** (Check for updates)
- **Solana Web3.js**: Version compatibility, API changes
- **Ethers.js**: V5 vs V6 migration status, new features
- **Chain RPC providers**: Alchemy, Infura endpoint changes
- **Wallet connect standards**: Latest WalletConnect versions

### **Package Dependencies** (Always check latest)
- **Next.js**: Current stable version, app router vs pages
- **Supabase**: Latest auth helpers, deprecated packages
- **TypeScript**: Latest version compatibility
- **React**: Current patterns, deprecated features

## 12 Analysis Categories

### 1. **PLACEHOLDER/MOCK CODE**
- Identify intentional placeholder implementations
- Note what real implementation should replace it
- Assess completion priority

### 2. **MISSING IMPLEMENTATIONS**
- Functions/features referenced but not implemented
- Import statements pointing to non-existent files
- Incomplete business logic

### 3. **LOGIC ERRORS**
- Incorrect algorithms or calculations
- Wrong assumptions in code flow
- Data type mismatches or conversion errors

### 4. **INTEGRATION GAPS**
- Disconnected components that should work together
- Mismatched interfaces between modules
- Database schema vs. code misalignment

### 5. **CONFIGURATION CENTRALIZATION**
- Hardcoded values that should be in config files
- Configuration scattered across multiple files
- Values that could change and need centralized management
- Missing environment variable organization
- Configuration validation and type safety

### 6. **DEPENDENCIES & PACKAGES**
- Outdated package versions (**Web search for latest stable**)
- Security vulnerabilities in dependencies
- Best practice package choices for the use case
- Missing packages for intended functionality
- Package compatibility issues
- Bundle size and performance implications

### 7. **BOT LOGIC SOUNDNESS**
- **Strategy Validity**: Do formulas match current DEX implementations? (**Web search DEX docs**)
- **Modularity**: Can new strategies be added easily?
- **Maintainability**: Is the code structure sustainable?
- **DEX Version Compatibility**: Constant product vs concentrated liquidity vs other AMM models (**Web search current implementations**)
- **Market Assumptions**: Are pricing models accurate for current market structure?
- **Risk Management**: Are calculations sound for volatility and slippage?

### 8. **CODE QUALITY**
- TypeScript errors and type safety
- Code organization and structure
- Naming conventions and clarity

### 9. **PERFORMANCE CONSIDERATIONS**
- Inefficient algorithms or queries
- Memory leaks or excessive resource usage
- Optimization opportunities

### 10. **PRODUCTION READINESS**
- Missing error handling
- Logging and monitoring gaps
- Deployment configuration issues

### 11. **DOCUMENTATION GAPS**
- Missing function/class documentation
- Unclear variable names or complex logic
- API documentation needs

### 12. **TESTING GAPS**
- Missing unit tests
- Integration test needs
- Edge case handling

## Analysis Template Structure

```markdown
# Analysis: [File Path]

**File Type**: [Component/Configuration/Bot/Package/etc.]
**Lines of Code**: [number]
**Completion Status**: [% estimate]
**External Research**: [List any web searches performed]

## Summary
Brief overview of file purpose and current state.

## Category Analysis

### 1. Placeholder/Mock Code
- **Found**: [List placeholders]
- **Priority**: [High/Medium/Low]
- **Implementation Need**: [Description]

### 2. Missing Implementations
- **Missing**: [List missing features]
- **Dependencies**: [What's needed to implement]
- **Effort**: [Time estimate]

### 3. Logic Errors
- **Issues Found**: [List logical problems]
- **Impact**: [Effect on functionality]
- **Fix Complexity**: [Simple/Complex]

### 4. Integration Gaps
- **Disconnects**: [Components not properly connected]
- **Interface Issues**: [Mismatched APIs]
- **Data Flow**: [Broken data paths]

### 5. Configuration Centralization
- **Hardcoded Values**: [Values that should be configurable]
- **Scattered Config**: [Configuration spread across files]
- **Missing Centralization**: [What needs config file management]
- **Validation Needs**: [Config validation requirements]

### 6. Dependencies & Packages
- **Outdated Packages**: [Versions behind current stable - web search results]
- **Security Issues**: [Known vulnerabilities]
- **Better Alternatives**: [More suitable packages available]
- **Missing Packages**: [Functionality needs additional dependencies]
- **Compatibility**: [Version conflicts or compatibility issues]

### 7. Bot Logic Soundness
- **Strategy Validity**: [Are formulas accurate for current market? - include web search findings]
- **DEX Compatibility**: [Constant product vs V3 concentrated liquidity vs other AMMs - current docs]
- **Modularity**: [How easy to add new strategies?]
- **Maintainability**: [Code structure sustainability]
- **Market Assumptions**: [Are pricing/slippage models current?]
- **Risk Calculations**: [Soundness of volatility/exposure calculations]

### 8. Code Quality
- **TypeScript Issues**: [Type errors, any usage]
- **Structure**: [Organization problems]
- **Naming**: [Unclear variables/functions]

### 9. Performance Considerations
- **Bottlenecks**: [Performance issues]
- **Optimizations**: [Improvement opportunities]
- **Resource Usage**: [Memory/CPU concerns]

### 10. Production Readiness
- **Error Handling**: [Missing try/catch, validation]
- **Logging**: [Insufficient logging]
- **Monitoring**: [Health checks, metrics]

### 11. Documentation Gaps
- **Missing Docs**: [Undocumented functions]
- **Unclear Code**: [Complex logic needs explanation]
- **API Docs**: [External interface documentation]

### 12. Testing Gaps
- **Unit Tests**: [Missing test coverage]
- **Integration Tests**: [Component interaction tests]
- **Edge Cases**: [Unhandled scenarios]

## Current Standards Research
[If web searches were performed, summarize findings about current best practices, API changes, or documentation updates that affect this file]

## Implementation Tasks
1. **Immediate**: [Must fix before basic functionality]
2. **Pre-Production**: [Required before release]
3. **Post-Launch**: [Can be improved after release]

## Dependencies
- **Blocks**: [What this file blocks]
- **Blocked By**: [What blocks this file's completion]

## Effort Estimate
- **Time**: [Hours/days estimate]
- **Complexity**: [Low/Medium/High]
- **Priority**: [Critical/High/Medium/Low]
```

## Background Agent Instructions

You are a systematic code analyst. For each file:

1. **Stay Calm**: This is development code with expected placeholders
2. **Be Thorough**: Check every line for the 12 categories
3. **Research Current Standards**: **Use web search** when analyzing external APIs, protocols, or packages
4. **Check DEX Reality**: For trading bots, **web search** current DEX documentation to verify formulas match implementations
5. **Verify Package Versions**: **Web search** for latest stable versions and security advisories
6. **Estimate Effort**: Help prioritize development work
7. **Track Dependencies**: Note what depends on what
8. **Create Individual Files**: One analysis per source file
9. **Update Summary**: Keep running totals of work needed

## Web Search Triggers

**ALWAYS web search when you encounter:**
- External API endpoints or SDK usage
- DEX/DeFi protocol integrations
- Package version specifications
- Blockchain network configurations
- MEV/block building implementations
- Authentication provider integrations
- Database service configurations

## Special Focus Areas

### Configuration Analysis
- Look for any value that could change between environments
- Check if configuration is properly centralized
- Verify environment variable usage vs hardcoded values
- Assess configuration validation and type safety

### Package Analysis
- **Web search** package.json files for outdated versions
- Research if chosen packages are current best practice
- Identify security vulnerabilities
- Assess bundle size and performance impact

### Bot Logic Deep Dive
- **DEX Formula Accuracy**: **Web search** current DEX docs to verify AMM formulas
- **Liquidity Model**: Does it account for concentrated liquidity (V3) vs constant product (V2)?
- **Strategy Modularity**: How easy would it be to add a new trading strategy?
- **Market Reality**: Do assumptions match current market conditions?
- **Risk Management**: Are volatility and slippage calculations sound?

## File Naming Convention
- `apps_frontend_package.json.md`
- `apps_bots_arbitrage_src_index.ts.md` 
- `packages_chain-client_src_index.ts.md`
- `turbo.json.md`

## Running Summary Format
Track across all files:
- Total files analyzed
- Total implementation tasks identified
- Effort estimates by category
- Critical path dependencies
- Production readiness percentage
- Configuration centralization status
- Package update requirements
- Bot logic soundness assessment
- External documentation research performed

Remember: This is a development assessment focused on completion and quality. The goal is to understand what work remains to complete the project properly, using current best practices and documentation.