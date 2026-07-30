'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <nav>
      <ul className="nav-menu">
        <li>
          <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
            📊 Dashboard
          </Link>
        </li>
        <li>
          <Link href="/investigations" className={`nav-item ${isActive('/investigations') ? 'active' : ''}`}>
            🔍 Investigaciones
          </Link>
        </li>
        <li>
          <Link href="/analytics" className={`nav-item ${isActive('/analytics') ? 'active' : ''}`}>
            📈 Analytics SQL
          </Link>
        </li>
        <li>
          <Link href="/ml-governance" className={`nav-item ${isActive('/ml-governance') ? 'active' : ''}`}>
            🧪 Gobernanza ML
          </Link>
        </li>
      </ul>
    </nav>
  );
}
