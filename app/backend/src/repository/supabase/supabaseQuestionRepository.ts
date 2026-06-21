// Repositorio Supabase del banco de preguntas (SPEC 023). Implementa
// `QuestionRepository` repartiendo la pregunta en dos tablas:
//   - `questions`: campos escalares + `source`/`generation_metadata` como JSONB,
//   - `question_options`: una fila por opcion (con `is_correct` y `order_index`).
//
// `source` y `generation_metadata` se guardan como JSONB para no perder la
// estructura del dominio (el modelo es mas rico que columnas sueltas). El filtro
// (status/difficulty/topic) replica el del repo InMemory.

import type { Difficulty, QuestionStatus } from '../../models/enums.js';
import type { Question } from '../../models/question.js';
import type { Option } from '../../models/option.js';
import type { Source } from '../../models/source.js';
import type { GenerationMetadata } from '../../models/generationMetadata.js';
import type { QuestionFilter, QuestionRepository } from '../questionRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { iso, parseDate } from './supabaseProfileRepository.js';

const TABLE = 'questions';
const OPTIONS_TABLE = 'question_options';

export class SupabaseQuestionRepository implements QuestionRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async create(question: Question): Promise<Question> {
    await this.port.table(TABLE).insert(toRow(question));
    await this.writeOptions(question);
    return structuredCloneQuestion(question);
  }

  async findAll(filter: QuestionFilter = {}): Promise<Question[]> {
    const [rows, optionRows] = await Promise.all([
      this.port.table(TABLE).selectAll(),
      this.port.table(OPTIONS_TABLE).selectAll(),
    ]);
    const byQuestion = groupOptions(optionRows);
    let result = rows.map((row) =>
      toQuestion(row, byQuestion.get(String(row.id)) ?? []),
    );
    if (filter.status !== undefined) {
      result = result.filter((q) => q.status === filter.status);
    }
    if (filter.difficulty !== undefined) {
      result = result.filter((q) => q.difficulty === filter.difficulty);
    }
    if (filter.topic !== undefined) {
      result = result.filter((q) => q.topic === filter.topic);
    }
    return result;
  }

  async findById(id: string): Promise<Question | null> {
    const rows = await this.port.table(TABLE).selectMatch({ id });
    if (!rows[0]) {
      return null;
    }
    const optionRows = await this.port
      .table(OPTIONS_TABLE)
      .selectMatch({ question_id: id });
    return toQuestion(rows[0], optionRows);
  }

  async save(question: Question): Promise<Question> {
    const { id: _omit, created_at: _omitCreated, ...patch } = toRow(question);
    await this.port.table(TABLE).updateById(question.id, patch);
    // Reemplaza las opciones (borra e inserta) para reflejar el estado actual.
    await this.port.table(OPTIONS_TABLE).deleteMatch({ question_id: question.id });
    await this.writeOptions(question);
    return structuredCloneQuestion(question);
  }

  private async writeOptions(question: Question): Promise<void> {
    for (const option of question.options) {
      await this.port.table(OPTIONS_TABLE).insert({
        id: option.id,
        question_id: question.id,
        opposition_id: question.opposition_id,
        text: option.text,
        is_correct: option.is_correct,
        order_index: option.order,
      });
    }
  }
}

function toRow(q: Question): SupabaseRow {
  return {
    id: q.id,
    opposition_id: q.opposition_id,
    statement: q.statement,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    source: q.source,
    topic: q.topic,
    topic_id: q.topic_id ?? null,
    difficulty: q.difficulty,
    status: q.status,
    generation_metadata: q.generation_metadata ?? null,
    material_section_id: q.material_section_id ?? null,
    source_reference_id: q.source_reference_id ?? null,
    topic_source_reference_id: q.topic_source_reference_id ?? null,
    created_at: iso(q.created_at),
    updated_at: iso(q.updated_at),
  };
}

function toQuestion(row: SupabaseRow, optionRows: SupabaseRow[]): Question {
  const options: Option[] = optionRows
    .map((o) => ({
      id: String(o.id),
      text: String(o.text ?? ''),
      is_correct: o.is_correct === true,
      order: typeof o.order_index === 'number' ? o.order_index : 0,
    }))
    .sort((a, b) => a.order - b.order);
  return {
    id: String(row.id),
    opposition_id: String(row.opposition_id ?? ''),
    statement: String(row.statement ?? ''),
    options,
    correct_answer:
      typeof row.correct_answer === 'string' && row.correct_answer.length > 0
        ? row.correct_answer
        : null,
    explanation: asNullableString(row.explanation),
    source: (row.source as Source | null) ?? null,
    topic: asNullableString(row.topic),
    topic_id: asNullableString(row.topic_id),
    difficulty: (row.difficulty as Difficulty | null) ?? null,
    status: row.status as QuestionStatus,
    generation_metadata: (row.generation_metadata as GenerationMetadata | null) ?? null,
    material_section_id: asNullableString(row.material_section_id),
    source_reference_id: asNullableString(row.source_reference_id),
    topic_source_reference_id: asNullableString(row.topic_source_reference_id),
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
  };
}

function groupOptions(optionRows: SupabaseRow[]): Map<string, SupabaseRow[]> {
  const map = new Map<string, SupabaseRow[]>();
  for (const row of optionRows) {
    const qid = String(row.question_id ?? '');
    const list = map.get(qid) ?? [];
    list.push(row);
    map.set(qid, list);
  }
  return map;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function structuredCloneQuestion(question: Question): Question {
  return structuredClone(question);
}
