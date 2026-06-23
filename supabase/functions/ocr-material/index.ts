// TESTOPO - Edge Function: ocr-material (SPEC 034). SCAFFOLD HONESTO.
//
// Frontera de servidor de CONFIANZA para el OCR de PDFs ESCANEADOS. El navegador
// solo manda IDs de scope y una opcion de reintento (NUNCA imagenes, texto OCR,
// prompts ni `user_id`); esta funcion es quien:
//   1. autentica el JWT y deriva el actor SOLO del token (no del body),
//   2. valida el body de forma estricta (whitelist; rechaza imagen/texto/clave),
//   3. valida el scope (workspace/oposicion/material) y la elegibilidad del
//      material (PDF no obsoleto, estado OCR-elegible, reintento permitido) bajo
//      RLS antes de tocar Storage, llamar al proveedor o crear un run,
//   4. (integracion real) descarga el PDF privado en el servidor, renderiza y
//      lee pagina a pagina con el proveedor (clave = secreto de SERVIDOR), y
//      persiste run + paginas + texto real,
//   5. devuelve un resumen seguro.
//
// La clave del proveedor (p. ej. OPENAI_API_KEY) y la service_role NUNCA llegan al
// navegador/Vite. Sin proveedor real configurado, la funcion responde 501
// OCR_PROVIDER_NOT_CONFIGURED, PRESERVA el estado detectado (normalmente
// `scanned_detected`) y NO persiste nada (ni run, ni pagina, ni texto, ni mock) en
// Supabase/staging/produccion.
//
// Estado ACTUAL = scaffold (mismo enfoque que `generate-questions`): implementa
// auth + validacion de body + coherencia de scope/elegibilidad y deja marcado el
// PUNTO EXACTO donde se cablea render server-side + proveedor real + persistencia.
// La logica canonica vive en `_shared/ocr-material/contract.ts` (testeada en
// vitest). Despliegue y secretos: docs/security/ocr-provider-secrets.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  OCR_ERROR,
  OCR_PROVIDER_NOT_CONFIGURED_MESSAGE,
  isOcrProviderReady,
  isOcrRetryState,
  isOcrEligibleState,
  validateOcrRequest,
  type OcrErrorCode,
} from '../_shared/ocr-material/contract.ts';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return fail(OCR_ERROR.INVALID_REQUEST, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'OCR_SERVER_NOT_CONFIGURED' }, 500);
  }

  // 1) Autenticacion: el actor sale del JWT verificado, jamas del body. Con
  //    verify_jwt activado Supabase ya exige Authorization; revalidamos para
  //    obtener el usuario y para que las lecturas/escrituras vayan bajo su RLS.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return fail(OCR_ERROR.AUTH_REQUIRED, 401);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return fail(OCR_ERROR.AUTH_REQUIRED, 401);
  }

  // 2) Body: whitelist estricta de IDs/opciones. Rechaza `user_id`,
  //    `image_base64`, `image_url`, `ocr_text`, `fake_text`, `raw_text`,
  //    `provider_prompt`, `api_key`, campos desconocidos, etc.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(OCR_ERROR.INVALID_REQUEST, 400);
  }
  const parsed = validateOcrRequest(raw);
  if (!parsed.ok) {
    const status = parsed.code === OCR_ERROR.ARBITRARY_INPUT_FORBIDDEN ? 422 : 400;
    return fail(parsed.code, status);
  }
  const request = parsed.value;

  // 3) Coherencia de scope + elegibilidad bajo RLS (el actor solo ve lo suyo). La
  //    AUTORIZACION autoritativa de gestion la garantiza ademas la RLS de
  //    material_ocr_runs/pages (policy *_manage: can_manage_workspace) en el paso 4.
  //    - la oposicion pertenece al workspace declarado;
  //    - el material pertenece a esa oposicion y workspace exactos;
  //    - es un PDF no obsoleto en estado OCR-elegible;
  //    - un reintento solo procede desde un estado terminal revisable.
  const { data: opposition, error: oppErr } = await userClient
    .from('oppositions')
    .select('id, workspace_id')
    .eq('id', request.opposition_id)
    .maybeSingle();
  if (oppErr) {
    return fail(OCR_ERROR.ACCESS_DENIED, 403);
  }
  if (!opposition || opposition.workspace_id !== request.workspace_id) {
    return fail(OCR_ERROR.ACCESS_DENIED, 403);
  }

  const { data: material, error: matErr } = await userClient
    .from('materials')
    .select(
      'id, workspace_id, opposition_id, type, file_extension, storage_path, status, extraction_status, page_count',
    )
    .eq('id', request.material_id)
    .maybeSingle();
  if (matErr) {
    return fail(OCR_ERROR.ACCESS_DENIED, 403);
  }
  if (
    !material ||
    material.opposition_id !== request.opposition_id ||
    material.workspace_id !== request.workspace_id
  ) {
    return fail(OCR_ERROR.MATERIAL_NOT_FOUND, 404);
  }
  if (material.status === 'obsolete') {
    return fail(OCR_ERROR.MATERIAL_OBSOLETE, 409);
  }
  if (material.file_extension !== 'pdf' || !material.storage_path) {
    return fail(OCR_ERROR.MATERIAL_NOT_PDF, 409);
  }
  if (!isOcrEligibleState(material.extraction_status)) {
    return fail(OCR_ERROR.SCAN_NOT_DETECTED, 409);
  }
  // Un reintento (force_retry o estado ya terminal) solo desde estado revisable.
  const isRetry =
    request.force_retry || material.extraction_status !== 'scanned_detected';
  if (isRetry && !isOcrRetryState(material.extraction_status)) {
    return fail(OCR_ERROR.RETRY_NOT_ALLOWED, 409);
  }
  if (typeof material.page_count === 'number' && material.page_count > 300) {
    return fail(OCR_ERROR.PAGE_LIMIT_EXCEEDED, 413);
  }

  // 4) Proveedor OCR/vision: la CLAVE es un secreto de SERVIDOR. Sin proveedor
  //    real configurado, NO se lee Storage ni se persiste nada: respuesta honesta
  //    501 y se PRESERVA el estado detectado (cero escrituras / cero mock).
  const provider = Deno.env.get('OCR_PROVIDER');
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!isOcrProviderReady({ provider, apiKey })) {
    return fail(
      OCR_ERROR.PROVIDER_NOT_CONFIGURED,
      501,
      OCR_PROVIDER_NOT_CONFIGURED_MESSAGE,
    );
  }

  // 5) === PUNTO DE INTEGRACION DEL RENDER + PROVEEDOR REAL + PERSISTENCIA ===
  //    Aqui (solo con proveedor configurado) se cablea, en este orden:
  //
  //      a) Crear un cliente service-role SOLO de servidor (tras los checks de
  //         JWT/scope), descargar el PDF privado desde Storage por `storage_path`
  //         y verificar bytes. Fallo de descarga -> OCR_STORAGE_FAILED, 0 escrituras.
  //
  //      b) Renderizar el PDF pagina a pagina con un renderer compatible con Deno
  //         (Edge Functions). Si el render no inicializa o falla -> fail closed con
  //         OCR_RENDER_FAILED / OCR_PAGE_RENDER_FAILED. NUNCA renderizar en el
  //         navegador ni inventar texto. Acotar: <=300 paginas, <=3 paginas en
  //         paralelo, timeout 60s/pagina, <=10MB de imagen temporal por pagina
  //         (MAX_OCR_* del contrato). Imagenes temporales privadas y borradas tras
  //         procesar.
  //
  //      c) Crear material_ocr_runs (status 'processing') y mover el material a
  //         'ocr_processing'. Un reintento crea SIEMPRE un run nuevo (no reutiliza
  //         ni mezcla paginas de runs previos).
  //
  //      d) Por cada pagina REALMENTE procesada: llamar al proveedor (OCR_MODEL),
  //         clasificar con ocrConfidenceBand(), crear UN material_ocr_pages con
  //         texto/confianza/advertencias/errores reales. No representar paginas
  //         saltadas/fallidas como completadas.
  //
  //      e) Agregar el texto USABLE en orden con aggregateUsableText(); media con
  //         averageOcrConfidence(); estado terminal con mapOcrTerminalOutcome().
  //         Solo si hay texto usable se escribe materials.content_text
  //         (extraction_method='ocr'); un fallo total NO sobreescribe buen texto
  //         nativo. Logs: solo IDs/contadores/estado/codigos (nunca texto/clave/rutas).
  //
  //      f) Devolver resumen seguro: { material_id, extraction_status, run_id,
  //         page_count, processed_pages, failed_pages, average_confidence, warnings }.
  //
  //    Mientras no se cablee, el scaffold no debe simular nada:
  return fail(
    OCR_ERROR.PROVIDER_NOT_CONFIGURED,
    501,
    OCR_PROVIDER_NOT_CONFIGURED_MESSAGE,
  );
});
