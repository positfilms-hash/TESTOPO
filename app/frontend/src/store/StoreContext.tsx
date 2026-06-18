import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Opposition, User, Workspace, WorkspaceRole } from '@backend';
import { createAppStore, seedDemoData, type AppStore } from './appStore.js';

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
  // false mientras se resuelven rol/acceso del workspace (SPEC 018.3, async).
  accessReady: boolean;
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
    storeRef.current = createAppStore();
  }
  // Datos demo: se siembran de forma asincrona al arrancar (SPEC 018.3). Solo en
  // modo memoria; con persistencia Supabase la cuenta es real (SPEC 020).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const store = storeRef.current as AppStore;
    if (store.persistence !== 'memory') {
      setSeeded(true);
      return () => {
        cancelled = true;
      };
    }
    void seedDemoData(store).then(() => {
      if (!cancelled) setSeeded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
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

  // SPEC 018.3: el rol de workspace y el acceso de estudio se consultan de
  // forma asincrona; se cargan en estado al cambiar usuario/workspace/version.
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [canStudy, setCanStudy] = useState(false);
  const [accessReady, setAccessReady] = useState(true);
  const store = storeRef.current;
  useEffect(() => {
    let cancelled = false;
    if (currentUser && currentWorkspace) {
      setAccessReady(false);
      void Promise.all([
        store.workspaces.getMemberRole(currentUser.id, currentWorkspace.id),
        store.oppositions.hasStudyAccess(currentUser, currentWorkspace.id),
      ]).then(([role, study]) => {
        if (!cancelled) {
          setWorkspaceRole(role);
          setCanStudy(study);
          setAccessReady(true);
        }
      });
    } else {
      setWorkspaceRole(null);
      setCanStudy(false);
      setAccessReady(true);
    }
    return () => {
      cancelled = true;
    };
    // No depende de `version`: ese contador lo dispara `refresh()` desde
    // cualquier pantalla tras mutar el store (crear test, iniciar intento,
    // etc.) y no implica un cambio de rol/matricula. Si dependiera de
    // `version`, cada refresh() pondria accessReady en false y App.tsx
    // desmontaria el arbol autenticado entero (LoadingState), perdiendo el
    // estado local de la pantalla activa (BUG-002: "Empezar" no abria
    // "Realizar test" porque TestsPage se remontaba con view inicial).
  }, [store, currentUser, currentWorkspace]);
  const isWorkspaceManager =
    workspaceRole === 'owner' || workspaceRole === 'admin';

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
        accessReady,
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
      {seeded ? children : <div className="loading-state">Cargando…</div>}
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
