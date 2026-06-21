// Repositorio Supabase del aprendizaje de patrones de examen (SPEC 028-F).
// Persiste las 5 entidades en sus tablas. Arrays y `rules` como JSONB. Mismo
// patron que el resto de repos Supabase del dominio.

import type {
  AIErrorMemory,
  AIErrorMemorySource,
  AIQuestionQualityScore,
  ExamPatternAnalysisRun,
  ExamPatternRunStatus,
  QuestionStyleProfile,
  StyleProfileRules,
  StyleProfileStatus,
  TopicExamPattern,
} from '../../models/examPatternLearning.js';
import type { ExamPatternLearningRepository } from '../examPatternLearningRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const RUNS = 'exam_pattern_analysis_runs';
const PROFILES = 'exam_pattern_profiles';
const TOPIC_PATTERNS = 'topic_exam_patterns';
const ERROR_MEMORIES = 'ai_error_memories';
const QUALITY_SCORES = 'ai_question_quality_scores';

export class SupabaseExamPatternLearningRepository
  implements ExamPatternLearningRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  // --- Analysis runs ---
  async createRun(run: ExamPatternAnalysisRun): Promise<ExamPatternAnalysisRun> {
    const row = await this.port.table(RUNS).insert(runToRow(run));
    return toRun(row);
  }

  async getRun(id: string): Promise<ExamPatternAnalysisRun | null> {
    const rows = await this.port.table(RUNS).selectMatch({ id });
    return rows[0] ? toRun(rows[0]) : null;
  }

  async updateRun(run: ExamPatternAnalysisRun): Promise<ExamPatternAnalysisRun> {
    const row = await this.port.table(RUNS).updateById(run.id, runToRow(run));
    return toRun(row);
  }

  async listRunsByOpposition(
    oppositionId: string,
  ): Promise<ExamPatternAnalysisRun[]> {
    const rows = await this.port
      .table(RUNS)
      .selectMatch({ opposition_id: oppositionId });
    return rows.map(toRun);
  }

  // --- Style profiles ---
  async createProfile(
    profile: QuestionStyleProfile,
  ): Promise<QuestionStyleProfile> {
    const row = await this.port.table(PROFILES).insert(profileToRow(profile));
    return toProfile(row);
  }

  async getProfile(id: string): Promise<QuestionStyleProfile | null> {
    const rows = await this.port.table(PROFILES).selectMatch({ id });
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async updateProfile(
    profile: QuestionStyleProfile,
  ): Promise<QuestionStyleProfile> {
    const row = await this.port
      .table(PROFILES)
      .updateById(profile.id, profileToRow(profile));
    return toProfile(row);
  }

  async listProfilesByOpposition(
    oppositionId: string,
  ): Promise<QuestionStyleProfile[]> {
    const rows = await this.port
      .table(PROFILES)
      .selectMatch({ opposition_id: oppositionId });
    return rows.map(toProfile).sort((a, b) => b.version - a.version);
  }

  async getActiveProfile(
    oppositionId: string,
  ): Promise<QuestionStyleProfile | null> {
    const rows = await this.port
      .table(PROFILES)
      .selectMatch({ opposition_id: oppositionId, status: 'active' });
    return rows[0] ? toProfile(rows[0]) : null;
  }

  // --- Topic exam patterns ---
  async createTopicPattern(
    pattern: TopicExamPattern,
  ): Promise<TopicExamPattern> {
    const row = await this.port
      .table(TOPIC_PATTERNS)
      .insert(topicPatternToRow(pattern));
    return toTopicPattern(row);
  }

  async listTopicPatternsByProfile(
    profileId: string,
  ): Promise<TopicExamPattern[]> {
    const rows = await this.port
      .table(TOPIC_PATTERNS)
      .selectMatch({ style_profile_id: profileId });
    return rows.map(toTopicPattern);
  }

  async listTopicPatternsByOpposition(
    oppositionId: string,
  ): Promise<TopicExamPattern[]> {
    const rows = await this.port
      .table(TOPIC_PATTERNS)
      .selectMatch({ opposition_id: oppositionId });
    return rows.map(toTopicPattern);
  }

  // --- AI error memory ---
  async createErrorMemory(entry: AIErrorMemory): Promise<AIErrorMemory> {
    const row = await this.port
      .table(ERROR_MEMORIES)
      .insert(errorMemoryToRow(entry));
    return toErrorMemory(row);
  }

  async updateErrorMemory(entry: AIErrorMemory): Promise<AIErrorMemory> {
    const row = await this.port
      .table(ERROR_MEMORIES)
      .updateById(entry.id, errorMemoryToRow(entry));
    return toErrorMemory(row);
  }

  async listErrorMemoriesByOpposition(
    oppositionId: string,
  ): Promise<AIErrorMemory[]> {
    const rows = await this.port
      .table(ERROR_MEMORIES)
      .selectMatch({ opposition_id: oppositionId });
    return rows.map(toErrorMemory);
  }

  async deleteErrorMemoriesByOpposition(oppositionId: string): Promise<void> {
    await this.port
      .table(ERROR_MEMORIES)
      .deleteMatch({ opposition_id: oppositionId });
  }

  // --- AI question quality scores ---
  async createQualityScore(
    score: AIQuestionQualityScore,
  ): Promise<AIQuestionQualityScore> {
    const row = await this.port
      .table(QUALITY_SCORES)
      .insert(qualityScoreToRow(score));
    return toQualityScore(row);
  }

  async getQualityScoreByQuestion(
    questionId: string,
  ): Promise<AIQuestionQualityScore | null> {
    const rows = await this.port
      .table(QUALITY_SCORES)
      .selectMatch({ question_id: questionId });
    return rows[0] ? toQualityScore(rows[0]) : null;
  }

  async listQualityScoresByRun(
    runId: string,
  ): Promise<AIQuestionQualityScore[]> {
    const rows = await this.port
      .table(QUALITY_SCORES)
      .selectMatch({ run_id: runId });
    return rows.map(toQualityScore);
  }
}

// =====================================================================
// Mapeos por entidad.
// =====================================================================
function runToRow(r: ExamPatternAnalysisRun): SupabaseRow {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    opposition_id: r.opposition_id,
    created_by: r.created_by,
    status: r.status,
    provider: r.provider,
    model: r.model,
    input_material_ids: r.input_material_ids,
    input_section_ids: r.input_section_ids,
    old_exam_count: r.old_exam_count,
    analyzed_question_count: r.analyzed_question_count,
    warnings: r.warnings,
    errors: r.errors,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function toRun(row: SupabaseRow): ExamPatternAnalysisRun {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    created_by: asNullableString(row.created_by),
    status: (row.status as ExamPatternRunStatus) ?? 'pending',
    provider: String(row.provider ?? ''),
    model: asNullableString(row.model),
    input_material_ids: asStringArray(row.input_material_ids),
    input_section_ids: asStringArray(row.input_section_ids),
    old_exam_count: asNumber(row.old_exam_count),
    analyzed_question_count: asNumber(row.analyzed_question_count),
    warnings: asStringArray(row.warnings),
    errors: asStringArray(row.errors),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

const EMPTY_RULES: StyleProfileRules = {
  option_count_distribution: {},
  difficulty_distribution: {},
  common_question_types: [],
  trap_patterns: [],
  legal_vs_conceptual: { legal: 0, conceptual: 0 },
  statement_length: null,
  style_notes: null,
};

function profileToRow(p: QuestionStyleProfile): SupabaseRow {
  return {
    id: p.id,
    workspace_id: p.workspace_id,
    opposition_id: p.opposition_id,
    version: p.version,
    status: p.status,
    selected_summary_ids: p.selected_summary_ids,
    rules: p.rules,
    fingerprints: p.fingerprints,
    coverage_notes: p.coverage_notes,
    confidence: p.confidence,
    warnings: p.warnings,
    created_by: p.created_by,
    approved_by: p.approved_by,
    approved_at: p.approved_at ? iso(p.approved_at) : null,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
  };
}

function toProfile(row: SupabaseRow): QuestionStyleProfile {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    version: asNumber(row.version),
    status: (row.status as StyleProfileStatus) ?? 'draft',
    selected_summary_ids: asStringArray(row.selected_summary_ids),
    rules: (row.rules as StyleProfileRules) ?? EMPTY_RULES,
    fingerprints: asStringArray(row.fingerprints),
    coverage_notes: asNullableString(row.coverage_notes),
    confidence: asNullableNumber(row.confidence),
    warnings: asStringArray(row.warnings),
    created_by: asNullableString(row.created_by),
    approved_by: asNullableString(row.approved_by),
    approved_at: asNullableDate(row.approved_at),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function topicPatternToRow(p: TopicExamPattern): SupabaseRow {
  return {
    id: p.id,
    workspace_id: p.workspace_id,
    opposition_id: p.opposition_id,
    topic_id: p.topic_id,
    style_profile_id: p.style_profile_id,
    frequency_score: p.frequency_score,
    difficulty_score: p.difficulty_score,
    common_question_types: p.common_question_types,
    trap_patterns: p.trap_patterns,
    style_notes: p.style_notes,
    coverage_notes: p.coverage_notes,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
  };
}

function toTopicPattern(row: SupabaseRow): TopicExamPattern {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    topic_id: String(row.topic_id ?? ''),
    style_profile_id: asNullableString(row.style_profile_id),
    frequency_score: asNullableNumber(row.frequency_score),
    difficulty_score: asNullableNumber(row.difficulty_score),
    common_question_types: asStringArray(row.common_question_types),
    trap_patterns: asStringArray(row.trap_patterns),
    style_notes: asNullableString(row.style_notes),
    coverage_notes: asNullableString(row.coverage_notes),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function errorMemoryToRow(e: AIErrorMemory): SupabaseRow {
  return {
    id: e.id,
    workspace_id: e.workspace_id,
    opposition_id: e.opposition_id,
    topic_id: e.topic_id,
    material_id: e.material_id,
    type: e.type,
    severity: e.severity,
    summary: e.summary,
    avoid_instruction: e.avoid_instruction,
    source: e.source,
    occurrences: e.occurrences,
    created_at: iso(e.created_at),
    updated_at: iso(e.updated_at),
  };
}

function toErrorMemory(row: SupabaseRow): AIErrorMemory {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    topic_id: asNullableString(row.topic_id),
    material_id: asNullableString(row.material_id),
    type: String(row.type ?? ''),
    severity: String(row.severity ?? 'low'),
    summary: String(row.summary ?? ''),
    avoid_instruction: String(row.avoid_instruction ?? ''),
    source: (row.source as AIErrorMemorySource) ?? 'review_feedback',
    occurrences: asNumber(row.occurrences),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function qualityScoreToRow(s: AIQuestionQualityScore): SupabaseRow {
  return {
    id: s.id,
    question_id: s.question_id,
    run_id: s.run_id,
    workspace_id: s.workspace_id,
    opposition_id: s.opposition_id,
    source_grounding: s.source_grounding,
    exam_style_similarity: s.exam_style_similarity,
    clarity: s.clarity,
    single_answer_confidence: s.single_answer_confidence,
    difficulty_fit: s.difficulty_fit,
    overall: s.overall,
    warnings: s.warnings,
    created_at: iso(s.created_at),
    updated_at: iso(s.updated_at),
  };
}

function toQualityScore(row: SupabaseRow): AIQuestionQualityScore {
  return {
    id: String(row.id),
    question_id: String(row.question_id ?? ''),
    run_id: asNullableString(row.run_id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    source_grounding: asNumber(row.source_grounding),
    exam_style_similarity: asNumber(row.exam_style_similarity),
    clarity: asNumber(row.clarity),
    single_answer_confidence: asNumber(row.single_answer_confidence),
    difficulty_fit: asNumber(row.difficulty_fit),
    overall: asNumber(row.overall),
    warnings: asStringArray(row.warnings),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

// --- Helpers ---
function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}
function asNullableDate(value: unknown): Date | null {
  return value == null ? null : parseDate(value);
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}
