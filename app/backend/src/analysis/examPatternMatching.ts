// Helpers PUROS de la generacion adaptativa (SPEC 028-F): anti-copia, puntuacion
// de calidad y formateo de reglas de estilo. Sin red ni estado.

import type { Difficulty } from '../models/enums.js';
import type { StyleProfileRules } from '../models/examPatternLearning.js';

// --- Normalizacion comun (igual criterio que el analizador) ---
export function normalizeStatement(value: string): string {
  return Array.from((value ?? '').normalize('NFD'))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeStatement(value).split(' ').filter((t) => t.length > 2));
}

// Similitud de Jaccard entre conjuntos de tokens (0..1).
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  return inter / (a.size + b.size - inter);
}

export interface CopyRiskResult {
  risk: boolean;
  score: number;
}

// Compara un enunciado contra las huellas de examenes antiguos. Riesgo si el
// parecido (Jaccard de tokens) supera el umbral, o si es subcadena casi exacta.
export function assessCopyRisk(
  statement: string,
  fingerprints: string[],
  threshold = 0.85,
): CopyRiskResult {
  const norm = normalizeStatement(statement);
  if (norm.length === 0 || fingerprints.length === 0) {
    return { risk: false, score: 0 };
  }
  const stmtTokens = tokens(statement);
  let best = 0;
  for (const fp of fingerprints) {
    const fpNorm = normalizeStatement(fp);
    if (fpNorm.length === 0) continue;
    if (norm === fpNorm || norm.includes(fpNorm) || fpNorm.includes(norm)) {
      return { risk: true, score: 1 };
    }
    best = Math.max(best, jaccard(stmtTokens, tokens(fp)));
  }
  return { risk: best >= threshold, score: round2(best) };
}

// --- Puntuacion de calidad por candidata (transparente; NUNCA aprueba) ---
export interface QualityScoreComponents {
  source_grounding: number;
  exam_style_similarity: number;
  clarity: number;
  single_answer_confidence: number;
  difficulty_fit: number;
  overall: number;
  warnings: string[];
}

export interface QualityScoreInput {
  grounded: boolean;
  option_count: number;
  statement_length: number;
  single_correct: boolean;
  requested_difficulty: Difficulty | 'mixed';
  candidate_difficulty: Difficulty | null;
  rules: StyleProfileRules | null;
}

export function scoreCandidateQuality(input: QualityScoreInput): QualityScoreComponents {
  const warnings: string[] = [];

  const source_grounding = input.grounded ? 1 : 0.4;
  if (!input.grounded) warnings.push('La cita de fuente no se ha podido verificar.');

  const exam_style_similarity = styleSimilarity(input.option_count, input.rules);

  const clarity = clarityScore(input.statement_length);
  if (clarity < 0.5) warnings.push('Longitud de enunciado fuera del rango habitual.');

  const single_answer_confidence = input.single_correct ? 1 : 0;
  if (!input.single_correct) warnings.push('No hay exactamente una respuesta correcta.');

  const difficulty_fit =
    input.requested_difficulty === 'mixed' ||
    input.candidate_difficulty === input.requested_difficulty
      ? 1
      : 0.6;

  const overall = round2(
    (source_grounding +
      exam_style_similarity +
      clarity +
      single_answer_confidence +
      difficulty_fit) /
      5,
  );

  return {
    source_grounding: round2(source_grounding),
    exam_style_similarity: round2(exam_style_similarity),
    clarity: round2(clarity),
    single_answer_confidence,
    difficulty_fit,
    overall,
    warnings,
  };
}

function styleSimilarity(
  optionCount: number,
  rules: StyleProfileRules | null,
): number {
  if (!rules) {
    return 0.5; // sin perfil activo: neutro
  }
  const dist = rules.option_count_distribution;
  const keys = Object.keys(dist);
  if (keys.length === 0) {
    return 0.5;
  }
  // Frecuencia del nº de opciones de la candidata en los examenes oficiales.
  const freq = dist[String(optionCount)] ?? 0;
  return round2(0.5 + 0.5 * Math.min(1, freq));
}

function clarityScore(length: number): number {
  if (length < 15) return 0.3;
  if (length > 400) return 0.4;
  return 1;
}

// --- Formateo de reglas de estilo para el prompt (NO factual) ---
export function formatStyleRules(rules: StyleProfileRules): string[] {
  const lines: string[] = [];
  const modal = modalOptionCount(rules.option_count_distribution);
  if (modal) {
    lines.push(`Usa preferentemente ${modal} opciones por pregunta.`);
  }
  if (rules.common_question_types.length > 0) {
    lines.push(
      `Tipos de pregunta frecuentes en los examenes: ${rules.common_question_types.join(', ')}.`,
    );
  }
  if (rules.trap_patterns.length > 0) {
    lines.push(
      `Distractores/trampas habituales (uso moderado): ${rules.trap_patterns.join('; ')}.`,
    );
  }
  if (rules.legal_vs_conceptual.legal >= 0.5) {
    lines.push('Predomina la precision legal (articulos/normas concretas).');
  }
  if (rules.statement_length) {
    lines.push(
      `Longitud de enunciado habitual: ~${rules.statement_length.avg} caracteres.`,
    );
  }
  if (rules.style_notes) {
    lines.push(rules.style_notes);
  }
  return lines;
}

function modalOptionCount(dist: Record<string, number>): string | null {
  let bestKey: string | null = null;
  let bestVal = -1;
  for (const [key, val] of Object.entries(dist)) {
    if (val > bestVal) {
      bestVal = val;
      bestKey = key;
    }
  }
  return bestKey;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
