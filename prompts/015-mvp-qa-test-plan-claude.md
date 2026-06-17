# Claude Prompt - SPEC 015 MVP QA & Manual Test Plan

## Context

TESTOPO ya tiene specs de producto desde el banco de preguntas hasta frontend, workspaces, PDFs, student portal y separacion admin/student.

Esta SPEC 015 no debe crear funcionalidades nuevas. Debe preparar la documentacion y checklist para validar el MVP como usuario real.

Codex coordina y revisa. Claude implementa el codigo/docs, hace `git push` y abre PR.

## Spec

Implementa estrictamente:

```text
/docs/specs/015-mvp-qa-test-plan.md
```

Branch de trabajo:

```text
feature/mvp-qa-test-plan
```

## Product Goal

Tener una guia clara para saber si el MVP esta listo para usarse y que errores hay que detectar antes de seguir construyendo.

El plan debe cubrir dos flujos end to end:

- Admin/organizacion.
- Student/opositor.

## Scope

Crea como minimo:

- `/docs/qa/mvp-manual-test-plan.md`
- `/docs/qa/mvp-checklist.md`
- `/docs/qa/bug-report-template.md`

Opcional, si encaja con el stack:

- `/tests/fixtures/mvp-demo-data.md`
- Datos ficticios equivalentes para facilitar pruebas.

Tambien puedes hacer ajustes minimos para facilitar testing si son estrictamente necesarios, por ejemplo:

- Documentar comandos de test.
- Aclarar credenciales demo existentes.
- Asegurar que datos demo son claramente ficticios.
- Anadir instrucciones de smoke visual/manual.

## Out of Scope

No implementes:

- Nuevas funcionalidades de producto.
- Pagos.
- Ranking.
- Comunidad.
- Chat.
- Estadisticas avanzadas.
- Gamificacion.
- App movil nativa.
- Marketplace.
- Roles empresariales complejos.
- Automatizaciones comerciales.

Esta spec es QA/documentacion, no producto.

## Required QA Docs

### `/docs/qa/mvp-manual-test-plan.md`

Debe incluir flujos paso a paso:

- Admin - workspace y oposicion.
- Admin - material y PDF.
- Admin - temario.
- Admin - preguntas.
- Admin - acceso de estudiante.
- Student - entrada.
- Student - material.
- Student - test.
- Student - resultados.

Cada flujo debe incluir:

- Pasos.
- Resultado esperado.
- Riesgos o fallos a observar cuando aplique.

### `/docs/qa/mvp-checklist.md`

Debe incluir una checklist con secciones:

- Producto.
- Seguridad basica.
- UX.
- Permisos.
- Integridad de datos.
- PDF.
- Tests.

### `/docs/qa/bug-report-template.md`

Debe incluir una plantilla con:

- Resumen.
- Tipo.
- Rol usado.
- Pasos para reproducir.
- Resultado esperado.
- Resultado real.
- Capturas o detalles.
- Gravedad.
- Notas.

## Required Coverage

El plan debe cubrir:

- SPEC 001 - Question Bank.
- SPEC 002 - Material Upload & Source Registry.
- SPEC 003 - Topic Map.
- SPEC 004 - Question Generation Drafts.
- SPEC 005 - Question Validation & Quality Gate.
- SPEC 006 - Admin Review.
- SPEC 007 - Test Generator.
- SPEC 008 - Test Taking & Results.
- SPEC 009 - Basic MVP Frontend.
- SPEC 010 - Oppositions, Users & Access.
- SPEC 011 - Workspaces & Account Plans.
- SPEC 012 - PDF Material Upload.
- SPEC 013 - Student Portal.
- SPEC 014 - Admin/Student UI Separation & Navigation.

## Critical Manual Checks

Incluye explicitamente pruebas para:

- Student no puede acceder a admin.
- Student no puede subir material.
- Student no puede generar preguntas.
- Student no puede revisar preguntas.
- Student no puede aprobar preguntas.
- Student no puede ver preguntas no validadas.
- Student no puede ver resultados de otros estudiantes.
- Student solo ve oposiciones autorizadas.
- Student solo ve material activo.
- Admin puede gestionar workspace propio.
- Admin puede gestionar oposicion propia.
- Admin puede subir material.
- Admin puede generar, validar, revisar y aprobar preguntas.
- Premium individual puede gestionar su workspace personal.
- No se mezclan workspaces.
- No se mezclan oposiciones.
- No se mezclan preguntas, temas, materiales, tests ni intentos entre oposiciones.
- Tests solo usan preguntas `validated`.
- Respuestas correctas y explicaciones no aparecen antes de enviar.
- Resultados se calculan correctamente.
- Fuentes y explicaciones aparecen despues de enviar.
- PDFs se guardan fuera del repositorio o en carpeta ignorada.
- PDFs invalidos, vacios o demasiado grandes se rechazan.
- PDF escaneado/no extraible muestra aviso claro.

## Demo Data Rules

Si anades fixtures o datos demo:

- Deben ser ficticios.
- No usar temarios reales.
- No usar contenido legal sensible real.
- Marcar claramente que son datos de prueba.

Datos recomendados:

- Admin Demo: `admin@testopo.local`
- Student Demo: `student@testopo.local`
- Premium Demo: `premium@testopo.local`
- Workspace: `Academia Demo`
- Workspace personal: `Mi preparacion personal`
- Oposicion: `Oposicion Demo - Administrativo`
- Materiales ficticios: `Tema Demo 1`, `Tema Demo 2`
- Preguntas ficticias sobre conceptos, plazos u organos inventados.

## Blocking Bugs

Marca como bloqueante cualquier error que permita:

- Student accede a admin.
- Student ve preguntas no validadas.
- Test incluye preguntas no validadas.
- Test muestra respuestas antes de enviar.
- Pregunta invalida se aprueba sin control.
- Se mezclan datos entre oposiciones.
- Se mezclan datos entre workspaces.
- Student ve resultados de otro usuario.
- Material privado queda expuesto sin permiso.
- PDF se guarda dentro del repositorio.

## Expected Output

Claude debe entregar:

- Documentos QA creados en `/docs/qa`.
- Datos ficticios de prueba o documentacion de datos demo si procede.
- Ajustes minimos para facilitar testing, solo si son necesarios y no crean producto nuevo.
- Tests existentes pasando si se toca codigo.
- `git push` de la rama.
- PR abierto al remoto.

En la descripcion del PR, incluye:

- Resumen de documentos creados.
- Como usar el plan de QA.
- Tests/comandos ejecutados.
- Confirmacion explicita de que no se implementaron funcionalidades nuevas fuera del MVP.
