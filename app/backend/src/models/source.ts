// Fuente de la que procede una pregunta (SPEC 001, seccion 6).
// Garantiza la trazabilidad: toda pregunta validada debe poder rastrearse
// hasta su origen.

import type { SourceStatus, SourceType } from './enums.js';

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  reference: string;
  status: SourceStatus;
  /**
   * Vinculo opcional al material registrado del que procede la pregunta
   * (SPEC 002). Cuando esta presente, una pregunta no puede validarse si ese
   * material esta `obsolete`.
   */
  material_id?: string | null;
  /** Fragmento concreto del material que respalda la pregunta (SPEC 002). */
  excerpt?: string | null;
}
