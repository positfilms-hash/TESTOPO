# Claude Prompt - SPEC 018.2 Supabase Auth & Database Foundation

## Context

TESTOPO necesita autenticacion real y persistencia real antes de la beta.

El usuario ya tiene cuenta de Supabase asociada a `positfilms@gmail.com`, pero no debes pedir ni incluir credenciales reales en el codigo. Todo debe ir en variables de entorno y documentacion segura.

Codex coordina y revisa. Claude implementa el codigo, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/018-2-supabase-auth-db.md
```

Branch de trabajo:

```text
feature/pre-beta-supabase-auth-db
```

## Product Goal

Anadir a TESTOPO:

- Registro real con email y contrasena.
- Login real.
- Logout.
- Sesion persistente.
- Usuario actual.
- Recuperacion de contrasena.
- Restablecimiento de contrasena.
- Eliminacion o solicitud segura de eliminacion de cuenta.
- Conexion con Supabase como base de datos.
- Fundacion de tablas para perfiles, workspaces, oposiciones y permisos.

## Non-Negotiable Security Rules

No hardcodees credenciales.

No subas archivos `.env`.

Nunca expongas en frontend:

```text
SUPABASE_SERVICE_ROLE_KEY
```

La `service_role` key:

- Solo puede existir en variables de entorno de servidor.
- Nunca debe tener prefijo `VITE_`.
- Nunca debe importarse en codigo frontend.
- Nunca debe aparecer en bundles frontend.
- Nunca debe aparecer en logs, tests o docs con valor real.

El frontend solo puede usar:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

O nombres equivalentes publicos segun el stack.

No guardes contrasenas en tablas propias. Supabase Auth debe gestionar credenciales.

La eliminacion real de usuario Auth, si se implementa, debe hacerse solo desde servidor.

## Environment Variables

Crea o actualiza:

```text
.env.example
```

Debe incluir placeholders seguros, por ejemplo:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-server-only
SUPABASE_DATABASE_URL=postgresql://...
```

Comprueba que `.gitignore` excluye:

```text
.env
.env.local
.env.production
```

No incluyas claves reales.

## Supabase Setup Documentation

Crea:

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
- Verificar Auth email/password.
- Probar registro y login.
- No incluir claves reales.

## Auth Flows Required

Implementa:

- `/register`
- `/login`
- `/forgot-password`
- `/reset-password`
- `/account`
- `/account/delete`

Si el stack usa otra estructura de rutas, adapta sin romper navegacion existente.

### Register

Campos:

- `name`
- `email`
- `password`
- `confirm_password`

Reglas:

- Email obligatorio.
- Password obligatoria.
- Confirmacion obligatoria.
- Passwords deben coincidir.
- Crear usuario en Supabase Auth.
- Crear perfil en `profiles`.
- Rol por defecto `student`, salvo que el modelo actual tenga una convencion mejor documentada.
- Errores comprensibles.

### Login

Campos:

- `email`
- `password`

Reglas:

- Login contra Supabase Auth.
- Mantener sesion.
- Redirigir segun rol/acceso:
  - Admin/owner -> zona admin.
  - Student -> zona student.
- Errores comprensibles.

### Logout

Debe:

- Cerrar sesion en Supabase.
- Limpiar estado local.
- Redirigir a login.

### Current User

Crea o adapta:

```text
getCurrentUser
useCurrentUser
requireAuth
```

Debe permitir:

- Saber si hay sesion.
- Saber perfil.
- Saber rol.
- Saber workspaces disponibles.
- Proteger rutas privadas.

### Forgot Password

Pantalla:

```text
/forgot-password
```

Debe mostrar mensaje neutral:

```text
Si existe una cuenta con ese email, recibiras un enlace para restablecer tu contrasena.
```

No revelar si el email existe.

### Reset Password

Pantalla:

```text
/reset-password
```

Debe:

- Recibir sesion/token de Supabase.
- Pedir nueva contrasena.
- Pedir confirmacion.
- Validar coincidencia.
- Actualizar contrasena.
- Redirigir a login o zona privada.

### Delete Account

Ubicacion recomendada:

```text
/account/delete
```

Debe:

- Requerir confirmacion explicita.
- Marcar `profiles.status = deleted` o hacer solicitud segura de eliminacion.
- Revocar sesion.
- Bloquear eliminacion si el usuario es unico owner de un workspace.

Error recomendado:

```text
ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED
```

No permitas que el frontend ejecute operaciones admin sensibles directamente.

## Database Foundation

Supabase Auth gestiona usuarios en:

```text
auth.users
```

Crea tabla publica complementaria:

```text
profiles
```

Campos recomendados:

- `id`
- `email`
- `name`
- `role`
- `status`
- `created_at`
- `updated_at`

`profiles.id` debe coincidir con `auth.users.id`.

Tablas minimas recomendadas para preparar Supabase:

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

Si ya existen modelos equivalentes, adapta la solucion manteniendo compatibilidad.

## Migrations

Crea carpeta si no existe:

```text
/supabase/migrations
```

Incluye migraciones SQL iniciales para:

- `profiles`
- `workspaces`
- `workspace_members`
- `oppositions`
- Relaciones minimas necesarias.
- Politicas RLS basicas si se aplican directamente.

Si el proyecto usa ORM, manten compatibilidad con el stack existente.

## Row Level Security

Activa RLS en tablas sensibles si se implementa directamente en Supabase.

Reglas objetivo:

- Un usuario solo puede leer su propio perfil.
- Un usuario solo puede ver workspaces donde sea miembro.
- Un estudiante solo puede ver oposiciones autorizadas.
- Un estudiante no puede ver preguntas no validadas.
- Un estudiante no puede ver resultados de otros usuarios.

Si no puedes implementar RLS completa en esta spec:

- Documenta claramente las politicas pendientes.
- Refuerza permisos en capa servidor/servicios.
- No dejes tablas sensibles abiertas sin control.

## UX

El flujo de auth debe respetar la identidad visual:

- Azul pastel.
- Blanco.
- Lineas negras finas.
- Titulos con Georgia.
- Texto general sans-serif.
- Formularios simples.
- Errores claros.
- Pantallas no saturadas.

No anadas funcionalidades fuera de auth/base de datos.

## Out Of Scope

No implementes:

- Google login.
- OAuth.
- 2FA.
- Magic links como flujo principal.
- Invitaciones por email.
- Pagos.
- Stripe.
- Suscripciones reales.
- Panel avanzado de cuenta.
- Auditoria avanzada.
- Exportacion de datos.
- Recuperacion compleja de cuenta.
- Nuevas funcionalidades de producto no relacionadas con esta mini spec.

## Required Tests Or Checks

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
- `SUPABASE_SERVICE_ROLE_KEY` no esta expuesta en frontend.
- `.env` no se sube al repo.
- `.env.example` existe sin claves reales.

Ejecuta tambien los tests/build existentes del proyecto.

## PR Expectations

En la descripcion del PR incluye:

- Resumen de cambios.
- Variables de entorno necesarias, sin valores reales.
- Migraciones creadas.
- Como ejecutar setup Supabase.
- Confirmacion explicita de que no hay claves reales.
- Confirmacion explicita de que `service_role` no se usa en frontend.
- Checks ejecutados.
- Funcionalidades fuera de alcance no implementadas.

## Acceptance Criteria

- Supabase queda configurado como base de autenticacion.
- Existen variables de entorno documentadas.
- Existe `.env.example` sin claves reales.
- Existe `/docs/setup/supabase-setup.md`.
- El usuario puede registrarse.
- El usuario puede iniciar sesion.
- El usuario puede cerrar sesion.
- La app puede obtener usuario actual.
- Las rutas privadas requieren sesion.
- Existe flujo de "Has olvidado la contrasena?".
- Existe restablecimiento de contrasena.
- Existe eliminacion o solicitud segura de eliminacion de cuenta.
- No se expone `service_role` en frontend.
- No se guardan contrasenas en tablas propias.
- La base de datos queda preparada en Supabase.
- No se rompen funcionalidades existentes.
- No se anaden funcionalidades fuera de esta spec.

