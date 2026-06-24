// SPEC 038: tests del contrato COMPARTIDO del estudio de material. Logica pura,
// sin red ni proveedor. Importa el MISMO modulo que la Edge Function.

import { describe, it, expect } from 'vitest';
import {
  STUDY_ERROR,
  STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE,
  validateStudyRequest,
  isStudyEligibleMaterial,
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

describe('resolveStudyProvider (OpenAI-only) + mensaje honesto', () => {
  it('null sin proveedor real; OpenAI con clave', () => {
    expect(resolveStudyProvider({ STUDY_PROVIDER: 'openai', OPENAI_API_KEY: '' })).toBeNull();
    expect(resolveStudyProvider({ STUDY_PROVIDER: 'anthropic', OPENAI_API_KEY: 'k' })).toBeNull();
    expect(resolveStudyProvider({ STUDY_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x', STUDY_MODEL: 'gpt-4o' })).toMatchObject({ provider: 'openai', model: 'gpt-4o' });
    expect(STUDY_PROVIDER_NOT_CONFIGURED_MESSAGE).toContain('no está configurado en servidor');
  });
});

const scope: StudyEvidenceScope = {
  material_ids: new Set(['mat-1']),
  material_section_ids: new Set(['sec-1']),
  source_reference_ids: new Set<string>(),
  evidence_text: 'La organización del Estado se estructura en departamentos.',
};
function unit(): ProviderUnit {
  return {
    title: 'Organización del Estado',
    summary: 'Estructura en departamentos.',
    material_id: 'mat-1',
    material_section_id: 'sec-1',
    source_reference_id: null,
    source_excerpt: 'La organización del Estado se estructura en departamentos.',
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
  it('rechaza sin titulo/resumen, material ajeno, puntero ajeno o ausente, y excerpt no anclado', () => {
    expect(validateStudyUnit({ ...unit(), title: '' }, scope).ok).toBe(false);
    expect(validateStudyUnit({ ...unit(), material_id: 'ajeno' }, scope).ok).toBe(false);
    expect(validateStudyUnit({ ...unit(), material_section_id: 'ajena' }, scope).ok).toBe(false);
    expect(validateStudyUnit({ ...unit(), material_section_id: null, source_reference_id: null }, scope).ok).toBe(false);
    // excerpt inventado -> se sustituye por la evidencia (sigue ok, anclado).
    const r = validateStudyUnit({ ...unit(), source_excerpt: 'cita inventada' }, scope);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.excerpt).toBe(scope.evidence_text);
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
