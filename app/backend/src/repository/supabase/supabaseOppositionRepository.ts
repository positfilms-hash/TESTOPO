// Repositorio Supabase de oposiciones (SPEC 021). Implementa
// `OppositionRepository` mapeando el modelo `Opposition` a la tabla `oppositions`.

import type {
  Opposition,
  OppositionStatus,
} from '../../models/opposition.js';
import type { OppositionRepository } from '../oppositionRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'oppositions';

export class SupabaseOppositionRepository implements OppositionRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(opposition: Opposition): Promise<Opposition> {
    const row = await this.port.table(TABLE).insert(toRow(opposition));
    return toOpposition(row);
  }

  async findById(id: string): Promise<Opposition | null> {
    const rows = await this.port.table(TABLE).selectMatch({ id });
    return rows[0] ? toOpposition(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Opposition | null> {
    const rows = await this.port.table(TABLE).selectMatch({ slug });
    return rows[0] ? toOpposition(rows[0]) : null;
  }

  async findAll(): Promise<Opposition[]> {
    const rows = await this.port.table(TABLE).selectAll();
    return rows.map(toOpposition);
  }

  async save(opposition: Opposition): Promise<Opposition> {
    const row = await this.port.table(TABLE).updateById(opposition.id, {
      workspace_id: opposition.workspace_id,
      title: opposition.title,
      description: opposition.description,
      slug: opposition.slug,
      status: opposition.status,
      created_by: opposition.created_by,
      updated_at: iso(opposition.updated_at),
    });
    return toOpposition(row);
  }
}

function toRow(o: Opposition): SupabaseRow {
  return {
    id: o.id,
    workspace_id: o.workspace_id,
    title: o.title,
    description: o.description,
    slug: o.slug,
    status: o.status,
    created_by: o.created_by,
    created_at: iso(o.created_at),
    updated_at: iso(o.updated_at),
  };
}

function toOpposition(row: SupabaseRow): Opposition {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id ?? ''),
    title: String(row.title ?? ''),
    description: typeof row.description === 'string' ? row.description : null,
    slug: String(row.slug ?? ''),
    status: (row.status as OppositionStatus) ?? 'active',
    created_by: String(row.created_by ?? ''),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}
