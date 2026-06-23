// SPEC 033/034: tests de la logica DETERMINISTA del flujo real server-side que
// orquestan las Edge Functions. Sin red ni Supabase: cubre autorizacion de
// gestion explicita, resolucion de proveedor (OpenAI-only), elegibilidad de
// secciones, construccion de la peticion a OpenAI, parseo de salida y los
// constructores de filas de persistencia. Importa los MISMOS modulos _shared que
// usan las funciones Deno.

import { describe, it, expect } from 'vitest';
import { evaluateManagementAccess } from '../../../supabase/functions/_shared/authz/management';
import {
  QG_ERROR,
  resolveProvider,
  isEligiblePrimarySection,
  isSecondaryStyleSection,
  buildOpenAIRequest,
  parseProviderCandidates,
  buildQuestionRow,
  buildOptionRows,
  buildValidationRow,
  type ValidatedCandidate,
} from '../../../supabase/functions/_shared/question-generation/contract';

describe('evaluateManagementAccess (guarda explicita, no solo RLS)', () => {
  const owner = { role: 'owner', status: 'active' };
  it('permite owner/admin activos con perfil activo', () => {
    expect(evaluateManagementAccess({ profile: { status: 'active' }, membership: owner }).ok).toBe(true);
    expect(
      evaluateManagementAccess({ profile: { status: 'active' }, membership: { role: 'admin', status: 'active' } }).ok,
    ).toBe(true);
  });

  it('rechaza Student (access_denied)', () => {
    const r = evaluateManagementAccess({ profile: { status: 'active' }, membership: { role: 'student', status: 'active' } });
    expect(r).toEqual({ ok: false, reason: 'access_denied' });
  });

  it('rechaza membership revocada/pendiente o inexistente', () => {
    expect(evaluateManagementAccess({ profile: { status: 'active' }, membership: { role: 'owner', status: 'revoked' } }).ok).toBe(false);
    expect(evaluateManagementAccess({ profile: { status: 'active' }, membership: { role: 'admin', status: 'pending' } }).ok).toBe(false);
    expect(evaluateManagementAccess({ profile: { status: 'active' }, membership: null }).ok).toBe(false);
  });

  it('rechaza usuario eliminado/bloqueado/sin perfil (auth_required)', () => {
    expect(evaluateManagementAccess({ profile: { status: 'deleted' }, membership: owner })).toEqual({ ok: false, reason: 'auth_required' });
    expect(evaluateManagementAccess({ profile: { status: 'blocked' }, membership: owner })).toEqual({ ok: false, reason: 'auth_required' });
    expect(evaluateManagementAccess({ profile: null, membership: owner })).toEqual({ ok: false, reason: 'auth_required' });
  });
});

describe('resolveProvider (OpenAI-only; corrige el bug de Anthropic)', () => {
  it('null sin proveedor real; OpenAI con clave + modelo por defecto', () => {
    expect(resolveProvider({ AI_PROVIDER: 'openai', OPENAI_API_KEY: '' })).toBeNull();
    expect(resolveProvider({ AI_PROVIDER: 'anthropic', OPENAI_API_KEY: 'k' })).toBeNull();
    expect(resolveProvider({ AI_PROVIDER: 'mock', OPENAI_API_KEY: 'k' })).toBeNull();
    const r = resolveProvider({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x' });
    expect(r).toMatchObject({ provider: 'openai', apiKey: 'sk-x' });
    expect(r?.model).toBeTruthy();
  });
});

describe('elegibilidad de secciones (028-C)', () => {
  it('primaria solo study/legal/summary/index activas; old_exam = secundaria', () => {
    for (const c of ['study_content', 'legal_content', 'summary_content', 'index_content']) {
      expect(isEligiblePrimarySection({ classification: c, status: 'active' })).toBe(true);
      expect(isEligiblePrimarySection({ classification: c, status: 'obsolete' })).toBe(false);
    }
    expect(isEligiblePrimarySection({ classification: 'old_exam_content', status: 'active' })).toBe(false);
    expect(isSecondaryStyleSection('old_exam_content')).toBe(true);
    expect(isSecondaryStyleSection('study_content')).toBe(false);
  });
});

describe('buildOpenAIRequest (puro; solo IDs/excerpts del servidor)', () => {
  it('incluye system+user, json_schema y los punteros de fuente', () => {
    const body = buildOpenAIRequest({
      model: 'gpt-4o-mini',
      topic_title: 'Tema 1',
      difficulty: 'easy',
      question_count: 2,
      sources: [{ material_id: 'mat-1', material_section_id: 'sec-1', source_reference_id: null, excerpt: 'El plazo es de 10 dias.' }],
      style_note: null,
    }) as { messages: { role: string; content: string }[]; response_format: { type: string } };
    expect(body.response_format.type).toBe('json_schema');
    const sys = body.messages.find((m) => m.role === 'system')?.content ?? '';
    expect(sys).toContain('EXCLUSIVAMENTE');
    const user = body.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(user).toContain('material_id=mat-1');
    expect(user).toContain('material_section_id=sec-1');
    expect(user).toContain('El plazo es de 10 dias.');
  });
});

describe('parseProviderCandidates (puro)', () => {
  it('extrae candidates de un JSON valido', () => {
    const r = parseProviderCandidates(JSON.stringify({ candidates: [{ statement: 'x' }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.candidates).toHaveLength(1);
  });
  it('rechaza JSON invalido o sin array candidates', () => {
    expect(parseProviderCandidates('no-json')).toMatchObject({ ok: false, code: QG_ERROR.INVALID_OUTPUT });
    expect(parseProviderCandidates(JSON.stringify({ candidates: 'x' }))).toMatchObject({ ok: false });
    expect(parseProviderCandidates(null)).toMatchObject({ ok: false });
  });
});

describe('constructores de filas de persistencia (SPEC 023 + 028-E)', () => {
  const validated: ValidatedCandidate = {
    statement: '¿Plazo?',
    options: [
      { text: '10 dias', is_correct: true },
      { text: '5 dias', is_correct: false },
    ],
    explanation: 'Segun la evidencia.',
    difficulty: 'easy',
    topic_id: 'tp-1',
    material_id: 'mat-1',
    material_section_id: 'sec-1',
    source_reference_id: null,
    source_excerpt: 'El plazo es de 10 dias.',
    warnings: [],
  };

  it('buildQuestionRow: trazabilidad, IA, nunca validated', () => {
    const row = buildQuestionRow({
      id: 'q-1',
      workspace_id: 'ws-1',
      opposition_id: 'op-1',
      topic_id: 'tp-1',
      topic_title: 'Tema 1',
      candidate: validated,
      status: 'pending_review',
      run_id: 'run-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      now: '2026-06-23T00:00:00.000Z',
    });
    expect(row.status).toBe('pending_review');
    expect(['pending_review', 'needs_fix']).toContain(row.status);
    expect(row.correct_answer).toBe('10 dias');
    expect(row.material_section_id).toBe('sec-1');
    expect((row.generation_metadata as { generated_by_ai: boolean }).generated_by_ai).toBe(true);
    expect((row.generation_metadata as { generation_run_id: string }).generation_run_id).toBe('run-1');
    expect((row.source as { excerpt: string }).excerpt).toBe('El plazo es de 10 dias.');
  });

  it('buildOptionRows: orden + exactamente una correcta preservada', () => {
    const rows = buildOptionRows({ question_id: 'q-1', workspace_id: 'ws-1', opposition_id: 'op-1', candidate: validated });
    expect(rows).toHaveLength(2);
    expect(rows[0].order_index).toBe(0);
    expect(rows.filter((r) => r.is_correct)).toHaveLength(1);
  });

  it('buildValidationRow: passed; con needs_fix => passed_with_warnings', () => {
    expect(buildValidationRow({ question_id: 'q-1', workspace_id: 'ws-1', opposition_id: 'op-1', status: 'pending_review', warnings: [] })).toMatchObject({
      status: 'passed',
      passed: true,
      recommended_status: 'pending_review',
    });
    expect(buildValidationRow({ question_id: 'q-1', workspace_id: 'ws-1', opposition_id: 'op-1', status: 'needs_fix', warnings: ['w'] })).toMatchObject({
      status: 'passed_with_warnings',
      recommended_status: 'needs_fix',
    });
  });
});
