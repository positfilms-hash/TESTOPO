import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Opposition, User, Workspace, WorkspaceRole } from '@backend';
import { createAppStore, type AppStore } from './appStore.js';

// Zona de la app (SPEC 014): administracion (gestionar) vs estudio (estudiar).
export type Zone = 'admin' | 'student';

interface StoreContextValue {
  store: AppStore;
  version: number;
  refresh: () => void;
  // Sesion del MVP (sin tokens): usuario, workspace y oposicion activos.
  currentUser: User | null;
  currentWorkspace: Workspace | null;
  currentOpposition: Opposition | null;
  // Rol DENTRO del workspace activo (owner/admin/student). Decide capacidades.
  workspaceRole: WorkspaceRole | null;
  isWorkspaceManager: boolean;
  // ¿Tiene matricula de estudio en alguna oposicion del workspace? (SPEC 014)
  canStudy: boolean;
  // Zona activa elegida por el usuario; null = aun sin decidir.
  zone: Zone | null;
  selectZone: (zone: Zone) => void;
  clearZone: () => void;
  login: (user: User) => void;
  logout: () => void;
  selectWorkspace: (workspace: Workspace) => void;
  clearWorkspace: () => void;
  selectOpposition: (opposition: Opposition) => void;
  clearOpposition: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createAppStore(true);
  }
  const [version, setVersion] = useState(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(
    null,
  );
  const [currentOpposition, setCurrentOpposition] =
    useState<Opposition | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const login = useCallback((user: User) => setCurrentUser(user), []);
  const logout = useCallback(() => {
    setCurrentUser(null);
    setCurrentWorkspace(null);
    setCurrentOpposition(null);
    setZone(null);
  }, []);
  const selectWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    setCurrentOpposition(null);
    // Cada workspace puede tener distinto rol: se reelige zona al entrar.
    setZone(null);
  }, []);
  const clearWorkspace = useCallback(() => {
    setCurrentWorkspace(null);
    setCurrentOpposition(null);
    setZone(null);
  }, []);
  const selectOpposition = useCallback(
    (opposition: Opposition) => setCurrentOpposition(opposition),
    [],
  );
  const clearOpposition = useCallback(() => setCurrentOpposition(null), []);
  const selectZone = useCallback((next: Zone) => {
    setZone(next);
    // Las oposiciones visibles dependen de la zona: se reelige al cambiar.
    setCurrentOpposition(null);
  }, []);
  const clearZone = useCallback(() => {
    setZone(null);
    setCurrentOpposition(null);
  }, []);

  const workspaceRole =
    currentUser && currentWorkspace
      ? storeRef.current.workspaces.getMemberRole(
          currentUser.id,
          currentWorkspace.id,
        )
      : null;
  const isWorkspaceManager =
    workspaceRole === 'owner' || workspaceRole === 'admin';
  const canStudy =
    currentUser && currentWorkspace
      ? storeRef.current.oppositions.hasStudyAccess(
          currentUser,
          currentWorkspace.id,
        )
      : false;

  return (
    <StoreContext.Provider
      value={{
        store: storeRef.current,
        version,
        refresh,
        currentUser,
        currentWorkspace,
        currentOpposition,
        workspaceRole,
        isWorkspaceManager,
        canStudy,
        zone,
        selectZone,
        clearZone,
        login,
        logout,
        selectWorkspace,
        clearWorkspace,
        selectOpposition,
        clearOpposition,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore debe usarse dentro de <StoreProvider>');
  }
  return ctx;
}
