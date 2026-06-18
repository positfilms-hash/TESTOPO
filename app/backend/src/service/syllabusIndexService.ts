// Constructor de indice de temario con IA (SPEC 019).
//
// Orquesta: analisis de materiales -> propuesta de indice (la IA SOLO propone)
// -> revision/edicion humana -> aprobacion -> aplicacion al Topic Map (SPEC 003).
// Ninguna propuesta se aplica sin aprobacion humana explicita. No genera
// preguntas ni valida preguntas (eso es SPEC 018.4).

import { randomUUID } from 'node:crypto';
import type { Material } from '../models/material.js';
import type { Topic } from '../models/topic.js';
import type {
  ExamPatternSummary,
  MaterialTopicSuggestion,
  SyllabusIndexNodeProposal,
  SyllabusIndexProposal,
  SyllabusIndexRun,
  SyllabusNodeStatus,
  SyllabusRunStatus,
} from '../models/syllabusIndex.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicMaterialLinkRepository } from '../repository/topicMaterialLinkRepository.js';
import type { SyllabusIndexRepository } from '../repository/syllabusIndexRepository.js';
import { InMemorySyllabusIndexRepository } from '../repository/inMemorySyllabusIndexRepository.js';
import { TopicService } from './topicService.js';
import { TopicValidationError } from './topicValidationError.js';
import type {
  AISyllabusTopicNode,
  SyllabusIndexProvider,
} from '../generation/syllabusIndexTypes.js';
import { MockSyllabusIndexProvider } from '../generation/mockSyllabusIndexProvider.js';
import {
  loadSyllabusIndexConfig,
  MAX_SYLLABUS_TREE_DEPTH,
  type SyllabusIndexConfig,
} from '../generation/syllabusIndexConfig.js';
import {
  SyllabusIndexError,
  SyllabusIndexErrorCode,
} from '../syllabus/syllabusIndexErrors.js';

export interface SyllabusIndexServiceOptions {
  materialRepository: MaterialRepository;
  topicService: TopicService;
  topicMaterialLinks: TopicMaterialLinkRepository;
  provider?: SyllabusIndexProvider;
  repository?: SyllabusIndexRepository;
  config?: SyllabusIndexConfig;
  generateId?: () => string;
  now?: () => Date;
}

export interface ProposeIndexInput {
  opposition_id: string;
  workspace_id?: string | null;
  created_by?: string | null;
  opposition_title?: string | null;
  /** Seleccion explicita de materiales; si se omite, todo el material activo. */
  material_ids?: string[];
  /** Solo materiales sin tema (sin vinculo material-tema). */
  only_unclassified?: boolean;
  /** Lote de carga masiva que origino el analisis (SPEC 028); sella los patrones. */
  batch_id?: string | null;
  /** Pistas de carpeta por material (material_id -> ruta) para sugerir temas (SPEC 028). */
  folder_paths?: Record<string, string>;
}

export interface ProposalDetail {
  proposal: SyllabusIndexProposal;
  run: SyllabusIndexRun | null;
  nodes: SyllabusIndexNodeProposal[];
  suggestions: MaterialTopicSuggestion[];
  exam_patterns: ExamPatternSummary[];
}

export interface ApplyResult {
  proposal: SyllabusIndexProposal;
  created_topic_ids: string[];
  reused_topic_ids: string[];
  linked_materials: number;
  skipped_duplicates: number;
}

const EDITABLE_PROPOSAL_STATUSES = new Set(['draft', 'pending_review']);
// Nodos que SI se aplican al temario (los rechazados/fusionados no).
const APPLICABLE_NODE_STATUSES = new Set<SyllabusNodeStatus>([
  'proposed',
  'edited',
  'accepted',
]);

export class SyllabusIndexService {
  private readonly materials: MaterialRepository;
  private readonly topics: TopicService;
  private readonly links: TopicMaterialLinkRepository;
  private readonly provider: SyllabusIndexProvider;
  private readonly repo: SyllabusIndexRepository;
  private readonly config: SyllabusIndexConfig;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(options: SyllabusIndexServiceOptions) {
    this.materials = options.materialRepository;
    this.topics = options.topicService;
    this.links = options.topicMaterialLinks;
    this.provider = options.provider ?? new MockSyllabusIndexProvider();
    this.repo = options.repository ?? new InMemorySyllabusIndexRepository();
    this.config = options.config ?? loadSyllabusIndexConfig();
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // --- Proponer indice -----------------------------------------------------

  async proposeIndex(input: ProposeIndexInput): Promise<ProposalDetail> {
    if (!isNonEmptyString(input.opposition_id)) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.OPPOSITION_REQUIRED,
      ]);
    }

    const materials = await this.resolveMaterials(input);
    if (materials.length === 0) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.NO_MATERIALS]);
    }

    const analyzable = materials.filter((m) => isNonEmptyString(m.content_text));
    const ignored = materials.filter((m) => !isNonEmptyString(m.content_text));
    if (analyzable.length === 0) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.NO_EXTRACTED_TEXT,
      ]);
    }

    const warnings: string[] = [];
    const { providerMaterials, truncated } = this.buildProviderMaterials(
      analyzable,
      warnings,
      input.folder_paths,
    );
    void truncated;

    let output;
    try {
      output = await this.provider.proposeIndex({
        opposition_title: input.opposition_title ?? null,
        materials: providerMaterials,
        max_topics: this.config.max_topics,
      });
    } catch (error) {
      if (error instanceof SyllabusIndexError) {
        throw error;
      }
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.GENERATION_FAILED],
        String(error),
      );
    }

    if (typeof output !== 'object' || output === null || !Array.isArray(output.topics)) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.INVALID_OUTPUT]);
    }
    warnings.push(...(output.warnings ?? []));

    const validMaterialIds = new Set(analyzable.map((m) => m.id));
    const timestamp = this.now();

    const run = await this.repo.createRun({
      id: this.generateId(),
      workspace_id: input.workspace_id ?? null,
      opposition_id: input.opposition_id,
      created_by: input.created_by ?? null,
      status: 'processing',
      provider: output.provider,
      model: output.model,
      material_ids: materials.map((m) => m.id),
      input_summary: output.summary ?? '',
      total_materials: materials.length,
      analyzed_materials: analyzable.length,
      ignored_materials: ignored.length,
      proposed_topics_count: 0,
      warnings: [],
      errors: [],
      created_at: timestamp,
      updated_at: timestamp,
    });

    const proposal = await this.repo.createProposal({
      id: this.generateId(),
      run_id: run.id,
      workspace_id: input.workspace_id ?? null,
      opposition_id: input.opposition_id,
      title: isNonEmptyString(output.title)
        ? output.title
        : 'Indice de temario propuesto',
      summary: output.summary ?? null,
      status: 'pending_review',
      created_by: input.created_by ?? null,
      approved_by: null,
      approved_at: null,
      applied_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    });

    // Aplanar el arbol de nodos (respetando limites de numero y profundidad).
    const nodes = await this.persistNodes(
      proposal.id,
      output.topics,
      validMaterialIds,
      warnings,
    );

    // Sugerencias material-tema a partir de las fuentes de cada nodo.
    const suggestions: MaterialTopicSuggestion[] = [];
    for (const node of nodes) {
      for (const materialId of node.source_material_ids) {
        suggestions.push(
          await this.repo.createSuggestion({
            id: this.generateId(),
            run_id: run.id,
            proposal_node_id: node.id,
            material_id: materialId,
            confidence: node.confidence,
            reason: 'Material fuente del tema propuesto.',
            status: 'suggested',
            created_at: timestamp,
            updated_at: timestamp,
          }),
        );
      }
    }
    // Materiales sin clasificar: los marcados por la IA + los ignorados sin texto.
    const unclassifiedIds = new Set<string>(
      (output.unclassified_material_ids ?? []).filter((id) =>
        validMaterialIds.has(id),
      ),
    );
    for (const material of ignored) {
      unclassifiedIds.add(material.id);
    }
    for (const materialId of unclassifiedIds) {
      const reason = validMaterialIds.has(materialId)
        ? 'La IA no ha podido clasificar este material.'
        : 'Material sin texto extraido; no analizable (sin OCR).';
      suggestions.push(
        await this.repo.createSuggestion({
          id: this.generateId(),
          run_id: run.id,
          proposal_node_id: null,
          material_id: materialId,
          confidence: null,
          reason,
          status: 'unclassified',
          created_at: timestamp,
          updated_at: timestamp,
        }),
      );
    }

    // Patrones de examen (contexto, no banco de preguntas).
    const examPatterns: ExamPatternSummary[] = [];
    for (const pattern of output.exam_patterns ?? []) {
      examPatterns.push(
        await this.repo.createExamPattern({
          id: this.generateId(),
          run_id: run.id,
          workspace_id: input.workspace_id ?? null,
          opposition_id: input.opposition_id,
          batch_id: input.batch_id ?? null,
          material_id: pattern.material_id,
          detected_question_count: pattern.detected_question_count ?? null,
          detected_topics: pattern.detected_topics ?? [],
          difficulty_notes: pattern.difficulty_notes ?? null,
          style_notes: pattern.style_notes ?? null,
          coverage_notes: pattern.coverage_notes ?? null,
          warnings: pattern.warnings ?? [],
          created_at: timestamp,
          updated_at: timestamp,
        }),
      );
    }

    const finalStatus: SyllabusRunStatus =
      warnings.length > 0 ? 'completed_with_warnings' : 'completed';
    const finalRun = await this.repo.updateRun({
      ...run,
      status: finalStatus,
      proposed_topics_count: nodes.length,
      warnings,
      updated_at: this.now(),
    });

    return {
      proposal,
      run: finalRun,
      nodes,
      suggestions,
      exam_patterns: examPatterns,
    };
  }

  // --- Lectura -------------------------------------------------------------

  async getProposalDetail(proposalId: string): Promise<ProposalDetail> {
    const proposal = await this.requireProposal(proposalId);
    const nodes = (await this.repo.listNodesByProposal(proposalId)).sort(
      sortNodes,
    );
    const run = await this.repo.getRun(proposal.run_id);
    const suggestions = run
      ? await this.repo.listSuggestionsByRun(run.id)
      : [];
    const examPatterns = run
      ? await this.repo.listExamPatternsByRun(run.id)
      : [];
    return {
      proposal,
      run,
      nodes,
      suggestions,
      exam_patterns: examPatterns,
    };
  }

  async listProposals(oppositionId: string): Promise<SyllabusIndexProposal[]> {
    return this.repo.listProposalsByOpposition(oppositionId);
  }

  // Propuesta sola (para resolver permisos en la fachada).
  async getProposal(
    proposalId: string,
  ): Promise<SyllabusIndexProposal | null> {
    return this.repo.getProposal(proposalId);
  }

  // --- Edicion humana ------------------------------------------------------

  async updateNode(
    nodeId: string,
    changes: {
      title?: string;
      description?: string | null;
      code?: string | null;
      order?: number;
      parent_id?: string | null;
      status?: SyllabusNodeStatus;
    },
  ): Promise<SyllabusIndexNodeProposal> {
    const node = await this.requireNode(nodeId);
    await this.assertEditableProposal(node.proposal_id);
    const updated: SyllabusIndexNodeProposal = {
      ...node,
      title: changes.title ?? node.title,
      description:
        changes.description !== undefined
          ? changes.description
          : node.description,
      code: changes.code !== undefined ? changes.code : node.code,
      order: changes.order !== undefined ? changes.order : node.order,
      parent_id:
        changes.parent_id !== undefined ? changes.parent_id : node.parent_id,
      // Cualquier edicion de contenido marca el nodo como `edited` salvo que se
      // indique un estado explicito (accept/reject/merged).
      status: changes.status ?? 'edited',
      updated_at: this.now(),
    };
    return this.repo.updateNode(updated);
  }

  async addNode(
    proposalId: string,
    input: {
      title: string;
      description?: string | null;
      code?: string | null;
      order?: number;
      parent_id?: string | null;
    },
  ): Promise<SyllabusIndexNodeProposal> {
    await this.assertEditableProposal(proposalId);
    const timestamp = this.now();
    return this.repo.createNode({
      id: this.generateId(),
      proposal_id: proposalId,
      parent_id: input.parent_id ?? null,
      title: input.title,
      description: input.description ?? null,
      code: input.code ?? null,
      order: input.order ?? 0,
      confidence: null,
      source_material_ids: [],
      source_references: [],
      warnings: [],
      status: 'edited',
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  async setNodeStatus(
    nodeId: string,
    status: SyllabusNodeStatus,
  ): Promise<SyllabusIndexNodeProposal> {
    const node = await this.requireNode(nodeId);
    await this.assertEditableProposal(node.proposal_id);
    return this.repo.updateNode({ ...node, status, updated_at: this.now() });
  }

  async setSuggestionStatus(
    suggestionId: string,
    status: MaterialTopicSuggestion['status'],
  ): Promise<MaterialTopicSuggestion> {
    const suggestion = await this.repo.getSuggestion(suggestionId);
    if (!suggestion) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.NODE_NOT_FOUND]);
    }
    return this.repo.updateSuggestion({
      ...suggestion,
      status,
      updated_at: this.now(),
    });
  }

  // --- Aprobacion / rechazo ------------------------------------------------

  async approveProposal(
    proposalId: string,
    approverId: string | null,
  ): Promise<SyllabusIndexProposal> {
    const proposal = await this.requireProposal(proposalId);
    if (proposal.status === 'applied') {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_ALREADY_APPLIED,
      ]);
    }
    if (!EDITABLE_PROPOSAL_STATUSES.has(proposal.status)) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_NOT_EDITABLE,
      ]);
    }
    return this.repo.updateProposal({
      ...proposal,
      status: 'approved',
      approved_by: approverId,
      approved_at: this.now(),
      updated_at: this.now(),
    });
  }

  async rejectProposal(proposalId: string): Promise<SyllabusIndexProposal> {
    const proposal = await this.requireProposal(proposalId);
    if (proposal.status === 'applied') {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_ALREADY_APPLIED,
      ]);
    }
    return this.repo.updateProposal({
      ...proposal,
      status: 'rejected',
      updated_at: this.now(),
    });
  }

  // --- Aplicacion al Topic Map (SPEC 019, 20) ------------------------------

  async applyProposal(proposalId: string): Promise<ApplyResult> {
    const proposal = await this.requireProposal(proposalId);
    if (proposal.status === 'applied') {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_ALREADY_APPLIED,
      ]);
    }
    if (proposal.status !== 'approved') {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.APPROVAL_REQUIRED,
      ]);
    }

    const allNodes = await this.repo.listNodesByProposal(proposalId);
    const applicable = allNodes
      .filter((n) => APPLICABLE_NODE_STATUSES.has(n.status))
      .sort(sortNodes);
    const applicableIds = new Set(applicable.map((n) => n.id));

    // Temas existentes de la oposicion para reutilizar (no duplicar).
    const existingTopics = (await this.topics.listTopics()).filter(
      (t) =>
        t.opposition_id === proposal.opposition_id && t.status !== 'obsolete',
    );
    const existingByKey = new Map<string, Topic>();
    for (const topic of existingTopics) {
      existingByKey.set(topicKey(topic.parent_id, topic.title), topic);
    }

    const nodeToTopicId = new Map<string, string>();
    const createdTopicIds: string[] = [];
    const reusedTopicIds: string[] = [];
    let skippedDuplicates = 0;

    // Recorrido raiz->hojas para que el padre exista antes que el hijo.
    for (const node of orderForApply(applicable)) {
      const parentTopicId =
        node.parent_id && applicableIds.has(node.parent_id)
          ? (nodeToTopicId.get(node.parent_id) ?? null)
          : null;
      const key = topicKey(parentTopicId, node.title);
      const existing = existingByKey.get(key);
      if (existing) {
        nodeToTopicId.set(node.id, existing.id);
        reusedTopicIds.push(existing.id);
        skippedDuplicates += 1;
        continue;
      }
      let topic: Topic;
      try {
        topic = await this.topics.createTopic({
          opposition_id: proposal.opposition_id,
          title: node.title,
          description: node.description,
          code: node.code,
          parent_id: parentTopicId,
          order: node.order,
        });
      } catch (error) {
        throw new SyllabusIndexError(
          [SyllabusIndexErrorCode.APPLY_FAILED],
          String(error),
        );
      }
      existingByKey.set(key, topic);
      nodeToTopicId.set(node.id, topic.id);
      createdTopicIds.push(topic.id);
    }

    // Asociar materiales: sugerencias no rechazadas/no sin-clasificar cuyo nodo
    // se ha aplicado. No borra ni sobrescribe vinculos existentes.
    let linkedMaterials = 0;
    const suggestions = await this.repo.listSuggestionsByRun(proposal.run_id);
    for (const suggestion of suggestions) {
      if (
        suggestion.status === 'rejected' ||
        suggestion.status === 'unclassified' ||
        !suggestion.proposal_node_id
      ) {
        continue;
      }
      const topicId = nodeToTopicId.get(suggestion.proposal_node_id);
      if (!topicId) {
        continue;
      }
      if (await this.links.find(suggestion.material_id, topicId)) {
        continue;
      }
      try {
        await this.topics.linkMaterial(suggestion.material_id, topicId);
        linkedMaterials += 1;
      } catch (error) {
        // Vinculo duplicado o material de otra oposicion: se ignora, no bloquea.
        if (!(error instanceof TopicValidationError)) {
          throw error;
        }
      }
    }

    const applied = await this.repo.updateProposal({
      ...proposal,
      status: 'applied',
      applied_at: this.now(),
      updated_at: this.now(),
    });

    return {
      proposal: applied,
      created_topic_ids: createdTopicIds,
      reused_topic_ids: reusedTopicIds,
      linked_materials: linkedMaterials,
      skipped_duplicates: skippedDuplicates,
    };
  }

  // --- Internos ------------------------------------------------------------

  private async resolveMaterials(
    input: ProposeIndexInput,
  ): Promise<Material[]> {
    const all = (await this.materials.findAll({})).filter(
      (m) => m.opposition_id === input.opposition_id && m.status !== 'obsolete',
    );
    let materials = all;
    if (input.material_ids && input.material_ids.length > 0) {
      const wanted = new Set(input.material_ids);
      materials = materials.filter((m) => wanted.has(m.id));
    }
    if (input.only_unclassified) {
      const links = await this.links.findAll({});
      const linkedMaterialIds = new Set(links.map((l) => l.material_id));
      materials = materials.filter((m) => !linkedMaterialIds.has(m.id));
    }
    return materials;
  }

  private buildProviderMaterials(
    analyzable: Material[],
    warnings: string[],
    folderPaths?: Record<string, string>,
  ): {
    providerMaterials: {
      id: string;
      title: string;
      type: Material['type'];
      text: string;
      folder_path?: string | null;
    }[];
    truncated: boolean;
  } {
    const perMaterialCap = Math.max(
      200,
      Math.floor(this.config.max_input_chars / analyzable.length),
    );
    let truncated = false;
    const providerMaterials = analyzable.map((m) => {
      const full = m.content_text ?? '';
      const text = full.slice(0, perMaterialCap);
      if (text.length < full.length) {
        truncated = true;
      }
      return {
        id: m.id,
        title: m.title,
        type: m.type,
        text,
        folder_path: folderPaths?.[m.id] ?? null,
      };
    });
    if (truncated) {
      warnings.push(
        'Se ha recortado el texto de algunos materiales por exceder el limite de analisis.',
      );
    }
    return { providerMaterials, truncated };
  }

  // Aplana el arbol de la IA a nodos persistidos, respetando limites de numero
  // (max_topics) y profundidad (4 niveles). Descarta nodos sin titulo (warning).
  private async persistNodes(
    proposalId: string,
    topics: AISyllabusTopicNode[],
    validMaterialIds: Set<string>,
    warnings: string[],
  ): Promise<SyllabusIndexNodeProposal[]> {
    const created: SyllabusIndexNodeProposal[] = [];
    let count = 0;
    let limitWarned = false;
    let depthWarned = false;

    const walk = async (
      node: AISyllabusTopicNode,
      parentId: string | null,
      depth: number,
    ): Promise<void> => {
      if (count >= this.config.max_topics) {
        if (!limitWarned) {
          warnings.push(
            `Se ha alcanzado el maximo de ${this.config.max_topics} temas propuestos; el resto se ha descartado.`,
          );
          limitWarned = true;
        }
        return;
      }
      if (depth > MAX_SYLLABUS_TREE_DEPTH) {
        if (!depthWarned) {
          warnings.push(
            `Se ha limitado la profundidad del indice a ${MAX_SYLLABUS_TREE_DEPTH} niveles.`,
          );
          depthWarned = true;
        }
        return;
      }
      if (!isNonEmptyString(node.title)) {
        warnings.push('Se ha descartado un tema propuesto sin titulo.');
        return;
      }

      const sourceMaterialIds = (node.source_material_ids ?? []).filter((id) =>
        validMaterialIds.has(id),
      );
      const timestamp = this.now();
      const stored = await this.repo.createNode({
        id: this.generateId(),
        proposal_id: proposalId,
        parent_id: parentId,
        title: node.title,
        description: node.description ?? null,
        code: node.code ?? null,
        order: typeof node.order === 'number' ? node.order : count,
        confidence:
          typeof node.confidence === 'number' ? node.confidence : null,
        source_material_ids: sourceMaterialIds,
        source_references: node.source_references ?? [],
        warnings: node.warnings ?? [],
        status: 'proposed',
        created_at: timestamp,
        updated_at: timestamp,
      });
      created.push(stored);
      count += 1;

      for (const child of node.children ?? []) {
        await walk(child, stored.id, depth + 1);
      }
    };

    for (const root of topics) {
      await walk(root, null, 1);
    }
    return created;
  }

  private async assertEditableProposal(proposalId: string): Promise<void> {
    const proposal = await this.requireProposal(proposalId);
    if (!EDITABLE_PROPOSAL_STATUSES.has(proposal.status)) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_NOT_EDITABLE,
      ]);
    }
  }

  private async requireProposal(
    proposalId: string,
  ): Promise<SyllabusIndexProposal> {
    const proposal = await this.repo.getProposal(proposalId);
    if (!proposal) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_NOT_FOUND,
      ]);
    }
    return proposal;
  }

  private async requireNode(
    nodeId: string,
  ): Promise<SyllabusIndexNodeProposal> {
    const node = await this.repo.getNode(nodeId);
    if (!node) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.NODE_NOT_FOUND]);
    }
    return node;
  }
}

function sortNodes(
  a: SyllabusIndexNodeProposal,
  b: SyllabusIndexNodeProposal,
): number {
  return a.order - b.order;
}

// Ordena raiz->hojas para que el padre se cree antes que el hijo.
function orderForApply(
  nodes: SyllabusIndexNodeProposal[],
): SyllabusIndexNodeProposal[] {
  const byParent = new Map<string | null, SyllabusIndexNodeProposal[]>();
  const ids = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    const key = node.parent_id && ids.has(node.parent_id) ? node.parent_id : null;
    const siblings = byParent.get(key) ?? [];
    siblings.push(node);
    byParent.set(key, siblings);
  }
  const result: SyllabusIndexNodeProposal[] = [];
  const visit = (parentId: string | null): void => {
    const siblings = [...(byParent.get(parentId) ?? [])].sort(sortNodes);
    for (const node of siblings) {
      result.push(node);
      visit(node.id);
    }
  };
  visit(null);
  return result;
}

function topicKey(parentId: string | null, title: string): string {
  return `${parentId ?? 'root'}::${title.trim().toLowerCase()}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
