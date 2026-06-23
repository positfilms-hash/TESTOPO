// TESTOPO - Edge Function: generate-questions (SPEC 033). FLUJO REAL server-side.
//
// Frontera de servidor de CONFIANZA para la generacion de preguntas ANCLADA A
// FUENTES. El navegador solo manda IDs/parametros (nunca texto, fuente, prompt ni
// `user_id`). Esta funcion: (1) autentica el JWT y deriva el actor del token,
// (2) valida el body de forma estricta, (3) comprueba EXPLICITAMENTE el permiso de
// gestion (rol owner/admin activo) + scope + tema aplicado (no solo RLS),
// (4) recupera la evidencia concreta desde Supabase, (5) llama a OpenAI con la
// CLAVE como secreto de SERVIDOR, (6) valida la salida y persiste candidatas
// trazables (pending_review/needs_fix, NUNCA validated), y (7) devuelve un resumen.
//
// La clave (OPENAI_API_KEY) NUNCA llega al navegador/Vite. Sin proveedor real
// configurado, responde 501 y NO persiste nada. La logica determinista vive en
// `_shared/question-generation/contract.ts` (testeada en vitest); aqui solo hay
// orquestacion + el adaptador de red a OpenAI y las consultas a Supabase, que solo
// se pueden verificar en staging con secretos reales.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { evaluateManagementAccess } from '../_shared/authz/management.ts';
import {
  QG_ERROR,
  PROVIDER_NOT_CONFIGURED_MESSAGE,
  MAX_QUESTION_SOURCE_REFERENCES,
  resolveQuestionLimits,
  validateGenerateRequest,
  resolveProvider,
  evaluateTopicSourceReference,
  isEligiblePrimarySection,
  isSecondaryStyleSection,
  buildOpenAIRequest,
  parseProviderCandidates,
  validateCandidate,
  candidateStatus,
  mapRunStatus,
  buildQuestionRow,
  buildOptionRows,
  buildValidationRow,
  type EvidenceScope,
  type PromptSource,
  type QgErrorCode,
  type ValidatedCandidate,
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
function uuid(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(QG_ERROR.INVALID_REQUEST, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'QUESTION_GENERATION_SERVER_NOT_CONFIGURED' }, 500);
  }

  // 1) Auth: el actor sale del JWT verificado. Las lecturas/escrituras van con su
  //    cliente (RLS) como backstop, pero ademas comprobamos el rol explicitamente.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(QG_ERROR.AUTH_REQUIRED, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return fail(QG_ERROR.AUTH_REQUIRED, 401);
  const actorId = userData.user.id;

  // 2) Body: whitelist estricta (rechaza user_id/source_text/prompt/etc.).
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(QG_ERROR.INVALID_REQUEST, 400);
  }
  const parsed = validateGenerateRequest(raw);
  if (!parsed.ok) {
    return fail(parsed.code, parsed.code === QG_ERROR.ARBITRARY_TEXT_FORBIDDEN ? 422 : 400);
  }
  const request = parsed.value;

  // 3) GUARDA EXPLICITA de gestion (no solo RLS): perfil no eliminado + membership
  //    activa owner/admin en el workspace. Student/eliminado/revocado fallan AQUI,
  //    antes del proveedor o de cualquier escritura.
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
      ? fail(QG_ERROR.AUTH_REQUIRED, 401)
      : fail(QG_ERROR.ACCESS_DENIED, 403);
  }

  // 3b) Scope: oposicion del workspace; tema activo y aplicado (existe en topics).
  const { data: opposition } = await userClient
    .from('oppositions')
    .select('id, workspace_id')
    .eq('id', request.opposition_id)
    .maybeSingle();
  if (!opposition || opposition.workspace_id !== request.workspace_id) {
    return fail(QG_ERROR.ACCESS_DENIED, 403);
  }
  const { data: topic } = await userClient
    .from('topics')
    .select('id, opposition_id, status, title')
    .eq('id', request.topic_id)
    .maybeSingle();
  if (!topic || topic.opposition_id !== request.opposition_id) {
    return fail(QG_ERROR.TOPIC_NOT_FOUND, 404);
  }
  // Un tema en `topics` ES un tema del Topic Map aplicado; debe estar activo.
  if (topic.status !== 'active') {
    return fail(QG_ERROR.TOPIC_NOT_APPLIED, 409);
  }

  // 4) RECUPERACION de evidencia (RLS). Orden: topic_source_references del tema ->
  //    secciones elegibles enlazadas. Solo evidencia PRIMARIA factual y del scope.
  const warnings: string[] = [];
  const promptSources: PromptSource[] = [];
  const materialIds = new Set<string>();
  const sectionIds = new Set<string>();
  const referenceIds = new Set<string>();
  const topicRefIds = new Set<string>();
  // SPEC 035: limites efectivos por secreto de Edge Function (clamp al maximo
  // seguro). El navegador no los controla.
  const limits = resolveQuestionLimits({
    MAX_GENERATED_QUESTIONS: Deno.env.get('MAX_GENERATED_QUESTIONS'),
    MAX_QUESTION_SOURCE_CHARS: Deno.env.get('MAX_QUESTION_SOURCE_CHARS'),
  });
  const questionCount = Math.min(request.question_count, limits.maxQuestions);
  let charBudget = limits.maxSourceChars;
  let secondaryStyleCount = 0;

  const pushSource = (s: PromptSource): boolean => {
    if (promptSources.length >= MAX_QUESTION_SOURCE_REFERENCES) return false;
    const excerpt = (s.excerpt ?? '').slice(0, Math.max(0, charBudget)).trim();
    if (!excerpt) return false;
    charBudget -= excerpt.length;
    promptSources.push({ ...s, excerpt });
    materialIds.add(s.material_id);
    if (s.material_section_id) sectionIds.add(s.material_section_id);
    if (s.source_reference_id) referenceIds.add(s.source_reference_id);
    if (s.topic_source_reference_id) topicRefIds.add(s.topic_source_reference_id);
    return true;
  };

  // (a) topic_source_references: fuente concreta del tema aplicado (028-D / 030).
  //     NO se añade directamente al prompt: para CADA referencia el servidor
  //     resuelve y valida el material (mismo workspace/oposicion, activo, no
  //     obsoleto, legible), su clasificacion EFECTIVA (document_classifications mas
  //     reciente, debe ser primaria factual y no needs_review) y el puntero
  //     concreto (seccion/referencia existente y del scope). Solo entonces se ancla.
  const { data: tsr } = await userClient
    .from('topic_source_references')
    .select('id, material_id, material_section_id, source_reference_id, excerpt, opposition_id')
    .eq('topic_id', request.topic_id);
  const tsrRows = tsr ?? [];
  if (tsrRows.length > 0) {
    const refMaterialIds = [...new Set(tsrRows.map((r) => r.material_id).filter(Boolean))];
    const refSectionIds = [...new Set(tsrRows.map((r) => r.material_section_id).filter(Boolean))];
    const refReferenceIds = [...new Set(tsrRows.map((r) => r.source_reference_id).filter(Boolean))];

    const { data: refMaterials } = await userClient
      .from('materials')
      .select('id, workspace_id, opposition_id, status, extraction_status')
      .in('id', refMaterialIds.length ? refMaterialIds : ['']);
    const materialById = new Map((refMaterials ?? []).map((m) => [m.id, m]));

    // Clasificacion EFECTIVA = la mas reciente por material (document_classifications).
    const { data: classRows } = await userClient
      .from('document_classifications')
      .select('material_id, classification, needs_review, created_at')
      .in('material_id', refMaterialIds.length ? refMaterialIds : [''])
      .order('created_at', { ascending: false });
    const classByMaterial = new Map<string, { classification: string; needs_review: boolean }>();
    for (const c of classRows ?? []) {
      if (!classByMaterial.has(c.material_id)) {
        classByMaterial.set(c.material_id, {
          classification: c.classification,
          needs_review: c.needs_review === true,
        });
      }
    }

    const { data: refSections } = await userClient
      .from('material_sections')
      .select('id, material_id, status, opposition_id')
      .in('id', refSectionIds.length ? refSectionIds : ['']);
    const sectionById = new Map((refSections ?? []).map((s) => [s.id, s]));

    const { data: refReferences } = await userClient
      .from('source_references')
      .select('id, material_id, opposition_id')
      .in('id', refReferenceIds.length ? refReferenceIds : ['']);
    const referenceById = new Map((refReferences ?? []).map((s) => [s.id, s]));

    for (const r of tsrRows) {
      // Puntero concreto VALIDO: seccion activa del mismo material, o referencia
      // del mismo material/scope. Sin puntero resuelto no se ancla.
      let hasValidConcretePointer = false;
      if (r.material_section_id) {
        const sec = sectionById.get(r.material_section_id);
        hasValidConcretePointer =
          !!sec &&
          sec.status === 'active' &&
          sec.material_id === r.material_id &&
          (!sec.opposition_id || sec.opposition_id === request.opposition_id);
      }
      if (!hasValidConcretePointer && r.source_reference_id) {
        const ref = referenceById.get(r.source_reference_id);
        hasValidConcretePointer =
          !!ref &&
          ref.material_id === r.material_id &&
          (!ref.opposition_id || ref.opposition_id === request.opposition_id);
      }

      const eligibility = evaluateTopicSourceReference({
        requestWorkspaceId: request.workspace_id,
        requestOppositionId: request.opposition_id,
        refOppositionId: r.opposition_id,
        material: materialById.get(r.material_id),
        classification: classByMaterial.get(r.material_id),
        hasValidConcretePointer,
      });
      if (!eligibility.ok) continue;

      pushSource({
        material_id: r.material_id,
        material_section_id: r.material_section_id ?? null,
        source_reference_id: r.source_reference_id ?? null,
        topic_source_reference_id: r.id,
        excerpt: r.excerpt ?? '',
      });
    }
  }

  // (b) Secciones elegibles de los materiales enlazados al tema (fallback).
  if (promptSources.length === 0) {
    const { data: links } = await userClient
      .from('material_topic_links')
      .select('material_id')
      .eq('topic_id', request.topic_id);
    const linkedMaterialIds = [...new Set((links ?? []).map((l) => l.material_id))];
    if (linkedMaterialIds.length > 0) {
      const { data: sections } = await userClient
        .from('material_sections')
        .select('id, material_id, classification, status, content_text, content_excerpt, opposition_id')
        .in('material_id', linkedMaterialIds)
        .order('order_index', { ascending: true });
      for (const sec of sections ?? []) {
        if (sec.opposition_id && sec.opposition_id !== request.opposition_id) continue;
        if (isSecondaryStyleSection(sec.classification)) {
          secondaryStyleCount += 1;
          continue;
        }
        if (!isEligiblePrimarySection({ classification: sec.classification, status: sec.status })) {
          continue;
        }
        pushSource({
          material_id: sec.material_id,
          material_section_id: sec.id,
          source_reference_id: null,
          excerpt: (sec.content_text || sec.content_excerpt) ?? '',
        });
      }
    }
  }

  if (promptSources.length === 0) {
    // Sin evidencia primaria elegible: 0 escrituras (SPEC 033).
    return fail(QG_ERROR.NO_SOURCES, 422);
  }
  if (charBudget <= 0) {
    warnings.push('Se ha limitado el texto de fuente analizado por exceder el maximo.');
  }
  const styleNote =
    secondaryStyleCount > 0
      ? `Estilo/cobertura de referencia: ${secondaryStyleCount} fragmento(s) de test antiguo.`
      : null;

  // 5) Proveedor: la CLAVE es secreto de SERVIDOR. Sin proveedor real -> 501 honesto.
  const provider = resolveProvider({
    AI_PROVIDER: Deno.env.get('AI_PROVIDER'),
    OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
    OPENAI_MODEL: Deno.env.get('OPENAI_MODEL'),
  });
  if (!provider) {
    return fail(QG_ERROR.PROVIDER_NOT_CONFIGURED, 501, PROVIDER_NOT_CONFIGURED_MESSAGE);
  }

  // 6) Llamada real a OpenAI (salida estructurada). Solo IDs/excerpts del servidor.
  let content: string | null = null;
  try {
    const body = buildOpenAIRequest({
      model: provider.model,
      topic_title: topic.title,
      difficulty: request.difficulty,
      question_count: questionCount,
      sources: promptSources,
      style_note: styleNote,
    });
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return fail(QG_ERROR.PROVIDER_FAILED, 502);
    }
    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = data.choices?.[0]?.message?.content ?? null;
  } catch {
    return fail(QG_ERROR.PROVIDER_FAILED, 502);
  }

  const parseRes = parseProviderCandidates(content);
  if (!parseRes.ok) {
    return fail(parseRes.code, 422);
  }

  // 7) Validacion de salida + persistencia trazable (RLS exige can_manage).
  const evidenceText = promptSources.map((s) => s.excerpt).join('\n\n');
  const scope: EvidenceScope = {
    topic_id: request.topic_id,
    material_ids: materialIds,
    material_section_ids: sectionIds,
    source_reference_ids: referenceIds,
    topic_source_reference_ids: topicRefIds,
    evidence_text: evidenceText,
  };

  const now = new Date().toISOString();
  const runId = uuid(); // pre-generado para que cada pregunta lo referencie ya.
  let created = 0;
  let hadErrors = false;
  const usedSectionIds = new Set<string>();
  const usedReferenceIds = new Set<string>();

  for (const candidate of parseRes.candidates) {
    if (created >= questionCount) break;
    const v = validateCandidate(candidate, scope);
    if (!v.ok) {
      hadErrors = true;
      continue;
    }
    const validated: ValidatedCandidate = v.value;
    const status = candidateStatus({ hasCriticalFinding: false, warnings: v.warnings });
    const questionId = uuid();
    try {
      const qRow = buildQuestionRow({
        id: questionId,
        workspace_id: request.workspace_id,
        opposition_id: request.opposition_id,
        topic_id: request.topic_id,
        topic_title: topic.title,
        candidate: validated,
        status,
        run_id: runId,
        provider: provider.provider,
        model: provider.model,
        now,
      });
      const { error: qErr } = await userClient.from('questions').insert(qRow);
      if (qErr) {
        hadErrors = true;
        continue;
      }
      const optRows = buildOptionRows({
        question_id: questionId,
        workspace_id: request.workspace_id,
        opposition_id: request.opposition_id,
        candidate: validated,
      });
      await userClient.from('question_options').insert(optRows);
      const valRow = buildValidationRow({
        question_id: questionId,
        workspace_id: request.workspace_id,
        opposition_id: request.opposition_id,
        status,
        warnings: v.warnings,
      });
      await userClient.from('question_validation_results').insert(valRow);
      created += 1;
      if (validated.material_section_id) usedSectionIds.add(validated.material_section_id);
      if (validated.source_reference_id) usedReferenceIds.add(validated.source_reference_id);
      for (const w of v.warnings) warnings.push(w);
    } catch {
      hadErrors = true;
    }
  }

  if (created === 0) {
    // Salida sin candidatas validas: registra un run fallido y no inventa nada.
    await userClient.from('question_generation_runs').insert({
      id: runId,
      workspace_id: request.workspace_id,
      opposition_id: request.opposition_id,
      topic_id: request.topic_id,
      mode: 'server_grounded',
      requested_count: questionCount,
      created_count: 0,
      status: 'failed',
      errors: [],
      provider: provider.provider,
      model: provider.model,
      source_strategy: 'topic_sources',
      source_reference_ids: [...referenceIds],
      material_section_ids: [...sectionIds],
    });
    return fail(QG_ERROR.NO_VALID_CANDIDATES, 422);
  }

  const runStatus = mapRunStatus({
    created,
    requested: questionCount,
    hadErrors,
  });
  await userClient.from('question_generation_runs').insert({
    id: runId,
    workspace_id: request.workspace_id,
    opposition_id: request.opposition_id,
    topic_id: request.topic_id,
    mode: 'server_grounded',
    requested_count: questionCount,
    created_count: created,
    status: runStatus,
    errors: [],
    provider: provider.provider,
    model: provider.model,
    source_strategy: 'topic_sources',
    source_reference_ids: [...usedReferenceIds],
    material_section_ids: [...usedSectionIds],
  });

  return json({
    run_id: runId,
    created,
    requested: questionCount,
    warnings: [...new Set(warnings)],
  });
});
