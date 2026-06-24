// P0 bootstrap atomico de workspace: tests del wrapper que invoca la RPC
// `create_workspace_with_owner`. Sin red real: cliente Supabase y modo de
// persistencia mockeados. Verifica que el navegador envia SOLO los campos
// previstos (NUNCA owner_id), el slug interno autogenerado, el mapeo de errores
// ESPECIFICO (slug duplicado vs generico) y la conversion de la fila a Workspace.

import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastRpc: { fn: string; args: unknown } | null = null;
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('../src/auth/supabaseClient.js', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    rpc: async (fn: string, args: unknown) => {
      lastRpc = { fn, args };
      return rpcResult;
    },
  }),
}));

vi.mock('../src/store/supabaseGateway.js', () => ({
  requestedPersistenceMode: () => 'supabase',
}));

import {
  shouldUseServerWorkspaceCreate,
  createWorkspaceViaRpc,
  ServerWorkspaceError,
  slugifyName,
} from '../src/workspaces/serverWorkspaceBootstrap.js';

const okRow = {
  id: 'ws-1',
  name: 'Mi Espacio',
  slug: 'mi-espacio-ab12cd',
  type: 'personal',
  plan: 'premium',
  status: 'active',
  owner_id: 'user-1',
  created_at: '2026-06-24T00:00:00.000Z',
  updated_at: '2026-06-24T00:00:00.000Z',
};

beforeEach(() => {
  lastRpc = null;
  rpcResult = { data: null, error: null };
});

describe('slugifyName', () => {
  it('genera slug interno desde el nombre (sin acentos, minusculas, con sufijo)', () => {
    expect(slugifyName('Mi Preparación Personal')).toMatch(/^mi-preparacion-personal-[a-z0-9]+$/);
    expect(slugifyName('   ')).toMatch(/^ws-[a-z0-9]+$/);
    // Dos llamadas con el mismo nombre dan slugs distintos (sufijo aleatorio).
    expect(slugifyName('Hola')).not.toBe(slugifyName('Hola'));
  });
});

describe('createWorkspaceViaRpc', () => {
  it('shouldUseServerWorkspaceCreate es true en modo Supabase configurado', () => {
    expect(shouldUseServerWorkspaceCreate()).toBe(true);
  });

  it('envia SOLO los campos previstos (sin owner_id) y deriva el plan del tipo', async () => {
    rpcResult = { data: okRow, error: null };
    await createWorkspaceViaRpc({ name: 'Mi Espacio', type: 'personal' });
    expect(lastRpc?.fn).toBe('create_workspace_with_owner');
    const args = lastRpc?.args as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(['p_name', 'p_plan', 'p_slug', 'p_type']);
    expect('owner_id' in args).toBe(false);
    expect('p_owner_id' in args).toBe(false);
    expect(args.p_name).toBe('Mi Espacio');
    expect(args.p_type).toBe('personal');
    expect(args.p_plan).toBe('premium');
    expect(args.p_slug).toMatch(/^mi-espacio-[a-z0-9]+$/);

    rpcResult = { data: { ...okRow, type: 'organization', plan: 'organization' }, error: null };
    await createWorkspaceViaRpc({ name: 'Academia X', type: 'organization' });
    expect((lastRpc?.args as Record<string, unknown>).p_plan).toBe('organization');
  });

  it('convierte la fila devuelta en un Workspace', async () => {
    rpcResult = { data: okRow, error: null };
    const ws = await createWorkspaceViaRpc({ name: 'Mi Espacio', type: 'personal' });
    expect(ws.id).toBe('ws-1');
    expect(ws.owner_id).toBe('user-1');
    expect(ws.created_at).toBeInstanceOf(Date);
  });

  it('slug duplicado -> mensaje ESPECIFICO; otro error -> generico (no "slug")', async () => {
    rpcResult = { data: null, error: { message: 'ERROR: WORKSPACE_SLUG_ALREADY_EXISTS' } };
    await expect(createWorkspaceViaRpc({ name: 'X', type: 'personal' })).rejects.toMatchObject({
      code: 'WORKSPACE_SLUG_ALREADY_EXISTS',
    });

    rpcResult = { data: null, error: { message: 'permission denied (RLS)' } };
    try {
      await createWorkspaceViaRpc({ name: 'X', type: 'personal' });
      throw new Error('no debio resolver');
    } catch (e) {
      expect(e).toBeInstanceOf(ServerWorkspaceError);
      expect((e as ServerWorkspaceError).code).toBe('WORKSPACE_CREATE_FAILED');
      expect((e as ServerWorkspaceError).message).not.toMatch(/slug|Ya existe/i);
    }
  });

  it('AUTH_REQUIRED -> mensaje de sesión', async () => {
    rpcResult = { data: null, error: { message: 'AUTH_REQUIRED' } };
    await expect(createWorkspaceViaRpc({ name: 'X', type: 'personal' })).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
  });

  it('nombre vacio -> error sin invocar la RPC (no se puede crear sin nombre)', async () => {
    await expect(createWorkspaceViaRpc({ name: '   ', type: 'personal' })).rejects.toBeInstanceOf(
      ServerWorkspaceError,
    );
    expect(lastRpc).toBeNull();
  });
});
