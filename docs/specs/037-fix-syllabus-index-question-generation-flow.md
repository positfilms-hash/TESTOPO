# SPEC 037 - Fix Syllabus Index & Question Generation Flow

## Objective

Fix the critical flow from readable material to source-grounded question
generation:

```text
read native PDF / usable OCR
  -> concise syllabus-index proposal
  -> one global human apply action
  -> active Topics with real scoped sources
  -> server-side question candidates
```

The syllabus is an index of study blocks. It is not a transcription of a PDF,
an article-by-article map, or complete study notes.

This SPEC does not replace SPEC 035 (staging AI activation) or SPEC 036
(session/workspace rehydration). It fixes the observed gap: the Questions UI
can report sources while `generate-questions` rejects the same topic for having
no eligible factual source.

## Scope

1. Locate and document the exact source-readiness mismatch using safe QA
   evidence: UI preview, applied topic, `topic_source_references`, linked
   sections/references, material classification/status, and Edge response.
2. Align the visible readiness with the authoritative server-side eligibility
   rule. A positive source count must mean the server can use factual evidence,
   subject to permission and provider checks.
3. Generate compact, useful index proposals from eligible material.
4. Allow one global review and one explicit `Aplicar índice completo` action;
   no per-topic acceptance is required.
5. Apply the proposal into real active Topics and persist real scoped source
   links for every question-ready Topic.
6. Retain server-side source-grounded question generation and show the actual
   safe reason when it cannot proceed.

## Index Rules

The index organises important study blocks; it never mirrors a PDF's pages,
articles, paragraphs, minor headings, or dispositions.

- Target 5-15 top-level topics; hard maximum 20.
- Use one or two levels normally. A third level needs clear study value.
- Prefer concise semantic titles such as `Derechos y deberes fundamentales`.
- Group related articles/headings beneath logical blocks. Articles remain
  factual evidence, not default topic titles.
- Do not output full notes, long summaries, copied text, questions, tests, or
  `validated` content.

Update the index prompt and deterministic validation accordingly. A proposal
that is dominated by article/page-level nodes, exceeds the cap, has empty
titles, or lacks valid source mapping is `needs_regeneration`; never silently
apply it.

## Proposal Review And Apply

The manager flow is:

1. `Generar temario` creates one reviewable index proposal from eligible
   material in the current workspace/opposition.
2. The user sees the whole compact tree, warning summary, and source-readiness
   summary.
3. The user may regenerate or make globally supported edits.
4. The user explicitly chooses `Aplicar índice completo` once.

Applying must create/update real `topics` with correct `workspace_id`,
`opposition_id`, parent/order data, and `active` status. It must also create or
update real `topic_source_references` with existing eligible
`source_references`/`material_sections`. Do not mass-duplicate equivalent
topics on reapply and do not delete an existing applied map without the current
safe confirmation/replace behaviour.

## Material And Source Rules

Factual evidence is only existing readable current-scope material:

- native extraction `completed`;
- `completed_ocr` and `completed_ocr_with_warnings` (the latter warns); and
- existing sections/references effectively classified as `syllabus_material`,
  `legal_text`, `notes_or_summary`, or `index_or_table_of_contents`.

Exclude obsolete, failed, `ocr_failed`, unsupported, unreadable, irrelevant,
not-analyzable, and uncorrected ambiguous material. Tests/exams may influence
style only; they are never primary factual evidence.

A Topic is question-ready only if the same authoritative eligibility logic used
by `generate-questions` finds at least one concrete source. The browser must
not count merely linked but forbidden/incomplete rows. Do not weaken the Edge
guard or accept browser-provided evidence to make a topic look ready.

Topics without usable sources may be visible with `Sin fuentes suficientes`,
but their question action is disabled/explained. Where eligible material exists,
application must map every applied question-ready Topic to a valid source.

## Question Generation

Reuse the existing authenticated `generate-questions` Edge Function. Browser
requests contain IDs and bounded parameters only: never source text, prompts,
user IDs, images, or private keys. The server continues to validate JWT, actor,
workspace, opposition, active applied Topic, and existing scoped evidence.

When ready, generated candidates retain topic, material, concrete source
pointer, and excerpt. Their status is only `pending_review` or `needs_fix`,
never `validated`.

Use safe Spanish errors:

| Condition | Required message |
| --- | --- |
| No eligible source | `Este tema no tiene fuentes asociadas y utilizables. Regenera o reaplica el temario para vincularlo al material.` |
| Topic not applied | `Este tema todavía no está aplicado. Aplica el índice antes de generar preguntas.` |
| Provider absent | `La generación de preguntas todavía no está configurada en servidor.` |
| Access denied | `No tienes permisos para generar preguntas en esta oposición.` |
| Other safe failure | `No se pudieron generar preguntas. Revisa que el tema tenga fuentes válidas e inténtalo de nuevo.` |

Never expose prompts, full excerpts, provider errors, signed URLs, secrets, or
internal database details.

## Security And Scope Limits

Keep existing owner/admin/authorised-manager/premium-owner capabilities and
Student, revoked, deleted, and cross-scope isolation. Maintain Auth, RLS,
private material access, Supabase repositories, workspace/opposition boundaries,
and InMemory fallback.

Out of scope: OCR/provider implementation, provider secrets/frontend calls,
embeddings, RAG, fine-tuning, metrics, payments, ranking, gamification, new
test workflow, broad Auth/RLS/schema redesign, and automatic question
validation.

## Required Tests And Documentation

Add focused coverage for:

- compact index shape, max 20, shallow hierarchy, and no article/page-per-node;
- global review/apply with no per-topic gate;
- apply creates/reuses scoped active Topics and source links without mass
  duplication;
- native/OCR/OCR-warning mapping and failed/obsolete exclusion;
- frontend source readiness matching server eligibility exactly;
- ready topic reaches `generate-questions`, creates a run and only traceable
  pending-review/needs-fix candidates;
- clear no-source, unapplied, provider, access, provider-failure, and save
  errors; Student/cross-scope isolation; Material/OCR and InMemory regression.

Create/update:

- `docs/architecture/syllabus-to-question-generation-flow.md`
- `docs/user-guides/create-syllabus-index.md`
- `docs/qa/syllabus-question-generation-flow-test-plan.md`

Run relevant backend/frontend suites, frontend build, `git diff --check`, and
the visual review runbook at 1366x900 and 390x844. Do not claim real provider
success without a separate real staging retest.

## Acceptance Criteria

- Temario proposes a compact study index, not document transcription.
- The manager reviews globally and applies once; no per-topic approval gate.
- Applying creates usable active scoped Topics with real source links.
- Questions generation succeeds for an applied Topic with eligible evidence.
- UI source readiness cannot contradict Edge source eligibility.
- No factual question lacks a concrete server-side source and no candidate is
  `validated`.
- Errors are safe, Spanish, and action-oriented; Student isolation, server-only
  secrets, OCR/Material flow, RLS boundaries, and InMemory fallback remain.

## Instructions For Claude

Read `docs/constitution/CODEX.md`, `docs/constitution/CLAUDE.md`, this SPEC,
SPEC 028-C, 028-D, 028-E, 030, 032, 033, 034, 035, and 036 before coding.
Diagnose the observed readiness mismatch with safe evidence first. Implement the
smallest coherent fix; never relax source eligibility, accept browser source
text, add frontend provider keys, create mock candidates, or bypass scope
checks. Report root cause, changed paths, test/build/visual results, and any
remaining staging limitation.
