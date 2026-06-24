// P0 bootstrap atomico del PRIMER workspace (modo Supabase). El insert directo
// `.insert().select().single()` + creacion de membership NO es atomico y choca
// con la RLS: tras crear el workspace, el actor aun no es miembro, asi que ni
// puede leer la fila recien creada ni la policy de membership puede verificarla.
//
// Solucion: una RPC SECURITY DEFINER (`create_workspace_with_owner`) que crea el
// workspace y la membership `owner` en UNA transaccion. El frontend solo la
// invoca; el `owner_id` lo fija el servidor desde `auth.uid()` (el cliente NO lo
// decide). Sin clave de servicio ni secretos. El slug es INTERNO (autogenerado desde el
// nombre, no editable por el usuario).

import type { Workspace, WorkspaceType, WorkspacePlan } from '@backend';
import { getSupabase, isSupabaseConfigured } from '../auth/supabaseClient.js';
import { requestedPersistenceMode } from '../store/supabaseGateway.js';

// ¿La creacion de workspace debe ir por la RPC de servidor (Supabase) en vez del
// servicio en proceso (InMemory)?
export function shouldUseServerWorkspaceCreate(): boolean {
  return (
    requestedPersistenceMode().toLowerCase() === 'supabase' && isSupabaseConfigured()
  );
}

// Slug INTERNO autogenerado desde el nombre (no editable, no visible). Lleva un
// sufijo aleatorio para que sea practicamente unico y el usuario nunca tope con
// "slug duplicado" en uso normal. PURO (testeable).
export function slugifyName(name: string): string {
  const base = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (diacriticos combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `ws-${suffix}`;
}

export class ServerWorkspaceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServerWorkspaceError';
  }
}

export interface ServerWorkspaceInput {
  name: string;
  type: WorkspaceType;
}

// El plan se deriva del tipo (igual que el flujo actual): personal -> premium,
// organizacion -> organization.
function planForType(type: WorkspaceType): WorkspacePlan {
  return type === 'organization' ? 'organization' : 'premium';
}

// Mapea el error de la RPC a un mensaje SEGURO y ESPECIFICO. Importante: NO mostrar
// "slug duplicado" para un fallo de RLS/otro; el slug es interno y casi nunca
// colisiona.
function mapRpcError(message: string | undefined): { code: string; text: string } {
  const m = message ?? '';
  if (m.includes('WORKSPACE_SLUG_ALREADY_EXISTS')) {
    return {
      code: 'WORKSPACE_SLUG_ALREADY_EXISTS',
      text: 'Ya existe un espacio con ese nombre. Prueba con otro nombre.',
    };
  }
  if (m.includes('WORKSPACE_NAME_REQUIRED')) {
    return { code: 'WORKSPACE_NAME_REQUIRED', text: 'Introduce un nombre para el espacio.' };
  }
  if (m.includes('AUTH_REQUIRED')) {
    return { code: 'AUTH_REQUIRED', text: 'Tu sesión ha caducado. Vuelve a iniciar sesión.' };
  }
  if (m.includes('WORKSPACE_INVALID_TYPE') || m.includes('WORKSPACE_INVALID_PLAN')) {
    return { code: 'WORKSPACE_INVALID', text: 'Datos del espacio no válidos.' };
  }
  return {
    code: 'WORKSPACE_CREATE_FAILED',
    text: 'No se pudo crear el espacio. Inténtalo de nuevo.',
  };
}

function toWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    type: row.type as WorkspaceType,
    plan: row.plan as WorkspacePlan,
    status: row.status as Workspace['status'],
    owner_id: String(row.owner_id),
    created_at: row.created_at ? new Date(String(row.created_at)) : new Date(),
    updated_at: row.updated_at ? new Date(String(row.updated_at)) : new Date(),
  };
}

// Crea el workspace + membership owner de forma atomica via la RPC. El navegador
// envia SOLO los campos previstos (nombre/slug interno/tipo/plan); NUNCA owner_id
// (lo fija el servidor desde el JWT), asi que no se puede crear para otro owner.
export async function createWorkspaceViaRpc(
  input: ServerWorkspaceInput,
): Promise<Workspace> {
  const name = (input.name ?? '').trim();
  if (!name) {
    throw new ServerWorkspaceError('WORKSPACE_NAME_REQUIRED', 'Introduce un nombre para el espacio.');
  }
  const type: WorkspaceType = input.type === 'organization' ? 'organization' : 'personal';
  const body = {
    p_name: name,
    p_slug: slugifyName(name),
    p_type: type,
    p_plan: planForType(type),
  };

  const { data, error } = await getSupabase().rpc('create_workspace_with_owner', body);
  if (error) {
    const mapped = mapRpcError(error.message);
    throw new ServerWorkspaceError(mapped.code, mapped.text);
  }
  // La funcion devuelve la fila de workspaces (objeto, no array).
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row || !row.id) {
    throw new ServerWorkspaceError('WORKSPACE_CREATE_FAILED', 'No se pudo crear el espacio. Inténtalo de nuevo.');
  }
  return toWorkspace(row);
}
