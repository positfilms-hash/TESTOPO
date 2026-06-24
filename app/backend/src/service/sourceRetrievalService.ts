// Recuperacion de fuentes para generar preguntas ancladas (SPEC 028-E). Dado un
// tema aplicado del Topic Map, encuentra evidencia PRIMARIA concreta y trazable
// (referencia de fuente del tema 028-D, referencia/seccion 028-C, secciones del
// material asociado, o match de texto), sellada al mismo workspace+oposicion.
// NO es busqueda semantica/vectorial. Los examenes antiguos solo aportan contexto
// secundario (estilo/cobertura), nunca fuente factual.

import type { Material } from '../models/material.js';
import type { MaterialSection } from '../models/materialSection.js';
import { isEligibleDocumentClass } from '../models/materialSection.js';
import type { DocumentClass } from '../models/documentClassification.js';
import { isPrimaryIndexClass } from '../generation/documentGroundedIndexTypes.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { MaterialSectionRepository } from '../repository/materialSectionRepository.js';
import type { SourceReferenceRepository } from '../repository/sourceReferenceRepository.js';
import type { TopicMaterialLinkRepository } from '../repository/topicMaterialLinkRepository.js';
import type { SyllabusIndexRepository } from '../repository/syllabusIndexRepository.js';
import type { DocumentClassificationService } from './documentClassificationService.js';
import type { TopicService } from './topicService.js';

// Fuente primaria concreta para anclar una pregunta.
export interface GroundedSource {
  material_id: string;
  material_section_id: string | null;
  source_reference_id: string | null;
  topic_source_reference_id: string | null;
  excerpt: string;
  classification: DocumentClass;
  confidence: number | null;
}

// Contexto secundario (examen antiguo): estilo/cobertura, nunca fuente factual.
export interface SecondaryContext {
  material_id: string;
  note: string;
}

export type RetrievalStrategy =
  | 'topic_source_references'
  | 'linked_references'
  | 'material_sections'
  | 'text_match'
  | 'none';

export interface RetrievalResult {
  primary: GroundedSource[];
  secondary: SecondaryContext[];
  strategy: RetrievalStrategy;
  warnings: string[];
}

export interface SourceRetrievalDeps {
  materials: MaterialRepository;
  sections: MaterialSectionRepository;
  sourceReferences: SourceReferenceRepository;
  topicMaterialLinks: TopicMaterialLinkRepository;
  syllabusRepository: SyllabusIndexRepository;
  documentClassification: DocumentClassificationService;
  topics: TopicService;
}

export interface RetrieveForTopicInput {
  workspace_id?: string | null;
  opposition_id: string;
  topic_id: string;
  /** Seleccion manual opcional: ids de seccion / referencia (SPEC 028-E). */
  manual_source_selection?: {
    material_section_ids?: string[];
    source_reference_ids?: string[];
  };
}

export class SourceRetrievalService {
  constructor(private readonly deps: SourceRetrievalDeps) {}

  async retrieveForTopic(
    input: RetrieveForTopicInput,
  ): Promise<RetrievalResult> {
    const warnings: string[] = [];
    const seenSections = new Set<string>();
    const primary: GroundedSource[] = [];

    const addSource = async (
      source: Omit<GroundedSource, 'classification' | 'confidence' | 'excerpt'> & {
        excerpt?: string;
      },
      section: MaterialSection | null,
    ): Promise<boolean> => {
      const key = source.material_section_id ?? `${source.material_id}:nosec`;
      if (seenSections.has(key)) {
        return false;
      }
      const eligible = await this.isEligibleMaterial(
        source.material_id,
        input.opposition_id,
      );
      if (!eligible) {
        return false;
      }
      // SPEC 037: la readiness DEBE coincidir con la elegibilidad del servidor
      // (`evaluateTopicSourceReference`): exige un PUNTERO CONCRETO valido (una
      // seccion ACTIVA del mismo material, o una referencia de fuente). Un row
      // meramente vinculado pero sin puntero usable NO cuenta como fuente.
      const hasActiveSection =
        section != null &&
        section.status === 'active' &&
        section.material_id === source.material_id;
      const hasValidConcretePointer =
        hasActiveSection || source.source_reference_id != null;
      if (!hasValidConcretePointer) {
        return false;
      }
      seenSections.add(key);
      primary.push({
        material_id: source.material_id,
        material_section_id: source.material_section_id,
        source_reference_id: source.source_reference_id,
        topic_source_reference_id: source.topic_source_reference_id,
        excerpt: source.excerpt ?? section?.content_excerpt ?? '',
        classification: eligible.classification,
        confidence: eligible.confidence,
      });
      return true;
    };

    let strategy: RetrievalStrategy = 'none';

    // Seleccion manual explicita tiene prioridad absoluta.
    if (
      input.manual_source_selection &&
      (input.manual_source_selection.material_section_ids?.length ||
        input.manual_source_selection.source_reference_ids?.length)
    ) {
      for (const sectionId of input.manual_source_selection.material_section_ids ?? []) {
        const section = await this.deps.sections.findById(sectionId);
        if (section && section.opposition_id === input.opposition_id) {
          await addSource(
            {
              material_id: section.material_id,
              material_section_id: section.id,
              source_reference_id: null,
              topic_source_reference_id: null,
            },
            section,
          );
        }
      }
      for (const refId of input.manual_source_selection.source_reference_ids ?? []) {
        const ref = await this.deps.sourceReferences.findById(refId);
        if (ref && ref.opposition_id === input.opposition_id) {
          const section = ref.material_section_id
            ? await this.deps.sections.findById(ref.material_section_id)
            : null;
          await addSource(
            {
              material_id: ref.material_id,
              material_section_id: ref.material_section_id,
              source_reference_id: ref.id,
              topic_source_reference_id: null,
              excerpt: ref.source_excerpt,
            },
            section,
          );
        }
      }
      if (primary.length > 0) {
        strategy = 'linked_references';
      }
    }

    // 1) Referencias de fuente del tema aplicado (SPEC 028-D).
    if (primary.length === 0) {
      const topicRefs =
        await this.deps.syllabusRepository.listTopicSourceReferencesByTopic(
          input.topic_id,
        );
      for (const ref of topicRefs) {
        if (ref.opposition_id && ref.opposition_id !== input.opposition_id) {
          continue;
        }
        const section = ref.material_section_id
          ? await this.deps.sections.findById(ref.material_section_id)
          : null;
        await addSource(
          {
            material_id: ref.material_id,
            material_section_id: ref.material_section_id,
            source_reference_id: ref.source_reference_id,
            topic_source_reference_id: ref.id,
            excerpt: ref.excerpt ?? section?.content_excerpt ?? '',
          },
          section,
        );
      }
      if (primary.length > 0) {
        strategy = 'topic_source_references';
      }
    }

    // 2-3) Secciones del material asociado al tema (vinculo material-tema).
    if (primary.length === 0) {
      const links = await this.deps.topicMaterialLinks.findAll({
        topic_id: input.topic_id,
      });
      for (const link of links) {
        const sections = await this.deps.sections.listByMaterial(link.material_id);
        for (const section of sections) {
          const refs = await this.deps.sourceReferences.listBySection(section.id);
          await addSource(
            {
              material_id: section.material_id,
              material_section_id: section.id,
              source_reference_id: refs[0]?.id ?? null,
              topic_source_reference_id: null,
            },
            section,
          );
        }
      }
      if (primary.length > 0) {
        strategy = 'material_sections';
      }
    }

    // 4) Match de texto del titulo del tema en secciones elegibles.
    if (primary.length === 0) {
      const topic = await this.deps.topics.getTopic(input.topic_id);
      if (topic) {
        const matches = await this.deps.sections.search({
          opposition_id: input.opposition_id,
          query: topic.title,
          limit: 20,
        });
        for (const section of matches) {
          await addSource(
            {
              material_id: section.material_id,
              material_section_id: section.id,
              source_reference_id: null,
              topic_source_reference_id: null,
            },
            section,
          );
        }
        if (primary.length > 0) {
          strategy = 'text_match';
        }
      }
    }

    // Contexto secundario: examenes antiguos de la oposicion (estilo/cobertura).
    const secondary = await this.collectSecondaryContext(input.opposition_id);

    if (primary.length === 0) {
      warnings.push('No se ha encontrado ninguna fuente primaria elegible para el tema.');
    }

    return { primary, secondary, strategy, warnings };
  }

  // Material elegible como fuente primaria. SPEC 037: MISMA regla autoritativa que
  // el servidor (`evaluateTopicSourceReference`), para que la readiness visible no
  // pueda contradecir la elegibilidad del Edge Function. Exige: existe, misma
  // oposicion, NO obsoleto, LEGIBLE (extraction_status no failed/ocr_failed/
  // not_supported), clasificacion vigente PRIMARIA y SIN `needs_review`.
  private async isEligibleMaterial(
    materialId: string,
    oppositionId: string,
  ): Promise<{ material: Material; classification: DocumentClass; confidence: number | null } | null> {
    const material = await this.deps.materials.findById(materialId);
    if (!material || material.opposition_id !== oppositionId) {
      return null;
    }
    // No obsoleto (el servidor excluye obsolete; OCR-con-advertencias deja el
    // material en `needs_review`, que SI es elegible).
    if (material.status === 'obsolete') {
      return null;
    }
    // Material LEGIBLE: se excluye lo no leido/ilegible (failed/ocr_failed/
    // not_supported). El texto nativo `completed` y el OCR usable si valen.
    const ext = material.extraction_status;
    if (ext === 'failed' || ext === 'ocr_failed' || ext === 'not_supported') {
      return null;
    }
    const classification =
      await this.deps.documentClassification.getClassificationForMaterial(materialId);
    if (!classification) {
      return null;
    }
    // Clasificacion pendiente de revision (ambigua/no corregida): el servidor la
    // RECHAZA -> aqui tampoco cuenta (alinea readiness con el Edge).
    if (classification.needs_review) {
      return null;
    }
    const cls = classification.classification;
    // Doble guarda: clase primaria del indice y elegible para seccionar.
    if (!isPrimaryIndexClass(cls) || !isEligibleDocumentClass(cls)) {
      return null;
    }
    return { material, classification: cls, confidence: classification.confidence };
  }

  // Examenes antiguos de la oposicion como contexto de estilo/cobertura.
  private async collectSecondaryContext(
    oppositionId: string,
  ): Promise<SecondaryContext[]> {
    const materials = (await this.deps.materials.findAll({})).filter(
      (m) =>
        m.opposition_id === oppositionId &&
        (m.type === 'old_test' || m.type === 'official_exam') &&
        m.status !== 'obsolete',
    );
    return materials.map((m) => ({
      material_id: m.id,
      note: `Estilo/cobertura de "${m.title}" (contexto, no fuente factual).`,
    }));
  }
}
