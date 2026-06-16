// Implementacion en memoria del repositorio de preguntas (SPEC 001, seccion 9).
// Clona las preguntas al entrar y salir del almacen para que el estado interno
// no pueda mutarse por referencia desde fuera.

import type { Question } from '../models/question.js';
import type {
  QuestionFilter,
  QuestionRepository,
} from './questionRepository.js';

export class InMemoryQuestionRepository implements QuestionRepository {
  private readonly questions = new Map<string, Question>();

  create(question: Question): Question {
    this.questions.set(question.id, clone(question));
    return clone(question);
  }

  findAll(filter: QuestionFilter = {}): Question[] {
    let result = [...this.questions.values()];
    if (filter.status !== undefined) {
      result = result.filter((question) => question.status === filter.status);
    }
    if (filter.difficulty !== undefined) {
      result = result.filter(
        (question) => question.difficulty === filter.difficulty,
      );
    }
    if (filter.topic !== undefined) {
      result = result.filter((question) => question.topic === filter.topic);
    }
    return result.map(clone);
  }

  findById(id: string): Question | null {
    const question = this.questions.get(id);
    return question ? clone(question) : null;
  }

  save(question: Question): Question {
    if (!this.questions.has(question.id)) {
      throw new Error(`Cannot save unknown question: ${question.id}`);
    }
    this.questions.set(question.id, clone(question));
    return clone(question);
  }
}

function clone(question: Question): Question {
  return structuredClone(question);
}
