export type FindingAuditStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'APPROVED_WITH_WARNINGS'
  | 'REJECTED'
  | 'NOT_APPLICABLE';

export interface EvidenceQualityDimensions {
  executionIntegrity: number;
  scopeConsistency: number;
  numericGrounding: number;
  sampleAdequacy: number;
  methodProvenance: number;
}

export interface EvidenceQualityResult {
  score: number;
  grade: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_APPLICABLE';
  computedBy: 'DETERMINISTIC_V4_2';
  dimensions: EvidenceQualityDimensions;
  rationale: string[];
}

export interface FindingAuditResult {
  findingId: string;
  status: FindingAuditStatus;
  errors: string[];
  warnings: string[];
  evidenceQuality: EvidenceQualityResult;
}
