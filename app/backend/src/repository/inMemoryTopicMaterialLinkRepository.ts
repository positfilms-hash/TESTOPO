// Implementacion en memoria de los vinculos material-tema (SPEC 003).
// La clave de unicidad es la pareja (material_id, topic_id).

import type { TopicMaterialLink } from '../models/topicMaterialLink.js';
import type {
  TopicMaterialLinkFilter,
  TopicMaterialLinkRepository,
} from './topicMaterialLinkRepository.js';

export class InMemoryTopicMaterialLinkRepository
  implements TopicMaterialLinkRepository
{
  private readonly links = new Map<string, TopicMaterialLink>();

  create(link: TopicMaterialLink): TopicMaterialLink {
    this.links.set(key(link.material_id, link.topic_id), clone(link));
    return clone(link);
  }

  findAll(filter: TopicMaterialLinkFilter = {}): TopicMaterialLink[] {
    let result = [...this.links.values()];
    if (filter.topic_id !== undefined) {
      result = result.filter((link) => link.topic_id === filter.topic_id);
    }
    if (filter.material_id !== undefined) {
      result = result.filter(
        (link) => link.material_id === filter.material_id,
      );
    }
    return result.map(clone);
  }

  find(materialId: string, topicId: string): TopicMaterialLink | null {
    const link = this.links.get(key(materialId, topicId));
    return link ? clone(link) : null;
  }

  delete(materialId: string, topicId: string): boolean {
    return this.links.delete(key(materialId, topicId));
  }
}

function key(materialId: string, topicId: string): string {
  return `${materialId}::${topicId}`;
}

function clone(link: TopicMaterialLink): TopicMaterialLink {
  return structuredClone(link);
}
