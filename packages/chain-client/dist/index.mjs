// src/base-client.ts
import { EventEmitter } from "eventemitter3";
import PQueue from "p-queue";
import pRetry from "p-retry";
import axios from "axios";
var BaseChainClient = class extends EventEmitter {
  constructor(chain, config) {
    super();
    this.isConnected = false;
    this.connectionRetries = 0;
    this.chain = chain;
    this.config = {
      maxRetries: 3,
      retryDelay: 1e3,
      timeout: 3e4,
      rateLimitPerSecond: 10,
      ...config
    };
    this.httpClient = axios.create({
      baseURL: this.config.rpcUrl,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json"
      }
    });
    this.requestQueue = new PQueue({
      intervalCap: this.config.rateLimitPerSecond,
      interval: 1e3,
      concurrency: 5
    });
    this.setupErrorHandling();
  }
  // Common RPC call method with retry logic
  async makeRPCCall(call) {
    return this.requestQueue.add(async () => {
      return pRetry(
        async () => {
          try {
            const response = await this.httpClient.post("", {
              jsonrpc: "2.0",
              id: call.id || Date.now(),
              method: call.method,
              params: call.params
            });
            const rpcResponse = response.data;
            if (rpcResponse.error) {
              throw new Error(`RPC Error: ${rpcResponse.error.message}`);
            }
            return rpcResponse.result;
          } catch (error) {
            this.emit("error", error);
            throw error;
          }
        },
        {
          retries: this.config.maxRetries,
          minTimeout: this.config.retryDelay,
          onFailedAttempt: (error) => {
            this.emit("retryAttempt", {
              attempt: error.attemptNumber,
              error: error.message
            });
          }
        }
      );
    });
  }
  // Connection health check
  async healthCheck() {
    try {
      await this.getLatestBlockNumber();
      return true;
    } catch (error) {
      this.emit("healthCheckFailed", error);
      return false;
    }
  }
  // Setup error handling and monitoring
  setupErrorHandling() {
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.emit("httpError", error);
        return Promise.reject(error);
      }
    );
    setInterval(async () => {
      if (this.isConnected) {
        const isHealthy = await this.healthCheck();
        if (!isHealthy) {
          this.emit("connectionUnhealthy");
        }
      }
    }, 3e4);
  }
  // Utility method to format addresses for the specific chain
  formatAddress(address) {
    return address;
  }
  // Utility method to format amounts
  formatAmount(amount) {
    return amount.toString();
  }
  // Get connection stats
  getConnectionStats() {
    return {
      chain: this.chain,
      isConnected: this.isConnected,
      queueSize: this.requestQueue.size,
      queuePending: this.requestQueue.pending,
      connectionRetries: this.connectionRetries
    };
  }
};

// src/ethereum-client.ts
var EthereumClient = class {
  // Implementation will be added in next phase
};

// src/solana-client.ts
var SolanaClient = class {
  // Implementation will be added in next phase
};

// src/multi-chain-client.ts
var MultiChainClient = class {
  // Implementation will be added in next phase
};

// src/utils.ts
function hexToDecimal(hex) {
  return parseInt(hex, 16);
}
function decimalToHex(decimal) {
  return "0x" + decimal.toString(16);
}
function weiToEther(wei) {
  const weiNum = BigInt(wei);
  const etherNum = Number(weiNum) / 1e18;
  return etherNum.toString();
}
function etherToWei(ether) {
  const etherNum = parseFloat(ether);
  const weiNum = BigInt(Math.floor(etherNum * 1e18));
  return weiNum.toString();
}
function isValidEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
function isValidSolanaAddress(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1e3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        throw lastError;
      }
      const delayTime = baseDelay * Math.pow(2, attempt);
      await delay(delayTime);
    }
  }
  throw lastError;
}
function calculateGasPrice(baseFee, priorityFee = "2000000000") {
  const baseFeeNum = BigInt(baseFee);
  const priorityFeeNum = BigInt(priorityFee);
  const maxFeePerGas = (baseFeeNum * BigInt(2) + priorityFeeNum).toString();
  return {
    maxFeePerGas,
    maxPriorityFeePerGas: priorityFee
  };
}
function formatTxHash(hash, length = 10) {
  if (hash.length <= length)
    return hash;
  return `${hash.slice(0, length / 2)}...${hash.slice(-length / 2)}`;
}
function isTransactionConfirmed(confirmations, requiredConfirmations = 1) {
  return confirmations >= requiredConfirmations;
}

// src/mev.ts
var MEVProtection = class {
  // Implementation will be added in next phase
};

// src/websocket.ts
var WebSocketManager = class {
  // Implementation will be added in next phase
};
export {
  BaseChainClient,
  EthereumClient,
  MEVProtection,
  MultiChainClient,
  SolanaClient,
  WebSocketManager,
  calculateGasPrice,
  decimalToHex,
  delay,
  etherToWei,
  formatTxHash,
  hexToDecimal,
  isTransactionConfirmed,
  isValidEthAddress,
  isValidSolanaAddress,
  retryWithBackoff,
  weiToEther
};
