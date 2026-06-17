// Guardas de integridad por oposicion (SPEC 010, 17): toda entidad principal
// debe pertenecer a una oposicion y no se pueden mezclar entidades de
// oposiciones distintas.

import { AccessError } from './accessError.js';
import { AccessErrorCode } from './accessErrors.js';

export function requireOpposition(
  oppositionId: string | undefined | null,
): string {
  if (typeof oppositionId !== 'string' || oppositionId.trim() === '') {
    throw new AccessError([AccessErrorCode.OPPOSITION_REQUIRED]);
  }
  return oppositionId;
}

export function assertSameOpposition(a: string, b: string): void {
  if (a !== b) {
    throw new AccessError([AccessErrorCode.OPPOSITION_ENTITY_MISMATCH]);
  }
}
