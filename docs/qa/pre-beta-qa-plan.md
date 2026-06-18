# Plan de QA pre-beta (SPEC 027)

Esta spec **no añade funcionalidades**: estabiliza y verifica el MVP ya migrado a
Supabase antes de la beta cerrada (SPEC 028).

## Qué se prueba y por qué

| Área | Qué se verifica | Por qué |
| --- | --- | --- |
| Consistencia de datos | que no se mezclen datos de usuarios/workspaces/oposiciones | una fuga de datos bloquea la beta |
| Permisos | que cada rol solo pueda lo que debe | seguridad y confianza |
| RLS | que la BD también proteja (no solo la app) | defensa en profundidad |
| Flujos E2E | que org/student/premium funcionen de principio a fin | que el MVP sea usable |
| IA | que nunca cree preguntas `validated` ni aplique índice sin revisión | fiabilidad del banco |
| Tests | que solo usen preguntas `validated` | calidad de los tests |
| Eliminación de cuenta | que sea segura y no rompa datos compartidos | privacidad/integridad |

## Perfiles de prueba

Owner organización · Admin/manager · Student A · Student B · Premium individual ·
Usuario sin acceso · Usuario eliminado. Cada uno se prueba por separado
(detalle en [`pre-beta-permissions-checklist.md`](./pre-beta-permissions-checklist.md)).

## Datos demo

El seed (`app/frontend/src/store/appStore.ts → seedDemoData`, modo memory) crea
admin/alumno, workspace, oposición, material activo, temas y preguntas
`validated` + `pending_review`. Para QA de estados completos (material/topic/
pregunta en cada estado, 2 oposiciones, attempts de 2 usuarios) ver el guion
manual y, en código, `app/backend/tests/studentPortal.test.ts` (construye ese
mundo). Nunca se usan datos reales/sensibles (regla del proyecto).

## Cómo ejecutar los tests automáticos

```bash
cd app/backend  && npm run typecheck && npm test   # dominio (modo memory)
cd app/frontend && npx tsc --noEmit && npm run build && npm test
```

Los tests unitarios corren en **modo memory** (sin Supabase). La verificación de
**RLS** y de la **Edge Function** es manual contra un Supabase de staging (no en
CI): ver [`../security/rls-test-plan.md`](../security/rls-test-plan.md) y
[`../setup/supabase-edge-functions.md`](../setup/supabase-edge-functions.md).

## Cobertura automática de los invariantes críticos (trazabilidad)

| Invariante (release-blocker) | Test que lo cubre |
| --- | --- |
| Student solo ve oposiciones autorizadas | `studentPortal.test.ts` |
| Student solo ve material/topic `active` | `studentPortal.test.ts`, `zoneSeparation.test.ts` |
| Student no sube material / no genera / no importa | `studentPortal.test.ts` |
| Student no ve revisión antes de enviar | `studentPortal.test.ts` |
| Student no ve resultados de otro usuario | `studentPortal.test.ts` |
| Test solo usa preguntas `validated` (excluye draft/pending/needs_fix/rejected/obsolete) | `testGeneratorService.test.ts` |
| Contadores correct/incorrect/`unanswered` correctos | `testAttemptService.test.ts` |
| IA nunca crea preguntas `validated` (queda pending/needs_fix) | `aiGenerationFeedback.test.ts`, `questionGenerationService.test.ts` |
| Gate de validación (sin explicación/fuente/única correcta → no valida) | `questionValidationService.test.ts`, `validateQuestion.test.ts` |
| Índice IA no se aplica sin revisión humana | `syllabusIndexService.test.ts`, `syllabusIndexPlatform.test.ts` |
| Owner/admin no cruza workspace/oposición | `oppositionsAccess.test.ts`, `platformAccess.test.ts` |
| Factory memory/supabase | `supabase*Access.test.ts`, `supabase*.test.ts` |
| Eliminación de cuenta: bloqueo único owner | `accountDeletion.test.ts` (frontend) |
| Service role no en frontend | `supabaseSecurity.test.ts` (frontend) |
| Release-gate consolidado | `preBetaInvariants.test.ts` |

## Clasificación de errores

Blocker / High / Medium / Low — ver
[`pre-beta-release-blockers.md`](./pre-beta-release-blockers.md) y el
[`pre-beta-bug-log.md`](./pre-beta-bug-log.md). Solo se permite **corregir bugs**
en esta spec; **no** añadir funciones.
