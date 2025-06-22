# @trading-bot/utilities

Shared utility functions for the trading bot platform. This package provides pure utility functions with perfect separation of concerns, using types exclusively from `@trading-bot/types`.

## Features

- **Cache Management**: Memory, TTL, and Redis-based caching
- **Validation**: Address, amount, config, and schema validation
- **Formatting**: Number, address, time, and currency formatting
- **Rate Limiting**: Token bucket, sliding window, and adaptive limiters
- **Retry Logic**: Exponential backoff, jitter, and circuit breaker patterns
- **Crypto Utilities**: Address, amount, and signature utilities

## Usage

```typescript
import {
  memoryCache,
  validateEthereumAddress,
  formatCurrency,
  createTokenBucket,
  exponentialBackoff,
  normalizeAddress
} from '@trading-bot/utilities';

// Cache usage
const cache = memoryCache<string>({ maxSize: 1000 });
cache.set('key', 'value', 3600);

// Address validation
const isValid = validateEthereumAddress('0x742d35Cc6634C0532925a3b8D2C9c2c77A7B4777');

// Currency formatting
const formatted = formatCurrency(1234.56, 'USD', 2);

// Rate limiting
const limiter = createTokenBucket(100, 60); // 100 requests per minute
const allowed = limiter.consume(1);

// Retry logic
const result = await exponentialBackoff(() => apiCall(), {
  maxRetries: 3,
  baseDelay: 1000
});
```

## Architecture

This package follows strict separation of concerns:
- **Pure Functions**: All utilities are pure functions with no side effects
- **Type Safety**: Uses types exclusively from `@trading-bot/types`
- **No Business Logic**: Contains only utility functions, no domain logic
- **Stateless**: Most utilities are stateless (except caching)
- **Composable**: All utilities can be combined and composed

## Modules

### Cache
- `memory-cache.ts`: In-memory caching with LRU eviction
- `ttl-cache.ts`: Time-to-live based caching
- `redis-cache.ts`: Redis-backed distributed caching
- `cache-stats.ts`: Cache performance statistics

### Validation
- `address-validator.ts`: Blockchain address validation
- `amount-validator.ts`: Trading amount validation
- `config-validator.ts`: Configuration validation
- `schema-validator.ts`: JSON schema validation

### Formatting
- `number-formatter.ts`: Number and decimal formatting
- `address-formatter.ts`: Address display formatting
- `time-formatter.ts`: Timestamp formatting
- `currency-formatter.ts`: Currency value formatting

### Rate Limiting
- `token-bucket.ts`: Token bucket algorithm
- `sliding-window.ts`: Sliding window rate limiter
- `adaptive-limiter.ts`: Adaptive rate limiting

### Retry
- `exponential-backoff.ts`: Exponential backoff retry
- `retry-with-jitter.ts`: Retry with random jitter
- `circuit-breaker.ts`: Circuit breaker pattern

### Crypto
- `address-utils.ts`: Address utility functions
- `amount-utils.ts`: Amount calculation utilities
- `signature-utils.ts`: Signature verification utilities
