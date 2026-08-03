import React from 'react';

interface Props {
  message?: string;
  reasonCode?: string;
}

export const PanelDataUnavailable: React.FC<Props> = ({
  message = 'La evidencia estructurada necesaria para esta visualización no está disponible.',
  reasonCode,
}) => {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs flex flex-col gap-1.5 my-2">
      <div className="flex items-center justify-between font-semibold">
        <span>ℹ️ Visualización no disponible</span>
        {reasonCode && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700">
            {reasonCode}
          </span>
        )}
      </div>
      <p>{message}</p>
    </div>
  );
};
