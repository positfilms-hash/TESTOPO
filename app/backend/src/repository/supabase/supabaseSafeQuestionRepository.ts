// Repositorio Supabase de SOLO LECTURA y SANEADO del banco de preguntas
// (SPEC 029). Lee de las vistas seguras `safe_questions` / `safe_question_options`,
// que exponen unicamente preguntas `validated` accesibles y NO incluyen
// `correct_answer`, `explanation` ni `is_correct`.
//
// Se inyecta en el flujo de ALUMNO (generar/responder un test) para que el rol
// del alumno no lea la solucion por API directa. La correccion y la revision
// (que si necesitan el secreto) van por RPC SECURITY DEFINER, no por aqui.
//
// `create`/`save` no se usan en este flujo y lanzan si se invocan.

import type { Difficulty, QuestionStatus } from '../../models/enums.js';
import type { Question } from '../../models/question.js';
import type { Option } from '../../models/option.js';
import type { QuestionFilter, QuestionRepository } from '../questionRepository.js';
import type { SupabaseClientPort, SupabaseRow } from './supabaseClientPort.js';
import { parseDate } from './supabaseProfileRepository.js';

const SAFE_QUESTIONS = 'safe_questions';
const SAFE_OPTIONS = 'safe_question_options';

export class SupabaseSafeQuestionRepository implements QuestionRepository {
  constructor(private readonly port: SupabaseClientPort) {}

  async findAll(filter: QuestionFilter = {}): Promise<Question[]> {
    const [rows, optionRows] = await Promise.all([
      this.port.table(SAFE_QUESTIONS).selectAll(),
      this.port.table(SAFE_OPTIONS).selectAll(),
    ]);
    const byQuestion = groupOptions(optionRows);
    let result = rows.map((row) =>
      toSafeQuestion(row, byQuestion.get(String(row.id)) ?? []),
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
    const rows = await this.port.table(SAFE_QUESTIONS).selectMatch({ id });
    if (!rows[0]) {
      return null;
    }
    const optionRows = await this.port
      .table(SAFE_OPTIONS)
      .selectMatch({ question_id: id });
    return toSafeQuestion(rows[0], optionRows);
  }

  async create(): Promise<Question> {
    throw new Error('SupabaseSafeQuestionRepository es de solo lectura.');
  }

  async save(): Promise<Question> {
    throw new Error('SupabaseSafeQuestionRepository es de solo lectura.');
  }
}

// Mapea una fila saneada: SIN solucion. `correct_answer`/`explanation` quedan
// null y `is_correct` en false (la vista no los expone).
function toSafeQuestion(row: SupabaseRow, optionRows: SupabaseRow[]): Question {
  const options: Option[] = optionRows
    .map((o) => ({
      id: String(o.id),
      text: String(o.text ?? ''),
      is_correct: false,
      order: typeof o.order_index === 'number' ? o.order_index : 0,
    }))
    .sort((a, b) => a.order - b.order);
  return {
    id: String(row.id),
    opposition_id: String(row.opposition_id ?? ''),
    statement: String(row.statement ?? ''),
    options,
    correct_answer: null,
    explanation: null,
    source: null,
    topic: asNullableString(row.topic),
    topic_id: asNullableString(row.topic_id),
    difficulty: (row.difficulty as Difficulty | null) ?? null,
    status: (row.status as QuestionStatus) ?? 'validated',
    generation_metadata: null,
    material_section_id: null,
    source_reference_id: null,
    topic_source_reference_id: null,
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
