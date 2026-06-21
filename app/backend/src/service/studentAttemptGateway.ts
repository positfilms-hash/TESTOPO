// Gateway de la parte SENSIBLE del flujo de alumno: corregir y revisar.
//
// Aisla las operaciones que leen el SECRETO (respuesta correcta / is_correct /
// explicacion) para que en modo Supabase se hagan por funciones SECURITY
// DEFINER (RPC) en vez de leer columnas directamente. Cierra el gap BUG-001: el
// rol del alumno no puede leer `questions.correct_answer` ni
// `question_options.is_correct` por API directa.
//
// Responder/generar NO necesitan el secreto: se sirven de vistas seguras
// (`safe_questions`/`safe_question_options`, sin solucion) via un
// `QuestionService` de solo lectura; por eso no pasan por aqui.
//
//   - `LocalStudentAttemptGateway`: correccion/revision en proceso (modo
//     memory/demo, sin RLS). Comportamiento IDENTICO al historico de
//     `TestAttemptService`.
//   - `SupabaseStudentAttemptGateway`: delega en las RPC de la migracion 029
//     (`submit_attempt` / `get_attempt_review`), que corren con privilegios del
//     definidor y nunca devuelven el secreto antes de enviar.

import type { TestAttempt } from '../models/testAttempt.js';
import type { Difficulty } from '../models/enums.js';
import type { QuestionService } from './questionService.js';
import type { TestQuestionRepository } from '../repository/testQuestionRepository.js';
import type { TestAttemptRepository } from '../repository/testAttemptRepository.js';
import type { TestAnswerRepository } from '../repository/testAnswerRepository.js';
import type { SupabaseClientPort } from '../repository/supabase/supabaseClientPort.js';
import type { ReviewItemView, ReviewOptionView } from './testAttemptService.js';

export interface StudentAttemptGateway {
  /** Corrige y persiste el intento; devuelve el intento actualizado. */
  submitAttempt(attempt: TestAttempt): Promise<TestAttempt>;
  /** Revision tras enviar: solucion + explicacion reveladas. */
  getReviewItems(attempt: TestAttempt): Promise<ReviewItemView[]>;
}

export interface LocalStudentAttemptGatewayDeps {
  testQuestions: TestQuestionRepository;
  questions: QuestionService;
  attempts: TestAttemptRepository;
  answers: TestAnswerRepository;
  now: () => Date;
}

// Implementacion en proceso: replica el comportamiento historico de
// TestAttemptService (correccion en la capa de servicio, sin red).
export class LocalStudentAttemptGateway implements StudentAttemptGateway {
  constructor(private readonly deps: LocalStudentAttemptGatewayDeps) {}

  async submitAttempt(attempt: TestAttempt): Promise<TestAttempt> {
    const testQuestions = await this.deps.testQuestions.findByTest(
      attempt.test_id,
    );
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    for (const testQuestion of testQuestions) {
      const answer = await this.deps.answers.find(attempt.id, testQuestion.id);
      if (!answer || !answer.selected_option_id) {
        unanswered += 1;
        continue;
      }
      const question = await this.deps.questions.getQuestion(
        testQuestion.question_id,
      );
      const isCorrect =
        question !== null &&
        answer.selected_option_id === question.correct_answer;
      await this.deps.answers.save({
        ...answer,
        is_correct: isCorrect,
        updated_at: this.deps.now(),
      });
      if (isCorrect) {
        correct += 1;
      } else {
        incorrect += 1;
      }
    }

    const timestamp = this.deps.now();
    return this.deps.attempts.save({
      ...attempt,
      status: 'submitted',
      submitted_at: timestamp,
      total_questions: testQuestions.length,
      correct_count: correct,
      incorrect_count: incorrect,
      unanswered_count: unanswered,
      score: correct,
      updated_at: timestamp,
    });
  }

  async getReviewItems(attempt: TestAttempt): Promise<ReviewItemView[]> {
    const questions: ReviewItemView[] = [];
    const testQuestions = await this.deps.testQuestions.findByTest(
      attempt.test_id,
    );
    for (const testQuestion of testQuestions) {
      const question = await this.deps.questions.getQuestion(
        testQuestion.question_id,
      );
      if (!question) {
        continue;
      }
      const answer = await this.deps.answers.find(attempt.id, testQuestion.id);
      const options: ReviewOptionView[] = [];
      testQuestion.options_order.forEach((optionId, index) => {
        const option = question.options.find((o) => o.id === optionId);
        if (option) {
          options.push({ id: option.id, text: option.text, order: index });
        }
      });
      questions.push({
        question_id: question.id,
        order: testQuestion.order,
        statement: question.statement,
        options,
        selected_option_id: answer?.selected_option_id ?? null,
        correct_option_id: question.correct_answer,
        is_correct: answer?.is_correct ?? null,
        explanation: question.explanation,
        topic: question.topic,
        difficulty: question.difficulty,
        source_reference: question.source?.reference ?? null,
      });
    }
    return questions;
  }
}

// Implementacion Supabase: las RPC SECURITY DEFINER de 029 hacen el trabajo
// sensible en servidor. El alumno nunca recibe la solucion antes de enviar.
export class SupabaseStudentAttemptGateway implements StudentAttemptGateway {
  constructor(private readonly port: SupabaseClientPort) {}

  async submitAttempt(attempt: TestAttempt): Promise<TestAttempt> {
    const row = await this.port.rpc('submit_attempt', {
      p_attempt_id: attempt.id,
    });
    return mergeAttempt(attempt, asRecord(row));
  }

  async getReviewItems(attempt: TestAttempt): Promise<ReviewItemView[]> {
    const rows = asArray(
      await this.port.rpc('get_attempt_review', { p_attempt_id: attempt.id }),
    );
    return rows.map(toReviewItemView);
  }
}

// --- Mapeo defensivo de las filas que devuelven las RPC ---

type Row = Record<string, unknown>;

function asArray(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' ? (value as Row) : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function strOrNull(value: unknown): string | null {
  return value == null ? null : str(value);
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
}

function toReviewOption(value: unknown, index: number): ReviewOptionView {
  const o = asRecord(value);
  return {
    id: str(o.id),
    text: str(o.text),
    order: o.order != null ? num(o.order) : index,
  };
}

function toReviewItemView(row: Row): ReviewItemView {
  const options = Array.isArray(row.options) ? row.options : [];
  return {
    question_id: str(row.question_id),
    order: num(row.order),
    statement: str(row.statement),
    options: options.map(toReviewOption),
    selected_option_id: strOrNull(row.selected_option_id),
    correct_option_id: strOrNull(row.correct_option_id),
    is_correct: row.is_correct == null ? null : Boolean(row.is_correct),
    explanation: strOrNull(row.explanation),
    topic: strOrNull(row.topic),
    difficulty: (strOrNull(row.difficulty) as Difficulty | null) ?? null,
    source_reference: strOrNull(row.source_reference),
  };
}

function mergeAttempt(attempt: TestAttempt, row: Row): TestAttempt {
  const submittedAt = row.submitted_at ?? row.submittedAt;
  return {
    ...attempt,
    status: (strOrNull(row.status) as TestAttempt['status']) ?? 'submitted',
    submitted_at: submittedAt ? new Date(str(submittedAt)) : new Date(),
    total_questions:
      row.total_questions != null
        ? num(row.total_questions)
        : attempt.total_questions,
    correct_count: num(row.correct_count),
    incorrect_count: num(row.incorrect_count),
    unanswered_count: num(row.unanswered_count),
    score: num(row.score),
    updated_at: new Date(),
  };
}
