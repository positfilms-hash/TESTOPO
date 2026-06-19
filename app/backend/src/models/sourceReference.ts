// Referencias de fuente (SPEC 028-C). Una `SourceReference` apunta a una seccion
// concreta de un material (pagina/rango/fragmento). Specs futuras la usaran para
// decir "este tema/esta pregunta sale de esta fuente". Aqui solo se preparan: no
// se asocian todavia a preguntas ni a indice.

export const REFERENCE_TYPES = [
  'material_section',
  'page_range',
  'excerpt',
  'manual',
  'ai_suggested',
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export function isReferenceType(value: unknown): value is ReferenceType {
  return (
    typeof value === 'string' &&
    (REFERENCE_TYPES as readonly string[]).includes(value)
  );
}

export interface SourceReference {
  id: string;
  workspace_id: string | null;
  opposition_id: string | null;
  material_id: string;
  material_section_id: string | null;
  reference_type: ReferenceType;
  label: string;
  page_start: number | null;
  page_end: number | null;
  source_excerpt: string;
  confidence: number | null;
  created_at: Date;
  updated_at: Date;
}
