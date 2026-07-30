'use client';

interface ModelGovernancePanelProps {
  governance?: {
    modelName?: string;
    modelVersion?: string;
    deploymentStatus?: string;
    operationallyActionable?: boolean;
    reasons?: string[];
  };
}

export function ModelGovernancePanel({ governance }: ModelGovernancePanelProps) {
  if (!governance) return null;

  return (
    <div style={{ padding: '14px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginTop: '12px' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)', marginBottom: '6px' }}>
        ⚙️ Estado de Gobernanza del Modelo ML
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div><strong>Modelo:</strong> {governance.modelName || 'delivery_delay_champion'}</div>
        <div><strong>Versión:</strong> {governance.modelVersion || 'v3.0.0'}</div>
        <div><strong>Deployment Status:</strong> <span style={{ color: governance.operationallyActionable ? 'var(--color-accent-success)' : '#f59e0b', fontWeight: 600 }}>{governance.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED'}</span></div>
        <div><strong>Uso Operativo:</strong> {governance.operationallyActionable ? 'Aprobado' : 'Bloqueado por Quality Gate'}</div>
      </div>
      {governance.reasons && governance.reasons.length > 0 && (
        <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#f59e0b' }}>
          <strong>Motivos Quality Gate:</strong> {governance.reasons.join(', ')}
        </div>
      )}
    </div>
  );
}
