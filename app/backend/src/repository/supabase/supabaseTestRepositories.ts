// Repositorios Supabase de tests, preguntas de test, intentos y respuestas
// (SPEC 024). Cierran la migracion principal del MVP. Implementan las interfaces
// async existentes; `filters`/`options_order` se guardan como JSONB.

import type {
  PracticeTest,
  TestFilters,
  TestMode,
  TestStatus,
} from '../../models/practiceTest.js';
import type { PracticeTestQuestion } from '../../models/practiceTestQuestion.js';
import type {
  TestAttempt,
  TestAttemptStatus,
} from '../../models/testAttempt.js';
import type { TestAnswer } from '../../models/testAnswer.js';
import type { TestRepository } from '../testRepository.js';
import type { TestQuestionRepository } from '../testQuestionRepository.js';
import type { TestAttemptRepository } from '../testAttemptRepository.js';
import type { TestAnswerRepository } from '../testAnswerRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

// ===================== tests =====================
export class SupabaseTestRepository implements TestRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(test: PracticeTest): Promise<PracticeTest> {
    const row = await this.port.table('tests').insert(testToRow(test));
    return toTest(row);
  }

  async findById(id: string): Promise<PracticeTest | null> {
    const rows = await this.port.table('tests').selectMatch({ id });
    return rows[0] ? toTest(rows[0]) : null;
  }

  async save(test: PracticeTest): Promise<PracticeTest> {
    const { id: _omit, created_at: _omitCreated, ...patch } = testToRow(test);
    const row = await this.port.table('tests').updateById(test.id, patch);
    return toTest(row);
  }
}

function testToRow(t: PracticeTest): SupabaseRow {
  return {
    id: t.id,
    opposition_id: t.opposition_id,
    title: t.title,
    mode: t.mode,
    status: t.status,
    question_count: t.question_count,
    filters: t.filters,
    created_at: iso(t.created_at),
    updated_at: iso(t.updated_at),
  };
}

function toTest(row: SupabaseRow): PracticeTest {
  return {
    id: String(row.id),
    opposition_id: String(row.opposition_id ?? ''),
    title: String(row.title ?? ''),
    mode: row.mode as TestMode,
    status: row.status as TestStatus,
    question_count: asNumber(row.question_count),
    filters: (row.filters as TestFilters) ?? {
      topic_id: null,
      difficulty: null,
      question_count: asNumber(row.question_count),
      random_seed: null,
    },
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

// ===================== test_questions =====================
export class SupabaseTestQuestionRepository
  implements TestQuestionRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(
    testQuestion: PracticeTestQuestion,
  ): Promise<PracticeTestQuestion> {
    const row = await this.port.table('test_questions').insert({
      id: testQuestion.id,
      test_id: testQuestion.test_id,
      question_id: testQuestion.question_id,
      order_index: testQuestion.order,
      options_order: testQuestion.options_order,
      created_at: iso(testQuestion.created_at),
    });
    return toTestQuestion(row);
  }

  async findByTest(testId: string): Promise<PracticeTestQuestion[]> {
    const rows = await this.port
      .table('test_questions')
      .selectMatch({ test_id: testId });
    return rows.map(toTestQuestion).sort((a, b) => a.order - b.order);
  }
}

function toTestQuestion(row: SupabaseRow): PracticeTestQuestion {
  return {
    id: String(row.id),
    test_id: String(row.test_id ?? ''),
    question_id: String(row.question_id ?? ''),
    order: typeof row.order_index === 'number' ? row.order_index : 0,
    options_order: Array.isArray(row.options_order)
      ? (row.options_order as string[])
      : [],
    created_at: parseDate(row.created_at),
  };
}

// ===================== test_attempts =====================
export class SupabaseTestAttemptRepository
  implements TestAttemptRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(attempt: TestAttempt): Promise<TestAttempt> {
    const row = await this.port.table('test_attempts').insert(attemptToRow(attempt));
    return toAttempt(row);
  }

  async findById(id: string): Promise<TestAttempt | null> {
    const rows = await this.port.table('test_attempts').selectMatch({ id });
    return rows[0] ? toAttempt(rows[0]) : null;
  }

  async findByUser(userId: string): Promise<TestAttempt[]> {
    const rows = await this.port
      .table('test_attempts')
      .selectMatch({ user_id: userId });
    return rows.map(toAttempt);
  }

  async save(attempt: TestAttempt): Promise<TestAttempt> {
    const { id: _omit, created_at: _omitCreated, ...patch } = attemptToRow(attempt);
    const row = await this.port.table('test_attempts').updateById(attempt.id, patch);
    return toAttempt(row);
  }
}

function attemptToRow(a: TestAttempt): SupabaseRow {
  return {
    id: a.id,
    test_id: a.test_id,
    opposition_id: a.opposition_id,
    user_id: a.user_id,
    status: a.status,
    started_at: a.started_at instanceof Date ? a.started_at.toISOString() : a.started_at,
    submitted_at: a.submitted_at instanceof Date ? a.submitted_at.toISOString() : a.submitted_at,
    score: a.score,
    total_questions: a.total_questions,
    correct_count: a.correct_count,
    incorrect_count: a.incorrect_count,
    unanswered_count: a.unanswered_count,
    created_at: iso(a.created_at),
    updated_at: iso(a.updated_at),
  };
}

function toAttempt(row: SupabaseRow): TestAttempt {
  return {
    id: String(row.id),
    test_id: String(row.test_id ?? ''),
    opposition_id: String(row.opposition_id ?? ''),
    user_id: asNullableString(row.user_id),
    status: row.status as TestAttemptStatus,
    started_at: parseDate(row.started_at),
    submitted_at: row.submitted_at != null ? parseDate(row.submitted_at) : null,
    score: asNumber(row.score),
    total_questions: asNumber(row.total_questions),
    correct_count: asNumber(row.correct_count),
    incorrect_count: asNumber(row.incorrect_count),
    unanswered_count: asNumber(row.unanswered_count),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

// ===================== test_answers =====================
export class SupabaseTestAnswerRepository implements TestAnswerRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(answer: TestAnswer): Promise<TestAnswer> {
    const row = await this.port.table('test_answers').insert(answerToRow(answer));
    return toAnswer(row);
  }

  async save(answer: TestAnswer): Promise<TestAnswer> {
    const { id: _omit, created_at: _omitCreated, ...patch } = answerToRow(answer);
    const row = await this.port.table('test_answers').updateById(answer.id, patch);
    return toAnswer(row);
  }

  async find(
    attemptId: string,
    testQuestionId: string,
  ): Promise<TestAnswer | null> {
    const rows = await this.port
      .table('test_answers')
      .selectMatch({ attempt_id: attemptId, test_question_id: testQuestionId });
    return rows[0] ? toAnswer(rows[0]) : null;
  }

  async findByAttempt(attemptId: string): Promise<TestAnswer[]> {
    const rows = await this.port
      .table('test_answers')
      .selectMatch({ attempt_id: attemptId });
    return rows.map(toAnswer);
  }

  async delete(attemptId: string, testQuestionId: string): Promise<boolean> {
    const deleted = await this.port
      .table('test_answers')
      .deleteMatch({ attempt_id: attemptId, test_question_id: testQuestionId });
    return deleted > 0;
  }
}

function answerToRow(a: TestAnswer): SupabaseRow {
  return {
    id: a.id,
    attempt_id: a.attempt_id,
    test_question_id: a.test_question_id,
    question_id: a.question_id,
    selected_option_id: a.selected_option_id,
    is_correct: a.is_correct,
    answered_at: a.answered_at instanceof Date ? a.answered_at.toISOString() : a.answered_at,
    created_at: iso(a.created_at),
    updated_at: iso(a.updated_at),
  };
}

function toAnswer(row: SupabaseRow): TestAnswer {
  return {
    id: String(row.id),
    attempt_id: String(row.attempt_id ?? ''),
    test_question_id: String(row.test_question_id ?? ''),
    question_id: String(row.question_id ?? ''),
    selected_option_id: asNullableString(row.selected_option_id),
    is_correct: typeof row.is_correct === 'boolean' ? row.is_correct : null,
    answered_at: row.answered_at != null ? parseDate(row.answered_at) : null,
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

// ===================== helpers =====================
function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}
