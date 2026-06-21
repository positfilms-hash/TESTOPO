# Gaps conocidos de RLS (SPEC 025)

No se ocultan limitaciones. Estado tras la SPEC 025.

## 1. `is_correct` legible por el alumno (opciones y respuestas) — CERRADO (SPEC 029)

**Qué pasaba.** La RLS no puede ocultar columnas concretas de una fila, así que
el alumno podía leer `questions.correct_answer` y `question_options.is_correct`
de preguntas `validated` por API directa **antes** de enviar el test (la UI nunca
lo mostraba, pero la lectura directa con la clave anónima + su JWT seguía
abierta).

**Cómo se cierra (SPEC 029, migración `029_secure_test_question_access.sql`).**

- El alumno **deja de poder leer** las tablas base `questions`/`question_options`
  (sus políticas `*_select` pasan a **solo gestores**).
- El flujo de alumno (generar/responder un test) lee de **vistas seguras**
  `safe_questions` / `safe_question_options`, que solo exponen preguntas
  `validated` accesibles y **NO** incluyen `correct_answer`/`explanation`/
  `is_correct`. En la app lo sirve `SupabaseSafeQuestionRepository` (inyectado en
  `TestGeneratorService`/`TestAttemptService` solo en modo Supabase).
- **Corregir** y **revisar** (que sí necesitan la solución) se hacen con
  funciones **`SECURITY DEFINER`** `submit_attempt` / `get_attempt_review`, que
  validan que el intento es del `auth.uid()` y nunca devuelven la solución antes
  de enviar. En la app las usa `SupabaseStudentAttemptGateway` (vía
  `SupabaseClientPort.rpc`).

`test_answers.is_correct` es `null` hasta enviar (se calcula en `submit_attempt`),
y el alumno solo lee las de sus intentos (SPEC 024). En modo `memory`/demo no hay
RLS: la corrección la hace el gateway local en proceso (sin cambio de
comportamiento). La verificación de RLS/RPC es manual en staging
(ver [`rls-test-plan.md`](./rls-test-plan.md)).

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
