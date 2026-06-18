# SPEC 027 - Pre-Beta QA & Data Consistency

## 1. Objetivo

Realizar una revision completa de calidad, consistencia de datos y permisos antes de preparar la beta cerrada de TESTOPO.

Esta spec no debe anadir funcionalidades nuevas.

Su objetivo es comprobar que el MVP principal, ya migrado a Supabase, funciona de forma estable y segura.

## 2. Contexto

Specs previas relevantes:

- SPEC 020 - Supabase Repositories: Profiles & Workspaces.
- SPEC 021 - Supabase Repositories: Oppositions & Access.
- SPEC 022 - Supabase Repositories: Materials & Topics.
- SPEC 023 - Supabase Repositories: Questions & Options.
- SPEC 024 - Supabase Repositories: Tests, Attempts & Answers.
- SPEC 025 - Supabase RLS Hardening.
- SPEC 026 - Supabase Edge Functions for Account Deletion.

Despues de estas specs, el MVP principal deberia tener persistencia real en Supabase.

Ahora hay que comprobar que todo funciona unido.

## 3. Branch

```text
feature/pre-beta-qa-data-consistency
```

## 4. Principio Central

Antes de beta, no se debe priorizar anadir funciones.

Se debe priorizar:

- Estabilidad.
- Seguridad.
- Consistencia.
- Claridad.
- Confianza.

Regla central:

```text
Si una pregunta, test, resultado, usuario, workspace u oposicion puede mezclarse con datos ajenos, la beta no esta lista.
```

## 5. Alcance

Claude debe revisar y/o implementar:

- Tests de consistencia de datos.
- Tests de permisos criticos.
- Tests de RLS.
- Tests de flujos end-to-end.
- Fixtures de datos demo.
- Checklist manual pre-beta.
- Documentacion de QA.
- Correccion de bugs encontrados durante esta revision.
- Verificacion de fallback InMemory.
- Verificacion de modo Supabase.
- Verificacion de variables de entorno.
- Verificacion de que no hay claves expuestas.
- Verificacion de eliminacion de cuenta.
- Verificacion de generacion IA sin auto-validacion.
- Verificacion de que los tests solo usan preguntas validadas.

## 6. Fuera De Alcance

No implementar:

- Nuevas funcionalidades de producto.
- Pagos.
- Stripe.
- Ranking.
- Gamificacion.
- Estadisticas avanzadas.
- Repeticion espaciada.
- App movil.
- OCR.
- RAG avanzado.
- Embeddings.
- Marketplace.
- Comunidad.
- Nuevos roles complejos.
- Nuevas integraciones externas.
- Rediseno visual grande.

Esta spec es de estabilizacion y control.

## 7. Archivos Esperados

Crear o actualizar:

```text
docs/qa/pre-beta-qa-plan.md
docs/qa/pre-beta-data-consistency-checklist.md
docs/qa/pre-beta-permissions-checklist.md
docs/qa/pre-beta-bug-log.md
docs/qa/pre-beta-manual-test-script.md
docs/qa/pre-beta-release-blockers.md
```

Opcional:

```text
tests/fixtures/pre-beta-demo-data.md
```

Si el proyecto ya tiene una carpeta equivalente de fixtures, adaptarse a la estructura existente.

## 8. QA Plan

`docs/qa/pre-beta-qa-plan.md` debe explicar:

- Que se prueba.
- Por que se prueba.
- Que perfiles se usan.
- Que datos demo se necesitan.
- Que errores bloquean beta.
- Que errores pueden pasar a backlog.
- Como ejecutar tests.
- Como probar manualmente.

## 9. Perfiles De Prueba

Usar como minimo estos perfiles:

- Owner organizacion.
- Admin/manager organizacion.
- Student A.
- Student B.
- Premium individual.
- Usuario sin acceso.
- Usuario eliminado.

Cada perfil debe probarse de forma separada.

## 10. Datos Demo Minimos

Crear o documentar datos demo para:

- Workspace organizacion.
- Workspace personal.
- Oposicion A.
- Oposicion B.
- Material activo.
- Material obsolete.
- Topic activo.
- Topic obsolete.
- Pregunta draft.
- Pregunta pending_review.
- Pregunta needs_fix.
- Pregunta rejected.
- Pregunta obsolete.
- Pregunta validated.
- Test creado.
- Attempt in_progress.
- Attempt submitted.
- Attempt de otro usuario.

## 11. Consistencia De Datos

Crear checklist en:

```text
docs/qa/pre-beta-data-consistency-checklist.md
```

Debe comprobar:

### Workspaces

- No hay workspace sin owner.
- No hay workspace sin status.
- No hay workspace con slug duplicado si no esta permitido.
- No hay student con permisos de owner por error.

### Workspace Members

- No hay memberships duplicadas para mismo usuario/workspace.
- No hay memberships activas de usuarios deleted.
- No hay memberships sin profile.
- No hay owner unico eliminado.

### Oppositions

- No hay oposicion sin workspace.
- No hay oposicion con `workspace_id` invalido.
- No hay oposicion con slug duplicado dentro del mismo workspace.
- No hay `opposition_access` apuntando a oposicion inexistente.

### Materials

- No hay material sin `opposition_id`.
- No hay material con workspace distinto al workspace de su oposicion.
- No hay material activo asociado a oposicion archivada sin decision explicita.
- No hay `storage_path` publico inseguro.
- No hay material obsolete usado para validar nuevas preguntas.

### Topics

- No hay topic sin `opposition_id`.
- No hay topic con parent de otra oposicion.
- No hay ciclos en jerarquia.
- No hay topic siendo padre de si mismo.
- No hay topic obsolete usado para validar nuevas preguntas.

### Material-Topic Links

- No hay link entre material y topic de oposiciones distintas.
- No hay link duplicado.
- No hay link a material inexistente.
- No hay link a topic inexistente.

### Questions

- No hay pregunta sin `opposition_id`.
- No hay pregunta con workspace distinto al workspace de su oposicion.
- No hay pregunta validated sin explicacion.
- No hay pregunta validated sin fuente.
- No hay pregunta validated sin topic.
- No hay pregunta validated sin dificultad valida.
- No hay pregunta validated con cero opciones correctas.
- No hay pregunta validated con varias opciones correctas.
- No hay pregunta generada por IA naciendo como validated.
- No hay pregunta validated basada en material obsolete.
- No hay pregunta validated basada en topic obsolete.

### Tests

- No hay test sin `opposition_id`.
- No hay test con preguntas de otra oposicion.
- No hay test con preguntas no validated.
- No hay test con preguntas duplicadas.
- No hay `test_question` apuntando a pregunta inexistente.

### Attempts

- No hay attempt sin `user_id`.
- No hay attempt de usuario sin acceso a la oposicion.
- No hay attempt submitted sin `submitted_at`.
- No hay attempt submitted con contadores inconsistentes.
- No hay attempt visible para otro student.

### Answers

- No hay answer sin attempt.
- No hay answer a pregunta fuera del test.
- No hay answer con opcion de otra pregunta.
- No hay answer modificable tras submit.
- No hay answer visible para otro student.

## 12. Checklist De Permisos

Crear:

```text
docs/qa/pre-beta-permissions-checklist.md
```

### Student No Puede

- Entrar en `/admin`.
- Crear workspace organization.
- Crear oposicion.
- Subir material.
- Importar ZIP.
- Crear topic.
- Editar topic.
- Crear pregunta.
- Generar pregunta para banco admin si no procede.
- Revisar pregunta.
- Aprobar pregunta.
- Ver preguntas `pending_review`.
- Ver preguntas `draft`.
- Ver preguntas `needs_fix`.
- Ver preguntas `rejected`.
- Ver respuestas correctas antes de submit.
- Ver explicacion antes de submit.
- Ver results de otro usuario.
- Ver attempts de otro usuario.
- Eliminar cuenta de otro usuario.
- Darse acceso a una oposicion.
- Cambiar su rol.

### Student Si Puede

- Registrarse.
- Iniciar sesion.
- Restablecer contrasena.
- Ver oposiciones autorizadas.
- Ver material activo.
- Ver topic activo.
- Crear o iniciar test si tiene acceso.
- Responder test.
- Enviar test.
- Ver su resultado.
- Ver explicacion despues de submit.
- Eliminar su cuenta.

### Owner/Admin Puede

- Crear workspace permitido.
- Crear oposicion.
- Gestionar miembros.
- Dar acceso a estudiantes.
- Subir material.
- Importar ZIP.
- Crear topics.
- Generar indice IA.
- Revisar indice IA.
- Aplicar indice IA.
- Generar preguntas.
- Revisar preguntas.
- Aprobar preguntas validas.
- Crear tests.
- Ver datos de sus oposiciones.

### Owner/Admin No Puede

- Gestionar workspace ajeno.
- Ver datos de oposicion ajena.
- Cruzar materiales entre oposiciones.
- Cruzar preguntas entre workspaces.
- Aprobar preguntas invalidas.
- Usar service role desde frontend.

### Premium Individual Puede

- Crear workspace personal.
- Crear oposicion personal.
- Subir material propio.
- Crear indice IA.
- Generar preguntas propias.
- Revisar preguntas propias.
- Crear tests propios.
- Eliminar cuenta archivando workspace personal.

### Premium Individual No Puede

- Ver datos de otros usuarios.
- Gestionar workspaces organization ajenos.
- Aprobar preguntas de otros workspaces.

## 13. Flujos End-To-End Obligatorios

Crear:

```text
docs/qa/pre-beta-manual-test-script.md
```

### 13.1 Flujo Organizacion Completo

1. Owner crea workspace organization.
2. Owner crea oposicion.
3. Owner sube material.
4. Owner importa ZIP.
5. Owner crea indice IA.
6. Owner revisa/aprueba indice.
7. Owner genera preguntas.
8. Owner revisa preguntas.
9. Owner aprueba preguntas validas.
10. Owner anade Student A.
11. Student A entra.
12. Student A ve material activo.
13. Student A crea test.
14. Student A responde test.
15. Student A envia test.
16. Student A ve resultado.
17. Student A ve explicacion y fuente.

### 13.2 Flujo Student Aislado

1. Student A inicia sesion.
2. Student A ve solo sus oposiciones.
3. Student A no ve oposicion de Student B.
4. Student A crea test.
5. Student A responde parcialmente.
6. Student A envia.
7. Contadores `correct`/`incorrect`/`unanswered` son correctos.
8. Student A no puede editar tras submit.
9. Student A no puede ver attempt de Student B.

### 13.3 Flujo Premium Individual

1. Usuario crea workspace personal.
2. Crea oposicion personal.
3. Sube material.
4. Crea temario.
5. Genera preguntas.
6. Revisa preguntas.
7. Aprueba preguntas.
8. Crea test.
9. Realiza test.
10. Elimina cuenta.
11. Workspace personal queda archived.

### 13.4 Flujo Eliminacion Cuenta Organizacion

1. Owner unico intenta eliminar cuenta.
2. Sistema bloquea eliminacion.
3. Se anade segundo owner.
4. Primer owner elimina cuenta.
5. Workspace organization sigue activo.
6. Membership del owner eliminado queda revoked.
7. Profile queda deleted.

## 14. Revision De IA

Comprobar:

- OpenAI es proveedor principal configurable.
- Mock provider sigue funcionando.
- Las claves no estan hardcodeadas.
- La IA no genera preguntas validated.
- La IA no genera tests directos para student.
- La IA usa feedback si existe.
- La IA propone indice, pero no lo aplica sin revision.
- La IA no inventa temas sin base textual.
- El indice IA puede rechazarse.
- Las preguntas IA pueden rechazarse o marcarse `needs_fix`.

## 15. Revision De Supabase

Comprobar:

- Todas las migraciones se aplican en orden.
- El modo Supabase funciona.
- El modo memory sigue funcionando.
- El factory selecciona repositorios correctos.
- `.env.example` esta actualizado.
- `.env` no esta en repo.
- `SUPABASE_SERVICE_ROLE_KEY` no aparece en frontend.
- Edge Function de eliminacion usa service role solo en servidor.
- RLS esta activado.
- Politicas criticas pasan.

## 16. Tests Automaticos Recomendados

Claude debe anadir o reforzar tests para:

- Workspace boundary.
- Opposition boundary.
- Student permissions.
- Admin permissions.
- Question validation rules.
- AI generation status.
- Test generation only validated.
- Attempt ownership.
- Answer ownership.
- Account deletion.
- RLS critical cases.
- Factory memory/supabase.

Los tests que dependan de Supabase real pueden ser opcionales o marcados como integration tests.

Los tests unitarios deben seguir pasando sin Supabase real.

## 17. Bug Log

Crear:

```text
docs/qa/pre-beta-bug-log.md
```

Formato:

```markdown
# Pre-Beta Bug Log

## Bug ID

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

## 18. Release Blockers

Crear:

```text
docs/qa/pre-beta-release-blockers.md
```

Bloquean beta:

- Student accede a admin.
- Student ve preguntas no validadas.
- Student ve respuestas correctas antes de enviar.
- Student ve explicacion antes de enviar.
- Student ve resultado de otro usuario.
- Student puede modificar attempt submitted.
- Test incluye preguntas no validated.
- Test incluye preguntas de otra oposicion.
- Pregunta IA nace como validated.
- Pregunta invalida se aprueba.
- Material obsolete se usa para validar pregunta.
- Topic obsolete se usa para validar pregunta.
- Workspace se mezcla con otro.
- Opposition se mezcla con otra.
- Service role aparece en frontend.
- `.env` se sube al repo.
- RLS permite lectura indebida.
- Eliminacion de cuenta borra datos compartidos por error.
- Owner unico puede borrar cuenta y dejar organization sin owner.
- Registro/login/reset no funcionan.
- No se puede completar flujo student.
- No se puede completar flujo admin.

## 19. Severidad De Errores

### Blocker

Impide beta.

Ejemplos:

- Fuga de datos.
- Permisos rotos.
- Test con preguntas no validadas.
- Service role expuesta.

### High

Debe corregirse antes de beta salvo decision explicita.

Ejemplos:

- Flujo principal roto.
- Errores frecuentes en subida material.
- Resultados mal calculados.

### Medium

Puede entrar en backlog si no rompe confianza.

Ejemplos:

- Mensaje confuso.
- Estado vacio poco claro.
- Problema visual menor.

### Low

Pulido.

Ejemplos:

- Espaciado.
- Copy menor.
- Orden de botones.

## 20. Correccion De Bugs

Esta spec permite corregir bugs encontrados durante QA.

Pero no permite anadir funciones nuevas.

Correcto:

- Corregir que Student vea una pregunta `pending_review`.
- Corregir que un test incluya pregunta `obsolete`.
- Corregir contador de `unanswered`.
- Corregir RLS demasiado permisiva.

Incorrecto:

- Anadir ranking.
- Anadir estadisticas avanzadas.
- Anadir planes de estudio inteligentes.
- Anadir pagos.

## 21. Documentacion Final De Estado

Actualizar solo si hay cambios detectados durante QA:

```text
docs/architecture/persistence.md
docs/security/rls-policies.md
docs/security/account-deletion.md
docs/setup/supabase-setup.md
```

## 22. Relacion Con Beta Readiness

Esta spec no lanza la beta.

Prepara el terreno para:

```text
SPEC 028 - Beta Readiness
```

La SPEC 028 solo debe empezar cuando:

- No hay blockers abiertos.
- Los flujos principales pasan.
- Los permisos criticos pasan.
- La documentacion QA esta lista.

## 23. Criterios De Aceptacion

La tarea se considera completada cuando:

- Existe plan QA pre-beta.
- Existe checklist de consistencia de datos.
- Existe checklist de permisos.
- Existe script manual de pruebas.
- Existe bug log.
- Existe lista de release blockers.
- Se han ejecutado o documentado pruebas criticas.
- Se han corregido blockers encontrados.
- No se han anadido funcionalidades nuevas.
- El modo Supabase funciona.
- El modo InMemory funciona.
- Student no accede a datos internos.
- Admin no cruza workspaces.
- Tests solo usan preguntas validadas.
- Resultados son privados.
- Account deletion es segura.
- Service role no esta expuesta.
- La app queda preparada para SPEC 028 - Beta Readiness.

## 24. Prompt Para Claude

Claude, implementa la SPEC 027 - Pre-Beta QA & Data Consistency.

No anadas funcionalidades nuevas.

Debes revisar la app despues de la migracion principal a Supabase y crear una base solida de QA antes de la beta.

Debes crear o actualizar:

- `docs/qa/pre-beta-qa-plan.md`
- `docs/qa/pre-beta-data-consistency-checklist.md`
- `docs/qa/pre-beta-permissions-checklist.md`
- `docs/qa/pre-beta-bug-log.md`
- `docs/qa/pre-beta-manual-test-script.md`
- `docs/qa/pre-beta-release-blockers.md`

Debes anadir o reforzar tests para:

- Consistencia de datos.
- Permisos.
- RLS critica.
- Student Portal.
- Admin Portal.
- Generacion IA.
- Revision humana.
- Tests y resultados.
- Eliminacion de cuenta.
- Factory memory/supabase.

Puedes corregir bugs encontrados, especialmente si son blockers.

No implementes:

- Nuevas funcionalidades.
- Pagos.
- Ranking.
- Gamificacion.
- Estadisticas avanzadas.
- RAG.
- OCR.
- Embeddings.
- Beta readiness todavia.

Reglas obligatorias:

- Student no puede ver datos internos.
- Student no puede ver preguntas no validadas.
- Student no puede ver respuestas correctas antes de submit.
- Student no puede ver resultados de otro usuario.
- Admin no puede cruzar workspaces.
- Tests solo usan preguntas `validated`.
- Preguntas IA nunca nacen como `validated`.
- Account deletion no rompe datos compartidos.
- Service role no aparece en frontend.
- `.env` no esta en repo.
- Fallback InMemory sigue funcionando.
- Supabase mode sigue funcionando.

Objetivo:

```text
Dejar TESTOPO limpio, consistente y comprobado antes de preparar la SPEC 028 - Beta Readiness.
```
