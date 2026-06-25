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
  resolveOcrProvider,
  resolveOcrLimits,
  ocrConfidenceBand,
  aggregateUsableText,
  averageOcrConfidence,
  mapOcrTerminalOutcome,
  buildOcrVisionRequest,
  parseOcrVisionResponse,
  classifyRenderFailure,
  OCR_RENDER_DIAG,
  resolveOcrStrategy,
  DEFAULT_OCR_STRATEGY,
  buildOcrPdfRequest,
  parseOcrPdfResponse,
  planOcrBatches,
  resolveOcrBatchSize,
  resolveOcrBudget,
  evaluateOcrBudget,
  OCR_PDF_BATCH_PAGES,
  MAX_OCR_PDF_PAGES,
  MAX_OCR_COST_PER_DOCUMENT_USD,
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

describe('isOcrProviderReady / resolveOcrProvider', () => {
  it('solo OpenAI esta soportado (anthropic NO, para no usar su clave con otro)', () => {
    expect(isOcrProviderReady({ provider: 'openai', apiKey: 'sk-x' })).toBe(true);
    expect(isOcrProviderReady({ provider: 'anthropic', apiKey: 'k' })).toBe(false);
    expect(isOcrProviderReady({ provider: 'openai', apiKey: '' })).toBe(false);
    expect(isOcrProviderReady({ provider: 'openai', apiKey: null })).toBe(false);
    expect(isOcrProviderReady({ provider: '', apiKey: 'sk-x' })).toBe(false);
    expect(isOcrProviderReady({ provider: 'mock', apiKey: 'sk-x' })).toBe(false);
  });

  it('resolveOcrProvider devuelve null sin proveedor real; OpenAI con clave', () => {
    expect(resolveOcrProvider({ OCR_PROVIDER: 'openai', OPENAI_API_KEY: '' })).toBeNull();
    expect(resolveOcrProvider({ OCR_PROVIDER: 'anthropic', OPENAI_API_KEY: 'k' })).toBeNull();
    const r = resolveOcrProvider({ OCR_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x', OCR_MODEL: 'gpt-4o' });
    expect(r).toMatchObject({ provider: 'openai', apiKey: 'sk-x', model: 'gpt-4o' });
  });

  it('expone el mensaje honesto sin proveedor', () => {
    expect(OCR_PROVIDER_NOT_CONFIGURED_MESSAGE).toContain('no configurado en servidor');
  });
});

describe('vision request/response (puro)', () => {
  it('buildOcrVisionRequest incluye la imagen como data URL y json_schema', () => {
    const body = buildOcrVisionRequest({ model: 'gpt-4o', imageDataUrl: 'data:image/png;base64,AAA' }) as {
      model: string;
      messages: { role: string; content: unknown }[];
      response_format: { type: string };
    };
    expect(body.model).toBe('gpt-4o');
    expect(body.response_format.type).toBe('json_schema');
    const userMsg = body.messages.find((m) => m.role === 'user');
    expect(JSON.stringify(userMsg?.content)).toContain('data:image/png;base64,AAA');
  });

  it('parseOcrVisionResponse extrae texto/confianza/warnings y tolera basura', () => {
    expect(parseOcrVisionResponse(JSON.stringify({ text: 'Hola', confidence: 0.9, warnings: [] }))).toEqual({
      text: 'Hola',
      confidence: 0.9,
      warnings: [],
    });
    // confianza fuera de rango se acota a [0,1]
    expect(parseOcrVisionResponse(JSON.stringify({ text: 'x', confidence: 5 })).confidence).toBe(1);
    // salida no JSON -> texto vacio + confianza null (=> pagina fallida)
    expect(parseOcrVisionResponse('no-json').confidence).toBeNull();
    expect(parseOcrVisionResponse(null).text).toBe('');
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

describe('resolveOcrLimits (SPEC 035: limites por secreto, clamp)', () => {
  it('sin env usa los maximos seguros por defecto', () => {
    expect(resolveOcrLimits({})).toEqual({ maxPages: 300, maxConcurrentPages: 3, pageTimeoutMs: 60000 });
  });
  it('un valor del entorno solo puede ENDURECER (nunca superar el maximo)', () => {
    expect(resolveOcrLimits({ OCR_MAX_PAGES_PER_DOCUMENT: '50' }).maxPages).toBe(50);
    expect(resolveOcrLimits({ OCR_MAX_PAGES_PER_DOCUMENT: '9999' }).maxPages).toBe(300);
    expect(resolveOcrLimits({ OCR_MAX_CONCURRENT_PAGES: '1' }).maxConcurrentPages).toBe(1);
    expect(resolveOcrLimits({ OCR_MAX_CONCURRENT_PAGES: '99' }).maxConcurrentPages).toBe(3);
    expect(resolveOcrLimits({ OCR_PAGE_TIMEOUT_SECONDS: '30' }).pageTimeoutMs).toBe(30000);
    expect(resolveOcrLimits({ OCR_PAGE_TIMEOUT_SECONDS: '120' }).pageTimeoutMs).toBe(60000);
  });
  it('valor invalido cae al maximo seguro', () => {
    expect(resolveOcrLimits({ OCR_MAX_PAGES_PER_DOCUMENT: 'x' }).maxPages).toBe(300);
  });
});

describe('limites documentados', () => {
  it('coinciden con SPEC 030/034', () => {
    expect(MAX_OCR_PAGES).toBe(300);
    expect(OCR_PER_PAGE_TIMEOUT_MS).toBe(60000);
  });
});

describe('classifyRenderFailure (diagnostico SEGURO del render PDF en Edge)', () => {
  it('mapea cada etapa a su codigo de diagnostico', () => {
    expect(classifyRenderFailure({ stage: 'init', message: 'MuPDF no disponible' })).toBe(OCR_RENDER_DIAG.RENDERER_INIT_FAILED);
    expect(classifyRenderFailure({ stage: 'load', message: 'No se pudo abrir el PDF' })).toBe(OCR_RENDER_DIAG.PDF_LOAD_FAILED);
    expect(classifyRenderFailure({ stage: 'page', message: 'No se pudo rasterizar la pagina 3' })).toBe(OCR_RENDER_DIAG.PAGE_RASTERIZE_FAILED);
    expect(classifyRenderFailure({ stage: 'size', message: 'excede el tamano maximo' })).toBe(OCR_RENDER_DIAG.PDF_TOO_LARGE);
  });

  it('detecta PDF cifrado/protegido por contenido del error (cualquier etapa)', () => {
    expect(classifyRenderFailure({ stage: 'load', message: 'document is password protected' })).toBe(OCR_RENDER_DIAG.PDF_PASSWORD_OR_ENCRYPTED);
    expect(classifyRenderFailure({ stage: 'load', message: 'PDF encrypted' })).toBe(OCR_RENDER_DIAG.PDF_PASSWORD_OR_ENCRYPTED);
  });

  it('detecta fallo del runtime WASM en init/page; y tamano por contenido', () => {
    expect(classifyRenderFailure({ stage: 'init', message: 'WebAssembly.instantiate failed: out of memory' })).toBe(OCR_RENDER_DIAG.WASM_RUNTIME_FAILED);
    expect(classifyRenderFailure({ stage: 'page', message: 'wasm memory access out of bounds' })).toBe(OCR_RENDER_DIAG.WASM_RUNTIME_FAILED);
    expect(classifyRenderFailure({ stage: 'page', message: 'image too large' })).toBe(OCR_RENDER_DIAG.PDF_TOO_LARGE);
  });

  it('todos los codigos son etiquetas estables (sin contenido del PDF ni secretos)', () => {
    const all = Object.values(OCR_RENDER_DIAG);
    for (const v of all) expect(/^[a-z_]+$/.test(v)).toBe(true);
    expect(all).toContain('renderer_init_failed');
    expect(all).toContain('wasm_runtime_failed');
  });
});

describe('estrategia OCR provider_pdf (alternativa sin rasterizar en Edge)', () => {
  it('por defecto envia el PDF al proveedor (provider_pdf); solo edge_rasterize si se pide', () => {
    expect(DEFAULT_OCR_STRATEGY).toBe('provider_pdf');
    expect(resolveOcrStrategy({})).toBe('provider_pdf');
    expect(resolveOcrStrategy({ OCR_STRATEGY: null })).toBe('provider_pdf');
    expect(resolveOcrStrategy({ OCR_STRATEGY: 'desconocido' })).toBe('provider_pdf');
    expect(resolveOcrStrategy({ OCR_STRATEGY: 'edge_rasterize' })).toBe('edge_rasterize');
    expect(resolveOcrStrategy({ OCR_STRATEGY: 'EDGE_RASTERIZE' })).toBe('edge_rasterize');
  });

  it('buildOcrPdfRequest manda el PDF como adjunto file_data y pide JSON por paginas', () => {
    const body = buildOcrPdfRequest({ model: 'gpt-4o-mini', pdfBase64: 'QUJD', fileName: 'mat.pdf' }) as {
      model: string;
      messages: { role: string; content: unknown }[];
      response_format: { type: string; json_schema: { name: string } };
    };
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.name).toBe('ocr_document');
    const userMsg = body.messages.find((m) => m.role === 'user');
    const serialized = JSON.stringify(userMsg?.content);
    expect(serialized).toContain('data:application/pdf;base64,QUJD');
    expect(serialized).toContain('mat.pdf');
    // NUNCA debe contener imagenes rasterizadas en este camino.
    expect(serialized).not.toContain('image_url');
  });

  it('parseOcrPdfResponse extrae paginas, reasigna page_number y acota confianza', () => {
    const out = parseOcrPdfResponse(
      JSON.stringify({
        pages: [
          { page_number: 1, text: 'Primera', confidence: 0.9, warnings: [] },
          { page_number: 2, text: 'Segunda', confidence: 5, warnings: ['borroso'] },
          { text: 'Tercera sin numero', confidence: 0.8, warnings: [] },
        ],
      }),
    );
    expect(out.pages).toHaveLength(3);
    expect(out.pages[1].confidence).toBe(1); // acotada a [0,1]
    expect(out.pages[2].page_number).toBe(3); // reasignada por orden
    expect(out.pages[2].text).toBe('Tercera sin numero');
  });

  it('parseOcrPdfResponse tolera basura -> sin paginas (=> sin texto usable, fallo honesto)', () => {
    expect(parseOcrPdfResponse('no-json').pages).toEqual([]);
    expect(parseOcrPdfResponse(null).pages).toEqual([]);
    expect(parseOcrPdfResponse(JSON.stringify({ nope: 1 })).pages).toEqual([]);
  });
})

describe('lotes por rango de paginas (provider_pdf, PDFs grandes)', () => {
  it('resolveOcrBatchSize por defecto el maximo; un secreto solo lo REDUCE', () => {
    expect(resolveOcrBatchSize({})).toBe(OCR_PDF_BATCH_PAGES);
    expect(resolveOcrBatchSize({ OCR_PDF_BATCH_PAGES: '4' })).toBe(4);
    // valor invalido o mayor que el maximo -> maximo
    expect(resolveOcrBatchSize({ OCR_PDF_BATCH_PAGES: '999' })).toBe(OCR_PDF_BATCH_PAGES);
    expect(resolveOcrBatchSize({ OCR_PDF_BATCH_PAGES: 'x' })).toBe(OCR_PDF_BATCH_PAGES);
  });

  it('planOcrBatches divide [1..total] en rangos consecutivos de <= batchSize', () => {
    expect(planOcrBatches(24, 10)).toEqual([
      { from: 1, to: 10 },
      { from: 11, to: 20 },
      { from: 21, to: 24 },
    ]);
    expect(planOcrBatches(10, 10)).toEqual([{ from: 1, to: 10 }]);
    // sin total conocido -> sin lotes (el llamador hace una sola llamada al doc)
    expect(planOcrBatches(0, 10)).toEqual([]);
    expect(planOcrBatches(5, 0)).toEqual([]);
  });

  it('buildOcrPdfRequest con pageRange pide SOLO ese rango (sin imagenes)', () => {
    const body = buildOcrPdfRequest({
      model: 'gpt-4o-mini',
      pdfBase64: 'QUJD',
      fileName: 'mat.pdf',
      pageRange: { from: 11, to: 20 },
    }) as { messages: { role: string; content: unknown }[] };
    const userMsg = body.messages.find((m) => m.role === 'user');
    const serialized = JSON.stringify(userMsg?.content);
    expect(serialized).toContain('de la 11 a la 20');
    expect(serialized).toContain('data:application/pdf;base64,QUJD');
    expect(serialized).not.toContain('image_url');
  });
});

describe('presupuesto de OCR por documento', () => {
  it('resolveOcrBudget: defaults seguros; secretos solo REDUCEN', () => {
    const def = resolveOcrBudget({});
    expect(def.maxPages).toBe(MAX_OCR_PDF_PAGES);
    expect(def.maxCostUsd).toBe(MAX_OCR_COST_PER_DOCUMENT_USD);
    const tighter = resolveOcrBudget({
      OCR_MAX_PAGES_PER_DOCUMENT: '30',
      OCR_MAX_COST_PER_DOCUMENT_USD: '0.10',
    });
    expect(tighter.maxPages).toBe(30);
    expect(tighter.maxCostUsd).toBe(0.1);
    // valores mayores que el maximo seguro NO lo superan
    expect(resolveOcrBudget({ OCR_MAX_COST_PER_DOCUMENT_USD: '999' }).maxCostUsd).toBe(
      MAX_OCR_COST_PER_DOCUMENT_USD,
    );
  });

  it('evaluateOcrBudget: bloquea por paginas o por coste; permite si cabe', () => {
    const budget = resolveOcrBudget({});
    expect(evaluateOcrBudget({ pages: 10, estimatedCostUsd: 0.02, budget })).toEqual({ ok: true });
    expect(evaluateOcrBudget({ pages: 9999, estimatedCostUsd: 0.0, budget })).toEqual({
      ok: false,
      reason: 'page_limit',
    });
    expect(evaluateOcrBudget({ pages: 5, estimatedCostUsd: 999, budget })).toEqual({
      ok: false,
      reason: 'cost_limit',
    });
  });
})
