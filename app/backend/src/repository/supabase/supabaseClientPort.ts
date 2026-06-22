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

/** Puerto de Supabase Storage (SPEC 029): bucket privado de materiales. */
export interface SupabaseStoragePort {
  upload(path: string, bytes: Uint8Array, contentType?: string): Promise<void>;
  download(path: string): Promise<Uint8Array | null>;
  /** URL firmada de corta duracion (segundos). null si no se puede firmar. */
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string | null>;
  remove(path: string): Promise<void>;
}

export interface SupabaseClientPort {
  table(name: string): SupabaseTablePort;
  /**
   * Llama una funcion RPC de Postgres (SPEC 029: funciones SECURITY DEFINER que
   * sirven el flujo de alumno sin exponer la solucion). Solo se usa en modo
   * Supabase real; el puerto en memoria no lo soporta.
   */
  rpc(fn: string, args?: SupabaseRow): Promise<unknown>;
  /** Acceso a un bucket privado de Supabase Storage (SPEC 029). */
  storage(bucket: string): SupabaseStoragePort;
}
