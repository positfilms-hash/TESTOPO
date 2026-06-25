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
  EMPTY_USAGE,
  parseOpenAIUsage,
  addUsage,
  resolvePrice,
  buildCostBreakdown,
  type AiUsage,
} from '../_shared/ai-cost/contract.ts';
import {
  STUDY_ERROR,
  STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE,
  MAX_STUDY_UNITS_PER_MATERIAL,
  MAX_STUDY_CHUNK_CHARS,
  MAX_STUDY_BLOCKS_PER_MATERIAL,
  resolveStudyLimits,
  validateStudyRequest,
  STUDY_READABLE_EXTRACTION,
  evaluateStudyEligibility,
  classifyStudyDocument,
  resolveCanonicalSection,
  chunkSectionText,
  buildFallbackStudyUnits,
  materialHasOcrWarnings,
  resolveStudyProvider,
  STUDY_SYSTEM_PROMPT,
  parseProviderUnits,
  validateStudyUnit,
  mapStudyRunStatus,
  mapMaterialStudyStatus,
  type StudyErrorCode,
  type StudyEvidenceScope,
  type ProviderUnit,
  type ValidatedStudyUnit,
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

  // 4) Materiales del scope + su clasificacion efectiva (la mas reciente por material).
  const { data: materials } = await userClient
    .from('materials')
    .select('id, workspace_id, opposition_id, status, extraction_status, study_status, title, content_text')
    .eq('opposition_id', request.opposition_id)
    .limit(limits.maxMaterials);
  const matRows = (materials ?? []).filter((m) => m.workspace_id === request.workspace_id);
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

  // "Estudiar material" es AUTOSUFICIENTE: si un material LEGIBLE no tiene
  // clasificacion previa (el usuario no ejecuto "Analizar material"/indice), la
  // resolvemos AQUI con la heuristica determinista y la PERSISTIMOS de forma
  // trazable (run interno de comprension + fila document_classifications). NO es un
  // mock de IA ni depende de un indice/temario publico. El texto sale de las
  // secciones del material en SERVIDOR; el navegador nunca lo aporta. Fail-closed:
  // sin clase primaria con confianza, el material no se estudia (motivo exacto).
  const readableCandidates = matRows.filter(
    (m) => m.status !== 'obsolete' && STUDY_READABLE_EXTRACTION.has(m.extraction_status ?? ''),
  );

  // 4a) SECCION CANONICA (SPEC 038 fix staging): un material legible puede no tener
  // material_sections (la seccion 028-C nunca corrio) pero SI tener texto en
  // materials.content_text. Para esos, creamos internamente una seccion canonica
  // desde content_text (recuperado SOLO en servidor) ANTES de clasificar/estudiar,
  // de modo que la clasificacion reciba texto y las unidades queden ancladas a esa
  // seccion concreta (evidencia para SPEC 039). Errores de lectura/escritura ->
  // bloqueo TRAZABLE (no se silencian). Sin content_text -> motivo honesto.
  const readableIds = readableCandidates.map((m) => m.id);
  const { data: existingSections, error: secReadErr } = await userClient
    .from('material_sections')
    .select('material_id, status')
    .in('material_id', readableIds.length ? readableIds : [''])
    .eq('status', 'active');
  if (secReadErr) {
    return fail(STUDY_ERROR.PREP_FAILED, 502, 'No se pudo leer la estructura del material.');
  }
  const activeSectionCount = new Map<string, number>();
  for (const s of existingSections ?? []) {
    activeSectionCount.set(s.material_id, (activeSectionCount.get(s.material_id) ?? 0) + 1);
  }
  // Materiales legibles SIN texto utilizable (completed pero sin secciones y sin
  // content_text): motivo honesto y especifico.
  const noTextReason = new Map<string, string>();
  for (const m of readableCandidates) {
    const resolution = resolveCanonicalSection({
      activeSectionCount: activeSectionCount.get(m.id) ?? 0,
      content_text: m.content_text,
      title: m.title,
    });
    if (resolution.kind === 'has_sections') continue;
    if (resolution.kind === 'no_text') {
      noTextReason.set(m.id, resolution.reason);
      continue;
    }
    // Crea la seccion canonica trazable. Error de escritura -> bloqueo trazable.
    const { error: secErr } = await userClient.from('material_sections').insert({
      workspace_id: request.workspace_id,
      opposition_id: request.opposition_id,
      material_id: m.id,
      section_title: resolution.section.section_title,
      section_type: resolution.section.section_type,
      classification: resolution.section.classification,
      content_text: resolution.section.content_text,
      content_excerpt: resolution.section.content_text.slice(0, 500),
      order_index: resolution.section.order_index,
      status: 'active',
    });
    if (secErr) {
      return fail(STUDY_ERROR.PREP_FAILED, 502, 'No se pudo preparar la fuente del material.');
    }
    activeSectionCount.set(m.id, 1);
  }

  // "Estudiar material" es AUTOSUFICIENTE: si un material LEGIBLE no tiene
  // clasificacion previa (el usuario no ejecuto "Analizar material"/indice), la
  // resolvemos AQUI con la heuristica determinista y la PERSISTIMOS de forma
  // trazable (run interno de comprension + fila document_classifications). NO es un
  // mock de IA ni depende de un indice/temario publico. El texto sale de las
  // secciones del material en SERVIDOR; el navegador nunca lo aporta. Fail-closed:
  // sin clase primaria con confianza, el material no se estudia (motivo exacto).
  // Se excluyen los materiales sin texto (no hay nada que clasificar).
  const unclassified = readableCandidates.filter(
    (m) => !classByMaterial.has(m.id) && !noTextReason.has(m.id),
  );
  if (unclassified.length > 0) {
    const autoRunId = uuid();
    const { error: arErr } = await userClient.from('document_understanding_runs').insert({
      id: autoRunId,
      workspace_id: request.workspace_id,
      opposition_id: request.opposition_id,
      created_by: actorId,
      status: 'completed',
      provider: 'heuristic',
      model: null,
      total_materials: unclassified.length,
      classified_materials: 0,
      warnings: [],
      errors: [],
    });
    if (arErr) {
      return fail(STUDY_ERROR.PREP_FAILED, 502, 'No se pudo preparar la clasificacion del material.');
    }
    let classifiedCount = 0;
    for (const m of unclassified) {
      const { data: secs, error: secErr } = await userClient
        .from('material_sections')
        .select('material_id, status, content_text, content_excerpt, order_index')
        .eq('material_id', m.id)
        .eq('status', 'active')
        .order('order_index', { ascending: true });
      if (secErr) {
        return fail(STUDY_ERROR.PREP_FAILED, 502, 'No se pudo leer el texto del material.');
      }
      const text = (secs ?? [])
        .filter((s) => s.material_id === m.id)
        .map((s) => (s.content_text || s.content_excerpt) ?? '')
        .join('\n')
        .slice(0, 20000);
      const auto = classifyStudyDocument({ text, filename: m.title });
      // No se silencia el error de escritura de la clasificacion: bloqueo trazable.
      const { error: insErr } = await userClient.from('document_classifications').insert({
        workspace_id: request.workspace_id,
        opposition_id: request.opposition_id,
        material_id: m.id,
        run_id: autoRunId,
        classification: auto.classification,
        confidence: auto.confidence,
        reason: auto.reason,
        needs_review: auto.needs_review,
        manually_corrected: false,
        warnings: auto.warnings,
      });
      if (insErr) {
        return fail(STUDY_ERROR.PREP_FAILED, 502, 'No se pudo guardar la clasificacion del material.');
      }
      classifiedCount += 1;
      classByMaterial.set(m.id, {
        classification: auto.classification,
        needs_review: auto.needs_review,
      });
    }
    await userClient
      .from('document_understanding_runs')
      .update({ classified_materials: classifiedCount })
      .eq('id', autoRunId);
  }

  // Elegibilidad con MOTIVO exacto sobre los materiales legibles (tras autoclasificar).
  const eligible: typeof matRows = [];
  const ineligible: { material_id: string; reason: string }[] = [];
  for (const m of readableCandidates) {
    // Material completed sin texto: motivo honesto y especifico (no clasificable).
    const noText = noTextReason.get(m.id);
    if (noText) {
      ineligible.push({ material_id: m.id, reason: noText });
      continue;
    }
    const verdict = evaluateStudyEligibility({ material: m, classification: classByMaterial.get(m.id) });
    if (verdict.eligible) eligible.push(m);
    else ineligible.push({ material_id: m.id, reason: verdict.reason });
  }
  if (eligible.length === 0) {
    // Cero escrituras de estudio. Se devuelve el MOTIVO exacto por material legible.
    return json({ error: STUDY_ERROR.NO_ELIGIBLE_MATERIAL, ineligible }, 422);
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
      ineligible,
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
  // Pistas internas de QA para diagnosticar NO_VALID_UNITS (sin secretos ni texto).
  const qaErrors: string[] = [];
  // Coste de IA del run (acumulado entre llamadas por material). Solo tokens.
  let totalUsage: AiUsage = EMPTY_USAGE;
  const price = resolvePrice(provider.model, {
    AI_PRICE_INPUT_PER_M: Deno.env.get('AI_PRICE_INPUT_PER_M'),
    AI_PRICE_OUTPUT_PER_M: Deno.env.get('AI_PRICE_OUTPUT_PER_M'),
  });
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

    // TROCEA cada seccion en BLOQUES manejables (no se envia una seccion de 163k
    // como una sola fuente). Cada bloque conserva su material_section_id real
    // (subreferencia trazable). Respeta el presupuesto GLOBAL y el tope de bloques.
    const blocks: { section_id: string; label: string; text: string }[] = [];
    const sectionTextById = new Map<string, string>();
    secRows.forEach((s, sIdx) => {
      const sectionText = ((s.content_text || s.content_excerpt) ?? '').trim();
      if (sectionText.length === 0) return;
      let bIdx = 0;
      for (const chunk of chunkSectionText(sectionText, { maxChunkChars: MAX_STUDY_CHUNK_CHARS })) {
        if (totalCharBudget <= 0 || blocks.length >= MAX_STUDY_BLOCKS_PER_MATERIAL) break;
        const text = chunk.slice(0, Math.max(0, totalCharBudget)).trim();
        if (text.length === 0) continue;
        totalCharBudget -= text.length;
        bIdx += 1;
        blocks.push({ section_id: s.id, label: `S${sIdx + 1}-B${bIdx}`, text });
        const prev = sectionTextById.get(s.id);
        sectionTextById.set(s.id, prev ? `${prev}\n${text}` : text);
      }
    });

    if (blocks.length === 0) {
      warnings.push('Un material elegible no tiene secciones activas legibles para estudiar.');
    } else {
      const scope: StudyEvidenceScope = {
        material_ids: new Set([material.id]),
        section_texts: sectionTextById,
        reference_texts: new Map<string, string>(),
      };

      // Proveedor: prompt que FUERZA material_section_id valido + source_excerpt
      // copiado literalmente del bloque.
      let content: string | null = null;
      try {
        const userContent = [
          `material_id=${material.id}`,
          `Maximo ${MAX_STUDY_UNITS_PER_MATERIAL} unidades de estudio.`,
          'Por cada unidad: material_section_id EXACTO del bloque y source_excerpt COPIADO',
          'LITERALMENTE de ese bloque.',
          ...blocks.map((b) => `BLOQUE ${b.label} [material_section_id=${b.section_id}]\n${b.text}`),
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
          const data = (await resp.json()) as {
            choices?: { message?: { content?: string } }[];
            usage?: unknown;
          };
          content = data.choices?.[0]?.message?.content ?? null;
          // Coste de IA: acumula el uso de tokens del proveedor (sin secretos/texto).
          totalUsage = addUsage(totalUsage, parseOpenAIUsage(data.usage));
        } else {
          hadErrors = true;
          qaErrors.push('provider_http_error');
        }
      } catch {
        hadErrors = true;
        qaErrors.push('provider_exception');
      }

      // Valida la salida del proveedor (puntero + excerpt anclado).
      const validUnits: ValidatedStudyUnit[] = [];
      if (content !== null) {
        const parseRes = parseProviderUnits(content);
        if (!parseRes.ok) {
          hadErrors = true;
          qaErrors.push('provider_parse_failed');
        } else {
          let rejected = 0;
          for (const u of parseRes.units) {
            const v = validateStudyUnit(u, scope);
            if (v.ok) validUnits.push(v.value);
            else rejected += 1;
          }
          if (rejected > 0) qaErrors.push(`provider_units_rejected=${rejected}`);
          if (parseRes.units.length > 0 && validUnits.length === 0) {
            qaErrors.push('provider_zero_valid_units');
          }
        }
      }

      // FALLBACK DETERMINISTA SEGURO: si el proveedor no dio unidades validas, crea
      // bloques internos desde los chunks con source_excerpt REAL (texto literal).
      // No es un mock: es estructuracion deterministica del material, anclada a su
      // seccion concreta. Garantiza unidades cuando hay texto real.
      if (validUnits.length === 0) {
        for (const b of blocks) {
          if (validUnits.length >= MAX_STUDY_UNITS_PER_MATERIAL) break;
          const [fb] = buildFallbackStudyUnits({
            material_id: material.id,
            section_id: b.section_id,
            chunks: [b.text],
            max: 1,
          }) as ProviderUnit[];
          if (!fb) continue;
          const v = validateStudyUnit(fb, scope);
          if (v.ok) validUnits.push(v.value);
        }
        if (validUnits.length > 0) {
          warnings.push('Se prepararon bloques de estudio de forma determinista desde el texto del material.');
          qaErrors.push('deterministic_fallback_used');
        }
      }

      // Persiste las unidades validas (respeta topes por material y global).
      for (const v of validUnits) {
        if (materialUnits >= MAX_STUDY_UNITS_PER_MATERIAL || totalUnits >= limits.totalUnits) break;
        const { error: uErr } = await userClient.from('material_study_units').insert({
          id: uuid(),
          workspace_id: request.workspace_id,
          opposition_id: request.opposition_id,
          run_id: runId,
          material_id: v.material_id,
          material_section_id: v.material_section_id,
          source_reference_id: v.source_reference_id,
          title: v.title,
          summary: v.summary,
          excerpt: v.excerpt,
          importance: v.importance,
          confidence: v.confidence,
        });
        if (uErr) {
          hadErrors = true;
          qaErrors.push('unit_persist_failed');
          continue;
        }
        materialUnits += 1;
        unitsCreated += 1;
        totalUnits += 1;
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
  const cost = buildCostBreakdown(totalUsage, price);
  const { error: finErr } = await userClient.from('material_study_runs').update({
    status: runStatus,
    studied_count: studiedCount,
    unit_count: unitsCreated,
    warnings: [...new Set(warnings)],
    errors: [...new Set(qaErrors)],
    input_tokens: cost.input_tokens,
    output_tokens: cost.output_tokens,
    total_tokens: cost.total_tokens,
    estimated_cost_usd: cost.estimated_cost_usd,
    cost_model: cost.cost_model,
    updated_at: new Date().toISOString(),
  }).eq('id', runId);
  if (finErr) return fail(STUDY_ERROR.SAVE_FAILED, 502);

  if (unitsCreated === 0) {
    // QA: se devuelven pistas internas (sin secretos ni texto) para diagnosticar
    // por que no se crearon unidades validas.
    return json(
      {
        error: STUDY_ERROR.NO_VALID_UNITS,
        warnings: [...new Set(warnings)],
        errors: [...new Set(qaErrors)],
        ineligible,
      },
      422,
    );
  }
  return json({
    run_id: runId,
    materials: toStudy.length,
    studied: studiedCount,
    units: unitsCreated,
    warnings: [...new Set(warnings)],
    ineligible,
    cost: {
      input_tokens: cost.input_tokens,
      output_tokens: cost.output_tokens,
      total_tokens: cost.total_tokens,
      estimated_cost_usd: cost.estimated_cost_usd,
      cost_model: cost.cost_model,
    },
  });
});
