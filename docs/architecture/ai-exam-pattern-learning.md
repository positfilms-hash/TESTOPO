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

## Fase 2 — Memoria de errores + generación adaptativa + anti-copia + calidad (pendiente)
`AIErrorMemoryService`; bloques de contexto separados (evidencia factual / reglas
de patrón-perfil / reglas de feedback) en `SourceGroundedQuestionGenerationService`
+ `prompts/adaptive-source-grounded-question-generator.md`; anti-copia por
fingerprints (`copying_risk` → `needs_fix`); `AIQuestionQualityScore` por candidata.

## Fase 3 — Facade + UI admin "IA de la oposición" + docs (pendiente)
Revisión/activación de perfil, visibilidad del contexto de generación, warnings de
calidad en la revisión; guías de usuario y plan de QA.
