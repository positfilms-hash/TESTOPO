# Uso de la `service_role` en TESTOPO

> **La service role key NUNCA debe usarse en frontend.**

La `service_role` de Supabase **se salta la RLS** y tiene permisos totales. Por eso
su uso está restringido a entornos de servidor controlados.

## Dónde se usa

| Lugar | Uso | Por qué |
| --- | --- | --- |
| Edge Function `delete-account` | Borrado de cuenta (revocar accesos, archivar workspace personal, soft-delete de perfil, borrar usuario Auth) | El borrado de `auth.users` requiere Admin API / privilegios que la clave anónima no tiene |
| Tooling/scripts de servidor (futuro) | Mantenimiento seguro | Operaciones administrativas puntuales |

## Qué operaciones permite

- `auth.admin.deleteUser(...)` y demás Admin API.
- Lectura/escritura saltándose RLS (por eso la función **revalida todo a mano**:
  auth, confirmación, ownership, tipo de workspace).

## Restricciones (obligatorias)

- ❌ Nunca en el frontend ni en el bundle del navegador.
- ❌ Nunca en una variable con prefijo `VITE_` (Vite las inyecta al cliente).
- ❌ Nunca en código compartido cliente/servidor importable desde el frontend.
- ❌ No se loguea ni se devuelve en respuestas.
- ✅ Solo en Edge Functions / backend / scripts de servidor.
- ✅ La función con service role debe ser **más estricta** que una operación normal
  (no confiar en ids del body; inferir el usuario del JWT).

## Verificación automática

`app/frontend/tests/supabaseSecurity.test.ts` (CI) escanea `app/frontend/src` y
falla si encuentra `service_role`/`SERVICE_ROLE_KEY` o una env `SUPABASE_*` sin
prefijo `VITE_`. El `.env` real está gitignored; `.env.example` no contiene claves
reales.

## Variables

```text
# Solo servidor (Edge Function / backend). NUNCA VITE_:
SUPABASE_SERVICE_ROLE_KEY=...
```

En funciones desplegadas, Supabase inyecta `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` automáticamente.
