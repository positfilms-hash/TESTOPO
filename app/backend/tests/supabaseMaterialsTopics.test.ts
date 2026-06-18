// SPEC 022 - Supabase Repositories: Materials & Topics.
//
// Los repos Supabase se ejercitan contra un puerto en memoria (sin red): mapeo
// fila<->modelo, filtros y borrado (material_topic_links). El factory incluye
// ahora materials/topics/links/import batches/items.

import { describe, expect, it } from 'vitest';
import { InMemorySupabasePort } from '../src/repository/supabase/inMemorySupabasePort.js';
import { SupabaseMaterialRepository } from '../src/repository/supabase/supabaseMaterialRepository.js';
import { SupabaseTopicRepository } from '../src/repository/supabase/supabaseTopicRepository.js';
import { SupabaseTopicMaterialLinkRepository } from '../src/repository/supabase/supabaseTopicMaterialLinkRepository.js';
import {
  SupabaseMaterialImportBatchRepository,
  SupabaseMaterialImportItemRepository,
} from '../src/repository/supabase/supabaseMaterialImportRepositories.js';
import { createCoreRepositories } from '../src/repository/supabase/createCoreRepositories.js';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import type { Material } from '../src/models/material.js';
import type { Topic } from '../src/models/topic.js';
import type { TopicMaterialLink } from '../src/models/topicMaterialLink.js';
import type { MaterialImportBatch } from '../src/models/materialImportBatch.js';
import type { MaterialImportItem } from '../src/models/materialImportItem.js';

const NOW = new Date('2026-06-18T00:00:00.000Z');

function makeMaterial(id: string, overrides: Partial<Material> = {}): Material {
  return {
    id,
    opposition_id: 'opo-1',
    title: `Material ${id}`,
    description: null,
    type: 'syllabus',
    status: 'active',
    original_filename: null,
    mime_type: null,
    size_bytes: null,
    storage_path: null,
    content_text: 'texto',
    reference: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeTopic(id: string, overrides: Partial<Topic> = {}): Topic {
  return {
    id,
    opposition_id: 'opo-1',
    title: `Tema ${id}`,
    description: null,
    code: null,
    parent_id: null,
    order: 0,
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('SPEC 022 - SupabaseMaterialRepository', () => {
  it('crea, filtra por type/status/opposition, busca y actualiza', async () => {
    const repo = new SupabaseMaterialRepository(new InMemorySupabasePort());
    await repo.create(makeMaterial('m1', { type: 'syllabus', status: 'active', opposition_id: 'opo-1' }));
    await repo.create(makeMaterial('m2', { type: 'law', status: 'obsolete', opposition_id: 'opo-1' }));
    await repo.create(makeMaterial('m3', { type: 'syllabus', status: 'active', opposition_id: 'opo-2' }));

    expect(await repo.findAll()).toHaveLength(3);
    expect((await repo.findAll({ type: 'law' })).map((m) => m.id)).toEqual(['m2']);
    expect((await repo.findAll({ status: 'active' })).map((m) => m.id).sort()).toEqual(['m1', 'm3']);
    expect((await repo.findAll({ opposition_id: 'opo-2' })).map((m) => m.id)).toEqual(['m3']);
    expect((await repo.findById('m1'))?.title).toBe('Material m1');

    const obsoleted = await repo.save({ ...makeMaterial('m1'), status: 'obsolete' });
    expect(obsoleted.status).toBe('obsolete');
  });
});

describe('SPEC 022 - SupabaseTopicRepository', () => {
  it('crea, filtra por status/parent_id(null)/search, busca y actualiza', async () => {
    const repo = new SupabaseTopicRepository(new InMemorySupabasePort());
    await repo.create(makeTopic('t1', { title: 'Constitucion', code: 'T1', parent_id: null }));
    await repo.create(makeTopic('t2', { title: 'Derechos', code: 'T1.1', parent_id: 't1' }));
    await repo.create(makeTopic('t3', { title: 'Procedimiento', code: 'T2', parent_id: null, status: 'obsolete' }));

    // parent_id null -> solo raices.
    expect((await repo.findAll({ parent_id: null })).map((t) => t.id).sort()).toEqual(['t1', 't3']);
    // parent_id concreto.
    expect((await repo.findAll({ parent_id: 't1' })).map((t) => t.id)).toEqual(['t2']);
    expect((await repo.findAll({ status: 'active' })).map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect((await repo.findAll({ search: 'derech' })).map((t) => t.id)).toEqual(['t2']);
    expect((await repo.findById('t2'))?.order).toBe(0);

    const updated = await repo.save({ ...makeTopic('t3', { parent_id: null }), status: 'obsolete', order: 5 });
    expect(updated.order).toBe(5);
  });
});

describe('SPEC 022 - SupabaseTopicMaterialLinkRepository', () => {
  it('crea, busca, lista por material/topic y borra', async () => {
    const repo = new SupabaseTopicMaterialLinkRepository(new InMemorySupabasePort());
    const link = (id: string, m: string, t: string): TopicMaterialLink => ({
      id,
      material_id: m,
      topic_id: t,
      reference: null,
      created_at: NOW,
    });
    await repo.create(link('l1', 'm1', 't1'));
    await repo.create(link('l2', 'm1', 't2'));

    expect((await repo.find('m1', 't1'))?.id).toBe('l1');
    expect(await repo.findAll({ material_id: 'm1' })).toHaveLength(2);
    expect(await repo.findAll({ topic_id: 't2' })).toHaveLength(1);

    expect(await repo.delete('m1', 't1')).toBe(true);
    expect(await repo.find('m1', 't1')).toBeNull();
    expect(await repo.delete('m1', 't1')).toBe(false);
  });
});

describe('SPEC 022 - import batch/item repositories', () => {
  it('crea/actualiza batch y crea/lista items por lote', async () => {
    const port = new InMemorySupabasePort();
    const batches = new SupabaseMaterialImportBatchRepository(port);
    const items = new SupabaseMaterialImportItemRepository(port);

    const batch: MaterialImportBatch = {
      id: 'b1',
      workspace_id: 'ws-1',
      opposition_id: 'opo-1',
      uploaded_by: 'admin',
      status: 'pending',
      source_type: 'zip',
      upload_category: 'opposition_material',
      original_filename: 'temario.zip',
      total_files: 2,
      imported_files: 0,
      skipped_files: 0,
      failed_files: 0,
      analyzed_files: 0,
      errors: [],
      warnings: [],
      created_at: NOW,
      updated_at: NOW,
    };
    await batches.create(batch);
    expect((await batches.findById('b1'))?.source_type).toBe('zip');
    expect((await batches.findById('b1'))?.upload_category).toBe('opposition_material');

    const done = await batches.save({ ...batch, status: 'completed', imported_files: 2, errors: ['x'] });
    expect(done.status).toBe('completed');
    expect(done.imported_files).toBe(2);
    expect(done.errors).toEqual(['x']);

    const item: MaterialImportItem = {
      id: 'i1',
      batch_id: 'b1',
      workspace_id: 'ws-1',
      opposition_id: 'opo-1',
      material_id: 'm1',
      topic_id: 't1',
      original_path: 'Tema 1/intro.pdf',
      original_filename: 'intro.pdf',
      upload_category: 'opposition_material',
      detected_category: 'opposition_material',
      ai_classification_confidence: null,
      status: 'imported',
      error: null,
      created_at: NOW,
      updated_at: NOW,
    };
    await items.create(item);
    await items.create({ ...item, id: 'i2', material_id: null, status: 'skipped' });
    const list = await items.findByBatch('b1');
    expect(list).toHaveLength(2);
    expect(list.find((i) => i.id === 'i2')?.material_id).toBeNull();
  });
});

describe('SPEC 022 - factory incluye materials/topics/imports', () => {
  it('usa InMemory por defecto', () => {
    const core = createCoreRepositories();
    expect(core.materials).toBeInstanceOf(InMemoryMaterialRepository);
    expect(core.topics).toBeInstanceOf(InMemoryTopicRepository);
  });

  it('usa Supabase cuando hay puerto y modo supabase', () => {
    const core = createCoreRepositories({
      persistence: 'supabase',
      supabase: new InMemorySupabasePort(),
    });
    expect(core.materials).toBeInstanceOf(SupabaseMaterialRepository);
    expect(core.topics).toBeInstanceOf(SupabaseTopicRepository);
    expect(core.topicMaterialLinks).toBeInstanceOf(SupabaseTopicMaterialLinkRepository);
    expect(core.importBatches).toBeInstanceOf(SupabaseMaterialImportBatchRepository);
    expect(core.importItems).toBeInstanceOf(SupabaseMaterialImportItemRepository);
  });
});
