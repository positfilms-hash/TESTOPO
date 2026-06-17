import type { Opposition } from '../models/opposition.js';

export interface OppositionRepository {
  create(opposition: Opposition): Promise<Opposition>;
  findById(id: string): Promise<Opposition | null>;
  findBySlug(slug: string): Promise<Opposition | null>;
  findAll(): Promise<Opposition[]>;
  save(opposition: Opposition): Promise<Opposition>;
}
