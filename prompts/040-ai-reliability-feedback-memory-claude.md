# Encargo para Claude — SPEC 040

Antes de editar, lee completos y en este orden:

1. `docs/constitution/CODEX.md`
2. `docs/constitution/CLAUDE.md`
3. `docs/specs/038-internal-material-study-flow-without-public-syllabus-index.md`
4. `docs/specs/039-direct-question-generation-from-studied-material.md`
5. `docs/specs/040-ai-reliability-feedback-memory.md`

Implementa SPEC 040 en `feature/ai-reliability-feedback-memory` con un alcance pequeño. Las SPEC 035–037 centradas en índice visible no son la base funcional. No arregles ni reintroduzcas el flujo de temario.

## Obligatorio

- Reutiliza `question_reviews`, `question_review_feedback`, `ai_error_memories`, `ai_question_quality_scores` y `question_generation_runs` existentes; migra de forma aditiva e idempotente solo lo imprescindible.
- Formaliza un catálogo único de feedback types y severities en contratos compartidos. Rechazo requiere motivo estructurado y severidad. Needs fix puede registrar motivo. Edición/validación registran señales auditables, pero ninguna señal valida automáticamente.
- Valida siempre JWT/gestión/scope y que pregunta, review, run y feedback pertenecen al mismo workspace y oposición. Student, acceso revocado y cruces de scope no pueden leer ni escribir feedback, memoria, métricas ni candidatas.
- Resume errores solo dentro del mismo workspace + oposición. No existe memoria global ni cruce entre academias. La memoria nunca contiene fuentes, extractos, prompts, secretos o datos de otro cliente.
- Integra la memoria **solo server-side** en `generate-questions-from-studied-material`: máximo 10 entradas y 3000 caracteres, como bloque de consejos de calidad separado de la evidencia factual. El frontend nunca manda memoria/prompt.
- Mantén intactas las reglas de SPEC 039: evidencia desde material estudiado, fuente concreta, explicación, exactamente una correcta y estado exclusivo `pending_review`/`needs_fix`. Nunca `validated`, tests automáticos ni mocks presentados como IA real.
- Métricas básicas por workspace/oposición; no dashboard grande. Mantén fallback InMemory aislado para test/local.
- No implementes fine-tuning, embeddings, RAG avanzado, cambios amplios de Auth/RLS, pagos, ranking ni gamificación.

## Entrega exigida

Incluye pruebas para aislamiento, roles, validación de feedback, actualización de memoria, inyección limitada/aislada en el prompt, no-memoria, no-validación automática y regresión del generador de tests. Ejecuta tests, build y revisión visual en 1366×900 y 390×844. Añade arquitectura, guía y plan QA. No declares staging PASS ni despliegues sin smoke real.
