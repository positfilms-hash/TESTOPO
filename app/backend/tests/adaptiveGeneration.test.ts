// SPEC 028-F Fase 2: memoria de errores + generación adaptativa (anti-copia +
// quality scores + toggles). Fakes deterministas, sin red.

import { describe, expect, it } from 'vitest';
import {
  AIErrorMemoryService,
  InMemoryExamPatternLearningRepository,
  InMemoryQuestionRepository,
  InMemoryMaterialRepository,
  QuestionService,
  SourceGroundedQuestionGenerationService,
  type QuestionFeedbackService,
  type QuestionStyleProfile,
  type SourceRetrievalService,
  type TopicService,
} from '../src/index.js';

const now = new Date('2026-01-02T00:00:00.000Z');

describe('AIErrorMemoryService', () => {
  it('deriva memoria desde el feedback y produce avoid-instructions', async () => {
    const repository = new InMemoryExamPatternLearningRepository();
    const feedback = {
      getFeedbackSummaryForGeneration: async () => [
        { feedback_type: 'style_mismatch', count: 3, severity: 'low' },
        { feedback_type: 'missing_source', count: 1, severity: 'critical' },
      ],
    } as unknown as QuestionFeedbackService;
    const service = new AIErrorMemoryService({ repository, feedback, now: () => now });

    const entries = await service.refreshForOpposition('opp-1');
    expect(entries).toHaveLength(2);
    const instructions = await service.getAvoidInstructions('opp-1');
    // La más grave (missing_source/critical) va primero.
    expect(instructions[0]).toMatch(/fuente concreta/i);
  });

  it('refresca reemplazando la memoria previa', async () => {
    const repository = new InMemoryExamPatternLearningRepository();
    let summary = [{ feedback_type: 'too_easy', count: 1, severity: 'low' }];
    const feedback = {
      getFeedbackSummaryForGeneration: async () => summary,
    } as unknown as QuestionFeedbackService;
    const service = new AIErrorMemoryService({ repository, feedback, now: () => now });
    await service.refreshForOpposition('opp-1');
    summary = [{ feedback_type: 'off_topic', count: 2, severity: 'high' }];
    await service.refreshForOpposition('opp-1');
    const list = await service.list('opp-1');
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('off_topic');
  });
});

// --- Generación adaptativa con fakes ---
function makeProfile(fingerprints: string[]): QuestionStyleProfile {
  return {
    id: 'prof-1', workspace_id: 'ws-1', opposition_id: 'opp-1', version: 2,
    status: 'active', selected_summary_ids: [],
    rules: {
      option_count_distribution: { '2': 1 }, difficulty_distribution: {},
      common_question_types: ['referencia legal'], trap_patterns: [],
      legal_vs_conceptual: { legal: 0.8, conceptual: 0.2 },
      statement_length: { min: 20, max: 120, avg: 50 }, style_notes: null,
    },
    fingerprints, coverage_notes: null, confidence: 0.6, warnings: [],
    created_by: 'admin', approved_by: 'admin', approved_at: now,
    created_at: now, updated_at: now,
  };
}

const SOURCE = {
  material_id: 'm1', material_section_id: 'sec1', source_reference_id: null,
  topic_source_reference_id: null,
  excerpt: 'El plazo de recurso de alzada es de un mes desde la notificacion.',
  classification: 'legal_text' as const, confidence: 0.9,
};

const CANDIDATE = {
  statement: 'Cual es el plazo del recurso de alzada',
  options: [
    { text: 'Un mes', is_correct: true },
    { text: 'Dos meses', is_correct: false },
  ],
  explanation: 'El plazo es de un mes desde la notificacion.',
  difficulty: 'medium' as const,
  source_excerpt: 'plazo de recurso de alzada es de un mes',
  source_reference: 'art. 122',
};

function fakeDeps(repository: InMemoryExamPatternLearningRepository) {
  const questions = new QuestionService(new InMemoryQuestionRepository());
  const retrieval = {
    retrieveForTopic: async () => ({
      primary: [SOURCE], secondary: [], warnings: [], strategy: 'material_sections',
    }),
  } as unknown as SourceRetrievalService;
  const topics = {
    getTopic: async (id: string) => ({
      id, opposition_id: 'opp-1', status: 'active', title: 'Tema 1',
    }),
  } as unknown as TopicService;
  const provider = {
    version: 'test-1', name: 'mock', model: null,
    generate: async () => [CANDIDATE],
  };
  return { questions, retrieval, topics, provider };
}

describe('SourceGroundedQuestionGenerationService (028-F adaptativo)', () => {
  it('marca needs_fix por copying_risk y persiste quality score', async () => {
    const repository = new InMemoryExamPatternLearningRepository();
    await repository.createProfile(makeProfile(['cual es el plazo del recurso de alzada']));
    const { questions, retrieval, topics, provider } = fakeDeps(repository);
    const service = new SourceGroundedQuestionGenerationService({
      questionService: questions, materials: new InMemoryMaterialRepository(),
      topics, retrieval, provider, learning: repository, now: () => now,
    });

    const result = await service.generateFromTopic({
      opposition_id: 'opp-1', topic_id: 'topic-1', difficulty: 'medium', count: 1,
    });
    expect(result.questions[0].status).toBe('needs_fix');
    expect(result.run.adaptive_context_used).toBe(true);
    expect(result.run.style_profile_id).toBe('prof-1');
    const score = await repository.getQualityScoreByQuestion(result.questions[0].id);
    expect(score).not.toBeNull();
    expect(score?.warnings.join(' ')).toMatch(/copying_risk/);
    expect(result.warnings.join(' ')).toMatch(/perfil de estilo v2/i);
  });

  it('sin copia: pending_review y quality score sin warning de copia', async () => {
    const repository = new InMemoryExamPatternLearningRepository();
    await repository.createProfile(makeProfile(['un enunciado totalmente distinto']));
    const { questions, retrieval, topics, provider } = fakeDeps(repository);
    const service = new SourceGroundedQuestionGenerationService({
      questionService: questions, materials: new InMemoryMaterialRepository(),
      topics, retrieval, provider, learning: repository, now: () => now,
    });
    const result = await service.generateFromTopic({
      opposition_id: 'opp-1', topic_id: 'topic-1', difficulty: 'medium', count: 1,
    });
    expect(result.questions[0].status).toBe('pending_review');
    const score = await repository.getQualityScoreByQuestion(result.questions[0].id);
    expect(score?.warnings.join(' ')).not.toMatch(/copying_risk/);
  });

  it('la generación REFRESCA la memoria desde el feedback automáticamente (blocker)', async () => {
    const repository = new InMemoryExamPatternLearningRepository();
    await repository.createProfile(makeProfile(['otra cosa']));
    const feedback = {
      getFeedbackSummaryForGeneration: async () => [
        { feedback_type: 'style_mismatch', count: 2, severity: 'low' },
      ],
    } as unknown as QuestionFeedbackService;
    const errorMemory = new AIErrorMemoryService({ repository, feedback, now: () => now });
    const { questions, retrieval, topics, provider } = fakeDeps(repository);
    const service = new SourceGroundedQuestionGenerationService({
      questionService: questions, materials: new InMemoryMaterialRepository(),
      topics, retrieval, provider, learning: repository, errorMemory, now: () => now,
    });
    // Sin pulsar "Refrescar": la memoria está vacía antes de generar.
    expect(await repository.listErrorMemoriesByOpposition('opp-1')).toHaveLength(0);
    const result = await service.generateFromTopic({
      opposition_id: 'opp-1', topic_id: 'topic-1', difficulty: 'medium', count: 1,
    });
    // Tras generar, la memoria refleja el feedback (derivada automáticamente).
    expect((await repository.listErrorMemoriesByOpposition('opp-1')).length).toBeGreaterThan(0);
    expect(result.run.feedback_used).toBe(true);
  });

  it('toggle use_style_profile=false: no aplica perfil ni anti-copia', async () => {
    const repository = new InMemoryExamPatternLearningRepository();
    await repository.createProfile(makeProfile(['cual es el plazo del recurso de alzada']));
    const { questions, retrieval, topics, provider } = fakeDeps(repository);
    const service = new SourceGroundedQuestionGenerationService({
      questionService: questions, materials: new InMemoryMaterialRepository(),
      topics, retrieval, provider, learning: repository, now: () => now,
    });
    const result = await service.generateFromTopic({
      opposition_id: 'opp-1', topic_id: 'topic-1', difficulty: 'medium', count: 1,
      use_style_profile: false,
    });
    // Sin perfil cargado: no hay anti-copia → pending_review; no se aplicó perfil.
    expect(result.questions[0].status).toBe('pending_review');
    expect(result.run.adaptive_context_used).toBe(false);
    expect(result.run.style_profile_id).toBeNull();
  });
});
