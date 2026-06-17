// Operaciones del mapa del temario (SPEC 003, secciones 11 y 13).
//
// TopicService es el coordinador del mapa: gestiona los temas y su jerarquia, y
// los vincula con materiales (SPEC 002) y preguntas (SPEC 001). Las dependencias
// hacia otros modulos (material y preguntas) son repositorios inyectables y
// opcionales, para no acoplar este servicio si solo se usan los temas.

import { randomUUID } from 'node:crypto';
import type { TopicStatus } from '../models/enums.js';
import type { Topic, TopicTreeNode } from '../models/topic.js';
import type { TopicMaterialLink } from '../models/topicMaterialLink.js';
import type {
  TopicFilter,
  TopicRepository,
} from '../repository/topicRepository.js';
import type { TopicMaterialLinkRepository } from '../repository/topicMaterialLinkRepository.js';
import { InMemoryTopicMaterialLinkRepository } from '../repository/inMemoryTopicMaterialLinkRepository.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { QuestionRepository } from '../repository/questionRepository.js';
import { validateTopicMetadata } from '../validation/validateTopic.js';
import { TopicValidationErrorCode } from '../validation/topicErrors.js';
import { TopicValidationError } from './topicValidationError.js';
import {
  assertSameOpposition,
  requireOpposition,
} from '../access/oppositionGuards.js';

export interface CreateTopicInput {
  opposition_id?: string;
  title?: string;
  description?: string | null;
  code?: string | null;
  parent_id?: string | null;
  order?: number;
  status?: TopicStatus;
}

export interface EditTopicInput {
  title?: string;
  description?: string | null;
  code?: string | null;
  parent_id?: string | null;
  order?: number;
  status?: TopicStatus;
}

export interface TopicServiceOptions {
  linkRepository?: TopicMaterialLinkRepository;
  /** Permite verificar la existencia del material al vincularlo. */
  materialRepository?: MaterialRepository;
  /** Permite asignar un tema a una pregunta existente. */
  questionRepository?: QuestionRepository;
  generateId?: () => string;
  now?: () => Date;
}

export class TopicService {
  private readonly links: TopicMaterialLinkRepository;
  private readonly materials?: MaterialRepository;
  private readonly questions?: QuestionRepository;
  private readonly generateId: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly topics: TopicRepository,
    options: TopicServiceOptions = {},
  ) {
    this.links =
      options.linkRepository ?? new InMemoryTopicMaterialLinkRepository();
    this.materials = options.materialRepository;
    this.questions = options.questionRepository;
    this.generateId = options.generateId ?? (() => randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  // 11.1 Crear tema (raiz o subtema). Estado por defecto `active`.
  createTopic(input: CreateTopicInput): Topic {
    const oppositionId = requireOpposition(input.opposition_id);
    const status = input.status ?? 'active';
    this.assertValidMetadata({ title: input.title, status });

    const parentId = input.parent_id ?? null;
    if (parentId !== null) {
      const parent = this.topics.findById(parentId);
      if (!parent) {
        throw new TopicValidationError([
          TopicValidationErrorCode.PARENT_NOT_FOUND,
        ]);
      }
      // El subtema debe pertenecer a la misma oposicion que su padre.
      assertSameOpposition(parent.opposition_id, oppositionId);
    }

    const timestamp = this.now();
    const topic: Topic = {
      id: this.generateId(),
      opposition_id: oppositionId,
      title: input.title as string,
      description: input.description ?? null,
      code: input.code ?? null,
      parent_id: parentId,
      order: input.order ?? 0,
      status,
      created_at: timestamp,
      updated_at: timestamp,
    };
    return this.topics.create(topic);
  }

  // 11.2 Listar temas con filtros opcionales.
  listTopics(filter: TopicFilter = {}): Topic[] {
    return this.topics.findAll(filter);
  }

  // 11.3 Obtener los temas en estructura de arbol, ordenados por `order`.
  getTopicTree(): TopicTreeNode[] {
    const all = this.topics.findAll();
    const ids = new Set(all.map((topic) => topic.id));
    const byParent = new Map<string | null, Topic[]>();
    for (const topic of all) {
      // Un tema cuyo padre no existe se trata como raiz para no perderlo.
      const parentKey =
        topic.parent_id !== null && ids.has(topic.parent_id)
          ? topic.parent_id
          : null;
      const siblings = byParent.get(parentKey) ?? [];
      siblings.push(topic);
      byParent.set(parentKey, siblings);
    }

    const build = (parentId: string | null): TopicTreeNode[] => {
      const siblings = [...(byParent.get(parentId) ?? [])].sort(
        (a, b) => a.order - b.order,
      );
      return siblings.map((topic) => ({
        ...topic,
        children: build(topic.id),
      }));
    };

    return build(null);
  }

  // 11.4 Consultar tema por id.
  getTopic(id: string): Topic | null {
    return this.topics.findById(id);
  }

  // 11.5 Editar tema. Valida metadatos y jerarquia. Actualiza `updated_at`.
  editTopic(id: string, changes: EditTopicInput): Topic {
    const existing = this.requireTopic(id);

    const nextTitle = changes.title ?? existing.title;
    const nextStatus = changes.status ?? existing.status;
    this.assertValidMetadata({ title: nextTitle, status: nextStatus });

    const nextParentId =
      changes.parent_id !== undefined ? changes.parent_id : existing.parent_id;
    if (nextParentId !== existing.parent_id) {
      this.assertValidParent(id, nextParentId);
    }

    const updated: Topic = {
      ...existing,
      title: nextTitle,
      status: nextStatus,
      parent_id: nextParentId,
      description:
        changes.description !== undefined
          ? changes.description
          : existing.description,
      code: changes.code !== undefined ? changes.code : existing.code,
      order: changes.order !== undefined ? changes.order : existing.order,
      updated_at: this.now(),
    };
    return this.topics.save(updated);
  }

  // 11.6 Cambiar estado del tema.
  changeStatus(id: string, status: TopicStatus): Topic {
    const existing = this.requireTopic(id);
    this.assertValidMetadata({ title: existing.title, status });

    const updated: Topic = {
      ...existing,
      status,
      updated_at: this.now(),
    };
    return this.topics.save(updated);
  }

  // 11.7 atajo: marcar como obsoleto (no se borra fisicamente).
  markObsolete(id: string): Topic {
    return this.changeStatus(id, 'obsolete');
  }

  // 11.7 Vincular un material existente a un tema existente.
  linkMaterial(
    materialId: string,
    topicId: string,
    reference: string | null = null,
  ): TopicMaterialLink {
    const topic = this.requireTopic(topicId);
    if (!this.materials) {
      throw new Error(
        'linkMaterial requires a materialRepository in TopicService options',
      );
    }
    const material = this.materials.findById(materialId);
    if (!material) {
      throw new TopicValidationError([
        TopicValidationErrorCode.MATERIAL_NOT_FOUND,
      ]);
    }
    // No se puede vincular material de otra oposicion (SPEC 010, 17.1).
    assertSameOpposition(material.opposition_id, topic.opposition_id);
    if (this.links.find(materialId, topicId)) {
      throw new TopicValidationError([
        TopicValidationErrorCode.MATERIAL_LINK_ALREADY_EXISTS,
      ]);
    }

    const link: TopicMaterialLink = {
      id: this.generateId(),
      material_id: materialId,
      topic_id: topicId,
      reference,
      created_at: this.now(),
    };
    return this.links.create(link);
  }

  // 11.8 Desvincular material de tema. No borra ni material ni tema.
  unlinkMaterial(materialId: string, topicId: string): boolean {
    return this.links.delete(materialId, topicId);
  }

  listMaterialsForTopic(topicId: string): TopicMaterialLink[] {
    return this.links.findAll({ topic_id: topicId });
  }

  // 11.9 Vincular una pregunta existente a un tema existente. Requiere haber
  // inyectado un questionRepository. Actualiza `topic_id` y el texto `topic`.
  assignTopicToQuestion(questionId: string, topicId: string): void {
    if (!this.questions) {
      throw new Error(
        'assignTopicToQuestion requires a questionRepository in TopicService options',
      );
    }
    const topic = this.requireTopic(topicId);
    const question = this.questions.findById(questionId);
    if (!question) {
      throw new TopicValidationError([
        TopicValidationErrorCode.QUESTION_NOT_FOUND,
      ]);
    }
    // No se puede vincular una pregunta a un tema de otra oposicion (17.1).
    assertSameOpposition(topic.opposition_id, question.opposition_id);

    this.questions.save({
      ...question,
      topic_id: topic.id,
      topic: topic.title,
      updated_at: this.now(),
    });
  }

  private requireTopic(id: string): Topic {
    const topic = this.topics.findById(id);
    if (!topic) {
      throw new TopicValidationError([
        TopicValidationErrorCode.TOPIC_NOT_FOUND,
      ]);
    }
    return topic;
  }

  private assertValidMetadata(metadata: {
    title: unknown;
    status: unknown;
  }): void {
    const result = validateTopicMetadata(metadata);
    if (!result.valid) {
      throw new TopicValidationError(result.errors);
    }
  }

  // Valida el padre propuesto para un tema: no puede ser el mismo tema, debe
  // existir y no puede generar un ciclo en la jerarquia (SPEC 003, 10.3).
  private assertValidParent(topicId: string, parentId: string | null): void {
    if (parentId === null) {
      return;
    }
    if (parentId === topicId) {
      throw new TopicValidationError([
        TopicValidationErrorCode.CANNOT_BE_OWN_PARENT,
      ]);
    }
    if (!this.topics.findById(parentId)) {
      throw new TopicValidationError([
        TopicValidationErrorCode.PARENT_NOT_FOUND,
      ]);
    }
    if (this.wouldCreateCycle(topicId, parentId)) {
      throw new TopicValidationError([
        TopicValidationErrorCode.HIERARCHY_CYCLE_DETECTED,
      ]);
    }
  }

  // Recorre la cadena de ancestros del nuevo padre: si aparece el propio tema,
  // el cambio crearia un ciclo.
  private wouldCreateCycle(topicId: string, newParentId: string): boolean {
    const visited = new Set<string>();
    let current: string | null = newParentId;
    while (current !== null) {
      if (current === topicId) {
        return true;
      }
      if (visited.has(current)) {
        break;
      }
      visited.add(current);
      current = this.topics.findById(current)?.parent_id ?? null;
    }
    return false;
  }
}
