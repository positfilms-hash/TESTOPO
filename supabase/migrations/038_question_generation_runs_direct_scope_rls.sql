-- TESTOPO - SPEC 039 fix RLS: scope DIRECTO en question_generation_runs.
--
-- NUMERACION (excepcion ya documentada): numero SECUENCIAL (038 tras 037) != SPEC.
--
-- Bug confirmado en staging: la generacion directa desde material estudiado (SPEC
-- 039) inserta un question_generation_runs con material_id = NULL y topic_id = NULL
-- (scope por workspace_id/opposition_id + material_study_run_id). La policy
-- `qgr_manage` (023) derivaba el scope SOLO desde material_id o topic_id, asi que
-- con ambos NULL no podia resolver el workspace y BLOQUEABA el insert
-- (-> DIRECT_QG_SAVE_FAILED).
--
-- Esta migracion ACTUALIZA solo `qgr_manage` (aditiva e IDEMPOTENTE). NO toca la
-- RLS de otras tablas ni Auth general. NO relaja a `true`. NO permite cross-workspace.

-- =====================================================================
-- Helper STABLE (DRY: misma logica en USING y WITH CHECK). Se ejecuta con el
-- contexto del usuario (auth.uid() via can_manage_workspace), no SECURITY DEFINER.
-- Acepta DOS caminos:
--   (1) LEGACY: hay material_id o topic_id -> scope = oposicion del material/tema.
--   (2) DIRECTO (SPEC 039): sin material/topic -> scope = workspace_id/opposition_id
--       del propio run, VALIDANDO que:
--         - la oposicion pertenece a ese workspace (no cross-workspace);
--         - el actor gestiona ese workspace;
--         - si hay material_study_run_id, pertenece al mismo workspace/oposicion.
-- =====================================================================
create or replace function public.can_manage_qgen_run(
  p_material_id uuid,
  p_topic_id uuid,
  p_workspace_id uuid,
  p_opposition_id uuid,
  p_material_study_run_id uuid
) returns boolean
language sql
stable
as $$
  select
    -- (1) Legacy: scope via la oposicion del material o del tema.
    (
      (p_material_id is not null or p_topic_id is not null)
      and public.can_manage_workspace(public.opposition_workspace(coalesce(
        (select m.opposition_id from public.materials m where m.id = p_material_id),
        (select t.opposition_id from public.topics t where t.id = p_topic_id))))
    )
    or
    -- (2) Directo: sin material/topic; scope por workspace/oposicion del run.
    (
      p_material_id is null and p_topic_id is null
      and p_workspace_id is not null and p_opposition_id is not null
      -- la oposicion pertenece al workspace declarado (no cross-workspace)
      and public.opposition_workspace(p_opposition_id) = p_workspace_id
      -- el actor gestiona ese workspace
      and public.can_manage_workspace(p_workspace_id)
      -- si hay study run, pertenece al MISMO workspace + oposicion
      and (
        p_material_study_run_id is null
        or exists (
          select 1 from public.material_study_runs r
          where r.id = p_material_study_run_id
            and r.opposition_id = p_opposition_id
            and (r.workspace_id is null or r.workspace_id = p_workspace_id)
        )
      )
    );
$$;

grant execute on function public.can_manage_qgen_run(uuid, uuid, uuid, uuid, uuid)
  to authenticated;

-- =====================================================================
-- Policy: solo gestores. Acepta scope legacy (material/topic) Y directo (workspace/
-- oposicion + study run). Misma expresion en USING y WITH CHECK.
-- =====================================================================
drop policy if exists qgr_manage on public.question_generation_runs;
create policy qgr_manage on public.question_generation_runs
  for all
  using (
    public.can_manage_qgen_run(
      material_id, topic_id, workspace_id, opposition_id, material_study_run_id)
  )
  with check (
    public.can_manage_qgen_run(
      material_id, topic_id, workspace_id, opposition_id, material_study_run_id)
  );
