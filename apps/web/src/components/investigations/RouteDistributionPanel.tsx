import React from 'react';
import { RouteMetric } from '@commerce-ops/shared-types';

interface Props {
  eligibleRouteCount: number;
  weightedRouteLateRatePct: number;
  unweightedMeanRouteLateRatePct: number;
  medianRouteLateRatePct: number;
  routes: RouteMetric[];
  minOrdersPerRoute?: number;
}

export const RouteDistributionPanel: React.FC<Props> = ({
  eligibleRouteCount,
  weightedRouteLateRatePct,
  unweightedMeanRouteLateRatePct,
  medianRouteLateRatePct,
  routes,
  minOrdersPerRoute = 10,
}) => {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          🗺️ Distribución por Rutas ({eligibleRouteCount} rutas con ≥{minOrdersPerRoute} pedidos)
        </h4>
        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
          ESTADÍSTICA DE RUTA
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 my-1">
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
          <div className="text-[11px] text-slate-500">Promedio Ponderado</div>
          <div className="text-lg font-bold text-slate-800">{weightedRouteLateRatePct}%</div>
        </div>
        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
          <div className="text-[11px] text-amber-700">Promedio Simple Rutas</div>
          <div className="text-lg font-bold text-amber-900">{unweightedMeanRouteLateRatePct}%</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
          <div className="text-[11px] text-slate-500">Mediana Rutas</div>
          <div className="text-lg font-bold text-slate-800">{medianRouteLateRatePct}%</div>
        </div>
      </div>

      <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 flex items-start gap-1.5">
        <span>⚠️</span>
        <span>
          <strong>Diferencia de Métrica:</strong> El promedio simple de {unweightedMeanRouteLateRatePct}% asigna el mismo peso a cada ruta sin considerar su volumen y <strong>no equivale a la tasa agregada por pedido</strong> ({weightedRouteLateRatePct}%).
        </span>
      </div>

      {routes && routes.length > 0 && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="p-2">Ruta (Origen → Destino)</th>
                <th className="p-2 text-right">Pedidos</th>
                <th className="p-2 text-right">Atrasados</th>
                <th className="p-2 text-right">Tasa Atraso</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-mono font-semibold text-slate-700">{r.routeKey}</td>
                  <td className="p-2 text-right">{r.deliveredOrders.toLocaleString('es-ES')}</td>
                  <td className="p-2 text-right text-rose-600 font-medium">{r.lateOrders.toLocaleString('es-ES')}</td>
                  <td className="p-2 text-right font-bold text-slate-900">{r.lateRatePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
