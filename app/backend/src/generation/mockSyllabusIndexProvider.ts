// Proveedor de indice simulado (SPEC 019, 6/24). No llama a ninguna IA externa:
// produce una propuesta determinista a partir de los materiales, util para el
// MVP y los tests. Una IA real implementa la misma interfaz.
//
// Heuristica de demo (claramente ficticia):
// - syllabus/notes/law -> un tema raiz por material.
// - old_test/official_exam -> resumen de patron de examen (contexto, no temas).
// - other -> material sin clasificar.

import {
  EXAM_MATERIAL_TYPES,
  type AISyllabusTopicNode,
  type AIExamPatternSummary,
  type SyllabusIndexOutput,
  type SyllabusIndexProvider,
  type SyllabusIndexProviderInput,
} from './syllabusIndexTypes.js';

export class MockSyllabusIndexProvider implements SyllabusIndexProvider {
  readonly name = 'mock';
  readonly model = null;

  async proposeIndex(
    input: SyllabusIndexProviderInput,
  ): Promise<SyllabusIndexOutput> {
    const topics: AISyllabusTopicNode[] = [];
    const examPatterns: AIExamPatternSummary[] = [];
    const unclassified: string[] = [];
    let order = 0;

    for (const material of input.materials) {
      if (EXAM_MATERIAL_TYPES.includes(material.type)) {
        examPatterns.push({
          material_id: material.id,
          detected_question_count: null,
          detected_topics: [material.title],
          difficulty_notes: 'Estilo de examen detectado (mock, ficticio).',
          style_notes: 'Pregunta directa con cuatro opciones (mock).',
          warnings: [],
        });
        continue;
      }
      if (material.type === 'other') {
        unclassified.push(material.id);
        continue;
      }
      topics.push({
        title: `Tema: ${material.title}`,
        description: `Tema propuesto a partir de "${material.title}" (mock).`,
        code: `T${order + 1}`,
        order,
        confidence: 0.5,
        source_material_ids: [material.id],
        source_references: [],
        children: [],
        warnings: [],
      });
      order += 1;
    }

    const warnings: string[] = [];
    if (examPatterns.length > 0) {
      warnings.push(
        'Hay tests/examenes antiguos usados solo como contexto de cobertura.',
      );
    }

    return {
      title: input.opposition_title
        ? `Indice propuesto para ${input.opposition_title}`
        : 'Indice de temario propuesto',
      summary: `Propuesta automatica (mock) a partir de ${input.materials.length} materiales.`,
      topics,
      unclassified_material_ids: unclassified,
      exam_patterns: examPatterns,
      warnings,
      provider: this.name,
      model: this.model,
    };
  }
}
