// Repositorio Supabase de vinculos material-tema (SPEC 022). Implementa
// `TopicMaterialLinkRepository` sobre la tabla `material_topic_links`. La
// unicidad (material_id, topic_id) la garantiza la constraint de la tabla.

import type { TopicMaterialLink } from '../../models/topicMaterialLink.js';
import type {
  TopicMaterialLinkFilter,
  TopicMaterialLinkRepository,
} from '../topicMaterialLinkRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'material_topic_links';

export class SupabaseTopicMaterialLinkRepository
  implements TopicMaterialLinkRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(link: TopicMaterialLink): Promise<TopicMaterialLink> {
    const row = await this.port.table(TABLE).insert(toRow(link));
    return toLink(row);
  }

  async findAll(
    filter: TopicMaterialLinkFilter = {},
  ): Promise<TopicMaterialLink[]> {
    const rows = await this.port.table(TABLE).selectAll();
    let result = rows.map(toLink);
    if (filter.topic_id !== undefined) {
      result = result.filter((l) => l.topic_id === filter.topic_id);
    }
    if (filter.material_id !== undefined) {
      result = result.filter((l) => l.material_id === filter.material_id);
    }
    return result;
  }

  async find(
    materialId: string,
    topicId: string,
  ): Promise<TopicMaterialLink | null> {
    const rows = await this.port
      .table(TABLE)
      .selectMatch({ material_id: materialId, topic_id: topicId });
    return rows[0] ? toLink(rows[0]) : null;
  }

  async delete(materialId: string, topicId: string): Promise<boolean> {
    const deleted = await this.port
      .table(TABLE)
      .deleteMatch({ material_id: materialId, topic_id: topicId });
    return deleted > 0;
  }
}

function toRow(l: TopicMaterialLink): SupabaseRow {
  return {
    id: l.id,
    material_id: l.material_id,
    topic_id: l.topic_id,
    reference: l.reference,
    created_at: iso(l.created_at),
  };
}

function toLink(row: SupabaseRow): TopicMaterialLink {
  return {
    id: String(row.id),
    material_id: String(row.material_id ?? ''),
    topic_id: String(row.topic_id ?? ''),
    reference:
      typeof row.reference === 'string' && row.reference.length > 0
        ? row.reference
        : null,
    created_at: parseDate(row.created_at),
  };
}
