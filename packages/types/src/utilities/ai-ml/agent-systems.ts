/**
 * @file AI/ML Agent Systems Types
 * 
 * Advanced AI/ML infrastructure for trading systems with reinforcement
 * learning agents, multi-agent orchestration, and LLM integration.
 * 
 * Features:
 * - Reinforcement learning trading agents
 * - Multi-agent coordination systems
 * - Machine learning model management
 * - Large language model integration
 * - Ensemble learning frameworks
 * - AutoML and model optimization
 * - Real-time model inference
 * - Performance monitoring and drift detection
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

import type { SupportedChain } from '../../blockchain/chain';
import type { Address, TokenInfo } from '../../blockchain/addresses';
import type { TechnicalIndicatorType, SignalDirection, SignalStrength } from '../../analysis/technical-indicators';

// ========================================
// CORE AI/ML TYPES
// ========================================

/**
 * AI/ML model types for trading systems.
 */
type ModelType = 
  // ========================================
  // REINFORCEMENT LEARNING
  // ========================================
  | 'q-learning'          // Q-Learning
  | 'deep-q-network'      // Deep Q-Network (DQN)
  | 'double-dqn'          // Double DQN
  | 'dueling-dqn'         // Dueling DQN
  | 'rainbow-dqn'         // Rainbow DQN
  | 'policy-gradient'     // Policy Gradient
  | 'actor-critic'        // Actor-Critic
  | 'a3c'                 // Asynchronous Actor-Critic
  | 'ppo'                 // Proximal Policy Optimization
  | 'sac'                 // Soft Actor-Critic
  | 'td3'                 // Twin Delayed DDPG
  | 'ddpg'                // Deep Deterministic Policy Gradient
  | 'trpo'                // Trust Region Policy Optimization
  | 'mpo'                 // Maximum a Posteriori Policy Optimization
  
  // ========================================
  // SUPERVISED LEARNING
  // ========================================
  | 'linear-regression'   // Linear Regression
  | 'logistic-regression' // Logistic Regression
  | 'random-forest'       // Random Forest
  | 'gradient-boosting'   // Gradient Boosting
  | 'xgboost'             // XGBoost
  | 'lightgbm'            // LightGBM
  | 'catboost'            // CatBoost
  | 'svm'                 // Support Vector Machine
  | 'neural-network'      // Neural Network
  | 'cnn'                 // Convolutional Neural Network
  | 'rnn'                 // Recurrent Neural Network
  | 'lstm'                // Long Short-Term Memory
  | 'gru'                 // Gated Recurrent Unit
  | 'transformer'         // Transformer
  | 'attention'           // Attention Mechanism
  
  // ========================================
  // UNSUPERVISED LEARNING
  // ========================================
  | 'k-means'             // K-Means Clustering
  | 'dbscan'              // DBSCAN Clustering
  | 'hierarchical'        // Hierarchical Clustering
  | 'pca'                 // Principal Component Analysis
  | 'autoencoder'         // Autoencoder
  | 'vae'                 // Variational Autoencoder
  | 'gan'                 // Generative Adversarial Network
  | 'isolation-forest'    // Isolation Forest
  | 'one-class-svm'       // One-Class SVM
  
  // ========================================
  // TIME SERIES MODELS
  // ========================================
  | 'arima'               // ARIMA
  | 'garch'               // GARCH
  | 'var'                 // Vector Autoregression
  | 'state-space'         // State Space Models
  | 'kalman-filter'       // Kalman Filter
  | 'prophet'             // Facebook Prophet
  | 'neuralprophet'       // Neural Prophet
  | 'n-beats'             // N-BEATS
  | 'deepar'              // DeepAR
  | 'temporal-fusion'     // Temporal Fusion Transformer
  
  // ========================================
  // ENSEMBLE METHODS
  // ========================================
  | 'bagging'             // Bagging
  | 'boosting'            // Boosting
  | 'voting'              // Voting Classifier
  | 'stacking'            // Stacking
  | 'blending'            // Blending
  | 'meta-learning'       // Meta-Learning
  
  // ========================================
  // LARGE LANGUAGE MODELS
  // ========================================
  | 'gpt-3.5'             // GPT-3.5
  | 'gpt-4'               // GPT-4
  | 'claude'              // Claude
  | 'llama'               // LLaMA
  | 'palm'                // PaLM
  | 'gemini'              // Gemini
  | 'custom-llm'          // Custom LLM
  
  // ========================================
  // SPECIALIZED
  // ========================================
  | 'multi-agent'         // Multi-Agent System
  | 'federated'           // Federated Learning
  | 'transfer-learning'   // Transfer Learning
  | 'few-shot'            // Few-Shot Learning
  | 'zero-shot'           // Zero-Shot Learning
  | 'continual-learning'  // Continual Learning
  | 'custom';             // Custom Model

/**
 * Agent types for different trading strategies.
 */
type AgentType = 
  | 'arbitrage-agent'     // Arbitrage opportunity detection
  | 'market-maker'        // Market making strategies
  | 'trend-follower'      // Trend following strategies
  | 'mean-reversion'      // Mean reversion strategies
  | 'momentum-trader'     // Momentum trading strategies
  | 'portfolio-optimizer' // Portfolio optimization
  | 'risk-manager'        // Risk management agent
  | 'signal-generator'    // Technical signal generation
  | 'news-analyzer'       // News sentiment analysis
  | 'social-monitor'      // Social media monitoring
  | 'whale-tracker'       // Large transaction monitoring
  | 'liquidation-hunter'  // Liquidation opportunity detection
  | 'mev-searcher'        // MEV opportunity searcher
  | 'cross-chain-arbitrage' // Cross-chain arbitrage
  | 'defi-farmer'         // DeFi yield farming
  | 'options-trader'      // Options trading strategies
  | 'perpetual-trader'    // Perpetual futures trading
  | 'basket-trader'       // Basket trading strategies
  | 'index-rebalancer'    // Index rebalancing
  | 'coordinator'         // Multi-agent coordinator
  | 'supervisor'          // Agent supervisor
  | 'custom';             // Custom agent type

/**
 * Learning paradigms for AI agents.
 */
type LearningParadigm = 
  | 'supervised'          // Supervised learning
  | 'unsupervised'        // Unsupervised learning
  | 'reinforcement'       // Reinforcement learning
  | 'semi-supervised'     // Semi-supervised learning
  | 'self-supervised'     // Self-supervised learning
  | 'meta-learning'       // Meta-learning
  | 'transfer-learning'   // Transfer learning
  | 'federated'           // Federated learning
  | 'continual'           // Continual learning
  | 'multi-task'          // Multi-task learning
  | 'online'              // Online learning
  | 'offline'             // Offline learning
  | 'hybrid';             // Hybrid approach

// ========================================
// REINFORCEMENT LEARNING TYPES
// ========================================

/**
 * RL agent configuration.
 */
interface RLAgentConfig {
  /** Agent identifier. */
  id: string;
  
  /** Agent type. */
  agentType: AgentType;
  
  /** Model type. */
  modelType: ModelType;
  
  /** Environment configuration. */
  environment: {
    /** Environment type. */
    type: 'trading' | 'portfolio' | 'arbitrage' | 'market-making' | 'custom';
    
    /** State space definition. */
    stateSpace: {
      /** State dimensions. */
      dimensions: number;
      
      /** State features. */
      features: Array<{
        name: string;
        type: 'continuous' | 'discrete' | 'categorical';
        range?: [number, number];
        categories?: string[];
      }>;
      
      /** Observation space. */
      observationSpace: 'box' | 'discrete' | 'multi-discrete' | 'custom';
    };
    
    /** Action space definition. */
    actionSpace: {
      /** Action type. */
      type: 'discrete' | 'continuous' | 'multi-discrete' | 'custom';
      
      /** Action dimensions. */
      dimensions: number;
      
      /** Available actions. */
      actions: Array<{
        name: string;
        parameters: Record<string, unknown>;
        constraints: Record<string, unknown>;
      }>;
    };
    
    /** Reward function. */
    rewardFunction: {
      /** Primary objective. */
      primary: 'profit' | 'sharpe-ratio' | 'risk-adjusted-return' | 'custom';
      
      /** Reward shaping. */
      shaping: Array<{
        component: string;
        weight: number;
        function: string;
      }>;
      
      /** Penalty terms. */
      penalties: Array<{
        condition: string;
        penalty: number;
      }>;
    };
  };
  
  /** Model hyperparameters. */
  hyperparameters: {
    /** Learning rate. */
    learningRate: number;
    
    /** Discount factor. */
    discountFactor: number;
    
    /** Epsilon (exploration rate). */
    epsilon?: number;
    
    /** Epsilon decay. */
    epsilonDecay?: number;
    
    /** Target network update frequency. */
    targetUpdateFreq?: number;
    
    /** Batch size. */
    batchSize: number;
    
    /** Memory size. */
    memorySize: number;
    
    /** Network architecture. */
    networkArchitecture: Array<{
      type: 'dense' | 'conv' | 'lstm' | 'attention';
      units: number;
      activation: string;
      dropout?: number;
    }>;
  };
  
  /** Training configuration. */
  training: {
    /** Maximum episodes. */
    maxEpisodes: number;
    
    /** Episode length. */
    episodeLength: number;
    
    /** Training frequency. */
    trainingFreq: number;
    
    /** Evaluation frequency. */
    evaluationFreq: number;
    
    /** Early stopping criteria. */
    earlyStopping: {
      enabled: boolean;
      patience: number;
      metric: string;
      threshold: number;
    };
    
    /** Curriculum learning. */
    curriculum: {
      enabled: boolean;
      stages: Array<{
        difficulty: number;
        duration: number;
        conditions: Record<string, unknown>;
      }>;
    };
  };
  
  /** Risk management. */
  riskManagement: {
    /** Maximum position size. */
    maxPositionSize: number;
    
    /** Stop loss percentage. */
    stopLoss: number;
    
    /** Take profit percentage. */
    takeProfit: number;
    
    /** Maximum drawdown. */
    maxDrawdown: number;
    
    /** Risk per trade. */
    riskPerTrade: number;
    
    /** Volatility adjustment. */
    volatilityAdjustment: boolean;
  };
}

/**
 * RL agent state.
 */
interface RLAgentState {
  /** Agent identifier. */
  agentId: string;
  
  /** Current episode. */
  episode: number;
  
  /** Current step. */
  step: number;
  
  /** Agent status. */
  status: 'training' | 'evaluating' | 'inference' | 'paused' | 'terminated';
  
  /** Current observation. */
  observation: Array<number>;
  
  /** Last action taken. */
  lastAction: {
    action: number | Array<number>;
    parameters: Record<string, unknown>;
    confidence: number;
  };
  
  /** Performance metrics. */
  performance: {
    /** Total reward. */
    totalReward: number;
    
    /** Episode reward. */
    episodeReward: number;
    
    /** Average reward. */
    averageReward: number;
    
    /** Win rate. */
    winRate: number;
    
    /** Sharpe ratio. */
    sharpeRatio: number;
    
    /** Maximum drawdown. */
    maxDrawdown: number;
  };
  
  /** Model statistics. */
  modelStats: {
    /** Loss values. */
    loss: number;
    
    /** Q-values (for DQN). */
    qValues?: Array<number>;
    
    /** Policy entropy (for policy gradient). */
    policyEntropy?: number;
    
    /** Value function estimate. */
    valueEstimate?: number;
  };
  
  /** Memory usage. */
  memory: {
    /** Current memory size. */
    currentSize: number;
    
    /** Memory capacity. */
    capacity: number;
    
    /** Memory utilization. */
    utilization: number;
  };
}

// ========================================
// MULTI-AGENT SYSTEM TYPES
// ========================================

/**
 * Multi-agent system configuration.
 */
interface MultiAgentSystemConfig {
  /** System identifier. */
  id: string;
  
  /** System name. */
  name: string;
  
  /** Agent configurations. */
  agents: Array<{
    /** Agent configuration. */
    config: RLAgentConfig;
    
    /** Agent role. */
    role: 'executor' | 'advisor' | 'coordinator' | 'supervisor' | 'specialist';
    
    /** Agent priority. */
    priority: number;
    
    /** Resource allocation. */
    resources: {
      cpu: number;
      memory: number;
      gpu?: number;
    };
  }>;
  
  /** Communication protocols. */
  communication: {
    /** Message passing enabled. */
    messagePassing: boolean;
    
    /** Shared memory enabled. */
    sharedMemory: boolean;
    
    /** Communication topology. */
    topology: 'centralized' | 'decentralized' | 'hierarchical' | 'mesh';
    
    /** Message types. */
    messageTypes: Array<{
      type: string;
      format: string;
      priority: number;
    }>;
  };
  
  /** Coordination mechanisms. */
  coordination: {
    /** Coordination strategy. */
    strategy: 'consensus' | 'voting' | 'auction' | 'negotiation' | 'hierarchical';
    
    /** Conflict resolution. */
    conflictResolution: {
      method: 'priority-based' | 'voting' | 'arbitration' | 'consensus';
      timeout: number;
    };
    
    /** Task allocation. */
    taskAllocation: {
      method: 'round-robin' | 'capability-based' | 'load-balanced' | 'auction';
      rebalancing: boolean;
    };
  };
  
  /** Learning coordination. */
  learningCoordination: {
    /** Shared learning enabled. */
    sharedLearning: boolean;
    
    /** Knowledge transfer. */
    knowledgeTransfer: {
      enabled: boolean;
      method: 'parameter-sharing' | 'experience-replay' | 'distillation';
      frequency: number;
    };
    
    /** Collective intelligence. */
    collectiveIntelligence: {
      enabled: boolean;
      aggregationMethod: 'averaging' | 'voting' | 'weighted-average' | 'ensemble';
    };
  };
}

/**
 * Agent communication message.
 */
interface AgentMessage {
  /** Message identifier. */
  id: string;
  
  /** Sender agent ID. */
  senderId: string;
  
  /** Receiver agent ID(s). */
  receiverIds: string[];
  
  /** Message type. */
  type: 'signal' | 'trade-recommendation' | 'market-update' | 'risk-alert' | 'coordination' | 'custom';
  
  /** Message content. */
  content: {
    /** Primary data. */
    data: Record<string, unknown>;
    
    /** Confidence score. */
    confidence?: number;
    
    /** Urgency level. */
    urgency: 'low' | 'medium' | 'high' | 'critical';
    
    /** Expiration time. */
    expiresAt?: number;
  };
  
  /** Message metadata. */
  metadata: {
    /** Timestamp. */
    timestamp: number;
    
    /** Priority. */
    priority: number;
    
    /** Requires acknowledgment. */
    requiresAck: boolean;
    
    /** Delivery attempts. */
    deliveryAttempts: number;
  };
}

// ========================================
// LLM INTEGRATION TYPES
// ========================================

/**
 * LLM configuration for trading systems.
 */
interface LLMConfig {
  /** LLM identifier. */
  id: string;
  
  /** Model type. */
  modelType: ModelType;
  
  /** Model parameters. */
  parameters: {
    /** Model name/version. */
    model: string;
    
    /** Maximum tokens. */
    maxTokens: number;
    
    /** Temperature. */
    temperature: number;
    
    /** Top-p sampling. */
    topP: number;
    
    /** Frequency penalty. */
    frequencyPenalty: number;
    
    /** Presence penalty. */
    presencePenalty: number;
  };
  
  /** Prompt engineering. */
  prompts: {
    /** System prompt. */
    system: string;
    
    /** Task-specific prompts. */
    tasks: Record<string, {
      template: string;
      variables: string[];
      examples: Array<{
        input: string;
        output: string;
      }>;
    }>;
    
    /** Context management. */
    context: {
      /** Maximum context length. */
      maxLength: number;
      
      /** Context compression. */
      compression: {
        enabled: boolean;
        method: 'truncation' | 'summarization' | 'key-points';
      };
    };
  };
  
  /** Function calling. */
  functionCalling: {
    /** Available functions. */
    functions: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      implementation: string;
    }>;
    
    /** Auto-execution enabled. */
    autoExecution: boolean;
    
    /** Confirmation required. */
    confirmationRequired: boolean;
  };
  
  /** Output processing. */
  outputProcessing: {
    /** Response format. */
    format: 'text' | 'json' | 'structured' | 'custom';
    
    /** Validation rules. */
    validation: Array<{
      rule: string;
      errorMessage: string;
    }>;
    
    /** Post-processing. */
    postProcessing: string[];
  };
  
  /** Safety and filtering. */
  safety: {
    /** Content filtering enabled. */
    contentFiltering: boolean;
    
    /** Bias detection. */
    biasDetection: boolean;
    
    /** Fact checking. */
    factChecking: boolean;
    
    /** Output monitoring. */
    outputMonitoring: boolean;
  };
}

/**
 * LLM query configuration.
 */
interface LLMQuery {
  /** Query identifier. */
  id: string;
  
  /** Target LLM. */
  llmId: string;
  
  /** Query type. */
  type: 'market-analysis' | 'news-analysis' | 'sentiment-analysis' | 'strategy-generation' | 'risk-assessment' | 'custom';
  
  /** Input data. */
  input: {
    /** Text input. */
    text?: string;
    
    /** Structured data. */
    data?: Record<string, unknown>;
    
    /** Context information. */
    context?: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
  };
  
  /** Query parameters. */
  parameters: {
    /** Override model parameters. */
    overrides?: Partial<LLMConfig['parameters']>;
    
    /** Streaming enabled. */
    streaming: boolean;
    
    /** Response caching. */
    caching: {
      enabled: boolean;
      ttl: number;
    };
  };
  
  /** Processing instructions. */
  instructions: {
    /** Output format requirements. */
    outputFormat: string;
    
    /** Specific constraints. */
    constraints: string[];
    
    /** Required elements. */
    requiredElements: string[];
  };
}

/**
 * LLM response structure.
 */
interface LLMResponse {
  /** Query identifier. */
  queryId: string;
  
  /** Response timestamp. */
  timestamp: number;
  
  /** Response content. */
  content: {
    /** Generated text. */
    text: string;
    
    /** Structured output. */
    structured?: Record<string, unknown>;
    
    /** Function calls. */
    functionCalls?: Array<{
      name: string;
      arguments: Record<string, unknown>;
      result?: unknown;
    }>;
  };
  
  /** Response metadata. */
  metadata: {
    /** Model used. */
    model: string;
    
    /** Tokens used. */
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
    
    /** Response time. */
    responseTime: number;
    
    /** Confidence score. */
    confidence: number;
    
    /** Safety scores. */
    safetyScores: Record<string, number>;
  };
  
  /** Quality assessment. */
  quality: {
    /** Relevance score. */
    relevance: number;
    
    /** Coherence score. */
    coherence: number;
    
    /** Factual accuracy. */
    factualAccuracy: number;
    
    /** Bias indicators. */
    biasIndicators: string[];
  };
}

// ========================================
// MODEL MANAGEMENT TYPES
// ========================================

/**
 * Model lifecycle management.
 */
interface ModelLifecycle {
  /** Model identifier. */
  modelId: string;
  
  /** Model version. */
  version: string;
  
  /** Lifecycle stage. */
  stage: 'development' | 'training' | 'validation' | 'testing' | 'staging' | 'production' | 'deprecated';
  
  /** Model artifacts. */
  artifacts: {
    /** Model weights. */
    weights: string;
    
    /** Model architecture. */
    architecture: string;
    
    /** Training data. */
    trainingData: string;
    
    /** Validation data. */
    validationData: string;
    
    /** Model metadata. */
    metadata: string;
  };
  
  /** Performance metrics. */
  performance: {
    /** Training metrics. */
    training: Record<string, number>;
    
    /** Validation metrics. */
    validation: Record<string, number>;
    
    /** Test metrics. */
    test: Record<string, number>;
    
    /** Production metrics. */
    production: Record<string, number>;
  };
  
  /** Deployment configuration. */
  deployment: {
    /** Deployment target. */
    target: 'cpu' | 'gpu' | 'tpu' | 'edge';
    
    /** Resource requirements. */
    resources: {
      cpu: number;
      memory: number;
      gpu?: number;
    };
    
    /** Scaling configuration. */
    scaling: {
      minInstances: number;
      maxInstances: number;
      targetUtilization: number;
    };
  };
  
  /** Monitoring configuration. */
  monitoring: {
    /** Drift detection. */
    driftDetection: {
      enabled: boolean;
      threshold: number;
      methods: string[];
    };
    
    /** Performance monitoring. */
    performanceMonitoring: {
      enabled: boolean;
      metrics: string[];
      alertThresholds: Record<string, number>;
    };
    
    /** A/B testing. */
    abTesting: {
      enabled: boolean;
      trafficSplit: number;
      duration: number;
    };
  };
}

// ========================================
// MODEL MANAGER TYPES
// ========================================

/**
 * Model metadata for lifecycle management.
 */
interface ModelMetadata {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: ModelType;
  readonly filePath: string;
  readonly size: number;
  readonly createdAt: number;
  lastUsed: number;
  usageCount: number;
  readonly checksum: string;
  readonly tags: readonly string[];
}

/**
 * Model instance with runtime information.
 */
interface ModelInstance {
  readonly id: string;
  readonly metadata: ModelMetadata;
  readonly model: ModelWrapper;
  status: ModelStatus;
  readonly memoryUsage: number;
  readonly loadTime: number;
  lastAccessed: number;
  errorCount: number;
  readonly performance: ModelPerformanceMetrics;
}

/**
 * Model lifecycle status.
 */
type ModelStatus = 'loading' | 'ready' | 'unloading' | 'error';

/**
 * Model performance monitoring metrics.
 */
interface ModelPerformanceMetrics {
  readonly inferenceTime: {
    average: number;
    readonly p95: number;
    readonly p99: number;
    min: number;
    max: number;
  };
  accuracy: number;
  throughput: number;
  errorRate: number;
  memoryEfficiency: number;
  cpuUtilization: number;
  driftScore: number;
}

/**
 * Model loading configuration options.
 */
interface ModelLoadOptions {
  readonly warmup?: boolean;
  readonly precompile?: boolean;
  readonly memoryLimit?: number;
  readonly priority?: ModelPriority;
  readonly timeout?: number;
  readonly retries?: number;
}

/**
 * Model loading priority levels.
 */
type ModelPriority = 'low' | 'normal' | 'high';

/**
 * Model manager system configuration.
 */
interface ModelManagerConfig {
  readonly maxConcurrentModels: number;
  readonly maxMemoryUsage: number;
  readonly defaultTimeout: number;
  readonly enableMonitoring: boolean;
  readonly enableCaching: boolean;
  readonly cleanupInterval: number;
  readonly performanceThresholds: ModelPerformanceThresholds;
  readonly autoUnload: ModelAutoUnloadConfig;
}

/**
 * Performance threshold configuration.
 */
interface ModelPerformanceThresholds {
  readonly maxInferenceTime: number;
  readonly minAccuracy: number;
  readonly maxErrorRate: number;
  readonly maxDriftScore: number;
}

/**
 * Auto-unload configuration for memory management.
 */
interface ModelAutoUnloadConfig {
  readonly enabled: boolean;
  readonly idleTime: number;
  readonly memoryThreshold: number;
}

/**
 * Model wrapper interface for different frameworks.
 */
interface ModelWrapper {
  readonly type: ModelType;
  readonly loadTime: number;
  readonly modelPath: string;
  readonly size: number;
  readonly config: Record<string, unknown>;
  readonly predict: (input: unknown) => Promise<ModelPredictionResult>;
  readonly dispose: () => Promise<void>;
}

/**
 * Model prediction result structure.
 */
interface ModelPredictionResult {
  readonly predictions: unknown;
  readonly confidence: number;
}

/**
 * Comprehensive prediction result with metadata.
 */
interface PredictionResult<T = unknown> {
  readonly predictions: T;
  readonly confidence: number;
  readonly modelId: string;
  readonly timestamp: number;
  readonly processingTime: number;
}

/**
 * Model resource usage metrics.
 */
interface ModelResourceUsage {
  readonly totalMemory: number;
  readonly modelCount: number;
  readonly cpuUsage: number;
  readonly loadedModels: readonly string[];
  readonly averageInferenceTime: number;
}

/**
 * Model health check result.
 */
interface ModelHealthCheck {
  readonly healthy: readonly string[];
  readonly unhealthy: readonly string[];
  readonly issues: readonly ModelHealthIssue[];
}

/**
 * Model health issue details.
 */
interface ModelHealthIssue {
  readonly modelId: string;
  readonly issue: string;
  readonly severity: HealthIssueSeverity;
}

/**
 * Health issue severity levels.
 */
type HealthIssueSeverity = 'low' | 'medium' | 'high';

/**
 * Model validation configuration.
 */
interface ModelValidationConfig {
  readonly validateChecksum: boolean;
  readonly enforceVersioning: boolean;
  readonly requireMetadata: boolean;
  readonly maxFileSize: number;
}

// ========================================
// EXPORTS
// ========================================

export type {
  ModelType,
  AgentType,
  LearningParadigm,
  RLAgentConfig,
  RLAgentState,
  MultiAgentSystemConfig,
  AgentMessage,
  LLMConfig,
  LLMQuery,
  LLMResponse,
  ModelLifecycle,
  ModelMetadata,
  ModelInstance,
  ModelStatus,
  ModelPerformanceMetrics,
  ModelLoadOptions,
  ModelPriority,
  ModelManagerConfig,
  ModelPerformanceThresholds,
  ModelAutoUnloadConfig,
  ModelWrapper,
  ModelPredictionResult,
  PredictionResult,
  ModelResourceUsage,
  ModelHealthCheck,
  ModelHealthIssue,
  HealthIssueSeverity,
  ModelValidationConfig
}; 