# Plan de QA — AI Exam Pattern Learning (SPEC 028-F)

Cobertura automática (modo `memory`) + verificación manual (Supabase/RLS).

## Automático (vitest)

- **Análisis** (`examPatternAnalyzer.test.ts`, `examPatternLearning.test.ts`):
  detección de nº de opciones, negativas/"excepto", referencias legales, trampas,
  huellas; solo exámenes usables (gate de extracción); "sin exámenes" = warning,
  no fallo; round-trip Supabase de las 5 entidades; selección por el factory.
- **Adaptativo** (`examPatternMatching.test.ts`, `adaptiveGeneration.test.ts`):
  anti-copia (Jaccard/subcadena), puntuación de calidad (componentes + warnings),
  formateo de estilo; memoria de errores (deriva del feedback, refresh, avoid
  más graves primero); generación con perfil activo → `needs_fix` por
  `copying_risk`; quality score persistido; `adaptive_context_used`/
  `style_profile_id` en el run; toggles `use_style_profile`/`use_error_memory`.
- **Facade/permisos** (`sourceGroundedQuestionGeneration.test.ts`): admin analiza
  y activa perfil; **el student recibe `AccessError`** al analizar/listar/activar;
  contexto de generación tras activar.
- **Invariantes** (heredadas de 028-E): fuente factual solo primaria; ninguna
  candidata nace `validated`; sin fuente concreta no se genera.

## Manual (staging, único modo de validar RLS)

1. Aplicar `028_f_ai_exam_pattern_learning.sql` (incluye ALTER aditivo a
   `question_generation_runs`).
2. Como gestor: subir exámenes antiguos → **Analizar exámenes** → revisar y
   **activar** un perfil → **Generar desde tema** con perfil+memoria →
   comprobar en la revisión: fuente factual, estilo aplicado, quality score y
   avisos (incl. `copying_risk`).
3. Comprobar **aislamiento del alumno**: `select * from exam_pattern_profiles`,
   `ai_error_memories`, `ai_question_quality_scores`, `exam_pattern_analysis_runs`,
   `topic_exam_patterns` → **0 filas / denegado** para el rol del alumno.
4. Comprobar que **no** se exponen exámenes antiguos como banco copiable y que las
   candidatas con `copying_risk`/calidad baja quedan en `needs_fix`.

## Contratos de error a verificar
Sin exámenes (warning), análisis inválido, perfil ausente, sin fuente factual,
uso factual de examen antiguo (prohibido), posible copia, feedback crítico
ignorado, fallo de quality-score. Ninguno debe producir `validated` automático.
