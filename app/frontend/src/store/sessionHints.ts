// SPEC 036: pistas de seleccion (workspace/oposicion) PERSISTIDAS por usuario en
// localStorage. Son SOLO una conveniencia NO autoritativa: se validan SIEMPRE
// contra los resultados autorizados de Supabase antes de usarse, y se limpian si
// son invalidas/revocadas. NUNCA se guardan tokens, roles, datos de perfil ni
// secretos: unicamente el ID de la ultima seleccion, con clave por usuario.

const PREFIX = 'testopo';
type Kind = 'last_workspace_id' | 'last_opposition_id';

function key(kind: Kind, userId: string): string {
  return `${PREFIX}:${kind}:${userId}`;
}

// Acceso defensivo: en entornos sin localStorage (SSR/tests raros) no rompe.
function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function getHint(kind: Kind, userId: string): string | null {
  const s = safeStorage();
  if (!s || !userId) return null;
  try {
    const v = s.getItem(key(kind, userId));
    return v && v.trim().length > 0 ? v : null;
  } catch {
    return null;
  }
}

function setHint(kind: Kind, userId: string, id: string): void {
  const s = safeStorage();
  if (!s || !userId || !id) return;
  try {
    s.setItem(key(kind, userId), id);
  } catch {
    // cuota/privado: la pista es opcional, no es un error de la app.
  }
}

function clearHint(kind: Kind, userId: string): void {
  const s = safeStorage();
  if (!s || !userId) return;
  try {
    s.removeItem(key(kind, userId));
  } catch {
    // no-op
  }
}

export const getWorkspaceHint = (userId: string): string | null =>
  getHint('last_workspace_id', userId);
export const setWorkspaceHint = (userId: string, id: string): void =>
  setHint('last_workspace_id', userId, id);
export const clearWorkspaceHint = (userId: string): void =>
  clearHint('last_workspace_id', userId);

export const getOppositionHint = (userId: string): string | null =>
  getHint('last_opposition_id', userId);
export const setOppositionHint = (userId: string, id: string): void =>
  setHint('last_opposition_id', userId, id);
export const clearOppositionHint = (userId: string): void =>
  clearHint('last_opposition_id', userId);

// Limpia ambas pistas del usuario (logout / acceso revocado / perfil invalido).
export function clearSelectionHints(userId: string): void {
  clearWorkspaceHint(userId);
  clearOppositionHint(userId);
}
