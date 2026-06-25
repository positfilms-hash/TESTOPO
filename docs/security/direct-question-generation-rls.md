# RLS de `question_generation_runs`: scope directo (SPEC 039)

## Problema

La generación **directa desde material estudiado** (SPEC 039,
`generate-questions-from-studied-material`) inserta un `question_generation_runs`
con `material_id = NULL` y `topic_id = NULL` (el scope va por `workspace_id` +
`opposition_id` + `material_study_run_id`). La policy original `qgr_manage` (SPEC 023)
derivaba el scope **solo** desde `material_id`/`topic_id`, así que con ambos `NULL`
no podía resolver el workspace y **bloqueaba el insert** → la Edge Function devolvía
`DIRECT_QG_SAVE_FAILED`.

## Corrección (migración `038_question_generation_runs_direct_scope_rls.sql`)

Solo se actualiza `qgr_manage` (aditiva, idempotente; **no** toca Auth ni la RLS de
otras tablas; **no** relaja a `true`; **no** permite cross-workspace). La lógica vive
en el helper `public.can_manage_qgen_run(material_id, topic_id, workspace_id,
opposition_id, material_study_run_id)` (STABLE, se ejecuta con el contexto del
usuario), usado en `USING` y `WITH CHECK`:

1. **Legacy:** si hay `material_id` o `topic_id`, scope = oposición del material/tema
   (comportamiento previo intacto).
2. **Directo:** sin `material_id`/`topic_id`, scope = `workspace_id`/`opposition_id`
   del run, validando:
   - la **oposición pertenece al workspace** (`opposition_workspace(opposition_id) =
     workspace_id`) → no cross-workspace;
   - el actor **gestiona** ese workspace (`can_manage_workspace(workspace_id)`);
   - si hay `material_study_run_id`, **pertenece al mismo** workspace + oposición.

## Verificación (policy check en staging — no se puede en vitest)

La RLS es Postgres; se verifica con SQL en el proyecto de **staging** (transacción +
`rollback`, sin dejar datos). Sustituye los placeholders por valores reales del caso
(`workspace_id 81e231bc…`, `opposition_id ddaf7667…`, `material_study_run_id
029c1f4f…`) y por el `uid` de un gestor (owner/admin activo) de cada workspace.

```sql
-- (A) PERMITE: gestor del workspace inserta un run directo de su scope.
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"<UID_GESTOR_DEL_WORKSPACE>"}';
  insert into public.question_generation_runs
    (id, workspace_id, opposition_id, material_id, topic_id, material_study_run_id,
     mode, requested_count, created_count, status, errors, provider, model, source_strategy)
  values
    (gen_random_uuid(), '<WS>', '<OPP>', null, null, '<STUDY_RUN>',
     'studied_material', 5, 0, 'failed', '[]'::jsonb, 'openai', 'gpt-4o-mini', 'studied_material');
  -- esperado: INSERT 0 1
rollback;

-- (B) BLOQUEA: un gestor de OTRO workspace no puede insertar ese run.
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"<UID_GESTOR_DE_OTRO_WORKSPACE>"}';
  insert into public.question_generation_runs
    (id, workspace_id, opposition_id, material_id, topic_id, material_study_run_id,
     mode, requested_count, created_count, status, errors, provider, model, source_strategy)
  values
    (gen_random_uuid(), '<WS>', '<OPP>', null, null, '<STUDY_RUN>',
     'studied_material', 5, 0, 'failed', '[]'::jsonb, 'openai', 'gpt-4o-mini', 'studied_material');
  -- esperado: ERROR: new row violates row-level security policy for table
  --           "question_generation_runs"
rollback;

-- (C) BLOQUEA: cross-workspace (la oposicion NO pertenece al workspace declarado).
begin;
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"<UID_GESTOR_DEL_WORKSPACE>"}';
  insert into public.question_generation_runs
    (id, workspace_id, opposition_id, material_id, topic_id, material_study_run_id,
     mode, requested_count, created_count, status, errors, provider, model, source_strategy)
  values
    (gen_random_uuid(), '<WS>', '<OPP_DE_OTRO_WORKSPACE>', null, null, null,
     'studied_material', 5, 0, 'failed', '[]'::jsonb, 'openai', 'gpt-4o-mini', 'studied_material');
  -- esperado: ERROR (opposition_workspace(OPP) != WS).
rollback;
```

(A) debe insertar; (B) y (C) deben fallar con violación de RLS. El flujo legacy por
tema/material sigue funcionando como antes.

## Despliegue

Solo es **migración RLS** (no cambia Edge Functions): aplicar
`038_question_generation_runs_direct_scope_rls.sql` en staging (SQL Editor o
`supabase db push`) y reintentar “Generar preguntas desde material estudiado”.
