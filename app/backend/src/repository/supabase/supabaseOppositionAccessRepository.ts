// Repositorio Supabase de accesos a oposiciones (SPEC 021). Implementa
// `OppositionAccessRepository` mapeando `OppositionAccess` a `opposition_access`.
//
// La unicidad (opposition_id, user_id) la garantiza la constraint de la tabla;
// la capa de servicios mantiene ademas sus guards.

import type {
  AccessStatus,
  OppositionAccess,
  OppositionRole,
} from '../../models/oppositionAccess.js';
import type { OppositionAccessRepository } from '../oppositionAccessRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'opposition_access';

export class SupabaseOppositionAccessRepository
  implements OppositionAccessRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(access: OppositionAccess): Promise<OppositionAccess> {
    const row = await this.port.table(TABLE).insert(toRow(access));
    return toAccess(row);
  }

  async find(
    userId: string,
    oppositionId: string,
  ): Promise<OppositionAccess | null> {
    const rows = await this.port
      .table(TABLE)
      .selectMatch({ user_id: userId, opposition_id: oppositionId });
    return rows[0] ? toAccess(rows[0]) : null;
  }

  async findByUser(userId: string): Promise<OppositionAccess[]> {
    const rows = await this.port.table(TABLE).selectMatch({ user_id: userId });
    return rows.map(toAccess);
  }

  async findByOpposition(oppositionId: string): Promise<OppositionAccess[]> {
    const rows = await this.port
      .table(TABLE)
      .selectMatch({ opposition_id: oppositionId });
    return rows.map(toAccess);
  }

  async save(access: OppositionAccess): Promise<OppositionAccess> {
    const row = await this.port.table(TABLE).updateById(access.id, {
      opposition_id: access.opposition_id,
      user_id: access.user_id,
      role_in_opposition: access.role_in_opposition,
      status: access.status,
      granted_by: access.granted_by,
      updated_at: iso(access.updated_at),
    });
    return toAccess(row);
  }
}

function toRow(a: OppositionAccess): SupabaseRow {
  return {
    id: a.id,
    opposition_id: a.opposition_id,
    user_id: a.user_id,
    role_in_opposition: a.role_in_opposition,
    status: a.status,
    granted_by: a.granted_by,
    created_at: iso(a.created_at),
    updated_at: iso(a.updated_at),
  };
}

function toAccess(row: SupabaseRow): OppositionAccess {
  return {
    id: String(row.id),
    opposition_id: String(row.opposition_id ?? ''),
    user_id: String(row.user_id ?? ''),
    role_in_opposition: (row.role_in_opposition as OppositionRole) ?? 'student',
    status: (row.status as AccessStatus) ?? 'active',
    granted_by:
      typeof row.granted_by === 'string' && row.granted_by.length > 0
        ? row.granted_by
        : null,
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}
