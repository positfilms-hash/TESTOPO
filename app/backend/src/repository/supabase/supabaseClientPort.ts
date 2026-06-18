// Puerto minimo de acceso a Supabase (SPEC 020).
//
// El backend de dominio NO depende de `@supabase/supabase-js`: depende solo de
// este puerto. El frontend (donde vive supabase-js) provee un adaptador real; en
// tests se usa un puerto en memoria. Asi los repos Supabase son testeables sin
// red y CI no necesita un Supabase real.

export type SupabaseRow = Record<string, unknown>;

export interface SupabaseTablePort {
  /** Inserta una fila y devuelve la fila persistida. */
  insert(row: SupabaseRow): Promise<SupabaseRow>;
  /** Devuelve las filas que cumplen todas las igualdades de `criteria`. */
  selectMatch(criteria: SupabaseRow): Promise<SupabaseRow[]>;
  /** Devuelve todas las filas de la tabla. */
  selectAll(): Promise<SupabaseRow[]>;
  /** Actualiza por `id` (merge) y devuelve la fila resultante. */
  updateById(id: string, patch: SupabaseRow): Promise<SupabaseRow>;
  /** Borra las filas que cumplen `criteria` y devuelve cuantas se borraron. */
  deleteMatch(criteria: SupabaseRow): Promise<number>;
}

export interface SupabaseClientPort {
  table(name: string): SupabaseTablePort;
}
