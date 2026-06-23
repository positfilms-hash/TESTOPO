// SPEC 029: "Analizar material" — clasificacion por OPOSICION (no por lote).
// Clasifica todos los materiales analizables, preserva correcciones manuales y
// salta la extraccion fallida con aviso. No genera indice/preguntas.

import { describe, expect, it } from 'vitest';
import {
  DocumentClassificationService,
  HeuristicDocumentClassifier,
  InMemoryMaterialRepository,
  InMemoryDocumentUnderstandingRunRepository,
  InMemoryDocumentClassificationRepository,
  InMemoryMaterialImportBatchRepository,
  InMemoryMaterialImportItemRepository,
  type Material,
} from '../src/index.js';

const now = new Date('2026-01-02T00:00:00.000Z');

const SYLLABUS =
  'Tema 1. La Constitucion espanola de 1978 regula los derechos fundamentales ' +
  'y la organizacion del Estado en sus titulos preliminares y articulos.';

function makeMaterial(over: Partial<Material> = {}): Material {
  return {
    id: 'm1',
    opposition_id: 'opp-1',
    title: 'Tema 1',
    description: null,
    type: 'syllabus',
    status: 'active',
    original_filename: 'tema1.pdf',
    mime_type: 'application/pdf',
    size_bytes: 100,
    storage_path: 'uploads/m1.pdf',
    content_text: SYLLABUS,
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

function setup() {
  const materials = new InMemoryMaterialRepository();
  const classifications = new InMemoryDocumentClassificationRepository();
  const service = new DocumentClassificationService({
    materials,
    importBatches: new InMemoryMaterialImportBatchRepository(),
    importItems: new InMemoryMaterialImportItemRepository(),
    runs: new InMemoryDocumentUnderstandingRunRepository(),
    classifications,
    provider: new HeuristicDocumentClassifier(),
  });
  return { materials, classifications, service };
}

describe('DocumentClassificationService.classifyOpposition', () => {
  it('clasifica todos los materiales activos de la oposicion (no solo un lote)', async () => {
    const { materials, service } = setup();
    await materials.create(makeMaterial({ id: 'm1' }));
    await materials.create(makeMaterial({ id: 'm2', title: 'Tema 2' }));
    await materials.create(makeMaterial({ id: 'other', opposition_id: 'opp-2' }));

    const inv = await service.classifyOpposition({
      opposition_id: 'opp-1',
      workspace_id: 'ws-1',
    });
    expect(inv.run?.opposition_id).toBe('opp-1');
    expect(inv.run?.workspace_id).toBe('ws-1');
    expect(inv.classifications).toHaveLength(2);
    expect(inv.classifications.every((c) => c.workspace_id === 'ws-1')).toBe(true);
    expect(inv.classifications.map((c) => c.material_id).sort()).toEqual(['m1', 'm2']);
  });

  it('salta la extraccion fallida/escaneada con un aviso', async () => {
    const { materials, service } = setup();
    await materials.create(makeMaterial({ id: 'm1' }));
    await materials.create(
      makeMaterial({ id: 'scan', extraction_status: 'not_supported', content_text: null }),
    );
    const inv = await service.classifyOpposition({ opposition_id: 'opp-1' });
    expect(inv.run?.status).toBe('completed_with_warnings');
    expect(inv.run?.warnings.join(' ')).toMatch(/omiti|extracci/i);
    // El escaneado no se clasifica (solo el analizable).
    expect(inv.classifications.map((c) => c.material_id)).toEqual(['m1']);
  });

  it('preserva las correcciones manuales (no reclasifica)', async () => {
    const { materials, service } = setup();
    await materials.create(makeMaterial({ id: 'm1' }));
    const first = await service.classifyOpposition({ opposition_id: 'opp-1' });
    // Correccion humana -> prevalece.
    await service.correctClassification({
      classification_id: first.classifications[0].id,
      classification: 'legal_text',
      corrected_by: 'admin',
    });
    // Re-analizar NO debe sobreescribir la correccion.
    const second = await service.classifyOpposition({ opposition_id: 'opp-1' });
    const m1 = second.classifications.find((c) => c.material_id === 'm1');
    expect(m1?.classification).toBe('legal_text');
    expect(m1?.manually_corrected).toBe(true);
  });
});
