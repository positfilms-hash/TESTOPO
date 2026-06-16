import type { ReactNode } from 'react';

export type Section = 'inicio' | 'material' | 'temario' | 'preguntas' | 'tests';

const NAV: { id: Section; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'material', label: 'Material' },
  { id: 'temario', label: 'Temario' },
  { id: 'preguntas', label: 'Preguntas' },
  { id: 'tests', label: 'Tests' },
];

export function AppLayout({
  active,
  onNavigate,
  children,
}: {
  active: Section;
  onNavigate: (section: Section) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Navegacion principal">
        <div className="brand">TESTOPO</div>
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
