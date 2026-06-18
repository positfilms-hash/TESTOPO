# Edge Functions de Supabase (SPEC 026)

TESTOPO usa Edge Functions para operaciones **privilegiadas** que requieren la
`service_role` y no pueden ejecutarse en el navegador. Hoy hay una:

- `supabase/functions/delete-account` — eliminación segura de cuenta
  (ver [`../security/account-deletion.md`](../security/account-deletion.md)).

## Requisitos

- **Supabase CLI** instalada (`scoop install supabase` / `npm i -g supabase` /
  `npx supabase`).
- Proyecto vinculado: `supabase link --project-ref <project-ref>`.

## Variables / secretos

Las funciones desplegadas reciben **inyectadas automáticamente** por Supabase:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

No hace falta declararlas como secreto salvo que quieras sobrescribirlas. **Nunca**
pongas estas claves en el frontend ni con prefijo `VITE_`. La `service_role` solo
vive en el entorno de la función. Ver
[`../security/service-role-usage.md`](../security/service-role-usage.md).

## Desplegar

```bash
# Despliega la función (verify_jwt está activado por defecto: exige Authorization)
supabase functions deploy delete-account
```

> La función igualmente revalida el JWT y obtiene el `user_id` del token (no del
> body), así que es segura aunque se invoque directamente.

## Probar

Localmente:

```bash
supabase functions serve delete-account
# en otra terminal, con un access_token de un usuario de prueba:
curl -i -X POST http://localhost:54321/functions/v1/delete-account \
  -H "Authorization: Bearer <ACCESS_TOKEN_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{"confirmation":"ELIMINAR"}'
```

Respuestas esperadas:

- `200 { "ok": true, "auth_deleted": true }` — cuenta eliminada.
- `200 { "ok": true, "auth_deleted": false, "warning": "ACCOUNT_DELETE_AUTH_DELETE_FAILED" }`
  — perfil `deleted` pero el borrado Auth falló (reintentar/revisar permisos).
- `400 ACCOUNT_DELETE_CONFIRMATION_REQUIRED` — falta/!= `ELIMINAR`.
- `401 ACCOUNT_DELETE_AUTH_REQUIRED` — sin JWT válido.
- `409 ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED` — único owner de organización.
- `500 SERVICE_ROLE_NOT_CONFIGURED` — faltan variables de servidor.

## Desde el frontend

El frontend invoca la función con la sesión del usuario:

```ts
await supabase.functions.invoke('delete-account', {
  body: { confirmation: 'ELIMINAR' },
});
```

(en `app/frontend/src/auth/authService.ts → requestAccountDeletion`).

## Verificar que la service role no se expone

- `app/frontend/tests/supabaseSecurity.test.ts` (CI) escanea `app/frontend/src` y
  falla si aparece `service_role` o una env `SUPABASE_*` sin prefijo `VITE_`.
- La Edge Function vive en `supabase/functions/`, fuera del bundle del frontend.
