// Contrato de persistencia del registro de material (SPEC 002). La spec solo
// exige almacen en memoria, pero se define como interfaz para poder sustituirlo
// por una base de datos sin tocar el servicio.

import type { MaterialStatus, MaterialType } from '../models/enums.js';
import type { Material } from '../models/material.js';

export interface MaterialFilter {
  type?: MaterialType;
  status?: MaterialStatus;
  /** Filtra por oposicion (SPEC 010/012). */
  opposition_id?: string;
}

export interface MaterialRepository {
  create(material: Material): Promise<Material>;
  findAll(filter?: MaterialFilter): Promise<Material[]>;
  findById(id: string): Promise<Material | null>;
  save(material: Material): Promise<Material>;
}
