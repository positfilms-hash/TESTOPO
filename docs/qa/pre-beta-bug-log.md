# Pre-Beta Bug Log (SPEC 027)

Registro de incidencias de la revisión pre-beta. Plantilla por bug al final.

## Resumen de la revisión

Revisión automática (modo memory: `npm test` backend + frontend) y revisión de
código de los invariantes de [`pre-beta-release-blockers.md`](./pre-beta-release-blockers.md).

- **Backend**: 314+ tests en verde. **Frontend**: 56 en verde.
- **Blockers abiertos**: ninguno en la cobertura automática.
- **Gap conocido** (no bloqueante para beta cerrada): lectura directa de
  `is_correct` vía API — ya documentado en
  [`../security/rls-known-gaps.md`](../security/rls-known-gaps.md). Tracking: BUG-001.
- **Pendiente**: ejecutar guion manual + plan RLS contra staging (anotar aquí los
  hallazgos).

---

## BUG-001

### Summary
El alumno puede leer `is_correct` de `question_options`/`test_answers` vía API
directa de Supabase (la RLS no oculta columnas). La UI nunca lo muestra antes de
enviar el test.

### Severity
- [ ] Blocker
- [x] High
- [ ] Medium
- [ ] Low

(High pero **aceptado para beta cerrada**: la UI no expone el dato; cierre
planificado antes de beta abierta.)

### Area
RLS / banco de preguntas / tests.

### Steps to reproduce
Como alumno autenticado, hacer `select is_correct from question_options` (o leer
`test_answers` propios) directamente con la clave anónima.

### Expected behavior
El alumno no debería poder obtener la respuesta correcta antes de enviar.

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
