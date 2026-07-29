import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'CommerceOps AI | Inteligencia Operacional Multiagente',
  description: 'Plataforma multiagente para análisis operacional de e-commerce sobre dataset de Olist',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <div className="app-layout">
          <aside className="sidebar">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">🤖</div>
              <span>CommerceOps AI</span>
            </div>

            <nav>
              <ul className="nav-menu">
                <li>
                  <Link href="/" className="nav-item active">
                    📊 Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/investigations" className="nav-item">
                    🔍 Investigaciones
                  </Link>
                </li>
                <li>
                  <Link href="/analytics" className="nav-item">
                    📈 Analytics SQL
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>

          <div className="main-content">
            <header className="top-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Plataforma Multiagente de E-Commerce</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="badge badge-completed">● Sistema Operativo</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Dataset: Olist (100K pedidos)
                </span>
              </div>
            </header>

            <main className="page-container">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
