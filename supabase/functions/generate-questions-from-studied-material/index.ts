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
  resolveMemoryLimits,
  selectErrorMemories,
  formatAvoidBlock,
  type ErrorMemoryRecord,
} from '../_shared/reliability/contract.ts';
import {
  EMPTY_USAGE,
  parseOpenAIUsage,
  resolvePrice,
  buildCostBreakdown,
  costPerQuestion,
  resolveCostLimits,
  estimateRunCostUsd,
  evaluateBudget,
  type AiUsage,
} from '../_shared/ai-cost/contract.ts';
import {
  DQG_ERROR,
  DQG_PROVIDER_NOT_CONFIGURED_MESSAGE,
  resolveDirectLimits,
  validateDirectGenerateRequest,
  isStudyRunReady,
  isUsableStudiedMaterial,
  evaluateSelectionScope,
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
import { DEFAULT_OPENAI_MODEL } from '../_shared/direct-question-generation/contract.ts';
// SPEC 041: capa comun de proveedor IA OpenAI-compatible (base URL configurable,
// timeout, fallback de formato y thinking de Qwen3). Sin configurar AI_* el
// comportamiento es identico al actual (fallback a OPENAI_*).
import { resolveAiProvider, AI_PROVIDER_ERROR, capSourceChars, resolveMaxSourceChars } from '../_shared/ai-provider/contract.ts';
import { callChatCompletion } from '../_shared/ai-provider/openaiCompatible.ts';

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
  // SPEC 041: para el proveedor local, el presupuesto de chars no debe superar
  // AI_MAX_SOURCE_CHARS (si esta definido). Solo endurece; sin la env, igual que hoy.
  let charBudget = capSourceChars(
    limits.maxSourceChars,
    resolveMaxSourceChars({ AI_MAX_SOURCE_CHARS: Deno.env.get('AI_MAX_SOURCE_CHARS') }),
  );

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
  //    SPEC 041: resolucion OpenAI-compatible (AI_* preferente, fallback OPENAI_*),
  //    base URL configurable para LM Studio/servidor europeo sin tocar codigo.
  const provider = resolveAiProvider(
    {
      AI_PROVIDER: Deno.env.get('AI_PROVIDER'),
      AI_BASE_URL: Deno.env.get('AI_BASE_URL'),
      AI_API_KEY: Deno.env.get('AI_API_KEY'),
      AI_MODEL: Deno.env.get('AI_MODEL'),
      AI_REQUEST_TIMEOUT_MS: Deno.env.get('AI_REQUEST_TIMEOUT_MS'),
      AI_CONTEXT_WINDOW_TOKENS: Deno.env.get('AI_CONTEXT_WINDOW_TOKENS'),
      AI_MAX_SOURCE_CHARS: Deno.env.get('AI_MAX_SOURCE_CHARS'),
      AI_ENABLE_THINKING: Deno.env.get('AI_ENABLE_THINKING'),
      OPENAI_BASE_URL: Deno.env.get('OPENAI_BASE_URL'),
      OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
      OPENAI_MODEL: Deno.env.get('OPENAI_MODEL'),
    },
    { defaultModel: DEFAULT_OPENAI_MODEL },
  );
  if (!provider) {
    return fail(DQG_ERROR.PROVIDER_NOT_CONFIGURED, 501, DQG_PROVIDER_NOT_CONFIGURED_MESSAGE);
  }

  // 6a) Presupuesto de coste de IA. Antes de llamar al proveedor: estima el coste de
  //     este run y suma el coste de HOY de la oposicion (generacion + estudio). Si
  //     excede el tope por run o el diario, bloquea SIN crear el run ni llamar a IA.
  const price = resolvePrice(provider.model, {
    AI_PRICE_INPUT_PER_M: Deno.env.get('AI_PRICE_INPUT_PER_M'),
    AI_PRICE_OUTPUT_PER_M: Deno.env.get('AI_PRICE_OUTPUT_PER_M'),
  });
  const costLimits = resolveCostLimits({
    MAX_QUESTIONS_PER_RUN: Deno.env.get('MAX_QUESTIONS_PER_RUN'),
    MAX_COST_PER_RUN_USD: Deno.env.get('MAX_COST_PER_RUN_USD'),
    MAX_DAILY_COST_USD: Deno.env.get('MAX_DAILY_COST_USD'),
  });
  const cappedQuestionCount = Math.min(questionCount, costLimits.maxQuestionsPerRun);
  const sourceChars = promptUnits.reduce((acc, u) => acc + u.excerpt.length, 0);
  const estimatedRunCostUsd = estimateRunCostUsd({
    sourceChars,
    questionCount: cappedQuestionCount,
    price,
  });
  const startOfDayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString();
  let todayCostSoFarUsd = 0;
  try {
    for (const table of ['question_generation_runs', 'material_study_runs']) {
      const { data: rows } = await userClient
        .from(table)
        .select('estimated_cost_usd')
        .eq('workspace_id', request.workspace_id)
        .eq('opposition_id', request.opposition_id)
        .gte('created_at', startOfDayUtc);
      for (const r of rows ?? []) {
        const c = Number(r.estimated_cost_usd);
        if (Number.isFinite(c) && c > 0) todayCostSoFarUsd += c;
      }
    }
  } catch {
    todayCostSoFarUsd = 0; // si no se puede sumar, no se inventa coste (best-effort).
  }
  const budget = evaluateBudget({ estimatedRunCostUsd, todayCostSoFarUsd, limits: costLimits });
  if (!budget.ok) {
    return json(
      {
        error: DQG_ERROR.COST_LIMIT,
        reason: budget.reason,
        estimated_run_cost_usd: estimatedRunCostUsd,
        today_cost_usd: Math.round(todayCostSoFarUsd * 1e6) / 1e6,
        max_cost_per_run_usd: costLimits.maxCostPerRunUsd,
        max_daily_cost_usd: costLimits.maxDailyCostUsd,
      },
      429,
    );
  }

  // 6b) SPEC 040: memoria de errores AISLADA (mismo workspace + oposicion). Se lee
  //     con el cliente del usuario (RLS de gestion); se SELECCIONA y ACOTA en el
  //     contrato puro (≤10 entradas / ≤3000 chars) y se inyecta como bloque de
  //     "errores a evitar" SEPARADO de la evidencia factual. Sin memoria, la
  //     generacion se comporta igual que SPEC 039. La memoria NUNCA es fuente.
  const memoryLimits = resolveMemoryLimits({
    MAX_ERROR_MEMORIES_IN_PROMPT: Deno.env.get('MAX_ERROR_MEMORIES_IN_PROMPT'),
    MAX_ERROR_MEMORY_CHARS: Deno.env.get('MAX_ERROR_MEMORY_CHARS'),
  });
  let avoidBlock: string | null = null;
  try {
    const { data: memoryRows } = await userClient
      .from('ai_error_memories')
      .select('workspace_id, opposition_id, type, severity, summary, avoid_instruction, occurrences, difficulty, last_seen_at')
      .eq('workspace_id', request.workspace_id)
      .eq('opposition_id', request.opposition_id);
    const difficultyHint = request.difficulty !== 'mixed' ? request.difficulty : null;
    const selected = selectErrorMemories(
      (memoryRows ?? []) as ErrorMemoryRecord[],
      { workspace_id: request.workspace_id, opposition_id: request.opposition_id, difficulty: difficultyHint },
      memoryLimits,
    );
    avoidBlock = formatAvoidBlock(selected, memoryLimits.maxChars);
  } catch {
    avoidBlock = null; // la memoria es opcional: nunca bloquea la generacion.
  }

  // 7) Run + proveedor + validacion + persistencia via el ORQUESTADOR del ciclo de
  //    vida. El run se crea ANTES de cualquier candidata; proveedor/parsing/
  //    persistencia fallidos -> failed/partial coherente. Logica testeada en
  //    `runDirectGeneration`; aqui solo el adaptador de Supabase.
  const now = new Date().toISOString();
  const runId = uuid();
  // Uso/coste real del proveedor en este run (se rellena tras la llamada a OpenAI y
  // se persiste en finalizeRun). Sin secretos ni texto: solo tokens.
  let runUsage: AiUsage = EMPTY_USAGE;
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
        requested_count: cappedQuestionCount,
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
      // Coste de IA del run (tokens + estimacion; sin prompts ni texto).
      const cost = buildCostBreakdown(runUsage, price);
      const { error } = await userClient
        .from('question_generation_runs')
        .update({
          status,
          created_count: createdCount,
          errors: errs,
          input_tokens: cost.input_tokens,
          output_tokens: cost.output_tokens,
          total_tokens: cost.total_tokens,
          estimated_cost_usd: cost.estimated_cost_usd,
          cost_model: cost.cost_model,
        })
        .eq('id', runId);
      return !error;
    },
  };

  const result = await runDirectGeneration({
    port,
    requested: cappedQuestionCount,
    produce: async () => {
      // SPEC 041: la llamada (URL base, bearer, timeout, fallback de formato y
      // filtrado de <think>) la centraliza la capa comun. El diagnostico seguro
      // (sin api key/prompt/respuesta cruda) viene en `result.info`.
      const aiResult = await callChatCompletion(
        provider,
        buildOpenAIRequest({
          model: provider.model,
          difficulty: request.difficulty,
          question_count: cappedQuestionCount,
          units: promptUnits,
          avoidBlock,
        }),
      );
      if (!aiResult.ok) {
        const info = aiResult.info;
        return {
          ok: false,
          code: DQG_ERROR.PROVIDER_FAILED,
          candidates: [],
          errors: info?.codes ?? [AI_PROVIDER_ERROR.UNKNOWN],
          provider_status: info?.provider_status,
          provider_code: info?.provider_code ?? null,
        };
      }
      // Coste de IA: captura el uso de tokens del proveedor (sin secretos/texto).
      runUsage = parseOpenAIUsage(aiResult.usage);
      const parseRes = parseProviderCandidates(aiResult.content);
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
    // Para fallo de proveedor, devuelve diagnostico SEGURO (status/code/errors) para
    // QA, sin secretos ni contenido. El resto de errores van con su codigo de wire.
    if (result.code === DQG_ERROR.PROVIDER_FAILED) {
      return json(
        {
          error: DQG_ERROR.PROVIDER_FAILED,
          errors: result.errors ?? [],
          provider_status: result.provider_status ?? null,
          provider_code: result.provider_code ?? null,
        },
        result.httpStatus,
      );
    }
    return fail(result.code as DqgErrorCode, result.httpStatus);
  }
  const runCost = buildCostBreakdown(runUsage, price);
  return json({
    run_id: runId,
    study_run_id: studyRunId,
    created: result.created,
    requested: cappedQuestionCount,
    warnings: [...new Set(warnings)],
    cost: {
      input_tokens: runUsage.input_tokens,
      output_tokens: runUsage.output_tokens,
      total_tokens: runUsage.total_tokens,
      estimated_cost_usd: runCost.estimated_cost_usd,
      cost_model: runCost.cost_model,
      cost_per_question_usd: costPerQuestion(runCost.estimated_cost_usd, result.created),
    },
  });
});
