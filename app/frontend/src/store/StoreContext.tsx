import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createAppStore, type AppStore } from './appStore.js';

interface StoreContextValue {
  store: AppStore;
  // `version` cambia tras cada mutacion para forzar el re-render (los servicios
  // son sincronos y en memoria, asi que no hace falta estado asincrono).
  version: number;
  refresh: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createAppStore(true);
  }
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <StoreContext.Provider value={{ store: storeRef.current, version, refresh }}>
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
