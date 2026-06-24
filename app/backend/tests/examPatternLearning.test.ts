// SPEC 028-F Fase 1: persistencia (round-trip + factory) y servicio de analisis.

import { describe, expect, it } from 'vitest';
import {
  InMemorySupabasePort,
  SupabaseExamPatternLearningRepository,
  InMemoryExamPatternLearningRepository,
  createCoreRepositories,
  InMemoryMaterialRepository,
  InMemoryTopicMaterialLinkRepository,
  ExamPatternAnalysisService,
  type Material,
  type QuestionStyleProfile,
  type AIErrorMemory,
  type AIQuestionQualityScore,
} from '../src/index.js';
import { InMemoryMaterialSectionRepository } from '../src/repository/inMemorySectionsRepositories.js';

const now = new Date('2026-01-02T00:00:00.000Z');

function makeProfile(over: Partial<QuestionStyleProfile> = {}): QuestionStyleProfile {
  return {
    id: 'prof-1',
    workspace_id: 'ws-1',
    opposition_id: 'opp-1',
    version: 1,
    status: 'draft',
    selected_summary_ids: ['sum-1'],
    rules: {
      option_count_distribution: { '4': 1 },
      difficulty_distribution: {},
      common_question_types: ['negativa'],
      trap_patterns: [],
      legal_vs_conceptual: { legal: 0.3, conceptual: 0.7 },
      statement_length: { min: 10, max: 80, avg: 40 },
      style_notes: null,
    },
    fingerprints: ['cual es la capital'],
    coverage_notes: null,
    confidence: 0.5,
    warnings: [],
    created_by: 'admin',
    approved_by: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe('SupabaseExamPatternLearningRepository', () => {
  it('perfil: round-trip de rules/fingerprints y perfil activo', async () => {
    const repo = new SupabaseExamPatternLearningRepository(new InMemorySupabasePort());
    await repo.createProfile(makeProfile());
    const got = await repo.getProfile('prof-1');
    expect(got?.rules.option_count_distribution['4']).toBe(1);
    expect(got?.fingerprints).toEqual(['cual es la capital']);
    expect(await repo.getActiveProfile('opp-1')).toBeNull();

    await repo.updateProfile(makeProfile({ status: 'active', approved_by: 'admin', approved_at: now }));
    const active = await repo.getActiveProfile('opp-1');
    expect(active?.id).toBe('prof-1');
    expect(active?.status).toBe('active');
  });

  it('memoria de errores: crear, listar y borrar por oposicion', async () => {
    const repo = new SupabaseExamPatternLearningRepository(new InMemorySupabasePort());
    const entry: AIErrorMemory = {
      id: 'mem-1', workspace_id: 'ws-1', opposition_id: 'opp-1', topic_id: null,
      material_id: null, type: 'not_exam_style', severity: 'low',
      summary: 'estilo poco formal', avoid_instruction: 'usa registro formal',
      source: 'review_feedback', occurrences: 2, scope: 'opposition', difficulty: null,
      last_seen_at: now, example_question_id: null, created_at: now, updated_at: now,
    };
    await repo.createErrorMemory(entry);
    expect(await repo.listErrorMemoriesByOpposition('opp-1')).toHaveLength(1);

    // SPEC 040: upsert por clave de agregacion incrementa occurrences.
    const up = await repo.upsertErrorMemory({
      workspace_id: 'ws-1', opposition_id: 'opp-1', type: 'not_exam_style',
      scope: 'opposition', difficulty: null, severity: 'high',
      summary: 's', avoid_instruction: 'i', source: 'review_feedback',
    });
    expect(up.occurrences).toBe(3);
    expect(up.severity).toBe('high');

    await repo.deleteErrorMemoriesByOpposition('opp-1');
    expect(await repo.listErrorMemoriesByOpposition('opp-1')).toHaveLength(0);
  });

  it('quality score: por pregunta y por run', async () => {
    const repo = new SupabaseExamPatternLearningRepository(new InMemorySupabasePort());
    const score: AIQuestionQualityScore = {
      id: 'qs-1', question_id: 'q-1', run_id: 'run-1', workspace_id: 'ws-1',
      opposition_id: 'opp-1', source_grounding: 0.9, exam_style_similarity: 0.6,
      clarity: 0.8, single_answer_confidence: 0.95, difficulty_fit: 0.7,
      overall: 0.78, warnings: [], created_at: now, updated_at: now,
    };
    await repo.createQualityScore(score);
    expect((await repo.getQualityScoreByQuestion('q-1'))?.overall).toBe(0.78);
    expect(await repo.listQualityScoresByRun('run-1')).toHaveLength(1);
  });
});

describe('createCoreRepositories - examPatternLearning', () => {
  it('memory e supabase seleccionan el repo correcto', () => {
    const mem = createCoreRepositories({ persistence: 'memory' });
    expect(mem.examPatternLearning).toBeInstanceOf(InMemoryExamPatternLearningRepository);
    const sb = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(sb.examPatternLearning).toBeInstanceOf(SupabaseExamPatternLearningRepository);
  });
});

function makeMaterial(over: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    opposition_id: 'opp-1',
    title: 'Examen 2024',
    description: null,
    type: 'old_test',
    status: 'active',
    original_filename: 'examen.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1000,
    storage_path: 'uploads/x.pdf',
    content_text:
      '1) Cual es la capital? a) Madrid b) Paris c) Roma d) Berlin ' +
      '2) No es correcto, excepto: a) Uno b) Dos c) Tres d) Cuatro',
    reference: null,
    file_extension: 'pdf',
    extraction_status: 'completed',
    extraction_error: null,
    page_count: 1,
    uploaded_by: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe('ExamPatternAnalysisService', () => {
  async function setup() {
    const materials = new InMemoryMaterialRepository();
    const sections = new InMemoryMaterialSectionRepository();
    const links = new InMemoryTopicMaterialLinkRepository();
    const repository = new InMemoryExamPatternLearningRepository();
    const service = new ExamPatternAnalysisService({
      materials,
      sections,
      topicMaterialLinks: links,
      repository,
      generateId: (() => {
        let n = 0;
        return () => `id-${++n}`;
      })(),
      now: () => now,
    });
    return { materials, links, repository, service };
  }

  it('analiza exámenes usables y crea run + perfil draft + patron por tema', async () => {
    const { materials, links, service } = await setup();
    await materials.create(makeMaterial());
    await links.create({
      id: 'link-1', material_id: 'mat-1', topic_id: 'topic-1',
      reference: null, created_at: now,
    });

    const result = await service.analyze({ opposition_id: 'opp-1', created_by: 'admin' });
    expect(result.run.old_exam_count).toBe(1);
    expect(result.run.analyzed_question_count).toBe(2);
    expect(result.profile).not.toBeNull();
    expect(result.profile?.status).toBe('draft');
    expect(result.profile?.rules.option_count_distribution['4']).toBe(1);
    expect(result.profile?.fingerprints.length).toBe(2);
    expect(result.topicPatterns).toHaveLength(1);
    expect(result.topicPatterns[0].topic_id).toBe('topic-1');
  });

  it('sin exámenes antiguos: warning, sin perfil (no es fallo)', async () => {
    const { materials, service } = await setup();
    // material que NO es examen antiguo
    await materials.create(makeMaterial({ id: 'm2', type: 'syllabus' }));
    const result = await service.analyze({ opposition_id: 'opp-1' });
    expect(result.run.status).toBe('completed_with_warnings');
    expect(result.run.old_exam_count).toBe(0);
    expect(result.profile).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/no hay exámenes/i);
  });

  it('excluye exámenes con extracción no completada', async () => {
    const { materials, service } = await setup();
    await materials.create(makeMaterial({ extraction_status: 'not_supported', content_text: null }));
    const result = await service.analyze({ opposition_id: 'opp-1' });
    expect(result.run.old_exam_count).toBe(0);
    expect(result.profile).toBeNull();
  });
});
