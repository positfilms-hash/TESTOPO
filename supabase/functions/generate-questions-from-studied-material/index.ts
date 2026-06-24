// TESTOPO - Edge Function: generate-questions-from-studied-material (SPEC 039).
// FLUJO REAL server-side de generacion DIRECTA de preguntas desde MATERIAL
// ESTUDIADO (SPEC 038). Camino INDEPENDIENTE: no toca `generate-questions` ni el
// flujo por tema, ni exige `topic_id`.
//
// El navegador solo manda IDs/parametros de alcance (nunca texto, fuente, prompt,
// extracto, clave ni `user_id`). Esta funcion: (1) autentica el JWT y deriva el
// actor del token, (2) valida el body de forma estricta, (3) comprueba el permiso
// de gestion (rol owner/admin activo) + scope, (4) exige un ESTUDIO completado y
// resuelve la evidencia EXCLUSIVAMENTE desde unidades/conceptos estudiados y sus
// secciones/referencias, (5) llama a OpenAI con la CLAVE como secreto de SERVIDOR,
// (6) valida cada candidata anclada a su unidad y persiste preguntas trazables
// (pending_review/needs_fix, NUNCA validated), y (7) devuelve un resumen.
//
// La clave (OPENAI_API_KEY) NUNCA llega al navegador/Vite. Sin proveedor real
// configurado, responde 501 y NO persiste nada. La logica determinista vive en
// `_shared/direct-question-generation/contract.ts` (testeada en vitest); aqui solo
// hay orquestacion + el adaptador de red a OpenAI y las consultas a Supabase, que
// solo se pueden verificar en staging con secretos reales.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { evaluateManagementAccess } from '../_shared/authz/management.ts';
import {
  DQG_ERROR,
  DQG_PROVIDER_NOT_CONFIGURED_MESSAGE,
  resolveDirectLimits,
  validateDirectGenerateRequest,
  isStudyRunReady,
  isUsableStudiedMaterial,
  evaluateSelectionScope,
  resolveProvider,
  buildOpenAIRequest,
  parseProviderCandidates,
  validateDirectCandidate,
  candidateStatus,
  runDirectGeneration,
  buildQuestionRow,
  buildOptionRows,
  buildValidationRow,
  type DirectEvidenceScope,
  type AvailableEvidenceIds,
  type StudyUnitPointer,
  type PromptUnit,
  type DqgErrorCode,
  type DirectRunPort,
  type ValidatedDirectCandidate,
} from '../_shared/direct-question-generation/contract.ts';

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
function fail(code: DqgErrorCode, status: number, message?: string): Response {
  return json(message ? { error: code, message } : { error: code }, status);
}
function uuid(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(DQG_ERROR.INVALID_REQUEST, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'DIRECT_QG_SERVER_NOT_CONFIGURED' }, 500);
  }

  // 1) Auth: el actor sale del JWT verificado. Lecturas/escrituras van con su
  //    cliente (RLS) como backstop; ademas comprobamos el rol explicitamente.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail(DQG_ERROR.AUTH_REQUIRED, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return fail(DQG_ERROR.AUTH_REQUIRED, 401);
  const actorId = userData.user.id;

  // 2) Body: whitelist estricta (rechaza user_id/source_text/excerpt/prompt/etc.).
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(DQG_ERROR.INVALID_REQUEST, 400);
  }
  const parsed = validateDirectGenerateRequest(raw);
  if (!parsed.ok) {
    return fail(parsed.code, parsed.code === DQG_ERROR.ARBITRARY_INPUT_FORBIDDEN ? 422 : 400);
  }
  const request = parsed.value;

  // 3) GUARDA EXPLICITA de gestion (no solo RLS): perfil no eliminado + membership
  //    activa owner/admin. Student/eliminado/revocado fallan AQUI, antes de leer
  //    evidencia, llamar al proveedor o escribir nada.
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
      ? fail(DQG_ERROR.AUTH_REQUIRED, 401)
      : fail(DQG_ERROR.ACCESS_DENIED, 403);
  }

  // 3b) Scope: la oposicion pertenece al workspace.
  const { data: opposition } = await userClient
    .from('oppositions')
    .select('id, workspace_id')
    .eq('id', request.opposition_id)
    .maybeSingle();
  if (!opposition || opposition.workspace_id !== request.workspace_id) {
    return fail(DQG_ERROR.ACCESS_DENIED, 403);
  }

  // 4) ESTUDIO listo: el run indicado (o el mas reciente de la oposicion) debe estar
  //    completado / completado con avisos. Sin estudio -> bloqueo honesto.
  let studyRun: { id: string; status: string; opposition_id: string; workspace_id: string | null } | null = null;
  if (request.material_study_run_id) {
    const { data } = await userClient
      .from('material_study_runs')
      .select('id, status, opposition_id, workspace_id')
      .eq('id', request.material_study_run_id)
      .maybeSingle();
    studyRun = data ?? null;
    if (
      !studyRun ||
      studyRun.opposition_id !== request.opposition_id ||
      (studyRun.workspace_id && studyRun.workspace_id !== request.workspace_id)
    ) {
      return fail(DQG_ERROR.SELECTION_FORBIDDEN, 403);
    }
  } else {
    const { data } = await userClient
      .from('material_study_runs')
      .select('id, status, opposition_id, workspace_id')
      .eq('opposition_id', request.opposition_id)
      .order('created_at', { ascending: false })
      .limit(10);
    studyRun = (data ?? []).find((r) => isStudyRunReady(r.status)) ?? null;
  }
  if (!studyRun || !isStudyRunReady(studyRun.status)) {
    return fail(DQG_ERROR.STUDY_NOT_READY, 409);
  }
  const studyRunId = studyRun.id;

  // 5) RECUPERACION de evidencia (RLS): unidades estudiadas del run, acotadas por el
  //    alcance. Conceptos resuelven su unidad de respaldo. Solo material legible y
  //    del scope; nunca examenes antiguos como fuente factual.
  const limits = resolveDirectLimits({
    MAX_GENERATED_QUESTIONS: Deno.env.get('MAX_GENERATED_QUESTIONS'),
    MAX_QUESTION_SOURCE_CHARS: Deno.env.get('MAX_QUESTION_SOURCE_CHARS'),
    MAX_DIRECT_EVIDENCE_UNITS: Deno.env.get('MAX_DIRECT_EVIDENCE_UNITS'),
  });
  const questionCount = Math.min(request.question_count, limits.maxQuestions);

  const { data: allUnits } = await userClient
    .from('material_study_units')
    .select('id, workspace_id, opposition_id, run_id, material_id, material_section_id, source_reference_id, title, summary, excerpt')
    .eq('run_id', studyRunId);
  // Unidades del run acotadas a workspace + oposicion (verdad de la evidencia).
  const runUnits = (allUnits ?? []).filter(
    (u) =>
      u.opposition_id === request.opposition_id &&
      (!u.workspace_id || u.workspace_id === request.workspace_id),
  );

  // Conceptos del run (solo si el alcance es por conceptos) para validar y mapear.
  let runConcepts: { id: string; unit_id: string | null }[] = [];
  if (request.scope === 'selected_concepts') {
    const { data: concepts } = await userClient
      .from('material_study_concepts')
      .select('id, unit_id, workspace_id, opposition_id, run_id')
      .eq('run_id', studyRunId);
    runConcepts = (concepts ?? [])
      .filter(
        (c) =>
          c.opposition_id === request.opposition_id &&
          (!c.workspace_id || c.workspace_id === request.workspace_id),
      )
      .map((c) => ({ id: c.id, unit_id: c.unit_id ?? null }));
  }

  // SPEC 039 P1: la seleccion del cliente se valida ENTERA contra workspace +
  // oposicion + study run. Si UN SOLO id (material/unidad/concepto) no pertenece,
  // se rechaza TODA la peticion; nunca se descartan ids ajenos en silencio.
  const available: AvailableEvidenceIds = {
    materialIds: new Set(runUnits.map((u) => u.material_id).filter(Boolean)),
    unitIds: new Set(runUnits.map((u) => u.id)),
    conceptIds: new Set(runConcepts.map((c) => c.id)),
  };
  const selectionCheck = evaluateSelectionScope(request, available);
  if (!selectionCheck.ok) {
    return fail(selectionCheck.code, 403);
  }

  // Acota las unidades de evidencia segun el alcance YA validado.
  const conceptByUnit = new Map<string, string>();
  let units = runUnits;
  if (request.scope === 'selected_materials') {
    const wanted = new Set(request.material_ids);
    units = runUnits.filter((u) => wanted.has(u.material_id));
  } else if (request.scope === 'selected_units') {
    const wanted = new Set(request.material_study_unit_ids);
    units = runUnits.filter((u) => wanted.has(u.id));
  } else if (request.scope === 'selected_concepts') {
    const wanted = new Set(request.material_study_concept_ids);
    const unitIdsFromConcepts = new Set<string>();
    for (const c of runConcepts) {
      if (wanted.has(c.id) && c.unit_id) {
        unitIdsFromConcepts.add(c.unit_id);
        if (!conceptByUnit.has(c.unit_id)) conceptByUnit.set(c.unit_id, c.id);
      }
    }
    units = runUnits.filter((u) => unitIdsFromConcepts.has(u.id));
  }

  // Materiales del scope para comprobar legibilidad/no-obsoletos.
  const materialIds = [...new Set(units.map((u) => u.material_id).filter(Boolean))];
  const { data: materials } = await userClient
    .from('materials')
    .select('id, workspace_id, opposition_id, status, extraction_status')
    .in('id', materialIds.length ? materialIds : ['']);
  const materialById = new Map((materials ?? []).map((m) => [m.id, m]));

  // Construye la evidencia POR UNIDAD respetando el presupuesto GLOBAL de chars y
  // unidades. Cada unidad necesita texto (excerpt) y material legible del scope.
  const promptUnits: PromptUnit[] = [];
  const unitTexts = new Map<string, string>();
  const unitPointers = new Map<string, StudyUnitPointer>();
  const scopeMaterialIds = new Set<string>();
  const scopeUnitIds = new Set<string>();
  let charBudget = limits.maxSourceChars;

  for (const u of units) {
    if (promptUnits.length >= limits.maxUnits) break;
    if (charBudget <= 0) break;
    const material = materialById.get(u.material_id);
    if (!isUsableStudiedMaterial(material, { workspace_id: request.workspace_id, opposition_id: request.opposition_id })) {
      continue;
    }
    const text = ((u.excerpt || u.summary) ?? '').slice(0, Math.max(0, charBudget)).trim();
    if (!text) continue;
    charBudget -= text.length;
    const label = (typeof u.title === 'string' && u.title.trim()) || 'Material estudiado';
    promptUnits.push({ unit_id: u.id, material_id: u.material_id, topic_label: label, excerpt: text });
    unitTexts.set(u.id, text);
    unitPointers.set(u.id, {
      material_id: u.material_id,
      material_section_id: u.material_section_id ?? null,
      source_reference_id: u.source_reference_id ?? null,
      topic_label: label,
      concept_id: conceptByUnit.get(u.id) ?? null,
    });
    scopeMaterialIds.add(u.material_id);
    scopeUnitIds.add(u.id);
  }

  if (promptUnits.length === 0) {
    // Sin evidencia factual utilizable: 0 escrituras (SPEC 039).
    return fail(DQG_ERROR.NO_EVIDENCE, 422);
  }

  const warnings: string[] = [];
  if (charBudget <= 0) {
    warnings.push('Se ha limitado el texto de evidencia analizado por exceder el maximo.');
  }

  // 6) Proveedor: la CLAVE es secreto de SERVIDOR. Sin proveedor real -> 501 honesto.
  const provider = resolveProvider({
    AI_PROVIDER: Deno.env.get('AI_PROVIDER'),
    OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
    OPENAI_MODEL: Deno.env.get('OPENAI_MODEL'),
  });
  if (!provider) {
    return fail(DQG_ERROR.PROVIDER_NOT_CONFIGURED, 501, DQG_PROVIDER_NOT_CONFIGURED_MESSAGE);
  }

  // 7) Run + proveedor + validacion + persistencia via el ORQUESTADOR del ciclo de
  //    vida. El run se crea ANTES de cualquier candidata; proveedor/parsing/
  //    persistencia fallidos -> failed/partial coherente. Logica testeada en
  //    `runDirectGeneration`; aqui solo el adaptador de Supabase.
  const now = new Date().toISOString();
  const runId = uuid();
  const scope: DirectEvidenceScope = {
    material_ids: scopeMaterialIds,
    unit_ids: scopeUnitIds,
    unit_texts: unitTexts,
    unit_pointers: unitPointers,
  };
  const compensateQuestion = async (questionId: string): Promise<void> => {
    for (const op of [
      () => userClient.from('question_validation_results').delete().eq('question_id', questionId),
      () => userClient.from('question_options').delete().eq('question_id', questionId),
      () => userClient.from('questions').delete().eq('id', questionId),
    ]) {
      try {
        await op();
      } catch {
        // best-effort
      }
    }
  };

  const port: DirectRunPort = {
    async createRun() {
      const { error } = await userClient.from('question_generation_runs').insert({
        id: runId,
        workspace_id: request.workspace_id,
        opposition_id: request.opposition_id,
        topic_id: null,
        material_study_run_id: studyRunId,
        mode: 'studied_material',
        requested_count: questionCount,
        created_count: 0,
        status: 'failed', // placeholder honesto (CHECK 023: completed/partial/failed)
        errors: [],
        provider: provider.provider,
        model: provider.model,
        source_strategy: 'studied_material',
      });
      return !error;
    },
    async saveCandidate(candidate) {
      const status = candidateStatus({ warnings: candidate.warnings });
      const questionId = uuid();
      let questionInserted = false;
      try {
        const { error: qErr } = await userClient.from('questions').insert(
          buildQuestionRow({
            id: questionId,
            workspace_id: request.workspace_id,
            opposition_id: request.opposition_id,
            candidate,
            status,
            study_run_id: studyRunId,
            run_id: runId,
            provider: provider.provider,
            model: provider.model,
            now,
          }),
        );
        if (qErr) throw new Error('questions');
        questionInserted = true;

        const { error: optErr } = await userClient.from('question_options').insert(
          buildOptionRows({
            question_id: questionId,
            workspace_id: request.workspace_id,
            opposition_id: request.opposition_id,
            candidate,
          }),
        );
        if (optErr) throw new Error('question_options');

        const { error: valErr } = await userClient.from('question_validation_results').insert(
          buildValidationRow({
            question_id: questionId,
            workspace_id: request.workspace_id,
            opposition_id: request.opposition_id,
            status,
            warnings: candidate.warnings,
          }),
        );
        if (valErr) throw new Error('question_validation_results');

        for (const w of candidate.warnings) warnings.push(w);
        return true;
      } catch {
        if (questionInserted) await compensateQuestion(questionId);
        return false;
      }
    },
    async finalizeRun(status, createdCount, errs) {
      // La trazabilidad de la evidencia usada va en cada pregunta
      // (material_study_unit_id) y en el enlace run -> estudio
      // (material_study_run_id); no se sobrecarga ninguna columna ajena.
      const { error } = await userClient
        .from('question_generation_runs')
        .update({ status, created_count: createdCount, errors: errs })
        .eq('id', runId);
      return !error;
    },
  };

  const result = await runDirectGeneration({
    port,
    requested: questionCount,
    produce: async () => {
      let content: string | null = null;
      try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify(
            buildOpenAIRequest({
              model: provider.model,
              difficulty: request.difficulty,
              question_count: questionCount,
              units: promptUnits,
            }),
          ),
        });
        if (!resp.ok) return { ok: false, code: DQG_ERROR.PROVIDER_FAILED, candidates: [] };
        const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
        content = data.choices?.[0]?.message?.content ?? null;
      } catch {
        return { ok: false, code: DQG_ERROR.PROVIDER_FAILED, candidates: [] };
      }
      const parseRes = parseProviderCandidates(content);
      if (!parseRes.ok) return { ok: false, code: parseRes.code, candidates: [] };
      const validated: ValidatedDirectCandidate[] = [];
      for (const candidate of parseRes.candidates) {
        const v = validateDirectCandidate(candidate, scope);
        if (v.ok) validated.push(v.value);
      }
      return { ok: true, candidates: validated };
    },
  });

  if (!result.ok) {
    return fail(result.code as DqgErrorCode, result.httpStatus);
  }
  return json({
    run_id: runId,
    study_run_id: studyRunId,
    created: result.created,
    requested: questionCount,
    warnings: [...new Set(warnings)],
  });
});
