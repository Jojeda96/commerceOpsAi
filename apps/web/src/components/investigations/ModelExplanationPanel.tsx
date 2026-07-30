'use client';

interface ModelExplanationPanelProps {
  modelPredictions?: any[];
}

export function ModelExplanationPanel({ modelPredictions }: ModelExplanationPanelProps) {
  const validExplanations = (modelPredictions || [])
    .filter((mp) => mp.explanationJson && mp.explanationJson.status === 'AVAILABLE')
    .map((mp) => ({
      scenarioId: mp.scenarioId,
      explanationType: mp.explanationJson.explanationType || 'LOCAL_SHAP',
      topFeatures: mp.explanationJson.topFeatures || [],
    }));

  if (validExplanations.length === 0) {
    return (
      <div style={{ padding: '10px 12px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
        ℹ️ No se generó una explicación local (SHAP) porque no existe una predicción válida producida para este escenario.
      </div>
    );
  }

  return (
    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-main)', marginBottom: '6px' }}>
        📊 Factores de Mayor Impacto Local ({validExplanations[0].explanationType})
      </div>
      {validExplanations.map((exp, i) => (
        <div key={i} style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          {exp.topFeatures.slice(0, 3).map((f: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
              <span>• {f.feature}</span>
              <span style={{ fontWeight: 600, color: f.contribution > 0 ? '#ef4444' : 'var(--color-accent-success)' }}>
                {f.contribution > 0 ? `+${f.contribution}` : f.contribution}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
