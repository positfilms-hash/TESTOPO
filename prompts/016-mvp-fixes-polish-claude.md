# Claude Prompt - SPEC 016 MVP Fixes & Polish

## Context

TESTOPO ya tiene specs de producto y QA hasta SPEC 015.

Esta SPEC 016 es de estabilizacion: corregir bugs, pulir UX basica y dejar el MVP listo para pruebas mas amplias.

Codex coordina y revisa. Claude implementa el codigo/docs, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/016-mvp-fixes-polish.md
```

Branch de trabajo:

```text
feature/mvp-fixes-polish
```

## Required QA Review

Antes de cambiar codigo, revisa los resultados y documentos de SPEC 015:

- `/docs/qa/mvp-manual-test-plan.md`
- `/docs/qa/mvp-checklist.md`
- `/docs/qa/bug-report-template.md`
- `/docs/qa/mvp-demo-data.md` si existe

Usa esos documentos para priorizar correcciones.

## Product Goal

Dejar el MVP estable, claro y usable para pruebas mas amplias.

No crear producto nuevo. Mejorar lo existente.

## Scope

Trabaja sobre:

- Bugs detectados en QA.
- Errores de permisos.
- Errores de navegacion.
- Problemas de flujo admin.
- Problemas de flujo student.
- Problemas de generacion de tests.
- Problemas de resultados.
- Problemas de revision de preguntas.
- Problemas de subida o consulta de material.
- Problemas de PDF.
- Mensajes de error poco claros.
- Estados vacios.
- Ajustes visuales basicos.
- Inconsistencias de idioma o encoding visible.
- Tests automaticos rotos o insuficientes.
- Documentacion de bugs corregidos.

## Out of Scope

No implementes:

- Pagos.
- Suscripciones.
- Stripe.
- Marketplace.
- Ranking.
- Comunidad.
- Chat.
- Gamificacion.
- Estadisticas avanzadas.
- Plan de estudio inteligente.
- Repeticion espaciada.
- App movil nativa.
- Roles empresariales complejos.
- Analitica avanzada.
- OCR.
- RAG avanzado.
- Indexacion vectorial.
- Generacion automatica sin revision humana.
- Funcionalidades grandes nuevas fuera del MVP.

## Priority Order

### Priority 1 - Blocking

Corrige primero cualquier bug que permita:

- Student accede a admin.
- Student ve preguntas no validadas.
- Student genera, edita, revisa o aprueba preguntas.
- Test incluye preguntas no validadas.
- Test muestra respuestas correctas antes de enviar.
- Test muestra explicaciones antes de enviar.
- Student ve oposiciones no autorizadas.
- Student ve resultados de otro estudiante.
- Se mezclan datos entre workspaces.
- Se mezclan datos entre oposiciones.
- Pregunta invalida se aprueba.
- PDF privado queda accesible sin permisos.
- App no permite completar flujo principal admin o student.

### Priority 2 - Functional

Corrige despues:

- No se puede subir material.
- No se puede subir PDF.
- No se puede crear tema.
- No se puede generar pregunta desde material valido.
- No se puede aprobar pregunta valida.
- No se puede crear test con preguntas suficientes.
- Resultados mal calculados.
- Faltan explicaciones o fuentes despues de enviar.
- Estados no se actualizan correctamente.

### Priority 3 - UX

Mejora:

- Navegacion confusa.
- Admin y student poco diferenciados.
- Demasiados botones.
- Acciones duplicadas.
- Mensajes tecnicos.
- Estados vacios poco claros.
- Formularios largos o desordenados.
- Etiquetas internas visibles.

### Priority 4 - Visual polish

Pulir:

- Espaciado.
- Jerarquia visual.
- Botones principales.
- Badges.
- Tarjetas.
- Consistencia de colores.
- Consistencia de idioma.

## Security/Product Rules To Preserve

- Student no accede a admin.
- Student no ve preguntas no validadas.
- Student no genera, edita, revisa ni aprueba preguntas.
- Tests solo usan preguntas `validated`.
- Respuestas correctas ocultas hasta enviar.
- Explicaciones ocultas hasta enviar.
- Student solo ve oposiciones autorizadas.
- Student solo ve sus propios resultados.
- No se mezclan workspaces.
- No se mezclan oposiciones.
- PDFs privados no se exponen sin permiso.
- Preguntas generadas nunca pasan a `validated` automaticamente.
- Pregunta validada debe tener fuente.
- Pregunta validada debe tener explicacion.
- Pregunta validada debe tener exactamente una respuesta correcta.
- Pregunta validada debe tener tema.
- Pregunta validada debe tener dificultad.
- Oposicion pertenece a workspace.
- Material pertenece a oposicion.

## UX Polish Guidelines

- Una accion principal por pantalla.
- Botones secundarios menos destacados.
- Acciones destructivas con confirmacion.
- No mostrar botones que el usuario no puede usar.
- Sustituir errores tecnicos por mensajes comprensibles.
- Evitar lenguaje interno visible al usuario final:
  - `draft`
  - `pending_review`
  - `needs_fix`
  - `validated`
  - `source object`
  - `attempt`
  - `payload`
- Usar textos en espanol:
  - Borrador
  - Pendiente de revision
  - Necesita correccion
  - Validada
  - Fuente
  - Intento
  - Resultado
- Corregir mojibake o problemas de encoding si aparecen en UI o docs.

## Required Flow Review

Comprueba y corrige, si falla:

Admin:

- Crear workspace.
- Crear oposicion.
- Subir material.
- Subir PDF.
- Ver texto extraido.
- Crear temas.
- Generar preguntas.
- Validar preguntas.
- Revisar preguntas.
- Aprobar preguntas validas.
- Bloquear aprobacion de preguntas invalidas.
- Dar acceso a estudiante.
- Revocar acceso a estudiante.

Student:

- Ver solo oposiciones autorizadas.
- Entrar en oposicion.
- Ver material activo.
- No ver material obsoleto.
- Crear test.
- Realizar test.
- Cambiar respuestas antes de enviar.
- Enviar test.
- Ver resultado.
- Ver explicacion.
- Ver fuente.
- No acceder a zona admin.

## Tests

Debes:

- Ejecutar tests existentes.
- Corregir tests rotos.
- Anadir tests de regresion para bugs corregidos.
- Mantener tests de specs anteriores en verde.
- Cada bug corregido debe tener test si es razonable.

Comandos esperados, adapta si el repo difiere:

```bash
cd app/backend && npm run typecheck
cd app/backend && npm test
cd app/frontend && npm run build
cd app/frontend && npm test
```

## Fixes Log

Crea o actualiza:

```text
/docs/qa/mvp-fixes-log.md
```

Debe documentar cada bug corregido con:

- Resumen.
- Gravedad.
- Area afectada.
- Causa.
- Solucion.
- Test añadido o razon si no aplica.

## Acceptance Criteria

La implementacion esta lista cuando:

- Errores bloqueantes detectados en QA corregidos.
- Sin funcionalidades nuevas fuera del MVP.
- Navegacion admin/student clara.
- Student no accede a funciones admin.
- Student solo ve contenido autorizado.
- Tests solo usan preguntas validadas.
- No se muestran respuestas antes de enviar.
- Resultados correctos.
- Mensajes mas claros.
- Estados vacios utiles.
- Interfaz mas limpia.
- Tests automaticos pasan.
- `/docs/qa/mvp-fixes-log.md` existe y documenta cambios.

## Expected Output

Claude debe entregar:

- Correcciones implementadas en `feature/mvp-fixes-polish`.
- Tests nuevos o ajustados para regresiones.
- `/docs/qa/mvp-fixes-log.md`.
- Tests ejecutados y resultado.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Lista de bugs corregidos por prioridad.
- Tests ejecutados.
- Riesgos o decisiones.
- Confirmacion explicita de que no se implementaron funcionalidades grandes nuevas ni cosas fuera de alcance.
