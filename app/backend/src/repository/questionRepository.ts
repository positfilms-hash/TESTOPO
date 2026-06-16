// Contrato de persistencia del banco de preguntas. La SPEC 001 solo exige un
// almacen en memoria, pero se define como interfaz para que una futura base de
// datos pueda sustituirla sin tocar el servicio.

import type { Difficulty, QuestionStatus } from '../models/enums.js';
import type { Question } from '../models/question.js';

export interface QuestionFilter {
  status?: QuestionStatus;
  difficulty?: Difficulty;
  topic?: string;
}

export interface QuestionRepository {
  create(question: Question): Question;
  findAll(filter?: QuestionFilter): Question[];
  findById(id: string): Question | null;
  save(question: Question): Question;
}
