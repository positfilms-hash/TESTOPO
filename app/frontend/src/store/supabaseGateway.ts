// Adaptador real del puerto Supabase (SPEC 020). Vive en el frontend, donde se
// usa `@supabase/supabase-js` con la clave ANONIMA (publica). La service role
// NUNCA llega aqui. Traduce el `SupabaseClientPort` del backend a llamadas
// reales de supabase-js.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClientPort, SupabaseRow } from '@backend';

export function createSupabasePort(client: SupabaseClient): SupabaseClientPort {
  return {
    table(name: string) {
      return {
        async insert(row: SupabaseRow): Promise<SupabaseRow> {
          const { data, error } = await client
            .from(name)
            .insert(row)
            .select()
            .single();
          if (error) {
            throw new Error(`Supabase insert ${name}: ${error.message}`);
          }
          return (data ?? {}) as SupabaseRow;
        },
        async selectMatch(criteria: SupabaseRow): Promise<SupabaseRow[]> {
          const { data, error } = await client.from(name).select('*').match(criteria);
          if (error) {
            throw new Error(`Supabase select ${name}: ${error.message}`);
          }
          return (data ?? []) as SupabaseRow[];
        },
        async selectAll(): Promise<SupabaseRow[]> {
          const { data, error } = await client.from(name).select('*');
          if (error) {
            throw new Error(`Supabase selectAll ${name}: ${error.message}`);
          }
          return (data ?? []) as SupabaseRow[];
        },
        async updateById(id: string, patch: SupabaseRow): Promise<SupabaseRow> {
          const { data, error } = await client
            .from(name)
            .update(patch)
            .eq('id', id)
            .select()
            .single();
          if (error) {
            throw new Error(`Supabase update ${name}: ${error.message}`);
          }
          return (data ?? {}) as SupabaseRow;
        },
      };
    },
  };
}

// Modo de persistencia solicitado por entorno (publico): VITE_APP_PERSISTENCE_MODE.
export function requestedPersistenceMode(): string {
  return (import.meta.env.VITE_APP_PERSISTENCE_MODE as string | undefined) ?? 'memory';
}
