import { SandwichBotConfig, Chain } from "@trading-bot/types";
import { createChainClient } from "@trading-bot/chain-client";
import { Wallet, WebSocketProvider, Interface, parseUnits, formatUnits, Contract } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleTransaction, FlashbotsBundleRawTransaction } from "@flashbots/ethers-provider-bundle";

// --- Configuration ---
const SANDWICH_CONFIG: SandwichBotConfig = {
    id: "1",
    userId: "user-123",
    walletId: "wallet-1",
    chain: "ETH" as Chain,
    targetDex: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router on Ethereum
    minVictimTradeSize: 1, // e.g., victim must be trading at least 1 ETH
    maxGasPrice: 100, // 100 gwei max gas price
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};
const CHAIN: Chain = (process.env.CHAIN as Chain) || "ETH";
const WEBSOCKET_RPC_URL = process.env.ETH_WEBSOCKET_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const FLASHBOTS_RELAY_URL = "https://relay.flashbots.net";

const UNISWAP_V2_ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];
const uniswapInterface = new Interface(UNISWAP_V2_ROUTER_ABI);

// --- Main Bot Logic ---
async function startSandwichBot() {
    if (!WEBSOCKET_RPC_URL || !PRIVATE_KEY) {
        throw new Error("Missing environment variables: ETH_WEBSOCKET_RPC_URL or PRIVATE_KEY");
    }

    console.log("🤖 Sandwich bot starting...");
    const provider = new WebSocketProvider(WEBSOCKET_RPC_URL);
    const chainClient = createChainClient(CHAIN, PRIVATE_KEY, WEBSOCKET_RPC_URL);
    const userWallet = chainClient.getWallet() as Wallet;
    const uniswapRouter = new Contract(SANDWICH_CONFIG.targetDex, UNISWAP_V2_ROUTER_ABI, userWallet);
    
    // Flashbots provider for sending private bundles
    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, userWallet, FLASHBOTS_RELAY_URL);

    console.log("Scanning mempool for sandwich opportunities...");

    provider.on("pending", async (txHash: string) => {
        if (!txHash) return;
        try {
            const tx = await provider.getTransaction(txHash);
            
            // Filter for target DEX and swapExactETHForTokens
            if (tx && tx.to && tx.to.toLowerCase() === SANDWICH_CONFIG.targetDex.toLowerCase()) {
                const decodedTx = uniswapInterface.parseTransaction({ data: tx.data, value: tx.value });
                
                if (decodedTx && decodedTx.name === "swapExactETHForTokens" && tx.value >= parseUnits(SANDWICH_CONFIG.minVictimTradeSize.toString(), "ether")) {
                    console.log(`\n[${new Date().toISOString()}] Potential Victim Tx Found: ${txHash}`);
                    
                    const [amountOutMin, path, to, deadline] = decodedTx.args;
                    const victimAmountIn = tx.value;
                    const tokenToBuy = path[1];

                    // --- Advanced Simulation ---
                    console.log("   Running simulation...");

                    // 1. How much token will we get for our front-run buy?
                    const frontrunAmountIn = victimAmountIn; // For simplicity, we use the same amount
                    const amountsOutFrontrun = await uniswapRouter.getAmountsOut(frontrunAmountIn, [path[0], path[1]]);
                    const frontrunAmountOut = amountsOutFrontrun[1];
                    
                    // 2. How much ETH will we get for our back-run sell? (after victim's trade pushes price up)
                    // This is a simplification; a real bot would need to account for the victim's price impact.
                    const amountsOutBackrun = await uniswapRouter.getAmountsOut(frontrunAmountOut, [path[1], path[0]]);
                    const backrunAmountOut = amountsOutBackrun[1];
                    
                    const grossProfit = backrunAmountOut - frontrunAmountIn;

                    // Rough gas estimate
                    const gasEstimate = BigInt(tx.gasPrice || (await provider.getFeeData()).gasPrice!) * (150000n * 2n); // ~150k gas per swap
                    const netProfit = grossProfit - gasEstimate;

                    console.log(`   Simulation Result: Gross Profit: ${formatUnits(grossProfit)} ETH, Net Profit: ${formatUnits(netProfit)} ETH`);
                    
                    if (netProfit > parseUnits("0.005", "ether")) {
                        console.log("   ✅ Profitable simulation! Preparing bundle...");
                        
                        // --- Bundle Creation ---
                        const block = await provider.getBlock("latest");
                        if (!block) return;
                        const targetBlock = block.number + 1;

                        const frontrunTx: FlashbotsBundleTransaction = {
                            signer: userWallet,
                            transaction: await uniswapRouter.swapExactETHForTokens.populateTransaction(
                                0, // we accept any amount for the frontrun
                                [path[0], path[1]],
                                userWallet.address,
                                deadline,
                                { value: frontrunAmountIn, gasPrice: (BigInt(tx.gasPrice || 20000000000) - 1n), gasLimit: 250000 }
                            ),
                        };
                        
                        const backrunTx: FlashbotsBundleTransaction = {
                            signer: userWallet,
                            transaction: await uniswapRouter.swapExactTokensForETH.populateTransaction(
                                frontrunAmountOut,
                                0, // we accept any amount for the backrun
                                [path[1], path[0]],
                                userWallet.address,
                                deadline,
                                { gasPrice: (BigInt(tx.gasPrice || 20000000000) - 1n), gasLimit: 250000 }
                            ),
                        };

                        const victimTx: FlashbotsBundleRawTransaction = {
                            signedTransaction: tx.serialized
                        };

                        const signedTxs = await flashbotsProvider.signBundle([
                            { signer: userWallet, transaction: frontrunTx.transaction },
                            victimTx,
                            { signer: userWallet, transaction: backrunTx.transaction },
                        ]);
                        console.log(`   Submitting bundle for block ${targetBlock}...`);
                        const bundleSubmission = await flashbotsProvider.sendRawBundle(signedTxs, targetBlock);
                        
                        if ('error' in bundleSubmission) {
                            console.error("   Bundle submission error:", bundleSubmission.error.message);
                            return;
                        }
                        console.log("   🚀 Bundle submitted successfully!");
                    }
                }
            }
        } catch (error) {
            // Ignore errors
        }
    });
}

// --- Start the bot ---
startSandwichBot().catch(console.error); 