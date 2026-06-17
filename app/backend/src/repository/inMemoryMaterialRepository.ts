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

  create(material: Material): Material {
    this.materials.set(material.id, clone(material));
    return clone(material);
  }

  findAll(filter: MaterialFilter = {}): Material[] {
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

  findById(id: string): Material | null {
    const material = this.materials.get(id);
    return material ? clone(material) : null;
  }

  save(material: Material): Material {
    if (!this.materials.has(material.id)) {
      throw new Error(`Cannot save unknown material: ${material.id}`);
    }
    this.materials.set(material.id, clone(material));
    return clone(material);
  }
}

function clone(material: Material): Material {
  return structuredClone(material);
}
