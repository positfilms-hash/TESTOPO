import { describe, expect, it } from 'vitest';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { TopicValidationError } from '../src/service/topicValidationError.js';
import { TopicValidationErrorCode } from '../src/validation/topicErrors.js';
import { QuestionValidationError } from '../src/service/questionValidationError.js';
import { ValidationErrorCode } from '../src/validation/errors.js';
import { validInput, TEST_OPPOSITION_ID } from './helpers.js';

// Conecta el banco de preguntas (SPEC 001) con el mapa del temario (SPEC 003):
// QuestionService resuelve el estado del tema a traves de TopicService, y
// TopicService asigna temas a preguntas a traves del repositorio de preguntas.
function makeWiredServices(): {
  topics: TopicService;
  questions: QuestionService;
} {
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const topics = new TopicService(topicRepository, { questionRepository });
  const questions = new QuestionService(questionRepository, {
    resolveTopicStatus: async (topicId) => (await topics.getTopic(topicId))?.status ?? null,
  });
  return { topics, questions };
}

describe('Topic <-> Question', () => {
  it('vincula una pregunta a un tema existente', async () => {
    const { topics, questions } = makeWiredServices();
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });
    const question = await questions.createQuestion(validInput());

    await topics.assignTopicToQuestion(question.id, topic.id);

    const updated = await questions.getQuestion(question.id);
    expect(updated?.topic_id).toBe(topic.id);
    expect(updated?.topic).toBe('Tema 1');
  });

  it('no permite vincular una pregunta a un tema inexistente', async () => {
    const { topics, questions } = makeWiredServices();
    const question = await questions.createQuestion(validInput());

    try {
      await topics.assignTopicToQuestion(question.id, 'no-existe');
    } catch (error) {
      expect(error).toBeInstanceOf(TopicValidationError);
      expect((error as TopicValidationError).errors).toContain(
        TopicValidationErrorCode.TOPIC_NOT_FOUND,
      );
      return;
    }
    throw new Error('Expected TopicValidationError to be thrown');
  });

  it('no permite vincular un tema a una pregunta inexistente', async () => {
    const { topics } = makeWiredServices();
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });

    try {
      await topics.assignTopicToQuestion('no-existe', topic.id);
    } catch (error) {
      expect(error).toBeInstanceOf(TopicValidationError);
      expect((error as TopicValidationError).errors).toContain(
        TopicValidationErrorCode.QUESTION_NOT_FOUND,
      );
      return;
    }
    throw new Error('Expected TopicValidationError to be thrown');
  });

  it('una pregunta validada mantiene su tema asociado', async () => {
    const { topics, questions } = makeWiredServices();
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });
    const question = await questions.createQuestion(validInput());
    await topics.assignTopicToQuestion(question.id, topic.id);

    const validated = await questions.changeStatus(question.id, 'validated');

    expect(validated.status).toBe('validated');
    expect(validated.topic_id).toBe(topic.id);
  });

  it('no valida una pregunta vinculada a un tema obsolete', async () => {
    const { topics, questions } = makeWiredServices();
    const topic = await topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema antiguo' });
    const question = await questions.createQuestion(validInput());
    await topics.assignTopicToQuestion(question.id, topic.id);

    await topics.markObsolete(topic.id);

    try {
      await questions.changeStatus(question.id, 'validated');
    } catch (error) {
      expect(error).toBeInstanceOf(QuestionValidationError);
      expect((error as QuestionValidationError).errors).toContain(
        ValidationErrorCode.TOPIC_OBSOLETE,
      );
      return;
    }
    throw new Error('Expected QuestionValidationError to be thrown');
  });
});
