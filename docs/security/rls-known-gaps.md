# Gaps conocidos de RLS (SPEC 025)

No se ocultan limitaciones. Estado tras la SPEC 025.

## 1. `is_correct` legible por el alumno (opciones y respuestas)

**Qué pasa.** La RLS no puede ocultar columnas concretas de una fila. El alumno
puede leer:

- `question_options` de preguntas `validated` (incluye `is_correct`).
- `test_answers` de **sus** intentos (incluye `is_correct`, que se calcula al
  enviar).

Por tanto, un alumno con conocimientos podría leer `is_correct` vía API directa
**antes** de enviar el test.

**Por qué sigue abierto.** TESTOPO es hoy una app **cliente-only** (el navegador
habla con Supabase con la clave anónima y la sesión del usuario; no hay
servidor). El alumno necesita leer las opciones para responder, así que no se
puede bloquear la tabla sin romper el flujo.

**Mitigación actual.** La capa de servicio/UI nunca muestra `is_correct` ni la
explicación antes de `submit`; el resultado (correcto/incorrecto, explicación,
fuente) solo se revela tras enviar. Es un riesgo de **lectura directa por API**,
no de la UI.

**Plan de cierre.** Servir al alumno las preguntas del test mediante una
**vista/RPC `SECURITY DEFINER`** que devuelva opciones **sin** `is_correct` (y sin
explicación antes de submit), y restringir `SELECT` directo de `question_options`
a gestores. Requiere enrutar la lectura del flujo student por esa RPC (cambio en
la capa de acceso a datos). Se aborda en **beta readiness (SPEC 027)** o en una
spec dedicada, porque toca la arquitectura cliente-only.

## 2. Lectura agregada de resultados por admin

**Qué pasa.** `test_attempts` permite a los gestores del workspace leer intentos
para seguimiento; `test_answers` se restringe al dueño del intento. El producto
aún **no define** un flujo de "seguimiento de alumnos" completo (qué ve el admin
de los resultados ajenos).

**Estado.** Acceso conservador: el admin puede leer los `test_attempts` de su
workspace, pero las `test_answers` quedan restringidas al dueño. Cuando producto
defina el seguimiento, se ajustará la política de `test_answers`.

## 3. Las pruebas de RLS son manuales

Los tests automáticos corren en modo `memory` (sin RLS). La verificación de RLS
es manual contra un Supabase de staging — ver [`rls-test-plan.md`](./rls-test-plan.md).
Automatizarla (CI con un Supabase efímero) queda pendiente.
