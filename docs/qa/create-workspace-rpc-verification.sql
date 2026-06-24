-- TESTOPO - Verificacion de la RPC atomica create_workspace_with_owner (034).
--
-- Ejecutar en el SQL Editor del proyecto (staging) DESPUES de aplicar la migracion
-- 034. Sustituye <UUID_OWNER> por un id real de public.profiles del proyecto de QA.
-- No incluye secretos. Las pruebas van en transaccion con ROLLBACK: no dejan datos.

-- =====================================================================
-- (A) EXECUTE solo para `authenticated` (ni anon ni public).
-- =====================================================================
select grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public' and routine_name = 'create_workspace_with_owner'
order by grantee;
-- esperado: una fila `authenticated / EXECUTE`. NO debe aparecer `anon` ni `public`.

-- =====================================================================
-- (B) Primer workspace + membership owner ATOMICOS; owner = actor (no el cliente).
-- =====================================================================
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<UUID_OWNER>')::text, true);
set local role authenticated;

select id, owner_id, type, plan
from public.create_workspace_with_owner('Espacio QA', 'espacio-qa-verif-1', 'personal', 'premium');
-- esperado: owner_id = <UUID_OWNER>

select role, status
from public.workspace_members
where workspace_id = (select id from public.workspaces where slug = 'espacio-qa-verif-1');
-- esperado: owner / active  (la membership se creo en la misma transaccion)

reset role;
rollback;  -- no deja datos de prueba

-- =====================================================================
-- (C) Sin sesion -> AUTH_REQUIRED (y owner_id NO es un parametro del cliente, asi
--     que es imposible crear para otro owner).
-- =====================================================================
begin;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
-- Descomenta para ver el error esperado (AUTH_REQUIRED):
-- select public.create_workspace_with_owner('X', 'x-verif-1', 'personal', 'premium');
reset role;
rollback;

-- =====================================================================
-- (D) Atomicidad: ningun workspace queda SIN su membership owner. (La funcion es
--     una unica transaccion; una excepcion revierte ambos inserts.) Auditoria:
-- =====================================================================
select w.id, w.slug
from public.workspaces w
left join public.workspace_members m
  on m.workspace_id = w.id and m.role = 'owner'
where m.id is null;
-- esperado: 0 filas (no hay workspaces owner-huerfanos).
