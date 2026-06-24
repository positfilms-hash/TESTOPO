// Memoria de errores IA (SPEC 028-F).
//
// Deriva entradas AUDITABLES (tipo, severidad, resumen, instruccion de "evitar")
// del feedback de revision humana (QuestionReviewFeedback, fuente de verdad), y
// las resume por oposicion para alimentar la generacion adaptativa. Es contexto
// agregado de prompt: NUNCA sustituye la evidencia factual del material primario.

import { randomUUID } from 'node:crypto';
import type { AIErrorMemory } from '../models/examPatternLearning.js';
import type { ExamPatternLearningRepository } from '../repository/examPatternLearningRepository.js';
import { avoidInstructionFor } from '../../../../supabase/functions/_shared/reliability/contract';
import type {
  FeedbackSummaryFilter,
  QuestionFeedbackService,
} from './questionFeedbackService.js';

export interface AIErrorMemoryRefreshOptions {
  /** Temas a los que ademas acotar la memoria (adaptacion por tema). */
  topics?: { id: string }[];
  /** Workspace de la oposicion (trazabilidad); si falta, se intenta resolver. */
  workspaceId?: string | null;
}

export interface AIErrorMemoryServiceDeps {
  repository: ExamPatternLearningRepository;
  feedback: QuestionFeedbackService;
  /** Resuelve el workspace de una oposicion (trazabilidad de la memoria). */
  resolveWorkspaceId?: (oppositionId: string) => Promise<string | null>;
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

  // Reconstruye la memoria de una oposicion desde el feedback ACTUAL (fuente de
  // verdad). Borra y regenera para reflejar el estado real. Crea entradas a
  // nivel de oposicion y, si se pasan temas, tambien acotadas por tema.
  // SPEC 028-F: la generacion la invoca automaticamente (no depende del boton).
  async refresh(
    oppositionId: string,
    options: AIErrorMemoryRefreshOptions = {},
  ): Promise<AIErrorMemory[]> {
    const workspaceId =
      options.workspaceId ??
      (this.deps.resolveWorkspaceId
        ? await this.deps.resolveWorkspaceId(oppositionId)
        : null);

    await this.deps.repository.deleteErrorMemoriesByOpposition(oppositionId);
    const created: AIErrorMemory[] = [];

    // Nivel oposicion (general).
    created.push(
      ...(await this.deriveEntries(oppositionId, workspaceId, null)),
    );
    // Nivel tema (adaptacion por tema).
    for (const topic of options.topics ?? []) {
      created.push(
        ...(await this.deriveEntries(oppositionId, workspaceId, topic.id)),
      );
    }
    return created;
  }

  /** @deprecated usar `refresh`. Mantenido por compatibilidad. */
  async refreshForOpposition(oppositionId: string): Promise<AIErrorMemory[]> {
    return this.refresh(oppositionId);
  }

  private async deriveEntries(
    oppositionId: string,
    workspaceId: string | null,
    topicId: string | null,
  ): Promise<AIErrorMemory[]> {
    const summaries = await this.deps.feedback.getFeedbackSummaryForGeneration({
      opposition_id: oppositionId,
      topic_id: topicId,
    });
    const timestamp = this.now();
    const created: AIErrorMemory[] = [];
    for (const summary of summaries) {
      created.push(
        await this.deps.repository.createErrorMemory({
          id: this.generateId(),
          workspace_id: workspaceId,
          opposition_id: oppositionId,
          topic_id: topicId,
          material_id: null,
          type: summary.feedback_type,
          severity: summary.severity,
          summary: `${summary.feedback_type} observado ${summary.count} vez/veces (severidad ${summary.severity}).`,
          avoid_instruction: avoidInstructionFor(summary.feedback_type),
          source: 'review_feedback',
          occurrences: summary.count,
          scope: 'opposition',
          difficulty: null,
          last_seen_at: timestamp,
          example_question_id: null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
      );
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
