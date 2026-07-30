import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { HeaderStatus } from '@/components/HeaderStatus';

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

            <Navigation />
          </aside>

          <div className="main-content">
            <header className="top-header">
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Plataforma Multiagente de E-Commerce</h3>
              </div>
              <HeaderStatus />
            </header>

            <main className="page-container">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
