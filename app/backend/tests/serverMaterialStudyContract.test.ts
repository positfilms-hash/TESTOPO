// SPEC 038: tests del contrato COMPARTIDO del estudio de material. Logica pura,
// sin red ni proveedor. Importa el MISMO modulo que la Edge Function.

import { describe, it, expect } from 'vitest';
import {
  STUDY_ERROR,
  STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE,
  MAX_STUDY_MATERIALS,
  MAX_STUDY_TOTAL_SOURCE_CHARS,
  MAX_STUDY_TOTAL_UNITS,
  STUDY_PER_CALL_TIMEOUT_MS,
  resolveStudyLimits,
  validateStudyRequest,
  isStudyEligibleMaterial,
  evaluateStudyEligibility,
  classifyStudyDocument,
  resolveCanonicalSection,
  CANONICAL_SECTION_TITLE,
  MAX_CANONICAL_SECTION_CHARS,
  STUDY_INELIGIBLE_REASON,
  resolveStudyProvider,
  parseProviderUnits,
  validateStudyUnit,
  mapStudyRunStatus,
  mapMaterialStudyStatus,
  type StudyEvidenceScope,
  type ProviderUnit,
} from '../../../supabase/functions/_shared/material-study/contract';

const base = { workspace_id: 'ws-1', opposition_id: 'op-1', mode: 'all_eligible' as const, force_retry: false };

describe('validateStudyRequest', () => {
  it('acepta solo scope + opciones; por defecto mode=all_eligible, force_retry=false', () => {
    const r = validateStudyRequest({ workspace_id: 'ws-1', opposition_id: 'op-1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ mode: 'all_eligible', force_retry: false });
  });
  it.each(['user_id', 'material_text', 'ocr_text', 'prompt', 'concepts', 'image_base64', 'api_key'])(
    'rechaza el campo prohibido "%s"',
    (f) => {
      const r = validateStudyRequest({ ...base, [f]: 'x' });
      expect(r).toMatchObject({ ok: false, code: STUDY_ERROR.ARBITRARY_INPUT_FORBIDDEN });
    },
  );
  it('rechaza campos desconocidos y exige workspace/opposition', () => {
    expect(validateStudyRequest({ ...base, surprise: 1 }).ok).toBe(false);
    expect(validateStudyRequest({ ...base, workspace_id: '' })).toMatchObject({ ok: false, code: STUDY_ERROR.WORKSPACE_REQUIRED });
    expect(validateStudyRequest({ ...base, opposition_id: '' })).toMatchObject({ ok: false, code: STUDY_ERROR.OPPOSITION_REQUIRED });
  });
  it('rechaza mode no soportado y force_retry no booleano', () => {
    expect(validateStudyRequest({ ...base, mode: 'one' }).ok).toBe(false);
    expect(validateStudyRequest({ ...base, force_retry: 'no' }).ok).toBe(false);
  });
});

describe('isStudyEligibleMaterial', () => {
  const ok = {
    material: { status: 'active', extraction_status: 'completed' },
    classification: { classification: 'syllabus_material', needs_review: false },
  };
  it('acepta material legible + clase primaria sin needs_review (incl. OCR con avisos)', () => {
    expect(isStudyEligibleMaterial(ok)).toBe(true);
    expect(isStudyEligibleMaterial({ ...ok, material: { status: 'active', extraction_status: 'completed_ocr_with_warnings' } })).toBe(true);
  });
  it('rechaza no legible, obsoleto, needs_review y clase no primaria', () => {
    expect(isStudyEligibleMaterial({ ...ok, material: { status: 'active', extraction_status: 'ocr_failed' } })).toBe(false);
    expect(isStudyEligibleMaterial({ ...ok, material: { status: 'obsolete', extraction_status: 'completed' } })).toBe(false);
    expect(isStudyEligibleMaterial({ ...ok, classification: { classification: 'syllabus_material', needs_review: true } })).toBe(false);
    expect(isStudyEligibleMaterial({ ...ok, classification: { classification: 'old_exam_or_test', needs_review: false } })).toBe(false);
    expect(isStudyEligibleMaterial({ ...ok, classification: null })).toBe(false);
  });
});

describe('evaluateStudyEligibility (motivo EXACTO de inelegibilidad)', () => {
  const m = { status: 'active', extraction_status: 'completed' };
  it('devuelve el motivo por el que un material legible no se estudia', () => {
    expect(
      evaluateStudyEligibility({ material: { status: 'obsolete', extraction_status: 'completed' }, classification: null }),
    ).toMatchObject({ eligible: false, reason: STUDY_INELIGIBLE_REASON.OBSOLETE });
    expect(
      evaluateStudyEligibility({ material: { status: 'active', extraction_status: 'ocr_failed' }, classification: null }),
    ).toMatchObject({ eligible: false, reason: STUDY_INELIGIBLE_REASON.NOT_READABLE });
    // Legible pero SIN clasificacion resuelta -> fail-closed (no se inventa estado).
    expect(evaluateStudyEligibility({ material: m, classification: null })).toMatchObject({
      eligible: false,
      reason: STUDY_INELIGIBLE_REASON.UNCLASSIFIED,
    });
    expect(
      evaluateStudyEligibility({ material: m, classification: { classification: 'syllabus_material', needs_review: true } }),
    ).toMatchObject({ eligible: false, reason: STUDY_INELIGIBLE_REASON.NEEDS_REVIEW });
    expect(
      evaluateStudyEligibility({ material: m, classification: { classification: 'old_exam_or_test', needs_review: false } }),
    ).toMatchObject({ eligible: false, reason: STUDY_INELIGIBLE_REASON.NOT_PRIMARY });
    expect(
      evaluateStudyEligibility({ material: m, classification: { classification: 'syllabus_material', needs_review: false } }),
    ).toMatchObject({ eligible: true });
  });
});

// Reproduce el BUG BLOQUEANTE de staging: un material LEGIBLE que la UI muestra como
// "listo" pero que la Function rechazaba con NO_ELIGIBLE_MATERIAL por exigir una
// document_classifications primaria sin needs_review ejecutada antes por el usuario.
// El fix hace "Estudiar material" AUTOSUFICIENTE: el servidor clasifica internamente
// (classifyStudyDocument) y entonces el material es elegible — sin indice/temario.
describe('autosuficiencia: clasificacion interna desacopla el estudio del indice', () => {
  const readable = { status: 'active', extraction_status: 'completed' };
  const SYLLABUS_TEXT = [
    'TEMA 1 - La organizacion administrativa del sector publico.',
    'La Administracion General del Estado se ordena en organos superiores y',
    'directivos. El desarrollo de este tema abarca los principios de jerarquia,',
    'competencia y coordinacion, asi como la distribucion territorial y la',
    'estructura de los departamentos y sus unidades administrativas inferiores.',
  ].join('\n');

  it('BUG: material legible SIN clasificacion previa NO era elegible (coupling)', () => {
    // Asi fallaba en staging: sin clasificacion -> no elegible -> NO_ELIGIBLE_MATERIAL.
    expect(isStudyEligibleMaterial({ material: readable, classification: undefined })).toBe(false);
    expect(evaluateStudyEligibility({ material: readable, classification: undefined })).toMatchObject({
      eligible: false,
      reason: STUDY_INELIGIBLE_REASON.UNCLASSIFIED,
    });
  });

  it('FIX: el servidor clasifica el texto y el material pasa a elegible', () => {
    const auto = classifyStudyDocument({ text: SYLLABUS_TEXT, filename: 'tema-1.pdf' });
    expect(auto.classification).toBe('syllabus_material');
    expect(auto.needs_review).toBe(false);
    expect(evaluateStudyEligibility({ material: readable, classification: auto })).toMatchObject({
      eligible: true,
    });
  });

  it('FAIL-CLOSED: examen antiguo -> no primaria; texto ambiguo -> needs_review', () => {
    const examText = [
      '1. La capital de Espana es:',
      'a) Madrid',
      'b) Barcelona',
      'c) Sevilla',
      'd) Valencia',
      'Pregunta de examen. Respuestas correctas al final.',
    ].join('\n');
    const exam = classifyStudyDocument({ text: examText, filename: 'examen-2019.pdf' });
    expect(exam.classification).toBe('old_exam_or_test');
    expect(evaluateStudyEligibility({ material: readable, classification: exam })).toMatchObject({
      eligible: false,
      reason: STUDY_INELIGIBLE_REASON.NOT_PRIMARY,
    });

    const ambiguous = classifyStudyDocument({ text: 'Texto cualquiera sin senales claras de tipo.', filename: 'x.pdf' });
    expect(ambiguous.needs_review).toBe(true);
    expect(evaluateStudyEligibility({ material: readable, classification: ambiguous })).toMatchObject({
      eligible: false,
      reason: STUDY_INELIGIBLE_REASON.NEEDS_REVIEW,
    });

    // Sin texto extraible -> not_analyzable (needs_review) -> no se estudia.
    const empty = classifyStudyDocument({ text: '   ', filename: 'scan.pdf' });
    expect(empty.classification).toBe('not_analyzable');
    expect(empty.needs_review).toBe(true);
  });
});

// Reproduce EXACTAMENTE el bug de staging: material `completed` con texto en
// materials.content_text pero CERO material_sections (active_sections=0). Antes la
// Edge Function solo leia material_sections, la autoclasificacion recibia vacio y
// devolvia NO_ELIGIBLE_MATERIAL. El fix crea una seccion canonica desde content_text
// (solo en servidor) y entonces clasifica/estudia, anclando las unidades a esa
// seccion concreta. Tambien cubre el caso `completed` sin content_text.
describe('seccion canonica: completed + content_text + 0 secciones -> estudiable', () => {
  const readable = { status: 'active', extraction_status: 'completed' };
  const DOC_TEXT = [
    'TEMA 3 - El procedimiento administrativo comun de las administraciones publicas.',
    'El procedimiento se inicia de oficio o a solicitud del interesado. Las fases son',
    'iniciacion, ordenacion, instruccion y terminacion. La resolucion debe ser motivada',
    'y notificada en plazo; el silencio administrativo puede ser estimatorio o',
    'desestimatorio segun la materia y la norma aplicable a cada caso concreto.',
  ].join('\n');

  it('crea una seccion canonica desde content_text cuando no hay secciones', () => {
    const r = resolveCanonicalSection({ activeSectionCount: 0, content_text: DOC_TEXT, title: 'apuntes.pdf' });
    expect(r.kind).toBe('create');
    if (r.kind === 'create') {
      expect(r.section.content_text).toBe(DOC_TEXT);
      expect(r.section.section_title).toBe('apuntes.pdf');
      expect(r.section.section_type).toBe('chunk');
      expect(r.section.classification).toBe('study_content');
    }
  });

  it('ESTUDIO EXITOSO end-to-end (puro): canonica -> clasifica -> elegible -> unidad anclada', () => {
    // 1) Sin secciones pero con content_text -> seccion canonica.
    const resolution = resolveCanonicalSection({ activeSectionCount: 0, content_text: DOC_TEXT, title: 'apuntes.pdf' });
    expect(resolution.kind).toBe('create');
    if (resolution.kind !== 'create') return;
    const sectionText = resolution.section.content_text;

    // 2) La autoclasificacion recibe el texto de la canonica (ya NO vacio) -> clase
    //    PRIMARIA (de estudio) sin needs_review; antes recibia vacio -> not_analyzable.
    const auto = classifyStudyDocument({ text: sectionText, filename: 'documento.pdf' });
    expect(auto.needs_review).toBe(false);

    // 3) Elegible (ya no NO_ELIGIBLE_MATERIAL).
    expect(evaluateStudyEligibility({ material: readable, classification: auto })).toMatchObject({ eligible: true });

    // 4) La unidad de estudio queda ANCLADA a esa seccion concreta (evidencia para
    //    SPEC 039): el excerpt se valida contra el texto de la seccion canonica.
    const scope: StudyEvidenceScope = {
      material_ids: new Set(['mat-1']),
      section_texts: new Map([['canon-1', sectionText]]),
      reference_texts: new Map<string, string>(),
    };
    const unit: ProviderUnit = {
      title: 'Fases del procedimiento',
      summary: 'Iniciacion, ordenacion, instruccion y terminacion.',
      material_id: 'mat-1',
      material_section_id: 'canon-1',
      source_reference_id: null,
      source_excerpt: 'Las fases son iniciacion, ordenacion, instruccion y terminacion.',
      importance: 'high',
      confidence: 0.9,
    };
    const v = validateStudyUnit(unit, scope);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.material_section_id).toBe('canon-1');
  });

  it('completed SIN content_text (ni secciones) -> bloqueo honesto especifico', () => {
    for (const content_text of ['', '   ', null, undefined]) {
      const r = resolveCanonicalSection({ activeSectionCount: 0, content_text });
      expect(r).toMatchObject({ kind: 'no_text', reason: STUDY_INELIGIBLE_REASON.COMPLETED_WITHOUT_TEXT });
    }
  });

  it('si ya hay secciones activas, no se crea ninguna canonica', () => {
    expect(resolveCanonicalSection({ activeSectionCount: 2, content_text: DOC_TEXT })).toEqual({ kind: 'has_sections' });
  });

  it('titulo por defecto y tope de tamano de la seccion canonica', () => {
    const noTitle = resolveCanonicalSection({ activeSectionCount: 0, content_text: 'texto suficiente para una seccion.' });
    expect(noTitle.kind).toBe('create');
    if (noTitle.kind === 'create') expect(noTitle.section.section_title).toBe(CANONICAL_SECTION_TITLE);

    const huge = 'a'.repeat(MAX_CANONICAL_SECTION_CHARS + 5000);
    const capped = resolveCanonicalSection({ activeSectionCount: 0, content_text: huge });
    if (capped.kind === 'create') {
      expect(capped.section.content_text.length).toBe(MAX_CANONICAL_SECTION_CHARS);
    }
  });
});

describe('resolveStudyProvider (OpenAI-only) + mensaje honesto', () => {
  it('null sin proveedor real; OpenAI con clave', () => {
    expect(resolveStudyProvider({ STUDY_PROVIDER: 'openai', OPENAI_API_KEY: '' })).toBeNull();
    expect(resolveStudyProvider({ STUDY_PROVIDER: 'anthropic', OPENAI_API_KEY: 'k' })).toBeNull();
    expect(resolveStudyProvider({ STUDY_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x', STUDY_MODEL: 'gpt-4o' })).toMatchObject({ provider: 'openai', model: 'gpt-4o' });
    expect(STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE).toContain('no está configurado en servidor');
  });
});

// Dos secciones con TEXTOS DISTINTOS + una referencia: el anclaje es POR PUNTERO,
// nunca contra la concatenacion del material (SPEC 038 P0 #2).
const SEC1 = 'La organización del Estado se estructura en departamentos.';
const SEC2 = 'El plazo de presentación es de diez días hábiles.';
const REF1 = 'El artículo 103 regula el funcionamiento de la Administración.';
const scope: StudyEvidenceScope = {
  material_ids: new Set(['mat-1']),
  section_texts: new Map([
    ['sec-1', SEC1],
    ['sec-2', SEC2],
  ]),
  reference_texts: new Map([['ref-1', REF1]]),
};
function unit(): ProviderUnit {
  return {
    title: 'Organización del Estado',
    summary: 'Estructura en departamentos.',
    material_id: 'mat-1',
    material_section_id: 'sec-1',
    source_reference_id: null,
    source_excerpt: SEC1,
    importance: 'high',
    confidence: 0.9,
  };
}

describe('validateStudyUnit (anclaje a fuente)', () => {
  it('acepta una unidad anclada y acotada', () => {
    const r = validateStudyUnit(unit(), scope);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.material_section_id).toBe('sec-1');
  });
  it('acepta una unidad anclada a una source_reference del scope', () => {
    const r = validateStudyUnit(
      { ...unit(), material_section_id: null, source_reference_id: 'ref-1', source_excerpt: REF1 },
      scope,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.excerpt).toBe(REF1);
  });
  it('rechaza sin titulo/resumen, material ajeno, puntero ajeno o ausente', () => {
    expect(validateStudyUnit({ ...unit(), title: '' }, scope).ok).toBe(false);
    expect(validateStudyUnit({ ...unit(), material_id: 'ajeno' }, scope).ok).toBe(false);
    expect(validateStudyUnit({ ...unit(), material_section_id: 'ajena' }, scope).ok).toBe(false);
    expect(validateStudyUnit({ ...unit(), material_section_id: null, source_reference_id: 'ajena' }, scope).ok).toBe(false);
    expect(validateStudyUnit({ ...unit(), material_section_id: null, source_reference_id: null }, scope).ok).toBe(false);
  });
  it('excerpt inventado -> se sustituye por el texto de LA seccion citada (no la concatenacion)', () => {
    const r = validateStudyUnit({ ...unit(), source_excerpt: 'cita inventada' }, scope);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.excerpt).toBe(SEC1);
  });
  it('extracto de OTRA seccion: citando sec-1 con texto de sec-2 NO se valida contra la concatenacion', () => {
    // Con la concatenacion antigua esto se habria aceptado VERBATIM (SEC2 estaba en
    // la evidencia global). Ahora se ancla SOLO a sec-1: el excerpt nunca es SEC2.
    const r = validateStudyUnit({ ...unit(), source_excerpt: SEC2 }, scope);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.excerpt).not.toBe(SEC2);
      expect(r.value.excerpt).toBe(SEC1);
    }
  });
});

describe('resolveStudyLimits (presupuesto GLOBAL por run)', () => {
  it('ausente/invalido -> maximos seguros', () => {
    const l = resolveStudyLimits({});
    expect(l.maxMaterials).toBe(MAX_STUDY_MATERIALS);
    expect(l.totalSourceChars).toBe(MAX_STUDY_TOTAL_SOURCE_CHARS);
    expect(l.totalUnits).toBe(MAX_STUDY_TOTAL_UNITS);
    expect(l.perCallTimeoutMs).toBe(STUDY_PER_CALL_TIMEOUT_MS);
    const bad = resolveStudyLimits({ STUDY_MAX_MATERIALS: 'x', STUDY_MAX_TOTAL_CHARS: '0', STUDY_MAX_TOTAL_UNITS: '-5' });
    expect(bad.maxMaterials).toBe(MAX_STUDY_MATERIALS);
    expect(bad.totalSourceChars).toBe(MAX_STUDY_TOTAL_SOURCE_CHARS);
    expect(bad.totalUnits).toBe(MAX_STUDY_TOTAL_UNITS);
  });
  it('un secreto solo puede ENDURECER, nunca superar el maximo seguro', () => {
    const tight = resolveStudyLimits({
      STUDY_MAX_MATERIALS: '5',
      STUDY_MAX_TOTAL_CHARS: '1000',
      STUDY_MAX_TOTAL_UNITS: '7',
      STUDY_PER_CALL_TIMEOUT_SECONDS: '10',
    });
    expect(tight).toMatchObject({ maxMaterials: 5, totalSourceChars: 1000, totalUnits: 7, perCallTimeoutMs: 10000 });
    const over = resolveStudyLimits({
      STUDY_MAX_MATERIALS: '99999',
      STUDY_MAX_TOTAL_CHARS: '99999999',
      STUDY_MAX_TOTAL_UNITS: '99999',
      STUDY_PER_CALL_TIMEOUT_SECONDS: '99999',
    });
    expect(over.maxMaterials).toBe(MAX_STUDY_MATERIALS);
    expect(over.totalSourceChars).toBe(MAX_STUDY_TOTAL_SOURCE_CHARS);
    expect(over.totalUnits).toBe(MAX_STUDY_TOTAL_UNITS);
    expect(over.perCallTimeoutMs).toBe(STUDY_PER_CALL_TIMEOUT_MS);
  });
});

describe('parseProviderUnits + mapeo de estados', () => {
  it('parsea units; rechaza basura', () => {
    expect(parseProviderUnits(JSON.stringify({ units: [unit()] })).ok).toBe(true);
    expect(parseProviderUnits('no-json').ok).toBe(false);
    expect(parseProviderUnits(JSON.stringify({ units: 'x' })).ok).toBe(false);
  });
  it('run: 0 unidades -> failed; con avisos -> completed_with_warnings; limpio -> completed', () => {
    expect(mapStudyRunStatus({ unitsCreated: 0, hadErrors: false, hadWarnings: false })).toBe('failed');
    expect(mapStudyRunStatus({ unitsCreated: 2, hadErrors: false, hadWarnings: true })).toBe('completed_with_warnings');
    expect(mapStudyRunStatus({ unitsCreated: 2, hadErrors: false, hadWarnings: false })).toBe('completed');
  });
  it('material: sin unidades -> study_failed; con avisos OCR -> studied_with_warnings; limpio -> studied', () => {
    expect(mapMaterialStudyStatus({ hasUsableUnits: false, hadOcrWarnings: false })).toBe('study_failed');
    expect(mapMaterialStudyStatus({ hasUsableUnits: true, hadOcrWarnings: true })).toBe('studied_with_warnings');
    expect(mapMaterialStudyStatus({ hasUsableUnits: true, hadOcrWarnings: false })).toBe('studied');
  });
});
