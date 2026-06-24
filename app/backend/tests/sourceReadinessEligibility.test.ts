// SPEC 037: la readiness de fuentes que ve la UI (via SourceRetrievalService) DEBE
// coincidir con la elegibilidad autoritativa del servidor (evaluateTopicSourceReference):
//   - clasificacion vigente PRIMARIA y SIN needs_review;
//   - material no obsoleto y LEGIBLE (extraction_status no failed/ocr_failed/not_supported);
//   - PUNTERO CONCRETO valido (seccion activa del mismo material, o referencia).
// Estos tests prueban que un row "vinculado pero no usable" ya NO cuenta como fuente
// (antes la UI mostraba "2 fuentes" y el Edge respondia "sin fuentes elegibles").

import { describe, expect, it } from 'vitest';
import { SourceRetrievalService } from '../src/index.js';

type Any = Record<string, unknown>;

function makeService(opts: {
  material: Any;
  classification: Any | null;
  section: Any | null;
  topicRef: Any;
}) {
  const materials = {
    findById: async (id: string) => (id === opts.material.id ? opts.material : null),
    findAll: async () => [] as Any[],
  };
  const sections = {
    findById: async (id: string) => (opts.section && id === opts.section.id ? opts.section : null),
    listByMaterial: async () => [] as Any[],
    search: async () => [] as Any[],
  };
  const sourceReferences = {
    findById: async () => null,
    listBySection: async () => [] as Any[],
  };
  const topicMaterialLinks = { findAll: async () => [] as Any[] };
  const syllabusRepository = {
    listTopicSourceReferencesByTopic: async () => [opts.topicRef],
  };
  const documentClassification = {
    getClassificationForMaterial: async (id: string) =>
      opts.classification && id === opts.material.id ? opts.classification : null,
  };
  const topics = { getTopic: async () => ({ id: 'tp-1', title: 'Tema', opposition_id: 'op-1' }) };

  return new SourceRetrievalService({
    materials,
    sections,
    sourceReferences,
    topicMaterialLinks,
    syllabusRepository,
    documentClassification,
    topics,
  } as unknown as ConstructorParameters<typeof SourceRetrievalService>[0]);
}

const baseInput = { opposition_id: 'op-1', topic_id: 'tp-1' };
const activeSection = { id: 'sec-1', material_id: 'mat-1', opposition_id: 'op-1', status: 'active', content_excerpt: 'evidencia' };
const cleanMaterial = { id: 'mat-1', opposition_id: 'op-1', status: 'active', extraction_status: 'completed' };
const primaryClass = { classification: 'syllabus_material', needs_review: false, confidence: 0.9 };
const refToSection = {
  id: 'tsr-1',
  material_id: 'mat-1',
  material_section_id: 'sec-1',
  source_reference_id: null,
  opposition_id: 'op-1',
  excerpt: 'evidencia',
};

describe('SPEC 037 - readiness == elegibilidad del servidor', () => {
  it('cuenta una fuente limpia (material legible + clase primaria + seccion activa)', async () => {
    const svc = makeService({ material: cleanMaterial, classification: primaryClass, section: activeSection, topicRef: refToSection });
    const r = await svc.retrieveForTopic(baseInput);
    expect(r.primary).toHaveLength(1);
  });

  it('NO cuenta si la clasificacion esta needs_review (el servidor la rechaza)', async () => {
    const svc = makeService({
      material: cleanMaterial,
      classification: { ...primaryClass, needs_review: true },
      section: activeSection,
      topicRef: refToSection,
    });
    expect((await svc.retrieveForTopic(baseInput)).primary).toHaveLength(0);
  });

  it('NO cuenta si el material no es legible (ocr_failed / failed / not_supported)', async () => {
    for (const ext of ['ocr_failed', 'failed', 'not_supported']) {
      const svc = makeService({
        material: { ...cleanMaterial, extraction_status: ext },
        classification: primaryClass,
        section: activeSection,
        topicRef: refToSection,
      });
      expect((await svc.retrieveForTopic(baseInput)).primary).toHaveLength(0);
    }
  });

  it('NO cuenta si el puntero concreto no es valido (seccion inactiva y sin referencia)', async () => {
    const svc = makeService({
      material: cleanMaterial,
      classification: primaryClass,
      section: { ...activeSection, status: 'obsolete' },
      topicRef: refToSection,
    });
    expect((await svc.retrieveForTopic(baseInput)).primary).toHaveLength(0);
  });

  it('cuenta cuando el puntero es una REFERENCIA de fuente (sin seccion)', async () => {
    const svc = makeService({
      material: cleanMaterial,
      classification: primaryClass,
      section: null,
      topicRef: { ...refToSection, material_section_id: null, source_reference_id: 'ref-1' },
    });
    expect((await svc.retrieveForTopic(baseInput)).primary).toHaveLength(1);
  });

  it('NO cuenta material obsoleto', async () => {
    const svc = makeService({
      material: { ...cleanMaterial, status: 'obsolete' },
      classification: primaryClass,
      section: activeSection,
      topicRef: refToSection,
    });
    expect((await svc.retrieveForTopic(baseInput)).primary).toHaveLength(0);
  });
});
