-- TESTOPO - Permisos base de la Data API para el rol `authenticated`.
--
-- P0 (proyectos creados con "Automatically expose new tables" DESACTIVADO): la
-- RLS esta activa en todas las tablas, pero el rol `authenticated` no tiene los
-- privilegios SQL base (GRANT) para tocarlas. Resultado: la PostgREST Data API
-- devuelve `permission denied for table profiles` y la app no puede ni recuperar
-- el perfil (SPEC 036 bloqueada). Supabase, con la opcion activada, concede estos
-- grants automaticamente; al estar desactivada hay que concederlos explicitamente.
--
-- Este cambio es ADITIVO e IDEMPOTENTE (GRANT es repetible sin error; sigue
-- docs/setup/migrations-runbook.md). La RLS sigue siendo la AUTORIDAD real del
-- control de acceso: estos grants solo permiten que el rol "llegue" a la tabla; lo
-- que cada usuario ve/escribe lo deciden las politicas existentes. No se tocan
-- politicas, Auth, roles, service_role ni el frontend. Ver docs/setup/data-api-grants.md.

-- =====================================================================
-- 1) USAGE sobre el schema public (necesario para resolver objetos).
-- =====================================================================
grant usage on schema public to authenticated;

-- =====================================================================
-- 2) SELECT/INSERT/UPDATE/DELETE sobre las TABLAS BASE del dominio. La RLS filtra
--    filas y operaciones por usuario; sin grant, ni la RLS llega a evaluarse.
--    Se conceden por NOMBRE EXPLICITO (no `ALL TABLES`) para NO conceder escritura
--    sobre las vistas seguras `safe_questions`/`safe_question_options` (que
--    conservan su `grant select` propio de 029) ni sobre objetos futuros.
-- =====================================================================

-- Cuenta y espacios (020/021).
grant select, insert, update, delete on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.oppositions,
  public.opposition_access
  to authenticated;

-- Materiales y temario (022).
grant select, insert, update, delete on
  public.materials,
  public.topics,
  public.material_topic_links,
  public.material_import_batches,
  public.material_import_items
  to authenticated;

-- Banco de preguntas y trazabilidad (023).
grant select, insert, update, delete on
  public.questions,
  public.question_options,
  public.question_validation_results,
  public.question_reviews,
  public.question_review_feedback,
  public.question_generation_runs
  to authenticated;

-- Tests, intentos y respuestas (024).
grant select, insert, update, delete on
  public.tests,
  public.test_questions,
  public.test_attempts,
  public.test_answers
  to authenticated;

-- Clasificacion documental e inventario (028-B).
grant select, insert, update, delete on
  public.document_understanding_runs,
  public.document_classifications
  to authenticated;

-- Secciones de material y referencias de fuente (028-C).
grant select, insert, update, delete on
  public.material_sections,
  public.source_references
  to authenticated;

-- Aprendizaje de patron de examen (028-F).
grant select, insert, update, delete on
  public.exam_pattern_analysis_runs,
  public.exam_pattern_profiles,
  public.topic_exam_patterns,
  public.ai_error_memories,
  public.ai_question_quality_scores
  to authenticated;

-- Indice de temario (030).
grant select, insert, update, delete on
  public.syllabus_index_runs,
  public.syllabus_index_proposals,
  public.syllabus_index_node_proposals,
  public.material_topic_suggestions,
  public.exam_pattern_summaries,
  public.syllabus_index_node_sources,
  public.topic_source_references
  to authenticated;

-- OCR de PDFs escaneados (032).
grant select, insert, update, delete on
  public.material_ocr_runs,
  public.material_ocr_pages
  to authenticated;

-- =====================================================================
-- NOTAS (lo que este cambio NO hace, a proposito):
--   - NO concede nada a `anon`: ningun flujo existente lo requiere (login/registro
--     van por auth.*, no por estas tablas). Si una futura politica/flujo lo exige,
--     se concedera entonces de forma explicita.
--   - NO altera las vistas seguras `safe_questions`/`safe_question_options` ni sus
--     grants (SELECT a authenticated, de 029): el alumno sigue leyendo el banco
--     solo por esas vistas y por las RPC SECURITY DEFINER (submit_attempt /
--     get_attempt_review), que conservan su `grant execute`.
--   - NO toca politicas RLS, Auth, roles ni service_role.
-- =====================================================================
