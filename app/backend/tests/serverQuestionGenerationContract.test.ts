// SPEC 033: tests del contrato COMPARTIDO de la generacion en servidor. Logica
// pura, sin red ni proveedor real: valida el body de la peticion (solo IDs/
// parametros), la elegibilidad de clasificacion y la validacion estructural de
// la salida del proveedor (incluida la regla dura no-`validated`).
//
// Importa el MISMO modulo que usa la Edge Function (`supabase/functions/_shared`)
// para que no haya duplicacion de reglas.

import { describe, it, expect } from 'vitest';
import {
  QG_ERROR,
  validateGenerateRequest,
  validateCandidate,
  isEligiblePrimaryClass,
  groundedExcerpt,
  candidateStatus,
  mapRunStatus,
  type EvidenceScope,
  type ProviderCandidate,
} from '../../../supabase/functions/_shared/question-generation/contract';

const baseBody = {
  workspace_id: 'ws-1',
  opposition_id: 'op-1',
  topic_id: 'tp-1',
  difficulty: 'easy' as const,
  question_count: 3,
  source_mode: 'topic_sources' as const,
};

describe('validateGenerateRequest', () => {
  it('acepta un body con solo IDs y parametros acotados', () => {
    const r = validateGenerateRequest(baseBody);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.question_count).toBe(3);
      expect(r.value.source_mode).toBe('topic_sources');
      expect(r.value.selected_material_section_ids).toEqual([]);
    }
  });

  it('por defecto source_mode = topic_sources', () => {
    const { source_mode, ...rest } = baseBody;
    const r = validateGenerateRequest(rest);
    expect(r.ok && r.value.source_mode).toBe('topic_sources');
  });

  it.each([
    'user_id',
    'source_text',
    'raw_text',
    'manual_context',
    'custom_prompt',
    'prompt',
  ])('rechaza el campo arbitrario/factual "%s"', (field) => {
    const r = validateGenerateRequest({ ...baseBody, [field]: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(QG_ERROR.ARBITRARY_TEXT_FORBIDDEN);
  });

  it('rechaza campos desconocidos (whitelist estricta)', () => {
    const r = validateGenerateRequest({ ...baseBody, surprise: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(QG_ERROR.ARBITRARY_TEXT_FORBIDDEN);
  });

  it('exige workspace, opposition y topic', () => {
    expect(validateGenerateRequest({ ...baseBody, workspace_id: '' })).toMatchObject({
      ok: false,
      code: QG_ERROR.WORKSPACE_REQUIRED,
    });
    expect(validateGenerateRequest({ ...baseBody, opposition_id: '' })).toMatchObject({
      ok: false,
      code: QG_ERROR.OPPOSITION_REQUIRED,
    });
    expect(validateGenerateRequest({ ...baseBody, topic_id: '' })).toMatchObject({
      ok: false,
      code: QG_ERROR.TOPIC_REQUIRED,
    });
  });

  it('rechaza dificultad invalida', () => {
    const r = validateGenerateRequest({ ...baseBody, difficulty: 'impossible' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(QG_ERROR.INVALID_REQUEST);
  });

  it.each([0, 21, 2.5, -1])('rechaza question_count fuera de rango/no entero: %s', (n) => {
    const r = validateGenerateRequest({ ...baseBody, question_count: n });
    expect(r.ok).toBe(false);
  });

  it('rechaza manual IDs que no son arrays de strings', () => {
    const r = validateGenerateRequest({
      ...baseBody,
      selected_material_section_ids: [1, 2],
    });
    expect(r.ok).toBe(false);
  });
});

describe('isEligiblePrimaryClass', () => {
  it('acepta solo clases primarias factuales', () => {
    for (const cls of [
      'syllabus_material',
      'legal_text',
      'notes_or_summary',
      'index_or_table_of_contents',
    ]) {
      expect(isEligiblePrimaryClass(cls)).toBe(true);
    }
  });

  it('rechaza clases secundarias/prohibidas', () => {
    for (const cls of [
      'old_exam_or_test',
      'not_analyzable',
      'ambiguous',
      'irrelevant',
      'needs_review',
      undefined,
      null,
    ]) {
      expect(isEligiblePrimaryClass(cls)).toBe(false);
    }
  });
});

describe('groundedExcerpt', () => {
  it('conserva la cita de la IA si esta contenida en la evidencia', () => {
    expect(groundedExcerpt('El plazo es de 10 dias', 'Articulo 5. El plazo es de 10 dias habiles.')).toBe(
      'El plazo es de 10 dias',
    );
  });
  it('sustituye por la evidencia si la cita es inventada', () => {
    expect(groundedExcerpt('cita inventada', 'texto real recuperado')).toBe('texto real recuperado');
  });
});

const scope: EvidenceScope = {
  topic_id: 'tp-1',
  material_ids: new Set(['mat-1']),
  material_section_ids: new Set(['sec-1']),
  source_reference_ids: new Set(['ref-1']),
  evidence_text: 'El plazo de presentacion es de 10 dias habiles.',
};

function validCandidate(): ProviderCandidate {
  return {
    statement: '¿Cual es el plazo de presentacion?',
    options: [
      { text: '10 dias habiles', is_correct: true },
      { text: '5 dias habiles', is_correct: false },
    ],
    explanation: 'El plazo es de 10 dias habiles segun la evidencia.',
    difficulty: 'easy',
    topic_id: 'tp-1',
    material_id: 'mat-1',
    material_section_id: 'sec-1',
    source_reference_id: null,
    source_excerpt: 'El plazo de presentacion es de 10 dias habiles.',
    warnings: [],
  };
}

describe('validateCandidate', () => {
  it('acepta una candidata estructuralmente valida y anclada', () => {
    const r = validateCandidate(validCandidate(), scope);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.material_section_id).toBe('sec-1');
      expect(r.warnings).toHaveLength(0);
    }
  });

  it('rechaza status validated propuesto por la IA (regla dura)', () => {
    const r = validateCandidate({ ...validCandidate(), status: 'validated' }, scope);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(QG_ERROR.INVALID_OUTPUT);
  });

  it('rechaza si no hay exactamente una opcion correcta', () => {
    const two = validCandidate();
    (two.options as { is_correct: boolean }[])[1].is_correct = true;
    expect(validateCandidate(two, scope).ok).toBe(false);
  });

  it('rechaza menos de dos opciones', () => {
    const one = validCandidate();
    one.options = [{ text: 'unica', is_correct: true }];
    expect(validateCandidate(one, scope).ok).toBe(false);
  });

  it('rechaza dificultad invalida', () => {
    expect(validateCandidate({ ...validCandidate(), difficulty: 'x' }, scope).ok).toBe(false);
  });

  it('rechaza tema que no coincide', () => {
    expect(validateCandidate({ ...validCandidate(), topic_id: 'otro' }, scope).ok).toBe(false);
  });

  it('rechaza material ajeno al scope', () => {
    const r = validateCandidate({ ...validCandidate(), material_id: 'ajeno' }, scope);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(QG_ERROR.SOURCE_FORBIDDEN);
  });

  it('rechaza seccion/referencia ajena al scope', () => {
    const r = validateCandidate(
      { ...validCandidate(), material_section_id: 'ajena' },
      scope,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(QG_ERROR.SOURCE_FORBIDDEN);
  });

  it('exige al menos un puntero concreto (seccion o referencia)', () => {
    const r = validateCandidate(
      { ...validCandidate(), material_section_id: null, source_reference_id: null },
      scope,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(QG_ERROR.SOURCE_REQUIRED);
  });

  it('sustituye un excerpt inventado y marca warning (=> needs_fix)', () => {
    const r = validateCandidate(
      { ...validCandidate(), source_excerpt: 'cita totalmente inventada' },
      scope,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source_excerpt).toBe(scope.evidence_text);
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(candidateStatus({ hasCriticalFinding: false, warnings: r.warnings })).toBe(
        'needs_fix',
      );
    }
  });
});

describe('candidateStatus / mapRunStatus', () => {
  it('pending_review sin findings ni warnings; needs_fix con warnings', () => {
    expect(candidateStatus({ hasCriticalFinding: false, warnings: [] })).toBe('pending_review');
    expect(candidateStatus({ hasCriticalFinding: true, warnings: [] })).toBe('needs_fix');
    expect(candidateStatus({ hasCriticalFinding: false, warnings: ['w'] })).toBe('needs_fix');
  });

  it('nunca devuelve validated', () => {
    const statuses = [
      candidateStatus({ hasCriticalFinding: false, warnings: [] }),
      candidateStatus({ hasCriticalFinding: true, warnings: ['w'] }),
    ];
    expect(statuses).not.toContain('validated');
  });

  it('mapea el estado del run a los valores del CHECK existente', () => {
    expect(mapRunStatus({ created: 0, requested: 3, hadErrors: true })).toBe('failed');
    expect(mapRunStatus({ created: 2, requested: 3, hadErrors: false })).toBe('partial');
    expect(mapRunStatus({ created: 3, requested: 3, hadErrors: false })).toBe('completed');
  });
});
