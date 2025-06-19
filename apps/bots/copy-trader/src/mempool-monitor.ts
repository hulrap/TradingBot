import { EventEmitter } from 'events';
import { ethers } from 'ethers';

export interface MempoolTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  data: string;
  nonce: number;
  timestamp: number;
  decodedData?: DecodedTransactionData;
}

export interface DecodedTransactionData {
  functionName: string;
  functionSignature: string;
  parameters: any[];
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
  recipient?: string;
  deadline?: number;
  dexRouter?: string;
  isSwap: boolean;
  isLiquidityOperation: boolean;
}

export interface MonitorConfig {
  rpcUrl: string;
  wsUrl: string;
  targetWallets: string[];
  dexRouters: string[];
  minTransactionValue: string; // Minimum value in ETH to monitor
  maxGasPrice: string; // Maximum gas price to consider
  enableDecoding: boolean;
  enableFiltering: boolean;
}

export class MempoolMonitor extends EventEmitter {
  private config: MonitorConfig;
  private provider: ethers.JsonRpcProvider;
  private wsProvider: ethers.WebSocketProvider | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  // Common DEX router ABIs for decoding
  private routerABIs = {
    uniswapV2: [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)',
      'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)',
      'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
      'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)'
    ],
    uniswapV3: [
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96))',
      'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96))',
      'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum))',
      'function exactOutput((bytes path, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum))'
    ]
  };

  private interfaces: { [key: string]: ethers.Interface } = {};

  constructor(config: MonitorConfig) {
    super();
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Initialize ABI interfaces
    this.initializeInterfaces();
  }

  private initializeInterfaces(): void {
    try {
      this.interfaces['uniswapV2'] = new ethers.Interface(this.routerABIs['uniswapV2']);
      this.interfaces['uniswapV3'] = new ethers.Interface(this.routerABIs['uniswapV3']);
    } catch (error) {
      console.error('Error initializing ABI interfaces:', error);
    }
  }

  async start(): Promise<void> {
    try {
      await this.connectWebSocket();
      this.isConnected = true;
      this.emit('connected');
      console.log('Mempool monitor started successfully');
    } catch (error) {
      console.error('Failed to start mempool monitor:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsProvider = new ethers.WebSocketProvider(this.config.wsUrl);
        
        this.wsProvider.on('pending', async (txHash: string) => {
          try {
            await this.handlePendingTransaction(txHash);
          } catch (error) {
            console.error('Error handling pending transaction:', error);
          }
        });

        this.wsProvider.on('error', (error: Error) => {
          console.error('WebSocket error:', error);
          this.handleConnectionError(error);
        });

        this.wsProvider.on('close', () => {
          console.log('WebSocket connection closed');
          this.handleConnectionClose();
        });

        // Test connection
        this.wsProvider.getNetwork().then(() => {
          console.log('WebSocket connected to network');
          resolve();
        }).catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  private async handlePendingTransaction(txHash: string): Promise<void> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return;

      const mempoolTx: MempoolTransaction = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value.toString(),
        gasPrice: tx.gasPrice?.toString() || '0',
        gasLimit: tx.gasLimit.toString(),
        data: tx.data,
        nonce: tx.nonce,
        timestamp: Date.now()
      };

      // Apply filters
      if (!this.shouldProcessTransaction(mempoolTx)) {
        return;
      }

      // Decode transaction data if enabled
      if (this.config.enableDecoding && tx.data && tx.data !== '0x') {
        const decodedData = await this.decodeTransactionData(tx.to || '', tx.data);
        if (decodedData) {
          mempoolTx.decodedData = decodedData;
        }
      }

      // Emit transaction event
      this.emit('transaction', mempoolTx);

      // Emit specific events for target wallets
      if (this.config.targetWallets.includes(tx.from.toLowerCase())) {
        this.emit('targetWalletTransaction', mempoolTx);
      }

      // Emit DEX transaction events
      if (mempoolTx.decodedData?.isSwap) {
        this.emit('swapTransaction', mempoolTx);
      }

    } catch (error) {
      console.error('Error processing pending transaction:', error);
    }
  }

  private shouldProcessTransaction(tx: MempoolTransaction): boolean {
    if (!this.config.enableFiltering) return true;

    // Filter by minimum transaction value
    const minValue = ethers.parseEther(this.config.minTransactionValue);
    if (BigInt(tx.value) < minValue) return false;

    // Filter by maximum gas price
    const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
    if (BigInt(tx.gasPrice) > maxGasPrice) return false;

    // Filter by target wallets or DEX routers
    const isTargetWallet = this.config.targetWallets.includes(tx.from.toLowerCase());
    const isDexRouter = this.config.dexRouters.includes(tx.to.toLowerCase());
    
    if (!isTargetWallet && !isDexRouter) return false;

    return true;
  }

  private async decodeTransactionData(to: string, data: string): Promise<DecodedTransactionData | undefined> {
    try {
      const decodedData: DecodedTransactionData = {
        functionName: '',
        functionSignature: '',
        parameters: [],
        isSwap: false,
        isLiquidityOperation: false
      };

      // Try to decode with different router interfaces
      for (const [routerType, iface] of Object.entries(this.interfaces)) {
        try {
          const decoded = iface.parseTransaction({ data });
          if (decoded) {
            decodedData.functionName = decoded.name;
            decodedData.functionSignature = decoded.signature;
            decodedData.parameters = decoded.args;
            decodedData.dexRouter = to;

            // Extract swap-specific information
            this.extractSwapInfo(decoded, decodedData, routerType);
            
            return decodedData;
          }
        } catch (error) {
          // Continue to next interface
          continue;
        }
      }

      // If no specific router ABI worked, try generic function signature
      const functionSelector = data.slice(0, 10);
      decodedData.functionSignature = functionSelector;
      
      return decodedData;

    } catch (error) {
      console.error('Error decoding transaction data:', error);
      return undefined;
    }
  }

  private extractSwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData,
    routerType: string
  ): void {
    const functionName = decoded.name.toLowerCase();
    
    // Check if it's a swap function
    if (functionName.includes('swap')) {
      decodedData.isSwap = true;

      if (routerType === 'uniswapV2') {
        this.extractUniswapV2SwapInfo(decoded, decodedData);
      } else if (routerType === 'uniswapV3') {
        this.extractUniswapV3SwapInfo(decoded, decodedData);
      }
    }

    // Check if it's a liquidity operation
    if (functionName.includes('liquidity') || functionName.includes('mint') || functionName.includes('burn')) {
      decodedData.isLiquidityOperation = true;
    }
  }

  private extractUniswapV2SwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData
  ): void {
    const args = decoded.args;
    
    switch (decoded.name) {
      case 'swapExactTokensForTokens':
      case 'swapTokensForExactTokens':
        decodedData.amountIn = args[0]?.toString();
        decodedData.tokenIn = args[2]?.[0]; // First token in path
        decodedData.tokenOut = args[2]?.[args[2].length - 1]; // Last token in path
        decodedData.recipient = args[3];
        decodedData.deadline = args[4]?.toString();
        break;
      
      case 'swapExactETHForTokens':
      case 'swapETHForExactTokens':
        decodedData.tokenIn = 'ETH';
        decodedData.tokenOut = args[1]?.[args[1].length - 1]; // Last token in path
        decodedData.recipient = args[2];
        decodedData.deadline = args[3]?.toString();
        break;
      
      case 'swapExactTokensForETH':
      case 'swapTokensForExactETH':
        decodedData.tokenIn = args[2]?.[0]; // First token in path
        decodedData.tokenOut = 'ETH';
        decodedData.amountIn = args[0]?.toString();
        decodedData.recipient = args[3];
        decodedData.deadline = args[4]?.toString();
        break;
    }
  }

  private extractUniswapV3SwapInfo(
    decoded: ethers.TransactionDescription,
    decodedData: DecodedTransactionData
  ): void {
    const args = decoded.args;
    
    switch (decoded.name) {
      case 'exactInputSingle':
      case 'exactOutputSingle':
        const params = args[0];
        decodedData.tokenIn = params.tokenIn;
        decodedData.tokenOut = params.tokenOut;
        decodedData.amountIn = params.amountIn?.toString();
        decodedData.amountOut = params.amountOut?.toString();
        decodedData.recipient = params.recipient;
        decodedData.deadline = params.deadline?.toString();
        break;
      
      case 'exactInput':
      case 'exactOutput':
        const multiParams = args[0];
        decodedData.amountIn = multiParams.amountIn?.toString();
        decodedData.amountOut = multiParams.amountOut?.toString();
        decodedData.recipient = multiParams.recipient;
        decodedData.deadline = multiParams.deadline?.toString();
        // Path decoding for multi-hop swaps would require additional logic
        break;
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('WebSocket connection error:', error);
    this.isConnected = false;
    this.emit('disconnected', error);
    this.attemptReconnect();
  }

  private handleConnectionClose(): void {
    console.log('WebSocket connection closed');
    this.isConnected = false;
    this.emit('disconnected');
    this.attemptReconnect();
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(async () => {
      try {
        await this.connectWebSocket();
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('reconnected');
        console.log('Successfully reconnected to WebSocket');
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, this.reconnectDelay * this.reconnectAttempts); // Exponential backoff
  }

  // Public methods
  addTargetWallet(address: string): void {
    const lowercaseAddress = address.toLowerCase();
    if (!this.config.targetWallets.includes(lowercaseAddress)) {
      this.config.targetWallets.push(lowercaseAddress);
      this.emit('targetWalletAdded', address);
    }
  }

  removeTargetWallet(address: string): void {
    const lowercaseAddress = address.toLowerCase();
    const index = this.config.targetWallets.indexOf(lowercaseAddress);
    if (index > -1) {
      this.config.targetWallets.splice(index, 1);
      this.emit('targetWalletRemoved', address);
    }
  }

  getTargetWallets(): string[] {
    return [...this.config.targetWallets];
  }

  addDexRouter(address: string): void {
    const lowercaseAddress = address.toLowerCase();
    if (!this.config.dexRouters.includes(lowercaseAddress)) {
      this.config.dexRouters.push(lowercaseAddress);
      this.emit('dexRouterAdded', address);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async stop(): Promise<void> {
    try {
      if (this.wsProvider) {
        await this.wsProvider.destroy();
        this.wsProvider = null;
      }
      this.isConnected = false;
      this.emit('stopped');
      console.log('Mempool monitor stopped');
    } catch (error) {
      console.error('Error stopping mempool monitor:', error);
      throw error;
    }
  }

  updateConfig(newConfig: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getStats(): {
    isConnected: boolean;
    reconnectAttempts: number;
    targetWallets: number;
    dexRouters: number;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      targetWallets: this.config.targetWallets.length,
      dexRouters: this.config.dexRouters.length
    };
  }
}