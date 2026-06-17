import type { OppositionAccess } from '../models/oppositionAccess.js';

export interface OppositionAccessRepository {
  create(access: OppositionAccess): Promise<OppositionAccess>;
  find(userId: string, oppositionId: string): Promise<OppositionAccess | null>;
  findByUser(userId: string): Promise<OppositionAccess[]>;
  findByOpposition(oppositionId: string): Promise<OppositionAccess[]>;
  save(access: OppositionAccess): Promise<OppositionAccess>;
}
