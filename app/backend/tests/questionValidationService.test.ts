import { describe, expect, it } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import {
  QuestionService,
  type CreateQuestionInput,
} from '../src/service/questionService.js';
import { QuestionValidationService } from '../src/service/questionValidationService.js';
import { QuestionValidationCode } from '../src/quality/qualityCodes.js';
import type { QuestionValidationResult } from '../src/models/questionValidationResult.js';
import type { Difficulty } from '../src/models/enums.js';
import type { Source } from '../src/models/source.js';
import { validInput, TEST_OPPOSITION_ID } from './helpers.js';

function makeSetup() {
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(questionRepository);
  const validation = new QuestionValidationService({
    questionService: questions,
    materialRepository,
    topicRepository,
  });
  return { materials, topics, questions, validation };
}

function hasError(
  result: QuestionValidationResult,
  code: QuestionValidationCode,
): boolean {
  return result.errors.some((finding) => finding.code === code);
}

function hasWarning(
  result: QuestionValidationResult,
  code: QuestionValidationCode,
): boolean {
  return result.warnings.some((finding) => finding.code === code);
}

// Crea una pregunta (draft) a partir del input valido base con overrides.
function createQuestion(
  questions: QuestionService,
  overrides: Partial<CreateQuestionInput> = {},
) {
  return questions.createQuestion(validInput(overrides));
}

describe('QuestionValidationService - validacion formal', () => {
  it('una pregunta correcta pasa sin errores criticos', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions);

    const result = validation.validateQuestion(q.id);

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.recommended_status).toBe('pending_review');
  });

  it('sin enunciado falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { statement: '   ' });
    const result = validation.validateQuestion(q.id);
    expect(result.passed).toBe(false);
    expect(hasError(result, QuestionValidationCode.STATEMENT_REQUIRED)).toBe(
      true,
    );
  });

  it('sin opciones falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { options: [] });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.OPTIONS_REQUIRED)).toBe(
      true,
    );
  });

  it('con menos de 2 opciones falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, {
      options: [{ text: 'Unica', is_correct: true }],
    });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.MIN_OPTIONS_NOT_MET)).toBe(
      true,
    );
  });

  it('con cero respuestas correctas falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, {
      options: [
        { text: 'A', is_correct: false },
        { text: 'B', is_correct: false },
      ],
    });
    const result = validation.validateQuestion(q.id);
    expect(
      hasError(result, QuestionValidationCode.SINGLE_CORRECT_OPTION_REQUIRED),
    ).toBe(true);
  });

  it('con mas de una respuesta correcta falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, {
      options: [
        { text: 'A', is_correct: true },
        { text: 'B', is_correct: true },
      ],
    });
    const result = validation.validateQuestion(q.id);
    expect(
      hasError(result, QuestionValidationCode.SINGLE_CORRECT_OPTION_REQUIRED),
    ).toBe(true);
  });

  it('sin explicacion falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { explanation: null });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.EXPLANATION_REQUIRED)).toBe(
      true,
    );
  });

  it('sin fuente falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { source: null });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.SOURCE_REQUIRED)).toBe(true);
  });

  it('sin tema falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { topic: null });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.TOPIC_REQUIRED)).toBe(true);
  });

  it('sin dificultad falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { difficulty: null });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.DIFFICULTY_REQUIRED)).toBe(
      true,
    );
  });

  it('con dificultad invalida falla (mixed no es valida)', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, {
      difficulty: 'mixed' as Difficulty,
    });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.INVALID_DIFFICULTY)).toBe(
      true,
    );
  });

  it('con opciones duplicadas falla', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, {
      options: [
        { text: 'Madrid', is_correct: true },
        { text: ' madrid ', is_correct: false },
        { text: 'Sevilla', is_correct: false },
      ],
    });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.DUPLICATE_OPTIONS)).toBe(
      true,
    );
  });

  it('con enunciado duplicado exacto falla', () => {
    const { questions, validation } = makeSetup();
    createQuestion(questions, { statement: 'Mismo enunciado ficticio comun' });
    const second = createQuestion(questions, {
      statement: 'Mismo enunciado ficticio comun',
    });
    const result = validation.validateQuestion(second.id);
    expect(hasError(result, QuestionValidationCode.DUPLICATE_STATEMENT)).toBe(
      true,
    );
  });
});

describe('QuestionValidationService - fuente y tema', () => {
  it('con fuente obsoleta falla', () => {
    const { questions, validation } = makeSetup();
    const source: Source = {
      id: 'src-old',
      title: 'Norma ficticia derogada',
      type: 'law',
      reference: 'Ley ficticia',
      status: 'obsolete',
    };
    const q = createQuestion(questions, { source });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.SOURCE_OBSOLETE)).toBe(true);
  });

  it('con material vinculado obsoleto falla', () => {
    const { materials, questions, validation } = makeSetup();
    const material = materials.createMaterial({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Material ficticio',
      type: 'syllabus',
      content_text: 'texto',
    });
    materials.markObsolete(material.id);
    const source: Source = {
      id: 'src-mat',
      material_id: material.id,
      title: 'Material ficticio',
      type: 'syllabus',
      reference: 'Tema 1',
      excerpt: 'fragmento',
      status: 'active',
    };
    const q = createQuestion(questions, { source });
    const result = validation.validateQuestion(q.id);
    expect(
      hasError(result, QuestionValidationCode.SOURCE_MATERIAL_OBSOLETE),
    ).toBe(true);
  });

  it('con tema obsoleto (topic_id) falla', () => {
    const { topics, questions, validation } = makeSetup();
    const topic = topics.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema viejo' });
    topics.markObsolete(topic.id);
    const q = createQuestion(questions, { topic_id: topic.id });
    const result = validation.validateQuestion(q.id);
    expect(hasError(result, QuestionValidationCode.TOPIC_OBSOLETE)).toBe(true);
  });
});

describe('QuestionValidationService - advertencias', () => {
  it('explicacion muy corta genera warning', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { explanation: 'Corto.' });
    const result = validation.validateQuestion(q.id);
    expect(result.passed).toBe(true);
    expect(hasWarning(result, QuestionValidationCode.EXPLANATION_TOO_SHORT)).toBe(
      true,
    );
    expect(result.status).toBe('passed_with_warnings');
  });

  it('enunciado muy corto genera warning', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { statement: 'Corto?' });
    const result = validation.validateQuestion(q.id);
    expect(hasWarning(result, QuestionValidationCode.STATEMENT_TOO_SHORT)).toBe(
      true,
    );
  });
});

describe('QuestionValidationService - aplicar resultado', () => {
  it('con errores criticos cambia la pregunta a needs_fix', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions, { explanation: null });
    const { question } = validation.applyValidation(q.id);
    expect(question.status).toBe('needs_fix');
  });

  it('sin errores criticos cambia la pregunta a pending_review', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions);
    const { question } = validation.applyValidation(q.id);
    expect(question.status).toBe('pending_review');
  });

  it('aplicar resultado nunca pasa la pregunta a validated', () => {
    const { questions, validation } = makeSetup();
    const valid = createQuestion(questions);
    const invalid = createQuestion(questions, { source: null });
    expect(validation.applyValidation(valid.id).question.status).not.toBe(
      'validated',
    );
    expect(validation.applyValidation(invalid.id).question.status).not.toBe(
      'validated',
    );
  });

  it('guarda y recupera el ultimo informe (historial)', () => {
    const { questions, validation } = makeSetup();
    const q = createQuestion(questions);
    validation.validateQuestion(q.id);
    const last = validation.getLastReport(q.id);
    expect(last?.question_id).toBe(q.id);
    expect(last?.validator_version).toBe('quality-gate-1');
  });

  it('valida un lote sin detenerse por preguntas inexistentes', () => {
    const { questions, validation } = makeSetup();
    const a = createQuestion(questions);
    const b = createQuestion(questions, { source: null });
    const results = validation.validateMany([a.id, 'no-existe', b.id]);
    expect(results).toHaveLength(2);
  });
});
