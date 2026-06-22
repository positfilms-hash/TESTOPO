// Repositorio Supabase de materiales (SPEC 022). Implementa `MaterialRepository`
// mapeando el modelo `Material` a la tabla `materials`.
//
// El archivo real NO se guarda en Supabase: la tabla guarda metadatos,
// `storage_path` (referencia interna) y `content_text`. El filtrado replica el
// del repositorio InMemory para mantener identico comportamiento.

import type {
  ExtractionStatus,
  Material,
} from '../../models/material.js';
import type { MaterialStatus, MaterialType } from '../../models/enums.js';
import type {
  MaterialFilter,
  MaterialRepository,
} from '../materialRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'materials';

export class SupabaseMaterialRepository implements MaterialRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(material: Material): Promise<Material> {
    const row = await this.port.table(TABLE).insert(toRow(material));
    return toMaterial(row);
  }

  async findAll(filter: MaterialFilter = {}): Promise<Material[]> {
    const rows = await this.port.table(TABLE).selectAll();
    let result = rows.map(toMaterial);
    if (filter.type !== undefined) {
      result = result.filter((m) => m.type === filter.type);
    }
    if (filter.status !== undefined) {
      result = result.filter((m) => m.status === filter.status);
    }
    if (filter.opposition_id !== undefined) {
      result = result.filter((m) => m.opposition_id === filter.opposition_id);
    }
    return result;
  }

  async findById(id: string): Promise<Material | null> {
    const rows = await this.port.table(TABLE).selectMatch({ id });
    return rows[0] ? toMaterial(rows[0]) : null;
  }

  async save(material: Material): Promise<Material> {
    const { id: _omit, created_at: _omitCreated, ...patch } = toRow(material);
    const row = await this.port.table(TABLE).updateById(material.id, patch);
    return toMaterial(row);
  }

  async delete(id: string): Promise<void> {
    await this.port.table(TABLE).deleteMatch({ id });
  }
}

function toRow(m: Material): SupabaseRow {
  return {
    id: m.id,
    opposition_id: m.opposition_id,
    title: m.title,
    description: m.description,
    type: m.type,
    status: m.status,
    original_filename: m.original_filename,
    mime_type: m.mime_type,
    size_bytes: m.size_bytes,
    storage_path: m.storage_path,
    content_text: m.content_text,
    reference: m.reference,
    file_extension: m.file_extension ?? null,
    extraction_status: m.extraction_status ?? null,
    extraction_error: m.extraction_error ?? null,
    page_count: m.page_count ?? null,
    uploaded_by: m.uploaded_by ?? null,
    created_at: iso(m.created_at),
    updated_at: iso(m.updated_at),
  };
}

function toMaterial(row: SupabaseRow): Material {
  return {
    id: String(row.id),
    opposition_id: String(row.opposition_id ?? ''),
    title: String(row.title ?? ''),
    description: asNullableString(row.description),
    type: row.type as MaterialType,
    status: row.status as MaterialStatus,
    original_filename: asNullableString(row.original_filename),
    mime_type: asNullableString(row.mime_type),
    size_bytes: asNullableNumber(row.size_bytes),
    storage_path: asNullableString(row.storage_path),
    content_text: asNullableString(row.content_text),
    reference: asNullableString(row.reference),
    file_extension: asNullableString(row.file_extension),
    extraction_status: (row.extraction_status as ExtractionStatus | null) ?? undefined,
    extraction_error: asNullableString(row.extraction_error),
    page_count: asNullableNumber(row.page_count),
    uploaded_by: asNullableString(row.uploaded_by),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
