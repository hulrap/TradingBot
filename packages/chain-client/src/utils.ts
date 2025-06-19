// Utility functions for chain operations

// Convert hex to decimal
export function hexToDecimal(hex: string): number {
  return parseInt(hex, 16);
}

// Convert decimal to hex
export function decimalToHex(decimal: number): string {
  return '0x' + decimal.toString(16);
}

// Format wei to ether
export function weiToEther(wei: string): string {
  const weiNum = BigInt(wei);
  const etherNum = Number(weiNum) / 1e18;
  return etherNum.toString();
}

// Format ether to wei
export function etherToWei(ether: string): string {
  const etherNum = parseFloat(ether);
  const weiNum = BigInt(Math.floor(etherNum * 1e18));
  return weiNum.toString();
}

// Validate Ethereum address
export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate Solana address
export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

// Add delay utility
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delayTime = baseDelay * Math.pow(2, attempt);
      await delay(delayTime);
    }
  }
  
  throw lastError!;
}

// Calculate gas price with priority
export function calculateGasPrice(
  baseFee: string,
  priorityFee: string = '2000000000' // 2 gwei default
): { maxFeePerGas: string; maxPriorityFeePerGas: string } {
  const baseFeeNum = BigInt(baseFee);
  const priorityFeeNum = BigInt(priorityFee);
  const maxFeePerGas = (baseFeeNum * BigInt(2) + priorityFeeNum).toString();
  
  return {
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee
  };
}

// Format transaction hash for display
export function formatTxHash(hash: string, length: number = 10): string {
  if (hash.length <= length) return hash;
  return `${hash.slice(0, length / 2)}...${hash.slice(-length / 2)}`;
}

// Check if transaction is confirmed
export function isTransactionConfirmed(confirmations: number, requiredConfirmations: number = 1): boolean {
  return confirmations >= requiredConfirmations;
}