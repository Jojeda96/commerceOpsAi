'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_URL, fetchApi } from '@/lib/api-client';

export default function InvestigationsPage() {
  const [question, setQuestion] = useState('');
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvestigations = () => {
    fetchApi<any>('/investigations')
      .then((data) => {
        if (data && data.items) {
          setInvestigations(data.items);
        }
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchInvestigations();
  }, []);

  const getAuthToken = async (forceRefresh = false) => {
    let token = forceRefresh ? null : localStorage.getItem('accessToken');
    if (!token) {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'demo@commerceops.ai',
            password: 'demo123',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          token = data.accessToken;
          if (token) localStorage.setItem('accessToken', token);
        }
      } catch (err) {
        console.error('Error autenticando usuario demo:', err);
      }
    }
    return token;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      let token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res = await fetch(`${API_URL}/investigations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question }),
      });

      // Si el token expiró (401), solicitar uno nuevo y reintentar
      if (res.status === 401) {
        localStorage.removeItem('accessToken');
        token = await getAuthToken(true);
        if (token) headers['Authorization'] = `Bearer ${token}`;
        res = await fetch(`${API_URL}/investigations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ question }),
        });
      }

      if (!res.ok) {
        throw new Error(`Error al crear investigación: ${res.status}`);
      }

      const newInv = await res.json();

      // Iniciar ejecución del workflow automáticamente
      fetch(`${API_URL}/investigations/${newInv.id}/run`, {
        method: 'POST',
        headers,
      }).catch((err) => console.error('Error al iniciar ejecucion de investigacion:', err));

      setQuestion('');
      // Redirigir a la página de detalle SSE en tiempo real
      window.location.href = `/investigations/${newInv.id}`;
    } catch (err) {
      console.error('Error en creación de investigación:', err);
      alert('Hubo un error al iniciar la investigación. Revisa la consola o asegúrate de que la API esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>Investigaciones Multiagente</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Formula preguntas complejas para que el equipo de agentes investigue de forma coordinada
        </p>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Nueva Pregunta de Investigación</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Ej: ¿Por qué aumentaron las entregas tardías en la categoría muebles?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'white',
              fontSize: '0.95rem',
            }}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Lanzando Agentes...' : '🚀 Lanzar Investigación'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Historial de Investigaciones</h2>
        {investigations.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No hay investigaciones creadas todavía.</p>
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
                    {inv.question}
                  </Link>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    ID: {inv.id} | Creada: {new Date(inv.createdAt).toLocaleString()}
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
                  <Link href={`/investigations/${inv.id}`} className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                    Ver Detalle →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
