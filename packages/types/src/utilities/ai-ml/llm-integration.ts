/**
 * @file LLM Integration Utilities Type Definitions
 * 
 * Comprehensive type definitions for large language model integration utilities
 * including client management, prompt engineering, response processing, and API interactions.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

// ========================================
// LLM CLIENT TYPES
// ========================================

/**
 * LLM provider configuration.
 */
interface LLMProviderConfig {
  readonly providerId: string;
  readonly providerName: string;
  readonly apiEndpoint: string;
  readonly apiKey: string;
  readonly modelName: string;
  readonly maxTokens: number;
  readonly timeout: number;
  readonly rateLimits: RateLimitConfig;
  readonly retryConfig: LLMRetryConfig;
}

/**
 * Rate limiting configuration for LLM APIs.
 */
interface RateLimitConfig {
  readonly requestsPerMinute: number;
  readonly tokensPerMinute: number;
  readonly concurrentRequests: number;
  readonly burstAllowance: number;
}

/**
 * LLM API retry configuration.
 */
interface LLMRetryConfig {
  readonly maxRetries: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly exponentialBackoff: boolean;
  readonly retryableErrors: string[];
}

/**
 * LLM request parameters.
 */
interface LLMRequestParams {
  readonly temperature: number;
  readonly topP: number;
  readonly topK?: number;
  readonly frequencyPenalty: number;
  readonly presencePenalty: number;
  readonly stop?: string[];
  readonly seed?: number;
  readonly stream: boolean;
}

// ========================================
// PROMPT ENGINEERING TYPES
// ========================================

/**
 * Prompt template configuration.
 */
interface PromptTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly description: string;
  readonly template: string;
  readonly variables: PromptVariable[];
  readonly systemPrompt?: string;
  readonly examples: PromptExample[];
  readonly metadata: PromptMetadata;
}

/**
 * Prompt template variable.
 */
interface PromptVariable {
  readonly name: string;
  readonly type: VariableType;
  readonly required: boolean;
  readonly defaultValue?: string;
  readonly validation?: VariableValidation;
  readonly description: string;
}

/**
 * Variable types for prompt templates.
 */
type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'json';

/**
 * Variable validation rules.
 */
interface VariableValidation {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly allowedValues?: string[];
  readonly customValidator?: string;
}

/**
 * Prompt example for few-shot learning.
 */
interface PromptExample {
  readonly input: Record<string, unknown>;
  readonly output: string;
  readonly explanation?: string;
}

/**
 * Prompt template metadata.
 */
interface PromptMetadata {
  readonly category: string;
  readonly tags: string[];
  readonly version: string;
  readonly author: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly usageCount: number;
  readonly averageRating: number;
}

/**
 * Compiled prompt ready for execution.
 */
interface CompiledPrompt {
  readonly templateId: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly variables: Record<string, unknown>;
  readonly tokenCount: number;
  readonly timestamp: number;
}

// ========================================
// CONVERSATION TYPES
// ========================================

/**
 * Conversation message structure.
 */
interface ConversationMessage {
  readonly role: MessageRole;
  readonly content: string;
  readonly name?: string;
  readonly functionCall?: FunctionCall;
  readonly timestamp: number;
  readonly metadata?: MessageMetadata;
}

/**
 * Message roles in conversation.
 */
type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * Function call information.
 */
interface FunctionCall {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly callId: string;
}

/**
 * Message metadata.
 */
interface MessageMetadata {
  readonly messageId: string;
  readonly conversationId: string;
  readonly tokenCount: number;
  readonly model: string;
  readonly temperature: number;
  readonly reasoning?: string;
}

/**
 * Conversation context management.
 */
interface ConversationContext {
  readonly conversationId: string;
  readonly messages: ConversationMessage[];
  readonly totalTokens: number;
  readonly maxTokens: number;
  readonly contextWindow: number;
  readonly compressionEnabled: boolean;
  readonly lastActivity: number;
}

// ========================================
// RESPONSE PROCESSING TYPES
// ========================================

/**
 * LLM response structure.
 */
interface LLMResponse {
  readonly requestId: string;
  readonly model: string;
  readonly content: string;
  readonly finishReason: FinishReason;
  readonly usage: TokenUsage;
  readonly metadata: ResponseMetadata;
  readonly functionCalls?: FunctionCall[];
  readonly timestamp: number;
}

/**
 * Reasons for response completion.
 */
type FinishReason = 'stop' | 'length' | 'function_call' | 'content_filter' | 'error';

/**
 * Token usage information.
 */
interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly cost?: number;
}

/**
 * Response metadata.
 */
interface ResponseMetadata {
  readonly responseTime: number;
  readonly model: string;
  readonly providerId: string;
  readonly requestTimestamp: number;
  readonly responseTimestamp: number;
  readonly rateLimitRemaining: number;
  readonly rateLimitReset: number;
}

/**
 * Structured response extraction configuration.
 */
interface ResponseExtractionConfig {
  readonly extractionType: ExtractionType;
  readonly schema?: Record<string, unknown>;
  readonly patterns?: ExtractionPattern[];
  readonly validation: boolean;
  readonly fallbackStrategy: FallbackStrategy;
}

/**
 * Response extraction types.
 */
type ExtractionType = 'json' | 'xml' | 'markdown' | 'regex' | 'custom';

/**
 * Pattern for extracting structured data.
 */
interface ExtractionPattern {
  readonly name: string;
  readonly pattern: string;
  readonly flags?: string;
  readonly required: boolean;
  readonly type: 'string' | 'number' | 'boolean' | 'array';
}

/**
 * Fallback strategies for failed extractions.
 */
type FallbackStrategy = 'retry' | 'default' | 'error' | 'manual';

// ========================================
// FUNCTION CALLING TYPES
// ========================================

/**
 * Function definition for LLM calling.
 */
interface LLMFunction {
  readonly name: string;
  readonly description: string;
  readonly parameters: FunctionParameters;
  readonly implementation?: string;
  readonly category: string;
  readonly dangerous: boolean;
}

/**
 * Function parameter schema.
 */
interface FunctionParameters {
  readonly type: 'object';
  readonly properties: Record<string, ParameterProperty>;
  readonly required: string[];
  readonly additionalProperties: boolean;
}

/**
 * Individual parameter property.
 */
interface ParameterProperty {
  readonly type: string;
  readonly description: string;
  readonly enum?: string[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
  readonly items?: ParameterProperty;
}

/**
 * Function execution result.
 */
interface FunctionExecutionResult {
  readonly functionName: string;
  readonly callId: string;
  readonly success: boolean;
  readonly result?: unknown;
  readonly error?: string;
  readonly executionTime: number;
  readonly timestamp: number;
}

// ========================================
// EMBEDDING TYPES
// ========================================

/**
 * Text embedding configuration.
 */
interface EmbeddingConfig {
  readonly model: string;
  readonly dimensions: number;
  readonly maxInputLength: number;
  readonly batchSize: number;
  readonly normalization: boolean;
}

/**
 * Embedding request.
 */
interface EmbeddingRequest {
  readonly requestId: string;
  readonly texts: string[];
  readonly model: string;
  readonly parameters: EmbeddingConfig;
}

/**
 * Embedding response.
 */
interface EmbeddingResponse {
  readonly requestId: string;
  readonly embeddings: number[][];
  readonly model: string;
  readonly usage: TokenUsage;
  readonly timestamp: number;
}

/**
 * Similarity search configuration.
 */
interface SimilaritySearchConfig {
  readonly metric: SimilarityMetric;
  readonly topK: number;
  readonly threshold?: number;
  readonly includeMetadata: boolean;
}

/**
 * Similarity metrics for embeddings.
 */
type SimilarityMetric = 'cosine' | 'euclidean' | 'manhattan' | 'dot_product';

/**
 * Similarity search result.
 */
interface SimilaritySearchResult {
  readonly queryId: string;
  readonly results: SimilarityMatch[];
  readonly timestamp: number;
}

/**
 * Individual similarity match.
 */
interface SimilarityMatch {
  readonly id: string;
  readonly text: string;
  readonly score: number;
  readonly metadata?: Record<string, unknown>;
}

// ========================================
// EXPORTS
// ========================================

export type {
  LLMProviderConfig,
  RateLimitConfig,
  LLMRetryConfig,
  LLMRequestParams,
  PromptTemplate,
  PromptVariable,
  VariableType,
  VariableValidation,
  PromptExample,
  PromptMetadata,
  CompiledPrompt,
  ConversationMessage,
  MessageRole,
  FunctionCall,
  MessageMetadata,
  ConversationContext,
  LLMResponse,
  FinishReason,
  TokenUsage,
  ResponseMetadata,
  ResponseExtractionConfig,
  ExtractionType,
  ExtractionPattern,
  FallbackStrategy,
  LLMFunction,
  FunctionParameters,
  ParameterProperty,
  FunctionExecutionResult,
  EmbeddingConfig,
  EmbeddingRequest,
  EmbeddingResponse,
  SimilaritySearchConfig,
  SimilarityMetric,
  SimilaritySearchResult,
  SimilarityMatch
}; 