# SPEC 038 - Internal Material Study Flow Without Public Syllabus Index

## Product Decision

TESTOPO must no longer require a public syllabus index, applied Topic Map, or
per-topic review before material can be prepared for question generation.

The new user flow is:

```text
upload material
  -> native extraction or usable OCR
  -> Estudiar material
  -> internal blocks, concepts, and concrete sources
  -> Material estudiado / ready for future question generation
```

The user should understand only: upload material, let AI study it, then later
generate questions. Internal organisation may exist, but it is not a mandatory
visible syllabus or a manual topic-selection step.

## Supersession And Compatibility

This SPEC supersedes the **visible-index dependency** introduced or retained in
the earlier syllabus-to-question flow (notably the public-index portions of
SPEC 032 and SPEC 037, and the index precondition in the SPEC 035 smoke flow).
Do not delete existing tables, routes, proposals, Topics, or source records.
They remain compatibility/history data and may continue to work for legacy
flows, but the new primary path must not depend on them.

SPEC 036 session/workspace rehydration remains foundational and is not
superseded. SPEC 035 server-secret/no-mock safety remains foundational too.
Document this precise transition rather than falsely marking security or
rehydration work obsolete.

## Objective

Create an authenticated server-side material-study flow that prepares usable,
traceable internal evidence for future direct question generation. This SPEC
does **not** implement final direct question generation; that belongs to
SPEC 039 after this data layer and its staging smoke are proven.

## Scope

1. Reuse the existing Temario/analysis route where practical, but replace the
   visible-index-first experience with a simple `Estudiar material` action.
2. Add an authenticated server/Edge Function study operation. The browser sends
   only controlled scope IDs/options, never material text, OCR text, prompts,
   images, a user ID, provider key, or a private source.
3. Validate JWT, active actor, management access, workspace, opposition, and
   all material eligibility before reading evidence or calling a provider.
4. Create a durable internal study run and source-backed study units. Concepts
   are stored only when the provider returns valid source-grounded concepts.
5. Mark processed material/study scope honestly as ready, ready with warnings,
   or failed. Never claim study completion without real stored results.
6. Display honest coarse progress and a concise safe summary. No fake
   percentages, public mandatory tree, raw provider output, full excerpts, or
   internal IDs.
7. Preserve Material upload/open/delete/OCR, current RLS boundaries, and
   InMemory fallback. Do not generate questions in this SPEC.

## Internal Data Model

First audit whether existing `material_sections`, `source_references`, and
`document_classifications` can provide all required persisted state. Add only
the smallest additive, idempotent schema necessary to represent study lifecycle
and units. The expected conservative model is:

- `material_study_runs`: scoped aggregate lifecycle (`pending`, `processing`,
  `completed`, `completed_with_warnings`, `failed`), actor, counts, provider/model
  metadata, timestamps, safe warnings/errors.
- `material_study_units`: internal source-backed blocks with workspace,
  opposition, run, material, optional existing section/reference, title, short
  summary, bounded excerpt, page range where known, importance, confidence, and
  timestamps.
- `material_study_concepts`: optional source-backed concepts linked to a unit;
  use only if needed for the study result. It has the same workspace/opposition
  scope and a concrete unit/excerpt pointer.

Every unit and concept must be traceable to an existing eligible material and
at least one concrete source pointer (`material_section_id`,
`source_reference_id`, or a documented bounded material excerpt verified against
server-retrieved text). Do not create a free-floating concept.

If material-level status is needed for UX, add only additive fields or an
equivalent derived query. A material becomes `studied` only after a completed
run produced usable units for it; OCR warnings result in an honest warning state.
Do not overwrite good extraction/OCR text or delete historical runs/units.

## Material Eligibility

Study only material in the requested current workspace/opposition that is:

- native readable (`extraction_status = completed`);
- usable OCR (`completed_ocr` or `completed_ocr_with_warnings`); or
- another already-supported extracted readable file type.

Exclude `failed`, `ocr_failed`, `not_supported`, obsolete, irrelevant,
not-analyzable, and uncorrected ambiguous material. OCR-warning material is
eligible but surfaces a warning. Old exams/tests may provide style metadata only
and cannot become factual study units or future factual question evidence.

## Server Boundary

Implement one authenticated operation, preferably:

```text
supabase/functions/study-material/index.ts
```

Its request contains only:

```json
{
  "workspace_id": "uuid",
  "opposition_id": "uuid",
  "mode": "all_eligible",
  "force_retry": false
}
```

Reject unknown/prohibited fields including `user_id`, `material_text`,
`raw_text`, `ocr_text`, `prompt`, `concepts`, `image_base64`, `api_key`, and
equivalents. Verify JWT explicitly and derive actor only from it. Validate the
same existing management role rules as OCR/question generation; Student,
revoked, deleted, foreign-scope, and unauthorised actors fail before provider
or database use.

Use provider secrets only from Edge Function/server configuration. No provider
key, service key, model secret, or raw study evidence may reach `VITE_*`, the
frontend, repository, screenshots, or logs. If the provider is absent,
return HTTP 501 `MATERIAL_STUDY_PROVIDER_NOT_CONFIGURED` and create no mock
completed run/unit/concept/status in Supabase staging/production.

Provider output is structured and must refer only to supplied existing source
IDs/pointers. Validate title, bounded summary, source grounding, scope, excerpt
containment, and confidence before persistence. A provider failure or invalid
output results in an honest failed run/status, never invented blocks/concepts.

## UI: Temario / Análisis

Do not change routes merely to rename a page. Reuse the existing Temario route
where low risk, but its primary content becomes:

| State | Required UX |
| --- | --- |
| No material | Explain that material must be uploaded; link to Material. |
| Still reading/OCR | Explain that material must finish reading before it can be studied. |
| Ready | `Estudiar material` primary action and short readable-material summary. |
| Studying | `La IA está estudiando tus documentos…` with honest coarse steps, not percentages. |
| Studied | `Material estudiado` and safe counts of documents, blocks, concepts, and warnings. |
| Failed | Clear retryable safe error; no fake completion. |

Coarse steps may be shown only when true for the operation: reviewing eligible
documents, reading extracted/OCR text, preparing source-backed blocks, and
saving study preparation. Do not show a required public index, topic tree,
per-node accept/reject controls, `Aplicar índice`, or a mandatory `topic_id`.
Existing legacy index controls must not be the primary path for a new material.

Material UI remains limited to upload/open/delete/read/OCR status; it does not
absorb the analysis workflow.

## Future Question Generation Contract

SPEC 038 creates no candidates and no direct-generation UI. It prepares only
the stable source-backed unit/concept layer for SPEC 039. Document that future
questions must link to `material_id`, a concrete section/reference or
`material_study_unit_id`, source excerpt, explanation, and never be saved
without evidence or as `validated`.

## Permissions, RLS, And Fallback

Keep workspace/opposition boundaries and current RLS semantics. New internal
tables, if necessary, are management-only: owner/admin/authorised manager and
existing permitted premium owner may study/list summaries; Student cannot invoke
study, view runs/units/concepts/raw excerpts, or infer other-workspace data.

Use additive migration/RLS only for genuinely new study tables. Do not broadly
redesign Auth/RLS. Maintain an explicit InMemory fallback that can model study
state deterministically in local tests/demo, but make mock/provider-like output
impossible to present as real in Supabase staging/production.

## Explicitly Out Of Scope

- Final direct question generation or changing `generate-questions` request
  semantics (SPEC 039).
- OCR/provider changes, material upload/open/delete redesign, embeddings, RAG,
  fine-tuning, dashboard metrics, payments, ranking, or gamification.
- Public index generation/application, mandatory Topics, per-topic validation,
  destructive cleanup of legacy syllabus data, large Auth/RLS changes.

## Required Tests And Documentation

Add focused tests for:

- no material, processing/OCR-pending, eligible native text, OCR, OCR warnings,
  failed/obsolete/classification exclusions;
- authenticated scope/permission guards, Student/revoked/deleted/cross-workspace
  rejection, prohibited arbitrary input, provider absent/failure/invalid output;
- source-grounded unit/concept persistence, bounded excerpts, honest runs/status,
  retry/history, no mock real-state writes;
- Temario/analysis state UX, honest progress, no mandatory public index/topic,
  safe completion/failure summary, and InMemory fallback;
- Material/OCR regression, no question creation, no `validated` write, and no
  frontend secret/provider call.

Create/update:

- `docs/architecture/material-study-flow.md`
- `docs/user-guides/study-material.md`
- `docs/qa/material-study-flow-test-plan.md`
- transition notes in relevant 032/035/037 documentation, narrowly explaining
  that their visible-index dependency is superseded by SPEC 038 while preserving
  security/session work.

Run backend/frontend suites, frontend build, `git diff --check`, and the Codex
visual-review runbook at 1366x900 and 390x844. A real staging success claim
requires deployed secrets and an actual staging retest.

## Acceptance Criteria

- New material advances without generating/applying/validating a visible index
  or selecting a Topic.
- Temario/analysis exposes an honest `Estudiar material` state flow.
- Server-side analysis creates only scoped, source-backed internal study data.
- Materials are honestly marked studied or studied-with-warnings only after real
  usable persistence; failed/provider-absent paths do not fake completion.
- Student cannot study or inspect internals; no secrets appear in frontend.
- No questions or `validated` records are created by this SPEC.
- Legacy syllabus data remains compatible/history-preserved but is not required
  by the new primary flow.

## Instructions For Claude

Read `docs/constitution/CODEX.md`, `docs/constitution/CLAUDE.md`, this SPEC,
SPEC 030, 032, 033, 034, 035, 036, and 037 before coding. Treat the old
visible-index dependency as superseded, not the security/session foundations.
Audit existing sections/references/classifications before adding schema and use
the smallest safe design. Do not add a parallel browser/provider path, mock
staging results, public source text, or direct question generation. Report the
chosen data model, root migration rationale, tests/build/visual evidence, and
any staging-only blocker.
