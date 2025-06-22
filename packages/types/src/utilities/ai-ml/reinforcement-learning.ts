/**
 * @file Reinforcement Learning Utilities Type Definitions
 * 
 * Comprehensive type definitions for reinforcement learning utilities including
 * environment management, experience replay, training loops, and agent utilities.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

// ========================================
// EXPERIENCE REPLAY TYPES
// ========================================

/**
 * Experience replay buffer configuration.
 */
interface ExperienceReplayConfig {
  readonly maxSize: number;
  readonly batchSize: number;
  readonly prioritized: boolean;
  readonly alpha: number;
  readonly beta: number;
  readonly betaIncrement: number;
  readonly epsilon: number;
}

/**
 * Experience transition data structure.
 */
interface Experience {
  readonly state: Float64Array;
  readonly action: number | Float64Array;
  readonly reward: number;
  readonly nextState: Float64Array;
  readonly done: boolean;
  readonly priority?: number;
  readonly timestamp: number;
}

/**
 * Batch of experiences for training.
 */
interface ExperienceBatch {
  readonly states: Float64Array[];
  readonly actions: (number | Float64Array)[];
  readonly rewards: number[];
  readonly nextStates: Float64Array[];
  readonly dones: boolean[];
  readonly weights?: number[];
  readonly indices?: number[];
}

// ========================================
// ENVIRONMENT TYPES
// ========================================

/**
 * RL environment state information.
 */
interface EnvironmentState {
  readonly observation: Float64Array;
  readonly info: Record<string, unknown>;
  readonly timestamp: number;
}

/**
 * Environment step result.
 */
interface EnvironmentStepResult {
  readonly state: EnvironmentState;
  readonly reward: number;
  readonly done: boolean;
  readonly truncated: boolean;
  readonly info: Record<string, unknown>;
}

/**
 * Environment reset options.
 */
interface EnvironmentResetOptions {
  readonly seed?: number;
  readonly options?: Record<string, unknown>;
}

/**
 * Environment statistics.
 */
interface EnvironmentStats {
  readonly totalSteps: number;
  readonly totalEpisodes: number;
  readonly averageReward: number;
  readonly averageEpisodeLength: number;
  readonly bestReward: number;
  readonly worstReward: number;
}

// ========================================
// TRAINING TYPES
// ========================================

/**
 * Training episode result.
 */
interface TrainingEpisodeResult {
  readonly episodeNumber: number;
  readonly totalReward: number;
  readonly episodeLength: number;
  readonly averageReward: number;
  readonly loss?: number;
  readonly epsilon?: number;
  readonly explorationRate?: number;
  readonly stats: Record<string, number>;
}

/**
 * Training session configuration.
 */
interface TrainingSessionConfig {
  readonly maxEpisodes: number;
  readonly maxSteps: number;
  readonly targetReward?: number;
  readonly evaluationFrequency: number;
  readonly saveFrequency: number;
  readonly logFrequency: number;
  readonly earlyStoppingPatience?: number;
}

/**
 * Training session state.
 */
interface TrainingSessionState {
  readonly currentEpisode: number;
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly bestReward: number;
  readonly recentRewards: number[];
  readonly averageReward: number;
  readonly isRunning: boolean;
  readonly startTime: number;
  readonly lastSaveTime: number;
}

/**
 * Model checkpoint information.
 */
interface ModelCheckpoint {
  readonly episode: number;
  readonly reward: number;
  readonly timestamp: number;
  readonly modelPath: string;
  readonly metadata: Record<string, unknown>;
}

// ========================================
// EXPLORATION TYPES
// ========================================

/**
 * Exploration strategy configuration.
 */
interface ExplorationStrategy {
  readonly type: 'epsilon-greedy' | 'boltzmann' | 'ucb' | 'thompson-sampling' | 'noisy-networks';
  readonly parameters: Record<string, number>;
  readonly decaySchedule?: ExplorationDecaySchedule;
}

/**
 * Exploration decay schedule.
 */
interface ExplorationDecaySchedule {
  readonly type: 'linear' | 'exponential' | 'polynomial' | 'step';
  readonly startValue: number;
  readonly endValue: number;
  readonly decaySteps: number;
  readonly decayRate?: number;
}

/**
 * Action selection result.
 */
interface ActionSelectionResult {
  readonly action: number | Float64Array;
  readonly actionProbabilities?: number[];
  readonly qValues?: number[];
  readonly explorationRate: number;
  readonly isExploration: boolean;
}

// ========================================
// POLICY TYPES
// ========================================

/**
 * Policy network configuration.
 */
interface PolicyNetworkConfig {
  readonly inputSize: number;
  readonly outputSize: number;
  readonly hiddenLayers: number[];
  readonly activation: string;
  readonly outputActivation?: string;
  readonly learningRate: number;
  readonly optimizer: string;
}

/**
 * Policy gradient parameters.
 */
interface PolicyGradientParams {
  readonly baseline: boolean;
  readonly entropy: number;
  readonly valueCoefficient: number;
  readonly clipRange?: number;
  readonly targetKL?: number;
}

/**
 * Policy evaluation result.
 */
interface PolicyEvaluationResult {
  readonly averageReward: number;
  readonly standardDeviation: number;
  readonly episodes: number;
  readonly successRate: number;
  readonly confidence: number;
}

// ========================================
// EXPORTS
// ========================================

export type {
  ExperienceReplayConfig,
  Experience,
  ExperienceBatch,
  EnvironmentState,
  EnvironmentStepResult,
  EnvironmentResetOptions,
  EnvironmentStats,
  TrainingEpisodeResult,
  TrainingSessionConfig,
  TrainingSessionState,
  ModelCheckpoint,
  ExplorationStrategy,
  ExplorationDecaySchedule,
  ActionSelectionResult,
  PolicyNetworkConfig,
  PolicyGradientParams,
  PolicyEvaluationResult
}; 