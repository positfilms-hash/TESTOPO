// Puerto Supabase en memoria (SPEC 020). Simula el acceso a tablas para tests y
// desarrollo local sin red. No es persistencia real: vive en memoria por sesion.

import type {
  SupabaseClientPort,
  SupabaseRow,
  SupabaseTablePort,
} from './supabaseClientPort.js';

class InMemoryTable implements SupabaseTablePort {
  private readonly rows = new Map<string, SupabaseRow>();

  async insert(row: SupabaseRow): Promise<SupabaseRow> {
    const id = String(row.id);
    this.rows.set(id, { ...row });
    return { ...row };
  }

  async selectMatch(criteria: SupabaseRow): Promise<SupabaseRow[]> {
    const entries = Object.entries(criteria);
    return [...this.rows.values()]
      .filter((row) => entries.every(([key, value]) => row[key] === value))
      .map((row) => ({ ...row }));
  }

  async selectAll(): Promise<SupabaseRow[]> {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }

  async updateById(id: string, patch: SupabaseRow): Promise<SupabaseRow> {
    const existing = this.rows.get(id) ?? {};
    const updated = { ...existing, ...patch, id };
    this.rows.set(id, updated);
    return { ...updated };
  }

  async deleteMatch(criteria: SupabaseRow): Promise<number> {
    const entries = Object.entries(criteria);
    let deleted = 0;
    for (const [id, row] of [...this.rows.entries()]) {
      if (entries.every(([key, value]) => row[key] === value)) {
        this.rows.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
}

export class InMemorySupabasePort implements SupabaseClientPort {
  private readonly tables = new Map<string, InMemoryTable>();

  table(name: string): SupabaseTablePort {
    let table = this.tables.get(name);
    if (!table) {
      table = new InMemoryTable();
      this.tables.set(name, table);
    }
    return table;
  }
}
