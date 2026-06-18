// Repositorio Supabase de workspaces (SPEC 020). Implementa `WorkspaceRepository`
// mapeando el modelo `Workspace` a la tabla `workspaces`.

import type {
  Workspace,
  WorkspacePlan,
  WorkspaceStatus,
  WorkspaceType,
} from '../../models/workspace.js';
import type { WorkspaceRepository } from '../workspaceRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'workspaces';

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(workspace: Workspace): Promise<Workspace> {
    const row = await this.port.table(TABLE).insert(toRow(workspace));
    return toWorkspace(row);
  }

  async findById(id: string): Promise<Workspace | null> {
    const rows = await this.port.table(TABLE).selectMatch({ id });
    return rows[0] ? toWorkspace(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const rows = await this.port.table(TABLE).selectMatch({ slug });
    return rows[0] ? toWorkspace(rows[0]) : null;
  }

  async findAll(): Promise<Workspace[]> {
    const rows = await this.port.table(TABLE).selectAll();
    return rows.map(toWorkspace);
  }

  async save(workspace: Workspace): Promise<Workspace> {
    const row = await this.port.table(TABLE).updateById(workspace.id, {
      name: workspace.name,
      slug: workspace.slug,
      type: workspace.type,
      plan: workspace.plan,
      status: workspace.status,
      owner_id: workspace.owner_id,
      updated_at: iso(workspace.updated_at),
    });
    return toWorkspace(row);
  }
}

function toRow(w: Workspace): SupabaseRow {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    type: w.type,
    plan: w.plan,
    status: w.status,
    owner_id: w.owner_id,
    created_at: iso(w.created_at),
    updated_at: iso(w.updated_at),
  };
}

function toWorkspace(row: SupabaseRow): Workspace {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    type: (row.type as WorkspaceType) ?? 'personal',
    plan: (row.plan as WorkspacePlan) ?? 'free',
    status: (row.status as WorkspaceStatus) ?? 'active',
    owner_id: String(row.owner_id ?? ''),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}
