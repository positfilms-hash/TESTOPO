// SPEC 040 (P0) - prueba END-TO-END de dominio: revision humana -> feedback
// persistido y SCOPED -> memoria incrementada por workspace+oposicion -> el bloque
// de la SIGUIENTE generacion incluye SOLO memoria del mismo scope. La memoria se
// puebla POR REVISION, no por la generacion.

import { describe, expect, it } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { InMemoryQuestionReviewRepository } from '../src/repository/inMemoryQuestionReviewRepository.js';
import { InMemoryQuestionReviewFeedbackRepository } from '../src/repository/inMemoryQuestionReviewFeedbackRepository.js';
import { InMemoryExamPatternLearningRepository } from '../src/repository/inMemoryExamPatternLearningRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { QuestionValidationService } from '../src/service/questionValidationService.js';
import { QuestionReviewService } from '../src/service/questionReviewService.js';
import {
  selectErrorMemories,
  formatAvoidBlock,
  AVOID_BLOCK_HEADER,
  type ErrorMemoryRecord,
} from '../../../supabase/functions/_shared/reliability/contract';
import { validInput } from './helpers.js';

const WS_BY_OPP: Record<string, string> = { 'op-A': 'ws-1', 'op-B': 'ws-2' };

function setup() {
  const materialRepository = new InMemoryMaterialRepository();
  const topicRepository = new InMemoryTopicRepository();
  const questionRepository = new InMemoryQuestionRepository();
  const feedbackRepository = new InMemoryQuestionReviewFeedbackRepository();
  const reviewRepository = new InMemoryQuestionReviewRepository();
  const memory = new InMemoryExamPatternLearningRepository();
  const materials = new MaterialService(materialRepository);
  const topics = new TopicService(topicRepository, { materialRepository });
  const questions = new QuestionService(questionRepository, {
    resolveMaterialStatus: async (id) => (await materials.getMaterial(id))?.status ?? null,
    resolveTopicStatus: async (id) => (await topics.getTopic(id))?.status ?? null,
  });
  const validation = new QuestionValidationService({ questionService: questions, materialRepository, topicRepository });
  const review = new QuestionReviewService({
    questionService: questions,
    validationService: validation,
    materialRepository,
    topicRepository,
    reviewRepository,
    feedbackRepository,
    errorMemoryRepository: memory,
    resolveWorkspaceId: async (oppId) => WS_BY_OPP[oppId] ?? null,
  });
  return { questions, review, feedbackRepository, memory };
}

async function pendingQuestion(questions: QuestionService, oppositionId: string) {
  const q = await questions.createQuestion(validInput({ opposition_id: oppositionId }));
  await questions.changeStatus(q.id, 'pending_review');
  return (await questions.getQuestion(q.id))!;
}

describe('SPEC 040 e2e - revision -> feedback -> memoria -> prompt aislado', () => {
  it('puebla y aisla la memoria por workspace+oposicion al rechazar', async () => {
    const { questions, review, feedbackRepository, memory } = setup();

    const a1 = await pendingQuestion(questions, 'op-A');
    const a2 = await pendingQuestion(questions, 'op-A');
    const b1 = await pendingQuestion(questions, 'op-B');

    // Revision humana (reject) con motivo estructurado + severidad.
    await review.reject(a1.id, {
      reviewer_name: 'rev',
      feedback: [{ feedback_type: 'wrong_correct_answer', severity: 'critical' }],
    });
    await review.reject(a2.id, {
      reviewer_name: 'rev',
      feedback: [{ feedback_type: 'wrong_correct_answer', severity: 'high' }],
    });
    await review.reject(b1.id, {
      reviewer_name: 'rev',
      feedback: [{ feedback_type: 'ambiguous_question', severity: 'medium' }],
    });

    // 1) Feedback PERSISTIDO y SCOPED (workspace + oposicion).
    const fbA = (await feedbackRepository.findByQuestion(a1.id))[0];
    expect(fbA.opposition_id).toBe('op-A');
    expect(fbA.workspace_id).toBe('ws-1');
    expect(fbA.feedback_type).toBe('wrong_correct_answer');

    // 2) Memoria INCREMENTADA por (workspace, oposicion, tipo, ambito): dos rechazos
    //    del mismo tipo en op-A -> una entrada con occurrences = 2.
    const memA = await memory.listErrorMemoriesByOpposition('op-A');
    expect(memA).toHaveLength(1);
    expect(memA[0].occurrences).toBe(2);
    expect(memA[0].type).toBe('wrong_correct_answer');
    expect(memA[0].severity).toBe('critical'); // severidad MAX observada
    expect(memA[0].workspace_id).toBe('ws-1');

    const memB = await memory.listErrorMemoriesByOpposition('op-B');
    expect(memB).toHaveLength(1);
    expect(memB[0].type).toBe('ambiguous_question');
    expect(memB[0].workspace_id).toBe('ws-2');

    // 3) La SIGUIENTE generacion de op-A solo ve memoria de su scope (aislamiento).
    const all = [...memA, ...memB] as unknown as ErrorMemoryRecord[];
    const selected = selectErrorMemories(
      all,
      { workspace_id: 'ws-1', opposition_id: 'op-A' },
      { maxEntries: 10, maxChars: 3000 },
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].opposition_id).toBe('op-A');

    const block = formatAvoidBlock(selected, 3000) ?? '';
    expect(block).toContain(AVOID_BLOCK_HEADER);
    expect(block).toContain(memA[0].avoid_instruction);
    expect(block).not.toContain(memB[0].avoid_instruction); // nada de op-B/ws-2
  });

  it('needs_fix con feedback tambien puebla memoria; sin feedback no crea memoria', async () => {
    const { questions, review, memory } = setup();
    const q = await pendingQuestion(questions, 'op-A');
    await review.markNeedsFix(q.id, {
      feedback: [{ feedback_type: 'explanation_weak', severity: 'medium' }],
    });
    expect(await memory.listErrorMemoriesByOpposition('op-A')).toHaveLength(1);

    const q2 = await pendingQuestion(questions, 'op-A');
    await review.markNeedsFix(q2.id, { notes: 'sin motivo' });
    // Sigue habiendo 1 (la accion sin feedback no anade memoria).
    expect(await memory.listErrorMemoriesByOpposition('op-A')).toHaveLength(1);
  });
});
