// TESTOPO - Edge Function: ocr-material (SPEC 034). FLUJO REAL server-side.
//
// Frontera de servidor de CONFIANZA para el OCR de PDFs ESCANEADOS. El navegador
// solo manda IDs de scope y una opcion de reintento (NUNCA imagenes, texto OCR,
// prompts ni `user_id`). Esta funcion: (1) autentica el JWT, (2) valida el body,
// (3) comprueba EXPLICITAMENTE el permiso de gestion (rol owner/admin activo) +
// scope + elegibilidad del material (no solo RLS), (4) descarga el PDF privado en
// el servidor, lo renderiza pagina a pagina (MuPDF WASM) y lee cada pagina con un
// modelo de vision usando la CLAVE como secreto de SERVIDOR, (5) persiste run +
// paginas + texto real y estados honestos, y (6) devuelve un resumen seguro.
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
  OCR_PER_PAGE_TIMEOUT_MS,
  MAX_OCR_PAGES,
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
  if (typeof material.page_count === 'number' && material.page_count > MAX_OCR_PAGES) {
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

  // 5) Reintento: run NUEVO aislado (no reutiliza/mezcla paginas previas).
  await userClient.from('material_ocr_pages').delete().eq('material_id', request.material_id);
  await userClient.from('material_ocr_runs').delete().eq('material_id', request.material_id);

  const startedAt = new Date().toISOString();
  const runId = uuid();
  await userClient.from('material_ocr_runs').insert({
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
  await userClient
    .from('materials')
    .update({ extraction_status: 'ocr_processing', ocr_status: 'processing' })
    .eq('id', request.material_id);

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

  // 5b) Render server-side (fail-closed si MuPDF no inicializa/rasteriza).
  let pages: { page_number: number; imageDataUrl: string }[];
  try {
    pages = await renderPdfToPages(bytes, { maxPages: MAX_OCR_PAGES });
  } catch (e) {
    const isPage = e instanceof PdfRenderError && e.kind === 'page';
    return await failRun(userClient, runId, request.material_id, material, {
      runStatus: 'failed',
      extractionStatus: 'ocr_failed',
      errorCode: isPage ? OCR_ERROR.PAGE_RENDER_FAILED : OCR_ERROR.RENDER_FAILED,
      errorText: 'No se pudo procesar el PDF del escaneo en el servidor.',
    });
  }

  // 5c) OCR real pagina a pagina, en orden. Timeout por pagina; sin inventar texto.
  const pageRows: { page_number: number; text: string; band: OcrPageBand }[] = [];
  const confidences: (number | null)[] = [];
  const warnings: string[] = [];
  let processed = 0;
  let failed = 0;

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
        OCR_PER_PAGE_TIMEOUT_MS,
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

    const band = ocrConfidenceBand(result.confidence);
    confidences.push(result.confidence);
    pageRows.push({ page_number: page.page_number, text: result.text, band });
    if (band === 'failed') failed += 1;
    else {
      processed += 1;
      for (const w of result.warnings) warnings.push(w);
    }

    await userClient.from('material_ocr_pages').insert({
      id: uuid(),
      workspace_id: request.workspace_id,
      opposition_id: request.opposition_id,
      material_id: request.material_id,
      ocr_run_id: runId,
      page_number: page.page_number,
      image_ref: null, // las imagenes temporales no se conservan ni se exponen.
      text: result.text,
      confidence: result.confidence,
      status: band,
      warnings: result.warnings,
      errors: band === 'failed' ? ['Confianza insuficiente o sin texto.'] : [],
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

  await userClient
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
  await userClient.from('materials').update(materialUpdate).eq('id', request.material_id);

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
  },
): Promise<Response> {
  const ts = new Date().toISOString();
  await client
    .from('material_ocr_runs')
    .update({ status: args.runStatus, errors: [args.errorText], updated_at: ts })
    .eq('id', runId);
  await client
    .from('materials')
    .update({
      extraction_status: args.extractionStatus,
      status: 'needs_review',
      ocr_status: args.runStatus,
      extraction_error: args.errorText,
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
