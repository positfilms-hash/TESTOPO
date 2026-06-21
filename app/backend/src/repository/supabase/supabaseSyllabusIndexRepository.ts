// Repositorio Supabase del indice de temario con IA (SPEC 019 + 028-D). Persiste
// las 7 entidades del indice (runs, propuestas, nodos, sugerencias, patrones de
// examen, fuentes de nodo y referencias de fuente de temas aplicados) en sus
// tablas. Mismo patron que el resto de repos Supabase del dominio.
//
// Los arrays del modelo (material_ids, source_references, warnings, ...) se
// guardan como JSONB (como en SPEC 023/024). El campo `order` del nodo se mapea
// a la columna `order_index` (palabra reservada en SQL).

import type {
  ExamPatternSummary,
  MaterialSuggestionStatus,
  MaterialTopicSuggestion,
  SyllabusIndexNodeProposal,
  SyllabusIndexNodeSource,
  SyllabusIndexProposal,
  SyllabusIndexRun,
  SyllabusNodeStatus,
  SyllabusProposalStatus,
  SyllabusRunStatus,
  TopicSourceReference,
} from '../../models/syllabusIndex.js';
import type { SyllabusIndexRepository } from '../syllabusIndexRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const RUNS = 'syllabus_index_runs';
const PROPOSALS = 'syllabus_index_proposals';
const NODES = 'syllabus_index_node_proposals';
const SUGGESTIONS = 'material_topic_suggestions';
const EXAM_PATTERNS = 'exam_pattern_summaries';
const NODE_SOURCES = 'syllabus_index_node_sources';
const TOPIC_SOURCE_REFS = 'topic_source_references';

export class SupabaseSyllabusIndexRepository
  implements SyllabusIndexRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  // --- Runs ---
  async createRun(run: SyllabusIndexRun): Promise<SyllabusIndexRun> {
    const row = await this.port.table(RUNS).insert(runToRow(run));
    return toRun(row);
  }

  async getRun(id: string): Promise<SyllabusIndexRun | null> {
    const rows = await this.port.table(RUNS).selectMatch({ id });
    return rows[0] ? toRun(rows[0]) : null;
  }

  async updateRun(run: SyllabusIndexRun): Promise<SyllabusIndexRun> {
    const row = await this.port.table(RUNS).updateById(run.id, runToRow(run));
    return toRun(row);
  }

  // --- Proposals ---
  async createProposal(
    proposal: SyllabusIndexProposal,
  ): Promise<SyllabusIndexProposal> {
    const row = await this.port
      .table(PROPOSALS)
      .insert(proposalToRow(proposal));
    return toProposal(row);
  }

  async getProposal(id: string): Promise<SyllabusIndexProposal | null> {
    const rows = await this.port.table(PROPOSALS).selectMatch({ id });
    return rows[0] ? toProposal(rows[0]) : null;
  }

  async updateProposal(
    proposal: SyllabusIndexProposal,
  ): Promise<SyllabusIndexProposal> {
    const row = await this.port
      .table(PROPOSALS)
      .updateById(proposal.id, proposalToRow(proposal));
    return toProposal(row);
  }

  async listProposalsByOpposition(
    oppositionId: string,
  ): Promise<SyllabusIndexProposal[]> {
    const rows = await this.port
      .table(PROPOSALS)
      .selectMatch({ opposition_id: oppositionId });
    return rows.map(toProposal);
  }

  // --- Nodes ---
  async createNode(
    node: SyllabusIndexNodeProposal,
  ): Promise<SyllabusIndexNodeProposal> {
    const row = await this.port.table(NODES).insert(nodeToRow(node));
    return toNode(row);
  }

  async getNode(id: string): Promise<SyllabusIndexNodeProposal | null> {
    const rows = await this.port.table(NODES).selectMatch({ id });
    return rows[0] ? toNode(rows[0]) : null;
  }

  async updateNode(
    node: SyllabusIndexNodeProposal,
  ): Promise<SyllabusIndexNodeProposal> {
    const row = await this.port.table(NODES).updateById(node.id, nodeToRow(node));
    return toNode(row);
  }

  async listNodesByProposal(
    proposalId: string,
  ): Promise<SyllabusIndexNodeProposal[]> {
    const rows = await this.port
      .table(NODES)
      .selectMatch({ proposal_id: proposalId });
    return rows.map(toNode).sort((a, b) => a.order - b.order);
  }

  // --- Material suggestions ---
  async createSuggestion(
    suggestion: MaterialTopicSuggestion,
  ): Promise<MaterialTopicSuggestion> {
    const row = await this.port
      .table(SUGGESTIONS)
      .insert(suggestionToRow(suggestion));
    return toSuggestion(row);
  }

  async getSuggestion(id: string): Promise<MaterialTopicSuggestion | null> {
    const rows = await this.port.table(SUGGESTIONS).selectMatch({ id });
    return rows[0] ? toSuggestion(rows[0]) : null;
  }

  async updateSuggestion(
    suggestion: MaterialTopicSuggestion,
  ): Promise<MaterialTopicSuggestion> {
    const row = await this.port
      .table(SUGGESTIONS)
      .updateById(suggestion.id, suggestionToRow(suggestion));
    return toSuggestion(row);
  }

  async listSuggestionsByRun(
    runId: string,
  ): Promise<MaterialTopicSuggestion[]> {
    const rows = await this.port
      .table(SUGGESTIONS)
      .selectMatch({ run_id: runId });
    return rows.map(toSuggestion);
  }

  // --- Exam pattern summaries ---
  async createExamPattern(
    pattern: ExamPatternSummary,
  ): Promise<ExamPatternSummary> {
    const row = await this.port
      .table(EXAM_PATTERNS)
      .insert(examPatternToRow(pattern));
    return toExamPattern(row);
  }

  async listExamPatternsByRun(runId: string): Promise<ExamPatternSummary[]> {
    const rows = await this.port
      .table(EXAM_PATTERNS)
      .selectMatch({ run_id: runId });
    return rows.map(toExamPattern);
  }

  // --- Node sources (028-D) ---
  async createNodeSource(
    source: SyllabusIndexNodeSource,
  ): Promise<SyllabusIndexNodeSource> {
    const row = await this.port
      .table(NODE_SOURCES)
      .insert(nodeSourceToRow(source));
    return toNodeSource(row);
  }

  async listNodeSourcesByProposal(
    proposalId: string,
  ): Promise<SyllabusIndexNodeSource[]> {
    const rows = await this.port
      .table(NODE_SOURCES)
      .selectMatch({ proposal_id: proposalId });
    return rows.map(toNodeSource);
  }

  async listNodeSourcesByNode(
    nodeId: string,
  ): Promise<SyllabusIndexNodeSource[]> {
    const rows = await this.port
      .table(NODE_SOURCES)
      .selectMatch({ node_id: nodeId });
    return rows.map(toNodeSource);
  }

  // --- Topic source references (028-D) ---
  async createTopicSourceReference(
    ref: TopicSourceReference,
  ): Promise<TopicSourceReference> {
    const row = await this.port
      .table(TOPIC_SOURCE_REFS)
      .insert(topicSourceRefToRow(ref));
    return toTopicSourceRef(row);
  }

  async listTopicSourceReferencesByTopic(
    topicId: string,
  ): Promise<TopicSourceReference[]> {
    const rows = await this.port
      .table(TOPIC_SOURCE_REFS)
      .selectMatch({ topic_id: topicId });
    return rows.map(toTopicSourceRef);
  }

  async listTopicSourceReferencesByOpposition(
    oppositionId: string,
  ): Promise<TopicSourceReference[]> {
    const rows = await this.port
      .table(TOPIC_SOURCE_REFS)
      .selectMatch({ opposition_id: oppositionId });
    return rows.map(toTopicSourceRef);
  }
}

// =====================================================================
// Mapeos por entidad (modelo <-> fila). Arrays como JSONB; `order`->`order_index`.
// =====================================================================

function runToRow(r: SyllabusIndexRun): SupabaseRow {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    opposition_id: r.opposition_id,
    created_by: r.created_by,
    status: r.status,
    provider: r.provider,
    model: r.model,
    material_ids: r.material_ids,
    section_ids: r.section_ids ?? [],
    input_summary: r.input_summary,
    total_materials: r.total_materials,
    analyzed_materials: r.analyzed_materials,
    ignored_materials: r.ignored_materials,
    proposed_topics_count: r.proposed_topics_count,
    warnings: r.warnings,
    errors: r.errors,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function toRun(row: SupabaseRow): SyllabusIndexRun {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    created_by: asNullableString(row.created_by),
    status: (row.status as SyllabusRunStatus) ?? 'pending',
    provider: String(row.provider ?? ''),
    model: asNullableString(row.model),
    material_ids: asStringArray(row.material_ids),
    section_ids: asStringArray(row.section_ids),
    input_summary: String(row.input_summary ?? ''),
    total_materials: asNumber(row.total_materials),
    analyzed_materials: asNumber(row.analyzed_materials),
    ignored_materials: asNumber(row.ignored_materials),
    proposed_topics_count: asNumber(row.proposed_topics_count),
    warnings: asStringArray(row.warnings),
    errors: asStringArray(row.errors),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function proposalToRow(p: SyllabusIndexProposal): SupabaseRow {
  return {
    id: p.id,
    run_id: p.run_id,
    workspace_id: p.workspace_id,
    opposition_id: p.opposition_id,
    title: p.title,
    summary: p.summary,
    status: p.status,
    created_by: p.created_by,
    approved_by: p.approved_by,
    approved_at: p.approved_at ? iso(p.approved_at) : null,
    applied_at: p.applied_at ? iso(p.applied_at) : null,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
  };
}

function toProposal(row: SupabaseRow): SyllabusIndexProposal {
  return {
    id: String(row.id),
    run_id: String(row.run_id ?? ''),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    title: String(row.title ?? ''),
    summary: asNullableString(row.summary),
    status: (row.status as SyllabusProposalStatus) ?? 'draft',
    created_by: asNullableString(row.created_by),
    approved_by: asNullableString(row.approved_by),
    approved_at: asNullableDate(row.approved_at),
    applied_at: asNullableDate(row.applied_at),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function nodeToRow(n: SyllabusIndexNodeProposal): SupabaseRow {
  return {
    id: n.id,
    proposal_id: n.proposal_id,
    parent_id: n.parent_id,
    title: n.title,
    description: n.description,
    code: n.code,
    order_index: n.order,
    confidence: n.confidence,
    source_material_ids: n.source_material_ids,
    source_references: n.source_references,
    warnings: n.warnings,
    status: n.status,
    created_at: iso(n.created_at),
    updated_at: iso(n.updated_at),
  };
}

function toNode(row: SupabaseRow): SyllabusIndexNodeProposal {
  return {
    id: String(row.id),
    proposal_id: String(row.proposal_id ?? ''),
    parent_id: asNullableString(row.parent_id),
    title: String(row.title ?? ''),
    description: asNullableString(row.description),
    code: asNullableString(row.code),
    order: asNumber(row.order_index),
    confidence: asNullableNumber(row.confidence),
    source_material_ids: asStringArray(row.source_material_ids),
    source_references: asStringArray(row.source_references),
    warnings: asStringArray(row.warnings),
    status: (row.status as SyllabusNodeStatus) ?? 'proposed',
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function suggestionToRow(s: MaterialTopicSuggestion): SupabaseRow {
  return {
    id: s.id,
    run_id: s.run_id,
    proposal_node_id: s.proposal_node_id,
    material_id: s.material_id,
    confidence: s.confidence,
    reason: s.reason,
    status: s.status,
    created_at: iso(s.created_at),
    updated_at: iso(s.updated_at),
  };
}

function toSuggestion(row: SupabaseRow): MaterialTopicSuggestion {
  return {
    id: String(row.id),
    run_id: String(row.run_id ?? ''),
    proposal_node_id: asNullableString(row.proposal_node_id),
    material_id: String(row.material_id ?? ''),
    confidence: asNullableNumber(row.confidence),
    reason: asNullableString(row.reason),
    status: (row.status as MaterialSuggestionStatus) ?? 'suggested',
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function examPatternToRow(e: ExamPatternSummary): SupabaseRow {
  return {
    id: e.id,
    run_id: e.run_id,
    workspace_id: e.workspace_id,
    opposition_id: e.opposition_id,
    batch_id: e.batch_id,
    material_id: e.material_id,
    detected_question_count: e.detected_question_count,
    detected_topics: e.detected_topics,
    difficulty_notes: e.difficulty_notes,
    style_notes: e.style_notes,
    coverage_notes: e.coverage_notes,
    warnings: e.warnings,
    created_at: iso(e.created_at),
    updated_at: iso(e.updated_at),
  };
}

function toExamPattern(row: SupabaseRow): ExamPatternSummary {
  return {
    id: String(row.id),
    run_id: String(row.run_id ?? ''),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    batch_id: asNullableString(row.batch_id),
    material_id: String(row.material_id ?? ''),
    detected_question_count: asNullableNumber(row.detected_question_count),
    detected_topics: asStringArray(row.detected_topics),
    difficulty_notes: asNullableString(row.difficulty_notes),
    style_notes: asNullableString(row.style_notes),
    coverage_notes: asNullableString(row.coverage_notes),
    warnings: asStringArray(row.warnings),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function nodeSourceToRow(s: SyllabusIndexNodeSource): SupabaseRow {
  return {
    id: s.id,
    proposal_id: s.proposal_id,
    node_id: s.node_id,
    material_id: s.material_id,
    material_section_id: s.material_section_id,
    source_reference_id: s.source_reference_id,
    page_start: s.page_start,
    page_end: s.page_end,
    excerpt: s.excerpt,
    confidence: s.confidence,
    is_primary: s.is_primary,
    workspace_id: s.workspace_id,
    opposition_id: s.opposition_id,
    created_at: iso(s.created_at),
    updated_at: iso(s.updated_at),
  };
}

function toNodeSource(row: SupabaseRow): SyllabusIndexNodeSource {
  return {
    id: String(row.id),
    proposal_id: String(row.proposal_id ?? ''),
    node_id: String(row.node_id ?? ''),
    material_id: String(row.material_id ?? ''),
    material_section_id: asNullableString(row.material_section_id),
    source_reference_id: asNullableString(row.source_reference_id),
    page_start: asNullableNumber(row.page_start),
    page_end: asNullableNumber(row.page_end),
    excerpt: asNullableString(row.excerpt),
    confidence: asNullableNumber(row.confidence),
    is_primary: row.is_primary === true,
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function topicSourceRefToRow(r: TopicSourceReference): SupabaseRow {
  return {
    id: r.id,
    topic_id: r.topic_id,
    material_id: r.material_id,
    material_section_id: r.material_section_id,
    source_reference_id: r.source_reference_id,
    excerpt: r.excerpt,
    workspace_id: r.workspace_id,
    opposition_id: r.opposition_id,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function toTopicSourceRef(row: SupabaseRow): TopicSourceReference {
  return {
    id: String(row.id),
    topic_id: String(row.topic_id ?? ''),
    material_id: String(row.material_id ?? ''),
    material_section_id: asNullableString(row.material_section_id),
    source_reference_id: asNullableString(row.source_reference_id),
    excerpt: asNullableString(row.excerpt),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

// --- Helpers de mapeo ---
function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function asNullableDate(value: unknown): Date | null {
  return value == null ? null : parseDate(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}
