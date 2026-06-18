-- TESTOPO - SPEC 025: Supabase RLS Hardening.
--
-- Defensa en profundidad: ademas de los guards de aplicacion, la BD restringe el
-- acceso por rol y por pertenencia. Migracion IDEMPOTENTE (sigue el runbook). No
-- borra datos, no cambia modelos ni reglas de negocio: solo endurece RLS.
--
-- Cierra/reduce los gaps que las specs 021-024 dejaron documentados:
--   - El alumno solo ve oposiciones/materiales/temas con acceso ACTIVO y status
--     `active` (antes bastaba ser miembro del workspace).
--   - profiles: el usuario no puede cambiar role/status/email; los gestores
--     pueden leer perfiles de miembros de sus workspaces.
-- Gap que NO cierra esta spec (arquitectura cliente-only): `is_correct` de
-- `question_options` y `test_answers` sigue siendo legible por el alumno via API
-- directa para preguntas validated/sus intentos; la UI/servicio nunca lo muestra
-- antes de enviar. Ver docs/security/rls-known-gaps.md.

-- =====================================================================
-- RLS habilitada en TODAS las tablas sensibles (idempotente).
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.oppositions enable row level security;
alter table public.opposition_access enable row level security;
alter table public.materials enable row level security;
alter table public.topics enable row level security;
alter table public.material_topic_links enable row level security;
alter table public.material_import_batches enable row level security;
alter table public.material_import_items enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_validation_results enable row level security;
alter table public.question_reviews enable row level security;
alter table public.question_review_feedback enable row level security;
alter table public.question_generation_runs enable row level security;
alter table public.tests enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.test_answers enable row level security;

-- =====================================================================
-- Helper: acceso ACTIVO del usuario a una oposicion (SECURITY DEFINER).
-- =====================================================================
create or replace function public.has_active_opposition_access(opp uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.opposition_access oa
    where oa.opposition_id = opp
      and oa.user_id = auth.uid()
      and oa.status = 'active'
  );
$$;

-- =====================================================================
-- profiles: el usuario lee su perfil; los gestores leen perfiles de miembros de
-- sus workspaces. No se puede cambiar role/status/email desde cliente authenticated.
-- =====================================================================
drop policy if exists profiles_select_managed on public.profiles;
create policy profiles_select_managed on public.profiles
  for select using (
    exists (
      select 1 from public.workspace_members m
      where m.user_id = profiles.id
        and public.can_manage_workspace(m.workspace_id)
    )
  );

-- Extiende el trigger de 021 (mismo nombre): revierte cambios de role/status/email
-- hechos por el rol authenticated (frontend). service_role/postgres si pueden.
create or replace function public.enforce_profile_role_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and current_user = 'authenticated' then
    if new.role is distinct from old.role then
      new.role := old.role;
    end if;
    if new.status is distinct from old.status then
      new.status := old.status;
    end if;
    if new.email is distinct from old.email then
      new.email := old.email;
    end if;
  end if;
  return new;
end;
$$;

-- =====================================================================
-- oppositions: el alumno solo ve oposiciones con acceso ACTIVO (no basta con ser
-- miembro del workspace). Los gestores ven todas las de sus workspaces.
-- =====================================================================
drop policy if exists oppositions_select on public.oppositions;
create policy oppositions_select on public.oppositions
  for select using (
    public.can_manage_workspace(workspace_id)
    or public.has_active_opposition_access(id)
  );

-- =====================================================================
-- materials: el alumno solo ve materiales `active` de oposiciones con acceso
-- activo. Los gestores gestionan todo. (manage policy de 022 se mantiene.)
-- =====================================================================
drop policy if exists materials_select on public.materials;
create policy materials_select on public.materials
  for select using (
    public.can_manage_workspace(public.opposition_workspace(opposition_id))
    or (status = 'active' and public.has_active_opposition_access(opposition_id))
  );

-- =====================================================================
-- topics: el alumno solo ve topics `active` de oposiciones con acceso activo.
-- =====================================================================
drop policy if exists topics_select on public.topics;
create policy topics_select on public.topics
  for select using (
    public.can_manage_workspace(public.opposition_workspace(opposition_id))
    or (status = 'active' and public.has_active_opposition_access(opposition_id))
  );

-- =====================================================================
-- material_topic_links: el alumno solo ve links cuyo material y topic esten
-- `active` y tenga acceso activo a la oposicion del material.
-- =====================================================================
drop policy if exists mtl_select on public.material_topic_links;
create policy mtl_select on public.material_topic_links
  for select using (
    public.can_manage_workspace(public.opposition_workspace(
      (select m.opposition_id from public.materials m where m.id = material_id)))
    or (
      public.has_active_opposition_access(
        (select m.opposition_id from public.materials m where m.id = material_id))
      and exists (select 1 from public.materials m where m.id = material_id and m.status = 'active')
      and exists (select 1 from public.topics t where t.id = topic_id and t.status = 'active')
    )
  );

-- =====================================================================
-- tests: el alumno solo ve/crea tests de oposiciones con acceso ACTIVO; los
-- gestores, de sus workspaces. (Reemplaza las politicas amplias de 024.)
-- =====================================================================
drop policy if exists tests_select on public.tests;
create policy tests_select on public.tests
  for select using (
    public.can_manage_workspace(public.opposition_workspace(opposition_id))
    or public.has_active_opposition_access(opposition_id)
  );
drop policy if exists tests_write on public.tests;
create policy tests_write on public.tests
  for all to authenticated
  using (
    public.can_manage_workspace(public.opposition_workspace(opposition_id))
    or public.has_active_opposition_access(opposition_id)
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(opposition_id))
    or public.has_active_opposition_access(opposition_id)
  );

-- =====================================================================
-- test_questions: visibles para gestores del workspace o para quien tenga acceso
-- activo a la oposicion del test. (Reemplaza la politica amplia de 024.)
-- =====================================================================
drop policy if exists tq_select on public.test_questions;
create policy tq_select on public.test_questions
  for select using (
    public.can_manage_workspace(public.opposition_workspace(public.test_opposition(test_id)))
    or public.has_active_opposition_access(public.test_opposition(test_id))
  );
drop policy if exists tq_write on public.test_questions;
create policy tq_write on public.test_questions
  for all to authenticated
  using (
    public.can_manage_workspace(public.opposition_workspace(public.test_opposition(test_id)))
    or public.has_active_opposition_access(public.test_opposition(test_id))
  )
  with check (
    public.can_manage_workspace(public.opposition_workspace(public.test_opposition(test_id)))
    or public.has_active_opposition_access(public.test_opposition(test_id))
  );

-- =====================================================================
-- Notas sobre tablas ya endurecidas en specs previas (no se tocan aqui):
--   - questions: el alumno solo lee `validated` (023).
--   - question_options: el alumno solo lee opciones de `validated` (023) -> gap
--     is_correct documentado.
--   - validation/reviews/feedback/generation: solo gestores (023).
--   - test_attempts/test_answers: el usuario solo accede a los SUYOS (024).
--   - workspaces/workspace_members/opposition_access: 0001 + bootstrap 021.
-- =====================================================================
