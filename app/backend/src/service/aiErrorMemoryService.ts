// Memoria de errores IA (SPEC 028-F).
//
// Deriva entradas AUDITABLES (tipo, severidad, resumen, instruccion de "evitar")
// del feedback de revision humana (QuestionReviewFeedback, fuente de verdad), y
// las resume por oposicion para alimentar la generacion adaptativa. Es contexto
// agregado de prompt: NUNCA sustituye la evidencia factual del material primario.

import { randomUUID } from 'node:crypto';
import type { FeedbackType } from '../models/questionReviewFeedback.js';
import type { AIErrorMemory } from '../models/examPatternLearning.js';
import type { ExamPatternLearningRepository } from '../repository/examPatternLearningRepository.js';
import type {
  FeedbackSummaryFilter,
  QuestionFeedbackService,
} from './questionFeedbackService.js';

// Instruccion concreta de "evitar" por tipo de feedback. NO es factual: orienta
// la redaccion, no aporta hechos.
const AVOID_INSTRUCTION: Record<FeedbackType, string> = {
  ambiguous_statement:
    'Evita enunciados ambiguos: formula preguntas con una unica interpretacion.',
  multiple_correct_answers:
    'Asegura una unica respuesta correcta y opciones mutuamente excluyentes.',
  wrong_correct_answer:
    'Verifica que la respuesta marcada como correcta lo es segun la fuente.',
  weak_explanation:
    'Incluye una explicacion clara y suficiente apoyada en la fuente.',
  missing_source:
    'No generes preguntas sin una fuente concreta del material primario.',
  bad_source_excerpt:
    'Cita un fragmento exacto y pertinente del material como fuente.',
  too_easy: 'Sube la exigencia: evita preguntas triviales.',
  too_hard: 'Ajusta la dificultad: evita preguntas excesivamente rebuscadas.',
  duplicated_question: 'Evita repetir enunciados ya existentes.',
  off_topic: 'Mantente dentro del tema y la cobertura aprobada.',
  invented_content:
    'No inventes datos: usa solo lo que aparece en el material primario.',
  bad_options: 'Mejora los distractores: plausibles pero claramente incorrectos.',
  unclear_wording: 'Redacta con precision y sin ambiguedad gramatical.',
  needs_legal_precision:
    'Cita articulos/normas con precision cuando proceda (referencia exacta).',
  style_mismatch:
    'Ajusta el estilo al de los examenes oficiales de la oposicion.',
  difficulty_mismatch:
    'Ajusta la dificultad al patron observado en los examenes oficiales.',
  coverage_mismatch:
    'Cubre los temas con la frecuencia observada en los examenes oficiales.',
  source_mismatch:
    'Ancla cada pregunta a la fuente factual correcta del material primario.',
  copying_risk:
    'No copies ni parafrasees de cerca preguntas de examenes antiguos.',
  other: 'Ten en cuenta el feedback humano previo de este contexto.',
};

export interface AIErrorMemoryServiceDeps {
  repository: ExamPatternLearningRepository;
  feedback: QuestionFeedbackService;
  generateId?: () => string;
  now?: () => Date;
}

export class AIErrorMemoryService {
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(private readonly deps: AIErrorMemoryServiceDeps) {
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  // Reconstruye la memoria de una oposicion desde el feedback actual (se llama
  // tras nuevo feedback humano). Borra y regenera para reflejar el estado real.
  async refreshForOpposition(oppositionId: string): Promise<AIErrorMemory[]> {
    const summaries = await this.deps.feedback.getFeedbackSummaryForGeneration({
      opposition_id: oppositionId,
    });
    await this.deps.repository.deleteErrorMemoriesByOpposition(oppositionId);

    const timestamp = this.now();
    const created: AIErrorMemory[] = [];
    for (const summary of summaries) {
      const entry = await this.deps.repository.createErrorMemory({
        id: this.generateId(),
        workspace_id: null,
        opposition_id: oppositionId,
        topic_id: null,
        material_id: null,
        type: summary.feedback_type,
        severity: summary.severity,
        summary: `${summary.feedback_type} observado ${summary.count} vez/veces (severidad ${summary.severity}).`,
        avoid_instruction:
          AVOID_INSTRUCTION[summary.feedback_type] ?? AVOID_INSTRUCTION.other,
        source: 'review_feedback',
        occurrences: summary.count,
        created_at: timestamp,
        updated_at: timestamp,
      });
      created.push(entry);
    }
    return created;
  }

  async list(oppositionId: string): Promise<AIErrorMemory[]> {
    return this.deps.repository.listErrorMemoriesByOpposition(oppositionId);
  }

  // Instrucciones de "evitar" para inyectar en la generacion (mas graves primero).
  async getAvoidInstructions(
    oppositionId: string,
    filter: Pick<FeedbackSummaryFilter, 'topic_id' | 'material_id'> = {},
  ): Promise<string[]> {
    const entries = await this.deps.repository.listErrorMemoriesByOpposition(
      oppositionId,
    );
    const scoped = entries.filter((e) => {
      if (filter.topic_id && e.topic_id && e.topic_id !== filter.topic_id) {
        return false;
      }
      if (
        filter.material_id &&
        e.material_id &&
        e.material_id !== filter.material_id
      ) {
        return false;
      }
      return true;
    });
    scoped.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of scoped) {
      if (!seen.has(e.avoid_instruction)) {
        seen.add(e.avoid_instruction);
        out.push(e.avoid_instruction);
      }
    }
    return out;
  }
}

function severityRank(severity: string): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity] ?? 0;
}
