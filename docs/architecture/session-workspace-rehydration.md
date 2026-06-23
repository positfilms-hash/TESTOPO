# Rehidratación de sesión y workspace (SPEC 036)

Hace **determinista** el arranque tras recargar o volver con una sesión de
Supabase válida. La app restaura, en orden, el usuario autenticado, su perfil, el
workspace autorizado, el rol/acceso aplicable y la oposición seleccionada **antes**
de renderizar una página dependiente de contexto. La selección local es solo una
conveniencia; **los datos autorizados por Supabase son la autoridad**.

No se sustituye Supabase Auth ni se crea un segundo sistema de contexto: se adapta
el store/bootstrap existente (`StoreContext`) reutilizando `WorkspaceService.
listForUser`, `OppositionService.listForUser`/`listStudyOppositions` y los checks
de rol/acceso actuales.

## Máquina de estados

```text
booting            ← comprobando la sesión de Supabase (nunca Login aquí)
  → signed_out     ← sin sesión: Login
  → loading_workspaces
  → selecting_workspace   ← varios sin pista válida (o ninguno): gate
  → resolving_access      ← rol/estudio del workspace (async)
  → selecting_zone        ← gestor Y estudiante: ZoneChooser
  → no_access             ← sin rol útil en el workspace
  → loading_oppositions
  → selecting_opposition  ← varias sin pista válida (o ninguna): gate
  → ready                 ← usuario + workspace + zona + oposición válidos
  → error
```

`App` renderiza según `phase` (expuesta por `useStore`):

| phase | UI |
| --- | --- |
| `booting` | `Cargando sesión…` |
| `signed_out` | Login |
| `loading_workspaces` / `resolving_access` | `Preparando tu espacio…` |
| `selecting_workspace` | `WorkspacesGate` |
| `selecting_zone` | `ZoneChooser` |
| `loading_oppositions` | `Cargando oposición…` |
| `selecting_opposition` / `no_access` | `OppositionsGate` |
| `ready` | `AppShell` |
| `error` | mensaje de error |

Material, Temario, Preguntas y Tests solo se montan en `ready`: **nunca** aparece
una página vacía falsa mientras el contexto se resuelve.

## Pistas de selección persistidas (no autoritativas)

`localStorage`, con clave por usuario (`sessionHints.ts`):

```text
testopo:last_workspace_id:<user_id>
testopo:last_opposition_id:<user_id>
```

Reglas:

- Solo se guarda el **ID** de la última selección. Nunca tokens, roles, datos de
  perfil ni secretos.
- Una pista de workspace se restaura **solo** si aparece en la lista de workspaces
  autorizados de la sesión actual; si no, se elimina.
- Una pista de oposición se restaura **solo** si pertenece al workspace elegido y
  es visible para el actor según los servicios/RLS existentes (y según la zona);
  si no, se elimina.
- **Auto-selección**: si hay exactamente **uno** válido (workspace u oposición) y
  no hay pista válida previa, se selecciona automáticamente. Con **varios** y sin
  pista válida se muestra el selector (no se elige el primero).
- Seleccionar un workspace descarta la oposición y la pista de oposición previas y
  reelige zona. Seleccionar una oposición persiste solo su ID.
- `Cambiar espacio` limpia las pistas del usuario (para volver a elegir).
- Logout, `SIGNED_OUT` del proveedor, o perfil `deleted`/`blocked` limpian el
  contexto y las pistas del usuario.

## Invariantes de aislamiento de datos

- Nunca se usa un ID de workspace/oposición viejo solo porque esté en
  `localStorage`: se valida primero contra los resultados autorizados.
- Nunca se muestran datos de otro workspace/oposición durante una transición; el
  shell se remonta (`key` por zona/oposición) al cambiar de scope validado.
- El Student no restaura zona/páginas de administración: la zona efectiva se
  recomputa desde el rol real del workspace; la restaurada nunca es autoritativa.
- La RLS sigue siendo el backstop. Este SPEC **no** añade cliente service-role ni
  bypass de cliente, ni cambia Auth, permisos, RLS, OCR, generación ni Edge
  Functions.

## InMemory / demo

Sin Supabase configurado no hay sesión: el arranque queda `signed_out` y el login
en memoria fija el usuario; con el workspace/oposición únicos sembrados, la
rehidratación los auto-selecciona (comportamiento determinista equivalente).

## Retest manual en staging

Con una sesión válida en staging, comprobar: recarga restaura perfil + solo un
workspace/oposición autorizados; pista inválida/revocada se elimina y no se
consulta; varias opciones → selector; cero → estado claro; Student no restaura
admin; sin filtración de tokens/datos en logs. Plan:
[`../qa/session-workspace-rehydration-test-plan.md`](../qa/session-workspace-rehydration-test-plan.md).
