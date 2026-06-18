// Repositorio Supabase de temas (SPEC 022). Implementa `TopicRepository`
// mapeando el modelo `Topic` a la tabla `topics`. El filtrado (status, parent_id
// incluido `null`, search por titulo/codigo) replica el del repo InMemory.

import type { Topic } from '../../models/topic.js';
import type { TopicStatus } from '../../models/enums.js';
import type { TopicFilter, TopicRepository } from '../topicRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'topics';

export class SupabaseTopicRepository implements TopicRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(topic: Topic): Promise<Topic> {
    const row = await this.port.table(TABLE).insert(toRow(topic));
    return toTopic(row);
  }

  async findAll(filter: TopicFilter = {}): Promise<Topic[]> {
    const rows = await this.port.table(TABLE).selectAll();
    let result = rows.map(toTopic);
    if (filter.status !== undefined) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter.parent_id !== undefined) {
      result = result.filter((t) => t.parent_id === filter.parent_id);
    }
    if (filter.search !== undefined && filter.search.trim() !== '') {
      const needle = filter.search.trim().toLowerCase();
      result = result.filter((t) =>
        `${t.title} ${t.code ?? ''}`.toLowerCase().includes(needle),
      );
    }
    return result;
  }

  async findById(id: string): Promise<Topic | null> {
    const rows = await this.port.table(TABLE).selectMatch({ id });
    return rows[0] ? toTopic(rows[0]) : null;
  }

  async save(topic: Topic): Promise<Topic> {
    const { id: _omit, created_at: _omitCreated, ...patch } = toRow(topic);
    const row = await this.port.table(TABLE).updateById(topic.id, patch);
    return toTopic(row);
  }
}

function toRow(t: Topic): SupabaseRow {
  return {
    id: t.id,
    opposition_id: t.opposition_id,
    title: t.title,
    description: t.description,
    code: t.code,
    parent_id: t.parent_id,
    // El modelo usa `order`; en la tabla es `order_index` (order es reservada).
    order_index: t.order,
    status: t.status,
    created_at: iso(t.created_at),
    updated_at: iso(t.updated_at),
  };
}

function toTopic(row: SupabaseRow): Topic {
  return {
    id: String(row.id),
    opposition_id: String(row.opposition_id ?? ''),
    title: String(row.title ?? ''),
    description: typeof row.description === 'string' && row.description.length > 0 ? row.description : null,
    code: typeof row.code === 'string' && row.code.length > 0 ? row.code : null,
    parent_id: typeof row.parent_id === 'string' && row.parent_id.length > 0 ? row.parent_id : null,
    order: typeof row.order_index === 'number' ? row.order_index : 0,
    status: row.status as TopicStatus,
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}
