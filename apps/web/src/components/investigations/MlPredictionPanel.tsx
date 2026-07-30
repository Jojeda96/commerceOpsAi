'use client';

interface MlPredictionPanelProps {
  modelPredictions?: any[];
}

export function MlPredictionPanel({ modelPredictions }: MlPredictionPanelProps) {
  if (!modelPredictions || modelPredictions.length === 0) {
    return (
      <div style={{ padding: '12px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px border-dashed var(--color-border)', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        ℹ️ Predicción no disponible. No se encontraron escenarios que cumplieran los filtros y el mínimo de observaciones requeridas.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-accent-primary)' }}>
        🤖 Predicciones ML Ineridas por Escenario
      </div>
      {modelPredictions.map((mp, idx) => (
        <div key={idx} style={{ padding: '12px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Escenario {mp.scenarioId}</span>
            <span style={{ color: mp.riskLevel === 'HIGH' || mp.riskLevel === 'CRITICAL' ? '#ef4444' : 'var(--color-accent-success)' }}>
              Riesgo: {mp.riskLevel}
            </span>
          </div>
          <div style={{ marginTop: '4px', color: 'var(--color-text-secondary)' }}>
            Probabilidad estimada: <strong>{Math.round(mp.probability * 100)}%</strong> (Umbral: {Math.round(mp.threshold * 100)}%)
          </div>
        </div>
      ))}
    </div>
  );
}
