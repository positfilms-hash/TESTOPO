// Cobertura basica del temario (SPEC 003, seccion 12). Funcion pura: recibe los
// datos ya cargados (temas, preguntas y vinculos material-tema) y devuelve, por
// tema, los conteos utiles para detectar huecos del temario. No implementa
// estadisticas avanzadas.
//
// Las preguntas se asocian a un tema por `topic_id` (relacion de la SPEC 003).

import type { Question } from '../models/question.js';
import type { Topic } from '../models/topic.js';
import type { TopicMaterialLink } from '../models/topicMaterialLink.js';

export interface TopicCoverage {
  topic_id: string;
  topic_title: string;
  total_questions: number;
  validated_questions: number;
  draft_questions: number;
  needs_fix_questions: number;
  linked_materials: number;
}

export function computeTopicCoverage(
  topics: Topic[],
  questions: Question[],
  links: TopicMaterialLink[],
): TopicCoverage[] {
  return topics.map((topic) => {
    const topicQuestions = questions.filter((q) => q.topic_id === topic.id);
    const linkedMaterials = links.filter(
      (link) => link.topic_id === topic.id,
    ).length;

    return {
      topic_id: topic.id,
      topic_title: topic.title,
      total_questions: topicQuestions.length,
      validated_questions: countByStatus(topicQuestions, 'validated'),
      draft_questions: countByStatus(topicQuestions, 'draft'),
      needs_fix_questions: countByStatus(topicQuestions, 'needs_fix'),
      linked_materials: linkedMaterials,
    };
  });
}

function countByStatus(questions: Question[], status: string): number {
  return questions.filter((q) => q.status === status).length;
}
