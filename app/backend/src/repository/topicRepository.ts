// Contrato de persistencia de temas (SPEC 003). Almacen en memoria en el MVP.

import type { TopicStatus } from '../models/enums.js';
import type { Topic } from '../models/topic.js';

export interface TopicFilter {
  status?: TopicStatus;
  /** Filtra por tema padre. Usar `null` para listar solo temas raiz. */
  parent_id?: string | null;
  /** Busqueda simple por texto en titulo o codigo. */
  search?: string;
}

export interface TopicRepository {
  create(topic: Topic): Promise<Topic>;
  findAll(filter?: TopicFilter): Promise<Topic[]>;
  findById(id: string): Promise<Topic | null>;
  save(topic: Topic): Promise<Topic>;
}
