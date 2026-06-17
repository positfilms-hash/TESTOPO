// Oposicion: agrupa material, temario, preguntas, tests e intentos (SPEC 010, 9).

export const OPPOSITION_STATUSES = ['active', 'draft', 'archived'] as const;
export type OppositionStatus = (typeof OPPOSITION_STATUSES)[number];

export interface Opposition {
  id: string;
  title: string;
  description: string | null;
  /** Identificador legible y unico. */
  slug: string;
  status: OppositionStatus;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export function isOppositionStatus(value: unknown): value is OppositionStatus {
  return OPPOSITION_STATUSES.includes(value as OppositionStatus);
}
