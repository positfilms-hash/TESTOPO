import type { Opposition } from '../models/opposition.js';
import type { OppositionRepository } from './oppositionRepository.js';

export class InMemoryOppositionRepository implements OppositionRepository {
  private readonly oppositions = new Map<string, Opposition>();

  create(opposition: Opposition): Opposition {
    this.oppositions.set(opposition.id, clone(opposition));
    return clone(opposition);
  }

  findById(id: string): Opposition | null {
    const opposition = this.oppositions.get(id);
    return opposition ? clone(opposition) : null;
  }

  findBySlug(slug: string): Opposition | null {
    for (const opposition of this.oppositions.values()) {
      if (opposition.slug === slug) {
        return clone(opposition);
      }
    }
    return null;
  }

  findAll(): Opposition[] {
    return [...this.oppositions.values()].map(clone);
  }

  save(opposition: Opposition): Opposition {
    this.oppositions.set(opposition.id, clone(opposition));
    return clone(opposition);
  }
}

function clone(opposition: Opposition): Opposition {
  return structuredClone(opposition);
}
