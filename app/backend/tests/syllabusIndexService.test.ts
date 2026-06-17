// SPEC 019 - AI Syllabus Index Builder.
//
// La IA SOLO propone: el indice no se aplica sin aprobacion humana, no se
// generan preguntas, y al aplicar se crean/reutilizan temas sin duplicar ni
// borrar los existentes. Mock provider sin API externa.

import { describe, expect, it } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryTopicMaterialLinkRepository } from '../src/repository/inMemoryTopicMaterialLinkRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { InMemorySyllabusIndexRepository } from '../src/repository/inMemorySyllabusIndexRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { SyllabusIndexService } from '../src/service/syllabusIndexService.js';
import { SyllabusIndexErrorCode } from '../src/syllabus/syllabusIndexErrors.js';
import type { MaterialType } from '../src/models/enums.js';
import type {
  SyllabusIndexOutput,
  SyllabusIndexProvider,
} from '../src/generation/syllabusIndexTypes.js';

const OPP = 'opp-syllabus';

interface Repos {
  materialRepo: InMemoryMaterialRepository;
  linkRepo: InMemoryTopicMaterialLinkRepository;
  materials: MaterialService;
  topics: TopicService;
  questions: QuestionService;
}

function makeRepos(): Repos {
  const materialRepo = new InMemoryMaterialRepository();
  const topicRepo = new InMemoryTopicRepository();
  const linkRepo = new InMemoryTopicMaterialLinkRepository();
  const materials = new MaterialService(materialRepo);
  const topics = new TopicService(topicRepo, {
    materialRepository: materialRepo,
    linkRepository: linkRepo,
  });
  const questions = new QuestionService(new InMemoryQuestionRepository());
  return { materialRepo, linkRepo, materials, topics, questions };
}

function makeSyllabus(r: Repos, provider?: SyllabusIndexProvider) {
  return new SyllabusIndexService({
    materialRepository: r.materialRepo,
    topicService: r.topics,
    topicMaterialLinks: r.linkRepo,
    repository: new InMemorySyllabusIndexRepository(),
    provider,
  });
}

function makeMaterial(
  materials: MaterialService,
  overrides: { title?: string; type?: MaterialType; content_text?: string | null } = {},
) {
  return materials.createMaterial({
    opposition_id: OPP,
    title: overrides.title ?? 'Material ficticio',
    type: overrides.type ?? 'syllabus',
    content_text:
      overrides.content_text === undefined
        ? 'Texto ficticio del material.'
        : overrides.content_text,
  });
}

// Proveedor que devuelve un arbol fijo (para probar la aplicacion al Topic Map).
function treeProvider(
  rootMaterialId: string,
  childMaterialId: string,
): SyllabusIndexProvider {
  return {
    name: 'stub',
    model: null,
    async proposeIndex(): Promise<SyllabusIndexOutput> {
      return {
        title: 'Indice ficticio',
        summary: 'resumen',
        topics: [
          {
            title: 'Bloque 1',
            order: 0,
            source_material_ids: [rootMaterialId],
            children: [
              {
                title: 'Subtema 1.1',
                order: 0,
                source_material_ids: [childMaterialId],
                children: [],
              },
            ],
          },
        ],
        unclassified_material_ids: [],
        exam_patterns: [],
        warnings: [],
        provider: 'stub',
        model: null,
      };
    },
  };
}

describe('SPEC 019 - proponer indice', () => {
  it('crea run, propuesta, nodos, sugerencias y patrones; detecta sin clasificar', async () => {
    const r = makeRepos();
    const syllabus = makeSyllabus(r);
    await makeMaterial(r.materials, { title: 'Temario', type: 'syllabus' });
    await makeMaterial(r.materials, { title: 'Misc', type: 'other' });
    await makeMaterial(r.materials, { title: 'Examen 2020', type: 'old_test' });
    await makeMaterial(r.materials, { title: 'PDF sin texto', type: 'notes', content_text: null });

    const detail = await syllabus.proposeIndex({ opposition_id: OPP });

    expect(detail.run?.total_materials).toBe(4);
    expect(detail.run?.analyzed_materials).toBe(3);
    expect(detail.run?.ignored_materials).toBe(1);
    expect(detail.proposal.status).toBe('pending_review');
    // 'syllabus' -> tema; 'other' -> sin clasificar; 'old_test' -> patron examen.
    expect(detail.nodes).toHaveLength(1);
    expect(detail.exam_patterns).toHaveLength(1);
    const unclassified = detail.suggestions.filter((x) => x.status === 'unclassified');
    expect(unclassified.length).toBeGreaterThanOrEqual(2); // 'other' + PDF sin texto
    const suggested = detail.suggestions.filter((x) => x.status === 'suggested');
    expect(suggested.length).toBeGreaterThanOrEqual(1);
  });

  it('no genera preguntas en esta spec', async () => {
    const r = makeRepos();
    const syllabus = makeSyllabus(r);
    await makeMaterial(r.materials, { type: 'syllabus' });
    await syllabus.proposeIndex({ opposition_id: OPP });
    expect(await r.questions.listQuestions()).toHaveLength(0);
  });

  it('falla sin materiales (NO_MATERIALS)', async () => {
    const r = makeRepos();
    const syllabus = makeSyllabus(r);
    await expect(syllabus.proposeIndex({ opposition_id: OPP })).rejects.toMatchObject({
      codes: expect.arrayContaining([SyllabusIndexErrorCode.NO_MATERIALS]),
    });
  });

  it('falla si ningun material tiene texto extraido (NO_EXTRACTED_TEXT)', async () => {
    const r = makeRepos();
    const syllabus = makeSyllabus(r);
    await makeMaterial(r.materials, { type: 'notes', content_text: null });
    await expect(syllabus.proposeIndex({ opposition_id: OPP })).rejects.toMatchObject({
      codes: expect.arrayContaining([SyllabusIndexErrorCode.NO_EXTRACTED_TEXT]),
    });
  });

  it('rechaza salida IA invalida (INVALID_OUTPUT)', async () => {
    const badProvider: SyllabusIndexProvider = {
      name: 'stub',
      model: null,
      async proposeIndex() {
        return {
          title: 'x',
          summary: '',
          topics: 'no-es-array',
          provider: 'stub',
          model: null,
        } as unknown as SyllabusIndexOutput;
      },
    };
    const r = makeRepos();
    const syllabus = makeSyllabus(r, badProvider);
    await makeMaterial(r.materials, { type: 'syllabus' });
    await expect(syllabus.proposeIndex({ opposition_id: OPP })).rejects.toMatchObject({
      codes: expect.arrayContaining([SyllabusIndexErrorCode.INVALID_OUTPUT]),
    });
  });
});

describe('SPEC 019 - aprobar y aplicar', () => {
  it('no se aplica sin aprobacion (APPROVAL_REQUIRED)', async () => {
    const r = makeRepos();
    const syllabus = makeSyllabus(r);
    await makeMaterial(r.materials, { type: 'syllabus' });
    const detail = await syllabus.proposeIndex({ opposition_id: OPP });
    await expect(syllabus.applyProposal(detail.proposal.id)).rejects.toMatchObject({
      codes: expect.arrayContaining([SyllabusIndexErrorCode.APPROVAL_REQUIRED]),
    });
  });

  it('aprobar y aplicar crea temas y subtemas y asocia materiales', async () => {
    const r = makeRepos();
    const a = await makeMaterial(r.materials, { title: 'A', type: 'syllabus' });
    const b = await makeMaterial(r.materials, { title: 'B', type: 'syllabus' });
    const syllabus = makeSyllabus(r, treeProvider(a.id, b.id));

    const detail = await syllabus.proposeIndex({ opposition_id: OPP });
    expect(detail.nodes).toHaveLength(2);

    await syllabus.approveProposal(detail.proposal.id, 'admin-1');
    const result = await syllabus.applyProposal(detail.proposal.id);

    expect(result.proposal.status).toBe('applied');
    expect(result.created_topic_ids).toHaveLength(2);

    const tree = await r.topics.getTopicTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Bloque 1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].title).toBe('Subtema 1.1');

    const rootLinks = await r.topics.listMaterialsForTopic(tree[0].id);
    expect(rootLinks.map((l) => l.material_id)).toContain(a.id);
    const childLinks = await r.topics.listMaterialsForTopic(tree[0].children[0].id);
    expect(childLinks.map((l) => l.material_id)).toContain(b.id);
  });

  it('no duplica temas con mismo titulo bajo mismo padre ni borra los existentes', async () => {
    const r = makeRepos();
    const a = await makeMaterial(r.materials, { title: 'A', type: 'syllabus' });
    const b = await makeMaterial(r.materials, { title: 'B', type: 'syllabus' });
    const syllabus = makeSyllabus(r, treeProvider(a.id, b.id));

    const existing = await r.topics.createTopic({ opposition_id: OPP, title: 'Bloque 1' });
    await r.topics.createTopic({ opposition_id: OPP, title: 'Tema ajeno' });

    const detail = await syllabus.proposeIndex({ opposition_id: OPP });
    await syllabus.approveProposal(detail.proposal.id, null);
    const result = await syllabus.applyProposal(detail.proposal.id);

    expect(result.reused_topic_ids).toContain(existing.id);
    const all = await r.topics.listTopics();
    expect(all.filter((t) => t.title === 'Bloque 1')).toHaveLength(1);
    expect(all.some((t) => t.title === 'Tema ajeno')).toBe(true);
  });
});
