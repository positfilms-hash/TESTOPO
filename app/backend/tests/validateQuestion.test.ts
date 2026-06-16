import { describe, expect, it } from 'vitest';
import { validateQuestion } from '../src/validation/validateQuestion.js';
import { ValidationErrorCode } from '../src/validation/errors.js';
import type { Question } from '../src/models/question.js';
import { activeSource } from './helpers.js';

const now = new Date(Date.UTC(2026, 0, 1));

function validQuestion(): Question {
  return {
    id: 'q-1',
    statement: '¿Enunciado ficticio valido?',
    options: [
      { id: 'o-1', text: 'A', is_correct: true, order: 0 },
      { id: 'o-2', text: 'B', is_correct: false, order: 1 },
    ],
    correct_answer: 'o-1',
    explanation: 'Explicacion ficticia.',
    source: activeSource,
    topic: 'Tema 1',
    difficulty: 'medium',
    status: 'draft',
    created_at: now,
    updated_at: now,
  };
}

describe('validateQuestion', () => {
  it('una pregunta completa es valida', () => {
    expect(validateQuestion(validQuestion())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('una pregunta vacia acumula todos los errores aplicables', () => {
    const empty: Question = {
      id: 'q-empty',
      statement: '',
      options: [],
      correct_answer: null,
      explanation: null,
      source: null,
      topic: null,
      difficulty: null,
      status: 'draft',
      created_at: now,
      updated_at: now,
    };

    const result = validateQuestion(empty);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        ValidationErrorCode.STATEMENT_REQUIRED,
        ValidationErrorCode.OPTIONS_REQUIRED,
        ValidationErrorCode.EXPLANATION_REQUIRED,
        ValidationErrorCode.SOURCE_REQUIRED,
        ValidationErrorCode.TOPIC_REQUIRED,
        ValidationErrorCode.DIFFICULTY_REQUIRED,
      ]),
    );
  });
});
