'use client';

interface FindingConfidenceBadgeProps {
  confidence?: number;
  operationalStatus?: string;
  auditStatus?: string;
  findingType?: string;
}

export function FindingConfidenceBadge({
  confidence,
  operationalStatus,
  auditStatus = 'PENDING',
  findingType,
}: FindingConfidenceBadgeProps) {
  if (operationalStatus === 'BLOCKED' || operationalStatus === 'UNAVAILABLE') {
    return (
      <div style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 'var(--radius-sm)', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>
        ⚠️ Estado: NO DISPONIBLE (Confianza: NO APLICA)
      </div>
    );
  }

  const pct = Math.round((confidence || 0.85) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent-success)' }}>
        Calidad de Evidencia: {pct}%
      </span>
      <span style={{ fontSize: '0.75rem', color: auditStatus === 'APPROVED' ? 'var(--color-accent-success)' : 'var(--color-text-muted)' }}>
        Auditoría: {auditStatus}
      </span>
    </div>
  );
}
