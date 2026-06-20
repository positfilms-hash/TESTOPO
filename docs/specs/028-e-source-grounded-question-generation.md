# SPEC 028-E - Source-Grounded Question Generation

## Objective

Strengthen TESTOPO's existing question generation so candidate questions are
created from approved topics and concrete, traceable source fragments instead
of whole PDFs or ambiguous context.

Every generated question in this flow must retain its material, source excerpt,
topic, and, where available, material section and source-reference identifiers.
It remains a human-review workflow: AI never creates a `validated` question.

## Scope

Implement:

- Source retrieval for an approved Topic Map topic.
- Source-grounded generation by adapting the existing question-generation
  service and providers, rather than replacing them.
- Provider prompt, bounded source context, and strict output validation.
- Question and generation-run traceability for sections and source references.
- Existing automatic quality validation and admin review integration.
- Optional old-exam pattern context for style, coverage, and difficulty only.
- Supabase/RLS, application guards, InMemory fallback, focused UI, tests, and
  documentation.

Do not implement:

- Automatic validation, student test creation, or student publication.
- A written syllabus, OCR, RAG, embeddings, vector search/storage, or
  fine-tuning.
- A new question bank, duplicate generator, or a parallel migration process.

## Branch And Existing Foundation

Use:

```text
feature/source-grounded-question-generation
```

Follow `docs/setup/migrations-runbook.md`. Reuse and adapt the existing
`QuestionGenerationService`, providers, `QuestionGenerationRun`, question
repositories, validation service, feedback service, admin-review queue, and
Supabase factory wiring. Reuse SPEC 028-B classifications, SPEC 028-C
`MaterialSection`/`SourceReference`, and SPEC 028-D
`TopicSourceReference`/applied Topic Map data.

## Source Eligibility

The primary factual evidence for a generated question must come from an active,
approved, same-workspace, same-opposition source classified as:

- `syllabus_material`
- `legal_text`
- `notes_or_summary`
- `index_or_table_of_contents`

Use the following priority when generating from a topic:

1. `TopicSourceReference` for the applied topic.
2. Linked `SourceReference` and `MaterialSection`.
3. Eligible sections of material associated with the topic.
4. Basic text matching on the topic title within eligible sections.

`old_exam_or_test` and `ExamPatternSummary` may contribute secondary style,
difficulty, option-count, frequency, or coverage context. They cannot be the
only evidence for a topic or question and cannot be copied as questions.

Never use `irrelevant`, `not_analyzable`, obsolete, `needs_review`, or
uncorrected `ambiguous` documents. A manually corrected document may be used
only after its effective classification is an allowed one.

If no eligible primary source is found, fail with
`QUESTION_GENERATION_NO_SOURCES` or `QUESTION_GENERATION_SOURCE_REQUIRED` and
persist no candidate question.

## Retrieval And Generation Contract

Create `SourceRetrievalService` or an equivalent focused extension. It must
retrieve only sources sealed to the requested workspace and opposition and
support basic retrieval by topic, material, source ids, and plain-text matching.
It is not semantic/vector search.

Create `SourceGroundedQuestionGenerationService` or add a clearly separated
source-grounded entry point to the current service. Its input requires
`workspaceId`, `oppositionId`, `topicId`, difficulty, and a count from 1 to 20.
It supports `topic_sources` and, optionally, `manual_source_selection` using
selected source-reference/material-section ids. It must verify that the topic
is an active, applied topic accessible to the caller.

Do not send a full PDF unless it is exceptionally small and still represented
by its concrete sources. Prefer excerpts and sections. Recommended limits are:

```text
MAX_QUESTION_SOURCE_CHARS = 20000
MAX_QUESTION_SOURCE_REFERENCES = 20
MAX_GENERATED_QUESTIONS = 20
```

Prioritize approved/high-confidence primary sources and surface warnings when
input is trimmed. Feedback from existing human review can guide phrasing and
quality, but is never factual source material.

Create/update `prompts/source-grounded-question-generator.md`. It must require
structured output with statement, options, exactly one correct option, short
source-based explanation, difficulty, topic id, material id, optional material
section/source-reference ids, source excerpt, and warnings. It must forbid
external knowledge, invented claims, questions without sources, question copies
from old tests, and `validated` status.

## Persistence And Validation

Keep the existing `questions`, `question_options`,
`question_generation_runs`, and `question_validation_results` entities.
Add fields only when missing, through a minimal migration named
`028_e_source_grounded_question_generation.sql`:

- `questions.material_section_id`
- `questions.source_reference_id`
- `questions.topic_source_reference_id` when useful
- `question_generation_runs.source_strategy`
- `question_generation_runs.source_reference_ids`
- `question_generation_runs.material_section_ids`

Do not duplicate equivalent schema or tables. Each stored question must retain
`material_id`, `topic_id`, `source_excerpt`, and at least one valid concrete
source pointer (`source_reference_id`, `material_section_id`, or an equivalent
approved `TopicSourceReference`). Verify all pointers before persistence.

Reject malformed output: missing statement/options/explanation/source excerpt,
fewer than two options, anything except one correct answer, invalid difficulty,
foreign/missing/forbidden source, or a provider-proposed `validated` status.
Do not save candidates without a source. Candidates with valid evidence but
noncritical warnings may be saved as `needs_fix`.

Run existing automatic validation after creation. A passing candidate ends as
`pending_review`; one with critical validation failures ends as `needs_fix`.
`generated_by_ai`/generation metadata must be true/present and status must
never be `validated`. Only the existing human review can approve it.

## UI And Permissions

Authorized owner, admin, authorized manager, and premium owner in a personal
workspace can generate from a selected applied topic. The minimal UI shows the
selected topic, available sources, difficulty, count, optional manual selection,
and a clear no-source state. Generated candidates lead to the existing review
queue, where admins see source, excerpt, section/page where available, warnings,
and feedback context.

Student, deleted users, and users without opposition access cannot generate,
inspect generation runs, see pending-review/needs-fix questions, or view
internal source excerpts. Student-facing tests continue to select only
`validated` questions and reveal source details only according to existing
post-submission rules.

Apply equivalent application guards and Supabase RLS. Do not allow workspace or
opposition crossing. Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend
source, Vite variables, or browser bundles.

## Required Tests

- Retrieval finds topic sources/sections and excludes foreign, forbidden, and
  uncorrected ambiguous documents.
- Generation fails without an approved topic and concrete eligible source.
- Every persisted candidate has topic, material, source excerpt, and valid
  section/reference linkage; old exams alone cannot generate candidates.
- Old exams can influence only secondary style/coverage context.
- Output validation rejects missing structure, missing source excerpt, invalid
  difficulty, multiple correct answers, foreign source, and `validated` status.
- Generated candidates end only in `pending_review` or `needs_fix`; automatic
  validation never approves them.
- Human review still controls validation, and student cannot see internals or
  generate questions.
- Test creation still uses only validated questions.
- Supabase and InMemory paths work; unit tests use mock providers without
  network calls.
- No code path adds RAG, embeddings, OCR, questions from full ambiguous PDFs,
  or direct student tests.

## Documentation And Acceptance

Create or update:

- `docs/architecture/source-grounded-question-generation.md`
- `docs/user-guides/generate-questions.md`
- `docs/qa/source-grounded-question-generation-test-plan.md`
- `prompts/source-grounded-question-generator.md`

The work is complete when an authorized user can choose an applied topic with
eligible evidence and create traceable candidates, while a topic without
sources cannot produce a question. Each candidate stays pending human review,
students cannot access internals, tests use only validated questions, and
Supabase/RLS plus InMemory fallback remain intact.

## Instructions For Claude

Implement this spec by following the existing migration runbook and project
patterns. Reuse the generation, validation, feedback, review, and source layers
already present. Keep source grounding mandatory and validate workspace,
opposition, classification, and primary-source status before calling the AI and
again before saving. Do not broaden scope into written syllabus content,
questions without evidence, automatic validation, direct student tests, OCR,
RAG, embeddings, or frontend service-role credentials. Add focused backend and
frontend tests and run the relevant suites before reporting.
