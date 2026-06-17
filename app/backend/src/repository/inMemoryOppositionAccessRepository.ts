import type { OppositionAccess } from '../models/oppositionAccess.js';
import type { OppositionAccessRepository } from './oppositionAccessRepository.js';

export class InMemoryOppositionAccessRepository
  implements OppositionAccessRepository
{
  private readonly access = new Map<string, OppositionAccess>();

  create(access: OppositionAccess): OppositionAccess {
    this.access.set(key(access.user_id, access.opposition_id), clone(access));
    return clone(access);
  }

  find(userId: string, oppositionId: string): OppositionAccess | null {
    const found = this.access.get(key(userId, oppositionId));
    return found ? clone(found) : null;
  }

  findByUser(userId: string): OppositionAccess[] {
    return [...this.access.values()]
      .filter((a) => a.user_id === userId)
      .map(clone);
  }

  findByOpposition(oppositionId: string): OppositionAccess[] {
    return [...this.access.values()]
      .filter((a) => a.opposition_id === oppositionId)
      .map(clone);
  }

  save(access: OppositionAccess): OppositionAccess {
    this.access.set(key(access.user_id, access.opposition_id), clone(access));
    return clone(access);
  }
}

function key(userId: string, oppositionId: string): string {
  return `${userId}::${oppositionId}`;
}

function clone(access: OppositionAccess): OppositionAccess {
  return structuredClone(access);
}
