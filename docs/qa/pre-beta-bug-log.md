# Pre-Beta Bug Log (SPEC 027)

Registro de incidencias de la revision pre-beta. Plantilla por bug al final.

## Resumen de la revision

Revision automatica (modo memory: `npm test` backend + frontend) y revision de
codigo de los invariantes de [`pre-beta-release-blockers.md`](./pre-beta-release-blockers.md).

- **Backend**: 314+ tests en verde. **Frontend**: 56 en verde.
- **Blockers abiertos en cobertura automatica**: ninguno.
- **Gap conocido** (no bloqueante para beta cerrada): lectura directa de
  `is_correct` via API, ya documentado en
  [`../security/rls-known-gaps.md`](../security/rls-known-gaps.md). Tracking: BUG-001.
- **Plan RLS ejecutado contra staging (2026-06-18)**: las 17 comprobaciones de
  [`../security/rls-test-plan.md`](../security/rls-test-plan.md) (secciones 1-3:
  fallos esperados de student, exitos esperados de student, acciones de
  admin/owner) se ejecutaron con impersonacion JWT real (`set_config` +
  `set role authenticated`) contra el dataset ficticio de
  [`staging-rls-seed.sql`](./staging-rls-seed.sql). Resultado: todas pasan como
  se esperaba, sin hallazgos nuevos. Detalle reproducible en
  [`staging-rls-checks.sql`](./staging-rls-checks.sql).
- **Revision visual/manual Codex contra staging (2026-06-18)**: se recorrio
  Home/Auth, Admin, Student A/B y Account Deletion con capturas `smoke-027-*`.
  Resultado: BUG-002 abierto como blocker porque Student puede crear un test,
  pero `Empezar` no abre la pantalla de realizacion.

---

## BUG-001

### Summary

El alumno puede leer `is_correct` de `question_options`/`test_answers` via API
directa de Supabase (la RLS no oculta columnas). La UI nunca lo muestra antes de
enviar el test.

### Severity

- [ ] Blocker
- [x] High
- [ ] Medium
- [ ] Low

(High pero aceptado para beta cerrada: la UI no expone el dato; cierre
planificado antes de beta abierta.)

### Area

RLS / banco de preguntas / tests.

### Steps to reproduce

Como alumno autenticado, hacer `select is_correct from question_options` (o leer
`test_answers` propios) directamente con la clave anonima.

### Expected behavior

El alumno no deberia poder obtener la respuesta correcta antes de enviar.

### Actual behavior

La fila es legible (la RLS permite leer opciones de preguntas `validated`).

### Root cause

Arquitectura cliente-only: el navegador necesita leer las opciones para
responder; la RLS no puede ocultar una columna.

### Fix applied

Pendiente. Plan: RPC/vista `SECURITY DEFINER` que sirva opciones saneadas (sin
`is_correct`) y restringir `select` directo de `question_options` a gestores.

### Test added

N/A (cierre futuro). Cubierto a nivel UI por el flujo de test.

### Status

- [x] Open
- [ ] Fixed
- [x] Deferred (a beta abierta)

---

## BUG-002

### Summary

En staging, Student A puede crear un test con 1 pregunta validada, pero el boton
`Empezar` queda visible y habilitado sin abrir la pantalla de realizacion del
test. El flujo student no puede completarse desde UI.

### Severity

- [x] Blocker
- [ ] High
- [ ] Medium
- [ ] Low

### Area

Student Portal / Tests / Attempts.

### Steps to reproduce

1. Abrir `http://127.0.0.1:5173` apuntando a Supabase staging.
2. Login como `student-a.qa@testopo-fake.dev`.
3. Entrar en `QA Academia Ficticia`.
4. Entrar en `QA Aux Administrativo Ficticio A`.
5. Ir a `Crear test`.
6. Poner `Numero de preguntas = 1`.
7. Pulsar `Crear test`.
8. Pulsar `Empezar`.

### Expected behavior

La app debe abrir la pantalla `Realizar test`, permitir responder la pregunta,
enviar el intento y mostrar resultado/explicacion despues de submit.

### Actual behavior

El test aparece como `Creado` y el boton `Empezar` esta habilitado, pero al
pulsarlo no hay cambio visible de pantalla. No se muestra error en UI ni errores
de consola capturados por Playwright.

### Root cause

`App.tsx` desmonta el arbol autenticado entero (`<LoadingState />`) mientras
`accessReady` es `false` (linea 55-57). El efecto que calcula `accessReady` en
`StoreContext.tsx` dependia de `[store, currentUser, currentWorkspace,
version]`. `version` lo incrementa `refresh()`, que se llama por convencion
en toda la app tras cualquier mutacion del store (crear test, iniciar
intento, etc.) para forzar el re-render de listas que leen arrays no
reactivos.

Al pulsar `Empezar`, `TestsList.start()` hace `refresh()` y a continuacion
`onStart(attempt.id)`, que pone el estado local de `TestsPage` en `{kind:
'take', attemptId}`. React aplica ambos `setState` en el mismo batch, asi
que el primer render ya muestra `TakeTest`. Pero al confirmar ese render,
se ejecuta el efecto de `accessReady` (porque `version` cambio), que pone
`accessReady` en `false` mientras vuelve a pedir `getMemberRole` /
`hasStudyAccess` — datos que no han cambiado, porque ni el usuario ni el
workspace cambiaron. Con `accessReady=false`, `App.tsx` renderiza
`<LoadingState />`, desmontando `TestsPage` y perdiendo su estado local
`view`. Cuando la comprobacion async termina y `accessReady` vuelve a
`true`, `TestsPage` se remonta desde cero con `view: { kind: 'list' }`, asi
que la pantalla vuelve a la lista de tests sin ningun error visible (no es
una excepcion, es un remount legitimo).

El mismo patron afecta a `TakeTest.submit()` (linea ~210 de
`TestsPage.tsx`), que tambien llama `refresh()` justo antes de
`onSubmitted()`.

### Fix applied

`app/frontend/src/store/StoreContext.tsx`: se quita `version` de las
dependencias del efecto que calcula `accessReady`/`workspaceRole`/`canStudy`
(antes en la linea 140). Ese efecto solo necesita reevaluarse cuando cambia
el `store`, el usuario o el workspace activo — no cuando se llama
`refresh()` desde una pantalla cualquiera para refrescar listas locales. Se
anadio un comentario explicando la invariante para evitar que se reintroduzca
la dependencia.

No fue necesario tocar `TestsPage.tsx` ni los demas ~20 sitios que llaman
`refresh()`: el problema era el acoplamiento indebido en `StoreContext`, no
el uso de `refresh()` en si.

### Test added

`app/frontend/tests/smoke.test.tsx`: nuevo test "estudiante: crear test y
pulsar 'Empezar' abre 'Realizar test' (BUG-002)" que crea un test desde la
UI, pulsa `Empezar` y verifica que aparece la pantalla `Realizar test`. Sin
el fix, este test falla (se queda en la lista de tests). Confirmado: 57/57
tests de frontend en verde con el fix aplicado.

(Nota lateral, no relacionada con BUG-002: durante la investigacion, el
`app/frontend/.env.local` creado para apuntar el dev server a Supabase
staging se filtraba a `vitest` — Vite carga `.env.local` para cualquier
`mode`, incluido `test` — y rompia 9 tests del smoke suite que esperan modo
`memory`. Se renombro a `.env.staging.local` (cubierto igualmente por
`.env.*.local` en `.gitignore`); para levantar el dev server contra staging
usar `npm run dev -- --mode staging`.)

### Status

- [ ] Open
- [x] Fixed
- [ ] Deferred

---

## Plantilla (copiar para nuevos bugs)

```markdown
## BUG-NNN
### Summary
### Severity
- [ ] Blocker
- [ ] High
- [ ] Medium
- [ ] Low
### Area
### Steps to reproduce
### Expected behavior
### Actual behavior
### Root cause
### Fix applied
### Test added
### Status
- [ ] Open
- [ ] Fixed
- [ ] Deferred
```
