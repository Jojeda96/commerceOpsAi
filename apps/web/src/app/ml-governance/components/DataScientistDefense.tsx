'use client';

import { useState, useMemo } from 'react';
import type { MlDefenseResponse, DefenseCategory } from '../types';
import { DefenseQuestionItem } from './DefenseQuestion';

interface Props {
  defense: MlDefenseResponse;
}

const ALL_CATEGORIES = 'Todas';

export function DataScientistDefense({ defense }: Props) {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);

  const { categories, metrics_snapshot } = defense;

  const categoryNames = useMemo(
    () => [ALL_CATEGORIES, ...categories.map((c: DefenseCategory) => c.title)],
    [categories],
  );

  const filteredCategories = useMemo(() => {
    return categories
      .filter(
        (cat: DefenseCategory) =>
          selectedCategory === ALL_CATEGORIES || cat.title === selectedCategory,
      )
      .map((cat: DefenseCategory) => ({
        ...cat,
        questions: cat.questions.filter(
          (q) =>
            searchText === '' ||
            q.question.toLowerCase().includes(searchText.toLowerCase()) ||
            q.answer.toLowerCase().includes(searchText.toLowerCase()),
        ),
      }))
      .filter((cat) => cat.questions.length > 0);
  }, [categories, selectedCategory, searchText]);

  const totalMatches = filteredCategories.reduce((acc, c) => acc + c.questions.length, 0);

  return (
    <section aria-labelledby="defense-heading">
      <h2 id="defense-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
        Defensa Data Scientist
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        Respuestas preparadas con evidencia técnica para entrevistas, code reviews y defensas.
        Las respuestas con badge <strong>Dinámica</strong> usan métricas actuales del modelo.
      </p>

      {metrics_snapshot && (
        <div
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '0.82rem',
          }}
        >
          <strong>Snapshot de métricas activas:</strong>{' '}
          Champion: <code>{metrics_snapshot.champion_model_name ?? 'N/A'}</code> —
          ROC-AUC test: <code>{metrics_snapshot.roc_auc_test?.toFixed(4) ?? 'N/A'}</code> —
          PR-AUC test: <code>{metrics_snapshot.pr_auc_test?.toFixed(4) ?? 'N/A'}</code> —
          Estado: <code>{metrics_snapshot.gate_status ?? 'N/A'}</code>
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '16px',
          alignItems: 'center',
        }}
      >
        <input
          id="defense-search"
          type="search"
          placeholder="Buscar pregunta o respuesta..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: 'inherit',
            fontSize: '0.85rem',
            outline: 'none',
          }}
          aria-label="Buscar preguntas de defensa"
        />
        <select
          id="defense-category-filter"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: 'inherit',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
          aria-label="Filtrar por categoría"
        >
          {categoryNames.map((name) => (
            <option key={name} value={name} style={{ background: '#1e1e2e' }}>
              {name}
            </option>
          ))}
        </select>
        {(searchText || selectedCategory !== ALL_CATEGORIES) && (
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            {totalMatches} resultado{totalMatches !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Questions accordion */}
      {filteredCategories.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            padding: '40px',
            fontSize: '0.9rem',
          }}
        >
          {categories.length === 0
            ? 'Sin preguntas disponibles. El archivo model_defense_qa.json se generará con PR-12.'
            : 'Sin resultados para la búsqueda actual.'}
        </div>
      ) : (
        filteredCategories.map((cat) => (
          <div key={cat.id} style={{ marginBottom: '20px' }}>
            <h3
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {cat.title}
              <span
                style={{
                  marginLeft: '8px',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  fontSize: '0.72rem',
                  fontWeight: 400,
                }}
              >
                {cat.questions.length}
              </span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cat.questions.map((q) => (
                <DefenseQuestionItem
                  key={q.id}
                  question={q}
                  metricsSnapshot={metrics_snapshot ?? null}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
