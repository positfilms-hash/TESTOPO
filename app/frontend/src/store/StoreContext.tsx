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
import { isSupabaseConfigured, getSupabase } from '../auth/supabaseClient.js';
import * as auth from '../auth/authService.js';
import {
  getWorkspaceHint,
  setWorkspaceHint,
  clearWorkspaceHint,
  getOppositionHint,
  setOppositionHint,
  clearOppositionHint,
  clearSelectionHints,
} from './sessionHints.js';

// Zona de la app (SPEC 014): administracion (gestionar) vs estudio (estudiar).
export type Zone = 'admin' | 'student';

// SPEC 036: maquina de estados explicita del arranque/rehidratacion. NUNCA se
// representa un estado de carga como `currentUser` null o lista vacia: cada
// pantalla con contexto espera a `ready`.
export type BootPhase =
  | 'booting'
  | 'signed_out'
  | 'loading_workspaces'
  | 'selecting_workspace'
  | 'resolving_access'
  | 'selecting_zone'
  | 'loading_oppositions'
  | 'selecting_opposition'
  | 'no_access'
  | 'ready'
  | 'error';

interface StoreContextValue {
  store: AppStore;
  version: number;
  refresh: () => void;
  // Sesion del MVP: usuario, workspace y oposicion activos.
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
  // SPEC 036: zona efectiva (eleccion o derivada del rol) y fase de rehidratacion.
  effectiveZone: Zone | null;
  phase: BootPhase;
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

  // SPEC 036: senales de la maquina de rehidratacion.
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hydratingWorkspace, setHydratingWorkspace] = useState(false);
  const [hydratingOpposition, setHydratingOpposition] = useState(false);
  const [bootError, setBootError] = useState(false);

  const store = storeRef.current as AppStore;

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const login = useCallback((user: User) => setCurrentUser(user), []);

  const logout = useCallback(() => {
    const uid = currentUser?.id;
    if (uid) clearSelectionHints(uid);
    setCurrentUser(null);
    setCurrentWorkspace(null);
    setCurrentOpposition(null);
    setZone(null);
    // En modo Supabase, cerrar tambien la sesion del proveedor (best-effort).
    if (isSupabaseConfigured()) {
      void auth.logout().catch(() => undefined);
    }
  }, [currentUser]);

  // Seleccion de workspace iniciada por el USUARIO (gate): persiste la pista y
  // descarta la oposicion anterior (otro workspace, otra pista de oposicion).
  const selectWorkspace = useCallback(
    (workspace: Workspace) => {
      setCurrentWorkspace(workspace);
      setCurrentOpposition(null);
      setZone(null); // cada workspace puede tener distinto rol: se reelige zona.
      if (currentUser) {
        setWorkspaceHint(currentUser.id, workspace.id);
        clearOppositionHint(currentUser.id);
      }
    },
    [currentUser],
  );

  // Restauracion/auto-seleccion de workspace (SPEC 036): NO borra la pista de
  // oposicion (para poder restaurarla luego); reafirma la pista de workspace.
  const restoreWorkspace = useCallback(
    (workspace: Workspace) => {
      setCurrentWorkspace(workspace);
      setCurrentOpposition(null);
      setZone(null);
      if (currentUser) setWorkspaceHint(currentUser.id, workspace.id);
    },
    [currentUser],
  );

  const clearWorkspace = useCallback(() => {
    // "Cambiar espacio": el usuario elige de nuevo -> no auto-restaurar el mismo.
    if (currentUser) clearSelectionHints(currentUser.id);
    setCurrentWorkspace(null);
    setCurrentOpposition(null);
    setZone(null);
  }, [currentUser]);

  const selectOpposition = useCallback(
    (opposition: Opposition) => {
      setCurrentOpposition(opposition);
      if (currentUser) setOppositionHint(currentUser.id, opposition.id);
    },
    [currentUser],
  );
  const clearOpposition = useCallback(() => {
    if (currentUser) clearOppositionHint(currentUser.id);
    setCurrentOpposition(null);
  }, [currentUser]);
  const selectZone = useCallback(
    (next: Zone) => {
      setZone(next);
      // Las oposiciones visibles dependen de la zona: se reelige al cambiar.
      setCurrentOpposition(null);
      if (currentUser) clearOppositionHint(currentUser.id);
    },
    [currentUser],
  );
  const clearZone = useCallback(() => {
    setZone(null);
    setCurrentOpposition(null);
  }, []);

  // --- SPEC 036: rehidratacion de la SESION (paso 1) -----------------------
  // Al arrancar, restaura el usuario desde la sesion de Supabase ANTES de decidir
  // que pantalla mostrar (nunca Login en `booting`). En demo/memoria no hay
  // sesion: queda `signed_out` y el login en memoria fija el usuario.
  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured()) {
      setSessionChecked(true);
      return () => {
        cancelled = true;
      };
    }
    setSessionChecked(false);
    void (async () => {
      try {
        const profile = await auth.getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setCurrentUser(null);
        } else if (profile.status === 'deleted' || profile.status === 'blocked') {
          // Perfil invalido: no rehidratar; limpiar pistas y cerrar sesion.
          clearSelectionHints(profile.id);
          await auth.logout().catch(() => undefined);
          if (!cancelled) setCurrentUser(null);
        } else {
          setCurrentUser(auth.mapProfileToUser(profile));
        }
      } catch {
        if (!cancelled) setBootError(true);
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cierre de sesion desde el proveedor (logout/expiracion en otra pestana).
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let unsub: (() => void) | null = null;
    try {
      const { data } = getSupabase().auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          setCurrentUser((u) => {
            if (u) clearSelectionHints(u.id);
            return null;
          });
          setCurrentWorkspace(null);
          setCurrentOpposition(null);
          setZone(null);
        }
      });
      unsub = () => data.subscription.unsubscribe();
    } catch {
      unsub = null;
    }
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // SPEC 018.3: rol de workspace y acceso de estudio (async) al cambiar
  // usuario/workspace. (No depende de `version`: ver nota historica abajo.)
  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [canStudy, setCanStudy] = useState(false);
  const [accessReady, setAccessReady] = useState(true);
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
    // No depende de `version` (refresh() no implica cambio de rol/matricula; si
    // dependiera, cada refresh desmontaria el arbol autenticado - BUG-002).
  }, [store, currentUser, currentWorkspace]);
  const isWorkspaceManager =
    workspaceRole === 'owner' || workspaceRole === 'admin';

  // Zona efectiva: la elegida, o la unica posible segun el rol. null = indecisa
  // (gestor Y estudiante: hace falta elegir) o sin rol util.
  const effectiveZone: Zone | null =
    currentWorkspace && accessReady
      ? zone ??
        (isWorkspaceManager && canStudy
          ? null
          : isWorkspaceManager
            ? 'admin'
            : canStudy
              ? 'student'
              : null)
      : null;
  const hasNoRole =
    !!currentWorkspace && accessReady && !isWorkspaceManager && !canStudy;

  // --- SPEC 036: rehidratacion del WORKSPACE (paso 3-4) --------------------
  // Restaura una pista valida, auto-selecciona si solo hay uno, o deja el
  // selector (varios sin pista valida). Limpia pistas invalidas.
  useEffect(() => {
    if (!sessionChecked || !currentUser || currentWorkspace) return;
    let cancelled = false;
    setHydratingWorkspace(true);
    void store.workspaces
      .listForUser(currentUser)
      .then((list) => {
        if (cancelled) return;
        const uid = currentUser.id;
        const hint = getWorkspaceHint(uid);
        const byHint = hint ? list.find((w) => w.id === hint) ?? null : null;
        if (hint && !byHint) clearWorkspaceHint(uid);
        if (byHint) restoreWorkspace(byHint);
        else if (list.length === 1) restoreWorkspace(list[0]);
        // varios sin pista valida -> selecting_workspace (gate).
        setHydratingWorkspace(false);
      })
      .catch(() => {
        if (!cancelled) {
          setHydratingWorkspace(false);
          setBootError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionChecked, currentUser, currentWorkspace, store, restoreWorkspace]);

  // --- SPEC 036: rehidratacion de la OPOSICION (paso 5-6) ------------------
  // Solo cuando la zona efectiva esta resuelta (admin/student). Restaura una
  // oposicion valida del workspace/zona, auto-selecciona si solo hay una, o deja
  // el selector. Rechaza pistas de otro workspace/zona (aislamiento de datos).
  useEffect(() => {
    if (!currentUser || !currentWorkspace || !accessReady || currentOpposition) {
      return;
    }
    if (effectiveZone !== 'admin' && effectiveZone !== 'student') return;
    let cancelled = false;
    setHydratingOpposition(true);
    const load =
      effectiveZone === 'admin'
        ? store.oppositions.listForUser(currentUser)
        : store.oppositions.listStudyOppositions(currentUser);
    void load
      .then((all) => {
        if (cancelled) return;
        const list = all.filter((o) => o.workspace_id === currentWorkspace.id);
        const uid = currentUser.id;
        const hint = getOppositionHint(uid);
        const byHint = hint ? list.find((o) => o.id === hint) ?? null : null;
        if (hint && !byHint) clearOppositionHint(uid);
        if (byHint) selectOpposition(byHint);
        else if (list.length === 1) selectOpposition(list[0]);
        setHydratingOpposition(false);
      })
      .catch(() => {
        if (!cancelled) setHydratingOpposition(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    currentWorkspace,
    accessReady,
    effectiveZone,
    currentOpposition,
    store,
    selectOpposition,
  ]);

  // Fase derivada (SPEC 036): unica fuente para que App muestre carga/Login/gate/
  // ready sin estados vacios falsos.
  let phase: BootPhase;
  if (bootError) phase = 'error';
  else if (!sessionChecked) phase = 'booting';
  else if (!currentUser) phase = 'signed_out';
  else if (!currentWorkspace) {
    phase = hydratingWorkspace ? 'loading_workspaces' : 'selecting_workspace';
  } else if (!accessReady) phase = 'resolving_access';
  else if (hasNoRole) phase = 'no_access';
  else if (effectiveZone === null) phase = 'selecting_zone';
  else if (!currentOpposition) {
    phase = hydratingOpposition ? 'loading_oppositions' : 'selecting_opposition';
  } else phase = 'ready';

  return (
    <StoreContext.Provider
      value={{
        store,
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
        effectiveZone,
        phase,
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
