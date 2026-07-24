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
  | 'PLANNING'
  | 'EXECUTING'
  | 'REVIEWING'
  | 'COMPLETED'
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

export interface Finding {
  id: string;
  investigationId: string;
  agentRunId?: string;
  agent: AgentName;
  title: string;
  description: string;
  findingType: string;
  confidence: number;
  evidenceIds: string[];
  createdAt: string;
}

export interface Evidence {
  id: string;
  toolExecutionId?: string;
  toolName: string;
  queryHash?: string;
  parameters: Record<string, unknown>;
  resultSummary: string;
  rawResultReference?: string;
  rowCount?: number;
  sampleSize?: number;
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
