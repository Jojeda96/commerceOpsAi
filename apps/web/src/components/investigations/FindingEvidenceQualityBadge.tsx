import React from 'react';
import { EvidenceQualityResult, FindingAuditStatus } from '@commerce-ops/shared-types';
import { EvidenceQualityBreakdown } from './EvidenceQualityBreakdown';
import { FindingAuditBadge } from './FindingAuditBadge';

interface Props {
  auditStatus?: FindingAuditStatus;
  auditMessages?: string[];
  evidenceQuality?: EvidenceQualityResult;
  confidence?: number;
}

export const FindingEvidenceQualityBadge: React.FC<Props> = ({
  auditStatus,
  auditMessages,
  evidenceQuality,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <FindingAuditBadge status={auditStatus} messages={auditMessages} />
      <EvidenceQualityBreakdown value={evidenceQuality} />
    </div>
  );
};
