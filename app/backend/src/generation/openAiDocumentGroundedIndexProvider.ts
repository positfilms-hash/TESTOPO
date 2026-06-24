// Proveedor de indice anclado a documentos basado en OpenAI (SPEC 028-D). Llama a
// Chat Completions por HTTP pidiendo JSON estructurado con temas/subtemas y sus
// FUENTES (material/secciones/referencias). SOLO organiza evidencia: no escribe
// temario, no inventa temas, no genera preguntas ni tests. La clave nunca se
// hardcodea. El servicio valida la salida antes de persistir.

import {
  SyllabusIndexError,
  SyllabusIndexErrorCode,
} from '../syllabus/syllabusIndexErrors.js';
import type {
  DocumentGroundedIndexProvider,
  GroundedIndexOutput,
  GroundedIndexProviderInput,
  GroundedNodeSources,
  GroundedTopicNode,
} from './documentGroundedIndexTypes.js';

export const DEFAULT_GROUNDED_OPENAI_MODEL = 'gpt-4o-mini';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export interface OpenAiGroundedProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

export class OpenAiDocumentGroundedIndexProvider
  implements DocumentGroundedIndexProvider
{
  readonly name = 'openai';
  readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxTokens: number;

  constructor(options: OpenAiGroundedProviderOptions) {
    if (!isNonEmptyString(options.apiKey)) {
      throw new SyllabusIndexError([
        SyllabusIndexErrorCode.PROVIDER_NOT_CONFIGURED,
      ]);
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_GROUNDED_OPENAI_MODEL;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.maxTokens = options.maxTokens ?? 8000;
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('No hay implementacion de fetch disponible');
    }
  }

  async proposeIndex(
    input: GroundedIndexProviderInput,
  ): Promise<GroundedIndexOutput> {
    let response: Response;
    try {
      response = await this.fetchImpl(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_completion_tokens: this.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(input) },
          ],
        }),
      });
    } catch (error) {
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.GENERATION_FAILED],
        `Fallo al llamar a OpenAI: ${String(error)}`,
      );
    }

    if (!response.ok) {
      throw new SyllabusIndexError(
        [SyllabusIndexErrorCode.GENERATION_FAILED],
        `Error de la API de OpenAI (${response.status})`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!isNonEmptyString(content)) {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.INVALID_OUTPUT]);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new SyllabusIndexError([SyllabusIndexErrorCode.INVALID_OUTPUT]);
    }
    return mapOutput(parsed, this.name, this.model);
  }
}

function mapOutput(
  raw: unknown,
  provider: string,
  model: string | null,
): GroundedIndexOutput {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    title: asString(obj.title) ?? 'Indice de temario propuesto',
    summary: asString(obj.summary) ?? '',
    topics: Array.isArray(obj.topics) ? obj.topics.map(mapNode) : [],
    warnings: asStringArray(obj.warnings),
    provider,
    model,
  };
}

function mapNode(raw: unknown): GroundedTopicNode {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    title: asString(obj.title) ?? '',
    description: asString(obj.description),
    order: typeof obj.order === 'number' ? obj.order : 0,
    confidence: typeof obj.confidence === 'number' ? obj.confidence : null,
    warnings: asStringArray(obj.warnings),
    children: Array.isArray(obj.children) ? obj.children.map(mapNode) : [],
    sources: Array.isArray(obj.sources) ? obj.sources.map(mapSource) : [],
  };
}

function mapSource(raw: unknown): GroundedNodeSources {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    material_id: asString(obj.material_id) ?? '',
    section_ids: asStringArray(obj.section_ids),
    reference_ids: asStringArray(obj.reference_ids),
  };
}

function buildSystemPrompt(): string {
  return [
    'Eres un asistente que ORGANIZA evidencia documental en un indice de temas.',
    'Recibes documentos clasificados con sus secciones (id, titulo, extracto).',
    'Propon temas y subtemas, cada uno con sus FUENTES concretas (material_id y',
    'section_ids reales de la entrada). Reglas obligatorias:',
    '- Es un INDICE COMPACTO de BLOQUES DE ESTUDIO, NO una transcripcion del PDF.',
    '- Objetivo 5-15 temas raiz (TOPE DURO 20). Profundidad 1-2 niveles normal;',
    '  un tercer nivel solo si aporta valor de estudio.',
    '- NUNCA un nodo por articulo/pagina/epigrafe/disposicion. Agrupa articulos y',
    '  epigrafes relacionados bajo bloques logicos con titulo semantico conciso',
    '  (p. ej. "Derechos y deberes fundamentales"). Los articulos son evidencia,',
    '  no titulos de tema.',
    '- Usa solo los ids proporcionados; no inventes ids ni temas sin fuente.',
    '- Cada tema raiz necesita al menos una fuente primaria.',
    '- Los examenes antiguos son SOLO contexto secundario (cobertura/estilo), no',
    '  fuente unica de un tema.',
    '- No escribas contenido de temario, ni preguntas, ni opciones, ni tests, ni',
    '  notas largas ni texto copiado.',
    'Devuelve JSON con: title, summary, topics (arbol con title, description (1',
    'linea), order, confidence 0..1, warnings, children, sources:[{material_id,',
    'section_ids, reference_ids}]), warnings.',
  ].join('\n');
}

function buildUserPrompt(input: GroundedIndexProviderInput): string {
  const parts: string[] = [];
  if (isNonEmptyString(input.opposition_title)) {
    parts.push(`Oposicion: ${input.opposition_title}.`);
  }
  parts.push(`Maximo de temas: ${input.max_topics}. Profundidad maxima: ${input.max_depth}.`);
  parts.push('Documentos:');
  for (const doc of input.documents) {
    parts.push(
      `--- material_id=${doc.material_id} | ${doc.classification} | ${
        doc.is_primary ? 'PRIMARIO' : 'SECUNDARIO'
      } | ${doc.title}`,
    );
    for (const section of doc.sections) {
      parts.push(`  section_id=${section.section_id} | ${section.title}: ${section.excerpt}`);
    }
  }
  return parts.join('\n');
}

function asString(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => isNonEmptyString(v));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
