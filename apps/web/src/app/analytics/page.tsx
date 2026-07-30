'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api-client';

export default function AnalyticsPage() {
  const [revenueData, setRevenueData] = useState<any>(null);
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [sellersData, setSellersData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchApi<any>('/analytics/revenue'),
      fetchApi<any>('/analytics/deliveries'),
      fetchApi<any>('/analytics/reviews'),
      fetchApi<any[]>('/analytics/sellers?limit=10'),
    ])
      .then(([rev, del, revw, sel]) => {
        setRevenueData(rev);
        setDeliveryData(del);
        setReviewData(revw);
        setSellersData(Array.isArray(sel) ? sel : []);
      })
      .catch((err) => {
        console.error('Error fetching analytics:', err);
        setError('No se pudieron cargar las analíticas SQL deterministas.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', padding: '24px' }}>Cargando analíticas SQL deterministas...</p>;
  }

  if (error) {
    return (
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ color: 'var(--color-accent-error)' }}>Analíticas No Disponibles</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '8px' }}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Analytics SQL Deterministas</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            Consultas SQL directas sobre la base relacional de PostgreSQL (~100.000 pedidos)
          </p>
        </div>
        <Link href="/investigations" className="btn-primary" style={{ padding: '10px 18px', fontSize: '0.95rem' }}>
          🔍 Investigar con Agentes
        </Link>
      </div>

      <div
        style={{
          marginTop: '20px',
          padding: '16px 20px',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.98rem',
          lineHeight: '1.6',
          color: 'var(--color-text-secondary)',
          borderLeft: '5px solid var(--color-accent-primary)',
        }}
      >
        <strong style={{ color: 'var(--color-text-main)', display: 'block', fontSize: '1.1rem', marginBottom: '6px' }}>
          ℹ️ Principio Arquitectónico — Consultas Deterministas vs. Generación por LLM
        </strong>
        A diferencia de las respuestas generativas de un LLM, todas las cifras de este panel se calculan mediante consultas SQL directas sobre PostgreSQL utilizando funciones de agregación (<code>SUM</code>, <code>AVG</code>, <code>COUNT</code>, <code>GROUP BY</code>). La exactitud de las cifras depende de la calidad del dataset, los filtros y la implementación de cada consulta.
      </div>

      {/* KPI Cards */}
      <div className="grid-kpi" style={{ marginTop: '24px' }}>
        <div className="kpi-card" style={{ padding: '20px' }}>
          <span className="kpi-title" style={{ fontSize: '0.9rem' }}>Facturación Total (SQL)</span>
          <span className="kpi-value" style={{ fontSize: '1.8rem' }}>
            R$ {revenueData?.revenue ? revenueData.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '0'}
          </span>
        </div>
        <div className="kpi-card" style={{ padding: '20px' }}>
          <span className="kpi-title" style={{ fontSize: '0.9rem' }}>Entregas con Retraso</span>
          <span className="kpi-value" style={{ color: 'var(--color-accent-warning)', fontSize: '1.8rem' }}>
            {deliveryData?.lateRate || 0}% ({deliveryData?.lateOrders?.toLocaleString() || 0} pedidos)
          </span>
        </div>
        <div className="kpi-card" style={{ padding: '20px' }}>
          <span className="kpi-title" style={{ fontSize: '0.9rem' }}>Rating Promedio (CSAT)</span>
          <span className="kpi-value" style={{ color: 'var(--color-accent-success)', fontSize: '1.8rem' }}>
            {reviewData?.averageRating || 0} ⭐ ({reviewData?.totalReviews?.toLocaleString() || 0} reseñas)
          </span>
        </div>
        <div className="kpi-card" style={{ padding: '20px' }}>
          <span className="kpi-title" style={{ fontSize: '0.9rem' }}>Ticket Promedio por Orden</span>
          <span className="kpi-value" style={{ fontSize: '1.8rem' }}>
            R$ {revenueData?.averageOrderValue || 0}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        {/* Métricas Logísticas */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: 'var(--color-accent-primary)' }}>
            🚚 SLA & Tiempos Logísticos
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>Total Pedidos Entregados</span>
              <strong style={{ fontSize: '1.05rem' }}>{deliveryData?.deliveredOrders?.toLocaleString() || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>Tiempo Promedio de Entrega</span>
              <strong style={{ fontSize: '1.05rem' }}>{deliveryData?.averageDeliveryDays || 0} días</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>Demora Promedio en Pedidos Atrasados</span>
              <strong style={{ color: 'var(--color-accent-warning)', fontSize: '1.05rem' }}>{deliveryData?.averageDelayDays || 0} días</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span>Flete Total Cobrado</span>
              <strong style={{ fontSize: '1.05rem' }}>R$ {revenueData?.freightTotal ? revenueData.freightTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : 0}</strong>
            </div>
          </div>
        </div>

        {/* Distribución de Calificaciones */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '20px', color: 'var(--color-accent-success)' }}>
            ⭐ Distribución de Reseñas por Estrellas
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = reviewData?.distribution?.[stars] || 0;
              const total = reviewData?.totalReviews || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ minWidth: '95px', fontWeight: 600, fontSize: '1rem' }}>{stars} Estrellas</span>
                  <div
                    style={{
                      flex: 1,
                      height: '16px',
                      background: 'var(--color-bg-primary)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: stars >= 4 ? 'var(--color-accent-success)' : stars === 3 ? 'var(--color-accent-warning)' : 'var(--color-accent-danger)',
                      }}
                    />
                  </div>
                  <span style={{ minWidth: '110px', fontSize: '0.98rem', fontWeight: 600, color: 'var(--color-text-main)', textAlign: 'right' }}>
                    {count.toLocaleString()} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Vendedores */}
      <div className="glass-card" style={{ marginTop: '24px', padding: '24px' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>🏆 Top 10 Vendedores con Mayor Facturación</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                <th style={{ padding: '14px 12px' }}>#</th>
                <th style={{ padding: '14px 12px' }}>ID Vendedor</th>
                <th style={{ padding: '14px 12px' }}>Ítems Vendidos</th>
                <th style={{ padding: '14px 12px', textAlign: 'right' }}>Facturación Acumulada</th>
              </tr>
            </thead>
            <tbody>
              {sellersData.map((seller: any, idx: number) => (
                <tr key={seller.sellerId} style={{ borderBottom: '1px solid var(--color-bg-primary)' }}>
                  <td style={{ padding: '14px 12px', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '14px 12px', fontFamily: 'monospace', fontSize: '1.02rem', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                    {seller.sellerId}
                  </td>
                  <td style={{ padding: '14px 12px', fontSize: '1.02rem', fontWeight: 600 }}>{seller.itemsSold.toLocaleString()}</td>
                  <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-accent-success)' }}>
                    R$ {seller.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
