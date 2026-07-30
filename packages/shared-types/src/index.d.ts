export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AgentName = 'SALES' | 'LOGISTICS' | 'CUSTOMER_EXPERIENCE' | 'SELLER_PERFORMANCE' | 'ANOMALY' | 'DATA_SCIENCE' | 'CRITIC' | 'STRATEGY';
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
export type FindingOperationalStatus = 'ACTIONABLE' | 'EXPERIMENTAL_CONTEXT' | 'BLOCKED';
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
    agent: AgentName;
    agentName?: AgentName;
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
    supportingFindingIds?: string[];
    createdAt: string;
}
export interface FinalReport {
    investigationId: string;
    executiveSummary: string;
    overallRiskLevel: Priority;
    keyFindingsCount: number;
    recommendedActionsCount: number;
    generatedAt: string;
}