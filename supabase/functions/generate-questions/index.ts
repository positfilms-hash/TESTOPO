// TESTOPO - Edge Function: generate-questions (SPEC 033). SCAFFOLD HONESTO.
//
// Frontera de servidor de CONFIANZA para la generacion de preguntas ANCLADA A
// FUENTES. El navegador solo manda IDs y parametros acotados (nunca texto,
// fuente, prompt ni `user_id`); esta funcion es quien:
//   1. autentica el JWT y deriva el actor SOLO del token (no del body),
//   2. valida el body de forma estricta (whitelist; rechaza texto arbitrario),
//   3. valida el scope (workspace/oposicion/tema aplicado) bajo RLS,
//   4. (integracion real) recupera la evidencia concreta desde Supabase,
//      llama al proveedor con la CLAVE como secreto de SERVIDOR, valida la
//      salida y persiste candidatas trazables (pending_review / needs_fix),
//   5. devuelve un resumen seguro.
//
// La clave del proveedor (OPENAI_API_KEY) y la service_role NUNCA llegan al
// navegador/Vite. Sin proveedor real configurado, la funcion responde 501
// QUESTION_GENERATION_PROVIDER_NOT_CONFIGURED y NO persiste nada (ni run, ni
// pregunta, ni texto, ni mock) en Supabase/staging/produccion.
//
// Estado ACTUAL = scaffold (mismo enfoque que `ocr-material`): implementa auth +
// validacion de body + coherencia de scope y deja marcado el PUNTO EXACTO donde
// se cablea recuperacion + proveedor real + persistencia. La logica canonica de
// validacion vive en `_shared/question-generation/contract.ts` (testeada en
// vitest). Despliegue y secretos: docs/security/ai-provider-secrets.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  QG_ERROR,
  PROVIDER_NOT_CONFIGURED_MESSAGE,
  validateGenerateRequest,
  type QgErrorCode,
} from '../_shared/question-generation/contract.ts';

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

function fail(code: QgErrorCode, status: number, message?: string): Response {
  return json(message ? { error: code, message } : { error: code }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return fail(QG_ERROR.INVALID_REQUEST, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'QUESTION_GENERATION_SERVER_NOT_CONFIGURED' }, 500);
  }

  // 1) Autenticacion: el actor sale del JWT verificado, jamas del body. Con
  //    verify_jwt activado Supabase ya exige Authorization; revalidamos para
  //    obtener el usuario y para que las lecturas/escrituras vayan bajo su RLS.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return fail(QG_ERROR.AUTH_REQUIRED, 401);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return fail(QG_ERROR.AUTH_REQUIRED, 401);
  }

  // 2) Body: whitelist estricta de IDs/parametros. Rechaza `user_id`,
  //    `source_text`, `raw_text`, `custom_prompt`, campos desconocidos, etc.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(QG_ERROR.INVALID_REQUEST, 400);
  }
  const parsed = validateGenerateRequest(raw);
  if (!parsed.ok) {
    const status = parsed.code === QG_ERROR.ARBITRARY_TEXT_FORBIDDEN ? 422 : 400;
    return fail(parsed.code, status);
  }
  const request = parsed.value;

  // 3) Coherencia de scope bajo RLS (el actor solo ve lo suyo). La AUTORIZACION
  //    autoritativa de escritura la garantiza ademas la RLS de `questions`
  //    (policy questions_manage: can_manage_workspace) en el paso 4.
  //    - el tema existe, pertenece a la oposicion y no esta obsoleto;
  //    - la oposicion pertenece al workspace declarado.
  const { data: topic, error: topicErr } = await userClient
    .from('topics')
    .select('id, opposition_id, status')
    .eq('id', request.topic_id)
    .maybeSingle();
  if (topicErr) {
    return fail(QG_ERROR.ACCESS_DENIED, 403);
  }
  if (!topic || topic.opposition_id !== request.opposition_id) {
    return fail(QG_ERROR.TOPIC_NOT_FOUND, 404);
  }
  if (topic.status === 'obsolete') {
    return fail(QG_ERROR.TOPIC_NOT_APPLIED, 409);
  }
  const { data: opposition, error: oppErr } = await userClient
    .from('oppositions')
    .select('id, workspace_id')
    .eq('id', request.opposition_id)
    .maybeSingle();
  if (oppErr || !opposition) {
    return fail(QG_ERROR.ACCESS_DENIED, 403);
  }
  if (opposition.workspace_id !== request.workspace_id) {
    return fail(QG_ERROR.SOURCE_WORKSPACE_MISMATCH, 409);
  }

  // 4) Proveedor de IA: la CLAVE es un secreto de SERVIDOR. Sin proveedor real
  //    configurado, NO se genera nada: respuesta honesta 501 y CERO escrituras.
  const aiProvider = (Deno.env.get('AI_PROVIDER') ?? '').toLowerCase();
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const providerReady =
    (aiProvider === 'openai' || aiProvider === 'anthropic') && !!openAiKey;
  if (!providerReady) {
    return fail(
      QG_ERROR.PROVIDER_NOT_CONFIGURED,
      501,
      PROVIDER_NOT_CONFIGURED_MESSAGE,
    );
  }

  // 5) === PUNTO DE INTEGRACION DEL PROVEEDOR REAL + PERSISTENCIA ===
  //    Aqui (solo con proveedor configurado) se cablea, en este orden:
  //
  //      a) Recuperacion de evidencia concreta desde Supabase (RLS): orden
  //         topic_source_references -> source_references/material_sections ->
  //         secciones del material del tema -> match de titulo. Solo material
  //         activo, misma oposicion/workspace, clasificacion elegible
  //         (isEligiblePrimaryClass). old_exam_or_test = estilo secundario.
  //         Acotar a MAX_QUESTION_SOURCE_REFERENCES / MAX_QUESTION_SOURCE_CHARS.
  //         Sin evidencia primaria -> fail(QG_ERROR.NO_SOURCES, 422), 0 escrituras.
  //
  //      b) Construir EvidenceScope (material_ids/section_ids/reference_ids +
  //         evidence_text) y llamar al proveedor con el prompt de
  //         prompts/server-side-source-grounded-question-generator.md, usando
  //         OPENAI_MODEL. La clave NUNCA sale de aqui.
  //
  //      c) validateCandidate(candidate, scope) por cada salida; descartar las
  //         invalidas (estructura, >1 correcta, dificultad, fuente ajena,
  //         `validated`). Sin candidatas validas -> NO_VALID_CANDIDATES.
  //
  //      d) Persistir con el cliente del usuario (RLS exige can_manage):
  //         question_generation_runs (mapRunStatus) + questions
  //         (generated_by_ai=true, generation_run_id, topic/material/excerpt y
  //         punteros) + question_options + question_validation_results.
  //         Estado de cada candidata: candidateStatus() -> pending_review |
  //         needs_fix. NUNCA validated.
  //
  //      e) Devolver resumen seguro: { run_id, created, requested, warnings }.
  //         Sin prompts, sin excerpts completos, sin errores del proveedor.
  //
  //    Mientras no se cablee, el scaffold no debe simular nada:
  return fail(
    QG_ERROR.PROVIDER_NOT_CONFIGURED,
    501,
    PROVIDER_NOT_CONFIGURED_MESSAGE,
  );
});
