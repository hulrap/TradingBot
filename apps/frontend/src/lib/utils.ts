import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ==================== FORMATTING UTILITIES ====================

/**
 * Format currency values with proper decimal places and currency symbol
 */
export function formatCurrency(
  value: number, 
  currency: string = 'USD', 
  decimals: number = 2
): string {
  if (isNaN(value) || !isFinite(value)) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, 6)
  }).format(value);
}

/**
 * Format percentage values with proper decimal places
 */
export function formatPercentage(
  value: number, 
  decimals: number = 2,
  showSign: boolean = true
): string {
  if (isNaN(value) || !isFinite(value)) return '0.00%';
  
  const formatted = value.toFixed(decimals);
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

/**
 * Format large numbers with appropriate suffixes (K, M, B, T)
 */
export function formatLargeNumber(
  value: number, 
  decimals: number = 1
): string {
  if (isNaN(value) || !isFinite(value)) return '0';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1e12) {
    return `${sign}${(absValue / 1e12).toFixed(decimals)}T`;
  } else if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
  }
  
  return `${sign}${absValue.toFixed(decimals)}`;
}

/**
 * Format timestamp to human-readable date/time
 */
export function formatTimestamp(
  timestamp: string | number | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...options
    };
    
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Format time duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  if (isNaN(milliseconds) || milliseconds < 0) return '0ms';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  if (seconds > 0) return `${seconds}s`;
  return `${milliseconds}ms`;
}

/**
 * Format gas values with appropriate units
 */
export function formatGas(gasValue: number, gasPrice?: number): string {
  if (isNaN(gasValue) || gasValue < 0) return '0 gas';
  
  const gasFormatted = gasValue.toLocaleString();
  
  if (gasPrice && gasPrice > 0) {
    const gasCost = (gasValue * gasPrice) / 1e9; // Convert to ETH
    return `${gasFormatted} gas (${gasCost.toFixed(6)} ETH)`;
  }
  
  return `${gasFormatted} gas`;
}

// ==================== VALIDATION UTILITIES ====================

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate transaction hash format
 */
export function isValidTransactionHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.toLowerCase());
}

/**
 * Validate numeric input for trading amounts
 */
export function isValidAmount(
  value: string | number, 
  min: number = 0, 
  max: number = Infinity
): boolean {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(numValue) && isFinite(numValue) && numValue >= min && numValue <= max;
}

/**
 * Validate percentage input (0-100)
 */
export function isValidPercentage(value: string | number): boolean {
  return isValidAmount(value, 0, 100);
}

// ==================== DATA PROCESSING UTILITIES ====================

/**
 * Truncate string with ellipsis
 */
export function truncateString(
  str: string, 
  maxLength: number = 50, 
  ellipsis: string = '...'
): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Truncate address for display (0x1234...5678)
 */
export function truncateAddress(
  address: string, 
  startLength: number = 6, 
  endLength: number = 4
): string {
  if (!address || !isValidEthereumAddress(address)) return address;
  if (address.length <= startLength + endLength + 2) return address;
  
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      clonedObj[key] = deepClone(obj[key]);
    }
    return clonedObj;
  }
  return obj;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ==================== CALCULATION UTILITIES ====================

/**
 * Calculate profit/loss percentage
 */
export function calculateProfitLossPercentage(
  entryPrice: number, 
  exitPrice: number
): number {
  if (entryPrice <= 0) return 0;
  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

/**
 * Calculate compound interest
 */
export function calculateCompoundInterest(
  principal: number,
  rate: number,
  time: number,
  compoundingFrequency: number = 1
): number {
  if (principal <= 0 || rate < 0 || time < 0) return 0;
  return principal * Math.pow(1 + rate / compoundingFrequency, compoundingFrequency * time);
}

/**
 * Calculate Sharpe ratio
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02
): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  return (avgReturn - riskFreeRate) / stdDev;
}

/**
 * Calculate maximum drawdown
 */
export function calculateMaxDrawdown(values: number[]): number {
  if (values.length === 0) return 0;
  
  let peak = values[0]!; // Non-null assertion since we check length above
  let maxDrawdown = 0;
  
  for (const value of values) {
    if (value > peak) {
      peak = value;
    } else {
      const drawdown = (peak - value) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  
  return maxDrawdown * 100; // Return as percentage
}

// ==================== ERROR HANDLING UTILITIES ====================

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(
  jsonString: string, 
  fallback: T
): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safe number conversion
 */
export function safeNumber(
  value: any, 
  fallback: number = 0
): number {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

/**
 * Safe array access
 */
export function safeArrayAccess<T>(
  array: T[], 
  index: number, 
  fallback: T
): T {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return fallback;
  }
  return array[index];
}

// ==================== ASYNC UTILITIES ====================

/**
 * Sleep/delay function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error = new Error('No attempts made');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
}

// ==================== ENVIRONMENT UTILITIES ====================

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(
  key: string, 
  fallback: string = ''
): string {
  if (isBrowser()) {
    // Only access public env vars in browser
    return process.env[`NEXT_PUBLIC_${key}`] || fallback;
  }
  return process.env[key] || fallback;
}

// ==================== TYPE GUARDS ====================

/**
 * Check if value is defined and not null
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if value is a valid object
 */
export function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// ==================== TRADING SPECIFIC UTILITIES ====================

/**
 * Calculate slippage percentage
 */
export function calculateSlippage(
  expectedPrice: number,
  actualPrice: number
): number {
  if (expectedPrice <= 0) return 0;
  return Math.abs((actualPrice - expectedPrice) / expectedPrice) * 100;
}

/**
 * Calculate gas cost in USD
 */
export function calculateGasCostUSD(
  gasUsed: number,
  gasPriceGwei: number,
  ethPriceUSD: number
): number {
  const gasCostEth = (gasUsed * gasPriceGwei) / 1e9;
  return gasCostEth * ethPriceUSD;
}

/**
 * Calculate position size based on risk percentage
 */
export function calculatePositionSize(
  accountBalance: number,
  riskPercentage: number,
  stopLossPercentage: number
): number {
  if (stopLossPercentage <= 0) return 0;
  const riskAmount = accountBalance * (riskPercentage / 100);
  return riskAmount / (stopLossPercentage / 100);
}

/**
 * Calculate required profit for break-even after fees
 */
export function calculateBreakEvenProfit(
  entryFeePercentage: number,
  exitFeePercentage: number
): number {
  return entryFeePercentage + exitFeePercentage;
}

/**
 * Format token amount with proper decimals
 */
export function formatTokenAmount(
  amount: string | number,
  decimals: number = 18,
  displayDecimals: number = 6
): string {
  try {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '0';
    
    const divisor = Math.pow(10, decimals);
    const formattedAmount = numAmount / divisor;
    
    return formattedAmount.toFixed(displayDecimals);
  } catch {
    return '0';
  }
}