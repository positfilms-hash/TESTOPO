// Implementacion en memoria del repositorio de temas (SPEC 003). Clona al
// entrar y salir para evitar mutaciones por referencia.

import type { Topic } from '../models/topic.js';
import type { TopicFilter, TopicRepository } from './topicRepository.js';

export class InMemoryTopicRepository implements TopicRepository {
  private readonly topics = new Map<string, Topic>();

  create(topic: Topic): Topic {
    this.topics.set(topic.id, clone(topic));
    return clone(topic);
  }

  findAll(filter: TopicFilter = {}): Topic[] {
    let result = [...this.topics.values()];
    if (filter.status !== undefined) {
      result = result.filter((topic) => topic.status === filter.status);
    }
    if (filter.parent_id !== undefined) {
      result = result.filter((topic) => topic.parent_id === filter.parent_id);
    }
    if (filter.search !== undefined && filter.search.trim() !== '') {
      const needle = filter.search.trim().toLowerCase();
      result = result.filter((topic) => {
        const haystack = `${topic.title} ${topic.code ?? ''}`.toLowerCase();
        return haystack.includes(needle);
      });
    }
    return result.map(clone);
  }

  findById(id: string): Topic | null {
    const topic = this.topics.get(id);
    return topic ? clone(topic) : null;
  }

  save(topic: Topic): Topic {
    if (!this.topics.has(topic.id)) {
      throw new Error(`Cannot save unknown topic: ${topic.id}`);
    }
    this.topics.set(topic.id, clone(topic));
    return clone(topic);
  }
}

function clone(topic: Topic): Topic {
  return structuredClone(topic);
}
