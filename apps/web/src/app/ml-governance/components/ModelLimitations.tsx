'use client';

interface Props {
  deploymentStatus: string;
}

const LIMITATIONS = [
  {
    title: 'Dataset Olist 2016–2018',
    description:
      'Los datos cubren e-commerce brasileño de una plataforma específica. Las conclusiones son demostrativas y no representan condiciones logísticas actuales ni de otros mercados.',
    severity: 'warning',
  },
  {
    title: 'Modelo experimental — no aprobado para operaciones',
    description:
      'El predictor no supera los quality gates de ROC-AUC ≥ 0.60 y PR-AUC lift > 1.5x. Está bloqueado para decisiones operativas automáticas. Solo es válido para análisis exploratorio bajo supervisión humana.',
    severity: 'error',
  },
  {
    title: 'Prevalencia de positivos ~6.6%',
    description:
      'El dataset tiene desbalance significativo. Las métricas de accuracy son engañosas. PR-AUC es la métrica principal para evaluar utilidad operativa con esta prevalencia.',
    severity: 'warning',
  },
  {
    title: 'Drift temporal en features históricas',
    description:
      'Variables como seller_prior_late_rate_smoothed, route_prior_late_rate_smoothed y category_prior_late_rate_smoothed muestran drift HIGH entre entrenamiento y test, lo que explica parte del gap de desempeño.',
    severity: 'warning',
  },
  {
    title: 'Gap validación vs test',
    description:
      'El ROC-AUC en walk-forward CV (~0.725) es significativamente mayor que en test (0.4528). Esto sugiere que el modelo no generaliza bien fuera del período de desarrollo.',
    severity: 'error',
  },
  {
    title: 'Momento de predicción: ORDER_PURCHASE',
    description:
      'Solo se usan features disponibles al momento de la compra. Fechas de entrega al carrier (order_delivered_carrier_date) están explícitamente excluidas del contrato de features (INV-01).',
    severity: 'info',
  },
  {
    title: 'SHAP no implica causalidad',
    description:
      'Las explicaciones SHAP para XGBoost indican contribución marginal en la escala del modelo, no causalidad. Una feature importante puede ser un proxy de otra variable latente.',
    severity: 'info',
  },
  {
    title: 'Sin inferencia en tiempo real',
    description:
      'El sistema actual aplica el modelo a escenarios históricos point-in-time. No tiene integración con streams de órdenes en tiempo real ni con sistemas de notificación operativa.',
    severity: 'info',
  },
];

const PERMITTED_USES = [
  '✅ Análisis exploratorio de riesgo de atraso bajo supervisión humana',
  '✅ Comparación de modelos y metodologías durante desarrollo',
  '✅ Demostración de capacidades técnicas en contexto de portafolio',
  '✅ Priorización manual de órdenes para investigación adicional',
];

const PROHIBITED_USES = [
  '❌ Decisiones operativas automáticas sin revisión humana',
  '❌ Comunicación de probabilidades a clientes como garantía',
  '❌ Uso en producción hasta que supere los quality gates',
  '❌ Extrapolación a datos de otros países o períodos recientes',
];

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  error: {
    border: 'rgba(239,68,68,0.35)',
    bg: 'rgba(239,68,68,0.07)',
    icon: '🔴',
  },
  warning: {
    border: 'rgba(245,158,11,0.35)',
    bg: 'rgba(245,158,11,0.07)',
    icon: '🟡',
  },
  info: {
    border: 'rgba(99,102,241,0.25)',
    bg: 'rgba(99,102,241,0.06)',
    icon: '🔵',
  },
};

export function ModelLimitations({ deploymentStatus }: Props) {
  const isBlocked = deploymentStatus !== 'APPROVED_FOR_DEMO_INFERENCE';

  return (
    <section aria-labelledby="limitations-heading">
      <h2 id="limitations-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
        Limitaciones y Uso Permitido
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
        Estas limitaciones son parte del resultado científico honesto. No ocultar brechas es
        parte de la gobernanza responsable.
      </p>

      {isBlocked && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderLeft: '4px solid #ef4444',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '0.85rem',
          }}
        >
          <strong style={{ color: '#ef4444' }}>Estado actual: EXPERIMENTAL — BLOQUEADO</strong>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '6px' }}>
            El modelo no supera los umbrales de calidad requeridos. La API responde HTTP 503 por
            defecto. Bloquear un modelo experimental que no generaliza es el resultado correcto,
            no un fracaso.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
            background: 'rgba(34,197,94,0.06)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '10px', color: '#4ade80' }}>
            Usos Permitidos
          </h3>
          <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
            {PERMITTED_USES.map((use) => (
              <li key={use} style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                {use}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '10px', color: '#f87171' }}>
            Usos Prohibidos
          </h3>
          <ul style={{ paddingLeft: '0', listStyle: 'none' }}>
            {PROHIBITED_USES.map((use) => (
              <li key={use} style={{ fontSize: '0.83rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                {use}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '14px' }}>
        Limitaciones Técnicas Conocidas
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {LIMITATIONS.map(({ title, description, severity }) => {
          const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES['info'];
          return (
            <div
              key={title}
              style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <p style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                {style.icon} {title}
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
