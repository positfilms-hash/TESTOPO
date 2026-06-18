# SPEC 026 - Supabase Edge Functions for Account Deletion

## 1. Objetivo

Implementar un flujo seguro de eliminacion de cuenta en TESTOPO usando Supabase Edge Functions o endpoint servidor equivalente.

La eliminacion real de un usuario de Supabase Auth requiere privilegios de administrador. Por tanto, no puede ejecutarse desde el frontend ni usando claves publicas.

Regla central:

```text
La service role key nunca debe llegar al navegador.
```

## 2. Contexto

Specs previas relevantes:

- SPEC 018.2 - Supabase Auth & Database Foundation.
- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.
- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
- SPEC 025 - Supabase RLS Hardening.

La app ya debe tener:

- Registro real.
- Login real.
- Reset password.
- Profiles.
- Workspaces.
- Oposiciones.
- Materiales.
- Temario.
- Preguntas.
- Tests.
- Resultados.
- RLS endurecida.

Ahora falta cerrar correctamente:

- Eliminar cuenta.

## 3. Branch

```text
feature/supabase-account-deletion-edge-function
```

## 4. Principio Central

Eliminar una cuenta no es simplemente borrar un usuario.

Hay que proteger:

- Identidad del usuario.
- Datos personales.
- Workspaces personales.
- Workspaces de organizacion.
- Resultados de tests.
- Historial de revision.
- Integridad de academias/preparadores.
- Propiedad de datos compartidos.

Correcto:

```text
Usuario solicita eliminar cuenta
  -> Confirma explicitamente
  -> Servidor verifica permisos y ownership
  -> Servidor anonimiza/archiva datos necesarios
  -> Servidor elimina o desactiva usuario Auth
  -> Sesion se invalida
  -> Usuario vuelve a pantalla publica
```

Incorrecto:

```text
Frontend llama directamente a Supabase Admin API
  -> Borra usuario sin comprobar ownership
  -> Rompe workspaces o datos compartidos
```

## 5. Alcance

Claude debe implementar:

- Edge Function o endpoint servidor para eliminacion de cuenta.
- Validacion de usuario autenticado.
- Confirmacion explicita.
- Comprobacion de workspaces donde el usuario es owner.
- Bloqueo si el usuario es unico owner de un workspace organization.
- Soft delete del profile.
- Revocacion de memberships/access.
- Archivado de workspace personal si corresponde.
- Borrado real o desactivacion de usuario Auth desde servidor.
- Logout tras eliminacion.
- UI minima en Account Settings.
- Tests/verificaciones criticas.
- Documentacion de seguridad.

## 6. Fuera De Alcance

No implementar todavia:

- Exportacion completa de datos personales.
- Panel avanzado de privacidad.
- Auditoria legal completa.
- GDPR avanzado.
- Transferencia guiada de ownership.
- Emails transaccionales personalizados.
- Recuperacion de cuenta eliminada.
- Eliminacion granular de datos.
- Pagos.
- Stripe.
- OAuth.
- MFA.
- Beta readiness.

## 7. Tipos De Usuario Y Comportamiento

### 7.1 Student

Un estudiante puede solicitar eliminar su cuenta.

Efectos recomendados:

- `profile.status = deleted`.
- `workspace_members.status = revoked`.
- `opposition_access.status = revoked`.
- Sesion cerrada.
- Usuario Auth eliminado o desactivado desde servidor.

Sus intentos de test pueden:

- Anonimizarse.
- O mantenerse asociados a un usuario eliminado si es necesario para integridad.

Recomendacion MVP:

```text
Mantener intentos/resultados, pero anonimizar el perfil visible.
```

### 7.2 Premium Individual

Un usuario Premium individual puede eliminar su cuenta.

Efectos recomendados:

- `profile.status = deleted`.
- Workspace personal -> `archived`.
- `workspace_members.status = revoked`.
- `opposition_access.status = revoked`.
- Sesion cerrada.
- Usuario Auth eliminado o desactivado desde servidor.

Sus materiales/preguntas/tests personales pueden archivarse con el workspace.

No borrar fisicamente todo en cascada en esta spec salvo que ya este muy controlado.

### 7.3 Owner De Organizacion

Un owner de workspace organization no puede eliminar su cuenta si es el unico owner.

Debe bloquearse con error claro:

```text
ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED
```

Mensaje visible:

```text
No puedes eliminar tu cuenta porque eres el unico propietario de un workspace. Anade o transfiere la propiedad a otro usuario antes de eliminarla.
```

Si hay otro owner activo, se puede permitir la eliminacion con cuidado:

- `profile.status = deleted`.
- Memberships del usuario -> `revoked`.
- `opposition_access` del usuario -> `revoked`.
- Usuario Auth eliminado/desactivado.
- No archivar workspaces de organizacion si quedan otros owners.

## 8. Edge Function O Endpoint Servidor

Crear una funcion segura, por ejemplo:

```text
supabase/functions/delete-account
```

O endpoint equivalente si el stack usa backend propio:

```text
POST /api/account/delete
```

La funcion debe:

1. Recibir request autenticada.
2. Verificar JWT del usuario.
3. Obtener `auth.uid()`.
4. Verificar confirmacion explicita.
5. Comprobar ownership de workspaces.
6. Aplicar soft delete/anonimizacion.
7. Revocar accesos.
8. Eliminar o desactivar usuario Auth usando service role.
9. Devolver resultado seguro.

## 9. Uso De Service Role

La service role key puede usarse unicamente en:

- Edge Function.
- Backend server.
- Scripts seguros de mantenimiento.

Nunca en:

- Frontend.
- Bundle del navegador.
- Codigo compartido cliente.
- Variables `VITE_*`.

Variables recomendadas:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Regla:

```text
SUPABASE_SERVICE_ROLE_KEY no debe tener prefijo VITE_.
```

## 10. Confirmacion Explicita

La UI debe pedir confirmacion antes de borrar.

Ejemplo:

```text
Escribe ELIMINAR para confirmar.
```

Entrada esperada:

```text
ELIMINAR
```

Si no coincide:

```text
ACCOUNT_DELETE_CONFIRMATION_REQUIRED
```

## 11. UI Minima

Crear o adaptar:

```text
/account
/account/delete
```

O seccion equivalente en configuracion de cuenta.

Debe mostrar:

- Eliminar cuenta.
- Esta accion no se puede deshacer.
- Si perteneces a una academia, perderas acceso a tus oposiciones.
- Si eres el unico propietario de un workspace, deberas transferirlo antes.

Boton destructivo:

```text
Eliminar mi cuenta
```

Confirmacion:

```text
Escribe ELIMINAR para confirmar.
```

## 12. Flujo Frontend

Flujo esperado:

```text
Usuario abre Cuenta
  -> Pulsa Eliminar cuenta
  -> Lee advertencia
  -> Escribe ELIMINAR
  -> Frontend llama a Edge Function autenticada
  -> Servidor procesa eliminacion
  -> Frontend cierra sesion
  -> Redirige a login/home
```

El frontend no debe:

- Usar service role.
- Borrar directamente `auth.users`.
- Hacer operaciones admin sensibles.

## 13. Soft Delete De Profile

Actualizar `profiles`:

```text
status = deleted
name = Usuario eliminado
```

Opcionalmente:

```text
email = deleted_<id>@deleted.local
```

Pero cuidado: si email esta sincronizado con Supabase Auth, no forzar cambios inseguros.

Recomendacion MVP:

```text
profile.status = deleted
name = Usuario eliminado
```

No mostrar datos personales de perfiles `deleted`.

## 14. Revocacion De Accesos

Al eliminar cuenta:

- `workspace_members.status = revoked`.
- `opposition_access.status = revoked`.

No borrar registros fisicos salvo decision explicita.

Motivo:

- Preservar integridad historica.
- Evitar romper referencias.
- Mantener auditoria basica.

## 15. Workspaces Personales

Si el usuario tiene workspace personal donde es owner:

```text
workspace.type = personal
```

Entonces:

```text
workspace.status = archived
```

No hace falta borrar materiales/preguntas/tests fisicamente.

## 16. Workspaces De Organizacion

Si el usuario es owner de workspace organization:

```text
workspace.type = organization
```

Comprobar numero de owners activos.

Si es unico owner:

- Bloquear eliminacion.

Si hay otros owners:

- Permitir eliminacion.
- Revocar membership del usuario.
- Mantener workspace activo.

## 17. Tests/Resultados

No borrar fisicamente `test_attempts` y `test_answers` por defecto.

Recomendacion:

```text
Conservar resultados, pero ocultar/anonimizar perfil visible.
```

Motivo:

- Integridad de estadisticas futuras.
- Historial de academia/preparador.
- Evitar cascadas peligrosas.

No implementar estadisticas avanzadas en esta spec.

## 18. Auth User Deletion

Hay dos estrategias posibles.

### Opcion A - Borrado Real Auth

La Edge Function llama a Admin API para eliminar usuario Auth.

Ventaja:

- El usuario ya no puede iniciar sesion.

### Opcion B - Desactivacion Logica

Mantener Auth user pero bloquear acceso con:

```text
profile.status = deleted
```

Ventaja:

- Menos riesgo de romper referencias.

Recomendacion MVP:

```text
Implementar borrado real si la Edge Function esta bien configurada.
Si hay dudas, implementar soft delete fuerte y documentar que el borrado Auth real queda preparado.
```

Codex debe revisar que la decision este documentada.

## 19. Seguridad De La Edge Function

La funcion debe validar:

- Request autenticada.
- Usuario existe.
- Profile existe.
- Confirmacion explicita.
- Usuario no es unico owner bloqueante.
- No se pasan IDs arbitrarios para borrar otra cuenta.
- El `user_id` usado es el del token, no uno enviado desde frontend.
- Errores no filtran informacion sensible.

No aceptar:

```json
{ "user_id": "otro_usuario" }
```

La funcion debe inferir `user_id` desde el JWT.

Una Edge Function con service role debe ser mas estricta que una operacion normal.

## 20. Errores Recomendados

- `ACCOUNT_DELETE_CONFIRMATION_REQUIRED`.
- `ACCOUNT_DELETE_AUTH_REQUIRED`.
- `ACCOUNT_DELETE_PROFILE_NOT_FOUND`.
- `ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED`.
- `ACCOUNT_DELETE_FAILED`.
- `ACCOUNT_DELETE_AUTH_DELETE_FAILED`.
- `ACCOUNT_DELETE_ACCESS_REVOKE_FAILED`.
- `ACCOUNT_DELETE_WORKSPACE_ARCHIVE_FAILED`.
- `ACCOUNT_DELETE_SERVICE_NOT_CONFIGURED`.
- `ACCOUNT_DELETE_INVALID_REQUEST`.
- `SERVICE_ROLE_NOT_CONFIGURED`.

## 21. Mensajes Visibles Recomendados

- Tu cuenta se ha eliminado correctamente.
- No puedes eliminar tu cuenta porque eres el unico propietario de un workspace.
- Escribe ELIMINAR para confirmar la eliminacion de tu cuenta.
- No se ha podido eliminar la cuenta. Intentalo de nuevo o contacta con soporte.

## 22. Tests Obligatorios

Confirmacion:

- No elimina cuenta sin confirmacion.
- No elimina cuenta con confirmacion incorrecta.
- Elimina cuenta con confirmacion correcta.

Seguridad:

- No permite request no autenticada.
- No permite borrar otra cuenta pasando `user_id`.
- No expone service role en frontend.
- `.env.example` no contiene claves reales.
- `SUPABASE_SERVICE_ROLE_KEY` no tiene prefijo frontend.

Student:

- Student puede eliminar cuenta.
- Student queda `profile.status = deleted`.
- Student memberships quedan `revoked`.
- Student `opposition_access` queda `revoked`.
- Student queda logout.

Premium personal:

- Owner de workspace personal puede eliminar cuenta.
- Workspace personal queda `archived`.
- Membership queda `revoked`.

Owner organization:

- Unico owner organization no puede eliminar cuenta.
- Owner organization con otro owner activo si puede eliminar cuenta.
- Organization workspace no se archiva si quedan otros owners.

Auth:

- Edge Function usa `user_id` del JWT.
- Auth user se elimina o se bloquea segun estrategia implementada.
- Usuario eliminado no puede seguir usando la app.

Integridad:

- No se borran preguntas/tests/materiales compartidos accidentalmente.
- No se rompen resultados historicos.
- No se borran workspaces de organizacion por error.

## 23. Documentacion

Crear o actualizar:

```text
docs/security/account-deletion.md
docs/setup/supabase-edge-functions.md
docs/security/service-role-usage.md
docs/setup/migrations-runbook.md
docs/architecture/persistence.md
```

## 24. `docs/security/account-deletion.md`

Debe explicar:

- Que significa eliminar cuenta.
- Que datos se anonimizan.
- Que datos se conservan.
- Que pasa con workspaces personales.
- Que pasa con workspaces de organizacion.
- Que pasa si el usuario es unico owner.
- Que estrategia se usa para Auth user.

## 25. `docs/setup/supabase-edge-functions.md`

Debe explicar:

- Como desplegar Edge Functions.
- Que variables hacen falta.
- Como configurar `SUPABASE_SERVICE_ROLE_KEY`.
- Como probar la funcion.
- Como verificar que no se expone en frontend.

## 26. `docs/security/service-role-usage.md`

Debe listar:

- Donde se usa service role.
- Por que se usa.
- Que operaciones permite.
- Que restricciones hay.
- Que esta prohibido.

Debe incluir:

```text
La service role key nunca debe usarse en frontend.
```

## 27. Relacion Con RLS

La Edge Function puede usar service role y saltarse RLS.

Por eso debe implementar sus propias comprobaciones de seguridad.

Debe validar explicitamente:

- Auth.
- Confirmacion.
- Ownership.
- Tipo de workspace.
- Estado de memberships.

## 28. Relacion Con Fallback InMemory

El modo InMemory puede simular eliminacion de cuenta para tests/dev.

Pero la eliminacion real Auth solo aplica en Supabase.

En modo memory:

- `profile.status = deleted`.
- Memberships revoked.
- Workspace personal archived.
- Logout simulado.

## 29. Estado Esperado Tras Esta Spec

Al terminar:

- El usuario puede eliminar su cuenta desde la app.
- La eliminacion se procesa de forma segura en servidor.
- La service role key no esta expuesta.
- Los owners unicos de organization quedan protegidos.
- Los perfiles se marcan como `deleted`.
- Los accesos se revocan.
- Los workspaces personales se archivan.
- La sesion se cierra.
- La documentacion explica el comportamiento.

## 30. Futuras Specs Previstas

Despues de esta spec, el orden recomendado sera:

- SPEC 027 - Pre-Beta QA & Data Consistency.
- SPEC 028 - Beta Readiness.

Tambien puede hacerse una spec menor de UX si la pantalla de cuenta necesita pulido.

## 31. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existe Edge Function o endpoint servidor para eliminar cuenta.
- La funcion requiere autenticacion.
- La funcion usa `user_id` del JWT.
- La funcion requiere confirmacion explicita.
- La funcion bloquea unico owner de organization.
- La funcion permite eliminar student.
- La funcion permite eliminar premium personal archivando workspace personal.
- La funcion permite eliminar owner organization solo si queda otro owner.
- El profile queda `deleted`.
- Memberships quedan `revoked`.
- Opposition access queda `revoked`.
- Workspace personal queda `archived`.
- Usuario queda sin sesion.
- No se borran datos compartidos por accidente.
- No se expone `SUPABASE_SERVICE_ROLE_KEY`.
- Existe documentacion.
- Tests/verificaciones criticas pasan.

## 32. Prompt Para Claude

Claude, implementa la SPEC 026 - Supabase Edge Functions for Account Deletion.

Necesitamos implementar eliminacion segura de cuenta en TESTOPO.

Debes crear una Edge Function de Supabase o endpoint servidor equivalente para ejecutar operaciones privilegiadas que requieren service role.

Debes implementar:

1. Endpoint seguro de eliminacion de cuenta.
2. Validacion de autenticacion.
3. Confirmacion explicita.
4. Uso de `user_id` desde JWT, no desde el body.
5. Comprobacion de si el usuario es unico owner de workspace organization.
6. Soft delete del profile.
7. Revocacion de `workspace_members`.
8. Revocacion de `opposition_access`.
9. Archivado de workspace personal.
10. Borrado real o bloqueo del usuario Auth desde servidor.
11. Logout/redireccion en frontend.
12. UI minima en Account Settings.
13. Tests/verificaciones criticas.
14. Documentacion de account deletion.
15. Documentacion de Edge Functions.
16. Documentacion de uso de service role.

Reglas obligatorias:

- No uses service role en frontend.
- No pongas `SUPABASE_SERVICE_ROLE_KEY` con prefijo `VITE_`.
- No permitas borrar otra cuenta pasando `user_id`.
- Usa el `user_id` del JWT.
- Bloquea eliminacion si el usuario es unico owner de organization workspace.
- No archives organization workspace si quedan otros owners.
- No borres datos compartidos accidentalmente.
- No borres materiales/preguntas/tests en cascada en esta spec.
- Manten fallback InMemory para tests/dev.
- Documenta claramente que se borra, que se archiva y que se conserva.

No implementar:

- Exportacion avanzada de datos.
- Transferencia guiada de ownership.
- Pagos.
- OAuth.
- MFA.
- Beta readiness.

Objetivo:

Permitir que un usuario elimine su cuenta de forma segura sin comprometer workspaces, datos compartidos ni claves privadas.
