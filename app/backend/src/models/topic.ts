// Tema del temario (SPEC 003, seccion 6).
//
// Los temas forman una jerarquia mediante `parent_id` (un tema raiz lo tiene a
// null). Sirven para clasificar materiales y preguntas y, mas adelante, para
// medir la cobertura del temario.

import type { TopicStatus } from './enums.js';

export interface Topic {
  id: string;
  /** Oposicion a la que pertenece el tema (SPEC 010). Obligatorio. */
  opposition_id: string;
  title: string;
  description: string | null;
  /** Codigo opcional para ordenar/identificar el tema (p. ej. T1, T1.1). */
  code: string | null;
  /** Tema padre; `null` en un tema raiz. */
  parent_id: string | null;
  /** Orden dentro del mismo nivel (mismo padre). */
  order: number;
  status: TopicStatus;
  created_at: Date;
  updated_at: Date;
}

// Nodo del arbol de temas (SPEC 003, 11.3): un tema con sus hijos anidados.
export interface TopicTreeNode extends Topic {
  children: TopicTreeNode[];
}
