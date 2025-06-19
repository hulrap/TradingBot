import { Chain } from "@trading-bot/types";
import { ethers, Wallet, JsonRpcProvider, TransactionRequest, TransactionResponse, WebSocketProvider } from "ethers";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

// Unified interface for all chain clients
export interface ChainClient {
  getBalance(address: string): Promise<string>;
  sendTransaction(tx: TransactionRequest): Promise<string>;
  getWallet(): Wallet | Keypair;
  getProvider(): JsonRpcProvider | WebSocketProvider | Connection;
  getAddress(): string;
  estimateGas?(tx: TransactionRequest): Promise<bigint>;
  getCurrentNonce?(): Promise<number>;
}

// EVM Client (Ethereum, BSC)
class EthersClient implements ChainClient {
  private wallet: Wallet;
  private provider: JsonRpcProvider | WebSocketProvider;

  constructor(privateKey: string, rpcUrl: string) {
    // Use WebSocket if URL starts with ws/wss, otherwise use JSON-RPC
    if (rpcUrl.startsWith('ws://') || rpcUrl.startsWith('wss://')) {
      this.provider = new WebSocketProvider(rpcUrl);
    } else {
      this.provider = new JsonRpcProvider(rpcUrl);
    }
    this.wallet = new Wallet(privateKey, this.provider);
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async sendTransaction(tx: TransactionRequest): Promise<string> {
    const txResponse = await this.wallet.sendTransaction(tx);
    await txResponse.wait();
    return txResponse.hash;
  }

  getWallet(): Wallet {
    return this.wallet;
  }

  getProvider(): JsonRpcProvider | WebSocketProvider {
    return this.provider;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async estimateGas(tx: TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(tx);
  }

  async getCurrentNonce(): Promise<number> {
    return await this.provider.getTransactionCount(this.wallet.address, 'pending');
  }
}

// Solana Client
class SolanaClient implements ChainClient {
  private connection: Connection;
  private keypair: Keypair;

  constructor(privateKey: string, rpcUrl: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    // Assuming the private key is a base58 encoded string for simplicity
    // In a real app, this should handle different formats securely
    const decodedKey = new Uint8Array(JSON.parse(privateKey));
    this.keypair = Keypair.fromSecretKey(decodedKey);
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.connection.getBalance(new PublicKey(address));
    return (balance / LAMPORTS_PER_SOL).toString();
  }

  async sendTransaction(tx: TransactionRequest): Promise<string> {
    // Solana's `TransactionRequest` is different. This part needs to be adapted
    // based on how transactions are constructed. For now, we focus on the EVM path
    // which is more immediately needed by the bots.
    // This is a placeholder for what would be a more complex Solana tx sender.
    if (!tx.to || !tx.value) throw new Error("Solana transaction requires 'to' and 'value'.");
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey: new PublicKey(tx.to),
        lamports: parseFloat(tx.value.toString()) * LAMPORTS_PER_SOL,
      })
    );
    return await sendAndConfirmTransaction(this.connection, transaction, [this.keypair]);
  }
  
  getWallet(): Keypair {
    return this.keypair;
  }

  getProvider(): Connection {
    return this.connection;
  }

  getAddress(): string {
    return this.keypair.publicKey.toString();
  }
}

// Factory function to create a chain client
export function createChainClient(chain: Chain, privateKey: string, rpcUrl: string): ChainClient {
  switch (chain) {
    case "ETH":
    case "BSC":
      return new EthersClient(privateKey, rpcUrl);
    case "SOL":
      return new SolanaClient(privateKey, rpcUrl);
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
} 