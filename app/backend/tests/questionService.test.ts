import { describe, expect, it } from 'vitest';
import { ValidationErrorCode } from '../src/validation/errors.js';
import { QuestionValidationError } from '../src/service/questionValidationError.js';
import type { Difficulty } from '../src/models/enums.js';
import { makeService, validInput } from './helpers.js';

// Comprueba que `fn` lanza QuestionValidationError incluyendo el codigo dado.
function expectValidationError(
  fn: () => unknown,
  code: ValidationErrorCode,
): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(QuestionValidationError);
    expect((error as QuestionValidationError).errors).toContain(code);
    return;
  }
  throw new Error(`Expected QuestionValidationError (${code}) to be thrown`);
}

describe('QuestionService - operaciones', () => {
  it('crea una pregunta en estado draft', () => {
    const service = makeService();
    const question = service.createQuestion(validInput());

    expect(question.status).toBe('draft');
    expect(question.id).toBeTruthy();
    expect(question.created_at).toEqual(question.updated_at);
    expect(question.options).toHaveLength(4);
    // correct_answer se deriva de la unica opcion correcta.
    const correctOption = question.options.find((o) => o.is_correct);
    expect(question.correct_answer).toBe(correctOption?.id);
  });

  it('lista, consulta y filtra preguntas', () => {
    const service = makeService();
    const easy = service.createQuestion(validInput({ topic: 'Tema 1' }));
    service.createQuestion(
      validInput({ topic: 'Tema 2', difficulty: 'hard' }),
    );

    expect(service.listQuestions()).toHaveLength(2);
    expect(service.getQuestion(easy.id)?.id).toBe(easy.id);
    expect(service.getQuestion('no-existe')).toBeNull();
    expect(service.listQuestions({ topic: 'Tema 2' })).toHaveLength(1);
    expect(service.listQuestions({ difficulty: 'hard' })).toHaveLength(1);
    expect(service.listQuestions({ status: 'validated' })).toHaveLength(0);
  });

  it('al editar una pregunta actualiza updated_at', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());

    const edited = service.editQuestion(created.id, { topic: 'Tema 9' });

    expect(edited.topic).toBe('Tema 9');
    expect(edited.updated_at.getTime()).toBeGreaterThan(
      created.updated_at.getTime(),
    );
    expect(edited.created_at).toEqual(created.created_at);
  });
});

describe('QuestionService - transicion a validated', () => {
  it('una pregunta valida puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());

    const validated = service.changeStatus(created.id, 'validated');

    expect(validated.status).toBe('validated');
  });

  it('una pregunta sin enunciado no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());
    service.editQuestion(created.id, { statement: '   ' });

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.STATEMENT_REQUIRED,
    );
  });

  it('una pregunta sin explicacion no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());
    service.editQuestion(created.id, { explanation: null });

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.EXPLANATION_REQUIRED,
    );
  });

  it('una pregunta sin fuente no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());
    service.editQuestion(created.id, { source: null });

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.SOURCE_REQUIRED,
    );
  });

  it('una pregunta sin tema no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());
    service.editQuestion(created.id, { topic: null });

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.TOPIC_REQUIRED,
    );
  });

  it('una pregunta sin dificultad no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());
    service.editQuestion(created.id, { difficulty: null });

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.DIFFICULTY_REQUIRED,
    );
  });

  it('una pregunta con dificultad invalida no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());
    // Forzamos un valor invalido saltando el tipo (entrada externa no fiable).
    service.editQuestion(created.id, {
      difficulty: 'impossible' as Difficulty,
    });

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.INVALID_DIFFICULTY,
    );
  });

  it('una pregunta con cero respuestas correctas no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(
      validInput({
        options: [
          { text: 'Ciudad A', is_correct: false },
          { text: 'Ciudad B', is_correct: false },
        ],
      }),
    );

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.SINGLE_CORRECT_OPTION_REQUIRED,
    );
  });

  it('una pregunta con mas de una respuesta correcta no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(
      validInput({
        options: [
          { text: 'Ciudad A', is_correct: true },
          { text: 'Ciudad B', is_correct: true },
        ],
      }),
    );

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.SINGLE_CORRECT_OPTION_REQUIRED,
    );
  });

  it('una pregunta con menos de 2 opciones no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(
      validInput({ options: [{ text: 'Unica', is_correct: true }] }),
    );

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.MIN_OPTIONS_NOT_MET,
    );
  });

  it('una pregunta con opciones duplicadas no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(
      validInput({
        options: [
          { text: 'Madrid', is_correct: true },
          { text: '  madrid ', is_correct: false },
          { text: 'Sevilla', is_correct: false },
        ],
      }),
    );

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.DUPLICATE_OPTIONS,
    );
  });

  it('una pregunta con fuente obsolete no puede pasar a validated', () => {
    const service = makeService();
    const created = service.createQuestion(
      validInput({
        source: {
          id: 'src-old',
          title: 'Norma derogada (ficticia)',
          type: 'law',
          reference: 'Ley ficticia 1/2000',
          status: 'obsolete',
        },
      }),
    );

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.SOURCE_OBSOLETE,
    );
  });

  it('una pregunta en estado obsolete no puede pasar directamente a validated', () => {
    const service = makeService();
    const created = service.createQuestion(validInput());
    service.changeStatus(created.id, 'obsolete');

    expectValidationError(
      () => service.changeStatus(created.id, 'validated'),
      ValidationErrorCode.OBSOLETE_CANNOT_BE_VALIDATED,
    );
  });
});
