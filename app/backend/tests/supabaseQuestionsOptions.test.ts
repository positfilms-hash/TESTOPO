// SPEC 023 - Supabase Repositories: Questions & Options.
//
// Los repos Supabase se ejercitan contra un puerto en memoria (sin red): mapeo
// fila<->modelo (incluida la pregunta repartida en questions + question_options),
// filtros, informes de validacion, revisiones, feedback y generation runs. El
// factory incluye ahora todo el banco de preguntas.

import { describe, expect, it } from 'vitest';
import { InMemorySupabasePort } from '../src/repository/supabase/inMemorySupabasePort.js';
import { SupabaseQuestionRepository } from '../src/repository/supabase/supabaseQuestionRepository.js';
import {
  SupabaseGenerationRunRepository,
  SupabaseQuestionReviewRepository,
  SupabaseQuestionReviewFeedbackRepository,
  SupabaseQuestionValidationReportRepository,
} from '../src/repository/supabase/supabaseQuestionBankRepositories.js';
import { createCoreRepositories } from '../src/repository/supabase/createCoreRepositories.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import type { Question } from '../src/models/question.js';
import type { Source } from '../src/models/source.js';

const NOW = new Date('2026-06-18T00:00:00.000Z');

const SOURCE: Source = {
  id: 'src-1',
  title: 'Tema 1',
  type: 'syllabus',
  reference: 'Art. 1',
  status: 'active',
  material_id: 'mat-1',
  excerpt: 'fragmento',
};

function makeQuestion(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    opposition_id: 'opo-1',
    statement: `Enunciado ${id}`,
    options: [
      { id: `${id}-a`, text: 'A', is_correct: true, order: 0 },
      { id: `${id}-b`, text: 'B', is_correct: false, order: 1 },
      { id: `${id}-c`, text: 'C', is_correct: false, order: 2 },
    ],
    correct_answer: `${id}-a`,
    explanation: 'porque si',
    source: SOURCE,
    topic: 'Constitucion',
    topic_id: 'top-1',
    difficulty: 'easy',
    status: 'pending_review',
    generation_metadata: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('SPEC 023 - SupabaseQuestionRepository (questions + options)', () => {
  it('crea y reconstruye la pregunta con opciones ordenadas, source y correct_answer', async () => {
    const repo = new SupabaseQuestionRepository(new InMemorySupabasePort());
    await repo.create(makeQuestion('q1'));

    const found = await repo.findById('q1');
    expect(found).not.toBeNull();
    expect(found?.options.map((o) => o.id)).toEqual(['q1-a', 'q1-b', 'q1-c']);
    expect(found?.options.find((o) => o.is_correct)?.id).toBe('q1-a');
    expect(found?.correct_answer).toBe('q1-a');
    expect(found?.source?.material_id).toBe('mat-1');
    expect(found?.topic_id).toBe('top-1');
  });

  it('filtra por status/difficulty/topic', async () => {
    const repo = new SupabaseQuestionRepository(new InMemorySupabasePort());
    await repo.create(makeQuestion('q1', { status: 'validated', difficulty: 'easy', topic: 'A' }));
    await repo.create(makeQuestion('q2', { status: 'pending_review', difficulty: 'hard', topic: 'B' }));

    expect((await repo.findAll({ status: 'validated' })).map((q) => q.id)).toEqual(['q1']);
    expect((await repo.findAll({ difficulty: 'hard' })).map((q) => q.id)).toEqual(['q2']);
    expect((await repo.findAll({ topic: 'B' })).map((q) => q.id)).toEqual(['q2']);
    expect(await repo.findAll()).toHaveLength(2);
  });

  it('save reemplaza opciones y actualiza status', async () => {
    const repo = new SupabaseQuestionRepository(new InMemorySupabasePort());
    await repo.create(makeQuestion('q1'));
    await repo.save(
      makeQuestion('q1', {
        status: 'validated',
        options: [
          { id: 'q1-x', text: 'X', is_correct: false, order: 0 },
          { id: 'q1-y', text: 'Y', is_correct: true, order: 1 },
        ],
        correct_answer: 'q1-y',
      }),
    );
    const found = await repo.findById('q1');
    expect(found?.status).toBe('validated');
    expect(found?.options.map((o) => o.id)).toEqual(['q1-x', 'q1-y']);
    expect(found?.correct_answer).toBe('q1-y');
  });
});

describe('SPEC 023 - validation report / review / feedback / generation run', () => {
  it('validation report: guarda y recupera el ultimo por pregunta', async () => {
    const repo = new SupabaseQuestionValidationReportRepository(new InMemorySupabasePort());
    await repo.save({
      id: 'v1', question_id: 'q1', status: 'failed', passed: false,
      errors: [], warnings: [], info: [],
      validated_at: new Date('2026-06-18T10:00:00Z'),
      validator_version: '1', recommended_status: 'needs_fix',
    });
    await repo.save({
      id: 'v2', question_id: 'q1', status: 'passed', passed: true,
      errors: [], warnings: [], info: [],
      validated_at: new Date('2026-06-18T11:00:00Z'),
      validator_version: '1', recommended_status: 'pending_review',
    });
    const last = await repo.findLastByQuestion('q1');
    expect(last?.id).toBe('v2');
    expect(last?.recommended_status).toBe('pending_review'); // nunca 'validated'
    expect(await repo.findLastByQuestion('nope')).toBeNull();
  });

  it('review: crea y lista por pregunta', async () => {
    const repo = new SupabaseQuestionReviewRepository(new InMemorySupabasePort());
    await repo.create({
      id: 'r1', question_id: 'q1', action: 'approve',
      previous_status: 'pending_review', new_status: 'validated',
      reviewer_name: 'Admin', notes: null, validation_result_id: 'v2',
      created_at: NOW,
    });
    expect((await repo.findByQuestion('q1'))[0]?.action).toBe('approve');
    expect(await repo.findAll()).toHaveLength(1);
  });

  it('feedback: crea y lista por pregunta', async () => {
    const repo = new SupabaseQuestionReviewFeedbackRepository(new InMemorySupabasePort());
    await repo.create({
      id: 'f1', question_id: 'q1', review_id: 'r1',
      feedback_type: 'weak_explanation', severity: 'medium',
      comment: 'mejorar', created_by: null, created_at: NOW,
    });
    expect((await repo.findByQuestion('q1'))[0]?.feedback_type).toBe('weak_explanation');
  });

  it('generation run: crea, busca por id y lista', async () => {
    const repo = new SupabaseGenerationRunRepository(new InMemorySupabasePort());
    await repo.create({
      id: 'g1', material_id: 'mat-1', topic_id: null, mode: 'from_material_text',
      requested_count: 5, created_count: 3, status: 'partial',
      errors: [], provider: 'mock', model: null, feedback_used: true,
      created_at: NOW,
    });
    expect((await repo.findById('g1'))?.status).toBe('partial');
    expect((await repo.findById('g1'))?.feedback_used).toBe(true);
    expect(await repo.findAll()).toHaveLength(1);
  });
});

describe('SPEC 023 - factory incluye el banco de preguntas', () => {
  it('usa InMemory por defecto', () => {
    const core = createCoreRepositories();
    expect(core.questions).toBeInstanceOf(InMemoryQuestionRepository);
  });

  it('usa Supabase cuando hay puerto y modo supabase', () => {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(core.questions).toBeInstanceOf(SupabaseQuestionRepository);
    expect(core.generationRuns).toBeInstanceOf(SupabaseGenerationRunRepository);
    expect(core.questionReviews).toBeInstanceOf(SupabaseQuestionReviewRepository);
    expect(core.questionFeedback).toBeInstanceOf(SupabaseQuestionReviewFeedbackRepository);
    expect(core.questionValidationReports).toBeInstanceOf(SupabaseQuestionValidationReportRepository);
  });
});
