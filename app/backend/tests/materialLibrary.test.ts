// SPEC 029: almacenamiento (Supabase Storage + URL firmada) y biblioteca de
// material (abrir seguro + borrado con trazabilidad). Sin red (puerto en memoria).

import { describe, expect, it } from 'vitest';
import {
  InMemorySupabasePort,
  SupabaseFileStorage,
  InMemoryFileStorage,
  InMemoryMaterialRepository,
  InMemoryTopicMaterialLinkRepository,
  InMemoryMaterialSectionRepository,
  InMemorySourceReferenceRepository,
  InMemoryQuestionRepository,
  QuestionService,
  MaterialLibraryService,
  MaterialReferencedError,
  type FileStorage,
  type Material,
} from '../src/index.js';

const now = new Date('2026-01-02T00:00:00.000Z');
const bytes = new Uint8Array([1, 2, 3, 4]);

function makeMaterial(over: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    opposition_id: 'opp-1',
    title: 'Tema 1',
    description: null,
    type: 'syllabus',
    status: 'active',
    original_filename: 'tema1.pdf',
    mime_type: 'application/pdf',
    size_bytes: 4,
    storage_path: 'uploads/materials/mat-1.pdf',
    content_text: 'texto',
    reference: null,
    file_extension: 'pdf',
    extraction_status: 'completed',
    extraction_error: null,
    page_count: 1,
    uploaded_by: null,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

describe('SupabaseFileStorage', () => {
  it('round-trip de bytes + URL firmada + borrado', async () => {
    const storage = new SupabaseFileStorage(new InMemorySupabasePort());
    await storage.save('uploads/x.pdf', bytes);
    expect(await storage.read('uploads/x.pdf')).toEqual(bytes);
    const url = await storage.getSignedUrl('uploads/x.pdf');
    expect(url).toContain('materials/uploads/x.pdf');
    await storage.remove('uploads/x.pdf');
    expect(await storage.read('uploads/x.pdf')).toBeNull();
    expect(await storage.getSignedUrl('uploads/x.pdf')).toBeNull();
  });
});

function setup(storage: FileStorage = new InMemoryFileStorage()) {
  const materials = new InMemoryMaterialRepository();
  const topicMaterialLinks = new InMemoryTopicMaterialLinkRepository();
  const sections = new InMemoryMaterialSectionRepository();
  const sourceReferences = new InMemorySourceReferenceRepository();
  const questions = new QuestionService(new InMemoryQuestionRepository());
  const library = new MaterialLibraryService({
    materials,
    storage,
    topicMaterialLinks,
    sections,
    sourceReferences,
    questions,
  });
  return { materials, topicMaterialLinks, storage, library };
}

describe('MaterialLibraryService.getFile', () => {
  it('memory: devuelve bytes (sin URL firmada), nunca storage_path', async () => {
    const { materials, storage, library } = setup();
    await materials.create(makeMaterial());
    await storage.save('uploads/materials/mat-1.pdf', bytes);
    const file = await library.getFile('mat-1');
    expect(file.signed_url).toBeNull();
    expect(file.bytes).toEqual(bytes);
    expect(file.filename).toBe('tema1.pdf');
    expect(file).not.toHaveProperty('storage_path');
  });

  it('supabase: devuelve URL firmada (sin bytes)', async () => {
    const storage = new SupabaseFileStorage(new InMemorySupabasePort());
    const { materials, library } = setup(storage);
    await materials.create(makeMaterial());
    await storage.save('uploads/materials/mat-1.pdf', bytes);
    const file = await library.getFile('mat-1');
    expect(file.signed_url).toContain('materials');
    expect(file.bytes).toBeNull();
  });
});

describe('MaterialLibraryService.deleteMaterial (borrado seguro)', () => {
  it('borra material NO referenciado + sus bytes', async () => {
    const { materials, storage, library } = setup();
    await materials.create(makeMaterial());
    await storage.save('uploads/materials/mat-1.pdf', bytes);
    await library.deleteMaterial('mat-1');
    expect(await materials.findById('mat-1')).toBeNull();
    expect(await storage.read('uploads/materials/mat-1.pdf')).toBeNull();
  });

  it('BLOQUEA el borrado si esta vinculado a un tema (trazabilidad)', async () => {
    const { materials, topicMaterialLinks, library } = setup();
    await materials.create(makeMaterial());
    await topicMaterialLinks.create({
      id: 'l1', material_id: 'mat-1', topic_id: 't1', reference: null, created_at: now,
    });
    await expect(library.deleteMaterial('mat-1')).rejects.toBeInstanceOf(
      MaterialReferencedError,
    );
    // Sigue existiendo (no se rompe la fuente factual).
    expect(await materials.findById('mat-1')).not.toBeNull();
  });
});
