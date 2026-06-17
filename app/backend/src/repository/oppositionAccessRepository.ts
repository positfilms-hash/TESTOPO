import type { OppositionAccess } from '../models/oppositionAccess.js';

export interface OppositionAccessRepository {
  create(access: OppositionAccess): OppositionAccess;
  find(userId: string, oppositionId: string): OppositionAccess | null;
  findByUser(userId: string): OppositionAccess[];
  findByOpposition(oppositionId: string): OppositionAccess[];
  save(access: OppositionAccess): OppositionAccess;
}
