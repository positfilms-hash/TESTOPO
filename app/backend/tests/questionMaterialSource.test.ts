import { describe, expect, it } from 'vitest';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { QuestionService } from '../src/service/questionService.js';
import { MaterialService } from '../src/service/materialService.js';
import { QuestionValidationError } from '../src/service/questionValidationError.js';
import { ValidationErrorCode } from '../src/validation/errors.js';
import type { Source } from '../src/models/source.js';
import { validInput } from './helpers.js';

// Conecta el banco de preguntas con el registro de material (SPEC 002): el
// estado del material se resuelve a traves del MaterialService.
function makeWiredServices(): {
  questions: QuestionService;
  materials: MaterialService;
} {
  const materials = new MaterialService(new InMemoryMaterialRepository());
  const questions = new QuestionService(new InMemoryQuestionRepository(), {
    resolveMaterialStatus: (materialId) =>
      materials.getMaterial(materialId)?.status ?? null,
  });
  return { questions, materials };
}

function sourceForMaterial(materialId: string): Source {
  return {
    id: 'src-mat',
    material_id: materialId,
    title: 'Temario ficticio - Tema 1',
    type: 'syllabus',
    reference: 'Tema 1, apartado 2',
    excerpt: 'Fragmento ficticio que respalda la pregunta.',
    status: 'active',
  };
}

describe('Question source vinculada a material', () => {
  it('valida una pregunta cuya fuente apunta a material activo', () => {
    const { questions, materials } = makeWiredServices();
    const material = materials.createMaterial({
      title: 'Tema 1 - Documento ficticio',
      type: 'syllabus',
    });
    const question = questions.createQuestion(
      validInput({ source: sourceForMaterial(material.id) }),
    );

    const validated = questions.changeStatus(question.id, 'validated');

    expect(validated.status).toBe('validated');
  });

  it('no valida una pregunta cuya fuente apunta a material obsolete', () => {
    const { questions, materials } = makeWiredServices();
    const material = materials.createMaterial({
      title: 'Norma ficticia derogada',
      type: 'law',
    });
    const question = questions.createQuestion(
      validInput({ source: sourceForMaterial(material.id) }),
    );

    materials.markObsolete(material.id);

    try {
      questions.changeStatus(question.id, 'validated');
    } catch (error) {
      expect(error).toBeInstanceOf(QuestionValidationError);
      expect((error as QuestionValidationError).errors).toContain(
        ValidationErrorCode.SOURCE_MATERIAL_OBSOLETE,
      );
      return;
    }
    throw new Error('Expected QuestionValidationError to be thrown');
  });
});
