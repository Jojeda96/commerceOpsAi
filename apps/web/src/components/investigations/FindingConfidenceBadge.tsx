'use client';

import React from 'react';
import { EvidenceQualityResult, FindingAuditStatus } from '@commerce-ops/shared-types';
import { FindingAuditBadge } from './FindingAuditBadge';
import { EvidenceQualityBreakdown } from './EvidenceQualityBreakdown';

interface FindingConfidenceBadgeProps {
  confidence?: number;
  operationalStatus?: string;
  auditStatus?: FindingAuditStatus;
  auditMessages?: string[];
  evidenceQuality?: EvidenceQualityResult;
  findingType?: string;
}

export function FindingConfidenceBadge({
  operationalStatus,
  auditStatus,
  auditMessages,
  evidenceQuality,
}: FindingConfidenceBadgeProps) {
  if (operationalStatus === 'BLOCKED' || operationalStatus === 'UNAVAILABLE') {
    return (
      <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-semibold">
        ⚠️ Estado: NO DISPONIBLE (Confiabilidad predictiva: NO APLICA)
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <FindingAuditBadge status={auditStatus} messages={auditMessages} />
      <EvidenceQualityBreakdown value={evidenceQuality} />
    </div>
  );
}
