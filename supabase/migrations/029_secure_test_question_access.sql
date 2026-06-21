-- TESTOPO - SPEC 029: cierre del gap is_correct (BUG-001).
--
-- Defensa real (no solo de UI) frente a que el alumno lea la respuesta correcta
-- por API directa ANTES de enviar. La RLS no puede ocultar columnas, asi que:
--   1) El alumno deja de poder leer las tablas base `questions`/`question_options`
--      (pasan a SELECT solo para gestores).
--   2) El flujo de alumno (generar/responder un test) lee de VISTAS SEGURAS que
--      NO exponen `correct_answer`/`explanation`/`is_correct`.
--   3) Corregir y revisar (que si necesitan el secreto) se hacen con funciones
--      SECURITY DEFINER (RPC), que validan que el intento es del usuario y nunca
--      devuelven la solucion antes de enviar.
--
-- Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md). Sin cambios de
-- esquema (no borra datos). El codigo de la app (gateway + repo seguro) debe
-- desplegarse junto con esta migracion.

-- =====================================================================
-- 1) Endurecer RLS: el alumno ya NO lee las tablas base del banco.
--    (Los gestores conservan acceso via estas politicas y las _manage de 023.)
-- =====================================================================
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select using (
    public.can_manage_workspace(public.opposition_workspace(opposition_id))
  );

drop policy if exists qoptions_select on public.question_options;
create policy qoptions_select on public.question_options
  for select using (
    public.can_manage_workspace(public.opposition_workspace(opposition_id))
  );

-- =====================================================================
-- 2) Vistas seguras para el flujo de alumno: SIN solucion. Se ejecutan con los
--    privilegios del propietario (bypass de la RLS de las tablas base), asi que
--    el control de acceso lo hace el WHERE: solo preguntas `validated` de
--    oposiciones que el usuario gestiona o a las que tiene acceso ACTIVO.
-- =====================================================================
create or replace view public.safe_questions
with (security_invoker = off) as
  select
    q.id,
    q.opposition_id,
    q.statement,
    q.topic,
    q.topic_id,
    q.difficulty,
    q.status,
    q.created_at,
    q.updated_at
  from public.questions q
  where q.status = 'validated'
    and (
      public.can_manage_workspace(public.opposition_workspace(q.opposition_id))
      or public.has_active_opposition_access(q.opposition_id)
    );

create or replace view public.safe_question_options
with (security_invoker = off) as
  select
    o.id,
    o.question_id,
    o.text,
    o.order_index
  from public.question_options o
  join public.questions q on q.id = o.question_id
  where q.status = 'validated'
    and (
      public.can_manage_workspace(public.opposition_workspace(q.opposition_id))
      or public.has_active_opposition_access(q.opposition_id)
    );

grant select on public.safe_questions to authenticated;
grant select on public.safe_question_options to authenticated;

-- =====================================================================
-- 3a) submit_attempt: corrige en SERVIDOR (lee la solucion) y finaliza el
--     intento. Solo el dueno del intento, y solo si esta `in_progress`.
-- =====================================================================
create or replace function public.submit_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_att public.test_attempts;
  v_total integer;
  v_answered integer;
  v_correct integer;
begin
  select * into v_att from public.test_attempts where id = p_attempt_id;
  if v_att.id is null then
    raise exception 'attempt not found';
  end if;
  if v_att.user_id is distinct from v_user then
    raise exception 'forbidden';
  end if;
  if v_att.status <> 'in_progress' then
    raise exception 'attempt not editable';
  end if;

  -- Marca cada respuesta como correcta/incorrecta comparando con la solucion.
  update public.test_answers ta
  set is_correct = (ta.selected_option_id::text = q.correct_answer),
      updated_at = now()
  from public.questions q
  where ta.attempt_id = p_attempt_id
    and ta.question_id = q.id
    and ta.selected_option_id is not null;

  select count(*) into v_total
  from public.test_questions
  where test_id = v_att.test_id;

  select
    count(*) filter (where ta.selected_option_id is not null),
    count(*) filter (where ta.is_correct is true and ta.selected_option_id is not null)
  into v_answered, v_correct
  from public.test_answers ta
  where ta.attempt_id = p_attempt_id;

  update public.test_attempts
  set status = 'submitted',
      submitted_at = now(),
      total_questions = v_total,
      correct_count = v_correct,
      incorrect_count = v_answered - v_correct,
      unanswered_count = v_total - v_answered,
      score = v_correct,
      updated_at = now()
  where id = p_attempt_id;

  return jsonb_build_object(
    'status', 'submitted',
    'submitted_at', now(),
    'total_questions', v_total,
    'correct_count', v_correct,
    'incorrect_count', v_answered - v_correct,
    'unanswered_count', v_total - v_answered,
    'score', v_correct
  );
end;
$$;

-- =====================================================================
-- 3b) get_attempt_review: tras enviar, revela solucion + explicacion al dueno.
--     Devuelve un array jsonb (una entrada por pregunta del test).
-- =====================================================================
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_att public.test_attempts;
  v_result jsonb;
begin
  select * into v_att from public.test_attempts where id = p_attempt_id;
  if v_att.id is null then
    raise exception 'attempt not found';
  end if;
  if v_att.user_id is distinct from v_user then
    raise exception 'forbidden';
  end if;
  if v_att.status <> 'submitted' then
    raise exception 'review not available';
  end if;

  select coalesce(jsonb_agg(item order by item_order), '[]'::jsonb)
  into v_result
  from (
    select
      tq.order_index as item_order,
      jsonb_build_object(
        'question_id', q.id,
        'order', tq.order_index,
        'statement', q.statement,
        'options', coalesce((
          select jsonb_agg(
                   jsonb_build_object('id', o.id, 'text', o.text, 'order', ord.idx - 1)
                   order by ord.idx)
          from jsonb_array_elements_text(tq.options_order)
               with ordinality as ord(option_id, idx)
          join public.question_options o on o.id = ord.option_id::uuid
        ), '[]'::jsonb),
        'selected_option_id', ans.selected_option_id,
        'correct_option_id', q.correct_answer,
        'is_correct', ans.is_correct,
        'explanation', q.explanation,
        'topic', q.topic,
        'difficulty', q.difficulty,
        'source_reference', q.source->>'reference'
      ) as item
    from public.test_questions tq
    join public.questions q on q.id = tq.question_id
    left join public.test_answers ans
      on ans.attempt_id = p_attempt_id and ans.test_question_id = tq.id
    where tq.test_id = v_att.test_id
  ) sub;

  return v_result;
end;
$$;

grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;
