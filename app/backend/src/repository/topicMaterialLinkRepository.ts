// Contrato de persistencia de los vinculos material-tema (SPEC 003).

import type { TopicMaterialLink } from '../models/topicMaterialLink.js';

export interface TopicMaterialLinkFilter {
  topic_id?: string;
  material_id?: string;
}

export interface TopicMaterialLinkRepository {
  create(link: TopicMaterialLink): Promise<TopicMaterialLink>;
  findAll(filter?: TopicMaterialLinkFilter): Promise<TopicMaterialLink[]>;
  find(materialId: string, topicId: string): Promise<TopicMaterialLink | null>;
  delete(materialId: string, topicId: string): Promise<boolean>;
}
