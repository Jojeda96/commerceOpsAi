'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';

export function HeaderStatus() {
  const [status, setStatus] = useState<string>('CHECKING');

  useEffect(() => {
    const checkHealth = () => {
      fetchApi<any>('/health')
        .then((res) => {
          setStatus(res.status || 'OPERATIONAL');
        })
        .catch(() => {
          setStatus('DEGRADED');
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const getBadge = () => {
    if (status === 'OPERATIONAL') {
      return { class: 'badge-completed', text: '🟢 Sistema Operativo' };
    }
    if (status === 'DEGRADED') {
      return { class: 'badge-running', text: '🟡 Sistema Degradado' };
    }
    return { class: 'badge-failed', text: '🔴 Sistema Fuera de Línea' };
  };

  const badge = getBadge();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span className={`badge ${badge.class}`}>{badge.text}</span>
      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        Dataset: Olist (100K pedidos)
      </span>
    </div>
  );
}
