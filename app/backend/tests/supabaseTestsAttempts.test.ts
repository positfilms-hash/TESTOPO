// SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
//
// Los repos Supabase se ejercitan contra un puerto en memoria (sin red): mapeo
// fila<->modelo (filters/options_order JSONB), intentos por usuario, upsert y
// borrado de respuestas. El factory incluye ahora todo el MVP.

import { describe, expect, it } from 'vitest';
import { InMemorySupabasePort } from '../src/repository/supabase/inMemorySupabasePort.js';
import {
  SupabaseTestRepository,
  SupabaseTestQuestionRepository,
  SupabaseTestAttemptRepository,
  SupabaseTestAnswerRepository,
} from '../src/repository/supabase/supabaseTestRepositories.js';
import { createCoreRepositories } from '../src/repository/supabase/createCoreRepositories.js';
import { InMemoryTestRepository } from '../src/repository/inMemoryTestRepository.js';
import type { PracticeTest } from '../src/models/practiceTest.js';
import type { TestAttempt } from '../src/models/testAttempt.js';
import type { TestAnswer } from '../src/models/testAnswer.js';

const NOW = new Date('2026-06-18T00:00:00.000Z');

function makeTest(id: string, overrides: Partial<PracticeTest> = {}): PracticeTest {
  return {
    id,
    opposition_id: 'opo-1',
    title: `Test ${id}`,
    mode: 'random',
    status: 'created',
    question_count: 2,
    filters: { topic_id: null, difficulty: 'mixed', question_count: 2, random_seed: 42 },
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeAttempt(id: string, overrides: Partial<TestAttempt> = {}): TestAttempt {
  return {
    id,
    test_id: 't1',
    opposition_id: 'opo-1',
    user_id: 'u-1',
    status: 'in_progress',
    started_at: NOW,
    submitted_at: null,
    score: 0,
    total_questions: 2,
    correct_count: 0,
    incorrect_count: 0,
    unanswered_count: 0,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeAnswer(id: string, overrides: Partial<TestAnswer> = {}): TestAnswer {
  return {
    id,
    attempt_id: 'a1',
    test_question_id: 'tq1',
    question_id: 'q1',
    selected_option_id: null,
    is_correct: null,
    answered_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('SPEC 024 - SupabaseTestRepository', () => {
  it('crea, busca, preserva filters (jsonb) y cancela via save', async () => {
    const repo = new SupabaseTestRepository(new InMemorySupabasePort());
    await repo.create(makeTest('t1'));
    const found = await repo.findById('t1');
    expect(found?.mode).toBe('random');
    expect(found?.filters.random_seed).toBe(42);
    const cancelled = await repo.save(makeTest('t1', { status: 'cancelled' }));
    expect(cancelled.status).toBe('cancelled');
  });
});

describe('SPEC 024 - SupabaseTestQuestionRepository', () => {
  it('crea y lista por test en orden, con options_order', async () => {
    const repo = new SupabaseTestQuestionRepository(new InMemorySupabasePort());
    await repo.create({ id: 'tq2', test_id: 't1', question_id: 'q2', order: 1, options_order: ['b', 'a'], created_at: NOW });
    await repo.create({ id: 'tq1', test_id: 't1', question_id: 'q1', order: 0, options_order: ['x', 'y'], created_at: NOW });
    const list = await repo.findByTest('t1');
    expect(list.map((q) => q.id)).toEqual(['tq1', 'tq2']); // ordenadas por order
    expect(list[0].options_order).toEqual(['x', 'y']);
  });
});

describe('SPEC 024 - SupabaseTestAttemptRepository', () => {
  it('crea, busca por id, lista por usuario y actualiza al enviar', async () => {
    const repo = new SupabaseTestAttemptRepository(new InMemorySupabasePort());
    await repo.create(makeAttempt('a1', { user_id: 'u-1' }));
    await repo.create(makeAttempt('a2', { user_id: 'u-2' }));
    expect((await repo.findById('a1'))?.user_id).toBe('u-1');
    expect(await repo.findByUser('u-1')).toHaveLength(1);

    const submitted = await repo.save(
      makeAttempt('a1', {
        status: 'submitted',
        submitted_at: NOW,
        score: 1,
        correct_count: 1,
        incorrect_count: 0,
        unanswered_count: 1,
      }),
    );
    expect(submitted.status).toBe('submitted');
    expect(submitted.correct_count).toBe(1);
    expect(submitted.unanswered_count).toBe(1); // unanswered no cuenta como incorrect
    expect(submitted.submitted_at).not.toBeNull();
  });
});

describe('SPEC 024 - SupabaseTestAnswerRepository', () => {
  it('crea, actualiza (upsert), busca por pareja, lista y borra', async () => {
    const repo = new SupabaseTestAnswerRepository(new InMemorySupabasePort());
    await repo.create(makeAnswer('ans1', { attempt_id: 'a1', test_question_id: 'tq1' }));
    await repo.create(makeAnswer('ans2', { attempt_id: 'a1', test_question_id: 'tq2' }));

    const updated = await repo.save(
      makeAnswer('ans1', { attempt_id: 'a1', test_question_id: 'tq1', selected_option_id: 'opt-x', is_correct: true, answered_at: NOW }),
    );
    expect(updated.selected_option_id).toBe('opt-x');
    expect(updated.is_correct).toBe(true);

    expect((await repo.find('a1', 'tq1'))?.selected_option_id).toBe('opt-x');
    expect(await repo.findByAttempt('a1')).toHaveLength(2);

    expect(await repo.delete('a1', 'tq2')).toBe(true);
    expect(await repo.find('a1', 'tq2')).toBeNull();
    expect(await repo.delete('a1', 'tq2')).toBe(false);
  });
});

describe('SPEC 024 - factory cierra el MVP', () => {
  it('usa InMemory por defecto', () => {
    const core = createCoreRepositories();
    expect(core.tests).toBeInstanceOf(InMemoryTestRepository);
  });

  it('usa Supabase para tests/attempts/answers en modo supabase', () => {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(core.tests).toBeInstanceOf(SupabaseTestRepository);
    expect(core.testQuestions).toBeInstanceOf(SupabaseTestQuestionRepository);
    expect(core.testAttempts).toBeInstanceOf(SupabaseTestAttemptRepository);
    expect(core.testAnswers).toBeInstanceOf(SupabaseTestAnswerRepository);
  });
});
