// SPEC 018.4-B - OpenAI como proveedor principal de generacion.
//
// Cubre los tests obligatorios de la spec (seccion 18): seleccion por factory,
// errores controlados, salida estructurada parseada, y que la generacion via
// OpenAI nunca produce preguntas `validated` y conserva la fuente.

import { describe, expect, it, vi } from 'vitest';
import { InMemoryMaterialRepository } from '../src/repository/inMemoryMaterialRepository.js';
import { InMemoryTopicRepository } from '../src/repository/inMemoryTopicRepository.js';
import { InMemoryQuestionRepository } from '../src/repository/inMemoryQuestionRepository.js';
import { MaterialService } from '../src/service/materialService.js';
import { TopicService } from '../src/service/topicService.js';
import { QuestionService } from '../src/service/questionService.js';
import { QuestionValidationService } from '../src/service/questionValidationService.js';
import { QuestionGenerationService } from '../src/service/questionGenerationService.js';
import { createQuestionGenerationProvider } from '../src/generation/createQuestionGenerationProvider.js';
import { OpenAiQuestionGenerationProvider } from '../src/generation/openAiQuestionGenerationProvider.js';
import { AnthropicQuestionGenerationProvider } from '../src/generation/anthropicQuestionGenerationProvider.js';
import { MockQuestionGenerationProvider } from '../src/generation/mockQuestionGenerationProvider.js';
import {
  AiProviderError,
  AiProviderErrorCode,
} from '../src/generation/aiProviderErrors.js';
import { TEST_OPPOSITION_ID } from './helpers.js';

// Respuesta tipo Chat Completions de OpenAI con contenido JSON.
function openAiResponse(content: string, overrides: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{ message: { content, refusal: null }, finish_reason: 'stop' }],
      };
    },
    async text() {
      return content;
    },
    ...overrides,
  } as unknown as Response;
}

function questionsJson(): string {
  return JSON.stringify({
    questions: [
      {
        statement: 'Pregunta OpenAI ficticia suficientemente larga',
        options: [
          { text: 'Correcta', is_correct: true },
          { text: 'Incorrecta A', is_correct: false },
          { text: 'Incorrecta B', is_correct: false },
        ],
        explanation: 'Explicacion suficientemente larga de la respuesta.',
        difficulty: 'medium',
        source_excerpt: 'Fragmento exacto citado por OpenAI',
        source_reference: 'Tema 1, apartado 2',
      },
    ],
  });
}

describe('SPEC 018.4-B - factory de proveedor', () => {
  it('AI_PROVIDER=openai selecciona OpenAiQuestionGenerationProvider', () => {
    const provider = createQuestionGenerationProvider({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(provider).toBeInstanceOf(OpenAiQuestionGenerationProvider);
    expect(provider.name).toBe('openai');
  });

  it('AI_PROVIDER=mock selecciona MockQuestionGenerationProvider', () => {
    const provider = createQuestionGenerationProvider({ AI_PROVIDER: 'mock' });
    expect(provider).toBeInstanceOf(MockQuestionGenerationProvider);
  });

  it('AI_PROVIDER=anthropic sigue siendo configurable', () => {
    const provider = createQuestionGenerationProvider({
      AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-anthropic',
    });
    expect(provider).toBeInstanceOf(AnthropicQuestionGenerationProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('sin OPENAI_API_KEY y AI_PROVIDER=openai falla con codigo claro', () => {
    try {
      createQuestionGenerationProvider({ AI_PROVIDER: 'openai' });
      throw new Error('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe(
        AiProviderErrorCode.OPENAI_API_KEY_MISSING,
      );
    }
  });

  it('proveedor no valido devuelve error controlado', () => {
    try {
      createQuestionGenerationProvider({ AI_PROVIDER: 'gemini' });
      throw new Error('deberia haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect((error as AiProviderError).code).toBe(
        AiProviderErrorCode.PROVIDER_INVALID,
      );
    }
  });
});

describe('SPEC 018.4-B - OpenAiQuestionGenerationProvider', () => {
  const context = {
    text: 'material ficticio',
    reference: null,
    difficulty: 'medium' as const,
    count: 1,
    topic_title: 'Tema 1',
    previous_feedback: [],
  };

  it('usa fetch con salida estructurada y parsea candidatos', async () => {
    let capturedBody = '';
    const fakeFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedBody = String(init?.body ?? '');
      return openAiResponse(questionsJson());
    });
    const provider = new OpenAiQuestionGenerationProvider({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    const candidates = await provider.generate(context);

    expect(fakeFetch).toHaveBeenCalledOnce();
    expect(provider.model).toBe('gpt-4o-mini');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].options.filter((o) => o.is_correct)).toHaveLength(1);
    expect(candidates[0].source_excerpt).toBe('Fragmento exacto citado por OpenAI');
    expect(capturedBody).toContain('json_schema');
    expect(capturedBody).toContain('response_format');
  });

  it('respuesta vacia -> OPENAI_EMPTY_RESPONSE', async () => {
    const provider = new OpenAiQuestionGenerationProvider({
      apiKey: 'sk-test',
      fetchImpl: (async () => openAiResponse('')) as unknown as typeof fetch,
    });
    await expect(provider.generate(context)).rejects.toMatchObject({
      code: AiProviderErrorCode.OPENAI_EMPTY_RESPONSE,
    });
  });

  it('respuesta no-ok -> OPENAI_GENERATION_FAILED', async () => {
    const provider = new OpenAiQuestionGenerationProvider({
      apiKey: 'sk-test',
      fetchImpl: (async () =>
        ({
          ok: false,
          status: 500,
          async text() {
            return 'server error';
          },
        }) as unknown as Response) as unknown as typeof fetch,
    });
    await expect(provider.generate(context)).rejects.toMatchObject({
      code: AiProviderErrorCode.OPENAI_GENERATION_FAILED,
    });
  });

  it('JSON invalido -> OPENAI_INVALID_RESPONSE', async () => {
    const provider = new OpenAiQuestionGenerationProvider({
      apiKey: 'sk-test',
      fetchImpl: (async () =>
        openAiResponse('esto no es json')) as unknown as typeof fetch,
    });
    await expect(provider.generate(context)).rejects.toMatchObject({
      code: AiProviderErrorCode.OPENAI_INVALID_RESPONSE,
    });
  });

  it('JSON sin array questions -> AI_OUTPUT_SCHEMA_INVALID', async () => {
    const provider = new OpenAiQuestionGenerationProvider({
      apiKey: 'sk-test',
      fetchImpl: (async () =>
        openAiResponse(JSON.stringify({ foo: 'bar' }))) as unknown as typeof fetch,
    });
    await expect(provider.generate(context)).rejects.toMatchObject({
      code: AiProviderErrorCode.AI_OUTPUT_SCHEMA_INVALID,
    });
  });

  it('questions vacio es valido (la IA puede no generar) -> [] sin error', async () => {
    const provider = new OpenAiQuestionGenerationProvider({
      apiKey: 'sk-test',
      fetchImpl: (async () =>
        openAiResponse(JSON.stringify({ questions: [] }))) as unknown as typeof fetch,
    });
    await expect(provider.generate(context)).resolves.toEqual([]);
  });

  it('construir sin clave -> OPENAI_API_KEY_MISSING', () => {
    expect(() => new OpenAiQuestionGenerationProvider({ apiKey: '' })).toThrow(
      AiProviderError,
    );
  });
});

describe('SPEC 018.4-B - generacion via OpenAI (integracion)', () => {
  it('genera pending_review (nunca validated) y conserva la fuente', async () => {
    const materialRepository = new InMemoryMaterialRepository();
    const topicRepository = new InMemoryTopicRepository();
    const questionRepository = new InMemoryQuestionRepository();
    const materials = new MaterialService(materialRepository);
    const topics = new TopicService(topicRepository, { materialRepository });
    const questions = new QuestionService(questionRepository, {
      resolveMaterialStatus: async (id) =>
        (await materials.getMaterial(id))?.status ?? null,
      resolveTopicStatus: async (id) =>
        (await topics.getTopic(id))?.status ?? null,
    });
    const validation = new QuestionValidationService({
      questionService: questions,
      materialRepository,
      topicRepository,
    });
    const provider = new OpenAiQuestionGenerationProvider({
      apiKey: 'sk-test',
      fetchImpl: (async () =>
        openAiResponse(questionsJson())) as unknown as typeof fetch,
    });
    const generation = new QuestionGenerationService({
      questionService: questions,
      materialRepository,
      topicRepository,
      validationService: validation,
      provider,
    });

    const material = await materials.createMaterial({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1 - Documento ficticio',
      type: 'syllabus',
      content_text: 'Texto ficticio del tema 1.',
    });
    const topic = await topics.createTopic({
      opposition_id: TEST_OPPOSITION_ID,
      title: 'Tema 1',
    });

    const { run, questions: created } = await generation.generateFromMaterial({
      material_id: material.id,
      topic_id: topic.id,
      difficulty: 'medium',
      question_count: 1,
    });

    expect(run.provider).toBe('openai');
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe('pending_review');
    expect(created[0].status).not.toBe('validated');
    expect(created[0].source?.excerpt).toBe('Fragmento exacto citado por OpenAI');
  });
});
