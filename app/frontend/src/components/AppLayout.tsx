import type { ReactNode } from 'react';
import { useStore, type Zone } from '../store/StoreContext.js';

export type Section =
  | 'inicio'
  | 'material'
  | 'temario'
  | 'preguntas'
  | 'tests'
  | 'alumnos'
  | 'resultados';

// Zona admin (SPEC 014, 7): navegacion orientada a gestion.
const ADMIN_NAV: { id: Section; label: string }[] = [
  { id: 'inicio', label: 'Resumen' },
  { id: 'material', label: 'Material' },
  { id: 'temario', label: 'Temario' },
  { id: 'preguntas', label: 'Preguntas' },
  { id: 'tests', label: 'Tests' },
  { id: 'alumnos', label: 'Alumnos' },
];

// Zona estudiante (SPEC 014, 8): navegacion minima orientada al estudio.
const STUDENT_NAV: { id: Section; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'material', label: 'Material' },
  { id: 'tests', label: 'Crear test' },
  { id: 'resultados', label: 'Mis resultados' },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Admin',
  student: 'Estudiante',
};

export function AppLayout({
  zone,
  active,
  onNavigate,
  canSwitchZone,
  onSwitchZone,
  children,
}: {
  zone: Zone;
  active: Section;
  onNavigate: (section: Section) => void;
  canSwitchZone: boolean;
  onSwitchZone: () => void;
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
  const isAdmin = zone === 'admin';
  const nav = isAdmin ? ADMIN_NAV : STUDENT_NAV;

  return (
    <div className={`app-shell zone-${zone}`}>
      <nav className="sidebar" aria-label="Navegacion principal">
        <div className="brand">TESTOPO</div>
        <div className="zone-badge small" aria-label="Zona actual">
          {isAdmin ? 'Administracion' : 'Estudio'}
        </div>
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
          {/* Cabecera de contexto (SPEC 014, 10): donde estoy y que rol tengo. */}
          <div className="small muted">
            {currentUser?.name}
            {workspaceRole ? ` · ${ROLE_LABELS[workspaceRole] ?? workspaceRole}` : ''}
          </div>
          {isAdmin ? (
            <>
              <div className="small">Espacio: {currentWorkspace?.name}</div>
              <div className="small" style={{ marginBottom: 4 }}>
                Oposicion: {currentOpposition?.title}
              </div>
            </>
          ) : (
            <>
              <div className="small">Oposicion: {currentOpposition?.title}</div>
              <div className="small" style={{ marginBottom: 4 }}>
                Academia: {currentWorkspace?.name}
              </div>
            </>
          )}
          <button className="nav-item small" onClick={clearOpposition}>
            Cambiar oposicion
          </button>
          {canSwitchZone && (
            <button className="nav-item small" onClick={onSwitchZone}>
              Cambiar zona
            </button>
          )}
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
