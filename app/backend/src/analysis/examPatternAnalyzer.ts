// Analizador deterministico de exámenes antiguos (SPEC 028-F). Funcion PURA, sin
// red ni IA: deriva SOLO agregados de estilo/formato/cobertura y huellas
// anti-copia (enunciados normalizados) a partir del texto de los examenes. NUNCA
// conserva el contenido verbatim para reutilizarlo como pregunta.

import type { StyleProfileRules } from '../models/examPatternLearning.js';

export interface ExamAnalysisResult {
  rules: StyleProfileRules;
  /** Enunciados normalizados (anti-copia). No es contenido copiable: sirve para
   *  rechazar candidatas demasiado parecidas a un examen antiguo. */
  fingerprints: string[];
  analyzed_question_count: number;
  warnings: string[];
}

// Marcadores de pregunta numerada ("1)", "12.") al inicio o tras espacio.
const QUESTION_SPLIT = /(?:^|\s)(\d{1,3})[).]\s/g;
// Marcadores de opcion ("a)", "B)", "c.-").
const OPTION_MARKER = /(?:^|\s)([a-dA-D])[).]/g;
const NEGATIVE_RE = /\b(no|excepto|salvo|incorrecta|falsa|except)\b/i;
const LEGAL_RE =
  /\b(art[íi]?culo|art\.|ley|real decreto|reglamento|constituci[óo]n|c[óo]digo|directiva)\b/i;
const TRAP_RES: { label: string; re: RegExp }[] = [
  { label: 'todas son correctas', re: /todas\s+(las\s+anteriores\s+)?son\s+correctas/i },
  { label: 'ninguna es correcta', re: /ninguna\s+(de\s+las\s+anteriores\s+)?es\s+correcta/i },
  { label: 'a y b son correctas', re: /\b[a-d]\s+y\s+[a-d]\s+son\s+correctas/i },
];

export function analyzeExamText(blocks: string[]): ExamAnalysisResult {
  const warnings: string[] = [];
  const questions = splitQuestions(blocks);
  if (questions.length === 0) {
    return {
      rules: emptyRules(),
      fingerprints: [],
      analyzed_question_count: 0,
      warnings: ['No se han detectado preguntas analizables en los exámenes.'],
    };
  }

  const optionCounts: Record<string, number> = {};
  const fingerprints: string[] = [];
  const trapsFound = new Set<string>();
  let negatives = 0;
  let legal = 0;
  const lengths: number[] = [];

  for (const q of questions) {
    const optionMatches = [...q.matchAll(OPTION_MARKER)];
    const optionCount = distinctOptionLetters(optionMatches);
    if (optionCount > 0) {
      const key = String(optionCount);
      optionCounts[key] = (optionCounts[key] ?? 0) + 1;
    }
    const statement = statementOf(q);
    lengths.push(statement.length);
    if (NEGATIVE_RE.test(statement)) negatives += 1;
    if (LEGAL_RE.test(q)) legal += 1;
    for (const trap of TRAP_RES) {
      if (trap.re.test(q)) trapsFound.add(trap.label);
    }
    const fp = normalizeFingerprint(statement);
    if (fp.length >= 12) fingerprints.push(fp);
  }

  const total = questions.length;
  const commonTypes: string[] = [];
  if (negatives / total >= 0.15) commonTypes.push('negativa');
  if (legal / total >= 0.3) commonTypes.push('referencia legal');
  if (legal / total < 0.3) commonTypes.push('conceptual');

  const legalRatio = round2(legal / total);
  const rules: StyleProfileRules = {
    option_count_distribution: toDistribution(optionCounts, total),
    difficulty_distribution: {},
    common_question_types: commonTypes,
    trap_patterns: [...trapsFound],
    legal_vs_conceptual: { legal: legalRatio, conceptual: round2(1 - legalRatio) },
    statement_length: lengths.length
      ? {
          min: Math.min(...lengths),
          max: Math.max(...lengths),
          avg: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
        }
      : null,
    style_notes: null,
  };

  if (Object.keys(optionCounts).length === 0) {
    warnings.push('No se ha podido detectar el número de opciones por pregunta.');
  }

  return { rules, fingerprints, analyzed_question_count: total, warnings };
}

function splitQuestions(blocks: string[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const text = (block ?? '').trim();
    if (text.length === 0) continue;
    const matches = [...text.matchAll(QUESTION_SPLIT)];
    if (matches.length < 2) {
      // Bloque sin numeracion clara: se trata como una unica pregunta.
      out.push(text);
      continue;
    }
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
      const q = text.slice(start, end).trim();
      if (q.length > 0) out.push(q);
    }
  }
  return out;
}

function distinctOptionLetters(matches: RegExpMatchArray[]): number {
  const letters = new Set<string>();
  for (const m of matches) {
    if (m[1]) letters.add(m[1].toLowerCase());
  }
  return letters.size;
}

function statementOf(question: string): string {
  const firstOption = question.search(OPTION_MARKER);
  const raw = firstOption > 0 ? question.slice(0, firstOption) : question;
  return raw.replace(/^(?:\s*\d{1,3}[).]\s*)/, '').trim();
}

function normalizeFingerprint(statement: string): string {
  return Array.from(statement.normalize('NFD'))
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

function toDistribution(
  counts: Record<string, number>,
  total: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(counts)) {
    out[key] = round2(n / total);
  }
  return out;
}

function emptyRules(): StyleProfileRules {
  return {
    option_count_distribution: {},
    difficulty_distribution: {},
    common_question_types: [],
    trap_patterns: [],
    legal_vs_conceptual: { legal: 0, conceptual: 0 },
    statement_length: null,
    style_notes: null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
