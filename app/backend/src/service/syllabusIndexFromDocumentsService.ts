// Indice de temario ANCLADO A DOCUMENTOS (SPEC 028-D). Propone temas/subtemas a
// partir de documentos clasificados (SPEC 028-B) y sus secciones (SPEC 028-C),
// con FUENTES concretas por nodo. La IA solo organiza evidencia: no escribe
// temario, no inventa temas, no genera preguntas ni tests. Reutiliza los modelos
// y el repositorio de SPEC 019 (InMemory; ver docs/architecture/persistence.md) y
// `SyllabusIndexService` para el ciclo de revision. La aplicacion al Topic Map es
// explicita y crea referencias de fuente por tema.

import { randomUUID } from 'node:crypto';
import {
  extractionHasOcrWarnings,
  isUsableExtraction,
  type Material,
} from '../models/material.js';
import type { Topic } from '../models/topic.js';
import { isDocumentClass } from '../models/documentClassification.js';
import type {
  SyllabusIndexNodeProposal,
  SyllabusIndexNodeSource,
  SyllabusIndexProposal,
  SyllabusIndexRun,
  TopicSourceReference,
} from '../models/syllabusIndex.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { MaterialSectionRepository } from '../repository/materialSectionRepository.js';
import type { SourceReferenceRepository } from '../repository/sourceReferenceRepository.js';
import type { SyllabusIndexRepository } from '../repository/syllabusIndexRepository.js';
import type { DocumentClassificationService } from './documentClassificationService.js';
import type { TopicService } from './topicService.js';
import {
  isPrimaryIndexClass,
  isSecondaryIndexClass,
  type DocumentGroundedIndexProvider,
  type GroundedDocumentInput,
  type GroundedIndexOutput,
  type GroundedTopicNode,
} from '../generation/documentGroundedIndexTypes.js';
import { MockDocumentGroundedIndexProvider } from '../generation/mockDocumentGroundedIndexProvider.js';
import {
  loadDocumentGroundedIndexConfig,
  type DocumentGroundedIndexConfig,
} from '../generation/documentGroundedIndexConfig.js';
import {
  SyllabusIndexError,
  SyllabusIndexErrorCode,
} from '../syllabus/syllabusIndexErrors.js';

export interface SyllabusIndexFromDocumentsDeps {
  materials: MaterialRepository;
  documentClassification: DocumentClassificationService;
  sections: MaterialSectionRepository;
  sourceReferences: SourceReferenceRepository;
  repository: SyllabusIndexRepository;
  topics: TopicService;
  provider?: DocumentGroundedIndexProvider;
  config?: DocumentGroundedIndexConfig;
  generateId?: () => string;
  now?: () => Date;
}

export interface ProposeFromDocumentsInput {
  opposition_id: string;
  workspace_id?: string | null;
  opposition_title?: string | null;
  created_by?: string | null;
  material_ids?: string[];
}

export interface GroundedProposalDetail {
  proposal: SyllabusIndexProposal;
  run: SyllabusIndexRun | null;
  nodes: SyllabusIndexNodeProposal[];
  node_sources: SyllabusIndexNodeSource[];
}

export interface ApplyGroundedResult {
  proposal: SyllabusIndexProposal;
  created_topic_ids: string[];
  reused_topic_ids: string[];
  topic_source_references: number;
  warnings: string[];
}

const APPLICABLE_NODE_STATUSES = new Set(['proposed', 'edited', 'accepted']);

export class SyllabusIndexFromDocumentsService {
  private readonly materials: MaterialRepository;
  private readonly classifier: DocumentClassificationService;
  private readonly sections: MaterialSectionRepository;
  private readonly sourceRefs: SourceReferenceRepository;
  private readonly repo: SyllabusIndexRepository;
  private readonly topics: TopicService;
  private readonly provider: DocumentGroundedIndexProvider;
  private readonly config: DocumentGroundedIndexConfig;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(deps: SyllabusIndexFromDocumentsDeps) {
    this.materials = deps.materials;
    this.classifier = deps.documentClassification;
    this.sections = deps.sections;
    this.sourceRefs = deps.sourceReferences;
    this.repo = deps.repository;
    this.topics = deps.topics;
    this.provider = deps.provider ?? new MockDocumentGroundedIndexProvider();
    this.config = deps.config ?? loadDocumentGroundedIndexConfig();
    this.generateId = deps.generateId ?? (() => randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  // --- Proponer indice anclado a documentos --------------------------------

  async proposeFromDocuments(
    input: ProposeFromDocumentsInput,
  ): Promise<GroundedProposalDetail> {
    if (!isNonEmptyString(input.opposition_id)) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.OPPOSITION_REQUIRED]);
    }

    const { documents, sectionIndex, materialIndex, warnings } =
      await this.collectEligibleDocuments(input);

    if (!documents.some((d) => d.is_primary)) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.NO_MATERIALS]);
    }

    const timestamp = this.now();
    const run = await this.repo.createRun({
      id: this.generateId(),
      workspace_id: input.workspace_id ?? null,
      opposition_id: input.opposition_id,
      created_by: input.created_by ?? null,
      status: 'processing',
      provider: this.provider.name,
      model: this.provider.model,
      material_ids: documents.map((d) => d.material_id),
      section_ids: [...sectionIndex.keys()],
      input_summary: '',
      total_materials: documents.length,
      analyzed_materials: documents.filter((d) => d.is_primary).length,
      ignored_materials: documents.filter((d) => !d.is_primary).length,
      proposed_topics_count: 0,
      warnings,
      errors: [],
      created_at: timestamp,
      updated_at: timestamp,
    });

    let output: GroundedIndexOutput;
    try {
      output = await this.provider.proposeIndex({
        opposition_title: input.opposition_title ?? null,
        documents,
        max_topics: this.config.max_topics,
        max_depth: this.config.max_depth,
      });
    } catch (error) {
      await this.failRun(run, [String(error)]);
      throw error instanceof SyllabusIndexError
        ? error
        : new SyllabusIndexError(
            [SyllabusIndexErrorCode.GENERATION_FAILED],
            String(error),
          );
    }

    // Validacion estricta antes de persistir (SPEC 028-D).
    const errors = validateGroundedOutput(output, sectionIndex, materialIndex);
    if (errors.length > 0) {
      await this.failRun(run, errors);
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.INVALID_OUTPUT],
        errors.join('; '),
      );
    }

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

    const nodes: SyllabusIndexNodeProposal[] = [];
    const nodeSources: SyllabusIndexNodeSource[] = [];
    let count = 0;
    const walk = async (
      node: GroundedTopicNode,
      parentId: string | null,
      depth: number,
    ): Promise<void> => {
      if (count >= this.config.max_topics || depth > this.config.max_depth) {
        return;
      }
      if (!isNonEmptyString(node.title)) {
        return;
      }
      const ts = this.now();
      const stored = await this.repo.createNode({
        id: this.generateId(),
        proposal_id: proposal.id,
        parent_id: parentId,
        title: node.title,
        description: node.description ?? null,
        code: null,
        order: typeof node.order === 'number' ? node.order : count,
        confidence: typeof node.confidence === 'number' ? node.confidence : null,
        source_material_ids: node.sources.map((s) => s.material_id),
        source_references: [],
        warnings: node.warnings ?? [],
        status: 'proposed',
        created_at: ts,
        updated_at: ts,
      });
      nodes.push(stored);
      count += 1;

      for (const source of node.sources) {
        const material = materialIndex.get(source.material_id);
        const isPrimary = material
          ? isPrimaryIndexClass(material.classification)
          : false;
        const sectionIds = source.section_ids.length > 0 ? source.section_ids : [null];
        for (const sectionId of sectionIds) {
          const section = sectionId ? sectionIndex.get(sectionId) : null;
          nodeSources.push(
            await this.repo.createNodeSource({
              id: this.generateId(),
              proposal_id: proposal.id,
              node_id: stored.id,
              material_id: source.material_id,
              material_section_id: sectionId,
              source_reference_id: source.reference_ids[0] ?? null,
              page_start: null,
              page_end: null,
              excerpt: section?.excerpt ?? null,
              confidence: node.confidence ?? null,
              is_primary: isPrimary,
              workspace_id: input.workspace_id ?? null,
              opposition_id: input.opposition_id,
              created_at: ts,
              updated_at: ts,
            }),
          );
        }
      }

      for (const child of node.children ?? []) {
        await walk(child, stored.id, depth + 1);
      }
    };
    for (const root of output.topics) {
      await walk(root, null, 1);
    }

    const finalRun = await this.repo.updateRun({
      ...run,
      status: output.warnings.length > 0 ? 'completed_with_warnings' : 'completed',
      proposed_topics_count: nodes.length,
      warnings: [...warnings, ...output.warnings],
      updated_at: this.now(),
    });

    return { proposal, run: finalRun, nodes, node_sources: nodeSources };
  }

  // --- Detalle (incluye node sources) --------------------------------------

  async getProposalDetail(proposalId: string): Promise<GroundedProposalDetail> {
    const proposal = await this.repo.getProposal(proposalId);
    if (!proposal) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.PROPOSAL_NOT_FOUND]);
    }
    const nodes = await this.repo.listNodesByProposal(proposalId);
    const run = await this.repo.getRun(proposal.run_id);
    const nodeSources = await this.repo.listNodeSourcesByProposal(proposalId);
    return { proposal, run, nodes, node_sources: nodeSources };
  }

  // --- Aplicar al Topic Map con referencias de fuente ----------------------

  async applyProposal(proposalId: string): Promise<ApplyGroundedResult> {
    const proposal = await this.repo.getProposal(proposalId);
    if (!proposal) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.PROPOSAL_NOT_FOUND]);
    }
    if (proposal.status === 'applied') {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROPOSAL_ALREADY_APPLIED,
      ]);
    }
    if (proposal.status !== 'approved') {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.APPROVAL_REQUIRED]);
    }

    const allNodes = await this.repo.listNodesByProposal(proposalId);
    const applicable = allNodes.filter((n) =>
      APPLICABLE_NODE_STATUSES.has(n.status),
    );
    const applicableIds = new Set(applicable.map((n) => n.id));

    const existingTopics = (await this.topics.listTopics()).filter(
      (t) => t.opposition_id === proposal.opposition_id && t.status !== 'obsolete',
    );
    const existingByKey = new Map<string, Topic>();
    for (const topic of existingTopics) {
      existingByKey.set(topicKey(topic.parent_id, topic.title), topic);
    }

    const nodeToTopicId = new Map<string, string>();
    const createdTopicIds: string[] = [];
    const reusedTopicIds: string[] = [];
    const warnings: string[] = [];

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
        warnings.push(`Tema ya existente reutilizado: "${node.title}".`);
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

    // Referencias de fuente por tema desde las node sources (SPEC 028-D).
    //
    // Revision Codex (bloqueante): aplicar no es atomico (crea temas -> refs ->
    // marca aplicada) y no hay transaccion en los repos. Estrategia explicita de
    // IDEMPOTENCIA para que un reintento tras un fallo parcial converja sin
    // duplicar: los temas se reutilizan por clave (arriba) y las referencias se
    // crean solo si NO existe ya una equivalente (mismo tema/material/seccion/
    // referencia). Asi `applyProposal` puede re-ejecutarse con seguridad mientras
    // la propuesta siga `approved`; solo al final se marca `applied`.
    let topicSourceRefs = 0;
    for (const node of applicable) {
      const topicId = nodeToTopicId.get(node.id);
      if (!topicId) {
        continue;
      }
      const existingRefs = await this.repo.listTopicSourceReferencesByTopic(topicId);
      const existingKeys = new Set(existingRefs.map(topicSourceRefKey));
      const sources = await this.repo.listNodeSourcesByNode(node.id);
      for (const source of sources) {
        const key = topicSourceRefKey({
          material_id: source.material_id,
          material_section_id: source.material_section_id,
          source_reference_id: source.source_reference_id,
        });
        if (existingKeys.has(key)) {
          continue; // ya creada en un intento anterior: no duplicar.
        }
        existingKeys.add(key);
        await this.repo.createTopicSourceReference({
          id: this.generateId(),
          topic_id: topicId,
          material_id: source.material_id,
          material_section_id: source.material_section_id,
          source_reference_id: source.source_reference_id,
          excerpt: source.excerpt,
          workspace_id: source.workspace_id,
          opposition_id: source.opposition_id,
          created_at: this.now(),
          updated_at: this.now(),
        });
        topicSourceRefs += 1;
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
      topic_source_references: topicSourceRefs,
      warnings,
    };
  }

  async listTopicSourceReferences(
    oppositionId: string,
  ): Promise<TopicSourceReference[]> {
    return this.repo.listTopicSourceReferencesByOpposition(oppositionId);
  }

  // --- Internos ------------------------------------------------------------

  private async collectEligibleDocuments(
    input: ProposeFromDocumentsInput,
  ): Promise<{
    documents: GroundedDocumentInput[];
    sectionIndex: Map<string, { id: string; title: string; excerpt: string }>;
    materialIndex: Map<string, { material: Material; classification: import('../models/documentClassification.js').DocumentClass }>;
    warnings: string[];
  }> {
    const all = (await this.materials.findAll({})).filter(
      (m) =>
        m.opposition_id === input.opposition_id && m.status !== 'obsolete',
    );
    const wanted = input.material_ids ? new Set(input.material_ids) : null;
    const materials = wanted ? all.filter((m) => wanted.has(m.id)) : all;

    const documents: GroundedDocumentInput[] = [];
    const sectionIndex = new Map<string, { id: string; title: string; excerpt: string }>();
    const materialIndex = new Map<
      string,
      { material: Material; classification: import('../models/documentClassification.js').DocumentClass }
    >();
    const warnings: string[] = [];

    let sectionBudget = this.config.max_sections;
    let charBudget = this.config.max_input_chars;
    let truncated = false;

    // Primarios primero (mayor confianza), luego secundarios.
    const enriched: {
      material: Material;
      cls: import('../models/documentClassification.js').DocumentClass;
      confidence: number | null;
      isPrimary: boolean;
    }[] = [];
    for (const material of materials) {
      const classification =
        await this.classifier.getClassificationForMaterial(material.id);
      if (!classification) {
        continue;
      }
      const cls = classification.classification;
      const isPrimary = isPrimaryIndexClass(cls);
      const isSecondary = isSecondaryIndexClass(cls);
      if (!isPrimary && !isSecondary) {
        continue; // irrelevant/not_analyzable/ambiguous (no corregido): excluido.
      }
      // Texto nativo o recuperado por OCR (SPEC 030/032). El OCR con advertencias
      // es utilizable pero arrastra un aviso a la revision.
      if (!isUsableExtraction(material.extraction_status)) {
        continue;
      }
      if (extractionHasOcrWarnings(material.extraction_status)) {
        warnings.push(
          `"${material.title}" se leyó con OCR y puede contener errores: revísalo.`,
        );
      }
      enriched.push({ material, cls, confidence: classification.confidence, isPrimary });
    }
    enriched.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1;
      }
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    for (const { material, cls, confidence, isPrimary } of enriched) {
      const sections = await this.sections.listByMaterial(material.id);
      if (sections.length === 0) {
        continue; // documento util pero aun sin seccionar (SPEC 028-C).
      }
      const docSections: GroundedDocumentInput['sections'] = [];
      for (const section of sections) {
        if (sectionBudget <= 0 || charBudget <= 0) {
          truncated = true;
          break;
        }
        const refs = await this.sourceRefs.listBySection(section.id);
        docSections.push({
          section_id: section.id,
          title: section.section_title,
          excerpt: section.content_excerpt,
          source_reference_id: refs[0]?.id ?? null,
        });
        sectionIndex.set(section.id, {
          id: section.id,
          title: section.section_title,
          excerpt: section.content_excerpt,
        });
        sectionBudget -= 1;
        charBudget -= section.content_excerpt.length;
      }
      if (docSections.length === 0) {
        continue;
      }
      materialIndex.set(material.id, { material, classification: cls });
      documents.push({
        material_id: material.id,
        title: material.title,
        classification: cls,
        is_primary: isPrimary,
        confidence,
        sections: docSections,
      });
    }

    if (truncated) {
      warnings.push(
        'Se ha recortado el material analizado por exceder los limites de entrada.',
      );
    }
    return { documents, sectionIndex, materialIndex, warnings };
  }

  private async failRun(run: SyllabusIndexRun, errors: string[]): Promise<void> {
    await this.repo.updateRun({
      ...run,
      status: 'failed',
      errors,
      updated_at: this.now(),
    });
  }
}

// Valida la salida del proveedor (SPEC 028-D). Devuelve la lista de errores; vacia
// si es valida. Rechaza fuentes ausentes/ajenas, raices sin fuente primaria,
// nodos cuya unica fuente es secundaria (examen), y contenido prohibido.
export function validateGroundedOutput(
  output: GroundedIndexOutput,
  sectionIndex: Map<string, unknown>,
  materialIndex: Map<string, { classification: import('../models/documentClassification.js').DocumentClass }>,
): string[] {
  const errors: string[] = [];
  if (!output || !Array.isArray(output.topics)) {
    return ['Salida del proveedor invalida.'];
  }

  const checkNode = (node: GroundedTopicNode, isRoot: boolean): void => {
    if (!isNonEmptyString(node.title)) {
      errors.push('Hay un nodo sin titulo.');
    }
    if (looksForbidden(node.title) || looksForbidden(node.description ?? '')) {
      errors.push(`Contenido no permitido en "${node.title}".`);
    }
    if (!Array.isArray(node.sources) || node.sources.length === 0) {
      errors.push(`El nodo "${node.title}" no tiene fuentes.`);
    } else {
      let hasPrimary = false;
      for (const source of node.sources) {
        if (!materialIndex.has(source.material_id)) {
          errors.push(`Fuente ajena/inexistente en "${node.title}".`);
          continue;
        }
        for (const sectionId of source.section_ids ?? []) {
          if (!sectionIndex.has(sectionId)) {
            errors.push(`Seccion ajena/inexistente en "${node.title}".`);
          }
        }
        const cls = materialIndex.get(source.material_id)?.classification;
        if (cls && isPrimaryIndexClass(cls)) {
          hasPrimary = true;
        }
      }
      if (isRoot && !hasPrimary) {
        errors.push(`El tema raiz "${node.title}" no tiene fuente primaria.`);
      }
      if (!hasPrimary && node.sources.every((s) => {
        const cls = materialIndex.get(s.material_id)?.classification;
        return cls ? isSecondaryIndexClass(cls) : false;
      })) {
        errors.push(`El nodo "${node.title}" se apoya solo en examenes antiguos.`);
      }
    }
    for (const child of node.children ?? []) {
      checkNode(child, false);
    }
  };
  for (const root of output.topics) {
    checkNode(root, true);
  }
  return errors;
}

// Heuristica anti-contenido prohibido: opciones A/B/C/D, "?" repetidos o textos
// largos (temario escrito). Conservadora: el objetivo es rechazar salidas claras.
function looksForbidden(text: string): boolean {
  if (text.length > 400) {
    return true; // titulo/descripcion demasiado largo: posible temario escrito.
  }
  if (/\b[a-d]\)\s/i.test(text)) {
    return true; // opciones tipo test.
  }
  return false;
}

function topicKey(parentId: string | null, title: string): string {
  return `${parentId ?? 'root'}::${title.trim().toLowerCase()}`;
}

// Clave de deduplicacion de una referencia de fuente por tema (idempotencia del
// apply): mismo material + seccion + referencia para el mismo tema.
function topicSourceRefKey(ref: {
  material_id: string;
  material_section_id: string | null;
  source_reference_id: string | null;
}): string {
  return `${ref.material_id}::${ref.material_section_id ?? ''}::${ref.source_reference_id ?? ''}`;
}

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
    const siblings = [...(byParent.get(parentId) ?? [])].sort(
      (a, b) => a.order - b.order,
    );
    for (const node of siblings) {
      result.push(node);
      visit(node.id);
    }
  };
  visit(null);
  return result;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
