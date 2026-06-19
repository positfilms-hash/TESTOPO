// Implementacion InMemory de los repositorios de secciones y referencias
// (SPEC 028-C). Para tests y modo demo. Guarda copias para evitar aliasing.

import type { MaterialSection } from '../models/materialSection.js';
import type { SourceReference } from '../models/sourceReference.js';
import type {
  MaterialSectionRepository,
  SectionSearchInput,
} from './materialSectionRepository.js';
import type { SourceReferenceRepository } from './sourceReferenceRepository.js';

export class InMemoryMaterialSectionRepository
  implements MaterialSectionRepository
{
  private readonly sections = new Map<string, MaterialSection>();

  async create(section: MaterialSection): Promise<MaterialSection> {
    this.sections.set(section.id, { ...section });
    return { ...section };
  }

  async createMany(sections: MaterialSection[]): Promise<MaterialSection[]> {
    for (const section of sections) {
      this.sections.set(section.id, { ...section });
    }
    return sections.map((s) => ({ ...s }));
  }

  async findById(id: string): Promise<MaterialSection | null> {
    const section = this.sections.get(id);
    return section ? { ...section } : null;
  }

  async listByMaterial(materialId: string): Promise<MaterialSection[]> {
    return [...this.sections.values()]
      .filter((s) => s.material_id === materialId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((s) => ({ ...s }));
  }

  async deleteByMaterial(materialId: string): Promise<void> {
    for (const [id, section] of this.sections) {
      if (section.material_id === materialId) {
        this.sections.delete(id);
      }
    }
  }

  async search(input: SectionSearchInput): Promise<MaterialSection[]> {
    const terms = tokenize(input.query);
    const materialIds = input.material_ids ? new Set(input.material_ids) : null;
    const scored = [...this.sections.values()]
      .filter((s) => s.opposition_id === input.opposition_id)
      .filter((s) => (input.classification ? s.classification === input.classification : true))
      .filter((s) => (materialIds ? materialIds.has(s.material_id) : true))
      .map((s) => ({ section: s, score: matchScore(s, terms) }))
      .filter((x) => terms.length === 0 || x.score > 0)
      .sort((a, b) => b.score - a.score);
    const limit = input.limit ?? 20;
    return scored.slice(0, limit).map((x) => ({ ...x.section }));
  }
}

export class InMemorySourceReferenceRepository
  implements SourceReferenceRepository
{
  private readonly refs = new Map<string, SourceReference>();

  async create(reference: SourceReference): Promise<SourceReference> {
    this.refs.set(reference.id, { ...reference });
    return { ...reference };
  }

  async createMany(references: SourceReference[]): Promise<SourceReference[]> {
    for (const reference of references) {
      this.refs.set(reference.id, { ...reference });
    }
    return references.map((r) => ({ ...r }));
  }

  async findById(id: string): Promise<SourceReference | null> {
    const ref = this.refs.get(id);
    return ref ? { ...ref } : null;
  }

  async listByMaterial(materialId: string): Promise<SourceReference[]> {
    return [...this.refs.values()]
      .filter((r) => r.material_id === materialId)
      .map((r) => ({ ...r }));
  }

  async listBySection(sectionId: string): Promise<SourceReference[]> {
    return [...this.refs.values()]
      .filter((r) => r.material_section_id === sectionId)
      .map((r) => ({ ...r }));
  }
}

// Busqueda basica por coincidencia de palabras (SPEC 028-C, 22). Sin ranking
// semantico: cuenta cuantos terminos aparecen en titulo/texto/clasificacion.
function tokenize(query: string): string[] {
  return normalize(query)
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function matchScore(section: MaterialSection, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }
  const haystack = normalize(
    `${section.section_title} ${section.content_text} ${section.classification}`,
  );
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) {
      score += 1;
    }
  }
  return score;
}

function normalize(value: string): string {
  return Array.from(value.normalize('NFD'))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join('')
    .toLowerCase();
}
