// Cliente Supabase del frontend (SPEC 018.2). SOLO usa claves publicas:
// VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. La clave de servicio (server-only)
// NUNCA debe vivir en el frontend (ver docs/setup/supabase-setup.md).
//
// Si las variables no estan definidas, la app sigue funcionando en modo demo
// (datos en memoria) y las operaciones de auth lanzan SUPABASE_NOT_CONFIGURED.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AuthError, AuthErrorCode } from './authErrors.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new AuthError([AuthErrorCode.SUPABASE_NOT_CONFIGURED]);
  }
  if (!client) {
    client = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
