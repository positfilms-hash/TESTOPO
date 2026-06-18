# Checklist de permisos pre-beta (SPEC 027)

Dos capas: **guards de aplicación** (servicios/`PlatformService`) y **RLS**
(Supabase). Marca cada caso en app (tests automáticos) y en BD (manual, staging).

## Student NO puede
- [ ] Entrar en administración / `/admin`.
- [ ] Crear workspace organization · crear oposición · subir material · importar
      ZIP · crear/editar topic · crear pregunta · revisar/aprobar pregunta.
      → app: `studentPortal.test.ts` (AccessError); RLS: políticas manage solo gestores.
- [ ] Ver preguntas `draft`/`pending_review`/`needs_fix`/`rejected`.
      → RLS `questions_select` (solo `validated` para no-gestor); app: facade.
- [ ] Ver respuesta correcta / explicación antes de enviar.
      → `studentPortal.test.ts` (getReview antes de submit → error). Gap RLS de
      `is_correct` documentado en [`../security/rls-known-gaps.md`](../security/rls-known-gaps.md).
- [ ] Ver attempts/resultados de otro usuario → `studentPortal.test.ts`; RLS `user_id = auth.uid()`.
- [ ] Eliminar la cuenta de otro · darse acceso a una oposición · cambiar su rol.
      → Edge Function usa uid del JWT; trigger `profiles` revierte cambios de role/status.

## Student SÍ puede
- [ ] Registro/login/reset de contraseña.
- [ ] Ver oposiciones autorizadas, material/topic `active`.
- [ ] Crear/realizar/enviar test (con acceso) y ver su resultado + explicación tras enviar.
- [ ] Eliminar su propia cuenta.
      → `studentPortal.test.ts`, `authValidation.test.ts`, `accountDeletion.test.ts`.

## Owner/Admin (workspace) SÍ puede
- [ ] Crear oposición, gestionar miembros, dar acceso, subir material, importar
      ZIP, crear topics, generar/revisar/aplicar índice IA, generar/revisar/aprobar
      preguntas válidas, crear tests, ver datos de **sus** oposiciones.
      → `platformAccess.test.ts`, `oppositionsAccess.test.ts`, `syllabusIndexPlatform.test.ts`.

## Owner/Admin NO puede
- [ ] Gestionar workspace ajeno · ver datos de oposición ajena · cruzar
      materiales/preguntas entre oposiciones/workspaces · aprobar preguntas inválidas
      · usar service role desde frontend.
      → `oppositionsAccess.test.ts`, `questionReviewService.test.ts`,
      `supabaseSecurity.test.ts`; RLS scope por `opposition_workspace`.

## Premium individual SÍ / NO puede
- [ ] SÍ: workspace personal, oposición personal, material/índice/preguntas/tests
      propios, eliminar cuenta archivando el workspace personal.
- [ ] NO: ver datos de otros · gestionar organizations ajenas · aprobar preguntas
      de otros workspaces.
      → `workspacesPlans.test.ts`, `accountDeletion.test.ts`; Edge Function archiva
      personal.

## Verificación de RLS (manual, staging)
Sigue [`../security/rls-test-plan.md`](../security/rls-test-plan.md): impersonar
Student A/B y owner, e intentar las lecturas/escrituras prohibidas (deben dar 0
filas/error).
