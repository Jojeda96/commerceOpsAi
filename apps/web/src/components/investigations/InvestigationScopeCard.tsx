'use client';

interface ScopeCardProps {
  analysisScope?: {
    dateFrom?: string | null;
    dateTo?: string | null;
    categories?: string[] | null;
    sellerStates?: string[] | null;
    customerStates?: string[] | null;
    interstateOnly?: boolean;
    scopeHash?: string;
  };
}

export function InvestigationScopeCard({ analysisScope }: ScopeCardProps) {
  if (!analysisScope) {
    return (
      <div style={{ padding: '12px', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
        <strong>Scope Inmutable:</strong> Todo el periodo disponible (Sin filtros de fecha forzados)
      </div>
    );
  }

  const dateFromText = analysisScope.dateFrom ? new Date(analysisScope.dateFrom).toLocaleDateString() : 'Inicio dataset (2016)';
  const dateToText = analysisScope.dateTo ? new Date(analysisScope.dateTo).toLocaleDateString() : 'Fin dataset (2018)';

  return (
    <div style={{ padding: '14px 16px', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
      <div style={{ fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>🎯 AnalysisScope Inmutable por Ronda</span>
        <span style={{ fontFamily: 'monospace', color: 'var(--color-accent-primary)', fontSize: '0.8rem' }}>Hash: {analysisScope.scopeHash || 'n/a'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', color: 'var(--color-text-secondary)' }}>
        <div>📅 <strong>Periodo:</strong> {analysisScope.dateFrom || analysisScope.dateTo ? `${dateFromText} - ${dateToText}` : 'Todo el periodo disponible'}</div>
        <div>📦 <strong>Categorías:</strong> {analysisScope.categories && analysisScope.categories.length > 0 ? analysisScope.categories.join(', ') : 'Todas'}</div>
        <div>🚛 <strong>Rutas:</strong> {analysisScope.interstateOnly ? 'Solo Interestatales (distinto estado)' : 'Todas las rutas'}</div>
      </div>
    </div>
  );
}
