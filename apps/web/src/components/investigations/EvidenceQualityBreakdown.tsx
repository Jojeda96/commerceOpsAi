import React from 'react';
import { EvidenceQualityResult } from '@commerce-ops/shared-types';

interface Props {
  value?: EvidenceQualityResult;
}

export const EvidenceQualityBreakdown: React.FC<Props> = ({ value }) => {
  if (!value) {
    return (
      <div className="text-xs text-gray-400 italic">
        Calidad de evidencia: No registrada
      </div>
    );
  }

  if (value.grade === 'NOT_APPLICABLE') {
    return (
      <div className="text-xs text-blue-600 font-medium">
        Calidad estadística: No aplica (Evidencia de gobernanza verificada)
      </div>
    );
  }

  const scorePct = Math.round(value.score * 100);
  const gradeColor =
    value.grade === 'HIGH'
      ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
      : value.grade === 'MEDIUM'
      ? 'text-amber-600 border-amber-200 bg-amber-50'
      : 'text-red-600 border-red-200 bg-red-50';

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg border bg-slate-50 border-slate-200 text-xs">
      <div className="flex items-center justify-between font-semibold">
        <span className="text-slate-700">Calidad de Evidencia (Determinista V4.2)</span>
        <span className={`px-2 py-0.5 rounded border text-xs font-bold ${gradeColor}`}>
          {scorePct}% — {value.grade}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-1">
        <div>Integridad de ejecución: {value.dimensions.executionIntegrity}/20</div>
        <div>Consistencia de scope: {value.dimensions.scopeConsistency}/20</div>
        <div>Fundamentación numérica: {value.dimensions.numericGrounding}/25</div>
        <div>Adecuación muestral: {value.dimensions.sampleAdequacy}/20</div>
        <div>Proveniencia metodológica: {value.dimensions.methodProvenance}/15</div>
      </div>

      {value.rationale && value.rationale.length > 0 && (
        <ul className="text-[10px] text-slate-500 list-disc pl-3 mt-1 space-y-0.5">
          {value.rationale.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
