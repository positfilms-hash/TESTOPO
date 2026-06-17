import type { Opposition } from '../models/opposition.js';

export interface OppositionRepository {
  create(opposition: Opposition): Opposition;
  findById(id: string): Opposition | null;
  findBySlug(slug: string): Opposition | null;
  findAll(): Opposition[];
  save(opposition: Opposition): Opposition;
}
