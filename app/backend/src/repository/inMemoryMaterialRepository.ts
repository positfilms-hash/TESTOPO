// Implementacion en memoria del repositorio de material (SPEC 002). Clona los
// materiales al entrar y salir para que el estado interno no pueda mutarse por
// referencia desde fuera.

import type { Material } from '../models/material.js';
import type {
  MaterialFilter,
  MaterialRepository,
} from './materialRepository.js';

export class InMemoryMaterialRepository implements MaterialRepository {
  private readonly materials = new Map<string, Material>();

  async create(material: Material): Promise<Material> {
    this.materials.set(material.id, clone(material));
    return clone(material);
  }

  async findAll(filter: MaterialFilter = {}): Promise<Material[]> {
    let result = [...this.materials.values()];
    if (filter.type !== undefined) {
      result = result.filter((material) => material.type === filter.type);
    }
    if (filter.status !== undefined) {
      result = result.filter((material) => material.status === filter.status);
    }
    if (filter.opposition_id !== undefined) {
      result = result.filter(
        (material) => material.opposition_id === filter.opposition_id,
      );
    }
    return result.map(clone);
  }

  async findById(id: string): Promise<Material | null> {
    const material = this.materials.get(id);
    return material ? clone(material) : null;
  }

  async save(material: Material): Promise<Material> {
    if (!this.materials.has(material.id)) {
      throw new Error(`Cannot save unknown material: ${material.id}`);
    }
    this.materials.set(material.id, clone(material));
    return clone(material);
  }

  async delete(id: string): Promise<void> {
    this.materials.delete(id);
  }
}

function clone(material: Material): Material {
  return structuredClone(material);
}
