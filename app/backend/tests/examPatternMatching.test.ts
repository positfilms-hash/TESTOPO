// SPEC 028-F: helpers puros de generación adaptativa (anti-copia, calidad, estilo).

import { describe, expect, it } from 'vitest';
import {
  assessCopyRisk,
  scoreCandidateQuality,
  formatStyleRules,
  type StyleProfileRules,
} from '../src/index.js';

describe('assessCopyRisk', () => {
  const fingerprints = ['cual es el plazo de recurso administrativo'];

  it('detecta copia casi exacta', () => {
    const r = assessCopyRisk('¿Cuál es el plazo de recurso administrativo?', fingerprints);
    expect(r.risk).toBe(true);
    expect(r.score).toBe(1);
  });

  it('no marca riesgo en enunciados distintos', () => {
    const r = assessCopyRisk('Define el concepto de acto administrativo nulo', fingerprints);
    expect(r.risk).toBe(false);
  });

  it('sin huellas, nunca hay riesgo', () => {
    expect(assessCopyRisk('cualquier cosa', []).risk).toBe(false);
  });
});

describe('scoreCandidateQuality', () => {
  const rules: StyleProfileRules = {
    option_count_distribution: { '4': 1 },
    difficulty_distribution: {},
    common_question_types: [],
    trap_patterns: [],
    legal_vs_conceptual: { legal: 0.5, conceptual: 0.5 },
    statement_length: { min: 20, max: 120, avg: 60 },
    style_notes: null,
  };

  it('puntúa alto una candidata anclada, clara y con el formato del examen', () => {
    const q = scoreCandidateQuality({
      grounded: true,
      option_count: 4,
      statement_length: 60,
      single_correct: true,
      requested_difficulty: 'medium',
      candidate_difficulty: 'medium',
      rules,
    });
    expect(q.single_answer_confidence).toBe(1);
    expect(q.exam_style_similarity).toBe(1);
    expect(q.overall).toBeGreaterThan(0.8);
  });

  it('penaliza fuente no verificada y enunciado muy corto (con warnings)', () => {
    const q = scoreCandidateQuality({
      grounded: false,
      option_count: 3,
      statement_length: 8,
      single_correct: true,
      requested_difficulty: 'hard',
      candidate_difficulty: 'easy',
      rules: null,
    });
    expect(q.source_grounding).toBeLessThan(1);
    expect(q.clarity).toBeLessThan(0.5);
    expect(q.warnings.length).toBeGreaterThan(0);
  });
});

describe('formatStyleRules', () => {
  it('produce líneas legibles de estilo (no factual)', () => {
    const lines = formatStyleRules({
      option_count_distribution: { '4': 0.9, '3': 0.1 },
      difficulty_distribution: {},
      common_question_types: ['negativa', 'referencia legal'],
      trap_patterns: ['todas son correctas'],
      legal_vs_conceptual: { legal: 0.7, conceptual: 0.3 },
      statement_length: { min: 20, max: 120, avg: 60 },
      style_notes: null,
    });
    expect(lines.join(' ')).toMatch(/4 opciones/);
    expect(lines.join(' ')).toMatch(/negativa/);
    expect(lines.join(' ')).toMatch(/precision legal/i);
  });
});
