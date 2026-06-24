// Almacen en memoria del aprendizaje de patrones de examen (SPEC 028-F).
// Implementacion de referencia (tests/demo); la real es Supabase.

import { randomUUID } from 'node:crypto';
import type {
  AIErrorMemory,
  AIQuestionQualityScore,
  ErrorMemoryUpsertInput,
  ExamPatternAnalysisRun,
  QuestionStyleProfile,
  TopicExamPattern,
} from '../models/examPatternLearning.js';
import type { ExamPatternLearningRepository } from './examPatternLearningRepository.js';

function severityRank(severity: string): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity] ?? 0;
}

export class InMemoryExamPatternLearningRepository
  implements ExamPatternLearningRepository
{
  private readonly runs = new Map<string, ExamPatternAnalysisRun>();
  private readonly profiles = new Map<string, QuestionStyleProfile>();
  private readonly topicPatterns = new Map<string, TopicExamPattern>();
  private readonly errorMemories = new Map<string, AIErrorMemory>();
  private readonly qualityScores = new Map<string, AIQuestionQualityScore>();

  // --- Analysis runs ---
  async createRun(run: ExamPatternAnalysisRun): Promise<ExamPatternAnalysisRun> {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async getRun(id: string): Promise<ExamPatternAnalysisRun | null> {
    const run = this.runs.get(id);
    return run ? clone(run) : null;
  }

  async updateRun(run: ExamPatternAnalysisRun): Promise<ExamPatternAnalysisRun> {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async listRunsByOpposition(
    oppositionId: string,
  ): Promise<ExamPatternAnalysisRun[]> {
    return [...this.runs.values()]
      .filter((r) => r.opposition_id === oppositionId)
      .map(clone);
  }

  // --- Style profiles ---
  async createProfile(
    profile: QuestionStyleProfile,
  ): Promise<QuestionStyleProfile> {
    this.profiles.set(profile.id, clone(profile));
    return clone(profile);
  }

  async getProfile(id: string): Promise<QuestionStyleProfile | null> {
    const p = this.profiles.get(id);
    return p ? clone(p) : null;
  }

  async updateProfile(
    profile: QuestionStyleProfile,
  ): Promise<QuestionStyleProfile> {
    this.profiles.set(profile.id, clone(profile));
    return clone(profile);
  }

  async listProfilesByOpposition(
    oppositionId: string,
  ): Promise<QuestionStyleProfile[]> {
    return [...this.profiles.values()]
      .filter((p) => p.opposition_id === oppositionId)
      .sort((a, b) => b.version - a.version)
      .map(clone);
  }

  async getActiveProfile(
    oppositionId: string,
  ): Promise<QuestionStyleProfile | null> {
    const active = [...this.profiles.values()].find(
      (p) => p.opposition_id === oppositionId && p.status === 'active',
    );
    return active ? clone(active) : null;
  }

  // --- Topic exam patterns ---
  async createTopicPattern(
    pattern: TopicExamPattern,
  ): Promise<TopicExamPattern> {
    this.topicPatterns.set(pattern.id, clone(pattern));
    return clone(pattern);
  }

  async listTopicPatternsByProfile(
    profileId: string,
  ): Promise<TopicExamPattern[]> {
    return [...this.topicPatterns.values()]
      .filter((p) => p.style_profile_id === profileId)
      .map(clone);
  }

  async listTopicPatternsByOpposition(
    oppositionId: string,
  ): Promise<TopicExamPattern[]> {
    return [...this.topicPatterns.values()]
      .filter((p) => p.opposition_id === oppositionId)
      .map(clone);
  }

  // --- AI error memory ---
  async createErrorMemory(entry: AIErrorMemory): Promise<AIErrorMemory> {
    this.errorMemories.set(entry.id, clone(entry));
    return clone(entry);
  }

  async updateErrorMemory(entry: AIErrorMemory): Promise<AIErrorMemory> {
    this.errorMemories.set(entry.id, clone(entry));
    return clone(entry);
  }

  // UPSERT por clave de agregacion (SPEC 040): poblado de memoria POR REVISION.
  async upsertErrorMemory(input: ErrorMemoryUpsertInput): Promise<AIErrorMemory> {
    const now = new Date();
    const existing = [...this.errorMemories.values()].find(
      (e) =>
        e.workspace_id === input.workspace_id &&
        e.opposition_id === input.opposition_id &&
        e.type === input.type &&
        e.scope === input.scope &&
        (e.difficulty ?? null) === (input.difficulty ?? null),
    );
    if (existing) {
      existing.occurrences += 1;
      if (severityRank(input.severity) > severityRank(existing.severity)) {
        existing.severity = input.severity;
      }
      existing.avoid_instruction = input.avoid_instruction;
      existing.summary = input.summary;
      existing.last_seen_at = now;
      existing.updated_at = now;
      if (input.example_question_id) existing.example_question_id = input.example_question_id;
      this.errorMemories.set(existing.id, existing);
      return clone(existing);
    }
    const created: AIErrorMemory = {
      id: randomUUID(),
      workspace_id: input.workspace_id,
      opposition_id: input.opposition_id,
      topic_id: input.topic_id ?? null,
      material_id: input.material_id ?? null,
      type: input.type,
      severity: input.severity,
      summary: input.summary,
      avoid_instruction: input.avoid_instruction,
      source: input.source,
      occurrences: 1,
      scope: input.scope,
      difficulty: input.difficulty,
      last_seen_at: now,
      example_question_id: input.example_question_id ?? null,
      created_at: now,
      updated_at: now,
    };
    this.errorMemories.set(created.id, created);
    return clone(created);
  }

  async listErrorMemoriesByOpposition(
    oppositionId: string,
  ): Promise<AIErrorMemory[]> {
    return [...this.errorMemories.values()]
      .filter((e) => e.opposition_id === oppositionId)
      .map(clone);
  }

  async deleteErrorMemoriesByOpposition(oppositionId: string): Promise<void> {
    for (const [id, entry] of this.errorMemories) {
      if (entry.opposition_id === oppositionId) {
        this.errorMemories.delete(id);
      }
    }
  }

  // --- AI question quality scores ---
  async createQualityScore(
    score: AIQuestionQualityScore,
  ): Promise<AIQuestionQualityScore> {
    this.qualityScores.set(score.id, clone(score));
    return clone(score);
  }

  async getQualityScoreByQuestion(
    questionId: string,
  ): Promise<AIQuestionQualityScore | null> {
    const found = [...this.qualityScores.values()].find(
      (s) => s.question_id === questionId,
    );
    return found ? clone(found) : null;
  }

  async listQualityScoresByRun(
    runId: string,
  ): Promise<AIQuestionQualityScore[]> {
    return [...this.qualityScores.values()]
      .filter((s) => s.run_id === runId)
      .map(clone);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
