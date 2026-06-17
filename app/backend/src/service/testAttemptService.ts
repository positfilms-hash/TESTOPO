// Realizacion y correccion de tests (SPEC 008).
//
// Cierra el flujo del MVP: iniciar un intento sobre un test de SPEC 007, guardar
// respuestas, enviar, corregir y revisar. La correccion vive en esta capa de
// servicio (el frontend no calcula la nota).
//
// Regla central: mientras el intento esta `in_progress` no se expone la
// respuesta correcta ni la explicacion. La vista para responder reutiliza
// `TestGeneratorService.getTest` (vista de alumno sin soluciones). La respuesta
// correcta y la explicacion solo aparecen en la revision, tras enviar.

import { randomUUID } from 'node:crypto';
import type { Difficulty } from '../models/enums.js';
import type { TestAttempt } from '../models/testAttempt.js';
import type { TestAnswer } from '../models/testAnswer.js';
import type { QuestionService } from './questionService.js';
import type { TestRepository } from '../repository/testRepository.js';
import type { TestQuestionRepository } from '../repository/testQuestionRepository.js';
import type { TestAttemptRepository } from '../repository/testAttemptRepository.js';
import type { TestAnswerRepository } from '../repository/testAnswerRepository.js';
import { InMemoryTestAttemptRepository } from '../repository/inMemoryTestAttemptRepository.js';
import { InMemoryTestAnswerRepository } from '../repository/inMemoryTestAnswerRepository.js';
import {
  TestGeneratorService,
  type StudentQuestionView,
} from './testGeneratorService.js';
import { TestAttemptError } from '../attempt/testAttemptError.js';
import { TestAttemptErrorCode } from '../attempt/attemptErrors.js';

export interface TakingView {
  attempt_id: string;
  test_id: string;
  status: TestAttempt['status'];
  questions: StudentQuestionView[];
}

export interface AttemptResult {
  attempt_id: string;
  test_id: string;
  score: number;
  percentage: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  submitted_at: Date | null;
}

export interface ReviewOptionView {
  id: string;
  text: string;
  order: number;
}

export interface ReviewItemView {
  question_id: string;
  order: number;
  statement: string;
  options: ReviewOptionView[];
  selected_option_id: string | null;
  correct_option_id: string | null;
  is_correct: boolean | null;
  explanation: string | null;
  topic: string | null;
  difficulty: Difficulty | null;
  source_reference: string | null;
}

export interface AttemptReview {
  attempt_id: string;
  test_id: string;
  questions: ReviewItemView[];
}

export interface TestAttemptServiceOptions {
  testRepository: TestRepository;
  testQuestionRepository: TestQuestionRepository;
  questionService: QuestionService;
  testGenerator: TestGeneratorService;
  attemptRepository?: TestAttemptRepository;
  answerRepository?: TestAnswerRepository;
  generateId?: () => string;
  now?: () => Date;
}

export class TestAttemptService {
  private readonly tests: TestRepository;
  private readonly testQuestions: TestQuestionRepository;
  private readonly questions: QuestionService;
  private readonly generator: TestGeneratorService;
  private readonly attempts: TestAttemptRepository;
  private readonly answers: TestAnswerRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: TestAttemptServiceOptions) {
    this.tests = options.testRepository;
    this.testQuestions = options.testQuestionRepository;
    this.questions = options.questionService;
    this.generator = options.testGenerator;
    this.attempts =
      options.attemptRepository ?? new InMemoryTestAttemptRepository();
    this.answers =
      options.answerRepository ?? new InMemoryTestAnswerRepository();
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 10.1 Iniciar intento. `userId` asocia el intento al estudiante (SPEC 010).
  startAttempt(testId: string, userId: string | null = null): TestAttempt {
    const test = this.tests.findById(testId);
    if (!test) {
      throw new TestAttemptError([TestAttemptErrorCode.TEST_NOT_FOUND]);
    }
    if (test.status === 'cancelled') {
      throw new TestAttemptError([
        TestAttemptErrorCode.TEST_CANCELLED_CANNOT_BE_STARTED,
      ]);
    }
    const total = this.testQuestions.findByTest(testId).length;
    const timestamp = this.now();
    return this.attempts.create({
      id: this.generateId(),
      test_id: testId,
      opposition_id: test.opposition_id,
      user_id: userId,
      status: 'in_progress',
      started_at: timestamp,
      submitted_at: null,
      score: 0,
      total_questions: total,
      correct_count: 0,
      incorrect_count: 0,
      unanswered_count: total,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  // 10.2 Consultar test para responder (sin soluciones).
  getTestForTaking(attemptId: string): TakingView {
    const attempt = this.requireAttempt(attemptId);
    const view = this.generator.getTest(attempt.test_id);
    return {
      attempt_id: attempt.id,
      test_id: attempt.test_id,
      status: attempt.status,
      questions: view.questions,
    };
  }

  // 10.3 Guardar (o actualizar) una respuesta.
  saveAnswer(input: {
    attempt_id: string;
    test_question_id: string;
    selected_option_id: string;
  }): TestAnswer {
    const attempt = this.requireEditableAttempt(input.attempt_id);
    const testQuestion = this.requireTestQuestion(
      attempt.test_id,
      input.test_question_id,
    );

    const question = this.questions.getQuestion(testQuestion.question_id);
    const optionIds = question?.options.map((option) => option.id) ?? [];
    if (!optionIds.includes(input.selected_option_id)) {
      throw new TestAttemptError([
        TestAttemptErrorCode.OPTION_NOT_IN_QUESTION,
      ]);
    }

    const timestamp = this.now();
    const existing = this.answers.find(
      input.attempt_id,
      input.test_question_id,
    );
    if (existing) {
      return this.answers.save({
        ...existing,
        selected_option_id: input.selected_option_id,
        is_correct: null,
        answered_at: timestamp,
        updated_at: timestamp,
      });
    }
    return this.answers.create({
      id: this.generateId(),
      attempt_id: input.attempt_id,
      test_question_id: input.test_question_id,
      question_id: testQuestion.question_id,
      selected_option_id: input.selected_option_id,
      is_correct: null,
      answered_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  // 10.4 Borrar respuesta (la pregunta queda como no respondida).
  clearAnswer(input: {
    attempt_id: string;
    test_question_id: string;
  }): void {
    const attempt = this.requireEditableAttempt(input.attempt_id);
    this.requireTestQuestion(attempt.test_id, input.test_question_id);
    this.answers.delete(input.attempt_id, input.test_question_id);
  }

  // 10.5 Enviar test: corrige, calcula y finaliza.
  submitAttempt(attemptId: string): TestAttempt {
    const attempt = this.requireEditableAttempt(attemptId);

    const testQuestions = this.testQuestions.findByTest(attempt.test_id);
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    for (const testQuestion of testQuestions) {
      const answer = this.answers.find(attemptId, testQuestion.id);
      if (!answer || !answer.selected_option_id) {
        unanswered += 1;
        continue;
      }
      const question = this.questions.getQuestion(testQuestion.question_id);
      const isCorrect =
        question !== null &&
        answer.selected_option_id === question.correct_answer;
      this.answers.save({
        ...answer,
        is_correct: isCorrect,
        updated_at: this.now(),
      });
      if (isCorrect) {
        correct += 1;
      } else {
        incorrect += 1;
      }
    }

    const timestamp = this.now();
    return this.attempts.save({
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

  // Devuelve el intento crudo (o null). Util para comprobar propiedad (SPEC 010,
  // 13.6: el estudiante solo ve sus propios intentos).
  getAttempt(attemptId: string): TestAttempt | null {
    return this.attempts.findById(attemptId);
  }

  // 10.6 Consultar resultado.
  getResult(attemptId: string): AttemptResult {
    const attempt = this.requireAttempt(attemptId);
    return {
      attempt_id: attempt.id,
      test_id: attempt.test_id,
      score: attempt.score,
      percentage:
        attempt.total_questions > 0
          ? (attempt.correct_count / attempt.total_questions) * 100
          : 0,
      total_questions: attempt.total_questions,
      correct_count: attempt.correct_count,
      incorrect_count: attempt.incorrect_count,
      unanswered_count: attempt.unanswered_count,
      submitted_at: attempt.submitted_at,
    };
  }

  // 10.7 Consultar revision (solo tras enviar): respuesta correcta + explicacion.
  getReview(attemptId: string): AttemptReview {
    const attempt = this.requireAttempt(attemptId);
    if (attempt.status !== 'submitted') {
      throw new TestAttemptError([
        TestAttemptErrorCode.REVIEW_NOT_AVAILABLE,
      ]);
    }

    const questions: ReviewItemView[] = [];
    for (const testQuestion of this.testQuestions.findByTest(attempt.test_id)) {
      const question = this.questions.getQuestion(testQuestion.question_id);
      if (!question) {
        continue;
      }
      const answer = this.answers.find(attemptId, testQuestion.id);
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
    return { attempt_id: attempt.id, test_id: attempt.test_id, questions };
  }

  // 10.8 Cancelar intento en progreso.
  cancelAttempt(attemptId: string): TestAttempt {
    const attempt = this.requireAttempt(attemptId);
    if (attempt.status !== 'in_progress') {
      throw new TestAttemptError([TestAttemptErrorCode.INVALID_STATUS]);
    }
    return this.attempts.save({
      ...attempt,
      status: 'cancelled',
      updated_at: this.now(),
    });
  }

  private requireAttempt(attemptId: string): TestAttempt {
    const attempt = this.attempts.findById(attemptId);
    if (!attempt) {
      throw new TestAttemptError([TestAttemptErrorCode.ATTEMPT_NOT_FOUND]);
    }
    return attempt;
  }

  // Exige que el intento exista y siga `in_progress` (para guardar/enviar).
  private requireEditableAttempt(attemptId: string): TestAttempt {
    const attempt = this.requireAttempt(attemptId);
    if (attempt.status === 'submitted') {
      throw new TestAttemptError([
        TestAttemptErrorCode.ALREADY_SUBMITTED,
      ]);
    }
    if (attempt.status === 'cancelled') {
      throw new TestAttemptError([TestAttemptErrorCode.CANCELLED]);
    }
    return attempt;
  }

  private requireTestQuestion(testId: string, testQuestionId: string) {
    const testQuestion = this.testQuestions
      .findByTest(testId)
      .find((item) => item.id === testQuestionId);
    if (!testQuestion) {
      throw new TestAttemptError([
        TestAttemptErrorCode.QUESTION_NOT_IN_TEST,
      ]);
    }
    return testQuestion;
  }
}
