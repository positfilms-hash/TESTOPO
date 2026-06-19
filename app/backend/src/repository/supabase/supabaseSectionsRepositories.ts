// Repositorios Supabase de secciones de material y referencias de fuente
// (SPEC 028-C): `material_sections` y `source_references`. Mismo patron que
// supabaseDocumentClassificationRepositories.

import type {
  MaterialSection,
  SectionClass,
  SectionStatus,
  SectionType,
} from '../../models/materialSection.js';
import type {
  ReferenceType,
  SourceReference,
} from '../../models/sourceReference.js';
import type {
  MaterialSectionRepository,
  SectionSearchInput,
} from '../materialSectionRepository.js';
import type { SourceReferenceRepository } from '../sourceReferenceRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const SECTION_TABLE = 'material_sections';
const REFERENCE_TABLE = 'source_references';

export class SupabaseMaterialSectionRepository
  implements MaterialSectionRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(section: MaterialSection): Promise<MaterialSection> {
    const row = await this.port.table(SECTION_TABLE).insert(sectionToRow(section));
    return toSection(row);
  }

  async createMany(sections: MaterialSection[]): Promise<MaterialSection[]> {
    const created: MaterialSection[] = [];
    for (const section of sections) {
      created.push(await this.create(section));
    }
    return created;
  }

  async findById(id: string): Promise<MaterialSection | null> {
    const rows = await this.port.table(SECTION_TABLE).selectMatch({ id });
    return rows[0] ? toSection(rows[0]) : null;
  }

  async listByMaterial(materialId: string): Promise<MaterialSection[]> {
    const rows = await this.port
      .table(SECTION_TABLE)
      .selectMatch({ material_id: materialId });
    return rows.map(toSection).sort((a, b) => a.order_index - b.order_index);
  }

  async deleteByMaterial(materialId: string): Promise<void> {
    await this.port.table(SECTION_TABLE).deleteMatch({ material_id: materialId });
  }

  async search(input: SectionSearchInput): Promise<MaterialSection[]> {
    // Scope por oposicion (+ clasificacion si se indica) en Supabase; el filtrado
    // de texto se hace en memoria (busqueda basica, sin ranking semantico).
    const match: SupabaseRow = { opposition_id: input.opposition_id };
    if (input.classification) {
      match.classification = input.classification;
    }
    const rows = await this.port.table(SECTION_TABLE).selectMatch(match);
    const sections = rows.map(toSection);
    const materialIds = input.material_ids ? new Set(input.material_ids) : null;
    const terms = tokenize(input.query);
    const scored = sections
      .filter((s) => (materialIds ? materialIds.has(s.material_id) : true))
      .map((s) => ({ section: s, score: matchScore(s, terms) }))
      .filter((x) => terms.length === 0 || x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, input.limit ?? 20).map((x) => x.section);
  }
}

export class SupabaseSourceReferenceRepository
  implements SourceReferenceRepository
{
  constructor(private readonly port: SupabaseClientPort) {}

  async create(reference: SourceReference): Promise<SourceReference> {
    const row = await this.port
      .table(REFERENCE_TABLE)
      .insert(referenceToRow(reference));
    return toReference(row);
  }

  async createMany(references: SourceReference[]): Promise<SourceReference[]> {
    const created: SourceReference[] = [];
    for (const reference of references) {
      created.push(await this.create(reference));
    }
    return created;
  }

  async findById(id: string): Promise<SourceReference | null> {
    const rows = await this.port.table(REFERENCE_TABLE).selectMatch({ id });
    return rows[0] ? toReference(rows[0]) : null;
  }

  async listByMaterial(materialId: string): Promise<SourceReference[]> {
    const rows = await this.port
      .table(REFERENCE_TABLE)
      .selectMatch({ material_id: materialId });
    return rows.map(toReference);
  }

  async listBySection(sectionId: string): Promise<SourceReference[]> {
    const rows = await this.port
      .table(REFERENCE_TABLE)
      .selectMatch({ material_section_id: sectionId });
    return rows.map(toReference);
  }
}

function sectionToRow(s: MaterialSection): SupabaseRow {
  return {
    id: s.id,
    workspace_id: s.workspace_id,
    opposition_id: s.opposition_id,
    material_id: s.material_id,
    section_title: s.section_title,
    section_type: s.section_type,
    page_start: s.page_start,
    page_end: s.page_end,
    content_excerpt: s.content_excerpt,
    content_text: s.content_text,
    order_index: s.order_index,
    classification: s.classification,
    source_path: s.source_path,
    status: s.status,
    created_at: iso(s.created_at),
    updated_at: iso(s.updated_at),
  };
}

function toSection(row: SupabaseRow): MaterialSection {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    material_id: String(row.material_id ?? ''),
    section_title: String(row.section_title ?? ''),
    section_type: (row.section_type as SectionType) ?? 'unknown',
    page_start: asNullableNumber(row.page_start),
    page_end: asNullableNumber(row.page_end),
    content_excerpt: String(row.content_excerpt ?? ''),
    content_text: String(row.content_text ?? ''),
    order_index: asNumber(row.order_index),
    classification: (row.classification as SectionClass) ?? 'unknown',
    source_path: asNullableString(row.source_path),
    status: (row.status as SectionStatus) ?? 'active',
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function referenceToRow(r: SourceReference): SupabaseRow {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    opposition_id: r.opposition_id,
    material_id: r.material_id,
    material_section_id: r.material_section_id,
    reference_type: r.reference_type,
    label: r.label,
    page_start: r.page_start,
    page_end: r.page_end,
    source_excerpt: r.source_excerpt,
    confidence: r.confidence,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
}

function toReference(row: SupabaseRow): SourceReference {
  return {
    id: String(row.id),
    workspace_id: asNullableString(row.workspace_id),
    opposition_id: asNullableString(row.opposition_id),
    material_id: String(row.material_id ?? ''),
    material_section_id: asNullableString(row.material_section_id),
    reference_type: (row.reference_type as ReferenceType) ?? 'material_section',
    label: String(row.label ?? ''),
    page_start: asNullableNumber(row.page_start),
    page_end: asNullableNumber(row.page_end),
    source_excerpt: String(row.source_excerpt ?? ''),
    confidence: asNullableNumber(row.confidence),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function tokenize(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function matchScore(section: MaterialSection, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }
  const haystack = normalize(
    `${section.section_title} ${section.content_text} ${section.classification}`,
  );
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      score += 1;
    }
  }
  return score;
}

function normalize(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('')
    .toLowerCase();
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
