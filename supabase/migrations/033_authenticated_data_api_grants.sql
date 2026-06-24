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
--
--    Se conceden por NOMBRE EXPLICITO (no `ALL TABLES`) para NO conceder escritura
--    sobre las vistas seguras `safe_questions`/`safe_question_options` (que
--    conservan su `grant select` propio de 029) ni sobre objetos futuros.
--
--    TOLERANTE A TABLAS AUSENTES: se recorre la lista y solo se concede sobre las
--    que EXISTEN (`to_regclass`). Asi la migracion no falla si el esquema aun esta
--    incompleto (p. ej. faltan migraciones previas), y al volver a aplicarla tras
--    crearlas concede el resto (idempotente, orden-tolerante). Si faltan tablas,
--    aplicar antes el historial de migraciones (022..032) - ver docs/setup/data-api-grants.md.
-- =====================================================================
do $$
declare
  v_table text;
  v_domain_tables constant text[] := array[
    -- Cuenta y espacios (020/021)
    'profiles', 'workspaces', 'workspace_members', 'oppositions', 'opposition_access',
    -- Materiales y temario (022)
    'materials', 'topics', 'material_topic_links',
    'material_import_batches', 'material_import_items',
    -- Banco de preguntas y trazabilidad (023)
    'questions', 'question_options', 'question_validation_results',
    'question_reviews', 'question_review_feedback', 'question_generation_runs',
    -- Tests, intentos y respuestas (024)
    'tests', 'test_questions', 'test_attempts', 'test_answers',
    -- Clasificacion documental e inventario (028-B)
    'document_understanding_runs', 'document_classifications',
    -- Secciones de material y referencias de fuente (028-C)
    'material_sections', 'source_references',
    -- Aprendizaje de patron de examen (028-F)
    'exam_pattern_analysis_runs', 'exam_pattern_profiles', 'topic_exam_patterns',
    'ai_error_memories', 'ai_question_quality_scores',
    -- Indice de temario (030)
    'syllabus_index_runs', 'syllabus_index_proposals', 'syllabus_index_node_proposals',
    'material_topic_suggestions', 'exam_pattern_summaries',
    'syllabus_index_node_sources', 'topic_source_references',
    -- OCR de PDFs escaneados (032)
    'material_ocr_runs', 'material_ocr_pages'
  ];
begin
  foreach v_table in array v_domain_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format(
        'grant select, insert, update, delete on public.%I to authenticated',
        v_table
      );
    else
      raise notice 'omitida (no existe aun): public.%', v_table;
    end if;
  end loop;
end
$$;

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
