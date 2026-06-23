// SPEC 034: tests del contrato COMPARTIDO del OCR en servidor. Logica pura, sin
// red ni proveedor real: valida el body de la peticion (solo IDs/opciones), la
// elegibilidad/reintento por estado, las bandas de confianza, la agregacion de
// texto usable y el mapeo HONESTO del resultado real a estados terminales.
//
// Importa el MISMO modulo que usa la Edge Function (`supabase/functions/_shared`)
// para que no haya duplicacion de reglas.

import { describe, it, expect } from 'vitest';
import {
  OCR_ERROR,
  OCR_PROVIDER_NOT_CONFIGURED_MESSAGE,
  validateOcrRequest,
  isOcrEligibleState,
  isOcrRetryState,
  isOcrProviderReady,
  ocrConfidenceBand,
  aggregateUsableText,
  averageOcrConfidence,
  mapOcrTerminalOutcome,
  MAX_OCR_PAGES,
  OCR_PER_PAGE_TIMEOUT_MS,
} from '../../../supabase/functions/_shared/ocr-material/contract';

const baseBody = {
  workspace_id: 'ws-1',
  opposition_id: 'op-1',
  material_id: 'mat-1',
  mode: 'auto' as const,
  force_retry: false,
};

describe('validateOcrRequest', () => {
  it('acepta un body con solo IDs de scope y opciones acotadas', () => {
    const r = validateOcrRequest(baseBody);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.material_id).toBe('mat-1');
      expect(r.value.mode).toBe('auto');
      expect(r.value.force_retry).toBe(false);
    }
  });

  it('por defecto mode = auto y force_retry = false', () => {
    const r = validateOcrRequest({
      workspace_id: 'ws-1',
      opposition_id: 'op-1',
      material_id: 'mat-1',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.mode).toBe('auto');
      expect(r.value.force_retry).toBe(false);
    }
  });

  it.each([
    'user_id',
    'image_base64',
    'image_url',
    'ocr_text',
    'fake_text',
    'raw_text',
    'provider_prompt',
    'api_key',
  ])('rechaza el campo arbitrario/imagen/secreto "%s"', (field) => {
    const r = validateOcrRequest({ ...baseBody, [field]: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(OCR_ERROR.ARBITRARY_INPUT_FORBIDDEN);
  });

  it('rechaza campos desconocidos (whitelist estricta)', () => {
    const r = validateOcrRequest({ ...baseBody, surprise: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(OCR_ERROR.ARBITRARY_INPUT_FORBIDDEN);
  });

  it('exige workspace, opposition y material', () => {
    expect(validateOcrRequest({ ...baseBody, workspace_id: '' })).toMatchObject({
      ok: false,
      code: OCR_ERROR.WORKSPACE_REQUIRED,
    });
    expect(validateOcrRequest({ ...baseBody, opposition_id: '' })).toMatchObject({
      ok: false,
      code: OCR_ERROR.OPPOSITION_REQUIRED,
    });
    expect(validateOcrRequest({ ...baseBody, material_id: '' })).toMatchObject({
      ok: false,
      code: OCR_ERROR.MATERIAL_REQUIRED,
    });
  });

  it('rechaza mode no soportado y force_retry no booleano', () => {
    expect(validateOcrRequest({ ...baseBody, mode: 'selective' }).ok).toBe(false);
    expect(validateOcrRequest({ ...baseBody, force_retry: 'yes' }).ok).toBe(false);
  });

  it('rechaza un body que no es objeto', () => {
    expect(validateOcrRequest(null).ok).toBe(false);
    expect(validateOcrRequest([baseBody]).ok).toBe(false);
    expect(validateOcrRequest('x').ok).toBe(false);
  });
});

describe('elegibilidad y reintento por estado', () => {
  it('solo (re)lanza OCR desde scanned_detected / ocr_failed / completed_ocr_with_warnings', () => {
    for (const s of ['scanned_detected', 'ocr_failed', 'completed_ocr_with_warnings']) {
      expect(isOcrEligibleState(s)).toBe(true);
    }
    for (const s of ['not_started', 'completed', 'ocr_processing', 'completed_ocr', undefined]) {
      expect(isOcrEligibleState(s)).toBe(false);
    }
  });

  it('reintento solo desde estados terminales revisables', () => {
    expect(isOcrRetryState('ocr_failed')).toBe(true);
    expect(isOcrRetryState('completed_ocr_with_warnings')).toBe(true);
    expect(isOcrRetryState('scanned_detected')).toBe(true);
    expect(isOcrRetryState('ocr_processing')).toBe(false);
  });
});

describe('isOcrProviderReady', () => {
  it('exige proveedor compatible Y clave presente', () => {
    expect(isOcrProviderReady({ provider: 'openai', apiKey: 'sk-x' })).toBe(true);
    expect(isOcrProviderReady({ provider: 'anthropic', apiKey: 'k' })).toBe(true);
    expect(isOcrProviderReady({ provider: 'openai', apiKey: '' })).toBe(false);
    expect(isOcrProviderReady({ provider: 'openai', apiKey: null })).toBe(false);
    expect(isOcrProviderReady({ provider: '', apiKey: 'sk-x' })).toBe(false);
    expect(isOcrProviderReady({ provider: 'mock', apiKey: 'sk-x' })).toBe(false);
  });

  it('expone el mensaje honesto sin proveedor', () => {
    expect(OCR_PROVIDER_NOT_CONFIGURED_MESSAGE).toContain('no configurado en servidor');
  });
});

describe('bandas de confianza (SPEC 030)', () => {
  it('>=0.70 completed; 0.40-0.69 warning; <0.40 o null failed', () => {
    expect(ocrConfidenceBand(0.95)).toBe('completed');
    expect(ocrConfidenceBand(0.7)).toBe('completed');
    expect(ocrConfidenceBand(0.69)).toBe('warning');
    expect(ocrConfidenceBand(0.4)).toBe('warning');
    expect(ocrConfidenceBand(0.39)).toBe('failed');
    expect(ocrConfidenceBand(null)).toBe('failed');
  });
});

describe('agregacion de texto y confianza', () => {
  it('concatena solo texto usable en orden de pagina, ignorando fallidas/vacias', () => {
    const text = aggregateUsableText([
      { page_number: 3, text: 'tercera', band: 'completed' },
      { page_number: 1, text: 'primera', band: 'warning' },
      { page_number: 2, text: '', band: 'completed' },
      { page_number: 4, text: 'cuarta', band: 'failed' },
    ]);
    expect(text).toBe('primera\n\ntercera');
  });

  it('media de confianza redondeada a 2 decimales; null si ninguna', () => {
    expect(averageOcrConfidence([0.8, 0.6, null])).toBe(0.7);
    expect(averageOcrConfidence([null, undefined])).toBeNull();
  });
});

describe('mapOcrTerminalOutcome (estados HONESTOS)', () => {
  it('sin texto usable -> failed / ocr_failed / needs_review', () => {
    expect(
      mapOcrTerminalOutcome({ hasUsableText: false, failedPages: 2, warningCount: 0 }),
    ).toEqual({
      run_status: 'failed',
      extraction_status: 'ocr_failed',
      material_status: 'needs_review',
    });
  });

  it('texto usable con fallos o advertencias -> completed_with_warnings / needs_review', () => {
    expect(
      mapOcrTerminalOutcome({ hasUsableText: true, failedPages: 1, warningCount: 0 }),
    ).toMatchObject({ extraction_status: 'completed_ocr_with_warnings', material_status: 'needs_review' });
    expect(
      mapOcrTerminalOutcome({ hasUsableText: true, failedPages: 0, warningCount: 3 }),
    ).toMatchObject({ run_status: 'completed_with_warnings' });
  });

  it('texto usable limpio -> completed / completed_ocr / active', () => {
    expect(
      mapOcrTerminalOutcome({ hasUsableText: true, failedPages: 0, warningCount: 0 }),
    ).toEqual({
      run_status: 'completed',
      extraction_status: 'completed_ocr',
      material_status: 'active',
    });
  });
});

describe('limites documentados', () => {
  it('coinciden con SPEC 030/034', () => {
    expect(MAX_OCR_PAGES).toBe(300);
    expect(OCR_PER_PAGE_TIMEOUT_MS).toBe(60000);
  });
});
