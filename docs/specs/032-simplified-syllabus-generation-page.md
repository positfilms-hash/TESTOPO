# SPEC 032 - Simplified Syllabus Generation Page

## Objective

Replace the confusing Temario entry screen with a calm, focused syllabus
generation page. For an opposition without an applied syllabus, the primary
experience is one obvious action: `Generar temario`.

That action reuses the existing document-understanding and syllabus-index
pipeline to analyse eligible uploaded material and create a reviewable proposal
of topics and subtopics. It never writes a full syllabus, questions, tests, or
validated content, and never applies a proposal without an explicit human
action.

## User Model

The user should understand only this sequence:

1. Upload, open, check, and remove files in Material.
2. Generate a syllabus in Temario.
3. Review and apply the proposed index.
4. Continue with already-existing later workflows.

Material remains a file library. Temario owns analysis, a proposed index, human
review, and applying the index. Do not add upload controls to Temario or
classification/index controls to Material.

## Existing Building Blocks To Reuse

Reuse the existing guarded flows rather than creating a parallel pipeline:

- Material repositories and existing extraction/OCR text in `content_text`.
- Document classification, material sections, and source references.
- `SyllabusIndexRun`, `SyllabusIndexProposal`, node proposals, source records,
  the existing index-generation service, and `PlatformService` proposal apply
  methods.
- Current Supabase and InMemory repositories, application guards, and RLS.

An additive, narrow platform/facade orchestrator is permitted only if no
existing method composes the required steps for the current opposition. It must
call existing services in order and return existing domain result types; it must
not add tables, repositories, alternative storage, permissions, or AI paths.

## Eligible Material

`Generar temario` considers all material in the current workspace and
opposition, not merely the last upload. It may use:

- Native extracted text: `extraction_status = completed`.
- OCR output: `completed_ocr` and `completed_ocr_with_warnings` when SPEC 030
  is available.
- Existing readable TXT/MD material if the current ingestion pipeline supports
  it.

It excludes failed, unreadable, obsolete, and unsupported material, including
`failed`, `ocr_failed`, `not_supported`, and `material.status = obsolete`.
Material with OCR warnings is eligible but carries a clear, non-technical
warning into the proposal/review presentation. Do not claim OCR support in the
UI until its status exists in the current deployed model.

The pipeline may classify unclassified eligible material, create missing
sections/references, and generate the index as one controlled backend flow.
Tests antiguos remain secondary style/coverage context only; they cannot become
the main factual basis for a syllabus and must not be copied.

## Temario States And UI

Use the visual language from SPEC 031. The initial view is intentionally sparse:

- Title: `Temario`.
- Short explanatory sentence that says the app will analyse uploaded material
  and propose a reviewable topic/subtopic index.
- One large, centered primary action: `Generar temario`.
- A small, human-readable material readiness summary, not internal runs, IDs,
  prompts, raw errors, or classification tables.

Represent the following states with clear language and existing UX primitives:

| State | Required presentation |
| --- | --- |
| No material | Explain that material must be uploaded first and provide the existing navigation action to Material. Disable/hide generation. |
| Material processing | Explain that some files are still being read. For this MVP, disable generation until eligible material is available rather than creating a new background-work policy. |
| Ready | Show the primary action and concise readiness count. |
| Generating | Show friendly staged progress such as `Analizando material...` and `Generando indice...`; no internal provider or repository details. |
| Proposal pending review | Show a clean index tree, sources where existing support provides them, warnings, and existing review/apply controls. |
| Applied | Show the approved Topic Map as the primary content and only already-existing relevant actions. |
| Failure | Show a clear human message and an existing retry/regenerate action where the current workflow supports it; retain technical codes in logs only. |

After generation, show `Indice propuesto`, topics/subtopics, existing source
references, warning summary, and actions already supported by the domain:
`Aplicar indice`, `Regenerar temario`, and any existing view-source/reject
controls. A regeneration creates a new proposal and must not silently delete a
prior proposal or applied topics. If an applied syllabus exists, applying a
replacement must use the existing safe confirmation/replace policy; it must
never remove the current Topic Map automatically.

## Human Review And Safety

- The AI proposes an index only. It does not write explanatory syllabus prose,
  generate questions, generate tests, or validate anything.
- Every proposed topic/subtopic needs existing source support. A source-free
  proposal is marked doubtful or excluded according to current validation
  behavior; never invent a source.
- Applying the Topic Map requires a deliberate authorized human click. A
  successful generation alone changes no applied topics.
- Owner, admin, manager, and existing permitted premium-owner roles retain the
  current ability to generate/review/apply. Student and users without access
  cannot initiate generation or read runs, proposals, internal classifications,
  source work data, warnings, or raw errors. Student only sees an applied
  syllabus where current product rules allow it.
- Maintain workspace and opposition boundaries, Supabase RLS, application
  guards, and InMemory fallback behavior.

## Explicitly Out Of Scope

- Uploading, opening, deleting, OCR execution, or changing Material behavior.
- New document classes, OCR/provider behavior, source-reference schemas, or
  index-generation algorithms.
- Full syllabus prose, notes, questions, question validation, tests, results,
  and direct student test creation.
- New persistence tables, migrations, Supabase/RLS policy changes, service-role
  usage, public file access, RAG, embeddings, or fine-tuning.
- A redesign outside the Temario flow, except shared visual components needed
  for its consistency with SPEC 031.

## Expected Change Surface

- `app/frontend/src/pages/TopicPage.tsx` and closely related existing frontend
  components/styles/tests.
- Existing frontend-to-platform integration for syllabus actions.
- At most one small existing-service/facade orchestration method plus focused
  tests, only when composition is genuinely missing.
- User guide and QA test plan updates:
  `docs/user-guides/create-syllabus-index.md`,
  `docs/user-guides/upload-material.md`, and
  `docs/qa/syllabus-generation-page-test-plan.md`.

Do not modify repository implementations, migrations, Supabase schema/RLS, or
unrelated frontend screens.

## Acceptance Criteria

- Temario is a clean, focused page with a prominent `Generar temario` action
  when no syllabus is applied and eligible material exists.
- With no material, it directs the user to Material and cannot generate.
- It analyses all eligible current-opposition material with native extraction
  and, when available, usable OCR text; it excludes unreadable/obsolete files.
- The user sees simple progress, not internal implementation details.
- It reuses the existing classification, sections/source, and index proposal
  pipeline rather than duplicating it.
- The output is a source-supported index proposal, never full syllabus prose,
  questions, or tests.
- No proposal or Topic Map is applied automatically. Applying requires explicit
  authorized human action and preserves existing content safely.
- Student sees no internal generation or proposal tools/data.
- Material remains upload/open/review/delete only and continues to work.
- Supabase/RLS and InMemory maintain current boundaries and tests remain green.
- Focused tests cover: no material, readable native text, usable OCR text,
  OCR-warning behavior, unreadable/obsolete exclusions, proposal creation,
  non-automatic apply, regeneration safety, authorization, Student isolation,
  and Material-flow regression.
- Run frontend/build checks and visual smoke review at `1366x900` and `390x844`.

## Instructions For Claude

Before implementation, read `docs/constitution/CODEX.md`,
`docs/constitution/CLAUDE.md`, this spec, the existing Topic/Material UI,
syllabus-index and classification tests, and
`docs/qa/codex-visual-review-runbook.md`. Reuse the established pipeline and
the visual conventions from SPEC 031. Do not widen the domain or introduce
another generation pipeline. Preserve local changes, run focused tests and
build, perform desktop/mobile smoke checks, and report the exact orchestration
reused, changed files, commands/results, and any limitation.
