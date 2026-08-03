import React from 'react';

interface Props {
  deliveredOrders: number;
  lateOrders: number;
  aggregateLateRatePct: number;
  avgDeliveryDays?: number;
  avgDelayDays?: number;
  interstateOnly?: boolean;
}

export const HistoricalAggregatePanel: React.FC<Props> = ({
  deliveredOrders,
  lateOrders,
  aggregateLateRatePct,
  avgDeliveryDays,
  avgDelayDays,
  interstateOnly = false,
}) => {
  return (
    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
          📊 Contexto Histórico Agregado {interstateOnly ? '(Interestatal)' : '(Global)'}
        </h4>
        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">
          PROPORCIÓN OBSERVADA
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 my-1">
        <div className="p-2.5 rounded-lg bg-white border border-indigo-100 shadow-sm text-center">
          <div className="text-xs text-gray-500">Tasa Agregada</div>
          <div className="text-xl font-bold text-indigo-900">{aggregateLateRatePct}%</div>
        </div>
        <div className="p-2.5 rounded-lg bg-white border border-indigo-100 shadow-sm text-center">
          <div className="text-xs text-gray-500">Pedidos Tardíos</div>
          <div className="text-xl font-bold text-rose-600">{lateOrders.toLocaleString('es-ES')}</div>
        </div>
        <div className="p-2.5 rounded-lg bg-white border border-indigo-100 shadow-sm text-center">
          <div className="text-xs text-gray-500">Pedidos Entregados</div>
          <div className="text-xl font-bold text-gray-800">{deliveredOrders.toLocaleString('es-ES')}</div>
        </div>
      </div>

      {(avgDeliveryDays !== undefined || avgDelayDays !== undefined) && (
        <div className="flex items-center justify-between text-xs text-indigo-900 border-t border-indigo-100 pt-2">
          {avgDeliveryDays !== undefined && (
            <span>Tiempo medio de entrega: <strong>{avgDeliveryDays} días</strong></span>
          )}
          {avgDelayDays !== undefined && (
            <span>Atraso medio en tardíos: <strong>{avgDelayDays} días</strong></span>
          )}
        </div>
      )}

      <div className="text-[11px] text-indigo-700 bg-indigo-100/60 p-2 rounded border border-indigo-200/60 flex items-start gap-1.5">
        <span>💡</span>
        <span>
          <strong>Nota de rigor:</strong> {lateOrders.toLocaleString('es-ES')} / {deliveredOrders.toLocaleString('es-ES')} = {aggregateLateRatePct}%. Esta es una proporción histórica observada y <strong>no una probabilidad predictiva del modelo</strong>.
        </span>
      </div>
    </div>
  );
};
