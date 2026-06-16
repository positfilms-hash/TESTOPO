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
}
