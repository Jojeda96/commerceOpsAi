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

export type AnswerComponent =
  | 'REVIEW_COMPLAINT_THEMES'
  | 'DELIVERY_DELAY_COMPLAINTS'
  | 'PACKAGE_DAMAGE_COMPLAINTS'
  | 'REVIEW_RATING_CONTEXT'
  | 'HISTORICAL_LOGISTICS_CONTEXT'
  | 'MODEL_GOVERNANCE'
  | 'PREDICTION'
  | 'LOCAL_EXPLANATION'
  | 'ANOMALY_DETECTION';

export interface AnswerCoverageItem {
  component: AnswerComponent;
  status: 'ANSWERED' | 'NO_DATA_WITH_REASON' | 'UNAVAILABLE_WITH_REASON' | 'UNANSWERED';
  evidenceIds?: string[];
  reasonCode?: string;
  explanation?: string;
}

export interface FilterState {
  dateFrom?: string;
  dateTo?: string;
  sellerIds?: string[];
  categories?: string[];
  customerStates?: string[];
}

export type ScopeSource =
  | 'REQUEST_DTO'
  | 'DETERMINISTIC_QUESTION_PARSER'
  | 'CRITIC_PATCH'
  | 'UNSPECIFIED';

export interface ScopeProvenanceEntry {
  field:
    | 'dateFrom'
    | 'dateTo'
    | 'categories'
    | 'sellerIds'
    | 'sellerStates'
    | 'customerStates'
    | 'interstateOnly';
  source: ScopeSource;
  rawText?: string;
}

export interface AnalysisScope {
  dateFrom?: string;
  dateTo?: string;
  categories?: string[];
  sellerIds?: string[];
  sellerStates?: string[];
  customerStates?: string[];
  interstateOnly: boolean;
  provenance: ScopeProvenanceEntry[];
  scopeHash: string;
}

export interface ScopeDatasetCoverage {
  minDate: string;
  maxDate: string;
  isOutsideCoverage: boolean;
}

import {
  MetricUnit,
  AnalysisMethod,
  EvidenceMetric,
  NumericClaim,
  MethodClaim,
  ToolResultEnvelope,
  METRIC_LABELS,
  DeliveryAggregateData,
  RouteDistributionData,
  RouteMetric,
  StageBreakdownData,
} from './analytics';

import {
  FindingAuditStatus,
  EvidenceQualityResult,
  EvidenceQualityDimensions,
  FindingAuditResult,
} from './audit';

import { RecommendationKind, ValidatedRecommendation } from './recommendations';

export * from './analytics';
export * from './audit';
export * from './recommendations';

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
  | 'BLOCKED'
  | 'UNAVAILABLE';

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
  /** @deprecated Use evidenceQuality or modelGovernance instead. */
  confidence?: number;
  evidenceIds: string[];
  iteration?: number;
  supersedesFindingId?: string;
  status?: 'ACTIVE' | 'SUPERSEDED';
  operationalStatus?: FindingOperationalStatus;
  modelGovernance?: ModelGovernanceMetadata;
  numericClaims?: NumericClaim[];
  methodClaims?: MethodClaim[];
  auditStatus?: FindingAuditStatus;
  auditMessages?: string[];
  evidenceQuality?: EvidenceQualityResult;
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
  scopeHash?: string;
  appliedScope?: AnalysisScope;
  status?: 'AVAILABLE' | 'NO_DATA' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE' | 'ERROR';
  reasonCode?: string;
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
  status: 'RESOLVED' | 'UNRESOLVED';
  resolutionNote?: string;
}

export interface ModelPrediction {
  id?: string;
  investigationId: string;
  findingId?: string;
  scenarioId?: string;
  modelName: string;
  modelVersion: string;
  deploymentStatus: string;
  probability: number;
  threshold: number;
  predictedDelayed: boolean;
  riskLevel: Priority;
  operationallyActionable: boolean;
  featuresJson?: Record<string, unknown>;
  explanationJson?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  investigationId: string;
  title: string;
  description: string;
  priority: Priority;
  kind?: RecommendationKind;
  evidenceBasis?: string[];
  supportingFindingIds?: string[];
  validationRequirements?: string[];
  expectedImpact?: string;
  expectedImpactClaims?: NumericClaim[];
  assumptions?: string[];
  createdAt?: string;
}

export interface CriticFeedback {
  id: string;
  investigationId: string;
  severity: Priority;
  message: string;
  status: 'OPEN' | 'RESOLVED';
}

export interface InvestigationReport {
  investigationId: string;
  title?: string;
  question?: string;
  status?: InvestigationStatus;
  executiveSummary?: string;
  qualityScore?: number;
  iterationCount?: number;
  completedAt?: string;
  generatedAt?: string;
  findings?: Finding[];
  keyFindings?: Finding[];
  evidenceList?: Evidence[];
  recommendations: Recommendation[];
  criticFeedback?: CriticFeedback[];
  limitations?: string[];
}

export type FinalReport = InvestigationReport;

export type InvestigationEventType =
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'finding.created'
  | 'recommendation.created'
  | 'investigation.started'
  | 'investigation.queued'
  | 'investigation.completed'
  | 'investigation.failed'
  | 'critic.feedback'
  | 'plan.created'
  | 'report.completed';

export interface InvestigationEvent {
  eventId?: string;
  investigationId: string;
  sequence?: number;
  iteration?: number;
  timestamp: string;
  type: InvestigationEventType | string;
  payload: Record<string, unknown>;
}
