import { CopyTraderBotConfig, Chain, Trade } from "@trading-bot/types";
import { createChainClient } from "@trading-bot/chain-client";
import { Wallet, WebSocketProvider, Interface, parseUnits, JsonRpcProvider } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";

// --- Configuration ---
const COPY_TRADE_CONFIG: CopyTraderBotConfig = {
  id: "1",
  userId: "user-123",
  walletId: "wallet-1",
  chain: "ETH" as Chain,
  targetWalletAddress: process.env.TARGET_WALLET_ADDRESS || "0x...", // IMPORTANT: Target wallet to copy
  tradeSize: {
    type: "FIXED",
    value: 0.1, // e.g., 0.1 ETH per trade
  },
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const CHAIN: Chain = (process.env.CHAIN as Chain) || "ETH";
const WEBSOCKET_RPC_URL = process.env.ETH_WEBSOCKET_RPC_URL!; // IMPORTANT: Use a WSS RPC URL
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const SOLANA_WEBSOCKET_RPC_URL = process.env.SOLANA_WEBSOCKET_RPC_URL!;
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY!;

// A common ABI for Uniswap V2-like routers
const UNISWAP_V2_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
];
const uniswapInterface = new Interface(UNISWAP_V2_ROUTER_ABI);

// --- EVM Logic ---
async function startEvmCopyTrader() {
  if (!WEBSOCKET_RPC_URL || !PRIVATE_KEY) {
    throw new Error("Missing environment variables: ETH_WEBSOCKET_RPC_URL or PRIVATE_KEY");
  }

  console.log("🤖 Copy-trader bot starting...");
  console.log("Configuration:", COPY_TRADE_CONFIG);

  const provider = new WebSocketProvider(WEBSOCKET_RPC_URL);
  const chainClient = createChainClient(CHAIN, PRIVATE_KEY, WEBSOCKET_RPC_URL);
  const userWallet = chainClient.getWallet() as Wallet;

  console.log(`Monitoring target wallet: ${COPY_TRADE_CONFIG.targetWalletAddress}`);
  
  provider.on("pending", async (txHash: string) => {
    try {
      if (!txHash) return;
      const tx = await provider.getTransaction(txHash);
      if (tx && tx.from && tx.from.toLowerCase() === COPY_TRADE_CONFIG.targetWalletAddress.toLowerCase()) {
        
        console.log(`[${new Date().toISOString()}] Detected transaction from target: ${txHash}`);
        
        const decodedTx = uniswapInterface.parseTransaction({ data: tx.data, value: tx.value });

        if (decodedTx) {
            console.log(`   Action: ${decodedTx.name}`);
            console.log("   Replicating trade...");
            
            let tradeValue: bigint;
            if (COPY_TRADE_CONFIG.tradeSize.type === 'PERCENTAGE') {
                const percentage = BigInt(COPY_TRADE_CONFIG.tradeSize.value);
                tradeValue = (tx.value * percentage) / 100n;
            } else { // FIXED
                tradeValue = parseUnits(COPY_TRADE_CONFIG.tradeSize.value.toString(), "ether");
            }
            
            const newTx = {
                to: tx.to,
                gasLimit: tx.gasLimit,
                gasPrice: tx.gasPrice,
                data: tx.data,
                value: tradeValue,
            };

            const txResponse = await userWallet.sendTransaction(newTx);
            console.log(`🚀 Trade replicated! Transaction hash: ${txResponse.hash}`);
            await txResponse.wait();
            console.log("Replicated trade confirmed.");
        }
      }
    } catch (error) {
      // Errors are expected
    }
  });

  provider._websocket.on("error", (error: any) => {
      console.error("WebSocket Error:", error);
  });

  provider._websocket.on("close", (code: number, reason: string) => {
      console.log(`WebSocket closed: ${code} ${reason}`);
      console.log("Attempting to reconnect...");
      startEvmCopyTrader(); // Reconnect on close
  });
}

// --- Solana Logic ---
async function startSolanaCopyTrader() {
    if (!SOLANA_WEBSOCKET_RPC_URL || !SOLANA_PRIVATE_KEY) {
        throw new Error("Missing Solana environment variables");
    }
    console.log("🤖 Solana Copy-trader bot starting...");
    const connection = new Connection(SOLANA_WEBSOCKET_RPC_URL, 'confirmed');
    const targetWallet = new PublicKey(COPY_TRADE_CONFIG.targetWalletAddress);

    console.log(`Monitoring target wallet on Solana: ${targetWallet.toBase58()}`);

    connection.onLogs(
        targetWallet,
        (logs: any, context: any) => {
            const logMessages = logs.logs.join('\n');
            if (logMessages.includes("Instruction: Swap")) {
                console.log(`[${new Date().toISOString()}] Detected SWAP transaction from target: ${logs.signature}`);
                console.log("   --> Solana trade replication logic would be implemented here <--");
            }
        },
        'confirmed'
    );
}

// --- Main Execution ---
async function main() {
    const chain: Chain = (process.env.CHAIN as Chain) || "ETH";

    if (chain === "ETH" || chain === "BSC") {
        await startEvmCopyTrader();
    } else if (chain === "SOL") {
        await startSolanaCopyTrader();
    } else {
        console.error(`Unsupported chain: ${chain}`);
        process.exit(1);
    }
}

main().catch(error => {
    console.error("Failed to start copy-trader:", error);
    process.exit(1);
}); 