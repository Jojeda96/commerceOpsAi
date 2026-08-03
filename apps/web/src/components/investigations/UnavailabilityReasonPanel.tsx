import React from 'react';

interface Props {
  reasonCode?: string;
  diagnostics?: Record<string, any>;
}

export const UnavailabilityReasonPanel: React.FC<Props> = ({ reasonCode, diagnostics }) => {
  let title = 'Predicción / Escenario No Disponible';
  let message = 'No se dispuso de un escenario validado para inferencia predictiva.';
  let action = 'Verificar la cobertura de datos o generar snapshots de features.';

  if (reasonCode === 'SNAPSHOT_TABLE_EMPTY') {
    title = 'Almacén de Snapshots Vacío';
    message = 'La tabla de snapshots de features no contiene filas para el filtrado seleccionado.';
    action = 'Ejecutar el script de construcción de snapshots de features en la base de datos.';
  } else if (reasonCode === 'SNAPSHOT_TABLE_MISSING') {
    title = 'Tabla de Snapshots Ausente';
    message = 'La tabla de snapshots de features no existe en la base de datos PostgreSQL.';
    action = 'Aplicar las migraciones de base de datos pendientes.';
  } else if (reasonCode === 'NO_GROUP_MEETS_MINIMUM_SAMPLE') {
    title = 'Muestra Mínima Insuficiente';
    message = 'Ningún grupo de ruta/categoría alcanzó el umbral mínimo de observaciones requeridas.';
    action = 'Ampliar los criterios de búsqueda o el periodo temporal seleccionado.';
  } else if (reasonCode === 'NO_ROWS_IN_SCOPE') {
    title = 'Sin Registros en el Scope';
    message = 'No se encontraron observaciones en el almacén de datos dentro del filtro aplicado.';
    action = 'Ajustar los filtros de estado o categoría.';
  }

  return (
    <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 text-amber-950 flex flex-col gap-2">
      <div className="flex items-center justify-between font-bold text-sm">
        <span className="flex items-center gap-1.5">⚠️ {title}</span>
        {reasonCode && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
            {reasonCode}
          </span>
        )}
      </div>

      <p className="text-xs text-amber-900">{message}</p>

      <div className="text-[11px] bg-white/80 p-2.5 rounded border border-amber-200/80 font-medium text-amber-950 mt-1">
        💡 <strong>Acción sugerida:</strong> {action}
      </div>

      {diagnostics && Object.keys(diagnostics).length > 0 && (
        <details className="mt-1 text-[10px] text-amber-800">
          <summary className="cursor-pointer font-semibold hover:underline">Ver diagnóstico técnico</summary>
          <pre className="mt-1.5 p-2 rounded bg-amber-100/50 font-mono overflow-x-auto text-[10px]">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};
