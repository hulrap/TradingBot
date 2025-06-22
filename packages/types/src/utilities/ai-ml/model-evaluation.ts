/**
 * @file Model Evaluation Utilities Type Definitions
 * 
 * Comprehensive type definitions for model evaluation utilities including
 * performance metrics, validation frameworks, cross-validation, and model comparison.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

// ========================================
// EVALUATION METRICS TYPES
// ========================================

/**
 * Classification metrics configuration.
 */
interface ClassificationMetrics {
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly specificity: number;
  readonly sensitivity: number;
  readonly auc: number;
  readonly logLoss: number;
  readonly confusionMatrix: number[][];
  readonly classificationReport: ClassificationReport;
}

/**
 * Detailed classification report.
 */
interface ClassificationReport {
  readonly classes: string[];
  readonly perClassMetrics: Record<string, ClassMetrics>;
  readonly macroAverage: ClassMetrics;
  readonly microAverage: ClassMetrics;
  readonly weightedAverage: ClassMetrics;
}

/**
 * Per-class performance metrics.
 */
interface ClassMetrics {
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly support: number;
}

/**
 * Regression metrics configuration.
 */
interface RegressionMetrics {
  readonly meanAbsoluteError: number;
  readonly meanSquaredError: number;
  readonly rootMeanSquaredError: number;
  readonly meanAbsolutePercentageError: number;
  readonly r2Score: number;
  readonly adjustedR2: number;
  readonly meanSquaredLogError: number;
  readonly maxError: number;
  readonly medianAbsoluteError: number;
}

/**
 * Time series specific metrics.
 */
interface TimeSeriesMetrics {
  readonly meanAbsoluteScaledError: number;
  readonly symmetricMeanAbsolutePercentageError: number;
  readonly meanDirectionalAccuracy: number;
  readonly trackingSignal: number;
  readonly forecastBias: number;
  readonly theilsU: number;
  readonly autocorrelation: number[];
  readonly seasonalDecomposition: SeasonalComponents;
}

/**
 * Seasonal decomposition components.
 */
interface SeasonalComponents {
  readonly trend: number[];
  readonly seasonal: number[];
  readonly residual: number[];
  readonly strength: {
    trend: number;
    seasonal: number;
  };
}

/**
 * Trading-specific performance metrics.
 */
interface TradingMetrics {
  readonly totalReturn: number;
  readonly annualizedReturn: number;
  readonly volatility: number;
  readonly sharpeRatio: number;
  readonly sortinoRatio: number;
  readonly maxDrawdown: number;
  readonly calmarRatio: number;
  readonly winRate: number;
  readonly profitFactor: number;
  readonly averageWin: number;
  readonly averageLoss: number;
  readonly largestWin: number;
  readonly largestLoss: number;
  readonly consecutiveWins: number;
  readonly consecutiveLosses: number;
  readonly recoveryFactor: number;
  readonly ulcerIndex: number;
}

// ========================================
// VALIDATION TYPES
// ========================================

/**
 * Cross-validation configuration.
 */
interface CrossValidationConfig {
  readonly method: CrossValidationMethod;
  readonly folds: number;
  readonly stratified: boolean;
  readonly shuffle: boolean;
  readonly randomState?: number;
  readonly testSize?: number;
  readonly timeSeriesConfig?: TimeSeriesCVConfig;
}

/**
 * Cross-validation methods.
 */
type CrossValidationMethod = 
  | 'k-fold'
  | 'stratified-k-fold'
  | 'leave-one-out'
  | 'leave-p-out'
  | 'time-series-split'
  | 'walk-forward'
  | 'purged-cross-validation'
  | 'combinatorial-purged-cv';

/**
 * Time series cross-validation configuration.
 */
interface TimeSeriesCVConfig {
  readonly initialTrainSize: number;
  readonly testSize: number;
  readonly gap: number;
  readonly maxTrainSize?: number;
  readonly expanding: boolean;
}

/**
 * Cross-validation results.
 */
interface CrossValidationResult {
  readonly method: CrossValidationMethod;
  readonly folds: number;
  readonly scores: number[];
  readonly meanScore: number;
  readonly standardDeviation: number;
  readonly confidenceInterval: [number, number];
  readonly foldDetails: CrossValidationFoldResult[];
  readonly totalTime: number;
}

/**
 * Individual fold results.
 */
interface CrossValidationFoldResult {
  readonly foldIndex: number;
  readonly trainSize: number;
  readonly testSize: number;
  readonly score: number;
  readonly metrics: Record<string, number>;
  readonly executionTime: number;
  readonly predictions?: number[];
  readonly trueValues?: number[];
}

// ========================================
// MODEL COMPARISON TYPES
// ========================================

/**
 * Model comparison configuration.
 */
interface ModelComparisonConfig {
  readonly models: ModelComparisonEntry[];
  readonly metrics: string[];
  readonly comparisonMethod: ComparisonMethod;
  readonly significanceLevel: number;
  readonly bootstrapSamples?: number;
  readonly crossValidation: CrossValidationConfig;
}

/**
 * Model entry for comparison.
 */
interface ModelComparisonEntry {
  readonly modelId: string;
  readonly modelName: string;
  readonly modelType: string;
  readonly hyperparameters: Record<string, unknown>;
  readonly trainingTime: number;
  readonly memoryUsage: number;
}

/**
 * Model comparison methods.
 */
type ComparisonMethod = 
  | 'statistical-test'
  | 'bootstrap'
  | 'bayesian'
  | 'cross-validation'
  | 'holdout'
  | 'time-series-cv';

/**
 * Model comparison results.
 */
interface ModelComparisonResult {
  readonly comparisonId: string;
  readonly timestamp: number;
  readonly models: string[];
  readonly rankings: ModelRanking[];
  readonly statisticalTests: StatisticalTestResult[];
  readonly bestModel: string;
  readonly significantDifferences: ModelSignificanceTest[];
  readonly summary: ComparisonSummary;
}

/**
 * Model ranking information.
 */
interface ModelRanking {
  readonly modelId: string;
  readonly rank: number;
  readonly score: number;
  readonly metrics: Record<string, number>;
  readonly confidenceInterval: [number, number];
  readonly standardError: number;
}

/**
 * Statistical test results for model comparison.
 */
interface StatisticalTestResult {
  readonly testName: string;
  readonly statistic: number;
  readonly pValue: number;
  readonly significant: boolean;
  readonly confidenceLevel: number;
  readonly interpretation: string;
}

/**
 * Model significance testing.
 */
interface ModelSignificanceTest {
  readonly modelA: string;
  readonly modelB: string;
  readonly testType: string;
  readonly pValue: number;
  readonly significant: boolean;
  readonly effectSize: number;
  readonly confidenceInterval: [number, number];
}

/**
 * Comparison summary statistics.
 */
interface ComparisonSummary {
  readonly totalModels: number;
  readonly bestModelScore: number;
  readonly worstModelScore: number;
  readonly averageScore: number;
  readonly scoreVariance: number;
  readonly significantlyDifferentPairs: number;
  readonly executionTime: number;
}

// ========================================
// VALIDATION FRAMEWORK TYPES
// ========================================

/**
 * Model validation framework configuration.
 */
interface ValidationFrameworkConfig {
  readonly validationStrategy: ValidationStrategy;
  readonly metrics: EvaluationMetricConfig[];
  readonly dataValidation: DataValidationConfig;
  readonly modelValidation: ModelValidationConfig;
  readonly performanceThresholds: PerformanceThresholds;
  readonly reportingConfig: ValidationReportingConfig;
}

/**
 * Validation strategies.
 */
type ValidationStrategy = 
  | 'train-validation-test'
  | 'cross-validation'
  | 'time-series-validation'
  | 'monte-carlo-validation'
  | 'bootstrap-validation'
  | 'ensemble-validation';

/**
 * Evaluation metric configuration.
 */
interface EvaluationMetricConfig {
  readonly metricName: string;
  readonly metricType: 'classification' | 'regression' | 'trading' | 'custom';
  readonly parameters: Record<string, unknown>;
  readonly weight: number;
  readonly threshold?: number;
  readonly direction: 'maximize' | 'minimize';
}

/**
 * Data validation configuration.
 */
interface DataValidationConfig {
  readonly checkDataQuality: boolean;
  readonly checkDataDistribution: boolean;
  readonly checkDataLeakage: boolean;
  readonly checkTemporalConsistency: boolean;
  readonly outlierDetection: OutlierDetectionConfig;
  readonly missingValueThreshold: number;
}

/**
 * Outlier detection configuration.
 */
interface OutlierDetectionConfig {
  readonly method: 'iqr' | 'z-score' | 'isolation-forest' | 'local-outlier-factor';
  readonly threshold: number;
  readonly removeOutliers: boolean;
  readonly reportOutliers: boolean;
}

/**
 * Model validation configuration.
 */
interface ModelValidationConfig {
  readonly checkOverfitting: boolean;
  readonly checkUnderfitting: boolean;
  readonly checkBias: boolean;
  readonly checkVariance: boolean;
  readonly checkGeneralization: boolean;
  readonly stabilityTests: boolean;
  readonly robustnessTests: boolean;
}

/**
 * Performance thresholds for validation.
 */
interface PerformanceThresholds {
  readonly minimumAccuracy?: number;
  readonly maximumError?: number;
  readonly minimumPrecision?: number;
  readonly minimumRecall?: number;
  readonly minimumF1Score?: number;
  readonly minimumSharpeRatio?: number;
  readonly maximumDrawdown?: number;
  readonly customThresholds: Record<string, number>;
}

/**
 * Validation reporting configuration.
 */
interface ValidationReportingConfig {
  readonly generateDetailedReport: boolean;
  readonly includeVisualizations: boolean;
  readonly includeStatisticalTests: boolean;
  readonly includeModelExplanations: boolean;
  readonly exportFormat: ReportFormat[];
  readonly saveResults: boolean;
}

/**
 * Report output formats.
 */
type ReportFormat = 'json' | 'html' | 'pdf' | 'csv' | 'markdown';

/**
 * Complete validation result.
 */
interface ValidationResult {
  readonly validationId: string;
  readonly timestamp: number;
  readonly modelId: string;
  readonly strategy: ValidationStrategy;
  readonly dataValidation: DataValidationResult;
  readonly modelValidation: ModelValidationResult;
  readonly performanceMetrics: Record<string, number>;
  readonly thresholdTests: ThresholdTestResult[];
  readonly overallScore: number;
  readonly passed: boolean;
  readonly recommendations: string[];
  readonly executionTime: number;
}

/**
 * Data validation results.
 */
interface DataValidationResult {
  readonly dataQuality: DataQualityReport;
  readonly distributionTests: DistributionTestResult[];
  readonly leakageDetection: DataLeakageResult;
  readonly temporalConsistency: TemporalConsistencyResult;
  readonly outliers: OutlierDetectionResult;
}

/**
 * Data quality assessment.
 */
interface DataQualityReport {
  readonly completeness: number;
  readonly consistency: number;
  readonly accuracy: number;
  readonly validity: number;
  readonly uniqueness: number;
  readonly timeliness: number;
  readonly overallScore: number;
}

/**
 * Distribution test results.
 */
interface DistributionTestResult {
  readonly testName: string;
  readonly statistic: number;
  readonly pValue: number;
  readonly passed: boolean;
  readonly interpretation: string;
}

/**
 * Data leakage detection results.
 */
interface DataLeakageResult {
  readonly leakageDetected: boolean;
  readonly leakageSources: string[];
  readonly severity: 'low' | 'medium' | 'high';
  readonly recommendations: string[];
}

/**
 * Temporal consistency check results.
 */
interface TemporalConsistencyResult {
  readonly consistent: boolean;
  readonly issues: TemporalIssue[];
  readonly recommendations: string[];
}

/**
 * Temporal data issues.
 */
interface TemporalIssue {
  readonly issueType: 'future-leakage' | 'time-gap' | 'inconsistent-frequency' | 'missing-timestamps';
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
  readonly affectedRecords: number;
}

/**
 * Outlier detection results.
 */
interface OutlierDetectionResult {
  readonly outliersDetected: number;
  readonly outlierPercentage: number;
  readonly outlierIndices: number[];
  readonly outlierScores: number[];
  readonly method: string;
  readonly removed: boolean;
}

/**
 * Model validation results.
 */
interface ModelValidationResult {
  readonly overfittingTest: OverfittingTestResult;
  readonly underfittingTest: UnderfittingTestResult;
  readonly biasVarianceAnalysis: BiasVarianceResult;
  readonly generalizationTest: GeneralizationTestResult;
  readonly stabilityTest: StabilityTestResult;
  readonly robustnessTest: RobustnessTestResult;
}

/**
 * Overfitting detection results.
 */
interface OverfittingTestResult {
  readonly overfittingDetected: boolean;
  readonly trainScore: number;
  readonly validationScore: number;
  readonly scoreDifference: number;
  readonly severity: 'none' | 'mild' | 'moderate' | 'severe';
  readonly recommendations: string[];
}

/**
 * Underfitting detection results.
 */
interface UnderfittingTestResult {
  readonly underfittingDetected: boolean;
  readonly trainScore: number;
  readonly expectedScore: number;
  readonly scoreDifference: number;
  readonly severity: 'none' | 'mild' | 'moderate' | 'severe';
  readonly recommendations: string[];
}

/**
 * Bias-variance decomposition results.
 */
interface BiasVarianceResult {
  readonly bias: number;
  readonly variance: number;
  readonly noise: number;
  readonly totalError: number;
  readonly biasVarianceRatio: number;
  readonly recommendations: string[];
}

/**
 * Generalization capability test results.
 */
interface GeneralizationTestResult {
  readonly generalizationScore: number;
  readonly distributionShift: number;
  readonly domainAdaptation: number;
  readonly robustness: number;
  readonly recommendations: string[];
}

/**
 * Model stability test results.
 */
interface StabilityTestResult {
  readonly stable: boolean;
  readonly stabilityScore: number;
  readonly variabilityMetrics: Record<string, number>;
  readonly convergenceTest: ConvergenceTestResult;
  readonly recommendations: string[];
}

/**
 * Model convergence test results.
 */
interface ConvergenceTestResult {
  readonly converged: boolean;
  readonly convergenceScore: number;
  readonly iterations: number;
  readonly finalLoss: number;
  readonly lossHistory: number[];
}

/**
 * Model robustness test results.
 */
interface RobustnessTestResult {
  readonly robust: boolean;
  readonly robustnessScore: number;
  readonly adversarialTests: AdversarialTestResult[];
  readonly noiseTests: NoiseTestResult[];
  readonly recommendations: string[];
}

/**
 * Adversarial attack test results.
 */
interface AdversarialTestResult {
  readonly attackType: string;
  readonly successRate: number;
  readonly averageDistortion: number;
  readonly robustnessScore: number;
}

/**
 * Noise sensitivity test results.
 */
interface NoiseTestResult {
  readonly noiseType: string;
  readonly noiseLevel: number;
  readonly performanceDegradation: number;
  readonly robustnessScore: number;
}

/**
 * Threshold test results.
 */
interface ThresholdTestResult {
  readonly metricName: string;
  readonly actualValue: number;
  readonly threshold: number;
  readonly passed: boolean;
  readonly margin: number;
}

// ========================================
// EXPORTS
// ========================================

export type {
  ClassificationMetrics,
  ClassificationReport,
  ClassMetrics,
  RegressionMetrics,
  TimeSeriesMetrics,
  SeasonalComponents,
  TradingMetrics,
  CrossValidationConfig,
  CrossValidationMethod,
  TimeSeriesCVConfig,
  CrossValidationResult,
  CrossValidationFoldResult,
  ModelComparisonConfig,
  ModelComparisonEntry,
  ComparisonMethod,
  ModelComparisonResult,
  ModelRanking,
  StatisticalTestResult,
  ModelSignificanceTest,
  ComparisonSummary,
  ValidationFrameworkConfig,
  ValidationStrategy,
  EvaluationMetricConfig,
  DataValidationConfig,
  OutlierDetectionConfig,
  ModelValidationConfig,
  PerformanceThresholds,
  ValidationReportingConfig,
  ReportFormat,
  ValidationResult,
  DataValidationResult,
  DataQualityReport,
  DistributionTestResult,
  DataLeakageResult,
  TemporalConsistencyResult,
  TemporalIssue,
  OutlierDetectionResult,
  ModelValidationResult,
  OverfittingTestResult,
  UnderfittingTestResult,
  BiasVarianceResult,
  GeneralizationTestResult,
  StabilityTestResult,
  ConvergenceTestResult,
  RobustnessTestResult,
  AdversarialTestResult,
  NoiseTestResult,
  ThresholdTestResult
}; 