import { z } from 'zod';

declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    emailVerified: z.ZodBoolean;
    twoFactorEnabled: z.ZodBoolean;
    isActive: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastLogin: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLogin?: Date | undefined;
}, {
    id: string;
    email: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLogin?: Date | undefined;
}>;
type User = z.infer<typeof UserSchema>;
declare const UserProfileSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
    notificationPreferences: z.ZodObject<{
        email: z.ZodDefault<z.ZodBoolean>;
        sms: z.ZodDefault<z.ZodBoolean>;
        discord: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        email: boolean;
        sms: boolean;
        discord: boolean;
    }, {
        email?: boolean | undefined;
        sms?: boolean | undefined;
        discord?: boolean | undefined;
    }>;
    riskTolerance: z.ZodDefault<z.ZodEnum<["low", "medium", "high"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    userId: string;
    timezone: string;
    notificationPreferences: {
        email: boolean;
        sms: boolean;
        discord: boolean;
    };
    riskTolerance: "low" | "medium" | "high";
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
}, {
    id: string;
    userId: string;
    notificationPreferences: {
        email?: boolean | undefined;
        sms?: boolean | undefined;
        discord?: boolean | undefined;
    };
    firstName?: string | undefined;
    lastName?: string | undefined;
    phone?: string | undefined;
    timezone?: string | undefined;
    riskTolerance?: "low" | "medium" | "high" | undefined;
}>;
type UserProfile = z.infer<typeof UserProfileSchema>;
declare const JWTPayloadSchema: z.ZodObject<{
    sub: z.ZodString;
    email: z.ZodString;
    iat: z.ZodNumber;
    exp: z.ZodNumber;
    jti: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    sub: string;
    iat: number;
    exp: number;
    jti?: string | undefined;
}, {
    email: string;
    sub: string;
    iat: number;
    exp: number;
    jti?: string | undefined;
}>;
type JWTPayload = z.infer<typeof JWTPayloadSchema>;
declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    twoFactorCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    twoFactorCode?: string | undefined;
}, {
    email: string;
    password: string;
    twoFactorCode?: string | undefined;
}>;
type LoginRequest = z.infer<typeof LoginRequestSchema>;
declare const RegisterRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
}, {
    email: string;
    password: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
}>;
type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
declare const AuthResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    user: z.ZodOptional<z.ZodAny>;
    accessToken: z.ZodOptional<z.ZodString>;
    refreshToken: z.ZodOptional<z.ZodString>;
    expiresIn: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    timestamp: Date;
    user?: any;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    expiresIn?: number | undefined;
    error?: string | undefined;
    message?: string | undefined;
}, {
    success: boolean;
    user?: any;
    accessToken?: string | undefined;
    refreshToken?: string | undefined;
    expiresIn?: number | undefined;
    error?: string | undefined;
    message?: string | undefined;
    timestamp?: Date | undefined;
}>;
type AuthResponse = z.infer<typeof AuthResponseSchema>;
declare const SessionSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    expiresAt: z.ZodDate;
    createdAt: z.ZodDate;
    ipAddress: z.ZodOptional<z.ZodString>;
    userAgent: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}>;
type Session = z.infer<typeof SessionSchema>;

declare const ChainSchema: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
type Chain = z.infer<typeof ChainSchema>;
declare const ChainConfigSchema: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
    displayName: z.ZodString;
    rpcUrl: z.ZodString;
    wsUrl: z.ZodOptional<z.ZodString>;
    blockExplorer: z.ZodString;
    nativeCurrency: z.ZodObject<{
        name: z.ZodString;
        symbol: z.ZodString;
        decimals: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        name: string;
        decimals: number;
    }, {
        symbol: string;
        name: string;
        decimals: number;
    }>;
    isTestnet: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    displayName: string;
    rpcUrl: string;
    blockExplorer: string;
    nativeCurrency: {
        symbol: string;
        name: string;
        decimals: number;
    };
    isTestnet: boolean;
    wsUrl?: string | undefined;
}, {
    id: number;
    name: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    displayName: string;
    rpcUrl: string;
    blockExplorer: string;
    nativeCurrency: {
        symbol: string;
        name: string;
        decimals: number;
    };
    wsUrl?: string | undefined;
    isTestnet?: boolean | undefined;
}>;
type ChainConfig = z.infer<typeof ChainConfigSchema>;
declare const WalletSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    address: z.ZodString;
    chain: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
    encryptedPrivateKey: z.ZodString;
    walletType: z.ZodDefault<z.ZodEnum<["imported", "generated"]>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    address: string;
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    encryptedPrivateKey: string;
    walletType: "imported" | "generated";
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    address: string;
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    encryptedPrivateKey: string;
    walletType?: "imported" | "generated" | undefined;
    isActive?: boolean | undefined;
}>;
type Wallet = z.infer<typeof WalletSchema>;
declare const TokenSchema: z.ZodObject<{
    address: z.ZodString;
    symbol: z.ZodString;
    name: z.ZodString;
    decimals: z.ZodNumber;
    chain: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
    logoUri: z.ZodOptional<z.ZodString>;
    coingeckoId: z.ZodOptional<z.ZodString>;
    isVerified: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    isVerified: boolean;
    logoUri?: string | undefined;
    coingeckoId?: string | undefined;
}, {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    logoUri?: string | undefined;
    coingeckoId?: string | undefined;
    isVerified?: boolean | undefined;
}>;
type Token = z.infer<typeof TokenSchema>;
declare const TransactionSchema: z.ZodObject<{
    hash: z.ZodString;
    from: z.ZodString;
    to: z.ZodString;
    value: z.ZodString;
    gasLimit: z.ZodString;
    gasPrice: z.ZodOptional<z.ZodString>;
    maxFeePerGas: z.ZodOptional<z.ZodString>;
    maxPriorityFeePerGas: z.ZodOptional<z.ZodString>;
    nonce: z.ZodNumber;
    data: z.ZodOptional<z.ZodString>;
    blockNumber: z.ZodOptional<z.ZodNumber>;
    blockHash: z.ZodOptional<z.ZodString>;
    transactionIndex: z.ZodOptional<z.ZodNumber>;
    confirmations: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["pending", "confirmed", "failed"]>>;
}, "strip", z.ZodTypeAny, {
    value: string;
    hash: string;
    from: string;
    to: string;
    gasLimit: string;
    nonce: number;
    gasPrice?: string | undefined;
    maxFeePerGas?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
    data?: string | undefined;
    blockNumber?: number | undefined;
    blockHash?: string | undefined;
    transactionIndex?: number | undefined;
    confirmations?: number | undefined;
    status?: "pending" | "confirmed" | "failed" | undefined;
}, {
    value: string;
    hash: string;
    from: string;
    to: string;
    gasLimit: string;
    nonce: number;
    gasPrice?: string | undefined;
    maxFeePerGas?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
    data?: string | undefined;
    blockNumber?: number | undefined;
    blockHash?: string | undefined;
    transactionIndex?: number | undefined;
    confirmations?: number | undefined;
    status?: "pending" | "confirmed" | "failed" | undefined;
}>;
type Transaction = z.infer<typeof TransactionSchema>;
declare const GasEstimateSchema: z.ZodObject<{
    gasLimit: z.ZodString;
    gasPrice: z.ZodOptional<z.ZodString>;
    maxFeePerGas: z.ZodOptional<z.ZodString>;
    maxPriorityFeePerGas: z.ZodOptional<z.ZodString>;
    estimatedCost: z.ZodString;
    estimatedCostUSD: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    gasLimit: string;
    estimatedCost: string;
    gasPrice?: string | undefined;
    maxFeePerGas?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
    estimatedCostUSD?: number | undefined;
}, {
    gasLimit: string;
    estimatedCost: string;
    gasPrice?: string | undefined;
    maxFeePerGas?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
    estimatedCostUSD?: number | undefined;
}>;
type GasEstimate = z.infer<typeof GasEstimateSchema>;
declare const BlockSchema: z.ZodObject<{
    number: z.ZodNumber;
    hash: z.ZodString;
    parentHash: z.ZodString;
    timestamp: z.ZodNumber;
    gasLimit: z.ZodString;
    gasUsed: z.ZodString;
    baseFeePerGas: z.ZodOptional<z.ZodString>;
    transactions: z.ZodArray<z.ZodString, "many">;
    miner: z.ZodOptional<z.ZodString>;
    difficulty: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    number: number;
    timestamp: number;
    hash: string;
    gasLimit: string;
    parentHash: string;
    gasUsed: string;
    transactions: string[];
    baseFeePerGas?: string | undefined;
    miner?: string | undefined;
    difficulty?: string | undefined;
}, {
    number: number;
    timestamp: number;
    hash: string;
    gasLimit: string;
    parentHash: string;
    gasUsed: string;
    transactions: string[];
    baseFeePerGas?: string | undefined;
    miner?: string | undefined;
    difficulty?: string | undefined;
}>;
type Block = z.infer<typeof BlockSchema>;
declare const DEXSchema: z.ZodEnum<["uniswap_v2", "uniswap_v3", "sushiswap", "pancakeswap", "jupiter", "raydium", "orca", "serum", "1inch", "paraswap", "kyber", "balancer"]>;
type DEX = z.infer<typeof DEXSchema>;
declare const DEXConfigSchema: z.ZodObject<{
    name: z.ZodEnum<["uniswap_v2", "uniswap_v3", "sushiswap", "pancakeswap", "jupiter", "raydium", "orca", "serum", "1inch", "paraswap", "kyber", "balancer"]>;
    chain: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
    factoryAddress: z.ZodOptional<z.ZodString>;
    routerAddress: z.ZodOptional<z.ZodString>;
    quoterAddress: z.ZodOptional<z.ZodString>;
    fee: z.ZodNumber;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    name: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    fee: number;
    factoryAddress?: string | undefined;
    routerAddress?: string | undefined;
    quoterAddress?: string | undefined;
}, {
    name: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    fee: number;
    factoryAddress?: string | undefined;
    routerAddress?: string | undefined;
    quoterAddress?: string | undefined;
    isActive?: boolean | undefined;
}>;
type DEXConfig = z.infer<typeof DEXConfigSchema>;

declare const BotTypeSchema: z.ZodEnum<["arbitrage", "copy_trader", "sandwich", "liquidation", "jit_liquidity", "market_maker"]>;
type BotType = z.infer<typeof BotTypeSchema>;
declare const BotStatusSchema: z.ZodEnum<["idle", "running", "paused", "error", "stopped"]>;
type BotStatus = z.infer<typeof BotStatusSchema>;
declare const BaseBotConfigSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    walletId: z.ZodString;
    botType: z.ZodEnum<["arbitrage", "copy_trader", "sandwich", "liquidation", "jit_liquidity", "market_maker"]>;
    name: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    isPaperTrading: z.ZodDefault<z.ZodBoolean>;
    maxDailyTrades: z.ZodDefault<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodString>;
    stopLossPercentage: z.ZodOptional<z.ZodNumber>;
    takeProfitPercentage: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "arbitrage" | "copy_trader" | "sandwich" | "liquidation" | "jit_liquidity" | "market_maker";
    isPaperTrading: boolean;
    maxDailyTrades: number;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "arbitrage" | "copy_trader" | "sandwich" | "liquidation" | "jit_liquidity" | "market_maker";
    isActive?: boolean | undefined;
    isPaperTrading?: boolean | undefined;
    maxDailyTrades?: number | undefined;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}>;
type BaseBotConfig = z.infer<typeof BaseBotConfigSchema>;
declare const ArbitrageBotConfigSchema: z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    userId: z.ZodString;
    name: z.ZodString;
    walletId: z.ZodString;
    isPaperTrading: z.ZodDefault<z.ZodBoolean>;
    maxDailyTrades: z.ZodDefault<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodString>;
    stopLossPercentage: z.ZodOptional<z.ZodNumber>;
    takeProfitPercentage: z.ZodOptional<z.ZodNumber>;
    botType: z.ZodLiteral<"arbitrage">;
    configuration: z.ZodObject<{
        tokenPairs: z.ZodArray<z.ZodObject<{
            tokenA: z.ZodString;
            tokenB: z.ZodString;
            chains: z.ZodArray<z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>, "many">;
        }, "strip", z.ZodTypeAny, {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }, {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }>, "many">;
        minProfitThreshold: z.ZodNumber;
        maxSlippage: z.ZodNumber;
        dexes: z.ZodArray<z.ZodString, "many">;
        gasMultiplier: z.ZodDefault<z.ZodNumber>;
        enableMEVProtection: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier: number;
        enableMEVProtection: boolean;
    }, {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier?: number | undefined;
        enableMEVProtection?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "arbitrage";
    isPaperTrading: boolean;
    maxDailyTrades: number;
    configuration: {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier: number;
        enableMEVProtection: boolean;
    };
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "arbitrage";
    configuration: {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier?: number | undefined;
        enableMEVProtection?: boolean | undefined;
    };
    isActive?: boolean | undefined;
    isPaperTrading?: boolean | undefined;
    maxDailyTrades?: number | undefined;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}>;
type ArbitrageBotConfig = z.infer<typeof ArbitrageBotConfigSchema>;
declare const CopyTradingBotConfigSchema: z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    userId: z.ZodString;
    name: z.ZodString;
    walletId: z.ZodString;
    isPaperTrading: z.ZodDefault<z.ZodBoolean>;
    maxDailyTrades: z.ZodDefault<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodString>;
    stopLossPercentage: z.ZodOptional<z.ZodNumber>;
    takeProfitPercentage: z.ZodOptional<z.ZodNumber>;
    botType: z.ZodLiteral<"copy_trader">;
    configuration: z.ZodObject<{
        targetAddresses: z.ZodArray<z.ZodObject<{
            address: z.ZodString;
            chain: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
            copyPercentage: z.ZodDefault<z.ZodNumber>;
            maxCopyAmount: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage: number;
            maxCopyAmount?: string | undefined;
        }, {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage?: number | undefined;
            maxCopyAmount?: string | undefined;
        }>, "many">;
        copySettings: z.ZodObject<{
            copyType: z.ZodDefault<z.ZodEnum<["fixed_amount", "percentage"]>>;
            fixedAmount: z.ZodOptional<z.ZodString>;
            percentage: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            percentage: number;
            copyType: "fixed_amount" | "percentage";
            fixedAmount?: string | undefined;
        }, {
            copyType?: "fixed_amount" | "percentage" | undefined;
            fixedAmount?: string | undefined;
            percentage?: number | undefined;
        }>;
        filters: z.ZodObject<{
            minTradeSize: z.ZodOptional<z.ZodString>;
            maxTradeSize: z.ZodOptional<z.ZodString>;
            excludeTokens: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            onlyVerifiedTokens: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            excludeTokens: string[];
            onlyVerifiedTokens: boolean;
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
        }, {
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
            excludeTokens?: string[] | undefined;
            onlyVerifiedTokens?: boolean | undefined;
        }>;
        latencyOptimization: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage: number;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            percentage: number;
            copyType: "fixed_amount" | "percentage";
            fixedAmount?: string | undefined;
        };
        filters: {
            excludeTokens: string[];
            onlyVerifiedTokens: boolean;
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
        };
        latencyOptimization: boolean;
    }, {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage?: number | undefined;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            copyType?: "fixed_amount" | "percentage" | undefined;
            fixedAmount?: string | undefined;
            percentage?: number | undefined;
        };
        filters: {
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
            excludeTokens?: string[] | undefined;
            onlyVerifiedTokens?: boolean | undefined;
        };
        latencyOptimization?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "copy_trader";
    isPaperTrading: boolean;
    maxDailyTrades: number;
    configuration: {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage: number;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            percentage: number;
            copyType: "fixed_amount" | "percentage";
            fixedAmount?: string | undefined;
        };
        filters: {
            excludeTokens: string[];
            onlyVerifiedTokens: boolean;
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
        };
        latencyOptimization: boolean;
    };
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "copy_trader";
    configuration: {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage?: number | undefined;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            copyType?: "fixed_amount" | "percentage" | undefined;
            fixedAmount?: string | undefined;
            percentage?: number | undefined;
        };
        filters: {
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
            excludeTokens?: string[] | undefined;
            onlyVerifiedTokens?: boolean | undefined;
        };
        latencyOptimization?: boolean | undefined;
    };
    isActive?: boolean | undefined;
    isPaperTrading?: boolean | undefined;
    maxDailyTrades?: number | undefined;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}>;
type CopyTradingBotConfig = z.infer<typeof CopyTradingBotConfigSchema>;
declare const SandwichBotConfigSchema: z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    userId: z.ZodString;
    name: z.ZodString;
    walletId: z.ZodString;
    isPaperTrading: z.ZodDefault<z.ZodBoolean>;
    maxDailyTrades: z.ZodDefault<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodString>;
    stopLossPercentage: z.ZodOptional<z.ZodNumber>;
    takeProfitPercentage: z.ZodOptional<z.ZodNumber>;
    botType: z.ZodLiteral<"sandwich">;
    configuration: z.ZodObject<{
        targetDEXes: z.ZodArray<z.ZodString, "many">;
        minVictimTradeSize: z.ZodString;
        maxGasBid: z.ZodString;
        profitThreshold: z.ZodNumber;
        mevRelays: z.ZodArray<z.ZodString, "many">;
        competitionAnalysis: z.ZodDefault<z.ZodBoolean>;
        bundleSettings: z.ZodObject<{
            maxBundleSize: z.ZodDefault<z.ZodNumber>;
            gasMultiplier: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            gasMultiplier: number;
            maxBundleSize: number;
        }, {
            maxBundleSize?: number | undefined;
            gasMultiplier?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        competitionAnalysis: boolean;
        bundleSettings: {
            gasMultiplier: number;
            maxBundleSize: number;
        };
    }, {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        bundleSettings: {
            maxBundleSize?: number | undefined;
            gasMultiplier?: number | undefined;
        };
        competitionAnalysis?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "sandwich";
    isPaperTrading: boolean;
    maxDailyTrades: number;
    configuration: {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        competitionAnalysis: boolean;
        bundleSettings: {
            gasMultiplier: number;
            maxBundleSize: number;
        };
    };
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "sandwich";
    configuration: {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        bundleSettings: {
            maxBundleSize?: number | undefined;
            gasMultiplier?: number | undefined;
        };
        competitionAnalysis?: boolean | undefined;
    };
    isActive?: boolean | undefined;
    isPaperTrading?: boolean | undefined;
    maxDailyTrades?: number | undefined;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}>;
type SandwichBotConfig = z.infer<typeof SandwichBotConfigSchema>;
declare const BotConfigSchema: z.ZodDiscriminatedUnion<"botType", [z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    userId: z.ZodString;
    name: z.ZodString;
    walletId: z.ZodString;
    isPaperTrading: z.ZodDefault<z.ZodBoolean>;
    maxDailyTrades: z.ZodDefault<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodString>;
    stopLossPercentage: z.ZodOptional<z.ZodNumber>;
    takeProfitPercentage: z.ZodOptional<z.ZodNumber>;
    botType: z.ZodLiteral<"arbitrage">;
    configuration: z.ZodObject<{
        tokenPairs: z.ZodArray<z.ZodObject<{
            tokenA: z.ZodString;
            tokenB: z.ZodString;
            chains: z.ZodArray<z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>, "many">;
        }, "strip", z.ZodTypeAny, {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }, {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }>, "many">;
        minProfitThreshold: z.ZodNumber;
        maxSlippage: z.ZodNumber;
        dexes: z.ZodArray<z.ZodString, "many">;
        gasMultiplier: z.ZodDefault<z.ZodNumber>;
        enableMEVProtection: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier: number;
        enableMEVProtection: boolean;
    }, {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier?: number | undefined;
        enableMEVProtection?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "arbitrage";
    isPaperTrading: boolean;
    maxDailyTrades: number;
    configuration: {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier: number;
        enableMEVProtection: boolean;
    };
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "arbitrage";
    configuration: {
        tokenPairs: {
            tokenA: string;
            tokenB: string;
            chains: ("ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism")[];
        }[];
        minProfitThreshold: number;
        maxSlippage: number;
        dexes: string[];
        gasMultiplier?: number | undefined;
        enableMEVProtection?: boolean | undefined;
    };
    isActive?: boolean | undefined;
    isPaperTrading?: boolean | undefined;
    maxDailyTrades?: number | undefined;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    userId: z.ZodString;
    name: z.ZodString;
    walletId: z.ZodString;
    isPaperTrading: z.ZodDefault<z.ZodBoolean>;
    maxDailyTrades: z.ZodDefault<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodString>;
    stopLossPercentage: z.ZodOptional<z.ZodNumber>;
    takeProfitPercentage: z.ZodOptional<z.ZodNumber>;
    botType: z.ZodLiteral<"copy_trader">;
    configuration: z.ZodObject<{
        targetAddresses: z.ZodArray<z.ZodObject<{
            address: z.ZodString;
            chain: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
            copyPercentage: z.ZodDefault<z.ZodNumber>;
            maxCopyAmount: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage: number;
            maxCopyAmount?: string | undefined;
        }, {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage?: number | undefined;
            maxCopyAmount?: string | undefined;
        }>, "many">;
        copySettings: z.ZodObject<{
            copyType: z.ZodDefault<z.ZodEnum<["fixed_amount", "percentage"]>>;
            fixedAmount: z.ZodOptional<z.ZodString>;
            percentage: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            percentage: number;
            copyType: "fixed_amount" | "percentage";
            fixedAmount?: string | undefined;
        }, {
            copyType?: "fixed_amount" | "percentage" | undefined;
            fixedAmount?: string | undefined;
            percentage?: number | undefined;
        }>;
        filters: z.ZodObject<{
            minTradeSize: z.ZodOptional<z.ZodString>;
            maxTradeSize: z.ZodOptional<z.ZodString>;
            excludeTokens: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            onlyVerifiedTokens: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            excludeTokens: string[];
            onlyVerifiedTokens: boolean;
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
        }, {
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
            excludeTokens?: string[] | undefined;
            onlyVerifiedTokens?: boolean | undefined;
        }>;
        latencyOptimization: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage: number;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            percentage: number;
            copyType: "fixed_amount" | "percentage";
            fixedAmount?: string | undefined;
        };
        filters: {
            excludeTokens: string[];
            onlyVerifiedTokens: boolean;
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
        };
        latencyOptimization: boolean;
    }, {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage?: number | undefined;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            copyType?: "fixed_amount" | "percentage" | undefined;
            fixedAmount?: string | undefined;
            percentage?: number | undefined;
        };
        filters: {
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
            excludeTokens?: string[] | undefined;
            onlyVerifiedTokens?: boolean | undefined;
        };
        latencyOptimization?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "copy_trader";
    isPaperTrading: boolean;
    maxDailyTrades: number;
    configuration: {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage: number;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            percentage: number;
            copyType: "fixed_amount" | "percentage";
            fixedAmount?: string | undefined;
        };
        filters: {
            excludeTokens: string[];
            onlyVerifiedTokens: boolean;
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
        };
        latencyOptimization: boolean;
    };
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "copy_trader";
    configuration: {
        targetAddresses: {
            address: string;
            chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
            copyPercentage?: number | undefined;
            maxCopyAmount?: string | undefined;
        }[];
        copySettings: {
            copyType?: "fixed_amount" | "percentage" | undefined;
            fixedAmount?: string | undefined;
            percentage?: number | undefined;
        };
        filters: {
            minTradeSize?: string | undefined;
            maxTradeSize?: string | undefined;
            excludeTokens?: string[] | undefined;
            onlyVerifiedTokens?: boolean | undefined;
        };
        latencyOptimization?: boolean | undefined;
    };
    isActive?: boolean | undefined;
    isPaperTrading?: boolean | undefined;
    maxDailyTrades?: number | undefined;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    userId: z.ZodString;
    name: z.ZodString;
    walletId: z.ZodString;
    isPaperTrading: z.ZodDefault<z.ZodBoolean>;
    maxDailyTrades: z.ZodDefault<z.ZodNumber>;
    maxPositionSize: z.ZodOptional<z.ZodString>;
    stopLossPercentage: z.ZodOptional<z.ZodNumber>;
    takeProfitPercentage: z.ZodOptional<z.ZodNumber>;
    botType: z.ZodLiteral<"sandwich">;
    configuration: z.ZodObject<{
        targetDEXes: z.ZodArray<z.ZodString, "many">;
        minVictimTradeSize: z.ZodString;
        maxGasBid: z.ZodString;
        profitThreshold: z.ZodNumber;
        mevRelays: z.ZodArray<z.ZodString, "many">;
        competitionAnalysis: z.ZodDefault<z.ZodBoolean>;
        bundleSettings: z.ZodObject<{
            maxBundleSize: z.ZodDefault<z.ZodNumber>;
            gasMultiplier: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            gasMultiplier: number;
            maxBundleSize: number;
        }, {
            maxBundleSize?: number | undefined;
            gasMultiplier?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        competitionAnalysis: boolean;
        bundleSettings: {
            gasMultiplier: number;
            maxBundleSize: number;
        };
    }, {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        bundleSettings: {
            maxBundleSize?: number | undefined;
            gasMultiplier?: number | undefined;
        };
        competitionAnalysis?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "sandwich";
    isPaperTrading: boolean;
    maxDailyTrades: number;
    configuration: {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        competitionAnalysis: boolean;
        bundleSettings: {
            gasMultiplier: number;
            maxBundleSize: number;
        };
    };
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    walletId: string;
    botType: "sandwich";
    configuration: {
        targetDEXes: string[];
        minVictimTradeSize: string;
        maxGasBid: string;
        profitThreshold: number;
        mevRelays: string[];
        bundleSettings: {
            maxBundleSize?: number | undefined;
            gasMultiplier?: number | undefined;
        };
        competitionAnalysis?: boolean | undefined;
    };
    isActive?: boolean | undefined;
    isPaperTrading?: boolean | undefined;
    maxDailyTrades?: number | undefined;
    maxPositionSize?: string | undefined;
    stopLossPercentage?: number | undefined;
    takeProfitPercentage?: number | undefined;
}>]>;
type BotConfig = z.infer<typeof BotConfigSchema>;
declare const BotStateSchema: z.ZodObject<{
    botId: z.ZodString;
    status: z.ZodEnum<["idle", "running", "paused", "error", "stopped"]>;
    lastActivity: z.ZodDate;
    errorCount: z.ZodDefault<z.ZodNumber>;
    lastError: z.ZodOptional<z.ZodString>;
    performanceMetrics: z.ZodObject<{
        totalTrades: z.ZodDefault<z.ZodNumber>;
        successfulTrades: z.ZodDefault<z.ZodNumber>;
        totalProfit: z.ZodDefault<z.ZodString>;
        totalLoss: z.ZodDefault<z.ZodString>;
        winRate: z.ZodDefault<z.ZodNumber>;
        avgExecutionTime: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        totalTrades: number;
        successfulTrades: number;
        totalProfit: string;
        totalLoss: string;
        winRate: number;
        avgExecutionTime: number;
    }, {
        totalTrades?: number | undefined;
        successfulTrades?: number | undefined;
        totalProfit?: string | undefined;
        totalLoss?: string | undefined;
        winRate?: number | undefined;
        avgExecutionTime?: number | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "idle" | "running" | "paused" | "stopped";
    botId: string;
    lastActivity: Date;
    errorCount: number;
    performanceMetrics: {
        totalTrades: number;
        successfulTrades: number;
        totalProfit: string;
        totalLoss: string;
        winRate: number;
        avgExecutionTime: number;
    };
    lastError?: string | undefined;
}, {
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "idle" | "running" | "paused" | "stopped";
    botId: string;
    lastActivity: Date;
    performanceMetrics: {
        totalTrades?: number | undefined;
        successfulTrades?: number | undefined;
        totalProfit?: string | undefined;
        totalLoss?: string | undefined;
        winRate?: number | undefined;
        avgExecutionTime?: number | undefined;
    };
    errorCount?: number | undefined;
    lastError?: string | undefined;
}>;
type BotState = z.infer<typeof BotStateSchema>;

declare const PerformanceMetricsSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    botConfigId: z.ZodString;
    date: z.ZodDate;
    totalTrades: z.ZodDefault<z.ZodNumber>;
    successfulTrades: z.ZodDefault<z.ZodNumber>;
    totalVolume: z.ZodDefault<z.ZodString>;
    totalProfitLoss: z.ZodDefault<z.ZodString>;
    totalProfitLossUSD: z.ZodDefault<z.ZodNumber>;
    maxDrawdown: z.ZodDefault<z.ZodNumber>;
    sharpeRatio: z.ZodOptional<z.ZodNumber>;
    winRate: z.ZodDefault<z.ZodNumber>;
    averageTradeSize: z.ZodDefault<z.ZodString>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    userId: string;
    date: Date;
    totalTrades: number;
    successfulTrades: number;
    winRate: number;
    botConfigId: string;
    totalVolume: string;
    totalProfitLoss: string;
    totalProfitLossUSD: number;
    maxDrawdown: number;
    averageTradeSize: string;
    sharpeRatio?: number | undefined;
}, {
    id: string;
    createdAt: Date;
    userId: string;
    date: Date;
    botConfigId: string;
    totalTrades?: number | undefined;
    successfulTrades?: number | undefined;
    totalVolume?: string | undefined;
    totalProfitLoss?: string | undefined;
    totalProfitLossUSD?: number | undefined;
    maxDrawdown?: number | undefined;
    sharpeRatio?: number | undefined;
    winRate?: number | undefined;
    averageTradeSize?: string | undefined;
}>;
type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
declare const AlertTypeSchema: z.ZodEnum<["trade_executed", "profit_target", "stop_loss", "error", "system"]>;
declare const AlertSeveritySchema: z.ZodEnum<["info", "warning", "error", "critical"]>;
declare const AlertSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    botConfigId: z.ZodOptional<z.ZodString>;
    alertType: z.ZodEnum<["trade_executed", "profit_target", "stop_loss", "error", "system"]>;
    title: z.ZodString;
    message: z.ZodString;
    severity: z.ZodDefault<z.ZodEnum<["info", "warning", "error", "critical"]>>;
    isRead: z.ZodDefault<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    message: string;
    userId: string;
    alertType: "error" | "trade_executed" | "profit_target" | "stop_loss" | "system";
    title: string;
    severity: "error" | "info" | "warning" | "critical";
    isRead: boolean;
    botConfigId?: string | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    id: string;
    createdAt: Date;
    message: string;
    userId: string;
    alertType: "error" | "trade_executed" | "profit_target" | "stop_loss" | "system";
    title: string;
    botConfigId?: string | undefined;
    severity?: "error" | "info" | "warning" | "critical" | undefined;
    isRead?: boolean | undefined;
    metadata?: Record<string, any> | undefined;
}>;
type Alert = z.infer<typeof AlertSchema>;
declare const APIKeySchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    serviceName: z.ZodString;
    encryptedApiKey: z.ZodString;
    encryptedSecretKey: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    serviceName: string;
    encryptedApiKey: string;
    encryptedSecretKey?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    serviceName: string;
    encryptedApiKey: string;
    encryptedSecretKey?: string | undefined;
    isActive?: boolean | undefined;
}>;
type APIKey = z.infer<typeof APIKeySchema>;
declare const DatabaseConfigSchema: z.ZodObject<{
    host: z.ZodString;
    port: z.ZodNumber;
    database: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    ssl: z.ZodDefault<z.ZodBoolean>;
    maxConnections: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    password: string;
    host: string;
    port: number;
    database: string;
    username: string;
    ssl: boolean;
    maxConnections: number;
}, {
    password: string;
    host: string;
    port: number;
    database: string;
    username: string;
    ssl?: boolean | undefined;
    maxConnections?: number | undefined;
}>;
type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

declare const APIResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDefault<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    timestamp: Date;
    data?: any;
    error?: string | undefined;
    message?: string | undefined;
}, {
    success: boolean;
    data?: any;
    error?: string | undefined;
    message?: string | undefined;
    timestamp?: Date | undefined;
}>;
type APIResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: Date;
};
declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    total: z.ZodOptional<z.ZodNumber>;
    totalPages: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    total?: number | undefined;
    totalPages?: number | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    total?: number | undefined;
    totalPages?: number | undefined;
}>;
type Pagination = z.infer<typeof PaginationSchema>;
declare const PaginatedResponseSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodArray<T, "many">;
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        total: z.ZodOptional<z.ZodNumber>;
        totalPages: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        total?: number | undefined;
        totalPages?: number | undefined;
    }, {
        page?: number | undefined;
        limit?: number | undefined;
        total?: number | undefined;
        totalPages?: number | undefined;
    }>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    data: T["_output"][];
    success: boolean;
    pagination: {
        page: number;
        limit: number;
        total?: number | undefined;
        totalPages?: number | undefined;
    };
    error?: string | undefined;
}, {
    data: T["_input"][];
    success: boolean;
    pagination: {
        page?: number | undefined;
        limit?: number | undefined;
        total?: number | undefined;
        totalPages?: number | undefined;
    };
    error?: string | undefined;
}>;
type PaginatedResponse<T> = {
    success: boolean;
    data: T[];
    pagination: Pagination;
    error?: string;
};
declare const HTTPMethodSchema: z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>;
type HTTPMethod = z.infer<typeof HTTPMethodSchema>;
declare const RequestHeadersSchema: z.ZodObject<{
    Authorization: z.ZodOptional<z.ZodString>;
    'Content-Type': z.ZodOptional<z.ZodString>;
    'X-API-Key': z.ZodOptional<z.ZodString>;
    'User-Agent': z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    Authorization?: string | undefined;
    'Content-Type'?: string | undefined;
    'X-API-Key'?: string | undefined;
    'User-Agent'?: string | undefined;
}, {
    Authorization?: string | undefined;
    'Content-Type'?: string | undefined;
    'X-API-Key'?: string | undefined;
    'User-Agent'?: string | undefined;
}>;
type RequestHeaders = z.infer<typeof RequestHeadersSchema>;
declare const RateLimitSchema: z.ZodObject<{
    limit: z.ZodNumber;
    remaining: z.ZodNumber;
    reset: z.ZodNumber;
    retryAfter: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number | undefined;
}, {
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number | undefined;
}>;
type RateLimit = z.infer<typeof RateLimitSchema>;

declare const TradeTypeSchema: z.ZodEnum<["buy", "sell", "swap", "arbitrage", "sandwich", "liquidation"]>;
type TradeType = z.infer<typeof TradeTypeSchema>;
declare const TradeStatusSchema: z.ZodEnum<["pending", "confirmed", "failed", "cancelled"]>;
type TradeStatus = z.infer<typeof TradeStatusSchema>;
declare const TradeSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    botConfigId: z.ZodOptional<z.ZodString>;
    walletId: z.ZodString;
    transactionHash: z.ZodOptional<z.ZodString>;
    chain: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
    tradeType: z.ZodEnum<["buy", "sell", "swap", "arbitrage", "sandwich", "liquidation"]>;
    tokenIn: z.ZodString;
    tokenOut: z.ZodString;
    amountIn: z.ZodString;
    amountOut: z.ZodString;
    gasUsed: z.ZodOptional<z.ZodString>;
    gasPrice: z.ZodOptional<z.ZodString>;
    profitLoss: z.ZodOptional<z.ZodString>;
    profitLossUSD: z.ZodOptional<z.ZodNumber>;
    slippage: z.ZodOptional<z.ZodNumber>;
    dex: z.ZodOptional<z.ZodEnum<["uniswap_v2", "uniswap_v3", "sushiswap", "pancakeswap", "jupiter", "raydium", "orca", "serum", "1inch", "paraswap", "kyber", "balancer"]>>;
    isPaperTrade: z.ZodDefault<z.ZodBoolean>;
    executedAt: z.ZodDate;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    userId: string;
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    walletId: string;
    tradeType: "arbitrage" | "sandwich" | "liquidation" | "buy" | "sell" | "swap";
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    isPaperTrade: boolean;
    executedAt: Date;
    botConfigId?: string | undefined;
    transactionHash?: string | undefined;
    gasUsed?: string | undefined;
    gasPrice?: string | undefined;
    profitLoss?: string | undefined;
    profitLossUSD?: number | undefined;
    slippage?: number | undefined;
    dex?: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer" | undefined;
}, {
    id: string;
    createdAt: Date;
    userId: string;
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    walletId: string;
    tradeType: "arbitrage" | "sandwich" | "liquidation" | "buy" | "sell" | "swap";
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    executedAt: Date;
    botConfigId?: string | undefined;
    transactionHash?: string | undefined;
    gasUsed?: string | undefined;
    gasPrice?: string | undefined;
    profitLoss?: string | undefined;
    profitLossUSD?: number | undefined;
    slippage?: number | undefined;
    dex?: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer" | undefined;
    isPaperTrade?: boolean | undefined;
}>;
type Trade = z.infer<typeof TradeSchema>;
declare const QuoteSchema: z.ZodObject<{
    tokenIn: z.ZodString;
    tokenOut: z.ZodString;
    amountIn: z.ZodString;
    amountOut: z.ZodString;
    price: z.ZodNumber;
    priceImpact: z.ZodNumber;
    gasEstimate: z.ZodString;
    route: z.ZodArray<z.ZodObject<{
        dex: z.ZodEnum<["uniswap_v2", "uniswap_v3", "sushiswap", "pancakeswap", "jupiter", "raydium", "orca", "serum", "1inch", "paraswap", "kyber", "balancer"]>;
        percentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        percentage: number;
        dex: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    }, {
        percentage: number;
        dex: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    }>, "many">;
    validUntil: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    price: number;
    priceImpact: number;
    gasEstimate: string;
    route: {
        percentage: number;
        dex: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    }[];
    validUntil: Date;
}, {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    price: number;
    priceImpact: number;
    gasEstimate: string;
    route: {
        percentage: number;
        dex: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    }[];
    validUntil: Date;
}>;
type Quote = z.infer<typeof QuoteSchema>;
declare const ArbitrageOpportunitySchema: z.ZodObject<{
    id: z.ZodString;
    tokenPair: z.ZodString;
    dexA: z.ZodEnum<["uniswap_v2", "uniswap_v3", "sushiswap", "pancakeswap", "jupiter", "raydium", "orca", "serum", "1inch", "paraswap", "kyber", "balancer"]>;
    dexB: z.ZodEnum<["uniswap_v2", "uniswap_v3", "sushiswap", "pancakeswap", "jupiter", "raydium", "orca", "serum", "1inch", "paraswap", "kyber", "balancer"]>;
    priceA: z.ZodNumber;
    priceB: z.ZodNumber;
    profitPotential: z.ZodNumber;
    profitAfterGas: z.ZodNumber;
    gasEstimate: z.ZodString;
    discoveredAt: z.ZodDate;
    expiresAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    expiresAt: Date;
    gasEstimate: string;
    tokenPair: string;
    dexA: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    dexB: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    priceA: number;
    priceB: number;
    profitPotential: number;
    profitAfterGas: number;
    discoveredAt: Date;
}, {
    id: string;
    expiresAt: Date;
    gasEstimate: string;
    tokenPair: string;
    dexA: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    dexB: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    priceA: number;
    priceB: number;
    profitPotential: number;
    profitAfterGas: number;
    discoveredAt: Date;
}>;
type ArbitrageOpportunity = z.infer<typeof ArbitrageOpportunitySchema>;
declare const TradingPairSchema: z.ZodObject<{
    tokenA: z.ZodString;
    tokenB: z.ZodString;
    chain: z.ZodEnum<["ethereum", "bsc", "solana", "polygon", "arbitrum", "optimism"]>;
    dex: z.ZodEnum<["uniswap_v2", "uniswap_v3", "sushiswap", "pancakeswap", "jupiter", "raydium", "orca", "serum", "1inch", "paraswap", "kyber", "balancer"]>;
    liquidity: z.ZodString;
    volume24h: z.ZodString;
    fee: z.ZodNumber;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    fee: number;
    tokenA: string;
    tokenB: string;
    dex: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    liquidity: string;
    volume24h: string;
}, {
    chain: "ethereum" | "bsc" | "solana" | "polygon" | "arbitrum" | "optimism";
    fee: number;
    tokenA: string;
    tokenB: string;
    dex: "uniswap_v2" | "uniswap_v3" | "sushiswap" | "pancakeswap" | "jupiter" | "raydium" | "orca" | "serum" | "1inch" | "paraswap" | "kyber" | "balancer";
    liquidity: string;
    volume24h: string;
    isActive?: boolean | undefined;
}>;
type TradingPair = z.infer<typeof TradingPairSchema>;
declare const MarketDataSchema: z.ZodObject<{
    symbol: z.ZodString;
    price: z.ZodNumber;
    priceChange24h: z.ZodNumber;
    volume24h: z.ZodString;
    marketCap: z.ZodOptional<z.ZodString>;
    liquidity: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    timestamp: Date;
    price: number;
    volume24h: string;
    priceChange24h: number;
    marketCap?: string | undefined;
    liquidity?: string | undefined;
}, {
    symbol: string;
    timestamp: Date;
    price: number;
    volume24h: string;
    priceChange24h: number;
    marketCap?: string | undefined;
    liquidity?: string | undefined;
}>;
type MarketData = z.infer<typeof MarketDataSchema>;
declare const OrderBookEntrySchema: z.ZodObject<{
    price: z.ZodNumber;
    amount: z.ZodString;
    total: z.ZodString;
}, "strip", z.ZodTypeAny, {
    total: string;
    price: number;
    amount: string;
}, {
    total: string;
    price: number;
    amount: string;
}>;
declare const OrderBookSchema: z.ZodObject<{
    symbol: z.ZodString;
    bids: z.ZodArray<z.ZodObject<{
        price: z.ZodNumber;
        amount: z.ZodString;
        total: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        total: string;
        price: number;
        amount: string;
    }, {
        total: string;
        price: number;
        amount: string;
    }>, "many">;
    asks: z.ZodArray<z.ZodObject<{
        price: z.ZodNumber;
        amount: z.ZodString;
        total: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        total: string;
        price: number;
        amount: string;
    }, {
        total: string;
        price: number;
        amount: string;
    }>, "many">;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    timestamp: Date;
    bids: {
        total: string;
        price: number;
        amount: string;
    }[];
    asks: {
        total: string;
        price: number;
        amount: string;
    }[];
}, {
    symbol: string;
    timestamp: Date;
    bids: {
        total: string;
        price: number;
        amount: string;
    }[];
    asks: {
        total: string;
        price: number;
        amount: string;
    }[];
}>;
type OrderBookEntry = z.infer<typeof OrderBookEntrySchema>;
type OrderBook = z.infer<typeof OrderBookSchema>;

declare const RiskParametersSchema: z.ZodObject<{
    maxPositionSize: z.ZodString;
    maxDailyLoss: z.ZodString;
    stopLossPercentage: z.ZodNumber;
    takeProfitPercentage: z.ZodNumber;
    maxSlippage: z.ZodNumber;
    maxGasPrice: z.ZodString;
    volatilityThreshold: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    maxPositionSize: string;
    stopLossPercentage: number;
    takeProfitPercentage: number;
    maxSlippage: number;
    maxDailyLoss: string;
    maxGasPrice: string;
    volatilityThreshold: number;
}, {
    maxPositionSize: string;
    stopLossPercentage: number;
    takeProfitPercentage: number;
    maxSlippage: number;
    maxDailyLoss: string;
    maxGasPrice: string;
    volatilityThreshold: number;
}>;
type RiskParameters = z.infer<typeof RiskParametersSchema>;
declare const RiskEventTypeSchema: z.ZodEnum<["stop_loss", "position_limit", "daily_limit", "volatility_halt", "gas_spike", "slippage_exceeded", "correlation_breach"]>;
declare const RiskEventSeveritySchema: z.ZodEnum<["low", "medium", "high", "critical"]>;
declare const RiskEventSchema: z.ZodObject<{
    id: z.ZodString;
    botId: z.ZodString;
    eventType: z.ZodEnum<["stop_loss", "position_limit", "daily_limit", "volatility_halt", "gas_spike", "slippage_exceeded", "correlation_breach"]>;
    severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
    description: z.ZodString;
    actionTaken: z.ZodOptional<z.ZodString>;
    positionSizeBefore: z.ZodOptional<z.ZodString>;
    positionSizeAfter: z.ZodOptional<z.ZodString>;
    triggerValue: z.ZodNumber;
    thresholdValue: z.ZodNumber;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    botId: string;
    severity: "low" | "medium" | "high" | "critical";
    eventType: "stop_loss" | "position_limit" | "daily_limit" | "volatility_halt" | "gas_spike" | "slippage_exceeded" | "correlation_breach";
    description: string;
    triggerValue: number;
    thresholdValue: number;
    actionTaken?: string | undefined;
    positionSizeBefore?: string | undefined;
    positionSizeAfter?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    botId: string;
    severity: "low" | "medium" | "high" | "critical";
    eventType: "stop_loss" | "position_limit" | "daily_limit" | "volatility_halt" | "gas_spike" | "slippage_exceeded" | "correlation_breach";
    description: string;
    triggerValue: number;
    thresholdValue: number;
    actionTaken?: string | undefined;
    positionSizeBefore?: string | undefined;
    positionSizeAfter?: string | undefined;
}>;
type RiskEvent = z.infer<typeof RiskEventSchema>;

declare const MEVOpportunityTypeSchema: z.ZodEnum<["sandwich", "arbitrage", "liquidation", "jit_liquidity"]>;
type MEVOpportunityType = z.infer<typeof MEVOpportunityTypeSchema>;
declare const BundleTransactionSchema: z.ZodObject<{
    to: z.ZodString;
    data: z.ZodString;
    value: z.ZodDefault<z.ZodString>;
    gasLimit: z.ZodString;
    gasPrice: z.ZodOptional<z.ZodString>;
    maxFeePerGas: z.ZodOptional<z.ZodString>;
    maxPriorityFeePerGas: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string;
    data: string;
    to: string;
    gasLimit: string;
    gasPrice?: string | undefined;
    maxFeePerGas?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
}, {
    data: string;
    to: string;
    gasLimit: string;
    value?: string | undefined;
    gasPrice?: string | undefined;
    maxFeePerGas?: string | undefined;
    maxPriorityFeePerGas?: string | undefined;
}>;
type BundleTransaction = z.infer<typeof BundleTransactionSchema>;
declare const MEVBundleSchema: z.ZodObject<{
    id: z.ZodString;
    transactions: z.ZodArray<z.ZodObject<{
        to: z.ZodString;
        data: z.ZodString;
        value: z.ZodDefault<z.ZodString>;
        gasLimit: z.ZodString;
        gasPrice: z.ZodOptional<z.ZodString>;
        maxFeePerGas: z.ZodOptional<z.ZodString>;
        maxPriorityFeePerGas: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        data: string;
        to: string;
        gasLimit: string;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }, {
        data: string;
        to: string;
        gasLimit: string;
        value?: string | undefined;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }>, "many">;
    blockNumber: z.ZodNumber;
    minTimestamp: z.ZodOptional<z.ZodNumber>;
    maxTimestamp: z.ZodOptional<z.ZodNumber>;
    revertingTxHashes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    blockNumber: number;
    transactions: {
        value: string;
        data: string;
        to: string;
        gasLimit: string;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }[];
    minTimestamp?: number | undefined;
    maxTimestamp?: number | undefined;
    revertingTxHashes?: string[] | undefined;
}, {
    id: string;
    blockNumber: number;
    transactions: {
        data: string;
        to: string;
        gasLimit: string;
        value?: string | undefined;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }[];
    minTimestamp?: number | undefined;
    maxTimestamp?: number | undefined;
    revertingTxHashes?: string[] | undefined;
}>;
type MEVBundle = z.infer<typeof MEVBundleSchema>;
declare const FlashbotsBundleSchema: z.ZodObject<{
    txs: z.ZodArray<z.ZodString, "many">;
    blockNumber: z.ZodString;
    minTimestamp: z.ZodOptional<z.ZodNumber>;
    maxTimestamp: z.ZodOptional<z.ZodNumber>;
    revertingTxHashes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    blockNumber: string;
    txs: string[];
    minTimestamp?: number | undefined;
    maxTimestamp?: number | undefined;
    revertingTxHashes?: string[] | undefined;
}, {
    blockNumber: string;
    txs: string[];
    minTimestamp?: number | undefined;
    maxTimestamp?: number | undefined;
    revertingTxHashes?: string[] | undefined;
}>;
type FlashbotsBundle = z.infer<typeof FlashbotsBundleSchema>;
declare const MEVOpportunitySchema: z.ZodObject<{
    id: z.ZodString;
    botId: z.ZodString;
    opportunityType: z.ZodEnum<["sandwich", "arbitrage", "liquidation", "jit_liquidity"]>;
    targetTransaction: z.ZodOptional<z.ZodString>;
    bundleTransactions: z.ZodArray<z.ZodObject<{
        to: z.ZodString;
        data: z.ZodString;
        value: z.ZodDefault<z.ZodString>;
        gasLimit: z.ZodString;
        gasPrice: z.ZodOptional<z.ZodString>;
        maxFeePerGas: z.ZodOptional<z.ZodString>;
        maxPriorityFeePerGas: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        data: string;
        to: string;
        gasLimit: string;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }, {
        data: string;
        to: string;
        gasLimit: string;
        value?: string | undefined;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }>, "many">;
    estimatedProfit: z.ZodString;
    gasBid: z.ZodString;
    competitionLevel: z.ZodDefault<z.ZodNumber>;
    isSubmitted: z.ZodDefault<z.ZodBoolean>;
    isSuccessful: z.ZodDefault<z.ZodBoolean>;
    actualProfit: z.ZodOptional<z.ZodString>;
    discoveredAt: z.ZodDate;
    submittedAt: z.ZodOptional<z.ZodDate>;
    confirmedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    id: string;
    botId: string;
    discoveredAt: Date;
    opportunityType: "arbitrage" | "sandwich" | "liquidation" | "jit_liquidity";
    bundleTransactions: {
        value: string;
        data: string;
        to: string;
        gasLimit: string;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }[];
    estimatedProfit: string;
    gasBid: string;
    competitionLevel: number;
    isSubmitted: boolean;
    isSuccessful: boolean;
    targetTransaction?: string | undefined;
    actualProfit?: string | undefined;
    submittedAt?: Date | undefined;
    confirmedAt?: Date | undefined;
}, {
    id: string;
    botId: string;
    discoveredAt: Date;
    opportunityType: "arbitrage" | "sandwich" | "liquidation" | "jit_liquidity";
    bundleTransactions: {
        data: string;
        to: string;
        gasLimit: string;
        value?: string | undefined;
        gasPrice?: string | undefined;
        maxFeePerGas?: string | undefined;
        maxPriorityFeePerGas?: string | undefined;
    }[];
    estimatedProfit: string;
    gasBid: string;
    targetTransaction?: string | undefined;
    competitionLevel?: number | undefined;
    isSubmitted?: boolean | undefined;
    isSuccessful?: boolean | undefined;
    actualProfit?: string | undefined;
    submittedAt?: Date | undefined;
    confirmedAt?: Date | undefined;
}>;
type MEVOpportunity = z.infer<typeof MEVOpportunitySchema>;

declare const AIStrategyTypeSchema: z.ZodEnum<["reinforcement_learning", "ensemble", "neural_network", "genetic_algorithm", "sentiment_analysis", "pattern_recognition"]>;
type AIStrategyType = z.infer<typeof AIStrategyTypeSchema>;
declare const MLModelConfigSchema: z.ZodObject<{
    modelType: z.ZodEnum<["reinforcement_learning", "ensemble", "neural_network", "genetic_algorithm", "sentiment_analysis", "pattern_recognition"]>;
    parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    trainingData: z.ZodObject<{
        features: z.ZodArray<z.ZodString, "many">;
        targetVariable: z.ZodString;
        timeframe: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        features: string[];
        targetVariable: string;
        timeframe: string;
    }, {
        features: string[];
        targetVariable: string;
        timeframe: string;
    }>;
    performance: z.ZodOptional<z.ZodObject<{
        accuracy: z.ZodOptional<z.ZodNumber>;
        precision: z.ZodOptional<z.ZodNumber>;
        recall: z.ZodOptional<z.ZodNumber>;
        f1Score: z.ZodOptional<z.ZodNumber>;
        sharpeRatio: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        accuracy?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        sharpeRatio?: number | undefined;
    }, {
        accuracy?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        sharpeRatio?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    modelType: "reinforcement_learning" | "ensemble" | "neural_network" | "genetic_algorithm" | "sentiment_analysis" | "pattern_recognition";
    parameters: Record<string, any>;
    trainingData: {
        features: string[];
        targetVariable: string;
        timeframe: string;
    };
    performance?: {
        accuracy?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        sharpeRatio?: number | undefined;
    } | undefined;
}, {
    modelType: "reinforcement_learning" | "ensemble" | "neural_network" | "genetic_algorithm" | "sentiment_analysis" | "pattern_recognition";
    parameters: Record<string, any>;
    trainingData: {
        features: string[];
        targetVariable: string;
        timeframe: string;
    };
    performance?: {
        accuracy?: number | undefined;
        precision?: number | undefined;
        recall?: number | undefined;
        f1Score?: number | undefined;
        sharpeRatio?: number | undefined;
    } | undefined;
}>;
type MLModelConfig = z.infer<typeof MLModelConfigSchema>;
declare const FeatureSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["technical", "fundamental", "sentiment", "on_chain"]>;
    timeframe: z.ZodString;
    value: z.ZodNumber;
    timestamp: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "technical" | "fundamental" | "sentiment" | "on_chain";
    value: number;
    timestamp: Date;
    name: string;
    timeframe: string;
}, {
    type: "technical" | "fundamental" | "sentiment" | "on_chain";
    value: number;
    timestamp: Date;
    name: string;
    timeframe: string;
}>;
type Feature = z.infer<typeof FeatureSchema>;
declare const PredictionSchema: z.ZodObject<{
    symbol: z.ZodString;
    prediction: z.ZodNumber;
    confidence: z.ZodNumber;
    timeframe: z.ZodString;
    features: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["technical", "fundamental", "sentiment", "on_chain"]>;
        timeframe: z.ZodString;
        value: z.ZodNumber;
        timestamp: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        type: "technical" | "fundamental" | "sentiment" | "on_chain";
        value: number;
        timestamp: Date;
        name: string;
        timeframe: string;
    }, {
        type: "technical" | "fundamental" | "sentiment" | "on_chain";
        value: number;
        timestamp: Date;
        name: string;
        timeframe: string;
    }>, "many">;
    modelId: z.ZodString;
    createdAt: z.ZodDate;
    expiresAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    createdAt: Date;
    expiresAt: Date;
    features: {
        type: "technical" | "fundamental" | "sentiment" | "on_chain";
        value: number;
        timestamp: Date;
        name: string;
        timeframe: string;
    }[];
    timeframe: string;
    prediction: number;
    confidence: number;
    modelId: string;
}, {
    symbol: string;
    createdAt: Date;
    expiresAt: Date;
    features: {
        type: "technical" | "fundamental" | "sentiment" | "on_chain";
        value: number;
        timestamp: Date;
        name: string;
        timeframe: string;
    }[];
    timeframe: string;
    prediction: number;
    confidence: number;
    modelId: string;
}>;
type Prediction = z.infer<typeof PredictionSchema>;

declare const WSMessageTypeSchema: z.ZodEnum<["trade_executed", "bot_status", "price_update", "alert", "error", "connection_status", "heartbeat"]>;
type WSMessageType = z.infer<typeof WSMessageTypeSchema>;
declare const WSMessageSchema: z.ZodObject<{
    type: z.ZodEnum<["trade_executed", "bot_status", "price_update", "alert", "error", "connection_status", "heartbeat"]>;
    data: z.ZodAny;
    timestamp: z.ZodDate;
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "error" | "trade_executed" | "bot_status" | "price_update" | "alert" | "connection_status" | "heartbeat";
    timestamp: Date;
    data?: any;
    id?: string | undefined;
}, {
    type: "error" | "trade_executed" | "bot_status" | "price_update" | "alert" | "connection_status" | "heartbeat";
    timestamp: Date;
    data?: any;
    id?: string | undefined;
}>;
type WSMessage = z.infer<typeof WSMessageSchema>;
declare const ConnectionStatusSchema: z.ZodEnum<["connecting", "connected", "disconnected", "error", "reconnecting"]>;
type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
declare const WSConnectionSchema: z.ZodObject<{
    id: z.ZodString;
    botId: z.ZodString;
    connectionType: z.ZodEnum<["rpc", "dex_data", "mempool", "price_feed"]>;
    endpoint: z.ZodString;
    status: z.ZodEnum<["connecting", "connected", "disconnected", "error", "reconnecting"]>;
    lastMessageAt: z.ZodOptional<z.ZodDate>;
    reconnectCount: z.ZodDefault<z.ZodNumber>;
    errorCount: z.ZodDefault<z.ZodNumber>;
    lastError: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "connecting" | "connected" | "disconnected" | "reconnecting";
    botId: string;
    errorCount: number;
    connectionType: "rpc" | "dex_data" | "mempool" | "price_feed";
    endpoint: string;
    reconnectCount: number;
    lastMessageAt?: Date | undefined;
    lastError?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "connecting" | "connected" | "disconnected" | "reconnecting";
    botId: string;
    connectionType: "rpc" | "dex_data" | "mempool" | "price_feed";
    endpoint: string;
    lastMessageAt?: Date | undefined;
    reconnectCount?: number | undefined;
    errorCount?: number | undefined;
    lastError?: string | undefined;
}>;
type WSConnection = z.infer<typeof WSConnectionSchema>;

export { type AIStrategyType, AIStrategyTypeSchema, type APIKey, APIKeySchema, type APIResponse, APIResponseSchema, type Alert, AlertSchema, AlertSeveritySchema, AlertTypeSchema, type ArbitrageBotConfig, ArbitrageBotConfigSchema, type ArbitrageOpportunity, ArbitrageOpportunitySchema, type AuthResponse, AuthResponseSchema, type BaseBotConfig, BaseBotConfigSchema, type Block, BlockSchema, type BotConfig, BotConfigSchema, type BotState, BotStateSchema, type BotStatus, BotStatusSchema, type BotType, BotTypeSchema, type BundleTransaction, BundleTransactionSchema, type Chain, type ChainConfig, ChainConfigSchema, ChainSchema, type ConnectionStatus, ConnectionStatusSchema, type CopyTradingBotConfig, CopyTradingBotConfigSchema, type DEX, type DEXConfig, DEXConfigSchema, DEXSchema, type DatabaseConfig, DatabaseConfigSchema, type Feature, FeatureSchema, type FlashbotsBundle, FlashbotsBundleSchema, type GasEstimate, GasEstimateSchema, type HTTPMethod, HTTPMethodSchema, type JWTPayload, JWTPayloadSchema, type LoginRequest, LoginRequestSchema, type MEVBundle, MEVBundleSchema, type MEVOpportunity, MEVOpportunitySchema, type MEVOpportunityType, MEVOpportunityTypeSchema, type MLModelConfig, MLModelConfigSchema, type MarketData, MarketDataSchema, type OrderBook, type OrderBookEntry, OrderBookEntrySchema, OrderBookSchema, type PaginatedResponse, PaginatedResponseSchema, type Pagination, PaginationSchema, type PerformanceMetrics, PerformanceMetricsSchema, type Prediction, PredictionSchema, type Quote, QuoteSchema, type RateLimit, RateLimitSchema, type RegisterRequest, RegisterRequestSchema, type RequestHeaders, RequestHeadersSchema, type RiskEvent, RiskEventSchema, RiskEventSeveritySchema, RiskEventTypeSchema, type RiskParameters, RiskParametersSchema, type SandwichBotConfig, SandwichBotConfigSchema, type Session, SessionSchema, type Token, TokenSchema, type Trade, TradeSchema, type TradeStatus, TradeStatusSchema, type TradeType, TradeTypeSchema, type TradingPair, TradingPairSchema, type Transaction, TransactionSchema, type User, type UserProfile, UserProfileSchema, UserSchema, type WSConnection, WSConnectionSchema, type WSMessage, WSMessageSchema, type WSMessageType, WSMessageTypeSchema, type Wallet, WalletSchema };
