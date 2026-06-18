# Release blockers pre-beta (SPEC 027)

Si **cualquiera** de estos ocurre, la beta **no** sale. Estado tras la revisión de
QA (automática en modo memory). La columna "Cobertura" indica cómo se previene.

| # | Blocker | Cobertura | Estado |
| --- | --- | --- | --- |
| 1 | Student accede a administración | guards + RLS manage solo gestores | ✅ |
| 2 | Student ve preguntas no `validated` | RLS `questions_select`; facade | ✅ (gap is_correct: ver nota) |
| 3 | Student ve respuesta correcta antes de enviar | facade (`getReview` bloquea) | ✅ app · ⚠️ RLS (nota) |
| 4 | Student ve explicación antes de enviar | facade | ✅ app · ⚠️ RLS (nota) |
| 5 | Student ve resultado de otro usuario | `studentPortal.test.ts`; RLS `user_id=auth.uid()` | ✅ |
| 6 | Student modifica attempt `submitted` | `testAttemptService.test.ts` | ✅ |
| 7 | Test incluye preguntas no `validated` | `testGeneratorService.test.ts` | ✅ |
| 8 | Test incluye preguntas de otra oposición | `testGeneratorService.test.ts` | ✅ |
| 9 | Pregunta IA nace `validated` | `aiGenerationFeedback.test.ts` | ✅ |
| 10 | Pregunta inválida se aprueba | `questionReviewService.test.ts`, validación | ✅ |
| 11 | Material/topic `obsolete` valida pregunta | gate de validación | ✅ |
| 12 | Se mezclan workspaces/oposiciones | `oppositionsAccess.test.ts`, RLS | ✅ |
| 13 | Service role en frontend | `supabaseSecurity.test.ts` | ✅ |
| 14 | `.env` subido al repo | `.gitignore` | ✅ |
| 15 | RLS permite lectura indebida | `025_rls_hardening.sql` + plan manual | ✅ app · 🔎 staging |
| 16 | Borrado de cuenta rompe datos compartidos | Edge Function (solo revoke/archive/soft-delete) | ✅ diseño · 🔎 staging |
| 17 | Owner único borra cuenta y deja org sin owner | bloqueo en `delete-account` + `accountDeletion.ts` | ✅ |
| 18 | Registro/login/reset rotos | `authValidation.test.ts` + manual | ✅ app · 🔎 staging |
| 19 | No se completa flujo student/admin | `studentPortal.test.ts` + guion manual | ✅ app · 🔎 staging |

## Notas

- **Gap `is_correct` (blockers 2–4, parcial)**: con RLS básica el alumno puede leer
  las opciones de preguntas `validated` y sus respuestas, así que `is_correct` es
  legible vía **API directa**. La UI/servicio **nunca** lo muestran antes de enviar.
  No es un blocker de la beta cerrada (la UI no lo expone), pero el cierre
  definitivo (servir opciones saneadas por RPC/vista) debe entrar en la beta —
  ver [`../security/rls-known-gaps.md`](../security/rls-known-gaps.md). **Estado:
  aceptado para beta cerrada, con cierre planificado.**

## Conclusión

Sin blockers **abiertos** en la cobertura automática (modo memory). Pendiente:
ejecutar el [guion manual](./pre-beta-manual-test-script.md) y el
[plan de RLS](../security/rls-test-plan.md) contra staging antes de SPEC 028.
