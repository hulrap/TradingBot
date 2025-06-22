/**
 * @file Multi-Agent Coordination Utilities Type Definitions
 * 
 * Comprehensive type definitions for multi-agent coordination utilities including
 * agent communication, consensus mechanisms, task allocation, and coordination protocols.
 * 
 * @version 1.0.0
 * @package @trading-bot/types
 */

// ========================================
// AGENT COMMUNICATION TYPES
// ========================================

/**
 * Agent communication message structure.
 */
interface AgentCommunicationMessage {
  readonly id: string;
  readonly senderId: string;
  readonly receiverId: string;
  readonly messageType: AgentMessageType;
  readonly payload: Record<string, unknown>;
  readonly priority: MessagePriority;
  readonly timestamp: number;
  readonly expiresAt?: number;
  readonly requiresResponse: boolean;
  readonly correlationId?: string;
}

/**
 * Types of agent messages.
 */
type AgentMessageType = 
  | 'coordination-request'
  | 'coordination-response'
  | 'task-assignment'
  | 'task-completion'
  | 'resource-request'
  | 'resource-allocation'
  | 'status-update'
  | 'performance-report'
  | 'conflict-notification'
  | 'consensus-proposal'
  | 'consensus-vote'
  | 'heartbeat'
  | 'shutdown-request';

/**
 * Message priority levels.
 */
type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Communication channel configuration.
 */
interface CommunicationChannelConfig {
  readonly channelId: string;
  readonly channelType: 'direct' | 'broadcast' | 'multicast' | 'publish-subscribe';
  readonly maxMessageSize: number;
  readonly compressionEnabled: boolean;
  readonly encryptionEnabled: boolean;
  readonly retryPolicy: RetryPolicy;
  readonly messageBufferSize: number;
}

/**
 * Message retry policy.
 */
interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly jitterEnabled: boolean;
}

// ========================================
// CONSENSUS TYPES
// ========================================

/**
 * Consensus algorithm configuration.
 */
interface ConsensusAlgorithmConfig {
  readonly algorithm: ConsensusAlgorithm;
  readonly participantIds: string[];
  readonly quorumSize: number;
  readonly timeout: number;
  readonly maxRounds: number;
  readonly parameters: Record<string, unknown>;
}

/**
 * Supported consensus algorithms.
 */
type ConsensusAlgorithm = 
  | 'byzantine-fault-tolerant'
  | 'practical-bft'
  | 'raft'
  | 'paxos'
  | 'proof-of-stake'
  | 'delegated-proof-of-stake'
  | 'federated-byzantine-agreement';

/**
 * Consensus proposal.
 */
interface ConsensusProposal {
  readonly proposalId: string;
  readonly proposerId: string;
  readonly proposalType: string;
  readonly proposalData: Record<string, unknown>;
  readonly timestamp: number;
  readonly round: number;
  readonly signature?: string;
}

/**
 * Consensus vote.
 */
interface ConsensusVote {
  readonly voteId: string;
  readonly voterId: string;
  readonly proposalId: string;
  readonly vote: 'accept' | 'reject' | 'abstain';
  readonly timestamp: number;
  readonly round: number;
  readonly justification?: string;
  readonly signature?: string;
}

/**
 * Consensus result.
 */
interface ConsensusResult {
  readonly proposalId: string;
  readonly result: 'accepted' | 'rejected' | 'timeout' | 'failure';
  readonly finalRound: number;
  readonly votes: ConsensusVote[];
  readonly timestamp: number;
  readonly executionTime: number;
}

// ========================================
// TASK ALLOCATION TYPES
// ========================================

/**
 * Task definition for agent allocation.
 */
interface AgentTask {
  readonly taskId: string;
  readonly taskType: string;
  readonly priority: TaskPriority;
  readonly requirements: TaskRequirements;
  readonly payload: Record<string, unknown>;
  readonly deadline?: number;
  readonly dependencies: string[];
  readonly estimatedDuration: number;
  readonly resourceRequirements: ResourceRequirements;
}

/**
 * Task priority levels.
 */
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';

/**
 * Task requirements specification.
 */
interface TaskRequirements {
  readonly requiredCapabilities: string[];
  readonly minimumPerformance: Record<string, number>;
  readonly preferredAgents?: string[];
  readonly excludedAgents?: string[];
  readonly parallelizable: boolean;
  readonly maxRetries: number;
}

/**
 * Resource requirements for tasks.
 */
interface ResourceRequirements {
  readonly cpu: number;
  readonly memory: number;
  readonly gpu?: number;
  readonly network: number;
  readonly storage?: number;
  readonly customResources?: Record<string, number>;
}

/**
 * Task allocation strategy.
 */
interface TaskAllocationStrategy {
  readonly strategy: AllocationStrategy;
  readonly parameters: Record<string, unknown>;
  readonly rebalancingEnabled: boolean;
  readonly rebalancingThreshold: number;
}

/**
 * Task allocation algorithms.
 */
type AllocationStrategy = 
  | 'round-robin'
  | 'weighted-round-robin'
  | 'least-connections'
  | 'resource-aware'
  | 'capability-based'
  | 'auction-based'
  | 'genetic-algorithm'
  | 'machine-learning';

/**
 * Task allocation result.
 */
interface TaskAllocationResult {
  readonly taskId: string;
  readonly assignedAgentId: string;
  readonly allocationScore: number;
  readonly estimatedCompletionTime: number;
  readonly resourceUtilization: Record<string, number>;
  readonly allocationTimestamp: number;
}

// ========================================
// COORDINATION PROTOCOL TYPES
// ========================================

/**
 * Coordination protocol configuration.
 */
interface CoordinationProtocolConfig {
  readonly protocolId: string;
  readonly protocolType: CoordinationProtocol;
  readonly participantIds: string[];
  readonly coordinatorId?: string;
  readonly parameters: Record<string, unknown>;
  readonly timeout: number;
  readonly maxIterations: number;
}

/**
 * Coordination protocol types.
 */
type CoordinationProtocol = 
  | 'centralized'
  | 'decentralized'
  | 'hierarchical'
  | 'market-based'
  | 'contract-net'
  | 'blackboard'
  | 'publish-subscribe'
  | 'peer-to-peer';

/**
 * Coordination state information.
 */
interface CoordinationState {
  readonly protocolId: string;
  readonly currentPhase: string;
  readonly iteration: number;
  readonly participantStates: Record<string, AgentCoordinationState>;
  readonly globalState: Record<string, unknown>;
  readonly timestamp: number;
}

/**
 * Individual agent coordination state.
 */
interface AgentCoordinationState {
  readonly agentId: string;
  readonly status: 'active' | 'inactive' | 'waiting' | 'executing' | 'failed';
  readonly currentTask?: string;
  readonly resourceUtilization: Record<string, number>;
  readonly performance: AgentPerformanceMetrics;
  readonly lastUpdate: number;
}

/**
 * Agent performance metrics for coordination.
 */
interface AgentPerformanceMetrics {
  readonly tasksCompleted: number;
  readonly averageExecutionTime: number;
  readonly successRate: number;
  readonly resourceEfficiency: number;
  readonly communicationLatency: number;
  readonly errorRate: number;
}

// ========================================
// CONFLICT RESOLUTION TYPES
// ========================================

/**
 * Conflict detection and resolution.
 */
interface ConflictResolutionConfig {
  readonly strategy: ConflictResolutionStrategy;
  readonly timeout: number;
  readonly maxNegotiationRounds: number;
  readonly mediatorId?: string;
  readonly parameters: Record<string, unknown>;
}

/**
 * Conflict resolution strategies.
 */
type ConflictResolutionStrategy = 
  | 'priority-based'
  | 'negotiation'
  | 'auction'
  | 'mediation'
  | 'voting'
  | 'resource-reallocation'
  | 'temporal-separation';

/**
 * Detected conflict information.
 */
interface AgentConflict {
  readonly conflictId: string;
  readonly conflictType: ConflictType;
  readonly involvedAgents: string[];
  readonly conflictData: Record<string, unknown>;
  readonly severity: ConflictSeverity;
  readonly timestamp: number;
  readonly autoResolvable: boolean;
}

/**
 * Types of agent conflicts.
 */
type ConflictType = 
  | 'resource-contention'
  | 'task-overlap'
  | 'goal-conflict'
  | 'constraint-violation'
  | 'communication-failure'
  | 'performance-degradation';

/**
 * Conflict severity levels.
 */
type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Conflict resolution result.
 */
interface ConflictResolutionResult {
  readonly conflictId: string;
  readonly resolutionStrategy: ConflictResolutionStrategy;
  readonly resolution: 'resolved' | 'unresolved' | 'escalated';
  readonly resolutionActions: ResolutionAction[];
  readonly timestamp: number;
  readonly executionTime: number;
}

/**
 * Actions taken to resolve conflicts.
 */
interface ResolutionAction {
  readonly actionType: string;
  readonly targetAgentId: string;
  readonly parameters: Record<string, unknown>;
  readonly expectedOutcome: string;
}

// ========================================
// EXPORTS
// ========================================

export type {
  AgentCommunicationMessage,
  AgentMessageType,
  MessagePriority,
  CommunicationChannelConfig,
  RetryPolicy,
  ConsensusAlgorithmConfig,
  ConsensusAlgorithm,
  ConsensusProposal,
  ConsensusVote,
  ConsensusResult,
  AgentTask,
  TaskPriority,
  TaskRequirements,
  ResourceRequirements,
  TaskAllocationStrategy,
  AllocationStrategy,
  TaskAllocationResult,
  CoordinationProtocolConfig,
  CoordinationProtocol,
  CoordinationState,
  AgentCoordinationState,
  AgentPerformanceMetrics,
  ConflictResolutionConfig,
  ConflictResolutionStrategy,
  AgentConflict,
  ConflictType,
  ConflictSeverity,
  ConflictResolutionResult,
  ResolutionAction
}; 