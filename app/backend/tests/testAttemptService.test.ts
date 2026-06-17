import { describe, expect, it } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { InMemoryTestRepository } from '../src/repository/inMemoryTestRepository.js';
import { InMemoryTestQuestionRepository } from '../src/repository/inMemoryTestQuestionRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { TestGeneratorService } from '../src/service/testGeneratorService.js';
import { TestAttemptService } from '../src/service/testAttemptService.js';
import { TestAttemptError } from '../src/attempt/testAttemptError.js';
import { TestAttemptErrorCode } from '../src/attempt/attemptErrors.js';
import type { PracticeTestQuestion } from '../src/models/practiceTestQuestion.js';
import { validInput, TEST_OPPOSITION_ID } from './helpers.js';

let seq = 0;

function makeSetup() {
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const testRepository = new InMemoryTestRepository();
  const testQuestionRepository = new InMemoryTestQuestionRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(questionRepository, {
    resolveMaterialStatus: (id) => materials.getMaterial(id)?.status ?? null,
    resolveTopicStatus: (id) => topics.getTopic(id)?.status ?? null,
  });
  let s = 1;
  const random = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const generator = new TestGeneratorService({
    questionService: questions,
    topicRepository,
    materialRepository,
    testRepository,
    testQuestionRepository,
    random,
  });
  const attempts = new TestAttemptService({
    testRepository,
    testQuestionRepository,
    questionService: questions,
    testGenerator: generator,
  });
  return { questions, generator, attempts };
}

function seedValidated(questions: QuestionService, n: number): void {
  for (let i = 0; i < n; i++) {
    const q = questions.createQuestion(
      validInput({ statement: `Pregunta ficticia numero ${++seq}` }),
    );
    questions.changeStatus(q.id, 'validated');
  }
}

// Devuelve el id de la opcion correcta y una incorrecta de una pregunta.
function answerIds(
  questions: QuestionService,
  questionId: string,
): { correct: string; wrong: string } {
  const q = questions.getQuestion(questionId)!;
  const correct = q.correct_answer!;
  const wrong = q.options.find((o) => o.id !== correct)!.id;
  return { correct, wrong };
}

function expectAttemptError(
  fn: () => unknown,
  code: TestAttemptErrorCode,
): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TestAttemptError);
    expect((error as TestAttemptError).codes).toContain(code);
    return;
  }
  throw new Error(`Expected TestAttemptError (${code})`);
}

describe('TestAttemptService - inicio', () => {
  it('inicia un intento en progreso', () => {
    const { questions, generator, attempts } = makeSetup();
    seedValidated(questions, 3);
    const { test } = generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 3 });

    const attempt = attempts.startAttempt(test.id);

    expect(attempt.status).toBe('in_progress');
    expect(attempt.total_questions).toBe(3);
    expect(attempt.submitted_at).toBeNull();
  });

  it('no inicia sobre test inexistente', () => {
    const { attempts } = makeSetup();
    expectAttemptError(
      () => attempts.startAttempt('no-existe'),
      TestAttemptErrorCode.TEST_NOT_FOUND,
    );
  });

  it('no inicia sobre test cancelado', () => {
    const { questions, generator, attempts } = makeSetup();
    seedValidated(questions, 2);
    const { test } = generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 2 });
    generator.cancelTest(test.id);
    expectAttemptError(
      () => attempts.startAttempt(test.id),
      TestAttemptErrorCode.TEST_CANCELLED_CANNOT_BE_STARTED,
    );
  });

  it('la vista para responder no expone respuesta correcta ni explicacion', () => {
    const { questions, generator, attempts } = makeSetup();
    seedValidated(questions, 1);
    const { test } = generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID, question_count: 1 });
    const attempt = attempts.startAttempt(test.id);

    const view = attempts.getTestForTaking(attempt.id);
    const item = view.questions[0] as unknown as Record<string, unknown>;
    const option = view.questions[0].options[0] as unknown as Record<
      string,
      unknown
    >;

    expect(item.correct_answer).toBeUndefined();
    expect(item.correct_option_id).toBeUndefined();
    expect(item.explanation).toBeUndefined();
    expect(item.is_correct).toBeUndefined();
    expect(option.is_correct).toBeUndefined();
  });
});

describe('TestAttemptService - respuestas', () => {
  function setupWithAttempt(count = 3) {
    const ctx = makeSetup();
    seedValidated(ctx.questions, count);
    const { test, questions: testQuestions } = ctx.generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID,
      question_count: count,
    });
    const attempt = ctx.attempts.startAttempt(test.id);
    return { ...ctx, test, testQuestions, attempt };
  }

  it('guarda y actualiza una respuesta sin duplicar', () => {
    const { questions, attempts, testQuestions, attempt } = setupWithAttempt(1);
    const tq = testQuestions[0];
    const { correct, wrong } = answerIds(questions, tq.question_id);

    attempts.saveAnswer({
      attempt_id: attempt.id,
      test_question_id: tq.id,
      selected_option_id: wrong,
    });
    attempts.saveAnswer({
      attempt_id: attempt.id,
      test_question_id: tq.id,
      selected_option_id: correct,
    });

    // Tras enviar, debe contar como 1 acierto (la respuesta se actualizo).
    const result = attempts.submitAttempt(attempt.id);
    expect(result.correct_count).toBe(1);
    expect(result.total_questions).toBe(1);
  });

  it('borra una respuesta (queda no respondida)', () => {
    const { questions, attempts, testQuestions, attempt } = setupWithAttempt(1);
    const tq = testQuestions[0];
    const { correct } = answerIds(questions, tq.question_id);
    attempts.saveAnswer({
      attempt_id: attempt.id,
      test_question_id: tq.id,
      selected_option_id: correct,
    });
    attempts.clearAnswer({ attempt_id: attempt.id, test_question_id: tq.id });

    const result = attempts.submitAttempt(attempt.id);
    expect(result.unanswered_count).toBe(1);
    expect(result.correct_count).toBe(0);
  });

  it('no permite responder una pregunta que no pertenece al test', () => {
    const { attempts, attempt } = setupWithAttempt(1);
    expectAttemptError(
      () =>
        attempts.saveAnswer({
          attempt_id: attempt.id,
          test_question_id: 'no-existe',
          selected_option_id: 'x',
        }),
      TestAttemptErrorCode.QUESTION_NOT_IN_TEST,
    );
  });

  it('no permite una opcion que no pertenece a la pregunta', () => {
    const { attempts, testQuestions, attempt } = setupWithAttempt(1);
    expectAttemptError(
      () =>
        attempts.saveAnswer({
          attempt_id: attempt.id,
          test_question_id: testQuestions[0].id,
          selected_option_id: 'opcion-inexistente',
        }),
      TestAttemptErrorCode.OPTION_NOT_IN_QUESTION,
    );
  });

  it('no permite modificar respuestas despues de enviar', () => {
    const { attempts, testQuestions, attempt } = setupWithAttempt(1);
    attempts.submitAttempt(attempt.id);
    expectAttemptError(
      () =>
        attempts.saveAnswer({
          attempt_id: attempt.id,
          test_question_id: testQuestions[0].id,
          selected_option_id: 'x',
        }),
      TestAttemptErrorCode.ALREADY_SUBMITTED,
    );
  });
});

describe('TestAttemptService - envio y correccion', () => {
  function setupAnswered() {
    const ctx = makeSetup();
    seedValidated(ctx.questions, 3);
    const { test, questions: testQuestions } = ctx.generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID,
      question_count: 3,
    });
    const attempt = ctx.attempts.startAttempt(test.id);
    const tq: PracticeTestQuestion[] = testQuestions;
    // Q0 correcta, Q1 incorrecta, Q2 sin responder.
    const a0 = answerIds(ctx.questions, tq[0].question_id);
    const a1 = answerIds(ctx.questions, tq[1].question_id);
    ctx.attempts.saveAnswer({
      attempt_id: attempt.id,
      test_question_id: tq[0].id,
      selected_option_id: a0.correct,
    });
    ctx.attempts.saveAnswer({
      attempt_id: attempt.id,
      test_question_id: tq[1].id,
      selected_option_id: a1.wrong,
    });
    return { ...ctx, attempt };
  }

  it('al enviar calcula aciertos, fallos, no respondidas y puntuacion', () => {
    const { attempts, attempt } = setupAnswered();
    const result = attempts.submitAttempt(attempt.id);
    expect(result.correct_count).toBe(1);
    expect(result.incorrect_count).toBe(1);
    expect(result.unanswered_count).toBe(1);
    expect(result.score).toBe(1);
    expect(result.status).toBe('submitted');
  });

  it('no permite enviar dos veces', () => {
    const { attempts, attempt } = setupAnswered();
    attempts.submitAttempt(attempt.id);
    expectAttemptError(
      () => attempts.submitAttempt(attempt.id),
      TestAttemptErrorCode.ALREADY_SUBMITTED,
    );
  });

  it('no permite enviar un intento cancelado', () => {
    const { attempts, attempt } = setupAnswered();
    attempts.cancelAttempt(attempt.id);
    expectAttemptError(
      () => attempts.submitAttempt(attempt.id),
      TestAttemptErrorCode.CANCELLED,
    );
  });
});

describe('TestAttemptService - resultado, revision y cancelacion', () => {
  function setupSubmitted() {
    const ctx = makeSetup();
    seedValidated(ctx.questions, 2);
    const { test, questions: testQuestions } = ctx.generator.createRandomTest({ opposition_id: TEST_OPPOSITION_ID,
      question_count: 2,
    });
    const attempt = ctx.attempts.startAttempt(test.id);
    const a0 = answerIds(ctx.questions, testQuestions[0].question_id);
    ctx.attempts.saveAnswer({
      attempt_id: attempt.id,
      test_question_id: testQuestions[0].id,
      selected_option_id: a0.correct,
    });
    return { ...ctx, attempt };
  }

  it('consulta resultado despues de enviar', () => {
    const { attempts, attempt } = setupSubmitted();
    attempts.submitAttempt(attempt.id);
    const result = attempts.getResult(attempt.id);
    expect(result.attempt_id).toBe(attempt.id);
    expect(result.correct_count).toBe(1);
    expect(result.percentage).toBe(50);
  });

  it('la revision muestra respuesta correcta y explicacion tras enviar', () => {
    const { attempts, attempt } = setupSubmitted();
    attempts.submitAttempt(attempt.id);
    const review = attempts.getReview(attempt.id);
    expect(review.questions).toHaveLength(2);
    expect(review.questions[0].correct_option_id).toBeTruthy();
    expect(review.questions[0].explanation).toBeTruthy();
  });

  it('no permite consultar revision antes de enviar', () => {
    const { attempts, attempt } = setupSubmitted();
    expectAttemptError(
      () => attempts.getReview(attempt.id),
      TestAttemptErrorCode.REVIEW_NOT_AVAILABLE,
    );
  });

  it('cancela un intento en progreso', () => {
    const { attempts, attempt } = setupSubmitted();
    expect(attempts.cancelAttempt(attempt.id).status).toBe('cancelled');
  });
});
