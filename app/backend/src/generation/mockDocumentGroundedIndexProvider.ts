// Proveedor de indice anclado a documentos SIMULADO (SPEC 028-D). Determinista y
// sin red: util para el MVP y los tests. Construye temas SOLO desde documentos
// primarios y sus secciones; los examenes antiguos quedan como contexto
// secundario (warning), nunca como fuente unica de un tema. Una IA real
// implementa la misma interfaz.

import {
  isPrimaryIndexClass,
  type DocumentGroundedIndexProvider,
  type GroundedDocumentInput,
  type GroundedIndexOutput,
  type GroundedIndexProviderInput,
  type GroundedNodeSources,
  type GroundedTopicNode,
} from './documentGroundedIndexTypes.js';

export class MockDocumentGroundedIndexProvider
  implements DocumentGroundedIndexProvider
{
  readonly name = 'mock';
  readonly model = null;

  async proposeIndex(
    input: GroundedIndexProviderInput,
  ): Promise<GroundedIndexOutput> {
    const topics: GroundedTopicNode[] = [];
    const warnings: string[] = [];
    let order = 0;
    let secondaryCount = 0;

    for (const document of input.documents) {
      if (!isPrimaryIndexClass(document.classification)) {
        // Examen antiguo u otra clase secundaria: solo contexto.
        secondaryCount += 1;
        continue;
      }
      if (order >= input.max_topics) {
        break;
      }
      topics.push(buildTopic(document, order, input.max_depth));
      order += 1;
    }

    if (secondaryCount > 0) {
      warnings.push(
        `${secondaryCount} test(s) antiguo(s) usados solo como contexto de cobertura, no como fuente de temas.`,
      );
    }
    if (topics.length === 0) {
      warnings.push('No hay documentos primarios con secciones para proponer temas.');
    }

    return {
      title: input.opposition_title
        ? `Indice propuesto para ${input.opposition_title}`
        : 'Indice de temario propuesto',
      summary: `Propuesta automatica (mock) a partir de ${topics.length} documento(s) primario(s).`,
      topics,
      warnings,
      provider: this.name,
      model: this.model,
    };
  }
}

function buildTopic(
  document: GroundedDocumentInput,
  order: number,
  maxDepth: number,
): GroundedTopicNode {
  const allSources: GroundedNodeSources = {
    material_id: document.material_id,
    section_ids: document.sections.map((s) => s.section_id),
    reference_ids: document.sections
      .map((s) => s.source_reference_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  };

  // Subtemas: uno por seccion si hay mas de una y la profundidad lo permite.
  const children: GroundedTopicNode[] =
    maxDepth > 1 && document.sections.length > 1
      ? document.sections.map((section, index) => ({
          title: section.title,
          description: null,
          order: index,
          confidence: document.confidence ?? 0.6,
          warnings: [],
          children: [],
          sources: [
            {
              material_id: document.material_id,
              section_ids: [section.section_id],
              reference_ids: section.source_reference_id
                ? [section.source_reference_id]
                : [],
            },
          ],
        }))
      : [];

  return {
    title: document.title,
    description: `Tema propuesto a partir de "${document.title}" (mock).`,
    order,
    confidence: document.confidence ?? 0.6,
    warnings: [],
    children,
    sources: [allSources],
  };
}
