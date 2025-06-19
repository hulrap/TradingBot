export * from './types';
export * from './encryption';
export * from './auth';

// Re-export specific error classes for better error handling
export { EncryptionError } from './encryption';
export { AuthError } from './auth';