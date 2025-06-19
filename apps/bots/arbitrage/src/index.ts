import { ArbitrageBotConfig, Chain } from "@trading-bot/types";
import { createChainClient } from "@trading-bot/chain-client";
import axios from "axios";
import Database from "better-sqlite3";
import { ethers } from "ethers";

// --- Configuration ---
const ARBITRAGE_CONFIG: ArbitrageBotConfig = {
  id: "1",
  userId: "user-123",
  walletId: "wallet-123",
  chain: "ETH",
  tokenPair: {
    tokenA: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // Native token (ETH, BNB)
    tokenB: "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI on Ethereum
  },
  minProfitThreshold: 0.1, // 0.1% profit
  tradeSize: 1, // e.g., 1 ETH
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const CHAIN: Chain = "ETH";
const RPC_URL = process.env['ETH_RPC_URL']!; // IMPORTANT: Set in .env file
const PRIVATE_KEY = process.env['PRIVATE_KEY']!; // IMPORTANT: Set in .env file

// --- Database Setup ---
const db = new Database("arbitrage_bot.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    profit REAL NOT NULL,
    trade_details TEXT NOT NULL
  )
`);

// --- 0x API Client ---
const ZERO_X_API_URL = "https://api.0x.org";

async function getQuote(buyToken: string, sellToken: string, sellAmount: string) {
  try {
    const response = await axios.get(`${ZERO_X_API_URL}/swap/v1/quote`, {
      params: {
        buyToken,
        sellToken,
        sellAmount,
      },
    });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching quote from 0x API:", error.response?.data?.validationErrors[0]?.description || error.message);
    return null;
  }
}

// --- Main Bot Logic ---
async function runArbitrage() {
  console.log(`[${new Date().toISOString()}] Checking for arbitrage opportunities...`);

  if (!RPC_URL || !PRIVATE_KEY) {
    throw new Error("Missing environment variables: ETH_RPC_URL or PRIVATE_KEY");
  }

  const chainClient = createChainClient(CHAIN, PRIVATE_KEY, RPC_URL);

  const sellAmountWei = (ARBITRAGE_CONFIG.tradeSize * 10 ** 18).toString();

  // Find opportunity: Sell Token A for Token B
  const quoteAtoB = await getQuote(
    ARBITRAGE_CONFIG.tokenPair.tokenB,
    ARBITRAGE_CONFIG.tokenPair.tokenA,
    sellAmountWei
  );

  if (!quoteAtoB) {
    console.log("Could not get quote for A -> B. Skipping cycle.");
    return;
  }
  const buyAmountFromAtoB = BigInt(quoteAtoB.buyAmount);

  // Find opportunity: Sell Token B back to Token A
  const quoteBtoA = await getQuote(
    ARBITRAGE_CONFIG.tokenPair.tokenA,
    ARBITRAGE_CONFIG.tokenPair.tokenB,
    buyAmountFromAtoB.toString()
  );

  if (!quoteBtoA) {
    console.log("Could not get quote for B -> A. Skipping cycle.");
    return;
  }

  const finalAmount = BigInt(quoteBtoA.buyAmount);
  const initialAmount = BigInt(sellAmountWei);
  
  // --- Profitability Calculation ---
  // Note: This is a simplified calculation. A real bot must simulate gas costs for both transactions.
  // The `gasPrice` and `gas` from the quote can be used for a more accurate estimate.
  const grossProfit = finalAmount - initialAmount;
  const estimatedGasCost = BigInt(quoteAtoB.gas) * BigInt(quoteAtoB.gasPrice) + BigInt(quoteBtoA.gas) * BigInt(quoteBtoA.gasPrice);
  const netProfit = grossProfit - estimatedGasCost;
  
  if (netProfit > 0) {
    const profitPercentage = (Number(netProfit) / Number(initialAmount)) * 100;
    console.log(`\n✅ Arbitrage Opportunity Found!`);
    console.log(`   Initial Amount: ${ethers.formatEther(initialAmount)} ${CHAIN}`);
    console.log(`   Final Amount:   ${ethers.formatEther(finalAmount)} ${CHAIN}`);
    console.log(`   Net Profit:     ${ethers.formatEther(netProfit)} ${CHAIN} (${profitPercentage.toFixed(4)}%)`);

    if (profitPercentage > ARBITRAGE_CONFIG.minProfitThreshold) {
        console.log("🚀 Executing trades...");
        
        // Execute the first swap (e.g., ETH -> DAI)
        const txAtoB = await chainClient.sendTransaction({
            to: quoteAtoB.to,
            data: quoteAtoB.data,
            value: quoteAtoB.value,
            gasPrice: quoteAtoB.gasPrice,
        });
        console.log(`   Trade 1 executed: ${txAtoB}`);

        // Execute the second swap (e.g., DAI -> ETH)
        const txBtoA = await chainClient.sendTransaction({
            to: quoteBtoA.to,
            data: quoteBtoA.data,
            value: quoteBtoA.value,
            gasPrice: quoteBtoA.gasPrice,
        });
        console.log(`   Trade 2 executed: ${txBtoA}`);
        
        // Record the profitable trade
        const stmt = db.prepare('INSERT INTO trades (profit, trade_details) VALUES (?, ?)');
        stmt.run(ethers.formatEther(netProfit), JSON.stringify({
            quoteAtoB,
            quoteBtoA,
            timestamp: new Date().toISOString()
        }));
        console.log("Trade executed and logged to database.");
    } else {
        console.log("Profit does not meet minimum threshold. Skipping.");
    }

  } else {
    console.log("No profitable opportunity found in this cycle.");
  }
}


// --- Bot Execution Loop ---
const POLLING_INTERVAL = 30000; // 30 seconds

(async () => {
  console.log("🤖 Arbitrage bot starting...");
  console.log("Configuration:", ARBITRAGE_CONFIG);
  
  // Run once immediately, then start the interval
  await runArbitrage().catch(console.error);
  setInterval(() => runArbitrage().catch(console.error), POLLING_INTERVAL);
})(); 