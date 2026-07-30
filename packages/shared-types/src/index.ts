export type AgentName =
  | 'SUPERVISOR'
  | 'SALES'
  | 'LOGISTICS'
  | 'CUSTOMER_EXPERIENCE'
  | 'SELLER_PERFORMANCE'
  | 'ANOMALY'
  | 'DATA_SCIENCE'
  | 'STRATEGY'
  | 'CRITIC';

export type InvestigationStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'NEEDS_HUMAN_REVIEW'
  | 'REJECTED'
  | 'FAILED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CriticDecision =
  | 'APPROVED'
  | 'APPROVED_WITH_WARNINGS'
  | 'REQUIRES_MORE_ANALYSIS'
  | 'REJECTED';

export interface FilterState {
  dateFrom?: string;
  dateTo?: string;
  sellerIds?: string[];
  categories?: string[];
  customerStates?: string[];
}

export interface EvidenceMetric {
  key: string;
  value: number;
  unit?: string;
  sampleSize?: number;
  sourcePath?: string;
}

export interface NumericClaim {
  metricKey: string;
  value: number;
  unit?: string;
  evidenceId: string;
  tolerance?: number;
}

export interface RequiredAction {
  agentName: AgentName;
  actionCode: string;
  description: string;
  findingIds: string[];
}

export interface InvestigationTask {
  id: string;
  investigationId: string;
  agentName: AgentName;
  objective: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  dependsOn?: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface AgentRunTrace {
  localRunId: string;
  agentName: AgentName;
  iteration: number;
  model?: string;
  promptVersion?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
}

export interface ToolExecutionTrace {
  localExecutionId: string;
  localAgentRunId: string;
  agentName: AgentName;
  iteration: number;
  toolName: string;
  parameters: unknown;
  resultSummary?: unknown;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
}

export type FindingOperationalStatus =
  | 'ACTIONABLE'
  | 'EXPERIMENTAL_CONTEXT'
  | 'BLOCKED';

export interface ModelGovernanceMetadata {
  modelName: string;
  modelVersion: string;
  deploymentStatus: string;
  operationallyActionable: boolean;
  reasons: string[];
}

export interface Finding {
  id: string;
  investigationId: string;
  agentRunId?: string;
  localAgentRunId?: string;
  agentName?: AgentName;
  agent: AgentName;
  title: string;
  description: string;
  findingType: string;
  confidence: number;
  evidenceIds: string[];
  iteration?: number;
  supersedesFindingId?: string;
  status?: 'ACTIVE' | 'SUPERSEDED';
  operationalStatus?: FindingOperationalStatus;
  modelGovernance?: ModelGovernanceMetadata;
  numericClaims?: NumericClaim[];
  createdAt: string;
}

export interface Evidence {
  id: string;
  toolExecutionId?: string;
  localAgentRunId?: string;
  localToolExecutionId?: string;
  sourceType?: 'TOOL_EXECUTION' | 'MODEL_PREDICTION' | 'MANUAL_CONTEXT';
  agentName?: AgentName;
  iteration?: number;
  toolName: string;
  queryHash?: string;
  parameters: Record<string, unknown>;
  resultSummary: string;
  rawReference?: string;
  rowCount?: number;
  sampleSize?: number;
  metrics?: EvidenceMetric[];
  generatedAt: string;
}

export interface Contradiction {
  id: string;
  findingIdA: string;
  findingIdB: string;
  description: string;
  severity: Priority;
}

export interface CriticFeedback {
  id: string;
  investigationId: string;
  findingId?: string;
  severity: Priority;
  message: string;
  requiredAction?: string;
  requestedAgents?: AgentName[];
  requiredActions?: RequiredAction[];
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
}

export interface Recommendation {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  priority: Priority;
  expectedImpact?: string;
  expectedImpactClaims?: NumericClaim[];
  supportingFindingIds: string[];
  assumptions: string[];
  createdAt?: string;
}

export interface FinalReport {
  investigationId: string;
  executiveSummary: string;
  keyFindings: Finding[];
  evidenceList: Evidence[];
  recommendations: Recommendation[];
  limitations: string[];
  qualityScore: number;
  generatedAt: string;
}

export interface CommerceOpsState {
  investigationId: string;
  userQuestion: string;
  filters: FilterState;
  investigationPlan: InvestigationTask[];
  activeAgents: AgentName[];
  completedAgents: AgentName[];
  findings: Finding[];
  evidence: Evidence[];
  contradictions: Contradiction[];
  criticFeedback: CriticFeedback[];
  recommendations: Recommendation[];
  finalReport?: FinalReport;
  iteration: number;
  maxIterations: number;
  requiresHumanReview: boolean;
  criticDecision: string;
  criticScore: number;
  requestedAgents: AgentName[];
  requiredActions?: RequiredAction[];
}

export type InvestigationEventType =
  | 'investigation.started'
  | 'plan.created'
  | 'agent.started'
  | 'agent.completed'
  | 'tool.started'
  | 'tool.completed'
  | 'finding.created'
  | 'critic.feedback'
  | 'iteration.started'
  | 'recommendation.created'
  | 'report.completed'
  | 'investigation.completed'
  | 'investigation.failed';

export interface InvestigationEvent {
  type: InvestigationEventType;
  investigationId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}
