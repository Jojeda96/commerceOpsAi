'use client';

import { useState, useCallback } from 'react';
import type { DefenseQuestion, MetricsSnapshot } from '../types';

interface Props {
  question: DefenseQuestion;
  metricsSnapshot: MetricsSnapshot | null;
}

function resolveDynamicFacts(answer: string, metricsSnapshot: MetricsSnapshot | null): string {
  if (!metricsSnapshot) return answer;
  return answer
    .replace('{roc_auc_test}', metricsSnapshot.roc_auc_test?.toFixed(4) ?? 'N/A')
    .replace('{pr_auc_test}', metricsSnapshot.pr_auc_test?.toFixed(4) ?? 'N/A')
    .replace('{brier_score_test}', metricsSnapshot.brier_score_test?.toFixed(4) ?? 'N/A')
    .replace('{champion_model_name}', metricsSnapshot.champion_model_name ?? 'N/A')
    .replace('{gate_status}', metricsSnapshot.gate_status ?? 'N/A')
    .replace(
      '{positive_ratio_pct}',
      metricsSnapshot.positive_ratio != null
        ? `${(metricsSnapshot.positive_ratio * 100).toFixed(1)}%`
        : 'N/A',
    );
}

export function DefenseQuestionItem({ question, metricsSnapshot }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const resolvedAnswer = resolveDynamicFacts(question.answer, metricsSnapshot);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(resolvedAnswer).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [resolvedAnswer]);

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        id={`defense-btn-${question.id}`}
        aria-expanded={expanded}
        aria-controls={`defense-panel-${question.id}`}
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: expanded ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
          border: 'none',
          cursor: 'pointer',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          color: 'inherit',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: '0.88rem', fontWeight: expanded ? 600 : 400, flex: 1 }}>
          {question.question}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {question.is_dynamic && (
            <span
              style={{
                background: 'rgba(99,102,241,0.25)',
                color: '#a5b4fc',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '0.68rem',
              }}
            >
              Dinámica
            </span>
          )}
          <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div
          id={`defense-panel-${question.id}`}
          role="region"
          aria-labelledby={`defense-btn-${question.id}`}
          style={{
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.01)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>
            {resolvedAnswer}
          </p>

          {question.evidence && question.evidence.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Evidencia
              </p>
              <ul style={{ paddingLeft: '16px', marginTop: '6px' }}>
                {question.evidence.map((ev) => (
                  <li key={ev} style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '3px' }}>
                    <code>{ev}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                color: copied ? '#4ade80' : 'inherit',
                padding: '5px 12px',
                fontSize: '0.78rem',
                transition: 'all 0.15s',
              }}
            >
              {copied ? '✅ Copiado' : '📋 Copiar respuesta'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
