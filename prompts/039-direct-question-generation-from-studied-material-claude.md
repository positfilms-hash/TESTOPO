# Encargo para Claude — SPEC 039

Lee antes de editar, completos y en este orden:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/038-internal-material-study-flow-without-public-syllabus-index.md`
4. `docs/specs/039-direct-question-generation-from-studied-material.md`

Implementa la SPEC 039 en la rama `feature/direct-question-generation-from-studied-material`. No uses las SPEC 035–037 centradas en índice visible como base funcional; conserva sus garantías de seguridad cuando correspondan.

## Dirección técnica obligatoria

- Crea una Edge Function autenticada nueva: `generate-questions-from-studied-material`. No conviertas `generate-questions` ni el flujo por tema en una dependencia del camino nuevo.
- El contrato del frontend admite únicamente IDs y parámetros de alcance permitidos. Rechaza texto fuente, extractos, prompts, URLs, claves, IDs de usuario y cualquier contenido arbitrario enviado por cliente.
- En servidor, valida JWT, usuario, permiso de gestión, workspace, oposición, estudio completado/completado con avisos y cada material/unidad/concepto seleccionado antes de contactar al proveedor.
- Resuelve evidencia factual solo desde unidades/conceptos estudiados y sus secciones/referencias existentes en Supabase. No uses exámenes/preguntas antiguas como fuente factual; a lo sumo, como estilo secundario.
- No hagas obligatorio `topic_id`. Si el esquema o comprobaciones históricas necesitan texto de tema, deriva una etiqueta descriptiva desde la unidad/concepto, manteniendo `topic_id` nulo para este flujo.
- Persiste punteros trazables y un extracto que corresponda exactamente al puntero de cada pregunta. Toda candidata debe tener explicación y exactamente una opción correcta.
- Estado exclusivo: `pending_review` o `needs_fix`. Está prohibido escribir `validated`, publicar automáticamente o crear tests finales.
- Student, acceso revocado, cross-workspace y cross-opposition deben ser rechazados; Student no puede ver runs, fuentes internas ni candidatas.
- IA/proveedor/secretos exclusivamente en Edge Function/Supabase Secrets. No añadas claves, modelos hardcodeados o mocks que parezcan reales al frontend, repo, logs o staging/producción. Si falta proveedor, falla cerrado y no escribas filas engañosas.
- Mantén InMemory solo como fallback de desarrollo/pruebas explícito; jamás como simulación de staging/producción.
- No amplíes Auth/RLS ni introduzcas OCR, embeddings, RAG avanzado, fine-tuning o test automático.

## UX y documentación

Tras un material estudiado, la UI debe permitir “Generar preguntas” sin índice visible ni selector de tema obligatorio. Debe ofrecer alcance/material, cantidad y dificultad, mostrar progreso y explicar bloqueos reales. Añade arquitectura, guía de usuario y plan QA indicados en la SPEC.

## Verificación exigida

Incluye pruebas de:

1. generación positiva con evidencia concreta;
2. sin proveedor/sin configuración: bloqueo honesto y cero mocks;
3. sin estudio o sin fuentes: bloqueo claro;
4. IDs o scopes cruzados: rechazo;
5. Student: no invoca ni lista internas;
6. cada candidata con fuente, explicación y una única correcta;
7. ninguna candidata/ruta termina en `validated`;
8. test generator sigue filtrando solo validadas.

Ejecuta los tests pertinentes y build. Haz revisión visual a 1366×900 y 390×844 conforme al runbook. Entrega un resumen con archivos, migraciones manuales requeridas para staging, comandos de test/build, resultado real y bloqueos; no inventes smoke ni despliegue.
