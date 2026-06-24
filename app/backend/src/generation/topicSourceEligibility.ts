// SPEC 037: regla AUTORITATIVA y UNICA de elegibilidad de una fuente de tema, en
// el backend. Replica exactamente lo que exige el servidor
// (`evaluateTopicSourceReference`) para que NO haya divergencia entre:
//   - el contador de readiness (SourceRetrievalService),
//   - lo que `applyProposal` crea como topic_source_references, y
//   - lo que `generate-questions` acepta.
//
// Asi, reaplicar el indice crea SOLO referencias que el servidor aceptara, y un
// tema sin fuente elegible queda correctamente "sin fuentes utilizables".

import type { DocumentClass } from '../models/documentClassification.js';
import { isPrimaryIndexClass } from './documentGroundedIndexTypes.js';
import { isEligibleDocumentClass } from '../models/materialSection.js';

// Estados de extraccion que hacen el material NO legible (no usable como fuente).
const UNREADABLE_EXTRACTION = new Set(['failed', 'ocr_failed', 'not_supported']);

// Material elegible: no obsoleto, LEGIBLE, y clasificacion efectiva PRIMARIA y SIN
// needs_review.
export function isEligibleSourceMaterial(args: {
  material: { status?: string | null; extraction_status?: string | null } | null | undefined;
  classification: { classification?: string | null; needs_review?: boolean | null } | null | undefined;
}): boolean {
  const m = args.material;
  if (!m) return false;
  if (m.status === 'obsolete') return false;
  if (UNREADABLE_EXTRACTION.has(m.extraction_status ?? '')) return false;
  const c = args.classification;
  if (!c) return false;
  if (c.needs_review === true) return false;
  const cls = (c.classification ?? '') as DocumentClass;
  return isPrimaryIndexClass(cls) && isEligibleDocumentClass(cls);
}

// Puntero concreto valido: una seccion ACTIVA del mismo material, o una referencia
// de fuente concreta.
export function isValidConcretePointer(args: {
  materialId: string;
  section: { status?: string | null; material_id?: string | null } | null | undefined;
  sourceReferenceId: string | null | undefined;
}): boolean {
  const sec = args.section;
  const activeSection =
    !!sec && sec.status === 'active' && sec.material_id === args.materialId;
  return activeSection || args.sourceReferenceId != null;
}
