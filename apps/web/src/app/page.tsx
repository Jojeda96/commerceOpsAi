'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    revenue: '$1,240,500',
    totalOrders: '99,441',
    lateRate: '12.6%',
    avgRating: '4.08 ⭐',
  });

  const [investigations, setInvestigations] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3001/api/investigations?limit=5')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.items) {
          setInvestigations(data.items);
        }
      })
      .catch(() => {
        // Fallback demo data si el backend aún no se ejecuta
        setInvestigations([
          {
            id: 'inv-demo-1',
            title: '¿Por qué disminuyó la calificación promedio durante febrero de 2018?',
            question: '¿Por qué disminuyó la calificación promedio durante febrero de 2018?',
            status: 'COMPLETED',
            finalQualityScore: 92,
            createdAt: new Date().toISOString(),
          },
        ]);
      });
  }, []);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>Resumen Operacional</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Visión general de métricas clave y actividad del equipo de agentes
          </p>
        </div>
        <Link href="/investigations" className="btn-primary">
          ➕ Nueva Investigación
        </Link>
      </div>

      <div className="grid-kpi">
        <div className="kpi-card">
          <span className="kpi-title">Ingresos Totales</span>
          <span className="kpi-value">{metrics.revenue}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">Total Pedidos</span>
          <span className="kpi-value">{metrics.totalOrders}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">Tasa de Atrasos</span>
          <span className="kpi-value" style={{ color: 'var(--color-accent-warning)' }}>
            {metrics.lateRate}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">Rating Promedio</span>
          <span className="kpi-value" style={{ color: 'var(--color-accent-success)' }}>
            {metrics.avgRating}
          </span>
        </div>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Últimas Investigaciones Multiagente</h2>
        {investigations.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No hay investigaciones registradas aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {investigations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  background: 'var(--color-bg-card)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <Link
                    href={`/investigations/${inv.id}`}
                    style={{ fontWeight: 600, color: 'var(--color-accent-primary)' }}
                  >
                    {inv.title}
                  </Link>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Creada: {new Date(inv.createdAt).toLocaleString()}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    className={`badge badge-${
                      inv.status === 'COMPLETED'
                        ? 'completed'
                        : inv.status === 'COMPLETED_WITH_WARNINGS'
                        ? 'warnings'
                        : inv.status === 'EXECUTING'
                        ? 'executing'
                        : inv.status === 'REJECTED' || inv.status === 'FAILED'
                        ? 'failed'
                        : 'pending'
                    }`}
                  >
                    {inv.status === 'COMPLETED_WITH_WARNINGS' ? 'COMPLETED (OBSERVACIONES)' : inv.status}
                  </span>
                  {inv.finalQualityScore && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Calidad: {inv.finalQualityScore}/100
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
