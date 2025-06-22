/**
 * @file Feature Engineering Utilities Type Definitions
 * 
 * Comprehensive type definitions for feature engineering utilities including
 * data preprocessing, feature extraction, transformation pipelines, and feature selection.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

// ========================================
// DATA PREPROCESSING TYPES
// ========================================

/**
 * Data preprocessing pipeline configuration.
 */
interface PreprocessingPipelineConfig {
  readonly pipelineId: string;
  readonly name: string;
  readonly steps: PreprocessingStep[];
  readonly parallelExecution: boolean;
  readonly errorHandling: ErrorHandlingStrategy;
  readonly caching: boolean;
  readonly validation: ValidationConfig;
}

/**
 * Individual preprocessing step.
 */
interface PreprocessingStep {
  readonly stepId: string;
  readonly stepType: PreprocessingStepType;
  readonly parameters: Record<string, unknown>;
  readonly inputColumns: string[];
  readonly outputColumns: string[];
  readonly condition?: string;
  readonly order: number;
}

/**
 * Types of preprocessing steps.
 */
type PreprocessingStepType = 
  | 'normalization'
  | 'standardization'
  | 'min-max-scaling'
  | 'robust-scaling'
  | 'quantile-transformation'
  | 'power-transformation'
  | 'one-hot-encoding'
  | 'label-encoding'
  | 'ordinal-encoding'
  | 'target-encoding'
  | 'binary-encoding'
  | 'imputation'
  | 'outlier-removal'
  | 'feature-selection'
  | 'dimensionality-reduction'
  | 'custom';

/**
 * Error handling strategies for preprocessing.
 */
type ErrorHandlingStrategy = 'skip' | 'stop' | 'warn' | 'replace' | 'custom';

/**
 * Validation configuration for preprocessing.
 */
interface ValidationConfig {
  readonly validateInput: boolean;
  readonly validateOutput: boolean;
  readonly schemaValidation: boolean;
  readonly rangeChecks: boolean;
  readonly typeChecks: boolean;
  readonly customValidators: string[];
}

// ========================================
// FEATURE EXTRACTION TYPES
// ========================================

/**
 * Feature extraction configuration.
 */
interface FeatureExtractionConfig {
  readonly extractorId: string;
  readonly extractorType: FeatureExtractorType;
  readonly sourceColumns: string[];
  readonly targetColumns: string[];
  readonly parameters: FeatureExtractionParams;
  readonly windowSize?: number;
  readonly lookahead?: number;
}

/**
 * Types of feature extractors.
 */
type FeatureExtractorType = 
  | 'technical-indicators'
  | 'statistical-features'
  | 'time-series-features'
  | 'price-action-features'
  | 'volume-features'
  | 'sentiment-features'
  | 'calendar-features'
  | 'lag-features'
  | 'rolling-features'
  | 'cross-sectional-features'
  | 'interaction-features'
  | 'polynomial-features'
  | 'custom';

/**
 * Parameters for feature extraction.
 */
interface FeatureExtractionParams {
  readonly windowSizes?: number[];
  readonly lags?: number[];
  readonly interactions?: string[][];
  readonly polynomialDegree?: number;
  readonly thresholds?: Record<string, number>;
  readonly customParams?: Record<string, unknown>;
}

/**
 * Technical indicator feature configuration.
 */
interface TechnicalIndicatorConfig {
  readonly indicators: TechnicalIndicatorSpec[];
  readonly priceColumns: PriceColumns;
  readonly volumeColumn?: string;
  readonly customIndicators?: CustomIndicatorConfig[];
}

/**
 * Price column mapping.
 */
interface PriceColumns {
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
}

/**
 * Technical indicator specification.
 */
interface TechnicalIndicatorSpec {
  readonly indicator: string;
  readonly period?: number;
  readonly parameters?: Record<string, number>;
  readonly outputName: string;
}

/**
 * Custom technical indicator configuration.
 */
interface CustomIndicatorConfig {
  readonly name: string;
  readonly formula: string;
  readonly parameters: Record<string, number>;
  readonly dependencies: string[];
}

// ========================================
// FEATURE TRANSFORMATION TYPES
// ========================================

/**
 * Feature transformation pipeline.
 */
interface TransformationPipeline {
  readonly pipelineId: string;
  readonly transformations: FeatureTransformation[];
  readonly inputFeatures: string[];
  readonly outputFeatures: string[];
  readonly fitted: boolean;
  readonly metadata: TransformationMetadata;
}

/**
 * Individual feature transformation.
 */
interface FeatureTransformation {
  readonly transformationId: string;
  readonly transformationType: TransformationType;
  readonly inputFeatures: string[];
  readonly outputFeatures: string[];
  readonly parameters: TransformationParams;
  readonly invertible: boolean;
}

/**
 * Types of feature transformations.
 */
type TransformationType = 
  | 'log-transform'
  | 'sqrt-transform'
  | 'box-cox-transform'
  | 'yeo-johnson-transform'
  | 'quantile-transform'
  | 'pca'
  | 'ica'
  | 'lda'
  | 'tsne'
  | 'umap'
  | 'autoencoder'
  | 'polynomial'
  | 'spline'
  | 'binning'
  | 'discretization'
  | 'custom';

/**
 * Transformation parameters.
 */
interface TransformationParams {
  readonly nComponents?: number;
  readonly degree?: number;
  readonly nBins?: number;
  readonly strategy?: string;
  readonly lambda?: number;
  readonly customParams?: Record<string, unknown>;
}

/**
 * Transformation metadata.
 */
interface TransformationMetadata {
  readonly fittedAt: number;
  readonly dataShape: [number, number];
  readonly featureNames: string[];
  readonly statistics: TransformationStatistics;
  readonly version: string;
}

/**
 * Statistics from transformation fitting.
 */
interface TransformationStatistics {
  readonly mean?: number[];
  readonly std?: number[];
  readonly min?: number[];
  readonly max?: number[];
  readonly explainedVariance?: number[];
  readonly componentWeights?: number[][];
}

// ========================================
// FEATURE SELECTION TYPES
// ========================================

/**
 * Feature selection configuration.
 */
interface FeatureSelectionConfig {
  readonly selectionMethod: FeatureSelectionMethod;
  readonly nFeatures?: number;
  readonly threshold?: number;
  readonly scoringFunction?: string;
  readonly crossValidation?: FeatureSelectionCVConfig;
  readonly parameters: FeatureSelectionParams;
}

/**
 * Feature selection methods.
 */
type FeatureSelectionMethod = 
  | 'univariate-selection'
  | 'recursive-feature-elimination'
  | 'lasso-regularization'
  | 'ridge-regularization'
  | 'elastic-net'
  | 'mutual-information'
  | 'correlation-threshold'
  | 'variance-threshold'
  | 'chi-square'
  | 'anova-f'
  | 'permutation-importance'
  | 'boruta'
  | 'genetic-algorithm'
  | 'custom';

/**
 * Cross-validation configuration for feature selection.
 */
interface FeatureSelectionCVConfig {
  readonly folds: number;
  readonly scoring: string;
  readonly stratified: boolean;
}

/**
 * Feature selection parameters.
 */
interface FeatureSelectionParams {
  readonly alpha?: number;
  readonly l1Ratio?: number;
  readonly maxIter?: number;
  readonly tolerance?: number;
  readonly randomState?: number;
  readonly customParams?: Record<string, unknown>;
}

/**
 * Feature selection result.
 */
interface FeatureSelectionResult {
  readonly selectedFeatures: string[];
  readonly featureScores: Record<string, number>;
  readonly featureRankings: Record<string, number>;
  readonly selectionMask: boolean[];
  readonly crossValidationScores?: number[];
  readonly metadata: FeatureSelectionMetadata;
}

/**
 * Feature selection metadata.
 */
interface FeatureSelectionMetadata {
  readonly method: FeatureSelectionMethod;
  readonly originalFeatureCount: number;
  readonly selectedFeatureCount: number;
  readonly selectionRatio: number;
  readonly executionTime: number;
  readonly parameters: FeatureSelectionParams;
}

// ========================================
// DATA QUALITY TYPES
// ========================================

/**
 * Data quality assessment configuration.
 */
interface DataQualityConfig {
  readonly checkCompleteness: boolean;
  readonly checkConsistency: boolean;
  readonly checkAccuracy: boolean;
  readonly checkValidity: boolean;
  readonly checkUniqueness: boolean;
  readonly checkTimeliness: boolean;
  readonly thresholds: DataQualityThresholds;
}

/**
 * Data quality thresholds.
 */
interface DataQualityThresholds {
  readonly completenessThreshold: number;
  readonly consistencyThreshold: number;
  readonly accuracyThreshold: number;
  readonly validityThreshold: number;
  readonly uniquenessThreshold: number;
  readonly timelinessThreshold: number;
}

/**
 * Data quality assessment result.
 */
interface DataQualityResult {
  readonly overallScore: number;
  readonly completeness: CompletenessResult;
  readonly consistency: ConsistencyResult;
  readonly accuracy: AccuracyResult;
  readonly validity: ValidityResult;
  readonly uniqueness: UniquenessResult;
  readonly timeliness: TimelinessResult;
  readonly recommendations: string[];
}

/**
 * Completeness assessment result.
 */
interface CompletenessResult {
  readonly score: number;
  readonly missingValues: Record<string, number>;
  readonly missingPatterns: string[];
  readonly completenessRatio: number;
}

/**
 * Consistency assessment result.
 */
interface ConsistencyResult {
  readonly score: number;
  readonly inconsistencies: Record<string, number>;
  readonly consistencyIssues: ConsistencyIssue[];
}

/**
 * Consistency issue details.
 */
interface ConsistencyIssue {
  readonly column: string;
  readonly issueType: string;
  readonly count: number;
  readonly examples: unknown[];
}

/**
 * Accuracy assessment result.
 */
interface AccuracyResult {
  readonly score: number;
  readonly outliers: Record<string, number>;
  readonly accuracyIssues: AccuracyIssue[];
}

/**
 * Accuracy issue details.
 */
interface AccuracyIssue {
  readonly column: string;
  readonly issueType: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly affectedRows: number;
}

/**
 * Validity assessment result.
 */
interface ValidityResult {
  readonly score: number;
  readonly invalidValues: Record<string, number>;
  readonly validationRules: ValidationRuleResult[];
}

/**
 * Validation rule result.
 */
interface ValidationRuleResult {
  readonly rule: string;
  readonly passed: boolean;
  readonly violations: number;
  readonly examples: unknown[];
}

/**
 * Uniqueness assessment result.
 */
interface UniquenessResult {
  readonly score: number;
  readonly duplicates: Record<string, number>;
  readonly uniquenessRatio: number;
}

/**
 * Timeliness assessment result.
 */
interface TimelinessResult {
  readonly score: number;
  readonly staleRecords: number;
  readonly averageAge: number;
  readonly timelinessIssues: string[];
}

// ========================================
// FEATURE STORE TYPES
// ========================================

/**
 * Feature store configuration.
 */
interface FeatureStoreConfig {
  readonly storeId: string;
  readonly storeName: string;
  readonly backend: FeatureStoreBackend;
  readonly caching: FeatureCacheConfig;
  readonly versioning: FeatureVersioningConfig;
  readonly monitoring: FeatureMonitoringConfig;
}

/**
 * Feature store backend options.
 */
type FeatureStoreBackend = 'redis' | 'postgres' | 'dynamodb' | 'cassandra' | 'mongodb' | 'custom';

/**
 * Feature caching configuration.
 */
interface FeatureCacheConfig {
  readonly enabled: boolean;
  readonly ttl: number;
  readonly maxSize: number;
  readonly evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
}

/**
 * Feature versioning configuration.
 */
interface FeatureVersioningConfig {
  readonly enabled: boolean;
  readonly strategy: 'semantic' | 'timestamp' | 'hash' | 'sequential';
  readonly retentionPolicy: RetentionPolicy;
}

/**
 * Retention policy for feature versions.
 */
interface RetentionPolicy {
  readonly maxVersions: number;
  readonly maxAge: number;
  readonly autoCleanup: boolean;
}

/**
 * Feature monitoring configuration.
 */
interface FeatureMonitoringConfig {
  readonly driftDetection: boolean;
  readonly distributionMonitoring: boolean;
  readonly performanceMonitoring: boolean;
  readonly alerting: boolean;
  readonly samplingRate: number;
}

/**
 * Feature definition in store.
 */
interface FeatureDefinition {
  readonly featureId: string;
  readonly featureName: string;
  readonly featureType: FeatureDataType;
  readonly description: string;
  readonly owner: string;
  readonly tags: string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly version: string;
  readonly schema: FeatureSchema;
  readonly metadata: FeatureMetadata;
}

/**
 * Feature data types.
 */
type FeatureDataType = 'numeric' | 'categorical' | 'binary' | 'text' | 'timestamp' | 'array' | 'object';

/**
 * Feature schema definition.
 */
interface FeatureSchema {
  readonly type: FeatureDataType;
  readonly nullable: boolean;
  readonly constraints?: FeatureConstraints;
  readonly defaultValue?: unknown;
}

/**
 * Feature constraints.
 */
interface FeatureConstraints {
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly allowedValues?: unknown[];
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
}

/**
 * Feature metadata.
 */
interface FeatureMetadata {
  readonly source: string;
  readonly computationMethod: string;
  readonly updateFrequency: string;
  readonly dependencies: string[];
  readonly businessContext: string;
  readonly technicalContext: string;
}

// ========================================
// EXPORTS
// ========================================

export type {
  PreprocessingPipelineConfig,
  PreprocessingStep,
  PreprocessingStepType,
  ErrorHandlingStrategy,
  ValidationConfig,
  FeatureExtractionConfig,
  FeatureExtractorType,
  FeatureExtractionParams,
  TechnicalIndicatorConfig,
  PriceColumns,
  TechnicalIndicatorSpec,
  CustomIndicatorConfig,
  TransformationPipeline,
  FeatureTransformation,
  TransformationType,
  TransformationParams,
  TransformationMetadata,
  TransformationStatistics,
  FeatureSelectionConfig,
  FeatureSelectionMethod,
  FeatureSelectionCVConfig,
  FeatureSelectionParams,
  FeatureSelectionResult,
  FeatureSelectionMetadata,
  DataQualityConfig,
  DataQualityThresholds,
  DataQualityResult,
  CompletenessResult,
  ConsistencyResult,
  ConsistencyIssue,
  AccuracyResult,
  AccuracyIssue,
  ValidityResult,
  ValidationRuleResult,
  UniquenessResult,
  TimelinessResult,
  FeatureStoreConfig,
  FeatureStoreBackend,
  FeatureCacheConfig,
  FeatureVersioningConfig,
  RetentionPolicy,
  FeatureMonitoringConfig,
  FeatureDefinition,
  FeatureDataType,
  FeatureSchema,
  FeatureConstraints,
  FeatureMetadata
}; 