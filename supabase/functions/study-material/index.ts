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
  MAX_STUDY_MATERIALS,
  MAX_STUDY_SOURCE_CHARS,
  MAX_STUDY_UNITS_PER_MATERIAL,
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

  // 4) Materiales ELEGIBLES del scope + su clasificacion efectiva.
  const { data: materials } = await userClient
    .from('materials')
    .select('id, workspace_id, opposition_id, status, extraction_status')
    .eq('opposition_id', request.opposition_id)
    .limit(MAX_STUDY_MATERIALS);
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

  // 5) Proveedor: sin proveedor real -> 501 honesto, CERO escrituras.
  const provider = resolveStudyProvider({
    STUDY_PROVIDER: Deno.env.get('STUDY_PROVIDER'),
    OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
    STUDY_MODEL: Deno.env.get('STUDY_MODEL'),
  });
  if (!provider) {
    return fail(STUDY_ERROR.PROVIDER_NOT_CONFIGURED, 501, STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE);
  }

  // 6) Run + estudio por material (evidencia -> proveedor -> unidades -> persistir).
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
    material_count: eligible.length,
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

  for (const material of eligible) {
    // Evidencia: secciones del material (puntero concreto + texto).
    const { data: sections } = await userClient
      .from('material_sections')
      .select('id, material_id, status, content_text, content_excerpt')
      .eq('material_id', material.id)
      .eq('status', 'active')
      .order('order_index', { ascending: true });
    const secRows = (sections ?? []).filter((s) => s.material_id === material.id);
    if (secRows.length === 0) {
      warnings.push('Un material elegible no tiene secciones activas para estudiar.');
      continue;
    }
    let charBudget = MAX_STUDY_SOURCE_CHARS;
    const promptSections = secRows
      .map((s) => {
        const text = ((s.content_text || s.content_excerpt) ?? '').slice(0, Math.max(0, charBudget)).trim();
        charBudget -= text.length;
        return { id: s.id, text };
      })
      .filter((s) => s.text.length > 0);
    if (promptSections.length === 0) continue;

    const scope: StudyEvidenceScope = {
      material_ids: new Set([material.id]),
      material_section_ids: new Set(promptSections.map((s) => s.id)),
      source_reference_ids: new Set<string>(),
      evidence_text: promptSections.map((s) => s.text).join('\n\n'),
    };

    let content: string | null = null;
    try {
      const userContent = [
        `material_id=${material.id}`,
        `Maximo ${MAX_STUDY_UNITS_PER_MATERIAL} bloques. Cita siempre material_section_id de la lista.`,
        ...promptSections.map((s) => `SECCION [material_section_id=${s.id}]\n${s.text}`),
      ].join('\n\n');
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
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
      });
      if (!resp.ok) {
        hadErrors = true;
        continue;
      }
      const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
      content = data.choices?.[0]?.message?.content ?? null;
    } catch {
      hadErrors = true;
      continue;
    }

    const parseRes = parseProviderUnits(content);
    if (!parseRes.ok) {
      hadErrors = true;
      continue;
    }
    let materialUnits = 0;
    for (const u of parseRes.units) {
      if (materialUnits >= MAX_STUDY_UNITS_PER_MATERIAL) break;
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
        hadErrors = true;
        continue;
      }
      materialUnits += 1;
      unitsCreated += 1;
    }

    const hadOcrWarnings = materialHasOcrWarnings(material.extraction_status);
    const matStatus = mapMaterialStudyStatus({ hasUsableUnits: materialUnits > 0, hadOcrWarnings });
    if (materialUnits > 0) studiedCount += 1;
    if (hadOcrWarnings) warnings.push('Un material leído por OCR con avisos se estudió igualmente.');
    await userClient.from('materials').update({ study_status: matStatus }).eq('id', material.id);
  }

  const runStatus = mapStudyRunStatus({
    unitsCreated,
    hadErrors,
    hadWarnings: warnings.length > 0,
  });
  await userClient.from('material_study_runs').update({
    status: runStatus,
    studied_count: studiedCount,
    unit_count: unitsCreated,
    warnings: [...new Set(warnings)],
    errors: [],
    updated_at: new Date().toISOString(),
  }).eq('id', runId);

  if (unitsCreated === 0) {
    return fail(STUDY_ERROR.NO_VALID_UNITS, 422);
  }
  return json({
    run_id: runId,
    materials: eligible.length,
    studied: studiedCount,
    units: unitsCreated,
    warnings: [...new Set(warnings)],
  });
});
