import { AgentName, AnalysisScope, EvidenceMetric, MethodClaim, NumericClaim } from '@commerce-ops/shared-types';

export interface EvidenceDetail {
  id: string;
  toolName: string;
  status: string;
  reasonCode?: string;
  scopeHash?: string;
  appliedScope?: AnalysisScope;
  rowCount?: number;
  sampleSize?: number;
  metrics: EvidenceMetric[];
  resultSummary: string;
}

export interface FindingDetail {
  id: string;
  agent: AgentName;
  agentName?: AgentName;
  title: string;
  description: string;
  findingType: string;
  confidence?: number;
  operationalStatus?: string;
  auditStatus?: string;
  auditMessages?: string[];
  evidenceQuality?: any;
  numericClaims?: NumericClaim[];
  methodClaims?: MethodClaim[];
  modelGovernance?: any;
  evidence: EvidenceDetail[];
}
