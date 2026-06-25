// SPEC 034: tests del wrapper del frontend que invoca la Edge Function
// `ocr-material`. Sin red real: se mockea el cliente Supabase y el modo de
// persistencia. Verifica que el navegador SOLO envia IDs de scope + reintento
// (nunca imagenes/texto OCR/prompts/secretos) y que los codigos de error se
// mapean a mensajes seguros.

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
  shouldUseServerOcr,
  runOcrViaEdgeFunction,
  ServerOcrError,
} from '../src/ocr/serverOcrMaterial.js';

const ALLOWED_KEYS = [
  'workspace_id',
  'opposition_id',
  'material_id',
  'mode',
  'force_retry',
].sort();

const FORBIDDEN_KEYS = [
  'user_id',
  'image_base64',
  'image_url',
  'ocr_text',
  'fake_text',
  'raw_text',
  'provider_prompt',
  'api_key',
];

const baseInput = {
  workspace_id: 'ws-1',
  opposition_id: 'op-1',
  material_id: 'mat-1',
};

beforeEach(() => {
  lastInvoke = null;
  invokeResult = { data: null, error: null };
});

describe('SPEC 034 - wrapper de OCR en servidor', () => {
  it('shouldUseServerOcr es true en modo Supabase configurado', () => {
    expect(shouldUseServerOcr()).toBe(true);
  });

  it('envia SOLO IDs/opciones permitidas (sin imagen/texto OCR/clave)', async () => {
    invokeResult = {
      data: { material_id: 'mat-1', extraction_status: 'completed_ocr', run_id: 'r1', warnings: [] },
      error: null,
    };
    const summary = await runOcrViaEdgeFunction({ ...baseInput, force_retry: true });

    expect(lastInvoke?.name).toBe('ocr-material');
    const body = lastInvoke?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(ALLOWED_KEYS);
    for (const k of FORBIDDEN_KEYS) {
      expect(k in body).toBe(false);
    }
    expect(body.mode).toBe('auto');
    expect(body.force_retry).toBe(true);
    expect(summary.extraction_status).toBe('completed_ocr');
    expect(summary.run_id).toBe('r1');
  });

  it('mapea el 501 sin proveedor a un mensaje seguro', async () => {
    invokeResult = {
      data: null,
      error: {
        context: {
          json: async () => ({ error: 'OCR_PROVIDER_NOT_CONFIGURED' }),
        },
      },
    };
    await expect(runOcrViaEdgeFunction(baseInput)).rejects.toMatchObject({
      code: 'OCR_PROVIDER_NOT_CONFIGURED',
    });
    try {
      await runOcrViaEdgeFunction(baseInput);
    } catch (e) {
      expect(e).toBeInstanceOf(ServerOcrError);
      expect((e as ServerOcrError).message).toContain('no configurado en servidor');
    }
  });

  it('no invoca la funcion si el body no pasa la validacion del contrato', async () => {
    await expect(
      runOcrViaEdgeFunction({ ...baseInput, material_id: '' }),
    ).rejects.toBeInstanceOf(ServerOcrError);
    expect(lastInvoke).toBeNull();
  });

  it('mapea el 429 de presupuesto a un mensaje seguro', async () => {
    invokeResult = {
      data: null,
      error: { context: { json: async () => ({ error: 'OCR_BUDGET_EXCEEDED' }) } },
    };
    try {
      await runOcrViaEdgeFunction(baseInput);
      throw new Error('deberia rechazar');
    } catch (e) {
      expect(e).toBeInstanceOf(ServerOcrError);
      expect((e as ServerOcrError).code).toBe('OCR_BUDGET_EXCEEDED');
      expect((e as ServerOcrError).message).toContain('presupuesto');
    }
  });
});
