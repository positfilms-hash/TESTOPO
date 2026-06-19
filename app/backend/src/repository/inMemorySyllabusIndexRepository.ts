// Implementacion en memoria del indice de temario (SPEC 019).

import type {
  ExamPatternSummary,
  MaterialTopicSuggestion,
  SyllabusIndexNodeProposal,
  SyllabusIndexNodeSource,
  SyllabusIndexProposal,
  SyllabusIndexRun,
  TopicSourceReference,
} from '../models/syllabusIndex.js';
import type { SyllabusIndexRepository } from './syllabusIndexRepository.js';

export class InMemorySyllabusIndexRepository
  implements SyllabusIndexRepository
{
  private readonly runs = new Map<string, SyllabusIndexRun>();
  private readonly proposals = new Map<string, SyllabusIndexProposal>();
  private readonly nodes = new Map<string, SyllabusIndexNodeProposal>();
  private readonly suggestions = new Map<string, MaterialTopicSuggestion>();
  private readonly examPatterns = new Map<string, ExamPatternSummary>();
  private readonly nodeSources = new Map<string, SyllabusIndexNodeSource>();
  private readonly topicSourceRefs = new Map<string, TopicSourceReference>();

  async createRun(run: SyllabusIndexRun): Promise<SyllabusIndexRun> {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }
  async getRun(id: string): Promise<SyllabusIndexRun | null> {
    const run = this.runs.get(id);
    return run ? clone(run) : null;
  }
  async updateRun(run: SyllabusIndexRun): Promise<SyllabusIndexRun> {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async createProposal(
    proposal: SyllabusIndexProposal,
  ): Promise<SyllabusIndexProposal> {
    this.proposals.set(proposal.id, clone(proposal));
    return clone(proposal);
  }
  async getProposal(id: string): Promise<SyllabusIndexProposal | null> {
    const proposal = this.proposals.get(id);
    return proposal ? clone(proposal) : null;
  }
  async updateProposal(
    proposal: SyllabusIndexProposal,
  ): Promise<SyllabusIndexProposal> {
    this.proposals.set(proposal.id, clone(proposal));
    return clone(proposal);
  }
  async listProposalsByOpposition(
    oppositionId: string,
  ): Promise<SyllabusIndexProposal[]> {
    return [...this.proposals.values()]
      .filter((p) => p.opposition_id === oppositionId)
      .map(clone);
  }

  async createNode(
    node: SyllabusIndexNodeProposal,
  ): Promise<SyllabusIndexNodeProposal> {
    this.nodes.set(node.id, clone(node));
    return clone(node);
  }
  async getNode(id: string): Promise<SyllabusIndexNodeProposal | null> {
    const node = this.nodes.get(id);
    return node ? clone(node) : null;
  }
  async updateNode(
    node: SyllabusIndexNodeProposal,
  ): Promise<SyllabusIndexNodeProposal> {
    this.nodes.set(node.id, clone(node));
    return clone(node);
  }
  async listNodesByProposal(
    proposalId: string,
  ): Promise<SyllabusIndexNodeProposal[]> {
    return [...this.nodes.values()]
      .filter((n) => n.proposal_id === proposalId)
      .map(clone);
  }

  async createSuggestion(
    suggestion: MaterialTopicSuggestion,
  ): Promise<MaterialTopicSuggestion> {
    this.suggestions.set(suggestion.id, clone(suggestion));
    return clone(suggestion);
  }
  async getSuggestion(id: string): Promise<MaterialTopicSuggestion | null> {
    const suggestion = this.suggestions.get(id);
    return suggestion ? clone(suggestion) : null;
  }
  async updateSuggestion(
    suggestion: MaterialTopicSuggestion,
  ): Promise<MaterialTopicSuggestion> {
    this.suggestions.set(suggestion.id, clone(suggestion));
    return clone(suggestion);
  }
  async listSuggestionsByRun(
    runId: string,
  ): Promise<MaterialTopicSuggestion[]> {
    return [...this.suggestions.values()]
      .filter((s) => s.run_id === runId)
      .map(clone);
  }

  async createExamPattern(
    pattern: ExamPatternSummary,
  ): Promise<ExamPatternSummary> {
    this.examPatterns.set(pattern.id, clone(pattern));
    return clone(pattern);
  }
  async listExamPatternsByRun(
    runId: string,
  ): Promise<ExamPatternSummary[]> {
    return [...this.examPatterns.values()]
      .filter((p) => p.run_id === runId)
      .map(clone);
  }

  async createNodeSource(
    source: SyllabusIndexNodeSource,
  ): Promise<SyllabusIndexNodeSource> {
    this.nodeSources.set(source.id, clone(source));
    return clone(source);
  }
  async listNodeSourcesByProposal(
    proposalId: string,
  ): Promise<SyllabusIndexNodeSource[]> {
    return [...this.nodeSources.values()]
      .filter((s) => s.proposal_id === proposalId)
      .map(clone);
  }
  async listNodeSourcesByNode(
    nodeId: string,
  ): Promise<SyllabusIndexNodeSource[]> {
    return [...this.nodeSources.values()]
      .filter((s) => s.node_id === nodeId)
      .map(clone);
  }

  async createTopicSourceReference(
    ref: TopicSourceReference,
  ): Promise<TopicSourceReference> {
    this.topicSourceRefs.set(ref.id, clone(ref));
    return clone(ref);
  }
  async listTopicSourceReferencesByTopic(
    topicId: string,
  ): Promise<TopicSourceReference[]> {
    return [...this.topicSourceRefs.values()]
      .filter((r) => r.topic_id === topicId)
      .map(clone);
  }
  async listTopicSourceReferencesByOpposition(
    oppositionId: string,
  ): Promise<TopicSourceReference[]> {
    return [...this.topicSourceRefs.values()]
      .filter((r) => r.opposition_id === oppositionId)
      .map(clone);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
