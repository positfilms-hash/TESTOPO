# Checklist de consistencia de datos pre-beta (SPEC 027)

Comprobaciones de integridad. En **modo Supabase**, ejecútalas como consultas SQL
en staging (la mayoría son FK/constraints que ya impone el esquema; las marcadas
con 🔎 conviene comprobarlas con datos reales). En **modo memory**, las reglas las
garantizan los servicios (tests citados).

Leyenda: ✅ garantizado por esquema/constraint o test · 🔎 verificar con datos.

## Workspaces
- ✅ No hay workspace sin owner (`owner_id NOT NULL`).
- ✅ No hay workspace sin `status` (default `active` + check).
- ✅ Slug único (`unique`).
- ✅ Student no es owner por error (rol viene de `workspace_members`).

## Workspace members
- ✅ No duplicados usuario/workspace (`unique(workspace_id, user_id)`).
- 🔎 No hay memberships `active` de usuarios `deleted` (la Edge Function los pone
  `revoked`; comprobar tras un borrado real).
- ✅ No hay membership sin profile (`user_id` FK a `profiles`).
- ✅ No queda owner único eliminado (bloqueo en `delete-account` + `accountDeletion.ts`).

## Oppositions
- ✅ Toda oposición tiene workspace (`workspace_id NOT NULL` FK).
- ✅ `opposition_access` no apunta a oposición inexistente (FK + `on delete cascade`).
- 🔎 Slug: en el esquema es único **global** (no por workspace); decisión vigente
  (ver migración 021). No relajar sin spec.

## Materials
- ✅ Material siempre con `opposition_id` (NOT NULL FK).
- ✅ Material `obsolete` no valida preguntas nuevas (`questionService` resolvers +
  `questionMaterialSource.test.ts`).
- 🔎 `storage_path` no expone rutas públicas inseguras (solo metadatos en BD; el
  archivo vive donde la app lo guarda).

## Topics
- ✅ Topic siempre con `opposition_id`.
- ✅ Parent de la misma oposición, sin ciclos, sin self-parent (`topicService.test.ts`).
- ✅ Topic `obsolete` no valida preguntas nuevas (`questionService` resolvers).

## Material-topic links
- ✅ No duplicados (`unique(material_id, topic_id)`).
- ✅ FK a material y topic existentes (`on delete cascade`).
- 🔎 No cruzan oposición/workspace (regla de servicio; verificar con datos).

## Questions
- ✅ Pregunta siempre con `opposition_id`.
- ✅ `validated` exige enunciado, explicación, fuente, tema, dificultad y
  exactamente una correcta (`validateQuestion.test.ts`, `questionValidationService.test.ts`).
- ✅ IA nunca nace `validated` (`aiGenerationFeedback.test.ts`).
- ✅ `validated` no se apoya en material/topic `obsolete` (gate de validación).

## Tests
- ✅ Test siempre con `opposition_id`.
- ✅ Solo preguntas `validated`, de la misma oposición, sin duplicar
  (`testGeneratorService.test.ts`; `unique(test_id, question_id)`).
- ✅ `test_question` apunta a pregunta existente (FK).

## Attempts
- ✅ Attempt con `user_id` (en supabase; en memory puede ser null por diseño MVP).
- 🔎 No hay attempt de usuario sin acceso a la oposición (guard de servicio +
  RLS; verificar con datos).
- ✅ `submitted` calcula contadores; `unanswered` no cuenta como incorrect
  (`testAttemptService.test.ts`).
- ✅ Un attempt no es visible para otro student (RLS `user_id = auth.uid()` +
  `studentPortal.test.ts`).

## Answers
- ✅ Answer siempre con attempt (FK `on delete cascade`).
- ✅ No duplicada para `(attempt_id, test_question_id)` (`unique`).
- ✅ No modificable tras submit (`testAttemptService.test.ts`).
- ✅ No visible para otro student (RLS).

> Hallazgos durante la revisión: ninguno con datos demo (todos los invariantes
> automáticos pasan). Las marcas 🔎 se confirman en staging — anota desviaciones
> en [`pre-beta-bug-log.md`](./pre-beta-bug-log.md).
