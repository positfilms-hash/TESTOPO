# Plan de pruebas: rehidratación de sesión y workspace (SPEC 036)

Frontend, sin red real (Supabase y `authService` mockeados donde aplica). No se
registran tokens ni datos de usuario.

## Tests automáticos (vitest)

### `app/frontend/tests/sessionHints.test.ts`

- Guarda/lee la pista por usuario con clave `testopo:last_*_id:<user_id>`; solo
  guarda el ID.
- Aísla pistas entre usuarios distintos.
- `clear*`/`clearSelectionHints` eliminan correctamente.
- userId vacío o valor ausente → `null`.

### `app/frontend/tests/sessionRehydration.test.tsx`

Con `isSupabaseConfigured` mockeado a `true` y `getCurrentProfile` controlado:

- **Sin sesión** → Login (no pantalla en blanco ni gate).
- **Sesión válida** → restaura el usuario y avanza al selector de workspaces
  (`Mis espacios`); **nunca** muestra Login.
- **Perfil `deleted`/`blocked`** → no rehidrata; queda en Login.

### Regresión `app/frontend/tests/smoke.test.tsx`

El flujo demo se actualizó a la **auto-selección** (un único workspace y una única
oposición sembrados): tras el login se llega directo al shell sin pulsar los gates.
Las 13 comprobaciones de navegación admin/estudiante siguen verdes.

## Cobertura de la máquina de estados

| Caso | Estado esperado |
| --- | --- |
| Arranque comprobando sesión | `booting` (`Cargando sesión…`), nunca Login |
| Sin/expirada sesión, logout | `signed_out` → Login; pistas del usuario limpiadas |
| Sesión válida | restaura perfil → workspaces autorizados |
| Perfil deleted/blocked | no rehidrata; Login |
| 1 workspace / 1 oposición | auto-selección |
| Varios sin pista válida | selector (no se elige el primero) |
| Pista inválida/revocada | se elimina; no se consulta como scope |
| Oposición de otro workspace en la pista | rechazada (aislamiento) |
| Gestor y estudiante | `ZoneChooser`; Student no restaura admin |
| Material/Temario/Preguntas/Tests | gated hasta `ready`; reciben la oposición correcta |

## Retest manual en staging (sesión real)

1. Login real; recargar la página → restaura perfil + workspace/oposición
   autorizados, sin volver a Login ni mostrar páginas vacías.
2. Manipular `localStorage` con un `last_workspace_id`/`last_opposition_id`
   inválido → se elimina y se muestra el selector/estado claro.
3. Workspace sin oposiciones → `Todavía no hay oposiciones en este workspace.`;
   usuario sin workspace → `No tienes ningún workspace disponible.`
4. Cambiar de workspace/oposición → el shell se remonta; no se ven datos del scope
   anterior.
5. Student: no puede restaurar ni navegar a Material/Temario/Preguntas/IA/Alumnos
   de administración.
6. Logout en otra pestaña (`SIGNED_OUT`) → la app vuelve a Login y limpia contexto.
7. Smoke visual (runbook de Codex) a 1366x900 y 390x844: recarga con sesión válida,
   selección inválida, sin workspace, sin oposición, Student y gestor.

> No incluir tokens de sesión ni datos reales de usuario en logs/capturas/docs.
