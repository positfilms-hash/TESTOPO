// TESTOPO - Edge Function: ocr-material (SPEC 034). FLUJO REAL server-side.
//
// Frontera de servidor de CONFIANZA para el OCR de PDFs ESCANEADOS. El navegador
// solo manda IDs de scope y una opcion de reintento (NUNCA imagenes, texto OCR,
// prompts ni `user_id`). Esta funcion: (1) autentica el JWT, (2) valida el body,
// (3) comprueba EXPLICITAMENTE el permiso de gestion (rol owner/admin activo) +
// scope + elegibilidad del material (no solo RLS), (4) descarga el PDF privado en
// el servidor y obtiene el texto OCR real segun la ESTRATEGIA: por defecto
// `provider_pdf` (envia el PDF al proveedor SIN rasterizar, porque MuPDF/WASM no
// inicializa en Edge -> renderer_init_failed), o legado `edge_rasterize` (MuPDF
// pagina a pagina) si el entorno lo soporta; en ambos la CLAVE es secreto de
// SERVIDOR, (5) persiste run + paginas + texto real y estados honestos, y (6)
// devuelve un resumen seguro.
//
// La clave NUNCA llega al navegador/Vite. Sin proveedor real configurado responde
// 501, PRESERVA `scanned_detected` y NO persiste nada. La logica determinista vive
// en `_shared/ocr-material/contract.ts` (testeada en vitest); aqui solo hay
// orquestacion + adaptadores (Storage, MuPDF, vision) que SOLO pueden verificarse
// en staging con secretos reales.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { evaluateManagementAccess } from '../_shared/authz/management.ts';
import {
  OCR_ERROR,
  OCR_PROVIDER_NOT_CONFIGURED_MESSAGE,
  resolveOcrLimits,
  resolveOcrProvider,
  validateOcrRequest,
  isOcrRetryState,
  isOcrEligibleState,
  ocrConfidenceBand,
  aggregateUsableText,
  averageOcrConfidence,
  mapOcrTerminalOutcome,
  buildOcrVisionRequest,
  parseOcrVisionResponse,
  classifyRenderFailure,
  resolveOcrStrategy,
  buildOcrPdfRequest,
  parseOcrPdfResponse,
  MAX_OCR_PDF_BYTES,
  MAX_OCR_PDF_PAGES,
  OCR_DOCUMENT_TIMEOUT_MS,
  type OcrErrorCode,
  type OcrPageBand,
} from '../_shared/ocr-material/contract.ts';
import { renderPdfToPages, PdfRenderError } from './pdfRender.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function fail(code: OcrErrorCode, status: number, message?: string): Response {
  return json(message ? { error: code, message } : { error: code }, status);
}
function uuid(): string {
  return crypto.randomUUID();
}
// Base64 de un Uint8Array sin dependencias (envio del PDF como adjunto al
// proveedor). El PDF lo descarga el servidor desde Storage; el navegador nunca lo
// aporta.
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(OCR_ERROR.INVALID_REQUEST, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'OCR_SERVER_NOT_CONFIGURED' }, 500);

  // 1) Auth.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(OCR_ERROR.AUTH_REQUIRED, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return fail(OCR_ERROR.AUTH_REQUIRED, 401);
  const actorId = userData.user.id;

  // 2) Body: whitelist estricta (rechaza imagen/texto OCR/clave/user_id).
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(OCR_ERROR.INVALID_REQUEST, 400);
  }
  const parsed = validateOcrRequest(raw);
  if (!parsed.ok) {
    return fail(parsed.code, parsed.code === OCR_ERROR.ARBITRARY_INPUT_FORBIDDEN ? 422 : 400);
  }
  const request = parsed.value;

  // 3) GUARDA EXPLICITA de gestion (no solo RLS): perfil no eliminado + membership
  //    activa owner/admin. Student/eliminado/revocado fallan AQUI, antes de
  //    Storage, del proveedor o de cualquier escritura.
  const { data: profile } = await userClient
    .from('profiles')
    .select('id, status')
    .eq('id', actorId)
    .maybeSingle();
  const { data: membership } = await userClient
    .from('workspace_members')
    .select('role, status')
    .eq('workspace_id', request.workspace_id)
    .eq('user_id', actorId)
    .maybeSingle();
  const access = evaluateManagementAccess({ profile, membership });
  if (!access.ok) {
    return access.reason === 'auth_required'
      ? fail(OCR_ERROR.AUTH_REQUIRED, 401)
      : fail(OCR_ERROR.ACCESS_DENIED, 403);
  }

  // 3b) Scope + elegibilidad del material.
  const { data: opposition } = await userClient
    .from('oppositions')
    .select('id, workspace_id')
    .eq('id', request.opposition_id)
    .maybeSingle();
  if (!opposition || opposition.workspace_id !== request.workspace_id) {
    return fail(OCR_ERROR.ACCESS_DENIED, 403);
  }
  const { data: material } = await userClient
    .from('materials')
    .select('id, workspace_id, opposition_id, file_extension, storage_path, status, extraction_status, page_count, content_text, extraction_method')
    .eq('id', request.material_id)
    .maybeSingle();
  if (
    !material ||
    material.opposition_id !== request.opposition_id ||
    material.workspace_id !== request.workspace_id
  ) {
    return fail(OCR_ERROR.MATERIAL_NOT_FOUND, 404);
  }
  if (material.status === 'obsolete') return fail(OCR_ERROR.MATERIAL_OBSOLETE, 409);
  if (material.file_extension !== 'pdf' || !material.storage_path) {
    return fail(OCR_ERROR.MATERIAL_NOT_PDF, 409);
  }
  if (!isOcrEligibleState(material.extraction_status)) {
    return fail(OCR_ERROR.SCAN_NOT_DETECTED, 409);
  }
  const isRetry = request.force_retry || material.extraction_status !== 'scanned_detected';
  if (isRetry && !isOcrRetryState(material.extraction_status)) {
    return fail(OCR_ERROR.RETRY_NOT_ALLOWED, 409);
  }
  // SPEC 035: limites efectivos por secreto de Edge Function (clamp al maximo
  // seguro). El navegador no los controla.
  const limits = resolveOcrLimits({
    OCR_MAX_PAGES_PER_DOCUMENT: Deno.env.get('OCR_MAX_PAGES_PER_DOCUMENT'),
    OCR_MAX_CONCURRENT_PAGES: Deno.env.get('OCR_MAX_CONCURRENT_PAGES'),
    OCR_PAGE_TIMEOUT_SECONDS: Deno.env.get('OCR_PAGE_TIMEOUT_SECONDS'),
  });
  if (typeof material.page_count === 'number' && material.page_count > limits.maxPages) {
    return fail(OCR_ERROR.PAGE_LIMIT_EXCEEDED, 413);
  }

  // 4) Proveedor: sin proveedor real -> 501, PRESERVA estado, CERO escrituras.
  const provider = resolveOcrProvider({
    OCR_PROVIDER: Deno.env.get('OCR_PROVIDER'),
    OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
    OCR_MODEL: Deno.env.get('OCR_MODEL'),
  });
  if (!provider) {
    return fail(OCR_ERROR.PROVIDER_NOT_CONFIGURED, 501, OCR_PROVIDER_NOT_CONFIGURED_MESSAGE);
  }

  // 5) Reintento: se crea SIEMPRE un run NUEVO con su propio `ocr_run_id`, sin
  //    reutilizar ni mezclar paginas de runs anteriores (las paginas se insertan
  //    SOLO con este `runId`). Se CONSERVA el historial auditado de runs/paginas
  //    previos (no se borra nada): la trazabilidad de OCR es acumulativa.
  const startedAt = new Date().toISOString();
  const runId = uuid();
  // Cada escritura es FALIBLE: se comprueba su error. Si no se puede crear el run,
  // no hay nada que actualizar: se deja el material en estado fallido honesto.
  const { error: runInsertErr } = await userClient.from('material_ocr_runs').insert({
    id: runId,
    workspace_id: request.workspace_id,
    opposition_id: request.opposition_id,
    material_id: request.material_id,
    created_by: actorId,
    provider: provider.provider,
    model: provider.model,
    status: 'processing',
    page_count: material.page_count ?? 0,
    processed_pages: 0,
    failed_pages: 0,
    average_confidence: null,
    warnings: [],
    errors: [],
    created_at: startedAt,
    updated_at: startedAt,
  });
  if (runInsertErr) {
    await userClient
      .from('materials')
      .update({
        extraction_status: 'ocr_failed',
        status: 'needs_review',
        ocr_status: 'failed',
        extraction_error: 'No se pudo iniciar el OCR.',
      })
      .eq('id', request.material_id);
    return fail(OCR_ERROR.SAVE_FAILED, 502, 'No se pudo guardar el OCR.');
  }
  const { error: procErr } = await userClient
    .from('materials')
    .update({ extraction_status: 'ocr_processing', ocr_status: 'processing' })
    .eq('id', request.material_id);
  if (procErr) {
    return await failRun(userClient, runId, request.material_id, material, {
      runStatus: 'failed',
      extractionStatus: 'ocr_failed',
      errorCode: OCR_ERROR.SAVE_FAILED,
      errorText: 'No se pudo guardar el OCR.',
    });
  }

  // 5a) Descarga privada del PDF (Storage; RLS de bucket exige owner/admin).
  const { data: file, error: dlErr } = await userClient.storage
    .from('materials')
    .download(material.storage_path);
  if (dlErr || !file) {
    return await failRun(userClient, runId, request.material_id, material, {
      runStatus: 'failed',
      extractionStatus: 'ocr_failed',
      errorCode: OCR_ERROR.STORAGE_FAILED,
      errorText: 'No se pudo leer el archivo original.',
    });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());

  // 5b) Obtener el texto OCR por pagina segun la ESTRATEGIA del entorno:
  //   provider_pdf   = enviar el PDF al proveedor SIN rasterizar (por defecto;
  //                    MuPDF/WASM no inicializa en Edge -> renderer_init_failed).
  //   edge_rasterize = camino legado MuPDF (solo si el entorno lo soporta).
  // En ambos casos `results` es la lista honesta de paginas con texto/confianza
  // realmente devueltos por el proveedor (sin inventar nada).
  type PageResult = { page_number: number; text: string; confidence: number | null; warnings: string[] };
  const strategy = resolveOcrStrategy({ OCR_STRATEGY: Deno.env.get('OCR_STRATEGY') });
  let results: PageResult[];

  if (strategy === 'provider_pdf') {
    // 5b-A) Envio directo del PDF al proveedor (una sola llamada). Guarda de
    //       tamano/paginas ANTES de llamar (limite del file input del proveedor).
    if (
      bytes.byteLength > MAX_OCR_PDF_BYTES ||
      (typeof material.page_count === 'number' && material.page_count > MAX_OCR_PDF_PAGES)
    ) {
      console.error('ocr_pdf_input_too_large');
      return await failRun(userClient, runId, request.material_id, material, {
        runStatus: 'failed',
        extractionStatus: 'ocr_failed',
        errorCode: OCR_ERROR.PAGE_LIMIT_EXCEEDED,
        errorText: 'El PDF excede el limite admitido por el OCR del servidor.',
        diagCodes: ['pdf_too_large'],
      });
    }
    const fileName = `${request.material_id}.pdf`;
    const body = buildOcrPdfRequest({ model: provider.model, pdfBase64: toBase64(bytes), fileName });
    let resp: Response;
    try {
      resp = await withTimeout(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify(body),
        }),
        OCR_DOCUMENT_TIMEOUT_MS,
      );
    } catch {
      // SI se llamo al proveedor (timeout/red): fallo de PROVEEDOR, no de render.
      console.error('ocr_provider_failed reason=timeout_or_network');
      return await failRun(userClient, runId, request.material_id, material, {
        runStatus: 'failed',
        extractionStatus: 'ocr_failed',
        errorCode: OCR_ERROR.PROVIDER_FAILED,
        errorText: 'El proveedor OCR no respondio.',
        diagCodes: ['provider_timeout_or_network'],
      });
    }
    if (!resp.ok) {
      // Log SEGURO: solo el status; nunca cuerpo crudo, prompt ni Authorization.
      console.error(`ocr_provider_failed status=${resp.status}`);
      return await failRun(userClient, runId, request.material_id, material, {
        runStatus: 'failed',
        extractionStatus: 'ocr_failed',
        errorCode: OCR_ERROR.PROVIDER_FAILED,
        errorText: 'El proveedor OCR rechazo el documento.',
        diagCodes: [`provider_http_${resp.status}`],
      });
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    results = parseOcrPdfResponse(data.choices?.[0]?.message?.content ?? null).pages;
  } else {
    // 5b-B) Render server-side (fail-closed si MuPDF no inicializa/rasteriza). NO
    //       se ha llamado aun al proveedor: un fallo aqui es de RENDER, no de
    //       proveedor.
    let pages: { page_number: number; imageDataUrl: string }[];
    try {
      pages = await renderPdfToPages(bytes, { maxPages: limits.maxPages });
    } catch (e) {
      const renderErr = e instanceof PdfRenderError ? e : null;
      const stage = renderErr?.stage ?? 'init';
      const pageNumber = renderErr?.pageNumber ?? null;
      const diag = renderErr?.diag ?? classifyRenderFailure({ stage: 'init', message: String(e) });
      // Log SEGURO: solo etapa + pagina + codigo de diagnostico; nunca contenido
      // del PDF, bytes ni secretos.
      console.error(`ocr_render_failed stage=${stage} page=${pageNumber ?? ''} diag=${diag}`);
      return await failRun(userClient, runId, request.material_id, material, {
        runStatus: 'failed',
        extractionStatus: 'ocr_failed',
        errorCode: stage === 'page' ? OCR_ERROR.PAGE_RENDER_FAILED : OCR_ERROR.RENDER_FAILED,
        errorText: 'No se pudo procesar el PDF del escaneo en el servidor.',
        diagCodes: [diag],
      });
    }
    results = [];
    for (const page of pages) {
      let result = { text: '', confidence: null as number | null, warnings: [] as string[] };
      try {
        const body = buildOcrVisionRequest({ model: provider.model, imageDataUrl: page.imageDataUrl });
        const resp = await withTimeout(
          fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${provider.apiKey}`,
            },
            body: JSON.stringify(body),
          }),
          limits.pageTimeoutMs,
        );
        if (resp.ok) {
          const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
          result = parseOcrVisionResponse(data.choices?.[0]?.message?.content ?? null);
        } else {
          result.warnings.push('El proveedor OCR rechazo esta pagina.');
        }
      } catch {
        result.warnings.push('Error o timeout del proveedor OCR en esta pagina.');
      }
      results.push({
        page_number: page.page_number,
        text: result.text,
        confidence: result.confidence,
        warnings: result.warnings,
      });
    }
  }

  // 5c) Persistencia HONESTA por pagina + agregacion (comun a ambas estrategias).
  const pageRows: { page_number: number; text: string; band: OcrPageBand }[] = [];
  const confidences: (number | null)[] = [];
  const warnings: string[] = [];
  let processed = 0;
  let failed = 0;
  let saveFailed = false;

  for (const result of results) {
    const band = ocrConfidenceBand(result.confidence);
    confidences.push(result.confidence);
    pageRows.push({ page_number: result.page_number, text: result.text, band });
    if (band === 'failed') failed += 1;
    else {
      processed += 1;
      for (const w of result.warnings) warnings.push(w);
    }

    const { error: pageErr } = await userClient.from('material_ocr_pages').insert({
      id: uuid(),
      workspace_id: request.workspace_id,
      opposition_id: request.opposition_id,
      material_id: request.material_id,
      ocr_run_id: runId,
      page_number: result.page_number,
      image_ref: null, // las imagenes temporales no se conservan ni se exponen.
      text: result.text,
      confidence: result.confidence,
      status: band,
      warnings: result.warnings,
      errors: band === 'failed' ? ['Confianza insuficiente o sin texto.'] : [],
    });
    if (pageErr) {
      saveFailed = true;
      break; // no seguir procesando si la persistencia de paginas falla.
    }
  }

  // Si alguna pagina no se pudo guardar, NO hay resultado fiable: run/material
  // fallidos honestos y OCR_SAVE_FAILED (nunca completed_ocr).
  if (saveFailed) {
    return await failRun(userClient, runId, request.material_id, material, {
      runStatus: 'failed',
      extractionStatus: 'ocr_failed',
      errorCode: OCR_ERROR.SAVE_FAILED,
      errorText: 'No se pudo guardar el OCR.',
    });
  }

  // 6) Agregacion ordenada + estados HONESTOS.
  const aggregated = aggregateUsableText(pageRows);
  const avg = averageOcrConfidence(confidences);
  const outcome = mapOcrTerminalOutcome({
    hasUsableText: aggregated.length > 0,
    failedPages: failed,
    warningCount: warnings.length,
  });
  const finishedAt = new Date().toISOString();

  const { error: runUpdateErr } = await userClient
    .from('material_ocr_runs')
    .update({
      status: outcome.run_status,
      processed_pages: processed,
      failed_pages: failed,
      average_confidence: avg,
      warnings,
      errors: aggregated.length === 0 ? ['No se extrajo texto utilizable del escaneo.'] : [],
      updated_at: finishedAt,
    })
    .eq('id', runId);
  if (runUpdateErr) {
    return await failRun(userClient, runId, request.material_id, material, {
      runStatus: 'failed',
      extractionStatus: 'ocr_failed',
      errorCode: OCR_ERROR.SAVE_FAILED,
      errorText: 'No se pudo guardar el OCR.',
    });
  }

  // Un fallo total NO sobreescribe buen texto nativo: solo se escribe content_text
  // cuando hay texto OCR utilizable.
  const materialUpdate: Record<string, unknown> = {
    extraction_status: outcome.extraction_status,
    status: outcome.material_status,
    ocr_status: outcome.run_status,
    ocr_confidence: avg,
    ocr_page_count: pageRows.length,
    ocr_processed_pages: processed,
    ocr_failed_pages: failed,
    ocr_warning_count: warnings.length,
    extraction_error:
      outcome.run_status === 'failed' ? 'OCR sin texto utilizable; revisar el escaneo.' : null,
  };
  if (aggregated.length > 0) {
    materialUpdate.content_text = aggregated;
    materialUpdate.extraction_method = 'ocr';
  }
  // Si la actualizacion del material falla, NO se puede devolver completed_ocr:
  // se revierte el run a fallido y se reporta OCR_SAVE_FAILED (estado honesto).
  const { error: matUpdateErr } = await userClient
    .from('materials')
    .update(materialUpdate)
    .eq('id', request.material_id);
  if (matUpdateErr) {
    return await failRun(userClient, runId, request.material_id, material, {
      runStatus: 'failed',
      extractionStatus: 'ocr_failed',
      errorCode: OCR_ERROR.SAVE_FAILED,
      errorText: 'No se pudo guardar el OCR.',
    });
  }

  return json({
    material_id: request.material_id,
    extraction_status: outcome.extraction_status,
    run_id: runId,
    page_count: pageRows.length,
    processed_pages: processed,
    failed_pages: failed,
    average_confidence: avg,
    warnings: [...new Set(warnings)],
  });
});

// Marca run + material como fallidos de forma honesta (sin texto inventado) y
// devuelve la respuesta de error. Un fallo NO sobreescribe content_text.
async function failRun(
  client: ReturnType<typeof createClient>,
  runId: string,
  materialId: string,
  material: { content_text?: unknown },
  args: {
    runStatus: 'failed';
    extractionStatus: 'ocr_failed';
    errorCode: OcrErrorCode;
    errorText: string;
    /** Codigos de diagnostico seguros (p. ej. render): se guardan en errors. */
    diagCodes?: string[];
  },
): Promise<Response> {
  const ts = new Date().toISOString();
  const errors = args.diagCodes && args.diagCodes.length > 0 ? args.diagCodes : [args.errorText];
  // El codigo de diagnostico se incluye tambien en extraction_error del material
  // (seguro: es una etiqueta estable, sin contenido del PDF).
  const extractionError =
    args.diagCodes && args.diagCodes.length > 0
      ? `${args.errorText} (${args.diagCodes[0]})`
      : args.errorText;
  await client
    .from('material_ocr_runs')
    .update({ status: args.runStatus, errors, updated_at: ts })
    .eq('id', runId);
  await client
    .from('materials')
    .update({
      extraction_status: args.extractionStatus,
      status: 'needs_review',
      ocr_status: args.runStatus,
      extraction_error: extractionError,
    })
    .eq('id', materialId);
  return fail(args.errorCode, 502, args.errorText);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
