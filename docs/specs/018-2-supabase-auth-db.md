# SPEC 018.2 - Supabase Auth & Database Foundation

## 1. Objetivo

Implementar autenticacion real y base de datos en Supabase para TESTOPO.

Esta spec debe permitir:

- Registro real de usuarios.
- Login real.
- Logout.
- Obtener usuario actual.
- Recuperacion de contrasena con "Has olvidado la contrasena?".
- Cambio de contrasena tras reset.
- Eliminacion o solicitud segura de eliminacion de cuenta.
- Conexion de la app con Supabase como base de datos.
- Preparacion de tablas minimas para perfiles, workspaces, oposiciones y permisos.

El usuario ya tiene cuenta de Supabase asociada a `positfilms@gmail.com`, pero ninguna credencial privada debe pedirse, hardcodearse ni subirse al repositorio.

## 2. Contexto

TESTOPO ya tiene una estructura de producto con:

```text
Workspace
  -> Opposition
       -> Material
       -> Topic
       -> Question
       -> Test
       -> TestAttempt
```

Tambien tiene dos grandes experiencias:

- Admin / Owner / Preparador.
- Student / Opositor.

Ahora necesitamos que esas experiencias funcionen con usuarios reales y persistencia real.

## 3. Branch

```text
feature/pre-beta-supabase-auth-db
```

## 4. Alcance

Claude debe implementar:

- Configuracion de Supabase.
- Cliente Supabase para frontend.
- Cliente Supabase server/admin si el stack lo requiere.
- Variables de entorno.
- `.env.example` seguro sin claves reales.
- Actualizacion de `.gitignore` si hace falta.
- Registro con email y contrasena.
- Login con email y contrasena.
- Logout.
- Sesion persistente.
- Obtener usuario actual.
- Pantalla o flujo de "Has olvidado la contrasena".
- Pantalla o flujo para establecer nueva contrasena.
- Eliminacion o solicitud segura de eliminacion de cuenta.
- Tabla `profiles`.
- Adaptacion minima de `User` al sistema Auth de Supabase.
- Preparacion o migracion inicial de tablas principales.
- Reglas basicas de seguridad.
- Tests o comprobaciones criticas.
- Documentacion de setup Supabase.

## 5. Fuera De Alcance

No implementar todavia:

- Login con Google.
- OAuth.
- Magic links como flujo principal.
- 2FA.
- Verificacion avanzada de email personalizada.
- Invitaciones por email.
- Pagos.
- Stripe.
- Suscripciones reales.
- Panel avanzado de cuenta.
- Auditoria avanzada.
- Exportacion de datos.
- Recuperacion compleja de cuenta.
- Multi-factor authentication.
- Funcionalidades de producto fuera de auth/base de datos.

Esta spec solo cubre autenticacion basica y base de datos inicial en Supabase.

## 6. Reglas De Seguridad Obligatorias

### 6.1 No Exponer Claves Privadas

Nunca exponer en frontend:

```text
SUPABASE_SERVICE_ROLE_KEY
```

La clave `service_role` solo puede usarse en servidor.

Debe revisarse que no aparezca en:

- Codigo frontend.
- Bundles frontend.
- Variables `VITE_*`.
- Logs.
- Documentacion con valores reales.
- Tests con valores reales.

### 6.2 Variables De Entorno

No hardcodear claves ni URLs.

Usar variables de entorno, por ejemplo:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DATABASE_URL
```

Los nombres exactos pueden adaptarse al stack.

### 6.3 Archivos `.env`

Los archivos `.env` no deben subirse al repositorio.

Actualizar `.gitignore` si hace falta:

```text
.env
.env.local
.env.production
```

Crear un ejemplo seguro:

```text
.env.example
```

El ejemplo debe contener nombres de variables y placeholders, nunca claves reales.

### 6.4 Contrasenas

- Nunca guardar contrasenas en tablas propias.
- No loguear contrasenas.
- No crear hashes manuales en la app.
- La autenticacion debe usar Supabase Auth.

### 6.5 Eliminacion De Cuenta

La eliminacion real de usuario en Supabase Auth debe hacerse de forma segura desde servidor.

No permitir que el frontend llame directamente a operaciones admin sensibles.

Para MVP puede implementarse una eliminacion logica segura:

- `profiles.status = deleted`.
- Revocar sesiones.
- Revocar o anonimizar accesos si procede.

## 7. Documentacion De Setup Supabase

Crear documentacion en:

```text
/docs/setup/supabase-setup.md
```

Debe explicar:

- Crear proyecto en Supabase.
- Copiar Project URL.
- Copiar anon public key.
- Configurar variables de entorno.
- Configurar redirect URL para reset password.
- Ejecutar migraciones SQL si aplica.
- Verificar que Auth email/password esta activado.
- Probar registro y login.
- No incluir claves reales.

## 8. Modelo De Usuario

Supabase Auth gestionara usuarios en:

```text
auth.users
```

Crear tabla publica complementaria:

```text
profiles
```

Campos recomendados:

```text
id
email
name
role
status
created_at
updated_at
```

`id` debe coincidir con el id del usuario en Supabase Auth.

### role

Valores permitidos:

- `admin`
- `student`

Si ya existe logica de `owner`, `admin`, `student` a nivel workspace, mantener:

- `profiles.role` como rol global simple.
- `workspace_members.role` para permisos dentro de workspace.

### status

Valores permitidos:

- `active`
- `inactive`
- `blocked`
- `deleted`

## 9. Tablas Minimas En Supabase

Si el proyecto ya tiene modelos equivalentes, adaptarlos a Supabase sin romper compatibilidad.

Tablas minimas recomendadas:

- `profiles`
- `workspaces`
- `workspace_members`
- `oppositions`
- `opposition_access`
- `materials`
- `topics`
- `questions`
- `question_options`
- `tests`
- `test_questions`
- `test_attempts`
- `test_answers`

No hace falta rehacer toda la logica si ya existe, pero Supabase debe quedar como base real de persistencia o como fundacion documentada y migrable segun el stack actual.

## 10. Migraciones

Crear carpeta si no existe:

```text
/supabase/migrations
```

Incluir migraciones SQL iniciales para:

- `profiles`
- `workspaces`
- `workspace_members`
- `oppositions`
- Relaciones minimas necesarias.

Si el proyecto usa ORM, adaptar la solucion manteniendo compatibilidad.

## 11. Row Level Security

Activar RLS en tablas sensibles si se implementa directamente en Supabase.

Regla general:

- Un usuario solo puede leer su propio perfil.
- Un usuario solo puede ver workspaces donde sea miembro.
- Un estudiante solo puede ver oposiciones autorizadas.
- Un estudiante no puede ver preguntas no validadas.
- Un estudiante no puede ver resultados de otros usuarios.

Si no se implementa RLS completa en esta spec:

- Documentar politicas necesarias.
- Asegurar permisos en capa servidor/servicios.
- No dejar tablas sensibles abiertas sin control.

## 12. Registro

Crear flujo de registro.

Campos:

- `name`
- `email`
- `password`
- `confirm_password`

Reglas:

- Email obligatorio.
- Password obligatoria.
- Password y confirmacion deben coincidir.
- Mostrar errores comprensibles.
- Crear usuario en Supabase Auth.
- Crear perfil en `profiles`.
- Crear workspace personal inicial si el producto lo requiere.
- Redirigir segun rol o estado.

Para el MVP, el registro puede crear por defecto:

- `role = student`

Si elegir plan complica, dejar `student` por defecto y documentar creacion premium/admin como accion interna o posterior.

## 13. Login

Crear flujo de login.

Campos:

- `email`
- `password`

Reglas:

- Mostrar errores comprensibles.
- Mantener sesion.
- Redirigir segun usuario:
  - Admin/owner -> zona admin.
  - Student -> zona student.
  - Usuario con varios accesos -> selector si ya existe.

## 14. Logout

Crear accion de cerrar sesion.

Debe:

- Cerrar sesion en Supabase.
- Limpiar estado local.
- Redirigir a login.

## 15. Usuario Actual

Crear funcion, hook o equivalente:

```text
getCurrentUser
useCurrentUser
requireAuth
```

Debe permitir:

- Saber si hay sesion.
- Saber perfil del usuario.
- Saber rol.
- Saber workspaces disponibles.
- Proteger rutas.

## 16. Recuperacion De Contrasena

Crear pantalla:

```text
/forgot-password
```

Texto visible:

```text
Has olvidado la contrasena?
Introduce tu email y te enviaremos un enlace para restablecerla.
```

Debe:

- Pedir email.
- Solicitar email de recuperacion a Supabase.
- Mostrar mensaje neutral.

Mensaje recomendado:

```text
Si existe una cuenta con ese email, recibiras un enlace para restablecer tu contrasena.
```

No revelar si el email existe o no.

## 17. Restablecer Contrasena

Crear pantalla:

```text
/reset-password
```

O ruta equivalente segun redirect configurado.

Debe:

- Recibir sesion/token de Supabase.
- Permitir introducir nueva contrasena.
- Confirmar nueva contrasena.
- Actualizar contrasena.
- Redirigir a login o zona privada.

Campos:

- `new_password`
- `confirm_new_password`

Validaciones:

- Password obligatoria.
- Confirmacion obligatoria.
- Ambas coinciden.
- Longitud minima razonable.

## 18. Eliminacion De Cuenta

Crear opcion:

```text
Eliminar cuenta
```

Ubicacion recomendada:

```text
Cuenta / Configuracion
```

Debe requerir confirmacion explicita.

Texto recomendado:

```text
Esta accion eliminara tu cuenta. Puede que algunos datos asociados se conserven de forma anonimizada o por motivos tecnicos. Esta accion no se puede deshacer.
```

Para el MVP:

- Permitir que el usuario solicite eliminar su cuenta.
- Marcar `profiles.status = deleted`.
- Revocar sesiones.
- Si se implementa eliminacion real en Supabase Auth, hacerla solo desde servidor usando clave segura.
- No borrar datos de workspaces de organizacion si el usuario es alumno y esos datos pertenecen a una academia.
- Si el usuario es owner de un workspace, bloquear eliminacion directa si deja el workspace sin owner.

Regla importante:

- No eliminar cuenta owner si existen workspaces sin otro owner/admin.

Error recomendado:

```text
ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED
```

## 19. Casos Especiales De Eliminacion

### Student

Puede eliminar su cuenta.

Efectos recomendados:

- Perfil marcado como `deleted`.
- Accesos a workspaces revocados o anonimizados.
- Intentos de test pueden conservarse anonimizados si hace falta.

### Premium Individual

Puede eliminar cuenta solo si:

- No hay procesos pendientes.
- Confirma eliminacion.
- Se decide que hacer con su workspace personal.

Para MVP:

- Marcar workspace personal como `archived`.
- Marcar perfil como `deleted`.

### Owner Organizacion

No puede eliminar cuenta si es el unico owner de un workspace organizacion.

Debe transferir ownership o anadir otro owner antes.

## 20. UI Necesaria

Crear o adaptar pantallas:

- `/register`
- `/login`
- `/forgot-password`
- `/reset-password`
- `/account`
- `/account/delete`

Si el stack usa otra estructura de rutas, adaptar.

## 21. UX

La autenticacion debe verse coherente con la identidad visual:

- Azul pastel.
- Blanco.
- Lineas negras finas.
- Titulos con Georgia.
- Texto general sans-serif.
- Formularios simples.
- Errores claros.
- No saturar la pantalla.

## 22. Errores Recomendados

- `AUTH_EMAIL_REQUIRED`
- `AUTH_PASSWORD_REQUIRED`
- `AUTH_PASSWORD_CONFIRMATION_REQUIRED`
- `AUTH_PASSWORDS_DO_NOT_MATCH`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_REGISTRATION_FAILED`
- `AUTH_LOGIN_FAILED`
- `AUTH_LOGOUT_FAILED`
- `AUTH_SESSION_REQUIRED`
- `AUTH_RESET_EMAIL_FAILED`
- `AUTH_PASSWORD_UPDATE_FAILED`
- `ACCOUNT_DELETE_CONFIRMATION_REQUIRED`
- `ACCOUNT_DELETE_FAILED`
- `ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED`
- `SUPABASE_NOT_CONFIGURED`

## 23. Mensajes Visibles Recomendados

- Cuenta creada correctamente.
- Has iniciado sesion.
- Has cerrado sesion.
- Si existe una cuenta con ese email, recibiras un enlace para restablecer tu contrasena.
- Tu contrasena se ha actualizado correctamente.
- Tu cuenta se ha eliminado correctamente.
- No puedes eliminar tu cuenta porque eres el unico propietario de un workspace.

## 24. Tests Obligatorios

Deben existir tests o comprobaciones para:

- Registro con email y password.
- Registro sin email falla.
- Registro sin password falla.
- Registro con passwords distintas falla.
- Login correcto.
- Login incorrecto.
- Logout.
- Usuario actual con sesion.
- Usuario no autenticado redirige a login.
- Student no accede a admin.
- Admin accede a admin.
- Forgot password muestra mensaje neutral.
- Reset password valida confirmacion.
- Delete account requiere confirmacion.
- Delete account bloquea owner unico de workspace.
- Service role key no esta expuesta en frontend.
- `.env` no se sube al repo.
- `.env.example` existe sin claves reales.

## 25. Criterios De Aceptacion

La tarea se considera completada cuando:

- Supabase queda configurado como base de autenticacion.
- Existen variables de entorno documentadas.
- Existe `.env.example`.
- Existe documentacion de setup Supabase.
- El usuario puede registrarse.
- El usuario puede iniciar sesion.
- El usuario puede cerrar sesion.
- La app puede obtener usuario actual.
- Las rutas privadas requieren sesion.
- Existe "Has olvidado la contrasena?".
- Existe restablecimiento de contrasena.
- Existe eliminacion o solicitud segura de eliminacion de cuenta.
- No se expone `service_role` en frontend.
- No se guardan contrasenas en tablas propias.
- La base de datos queda preparada en Supabase.
- No se rompen funcionalidades existentes.
- No se anaden funcionalidades fuera de esta spec.

