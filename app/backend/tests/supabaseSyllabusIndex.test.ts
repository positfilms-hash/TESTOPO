// Migracion del indice de temario IA a Supabase (SPEC 019 + 028-D).
// Round-trip de las entidades via InMemorySupabasePort (sin red): verifica el
// mapeo modelo<->fila (arrays como JSONB, order<->order_index, is_primary,
// fechas) y que el factory selecciona el repo segun el modo.

import { describe, expect, it } from 'vitest';
import {
  InMemorySupabasePort,
  SupabaseSyllabusIndexRepository,
  createCoreRepositories,
  type SyllabusIndexRun,
  type SyllabusIndexProposal,
  type SyllabusIndexNodeProposal,
  type SyllabusIndexNodeSource,
  type TopicSourceReference,
} from '../src/index.js';

const now = new Date('2026-01-02T00:00:00.000Z');

function makeRun(over: Partial<SyllabusIndexRun> = {}): SyllabusIndexRun {
  return {
    id: 'run-1',
    workspace_id: 'ws-1',
    opposition_id: 'opp-1',
    created_by: 'user-1',
    status: 'completed',
    provider: 'mock',
    model: null,
    material_ids: ['m1', 'm2'],
    section_ids: ['s1'],
    input_summary: 'resumen',
    total_materials: 2,
    analyzed_materials: 2,
    ignored_materials: 0,
    proposed_topics_count: 3,
    warnings: ['w1'],
    errors: [],
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function makeProposal(over: Partial<SyllabusIndexProposal> = {}): SyllabusIndexProposal {
  return {
    id: 'prop-1',
    run_id: 'run-1',
    workspace_id: 'ws-1',
    opposition_id: 'opp-1',
    title: 'Indice propuesto',
    summary: null,
    status: 'pending_review',
    created_by: 'user-1',
    approved_by: null,
    approved_at: null,
    applied_at: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

function makeNode(over: Partial<SyllabusIndexNodeProposal> = {}): SyllabusIndexNodeProposal {
  return {
    id: 'node-1',
    proposal_id: 'prop-1',
    parent_id: null,
    title: 'Tema 1',
    description: null,
    code: null,
    order: 0,
    confidence: 0.8,
    source_material_ids: ['m1'],
    source_references: ['ref1'],
    warnings: [],
    status: 'proposed',
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe('SupabaseSyllabusIndexRepository', () => {
  it('runs: round-trip de arrays y actualizacion de estado', async () => {
    const repo = new SupabaseSyllabusIndexRepository(new InMemorySupabasePort());
    const created = await repo.createRun(makeRun());
    expect(created.material_ids).toEqual(['m1', 'm2']);
    expect(created.section_ids).toEqual(['s1']);
    expect(created.warnings).toEqual(['w1']);

    const got = await repo.getRun('run-1');
    expect(got?.opposition_id).toBe('opp-1');
    expect(got?.created_at).toBeInstanceOf(Date);

    const updated = await repo.updateRun(makeRun({ status: 'failed', errors: ['boom'] }));
    expect(updated.status).toBe('failed');
    expect((await repo.getRun('run-1'))?.errors).toEqual(['boom']);
  });

  it('proposals: listar por oposicion y fechas de aprobacion', async () => {
    const repo = new SupabaseSyllabusIndexRepository(new InMemorySupabasePort());
    await repo.createProposal(makeProposal());
    await repo.createProposal(
      makeProposal({ id: 'prop-2', opposition_id: 'opp-2' }),
    );
    const list = await repo.listProposalsByOpposition('opp-1');
    expect(list.map((p) => p.id)).toEqual(['prop-1']);

    const approved = await repo.updateProposal(
      makeProposal({ status: 'approved', approved_by: 'admin', approved_at: now }),
    );
    expect(approved.status).toBe('approved');
    expect(approved.approved_at).toBeInstanceOf(Date);
  });

  it('nodes: order<->order_index y orden por listByProposal', async () => {
    const repo = new SupabaseSyllabusIndexRepository(new InMemorySupabasePort());
    await repo.createNode(makeNode({ id: 'n2', order: 1, title: 'Tema 2' }));
    await repo.createNode(makeNode({ id: 'n1', order: 0, title: 'Tema 1' }));
    const nodes = await repo.listNodesByProposal('prop-1');
    expect(nodes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(nodes[0].order).toBe(0);
    expect(nodes[0].source_references).toEqual(['ref1']);
  });

  it('node sources: conserva is_primary y referencias', async () => {
    const repo = new SupabaseSyllabusIndexRepository(new InMemorySupabasePort());
    const source: SyllabusIndexNodeSource = {
      id: 'ns-1',
      proposal_id: 'prop-1',
      node_id: 'node-1',
      material_id: 'm1',
      material_section_id: 'sec-1',
      source_reference_id: null,
      page_start: null,
      page_end: null,
      excerpt: 'fragmento',
      confidence: 0.5,
      is_primary: false,
      workspace_id: 'ws-1',
      opposition_id: 'opp-1',
      created_at: now,
      updated_at: now,
    };
    await repo.createNodeSource(source);
    const byProposal = await repo.listNodeSourcesByProposal('prop-1');
    expect(byProposal).toHaveLength(1);
    expect(byProposal[0].is_primary).toBe(false);
    expect(byProposal[0].material_section_id).toBe('sec-1');
    expect(await repo.listNodeSourcesByNode('node-1')).toHaveLength(1);
  });

  it('topic source references: listar por tema y por oposicion', async () => {
    const repo = new SupabaseSyllabusIndexRepository(new InMemorySupabasePort());
    const ref: TopicSourceReference = {
      id: 'tsr-1',
      topic_id: 'topic-1',
      material_id: 'm1',
      material_section_id: null,
      source_reference_id: null,
      excerpt: 'cita',
      workspace_id: 'ws-1',
      opposition_id: 'opp-1',
      created_at: now,
      updated_at: now,
    };
    await repo.createTopicSourceReference(ref);
    expect(await repo.listTopicSourceReferencesByTopic('topic-1')).toHaveLength(1);
    expect(await repo.listTopicSourceReferencesByOpposition('opp-1')).toHaveLength(1);
    expect(await repo.listTopicSourceReferencesByOpposition('opp-2')).toHaveLength(0);
  });
});

describe('createCoreRepositories - syllabusIndex', () => {
  it('memory usa el repo InMemory del indice', () => {
    const core = createCoreRepositories({ persistence: 'memory' });
    expect(core.syllabusIndex).toBeDefined();
    expect(core.mode).toBe('memory');
  });

  it('supabase usa el repo Supabase del indice', () => {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(core.syllabusIndex).toBeInstanceOf(SupabaseSyllabusIndexRepository);
    expect(core.mode).toBe('supabase');
  });
});
