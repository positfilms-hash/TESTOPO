import { describe, expect, it } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import {
  MaterialService,
  type CreateMaterialInput,
} from '../src/service/materialService.js';
import { MaterialValidationError } from '../src/service/materialValidationError.js';
import { MaterialValidationErrorCode } from '../src/validation/materialErrors.js';
import type { MaterialStatus, MaterialType } from '../src/models/enums.js';
import { TEST_OPPOSITION_ID } from './helpers.js';

// Servicio con reloj e ids deterministas (datos ficticios).
function makeService(maxFileSizeBytes?: number): MaterialService {
  let tick = 0;
  const now = (): Date => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
  let counter = 0;
  const generateId = (): string => `mat-${++counter}`;
  return new MaterialService(new InMemoryMaterialRepository(), {
    generateId,
    now,
    maxFileSizeBytes,
  });
}

function validInput(
  overrides: Partial<CreateMaterialInput> = {},
): CreateMaterialInput {
  return {
    opposition_id: TEST_OPPOSITION_ID,
    title: 'Tema 1 - Documento ficticio',
    type: 'syllabus',
    content_text: 'Texto ficticio del tema 1.',
    reference: 'Tema 1',
    ...overrides,
  };
}

async function expectMaterialError(
  fn: () => unknown,
  code: MaterialValidationErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(MaterialValidationError);
    expect((error as MaterialValidationError).errors).toContain(code);
    return;
  }
  throw new Error(`Expected MaterialValidationError (${code}) to be thrown`);
}

describe('MaterialService - creacion', () => {
  it('crea material manual en estado active por defecto', async () => {
    const service = makeService();
    const material = await service.createMaterial(validInput());

    expect(material.status).toBe('active');
    expect(material.type).toBe('syllabus');
    expect(material.id).toBeTruthy();
    expect(material.content_text).toBe('Texto ficticio del tema 1.');
    expect(material.original_filename).toBeNull();
    expect(material.created_at).toEqual(material.updated_at);
  });

  it('no permite crear material sin titulo', async () => {
    const service = makeService();
    await expectMaterialError(
      () => service.createMaterial(validInput({ title: '   ' })),
      MaterialValidationErrorCode.TITLE_REQUIRED,
    );
  });

  it('no permite crear material con tipo invalido', async () => {
    const service = makeService();
    await expectMaterialError(
      () =>
        service.createMaterial(
          validInput({ type: 'invalido' as MaterialType }),
        ),
      MaterialValidationErrorCode.INVALID_TYPE,
    );
  });

  it('no permite crear material con estado invalido', async () => {
    const service = makeService();
    await expectMaterialError(
      () =>
        service.createMaterial(
          validInput({ status: 'archived' as MaterialStatus }),
        ),
      MaterialValidationErrorCode.INVALID_STATUS,
    );
  });
});

describe('MaterialService - lectura y edicion', () => {
  it('lista y filtra materiales', async () => {
    const service = makeService();
    await service.createMaterial(validInput({ type: 'syllabus' }));
    await service.createMaterial(
      validInput({ title: 'Ley ficticia', type: 'law' }),
    );

    expect(await service.listMaterials()).toHaveLength(2);
    expect(await service.listMaterials({ type: 'law' })).toHaveLength(1);
    expect(await service.listMaterials({ status: 'obsolete' })).toHaveLength(0);
  });

  it('consulta un material por id', async () => {
    const service = makeService();
    const created = await service.createMaterial(validInput());

    expect((await service.getMaterial(created.id))?.id).toBe(created.id);
    expect(await service.getMaterial('no-existe')).toBeNull();
  });

  it('edita un material y actualiza updated_at', async () => {
    const service = makeService();
    const created = await service.createMaterial(validInput());

    const edited = await service.editMaterial(created.id, {
      title: 'Tema 1 - Revisado',
      reference: 'Tema 1, apartado 3',
    });

    expect(edited.title).toBe('Tema 1 - Revisado');
    expect(edited.reference).toBe('Tema 1, apartado 3');
    expect(edited.updated_at.getTime()).toBeGreaterThan(
      created.updated_at.getTime(),
    );
    expect(edited.created_at).toEqual(created.created_at);
  });

  it('marca un material como obsolete', async () => {
    const service = makeService();
    const created = await service.createMaterial(validInput());

    const obsolete = await service.markObsolete(created.id);

    expect(obsolete.status).toBe('obsolete');
  });
});

describe('MaterialService - registro de archivo', () => {
  it('registra un .txt y guarda content_text', async () => {
    const service = makeService();
    const material = await service.registerFileMaterial({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Apuntes ficticios',
      type: 'notes',
      file: {
        original_filename: 'apuntes.txt',
        mime_type: 'text/plain',
        size_bytes: 1024,
        storage_path: 'uploads/apuntes.txt',
        content_text: 'Contenido ficticio.',
      },
    });

    expect(material.original_filename).toBe('apuntes.txt');
    expect(material.content_text).toBe('Contenido ficticio.');
  });

  it('registra un .pdf sin extraer texto (content_text null)', async () => {
    const service = makeService();
    const material = await service.registerFileMaterial({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Examen ficticio',
      type: 'official_exam',
      file: {
        original_filename: 'examen.pdf',
        mime_type: 'application/pdf',
        size_bytes: 2048,
        storage_path: 'uploads/examen.pdf',
        content_text: 'esto se ignora para pdf',
      },
    });

    expect(material.original_filename).toBe('examen.pdf');
    expect(material.content_text).toBeNull();
  });

  it('rechaza un archivo con extension no permitida', async () => {
    const service = makeService();
    await expectMaterialError(
      () =>
        service.registerFileMaterial({
      opposition_id: TEST_OPPOSITION_ID,
          title: 'Documento ficticio',
          type: 'other',
          file: { original_filename: 'malware.exe', size_bytes: 10 },
        }),
      MaterialValidationErrorCode.FILE_TYPE_NOT_ALLOWED,
    );
  });

  it('rechaza un archivo que supera el limite de tamano', async () => {
    const service = makeService(100);
    await expectMaterialError(
      () =>
        service.registerFileMaterial({
      opposition_id: TEST_OPPOSITION_ID,
          title: 'Documento grande ficticio',
          type: 'other',
          file: { original_filename: 'grande.pdf', size_bytes: 500 },
        }),
      MaterialValidationErrorCode.FILE_TOO_LARGE,
    );
  });
});
