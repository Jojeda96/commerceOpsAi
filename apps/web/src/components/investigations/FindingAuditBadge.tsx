import React from 'react';
import { FindingAuditStatus } from '@commerce-ops/shared-types';

interface Props {
  status?: FindingAuditStatus;
  messages?: string[];
}

export const FindingAuditBadge: React.FC<Props> = ({ status = 'PENDING', messages }) => {
  let badgeColor = 'bg-gray-100 text-gray-800 border-gray-300';
  let label = 'PENDIENTE DE AUDITORÍA';

  if (status === 'APPROVED') {
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    label = 'AUDITORÍA: APROBADO';
  } else if (status === 'APPROVED_WITH_WARNINGS') {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-300';
    label = 'AUDITORÍA: APROBADO CON OBSERVACIONES';
  } else if (status === 'REJECTED') {
    badgeColor = 'bg-red-50 text-red-700 border-red-300';
    label = 'AUDITORÍA: RECHAZADO';
  } else if (status === 'NOT_APPLICABLE') {
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-300';
    label = 'AUDITORÍA: TÉCNICAMENTE VERIFICADO';
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${badgeColor}`}>
        {label}
      </span>
      {messages && messages.length > 0 && (
        <ul className="text-[11px] text-gray-500 list-disc pl-4 mt-0.5">
          {messages.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
