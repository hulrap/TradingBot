/**
 * @file Crypto utilities index - exports all crypto implementations
 * @package @trading-bot/utilities
. */

// Address utilities exports
export {
  toChecksumAddress,
  isValidChecksum,
  validateAddress,
  convertAddress,
  normalizeAddress,
  isValidAddressFormat,
  addressFromPublicKey,
  batchValidateAddresses,
  compareAddresses,
  addressUtils
} from './address-utils';

// Amount utilities exports
export {
  toBaseUnits,
  fromBaseUnits,
  convertAmountDecimals,
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  divideAmount,
  calculatePercentage,
  applySlippage,
  calculateTradingFees,
  calculatePriceImpact,
  compareAmounts,
  isWithinTolerance,
  isDustAmount,
  roundToSignificantDigits,
  formatAmountForDisplay,
  amountUtils
} from './amount-utils';

// Signature utilities exports
export {
  signMessage,
  signMessageExtended,
  verifySignatureExtended,
  verifySignature,
  recoverPublicKey,
  generateKeyPair,
  deriveKeyFromSeed,
  deriveKeyFromPassword,
  signEthereumTransaction,
  createEthereumPersonalSignMessage,
  generateRandomHex,
  signatureUtils
} from './signature-utils';

// Re-export crypto types for convenience
export type {
  CryptoHashOptions,
  EncryptionOptions,
  SignatureOptions,
  SignatureVerificationOptions,
  SignatureResult,
  KeyPairResult,
  KeyDerivationOptions,
  AmountPrecisionOptions,
  AmountDisplayOptions,
  TradingCalculationOptions,
  AmountConversionResult,
  ExtendedSignatureOptions,
  ExtendedSignatureResult,
  SignatureVerificationResult
} from '@trading-bot/types/src/utilities/crypto/crypto'; 