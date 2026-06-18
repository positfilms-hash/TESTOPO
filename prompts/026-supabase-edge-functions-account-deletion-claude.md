# Claude Prompt - SPEC 026 Supabase Edge Functions for Account Deletion

## Context

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

Estamos en:

```text
SPEC 026 - Supabase Edge Functions for Account Deletion
```

El MVP principal ya esta migrado a Supabase y RLS fue endurecida en SPEC 025.

Esta spec implementa eliminacion segura de cuenta con una Edge Function o endpoint servidor equivalente.

## Spec

Implementa estrictamente:

```text
docs/specs/026-supabase-edge-functions-account-deletion.md
```

Branch de trabajo:

```text
feature/supabase-account-deletion-edge-function
```

Runbook obligatorio:

```text
docs/setup/migrations-runbook.md
```

Si usas Supabase Edge Functions, documenta tambien el deploy en:

```text
docs/setup/supabase-edge-functions.md
```

## Product Goal

Permitir que un usuario elimine su cuenta de forma segura sin comprometer:

- Workspaces de organizacion.
- Datos compartidos.
- Resultados historicos.
- Claves privadas.

La service role key nunca debe llegar al navegador.

## Required Implementation

### 1. Edge Function o endpoint servidor

Crear una funcion segura, por ejemplo:

```text
supabase/functions/delete-account
```

O endpoint servidor equivalente si el stack lo requiere.

Debe:

- Requerir request autenticada.
- Verificar JWT.
- Obtener user id desde JWT, no desde body.
- Requerir confirmacion explicita `ELIMINAR`.
- Comprobar si el usuario es unico owner de workspace organization.
- Bloquear si es unico owner.
- Soft delete del profile.
- Revocar `workspace_members`.
- Revocar `opposition_access`.
- Archivar workspace personal.
- Eliminar o bloquear usuario Auth desde servidor.
- Devolver respuesta segura sin filtrar datos sensibles.

No aceptar:

```json
{ "user_id": "otro_usuario" }
```

### 2. Service role

Permitido solo en:

- Edge Function.
- Backend server.
- Scripts seguros.

Prohibido en:

- Frontend.
- Bundle navegador.
- Codigo compartido cliente.
- Variables `VITE_*`.

`SUPABASE_SERVICE_ROLE_KEY` nunca debe llevar prefijo `VITE_`.

### 3. Account behavior

Student:

- Puede eliminar cuenta.
- `profile.status = deleted`.
- Memberships revoked.
- Opposition access revoked.
- Logout.

Premium/personal:

- Puede eliminar cuenta.
- Workspace personal archived.
- Membership revoked.
- Datos compartidos no se borran en cascada.

Owner organization:

- Si es unico owner, bloquear con `ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED`.
- Si queda otro owner activo, permitir.
- Organization workspace no se archiva.
- Membership/access del usuario se revoca.

### 4. Frontend

Crear o adaptar UI minima en Account Settings:

- Advertencia clara.
- Confirmacion escribiendo `ELIMINAR`.
- Boton destructivo "Eliminar mi cuenta".
- Llamada autenticada a Edge Function/endpoint.
- Logout/redireccion tras exito.

Frontend no debe hacer operaciones admin directas.

## Required Tests

Anade tests/verificaciones para:

- No elimina sin confirmacion.
- No elimina con confirmacion incorrecta.
- Elimina con confirmacion correcta.
- No permite request no autenticada.
- No permite borrar otra cuenta pasando `user_id`.
- Edge Function usa user id del JWT.
- No expone service role en frontend.
- `.env.example` no contiene claves reales.
- `SUPABASE_SERVICE_ROLE_KEY` no tiene prefijo frontend.
- Student puede eliminar cuenta.
- Student queda `profile.status = deleted`.
- Memberships quedan revoked.
- Opposition access queda revoked.
- Logout tras eliminacion.
- Workspace personal queda archived.
- Unico owner organization no puede eliminar cuenta.
- Owner organization con otro owner activo si puede eliminar.
- Organization workspace no se archiva si quedan otros owners.
- Usuario eliminado no puede seguir usando la app segun estrategia implementada.
- No se borran preguntas/tests/materiales compartidos accidentalmente.
- No se rompen resultados historicos.

Los tests que dependan de Supabase real/Edge Functions pueden ser verificaciones controladas. Los tests unitarios deben seguir pasando sin Supabase real.

## Required Documentation

Crear o actualizar:

```text
docs/security/account-deletion.md
docs/setup/supabase-edge-functions.md
docs/security/service-role-usage.md
docs/setup/migrations-runbook.md
docs/architecture/persistence.md
```

`account-deletion.md` debe explicar:

- Que significa eliminar cuenta.
- Que se anonimiza.
- Que se conserva.
- Que pasa con workspaces personales.
- Que pasa con workspaces de organizacion.
- Que pasa si el usuario es unico owner.
- Estrategia Auth elegida: borrado real o desactivacion logica.

`supabase-edge-functions.md` debe explicar:

- Como desplegar la funcion.
- Variables requeridas.
- Como configurar `SUPABASE_SERVICE_ROLE_KEY`.
- Como probar.
- Como verificar que no se expone en frontend.

`service-role-usage.md` debe explicar:

- Donde se usa service role.
- Por que se usa.
- Que operaciones permite.
- Que esta prohibido.

## Security Checklist

Antes de terminar, verifica:

- No hay service role en frontend.
- No hay `VITE_SUPABASE_SERVICE_ROLE_KEY`.
- No hay claves reales.
- `.env` no esta versionado.
- Edge Function valida auth.
- Edge Function usa JWT user id.
- Edge Function ignora/rechaza `user_id` del body.
- Unico owner organization queda bloqueado.
- Datos compartidos no se borran en cascada.
- Fallback InMemory sigue funcionando para tests/dev.

## Out Of Scope

No implementes:

- Exportacion avanzada de datos.
- Transferencia guiada de ownership.
- Pagos.
- Stripe.
- OAuth.
- MFA.
- Beta readiness.

## Final Message / PR Notes

En la descripcion de la PR incluye:

- Resumen de cambios.
- Edge Function/endpoint creado.
- Estrategia Auth elegida: borrado real o soft delete fuerte.
- Como configurar secrets.
- Como desplegar/probar.
- Comportamiento por tipo de usuario.
- Tests ejecutados.
- Confirmacion de que service role no esta en frontend.
- Confirmacion de que no se borran datos compartidos en cascada.
