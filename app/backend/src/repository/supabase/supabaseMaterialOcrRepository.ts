// Repositorio Supabase del OCR de material (SPEC 030): material_ocr_runs +
// material_ocr_pages. Arrays como JSONB. Mismo patron que el resto de repos.

import type {
  MaterialOcrPage,
  MaterialOcrRun,
  OcrPageStatus,
  OcrRunStatus,
} from '../../models/materialOcr.js';
import type { MaterialOcrRepository } from '../materialOcrRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const RUNS = 'material_ocr_runs';
const PAGES = 'material_ocr_pages';

export class SupabaseMaterialOcrRepository implements MaterialOcrRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async createRun(run: MaterialOcrRun): Promise<MaterialOcrRun> {
    const row = await this.port.table(RUNS).insert(runToRow(run));
    return toRun(row);
  }

  async updateRun(run: MaterialOcrRun): Promise<MaterialOcrRun> {
    const row = await this.port.table(RUNS).updateById(run.id, runToRow(run));
    return toRun(row);
  }

  async getRun(id: string): Promise<MaterialOcrRun | null> {
    const rows = await this.port.table(RUNS).selectMatch({ id });
    return rows[0] ? toRun(rows[0]) : null;
  }

  async getLatestRunByMaterial(
    materialId: string,
  ): Promise<MaterialOcrRun | null> {
    const rows = await this.port
      .table(RUNS)
      .selectMatch({ material_id: materialId });
    const runs = rows
      .map(toRun)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return runs[0] ?? null;
  }

  async createPage(page: MaterialOcrPage): Promise<MaterialOcrPage> {
    const row = await this.port.table(PAGES).insert(pageToRow(page));
    return toPage(row);
  }

  async listPagesByRun(runId: string): Promise<MaterialOcrPage[]> {
    const rows = await this.port.table(PAGES).selectMatch({ ocr_run_id: runId });
    return rows.map(toPage).sort((a, b) => a.page_number - b.page_number);
  }

  async deleteByMaterial(materialId: string): Promise<void> {
    await this.port.table(PAGES).deleteMatch({ material_id: materialId });
    await this.port.table(RUNS).deleteMatch({ material_id: materialId });
  }
}

function runToRow(r: MaterialOcrRun): SupabaseRow {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    opposition_id: r.opposition_id,
    material_id: r.material_id,
    created_by: r.created_by,
    provider: r.provider,
    model: r.model,
    status: r.status,
    page_count: r.page_count,
    processed_pages: r.processed_pages,
    failed_pages: r.failed_pages,
    average_confidence: r.average_confidence,
    warnings: r.warnings,
    errors: r.errors,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function toRun(row: SupabaseRow): MaterialOcrRun {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    material_id: String(row.material_id ?? ''),
    created_by: asNullableString(row.created_by),
    provider: String(row.provider ?? ''),
    model: asNullableString(row.model),
    status: (row.status as OcrRunStatus) ?? 'pending',
    page_count: asNumber(row.page_count),
    processed_pages: asNumber(row.processed_pages),
    failed_pages: asNumber(row.failed_pages),
    average_confidence: asNullableNumber(row.average_confidence),
    warnings: asStringArray(row.warnings),
    errors: asStringArray(row.errors),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function pageToRow(p: MaterialOcrPage): SupabaseRow {
  return {
    id: p.id,
    workspace_id: p.workspace_id,
    opposition_id: p.opposition_id,
    material_id: p.material_id,
    ocr_run_id: p.ocr_run_id,
    page_number: p.page_number,
    image_ref: p.image_ref,
    text: p.text,
    confidence: p.confidence,
    status: p.status,
    warnings: p.warnings,
    errors: p.errors,
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
  };
}

function toPage(row: SupabaseRow): MaterialOcrPage {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: String(row.opposition_id ?? ''),
    material_id: String(row.material_id ?? ''),
    ocr_run_id: String(row.ocr_run_id ?? ''),
    page_number: asNumber(row.page_number),
    image_ref: asNullableString(row.image_ref),
    text: String(row.text ?? ''),
    confidence: asNullableNumber(row.confidence),
    status: (row.status as OcrPageStatus) ?? 'failed',
    warnings: asStringArray(row.warnings),
    errors: asStringArray(row.errors),
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
function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}
