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
        async deleteMatch(criteria: SupabaseRow): Promise<number> {
          const { data, error } = await client
            .from(name)
            .delete()
            .match(criteria)
            .select();
          if (error) {
            throw new Error(`Supabase delete ${name}: ${error.message}`);
          }
          return (data ?? []).length;
        },
      };
    },
    async rpc(fn: string, args?: SupabaseRow) {
      // SPEC 029: funciones SECURITY DEFINER (flujo de alumno sin solucion).
      const { data, error } = await client.rpc(fn, args ?? {});
      if (error) {
        throw new Error(`Supabase rpc ${fn}: ${error.message}`);
      }
      return data;
    },
    storage(bucket: string) {
      // SPEC 029: bucket privado de materiales. La URL firmada respeta las
      // politicas del bucket (sesion del gestor); nunca service-role.
      const api = client.storage.from(bucket);
      return {
        async upload(path: string, bytes: Uint8Array, contentType?: string) {
          const blob = new Blob([bytes.slice()], {
            type: contentType ?? 'application/octet-stream',
          });
          const { error } = await api.upload(path, blob, {
            upsert: true,
            contentType: contentType ?? undefined,
          });
          if (error) {
            throw new Error(`Supabase storage upload ${path}: ${error.message}`);
          }
        },
        async download(path: string) {
          const { data, error } = await api.download(path);
          if (error || !data) {
            return null;
          }
          return new Uint8Array(await data.arrayBuffer());
        },
        async createSignedUrl(path: string, expiresInSeconds: number) {
          const { data, error } = await api.createSignedUrl(
            path,
            expiresInSeconds,
          );
          if (error || !data) {
            return null;
          }
          return data.signedUrl;
        },
        async remove(path: string) {
          await api.remove([path]);
        },
      };
    },
  };
}

// Modo de persistencia solicitado por entorno (publico): VITE_APP_PERSISTENCE_MODE.
export function requestedPersistenceMode(): string {
  return (import.meta.env.VITE_APP_PERSISTENCE_MODE as string | undefined) ?? 'memory';
}
