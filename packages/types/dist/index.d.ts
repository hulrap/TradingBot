export type Chain = "ETH" | "BSC" | "SOL";
export interface User {
    id: string;
    email: string;
    encryptedPrivateKey: string;
    createdAt: string;
    updatedAt: string;
}
export interface Wallet {
    id: string;
    userId: string;
    address: string;
    encryptedPrivateKey: string;
    chain: Chain;
    name?: string;
    createdAt: string;
}
export interface ArbitrageBotConfig {
    id: string;
    userId: string;
    walletId: string;
    chain: Chain;
    tokenPair: {
        tokenA: string;
        tokenB: string;
    };
    minProfitThreshold: number;
    tradeSize: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface CopyTraderBotConfig {
    id: string;
    userId: string;
    walletId: string;
    chain: Chain;
    targetWalletAddress: string;
    tradeSize: {
        type: "FIXED" | "PERCENTAGE";
        value: number;
    };
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface SandwichBotConfig {
    id: string;
    userId: string;
    walletId: string;
    chain: Chain;
    targetDex: string;
    minVictimTradeSize: number;
    maxGasPrice: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export type BotConfig = ArbitrageBotConfig | CopyTraderBotConfig | SandwichBotConfig;
export interface Trade {
    id: string;
    botConfigId: string;
    botType: "ARBITRAGE" | "COPY_TRADER" | "SANDWICH";
    txHash: string;
    chain: Chain;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    gasUsed: string;
    gasPrice: string;
    profit?: string;
    status: "PENDING" | "SUCCESS" | "FAILED";
    createdAt: string;
    completedAt?: string;
}
export interface BotStatus {
    botConfigId: string;
    isRunning: boolean;
    lastActivity: string;
    totalTrades: number;
    totalProfit: string;
    errors: string[];
}
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    success: boolean;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface AuthResponse {
    user: User;
    token: string;
}
export interface RpcConfig {
    chain: Chain;
    url: string;
    websocketUrl?: string;
    apiKey?: string;
}
export { ArbitrageBotConfigSchema } from './src/bot';
//# sourceMappingURL=index.d.ts.map