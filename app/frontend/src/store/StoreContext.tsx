import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Opposition, User } from '@backend';
import { createAppStore, type AppStore } from './appStore.js';

interface StoreContextValue {
  store: AppStore;
  version: number;
  refresh: () => void;
  // Sesion del MVP (sin tokens): usuario autenticado y oposicion activa.
  currentUser: User | null;
  currentOpposition: Opposition | null;
  login: (user: User) => void;
  logout: () => void;
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
  const [currentOpposition, setCurrentOpposition] =
    useState<Opposition | null>(null);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const login = useCallback((user: User) => setCurrentUser(user), []);
  const logout = useCallback(() => {
    setCurrentUser(null);
    setCurrentOpposition(null);
  }, []);
  const selectOpposition = useCallback(
    (opposition: Opposition) => setCurrentOpposition(opposition),
    [],
  );
  const clearOpposition = useCallback(() => setCurrentOpposition(null), []);

  return (
    <StoreContext.Provider
      value={{
        store: storeRef.current,
        version,
        refresh,
        currentUser,
        currentOpposition,
        login,
        logout,
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
