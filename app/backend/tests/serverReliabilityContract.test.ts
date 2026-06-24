// SPEC 040: tests del contrato COMPARTIDO del motor de fiabilidad y memoria.
// Logica pura, sin red ni proveedor. Importa el MISMO modulo que la Edge Function
// `generate-questions-from-studied-material`.

import { describe, it, expect } from 'vitest';
import {
  RELIABILITY_FEEDBACK_TYPES,
  RELIABILITY_SEVERITIES,
  DEFAULT_FEEDBACK_SEVERITY,
  RELIABILITY_ERROR,
  MAX_ERROR_MEMORIES_IN_PROMPT,
  MAX_ERROR_MEMORY_CHARS,
  AVOID_BLOCK_HEADER,
  isReliabilityFeedbackType,
  isReliabilitySeverity,
  resolveSeverity,
  validateReviewFeedback,
  classifyValidationOutcome,
  resolveMemoryLimits,
  selectErrorMemories,
  formatAvoidBlock,
  computeReliabilityMetrics,
  avoidInstructionFor,
  type ErrorMemoryRecord,
} from '../../../supabase/functions/_shared/reliability/contract';
// El bloque de "errores a evitar" se inyecta en el prompt de la generacion directa.
import { buildOpenAIRequest } from '../../../supabase/functions/_shared/direct-question-generation/contract';

describe('catalogo unico de feedback', () => {
  it('cubre 23 tipos canonicos y 4 severidades con default por tipo', () => {
    expect(RELIABILITY_FEEDBACK_TYPES.length).toBe(23);
    expect(RELIABILITY_SEVERITIES).toEqual(['low', 'medium', 'high', 'critical']);
    for (const t of RELIABILITY_FEEDBACK_TYPES) {
      expect(isReliabilityFeedbackType(t)).toBe(true);
      expect(isReliabilitySeverity(DEFAULT_FEEDBACK_SEVERITY[t])).toBe(true);
      expect(avoidInstructionFor(t).length).toBeGreaterThan(0);
    }
    expect(isReliabilityFeedbackType('ambiguous_statement')).toBe(false); // tipo legacy, no canonico
    expect(resolveSeverity('wrong_correct_answer')).toBe('critical');
    expect(resolveSeverity('too_easy', 'high')).toBe('high');
  });
});

describe('validateReviewFeedback (reject exige motivo + severidad)', () => {
  it('reject sin entradas -> REASON_REQUIRED', () => {
    expect(validateReviewFeedback('reject', [])).toMatchObject({ ok: false, code: RELIABILITY_ERROR.REASON_REQUIRED });
    expect(validateReviewFeedback('reject', null)).toMatchObject({ ok: false, code: RELIABILITY_ERROR.REASON_REQUIRED });
  });
  it('reject con tipo invalido o severidad invalida -> error', () => {
    expect(validateReviewFeedback('reject', [{ feedback_type: 'nope', severity: 'high' }])).toMatchObject({
      ok: false,
      code: RELIABILITY_ERROR.INVALID_FEEDBACK_TYPE,
    });
    expect(
      validateReviewFeedback('reject', [{ feedback_type: 'wrong_correct_answer', severity: 'urgente' }]),
    ).toMatchObject({ ok: false, code: RELIABILITY_ERROR.INVALID_SEVERITY });
  });
  it('reject valido normaliza severidad (default si ausente)', () => {
    const r = validateReviewFeedback('reject', [
      { feedback_type: 'ambiguous_question', severity: 'critical', comment: ' x ', suggested_fix: 'aclarar' },
      { feedback_type: 'too_easy' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value[0]).toMatchObject({ feedback_type: 'ambiguous_question', severity: 'critical', comment: 'x', suggested_fix: 'aclarar' });
      expect(r.value[1].severity).toBe(DEFAULT_FEEDBACK_SEVERITY.too_easy); // resuelta por catalogo
    }
  });
  it('needs_fix sin feedback es valido; accion invalida -> INVALID_ACTION', () => {
    expect(validateReviewFeedback('needs_fix', []).ok).toBe(true);
    expect(validateReviewFeedback('validate', undefined).ok).toBe(true);
    // @ts-expect-error accion fuera del catalogo
    expect(validateReviewFeedback('publish', []).code).toBe(RELIABILITY_ERROR.INVALID_ACTION);
  });
  it('classifyValidationOutcome distingue sin/menor/mayor edicion', () => {
    expect(classifyValidationOutcome({ edited: false })).toBe('validated_without_changes');
    expect(classifyValidationOutcome({ edited: true })).toBe('validated_with_minor_changes');
    expect(classifyValidationOutcome({ edited: true, majorEdit: true })).toBe('validated_after_major_edit');
  });
});

describe('selectErrorMemories (aislamiento + prioridad + limites)', () => {
  const base = (over: Partial<ErrorMemoryRecord>): ErrorMemoryRecord => ({
    workspace_id: 'ws-1',
    opposition_id: 'op-1',
    type: 'ambiguous_question',
    severity: 'medium',
    summary: 's',
    avoid_instruction: 'evita ambiguedad',
    occurrences: 1,
    ...over,
  });

  it('AISLA: descarta memoria de otro workspace u oposicion aunque llegue en la lista', () => {
    const mems = [
      base({ avoid_instruction: 'a-propia' }),
      base({ workspace_id: 'ws-2', avoid_instruction: 'a-otro-ws' }),
      base({ opposition_id: 'op-2', avoid_instruction: 'a-otra-op' }),
    ];
    const sel = selectErrorMemories(mems, { workspace_id: 'ws-1', opposition_id: 'op-1' }, { maxEntries: 10, maxChars: 3000 });
    expect(sel.map((m) => m.avoid_instruction)).toEqual(['a-propia']);
  });

  it('prioriza criticas, luego coincidencia de dificultad, luego ocurrencias', () => {
    const mems = [
      base({ avoid_instruction: 'low-occ', severity: 'low', occurrences: 9 }),
      base({ avoid_instruction: 'critica', severity: 'critical', occurrences: 1 }),
      base({ avoid_instruction: 'media-dif', severity: 'medium', difficulty: 'hard', occurrences: 1 }),
      base({ avoid_instruction: 'media-noDif', severity: 'medium', occurrences: 5 }),
    ];
    const sel = selectErrorMemories(mems, { workspace_id: 'ws-1', opposition_id: 'op-1', difficulty: 'hard' }, { maxEntries: 10, maxChars: 3000 });
    expect(sel[0].avoid_instruction).toBe('critica');
    expect(sel[1].avoid_instruction).toBe('media-dif'); // misma severidad media, gana la que casa dificultad
  });

  it('deduplica por instruccion y respeta maxEntries', () => {
    const mems = [
      base({ avoid_instruction: 'misma' }),
      base({ avoid_instruction: 'misma' }),
      base({ avoid_instruction: 'otra' }),
      base({ avoid_instruction: 'tercera' }),
    ];
    const sel = selectErrorMemories(mems, { workspace_id: 'ws-1', opposition_id: 'op-1' }, { maxEntries: 2, maxChars: 3000 });
    expect(sel.length).toBe(2);
    expect(new Set(sel.map((m) => m.avoid_instruction)).size).toBe(2);
  });
});

describe('formatAvoidBlock + resolveMemoryLimits', () => {
  it('formatea un bloque separado con cabecera; null si vacio; acota a maxChars', () => {
    expect(formatAvoidBlock([], 3000)).toBeNull();
    const block = formatAvoidBlock(
      [{ avoid_instruction: 'evita A' }, { avoid_instruction: 'evita B' }],
      3000,
    );
    expect(block).toContain(AVOID_BLOCK_HEADER);
    expect(block).toContain('- evita A');
    expect(block).toContain('- evita B');
    // maxChars muy bajo: no supera el limite.
    const tiny = formatAvoidBlock([{ avoid_instruction: 'x'.repeat(50) }], 30);
    expect((tiny ?? '').length).toBeLessThanOrEqual(30);
  });
  it('los secretos solo REDUCEN los limites', () => {
    expect(resolveMemoryLimits({})).toEqual({ maxEntries: MAX_ERROR_MEMORIES_IN_PROMPT, maxChars: MAX_ERROR_MEMORY_CHARS });
    expect(resolveMemoryLimits({ MAX_ERROR_MEMORIES_IN_PROMPT: '3', MAX_ERROR_MEMORY_CHARS: '500' })).toEqual({ maxEntries: 3, maxChars: 500 });
    expect(resolveMemoryLimits({ MAX_ERROR_MEMORIES_IN_PROMPT: '999', MAX_ERROR_MEMORY_CHARS: '999999' })).toEqual({
      maxEntries: MAX_ERROR_MEMORIES_IN_PROMPT,
      maxChars: MAX_ERROR_MEMORY_CHARS,
    });
  });
});

describe('inyeccion en el prompt de generacion directa (separada de la evidencia)', () => {
  const baseArgs = {
    model: 'gpt-4o-mini',
    difficulty: 'mixed' as const,
    question_count: 3,
    units: [{ unit_id: 'u-1', material_id: 'm-1', topic_label: 'Tema', excerpt: 'evidencia factual' }],
  };
  function userContent(req: Record<string, unknown>): string {
    const messages = req.messages as { role: string; content: string }[];
    return messages.find((m) => m.role === 'user')?.content ?? '';
  }
  it('sin memoria: el prompt NO incluye el bloque (comportamiento SPEC 039)', () => {
    const req = buildOpenAIRequest({ ...baseArgs, avoidBlock: null });
    expect(userContent(req)).not.toContain(AVOID_BLOCK_HEADER);
    expect(userContent(req)).toContain('evidencia factual');
  });
  it('con memoria: incluye el bloque "errores a evitar" SEPARADO, sin perder la evidencia', () => {
    const block = formatAvoidBlock([{ avoid_instruction: 'evita distractores defendibles' }], 3000);
    const req = buildOpenAIRequest({ ...baseArgs, avoidBlock: block });
    const content = userContent(req);
    expect(content).toContain(AVOID_BLOCK_HEADER);
    expect(content).toContain('evita distractores defendibles');
    expect(content).toContain('evidencia factual');
    // El bloque va DESPUES de la evidencia (no se mezcla como fuente).
    expect(content.indexOf('evidencia factual')).toBeLessThan(content.indexOf(AVOID_BLOCK_HEADER));
  });
});

describe('computeReliabilityMetrics (basicas por workspace/oposicion)', () => {
  it('calcula tasas, media de tiempo y top de errores; sin division por cero', () => {
    const m = computeReliabilityMetrics({
      generated_count: 10,
      validated_count: 4,
      rejected_count: 3,
      needs_fix_count: 2,
      review_times_ms: [1000, 3000],
      top_error_types: [
        { type: 'ambiguous_question', count: 2 },
        { type: 'wrong_correct_answer', count: 5 },
      ],
    });
    expect(m.validation_rate).toBe(0.4);
    expect(m.rejection_rate).toBe(0.3);
    expect(m.needs_fix_rate).toBe(0.2);
    expect(m.average_review_time_ms).toBe(2000);
    expect(m.top_error_types[0]).toEqual({ type: 'wrong_correct_answer', count: 5 });
    const zero = computeReliabilityMetrics({ generated_count: 0, validated_count: 0, rejected_count: 0, needs_fix_count: 0 });
    expect(zero.validation_rate).toBe(0);
    expect(zero.average_review_time_ms).toBeNull();
  });
});
