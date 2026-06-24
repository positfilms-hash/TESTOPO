# Bootstrap atómico del primer workspace (RPC `create_workspace_with_owner`)

## El problema

Crear el **primer** workspace fallaba aunque perfil, grants y RLS estuvieran bien.
El bootstrap no era **atómico** y chocaba con la RLS:

1. La app insertaba el workspace con `.insert().select().single()`. Tras el
   `INSERT`, el actor **aún no es miembro**, así que la policy
   `workspaces_select_member` (RLS) **no le deja leer** la fila recién creada → el
   `.select().single()` fallaba.
2. La policy `members_insert_self_owner` consulta `public.workspaces` **bajo RLS**,
   así que **tampoco** podía verificar el workspace recién creado para permitir la
   membership.

Resultado: el flujo se rompía y la UI mostraba un genérico “revisa el slug
(duplicado)” que no era el problema real.

## La solución (mínima y atómica)

Migración **`034_create_workspace_rpc.sql`**: función
`public.create_workspace_with_owner(p_name, p_slug, p_type, p_plan)`,
**`SECURITY DEFINER`**, que crea el workspace y la membership `owner` en **una sola
transacción**:

- Deriva `auth.uid()` y exige sesión (`AUTH_REQUIRED` si no hay). **El `owner_id`
  lo fija el servidor** desde el JWT; el cliente **no** lo pasa → es imposible
  crear para otro owner.
- Valida solo los campos previstos (`name`, `slug`, `type`, `plan`).
- Si la membership fallara, la excepción **revierte también el workspace** → no
  quedan workspaces huérfanos.
- `unique_violation` → error específico `WORKSPACE_SLUG_ALREADY_EXISTS` (para que
  el frontend **solo** muestre “slug duplicado” ante un duplicado real, nunca ante
  un fallo de RLS).
- `EXECUTE` concedido **solo a `authenticated`** (ni `anon` ni `public`). Sin
  `service_role`, sin secretos. **No** cambia políticas RLS, Auth ni roles.

## Frontend

`app/frontend/src/workspaces/serverWorkspaceBootstrap.ts`:

- `shouldUseServerWorkspaceCreate()` → en modo Supabase, `WorkspacesGate` invoca la
  RPC (`getSupabase().rpc(...)`) en vez del insert por pasos. En InMemory/demo se
  mantiene el servicio en proceso.
- Envía **solo** `p_name`/`p_slug`/`p_type`/`p_plan` (nunca `owner_id`).
- Mapea errores a mensajes **específicos** (slug duplicado, sesión, genérico).

## Mejora UX (aparte)

- **Slug interno autogenerado** desde el nombre/título (`slugifyName`, con sufijo
  aleatorio para evitar colisiones) — **ya no es un campo editable** ni visible en
  `WorkspacesGate` ni en `OppositionsGate`.
- Los formularios de crear espacio/oposición van en `<form onSubmit>` → **Enter
  envía**.

## Verificación

- Frontend: `app/frontend/tests/serverWorkspaceBootstrap.test.ts` (campos enviados
  sin `owner_id`, plan por tipo, mapeo de errores, slug interno).
- SQL (operador, en staging): `docs/qa/create-workspace-rpc-verification.sql`
  (EXECUTE solo authenticated; workspace+membership atómicos; owner = actor;
  sin huérfanos).
- Rehidratación posterior: tras crear, `selectWorkspace(ws)` persiste la pista y la
  máquina de SPEC 036 continúa con normalidad.
