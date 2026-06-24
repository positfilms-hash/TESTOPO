# SPEC 040 — AI Reliability Engine & Feedback Memory

**Estado:** propuesta de implementación  
**Rama:** `feature/ai-reliability-feedback-memory`  
**Base:** SPEC 038 (material estudiado) y SPEC 039 (candidatas directas desde material estudiado).

## Decisión y objetivo

TESTOPO incorpora una memoria de calidad basada en revisión humana, no aprendizaje mágico: el sistema registra por qué una candidata se rechaza, corrige o valida, resume patrones dentro del mismo workspace y oposición, y los pasa como instrucciones de calidad limitadas a futuras generaciones.

La evidencia factual sigue siendo únicamente el material estudiado. La memoria nunca es fuente, nunca valida una pregunta ni publica un test.

```text
Pregunta con fuente -> revisión humana -> feedback estructurado
  -> memoria aislada workspace/oposición -> próxima generación
  -> instrucciones de calidad + misma evidencia factual de material
```

## Alcance pequeño y seguro

1. Reutilizar y completar las tablas ya existentes `question_reviews`, `question_review_feedback`, `ai_error_memories`, `ai_question_quality_scores` y `question_generation_runs`; no duplicarlas.
2. Registrar feedback y señales de resultado dentro de las acciones de revisión humanas existentes.
3. Crear/actualizar memoria resumida solo en el mismo `workspace_id` + `opposition_id`.
4. Inyectar una selección acotada de memorias relevantes solo en `generate-questions-from-studied-material` (SPEC 039), como consejos de calidad secundarios.
5. Exponer métricas agregadas mínimas a gestión, calculadas bajo demanda o mediante una consulta/servicio acotado.
6. Mantener fallback InMemory con el mismo aislamiento para desarrollo y tests; no aparentar aprendizaje real en staging/producción.

## Tipos y severidad

Formalizar un catálogo único, validado en servidor y cliente:

`ambiguous_question`, `multiple_correct_answers`, `wrong_correct_answer`, `weak_distractors`, `too_easy`, `too_hard`, `difficulty_mismatch`, `source_missing`, `source_insufficient`, `source_mismatch`, `explanation_missing`, `explanation_weak`, `hallucinated_content`, `copied_old_exam`, `bad_wording`, `too_literal`, `too_broad`, `too_narrow`, `not_exam_style`, `duplicate_question`, `obsolete_source`, `format_error`, `other`.

Severidad permitida: `low`, `medium`, `high`, `critical`.

## Feedback humano y trazabilidad

Al rechazar, marcar `needs_fix`, editar, volver a pendiente o validar, el sistema crea el `question_review` existente y registra una señal auditada.

- **Reject:** motivo estructurado obligatorio y severidad; comentario opcional.
- **Needs fix:** motivo recomendado/permitido y comentario opcional; si se aporta, persiste como feedback.
- **Edit:** registra edición; al validar, diferencia `validated_without_changes`, `validated_with_minor_changes` y `validated_after_major_edit` como señales positivas/resultados, no como aprobación automática.
- **Validate sin cambios:** no exige formulario de feedback.

Ampliar `question_review_feedback` solo con columnas mínimas que falten para enlazar `generation_run_id`, `suggested_fix` y `source_issue`; mantener `question_id`, `review_id`, `workspace_id`, `opposition_id`, `created_by` y fecha. Validar que todos los enlaces pertenecen al mismo scope antes de guardar.

El dataset debe poder reconstruir pregunta original/final, opciones, fuente, extracto, run, proveedor/modelo, feedback, revisión y estado. Documentar qué tablas lo componen, sin crear una tabla de copia enorme.

## Memoria de errores aislada

Extender `ai_error_memories` de forma aditiva e idempotente, respetando sus columnas existentes (`type`, `severity`, `summary`, `avoid_instruction`, `occurrences`). Añadir únicamente si hace falta: ámbito mínimo (`opposition` y opcionalmente `difficulty`), `last_seen_at`, `example_question_id` y un índice/clave de agregación por workspace + oposición + tipo + ámbito.

Una entrada debe contener instrucciones no factuales, por ejemplo: “Evita distractores defendibles desde el mismo extracto; debe existir una única correcta”. No guardar prompts completos, claves, texto del proveedor, datos de otros clientes ni extractos de material como memoria.

Feedback crítico o repetido actualiza la memoria correspondiente e incrementa `occurrences`. Feedback de un workspace/oposición no puede leerse, agregarse ni influir en ningún otro.

## Uso en futuras generaciones

Antes de llamar al proveedor en `generate-questions-from-studied-material`, el servidor obtiene solo memorias con el mismo `workspace_id` y `opposition_id`, priorizando:

1. críticas y recientes;
2. más repetidas;
3. coincidencia de dificultad, cuando exista.

Aplicar límites estrictos: `MAX_ERROR_MEMORIES_IN_PROMPT=10`, `MAX_ERROR_MEMORY_CHARS=3000` (solo configurables para reducirlos). Añadirlas a un bloque de “errores a evitar”, separado de la evidencia. Si no hay memoria, la generación se comporta igual que en SPEC 039.

La validación de fuentes, fragmentos, una única correcta y los estados `pending_review`/`needs_fix` permanece intacta. Ninguna memoria permite salvar una candidata sin fuente ni cambiarla a `validated`.

## Métricas básicas de gestión

Para un workspace/oposición, calcular bajo demanda:

- `generated_count`, `validated_count`, `rejected_count`, `needs_fix_count`;
- `validation_rate`, `rejection_rate`, `needs_fix_rate`;
- `average_review_time` cuando haya datos;
- tipos de error más frecuentes y últimas memorias.

Una vista interna sencilla es opcional; no crear un dashboard grande. Student no ve métricas, feedback, memorias, runs, fuentes internas ni candidatas no validadas.

## Seguridad y límites

- No fine-tuning, embeddings, RAG avanzado, modelo propio ni aprendizaje global.
- No cambios amplios de Auth/RLS. Las nuevas columnas/tablas conservan RLS de gestión y el aislamiento workspace/oposición; revisar expresamente las políticas existentes.
- No secretos ni claves privadas fuera de servidor.
- El frontend no redacta ni inyecta memoria en prompts: envía solamente la acción humana y feedback estructurado permitido.
- No auto-validación, no publicación automática y no generación automática de tests.

## Pruebas obligatorias

1. Rechazo exige tipo/severidad y persiste feedback scoped.
2. Needs fix y edición guardan las señales correctas; validar sin cambios crea señal positiva sin obligar a feedback.
3. Tipos/severidades inválidos, Student, usuario revocado y scope cruzado son rechazados.
4. Feedback crítico/repetido crea/actualiza una memoria e incrementa ocurrencias.
5. Memorias, métricas y ejemplos no se mezclan entre workspaces ni oposiciones.
6. La generación directa recupera solo la memoria relevante del mismo scope y la incluye como calidad, no como fuente.
7. Sin memoria la generación sigue funcionando; sin fuente sigue bloqueada.
8. Ninguna ruta deja preguntas `validated` automáticamente y el generador de tests sigue usando únicamente validadas.
9. Fallback InMemory conserva el aislamiento para pruebas locales.
10. Tests backend/frontend, build y revisión visual 1366×900 / 390×844.

## Entregables

- Migración aditiva mínima, si las columnas/índices existentes no bastan.
- Servicios/repositorios/contratos de feedback y memoria, incluida integración server-side con SPEC 039.
- UI de revisión ligera para feedback estructurado y, si cabe sin ampliar alcance, resumen interno de métricas.
- `docs/architecture/ai-reliability-engine.md`.
- `docs/user-guides/review-feedback.md`.
- `docs/qa/ai-reliability-feedback-memory-test-plan.md`.
