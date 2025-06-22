/**
 * @file TensorFlow Operations Type Definitions
 * 
 * Comprehensive type definitions for TensorFlow-style tensor operations and 
 * mathematical computations in AI/ML models.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

// ========================================
// TENSOR CORE TYPES
// ========================================

/**
 * Tensor shape information with dimensions and metadata.
 */
interface TensorShape {
  readonly dimensions: readonly number[];
  readonly rank: number;
  readonly size: number;
}

/**
 * Internal tensor data structure with values and metadata.
 */
interface TensorData {
  readonly values: Float64Array;
  readonly shape: TensorShape;
  readonly dtype: TensorDataType;
  readonly strides: readonly number[];
}

/**
 * Supported tensor data types.
 */
type TensorDataType = 'float32' | 'float64' | 'int32' | 'int64' | 'bool';

/**
 * Configuration options for tensor operations.
 */
interface TensorOperationOptions {
  readonly axis?: number | readonly number[];
  readonly keepDims?: boolean;
  readonly dtype?: TensorDataType;
  readonly inPlace?: boolean;
}

/**
 * Options for tensor slicing operations.
 */
interface TensorSliceOptions {
  readonly start?: readonly number[];
  readonly end?: readonly number[];
  readonly step?: readonly number[];
}

/**
 * Configuration for tensor concatenation operations.
 */
interface TensorConcatOptions {
  readonly axis: number;
  readonly validateShapes?: boolean;
}

/**
 * Options for tensor reshaping operations.
 */
interface TensorReshapeOptions {
  readonly shape: readonly number[];
  readonly allowInference?: boolean;
}

/**
 * Tensor computation result with metadata.
 */
interface TensorComputationResult<T = unknown> {
  readonly result: T;
  readonly computationTime: number;
  readonly memoryUsage: number;
  readonly operationType: string;
}

/**
 * Tensor validation configuration.
 */
interface TensorValidationConfig {
  readonly checkBounds: boolean;
  readonly validateShapes: boolean;
  readonly enforceDataType: boolean;
  readonly maxSize: number;
}

/**
 * Tensor performance metrics.
 */
interface TensorPerformanceMetrics {
  readonly averageComputationTime: number;
  readonly peakMemoryUsage: number;
  readonly operationsCount: number;
  readonly errorRate: number;
}

/**
 * Tensor factory configuration for creating tensors.
 */
interface TensorFactoryConfig {
  readonly defaultDtype: TensorDataType;
  readonly validateInput: boolean;
  readonly optimizeMemory: boolean;
  readonly enableCaching: boolean;
}

/**
 * Tensor broadcasting configuration.
 */
interface TensorBroadcastConfig {
  readonly allowImplicitBroadcast: boolean;
  readonly maxRankDifference: number;
  readonly strictShapeChecking: boolean;
}

// ========================================
// EXPORTS
// ========================================

export type {
  TensorShape,
  TensorData,
  TensorDataType,
  TensorOperationOptions,
  TensorSliceOptions,
  TensorConcatOptions,
  TensorReshapeOptions,
  TensorComputationResult,
  TensorValidationConfig,
  TensorPerformanceMetrics,
  TensorFactoryConfig,
  TensorBroadcastConfig
}; 