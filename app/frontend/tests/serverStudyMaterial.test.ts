// SPEC 038: tests del wrapper que invoca la Edge Function `study-material`. Sin red:
// cliente Supabase y modo de persistencia mockeados. Verifica que el navegador SOLO
// envia scope + opciones (nunca texto/prompt/imagen/clave/user_id) y el mapeo de
// errores a mensajes seguros (incl. 501 sin proveedor).

import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastInvoke: { name: string; body: unknown } | null = null;
let invokeResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('../src/auth/supabaseClient.js', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    functions: {
      invoke: async (name: string, opts: { body: unknown }) => {
        lastInvoke = { name, body: opts.body };
        return invokeResult;
      },
    },
  }),
}));
vi.mock('../src/store/supabaseGateway.js', () => ({ requestedPersistenceMode: () => 'supabase' }));

import {
  shouldUseServerStudy,
  studyMaterialViaEdgeFunction,
  ServerStudyError,
} from '../src/study/serverStudyMaterial.js';

const ALLOWED = ['workspace_id', 'opposition_id', 'mode', 'force_retry'].sort();
const FORBIDDEN = ['user_id', 'material_text', 'ocr_text', 'prompt', 'concepts', 'image_base64', 'api_key'];
const input = { workspace_id: 'ws-1', opposition_id: 'op-1' };

beforeEach(() => {
  lastInvoke = null;
  invokeResult = { data: null, error: null };
});

describe('SPEC 038 - wrapper de estudio en servidor', () => {
  it('shouldUseServerStudy true en modo Supabase configurado', () => {
    expect(shouldUseServerStudy()).toBe(true);
  });

  it('envia SOLO scope + opciones (sin texto/clave/user_id)', async () => {
    invokeResult = { data: { run_id: 'r1', materials: 3, studied: 2, units: 7, warnings: [] }, error: null };
    const r = await studyMaterialViaEdgeFunction({ ...input, force_retry: true });
    expect(lastInvoke?.name).toBe('study-material');
    const body = lastInvoke?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(ALLOWED);
    for (const k of FORBIDDEN) expect(k in body).toBe(false);
    expect(body.mode).toBe('all_eligible');
    expect(r.units).toBe(7);
  });

  it('mapea el 501 sin proveedor a un mensaje seguro', async () => {
    invokeResult = { data: null, error: { context: { json: async () => ({ error: 'MATERIAL_STUDY_PROVIDER_NOT_CONFIGURED' }) } } };
    try {
      await studyMaterialViaEdgeFunction(input);
      throw new Error('no debio resolver');
    } catch (e) {
      expect(e).toBeInstanceOf(ServerStudyError);
      expect((e as ServerStudyError).code).toBe('MATERIAL_STUDY_PROVIDER_NOT_CONFIGURED');
      expect((e as ServerStudyError).message).toMatch(/no está configurado en servidor/);
    }
  });
});
