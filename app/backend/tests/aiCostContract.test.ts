// Tracking de coste de IA por run (SPEC 038/039): tests del contrato COMPARTIDO
// `_shared/ai-cost/contract.ts`. Logica pura, sin red. Importa el MISMO modulo que
// las Edge Functions generate-questions-from-studied-material y study-material.

import { describe, it, expect } from 'vitest';
import {
  parseOpenAIUsage,
  addUsage,
  EMPTY_USAGE,
  resolvePrice,
  DEFAULT_PRICES,
  FALLBACK_PRICE,
  estimateCostUsd,
  costPerQuestion,
  buildCostBreakdown,
  resolveCostLimits,
  estimateRunCostUsd,
  evaluateBudget,
  MAX_QUESTIONS_PER_RUN,
  MAX_COST_PER_RUN_USD,
  MAX_DAILY_COST_USD,
} from '../../../supabase/functions/_shared/ai-cost/contract';

describe('parseOpenAIUsage', () => {
  it('lee Chat Completions (prompt/completion/total) y Responses (input/output)', () => {
    expect(parseOpenAIUsage({ prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 })).toEqual({
      input_tokens: 100,
      output_tokens: 40,
      total_tokens: 140,
    });
    expect(parseOpenAIUsage({ input_tokens: 10, output_tokens: 5 })).toEqual({
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15, // derivado si falta total
    });
    expect(parseOpenAIUsage(null)).toEqual(EMPTY_USAGE);
    expect(parseOpenAIUsage({ prompt_tokens: -1 })).toEqual(EMPTY_USAGE); // negativos -> 0
  });
  it('addUsage suma componentes', () => {
    expect(addUsage({ input_tokens: 1, output_tokens: 2, total_tokens: 3 }, { input_tokens: 10, output_tokens: 20, total_tokens: 30 })).toEqual({
      input_tokens: 11,
      output_tokens: 22,
      total_tokens: 33,
    });
  });
});

describe('resolvePrice', () => {
  it('env override > tabla > fallback; cost_model auditable', () => {
    expect(resolvePrice('gpt-4o-mini', { AI_PRICE_INPUT_PER_M: '0.2', AI_PRICE_OUTPUT_PER_M: '0.8' })).toMatchObject({
      input_per_m: 0.2,
      output_per_m: 0.8,
      cost_model: 'gpt-4o-mini@env',
    });
    expect(resolvePrice('gpt-4o-mini', {})).toMatchObject({ ...DEFAULT_PRICES['gpt-4o-mini'], cost_model: 'gpt-4o-mini@table' });
    expect(resolvePrice('modelo-desconocido', {})).toMatchObject({ ...FALLBACK_PRICE, cost_model: 'default-gpt-4o-mini@fallback' });
  });
});

describe('coste estimado y por pregunta', () => {
  it('estimateCostUsd usa precios por 1M tokens', () => {
    const price = DEFAULT_PRICES['gpt-4o-mini']; // 0.15 / 0.60
    expect(estimateCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000, total_tokens: 2_000_000 }, price)).toBe(0.75);
    expect(estimateCostUsd({ input_tokens: 500_000, output_tokens: 0, total_tokens: 500_000 }, price)).toBe(0.075);
  });
  it('costPerQuestion: divide; created_count 0 -> null', () => {
    expect(costPerQuestion(0.75, 5)).toBe(0.15);
    expect(costPerQuestion(0.75, 0)).toBeNull();
  });
  it('buildCostBreakdown agrega tokens + coste + cost_model', () => {
    const price = resolvePrice('gpt-4o-mini', {});
    const b = buildCostBreakdown({ input_tokens: 1000, output_tokens: 900, total_tokens: 1900 }, price);
    expect(b).toMatchObject({ input_tokens: 1000, output_tokens: 900, total_tokens: 1900, cost_model: 'gpt-4o-mini@table' });
    expect(b.estimated_cost_usd).toBeGreaterThan(0);
  });
});

describe('limites de coste/cantidad', () => {
  it('defaults; un secreto SOLO reduce (nunca supera el maximo)', () => {
    expect(resolveCostLimits({})).toEqual({
      maxQuestionsPerRun: MAX_QUESTIONS_PER_RUN,
      maxCostPerRunUsd: MAX_COST_PER_RUN_USD,
      maxDailyCostUsd: MAX_DAILY_COST_USD,
    });
    expect(resolveCostLimits({ MAX_QUESTIONS_PER_RUN: '5', MAX_COST_PER_RUN_USD: '0.1', MAX_DAILY_COST_USD: '1' })).toEqual({
      maxQuestionsPerRun: 5,
      maxCostPerRunUsd: 0.1,
      maxDailyCostUsd: 1,
    });
    const over = resolveCostLimits({ MAX_QUESTIONS_PER_RUN: '999', MAX_COST_PER_RUN_USD: '99', MAX_DAILY_COST_USD: '999' });
    expect(over).toEqual({ maxQuestionsPerRun: MAX_QUESTIONS_PER_RUN, maxCostPerRunUsd: MAX_COST_PER_RUN_USD, maxDailyCostUsd: MAX_DAILY_COST_USD });
  });
  it('estimateRunCostUsd aproxima tokens desde chars y nº de preguntas', () => {
    const price = DEFAULT_PRICES['gpt-4o-mini'];
    const cost = estimateRunCostUsd({ sourceChars: 4000, questionCount: 5, price });
    expect(cost).toBeGreaterThan(0);
    // input ~1000 tokens, output 900 tokens -> 0.00015 + 0.00054
    expect(cost).toBeCloseTo(0.00069, 5);
  });
  it('evaluateBudget: ok / run_cost_exceeded / daily_cost_exceeded', () => {
    const limits = { maxQuestionsPerRun: 20, maxCostPerRunUsd: 0.5, maxDailyCostUsd: 5 };
    expect(evaluateBudget({ estimatedRunCostUsd: 0.1, todayCostSoFarUsd: 1, limits })).toEqual({ ok: true });
    expect(evaluateBudget({ estimatedRunCostUsd: 0.6, todayCostSoFarUsd: 0, limits })).toMatchObject({ ok: false, reason: 'run_cost_exceeded' });
    expect(evaluateBudget({ estimatedRunCostUsd: 0.1, todayCostSoFarUsd: 4.95, limits })).toMatchObject({ ok: false, reason: 'daily_cost_exceeded' });
  });
});
