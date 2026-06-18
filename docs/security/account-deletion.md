# Eliminación de cuenta (SPEC 026)

Eliminar una cuenta es una operación **privilegiada**: borra el usuario de
Supabase Auth, lo que requiere la `service_role` y por tanto **no puede hacerse
desde el navegador**. Se ejecuta en la Edge Function `delete-account` (ver
[`docs/setup/supabase-edge-functions.md`](../setup/supabase-edge-functions.md)).

## Flujo

```text
Usuario → Cuenta → "Eliminar mi cuenta"
  → escribe ELIMINAR para confirmar
  → el frontend invoca la Edge Function autenticada (con su JWT)
  → la función valida y procesa en servidor (service role)
  → el frontend cierra sesión y vuelve al inicio
```

El frontend **nunca** usa la `service_role` ni borra `auth.users`; solo invoca la
función y hace `signOut`. La función infiere el `user_id` **del JWT**, nunca del
body (no se puede borrar otra cuenta pasando un id).

## Qué hace la función (en orden)

1. Verifica el JWT y obtiene `user_id`.
2. Exige confirmación explícita (`{ confirmation: "ELIMINAR" }`).
3. Comprueba el **bloqueo de único owner**: si el usuario es el único owner/admin
   activo de un workspace de **organización**, se bloquea con
   `ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED` (debe transferir la propiedad antes).
4. **Soft-delete del perfil**: `profiles.status = 'deleted'`, `name = 'Usuario eliminado'`.
5. **Revoca accesos**: `workspace_members.status = 'revoked'` y
   `opposition_access.status = 'revoked'` del usuario.
6. **Archiva** sus workspaces **personales** (`workspaces.status = 'archived'`,
   `type = 'personal'`). Los de organización con otros owners **no** se archivan.
7. **Borra el usuario de Supabase Auth** (Admin API). Si el borrado Auth falla, el
   perfil ya quedó `deleted` (soft-delete fuerte) y el usuario no puede usar la
   app igualmente; la respuesta lo indica con `auth_deleted: false`.

## Qué se conserva (y por qué)

- **`test_attempts` / `test_answers`**: no se borran. Se conservan por integridad
  histórica y estadística; el perfil visible queda anonimizado (`deleted`).
- **Materiales, preguntas, tests** de workspaces: **no** se borran en cascada. Si
  el workspace personal se archiva, su contenido queda archivado con él.
- **Filas de membership/acceso**: no se borran, se marcan `revoked` (auditoría y
  evitar romper referencias).

## Comportamiento por tipo de usuario

| Tipo | Efecto |
| --- | --- |
| Student | perfil `deleted`, memberships/acceso `revoked`, logout, Auth borrado |
| Premium individual | igual + workspace personal `archived` |
| Owner de organización (único) | **bloqueado** hasta transferir propiedad |
| Owner de organización (hay otro owner) | se permite; su membership `revoked`; el workspace de organización **no** se archiva |

## Estrategia de Auth user

Se implementa **borrado real** vía Admin API en la Edge Function. Si por
configuración el borrado Auth fallara, el **soft-delete fuerte** del perfil
(`status='deleted'`) ya impide el uso de la cuenta; el cierre real de Auth se
puede reintentar. La RLS y los guards de app no muestran perfiles `deleted`.

## Modo memoria / demo

En `APP_PERSISTENCE_MODE=memory` (demo, tests) **no** hay Supabase ni Edge
Function: la pantalla de Cuenta requiere Supabase configurado para eliminar. La
eliminación real solo aplica contra Supabase. Las **reglas puras** de bloqueo
(`app/frontend/src/auth/accountDeletion.ts`) sí se testean en CI.
