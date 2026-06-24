// SPEC 039: tests del contrato COMPARTIDO de la generacion DIRECTA de preguntas
// desde material estudiado. Logica PURA, sin red ni proveedor. Importa el MISMO
// modulo que la Edge Function `generate-questions-from-studied-material`.

import { describe, it, expect } from 'vitest';
import {
  DQG_ERROR,
  DQG_PROVIDER_NOT_CONFIGURED_MESSAGE,
  MAX_DIRECT_QUESTION_COUNT,
  MAX_DIRECT_SOURCE_CHARS,
  MAX_DIRECT_UNITS,
  resolveDirectLimits,
  validateDirectGenerateRequest,
  isSelectionCoherent,
  isStudyRunReady,
  isUsableStudiedMaterial,
  evaluateSelectionScope,
  validateDirectCandidate,
  candidateStatus,
  mapRunStatus,
  resolveProvider,
  parseProviderCandidates,
  runDirectGeneration,
  type DirectEvidenceScope,
  type ProviderDirectCandidate,
  type ValidatedDirectCandidate,
  type DirectRunPort,
} from '../../../supabase/functions/_shared/direct-question-generation/contract';

const base = {
  workspace_id: 'ws-1',
  opposition_id: 'op-1',
  scope: 'all_studied_material' as const,
  question_count: 5,
  difficulty: 'mixed' as const,
  material_ids: [],
  material_study_unit_ids: [],
  material_study_concept_ids: [],
};

describe('validateDirectGenerateRequest', () => {
  it('acepta un alcance global minimo y normaliza arrays', () => {
    const r = validateDirectGenerateRequest(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.scope).toBe('all_studied_material');
      expect(r.value.material_study_run_id).toBeNull();
      expect(r.value.material_ids).toEqual([]);
    }
  });

  it.each([
    'user_id',
    'source_text',
    'raw_text',
    'ocr_text',
    'excerpt',
    'source_excerpt',
    'prompt',
    'custom_prompt',
    'messages',
    'api_key',
    'image_base64',
    'correct_answer',
    'options',
    'statement',
  ])('rechaza el campo prohibido "%s"', (f) => {
    const r = validateDirectGenerateRequest({ ...base, [f]: 'x' });
    expect(r).toMatchObject({ ok: false, code: DQG_ERROR.ARBITRARY_INPUT_FORBIDDEN });
  });

  it('rechaza campos desconocidos y exige workspace/opposition', () => {
    expect(validateDirectGenerateRequest({ ...base, surprise: 1 }).ok).toBe(false);
    expect(validateDirectGenerateRequest({ ...base, workspace_id: '' })).toMatchObject({
      ok: false,
      code: DQG_ERROR.WORKSPACE_REQUIRED,
    });
    expect(validateDirectGenerateRequest({ ...base, opposition_id: '' })).toMatchObject({
      ok: false,
      code: DQG_ERROR.OPPOSITION_REQUIRED,
    });
  });

  it('valida cantidad, dificultad (incl. mixed) y limites de arrays', () => {
    expect(validateDirectGenerateRequest({ ...base, question_count: 0 }).ok).toBe(false);
    expect(validateDirectGenerateRequest({ ...base, question_count: 999 }).ok).toBe(false);
    expect(validateDirectGenerateRequest({ ...base, difficulty: 'imposible' }).ok).toBe(false);
    expect(validateDirectGenerateRequest({ ...base, difficulty: 'mixed' }).ok).toBe(true);
    expect(validateDirectGenerateRequest({ ...base, difficulty: 'hard' }).ok).toBe(true);
    expect(
      validateDirectGenerateRequest({
        ...base,
        scope: 'selected_materials',
        material_ids: Array.from({ length: 51 }, (_, i) => `m-${i}`),
      }).ok,
    ).toBe(false);
  });

  it('exige coherencia scope <-> arrays', () => {
    // all_studied_material no admite ninguna seleccion.
    expect(validateDirectGenerateRequest({ ...base, material_ids: ['m-1'] }).ok).toBe(false);
    // selected_materials exige material_ids y prohibe los demas.
    expect(
      validateDirectGenerateRequest({ ...base, scope: 'selected_materials', material_ids: ['m-1'] }).ok,
    ).toBe(true);
    expect(validateDirectGenerateRequest({ ...base, scope: 'selected_materials' }).ok).toBe(false);
    expect(
      validateDirectGenerateRequest({
        ...base,
        scope: 'selected_materials',
        material_ids: ['m-1'],
        material_study_unit_ids: ['u-1'],
      }).ok,
    ).toBe(false);
    // selected_units / selected_concepts.
    expect(
      validateDirectGenerateRequest({ ...base, scope: 'selected_units', material_study_unit_ids: ['u-1'] }).ok,
    ).toBe(true);
    expect(
      validateDirectGenerateRequest({
        ...base,
        scope: 'selected_concepts',
        material_study_concept_ids: ['c-1'],
      }).ok,
    ).toBe(true);
  });

  it('isSelectionCoherent es la regla central de coherencia', () => {
    expect(isSelectionCoherent('all_studied_material', { materialIds: [], unitIds: [], conceptIds: [] })).toBe(true);
    expect(isSelectionCoherent('selected_units', { materialIds: [], unitIds: ['u'], conceptIds: [] })).toBe(true);
    expect(isSelectionCoherent('selected_units', { materialIds: ['m'], unitIds: ['u'], conceptIds: [] })).toBe(false);
  });
});

describe('resolveDirectLimits (solo endurece, nunca supera el maximo)', () => {
  it('ausente/invalido -> maximos seguros', () => {
    const l = resolveDirectLimits({});
    expect(l).toMatchObject({
      maxQuestions: MAX_DIRECT_QUESTION_COUNT,
      maxSourceChars: MAX_DIRECT_SOURCE_CHARS,
      maxUnits: MAX_DIRECT_UNITS,
    });
    const bad = resolveDirectLimits({ MAX_GENERATED_QUESTIONS: 'x', MAX_QUESTION_SOURCE_CHARS: '0' });
    expect(bad.maxQuestions).toBe(MAX_DIRECT_QUESTION_COUNT);
    expect(bad.maxSourceChars).toBe(MAX_DIRECT_SOURCE_CHARS);
  });
  it('un secreto endurece pero no puede superar el maximo', () => {
    const tight = resolveDirectLimits({ MAX_GENERATED_QUESTIONS: '3', MAX_QUESTION_SOURCE_CHARS: '500', MAX_DIRECT_EVIDENCE_UNITS: '2' });
    expect(tight).toMatchObject({ maxQuestions: 3, maxSourceChars: 500, maxUnits: 2 });
    const over = resolveDirectLimits({ MAX_GENERATED_QUESTIONS: '9999', MAX_QUESTION_SOURCE_CHARS: '9999999' });
    expect(over.maxQuestions).toBe(MAX_DIRECT_QUESTION_COUNT);
    expect(over.maxSourceChars).toBe(MAX_DIRECT_SOURCE_CHARS);
  });
});

describe('elegibilidad de estudio y material', () => {
  it('isStudyRunReady solo con completed / completed_with_warnings', () => {
    expect(isStudyRunReady('completed')).toBe(true);
    expect(isStudyRunReady('completed_with_warnings')).toBe(true);
    expect(isStudyRunReady('processing')).toBe(false);
    expect(isStudyRunReady('failed')).toBe(false);
    expect(isStudyRunReady(undefined)).toBe(false);
  });
  it('isUsableStudiedMaterial excluye ajeno, obsoleto y no legible', () => {
    const scope = { workspace_id: 'ws-1', opposition_id: 'op-1' };
    const ok = { workspace_id: 'ws-1', opposition_id: 'op-1', status: 'active', extraction_status: 'completed' };
    expect(isUsableStudiedMaterial(ok, scope)).toBe(true);
    expect(isUsableStudiedMaterial({ ...ok, workspace_id: 'ws-2' }, scope)).toBe(false);
    expect(isUsableStudiedMaterial({ ...ok, opposition_id: 'op-2' }, scope)).toBe(false);
    expect(isUsableStudiedMaterial({ ...ok, status: 'obsolete' }, scope)).toBe(false);
    expect(isUsableStudiedMaterial({ ...ok, extraction_status: 'ocr_failed' }, scope)).toBe(false);
  });
});

describe('evaluateSelectionScope (P1: validar la seleccion ENTERA contra el scope)', () => {
  const available = {
    materialIds: new Set(['mat-1', 'mat-2']),
    unitIds: new Set(['u-1', 'u-2']),
    conceptIds: new Set(['c-1', 'c-2']),
  };
  const req = (over: Partial<Parameters<typeof evaluateSelectionScope>[0]>) => ({
    scope: 'all_studied_material' as const,
    material_ids: [],
    material_study_unit_ids: [],
    material_study_concept_ids: [],
    ...over,
  });

  it('all_studied_material no necesita seleccion', () => {
    expect(evaluateSelectionScope(req({}), available).ok).toBe(true);
  });

  it('materiales: solo propios -> ok; mixto propio+ajeno -> RECHAZO', () => {
    expect(evaluateSelectionScope(req({ scope: 'selected_materials', material_ids: ['mat-1', 'mat-2'] }), available).ok).toBe(true);
    // payload MIXTO valido + ajeno: un solo id ajeno rechaza toda la peticion.
    expect(
      evaluateSelectionScope(req({ scope: 'selected_materials', material_ids: ['mat-1', 'mat-ajeno'] }), available),
    ).toMatchObject({ ok: false, code: DQG_ERROR.SELECTION_FORBIDDEN });
    expect(
      evaluateSelectionScope(req({ scope: 'selected_materials', material_ids: ['ajeno'] }), available).ok,
    ).toBe(false);
  });

  it('unidades: solo propias -> ok; mixto propio+ajeno -> RECHAZO', () => {
    expect(evaluateSelectionScope(req({ scope: 'selected_units', material_study_unit_ids: ['u-1'] }), available).ok).toBe(true);
    expect(
      evaluateSelectionScope(req({ scope: 'selected_units', material_study_unit_ids: ['u-1', 'u-otra'] }), available),
    ).toMatchObject({ ok: false, code: DQG_ERROR.SELECTION_FORBIDDEN });
  });

  it('conceptos: solo propios -> ok; mixto propio+ajeno -> RECHAZO', () => {
    expect(
      evaluateSelectionScope(req({ scope: 'selected_concepts', material_study_concept_ids: ['c-1', 'c-2'] }), available).ok,
    ).toBe(true);
    expect(
      evaluateSelectionScope(req({ scope: 'selected_concepts', material_study_concept_ids: ['c-1', 'c-otro'] }), available),
    ).toMatchObject({ ok: false, code: DQG_ERROR.SELECTION_FORBIDDEN });
  });

  it('pool vacio (study run sin esa evidencia) -> RECHAZO de cualquier seleccion', () => {
    const empty = { materialIds: new Set<string>(), unitIds: new Set<string>(), conceptIds: new Set<string>() };
    expect(evaluateSelectionScope(req({ scope: 'selected_materials', material_ids: ['mat-1'] }), empty).ok).toBe(false);
    expect(evaluateSelectionScope(req({ scope: 'selected_units', material_study_unit_ids: ['u-1'] }), empty).ok).toBe(false);
  });
});

// Evidencia con DOS unidades de textos distintos + puntero de concepto en una.
const UNIT1 = 'La Constitucion se estructura en un titulo preliminar y diez titulos.';
const UNIT2 = 'El recurso de amparo se interpone ante el Tribunal Constitucional.';
const scope: DirectEvidenceScope = {
  material_ids: new Set(['mat-1']),
  unit_ids: new Set(['u-1', 'u-2']),
  unit_texts: new Map([
    ['u-1', UNIT1],
    ['u-2', UNIT2],
  ]),
  unit_pointers: new Map([
    [
      'u-1',
      { material_id: 'mat-1', material_section_id: 'sec-1', source_reference_id: null, topic_label: 'Estructura de la Constitucion', concept_id: 'con-1' },
    ],
    [
      'u-2',
      { material_id: 'mat-1', material_section_id: null, source_reference_id: 'ref-2', topic_label: 'Recurso de amparo', concept_id: null },
    ],
  ]),
};

function candidate(): ProviderDirectCandidate {
  return {
    statement: '¿En cuantos titulos se estructura la Constitucion (ademas del preliminar)?',
    options: [
      { text: 'Diez', is_correct: true },
      { text: 'Cinco', is_correct: false },
      { text: 'Quince', is_correct: false },
    ],
    explanation: 'La Constitucion tiene un titulo preliminar y diez titulos.',
    difficulty: 'medium',
    material_id: 'mat-1',
    material_study_unit_id: 'u-1',
    source_excerpt: UNIT1,
  };
}

describe('validateDirectCandidate (anclaje a unidad estudiada)', () => {
  it('acepta una candidata anclada, con 1 correcta y excerpt contenido', () => {
    const r = validateDirectCandidate(candidate(), scope);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.material_study_unit_id).toBe('u-1');
      expect(r.value.material_id).toBe('mat-1');
      expect(r.value.material_section_id).toBe('sec-1');
      expect(r.value.topic_label).toBe('Estructura de la Constitucion');
      expect(r.value.material_study_concept_id).toBe('con-1'); // puntero de concepto propagado
      expect(r.value.warnings).toEqual([]);
    }
  });

  it('rechaza validated, estructura incompleta, opciones invalidas', () => {
    expect(validateDirectCandidate({ ...candidate(), status: 'validated' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), statement: '' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), explanation: '' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), difficulty: 'mixed' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), options: [{ text: 'A', is_correct: true }] }, scope).ok).toBe(false);
    expect(
      validateDirectCandidate(
        { ...candidate(), options: [{ text: 'A', is_correct: true }, { text: 'B', is_correct: true }] },
        scope,
      ).ok,
    ).toBe(false);
    expect(
      validateDirectCandidate(
        { ...candidate(), options: [{ text: 'A', is_correct: true }, { text: 'A', is_correct: false }] },
        scope,
      ).ok,
    ).toBe(false);
  });

  it('rechaza unidad ajena/ausente y material/seccion/referencia que no casan', () => {
    expect(validateDirectCandidate({ ...candidate(), material_study_unit_id: 'u-ajena' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), material_study_unit_id: '' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), material_id: 'mat-ajeno' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), material_section_id: 'sec-ajena' }, scope).ok).toBe(false);
    expect(validateDirectCandidate({ ...candidate(), source_reference_id: 'ref-ajena' }, scope).ok).toBe(false);
  });

  it('excerpt inventado -> se sustituye por el texto de LA unidad citada (con aviso -> needs_fix)', () => {
    const r = validateDirectCandidate({ ...candidate(), source_excerpt: 'cita inventada' }, scope);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source_excerpt).toBe(UNIT1);
      expect(r.value.warnings.length).toBeGreaterThan(0);
      expect(candidateStatus({ warnings: r.value.warnings })).toBe('needs_fix');
    }
  });

  it('excerpt de OTRA unidad: citando u-1 con texto de u-2 NO se valida contra una bolsa global', () => {
    const r = validateDirectCandidate({ ...candidate(), source_excerpt: UNIT2 }, scope);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source_excerpt).not.toBe(UNIT2);
      expect(r.value.source_excerpt).toBe(UNIT1);
    }
  });
});

describe('estados de candidata y run', () => {
  it('candidateStatus: sin avisos -> pending_review; con avisos -> needs_fix; NUNCA validated', () => {
    expect(candidateStatus({ warnings: [] })).toBe('pending_review');
    expect(candidateStatus({ warnings: ['x'] })).toBe('needs_fix');
    // Invariante de tipo + runtime: el conjunto de estados no incluye 'validated'.
    expect(['pending_review', 'needs_fix']).toContain(candidateStatus({ warnings: [] }));
  });
  it('mapRunStatus: 0 -> failed; parcial -> partial; completo -> completed', () => {
    expect(mapRunStatus({ created: 0, requested: 5, hadErrors: false })).toBe('failed');
    expect(mapRunStatus({ created: 3, requested: 5, hadErrors: false })).toBe('partial');
    expect(mapRunStatus({ created: 5, requested: 5, hadErrors: true })).toBe('partial');
    expect(mapRunStatus({ created: 5, requested: 5, hadErrors: false })).toBe('completed');
  });
});

describe('resolveProvider + parseProviderCandidates', () => {
  it('null sin proveedor real; OpenAI con clave; mensaje honesto', () => {
    expect(resolveProvider({ AI_PROVIDER: 'openai', OPENAI_API_KEY: '' })).toBeNull();
    expect(resolveProvider({ AI_PROVIDER: 'anthropic', OPENAI_API_KEY: 'k' })).toBeNull();
    expect(resolveProvider({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x', OPENAI_MODEL: 'gpt-4o' })).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
    });
    expect(DQG_PROVIDER_NOT_CONFIGURED_MESSAGE).toContain('todavía no está configurada en servidor');
  });
  it('parsea candidatas; rechaza basura', () => {
    expect(parseProviderCandidates(JSON.stringify({ candidates: [candidate()] })).ok).toBe(true);
    expect(parseProviderCandidates('no-json').ok).toBe(false);
    expect(parseProviderCandidates(JSON.stringify({ candidates: 'x' })).ok).toBe(false);
  });
});

describe('runDirectGeneration (ciclo de vida del run)', () => {
  function fakePort(over: Partial<DirectRunPort> = {}): DirectRunPort & { created: ValidatedDirectCandidate[]; finalized: { status: string; count: number } | null } {
    const state = {
      createdRun: false,
      created: [] as ValidatedDirectCandidate[],
      finalized: null as { status: string; count: number } | null,
      async createRun() {
        state.createdRun = true;
        return true;
      },
      async saveCandidate(c: ValidatedDirectCandidate) {
        state.created.push(c);
        return true;
      },
      async finalizeRun(status: string, count: number) {
        state.finalized = { status, count };
        return true;
      },
      ...over,
    };
    return state as unknown as DirectRunPort & { created: ValidatedDirectCandidate[]; finalized: { status: string; count: number } | null };
  }
  const valid = (): ValidatedDirectCandidate => {
    const r = validateDirectCandidate(candidate(), scope);
    if (!r.ok) throw new Error('fixture');
    return r.value;
  };

  it('positivo: crea run, persiste candidatas y finaliza completed', async () => {
    const port = fakePort();
    const res = await runDirectGeneration({ port, requested: 2, produce: async () => ({ ok: true, candidates: [valid(), valid()] }) });
    expect(res).toMatchObject({ ok: true, created: 2 });
    expect(port.finalized).toMatchObject({ status: 'completed', count: 2 });
  });

  it('proveedor falla: run failed, 0 candidatas, sin escrituras', async () => {
    const port = fakePort();
    const res = await runDirectGeneration({ port, requested: 2, produce: async () => ({ ok: false, code: DQG_ERROR.PROVIDER_FAILED, candidates: [] }) });
    expect(res.ok).toBe(false);
    expect(res.code).toBe(DQG_ERROR.PROVIDER_FAILED);
    expect(port.created.length).toBe(0);
    expect(port.finalized).toMatchObject({ status: 'failed', count: 0 });
  });

  it('sin candidatas validas -> NO_VALID_CANDIDATES y run failed', async () => {
    const port = fakePort();
    const res = await runDirectGeneration({ port, requested: 2, produce: async () => ({ ok: true, candidates: [] }) });
    expect(res.code).toBe(DQG_ERROR.NO_VALID_CANDIDATES);
    expect(port.finalized?.status).toBe('failed');
  });

  it('persistencia parcial -> partial cuando alguna candidata falla', async () => {
    let n = 0;
    const port = fakePort({
      async saveCandidate() {
        n += 1;
        return n === 1; // la primera ok, la segunda falla
      },
    });
    const res = await runDirectGeneration({ port, requested: 2, produce: async () => ({ ok: true, candidates: [valid(), valid()] }) });
    expect(res.ok).toBe(true);
    expect(res.created).toBe(1);
    expect((port as unknown as { finalized: { status: string } }).finalized.status).toBe('partial');
  });
});
