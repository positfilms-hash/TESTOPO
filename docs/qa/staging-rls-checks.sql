-- TESTOPO - Comprobaciones de RLS contra staging (SPEC 027 / docs/security/rls-test-plan.md).
-- Requiere haber ejecutado antes staging-rls-seed.sql.
--
-- IMPORTANTE (2 lecciones aprendidas en esta sesion de QA):
--   1) El SQL Editor de Supabase solo muestra el resultado del ULTIMO statement
--      de cada bloque. No le añadas un `reset role;` detras del select que
--      importa, o tapas el resultado real. La limpieza va aparte (sección 4).
--   2) Cuando ese ultimo select devuelve 0 filas, el editor puede mostrar en su
--      lugar el resultado de un statement anterior (confunde). Por eso TODOS
--      los checks de abajo usan `count(*)`, que siempre devuelve exactamente
--      1 fila (con el numero 0 dentro si no hay filas), nunca una tabla vacia.
--
-- Reemplaza los placeholders {{...}} antes de pegar cada bloque.
--
-- Placeholders:
--   {{ADMIN}}              uuid del admin/owner
--   {{STUDENT_A}}          uuid de Student A (acceso a opp_a)
--   {{STUDENT_B}}          uuid de Student B (acceso a opp_b, NO a opp_a)
--   {{WS}}                 uuid del workspace "QA Academia Ficticia"
--   {{OPP_A}} / {{OPP_B}}  uuid de las oposiciones
--   {{MATERIAL_OBSOLETE}}  uuid del material en estado obsolete
--   {{TOPIC_OBSOLETE}}     uuid del topic en estado obsolete
--   {{ATTEMPT_B}}          uuid del test_attempt de Student B

-- =====================================================================
-- 0. DIAGNOSTICO — ya confirmado OK en esta sesion (auth.uid() resuelve bien).
-- =====================================================================
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select auth.uid() as deberia_ser_student_a, current_user, current_setting('request.jwt.claims', true) as claims_actuales;

-- =====================================================================
-- 1. STUDENT — debe FALLAR / devolver count = 0
-- =====================================================================

-- 1.1 Student B lee una oposicion a la que NO tiene acceso (opp_a) -> count = 0
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_B}}','role','authenticated')::text, false);
set role authenticated;
select count(*) as filas from public.oppositions where id = '{{OPP_A}}'; -- esperado: 0

-- 1.2 Student A lee un material `obsolete` (en su propia oposicion) -> count = 0
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select count(*) as filas from public.materials where id = '{{MATERIAL_OBSOLETE}}'; -- esperado: 0

-- 1.3 Student A lee un topic `obsolete` -> count = 0
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select count(*) as filas from public.topics where id = '{{TOPIC_OBSOLETE}}'; -- esperado: 0

-- 1.4 Student A lee preguntas NO validated de su propia oposicion -> count = 0
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select count(*) as filas from public.questions
  where opposition_id = '{{OPP_A}}' and status <> 'validated'; -- esperado: 0

-- 1.5 Student A lee tablas internas (validation/reviews/feedback/generation) -> 0 en las 4
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select
  (select count(*) from public.question_validation_results) as validation_results,
  (select count(*) from public.question_reviews) as reviews,
  (select count(*) from public.question_review_feedback) as feedback,
  (select count(*) from public.question_generation_runs) as generation_runs; -- esperado: 0,0,0,0

-- 1.6 / 1.7 Student A lee el test_attempt y test_answers de Student B -> 0 en ambas
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select
  (select count(*) from public.test_attempts where id = '{{ATTEMPT_B}}') as attempt_b,
  (select count(*) from public.test_answers where attempt_id = '{{ATTEMPT_B}}') as answers_b; -- esperado: 0,0

-- 1.8 Student A intenta crear un material -> ERROR de RLS (no debe insertarse)
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
insert into public.materials (opposition_id, title, type, status)
  values ('{{OPP_A}}', 'Intento intrusion', 'syllabus', 'active'); -- esperado: ERROR new row violates row-level security policy

-- 1.9 Student A intenta cambiar su propio role/status/email -> el trigger lo revierte
-- (anota antes el email real del usuario para comparar)
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
update public.profiles set role = 'admin', status = 'blocked', email = 'hacked@example.com'
  where id = '{{STUDENT_A}}';
select role, status, email from public.profiles where id = '{{STUDENT_A}}'; -- esperado: SIN cambios (siempre 1 fila, mira los valores)

-- 1.10 Student A intenta auto-promocionarse a admin en workspace_members -> sigue 'student'
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
update public.workspace_members set role = 'admin'
  where workspace_id = '{{WS}}' and user_id = '{{STUDENT_A}}';
select role from public.workspace_members where workspace_id = '{{WS}}' and user_id = '{{STUDENT_A}}'; -- esperado: 'student'

-- =====================================================================
-- 2. STUDENT — debe FUNCIONAR (todo debe dar 1, NO 0)
-- =====================================================================

-- 2.1 / 2.2 / 2.3 Student A lee su oposicion + materiales/topics active + preguntas validated
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select
  (select count(*) from public.oppositions where id = '{{OPP_A}}') as oposicion,
  (select count(*) from public.materials where opposition_id = '{{OPP_A}}' and status = 'active') as materials_active,
  (select count(*) from public.topics where opposition_id = '{{OPP_A}}' and status = 'active') as topics_active,
  (select count(*) from public.questions where opposition_id = '{{OPP_A}}' and status = 'validated') as questions_validated; -- esperado: 1,1,1,1

-- 2.4 / 2.5 Student A lee su propio test_attempt y test_answers (los del seed)
select set_config('request.jwt.claims', json_build_object('sub','{{STUDENT_A}}','role','authenticated')::text, false);
set role authenticated;
select
  (select count(*) from public.test_attempts where user_id = '{{STUDENT_A}}') as mis_attempts,
  (select count(*) from public.test_answers ta
     join public.test_attempts a on a.id = ta.attempt_id where a.user_id = '{{STUDENT_A}}') as mis_answers; -- esperado: 1,1

-- =====================================================================
-- 3. ADMIN / OWNER / MANAGER
-- =====================================================================

-- 3.1 Admin crea material en su workspace -> OK (debe devolver 1 fila con el id nuevo)
select set_config('request.jwt.claims', json_build_object('sub','{{ADMIN}}','role','authenticated')::text, false);
set role authenticated;
insert into public.materials (opposition_id, uploaded_by, title, type, status, content_text)
  values ('{{OPP_A}}', '{{ADMIN}}', 'Material QA admin OK', 'syllabus', 'active', 'Contenido ficticio.')
  returning id; -- esperado: 1 fila con un id (insert OK)

-- 3.2 Admin lee preguntas internas no-validated de su oposicion -> OK (count = 6)
select set_config('request.jwt.claims', json_build_object('sub','{{ADMIN}}','role','authenticated')::text, false);
set role authenticated;
select count(*) as todas_las_preguntas from public.questions where opposition_id = '{{OPP_A}}'; -- esperado: 6 (incluye draft/pending/etc.)

-- 3.3 Admin de este workspace NO puede leer/gestionar otro workspace ajeno.
-- (Omitido: requiere un workspace de OTRO admin. Si quieres este check, hay que
-- crear un segundo workspace/admin de prueba.)

-- =====================================================================
-- 4. LIMPIEZA DE SESION — ejecuta esto SOLO al terminar TODAS las comprobaciones
-- =====================================================================
reset role;
select set_config('request.jwt.claims', '', false);

-- Borrar todo el dataset ficticio de QA (cascada):
-- delete from public.workspaces where slug = 'qa-academia-ficticia';
