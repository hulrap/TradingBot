import type { SupportedChain, Address, OrderType } from '@trading-bot/types';

// Test type usage - this demonstrates that types are properly available
const testChain: SupportedChain = 'ethereum';
const testAddress: Address = '0x742564a7d34e5ff9a0577e9ba9d1b24abfae9c52' as Address;
const testOrderType: OrderType = 'market';

console.log('Types package integration test:', {
  chain: testChain,
  address: testAddress,
  orderType: testOrderType
});

export { testChain, testAddress, testOrderType }; 