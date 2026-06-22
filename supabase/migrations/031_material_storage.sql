-- TESTOPO - SPEC 029: almacenamiento privado de materiales (Supabase Storage).
--
-- Crea un bucket PRIVADO `materials` para los archivos originales (PDF, etc.).
-- El original solo se abre con una URL FIRMADA de corta duracion emitida por la
-- sesion del gestor; nunca es publico ni se usa la service-role key. El control
-- por oposicion lo aplica el facade (requireManageOpposition) antes de firmar;
-- estas politicas son el backstop a nivel de storage: solo usuarios que GESTIONAN
-- algun workspace (owner/admin) pueden tocar el bucket. Los alumnos quedan fuera.
--
-- Migracion IDEMPOTENTE (sigue docs/setup/migrations-runbook.md).

-- Bucket privado (public = false).
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

-- Politica de acceso al bucket: solo gestores (owner/admin de algun workspace).
drop policy if exists materials_objects_rw on storage.objects;
create policy materials_objects_rw on storage.objects
  for all to authenticated
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.workspace_members m
      where m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  )
  with check (
    bucket_id = 'materials'
    and exists (
      select 1 from public.workspace_members m
      where m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );
