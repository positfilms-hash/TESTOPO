// TESTOPO - Edge Function: study-material (SPEC 038). FLUJO REAL server-side.
//
// Estudio INTERNO del material (sin indice publico ni Topics ni topic_id). El
// navegador solo manda scope + opciones (nunca texto/prompt/imagen/clave/user_id).
// Esta funcion: (1) autentica el JWT y deriva el actor del token, (2) valida el
// body, (3) comprueba EXPLICITAMENTE el permiso de gestion + scope + elegibilidad
// de cada material (legible, clasificacion sin needs_review), (4) recupera la
// evidencia (secciones/referencias) desde Supabase, (5) llama a OpenAI con la CLAVE
// como secreto de SERVIDOR, valida unidades ANCLADAS A FUENTE y persiste run +
// units; (6) marca el material studied/with_warnings/failed honestamente.
//
// NO crea preguntas ni nada `validated`. Sin proveedor real -> 501 honesto, sin
// run/unit/concepto/estado mock. Logica determinista en
// `_shared/material-study/contract.ts` (testeada en vitest); aqui solo orquestacion
// + adaptadores (OpenAI/Supabase) que solo se verifican en staging con secretos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { evaluateManagementAccess } from '../_shared/authz/management.ts';
import {
  STUDY_ERROR,
  STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE,
  MAX_STUDY_UNITS_PER_MATERIAL,
  resolveStudyLimits,
  validateStudyRequest,
  isStudyEligibleMaterial,
  materialHasOcrWarnings,
  resolveStudyProvider,
  STUDY_SYSTEM_PROMPT,
  parseProviderUnits,
  validateStudyUnit,
  mapStudyRunStatus,
  mapMaterialStudyStatus,
  type StudyErrorCode,
  type StudyEvidenceScope,
} from '../_shared/material-study/contract.ts';

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
function fail(code: StudyErrorCode, status: number, message?: string): Response {
  return json(message ? { error: code, message } : { error: code }, status);
}
function uuid(): string {
  return crypto.randomUUID();
}
// Timeout por LLAMADA al proveedor (cota dura; SPEC 038 P0).
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(STUDY_ERROR.INVALID_REQUEST, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return json({ error: 'MATERIAL_STUDY_SERVER_NOT_CONFIGURED' }, 500);

  // 1) Auth.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(STUDY_ERROR.AUTH_REQUIRED, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return fail(STUDY_ERROR.AUTH_REQUIRED, 401);
  const actorId = userData.user.id;

  // 2) Body (whitelist; rechaza texto/prompt/imagen/clave/user_id).
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(STUDY_ERROR.INVALID_REQUEST, 400);
  }
  const parsed = validateStudyRequest(raw);
  if (!parsed.ok) {
    return fail(parsed.code, parsed.code === STUDY_ERROR.ARBITRARY_INPUT_FORBIDDEN ? 422 : 400);
  }
  const request = parsed.value;

  // 3) Guarda EXPLICITA de gestion (no solo RLS).
  const { data: profile } = await userClient
    .from('profiles').select('id, status').eq('id', actorId).maybeSingle();
  const { data: membership } = await userClient
    .from('workspace_members').select('role, status')
    .eq('workspace_id', request.workspace_id).eq('user_id', actorId).maybeSingle();
  const access = evaluateManagementAccess({ profile, membership });
  if (!access.ok) {
    return access.reason === 'auth_required'
      ? fail(STUDY_ERROR.AUTH_REQUIRED, 401)
      : fail(STUDY_ERROR.ACCESS_DENIED, 403);
  }
  const { data: opposition } = await userClient
    .from('oppositions').select('id, workspace_id').eq('id', request.opposition_id).maybeSingle();
  if (!opposition || opposition.workspace_id !== request.workspace_id) {
    return fail(STUDY_ERROR.ACCESS_DENIED, 403);
  }

  // Presupuesto GLOBAL por run (no por material). Solo puede endurecerse por secreto.
  const limits = resolveStudyLimits({
    STUDY_MAX_MATERIALS: Deno.env.get('STUDY_MAX_MATERIALS'),
    STUDY_MAX_TOTAL_CHARS: Deno.env.get('STUDY_MAX_TOTAL_CHARS'),
    STUDY_MAX_TOTAL_UNITS: Deno.env.get('STUDY_MAX_TOTAL_UNITS'),
    STUDY_PER_CALL_TIMEOUT_SECONDS: Deno.env.get('STUDY_PER_CALL_TIMEOUT_SECONDS'),
  });

  // 4) Materiales ELEGIBLES del scope + su clasificacion efectiva.
  const { data: materials } = await userClient
    .from('materials')
    .select('id, workspace_id, opposition_id, status, extraction_status, study_status')
    .eq('opposition_id', request.opposition_id)
    .limit(limits.maxMaterials);
  const matRows = materials ?? [];
  const matIds = matRows.map((m) => m.id);
  const { data: classRows } = await userClient
    .from('document_classifications')
    .select('material_id, classification, needs_review, created_at')
    .in('material_id', matIds.length ? matIds : [''])
    .order('created_at', { ascending: false });
  const classByMaterial = new Map<string, { classification: string; needs_review: boolean }>();
  for (const c of classRows ?? []) {
    if (!classByMaterial.has(c.material_id)) {
      classByMaterial.set(c.material_id, { classification: c.classification, needs_review: c.needs_review === true });
    }
  }
  const eligible = matRows.filter((m) =>
    m.workspace_id === request.workspace_id &&
    isStudyEligibleMaterial({ material: m, classification: classByMaterial.get(m.id) }),
  );
  if (eligible.length === 0) {
    return fail(STUDY_ERROR.NO_ELIGIBLE_MATERIAL, 422);
  }
  // force_retry: sin reintento se SALTAN los ya estudiados; con reintento se
  // reestudian todos (siempre un run nuevo; nunca se borra historial).
  const ALREADY = new Set(['studied', 'studied_with_warnings']);
  const toStudy = request.force_retry
    ? eligible
    : eligible.filter((m) => !ALREADY.has((m.study_status as string) ?? ''));
  if (toStudy.length === 0) {
    return json({
      run_id: null,
      materials: eligible.length,
      studied: 0,
      units: 0,
      warnings: ['El material elegible ya estaba estudiado. Usa "Volver a estudiar" para rehacerlo.'],
    });
  }

  // 5) Proveedor: sin proveedor real -> 501 honesto, CERO escrituras.
  const provider = resolveStudyProvider({
    STUDY_PROVIDER: Deno.env.get('STUDY_PROVIDER'),
    OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
    STUDY_MODEL: Deno.env.get('STUDY_MODEL'),
  });
  if (!provider) {
    return fail(STUDY_ERROR.PROVIDER_NOT_CONFIGURED, 501, STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE);
  }

  // 6) Run + estudio. Presupuesto GLOBAL acumulativo (chars + unidades) por run.
  const startedAt = new Date().toISOString();
  const runId = uuid();
  const { error: runErr } = await userClient.from('material_study_runs').insert({
    id: runId,
    workspace_id: request.workspace_id,
    opposition_id: request.opposition_id,
    created_by: actorId,
    provider: provider.provider,
    model: provider.model,
    status: 'processing',
    material_count: toStudy.length,
    studied_count: 0,
    unit_count: 0,
    concept_count: 0,
    warnings: [],
    errors: [],
    created_at: startedAt,
    updated_at: startedAt,
  });
  if (runErr) return fail(STUDY_ERROR.SAVE_FAILED, 502);

  const warnings: string[] = [];
  let unitsCreated = 0;
  let studiedCount = 0;
  let hadErrors = false;
  let totalCharBudget = limits.totalSourceChars; // GLOBAL, no se reinicia por material
  let totalUnits = 0; // GLOBAL

  for (const material of toStudy) {
    if (totalCharBudget <= 0 || totalUnits >= limits.totalUnits) {
      warnings.push('Presupuesto de estudio agotado; algunos materiales no se procesaron.');
      break; // no se intentaron: no se marcan (no es fallo).
    }
    let materialUnits = 0;
    const hadOcrWarnings = materialHasOcrWarnings(material.extraction_status);

    const { data: sections } = await userClient
      .from('material_sections')
      .select('id, material_id, status, content_text, content_excerpt')
      .eq('material_id', material.id)
      .eq('status', 'active')
      .order('order_index', { ascending: true });
    const secRows = (sections ?? []).filter((s) => s.material_id === material.id);

    // Construye secciones consumiendo el presupuesto GLOBAL de caracteres.
    const promptSections: { id: string; text: string }[] = [];
    for (const s of secRows) {
      if (totalCharBudget <= 0) break;
      const text = ((s.content_text || s.content_excerpt) ?? '')
        .slice(0, Math.max(0, totalCharBudget))
        .trim();
      if (text.length === 0) continue;
      totalCharBudget -= text.length;
      promptSections.push({ id: s.id, text });
    }

    if (promptSections.length === 0) {
      warnings.push('Un material elegible no tiene secciones activas legibles para estudiar.');
    } else {
      const scope: StudyEvidenceScope = {
        material_ids: new Set([material.id]),
        section_texts: new Map(promptSections.map((s) => [s.id, s.text])),
        reference_texts: new Map<string, string>(),
      };
      let content: string | null = null;
      try {
        const userContent = [
          `material_id=${material.id}`,
          `Maximo ${MAX_STUDY_UNITS_PER_MATERIAL} bloques. Cita siempre material_section_id de la lista.`,
          ...promptSections.map((s) => `SECCION [material_section_id=${s.id}]\n${s.text}`),
        ].join('\n\n');
        const resp = await withTimeout(
          fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
            body: JSON.stringify({
              model: provider.model,
              temperature: 0.2,
              messages: [
                { role: 'system', content: STUDY_SYSTEM_PROMPT },
                { role: 'user', content: userContent },
              ],
              response_format: { type: 'json_object' },
            }),
          }),
          limits.perCallTimeoutMs,
        );
        if (resp.ok) {
          const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
          content = data.choices?.[0]?.message?.content ?? null;
        } else {
          hadErrors = true;
        }
      } catch {
        hadErrors = true; // fallo o timeout del proveedor
      }

      if (content !== null) {
        const parseRes = parseProviderUnits(content);
        if (!parseRes.ok) {
          hadErrors = true; // salida invalida
        } else {
          for (const u of parseRes.units) {
            if (materialUnits >= MAX_STUDY_UNITS_PER_MATERIAL || totalUnits >= limits.totalUnits) break;
            const v = validateStudyUnit(u, scope);
            if (!v.ok) {
              hadErrors = true;
              continue;
            }
            const { error: uErr } = await userClient.from('material_study_units').insert({
              id: uuid(),
              workspace_id: request.workspace_id,
              opposition_id: request.opposition_id,
              run_id: runId,
              material_id: v.value.material_id,
              material_section_id: v.value.material_section_id,
              source_reference_id: v.value.source_reference_id,
              title: v.value.title,
              summary: v.value.summary,
              excerpt: v.value.excerpt,
              importance: v.value.importance,
              confidence: v.value.confidence,
            });
            if (uErr) {
              hadErrors = true; // error de persistencia
              continue;
            }
            materialUnits += 1;
            unitsCreated += 1;
            totalUnits += 1;
          }
        }
      }
    }

    // HONESTO en TODOS los caminos (secciones vacias, fallo de proveedor, parse
    // invalido, error de persistencia): 0 unidades -> study_failed; con avisos OCR
    // y unidades -> studied_with_warnings; limpio -> studied.
    const matStatus = mapMaterialStudyStatus({ hasUsableUnits: materialUnits > 0, hadOcrWarnings });
    if (materialUnits > 0) {
      studiedCount += 1;
      if (hadOcrWarnings) warnings.push('Un material leído por OCR con avisos se estudió igualmente.');
    }
    await userClient.from('materials').update({ study_status: matStatus }).eq('id', material.id);
  }

  const runStatus = mapStudyRunStatus({
    unitsCreated,
    hadErrors,
    hadWarnings: warnings.length > 0,
  });
  const { error: finErr } = await userClient.from('material_study_runs').update({
    status: runStatus,
    studied_count: studiedCount,
    unit_count: unitsCreated,
    warnings: [...new Set(warnings)],
    errors: [],
    updated_at: new Date().toISOString(),
  }).eq('id', runId);
  if (finErr) return fail(STUDY_ERROR.SAVE_FAILED, 502);

  if (unitsCreated === 0) {
    return fail(STUDY_ERROR.NO_VALID_UNITS, 422);
  }
  return json({
    run_id: runId,
    materials: toStudy.length,
    studied: studiedCount,
    units: unitsCreated,
    warnings: [...new Set(warnings)],
  });
});
