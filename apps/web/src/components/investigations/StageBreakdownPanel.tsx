import React from 'react';
import { StageBreakdownData } from '@commerce-ops/shared-types';

interface Props {
  data: StageBreakdownData;
  interstateOnly?: boolean;
}

export const StageBreakdownPanel: React.FC<Props> = ({ data, interstateOnly = false }) => {
  return (
    <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-teal-950 flex items-center gap-2">
          ⏱️ Desglose por Etapas de Logística {interstateOnly ? '(Interestatal)' : '(Scope General)'}
        </h4>
        <span className="text-[11px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-medium">
          {data.dominantStage === 'CARRIER_TRANSIT' ? 'DOMINIO: TRÁNSITO TRANSPORTISTA' : data.dominantStage === 'SELLER_PREPARATION' ? 'DOMINIO: PREPARACIÓN VENDEDOR' : 'EQUILIBRADO'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 my-1">
        <div className="p-3 rounded-lg bg-white border border-teal-100 shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Preparación del Vendedor</div>
          <div className="text-lg font-bold text-teal-900 mt-1">{data.avgSellerPreparationDays} días</div>
          <div className="text-[11px] text-gray-400">Mediana: {data.medianSellerPreparationDays} días</div>
        </div>

        <div className="p-3 rounded-lg bg-white border border-teal-100 shadow-sm">
          <div className="text-xs text-gray-500 font-medium">Tránsito del Transportista</div>
          <div className="text-lg font-bold text-teal-900 mt-1">{data.avgCarrierTransitDays} días</div>
          <div className="text-[11px] text-gray-400">Mediana: {data.medianCarrierTransitDays} días</div>
        </div>
      </div>

      <div className="text-[11px] text-teal-800 flex items-center justify-between pt-1 border-t border-teal-100">
        <span>Pedidos analizados: <strong>{data.analyzedOrders.toLocaleString('es-ES')}</strong></span>
        {data.excludedMissingCarrierDate > 0 && (
          <span className="text-gray-500">Excluidos sin fecha despacho: {data.excludedMissingCarrierDate}</span>
        )}
      </div>
    </div>
  );
};
