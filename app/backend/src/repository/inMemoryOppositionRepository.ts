import type { Opposition } from '../models/opposition.js';
import type { OppositionRepository } from './oppositionRepository.js';

export class InMemoryOppositionRepository implements OppositionRepository {
  private readonly oppositions = new Map<string, Opposition>();

  async create(opposition: Opposition): Promise<Opposition> {
    this.oppositions.set(opposition.id, clone(opposition));
    return clone(opposition);
  }

  async findById(id: string): Promise<Opposition | null> {
    const opposition = this.oppositions.get(id);
    return opposition ? clone(opposition) : null;
  }

  async findBySlug(slug: string): Promise<Opposition | null> {
    for (const opposition of this.oppositions.values()) {
      if (opposition.slug === slug) {
        return clone(opposition);
      }
    }
    return null;
  }

  async findAll(): Promise<Opposition[]> {
    return [...this.oppositions.values()].map(clone);
  }

  async save(opposition: Opposition): Promise<Opposition> {
    this.oppositions.set(opposition.id, clone(opposition));
    return clone(opposition);
  }
}

function clone(opposition: Opposition): Opposition {
  return structuredClone(opposition);
}
