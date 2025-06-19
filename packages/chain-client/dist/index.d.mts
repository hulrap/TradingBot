import { EventEmitter } from 'eventemitter3';
import PQueue from 'p-queue';
import { AxiosInstance } from 'axios';
import { Chain } from '@trading-bot/types';

interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    gasLimit: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    nonce: number;
    data?: string;
    blockNumber?: number;
    blockHash?: string;
    transactionIndex?: number;
    confirmations?: number;
    status?: 'pending' | 'confirmed' | 'failed';
}
interface GasEstimate {
    gasLimit: string;
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    estimatedCost: string;
    estimatedCostUSD?: number;
}
interface ConnectionConfig {
    rpcUrl: string;
    wsUrl?: string;
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
    rateLimitPerSecond?: number;
}
interface ChainClient {
    chain: Chain;
    isConnected: boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendTransaction(tx: Transaction): Promise<string>;
    simulateTransaction(tx: Transaction): Promise<TransactionSimulation>;
    getTransaction(hash: string): Promise<Transaction | null>;
    waitForTransaction(hash: string, confirmations?: number): Promise<Transaction>;
    estimateGas(tx: Partial<Transaction>): Promise<GasEstimate>;
    getBalance(address: string, tokenAddress?: string): Promise<string>;
    getLatestBlockNumber(): Promise<number>;
    getBlock(blockNumber: number): Promise<any>;
    subscribeToBlocks(callback: (block: any) => void): Promise<() => void>;
    subscribeToMempool(callback: (tx: Transaction) => void): Promise<() => void>;
}
interface TransactionSimulation {
    success: boolean;
    gasUsed: string;
    gasPrice: string;
    error?: string;
    logs?: any[];
    returnData?: string;
}
interface ConnectionPoolConfig {
    maxConnections: number;
    minConnections: number;
    idleTimeout: number;
    connectionTimeout: number;
}
interface RPCCall {
    method: string;
    params: any[];
    id?: string | number;
}
interface RPCResponse<T = any> {
    id?: string | number;
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

declare abstract class BaseChainClient extends EventEmitter implements ChainClient {
    readonly chain: Chain;
    isConnected: boolean;
    protected config: ConnectionConfig;
    protected httpClient: AxiosInstance;
    protected requestQueue: PQueue;
    protected connectionRetries: number;
    constructor(chain: Chain, config: ConnectionConfig);
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract sendTransaction(tx: Transaction): Promise<string>;
    abstract simulateTransaction(tx: Transaction): Promise<TransactionSimulation>;
    abstract getTransaction(hash: string): Promise<Transaction | null>;
    abstract waitForTransaction(hash: string, confirmations?: number): Promise<Transaction>;
    abstract estimateGas(tx: Partial<Transaction>): Promise<GasEstimate>;
    abstract getBalance(address: string, tokenAddress?: string): Promise<string>;
    abstract getLatestBlockNumber(): Promise<number>;
    abstract getBlock(blockNumber: number): Promise<any>;
    abstract subscribeToBlocks(callback: (block: any) => void): Promise<() => void>;
    abstract subscribeToMempool(callback: (tx: Transaction) => void): Promise<() => void>;
    protected makeRPCCall<T = any>(call: RPCCall): Promise<T>;
    protected healthCheck(): Promise<boolean>;
    private setupErrorHandling;
    protected formatAddress(address: string): string;
    protected formatAmount(amount: string | number): string;
    getConnectionStats(): {
        chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
        isConnected: boolean;
        queueSize: number;
        queuePending: number;
        connectionRetries: number;
    };
}

declare class EthereumClient {
}

declare class SolanaClient {
}

declare class MultiChainClient {
}

declare function hexToDecimal(hex: string): number;
declare function decimalToHex(decimal: number): string;
declare function weiToEther(wei: string): string;
declare function etherToWei(ether: string): string;
declare function isValidEthAddress(address: string): boolean;
declare function isValidSolanaAddress(address: string): boolean;
declare function delay(ms: number): Promise<void>;
declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
declare function calculateGasPrice(baseFee: string, priorityFee?: string): {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
};
declare function formatTxHash(hash: string, length?: number): string;
declare function isTransactionConfirmed(confirmations: number, requiredConfirmations?: number): boolean;

declare class MEVProtection {
}

declare class WebSocketManager {
}

export { BaseChainClient, type ChainClient, type ConnectionConfig, type ConnectionPoolConfig, EthereumClient, type GasEstimate, MEVProtection, MultiChainClient, type RPCCall, type RPCResponse, SolanaClient, type Transaction, type TransactionSimulation, WebSocketManager, calculateGasPrice, decimalToHex, delay, etherToWei, formatTxHash, hexToDecimal, isTransactionConfirmed, isValidEthAddress, isValidSolanaAddress, retryWithBackoff, weiToEther };
