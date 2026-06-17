import type { ReactNode } from 'react';
import { useStore } from '../store/StoreContext.js';

export type Section = 'inicio' | 'material' | 'temario' | 'preguntas' | 'tests';

const ADMIN_NAV: { id: Section; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'material', label: 'Material' },
  { id: 'temario', label: 'Temario' },
  { id: 'preguntas', label: 'Preguntas' },
  { id: 'tests', label: 'Tests' },
];

const STUDENT_NAV: { id: Section; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'material', label: 'Material' },
  { id: 'tests', label: 'Tests' },
];

export function AppLayout({
  active,
  onNavigate,
  isManager,
  children,
}: {
  active: Section;
  onNavigate: (section: Section) => void;
  isManager: boolean;
  children: ReactNode;
}) {
  const {
    currentUser,
    currentWorkspace,
    currentOpposition,
    workspaceRole,
    logout,
    clearOpposition,
    clearWorkspace,
  } = useStore();
  const nav = isManager ? ADMIN_NAV : STUDENT_NAV;

  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Navegacion principal">
        <div className="brand">TESTOPO</div>
        {nav.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
        <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="small muted">
            {currentUser?.name} · {workspaceRole ?? 'invitado'}
          </div>
          <div className="small">Espacio: {currentWorkspace?.name}</div>
          <div className="small" style={{ marginBottom: 4 }}>
            Oposicion: {currentOpposition?.title}
          </div>
          <button className="nav-item small" onClick={clearOpposition}>
            Cambiar oposicion
          </button>
          <button className="nav-item small" onClick={clearWorkspace}>
            Cambiar espacio
          </button>
          <button className="nav-item small" onClick={logout}>
            Salir
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
