// SPEC 037: validacion DETERMINISTA de que una propuesta de indice es un INDICE
// COMPACTO de bloques de estudio, no una transcripcion del PDF (articulo/pagina/
// epigrafe por nodo). PURA (sin red): la usa el servicio tras generar para no
// aplicar nunca en silencio una propuesta mala -> `needs_regeneration`.
//
// Reglas (SPEC 037 "Index Rules"):
//   - 5-15 temas raiz objetivo; TOPE DURO 20 raices.
//   - profundidad 1-2 normal; un 3er nivel necesita valor (se permite hasta 3).
//   - titulos no vacios.
//   - no dominado por nodos a nivel articulo/pagina/numeracion micro.
//   - mapeo de fuente: al menos un nodo con fuente concreta (no todo sin fuente).

import type {
  GroundedIndexOutput,
  GroundedNodeSources,
  GroundedTopicNode,
} from './documentGroundedIndexTypes.js';

export const COMPACT_INDEX_ROOT_TARGET_MIN = 5;
export const COMPACT_INDEX_ROOT_TARGET_MAX = 15;
export const COMPACT_INDEX_ROOT_HARD_CAP = 20;
export const COMPACT_INDEX_MAX_DEPTH = 3; // 1-2 normal; 3 solo con valor de estudio
// Fraccion maxima de nodos "articulo/pagina/micro" antes de considerar la
// propuesta una transcripcion (dominada por nodos de bajo nivel).
export const COMPACT_INDEX_MAX_MICRO_FRACTION = 0.5;

export type CompactIndexStatus = 'ok' | 'needs_regeneration';

export interface CompactIndexValidation {
  status: CompactIndexStatus;
  rootCount: number;
  totalNodes: number;
  maxDepth: number;
  microFraction: number;
  warnings: string[];
}

// ¿El titulo del nodo es a nivel articulo/pagina/epigrafe/numeracion profunda? Eso
// indica transcripcion, no bloque de estudio.
export function isMicroHeadingTitle(title: string): boolean {
  const t = (title ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /^art[íi]?culo?\s*\.?\s*\d+/.test(t) || // "articulo 14", "art. 5"
    /^art\.?\s*\d+/.test(t) ||
    /^p[áa]g(ina)?\.?\s*\d+/.test(t) || // "pagina 12", "pag. 3"
    /^(disposici[óo]n|apartado|ep[íi]grafe|punto)\s+\w/.test(t) ||
    /^\d+(\.\d+){2,}\b/.test(t) || // numeracion micro "1.2.3"
    /^anexo\s+\w/.test(t)
  );
}

function flatten(nodes: GroundedTopicNode[], depth: number, acc: { node: GroundedTopicNode; depth: number }[]): void {
  for (const node of nodes) {
    acc.push({ node, depth });
    if (node.children && node.children.length > 0) {
      flatten(node.children, depth + 1, acc);
    }
  }
}

function nodeHasSource(node: GroundedTopicNode): boolean {
  return (
    Array.isArray(node.sources) &&
    node.sources.some((s) => typeof s?.material_id === 'string' && s.material_id.length > 0)
  );
}

// Valida la FORMA de la propuesta. No toca fuentes/permisos: solo la compacidad.
export function validateCompactIndex(output: GroundedIndexOutput): CompactIndexValidation {
  const roots = Array.isArray(output.topics) ? output.topics : [];
  const all: { node: GroundedTopicNode; depth: number }[] = [];
  flatten(roots, 1, all);

  const rootCount = roots.length;
  const totalNodes = all.length;
  const maxDepth = all.reduce((m, x) => Math.max(m, x.depth), 0);
  const microCount = all.filter((x) => isMicroHeadingTitle(x.node.title)).length;
  const microFraction = totalNodes > 0 ? microCount / totalNodes : 0;
  const emptyTitles = all.filter((x) => !((x.node.title ?? '').trim().length > 0)).length;
  const anySource = all.some((x) => nodeHasSource(x.node));

  const warnings: string[] = [];
  let status: CompactIndexStatus = 'ok';
  const fail = (w: string) => {
    status = 'needs_regeneration';
    warnings.push(w);
  };

  if (rootCount === 0) {
    fail('La propuesta no tiene temas raíz.');
  }
  if (rootCount > COMPACT_INDEX_ROOT_HARD_CAP) {
    fail(`Demasiados temas raíz (${rootCount}); el máximo es ${COMPACT_INDEX_ROOT_HARD_CAP}.`);
  }
  if (maxDepth > COMPACT_INDEX_MAX_DEPTH) {
    fail(`El índice es demasiado profundo (nivel ${maxDepth}); usa 1-2 niveles.`);
  }
  if (emptyTitles > 0) {
    fail('Hay temas sin título.');
  }
  if (totalNodes > 0 && microFraction > COMPACT_INDEX_MAX_MICRO_FRACTION) {
    fail('La propuesta parece una transcripción (dominada por artículos/páginas), no un índice de estudio.');
  }
  if (totalNodes > 0 && !anySource) {
    fail('Ningún tema está vinculado a una fuente concreta.');
  }

  // Aviso (no bloqueante) si el numero de raices esta fuera del rango objetivo.
  if (
    status === 'ok' &&
    (rootCount < COMPACT_INDEX_ROOT_TARGET_MIN || rootCount > COMPACT_INDEX_ROOT_TARGET_MAX)
  ) {
    warnings.push(
      `El índice tiene ${rootCount} temas raíz (objetivo ${COMPACT_INDEX_ROOT_TARGET_MIN}-${COMPACT_INDEX_ROOT_TARGET_MAX}).`,
    );
  }

  return { status, rootCount, totalNodes, maxDepth, microFraction, warnings };
}

// Reconstruye el arbol desde los NODOS persistidos de una propuesta y valida su
// compacidad. La usan los servicios para BLOQUEAR el apply de una propuesta
// `needs_regeneration` (SPEC 037). Cada nodo "tiene fuente" si existe al menos un
// node_source con material para el.
export function validateCompactIndexFromNodes(
  nodes: ReadonlyArray<{ id: string; parent_id: string | null; title: string; order: number }>,
  nodeSources: ReadonlyArray<{ node_id: string; material_id: string }>,
): CompactIndexValidation {
  const sourcesByNode = new Map<string, GroundedNodeSources[]>();
  for (const s of nodeSources) {
    const arr = sourcesByNode.get(s.node_id) ?? [];
    arr.push({ material_id: s.material_id, section_ids: [], reference_ids: [] });
    sourcesByNode.set(s.node_id, arr);
  }
  const byId = new Map<string, GroundedTopicNode>();
  for (const n of nodes) {
    byId.set(n.id, {
      title: n.title,
      order: n.order,
      sources: sourcesByNode.get(n.id) ?? [],
      children: [],
    });
  }
  const roots: GroundedTopicNode[] = [];
  for (const n of nodes) {
    const node = byId.get(n.id) as GroundedTopicNode;
    const parent = n.parent_id ? byId.get(n.parent_id) : undefined;
    if (parent) (parent.children as GroundedTopicNode[]).push(node);
    else roots.push(node);
  }
  return validateCompactIndex({
    title: '',
    summary: '',
    topics: roots,
    warnings: [],
    provider: '',
    model: null,
  });
}
