-- TESTOPO - Fixture de QA para staging (SPEC 027 manual-test-script + rls-test-plan).
-- Crea un dataset FICTICIO completo para poder ejecutar ambos guiones sin tener
-- que navegar la UI a mano. Requiere 3 usuarios YA creados en Auth (Dashboard ->
-- Authentication -> Users -> Add user, con "Auto Confirm User" activado):
--   - Admin/owner   (ej. admin.qa@testopo-fake.dev)
--   - Student A     (ej. student-a.qa@testopo-fake.dev)  -> SI tendra acceso a opp_a
--   - Student B     (ej. student-b.qa@testopo-fake.dev)  -> SI tendra acceso a opp_b (no a opp_a)
--
-- Sustituye los 3 UUID de mas abajo (los ves en Authentication -> Users) y pega
-- todo el bloque en el SQL Editor. Es seguro re-ejecutar tras borrar las filas
-- (no es idempotente: usa slugs unicos, si repites te dara conflicto de unique).
--
-- NO commitear este archivo con UUID reales rellenados.

do $$
declare
  v_admin     uuid := 'REPLACE-ADMIN-UUID';
  v_student_a uuid := 'REPLACE-STUDENT-A-UUID';
  v_student_b uuid := 'REPLACE-STUDENT-B-UUID';
  v_ws uuid;
  v_opp_a uuid; -- Student A tiene acceso activo
  v_opp_b uuid; -- Student B tiene acceso activo (A NO)
  v_material_active uuid;
  v_material_obsolete uuid;
  v_topic_active uuid;
  v_topic_obsolete uuid;
  v_q_validated uuid;
  v_q_pending uuid;
  v_q_draft uuid;
  v_q_needs_fix uuid;
  v_q_rejected uuid;
  v_q_obsolete uuid;
  v_q_b uuid;
  v_opt_a uuid;
  v_opt_b uuid;
  v_test_a uuid;
  v_test_b uuid;
  v_tq_a uuid;
  v_tq_b uuid;
  v_attempt_a uuid;
  v_attempt_b uuid;
begin
  -- El admin sube a rol 'admin' (corremos como postgres: el trigger de
  -- inmutabilidad solo bloquea cambios hechos por el rol 'authenticated').
  update public.profiles set role = 'admin' where id = v_admin;

  insert into public.workspaces (name, slug, type, owner_id)
  values ('QA Academia Ficticia', 'qa-academia-ficticia', 'organization', v_admin)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role) values
    (v_ws, v_admin, 'owner'),
    (v_ws, v_student_a, 'student'),
    (v_ws, v_student_b, 'student');

  -- Oposicion A: acceso activo SOLO para Student A.
  insert into public.oppositions (workspace_id, title, slug, created_by)
  values (v_ws, 'QA Aux Administrativo Ficticio A', 'qa-aux-admin-ficticio-a', v_admin)
  returning id into v_opp_a;
  insert into public.opposition_access (opposition_id, user_id, role_in_opposition, granted_by)
  values (v_opp_a, v_student_a, 'student', v_admin);

  -- Oposicion B: acceso activo SOLO para Student B (sirve para "lee oposicion sin
  -- acceso" en ambas direcciones y para probar aislamiento entre estudiantes).
  insert into public.oppositions (workspace_id, title, slug, created_by)
  values (v_ws, 'QA Aux Administrativo Ficticio B', 'qa-aux-admin-ficticio-b', v_admin)
  returning id into v_opp_b;
  insert into public.opposition_access (opposition_id, user_id, role_in_opposition, granted_by)
  values (v_opp_b, v_student_b, 'student', v_admin);

  -- Material/topic active + obsolete en opp_a (para los checks de status).
  insert into public.materials (opposition_id, uploaded_by, title, type, status, content_text)
  values (v_opp_a, v_admin, 'Tema QA activo', 'syllabus', 'active', 'Contenido ficticio de prueba.')
  returning id into v_material_active;
  insert into public.materials (opposition_id, uploaded_by, title, type, status, content_text)
  values (v_opp_a, v_admin, 'Tema QA obsoleto', 'syllabus', 'obsolete', 'Contenido ficticio obsoleto.')
  returning id into v_material_obsolete;
  insert into public.topics (opposition_id, title, order_index, status)
  values (v_opp_a, 'Tema 1 QA activo', 1, 'active')
  returning id into v_topic_active;
  insert into public.topics (opposition_id, title, order_index, status)
  values (v_opp_a, 'Tema 2 QA obsoleto', 2, 'obsolete')
  returning id into v_topic_obsolete;

  -- Preguntas en opp_a, una por cada estado relevante.
  insert into public.questions (opposition_id, statement, explanation, topic, difficulty, status)
  values (v_opp_a, 'Pregunta QA validada ficticia', 'Explicacion ficticia.', 'Tema 1', 'easy', 'validated')
  returning id into v_q_validated;
  insert into public.question_options (question_id, opposition_id, text, is_correct, order_index)
  values (v_q_validated, v_opp_a, 'Opcion correcta ficticia', true, 1)
  returning id into v_opt_a;
  insert into public.question_options (question_id, opposition_id, text, is_correct, order_index) values
    (v_q_validated, v_opp_a, 'Opcion B ficticia', false, 2),
    (v_q_validated, v_opp_a, 'Opcion C ficticia', false, 3),
    (v_q_validated, v_opp_a, 'Opcion D ficticia', false, 4);

  insert into public.questions (opposition_id, statement, explanation, topic, difficulty, status)
  values (v_opp_a, 'Pregunta QA pending_review ficticia', 'Explicacion ficticia.', 'Tema 1', 'easy', 'pending_review')
  returning id into v_q_pending;
  insert into public.questions (opposition_id, statement, explanation, topic, difficulty, status)
  values (v_opp_a, 'Pregunta QA draft ficticia', 'Explicacion ficticia.', 'Tema 1', 'easy', 'draft')
  returning id into v_q_draft;
  insert into public.questions (opposition_id, statement, explanation, topic, difficulty, status)
  values (v_opp_a, 'Pregunta QA needs_fix ficticia', 'Explicacion ficticia.', 'Tema 1', 'easy', 'needs_fix')
  returning id into v_q_needs_fix;
  insert into public.questions (opposition_id, statement, explanation, topic, difficulty, status)
  values (v_opp_a, 'Pregunta QA rejected ficticia', 'Explicacion ficticia.', 'Tema 1', 'easy', 'rejected')
  returning id into v_q_rejected;
  insert into public.questions (opposition_id, statement, explanation, topic, difficulty, status)
  values (v_opp_a, 'Pregunta QA obsolete ficticia', 'Explicacion ficticia.', 'Tema 1', 'easy', 'obsolete')
  returning id into v_q_obsolete;

  -- Tablas internas (solo gestor): una fila de cada para comprobar que el
  -- alumno NO las ve.
  insert into public.question_validation_results
    (question_id, opposition_id, status, passed, recommended_status, validator_version)
  values (v_q_pending, v_opp_a, 'passed', true, 'pending_review', 'qa-1');
  insert into public.question_reviews
    (question_id, opposition_id, action, new_status, reviewer_id, reviewer_name)
  values (v_q_validated, v_opp_a, 'approve', 'validated', v_admin, 'Admin QA');
  insert into public.question_review_feedback
    (question_id, opposition_id, feedback_type, severity, comment, created_by)
  values (v_q_needs_fix, v_opp_a, 'clarity', 'medium', 'Feedback ficticio de QA.', v_admin);
  insert into public.question_generation_runs
    (opposition_id, material_id, mode, requested_count, created_count, status, provider)
  values (v_opp_a, v_material_active, 'manual', 1, 1, 'completed', 'mock');

  -- Pregunta validada en opp_b (para el test/attempt de Student B).
  insert into public.questions (opposition_id, statement, explanation, topic, difficulty, status)
  values (v_opp_b, 'Pregunta QA validada B ficticia', 'Explicacion ficticia.', 'Tema 1', 'easy', 'validated')
  returning id into v_q_b;
  insert into public.question_options (question_id, opposition_id, text, is_correct, order_index)
  values (v_q_b, v_opp_b, 'Opcion correcta B ficticia', true, 1)
  returning id into v_opt_b;
  insert into public.question_options (question_id, opposition_id, text, is_correct, order_index) values
    (v_q_b, v_opp_b, 'Opcion B2 ficticia', false, 2),
    (v_q_b, v_opp_b, 'Opcion B3 ficticia', false, 3);

  -- Test + attempt + answer de Student A en opp_a (ya enviado).
  insert into public.tests (opposition_id, created_by, mode, status, question_count)
  values (v_opp_a, v_student_a, 'random', 'completed', 1)
  returning id into v_test_a;
  insert into public.test_questions (test_id, opposition_id, question_id, order_index)
  values (v_test_a, v_opp_a, v_q_validated, 1)
  returning id into v_tq_a;
  insert into public.test_attempts
    (opposition_id, test_id, user_id, status, submitted_at, total_questions, correct_count, score)
  values (v_opp_a, v_test_a, v_student_a, 'submitted', now(), 1, 1, 100)
  returning id into v_attempt_a;
  insert into public.test_answers (attempt_id, test_question_id, question_id, selected_option_id, is_correct, answered_at)
  values (v_attempt_a, v_tq_a, v_q_validated, v_opt_a, true, now());

  -- Test + attempt + answer de Student B en opp_b (ya enviado).
  insert into public.tests (opposition_id, created_by, mode, status, question_count)
  values (v_opp_b, v_student_b, 'random', 'completed', 1)
  returning id into v_test_b;
  insert into public.test_questions (test_id, opposition_id, question_id, order_index)
  values (v_test_b, v_opp_b, v_q_b, 1)
  returning id into v_tq_b;
  insert into public.test_attempts
    (opposition_id, test_id, user_id, status, submitted_at, total_questions, correct_count, score)
  values (v_opp_b, v_test_b, v_student_b, 'submitted', now(), 1, 1, 100)
  returning id into v_attempt_b;
  insert into public.test_answers (attempt_id, test_question_id, question_id, selected_option_id, is_correct, answered_at)
  values (v_attempt_b, v_tq_b, v_q_b, v_opt_b, true, now());

  raise notice 'workspace=% opp_a=% opp_b=% material_obsolete=% topic_obsolete=%',
    v_ws, v_opp_a, v_opp_b, v_material_obsolete, v_topic_obsolete;
  raise notice 'q_validated=% q_pending=% q_draft=% q_needs_fix=% q_rejected=% q_obsolete=%',
    v_q_validated, v_q_pending, v_q_draft, v_q_needs_fix, v_q_rejected, v_q_obsolete;
  raise notice 'attempt_a(StudentA,opp_a)=% attempt_b(StudentB,opp_b)=%', v_attempt_a, v_attempt_b;
end $$;

-- Pega esto despues para recuperar todos los IDs generados (los necesitaras
-- para staging-rls-checks.sql):
select 'workspace' as item, id, slug from public.workspaces where slug = 'qa-academia-ficticia'
union all
select 'opposition_a', id, slug from public.oppositions where slug = 'qa-aux-admin-ficticio-a'
union all
select 'opposition_b', id, slug from public.oppositions where slug = 'qa-aux-admin-ficticio-b'
union all
select 'material_obsolete', id, title from public.materials where title = 'Tema QA obsoleto'
union all
select 'topic_obsolete', id, title from public.topics where title = 'Tema 2 QA obsoleto'
union all
select 'question_' || status, id, statement from public.questions where statement like 'Pregunta QA%'
union all
select 'attempt_a', ta.id, p.email from public.test_attempts ta
  join public.profiles p on p.id = ta.user_id where p.email like 'student-a%'
union all
select 'attempt_b', ta.id, p.email from public.test_attempts ta
  join public.profiles p on p.id = ta.user_id where p.email like 'student-b%';

-- Limpieza al terminar la QA (borra TODO el dataset ficticio en cascada):
-- delete from public.workspaces where slug = 'qa-academia-ficticia';
