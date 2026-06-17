import { describe, expect, it } from 'vitest';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import {
  TopicService,
  type TopicServiceOptions,
} from '../src/service/topicService.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicValidationError } from '../src/service/topicValidationError.js';
import { TopicValidationErrorCode } from '../src/validation/topicErrors.js';
import type { TopicStatus } from '../src/models/enums.js';
import { TEST_OPPOSITION_ID } from './helpers.js';

function makeTopicService(options: TopicServiceOptions = {}): TopicService {
  let tick = 0;
  const now = (): Date => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
  let counter = 0;
  const generateId = (): string => `top-${++counter}`;
  return new TopicService(new InMemoryTopicRepository(), {
    generateId,
    now,
    ...options,
  });
}

async function expectTopicError(
  fn: () => unknown,
  code: TopicValidationErrorCode,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TopicValidationError);
    expect((error as TopicValidationError).errors).toContain(code);
    return;
  }
  throw new Error(`Expected TopicValidationError (${code}) to be thrown`);
}

describe('TopicService - creacion y jerarquia', () => {
  it('crea un tema raiz en estado active por defecto', async () => {
    const service = makeTopicService();
    const topic = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Bloque 1', code: 'B1' });

    expect(topic.status).toBe('active');
    expect(topic.parent_id).toBeNull();
    expect(topic.id).toBeTruthy();
  });

  it('crea un subtema con padre existente', async () => {
    const service = makeTopicService();
    const root = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Bloque 1' });
    const child = await service.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
      parent_id: root.id,
    });

    expect(child.parent_id).toBe(root.id);
  });

  it('no permite crear un tema sin titulo', async () => {
    const service = makeTopicService();
    await expectTopicError(
      () => service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: '   ' }),
      TopicValidationErrorCode.TITLE_REQUIRED,
    );
  });

  it('no permite crear un tema con estado invalido', async () => {
    const service = makeTopicService();
    await expectTopicError(
      () =>
        service.createTopic({
          opposition_id: TEST_OPPOSITION_ID,
          title: 'Tema 1',
          status: 'archived' as TopicStatus,
        }),
      TopicValidationErrorCode.INVALID_STATUS,
    );
  });

  it('no permite crear un subtema con padre inexistente', async () => {
    const service = makeTopicService();
    await expectTopicError(
      () => service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1', parent_id: 'no-existe' }),
      TopicValidationErrorCode.PARENT_NOT_FOUND,
    );
  });

  it('no permite que un tema sea padre de si mismo', async () => {
    const service = makeTopicService();
    const topic = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });
    await expectTopicError(
      () => service.editTopic(topic.id, { parent_id: topic.id }),
      TopicValidationErrorCode.CANNOT_BE_OWN_PARENT,
    );
  });

  it('no permite crear ciclos en la jerarquia', async () => {
    const service = makeTopicService();
    const a = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'A' });
    const b = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'B', parent_id: a.id });
    const c = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'C', parent_id: b.id });

    // A pasaria a depender de C, que desciende de A -> ciclo.
    await expectTopicError(
      () => service.editTopic(a.id, { parent_id: c.id }),
      TopicValidationErrorCode.HIERARCHY_CYCLE_DETECTED,
    );
  });
});

describe('TopicService - lectura, edicion y arbol', () => {
  it('lista temas y filtra por padre', async () => {
    const service = makeTopicService();
    const root = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Bloque 1' });
    await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1', parent_id: root.id });

    expect(await service.listTopics()).toHaveLength(2);
    expect(await service.listTopics({ parent_id: null })).toHaveLength(1);
    expect(await service.listTopics({ parent_id: root.id })).toHaveLength(1);
  });

  it('consulta un tema por id', async () => {
    const service = makeTopicService();
    const topic = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });

    expect((await service.getTopic(topic.id))?.id).toBe(topic.id);
    expect(await service.getTopic('no-existe')).toBeNull();
  });

  it('obtiene el arbol de temas ordenado y anidado', async () => {
    const service = makeTopicService();
    const root = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Bloque 1', order: 0 });
    await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 2', parent_id: root.id, order: 1 });
    await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1', parent_id: root.id, order: 0 });

    const tree = await service.getTopicTree();

    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Bloque 1');
    expect(tree[0].children.map((c) => c.title)).toEqual(['Tema 1', 'Tema 2']);
  });

  it('edita un tema y actualiza updated_at', async () => {
    const service = makeTopicService();
    const created = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });

    const edited = await service.editTopic(created.id, {
      title: 'Tema 1 - Revisado',
      code: 'T1',
    });

    expect(edited.title).toBe('Tema 1 - Revisado');
    expect(edited.code).toBe('T1');
    expect(edited.updated_at.getTime()).toBeGreaterThan(
      created.updated_at.getTime(),
    );
  });

  it('marca un tema como obsolete', async () => {
    const service = makeTopicService();
    const created = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });

    expect((await service.markObsolete(created.id)).status).toBe('obsolete');
  });
});

describe('TopicService - vinculacion de materiales', () => {
  async function setup() {
    const materialRepository = new InMemoryMaterialRepository();
    const materialService = new MaterialService(materialRepository);
    const material = await materialService.createMaterial({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1 - Documento ficticio',
      type: 'syllabus',
    });
    const service = makeTopicService({ materialRepository });
    const topic = await service.createTopic({ opposition_id: TEST_OPPOSITION_ID, title: 'Tema 1' });
    return { service, topic, material };
  }

  it('vincula un material a un tema', async () => {
    const { service, topic, material } = await setup();
    const link = await service.linkMaterial(material.id, topic.id, 'Pagina 12');

    expect(link.material_id).toBe(material.id);
    expect(link.topic_id).toBe(topic.id);
    expect(await service.listMaterialsForTopic(topic.id)).toHaveLength(1);
  });

  it('desvincula un material de un tema sin borrar ninguno', async () => {
    const { service, topic, material } = await setup();
    await service.linkMaterial(material.id, topic.id);

    expect(await service.unlinkMaterial(material.id, topic.id)).toBe(true);
    expect(await service.listMaterialsForTopic(topic.id)).toHaveLength(0);
    expect(await service.getTopic(topic.id)).not.toBeNull();
  });

  it('no permite vincular un material inexistente', async () => {
    const { service, topic } = await setup();
    await expectTopicError(
      () => service.linkMaterial('no-existe', topic.id),
      TopicValidationErrorCode.MATERIAL_NOT_FOUND,
    );
  });

  it('no permite duplicar un vinculo material-tema', async () => {
    const { service, topic, material } = await setup();
    await service.linkMaterial(material.id, topic.id);
    await expectTopicError(
      () => service.linkMaterial(material.id, topic.id),
      TopicValidationErrorCode.MATERIAL_LINK_ALREADY_EXISTS,
    );
  });
});
