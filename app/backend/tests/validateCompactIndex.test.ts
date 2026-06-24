// SPEC 037: validacion DETERMINISTA del indice COMPACTO (no transcripcion).

import { describe, expect, it } from 'vitest';
import {
  validateCompactIndex,
  isMicroHeadingTitle,
  COMPACT_INDEX_ROOT_HARD_CAP,
  type GroundedIndexOutput,
  type GroundedTopicNode,
} from '../src/index.js';

function node(title: string, children: GroundedTopicNode[] = [], withSource = true): GroundedTopicNode {
  return {
    title,
    order: 0,
    sources: withSource ? [{ material_id: 'mat-1', section_ids: ['sec-1'], reference_ids: [] }] : [],
    children,
  };
}

function output(topics: GroundedTopicNode[]): GroundedIndexOutput {
  return { title: 'Índice', summary: '', topics, warnings: [], provider: 'mock', model: null };
}

const roots = (n: number) => Array.from({ length: n }, (_, i) => node(`Bloque de estudio ${i + 1}`));

describe('isMicroHeadingTitle', () => {
  it('detecta titulos a nivel articulo/pagina/numeracion micro', () => {
    for (const t of ['Artículo 14', 'Art. 5', 'Página 12', 'pag. 3', '1.2.3 Detalle', 'Anexo II', 'Disposición adicional']) {
      expect(isMicroHeadingTitle(t)).toBe(true);
    }
  });
  it('no marca bloques de estudio normales', () => {
    for (const t of ['Derechos y deberes fundamentales', 'La organización del Estado', 'Tema 1']) {
      expect(isMicroHeadingTitle(t)).toBe(false);
    }
  });
});

describe('validateCompactIndex', () => {
  it('acepta un índice compacto (6 raíces, profundidad 2, con fuentes)', () => {
    const o = output([
      node('Derechos fundamentales', [node('Derechos de la persona')]),
      ...roots(5),
    ]);
    const r = validateCompactIndex(o);
    expect(r.status).toBe('ok');
    expect(r.rootCount).toBe(6);
    expect(r.maxDepth).toBe(2);
  });

  it('needs_regeneration si supera el tope duro de raíces (20)', () => {
    const r = validateCompactIndex(output(roots(COMPACT_INDEX_ROOT_HARD_CAP + 1)));
    expect(r.status).toBe('needs_regeneration');
  });

  it('needs_regeneration si es demasiado profundo (nivel 4)', () => {
    const deep = node('A', [node('B', [node('C', [node('D')])])]);
    const r = validateCompactIndex(output([deep, ...roots(4)]));
    expect(r.status).toBe('needs_regeneration');
    expect(r.maxDepth).toBe(4);
  });

  it('needs_regeneration si hay títulos vacíos', () => {
    const r = validateCompactIndex(output([node(''), ...roots(4)]));
    expect(r.status).toBe('needs_regeneration');
  });

  it('needs_regeneration si está dominado por artículos/páginas (transcripción)', () => {
    const r = validateCompactIndex(
      output([node('Artículo 1'), node('Artículo 2'), node('Artículo 3'), node('Bloque real')]),
    );
    expect(r.status).toBe('needs_regeneration');
    expect(r.microFraction).toBeGreaterThan(0.5);
  });

  it('needs_regeneration si ningún tema tiene fuente', () => {
    const r = validateCompactIndex(output(roots(5).map((n) => ({ ...n, sources: [] }))));
    expect(r.status).toBe('needs_regeneration');
  });

  it('ok pero con aviso si las raíces están fuera del objetivo 5-15 (p. ej. 3)', () => {
    const r = validateCompactIndex(output(roots(3)));
    expect(r.status).toBe('ok');
    expect(r.warnings.join(' ')).toMatch(/objetivo/i);
  });
});
