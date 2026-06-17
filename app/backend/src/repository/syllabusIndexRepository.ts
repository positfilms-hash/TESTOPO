// Contrato de persistencia del indice de temario (SPEC 019). Una sola interfaz
// agrupa run/propuesta/nodos/sugerencias/patrones por simplicidad del MVP.

import type {
  ExamPatternSummary,
  MaterialTopicSuggestion,
  SyllabusIndexNodeProposal,
  SyllabusIndexProposal,
  SyllabusIndexRun,
} from '../models/syllabusIndex.js';

export interface SyllabusIndexRepository {
  // Runs
  createRun(run: SyllabusIndexRun): Promise<SyllabusIndexRun>;
  getRun(id: string): Promise<SyllabusIndexRun | null>;
  updateRun(run: SyllabusIndexRun): Promise<SyllabusIndexRun>;

  // Proposals
  createProposal(
    proposal: SyllabusIndexProposal,
  ): Promise<SyllabusIndexProposal>;
  getProposal(id: string): Promise<SyllabusIndexProposal | null>;
  updateProposal(
    proposal: SyllabusIndexProposal,
  ): Promise<SyllabusIndexProposal>;
  listProposalsByOpposition(
    oppositionId: string,
  ): Promise<SyllabusIndexProposal[]>;

  // Nodes
  createNode(
    node: SyllabusIndexNodeProposal,
  ): Promise<SyllabusIndexNodeProposal>;
  getNode(id: string): Promise<SyllabusIndexNodeProposal | null>;
  updateNode(
    node: SyllabusIndexNodeProposal,
  ): Promise<SyllabusIndexNodeProposal>;
  listNodesByProposal(
    proposalId: string,
  ): Promise<SyllabusIndexNodeProposal[]>;

  // Material suggestions
  createSuggestion(
    suggestion: MaterialTopicSuggestion,
  ): Promise<MaterialTopicSuggestion>;
  getSuggestion(id: string): Promise<MaterialTopicSuggestion | null>;
  updateSuggestion(
    suggestion: MaterialTopicSuggestion,
  ): Promise<MaterialTopicSuggestion>;
  listSuggestionsByRun(runId: string): Promise<MaterialTopicSuggestion[]>;

  // Exam pattern summaries
  createExamPattern(pattern: ExamPatternSummary): Promise<ExamPatternSummary>;
  listExamPatternsByRun(runId: string): Promise<ExamPatternSummary[]>;
}
