# Aprendizaje de patrones de examen (SPEC 028-F)

La generación anclada a fuentes (028-E) **aprende** del estilo/dificultad/formato/
cobertura de los exámenes antiguos y del feedback humano, **sin** dejar de usar el
material primario como **única fuente factual**. Es contexto de prompt adaptativo:
NO fine-tuning, OCR, RAG, embeddings ni almacén vectorial. Las candidatas nunca
nacen `validated`; solo la revisión humana valida.

> Implementación **por fases**. Esta página se amplía con cada fase.

## Fase 1 — Persistencia + análisis (entregada)

### Modelos (`app/backend/src/models/examPatternLearning.ts`)
- `ExamPatternAnalysisRun` — ejecución de análisis (estado, provider, materiales/
  secciones de entrada, nº de exámenes y preguntas analizadas, warnings/errores).
- `QuestionStyleProfile` — perfil de estilo **versionado** y **activado por humano**
  (1 activo por oposición). Contiene `rules` (agregados: distribución de nº de
  opciones, tipos de pregunta comunes, trampas, legal vs conceptual, longitud de
  enunciado) + `fingerprints` (enunciados normalizados para **anti-copia**, no
  copiables) + cobertura/confianza/warnings. Ciclo: `draft` → `pending_review` →
  `active`/`rejected`/`superseded`.
- `TopicExamPattern` — frecuencia/dificultad/estilo por tema y perfil.
- `AIErrorMemory` — entradas auditables (tipo, severidad, resumen,
  `avoid_instruction`) derivadas de feedback/review/validación.
- `AIQuestionQualityScore` — componentes `[0,1]` por candidata (transparente;
  **nunca** aprueba ni valida).

### Análisis (`service/examPatternAnalysisService.ts` + `analysis/examPatternAnalyzer.ts`)
- Analiza **solo** documentos `old_exam_or_test` **usables**: extracción
  `completed` (gate de 028-F PDF), `active`, clasificados como examen (o
  `type=old_test` si no hay clasificación). Excluye escaneados/corruptos/obsoletos.
- `analyzeExamText` es **puro y determinista** (sin red): deriva agregados +
  huellas anti-copia. NUNCA conserva contenido verbatim como pregunta.
- Persiste un `ExamPatternAnalysisRun`, un `QuestionStyleProfile` en `draft`
  (activación humana en fase posterior) y `TopicExamPattern` por tema vinculado.
  **"Sin exámenes" es warning, no fallo.**

### Persistencia
- Repo unificado `ExamPatternLearningRepository` (InMemory + Supabase) vía el
  factory `createCoreRepositories` (`core.examPatternLearning`).
- Migración `028_f_ai_exam_pattern_learning.sql` (idempotente): 5 tablas, índices,
  triggers, **RLS solo gestión** (el alumno no accede a nada interno), índice
  único de 1 perfil activo por oposición. Verificación de RLS: manual en staging.
- Taxonomía de feedback (`models/questionReviewFeedback.ts`) extendida:
  `style_mismatch`, `difficulty_mismatch`, `coverage_mismatch`, `source_mismatch`,
  `copying_risk` (`needs_legal_precision` ya cubría la precisión legal).

## Fase 2 — Memoria de errores + generación adaptativa + anti-copia + calidad (entregada)

- **`AIErrorMemoryService`** (`service/aiErrorMemoryService.ts`): deriva de
  `QuestionFeedbackService` entradas `AIErrorMemory` auditables (tipo, severidad,
  resumen, `avoid_instruction`) y las **refresca** (borra+regenera) por oposición;
  `getAvoidInstructions` devuelve las reglas de "evitar" (más graves primero).
- **Bloques de contexto separados** en el prompt (`generation/aiGenerationShared.ts`
  + `GenerationContext.style_rules`/`avoid_rules`): (1) MATERIAL = única fuente
  factual; (2) reglas de estilo agregadas (NO factual); (3) errores a evitar (NO
  factual). Prompt `prompts/adaptive-source-grounded-question-generator.md`.
- **`SourceGroundedQuestionGenerationService`** extendido (no nuevo generador):
  usa el perfil activo + memoria con toggles `use_style_profile`/`use_error_memory`
  (defecto on); **anti-copia** por `fingerprints` (`assessCopyRisk` → `needs_fix`
  con `copying_risk`, nunca `pending_review` en silencio); **`AIQuestionQualityScore`**
  por candidata (`scoreCandidateQuality`, componentes `[0,1]`); score bajo →
  `needs_fix`; registra `style_profile_id`/`adaptive_context_used`/`feedback_used`
  en el run. **Sin `learning` configurado, el comportamiento es idéntico a 028-E.**
- Migración 028_f: ALTER aditivo a `question_generation_runs`
  (`style_profile_id`, `adaptive_context_used`). Re-ejecutar 028_f (idempotente).
- Helpers puros en `analysis/examPatternMatching.ts` (anti-copia/calidad/estilo).

## Fase 3 — Facade + UI admin "IA de la oposición" + docs (pendiente)
Revisión/activación de perfil, visibilidad del contexto de generación, warnings de
calidad en la revisión; guías de usuario y plan de QA.
