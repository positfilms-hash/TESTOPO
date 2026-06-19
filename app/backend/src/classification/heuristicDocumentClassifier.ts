// Clasificador documental heuristico (SPEC 028-B, 14). Determinista y sin red:
// es el proveedor por defecto, el fallback cuando no hay IA configurada y el
// "mock" de los tests. Usa nombre de archivo, ruta, categoria de subida y senales
// del texto (preguntas A/B/C/D, palabras "ley"/"tema"/"resumen"/"indice").
//
// SOLO clasifica: no genera indice ni preguntas.

import type { DocumentClass } from '../models/documentClassification.js';
import type {
  DocumentClassificationProvider,
  DocumentClassificationProviderInput,
  DocumentClassificationProviderOutput,
} from './documentClassificationTypes.js';

// Texto minimo para considerar el documento analizable.
const MIN_ANALYZABLE_CHARS = 20;

// Orden de prioridad para desempates entre clases con igual puntuacion.
const PRIORITY: DocumentClass[] = [
  'old_exam_or_test',
  'index_or_table_of_contents',
  'legal_text',
  'notes_or_summary',
  'irrelevant',
  'syllabus_material',
];

export class HeuristicDocumentClassifier
  implements DocumentClassificationProvider
{
  readonly name = 'heuristic';
  readonly model = null;

  async classify(
    input: DocumentClassificationProviderInput,
  ): Promise<DocumentClassificationProviderOutput> {
    const text = input.text ?? '';
    const detectedTitle = deriveTitle(input);

    // Sin texto extraible -> no analizable (PDF escaneado, vacio o corrupto).
    if (text.trim().length < MIN_ANALYZABLE_CHARS) {
      return {
        classification: 'not_analyzable',
        confidence: 0.9,
        reason: 'No hay texto extraible suficiente para analizar el documento.',
        detected_title: detectedTitle,
        detected_question_count: null,
        warnings: [],
        provider: this.name,
        model: this.model,
      };
    }

    const nameHay = normalize(`${input.filename} ${input.original_path}`);
    const textHay = normalize(text);
    const hay = `${nameHay} ${textHay}`;

    const scores: Record<DocumentClass, number> = {
      syllabus_material: 0,
      old_exam_or_test: 0,
      legal_text: 0,
      notes_or_summary: 0,
      index_or_table_of_contents: 0,
      irrelevant: 0,
      not_analyzable: 0,
      ambiguous: 0,
    };

    // --- Tests/examenes: estructura de preguntas con opciones A/B/C/D ---
    const optionLines = countOptionLines(text);
    let questionCount: number | null = null;
    if (optionLines >= 3) {
      scores.old_exam_or_test += 3;
      questionCount = Math.round(optionLines / 4) || optionLines;
    }
    if (/\b(test|examen|examenes|simulacro|convocatoria|pregunta)\b/.test(hay)) {
      scores.old_exam_or_test += 2;
    }
    if (/respuestas?\s+correctas?|plantilla de respuestas/.test(hay)) {
      scores.old_exam_or_test += 2;
    }
    if (input.detected_category === 'old_tests') {
      scores.old_exam_or_test += 1;
    }

    // --- Texto legal ---
    if (/\bley\s+\d+\/\d+/.test(hay)) {
      scores.legal_text += 3;
    }
    if (
      /\b(ley|real decreto|constitucion|estatuto|reglamento|normativa|boe|articulo)\b/.test(
        hay,
      )
    ) {
      scores.legal_text += 2;
    }

    // --- Indice / programa / tabla de contenidos ---
    const temaLines = countTemaLines(text);
    if (/\b(indice|programa|temario oficial|distribucion de temas|tabla de contenidos)\b/.test(nameHay)) {
      scores.index_or_table_of_contents += 2;
    }
    if (temaLines >= 4 && isMostlyShortLines(text)) {
      scores.index_or_table_of_contents += 2;
    }

    // --- Apuntes / resumen / esquema ---
    if (/\b(resumen|esquema|cuadro|apuntes|chuleta|comparativa)\b/.test(nameHay)) {
      scores.notes_or_summary += 2;
    }

    // --- Temario / material de estudio ---
    if (/\btema\s+\d+/.test(hay)) {
      scores.syllabus_material += 2;
    }
    if (text.trim().length > 400 && !isMostlyShortLines(text)) {
      scores.syllabus_material += 1;
    }
    if (input.detected_category === 'opposition_material') {
      scores.syllabus_material += 1;
    }

    // --- Irrelevante (publicidad/comercial) ---
    if (/\b(publicidad|oferta|descuento|matriculate|promocion|academia .* matricula)\b/.test(hay)) {
      scores.irrelevant += 3;
    }

    const best = pickBest(scores);
    if (best === null) {
      // Ninguna senal clara -> dudoso, requiere revision humana.
      return {
        classification: 'ambiguous',
        confidence: 0.4,
        reason: 'No se han detectado senales claras para clasificar el documento.',
        detected_title: detectedTitle,
        detected_question_count: null,
        warnings: ['Clasificacion incierta; revisar manualmente.'],
        provider: this.name,
        model: this.model,
      };
    }

    // 1 senal -> 0.65 (baja, el servicio marcara needs_review); 2 -> 0.75; 3+ -> alta.
    const confidence = Math.min(0.95, 0.55 + 0.1 * scores[best]);
    return {
      classification: best,
      confidence,
      reason: reasonFor(best),
      detected_title: detectedTitle,
      detected_question_count:
        best === 'old_exam_or_test' ? questionCount : null,
      warnings: [],
      provider: this.name,
      model: this.model,
    };
  }
}

function pickBest(scores: Record<DocumentClass, number>): DocumentClass | null {
  let best: DocumentClass | null = null;
  let bestScore = 0;
  for (const cls of PRIORITY) {
    if (scores[cls] > bestScore) {
      best = cls;
      bestScore = scores[cls];
    }
  }
  return bestScore > 0 ? best : null;
}

function reasonFor(cls: DocumentClass): string {
  switch (cls) {
    case 'old_exam_or_test':
      return 'Contiene preguntas con opciones o senales de examen/test.';
    case 'legal_text':
      return 'Contiene referencias normativas (ley, decreto, articulo).';
    case 'index_or_table_of_contents':
      return 'Parece un indice o programa con lista de temas.';
    case 'notes_or_summary':
      return 'Parece apuntes, resumen o esquema.';
    case 'syllabus_material':
      return 'Contiene desarrollo teorico de temario.';
    case 'irrelevant':
      return 'Parece contenido comercial/publicitario ajeno al estudio.';
    default:
      return 'Clasificado por heuristica.';
  }
}

function deriveTitle(input: DocumentClassificationProviderInput): string | null {
  if (input.title && input.title.trim().length > 0) {
    return input.title.trim();
  }
  const base = input.filename.split('/').pop() ?? input.filename;
  const dot = base.lastIndexOf('.');
  const stripped = dot > 0 ? base.slice(0, dot) : base;
  return stripped.trim().length > 0 ? stripped.trim() : null;
}

// Cuenta lineas que empiezan por una opcion tipo "a)", "b.", "(c)" etc.
function countOptionLines(text: string): number {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\(?[a-dA-D]\)|^\s*[a-dA-D][).\-]\s+/.test(line)) {
      count += 1;
    }
  }
  return count;
}

// Cuenta lineas que empiezan por "Tema N" / "Tema N -".
function countTemaLines(text: string): number {
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*tema\s+\d+/i.test(line)) {
      count += 1;
    }
  }
  return count;
}

// Heuristica de "indice": mayoria de lineas cortas (poco desarrollo en prosa).
function isMostlyShortLines(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return false;
  }
  const shortLines = lines.filter((l) => l.trim().length <= 60).length;
  return shortLines / lines.length >= 0.7;
}

function normalize(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('')
    .toLowerCase();
}
