// Repositorio Supabase de miembros de workspace (SPEC 020). Implementa
// `WorkspaceMemberRepository` mapeando `WorkspaceMember` a `workspace_members`.
//
// La unicidad (workspace_id, user_id) la garantiza la constraint de la tabla;
// la capa de servicios mantiene ademas sus guards.

import type {
  WorkspaceMember,
  WorkspaceMemberStatus,
  WorkspaceRole,
} from '../../models/workspaceMember.js';
import type { WorkspaceMemberRepository } from '../workspaceMemberRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'workspace_members';

export class SupabaseWorkspaceMemberRepository
  implements WorkspaceMemberRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(member: WorkspaceMember): Promise<WorkspaceMember> {
    const row = await this.port.table(TABLE).insert(toRow(member));
    return toMember(row);
  }

  async find(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const rows = await this.port
      .table(TABLE)
      .selectMatch({ workspace_id: workspaceId, user_id: userId });
    return rows[0] ? toMember(rows[0]) : null;
  }

  async findByUser(userId: string): Promise<WorkspaceMember[]> {
    const rows = await this.port.table(TABLE).selectMatch({ user_id: userId });
    return rows.map(toMember);
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {
    const rows = await this.port
      .table(TABLE)
      .selectMatch({ workspace_id: workspaceId });
    return rows.map(toMember);
  }

  async save(member: WorkspaceMember): Promise<WorkspaceMember> {
    const row = await this.port.table(TABLE).updateById(member.id, {
      workspace_id: member.workspace_id,
      user_id: member.user_id,
      role: member.role,
      status: member.status,
      updated_at: iso(member.updated_at),
    });
    return toMember(row);
  }
}

function toRow(m: WorkspaceMember): SupabaseRow {
  return {
    id: m.id,
    workspace_id: m.workspace_id,
    user_id: m.user_id,
    role: m.role,
    status: m.status,
    created_at: iso(m.created_at),
    updated_at: iso(m.updated_at),
  };
}

function toMember(row: SupabaseRow): WorkspaceMember {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id ?? ''),
    user_id: String(row.user_id ?? ''),
    role: (row.role as WorkspaceRole) ?? 'student',
    status: (row.status as WorkspaceMemberStatus) ?? 'active',
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}
