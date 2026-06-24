-- TESTOPO - Verificacion de los grants de la Data API (migracion 033).
--
-- Ejecutar en el SQL Editor del proyecto (staging) DESPUES de aplicar la migracion
-- 033. Comprueba: (A) el rol `authenticated` tiene los grants base; (B) con un
-- usuario autenticado concreto, `public.profiles` devuelve SOLO su propio perfil
-- (RLS profiles_select_own); (C) un Student NO ve tablas internas de gestion (RLS
-- can_manage_workspace), aunque ahora tenga el grant base.
--
-- No incluye secretos. Sustituye los <UUID> por ids reales de public.profiles del
-- proyecto de QA (un owner/admin y un student).

-- =====================================================================
-- (A) Grants base presentes para `authenticated` (se ejecuta como postgres).
--     Esperado para profiles: DELETE, INSERT, SELECT, UPDATE (4 filas).
-- =====================================================================
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name = 'profiles'
order by privilege_type;

-- Cobertura: numero de tablas base de public con los 4 privilegios para authenticated.
select count(distinct table_name) as tablas_con_grants
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE');

-- =====================================================================
-- (B) Perfil propio: con role authenticated + sub del usuario, profiles devuelve
--     SOLO su fila (RLS). Esperado: 1 fila (la del <UUID_OWNER>).
-- =====================================================================
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<UUID_OWNER>')::text, true);
set local role authenticated;

select id, email from public.profiles;   -- esperado: 1 fila, la del <UUID_OWNER>

reset role;
rollback;

-- =====================================================================
-- (C) Aislamiento del Student: con el sub de un alumno, NO ve tablas internas de
--     gestion (la RLS las filtra a can_manage_workspace). Esperado: 0 filas.
--     (El grant base existe; la AUTORIDAD es la RLS, no la falta de grant.)
-- =====================================================================
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<UUID_STUDENT>')::text, true);
set local role authenticated;

select count(*) as runs_visibles            from public.question_generation_runs;   -- esperado: 0
select count(*) as clasificaciones_visibles from public.document_classifications;    -- esperado: 0
select count(*) as ocr_runs_visibles        from public.material_ocr_runs;           -- esperado: 0
-- En cambio, su propio perfil si es visible:
select count(*) as perfil_propio_visible    from public.profiles;                    -- esperado: 1

reset role;
rollback;
