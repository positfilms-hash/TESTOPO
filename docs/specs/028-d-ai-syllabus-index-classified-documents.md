# SPEC 028-D - AI Syllabus Index From Classified Documents

## Objective

Generate a structured syllabus index from classified documents, their material
sections, and concrete source references. The result is a human-reviewable
proposal of topics and subtopics, not written syllabus content, questions, or
student tests.

## Scope

Implement:

- Selection of classified, eligible material and useful sections.
- AI-assisted topic and subtopic proposals grounded in sources.
- Runs, proposals, proposal nodes, node sources, and topic-source references.
- Human review, node editing/acceptance/rejection, approval, and explicit
  application to the Topic Map.
- Supabase repositories, RLS, application guards, and InMemory fallback.
- Minimal admin/owner UI, tests, and documentation.

Do not implement:

- Written or long-form syllabus content.
- Question generation, question options, validations, or reviews.
- Test generation, attempts, answers, or results.
- OCR, RAG, embeddings, vector storage, or fine-tuning.
- Automatic application or student publication of a proposal.

## Branch

Use:

```text
feature/ai-syllabus-index-classified-documents
```

## Existing Foundation

Reuse and adapt, rather than duplicate, the SPEC 019 implementation:

- `SyllabusIndexRun`
- `SyllabusIndexProposal`
- `SyllabusIndexNodeProposal`
- `MaterialTopicSuggestion`
- `ExamPatternSummary`
- `SyllabusIndexService`, repository contract, InMemory implementation, mock
  provider, OpenAI provider, and `SyllabusIndexPanel` where suitable.

Reuse SPEC 028-B `DocumentClassification` and SPEC 028-C
`MaterialSection`/`SourceReference`. Follow
`docs/setup/migrations-runbook.md`; do not create a parallel migration process.

## Input Rules

Primary sources must be active, text-extracted, sectioned documents classified
as one of:

- `syllabus_material`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`

Secondary context may come from `old_exam_or_test` documents only to identify
coverage, frequency, difficulty, or style. It must never be the sole source of
a proposed topic or subtopic.

Exclude `irrelevant`, `not_analyzable`, obsolete material, and `ambiguous`
documents unless a human correction changed the classification to an allowed
one. Do not use material in `needs_review` unless it has an explicitly approved
usable classification.

Every proposed root topic needs at least one concrete primary source. A
subtopic needs a primary source of its own or an unambiguous inherited source
from its parent. Validate that each material, section, and source reference
exists and is sealed to the same workspace and opposition.

## Data Model

Extend existing SPEC 019 types and storage only where needed. A run must record
the selected material and section identifiers, summaries, counters, warnings,
and errors. A proposal retains its lifecycle:

```text
draft -> pending_review -> approved/rejected -> applied
```

Only `pending_review` proposals can be approved. Only `approved` proposals can
be applied. Rejected or applied proposals cannot be edited or applied again.

Add `SyllabusIndexNodeSource` if it does not already exist. It must link a
proposal node to its concrete material, optional material section and source
reference, page range, excerpt, confidence, workspace, and opposition.

Add or reuse `TopicSourceReference` for applied topics, preserving the same
source information. Do not overwrite or delete existing topics automatically.
If a topic with the same title exists under the same parent, reuse it or create
a warning instead of duplicating it.

Use the existing `ExamPatternSummary` only as secondary context. Generating new
exam-pattern analysis is optional and must not create a question bank.

## Service And AI Contract

Create `SyllabusIndexFromDocumentsService` or adapt `SyllabusIndexService` with
equivalent responsibilities:

- select eligible classified material and sections;
- bound input to excerpts and source metadata;
- create and update the run;
- call the configured provider or deterministic mock provider;
- validate the provider output before persistence;
- create proposal, nodes, node sources, and optional material suggestions;
- allow review, approval, rejection, and explicit Topic Map application.

Recommended limits are `MAX_INDEX_INPUT_CHARS = 80000`,
`MAX_INDEX_SECTIONS = 200`, `MAX_INDEX_TOPICS = 100`, and
`MAX_INDEX_DEPTH = 4`. When truncating, prefer higher-confidence primary
documents and emit warnings. Do not add embedding-based ranking.

Create or update `prompts/syllabus-index-from-classified-documents.md`. It must
require structured output with title, optional one-line description, order,
confidence in `[0, 1]`, warnings, children, and source identifiers. It must
forbid invented topics, written syllabus content, questions, options, and
tests. It must state that old exams are only secondary context.

Reject output that has missing or foreign sources, forbidden classifications,
questions/options, test-like content, or long-form syllabus writing. Mark the
run failed with persisted errors and do not create an applicable proposal.

## Review And Application

Owner, admin, authorized manager, and a premium owner of a personal workspace
can view and manage proposals in their opposition. The minimal review UI shows
the proposed hierarchy, sources, confidence, and warnings, and supports editing
title/order, accepting/rejecting nodes, approving/rejecting the proposal, and
applying an approved proposal. The apply action is disabled before approval.

Applying an approved proposal creates or reuses topics/subtopics and persists
topic-source references. It must not delete existing Topic Map data, silently
overwrite topics, create questions, or create tests.

Students, deleted users, and users without access cannot read runs, proposals,
nodes, node sources, warnings, or any internal index-review UI. Students only
see a Topic Map after it is explicitly applied and otherwise permitted.

## Persistence, Security, And Repositories

Add one migration through the runbook, named
`supabase/migrations/028_d_ai_syllabus_index_from_classified_documents.sql`,
only for missing/adapted schema. Reuse existing tables and names where possible;
do not make duplicate SPEC 019 tables. Cover runs, proposals, nodes, node
sources, and topic source references as required.

Add needed Supabase and InMemory repository support to the existing factory.
RLS and application guards must enforce workspace and opposition isolation.
Owner/admin/authorized manager access must be constrained to their workspace;
Student must have no access to internal proposal data. Do not expose
`SUPABASE_SERVICE_ROLE_KEY` to frontend code, frontend environment files, or
bundled assets.

## Required Tests

- Eligible primary classifications are selected; forbidden and uncorrected
  ambiguous classifications are excluded.
- A manually corrected usable document can be selected.
- Old exams are secondary context and cannot be the sole source of a node.
- Runs, proposals, topic/subtopic nodes, and node sources are persisted with
  workspace/opposition sealing.
- Invalid provider output is rejected for missing sources, foreign sources,
  forbidden documents, questions/options, and long-form syllabus content.
- Review lifecycle and explicit approval/application rules hold.
- Applying creates/reuses Topic Map nodes and topic-source references without
  deleting or duplicating existing topics.
- Student cannot list or access proposal internals; privileged users cannot
  cross workspace or opposition boundaries.
- Supabase and InMemory modes work, and mock-provider tests make no network
  calls.
- No new code path creates questions, tests, attempts, answers, OCR, RAG, or
  embeddings.

## Documentation And Acceptance

Create or update:

- `docs/architecture/ai-syllabus-index.md`
- `docs/user-guides/create-syllabus-index.md`
- `docs/qa/ai-syllabus-index-test-plan.md`
- `prompts/syllabus-index-from-classified-documents.md`

The implementation is complete when an authorized user can create a
source-grounded, reviewable index proposal from eligible classified documents,
approve it, and explicitly apply it to the Topic Map. Every topic/subtopic has
traceable primary evidence, no student sees internals, no proposal is applied
automatically, and no written syllabus, questions, or tests are generated.

## Instructions For Claude

Implement this spec by following `docs/setup/migrations-runbook.md` and the
existing repository/factory conventions. Preserve the SPEC 019 foundation and
the SPEC 028-B/028-C classification/section contracts. Keep the scope tightly
to source-grounded syllabus-index proposals, review, approval, and explicit
Topic Map application. Add focused tests and documentation, keep InMemory
fallback and Supabase RLS working, and never put the service-role key in the
frontend.
