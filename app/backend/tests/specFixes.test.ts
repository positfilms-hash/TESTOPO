// Tests de los arreglos de revision requeridos por la SPEC 004 sobre codigo de
// SPEC 001/003 (trazabilidad fuerte).

import { describe, expect, it } from 'vitest';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { QuestionService } from '../src/service/questionService.js';
import { QuestionValidationError } from '../src/service/questionValidationError.js';
import { TopicService } from '../src/service/topicService.js';
import { validateQuestion } from '../src/validation/validateQuestion.js';
import { ValidationErrorCode } from '../src/validation/errors.js';
import type { Question } from '../src/models/question.js';
import type { Source } from '../src/models/source.js';
import { validInput, TEST_OPPOSITION_ID } from './helpers.js';

const now = new Date(Date.UTC(2026, 0, 1));

describe('Fix: validateQuestion comprueba correct_answer', () => {
  it('falla si correct_answer no apunta a la unica opcion correcta', async () => {
    const question: Question = {
      id: 'q1',
      opposition_id: TEST_OPPOSITION_ID,
      statement: 'Enunciado ficticio',
      options: [
        { id: 'o-1', text: 'A', is_correct: true, order: 0 },
        { id: 'o-2', text: 'B', is_correct: false, order: 1 },
      ],
      correct_answer: 'o-2', // incoherente: la correcta es o-1
      explanation: 'Explicacion',
      source: null,
      topic: 'Tema 1',
      difficulty: 'easy',
      status: 'draft',
      created_at: now,
      updated_at: now,
    };

    const result = validateQuestion(question);
    expect(result.errors).toContain(
      ValidationErrorCode.CORRECT_ANSWER_MISMATCH,
    );
  });
});

function sourceWithMaterial(materialId: string): Source {
  return {
    id: 'src',
    material_id: materialId,
    title: 'Fuente ficticia',
    type: 'syllabus',
    reference: 'Tema 1',
    status: 'active',
  };
}

describe('Fix: no validar si material/tema no se puede resolver', () => {
  it('bloquea validar cuando el material no se resuelve (resolver -> null)', async () => {
    const service = new QuestionService(new InMemoryQuestionRepository(), {
      resolveMaterialStatus: async () => null, // material borrado / irresoluble
    });
    const q = await service.createQuestion(
      validInput({ source: sourceWithMaterial('ghost') }),
    );

    try {
      await service.changeStatus(q.id, 'validated');
    } catch (error) {
      expect((error as QuestionValidationError).errors).toContain(
        ValidationErrorCode.SOURCE_MATERIAL_OBSOLETE,
      );
      return;
    }
    throw new Error('Expected QuestionValidationError');
  });

  it('bloquea validar cuando el tema no se resuelve (resolver -> null)', async () => {
    const service = new QuestionService(new InMemoryQuestionRepository(), {
      resolveTopicStatus: async () => null,
    });
    const q = await service.createQuestion(validInput({ topic_id: 'ghost' }));

    try {
      await service.changeStatus(q.id, 'validated');
    } catch (error) {
      expect((error as QuestionValidationError).errors).toContain(
        ValidationErrorCode.TOPIC_OBSOLETE,
      );
      return;
    }
    throw new Error('Expected QuestionValidationError');
  });
});

describe('Fix: TopicService.linkMaterial exige repositorio de material', () => {
  it('lanza si no hay materialRepository configurado', async () => {
    const topics = new TopicService(new InMemoryTopicRepository());
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });

    await expect(topics.linkMaterial('cualquier', topic.id)).rejects.toThrow();
  });
});
