// SPEC 033: tests del wrapper del frontend que invoca la Edge Function
// `generate-questions`. Sin red real: se mockea el cliente Supabase y el modo de
// persistencia. Verifica que el navegador SOLO envia IDs/parametros (nunca
// texto/fuente/prompt/secretos) y que los codigos de error se mapean a mensajes
// seguros.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Captura del body enviado a la funcion.
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
  shouldUseServerGeneration,
  generateQuestionsViaEdgeFunction,
  ServerGenerationError,
} from '../src/generation/serverQuestionGeneration.js';

const ALLOWED_KEYS = [
  'workspace_id',
  'opposition_id',
  'topic_id',
  'difficulty',
  'question_count',
  'source_mode',
  'selected_source_reference_ids',
  'selected_material_section_ids',
].sort();

const FORBIDDEN_KEYS = [
  'user_id',
  'source_text',
  'raw_text',
  'manual_context',
  'custom_prompt',
  'prompt',
];

const baseInput = {
  workspace_id: 'ws-1',
  opposition_id: 'op-1',
  topic_id: 'tp-1',
  difficulty: 'easy' as const,
  question_count: 3,
};

beforeEach(() => {
  lastInvoke = null;
  invokeResult = { data: null, error: null };
});

describe('SPEC 033 - wrapper de generacion en servidor', () => {
  it('shouldUseServerGeneration es true en modo Supabase configurado', () => {
    expect(shouldUseServerGeneration()).toBe(true);
  });

  it('envia SOLO IDs/parametros permitidos (sin texto/fuente/prompt)', async () => {
    invokeResult = { data: { run_id: 'r1', created: 2, requested: 3, warnings: [] }, error: null };
    const summary = await generateQuestionsViaEdgeFunction(baseInput);

    expect(lastInvoke?.name).toBe('generate-questions');
    const body = lastInvoke?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS);
    for (const k of FORBIDDEN_KEYS) {
      expect(k in body).toBe(false);
    }
    expect(summary.created).toBe(2);
    expect(summary.run_id).toBe('r1');
  });

  it('mapea el 501 sin proveedor a un mensaje seguro', async () => {
    invokeResult = {
      data: null,
      error: {
        context: {
          json: async () => ({ error: 'QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED' }),
        },
      },
    };
    await expect(generateQuestionsViaEdgeFunction(baseInput)).rejects.toMatchObject({
      code: 'QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED',
    });
    try {
      await generateQuestionsViaEdgeFunction(baseInput);
    } catch (e) {
      expect(e).toBeInstanceOf(ServerGenerationError);
      expect((e as ServerGenerationError).message).toContain('todavía no está configurada');
    }
  });

  it('no invoca la funcion si el body no pasa la validacion del contrato', async () => {
    await expect(
      generateQuestionsViaEdgeFunction({ ...baseInput, question_count: 99 }),
    ).rejects.toBeInstanceOf(ServerGenerationError);
    expect(lastInvoke).toBeNull();
  });
});
