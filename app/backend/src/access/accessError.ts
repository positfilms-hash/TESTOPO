// Error de usuarios/oposiciones/acceso e integridad por oposicion (SPEC 010).

import type { AccessErrorCode } from './accessErrors.js';

export class AccessError extends Error {
  readonly codes: AccessErrorCode[];

  constructor(codes: AccessErrorCode[]) {
    super(`Access/opposition operation failed: ${codes.join(', ')}`);
    this.name = 'AccessError';
    this.codes = codes;
  }
}
