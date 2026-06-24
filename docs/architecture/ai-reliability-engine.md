# Motor de fiabilidad y memoria de feedback (SPEC 040)

Memoria de calidad basada en **revisión humana**, no aprendizaje mágico. El sistema
registra por qué una candidata se rechaza/corrige/valida, resume patrones **dentro
del mismo workspace + oposición**, y los pasa como **instrucciones de calidad
limitadas** a futuras generaciones directas (SPEC 039).

```text
Pregunta con fuente -> revisión humana -> feedback estructurado
  -> memoria aislada workspace/oposición -> próxima generación directa
  -> bloque "errores a evitar" (NO factual) + misma evidencia del material estudiado
```

La evidencia factual sigue siendo **únicamente** el material estudiado. La memoria
**nunca** es fuente, **nunca** valida una pregunta ni publica un test.

## Reutiliza tablas existentes (no duplica)

- `question_reviews` / `question_review_feedback` (SPEC 023): acción de revisión +
  feedback estructurado.
- `ai_error_memories` / `ai_question_quality_scores` (SPEC 028-F): memoria de
  errores + scoring por candidata.
- `question_generation_runs` (SPEC 023/036): historial de generación.

Migración aditiva idempotente `037_ai_reliability_feedback_memory.sql`: añade a
`question_review_feedback` (`generation_run_id`, `suggested_fix`, `source_issue`) y a
`ai_error_memories` (`scope`, `difficulty`, `last_seen_at`, `example_question_id` +
índice de agregación). **No crea tablas, no cambia RLS** (las columnas heredan las
políticas de gestión y el aislamiento workspace/oposición). Sin fine-tuning,
embeddings ni RAG avanzado.

## Catálogo único (contrato compartido)

`supabase/functions/_shared/reliability/contract.ts` es la **única fuente de verdad**
(pura, usada por la Edge Function y por backend/frontend):

- `RELIABILITY_FEEDBACK_TYPES` (23 tipos) + `RELIABILITY_SEVERITIES`
  (`low|medium|high|critical`) + severidad por defecto por tipo.
- `validateReviewFeedback(action, entries)`: **reject** exige ≥1 motivo estructurado
  y severidad; **needs_fix** permite motivo; **edit/validate** registran señales
  auditables. **Ninguna acción valida automáticamente.**
- Señales de resultado al validar: `validated_without_changes`,
  `validated_with_minor_changes`, `validated_after_major_edit`.
- `avoidInstructionFor(type)`: instrucción NO factual de "evitar" por tipo.

## Memoria de errores aislada

`ai_error_memories` guarda solo contenido **NO factual** (tipo, severidad, resumen,
`avoid_instruction`, `occurrences`, `scope`, `difficulty`). Nunca fuentes, extractos,
prompts, claves ni datos de otro cliente. Feedback crítico/repetido crea/actualiza la
entrada e incrementa `occurrences`. El feedback de un workspace/oposición **no** se
lee, agrega ni influye en ningún otro (aislamiento reforzado también en el código
puro: `selectErrorMemories` descarta cualquier registro de otro scope aunque llegara
en la lista).

## Integración server-side en la generación directa (SPEC 039)

**Solo** en `generate-questions-from-studied-material`, antes de llamar al proveedor:

1. El servidor lee `ai_error_memories` del **mismo** `workspace_id` + `opposition_id`
   (RLS de gestión).
2. `selectErrorMemories` prioriza: críticas y recientes → más repetidas →
   coincidencia de dificultad (si la petición no es `mixed`), deduplica por
   instrucción y acota a `MAX_ERROR_MEMORIES_IN_PROMPT=10`.
3. `formatAvoidBlock` produce un bloque **"errores a evitar"** ≤ `MAX_ERROR_MEMORY_CHARS=3000`,
   **separado de la evidencia** y marcado como NO factual; va al final del prompt
   tras las unidades de estudio.
4. Si no hay memoria, la generación se comporta **igual que SPEC 039**.

El frontend **nunca** redacta ni envía memoria/prompt: manda solo IDs de alcance y
parámetros (contrato de SPEC 039) y, en revisión, la acción humana + feedback
estructurado permitido. Los límites solo pueden **reducirse** por secreto, nunca
superar 10/3000.

## Invariantes preservadas (SPEC 039)

Evidencia desde material estudiado, fuente concreta, explicación, **exactamente una
correcta**, estado exclusivo `pending_review`/`needs_fix`. Ninguna memoria permite
salvar una candidata sin fuente ni cambiarla a `validated`. El generador de tests del
alumno sigue usando **solo** preguntas validadas por humanos.

## Métricas básicas

`computeReliabilityMetrics` (puro) calcula bajo demanda por workspace/oposición:
`generated/validated/rejected/needs_fix_count`, sus tasas, `average_review_time_ms`
(cuando haya datos) y los tipos de error más frecuentes. Se muestra una franja
compacta en la pantalla de gestión de Preguntas (sin dashboard). El Student no ve
métricas, feedback, memorias, runs, fuentes internas ni candidatas no validadas.

## Fallback InMemory

El dominio existente (repos InMemory) conserva el mismo aislamiento por
workspace/oposición para desarrollo y tests. La salida nunca aparenta aprendizaje
real en staging/producción.

## Fuera de alcance

Fine-tuning, embeddings, RAG avanzado, modelo propio, aprendizaje global, dashboard
grande, cambios amplios de Auth/RLS, pagos, ranking, gamificación.

## Estado de esta entrega

Contrato compartido + inyección server-side en SPEC 039 + migración aditiva +
métricas + UI de revisión (severidad obligatoria al rechazar) + docs. **Pendiente de
staging** (operador): aplicar la migración 037 y `functions deploy
generate-questions-from-studied-material`; retest real con memoria poblada. No se
declara smoke PASS sin ese retest.
