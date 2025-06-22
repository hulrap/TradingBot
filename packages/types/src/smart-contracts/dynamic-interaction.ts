/**
 * @file Dynamic Smart Contract Interaction Types
 * 
 * Advanced smart contract interaction infrastructure with dynamic ABI
 * discovery, contract introspection, and intelligent adaptation.
 * 
 * Features:
 * - Dynamic ABI discovery and parsing
 * - Contract introspection and analysis
 * - Intelligent function signature detection
 * - Multi-version contract support
 * - Proxy contract resolution
 * - Upgrade pattern detection
 * - Security analysis and validation
 * - Gas optimization strategies
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../blockchain/chain';
import type { Address, TokenInfo } from '../blockchain/addresses';

// ========================================
// CONTRACT DISCOVERY TYPES
// ========================================

/**
 * Contract types based on standards and patterns.
 */
type ContractType = 
  | 'erc20'               // ERC-20 Token
  | 'erc721'              // ERC-721 NFT
  | 'erc1155'             // ERC-1155 Multi-Token
  | 'erc4626'             // ERC-4626 Tokenized Vault
  | 'erc2612'             // ERC-2612 Permit
  | 'uniswap-v2-pair'     // Uniswap V2 Pair
  | 'uniswap-v2-factory'  // Uniswap V2 Factory
  | 'uniswap-v2-router'   // Uniswap V2 Router
  | 'uniswap-v3-pool'     // Uniswap V3 Pool
  | 'uniswap-v3-factory'  // Uniswap V3 Factory
  | 'uniswap-v3-router'   // Uniswap V3 Router
  | 'curve-pool'          // Curve Pool
  | 'balancer-pool'       // Balancer Pool
  | 'compound-ctoken'     // Compound cToken
  | 'aave-atoken'         // Aave aToken
  | 'yearn-vault'         // Yearn Vault
  | 'gnosis-safe'         // Gnosis Safe
  | 'multisig'            // Multi-signature wallet
  | 'timelock'            // Timelock contract
  | 'governance'          // Governance contract
  | 'dao'                 // DAO contract
  | 'staking'             // Staking contract
  | 'farming'             // Yield farming contract
  | 'lottery'             // Lottery contract
  | 'auction'             // Auction contract
  | 'marketplace'         // NFT marketplace
  | 'bridge'              // Cross-chain bridge
  | 'oracle'              // Price oracle
  | 'proxy-transparent'   // Transparent proxy
  | 'proxy-uups'          // UUPS proxy
  | 'proxy-beacon'        // Beacon proxy
  | 'proxy-diamond'       // Diamond proxy
  | 'factory'             // Factory contract
  | 'registry'            // Registry contract
  | 'router'              // Router contract
  | 'aggregator'          // Aggregator contract
  | 'custom'              // Custom contract
  | 'unknown';            // Unknown contract type

/**
 * ABI function types.
 */
type ABIFunctionType = 
  | 'function'
  | 'constructor'
  | 'fallback'
  | 'receive'
  | 'event'
  | 'error';

/**
 * Function state mutability.
 */
type StateMutability = 
  | 'pure'
  | 'view'
  | 'nonpayable'
  | 'payable';

/**
 * Contract verification status.
 */
type VerificationStatus = 
  | 'verified'
  | 'unverified'
  | 'partially-verified'
  | 'proxy-verified'
  | 'self-verified'
  | 'unknown';

// ========================================
// ABI AND INTERFACE TYPES
// ========================================

/**
 * Dynamic ABI parameter definition.
 */
interface ABIParameter {
  /** Parameter name. */
  name: string;
  
  /** Parameter type. */
  type: string;
  
  /** Internal type (for structs). */
  internalType?: string;
  
  /** Components (for tuples/structs). */
  components?: ABIParameter[];
  
  /** Indexed (for events). */
  indexed?: boolean;
  
  /** Parameter description. */
  description?: string;
  
  /** Parameter constraints. */
  constraints?: {
    minimum?: string;
    maximum?: string;
    pattern?: string;
    enum?: string[];
  };
}

/**
 * Dynamic ABI function definition.
 */
interface ABIFunction {
  /** Function name. */
  name: string;
  
  /** Function type. */
  type: ABIFunctionType;
  
  /** State mutability. */
  stateMutability: StateMutability;
  
  /** Function inputs. */
  inputs: ABIParameter[];
  
  /** Function outputs. */
  outputs: ABIParameter[];
  
  /** Function selector (first 4 bytes of hash). */
  selector: string;
  
  /** Function signature. */
  signature: string;
  
  /** Gas estimate. */
  gasEstimate?: {
    min: number;
    max: number;
    average: number;
  };
  
  /** Function documentation. */
  documentation?: {
    description: string;
    parameters: Record<string, string>;
    returns: Record<string, string>;
    examples: string[];
  };
  
  /** Security analysis. */
  security?: {
    accessControl: 'public' | 'restricted' | 'owner-only' | 'complex';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
  };
}

/**
 * Dynamic ABI event definition.
 */
interface ABIEvent {
  /** Event name. */
  name: string;
  
  /** Event type. */
  type: 'event';
  
  /** Event inputs. */
  inputs: ABIParameter[];
  
  /** Anonymous event. */
  anonymous: boolean;
  
  /** Event signature. */
  signature: string;
  
  /** Event topic hash. */
  topicHash: string;
  
  /** Event documentation. */
  documentation?: {
    description: string;
    parameters: Record<string, string>;
  };
}

/**
 * Dynamic ABI error definition.
 */
interface ABIError {
  /** Error name. */
  name: string;
  
  /** Error type. */
  type: 'error';
  
  /** Error inputs. */
  inputs: ABIParameter[];
  
  /** Error selector. */
  selector: string;
  
  /** Error signature. */
  signature: string;
  
  /** Error documentation. */
  documentation?: {
    description: string;
    parameters: Record<string, string>;
  };
}

/**
 * Complete dynamic ABI definition.
 */
interface DynamicABI {
  /** Contract address. */
  address: Address;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** ABI functions. */
  functions: ABIFunction[];
  
  /** ABI events. */
  events: ABIEvent[];
  
  /** ABI errors. */
  errors: ABIError[];
  
  /** Constructor definition. */
  constructor?: ABIFunction;
  
  /** Fallback function. */
  fallback?: ABIFunction;
  
  /** Receive function. */
  receive?: ABIFunction;
  
  /** ABI metadata. */
  metadata: {
    /** Compiler version. */
    compiler: string;
    
    /** Source code hash. */
    sourceHash: string;
    
    /** Contract name. */
    contractName: string;
    
    /** ABI discovery method. */
    discoveryMethod: 'etherscan' | 'sourcify' | 'bytecode-analysis' | 'manual' | 'proxy-resolution';
    
    /** Discovery timestamp. */
    discoveredAt: number;
    
    /** ABI confidence score. */
    confidence: number;
  };
}

// ========================================
// CONTRACT INTROSPECTION TYPES
// ========================================

/**
 * Contract introspection result.
 */
interface ContractIntrospection {
  /** Contract address. */
  address: Address;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Detected contract type. */
  contractType: ContractType;
  
  /** Contract standards implemented. */
  standards: Array<{
    /** Standard name (e.g., 'ERC20'). */
    standard: string;
    
    /** Compliance level. */
    compliance: 'full' | 'partial' | 'non-compliant';
    
    /** Missing functions. */
    missingFunctions: string[];
    
    /** Additional functions. */
    additionalFunctions: string[];
  }>;
  
  /** Proxy detection. */
  proxy: {
    /** Is proxy contract. */
    isProxy: boolean;
    
    /** Proxy type. */
    type?: 'transparent' | 'uups' | 'beacon' | 'diamond' | 'custom';
    
    /** Implementation address. */
    implementation?: Address;
    
    /** Admin address. */
    admin?: Address;
    
    /** Proxy version. */
    version?: string;
    
    /** Upgrade history. */
    upgradeHistory: Array<{
      timestamp: number;
      fromImplementation: Address;
      toImplementation: Address;
      transactionHash: string;
    }>;
  };
  
  /** Ownership analysis. */
  ownership: {
    /** Owner address. */
    owner?: Address;
    
    /** Ownership type. */
    type: 'single-owner' | 'multi-sig' | 'dao' | 'timelock' | 'immutable' | 'complex';
    
    /** Access control roles. */
    roles: Array<{
      name: string;
      addresses: Address[];
      permissions: string[];
    }>;
  };
  
  /** Security analysis. */
  security: {
    /** Overall security score. */
    score: number;
    
    /** Security issues found. */
    issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      type: string;
      description: string;
      recommendation: string;
    }>;
    
    /** Verification status. */
    verification: VerificationStatus;
    
    /** Audit information. */
    audits: Array<{
      auditor: string;
      date: number;
      report: string;
      findings: number;
    }>;
  };
  
  /** Upgrade patterns. */
  upgradeability: {
    /** Is upgradeable. */
    isUpgradeable: boolean;
    
    /** Upgrade mechanism. */
    mechanism?: string;
    
    /** Upgrade risks. */
    risks: string[];
    
    /** Governance requirements. */
    governance: {
      required: boolean;
      mechanism?: string;
      timelock?: number;
    };
  };
  
  /** Function analysis. */
  functions: {
    /** Total function count. */
    total: number;
    
    /** Public functions. */
    public: number;
    
    /** External functions. */
    external: number;
    
    /** View functions. */
    view: number;
    
    /** Payable functions. */
    payable: number;
    
    /** Critical functions. */
    critical: string[];
    
    /** Deprecated functions. */
    deprecated: string[];
  };
  
  /** Storage analysis. */
  storage: {
    /** Storage slots used. */
    slotsUsed: number;
    
    /** Storage layout. */
    layout: Array<{
      slot: number;
      offset: number;
      type: string;
      variable: string;
    }>;
    
    /** Storage collisions detected. */
    collisions: Array<{
      slot: number;
      variables: string[];
      risk: 'low' | 'medium' | 'high';
    }>;
  };
}

// ========================================
// DYNAMIC INTERACTION TYPES
// ========================================

/**
 * Dynamic function call configuration.
 */
interface DynamicFunctionCall {
  /** Call identifier. */
  id: string;
  
  /** Target contract. */
  contract: Address;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Function to call. */
  function: {
    /** Function name. */
    name: string;
    
    /** Function selector. */
    selector: string;
    
    /** Function parameters. */
    parameters: Array<{
      name: string;
      type: string;
      value: unknown;
    }>;
  };
  
  /** Call options. */
  options: {
    /** Call type. */
    type: 'call' | 'staticcall' | 'delegatecall';
    
    /** Value to send (for payable functions). */
    value?: string;
    
    /** Gas limit. */
    gasLimit?: number;
    
    /** Gas price. */
    gasPrice?: string;
    
    /** From address. */
    from?: Address;
    
    /** Block number (for historical calls). */
    blockNumber?: number;
  };
  
  /** Simulation configuration. */
  simulation: {
    /** Simulate before execution. */
    enabled: boolean;
    
    /** Fork configuration. */
    fork?: {
      blockNumber: number;
      url: string;
    };
    
    /** State overrides. */
    stateOverrides?: Record<Address, {
      balance?: string;
      nonce?: number;
      code?: string;
      state?: Record<string, string>;
    }>;
  };
  
  /** Validation rules. */
  validation: {
    /** Parameter validation. */
    parameters: Array<{
      name: string;
      rules: string[];
    }>;
    
    /** Pre-call conditions. */
    preconditions: string[];
    
    /** Post-call assertions. */
    postconditions: string[];
  };
  
  /** Error handling. */
  errorHandling: {
    /** Retry configuration. */
    retry: {
      enabled: boolean;
      maxAttempts: number;
      backoffStrategy: 'linear' | 'exponential';
    };
    
    /** Fallback strategies. */
    fallbacks: Array<{
      condition: string;
      action: 'retry' | 'alternative-function' | 'fail';
      parameters?: Record<string, unknown>;
    }>;
  };
}

/**
 * Dynamic function call result.
 */
interface DynamicFunctionResult {
  /** Call identifier. */
  callId: string;
  
  /** Execution timestamp. */
  timestamp: number;
  
  /** Transaction hash (if executed on-chain). */
  transactionHash?: string;
  
  /** Block number. */
  blockNumber: number;
  
  /** Gas used. */
  gasUsed: number;
  
  /** Execution status. */
  status: 'success' | 'reverted' | 'failed' | 'simulated';
  
  /** Return values. */
  returnValues: Array<{
    name: string;
    type: string;
    value: unknown;
  }>;
  
  /** Decoded return data. */
  decodedData: Record<string, unknown>;
  
  /** Events emitted. */
  events: Array<{
    name: string;
    signature: string;
    data: Record<string, unknown>;
    topics: string[];
  }>;
  
  /** Error information (if failed). */
  error?: {
    type: 'revert' | 'out-of-gas' | 'invalid-opcode' | 'unknown';
    message: string;
    data?: string;
    signature?: string;
  };
  
  /** State changes. */
  stateChanges: Array<{
    address: Address;
    storageChanges: Array<{
      slot: string;
      from: string;
      to: string;
    }>;
    balanceChange?: {
      from: string;
      to: string;
    };
  }>;
  
  /** Performance metrics. */
  performance: {
    /** Total execution time. */
    executionTime: number;
    
    /** Simulation time. */
    simulationTime?: number;
    
    /** Network latency. */
    networkLatency: number;
  };
}

// ========================================
// CONTRACT REGISTRY TYPES
// ========================================

/**
 * Contract registry entry.
 */
interface ContractRegistryEntry {
  /** Contract address. */
  address: Address;
  
  /** Target chain. */
  chain: SupportedChain;
  
  /** Contract metadata. */
  metadata: {
    /** Contract name. */
    name: string;
    
    /** Contract symbol (if applicable). */
    symbol?: string;
    
    /** Contract version. */
    version: string;
    
    /** Contract description. */
    description: string;
    
    /** Contract tags. */
    tags: string[];
    
    /** Creation timestamp. */
    createdAt: number;
    
    /** Creator address. */
    creator: Address;
  };
  
  /** ABI information. */
  abi: {
    /** ABI definition. */
    definition: DynamicABI;
    
    /** ABI hash. */
    hash: string;
    
    /** ABI source. */
    source: 'etherscan' | 'sourcify' | 'manual' | 'generated';
    
    /** Last updated. */
    lastUpdated: number;
  };
  
  /** Contract introspection. */
  introspection: ContractIntrospection;
  
  /** Usage statistics. */
  usage: {
    /** Total function calls. */
    totalCalls: number;
    
    /** Popular functions. */
    popularFunctions: Array<{
      name: string;
      callCount: number;
      lastCalled: number;
    }>;
    
    /** Gas usage statistics. */
    gasUsage: {
      total: string;
      average: number;
      peak: number;
    };
    
    /** Error rate. */
    errorRate: number;
  };
  
  /** Monitoring configuration. */
  monitoring: {
    /** Health checks enabled. */
    healthChecks: boolean;
    
    /** Alert configurations. */
    alerts: Array<{
      type: 'function-failure' | 'gas-spike' | 'upgrade-detected' | 'ownership-change';
      threshold: number;
      enabled: boolean;
    }>;
    
    /** Event subscriptions. */
    eventSubscriptions: string[];
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  ContractType,
  ABIFunctionType,
  StateMutability,
  VerificationStatus,
  ABIParameter,
  ABIFunction,
  ABIEvent,
  ABIError,
  DynamicABI,
  ContractIntrospection,
  DynamicFunctionCall,
  DynamicFunctionResult,
  ContractRegistryEntry
}; 