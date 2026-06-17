import { describe, expect, it } from 'vitest';
import { computeTopicCoverage } from '../src/service/topicCoverage.js';
import type { Topic } from '../src/models/topic.js';
import type { Question } from '../src/models/question.js';
import type { TopicMaterialLink } from '../src/models/topicMaterialLink.js';

const now = new Date(Date.UTC(2026, 0, 1));

function topic(id: string, title: string): Topic {
  return {
    id,
    opposition_id: 'opp-test',
    title,
    description: null,
    code: null,
    parent_id: null,
    order: 0,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
}

function question(topicId: string | null, status: Question['status']): Question {
  return {
    id: `q-${Math.random()}`,
    opposition_id: 'opp-test',
    statement: 'Pregunta ficticia',
    options: [],
    correct_answer: null,
    explanation: null,
    source: null,
    topic: null,
    topic_id: topicId,
    difficulty: null,
    status,
    created_at: now,
    updated_at: now,
  };
}

describe('computeTopicCoverage', () => {
  it('cuenta preguntas por estado y materiales vinculados por tema', () => {
    const topics = [topic('t1', 'Tema 1'), topic('t2', 'Tema 2 sin nada')];
    const questions = [
      question('t1', 'validated'),
      question('t1', 'draft'),
      question('t1', 'needs_fix'),
      question('t1', 'rejected'),
      question(null, 'validated'), // sin tema: no cuenta
    ];
    const links: TopicMaterialLink[] = [
      {
        id: 'l1',
        material_id: 'm1',
        topic_id: 't1',
        reference: null,
        created_at: now,
      },
    ];

    const coverage = computeTopicCoverage(topics, questions, links);

    const t1 = coverage.find((c) => c.topic_id === 't1');
    expect(t1).toMatchObject({
      topic_title: 'Tema 1',
      total_questions: 4,
      validated_questions: 1,
      draft_questions: 1,
      needs_fix_questions: 1,
      linked_materials: 1,
    });

    const t2 = coverage.find((c) => c.topic_id === 't2');
    expect(t2).toMatchObject({
      total_questions: 0,
      linked_materials: 0,
    });
  });
});
