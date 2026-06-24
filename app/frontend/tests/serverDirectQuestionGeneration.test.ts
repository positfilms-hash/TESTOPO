// SPEC 039: tests del wrapper del frontend que invoca la Edge Function
// `generate-questions-from-studied-material`. Sin red real: se mockea el cliente
// Supabase y el modo de persistencia. Verifica que el navegador SOLO envia IDs de
// alcance/parametros (nunca texto/fuente/extracto/prompt/secretos) y que los
// codigos de error se mapean a mensajes seguros.

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

vi.mock('../src/store/supabaseGateway.js', () => ({
  requestedPersistenceMode: () => 'supabase',
}));

import {
  shouldUseServerDirectGeneration,
  generateFromStudiedMaterialViaEdgeFunction,
  ServerDirectGenerationError,
} from '../src/generation/serverDirectQuestionGeneration.js';

const ALLOWED_KEYS = [
  'workspace_id',
  'opposition_id',
  'scope',
  'question_count',
  'difficulty',
  'material_ids',
  'material_study_unit_ids',
  'material_study_concept_ids',
].sort();

const FORBIDDEN_KEYS = ['user_id', 'source_text', 'excerpt', 'prompt', 'api_key', 'correct_answer'];

const baseInput = {
  workspace_id: 'ws-1',
  opposition_id: 'op-1',
  scope: 'all_studied_material' as const,
  question_count: 5,
  difficulty: 'mixed' as const,
};

beforeEach(() => {
  lastInvoke = null;
  invokeResult = { data: null, error: null };
});

describe('SPEC 039 - wrapper de generacion directa desde material estudiado', () => {
  it('shouldUseServerDirectGeneration es true en modo Supabase configurado', () => {
    expect(shouldUseServerDirectGeneration()).toBe(true);
  });

  it('invoca la funcion correcta y envia SOLO IDs/parametros permitidos', async () => {
    invokeResult = { data: { run_id: 'r1', study_run_id: 's1', created: 3, requested: 5, warnings: [] }, error: null };
    const summary = await generateFromStudiedMaterialViaEdgeFunction(baseInput);

    expect(lastInvoke?.name).toBe('generate-questions-from-studied-material');
    const body = lastInvoke?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS);
    for (const k of FORBIDDEN_KEYS) {
      expect(k in body).toBe(false);
    }
    expect(summary.created).toBe(3);
    expect(summary.run_id).toBe('r1');
    expect(summary.study_run_id).toBe('s1');
  });

  it('incluye material_study_run_id solo cuando se proporciona', async () => {
    invokeResult = { data: { created: 1 }, error: null };
    await generateFromStudiedMaterialViaEdgeFunction({ ...baseInput, material_study_run_id: 'run-9' });
    const body = lastInvoke?.body as Record<string, unknown>;
    expect(body.material_study_run_id).toBe('run-9');
  });

  it('mapea el 501 sin proveedor a un mensaje seguro', async () => {
    invokeResult = {
      data: null,
      error: { context: { json: async () => ({ error: 'DIRECT_QG_PROVIDER_NOT_CONFIGURED' }) } },
    };
    await expect(generateFromStudiedMaterialViaEdgeFunction(baseInput)).rejects.toMatchObject({
      code: 'DIRECT_QG_PROVIDER_NOT_CONFIGURED',
    });
    try {
      await generateFromStudiedMaterialViaEdgeFunction(baseInput);
    } catch (e) {
      expect(e).toBeInstanceOf(ServerDirectGenerationError);
      expect((e as ServerDirectGenerationError).message).toContain('todavía no está configurada');
    }
  });

  it('no invoca la funcion si el body no pasa la validacion del contrato', async () => {
    await expect(
      generateFromStudiedMaterialViaEdgeFunction({ ...baseInput, question_count: 99 }),
    ).rejects.toBeInstanceOf(ServerDirectGenerationError);
    expect(lastInvoke).toBeNull();
  });

  it('rechaza una seleccion incoherente con el alcance antes de invocar', async () => {
    await expect(
      generateFromStudiedMaterialViaEdgeFunction({
        ...baseInput,
        scope: 'selected_materials',
        material_ids: [],
      }),
    ).rejects.toBeInstanceOf(ServerDirectGenerationError);
    expect(lastInvoke).toBeNull();
  });
});
