// Biblioteca de material (SPEC 029): abrir el original de forma segura y borrado
// con TRAZABILIDAD. El control de acceso lo aplica el facade (owner/admin).
//
// - `getFile`: devuelve una URL firmada de corta duracion (Supabase) o los bytes
//   (memoria) para previsualizar el PDF. NUNCA expone `storage_path`.
// - `deleteMaterial`: si el material esta REFERENCIADO (temas, preguntas o
//   referencias de fuente) BLOQUEA el borrado (debe archivarse en su lugar). Si
//   no, borra registro + derivados internos + bytes. Nunca rompe en silencio una
//   fuente factual.

import type { Material } from '../models/material.js';
import type { MaterialRepository } from '../repository/materialRepository.js';
import type { TopicMaterialLinkRepository } from '../repository/topicMaterialLinkRepository.js';
import type { MaterialSectionRepository } from '../repository/materialSectionRepository.js';
import type { SourceReferenceRepository } from '../repository/sourceReferenceRepository.js';
import type { FileStorage } from '../storage/fileStorage.js';
import type { QuestionService } from './questionService.js';

export interface MaterialFileView {
  material_id: string;
  filename: string | null;
  mime_type: string | null;
  /** URL firmada de corta duracion (Supabase); null en memoria. */
  signed_url: string | null;
  /** Bytes del original cuando no hay URL firmada (memoria/demo). */
  bytes: Uint8Array | null;
}

export class MaterialReferencedError extends Error {
  constructor(public readonly reasons: string[]) {
    super(
      `No se puede eliminar el material: está en uso (${reasons.join(', ')}). Archívalo en su lugar.`,
    );
    this.name = 'MaterialReferencedError';
  }
}

export interface MaterialLibraryServiceDeps {
  materials: MaterialRepository;
  storage: FileStorage;
  topicMaterialLinks: TopicMaterialLinkRepository;
  sections: MaterialSectionRepository;
  sourceReferences: SourceReferenceRepository;
  questions: QuestionService;
}

export class MaterialLibraryService {
  constructor(private readonly deps: MaterialLibraryServiceDeps) {}

  async getFile(materialId: string): Promise<MaterialFileView> {
    const material = await this.requireMaterial(materialId);
    if (!material.storage_path) {
      throw new Error('El material no tiene archivo asociado.');
    }
    const signedUrl = await this.deps.storage.getSignedUrl(
      material.storage_path,
    );
    const bytes = signedUrl
      ? null
      : await this.deps.storage.read(material.storage_path);
    return {
      material_id: material.id,
      filename: material.original_filename,
      mime_type: material.mime_type,
      signed_url: signedUrl,
      bytes,
    };
  }

  // Comprueba si el material se usa como fuente factual (no se debe borrar).
  async findReferences(materialId: string): Promise<string[]> {
    const reasons: string[] = [];
    const links = await this.deps.topicMaterialLinks.findAll({
      material_id: materialId,
    });
    if (links.length > 0) {
      reasons.push('temas');
    }
    const refs = await this.deps.sourceReferences.listByMaterial(materialId);
    if (refs.length > 0) {
      reasons.push('referencias de fuente');
    }
    const questions = await this.deps.questions.listQuestions();
    if (questions.some((q) => q.source?.material_id === materialId)) {
      reasons.push('preguntas');
    }
    return reasons;
  }

  async deleteMaterial(materialId: string): Promise<void> {
    const material = await this.requireMaterial(materialId);
    const reasons = await this.findReferences(materialId);
    if (reasons.length > 0) {
      throw new MaterialReferencedError(reasons);
    }
    // No referenciado: limpia derivados internos + bytes + registro.
    await this.deps.sections.deleteByMaterial(materialId);
    if (material.storage_path) {
      await this.deps.storage.remove(material.storage_path);
    }
    await this.deps.materials.delete(materialId);
  }

  private async requireMaterial(materialId: string): Promise<Material> {
    const material = await this.deps.materials.findById(materialId);
    if (!material) {
      throw new Error('Material no encontrado.');
    }
    return material;
  }
}
