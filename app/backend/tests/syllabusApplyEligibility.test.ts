// SPEC 037: el apply del indice (1) BLOQUEA una propuesta needs_regeneration y
// (2) crea topic_source_references SOLO para fuentes ELEGIBLES (las que el servidor
// aceptara), avisando de los temas que quedan sin fuente utilizable.

import { describe, expect, it } from 'vitest';
import { SyllabusIndexFromDocumentsService, SyllabusIndexError } from '../src/index.js';

type Any = Record<string, any>;
const now = () => new Date('2026-06-24T00:00:00Z');

// Construye el servicio con fakes minimos: applyProposal solo usa repo/topics/
// materials/classifier/sections.
function makeService(over: {
  proposal?: Any;
  nodes: Any[];
  nodeSources?: Any[];
  nodeSourcesByNode?: Record<string, Any[]>;
  materials?: Record<string, Any>;
  classifications?: Record<string, Any>;
  sections?: Record<string, Any>;
}) {
  const created: Any[] = [];
  const createdRefs: Any[] = [];
  let idc = 0;
  const repo = {
    getProposal: async () => over.proposal ?? { id: 'p1', opposition_id: 'op-1', status: 'approved' },
    listNodesByProposal: async () => over.nodes,
    listNodeSourcesByProposal: async () => over.nodeSources ?? [],
    listNodeSourcesByNode: async (nodeId: string) => over.nodeSourcesByNode?.[nodeId] ?? [],
    listTopicSourceReferencesByTopic: async () => [] as Any[],
    createTopicSourceReference: async (r: Any) => createdRefs.push(r),
    updateProposal: async (p: Any) => p,
  };
  const topics = {
    listTopics: async () => [] as Any[],
    createTopic: async (t: Any) => {
      const topic = { id: `t-${++idc}`, status: 'active', ...t };
      created.push(topic);
      return topic;
    },
  };
  const materials = { findById: async (id: string) => over.materials?.[id] ?? null };
  const classifier = {
    getClassificationForMaterial: async (id: string) => over.classifications?.[id] ?? null,
  };
  const sections = { findById: async (id: string) => over.sections?.[id] ?? null };

  const svc = new SyllabusIndexFromDocumentsService({
    materials,
    documentClassification: classifier,
    sections,
    sourceReferences: { findById: async () => null },
    repository: repo,
    topics,
    generateId: () => `gen-${++idc}`,
    now,
  } as unknown as ConstructorParameters<typeof SyllabusIndexFromDocumentsService>[0]);

  return { svc, created, createdRefs };
}

const node = (id: string, title: string, parent: string | null = null) => ({
  id,
  parent_id: parent,
  title,
  order: 0,
  status: 'proposed',
  description: null,
  code: null,
});

describe('SPEC 037 - apply: bloqueo needs_regeneration + referencias elegibles', () => {
  it('(1) NO aplica una propuesta needs_regeneration (p. ej. 21 temas raíz)', async () => {
    const nodes = Array.from({ length: 21 }, (_, i) => node(`n${i}`, `Bloque ${i}`));
    const { svc, created, createdRefs } = makeService({ nodes });
    await expect(svc.applyProposal('p1')).rejects.toMatchObject({
      codes: ['SYLLABUS_INDEX_NEEDS_REGENERATION'],
    });
    expect(created).toHaveLength(0);
    expect(createdRefs).toHaveLength(0);
  });

  it('(2) crea referencias SOLO para fuentes elegibles; avisa de temas sin fuente', async () => {
    const nodes = [node('nA', 'Derechos fundamentales'), node('nB', 'Organización del Estado')];
    const result = await (async () => {
      const { svc, createdRefs } = makeService({
        nodes,
        // nA -> fuente ELEGIBLE; nB -> fuente con clasificacion needs_review (el
        // servidor la rechaza) -> NO debe crear referencia.
        nodeSourcesByNode: {
          nA: [{ material_id: 'mat-ok', material_section_id: 'sec-ok', source_reference_id: null, excerpt: 'ev', workspace_id: null, opposition_id: 'op-1' }],
          nB: [{ material_id: 'mat-rev', material_section_id: 'sec-rev', source_reference_id: null, excerpt: 'ev', workspace_id: null, opposition_id: 'op-1' }],
        },
        // node_sources global (para validateCompactIndexFromNodes: ambos temas con fuente).
        nodeSources: [
          { node_id: 'nA', material_id: 'mat-ok' },
          { node_id: 'nB', material_id: 'mat-rev' },
        ],
        materials: {
          'mat-ok': { id: 'mat-ok', opposition_id: 'op-1', status: 'active', extraction_status: 'completed' },
          'mat-rev': { id: 'mat-rev', opposition_id: 'op-1', status: 'active', extraction_status: 'completed' },
        },
        classifications: {
          'mat-ok': { classification: 'syllabus_material', needs_review: false },
          'mat-rev': { classification: 'syllabus_material', needs_review: true }, // pendiente -> ineligible
        },
        sections: {
          'sec-ok': { id: 'sec-ok', material_id: 'mat-ok', status: 'active' },
          'sec-rev': { id: 'sec-rev', material_id: 'mat-rev', status: 'active' },
        },
      });
      const r = await svc.applyProposal('p1');
      return { r, createdRefs };
    })();

    // Solo la fuente elegible (mat-ok) genero una referencia.
    expect(result.createdRefs).toHaveLength(1);
    expect(result.createdRefs[0].material_id).toBe('mat-ok');
    expect(result.r.topic_source_references).toBe(1);
    // El tema con fuente ineligible queda avisado "sin fuentes utilizables".
    expect(result.r.warnings.join(' ')).toMatch(/sin fuentes utilizables.*Organización del Estado/i);
  });
});
