import React from 'react';

interface AnomalyPoint {
  month: string;
  lateRatePct: number;
  sampleSize: number;
  robustZScore: number;
}

interface Props {
  method: string;
  threshold: number;
  monthsEvaluated: number;
  medianMonthlyLateRatePct: number;
  mad: number;
  anomalies: AnomalyPoint[];
}

export const AnomalyEvidencePanel: React.FC<Props> = ({
  method,
  threshold,
  monthsEvaluated,
  medianMonthlyLateRatePct,
  mad,
  anomalies,
}) => {
  return (
    <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-purple-950 flex items-center gap-2">
          📈 Detección de Anomalías Mensuales ({method})
        </h4>
        <span className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
          UMBRAL: |Z| ≥ {threshold}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 my-1">
        <div className="p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm text-center">
          <div className="text-xs text-gray-500">Meses Evaluados</div>
          <div className="text-lg font-bold text-purple-900">{monthsEvaluated}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm text-center">
          <div className="text-xs text-gray-500">Mediana Mensual</div>
          <div className="text-lg font-bold text-purple-900">{medianMonthlyLateRatePct}%</div>
        </div>
        <div className="p-2.5 rounded-lg bg-white border border-purple-100 shadow-sm text-center">
          <div className="text-xs text-gray-500">MAD (Desviación)</div>
          <div className="text-lg font-bold text-purple-900">{mad}</div>
        </div>
      </div>

      {anomalies && anomalies.length > 0 ? (
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-purple-200 bg-purple-100/60 text-purple-900">
                <th className="p-2">Mes</th>
                <th className="p-2 text-right">Muestra Pedidos</th>
                <th className="p-2 text-right">Tasa Atraso</th>
                <th className="p-2 text-right">Robust Z-Score</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, idx) => (
                <tr key={idx} className="border-b border-purple-100 bg-white hover:bg-purple-50/50">
                  <td className="p-2 font-mono font-bold text-purple-950">{a.month}</td>
                  <td className="p-2 text-right">{a.sampleSize.toLocaleString('es-ES')}</td>
                  <td className="p-2 text-right font-bold text-rose-600">{a.lateRatePct}%</td>
                  <td className="p-2 text-right font-bold text-purple-700">+{a.robustZScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs text-purple-800 italic bg-white p-3 rounded border border-purple-100 text-center">
          No se detectaron desviaciones anómalas que superaran el umbral de Robust Z-Score (|Z| ≥ {threshold}).
        </div>
      )}
    </div>
  );
};
