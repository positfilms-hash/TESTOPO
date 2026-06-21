// SPEC 029 - Cierre del gap is_correct (BUG-001).
//
// Cubre el codigo del camino Supabase en modo memory (sin red):
//   - SupabaseSafeQuestionRepository: lee de las vistas seguras y NUNCA expone
//     la solucion (correct_answer/explanation/is_correct).
//   - SupabaseStudentAttemptGateway: corregir/revisar via RPC, con mapeo de la
//     respuesta. (El gateway local ya lo ejercitan los tests de testAttempt.)

import { describe, expect, it } from 'vitest';
import {
  InMemorySupabasePort,
  SupabaseSafeQuestionRepository,
  SupabaseStudentAttemptGateway,
  type SupabaseClientPort,
  type TestAttempt,
} from '../src/index.js';

function seededSafePort(): InMemorySupabasePort {
  const port = new InMemorySupabasePort();
  void port.table('safe_questions').insert({
    id: 'q1',
    opposition_id: 'opp-1',
    statement: 'Enunciado de prueba',
    topic: 'Tema 1',
    topic_id: 't1',
    difficulty: 'easy',
    status: 'validated',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  void port.table('safe_question_options').insert({
    id: 'o1',
    question_id: 'q1',
    text: 'Opcion A',
    order_index: 0,
  });
  void port.table('safe_question_options').insert({
    id: 'o2',
    question_id: 'q1',
    text: 'Opcion B',
    order_index: 1,
  });
  return port;
}

describe('SupabaseSafeQuestionRepository', () => {
  it('lee preguntas saneadas sin exponer la solucion', async () => {
    const repo = new SupabaseSafeQuestionRepository(seededSafePort());
    const all = await repo.findAll();
    expect(all).toHaveLength(1);
    const q = all[0];
    expect(q.correct_answer).toBeNull();
    expect(q.explanation).toBeNull();
    expect(q.options.map((o) => o.id)).toEqual(['o1', 'o2']);
    expect(q.options.every((o) => o.is_correct === false)).toBe(true);
  });

  it('findById tampoco expone is_correct ni correct_answer', async () => {
    const repo = new SupabaseSafeQuestionRepository(seededSafePort());
    const q = await repo.findById('q1');
    expect(q).not.toBeNull();
    expect(q?.correct_answer).toBeNull();
    expect(q?.options.some((o) => o.is_correct)).toBe(false);
  });

  it('filtra por status validated', async () => {
    const repo = new SupabaseSafeQuestionRepository(seededSafePort());
    expect(await repo.findAll({ status: 'validated' })).toHaveLength(1);
    expect(await repo.findAll({ status: 'draft' })).toHaveLength(0);
  });

  it('escribir esta prohibido (solo lectura)', async () => {
    const repo = new SupabaseSafeQuestionRepository(seededSafePort());
    await expect(repo.create()).rejects.toThrow(/solo lectura/i);
  });
});

// Puerto fake que solo implementa rpc (lo unico que usa el gateway Supabase).
function rpcPort(handler: (fn: string, args?: unknown) => unknown): SupabaseClientPort {
  return {
    table() {
      throw new Error('no usado');
    },
    async rpc(fn: string, args?: Record<string, unknown>) {
      return handler(fn, args);
    },
  } as unknown as SupabaseClientPort;
}

const baseAttempt: TestAttempt = {
  id: 'att-1',
  test_id: 'test-1',
  opposition_id: 'opp-1',
  user_id: 'user-1',
  status: 'in_progress',
  started_at: new Date('2026-01-01T00:00:00.000Z'),
  submitted_at: null,
  score: 0,
  total_questions: 3,
  correct_count: 0,
  incorrect_count: 0,
  unanswered_count: 3,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('SupabaseStudentAttemptGateway', () => {
  it('submitAttempt llama a la RPC y mapea el resultado', async () => {
    let called: { fn: string; args?: unknown } | null = null;
    const port = rpcPort((fn, args) => {
      called = { fn, args };
      return {
        status: 'submitted',
        submitted_at: '2026-01-02T00:00:00.000Z',
        total_questions: 3,
        correct_count: 2,
        incorrect_count: 1,
        unanswered_count: 0,
        score: 2,
      };
    });
    const gateway = new SupabaseStudentAttemptGateway(port);
    const result = await gateway.submitAttempt(baseAttempt);
    expect(called).toEqual({ fn: 'submit_attempt', args: { p_attempt_id: 'att-1' } });
    expect(result.status).toBe('submitted');
    expect(result.correct_count).toBe(2);
    expect(result.incorrect_count).toBe(1);
    expect(result.score).toBe(2);
  });

  it('getReviewItems mapea las filas de la RPC (con solucion revelada)', async () => {
    const port = rpcPort(() => [
      {
        question_id: 'q1',
        order: 0,
        statement: 'Enunciado',
        options: [
          { id: 'o1', text: 'A', order: 0 },
          { id: 'o2', text: 'B', order: 1 },
        ],
        selected_option_id: 'o2',
        correct_option_id: 'o1',
        is_correct: false,
        explanation: 'Porque si',
        topic: 'Tema 1',
        difficulty: 'easy',
        source_reference: 'art. 1',
      },
    ]);
    const gateway = new SupabaseStudentAttemptGateway(port);
    const items = await gateway.getReviewItems({ ...baseAttempt, status: 'submitted' });
    expect(items).toHaveLength(1);
    expect(items[0].correct_option_id).toBe('o1');
    expect(items[0].is_correct).toBe(false);
    expect(items[0].options.map((o) => o.id)).toEqual(['o1', 'o2']);
  });
});
