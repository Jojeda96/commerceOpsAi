import {
  FindingAuditStatus,
  EvidenceQualityResult,
} from '@commerce-ops/shared-types';

export interface FindingAuditResult {
  findingId: string;
  status: FindingAuditStatus;
  errors: string[];
  warnings: string[];
  evidenceQuality: EvidenceQualityResult;
}
