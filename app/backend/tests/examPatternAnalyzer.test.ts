// SPEC 028-F: analizador deterministico de examenes antiguos. Solo agregados +
// huellas anti-copia; sin red.

import { describe, expect, it } from 'vitest';
import { analyzeExamText } from '../src/index.js';

const EXAM = [
  '1) Cual es la capital de Espana? a) Madrid b) Paris c) Roma d) Berlin',
  '2) No es un derecho fundamental, excepto: a) Uno b) Dos c) Tres d) Cuatro',
  '3) Segun el articulo 14 de la Constitucion espanola: a) A b) B c) C d) D',
].join(' ');

describe('analyzeExamText', () => {
  it('detecta numero de preguntas, opciones y tipos comunes', () => {
    const r = analyzeExamText([EXAM]);
    expect(r.analyzed_question_count).toBe(3);
    expect(r.rules.option_count_distribution['4']).toBe(1);
    expect(r.rules.common_question_types).toContain('negativa');
    expect(r.rules.common_question_types).toContain('referencia legal');
    expect(r.rules.statement_length).not.toBeNull();
  });

  it('genera una huella por pregunta (anti-copia)', () => {
    const r = analyzeExamText([EXAM]);
    expect(r.fingerprints).toHaveLength(3);
    // Las huellas son enunciados normalizados, no contenido copiable.
    expect(r.fingerprints[0]).toMatch(/capital de espana/);
  });

  it('detecta patrones de trampa', () => {
    const r = analyzeExamText([
      '1) Sobre el plazo: a) Uno b) Dos c) Tres d) Todas son correctas',
    ]);
    expect(r.rules.trap_patterns).toContain('todas son correctas');
  });

  it('sin preguntas devuelve agregados vacios y un warning', () => {
    const r = analyzeExamText(['', '   ']);
    expect(r.analyzed_question_count).toBe(0);
    expect(r.fingerprints).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
